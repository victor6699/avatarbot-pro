import { createClient } from '@/lib/supabase/server'
import { MessageSquare, Bot, BookOpen, TrendingUp, Users, Clock } from 'lucide-react'
import Link from 'next/link'
import { formatNumber } from '@/lib/utils'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: chatbots }, { data: conversations }, { data: documents }] = await Promise.all([
    supabase.from('chatbots').select('id, name, status').limit(5),
    supabase.from('conversations').select('id, status, channel_type, created_at').gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
    supabase.from('knowledge_documents').select('id, status'),
  ])

  const stats = {
    totalConversations: conversations?.length || 0,
    activeChatbots: chatbots?.filter(b => b.status === 'active').length || 0,
    indexedDocs: documents?.filter(d => d.status === 'indexed').length || 0,
    resolvedRate: conversations?.length
      ? Math.round((conversations.filter(c => c.status === 'resolved').length / conversations.length) * 100)
      : 0,
  }

  const statCards = [
    { label: '本月對話數', value: formatNumber(stats.totalConversations), icon: MessageSquare, color: 'blue', link: '/conversations' },
    { label: '啟用機器人', value: stats.activeChatbots, icon: Bot, color: 'green', link: '/chatbot' },
    { label: '知識文件數', value: stats.indexedDocs, icon: BookOpen, color: 'purple', link: '/knowledge' },
    { label: '問題解決率', value: `${stats.resolvedRate}%`, icon: TrendingUp, color: 'orange', link: '/analytics' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">總覽</h1>
        <p className="text-gray-500 text-sm mt-1">歡迎回來！以下是過去 30 天的服務概況。</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color, link }) => (
          <Link key={label} href={link} className="card p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500">{label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
              </div>
              <div className={`p-2 rounded-lg bg-${color}-50`}>
                <Icon className={`w-5 h-5 text-${color}-600`} />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent Chatbots */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">我的機器人</h2>
            <Link href="/chatbot" className="text-xs text-blue-600 hover:underline">查看全部</Link>
          </div>
          {chatbots && chatbots.length > 0 ? (
            <div className="space-y-3">
              {chatbots.map(bot => (
                <div key={bot.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <Bot className="w-4 h-4 text-blue-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-800">{bot.name}</span>
                  </div>
                  <span className={`badge ${bot.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {bot.status === 'active' ? '運行中' : '未啟用'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Bot className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">還沒有機器人</p>
              <Link href="/chatbot/new" className="btn-primary mt-3 text-xs px-3 py-1.5">建立第一個機器人</Link>
            </div>
          )}
        </div>

        {/* Quick Start Guide */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-4">快速開始</h2>
          <div className="space-y-3">
            {[
              { step: '1', text: '建立您的 AI 機器人', link: '/chatbot/new', done: (chatbots?.length || 0) > 0 },
              { step: '2', text: '上傳公司知識文件', link: '/knowledge', done: (documents?.length || 0) > 0 },
              { step: '3', text: '設定渠道（Web/LINE）', link: '/channels', done: false },
              { step: '4', text: '測試並啟用服務', link: '/chatbot', done: stats.activeChatbots > 0 },
            ].map(({ step, text, link, done }) => (
              <Link key={step} href={link} className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${done ? 'bg-green-50' : 'bg-gray-50 hover:bg-blue-50'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${done ? 'bg-green-500 text-white' : 'bg-blue-600 text-white'}`}>
                  {done ? '✓' : step}
                </div>
                <span className={`text-sm ${done ? 'text-green-700 line-through' : 'text-gray-700'}`}>{text}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
