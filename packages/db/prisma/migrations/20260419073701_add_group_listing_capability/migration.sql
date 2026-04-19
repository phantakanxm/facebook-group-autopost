-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Group" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "fbGroupId" TEXT NOT NULL,
    "fbUrl" TEXT NOT NULL,
    "name" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT NOT NULL,
    "lastPosted" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supportsListing" BOOLEAN NOT NULL DEFAULT false,
    "listingScannedAt" DATETIME,
    CONSTRAINT "Group_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Group" ("createdAt", "fbGroupId", "fbUrl", "id", "isActive", "lastPosted", "name", "source", "userId") SELECT "createdAt", "fbGroupId", "fbUrl", "id", "isActive", "lastPosted", "name", "source", "userId" FROM "Group";
DROP TABLE "Group";
ALTER TABLE "new_Group" RENAME TO "Group";
CREATE UNIQUE INDEX "Group_userId_fbGroupId_key" ON "Group"("userId", "fbGroupId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
