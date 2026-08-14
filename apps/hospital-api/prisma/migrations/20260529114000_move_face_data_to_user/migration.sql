ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "faceEmbedding" TEXT,
  ADD COLUMN IF NOT EXISTS "faceHash" TEXT;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'AdminProfile') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'AdminProfile' AND column_name = 'faceEmbedding') THEN
      EXECUTE '
        UPDATE "User" u
        SET
          "faceEmbedding" = COALESCE(u."faceEmbedding", ap."faceEmbedding"),
          "faceHash" = COALESCE(u."faceHash", ap."faceHash")
        FROM "AdminProfile" ap
        WHERE ap."userId" = u.id;

        ALTER TABLE "AdminProfile"
          DROP COLUMN IF EXISTS "faceEmbedding",
          DROP COLUMN IF EXISTS "faceHash";
      ';
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'StaffProfile') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'StaffProfile' AND column_name = 'faceEmbedding') THEN
      EXECUTE '
        UPDATE "User" u
        SET
          "faceEmbedding" = COALESCE(u."faceEmbedding", sp."faceEmbedding"),
          "faceHash" = COALESCE(u."faceHash", sp."faceHash")
        FROM "StaffProfile" sp
        WHERE sp."userId" = u.id;

        ALTER TABLE "StaffProfile"
          DROP COLUMN IF EXISTS "faceEmbedding",
          DROP COLUMN IF EXISTS "faceHash";
      ';
    END IF;
  END IF;
END $$;
