import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';

import WatchedChannels from '../models/watched_channels';
import dedent from 'dedent';

export default {
  data: new SlashCommandBuilder()
    .setName('channel')
    .setDescription('Manage watched channels')
    // /channel watch
    .addSubcommand((subcommand) =>
      subcommand
        .setName('watch')
        .setDescription('Start watching a channel for posted videos')
        .addChannelOption((option) => option.setName('channel').setDescription('Channel to watch').setRequired(true))
        .addStringOption((option) =>
          option.setName('title').setDescription('Title for the playlist for this channel').setRequired(true)
        )
    )
    // /channel unwatch
    .addSubcommand((subcommand) =>
      subcommand
        .setName('unwatch')
        .setDescription('Stop watching a channel')
        .addChannelOption((option) =>
          option.setName('channel').setDescription('Channel to stop watching').setRequired(true)
        )
    )
    // /channel list
    .addSubcommand((subcommand) => subcommand.setName('list').setDescription('List all watched channels')),
  async execute(interaction: ChatInputCommandInteraction) {
    switch (interaction.options.getSubcommand()) {
      case 'watch': {
        const channel = interaction.options.getChannel('channel', true);
        const watchedChannel = await WatchedChannels.fetchByChannelId(channel.id);
        if (watchedChannel) {
          if (watchedChannel.active) {
            return interaction.reply({ content: `${channel.name} is already being watched.`, ephemeral: true });
          }

          await WatchedChannels.startWatching(watchedChannel);
          return interaction.reply({ content: `Now watching ${channel.name}.`, ephemeral: true });
        }

        const title = interaction.options.getString('title', true);
        await WatchedChannels.create(channel.id, title);
        return interaction.reply({ content: `Now watching ${channel.name}.`, ephemeral: true });
      }

      case 'unwatch': {
        const channel = interaction.options.getChannel('channel', true);
        const watchedChannel = await WatchedChannels.fetchByChannelId(channel.id);
        if (!watchedChannel) {
          return interaction.reply({ content: `${channel.name} is not being watched.`, ephemeral: true });
        }

        await WatchedChannels.stopWatching(watchedChannel);
        return interaction.reply({ content: `No longer watching ${channel.name}.`, ephemeral: true });
      }

      case 'list': {
        const watchedChannels = await WatchedChannels.fetchAll();
        return interaction.reply({
          content: dedent`
          **Watching channels:**
          ${watchedChannels.map((watchedChannel) => `- <#${watchedChannel.channelId}>`).join('\n')}
        `,
        });
      }
    }
  },
};
