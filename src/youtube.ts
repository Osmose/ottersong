import fs from 'fs';
import path from 'path';

import { OAuth2Client } from 'google-auth-library';
import { google, youtube_v3 } from 'googleapis';

import CONFIG from '../config.toml';
import logger from './logger';

const CREDENTIALS_PATH = path.resolve(__dirname, '../youtube_token.json');
const SCOPES = ['https://www.googleapis.com/auth/youtube'];

export class Youtube {
  clientId: string;
  clientSecret: string;
  hasCredentials: boolean;

  oauth: OAuth2Client;
  service: youtube_v3.Youtube;

  constructor(clientId: string, clientSecret: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.oauth = new google.auth.OAuth2(clientId, clientSecret, 'http://localhost');
    this.service = google.youtube('v3');

    try {
      const credentialsFile = fs.readFileSync(CREDENTIALS_PATH, { encoding: 'utf8' });
      this.oauth.credentials = JSON.parse(credentialsFile);
      this.hasCredentials = true;
    } catch (err) {
      this.hasCredentials = false;
    }
  }

  async regenerateCredentials() {
    const authUrl = this.oauth.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
    });
    console.log(`Authorize this app by visiting this url: ${authUrl}`);
    const code = prompt('Enter the code from that page here: ');
    if (!code) {
      logger.warn('No code given, skipping token regeneration.');
      return;
    }

    try {
      const response = await this.oauth.getToken(code);
      this.oauth.credentials = response.tokens;
      this.hasCredentials = true;

      await Bun.write(CREDENTIALS_PATH, JSON.stringify(response.tokens));
    } catch (err) {
      logger.error('Error while trying to retrieve access token', err);
      throw err;
    }
  }

  async createPlaylist(name: string) {
    const response = await this.service.playlists.insert({
      auth: this.oauth,
      part: ['snippet', 'status'],
      requestBody: { snippet: { title: name }, status: { privacyStatus: 'public' } },
    });
    return response.data.id;
  }

  async deletePlaylist(id: string) {
    return this.service.playlists.delete({
      auth: this.oauth,
      id,
    });
  }
}

export default new Youtube(CONFIG.youtubeClientId, CONFIG.youtubeClientSecret);