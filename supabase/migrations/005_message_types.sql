-- Expand message_type check constraint to include all card types used by the app
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_message_type_check;

ALTER TABLE messages
  ADD CONSTRAINT messages_message_type_check
  CHECK (message_type IN (
    'text',
    'clarification',
    'clarification_v2',
    'build_mode',
    'spec',
    'enterprise_brief',
    'app_card',
    'confirmation',
    'error'
  ));
