import ScheduledMessageModel from '../models/ScheduledMessage';
import SlackService from './slackClient';

const POLL_MS = Number(process.env.SCHEDULER_POLL_MS || 15000);

let running = false;

async function runOnce() {
  const now = new Date();

  // Automically pick the oldest due job and mark it "sending"
  const doc = await ScheduledMessageModel.findOneAndUpdate(
    { status: { $in: ['scheduled', 'retry'] }, sendAt: { $lte: now } },
    { status: 'sending', updatedAt: new Date() },
    { sort: { sendAt: 1 }, new: true }
  );

  if (!doc) return;

  console.log('Processing scheduled message', {
    id: String(doc._id),
    team: doc.teamId,
    channel: doc.channelId,
    sendAt: doc.sendAt,
  });

  try {
    // Post the message
    const post = await SlackService.sendMessage(
      { teamId: doc.teamId },
      doc.channelId!, // safe by schema
      doc.text
    );

    // Grab ts from response
    const ts: string | undefined = post.ts || post.message?.ts;
    doc.slackTs = ts;

    // Try to resolve permalink (non-fatal if null)
    let permalink: string | null = null;
    if (ts) {
      permalink = await SlackService.getPermalink(doc.teamId, doc.channelId!, ts);
    }
    doc.permalink = permalink || null;

    doc.status = 'sent';
    doc.sentAt = new Date();
    await doc.save();

    console.log('Scheduled message sent', String(doc._id));
  } catch (err: any) {
    console.error('scheduled send failed', err?.message || err);
    doc.retryCount = (doc.retryCount || 0) + 1;
    doc.status = 'retry';
    // simple linear backoff: + N * 60s
    doc.sendAt = new Date(Date.now() + doc.retryCount * 60 * 1000);
    await doc.save();
  }
}

const scheduler = {
  start: () => {
    if (running) return;
    running = true;
    setInterval(runOnce, POLL_MS);
    console.log('Scheduler started, poll ms =', POLL_MS);
  },
};

export default scheduler;