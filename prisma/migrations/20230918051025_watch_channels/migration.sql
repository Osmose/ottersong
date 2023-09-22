/*
  Warnings:

  - You are about to drop the column `type` on the `Playlist` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "WatchedChannel" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "channelId" TEXT NOT NULL
);

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Playlist" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "youtubePlaylistId" TEXT,
    "watchedChannelId" INTEGER,
    CONSTRAINT "Playlist_watchedChannelId_fkey" FOREIGN KEY ("watchedChannelId") REFERENCES "WatchedChannel" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Playlist" ("id", "name", "youtubePlaylistId") SELECT "id", "name", "youtubePlaylistId" FROM "Playlist";
DROP TABLE "Playlist";
ALTER TABLE "new_Playlist" RENAME TO "Playlist";
CREATE UNIQUE INDEX "Playlist_name_key" ON "Playlist"("name");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;

-- CreateIndex
CREATE UNIQUE INDEX "WatchedChannel_channelId_key" ON "WatchedChannel"("channelId");
