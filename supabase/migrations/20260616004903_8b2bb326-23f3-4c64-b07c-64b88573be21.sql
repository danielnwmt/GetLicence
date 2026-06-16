-- Restrict Realtime subscriptions: only admins can subscribe to system_updates topic
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can subscribe to system_updates" ON realtime.messages;
CREATE POLICY "Admins can subscribe to system_updates"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  (realtime.topic() LIKE 'system_updates%' AND public.has_role(auth.uid(), 'admin'::app_role))
  OR (realtime.topic() NOT LIKE 'system_updates%')
);

DROP POLICY IF EXISTS "Admins can broadcast to system_updates" ON realtime.messages;
CREATE POLICY "Admins can broadcast to system_updates"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  (realtime.topic() LIKE 'system_updates%' AND public.has_role(auth.uid(), 'admin'::app_role))
  OR (realtime.topic() NOT LIKE 'system_updates%')
);