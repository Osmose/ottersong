import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandStringOption,
} from 'discord.js';

import prisma from '../database';
import youtube from '../youtube';
import logger from '../logger';
import dedent from 'dedent';
import playlists from '../models/playlists';
import songs from '../models/songs';

const playlistNameOption = (option: SlashCommandStringOption) =>
  option.setName('name').setDescription('Playlist name').setRequired(true);

async function getPlaylist(interaction: ChatInputCommandInteraction, name: string, errorMessage?: string) {
  const playlist = await playlists.fetchByName(name);
  if (!playlist) {
    await interaction.reply({
      content: errorMessage ?? `No playlist found with the name "${name}".`,
      ephemeral: true,
    });
  }
  return playlist;
}

export default {
  data: new SlashCommandBuilder()
    .setName('playlist')
    .setDescription('Manage playlists')
    // /playlist create
    .addSubcommand((subcommand) =>
      subcommand
        .setName('create')
        .setDescription('Create a playlist')
        .addStringOption((option) => playlistNameOption(option))
    )
    // /playlist list
    .addSubcommand((subcommand) => subcommand.setName('list').setDescription('List all playlists'))
    // /playlist delete
    .addSubcommand((subcommand) =>
      subcommand
        .setName('delete')
        .setDescription('Delete playlist')
        .addStringOption((option) => playlistNameOption(option).setAutocomplete(true))
    )
    // /playlist sync
    .addSubcommand((subcommand) => subcommand.setName('sync').setDescription('Sync saved playlists with Youtube'))
    // /playlist show
    .addSubcommand((subcommand) =>
      subcommand
        .setName('show')
        .setDescription('View playlist details')
        .addStringOption((option) => playlistNameOption(option).setAutocomplete(true))
    )
    // /playlist addSong
    .addSubcommand((subcommand) =>
      subcommand
        .setName('add_song')
        .setDescription('Add a song to a playlist')
        .addStringOption((option) => playlistNameOption(option).setAutocomplete(true))
        .addStringOption((option) => option.setName('url').setDescription('URL of the song to add').setRequired(true))
    )
    // /playlist removeSong
    .addSubcommand((subcommand) =>
      subcommand
        .setName('remove_song')
        .setDescription('Remove a song from a playlist')
        .addStringOption((option) => playlistNameOption(option).setAutocomplete(true))
        .addStringOption((option) =>
          option.setName('url').setDescription('URL of the song to remove').setRequired(true)
        )
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    switch (interaction.options.getSubcommand()) {
      case 'create': {
        const name = interaction.options.getString('name', true);

        const existingPlaylist = await playlists.fetchByName(name);
        if (existingPlaylist) {
          return interaction.reply({
            content: `Could not create playlist as one already exists with the name "${name}".`,
            ephemeral: true,
          });
        }

        await playlists.create(name);

        return interaction.reply({ content: `Created playlist "${name}".`, ephemeral: true });
      }

      case 'list': {
        const allPlaylists = await playlists.fetchAll();
        const formattedList = allPlaylists.map((playlist) => `- ${playlist.name}`).join('\n');
        return interaction.reply({ content: `All playlists:\n${formattedList}` });
      }

      case 'delete': {
        const name = interaction.options.getString('name', true);
        const playlist = await getPlaylist(interaction, name);
        if (!playlist) {
          return;
        }

        await playlists.delete(playlist);

        return interaction.reply({ content: `Deleted playlist "${name}"`, ephemeral: true });
      }

      case 'sync': {
        const playlistsToSync = await prisma.playlist.findMany({ include: { songs: true } });
        for (const playlist of playlistsToSync) {
          await playlists.sync(playlist);

          // Create playlist items if missing
          if (playlist.youtubePlaylistId) {
            for (const song of playlist.songs) {
              await songs.sync(song, playlist);
            }
          }
        }
        return interaction.reply({ content: 'Playlists synced successfully', ephemeral: true });
      }

      case 'add_song': {
        const name = interaction.options.getString('name', true);
        const playlist = await getPlaylist(interaction, name);
        if (!playlist) {
          return;
        } else if (playlist.youtubePlaylistId === null) {
          return interaction.reply({ content: 'Cannot add song to unsynced playlist.', ephemeral: true });
        }

        const url = interaction.options.getString('url', true);
        const videoId = await youtube.getVideoId(url);
        if (!videoId) {
          return interaction.reply({ content: `No video found at the URL ${url}`, ephemeral: true });
        }

        await songs.create(playlist, videoId);

        return interaction.reply({ content: 'Song added successfully', ephemeral: true });
      }

      case 'remove_song': {
        const name = interaction.options.getString('name', true);
        const playlist = await getPlaylist(interaction, name);
        if (!playlist) {
          return;
        }

        const url = interaction.options.getString('url', true);
        const videoId = await youtube.getVideoId(url);
        if (!videoId) {
          return interaction.reply({ content: `No video found at the URL ${url}`, ephemeral: true });
        }

        const song = await songs.fetchByVideoId(playlist.id, videoId);
        if (!song) {
          return interaction.reply({ content: 'Song is not in this playlist', ephemeral: true });
        }

        await songs.delete(song);

        return interaction.reply({ content: 'Song removed', ephemeral: true });
      }

      case 'show': {
        const name = interaction.options.getString('name', true);
        const playlist = await playlists.fetchByName(name);
        if (!playlist) {
          return interaction.reply({
            content: `No playlist found with the name "${name}".`,
            ephemeral: true,
          });
        }

        const playlistSongs = await songs.fetchAllForPlaylist(playlist.id);
        return interaction.reply({
          content: dedent`
          **Name:** ${playlist.name}
          **URL:** https://www.youtube.com/playlist?list=${playlist.youtubePlaylistId}
        `,
        });
      }
    }
  },

  async autocomplete(interaction: AutocompleteInteraction) {
    const focusedValue = interaction.options.getFocused();
    const matchingPlaylists = await prisma.playlist.findMany({
      where: { name: { contains: focusedValue } },
      take: 25,
    });
    await interaction.respond(matchingPlaylists.map((playlist) => ({ name: playlist.name, value: playlist.name })));
  },
};
