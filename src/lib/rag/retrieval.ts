import OpenAI from 'openai'
import { createAdminClient } from '@/lib/db/server'
import { generateEmbedding } from '@/lib/openai/embeddings'
import type { Chatbot } from '@/types/database'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'dummy_key_to_bypass_build_error' })

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface RAGResult {
  answer: string
  confidence: number
  retrievedChunks: { id: string; content: string; similarity: number }[]
  tokensUsed: number
  shouldHandoff: boolean
}

// ── Main RAG Chat Function ──────────────────────────────────────────────────
export async function ragChat(
  question: string,
  chatbot: Chatbot,
  conversationHistory: ChatMessage[] = []
): Promise<RAGResult> {
  const supabase = await createAdminClient()
  const startTime = Date.now()

  // 1. Generate embedding for the question
  const queryEmbedding = await generateEmbedding(question)

  // 2. Search knowledge base via pgvector
  const { data: chunks, error } = await supabase.rpc('match_knowledge_chunks', {
    query_embedding: queryEmbedding,
    chatbot_id_param: chatbot.id,
    match_threshold: chatbot.confidence_threshold,
    match_count: 5,
  })

  if (error) throw new Error(`Vector search failed: ${error.message}`)

  const hasContext = chunks && chunks.length > 0
  const confidence = hasContext ? Math.max(...chunks.map((c: any) => c.similarity)) : 0

  // 3. Build system prompt with retrieved context
  const contextSection = hasContext
    ? `\n\n以下是相關知識庫內容，請根據此內容回答：\n\n${chunks.map((c: any, i: number) => `[${i + 1}] ${c.content}`).join('\n\n')}`
    : ''

  const toneMap: Record<string, string> = {
    professional: '請使用專業、清晰的語氣回答',
    friendly: '請使用親切、友善的語氣回答',
    formal: '請使用正式、嚴謹的語氣回答',
    casual: '請使用輕鬆、口語化的語氣回答',
  }

  const systemPrompt = [
    chatbot.system_prompt || `你是 ${chatbot.persona_name}，一個專業的 AI 客服助理。`,
    toneMap[chatbot.persona_tone] || toneMap.professional,
    '只根據提供的知識庫內容回答問題。如果知識庫沒有相關資訊，請誠實告知無法回答，不要捏造資訊。',
    '回答請使用繁體中文，保持簡潔清晰（不超過 200 字）。',
    contextSection,
  ].filter(Boolean).join('\n')

  // 4. Call LLM with context
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-8).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user', content: question },
  ]

  const completion = await openai.chat.completions.create({
    model: chatbot.llm_model || 'gpt-4o-mini',
    messages,
    temperature: chatbot.temperature,
    max_tokens: chatbot.max_tokens,
  })

  const answer = completion.choices[0]?.message?.content || chatbot.fallback_message
  const tokensUsed = completion.usage?.total_tokens || 0

  // 5. Decide if should handoff to human
  const shouldHandoff = !hasContext || confidence < chatbot.confidence_threshold

  return {
    answer: shouldHandoff && !hasContext ? chatbot.fallback_message : answer,
    confidence,
    retrievedChunks: (chunks || []).map((c: any) => ({ id: c.id, content: c.content, similarity: c.similarity })),
    tokensUsed,
    shouldHandoff,
  }
}
