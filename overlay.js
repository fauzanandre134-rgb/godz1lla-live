/**
 * Godz1lla LIVE — Overlay client (transparent for LIVE Studio)
 */
(function () {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  const theme = params.get('theme') || 'neon';
  const maxRows = Math.min(20, Math.max(3, parseInt(params.get('top') || '10', 10) || 10));

  document.body.setAttribute('data-theme', theme);

  const listEl = document.getElementById('overlayList');
  const modeEl = document.getElementById('overlayMode');

  let ws = null;
  let reconnectDelay = 1000;

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatNumber(n) {
    return Number(n || 0).toLocaleString('id-ID');
  }

  function render(list) {
    const items = (Array.isArray(list) ? list : []).slice(0, maxRows);
    if (items.length === 0) {
      listEl.innerHTML =
        '<div class="ov-row" style="justify-content:center;opacity:0.6"><span>Menunggu gift...</span></div>';
      return;
    }

    listEl.innerHTML = items
      .map((u) => {
        const rClass = u.rank <= 3 ? 'r' + u.rank : '';
        const initial = (u.nickname || u.uniqueId || '?').charAt(0).toUpperCase();
        const av = u.avatar
          ? `<img class="ov-avatar" src="${escapeHtml(u.avatar)}" alt="" onerror="this.outerHTML='<div class=\\'ov-avatar ph\\'>${initial}</div>'" />`
          : `<div class="ov-avatar ph">${initial}</div>`;

        return `
          <div class="ov-row ${rClass}">
            <div class="ov-rank">${u.rank}</div>
            ${av}
            <div class="ov-name">${escapeHtml(u.nickname || u.uniqueId)}</div>
            <div class="ov-pts">${formatNumber(u.points)}</div>
          </div>`;
      })
      .join('');
  }

  function apply(data) {
    if (!data) return;
    if (data.mode === 'demo') {
      modeEl.textContent = 'DEMO';
    } else if (data.connected) {
      modeEl.textContent = data.username ? '@' + data.username : 'LIVE';
    } else {
      modeEl.textContent = '';
    }
    if (data.leaderboard) render(data.leaderboard);
  }

  function connect() {
    if (ws && (ws.readyState === 0 || ws.readyState === 1)) return;

    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    try {
      ws = new WebSocket(proto + '//' + location.host);
    } catch {
      schedule();
      return;
    }

    ws.onopen = () => {
      reconnectDelay = 1000;
    };

    ws.onclose = () => schedule();

    ws.onmessage = (ev) => {
      let data;
      try {
        data = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (data.type === 'state' || data.type === 'gift' || data.type === 'leaderboard' || data.leaderboard) {
        apply(data);
      }
    };
  }

  function schedule() {
    setTimeout(() => {
      connect();
      reconnectDelay = Math.min(12000, reconnectDelay * 1.4);
    }, reconnectDelay);
  }

  connect();

  setInterval(() => {
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({ type: 'ping' }));
    }
  }, 20000);
})();
