-- Credits: monetization via generation packs.
-- Every new profile gets 3 free credits. Each AI transform spends 1.
-- Atomic spend/refund via SECURITY DEFINER functions called from the edge function.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS credits int NOT NULL DEFAULT 3;

CREATE TABLE IF NOT EXISTS credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delta int NOT NULL,
  reason text NOT NULL CHECK (reason IN ('signup_grant','transform','refund','purchase','admin_grant')),
  piece_id uuid NULL REFERENCES pieces(id) ON DELETE SET NULL,
  stripe_payment_intent text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS credit_transactions_user_idx
  ON credit_transactions(user_id, created_at DESC);

ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own credit transactions" ON credit_transactions;
CREATE POLICY "own credit transactions" ON credit_transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION spend_credit(p_user_id uuid, p_reason text DEFAULT 'transform')
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_balance int;
BEGIN
  UPDATE profiles
    SET credits = credits - 1
    WHERE id = p_user_id AND credits > 0
    RETURNING credits INTO new_balance;

  IF new_balance IS NULL THEN
    RETURN -1;
  END IF;

  INSERT INTO credit_transactions (user_id, delta, reason)
    VALUES (p_user_id, -1, p_reason);

  RETURN new_balance;
END;
$$;

CREATE OR REPLACE FUNCTION refund_credit(p_user_id uuid, p_reason text DEFAULT 'refund')
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_balance int;
BEGIN
  UPDATE profiles
    SET credits = credits + 1
    WHERE id = p_user_id
    RETURNING credits INTO new_balance;

  INSERT INTO credit_transactions (user_id, delta, reason)
    VALUES (p_user_id, 1, p_reason);

  RETURN new_balance;
END;
$$;

CREATE OR REPLACE FUNCTION grant_credits(p_user_id uuid, p_amount int, p_reason text, p_stripe_payment_intent text DEFAULT NULL)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_balance int;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be positive';
  END IF;

  UPDATE profiles
    SET credits = credits + p_amount
    WHERE id = p_user_id
    RETURNING credits INTO new_balance;

  INSERT INTO credit_transactions (user_id, delta, reason, stripe_payment_intent)
    VALUES (p_user_id, p_amount, p_reason, p_stripe_payment_intent);

  RETURN new_balance;
END;
$$;

REVOKE ALL ON FUNCTION spend_credit(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION refund_credit(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION grant_credits(uuid, int, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION spend_credit(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION refund_credit(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION grant_credits(uuid, int, text, text) TO service_role;
