-- Create transactions table for storing Tranzila payment records
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,

  -- Tranzila transaction details
  confirmation_code TEXT,
  response_code TEXT,
  amount DECIMAL(10, 2),
  currency TEXT DEFAULT '1', -- 1=NIS, 2=USD, etc.
  transaction_type TEXT, -- A=Standard, V=Verification, etc.
  transaction_index TEXT,
  token TEXT, -- Tranzila token for future charges

  -- Card details (partial, for reference only)
  last_4_digits TEXT,
  card_expiry TEXT,
  credit_type TEXT,

  -- Additional info
  description TEXT,
  status TEXT DEFAULT 'pending', -- pending, success, failed
  transaction_data JSONB, -- Store full Tranzila response

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_event_id ON public.transactions(event_id);
CREATE INDEX IF NOT EXISTS idx_transactions_confirmation_code ON public.transactions(confirmation_code);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Create policies for RLS
-- Users can view their own transactions
CREATE POLICY "Users can view own transactions"
  ON public.transactions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own transactions
CREATE POLICY "Users can insert own transactions"
  ON public.transactions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- System can insert transactions (for API callbacks)
-- Note: You may need to adjust this based on your auth setup
CREATE POLICY "Service role can insert transactions"
  ON public.transactions
  FOR INSERT
  WITH CHECK (true);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Grant permissions (adjust based on your needs)
GRANT SELECT, INSERT ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;

COMMENT ON TABLE public.transactions IS 'Stores payment transaction records from Tranzila';
COMMENT ON COLUMN public.transactions.confirmation_code IS 'Tranzila confirmation code for successful transactions';
COMMENT ON COLUMN public.transactions.response_code IS 'Tranzila response code (000 = success)';
COMMENT ON COLUMN public.transactions.amount IS 'Transaction amount in the specified currency';
COMMENT ON COLUMN public.transactions.token IS 'Tranzila token for recurring/future charges';
COMMENT ON COLUMN public.transactions.transaction_data IS 'Full JSON response from Tranzila for reference';
