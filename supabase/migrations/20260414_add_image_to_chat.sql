-- Add image_url to booking_messages for photo support
ALTER TABLE booking_messages ADD COLUMN image_url text;

-- Ensure message can be NULL if image_url is present
ALTER TABLE booking_messages ALTER COLUMN message DROP NOT NULL;

-- Keep a message or image_url as a requirement
ALTER TABLE booking_messages ADD CONSTRAINT message_or_image CHECK (message IS NOT NULL OR image_url IS NOT NULL);
