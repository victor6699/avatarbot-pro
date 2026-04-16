'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Bot, BookOpen, Puzzle,
  BarChart2, Settings, Zap, MessageSquare
} from 'lucide-react'

const nav = [
  { label: '總覽', href: '/dashboard', icon: LayoutDashboard },
  { label: 'AI 機器人', href: '/chatbot', icon: Bot },
  { label: '知識庫', href: '/knowledge', icon: BookOpen },
  { label: '渠道設定', href: '/channels', icon: Zap },
  { label: '對話記錄', href: '/conversations', icon: MessageSquare },
  { label: '數據分析', href: '/analytics', icon: BarChart2 },
  { label: 'API 整合', href: '/integrations', icon: Puzzle },
  { label: '帳戶設定', href: '/settings', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()
  return (
    <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
      {/* Logo */}
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-gray-900 text-sm">AvatarBot Pro</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5">
        {nav.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link key={href} href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                active
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}>
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Plan badge */}
      <div className="p-4 border-t border-gray-100">
        <div className="bg-blue-50 rounded-lg p-3 text-center">
          <p className="text-xs text-blue-700 font-medium">入門版方案</p>
          <p className="text-xs text-blue-500 mt-0.5">1,234 / 2,000 對話</p>
          <Link href="/settings/billing" className="block mt-2 text-xs text-blue-600 hover:underline">升級方案 →</Link>
        </div>
      </div>
    </aside>
  )
}
