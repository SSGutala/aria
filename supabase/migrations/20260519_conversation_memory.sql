-- Add memory/summary column to conversations for cross-conversation context
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS memory JSONB DEFAULT NULL;

-- Index for fast per-user memory lookups
CREATE INDEX IF NOT EXISTS conversations_user_memory_idx
  ON conversations (user_id, updated_at DESC)
  WHERE memory IS NOT NULL;
