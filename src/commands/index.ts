import fs from 'fs';

import { AutocompleteInteraction, ChatInputCommandInteraction, Collection, SlashCommandBuilder } from 'discord.js';

import logger from '../logger';

export interface Command {
  data: SlashCommandBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
  autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
}

const commands = new Collection<string, Command>();
const commandFiles = fs
  .readdirSync(import.meta.dir)
  .filter((file) => file.endsWith('.ts') && !file.endsWith('index.ts'));

for (const file of commandFiles) {
  const command = require(`./${file}`).default;
  if ('data' in command && 'execute' in command) {
    commands.set(command.data.name, command);
  } else {
    logger.warn(`The command at ${file} is missing a required "data" or "execute" property.`);
  }
}

export default commands;
