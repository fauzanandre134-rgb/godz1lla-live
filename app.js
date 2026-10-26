/**
 * Godz1lla LIVE — Dashboard client
 */
(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);

  const els = {
    usernameInput: $('#usernameInput'),
    btnConnect: $('#btnConnect'),
    btnDisconnect: $('#btnDisconnect'),
    btnDemo: $('#btnDemo'),
    btnSimulate: $('#btnSimulate'),
    btnReset: $('#btnReset'),
    btnCopyUrl: $('#btnCopyUrl'),
    statusPill: $('#statusPill'),
    statusDot: $('#statusDot'),
    statusText: $('#statusText'),
    errorBox: $('#errorBox'),
    demoBanner: $('#demoBanner'),
    modeValue: $('#modeValue'),
    roomValue: $('#roomValue'),
    leaderboard: $('#leaderboard'),
    emptyState: $('#emptyState'),
    countBadge: $('#countBadge'),
    recentList: $('#recentList'),
    overlayUrl: $('#overlayUrl')
  };

  // Full overlay URL for current host
  const overlayPath = window.location.origin + '/overlay';
  els.overlayUrl.textContent = overlayPath;

  let ws = null;
  let reconnectDelay = 1000;
  let intentionalClose = false;

  function setStatus(mode, text) {
    els.statusPill.className = 'status-pill ' + (mode || '');
    els.statusText.textContent = text || mode || 'Offline';
  }

  function showError(msg) {
    if (!msg) {
      els.errorBox.hidden = true;
      els.errorBox.textContent = '';
      return;
    }
    els.errorBox.hidden = false;
    els.errorBox.textContent = msg;
  }

  function renderLeaderboard(list) {
    const items = Array.isArray(list) ? list : [];
    els.countBadge.textContent = String(items.length);

    if (items.length === 0) {
      els.leaderboard.innerHTML =
        '<div class="empty-state" id="emptyState"><div class="empty-icon">👑</div><p>Belum ada gift.<br />Connect ke LIVE atau jalankan DEMO.</p></div>';
      return;
    }

    els.leaderboard.innerHTML = items
      .map((u) => {
        const rankClass = u.rank <= 3 ? 'rank-' + u.rank : '';
        const initial = (u.nickname || u.uniqueId || '?').charAt(0).toUpperCase();
        const avatarHtml = u.avatar
          ? `<img class="avatar" src="${escapeAttr(u.avatar)}" alt="" onerror="this.className='avatar placeholder';this.outerHTML='<div class=\\'avatar placeholder\\'>${initial}</div>'" />`
          : `<div class="avatar placeholder">${initial}</div>`;

        return `
          <div class="lb-row ${rankClass}">
            <div class="rank-num">${u.rank}</div>
            ${avatarHtml}
            <div class="user-info">
              <div class="name">${escapeHtml(u.nickname || u.uniqueId)}</div>
              <div class="uid">@${escapeHtml(u.uniqueId)}</div>
            </div>
            <div class="points">${formatNumber(u.points)}<span>💎</span></div>
          </div>`;
      })
      .join('');
  }

  function renderRecent(gifts) {
    const items = Array.isArray(gifts) ? gifts : [];
    if (items.length === 0) {
      els.recentList.innerHTML = '<div class="empty-state small">Menunggu gift...</div>';
      return;
    }
    els.recentList.innerHTML = items
      .map(
        (g) => `
      <div class="gift-item">
        <div class="g-name">${escapeHtml(g.nickname || g.uniqueId)}</div>
        <div class="g-gift">${escapeHtml(g.giftName)}${g.repeatCount > 1 ? ' x' + g.repeatCount : ''}</div>
        <div class="g-pts">+${formatNumber(g.diamonds)}</div>
      </div>`
      )
      .join('');
  }

  function applyState(data) {
    if (!data) return;

    els.modeValue.textContent = data.mode || 'idle';
    els.roomValue.textContent = data.roomId || '—';

    if (data.error) showError(data.error);
    else showError(null);

    const connecting = data.connecting;
    const connected = data.connected;

    if (data.mode === 'demo') {
      setStatus('demo', 'DEMO MODE');
      if (els.demoBanner) els.demoBanner.hidden = false;
    } else if (connecting) {
      setStatus('connecting', 'Connecting...');
      if (els.demoBanner) els.demoBanner.hidden = true;
    } else if (connected) {
      setStatus('online', 'Connected' + (data.username ? ' @' + data.username : ''));
      if (els.demoBanner) els.demoBanner.hidden = true;
    } else if (data.mode === 'error') {
      setStatus('error', 'Error');
      if (els.demoBanner) els.demoBanner.hidden = true;
    } else {
      setStatus('', 'Offline');
      if (els.demoBanner) els.demoBanner.hidden = true;
    }

    els.btnConnect.disabled = connecting || (connected && data.mode === 'live');
    els.btnDisconnect.disabled = !connected && data.mode !== 'demo' && !connecting;
    els.usernameInput.disabled = connecting || (connected && data.mode === 'live');
    if (els.btnSimulate) els.btnSimulate.disabled = data.mode !== 'demo';

    if (data.leaderboard) renderLeaderboard(data.leaderboard);
    if (data.recentGifts) renderRecent(data.recentGifts);
  }

  function connectWs() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = proto + '//' + location.host;

    try {
      ws = new WebSocket(url);
    } catch (e) {
      console.error('WS create failed', e);
      scheduleWsReconnect();
      return;
    }

    ws.onopen = () => {
      reconnectDelay = 1000;
      console.log('[Godz1lla] WebSocket connected');
    };

    ws.onclose = () => {
      if (!intentionalClose) scheduleWsReconnect();
    };

    ws.onerror = () => {
      // onclose will handle reconnect
    };

    ws.onmessage = (ev) => {
      let data;
      try {
        data = JSON.parse(ev.data);
      } catch {
        return;
      }

      switch (data.type) {
        case 'state':
          applyState(data);
          break;
        case 'gift':
          if (data.leaderboard) renderLeaderboard(data.leaderboard);
          if (data.gift && els.recentList) {
            // Soft refresh: request full state is heavy; prepend one item visually
            const g = data.gift;
            const row = document.createElement('div');
            row.className = 'gift-item';
            row.innerHTML =
              '<div class="g-name">' +
              escapeHtml(g.nickname || g.uniqueId) +
              '</div><div class="g-gift">' +
              escapeHtml(g.giftName) +
              (g.repeatCount > 1 ? ' x' + g.repeatCount : '') +
              '</div><div class="g-pts">+' +
              formatNumber(g.diamonds) +
              '</div>';
            const empty = els.recentList.querySelector('.empty-state');
            if (empty) els.recentList.innerHTML = '';
            els.recentList.insertBefore(row, els.recentList.firstChild);
            while (els.recentList.children.length > 20) {
              els.recentList.removeChild(els.recentList.lastChild);
            }
          }
          break;
        case 'leaderboard':
          if (data.leaderboard) renderLeaderboard(data.leaderboard);
          if (data.recentGifts) renderRecent(data.recentGifts);
          break;
        case 'pong':
          break;
        default:
          if (data.leaderboard || data.mode) applyState(data);
      }
    };
  }

  function scheduleWsReconnect() {
    setTimeout(() => {
      connectWs();
      reconnectDelay = Math.min(15000, reconnectDelay * 1.5);
    }, reconnectDelay);
  }

  function send(msg) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    } else {
      showError('WebSocket belum terhubung. Tunggu sebentar lalu coba lagi.');
      connectWs();
    }
  }

  // Events
  els.btnConnect.addEventListener('click', () => {
    const u = (els.usernameInput.value || '').trim();
    if (!u) {
      showError('Masukkan username TikTok terlebih dahulu.');
      return;
    }
    send({ type: 'connect', username: u });
  });

  els.btnDisconnect.addEventListener('click', () => {
    send({ type: 'disconnect' });
  });

  els.btnDemo.addEventListener('click', () => {
    send({ type: 'demo' });
  });

  if (els.btnSimulate) {
    els.btnSimulate.addEventListener('click', () => {
      send({ type: 'simulate' });
    });
  }

  els.btnReset.addEventListener('click', () => {
    if (confirm('Reset leaderboard? Semua poin akan dihapus.')) {
      send({ type: 'reset' });
    }
  });

  els.btnCopyUrl.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(overlayPath);
      els.btnCopyUrl.textContent = 'Tersalin!';
      setTimeout(() => {
        els.btnCopyUrl.textContent = 'Salin';
      }, 1500);
    } catch {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = overlayPath;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      els.btnCopyUrl.textContent = 'Tersalin!';
      setTimeout(() => {
        els.btnCopyUrl.textContent = 'Salin';
      }, 1500);
    }
  });

  els.usernameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') els.btnConnect.click();
  });

  // Utils
  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeAttr(str) {
    return String(str || '').replace(/"/g, '&quot;');
  }

  function formatNumber(n) {
    return Number(n || 0).toLocaleString('id-ID');
  }

  // Boot
  connectWs();

  // Keep-alive ping
  setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ping' }));
    }
  }, 25000);
})();
