-- CreateTable
CREATE TABLE "ListingBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "scheduledAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "fbPostUrl" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ListingBatch_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ListingBatchGroup" (
    "batchId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL,

    PRIMARY KEY ("batchId", "groupId"),
    CONSTRAINT "ListingBatchGroup_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ListingBatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ListingBatchGroup_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Campaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "mediaFiles" TEXT NOT NULL DEFAULT '[]',
    "mediaType" TEXT NOT NULL DEFAULT 'none',
    "scheduledAt" DATETIME NOT NULL,
    "recurrence" TEXT,
    "jitterMinutes" INTEGER NOT NULL DEFAULT 15,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'post',
    "listingKind" TEXT,
    "propertyType" TEXT,
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "priceBaht" INTEGER,
    "location" TEXT,
    "squareMetres" INTEGER,
    "batchDelayMinMs" INTEGER,
    "batchDelayMaxMs" INTEGER,
    CONSTRAINT "Campaign_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Campaign" ("completedAt", "content", "createdAt", "id", "jitterMinutes", "lastError", "mediaFiles", "mediaType", "recurrence", "scheduledAt", "startedAt", "status", "title", "updatedAt", "userId") SELECT "completedAt", "content", "createdAt", "id", "jitterMinutes", "lastError", "mediaFiles", "mediaType", "recurrence", "scheduledAt", "startedAt", "status", "title", "updatedAt", "userId" FROM "Campaign";
DROP TABLE "Campaign";
ALTER TABLE "new_Campaign" RENAME TO "Campaign";
CREATE TABLE "new_Setting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "delayBetweenGroupsMinMs" INTEGER NOT NULL DEFAULT 180000,
    "delayBetweenGroupsMaxMs" INTEGER NOT NULL DEFAULT 600000,
    "delayBeforePostMinMs" INTEGER NOT NULL DEFAULT 1000,
    "delayBeforePostMaxMs" INTEGER NOT NULL DEFAULT 3000,
    "delayAfterFocusMinMs" INTEGER NOT NULL DEFAULT 500,
    "delayAfterFocusMaxMs" INTEGER NOT NULL DEFAULT 1500,
    "maxRetryPerGroup" INTEGER NOT NULL DEFAULT 2,
    "retryDelayMinMs" INTEGER NOT NULL DEFAULT 60000,
    "retryDelayMaxMs" INTEGER NOT NULL DEFAULT 180000,
    "stopAfterConsecutiveFailures" INTEGER NOT NULL DEFAULT 3,
    "delayBetweenBatchesMinMs" INTEGER NOT NULL DEFAULT 1800000,
    "delayBetweenBatchesMaxMs" INTEGER NOT NULL DEFAULT 3600000,
    "maxBatchesPerDay" INTEGER NOT NULL DEFAULT 5,
    "enableMouseMove" BOOLEAN NOT NULL DEFAULT true,
    "enableScrollBeforePost" BOOLEAN NOT NULL DEFAULT true,
    "enableJitter" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Setting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Setting" ("delayAfterFocusMaxMs", "delayAfterFocusMinMs", "delayBeforePostMaxMs", "delayBeforePostMinMs", "delayBetweenGroupsMaxMs", "delayBetweenGroupsMinMs", "enableJitter", "enableMouseMove", "enableScrollBeforePost", "id", "maxRetryPerGroup", "retryDelayMaxMs", "retryDelayMinMs", "stopAfterConsecutiveFailures", "userId") SELECT "delayAfterFocusMaxMs", "delayAfterFocusMinMs", "delayBeforePostMaxMs", "delayBeforePostMinMs", "delayBetweenGroupsMaxMs", "delayBetweenGroupsMinMs", "enableJitter", "enableMouseMove", "enableScrollBeforePost", "id", "maxRetryPerGroup", "retryDelayMaxMs", "retryDelayMinMs", "stopAfterConsecutiveFailures", "userId" FROM "Setting";
DROP TABLE "Setting";
ALTER TABLE "new_Setting" RENAME TO "Setting";
CREATE UNIQUE INDEX "Setting_userId_key" ON "Setting"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ListingBatch_status_scheduledAt_idx" ON "ListingBatch"("status", "scheduledAt");
