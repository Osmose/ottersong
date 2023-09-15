import { AutocompleteInteraction, ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';

import db from '../database';
import { playlists } from '../schema';
import { eq, like } from 'drizzle-orm';
import youtube from '../youtube';
import logger from '../logger';

export default {
  data: new SlashCommandBuilder()
    .setName('playlist')
    .setDescription('Manage playlists')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('create')
        .setDescription('Create a playlist')
        .addStringOption((option) => option.setName('name').setDescription('Playlist name').setRequired(true))
    )
    .addSubcommand((subcommand) => subcommand.setName('list').setDescription('List all playlists'))
    .addSubcommand((subcommand) =>
      subcommand
        .setName('delete')
        .setDescription('Delete playlist')
        .addStringOption((option) =>
          option.setName('name').setDescription('Playlist name').setRequired(true).setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) => subcommand.setName('sync').setDescription('Sync saved playlists with Youtube')),
  async execute(interaction: ChatInputCommandInteraction) {
    switch (interaction.options.getSubcommand()) {
      case 'create': {
        const name = interaction.options.getString('name', true);

        const existingPlaylist = await db.query.playlists.findFirst({ where: eq(playlists.name, name) });
        if (existingPlaylist) {
          return interaction.reply({
            content: `Could not create playlist as one already exists with the name "${name}".`,
            ephemeral: true,
          });
        }

        const [playlist] = await db
          .insert(playlists)
          .values({ type: 'manual' as const, name })
          .returning();
        const youtubePlaylistId = await youtube.createPlaylist(name);
        await db.update(playlists).set({ youtubePlaylistId }).where(eq(playlists.id, playlist.id));

        return interaction.reply({ content: `Created playlist "${name}".`, ephemeral: true });
      }

      case 'list': {
        const playlists = await db.query.playlists.findMany();
        const formattedList = playlists.map((playlist) => `- ${playlist.name}`).join('\n');
        return interaction.reply({ content: `All playlists:\n${formattedList}` });
      }

      case 'delete': {
        const name = interaction.options.getString('name', true);
        const existingPlaylist = await db.query.playlists.findFirst({ where: eq(playlists.name, name) });
        if (!existingPlaylist) {
          return interaction.reply({
            content: `No playlist found with the name "${name}".`,
            ephemeral: true,
          });
        }

        if (existingPlaylist.youtubePlaylistId) {
          await youtube.deletePlaylist(existingPlaylist.youtubePlaylistId);
        }
        await db.delete(playlists).where(eq(playlists.id, existingPlaylist.id));

        return interaction.reply({ content: `Deleted playlist "${name}"`, ephemeral: true });
      }

      case 'sync': {
        const playlistsToSync = await db.query.playlists.findMany();
        for (const playlist of playlistsToSync) {
          if (!playlist.youtubePlaylistId) {
            logger.info(`Creating Youtube playlist for "${playlist.name}" (ID: ${playlist.id})`);
            const youtubePlaylistId = await youtube.createPlaylist(playlist.name);
            await db.update(playlists).set({ youtubePlaylistId }).where(eq(playlists.id, playlist.id));
          }
        }
        return interaction.reply({ content: 'Playlists synced successfully', ephemeral: true });
      }
    }
  },
  async autocomplete(interaction: AutocompleteInteraction) {
    const focusedValue = interaction.options.getFocused();
    const matchingPlaylists = await db.query.playlists.findMany({
      where: like(playlists.name, `%${focusedValue}%`),
      limit: 25,
    });
    await interaction.respond(matchingPlaylists.map((playlist) => ({ name: playlist.name, value: playlist.name })));
  },
};
