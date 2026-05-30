-- ============================================================
-- Encryption key rotation reset
-- Wipes data encrypted with the old ENCRYPTION_KEY so users
-- can re-enroll under the new key.
-- Tokens signed with the old JWT_SECRET become invalid automatically.
-- ============================================================

BEGIN;

-- 1. Non-admin staff: keep account, force re-enroll face on next login.
UPDATE "User"
SET
  "faceEmbedding"          = NULL,
  "faceHash"               = NULL,
  "faceModelVersion"       = NULL,
  "faceEnrolledAt"         = NULL,
  "faceSampleCount"        = NULL,
  "faceChallenge"          = NULL,
  "faceChallengeExpiresAt" = NULL,
  "failedFaceAttempts"     = 0,
  "faceLockedUntil"        = NULL,
  "registrationStep"       = 1,
  "firstLogin"             = TRUE,
  "tokenVersion"           = "tokenVersion" + 1
WHERE role <> 'ADMIN';

-- 2. Admin: full re-bootstrap (face + wallet + recovery secret all gone).
UPDATE "User"
SET
  "faceEmbedding"          = NULL,
  "faceHash"               = NULL,
  "faceModelVersion"       = NULL,
  "faceEnrolledAt"         = NULL,
  "faceSampleCount"        = NULL,
  "faceChallenge"          = NULL,
  "faceChallengeExpiresAt" = NULL,
  "failedFaceAttempts"     = 0,
  "faceLockedUntil"        = NULL,
  "status"                 = 'PENDING',
  "firstLogin"             = TRUE,
  "registrationStep"       = 1,
  "tokenVersion"           = "tokenVersion" + 1,
  "inviteToken"            = :'invite_hash',
  "inviteTokenExpiry"      = NOW() + INTERVAL '7 days'
WHERE role = 'ADMIN';

-- 3. Admin profile: clear wallet binding + recovery secret + outstanding nonces.
UPDATE "AdminProfile"
SET
  "walletAddress"  = NULL,
  "mfaSecret"      = NULL,
  "nonce"          = NULL,
  "noncePurpose"   = NULL,
  "nonceExpiresAt" = NULL;

-- 4. AI models: invalidate API credentials (encrypted with old key).
--    Existing AiDiagnosis rows are preserved; admin must re-attach a key
--    or recreate the model entries before generating new analyses.
UPDATE "AiModelRegistry"
SET
  "ipHashEncrypted"  = 'ROTATED_KEY_INVALIDATED',
  "ipHashPlain"      = NULL,
  "apiEndpoint"      = NULL,
  "isActiveOnChain"  = FALSE;

-- 5. Audit log entry for traceability.
INSERT INTO "AuditLog" ("id", "actorId", "action", "entity", "entityId", "metadata", "createdAt")
VALUES (
  gen_random_uuid(),
  NULL,
  'KEY_ROTATION',
  'System',
  NULL,
  jsonb_build_object('reason', 'Manual ENCRYPTION_KEY/JWT_SECRET rotation', 'rotatedAt', NOW()::text),
  NOW()
);

COMMIT;
