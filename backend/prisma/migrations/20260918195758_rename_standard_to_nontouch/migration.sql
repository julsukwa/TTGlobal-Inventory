-- Data-only migration: rename the screenType value 'Standard' to 'Non-Touch'.
-- No schema change. Idempotent, and a no-op where no 'Standard' rows exist.
UPDATE "InventoryItem" SET "screenType" = 'Non-Touch' WHERE "screenType" = 'Standard';

-- Intentionally no "DropdownValue" update: screen types are not stored as a
-- DropdownValue category (no 'ScreenType' / 'Comment' category exists) — the
-- Touch Screen / Non-Touch options are a fixed list in the frontend.
