-- AI Assistant v2 tables
CREATE TABLE public.assistant_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sitter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_assistant_convos_sitter ON public.assistant_conversations(sitter_id, last_message_at DESC);

ALTER TABLE public.assistant_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sitters access their own conversations"
  ON public.assistant_conversations
  FOR ALL
  TO authenticated
  USING (sitter_id = auth.uid())
  WITH CHECK (sitter_id = auth.uid());

CREATE TABLE public.assistant_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.assistant_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'tool', 'system')),
  content text,
  tool_calls jsonb,
  tool_call_id text,
  tool_name text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_assistant_messages_convo ON public.assistant_messages(conversation_id, created_at);

ALTER TABLE public.assistant_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sitters access messages in their conversations"
  ON public.assistant_messages
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.assistant_conversations c
      WHERE c.id = conversation_id AND c.sitter_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.assistant_conversations c
      WHERE c.id = conversation_id AND c.sitter_id = auth.uid()
    )
  );

CREATE TABLE public.assistant_pending_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.assistant_conversations(id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.assistant_messages(id) ON DELETE CASCADE,
  sitter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  action_summary text NOT NULL,
  action_payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'failed', 'expired')),
  result jsonb,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '1 hour'),
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pending_actions_sitter ON public.assistant_pending_actions(sitter_id, status, created_at DESC);

ALTER TABLE public.assistant_pending_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sitters access their own pending actions"
  ON public.assistant_pending_actions
  FOR ALL
  TO authenticated
  USING (sitter_id = auth.uid())
  WITH CHECK (sitter_id = auth.uid());