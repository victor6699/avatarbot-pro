-- ============================================================
-- AvatarBot Pro - Supabase Database Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- TENANTS (企業帳戶 - Multi-tenant core)
-- ============================================================
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,          -- subdomain / identifier
  plan TEXT NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter', 'growth', 'enterprise')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'trial')),
  monthly_quota INTEGER NOT NULL DEFAULT 2000,   -- max conversations/month
  used_quota INTEGER NOT NULL DEFAULT 0,
  settings JSONB NOT NULL DEFAULT '{}',          -- custom settings
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PROFILES (使用者資料 - extends Supabase auth.users)
-- ============================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CHATBOTS (機器人設定)
-- ============================================================
CREATE TABLE chatbots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'training')),

  -- AI Settings
  llm_model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  system_prompt TEXT,
  temperature FLOAT NOT NULL DEFAULT 0.3,
  confidence_threshold FLOAT NOT NULL DEFAULT 0.6,  -- below this → handoff to human
  max_tokens INTEGER NOT NULL DEFAULT 512,

  -- Persona Settings
  persona_name TEXT DEFAULT 'AI 助理',
  persona_tone TEXT NOT NULL DEFAULT 'professional' CHECK (persona_tone IN ('professional', 'friendly', 'formal', 'casual')),
  welcome_message TEXT DEFAULT '您好！我是 AI 客服助理，請問有什麼可以幫您的嗎？',
  fallback_message TEXT DEFAULT '抱歉，這個問題我需要請專人為您服務，稍後將有客服人員與您聯繫。',

  -- Live2D Avatar
  avatar_type TEXT NOT NULL DEFAULT 'template' CHECK (avatar_type IN ('template', 'custom', 'none')),
  avatar_template_id TEXT,               -- preset template key
  avatar_model_url TEXT,                 -- custom Live2D model URL
  avatar_voice_id TEXT,                  -- TTS voice preset

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CHANNELS (渠道設定: web / line / phone)
-- ============================================================
CREATE TABLE channels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chatbot_id UUID NOT NULL REFERENCES chatbots(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('web', 'line', 'phone')),
  status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive')),

  -- Channel-specific config stored as JSONB
  -- web:  { allowed_origins: [], primary_color, position }
  -- line: { channel_id, channel_secret, channel_access_token }
  -- phone: { twilio_sid, twilio_token, phone_number }
  config JSONB NOT NULL DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(chatbot_id, type)
);

-- ============================================================
-- KNOWLEDGE DOCUMENTS (知識文件)
-- ============================================================
CREATE TABLE knowledge_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chatbot_id UUID NOT NULL REFERENCES chatbots(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('file', 'url', 'manual')),
  source_url TEXT,                    -- original URL if crawled
  file_path TEXT,                     -- Supabase Storage path
  file_type TEXT,                     -- pdf, docx, txt, etc.
  file_size INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'indexed', 'failed')),
  chunk_count INTEGER DEFAULT 0,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- KNOWLEDGE CHUNKS (知識切片 + 向量)
-- ============================================================
CREATE TABLE knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  chatbot_id UUID NOT NULL REFERENCES chatbots(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  content TEXT NOT NULL,              -- raw text chunk
  embedding VECTOR(1536),             -- OpenAI text-embedding-3-small
  token_count INTEGER,
  chunk_index INTEGER NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vector similarity search index
CREATE INDEX knowledge_chunks_embedding_idx
  ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Full-text search index
CREATE INDEX knowledge_chunks_content_idx ON knowledge_chunks USING GIN (to_tsvector('simple', content));

-- ============================================================
-- CONVERSATIONS (對話記錄)
-- ============================================================
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chatbot_id UUID NOT NULL REFERENCES chatbots(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  channel_type TEXT NOT NULL CHECK (channel_type IN ('web', 'line', 'phone')),
  channel_user_id TEXT,               -- LINE userId / phone number / session id
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'handoff', 'abandoned')),
  resolution TEXT,                    -- how it ended
  handoff_reason TEXT,
  satisfaction_score INTEGER CHECK (satisfaction_score BETWEEN 1 AND 5),
  message_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MESSAGES (對話訊息)
-- ============================================================
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  confidence_score FLOAT,             -- AI confidence for this reply
  retrieved_chunks JSONB,             -- which knowledge chunks were used
  tokens_used INTEGER,
  latency_ms INTEGER,                 -- response time
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- API INTEGRATIONS (企業 API 串接)
-- ============================================================
CREATE TABLE api_integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chatbot_id UUID NOT NULL REFERENCES chatbots(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  base_url TEXT NOT NULL,
  auth_type TEXT NOT NULL DEFAULT 'bearer' CHECK (auth_type IN ('none', 'bearer', 'api_key', 'basic')),
  -- Credentials stored encrypted (never return in API responses)
  credentials_encrypted TEXT,
  endpoints JSONB DEFAULT '[]',       -- array of { name, path, method, description, params }
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- USAGE LOGS (用量統計)
-- ============================================================
CREATE TABLE usage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  chatbot_id UUID REFERENCES chatbots(id),
  event_type TEXT NOT NULL,           -- 'conversation', 'message', 'knowledge_index', etc.
  tokens_used INTEGER DEFAULT 0,
  cost_usd FLOAT DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Partition by month for performance
CREATE INDEX usage_logs_tenant_date ON usage_logs (tenant_id, created_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbots ENABLE ROW LEVEL SECURITY;
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user's tenant_id
CREATE OR REPLACE FUNCTION get_user_tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER;

-- RLS Policies: users can only see their own tenant's data
CREATE POLICY "tenant_isolation" ON tenants FOR ALL USING (id = get_user_tenant_id());
CREATE POLICY "tenant_isolation" ON profiles FOR ALL USING (tenant_id = get_user_tenant_id());
CREATE POLICY "tenant_isolation" ON chatbots FOR ALL USING (tenant_id = get_user_tenant_id());
CREATE POLICY "tenant_isolation" ON channels FOR ALL USING (tenant_id = get_user_tenant_id());
CREATE POLICY "tenant_isolation" ON knowledge_documents FOR ALL USING (tenant_id = get_user_tenant_id());
CREATE POLICY "tenant_isolation" ON knowledge_chunks FOR ALL USING (tenant_id = get_user_tenant_id());
CREATE POLICY "tenant_isolation" ON conversations FOR ALL USING (tenant_id = get_user_tenant_id());
CREATE POLICY "tenant_isolation" ON messages FOR SELECT USING (
  conversation_id IN (SELECT id FROM conversations WHERE tenant_id = get_user_tenant_id())
);
CREATE POLICY "tenant_isolation" ON api_integrations FOR ALL USING (tenant_id = get_user_tenant_id());
CREATE POLICY "tenant_isolation" ON usage_logs FOR SELECT USING (tenant_id = get_user_tenant_id());

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tenants_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER chatbots_updated_at BEFORE UPDATE ON chatbots FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER channels_updated_at BEFORE UPDATE ON channels FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER documents_updated_at BEFORE UPDATE ON knowledge_documents FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER integrations_updated_at BEFORE UPDATE ON api_integrations FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile when user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant_id UUID;
  v_tenant_name TEXT;
  v_tenant_slug TEXT;
BEGIN
  -- Create tenant from user metadata
  v_tenant_name := COALESCE(NEW.raw_user_meta_data->>'company_name', split_part(NEW.email, '@', 2));
  v_tenant_slug := lower(regexp_replace(v_tenant_name, '[^a-zA-Z0-9]', '-', 'g')) || '-' || substr(NEW.id::text, 1, 6);

  INSERT INTO tenants (name, slug) VALUES (v_tenant_name, v_tenant_slug)
  RETURNING id INTO v_tenant_id;

  INSERT INTO profiles (id, tenant_id, full_name, role)
  VALUES (NEW.id, v_tenant_id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), 'owner');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Increment conversation message count
CREATE OR REPLACE FUNCTION increment_message_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations SET message_count = message_count + 1 WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER messages_count AFTER INSERT ON messages FOR EACH ROW EXECUTE FUNCTION increment_message_count();

-- ============================================================
-- VECTOR SEARCH FUNCTION (RAG 核心)
-- ============================================================
CREATE OR REPLACE FUNCTION match_knowledge_chunks(
  query_embedding VECTOR(1536),
  chatbot_id_param UUID,
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    kc.id,
    kc.content,
    kc.metadata,
    1 - (kc.embedding <=> query_embedding) AS similarity
  FROM knowledge_chunks kc
  WHERE
    kc.chatbot_id = chatbot_id_param
    AND 1 - (kc.embedding <=> query_embedding) > match_threshold
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Supabase Storage Buckets (run separately in dashboard)
-- ============================================================
-- INSERT INTO storage.buckets (id, name, public) VALUES ('knowledge-docs', 'knowledge-docs', false);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('live2d-models', 'live2d-models', false);
