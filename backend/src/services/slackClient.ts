import axios from 'axios';
import TokenModel from '../models/Token';

const REFRESH_MARGIN_MS = 30 * 1000; 

class SlackService {
  // Ensure token valid, refresh if needed
  static async ensureToken(teamId?: string) {
    const tokenDoc = teamId
      ? await TokenModel.findOne({ teamId })
      : await TokenModel.findOne({});

    if (!tokenDoc) throw new Error('no_token');

    if (
      tokenDoc.expiresAt != null &&
      Date.now() > (Number(tokenDoc.expiresAt) - REFRESH_MARGIN_MS)
    ) {
      const params = new URLSearchParams();
      params.append('client_id', process.env.SLACK_CLIENT_ID!);
      params.append('client_secret', process.env.SLACK_CLIENT_SECRET!);
      params.append('grant_type', 'refresh_token');
      params.append('refresh_token', tokenDoc.refreshToken!);

      const resp = await axios.post(
        'https://slack.com/api/oauth.v2.access',
        params.toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      const data = resp.data;
      if (!data.ok) throw new Error('refresh_failed');

      tokenDoc.accessToken = data.access_token;
      tokenDoc.refreshToken = data.refresh_token || tokenDoc.refreshToken;
      tokenDoc.expiresAt = data.expires_in
        ? Date.now() + data.expires_in * 1000
        : null;
      await tokenDoc.save();
    }

    return tokenDoc;
  }

  static async listChannels(tokenDoc: any) {
    const td = tokenDoc?.teamId
      ? await this.ensureToken(tokenDoc.teamId)
      : await this.ensureToken();

    const scopes = (td.scope || '') as string;
    const hasGroups = scopes.split(',').includes('groups:read');
    const types = hasGroups ? 'public_channel,private_channel' : 'public_channel';

    const resp = await axios.get(
      `https://slack.com/api/conversations.list?types=${encodeURIComponent(
        types
      )}&limit=100`,
      { headers: { Authorization: `Bearer ${td.accessToken}` } }
    );

    if (!resp.data.ok) throw new Error(resp.data.error || 'channels_failed');
    return resp.data.channels.map((c: any) => ({ id: c.id, name: c.name }));
  }

  static async sendMessage(tokenDoc: any, channelId: string, text: string) {
    const td = tokenDoc?.teamId
      ? await this.ensureToken(tokenDoc.teamId)
      : await this.ensureToken();

    const resp = await axios.post(
      'https://slack.com/api/chat.postMessage',
      { channel: channelId, text },
      { headers: { Authorization: `Bearer ${td.accessToken}` } }
    );

    if (!resp.data.ok) throw new Error(resp.data.error || 'post_failed');
    return resp.data; // contains { channel, ts, message: { ts, ... } }
  }

  // Permalink for a posted message
  static async getPermalink(teamId: string, channelId: string, ts: string) {
    const td = await this.ensureToken(teamId);
    const resp = await axios.get(
      `https://slack.com/api/chat.getPermalink?channel=${encodeURIComponent(channelId)}&message_ts=${encodeURIComponent(ts)}`,
      { headers: { Authorization: `Bearer ${td.accessToken}` } }
    );
    if (!resp.data?.ok) {
      // return null instead of throwing so we can retry later if needed
      return null;
    }
    return resp.data.permalink as string;
  }
}

export default SlackService;