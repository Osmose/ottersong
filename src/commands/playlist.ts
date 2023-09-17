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

const playlistNameOption = (option: SlashCommandStringOption) =>
  option.setName('name').setDescription('Playlist name').setRequired(true);

async function getPlaylist(interaction: ChatInputCommandInteraction, name: string, errorMessage?: string) {
  const playlist = await prisma.playlist.findUnique({ where: { name } });
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

        const existingPlaylist = await prisma.playlist.findUnique({ where: { name } });
        if (existingPlaylist) {
          return interaction.reply({
            content: `Could not create playlist as one already exists with the name "${name}".`,
            ephemeral: true,
          });
        }

        const playlist = await prisma.playlist.create({ data: { type: 'manual', name } });
        const youtubePlaylistId = await youtube.createPlaylist(name);
        await prisma.playlist.update({ where: { id: playlist.id }, data: { youtubePlaylistId } });

        return interaction.reply({ content: `Created playlist "${name}".`, ephemeral: true });
      }

      case 'list': {
        const playlists = await prisma.playlist.findMany();
        const formattedList = playlists.map((playlist) => `- ${playlist.name}`).join('\n');
        return interaction.reply({ content: `All playlists:\n${formattedList}` });
      }

      case 'delete': {
        const name = interaction.options.getString('name', true);
        const playlist = await getPlaylist(interaction, name);
        if (!playlist) {
          return;
        }

        if (playlist.youtubePlaylistId) {
          await youtube.deletePlaylist(playlist.youtubePlaylistId);
        }
        await prisma.playlist.delete({ where: { id: playlist.id } });

        return interaction.reply({ content: `Deleted playlist "${name}"`, ephemeral: true });
      }

      case 'sync': {
        const playlistsToSync = await prisma.playlist.findMany({ include: { songs: true } });
        for (const playlist of playlistsToSync) {
          // Create playlist if missing
          let youtubePlaylistId: string | null | undefined = playlist.youtubePlaylistId;
          if (!playlist.youtubePlaylistId) {
            logger.info(`Creating Youtube playlist for "${playlist.name}" (ID: ${playlist.id})`);
            youtubePlaylistId = await youtube.createPlaylist(playlist.name);
            await prisma.playlist.update({ where: { id: playlist.id }, data: { youtubePlaylistId } });
          }

          // Create playlist items if missing
          if (youtubePlaylistId) {
            for (const song of playlist.songs) {
              if (!song.youtubePlaylistItemId) {
                const youtubePlaylistItemId = await youtube.createPlaylistItem(youtubePlaylistId, song.youtubeVideoId);
                await prisma.song.update({ where: { id: song.id }, data: { youtubePlaylistItemId } });
              }
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

        const song = await prisma.song.create({ data: { playlistId: playlist.id, youtubeVideoId: videoId } });
        const playlistItemId = await youtube.createPlaylistItem(playlist.youtubePlaylistId, videoId);
        await prisma.song.update({ where: { id: song.id }, data: { youtubePlaylistItemId: playlistItemId } });

        return interaction.reply({ content: 'Song added successfully', ephemeral: true });
      }

      case 'remove_song': {
        const name = interaction.options.getString('name', true);
        const playlist = await getPlaylist(interaction, name);
        console.log(`playlist: ${JSON.stringify(playlist)}`);
        if (!playlist) {
          return;
        }

        const url = interaction.options.getString('url', true);
        const videoId = await youtube.getVideoId(url);
        if (!videoId) {
          return interaction.reply({ content: `No video found at the URL ${url}`, ephemeral: true });
        }

        const song = await prisma.song.findFirst({ where: { playlistId: playlist.id, youtubeVideoId: videoId } });
        if (!song) {
          return interaction.reply({ content: 'Song is not in this playlist', ephemeral: true });
        }

        if (song.youtubePlaylistItemId) {
          await youtube.deletePlaylistItem(song.youtubePlaylistItemId);
        }
        await prisma.song.delete({ where: { id: song.id } });

        return interaction.reply({ content: 'Song removed', ephemeral: true });
      }

      case 'show': {
        const name = interaction.options.getString('name', true);
        const playlist = await prisma.playlist.findUnique({ where: { name } });
        console.log(`playlist: ${JSON.stringify(playlist)}`);
        if (!playlist) {
          return interaction.reply({
            content: `No playlist found with the name "${name}".`,
            ephemeral: true,
          });
        }

        const songs = await prisma.song.findMany({ where: { playlistId: playlist.id } });
        return interaction.reply({
          content: dedent`
          **Name:** ${playlist.name}
          **Songs:**
          ${songs.map((song) => `- https://www.youtube.com/watch?v=${song.youtubeVideoId}`).join('\n')}
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
