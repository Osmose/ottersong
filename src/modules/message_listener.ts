import { Message } from 'discord.js';
import WatchedChannels from '../models/watched_channels';
import logger from '../logger';
import urlParser from 'js-video-url-parser/lib/base';
import 'js-video-url-parser/lib/provider/youtube';

import Playlists from '../models/playlists';
import Songs from '../models/songs';
import * as linkify from 'linkifyjs';
import prisma from '../database';

class MessageListener {
  /** In-memory cache of channel IDs that are actively being watched. */
  private activeWatchedChannelIds = new Set<string>(); // TODO: Switch to a proper cache / etcd / something for multi-instance

  async init() {
    WatchedChannels.on('watching', (channelId) => {
      this.activeWatchedChannelIds.add(channelId);
    });
    WatchedChannels.on('stopwatching', (channelId) => {
      this.activeWatchedChannelIds.delete(channelId);
    });

    const watchedChannels = await WatchedChannels.fetchAll();
    for (const channel of watchedChannels) {
      this.activeWatchedChannelIds.add(channel.channelId);
    }
  }

  async handleMessageCreate(message: Message<boolean>) {
    const channelId = message.channelId;
    if (!this.activeWatchedChannelIds.has(channelId)) {
      return;
    }

    const urls = linkify.find(message.content, 'url');
    const matchedVideoIds = [];
    for (const { href } of urls) {
      const parseResult = urlParser.parse(href);
      if (parseResult?.id) {
        matchedVideoIds.push(parseResult.id);
      }
    }

    if (matchedVideoIds.length < 1) {
      return;
    }

    logger.info(`Matched ${matchedVideoIds.length} youtube URLs in watched channel ${channelId}`);
    const watchedChannel = await WatchedChannels.fetchByChannelId(channelId);
    if (!watchedChannel) {
      throw new Error(
        `Watched channel cache out of sync; could not find watched channel entry for channel ${channelId}.`
      );
    }

    let playlist = await prisma.playlist.findFirst({
      where: { watchedChannelId: watchedChannel.id },
      orderBy: { id: 'desc' },
    });
    if (!playlist) {
      playlist = await Playlists.create(watchedChannel.name, watchedChannel);
    }

    for (const videoId of matchedVideoIds) {
      let song = await Songs.fetchByVideoId(playlist.id, videoId);
      if (song) {
        logger.info(`Skipping video ${videoId}, song already in playlist.`);
        continue;
      }

      song = await Songs.create(playlist, videoId);
      logger.info(`Created song ${song.id} for video ${videoId}`);
    }
  }
}

export default new MessageListener();
