// Auto-generate this with: npx supabase gen types typescript --project-id your-project-id
// For now, using manual type definitions

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type PlanType = 'starter' | 'growth' | 'enterprise'
export type StatusType = 'active' | 'inactive' | 'suspended' | 'trial'
export type ChannelType = 'web' | 'line' | 'phone'
export type PersonaTone = 'professional' | 'friendly' | 'formal' | 'casual'
export type MessageRole = 'user' | 'assistant' | 'system'
export type ConversationStatus = 'active' | 'resolved' | 'handoff' | 'abandoned'
export type DocumentStatus = 'pending' | 'processing' | 'indexed' | 'failed'
export type AvatarType = 'template' | 'custom' | 'none'

export interface Tenant {
  id: string
  name: string
  slug: string
  plan: PlanType
  status: StatusType
  monthly_quota: number
  used_quota: number
  settings: Json
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  tenant_id: string
  full_name: string | null
  role: 'owner' | 'admin' | 'member'
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface Chatbot {
  id: string
  tenant_id: string
  name: string
  description: string | null
  status: 'active' | 'inactive' | 'training'
  llm_model: string
  system_prompt: string | null
  temperature: number
  confidence_threshold: number
  max_tokens: number
  persona_name: string
  persona_tone: PersonaTone
  welcome_message: string
  fallback_message: string
  avatar_type: AvatarType
  avatar_template_id: string | null
  avatar_model_url: string | null
  avatar_voice_id: string | null
  created_at: string
  updated_at: string
}

export interface Channel {
  id: string
  chatbot_id: string
  tenant_id: string
  type: ChannelType
  status: 'active' | 'inactive'
  config: Json
  created_at: string
  updated_at: string
}

export interface KnowledgeDocument {
  id: string
  chatbot_id: string
  tenant_id: string
  title: string
  source_type: 'file' | 'url' | 'manual'
  source_url: string | null
  file_path: string | null
  file_type: string | null
  file_size: number | null
  status: DocumentStatus
  chunk_count: number
  error_message: string | null
  metadata: Json
  created_at: string
  updated_at: string
}

export interface KnowledgeChunk {
  id: string
  document_id: string
  chatbot_id: string
  tenant_id: string
  content: string
  chunk_index: number
  token_count: number | null
  metadata: Json
  created_at: string
}

export interface Conversation {
  id: string
  chatbot_id: string
  tenant_id: string
  channel_type: ChannelType
  channel_user_id: string | null
  status: ConversationStatus
  resolution: string | null
  handoff_reason: string | null
  satisfaction_score: number | null
  message_count: number
  metadata: Json
  started_at: string
  ended_at: string | null
  created_at: string
}

export interface Message {
  id: string
  conversation_id: string
  role: MessageRole
  content: string
  confidence_score: number | null
  retrieved_chunks: Json | null
  tokens_used: number | null
  latency_ms: number | null
  metadata: Json
  created_at: string
}

// Supabase Database type for typed client
export type Database = {
  public: {
    Tables: {
      tenants: { Row: Tenant; Insert: Partial<Tenant>; Update: Partial<Tenant> }
      profiles: { Row: Profile; Insert: Partial<Profile>; Update: Partial<Profile> }
      chatbots: { Row: Chatbot; Insert: Partial<Chatbot>; Update: Partial<Chatbot> }
      channels: { Row: Channel; Insert: Partial<Channel>; Update: Partial<Channel> }
      knowledge_documents: { Row: KnowledgeDocument; Insert: Partial<KnowledgeDocument>; Update: Partial<KnowledgeDocument> }
      knowledge_chunks: { Row: KnowledgeChunk; Insert: Partial<KnowledgeChunk>; Update: Partial<KnowledgeChunk> }
      conversations: { Row: Conversation; Insert: Partial<Conversation>; Update: Partial<Conversation> }
      messages: { Row: Message; Insert: Partial<Message>; Update: Partial<Message> }
    }
    Functions: {
      match_knowledge_chunks: {
        Args: { query_embedding: number[]; chatbot_id_param: string; match_threshold?: number; match_count?: number }
        Returns: { id: string; content: string; metadata: Json; similarity: number }[]
      }
    }
  }
}
