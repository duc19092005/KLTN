-- Add soft-delete status for departments.
-- INACTIVE means hidden/disabled but still visible in admin lists.
-- DELETE means soft-deleted and excluded from normal department lists.
ALTER TYPE "OperationalStatus" ADD VALUE IF NOT EXISTS 'DELETE';
