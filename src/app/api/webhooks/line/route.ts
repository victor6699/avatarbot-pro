// POST /api/webhooks/line — LINE Messaging API Webhook
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/db/server'
import { ragChat } from '@/lib/rag/retrieval'
import crypto from 'crypto'

const LINE_API = 'https://api.line.me/v2/bot/message/reply'

function verifyLineSignature(body: string, signature: string, secret: string): boolean {
  const hash = crypto.createHmac('SHA256', secret).update(body).digest('base64')
  return hash === signature
}

async function replyToLine(replyToken: string, message: string, accessToken: string) {
  await fetch(LINE_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ replyToken, messages: [{ type: 'text', text: message }] }),
  })
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('x-line-signature') || ''

  // Find the LINE channel config that matches this signature
  const supabase = await createAdminClient()
  const { data: channels } = await supabase
    .from('channels')
    .select('*, chatbots(*)')
    .eq('type', 'line')
    .eq('status', 'active')

  if (!channels || channels.length === 0) {
    return NextResponse.json({ error: 'No active LINE channels' }, { status: 404 })
  }

  // Find matching channel by verifying signature
  let matchedChannel: typeof channels[0] | null = null
  for (const ch of channels) {
    const cfg = ch.config as any
    if (cfg?.channel_secret && verifyLineSignature(body, signature, cfg.channel_secret)) {
      matchedChannel = ch
      break
    }
  }

  if (!matchedChannel) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const payload = JSON.parse(body)
  const events = payload.events || []

  for (const event of events) {
    if (event.type !== 'message' || event.message.type !== 'text') continue

    const userMessage = event.message.text
    const lineUserId = event.source.userId
    const replyToken = event.replyToken
    const cfg = matchedChannel.config as any
    const chatbot = matchedChannel.chatbots as any

    // Get or create conversation
    const { data: existingConv } = await supabase
      .from('conversations')
      .select('id')
      .eq('chatbot_id', chatbot.id)
      .eq('channel_type', 'line')
      .eq('channel_user_id', lineUserId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    let convId = existingConv?.id
    if (!convId) {
      const { data: newConv } = await supabase.from('conversations').insert({
        chatbot_id: chatbot.id,
        tenant_id: chatbot.tenant_id,
        channel_type: 'line',
        channel_user_id: lineUserId,
        status: 'active',
      }).select('id').single()
      convId = newConv?.id
    }

    // Get recent history
    const { data: recentMessages } = await supabase
      .from('messages')
      .select('role, content')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: false })
      .limit(8)

    const history = (recentMessages || []).reverse().map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

    // Save user message
    await supabase.from('messages').insert({ conversation_id: convId, role: 'user', content: userMessage })

    // Run RAG
    const result = await ragChat(userMessage, chatbot, history)

    // Save assistant reply
    await supabase.from('messages').insert({
      conversation_id: convId, role: 'assistant', content: result.answer,
      confidence_score: result.confidence, tokens_used: result.tokensUsed,
    })

    // Reply on LINE
    await replyToLine(replyToken, result.answer, cfg.channel_access_token)
  }

  return NextResponse.json({ ok: true })
}
