import { Router } from 'express';
import SlackService from '../services/slackClient';
import ScheduledMessageModel from '../models/ScheduledMessage';
import TokenModel from '../models/Token';

const router = Router();
const MIN_LEAD_MS = 10 * 1000;

router.get('/channels', async (req, res) => {
  const teamId = req.sessionUser?.teamId;
  if (!teamId) return res.status(401).json({ error: 'not_authenticated' });

  const token = await TokenModel.findOne({ teamId }).lean();
  if (!token) return res.status(400).json({ error: 'no_install' });

  try {
    const channels = await SlackService.listChannels({ teamId });
    return res.json({ channels });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/send', async (req, res) => {
  const teamId = req.sessionUser?.teamId;
  if (!teamId) return res.status(401).json({ error: 'not_authenticated' });

  const { channelId, text } = req.body;
  if (!channelId || !text) return res.status(400).json({ error: 'missing' });

  try {
    const post = await SlackService.sendMessage({ teamId }, channelId, text);
    const ts: string | undefined = post.ts || post.message?.ts;

    let permalink: string | null = null;
    if (ts) {
      const link = await SlackService.getPermalink(teamId, channelId, ts);
      permalink = link || null;
    }

    res.json({ ok: true, ts, permalink });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/schedule', async (req, res) => {
  const teamId = req.sessionUser?.teamId;
  if (!teamId) return res.status(401).json({ error: 'not_authenticated' });

  const { channelId, text, sendAt } = req.body;
  if (!channelId || !text || !sendAt) return res.status(400).json({ error: 'missing' });

  const when = new Date(sendAt);
  if (Number.isNaN(when.getTime())) return res.status(400).json({ error: 'invalid_datetime' });
  if (when.getTime() < Date.now() + MIN_LEAD_MS) {
    return res.status(400).json({ error: 'sendAt_in_past_or_too_soon', minLeadSeconds: MIN_LEAD_MS / 1000 });
  }

  const doc = await ScheduledMessageModel.create({
    teamId,
    channelId,
    text,
    sendAt: when,
    status: 'scheduled',
    createdAt: new Date()
  });
  res.json({ ok: true, scheduled: doc });
});

router.get('/scheduled', async (req, res) => {
  const teamId = req.sessionUser?.teamId;
  if (!teamId) return res.status(401).json({ error: 'not_authenticated' });

  const list = await ScheduledMessageModel
    .find({ teamId, status: { $in: ['scheduled', 'retry', 'sending', 'sent'] } })
    .sort({ sendAt: 1 })
    .lean();

  res.json({ list });
});

router.post('/scheduled/:id/cancel', async (req, res) => {
  const teamId = req.sessionUser?.teamId;
  if (!teamId) return res.status(401).json({ error: 'not_authenticated' });

  const id = req.params.id;
  const doc = await ScheduledMessageModel.findOneAndUpdate(
    { _id: id, teamId },
    { status: 'cancelled' },
    { new: true }
  );
  if (!doc) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

export default router;