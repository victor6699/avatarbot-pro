import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'dummy_key_to_bypass_build_error' })

const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small'
const EMBEDDING_DIMENSIONS = 1536

export async function generateEmbedding(text: string): Promise<number[]> {
  const cleaned = text.replace(/\n+/g, ' ').trim()
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: cleaned,
    dimensions: EMBEDDING_DIMENSIONS,
  })
  return response.data[0].embedding
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const cleaned = texts.map(t => t.replace(/\n+/g, ' ').trim())
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: cleaned,
    dimensions: EMBEDDING_DIMENSIONS,
  })
  return response.data.map(d => d.embedding)
}

// Split document text into overlapping chunks
export function chunkText(text: string, chunkSize = 800, overlap = 100): string[] {
  const words = text.split(/\s+/)
  const chunks: string[] = []
  let i = 0
  while (i < words.length) {
    const chunk = words.slice(i, i + chunkSize).join(' ')
    if (chunk.trim()) chunks.push(chunk.trim())
    i += chunkSize - overlap
  }
  return chunks
}
