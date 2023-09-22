import { REST, Routes, Client, GatewayIntentBits } from 'discord.js';

import CONFIG from '../config.toml';
import commands from './commands';
import logger from './logger';
import youtube from './youtube';
import MessageListener from './modules/message_listener';

// App initialization
if (!youtube.hasCredentials) {
  await youtube.regenerateCredentials();
}
await MessageListener.init();

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
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});
client.on('ready', () => {
  logger.info(`Logged in as ${client.user?.tag}!`);
});

// Handle incoming slash commands
client.on('interactionCreate', async (interaction) => {
  if (interaction.isChatInputCommand()) {
    const command = commands.get(interaction.commandName);
    if (command) {
      const subcommand = interaction.options.getSubcommand();
      logger.info(
        `COMMAND: ${interaction.commandName}${subcommand ? ` ${subcommand}` : ''} USER: ${interaction.user.username}`
      );
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

// Handle incoming message
client.on('messageCreate', async (message) => {
  await MessageListener.handleMessageCreate(message);
});

client.login(CONFIG.token);
