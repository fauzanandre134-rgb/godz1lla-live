/**
 * Godz1lla LIVE — Server
 * Real-time TikTok LIVE gift leaderboard + WebSocket broadcast
 *
 * IMPORTANT:
 * - This is an unofficial integration using tiktok-live-connector.
 * - TikTok can change their protocol at any time. Connection may fail.
 * - DEMO mode is always available and clearly labeled.
 * - No TikTok password / cookie / session is requested.
 */

const path = require('path');
const http = require('http');
const express = require('express');
const { WebSocketServer } = require('ws');

// Optional TikTok connector — loaded dynamically so server still starts if package fails
let WebcastPushConnection = null;
try {
  const tiktok = require('tiktok-live-connector');
  WebcastPushConnection = tiktok.WebcastPushConnection || tiktok.TikTokLiveConnection || null;
} catch (err) {
  console.warn('[Godz1lla] tiktok-live-connector not loaded:', err.message);
}

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// ---------- State ----------
const state = {
  connected: false,
  connecting: false,
  username: null,
  mode: 'idle', // idle | live | demo | error
  error: null,
  leaderboard: {}, // userId -> { uniqueId, nickname, avatar, points, gifts }
  recentGifts: [],
  roomId: null,
  reconnectAttempts: 0,
  maxReconnect: 5
};

let tiktokConnection = null;
let reconnectTimer = null;
let demoInterval = null;

// ---------- Helpers ----------
function sanitizeUsername(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let u = raw.trim().replace(/^@+/, '').toLowerCase();
  // Allow only typical TikTok uniqueId characters
  if (!/^[a-z0-9._]{2,24}$/i.test(u)) return null;
  return u;
}

function broadcast(msg) {
  const data = JSON.stringify(msg);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      try {
        client.send(data);
      } catch (_) {}
    }
  });
}

function getLeaderboardArray() {
  return Object.values(state.leaderboard)
    .sort((a, b) => b.points - a.points)
    .slice(0, 50)
    .map((entry, idx) => ({
      rank: idx + 1,
      uniqueId: entry.uniqueId,
      nickname: entry.nickname,
      avatar: entry.avatar || null,
      points: entry.points,
      giftCount: entry.giftCount || 0
    }));
}

function fullStatePayload() {
  return {
    type: 'state',
    connected: state.connected,
    connecting: state.connecting,
    username: state.username,
    mode: state.mode,
    error: state.error,
    roomId: state.roomId,
    leaderboard: getLeaderboardArray(),
    recentGifts: state.recentGifts.slice(0, 20)
  };
}

function addGiftToLeaderboard(user, diamondValue, giftName, repeatCount) {
  if (!user || !user.userId) return;

  const uid = String(user.userId);
  const points = Math.max(0, Number(diamondValue) || 0) * Math.max(1, Number(repeatCount) || 1);

  if (!state.leaderboard[uid]) {
    state.leaderboard[uid] = {
      uniqueId: user.uniqueId || 'unknown',
      nickname: user.nickname || user.uniqueId || 'Unknown',
      avatar: (user.profilePictureUrl || user.profilePicture?.url?.[0] || null),
      points: 0,
      giftCount: 0
    };
  }

  const entry = state.leaderboard[uid];
  entry.points += points;
  entry.giftCount += Math.max(1, Number(repeatCount) || 1);
  if (user.nickname) entry.nickname = user.nickname;
  if (user.uniqueId) entry.uniqueId = user.uniqueId;
  if (user.profilePictureUrl) entry.avatar = user.profilePictureUrl;

  const giftEvent = {
    uniqueId: entry.uniqueId,
    nickname: entry.nickname,
    avatar: entry.avatar,
    giftName: giftName || 'Gift',
    diamonds: points,
    repeatCount: repeatCount || 1,
    at: Date.now()
  };

  state.recentGifts.unshift(giftEvent);
  if (state.recentGifts.length > 30) state.recentGifts.pop();

  broadcast({
    type: 'gift',
    gift: giftEvent,
    leaderboard: getLeaderboardArray()
  });
}

function resetLeaderboard() {
  state.leaderboard = {};
  state.recentGifts = [];
  broadcast({
    type: 'leaderboard',
    leaderboard: [],
    recentGifts: []
  });
  broadcast(fullStatePayload());
}

// ---------- TikTok connection ----------
function clearReconnect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function scheduleReconnect() {
  clearReconnect();
  if (state.reconnectAttempts >= state.maxReconnect) {
    state.connected = false;
    state.connecting = false;
    state.mode = 'error';
    state.error = 'Gagal reconnect setelah beberapa percobaan. Coba Connect lagi.';
    broadcast(fullStatePayload());
    return;
  }
  const delay = Math.min(30000, 2000 * Math.pow(2, state.reconnectAttempts));
  state.reconnectAttempts += 1;
  state.connecting = true;
  state.error = `Reconnect attempt ${state.reconnectAttempts}/${state.maxReconnect} in ${Math.round(delay / 1000)}s...`;
  broadcast(fullStatePayload());
  reconnectTimer = setTimeout(() => {
    if (state.username) connectTikTok(state.username, true);
  }, delay);
}

function disconnectTikTok() {
  clearReconnect();
  stopDemo();
  if (tiktokConnection) {
    try {
      tiktokConnection.disconnect();
    } catch (_) {}
    tiktokConnection = null;
  }
  state.connected = false;
  state.connecting = false;
  state.username = null;
  state.mode = 'idle';
  state.error = null;
  state.roomId = null;
  state.reconnectAttempts = 0;
  broadcast(fullStatePayload());
}

async function connectTikTok(username, isReconnect = false) {
  if (!WebcastPushConnection) {
    state.connected = false;
    state.connecting = false;
    state.mode = 'error';
    state.error = 'Library tiktok-live-connector tidak tersedia. Gunakan mode DEMO.';
    broadcast(fullStatePayload());
    return;
  }

  const clean = sanitizeUsername(username);
  if (!clean) {
    state.error = 'Username tidak valid. Gunakan hanya huruf, angka, titik, underscore (2-24 karakter).';
    state.mode = 'error';
    state.connecting = false;
    broadcast(fullStatePayload());
    return;
  }

  if (tiktokConnection && !isReconnect) {
    try {
      tiktokConnection.disconnect();
    } catch (_) {}
    tiktokConnection = null;
  }

  stopDemo();
  clearReconnect();

  state.username = clean;
  state.connecting = true;
  state.connected = false;
  state.mode = 'live';
  state.error = null;
  if (!isReconnect) state.reconnectAttempts = 0;
  broadcast(fullStatePayload());

  try {
    // Older API (1.x) uses WebcastPushConnection
    const connection = new WebcastPushConnection(clean, {
      processInitialData: false,
      enableExtendedGiftInfo: true,
      requestPollingIntervalMs: 2000
    });

    tiktokConnection = connection;

    connection.on('connected', (data) => {
      state.connected = true;
      state.connecting = false;
      state.mode = 'live';
      state.error = null;
      state.roomId = data?.roomId || null;
      state.reconnectAttempts = 0;
      console.log(`[Godz1lla] Connected to @${clean} room ${state.roomId}`);
      broadcast(fullStatePayload());
    });

    connection.on('disconnected', () => {
      console.log('[Godz1lla] TikTok disconnected');
      state.connected = false;
      if (state.username && state.mode === 'live') {
        scheduleReconnect();
      } else {
        state.connecting = false;
        broadcast(fullStatePayload());
      }
    });

    connection.on('streamEnd', () => {
      console.log('[Godz1lla] Stream ended');
      state.connected = false;
      state.connecting = false;
      state.mode = 'error';
      state.error = 'LIVE telah berakhir.';
      tiktokConnection = null;
      broadcast(fullStatePayload());
    });

    connection.on('error', (err) => {
      console.error('[Godz1lla] TikTok error:', err?.message || err);
      state.error = String(err?.message || err || 'Unknown error');
      // Do not force mode=error on every transient error if we still reconnect
      broadcast(fullStatePayload());
    });

    // Gift handling with streak support
    connection.on('gift', (data) => {
      try {
        // giftType 1 = streakable. Only count when streak ends (repeatEnd) or non-streakable.
        const giftType = data.giftType ?? data.extendedGiftInfo?.type ?? 0;
        const repeatEnd = data.repeatEnd === true || data.repeatEnd === 1;
        const isStreakable = giftType === 1;

        if (isStreakable && !repeatEnd) {
          // Still in streak — ignore intermediate counts to avoid double-counting
          return;
        }

        const diamonds =
          data.diamondCount ??
          data.extendedGiftInfo?.diamond_count ??
          data.gift?.diamond_count ??
          1;
        const repeat = data.repeatCount || 1;
        const giftName =
          data.giftName ||
          data.extendedGiftInfo?.name ||
          data.gift?.name ||
          `Gift #${data.giftId || '?'}`;

        const user = {
          userId: data.userId || data.user?.userId || data.uniqueId,
          uniqueId: data.uniqueId || data.user?.uniqueId,
          nickname: data.nickname || data.user?.nickname || data.uniqueId,
          profilePictureUrl:
            data.profilePictureUrl ||
            data.user?.profilePictureUrl ||
            data.user?.profilePicture?.url?.[0]
        };

        addGiftToLeaderboard(user, diamonds, giftName, repeat);
      } catch (e) {
        console.error('[Godz1lla] gift handler error:', e.message);
      }
    });

    await connection.connect();
  } catch (err) {
    console.error('[Godz1lla] Connect failed:', err?.message || err);
    state.connected = false;
    state.connecting = false;
    state.mode = 'error';
    state.error =
      err?.message ||
      'Gagal terhubung. Pastikan username sedang LIVE, atau coba mode DEMO. Library unofficial bisa gagal kapan saja.';
    tiktokConnection = null;
    broadcast(fullStatePayload());
  }
}

// ---------- Demo mode ----------
const DEMO_USERS = [
  { uniqueId: 'godz1lla_fan', nickname: 'Godz1lla Fan', avatar: null },
  { uniqueId: 'anime_queen', nickname: 'Anime Queen', avatar: null },
  { uniqueId: 'dragon_rider', nickname: 'Dragon Rider', avatar: null },
  { uniqueId: 'pixel_knight', nickname: 'Pixel Knight', avatar: null },
  { uniqueId: 'neon_samurai', nickname: 'Neon Samurai', avatar: null },
  { uniqueId: 'star_gazer', nickname: 'Star Gazer', avatar: null }
];

const DEMO_GIFTS = [
  { name: 'Rose', diamonds: 1 },
  { name: 'TikTok', diamonds: 1 },
  { name: 'Finger Heart', diamonds: 5 },
  { name: 'GG', diamonds: 1 },
  { name: 'Doughnut', diamonds: 30 },
  { name: 'Galaxy', diamonds: 1000 },
  { name: 'Lion', diamonds: 299 },
  { name: 'Drama Queen', diamonds: 500 }
];

function stopDemo() {
  if (demoInterval) {
    clearInterval(demoInterval);
    demoInterval = null;
  }
}

function startDemo() {
  disconnectTikTok();
  stopDemo();
  resetLeaderboard();

  state.mode = 'demo';
  state.connected = true;
  state.connecting = false;
  state.username = 'DEMO';
  state.error = null;
  state.roomId = 'demo-room';
  broadcast(fullStatePayload());

  demoInterval = setInterval(() => {
    if (state.mode !== 'demo') return;
    const user = DEMO_USERS[Math.floor(Math.random() * DEMO_USERS.length)];
    const gift = DEMO_GIFTS[Math.floor(Math.random() * DEMO_GIFTS.length)];
    const repeat = Math.random() > 0.7 ? Math.floor(Math.random() * 5) + 1 : 1;
    addGiftToLeaderboard(
      {
        userId: user.uniqueId,
        uniqueId: user.uniqueId,
        nickname: user.nickname,
        profilePictureUrl: user.avatar
      },
      gift.diamonds,
      gift.name,
      repeat
    );
  }, 2500);
}

// ---------- WebSocket clients ----------
wss.on('connection', (ws) => {
  ws.send(JSON.stringify(fullStatePayload()));

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }

    if (!msg || typeof msg !== 'object') return;

    switch (msg.type) {
      case 'connect':
        if (msg.username) connectTikTok(msg.username);
        break;
      case 'disconnect':
        disconnectTikTok();
        break;
      case 'reset':
        resetLeaderboard();
        break;
      case 'demo':
        startDemo();
        break;
      case 'simulate':
        // Manual gift simulation — only works in DEMO mode
        if (state.mode === 'demo') {
          const user = DEMO_USERS[Math.floor(Math.random() * DEMO_USERS.length)];
          const gift = DEMO_GIFTS[Math.floor(Math.random() * DEMO_GIFTS.length)];
          const repeat = Math.floor(Math.random() * 3) + 1;
          addGiftToLeaderboard(
            {
              userId: user.uniqueId,
              uniqueId: user.uniqueId,
              nickname: user.nickname,
              profilePictureUrl: user.avatar
            },
            gift.diamonds,
            gift.name,
            repeat
          );
        }
        break;
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong' }));
        break;
      default:
        break;
    }
  });
});

// ---------- HTTP routes ----------
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'Godz1lla LIVE',
    mode: state.mode,
    connected: state.connected
  });
});

app.get('/api/state', (_req, res) => {
  res.json(fullStatePayload());
});

// Fallback to dashboard
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/overlay') || req.path.includes('.')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---------- Start ----------
server.listen(PORT, HOST, () => {
  console.log(`
╔══════════════════════════════════════════╗
║         GODZ1LLA LIVE  v1.0.0            ║
║   TikTok Gift Leaderboard + Overlay      ║
╠══════════════════════════════════════════╣
║  Dashboard : http://localhost:${PORT}/        ║
║  Overlay   : http://localhost:${PORT}/overlay ║
║  Health    : http://localhost:${PORT}/health  ║
╚══════════════════════════════════════════╝
  `);
  if (!WebcastPushConnection) {
    console.warn('[Godz1lla] TikTok library missing — DEMO mode only.');
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  disconnectTikTok();
  server.close(() => process.exit(0));
});
process.on('SIGTERM', () => {
  disconnectTikTok();
  server.close(() => process.exit(0));
});
