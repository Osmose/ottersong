import { Song, PrismaClient, Playlist } from '@prisma/client';
import prisma from '../database';
import youtubeApi, { YoutubeApi } from '../youtube';
import logger from '../logger';
import youtube from '../youtube';

class Songs {
  constructor(private readonly prismaSong: PrismaClient['song'], private readonly youtube: YoutubeApi) {}

  async fetchByVideoId(playlistId: number, youtubeVideoId: string) {
    return this.prismaSong.findFirst({ where: { playlistId, youtubeVideoId } });
  }

  async fetchAllForPlaylist(playlistId: number) {
    return prisma.song.findMany({ where: { playlistId } });
  }

  async create(playlist: Playlist, youtubeVideoId: string) {
    if (!playlist.youtubePlaylistId) {
      throw new Error('Cannot create song for unsynced playlist.');
    }

    const song = await this.prismaSong.create({ data: { playlistId: playlist.id, youtubeVideoId } });
    await this.sync(song, playlist);
    return song;
  }

  async sync(song: Song, playlist: Playlist) {
    // Create playlist item if missing
    if (!song.youtubePlaylistItemId && playlist.youtubePlaylistId) {
      logger.info(`Creating Youtube playlist item for video ${song.youtubeVideoId}`);

      const playlistItemId = await youtube.createPlaylistItem(playlist.youtubePlaylistId, song.youtubeVideoId);
      await this.prismaSong.update({ where: { id: song.id }, data: { youtubePlaylistItemId: playlistItemId } });
      song.youtubePlaylistItemId = playlistItemId ?? null;
    }

    return song;
  }

  async delete(song: Song) {
    if (song.youtubePlaylistItemId) {
      await youtube.deletePlaylistItem(song.youtubePlaylistItemId);
    }
    await prisma.song.delete({ where: { id: song.id } });
  }
}

export default new Songs(prisma.song, youtubeApi);
