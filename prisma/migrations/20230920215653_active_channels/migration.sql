/*
  Warnings:

  - Added the required column `active` to the `WatchedChannel` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WatchedChannel" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "channelId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL
);
INSERT INTO "new_WatchedChannel" ("channelId", "id") SELECT "channelId", "id" FROM "WatchedChannel";
DROP TABLE "WatchedChannel";
ALTER TABLE "new_WatchedChannel" RENAME TO "WatchedChannel";
CREATE UNIQUE INDEX "WatchedChannel_channelId_key" ON "WatchedChannel"("channelId");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
