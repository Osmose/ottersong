import fs from 'fs';
import path from 'path';

import { OAuth2Client } from 'google-auth-library';
import { google, youtube_v3 } from 'googleapis';

import CONFIG from '../config.toml';
import logger from './logger';

const CREDENTIALS_PATH = path.resolve(__dirname, '../youtube_token.json');
const SCOPES = ['https://www.googleapis.com/auth/youtube'];

export class YoutubeApi {
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

    this.hasCredentials = false;
    try {
      const credentialsFile = fs.readFileSync(CREDENTIALS_PATH, { encoding: 'utf8' });
      const credentials = JSON.parse(credentialsFile);
      if (credentials.access_token && credentials.refresh_token) {
        this.oauth.credentials = credentials;
        this.hasCredentials = true;
      }
    } catch (err) {}

    // Store new tokens when we get them
    this.oauth.on('tokens', async (tokens) => {
      await Bun.write(CREDENTIALS_PATH, JSON.stringify(tokens));
    });
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

  async getVideoId(url: string) {
    const response = await this.service.search.list({
      auth: this.oauth,
      part: ['snippet'],
      maxResults: 1,
      q: url,
      type: ['video'],
    });
    if (response.data.items && response.data.items.length > 0) {
      return response.data.items[0].id?.videoId;
    }

    return null;
  }

  async createPlaylistItem(playlistId: string, videoId: string) {
    const response = await this.service.playlistItems.insert({
      auth: this.oauth,
      part: ['snippet'],
      requestBody: { snippet: { playlistId, resourceId: { kind: 'youtube#video', videoId } } },
    });
    return response.data.id;
  }

  async deletePlaylistItem(id: string) {
    return this.service.playlistItems.delete({ auth: this.oauth, id });
  }
}

export default new YoutubeApi(CONFIG.youtubeClientId, CONFIG.youtubeClientSecret);
