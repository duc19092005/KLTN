ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "faceEmbedding" TEXT,
  ADD COLUMN IF NOT EXISTS "faceHash" TEXT;

DO $$
BEGIN
  IF to_regclass('public."AdminProfile"') IS NOT NULL THEN
    UPDATE "User" u
    SET
      "faceEmbedding" = COALESCE(u."faceEmbedding", ap."faceEmbedding"),
      "faceHash" = COALESCE(u."faceHash", ap."faceHash")
    FROM "AdminProfile" ap
    WHERE ap."userId" = u.id;

    ALTER TABLE "AdminProfile"
      DROP COLUMN IF EXISTS "faceEmbedding",
      DROP COLUMN IF EXISTS "faceHash";
  END IF;
END $$;
