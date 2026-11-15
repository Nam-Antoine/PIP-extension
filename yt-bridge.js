// PiP+ YouTube bridge. Runs in the page's own JavaScript world so it can
//  1) see the caption data the YouTube player downloads, and
//  2) call the player API (volume, seek, speed, next).
// It talks to content.js through window.postMessage.
(() => {
  'use strict';
  if (window.__pipxBridge) return;
  window.__pipxBridge = true;

  const mark = () => {
    try { document.documentElement.dataset.pipxBridge = '1'; } catch (_) {}
  };
  mark();
  document.addEventListener('DOMContentLoaded', mark);

  const post = (type, data) => {
    try { window.postMessage({ __pipxFromPage: true, type, data }, location.origin); } catch (_) {}
  };

  // ---------- caption capture ----------

  function handleCaptions(url, text) {
    try {
      const u = new URL(url, location.href);
      const json = JSON.parse(text);
      if (!json || !Array.isArray(json.events)) return;
      const cues = [];
      for (const ev of json.events) {
        if (!ev.segs) continue;
        const t = ev.segs.map((s) => s.utf8 || '').join('').replace(/​/g, '').trim();
        if (!t) continue;
        const s = (ev.tStartMs || 0) / 1000;
        cues.push({ s, e: s + (ev.dDurationMs || 3000) / 1000, t });
      }
      cues.sort((a, b) => a.s - b.s);
      post('captions', {
        vid: u.searchParams.get('v') || '',
        lang: u.searchParams.get('tlang') || u.searchParams.get('lang') || '',
        cues,
      });
    } catch (_) {
      // Not JSON captions; content.js falls back to reading the page.
    }
  }

  const isTimedText = (url) => typeof url === 'string' && url.includes('/api/timedtext');

  const origFetch = window.fetch;
  if (typeof origFetch === 'function') {
    window.fetch = function (input) {
      const promise = origFetch.apply(this, arguments);
      try {
        const url = typeof input === 'string' ? input : input && input.url;
        if (isTimedText(url)) {
          promise
            .then((r) => r.clone().text())
            .then((t) => handleCaptions(url, t))
            .catch(() => {});
        }
      } catch (_) {}
      return promise;
    };
  }

  const xhrOpen = XMLHttpRequest.prototype.open;
  const xhrSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url) {
    try { this.__pipxUrl = String(url); } catch (_) {}
    return xhrOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function () {
    if (isTimedText(this.__pipxUrl)) {
      this.addEventListener('load', () => {
        try {
          let text = null;
          if (this.responseType === '' || this.responseType === 'text') text = this.responseText;
          else if (this.responseType === 'json') text = JSON.stringify(this.response);
          else if (this.responseType === 'arraybuffer') text = new TextDecoder().decode(this.response);
          if (text) handleCaptions(this.__pipxUrl, text);
        } catch (_) {}
      });
    }
    return xhrSend.apply(this, arguments);
  };

  // ---------- automatic picture-in-picture ----------
  // content.js owns the "enterpictureinpicture" media action while auto-open
  // is on; keep the page from replacing that handler.
  try {
    const setHandler = MediaSession.prototype.setActionHandler;
    MediaSession.prototype.setActionHandler = function (action) {
      if (action === 'enterpictureinpicture' && document.documentElement.dataset.pipxAuto !== '0') return;
      return setHandler.apply(this, arguments);
    };
  } catch (_) {}

  // ---------- player commands ----------

  const getPlayer = () =>
    document.getElementById('movie_player') || document.querySelector('.html5-video-player');

  function postState(p) {
    try {
      let vid = '';
      try { vid = (p.getVideoData() || {}).video_id || ''; } catch (_) {}
      post('state', { volume: p.getVolume(), muted: p.isMuted(), vid });
    } catch (_) {}
  }

  function subscribe(p) {
    if (p.__pipxSubscribed) return;
    p.__pipxSubscribed = true;
    try { p.addEventListener('onVolumeChange', () => postState(p)); } catch (_) {}
  }

  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data || e.data.__pipxToPage !== true) return;
    mark();
    const p = getPlayer();
    if (!p) return;
    const { cmd, arg } = e.data;
    try {
      switch (cmd) {
        case 'setVolume':
          p.setVolume(arg);
          if (arg > 0 && p.isMuted()) p.unMute();
          break;
        case 'mute': p.mute(); break;
        case 'unMute': p.unMute(); break;
        case 'seekTo': p.seekTo(arg, true); break;
        case 'setPlaybackRate': p.setPlaybackRate(arg); break;
        case 'nextVideo': p.nextVideo(); break;
        case 'reloadCaptions': p.setOption('captions', 'reload', true); break;
        case 'getState': subscribe(p); break;
      }
    } catch (_) {}
    postState(p);
  });
})();
