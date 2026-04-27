-- Reduce default inter-batch delay from 30–60 min to 5–10 min.
-- Schema-level @default changes don't affect existing rows; we explicitly
-- update users who are still on the old defaults so they pick up the new
-- behaviour without having to edit the Settings page.
-- Users with custom values (anything other than the old defaults) are left
-- alone.

UPDATE "Setting"
SET "delayBetweenBatchesMinMs" = 300000,
    "delayBetweenBatchesMaxMs" = 600000
WHERE "delayBetweenBatchesMinMs" = 1800000
  AND "delayBetweenBatchesMaxMs" = 3600000;
