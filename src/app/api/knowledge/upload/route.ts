// POST /api/knowledge/upload — Upload & index knowledge documents
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/db/server'
import { generateEmbeddings, chunkText } from '@/lib/openai/embeddings'

export const maxDuration = 60 // Vercel/Render max timeout

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const adminSupabase = await createAdminClient()

    // Auth check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const chatbotId = formData.get('chatbot_id') as string
    const title = formData.get('title') as string || file?.name || 'Untitled'

    if (!file || !chatbotId) {
      return NextResponse.json({ error: 'file and chatbot_id required' }, { status: 400 })
    }

    // Get tenant_id from profile
    const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single()
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    // 1. Upload file to Supabase Storage
    const fileBuffer = await file.arrayBuffer()
    const filePath = `${profile.tenant_id}/${chatbotId}/${Date.now()}_${file.name}`
    const { error: uploadError } = await adminSupabase.storage
      .from('knowledge-docs')
      .upload(filePath, fileBuffer, { contentType: file.type })

    if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`)

    // 2. Create document record
    const { data: doc, error: docError } = await supabase
      .from('knowledge_documents')
      .insert({
        chatbot_id: chatbotId,
        tenant_id: profile.tenant_id,
        title,
        source_type: 'file',
        file_path: filePath,
        file_type: file.name.split('.').pop()?.toLowerCase(),
        file_size: file.size,
        status: 'processing',
      })
      .select()
      .single()

    if (docError) throw new Error(`Document insert failed: ${docError.message}`)

    // 3. Extract text from file
    let text = ''
    const fileType = file.name.split('.').pop()?.toLowerCase()

    if (fileType === 'txt') {
      text = await file.text()
    } else if (fileType === 'pdf') {
      const pdfParse = (await import('pdf-parse')).default
      text = (await pdfParse(Buffer.from(fileBuffer))).text
    } else if (fileType === 'docx') {
      const mammoth = await import('mammoth')
      text = (await mammoth.extractRawText({ buffer: Buffer.from(fileBuffer) })).value
    } else {
      // Try reading as plain text
      text = await file.text()
    }

    if (!text.trim()) {
      await supabase.from('knowledge_documents').update({ status: 'failed', error_message: 'Could not extract text' }).eq('id', doc.id)
      return NextResponse.json({ error: 'Could not extract text from file' }, { status: 422 })
    }

    // 4. Chunk text
    const chunks = chunkText(text, 800, 100)

    // 5. Generate embeddings in batches
    const BATCH = 20
    const allEmbeddings: number[][] = []
    for (let i = 0; i < chunks.length; i += BATCH) {
      const batch = chunks.slice(i, i + BATCH)
      const embeddings = await generateEmbeddings(batch)
      allEmbeddings.push(...embeddings)
    }

    // 6. Insert chunks with embeddings
    const chunkRows = chunks.map((content, i) => ({
      document_id: doc.id,
      chatbot_id: chatbotId,
      tenant_id: profile.tenant_id,
      content,
      embedding: allEmbeddings[i],
      chunk_index: i,
      token_count: Math.ceil(content.length / 4),
    }))

    // Insert in batches to avoid request size limits
    for (let i = 0; i < chunkRows.length; i += 50) {
      await adminSupabase.from('knowledge_chunks').insert(chunkRows.slice(i, i + 50))
    }

    // 7. Mark document as indexed
    await supabase.from('knowledge_documents').update({
      status: 'indexed',
      chunk_count: chunks.length,
    }).eq('id', doc.id)

    return NextResponse.json({
      success: true,
      document_id: doc.id,
      chunks_created: chunks.length,
    })
  } catch (err: any) {
    console.error('[Upload Error]', err)
    return NextResponse.json({ error: err.message || 'Upload failed' }, { status: 500 })
  }
}
