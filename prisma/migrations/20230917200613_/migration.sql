/*
  Warnings:

  - A unique constraint covering the columns `[playlistId,youtubeVideoId]` on the table `Song` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Song_playlistId_youtubeVideoId_key" ON "Song"("playlistId", "youtubeVideoId");
