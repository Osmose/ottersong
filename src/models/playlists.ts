import { Playlist, PrismaClient, WatchedChannel } from '@prisma/client';
import prisma from '../database';
import youtubeApi, { YoutubeApi } from '../youtube';
import logger from '../logger';

class Playlists {
  constructor(private readonly prismaPlaylist: PrismaClient['playlist'], private readonly youtube: YoutubeApi) {}

  async fetchByName(name: string) {
    return this.prismaPlaylist.findUnique({ where: { name } });
  }

  async fetchAll() {
    return this.prismaPlaylist.findMany();
  }

  async create(name: string, watchedChannel?: WatchedChannel) {
    const playlist = await this.prismaPlaylist.create({ data: { name, watchedChannelId: watchedChannel?.id } });
    await this.sync(playlist);
    return playlist;
  }

  async sync(playlist: Playlist) {
    // Create playlist if missing
    if (!playlist.youtubePlaylistId) {
      logger.info(`Creating Youtube playlist for "${playlist.name}" (ID: ${playlist.id})`);

      const youtubePlaylistId = await this.youtube.createPlaylist(playlist.name);
      await this.prismaPlaylist.update({ where: { id: playlist.id }, data: { youtubePlaylistId } });
      playlist.youtubePlaylistId = youtubePlaylistId ?? null;
    }

    return playlist;
  }

  async delete(playlist: Playlist) {
    if (playlist.youtubePlaylistId) {
      await this.youtube.deletePlaylist(playlist.youtubePlaylistId);
    }
    await prisma.playlist.delete({ where: { id: playlist.id } });
  }
}

export default new Playlists(prisma.playlist, youtubeApi);
