-- ============================================================================
-- Step-up (face re-authentication) tickets
-- ----------------------------------------------------------------------------
-- Short-lived, single-use proofs that a user re-scanned their face immediately
-- before a highly sensitive action. Stores only the SHA256 of the raw token.
-- ============================================================================
CREATE TABLE IF NOT EXISTS "StepUpTicket" (
  "id"         TEXT NOT NULL,
  "tokenHash"  TEXT NOT NULL,
  "userId"     TEXT NOT NULL,
  "action"     TEXT NOT NULL,
  "resourceId" TEXT,
  "ip"         TEXT,
  "expiresAt"  TIMESTAMP(3) NOT NULL,
  "usedAt"     TIMESTAMP(3),
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StepUpTicket_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StepUpTicket_tokenHash_key" ON "StepUpTicket"("tokenHash");
CREATE INDEX IF NOT EXISTS "StepUpTicket_userId_idx" ON "StepUpTicket"("userId");
CREATE INDEX IF NOT EXISTS "StepUpTicket_action_idx" ON "StepUpTicket"("action");
CREATE INDEX IF NOT EXISTS "StepUpTicket_expiresAt_idx" ON "StepUpTicket"("expiresAt");

-- FK to User (best-effort; skip if it already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StepUpTicket_userId_fkey'
  ) THEN
    ALTER TABLE "StepUpTicket"
      ADD CONSTRAINT "StepUpTicket_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
