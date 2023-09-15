import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const playlists = sqliteTable(
  'playlists',
  {
    id: integer('id').primaryKey(),
    type: text('type', { enum: ['server', 'channel', 'manual'] }),
    name: text('name').notNull().unique(),
    youtubePlaylistId: text('youtube_playlist_id'),
  },
  (playlists) => ({
    nameIdx: uniqueIndex('nameIdx').on(playlists.name),
  })
);
