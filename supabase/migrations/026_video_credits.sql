-- Credit-model change for the video pivot.
--
-- New model: the IMAGE transform is free (it's the always-available
-- fallback); a VIDEO costs 2 credits. New signups get 2 credits = exactly
-- one free video. Image-only creates spend nothing.
--
-- This migration:
--   1. New-signup grant 3 → 2 (one free video).
--   2. Widens the credit_transactions.reason CHECK to allow video reasons
--      (the just-shipped clip path used 'clip', which the old CHECK would
--      have REJECTED — latent bug, fixed here by standardizing on 'video').
--   3. Adds spend_credits / refund_credits that move N credits atomically
--      (a video costs 2; the old spend_credit only ever moved 1).

-- 1. One free video for new accounts.
ALTER TABLE profiles ALTER COLUMN credits SET DEFAULT 2;

-- 2. Allow video credit reasons.
ALTER TABLE credit_transactions DROP CONSTRAINT IF EXISTS credit_transactions_reason_check;
ALTER TABLE credit_transactions ADD CONSTRAINT credit_transactions_reason_check
  CHECK (reason IN ('signup_grant','transform','refund','purchase','admin_grant','video','video_refund'));

-- 3. Multi-credit spend/refund.
CREATE OR REPLACE FUNCTION spend_credits(p_user_id uuid, p_amount int, p_reason text)
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
    SET credits = credits - p_amount
    WHERE id = p_user_id AND credits >= p_amount
    RETURNING credits INTO new_balance;

  IF new_balance IS NULL THEN
    RETURN -1;  -- insufficient credits
  END IF;

  INSERT INTO credit_transactions (user_id, delta, reason)
    VALUES (p_user_id, -p_amount, p_reason);

  RETURN new_balance;
END;
$$;

CREATE OR REPLACE FUNCTION refund_credits(p_user_id uuid, p_amount int, p_reason text)
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

  INSERT INTO credit_transactions (user_id, delta, reason)
    VALUES (p_user_id, p_amount, p_reason);

  RETURN new_balance;
END;
$$;

REVOKE ALL ON FUNCTION spend_credits(uuid, int, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION refund_credits(uuid, int, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION spend_credits(uuid, int, text) TO service_role;
GRANT EXECUTE ON FUNCTION refund_credits(uuid, int, text) TO service_role;
