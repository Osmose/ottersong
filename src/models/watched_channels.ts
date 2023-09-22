import { TypedEmitter } from 'tiny-typed-emitter';
import { Playlist, PrismaClient, WatchedChannel } from '@prisma/client';
import prisma from '../database';
import youtubeApi, { YoutubeApi } from '../youtube';
import logger from '../logger';

interface WatchedChannelsEvents {
  watching: (channelId: string) => void;
  stopwatching: (channelId: string) => void;
}

class WatchedChannels extends TypedEmitter<WatchedChannelsEvents> {
  constructor(private readonly prismaWatchedChannels: PrismaClient['watchedChannel']) {
    super();
  }

  async fetchByChannelId(channelId: string) {
    return this.prismaWatchedChannels.findUnique({ where: { channelId } });
  }

  async fetchAll() {
    return this.prismaWatchedChannels.findMany();
  }

  async startWatching(channel: WatchedChannel) {
    await this.prismaWatchedChannels.update({ where: { id: channel.id }, data: { active: true } });
    channel.active = true;
    this.emit('watching', channel.channelId);
    return channel;
  }

  async stopWatching(channel: WatchedChannel) {
    await this.prismaWatchedChannels.update({ where: { id: channel.id }, data: { active: false } });
    channel.active = false;
    this.emit('stopwatching', channel.channelId);
    return channel;
  }

  async create(channelId: string, name: string) {
    const channel = await this.prismaWatchedChannels.create({ data: { channelId, name, active: true } });
    this.emit('watching', channelId);
    return channel;
  }

  async delete(watchedChannel: WatchedChannel) {
    await this.prismaWatchedChannels.delete({ where: { id: watchedChannel.id } });
    this.emit('stopwatching', watchedChannel.channelId);
  }
}

export default new WatchedChannels(prisma.watchedChannel);
