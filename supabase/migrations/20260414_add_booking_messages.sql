-- ─── Per-Order Chat: booking_messages ────────────────────────
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS booking_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id text NOT NULL,
    sender_type text NOT NULL CHECK (sender_type IN ('customer', 'staff', 'admin')),
    sender_id text NOT NULL,
    sender_name text,
    message text NOT NULL,
    is_read boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

-- Index for fast fetching per booking
CREATE INDEX IF NOT EXISTS idx_booking_messages_booking_id
    ON booking_messages(booking_id, created_at DESC);

-- Enable RLS
ALTER TABLE booking_messages ENABLE ROW LEVEL SECURITY;

-- Allow public reads (booking by id is opaque enough; adjust if you need stricter auth)
CREATE POLICY "Public can read messages by booking_id"
    ON booking_messages FOR SELECT
    USING (true);

-- Allow inserts from anon (we validate sender_id in the API route)
CREATE POLICY "Public can insert messages"
    ON booking_messages FOR INSERT
    WITH CHECK (true);

-- Enable Realtime on the table (run in Supabase dashboard or via REST)
-- ALTER PUBLICATION supabase_realtime ADD TABLE booking_messages;
