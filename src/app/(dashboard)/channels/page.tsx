'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/db/client'
import { Globe, MessageCircle, Phone, Copy, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ChannelsPage() {
  const supabase = createClient()
  const [chatbots, setChatbots] = useState<{ id: string; name: string }[]>([])
  const [selectedBot, setSelectedBot] = useState('')
  const [copied, setCopied] = useState(false)
  const [lineConfig, setLineConfig] = useState({ channel_id: '', channel_secret: '', channel_access_token: '' })
  const [saving, setSaving] = useState(false)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const widgetCode = selectedBot ? `<script src="${appUrl}/api/widget/${selectedBot}"></script>` : ''
  const webhookUrl = `${appUrl}/api/webhooks/line`

  useEffect(() => {
    supabase.from('chatbots').select('id, name').then(({ data }) => {
      if (data && data.length > 0) { 
        setChatbots(data as any); 
        setSelectedBot((data as any)[0].id) 
      }
    })
  }, [])

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    setCopied(true); toast.success('已複製！')
    setTimeout(() => setCopied(false), 2000)
  }

  async function saveLineChannel() {
    if (!selectedBot || !lineConfig.channel_secret || !lineConfig.channel_access_token) {
      toast.error('請填寫所有 LINE 設定'); return
    }
    setSaving(true)
    const { data: profile } = await (supabase as any).from('profiles').select('tenant_id').single()
    const { error } = await (supabase as any).from('channels').upsert({
      chatbot_id: selectedBot,
      tenant_id: profile?.tenant_id,
      type: 'line',
      status: 'active',
      config: lineConfig,
    }, { onConflict: 'chatbot_id,type' })
    if (error) toast.error('儲存失敗：' + error.message)
    else toast.success('LINE 渠道已設定完成！')
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">渠道設定</h1>
        <p className="text-gray-500 text-sm mt-1">設定對話渠道，讓客戶可以在各平台與您的 AI 互動</p>
      </div>

      {chatbots.length > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">選擇機器人：</span>
          <select className="input w-auto" value={selectedBot} onChange={e => setSelectedBot(e.target.value)}>
            {chatbots.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      )}

      <div className="grid gap-5">
        {/* Web Widget */}
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <Globe className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">網站嵌入 Widget</h2>
              <p className="text-xs text-gray-500">複製程式碼貼到您網站的 &lt;body&gt; 標籤前</p>
            </div>
            <span className="ml-auto badge bg-green-100 text-green-700">立即可用</span>
          </div>
          <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm text-green-400 relative">
            <pre className="whitespace-pre-wrap break-all">{widgetCode || '請先選擇機器人'}</pre>
            {widgetCode && (
              <button onClick={() => copyToClipboard(widgetCode)}
                className="absolute top-3 right-3 p-1.5 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 transition-colors">
                {copied ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>

        {/* LINE */}
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">LINE 官方帳號</h2>
              <p className="text-xs text-gray-500">整合 LINE Messaging API，讓客戶透過 LINE 詢問</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="bg-yellow-50 rounded-lg p-3 text-sm text-yellow-700">
              <strong>Webhook URL（貼到 LINE 後台）：</strong><br />
              <code className="text-xs break-all">{webhookUrl}</code>
              <button onClick={() => copyToClipboard(webhookUrl)} className="ml-2 text-yellow-600 hover:underline text-xs">複製</button>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Channel ID</label>
              <input className="input" placeholder="12345678" value={lineConfig.channel_id} onChange={e => setLineConfig(c => ({ ...c, channel_id: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Channel Secret</label>
              <input className="input" type="password" placeholder="••••••••" value={lineConfig.channel_secret} onChange={e => setLineConfig(c => ({ ...c, channel_secret: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Channel Access Token</label>
              <input className="input" type="password" placeholder="••••••••" value={lineConfig.channel_access_token} onChange={e => setLineConfig(c => ({ ...c, channel_access_token: e.target.value }))} />
            </div>
            <button onClick={saveLineChannel} className="btn-primary" disabled={saving}>
              {saving ? '儲存中...' : '儲存 LINE 設定'}
            </button>
          </div>
        </div>

        {/* Phone (coming soon) */}
        <div className="card p-6 opacity-60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
              <Phone className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">電話 IVR <span className="badge bg-gray-100 text-gray-500 ml-2">即將推出</span></h2>
              <p className="text-xs text-gray-500">整合 Twilio，提供語音 AI 客服（成長版以上）</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
