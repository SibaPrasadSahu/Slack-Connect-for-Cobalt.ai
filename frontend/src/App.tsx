import React, { useEffect, useState } from 'react';
import axios from 'axios';

axios.defaults.withCredentials = true;
const API_BASE = 'http://localhost:4000';

// Per-user/workspace draft keys
const k = (teamId?: string | null, userId?: string | null, name?: string) =>
  `SS_${name}_${teamId || 'none'}_${userId || 'none'}`;

function SignInButton() {
  return (
    <a className="btn" href={`${API_BASE}/api/auth/install`}>
      Sign in with Slack
    </a>
  );
}

function ChannelSelector({
  channels,
  onSelect,
  value,
}: {
  channels: any[];
  onSelect: (id: string) => void;
  value: string;
}) {
  return (
    <select value={value} onChange={(e) => onSelect(e.target.value)}>
      <option value="">-- select channel --</option>
      {channels.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}

// format a local datetime string (YYYY-MM-DDTHH:MM) for datetime-local inputs
function nowLocalForInput() {
  const d = new Date();
  d.setSeconds(0, 0);
  const tzOffsetMin = d.getTimezoneOffset();
  const local = new Date(d.getTime() - tzOffsetMin * 60000);
  return local.toISOString().slice(0, 16);
}

export default function App() {
  const [connected, setConnected] = useState(false);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [channels, setChannels] = useState<any[]>([]);
  const [selected, setSelected] = useState('');
  const [text, setText] = useState('');
  const [scheduled, setScheduled] = useState<any[]>([]);
  const [time, setTime] = useState('');
  const [minTime, setMinTime] = useState(nowLocalForInput());

  // On boot: ask backend if we have a session
  useEffect(() => {
    (async () => {
      try {
        const r = await axios.get(`${API_BASE}/api/auth/status`);
        if (r.data?.installed) {
          setTeamId(r.data.teamId || null);
          setUserId(r.data.userId || null);
          setConnected(true);
        } else {
          setConnected(false);
        }
      } catch {
        setConnected(false);
      }
    })();
  }, []);

  // When connected and we know team/user -> hydrate drafts & start polling
  useEffect(() => {
    if (!connected) return;

    // Load drafts scoped per team/user
    setSelected(localStorage.getItem(k(teamId, userId, 'DRAFT_CHANNEL')) || '');
    setText(localStorage.getItem(k(teamId, userId, 'DRAFT_TEXT')) || '');
    setTime(localStorage.getItem(k(teamId, userId, 'DRAFT_TIME')) || '');

    fetchChannels();
    fetchScheduled();
    const id = setInterval(fetchScheduled, 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, teamId, userId]);

  // Keep the min selectable time fresh while the app is open
  useEffect(() => {
    const id = setInterval(() => setMinTime(nowLocalForInput()), 30000);
    return () => clearInterval(id);
  }, []);

  // Persist drafts per user/workspace
  useEffect(() => {
    if (!teamId) return;
    localStorage.setItem(k(teamId, userId, 'DRAFT_CHANNEL'), selected);
  }, [selected, teamId, userId]);
  useEffect(() => {
    if (!teamId) return;
    localStorage.setItem(k(teamId, userId, 'DRAFT_TEXT'), text);
  }, [text, teamId, userId]);
  useEffect(() => {
    if (!teamId) return;
    localStorage.setItem(k(teamId, userId, 'DRAFT_TIME'), time);
  }, [time, teamId, userId]);

  
  async function fetchChannels() {
    try {
      const r = await axios.get(`${API_BASE}/api/slack/channels`);
      setChannels(r.data.channels || []);
    } catch (e: any) {
      console.error('channels error', e?.response?.data || e.message);
      // If session expired or cleared, bounce to sign-in
      setConnected(false);
    }
  }

  async function fetchScheduled() {
    try {
      const r = await axios.get(`${API_BASE}/api/slack/scheduled`);
      setScheduled(r.data.list || []);
    } catch (e: any) {
      console.error('scheduled error', e?.response?.data || e.message);
    }
  }

  async function sendNow() {
    if (!selected) return alert('select a channel');
    if (!text.trim()) return alert('please enter text');
    await axios.post(`${API_BASE}/api/slack/send`, { channelId: selected, text });
    alert('sent');
  }

  async function schedule() {
    if (!selected) return alert('select a channel');
    if (!text.trim()) return alert('please enter text');
    if (!time) return alert('choose time');

    const chosen = new Date(time);
    if (Number.isNaN(chosen.getTime())) return alert('invalid date/time');

    const leadMs = chosen.getTime() - Date.now();
    if (leadMs < 10_000) {
      return alert('Please schedule at least 10 seconds in the future.');
    }

    const sendAt = chosen.toISOString();
    try {
      await axios.post(`${API_BASE}/api/slack/schedule`, { channelId: selected, text, sendAt });
      setText('');
      setTime('');
      alert('scheduled');
      // list auto-refreshes via polling
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || 'schedule_failed';
      alert(`Schedule failed: ${msg}`);
    }
  }

  async function signOut() {
    try {
      await axios.post(`${API_BASE}/api/auth/signout`);
    } catch {}
    setConnected(false);
    // keep drafts in localStorage so they restore after login
  }

  return (
    <div className="container">
      {/* Header with Sign out in top-right */}
      <div className="header">
        <h1>Slack Scheduler</h1>
        {connected ? (
          <button className="signout-btn" onClick={signOut}>
            Sign out
          </button>
        ) : null}
      </div>

      {!connected && (
        <div className="card">
          <h3>Connect your Slack</h3>
          <p>Click below to install/authorize the app.</p>
          <SignInButton />
        </div>
      )}

      {connected && (
        <>
          <div className="card">
            <h3>Compose</h3>
            <ChannelSelector channels={channels} onSelect={setSelected} value={selected} />
            <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Message text" />
            <div className="row">
              <button onClick={sendNow}>Send now</button>
              <input
                type="datetime-local"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                min={minTime} // UI constraint: no past times
              />
              <button onClick={schedule}>Schedule</button>
            </div>
          </div>

          <div className="card">
            <h3>Scheduled</h3>
            <ul>
              {scheduled.map((s) => {
                const isSent = s.status === 'sent';
                const chan = channels.find((c) => c.id === s.channelId);
                const channelName = chan ? `#${chan.name}` : '(unknown)';
                const dateStr = new Date(s.sendAt).toLocaleDateString(undefined, {
                  day: 'numeric',
                  month: 'short',
                });
                const timeStr = new Date(s.sendAt).toLocaleTimeString(undefined, {
                  hour: 'numeric',
                  minute: '2-digit',
                });

                return (
                  <li key={s._id} className={isSent ? 'sent' : ''}>
  {channelName} — {dateStr} — {timeStr} — {s.text}{' '}
  {isSent ? (
    <>
      <span className="badge badge-success">✓ Sent</span>
      {s.permalink ? (
        <>
          {' '}· <a href={s.permalink} target="_blank" rel="noreferrer">View in Slack</a>
        </>
      ) : (
        <span className="badge badge-pending" style={{ marginLeft: 8 }}>verifying…</span>
      )}
    </>
  ) : (
    <span className="badge badge-pending">{s.status}</span>
  )}
  {!isSent && (
    <button
      onClick={async () => {
        await axios.post(`${API_BASE}/api/slack/scheduled/${s._id}/cancel`);
        fetchScheduled();
      }}
    >
      Cancel
    </button>
  )}
</li>

                );
              })}
              {scheduled.length === 0 && <li>No scheduled messages.</li>}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
