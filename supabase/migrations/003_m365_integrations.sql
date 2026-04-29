-- M365 OAuth connections (one per user)
CREATE TABLE IF NOT EXISTS m365_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  tenant_id TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  email TEXT,
  display_name TEXT,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Document templates (linked to generated apps)
CREATE TABLE IF NOT EXISTS document_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  app_id UUID REFERENCES generated_apps(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  template_type TEXT DEFAULT 'docx',  -- 'docx' | 'html' | 'markdown'
  template_content TEXT,              -- base64 for docx, raw text otherwise
  field_mappings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS policies
ALTER TABLE m365_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own M365 connection"
  ON m365_connections FOR ALL
  USING (auth.uid() = user_id);

ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own templates"
  ON document_templates FOR ALL
  USING (auth.uid() = user_id);

-- Service key bypass (for server-side token refresh)
CREATE POLICY "Service role bypass m365"
  ON m365_connections FOR ALL
  TO service_role
  USING (true);

CREATE POLICY "Service role bypass templates"
  ON document_templates FOR ALL
  TO service_role
  USING (true);
