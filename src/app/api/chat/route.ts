// POST /api/chat  — Core AI chat endpoint (used by Web Widget & internal)
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/db/server'
import { ragChat, type ChatMessage } from '@/lib/rag/retrieval'

export async function POST(req: NextRequest) {
  try {
    const { message, chatbot_id, conversation_id, history = [] } = await req.json()

    if (!message || !chatbot_id) {
      return NextResponse.json({ error: 'message and chatbot_id are required' }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // 1. Fetch chatbot config
    const { data: chatbot, error: botError } = await supabase
      .from('chatbots')
      .select('*')
      .eq('id', chatbot_id)
      .eq('status', 'active')
      .single()

    if (botError || !chatbot) {
      return NextResponse.json({ error: 'Chatbot not found or inactive' }, { status: 404 })
    }

    // 2. Resolve or create conversation
    let convId = conversation_id
    if (!convId) {
      const { data: conv } = await supabase
        .from('conversations')
        .insert({
          chatbot_id,
          tenant_id: chatbot.tenant_id,
          channel_type: 'web',
          status: 'active',
        })
        .select('id')
        .single()
      convId = conv?.id
    }

    // 3. Save user message
    await supabase.from('messages').insert({
      conversation_id: convId,
      role: 'user',
      content: message,
    })

    // 4. Run RAG
    const startTime = Date.now()
    const result = await ragChat(message, chatbot, history as ChatMessage[])
    const latency = Date.now() - startTime

    // 5. Save assistant message
    await supabase.from('messages').insert({
      conversation_id: convId,
      role: 'assistant',
      content: result.answer,
      confidence_score: result.confidence,
      retrieved_chunks: result.retrievedChunks,
      tokens_used: result.tokensUsed,
      latency_ms: latency,
    })

    // 6. Update conversation status if handoff needed
    if (result.shouldHandoff) {
      await supabase.from('conversations').update({ status: 'handoff', handoff_reason: 'low_confidence' }).eq('id', convId)
    }

    // 7. Log usage
    await supabase.from('usage_logs').insert({
      tenant_id: chatbot.tenant_id,
      chatbot_id,
      event_type: 'message',
      tokens_used: result.tokensUsed,
    })

    return NextResponse.json({
      answer: result.answer,
      conversation_id: convId,
      confidence: result.confidence,
      should_handoff: result.shouldHandoff,
    })
  } catch (err: any) {
    console.error('[Chat API Error]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
