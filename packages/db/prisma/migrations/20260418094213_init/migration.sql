-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "sessionPath" TEXT,
    "sessionValid" BOOLEAN NOT NULL DEFAULT false,
    "sessionChecked" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "fbGroupId" TEXT NOT NULL,
    "fbUrl" TEXT NOT NULL,
    "name" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT NOT NULL,
    "lastPosted" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Group_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Campaign" (
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
    CONSTRAINT "Campaign_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CampaignGroup" (
    "campaignId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    PRIMARY KEY ("campaignId", "groupId"),
    CONSTRAINT "CampaignGroup_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CampaignGroup_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PostLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "error" TEXT,
    "fbPostUrl" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PostLog_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PostLog_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Setting" (
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
    "enableMouseMove" BOOLEAN NOT NULL DEFAULT true,
    "enableScrollBeforePost" BOOLEAN NOT NULL DEFAULT true,
    "enableJitter" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Setting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Group_userId_fbGroupId_key" ON "Group"("userId", "fbGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "Setting_userId_key" ON "Setting"("userId");
