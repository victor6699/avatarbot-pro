'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/db/client'
import toast from 'react-hot-toast'
import { Bot } from 'lucide-react'

export default function RegisterPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ full_name: '', company_name: '', email: '', password: '' })

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (form.password.length < 8) { toast.error('密碼至少需要 8 個字元'); return }
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { full_name: form.full_name, company_name: form.company_name },
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    })
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('註冊成功！請查收確認信件')
      router.push('/login')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl mb-4">
            <Bot className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">AvatarBot Pro</h1>
          <p className="text-gray-500 text-sm mt-1">免費試用 14 天，無需信用卡</p>
        </div>
        <div className="card p-8">
          <h2 className="text-xl font-semibold mb-6">建立您的帳戶</h2>
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">您的姓名</label>
                <input className="input" placeholder="王小明" value={form.full_name} onChange={set('full_name')} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">公司名稱</label>
                <input className="input" placeholder="OO 股份有限公司" value={form.company_name} onChange={set('company_name')} required />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">電子郵件</label>
              <input type="email" className="input" placeholder="you@company.com" value={form.email} onChange={set('email')} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">密碼 <span className="text-gray-400 font-normal">（至少 8 個字元）</span></label>
              <input type="password" className="input" placeholder="••••••••" value={form.password} onChange={set('password')} required />
            </div>
            <button type="submit" className="btn-primary w-full py-2.5" disabled={loading}>
              {loading ? '建立中...' : '免費開始使用'}
            </button>
          </form>
          <p className="text-center text-sm text-gray-500 mt-6">
            已有帳戶？ <Link href="/login" className="text-blue-600 hover:underline font-medium">立即登入</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
