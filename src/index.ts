import { REST, Routes, Client, GatewayIntentBits } from 'discord.js';

import CONFIG from '../config.toml';
import commands from './commands';
import logger from './logger';
import { syncMigrations } from './database';

syncMigrations();

// Update application commands
const rest = new REST({ version: '10' }).setToken(CONFIG.token);
try {
  logger.info('Started refreshing application (/) commands.');
  await rest.put(Routes.applicationCommands(CONFIG.appId), {
    body: Array.from(commands.values()).map((command) => command.data.toJSON()),
  });
  logger.info('Successfully reloaded application (/) commands.');
} catch (error) {
  logger.error(error);
}

// Set up bot client
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.on('ready', () => {
  logger.info(`Logged in as ${client.user?.tag}!`);
});

// Handle incoming slash commands
client.on('interactionCreate', async (interaction) => {
  if (interaction.isChatInputCommand()) {
    const command = commands.get(interaction.commandName);
    if (command) {
      logger.info(`COMMAND: ${interaction.commandName} USER: ${interaction.user.username}`);
      await command.execute(interaction);
    }
  } else if (interaction.isAutocomplete()) {
    const command = commands.get(interaction.commandName);
    if (command && command.autocomplete) {
      logger.info(`AUTOCOMPLETE: ${interaction.commandName} USER: ${interaction.user.username}`);
      await command.autocomplete(interaction);
    }
  }
});

client.login(CONFIG.token);
