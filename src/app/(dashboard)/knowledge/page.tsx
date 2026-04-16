'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Upload, FileText, Trash2, RefreshCw, CheckCircle, AlertCircle, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import type { KnowledgeDocument } from '@/types/database'

export default function KnowledgePage() {
  const supabase = createClient()
  const [docs, setDocs] = useState<KnowledgeDocument[]>([])
  const [chatbots, setChatbots] = useState<{ id: string; name: string }[]>([])
  const [selectedBot, setSelectedBot] = useState('')
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('chatbots').select('id, name').then(({ data }) => {
      if (data) { setChatbots(data); if (data.length > 0) setSelectedBot(data[0].id) }
    })
  }, [])

  useEffect(() => {
    if (!selectedBot) return
    setLoading(true)
    supabase.from('knowledge_documents').select('*').eq('chatbot_id', selectedBot).order('created_at', { ascending: false })
      .then(({ data }) => { setDocs(data || []); setLoading(false) })
  }, [selectedBot])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !selectedBot) return
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('chatbot_id', selectedBot)
    fd.append('title', file.name)
    try {
      const res = await fetch('/api/knowledge/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (res.ok) {
        toast.success(`上傳成功，已建立 ${data.chunks_created} 個知識切片`)
        supabase.from('knowledge_documents').select('*').eq('chatbot_id', selectedBot).order('created_at', { ascending: false })
          .then(({ data }) => setDocs(data || []))
      } else { toast.error(data.error || '上傳失敗') }
    } catch { toast.error('上傳時發生錯誤') }
    setUploading(false)
    e.target.value = ''
  }

  async function handleDelete(id: string) {
    if (!confirm('確定要刪除這份文件及其所有知識切片？')) return
    const { error } = await supabase.from('knowledge_documents').delete().eq('id', id)
    if (error) { toast.error('刪除失敗') } else {
      toast.success('已刪除'); setDocs(d => d.filter(doc => doc.id !== id))
    }
  }

  const statusIcon = (status: string) => ({
    indexed: <CheckCircle className="w-4 h-4 text-green-500" />,
    processing: <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />,
    pending: <Clock className="w-4 h-4 text-gray-400" />,
    failed: <AlertCircle className="w-4 h-4 text-red-500" />,
  })[status] || null

  const statusLabel = (status: string) => ({ indexed: '已建立索引', processing: '處理中', pending: '等待中', failed: '失敗' })[status] || status

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">知識庫</h1>
          <p className="text-gray-500 text-sm mt-1">上傳文件讓 AI 學習您的公司知識</p>
        </div>
        <label className={`btn-primary cursor-pointer ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
          <Upload className="w-4 h-4" />
          {uploading ? '上傳中...' : '上傳文件'}
          <input type="file" className="hidden" accept=".pdf,.docx,.txt" onChange={handleUpload} disabled={uploading || !selectedBot} />
        </label>
      </div>

      {/* Bot selector */}
      {chatbots.length > 1 && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">選擇機器人：</span>
          <select className="input w-auto" value={selectedBot} onChange={e => setSelectedBot(e.target.value)}>
            {chatbots.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      )}

      {/* Upload tips */}
      <div className="card p-4 bg-blue-50 border-blue-100">
        <p className="text-sm text-blue-700 font-medium">支援格式：PDF、Word (.docx)、純文字 (.txt)</p>
        <p className="text-xs text-blue-600 mt-1">建議上傳：FAQ 文件、產品說明書、服務流程、常見問題解答等</p>
      </div>

      {/* Documents list */}
      <div className="card">
        {loading ? (
          <div className="p-12 text-center text-gray-400">載入中...</div>
        ) : docs.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">尚未上傳任何文件</p>
            <p className="text-sm text-gray-400 mt-1">上傳 PDF 或 Word 文件，AI 將自動學習其內容</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="border-b border-gray-100">
              <tr className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                <th className="px-5 py-3 text-left">文件名稱</th>
                <th className="px-5 py-3 text-left">狀態</th>
                <th className="px-5 py-3 text-left">切片數</th>
                <th className="px-5 py-3 text-left">上傳時間</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {docs.map(doc => (
                <tr key={doc.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="text-sm font-medium text-gray-800">{doc.title}</span>
                      {doc.file_type && <span className="badge bg-gray-100 text-gray-500">.{doc.file_type}</span>}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      {statusIcon(doc.status)}
                      <span className="text-xs text-gray-600">{statusLabel(doc.status)}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-600">{doc.chunk_count || '-'}</td>
                  <td className="px-5 py-3 text-xs text-gray-400">{new Date(doc.created_at).toLocaleDateString('zh-TW')}</td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => handleDelete(doc.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
