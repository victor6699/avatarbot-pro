# AvatarBot Pro — AI 客服機器人 SaaS 平台

技術棧：**Next.js 14** + **Supabase** + **OpenAI GPT-4o** + **Render**

---

## 快速開始（本地開發）

### 1. 安裝依賴
```bash
npm install
```

### 2. 設定環境變數
```bash
cp .env.example .env.local
# 編輯 .env.local，填入所有必要金鑰
```

### 3. 建立 Supabase 資料庫
1. 登入 [Supabase Dashboard](https://app.supabase.com)
2. 建立新 Project
3. 進入 **SQL Editor**，複製並執行 `supabase/migrations/001_initial_schema.sql`
4. 進入 **Storage** → 建立三個 Bucket：
   - `knowledge-docs`（Private）
   - `avatars`（Public）
   - `live2d-models`（Private）
5. 複製 Project URL 和 API Keys 填入 `.env.local`

### 4. 啟動開發伺服器
```bash
npm run dev
# 開啟 http://localhost:3000
```

---

## 部署到 Render

### 方法一：使用 render.yaml（推薦）
1. 將專案 Push 到 GitHub
2. 登入 [Render Dashboard](https://dashboard.render.com)
3. New → **Blueprint** → 選擇您的 GitHub Repo
4. Render 自動讀取 `render.yaml` 設定
5. 在 Render Dashboard 填入以下環境變數：
   ```
   NEXT_PUBLIC_APP_URL=https://your-app.onrender.com
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   OPENAI_API_KEY=...
   LINE_CHANNEL_SECRET=...（選填）
   LINE_CHANNEL_ACCESS_TOKEN=...（選填）
   ```

### 方法二：手動建立 Web Service
1. New → **Web Service**
2. Connect GitHub Repo
3. Settings：
   - **Runtime**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Region**: Singapore（亞洲低延遲）

---

## 專案結構

```
avatarbot-pro/
├── src/
│   ├── app/
│   │   ├── (auth)/           # 登入、註冊頁
│   │   ├── (dashboard)/      # 管理後台（需登入）
│   │   │   ├── dashboard/    # 總覽首頁
│   │   │   ├── chatbot/      # 機器人管理
│   │   │   ├── knowledge/    # 知識庫管理
│   │   │   ├── channels/     # 渠道設定（Web/LINE/電話）
│   │   │   └── settings/     # 帳戶設定
│   │   └── api/
│   │       ├── chat/         # AI 對話核心 API
│   │       ├── knowledge/    # 知識庫上傳與索引
│   │       ├── webhooks/line/# LINE Webhook 處理
│   │       └── widget/[botId]# 可嵌入聊天視窗腳本
│   ├── lib/
│   │   ├── supabase/         # Supabase client（前端/後端）
│   │   ├── openai/           # Embedding 生成
│   │   └── rag/              # RAG 檢索 + LLM 回答引擎
│   └── types/                # TypeScript 類型定義
├── supabase/
│   └── migrations/           # SQL Schema
├── render.yaml               # Render 部署設定
└── .env.example              # 環境變數範本
```

---

## 核心 API 端點

| Method | Path | 說明 |
|--------|------|------|
| POST | `/api/chat` | AI 對話（Widget & 內部使用）|
| POST | `/api/knowledge/upload` | 上傳並索引知識文件 |
| GET  | `/api/widget/[botId]` | 取得可嵌入的聊天 JS |
| POST | `/api/webhooks/line` | LINE Webhook 接收 |
| GET  | `/api/health` | Health check |

---

## 嵌入 Web Chat Widget

在您客戶的網站 `</body>` 前加入：
```html
<script src="https://your-app.onrender.com/api/widget/YOUR_BOT_ID"></script>
```

---

## 下一步開發建議

- [ ] 機器人建立/編輯頁面（`/chatbot/new`、`/chatbot/[id]`）
- [ ] 對話記錄頁面（`/conversations`）
- [ ] 即時對話監控（Supabase Realtime）
- [ ] Live2D 形象代言人整合（Cubism SDK）
- [ ] 電話 IVR（Twilio Voice API）
- [ ] 計費系統（Stripe）
- [ ] 進階分析報表

---

## 技術架構

```
用戶瀏覽器 / LINE / 電話
        ↓
  Render (Next.js 14)
  ├── App Router (Server Components)
  ├── API Routes (Edge/Node runtime)
  └── Middleware (Auth guards)
        ↓
  Supabase
  ├── PostgreSQL (主資料庫)
  ├── pgvector (向量相似度搜尋)
  ├── Auth (JWT + RLS)
  ├── Storage (文件儲存)
  └── Realtime (即時對話推送)
        ↓
  OpenAI API
  ├── text-embedding-3-small (向量化)
  └── gpt-4o-mini (對話生成)
```
