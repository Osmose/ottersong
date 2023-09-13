import { AutocompleteInteraction, ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';

import db from '../database';
import { playlists } from '../schema';
import { eq, like } from 'drizzle-orm';

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
    ),
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

        await db.insert(playlists).values({ type: 'manual' as const, name });
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

        await db.delete(playlists).where(eq(playlists.id, existingPlaylist.id));
        return interaction.reply({ content: `Deleted playlist "${name}"`, ephemeral: true });
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
