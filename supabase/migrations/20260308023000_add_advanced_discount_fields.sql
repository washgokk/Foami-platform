-- Add advanced fields to discount_codes table
ALTER TABLE discount_codes 
ADD COLUMN max_discount_amount NUMERIC(10,2),
ADD COLUMN max_uses_per_customer INTEGER,
ADD COLUMN target_segment TEXT;

-- Create a table to track discount usage per customer
CREATE TABLE discount_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    discount_code_id UUID REFERENCES discount_codes(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    discount_amount NUMERIC(10,2) NOT NULL,
    used_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup of customer usage
CREATE INDEX idx_discount_usage_customer ON discount_usage(customer_id, discount_code_id);
