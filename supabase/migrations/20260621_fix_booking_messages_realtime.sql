-- ─── Fix: booking_messages realtime + message nullable ──────────
-- Run this in Supabase SQL editor to fix the chat feature

-- 1. Ensure the table exists (idempotent)
CREATE TABLE IF NOT EXISTS booking_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id text NOT NULL,
    sender_type text NOT NULL CHECK (sender_type IN ('customer', 'staff', 'admin')),
    sender_id text NOT NULL,
    sender_name text,
    message text,
    image_url text,
    is_read boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

-- 2. Make message nullable (if it was NOT NULL from original migration)
ALTER TABLE booking_messages ALTER COLUMN message DROP NOT NULL;

-- 3. Add image_url column if missing
ALTER TABLE booking_messages ADD COLUMN IF NOT EXISTS image_url text;

-- 4. Add the CHECK constraint (message OR image_url must be present)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'message_or_image' AND conrelid = 'booking_messages'::regclass
    ) THEN
        ALTER TABLE booking_messages
            ADD CONSTRAINT message_or_image CHECK (message IS NOT NULL OR image_url IS NOT NULL);
    END IF;
END $$;

-- 5. Enable RLS
ALTER TABLE booking_messages ENABLE ROW LEVEL SECURITY;

-- 6. Ensure RLS policies exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'booking_messages' AND policyname = 'Public can read messages by booking_id'
    ) THEN
        CREATE POLICY "Public can read messages by booking_id"
            ON booking_messages FOR SELECT
            USING (true);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'booking_messages' AND policyname = 'Public can insert messages'
    ) THEN
        CREATE POLICY "Public can insert messages"
            ON booking_messages FOR INSERT
            WITH CHECK (true);
    END IF;
END $$;

-- 7. Add booking_messages to Supabase realtime publication (CRITICAL for real-time chat)
ALTER PUBLICATION supabase_realtime ADD TABLE booking_messages;

-- 8. Create index if not exists
CREATE INDEX IF NOT EXISTS idx_booking_messages_booking_id
    ON booking_messages(booking_id, created_at DESC);
