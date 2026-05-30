-- Biometric security: anti-replay challenge, lockout, and enrollment metadata
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "faceModelVersion" TEXT,
  ADD COLUMN IF NOT EXISTS "faceEnrolledAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "faceSampleCount" INTEGER,
  ADD COLUMN IF NOT EXISTS "faceChallenge" TEXT,
  ADD COLUMN IF NOT EXISTS "faceChallengeExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "failedFaceAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "faceLockedUntil" TIMESTAMP(3);
