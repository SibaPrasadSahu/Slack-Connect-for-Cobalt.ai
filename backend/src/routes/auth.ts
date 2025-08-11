import { Router } from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import TokenModel from '../models/Token';
import dotenv from 'dotenv';

dotenv.config();
const router = Router();

/**
 * GET /api/auth/install
 * Redirect user to Slack OAuth v2
 */
router.get('/install', (_req, res) => {
  const clientId = process.env.SLACK_CLIENT_ID!;
  // add groups:read so private channels can be listed if granted
  const scopes = encodeURIComponent('chat:write,channels:read,channels:history,chat:write.public,groups:read');
  const redirect = encodeURIComponent(process.env.SLACK_REDIRECT_URI || 'http://localhost:4000/api/auth/callback');
  const url = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${redirect}`;
  res.redirect(url);
});

/**
 * GET /api/auth/callback
 * Exchange code for tokens, save per-team tokens, set session cookie
 */
router.get('/callback', async (req, res) => {
  const code = req.query.code as string;
  if (!code) return res.status(400).send('Missing code');

  try {
    const params = new URLSearchParams();
    params.append('client_id', process.env.SLACK_CLIENT_ID!);
    params.append('client_secret', process.env.SLACK_CLIENT_SECRET!);
    params.append('code', code);
    params.append('redirect_uri', process.env.SLACK_REDIRECT_URI || 'http://localhost:4000/api/auth/callback');

    const resp = await axios.post('https://slack.com/api/oauth.v2.access', params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const data = resp.data;
    if (!data.ok) {
      console.error('Slack OAuth error:', data);
      return res.status(400).json({ error: data.error });
    }

    const teamId = data.team?.id;
    const userId = data.authed_user?.id || null;
    const expiresAt = data.expires_in ? Date.now() + data.expires_in * 1000 : null;

    await TokenModel.findOneAndUpdate(
      { teamId },
      {
        teamId,
        accessToken: data.access_token,
        tokenType: data.token_type,
        scope: data.scope,
        refreshToken: data.refresh_token || null,
        expiresAt
      },
      { upsert: true, new: true }
    );

    // Set a signed session cookie (teamId + userId). Frontend uses /status to know if connected.
    const token = jwt.sign({ teamId, userId }, process.env.JWT_SECRET!, { expiresIn: '30d' });
    res.cookie('ss_session', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,            // set true when serving over HTTPS in prod
      maxAge: 30 * 24 * 60 * 60 * 1000
    });

    // Redirect back to the frontend
    return res.redirect(process.env.FRONTEND_ORIGIN || 'http://localhost:5173');
  } catch (err: any) {
    console.error(err?.response?.data || err.message);
    return res.status(500).json({ error: 'exchange_failed' });
  }
});

/**
 * GET /api/auth/status
 * Used by the frontend to decide whether to show the sign-in screen or the app.
 * (req.sessionUser is set by middleware; if you haven't added it yet, you can
 * temporarily decode the cookie here. Best is to use a middleware.)
 */
router.get('/status', (req, res) => {
  // If you’re using the attachSession middleware, it will set req.sessionUser.
  // @ts-ignore
  const cookie = req.cookies?.ss_session as string | undefined;
  let session: any = null;
  if (cookie) {
    try { session = jwt.verify(cookie, process.env.JWT_SECRET!); } catch { session = null; }
  }
  if (!session?.teamId) return res.json({ installed: false });
  res.json({ installed: true, teamId: session.teamId, userId: session.userId || null });
});

/**
 * POST /api/auth/signout
 * Clears the browser session cookie ONLY. Tokens & schedules remain in DB.
 */
router.post('/signout', (_req, res) => {
  res.clearCookie('ss_session', { httpOnly: true, sameSite: 'lax', secure: false });
  res.json({ ok: true });
});

export default router;
