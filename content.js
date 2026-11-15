// PiP+ content script: finds the video, opens a Document Picture-in-Picture
// window, moves the video into it and draws subtitles + controls on top.
(() => {
  'use strict';
  if (window.__pipx) return;

  const IS_YT = /(^|\.)youtube(-nocookie)?\.com$/i.test(location.hostname);
  const SPEEDS = [1, 1.25, 1.5, 1.75, 2, 0.5, 0.75];

  // Caption elements of common non-YouTube players.
  const DOM_CAPTION_SELECTORS = [
    '.player-timedtext-text-container',
    '.atvwebplayersdk-captions-text',
    '.dss-subtitle-renderer-cue-window',
    '.jw-captions .jw-text-track-cue',
    '.plyr__caption',
    '.vp-captions',
    '.shaka-text-container',
    '.bmpui-ui-subtitle-label',
    '.vjs-text-track-cue',
  ];
  const YT_CAPTION_SELECTORS = [
    '.ytp-caption-window-container .caption-visual-line',
    '.ytp-caption-window-container .ytp-caption-segment',
  ];

  const ICONS = {
    play: 'M8 5v14l11-7z',
    pause: 'M6 5h4v14H6zM14 5h4v14h-4z',
    replay: 'M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z',
    forward: 'M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z',
    next: 'M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z',
    vol: 'M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z',
    volLow: 'M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z',
    muted: 'M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z',
    cc: 'M19 4H5c-1.11 0-2 .9-2 2v12c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 7H9.5v-.5h-2v3h2V13H11v1c0 .55-.45 1-1 1H7c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1zm7 0h-1.5v-.5h-2v3h2V13H18v1c0 .55-.45 1-1 1h-3c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1z',
    tab: 'M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z',
    pip: 'M19 11h-8v6h8v-6zm4 8V4.98C23 3.88 22.1 3 21 3H3c-1.1 0-2 .88-2 1.98V19c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2zm-2 .02H3V4.97h18v14.05z',
  };

  const PIP_CSS = `
:root { color-scheme: dark; }
* { box-sizing: border-box; }
html, body {
  margin: 0; height: 100%; overflow: hidden; background: #000; color: #fff;
  font: 13px/1.2 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  user-select: none; -webkit-user-select: none;
}
#stage { position: fixed; inset: 0; background: #000; --cap-lift: 60px; }
#stage.idle { cursor: none; --cap-lift: 0px; }
#stage video {
  position: absolute !important; inset: 0 !important; left: 0 !important; top: 0 !important;
  width: 100% !important; height: 100% !important; max-width: none !important; max-height: none !important;
  margin: 0 !important; transform: none !important; object-fit: contain !important; background: #000;
}
#captions {
  position: absolute; left: 4%; right: 4%; bottom: calc(var(--cap-lift) + 5%);
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  text-align: center; pointer-events: none; transition: bottom .2s ease; z-index: 2;
}
#captions .line {
  max-width: 100%; padding: .12em .45em; border-radius: 4px;
  background: rgba(8, 8, 8, var(--cap-bg, .7));
  font-size: var(--cap-size, 20px); line-height: 1.3; font-weight: 500;
  text-shadow: 0 0 2px #000; white-space: pre-wrap; overflow-wrap: anywhere;
}
#osd {
  position: absolute; top: 10px; left: 50%; transform: translateX(-50%);
  padding: 6px 12px; border-radius: 16px; background: rgba(0, 0, 0, .72);
  font-weight: 600; white-space: nowrap; opacity: 0; transition: opacity .25s;
  pointer-events: none; z-index: 4;
}
#osd.show { opacity: 1; }
#controls {
  position: absolute; left: 0; right: 0; bottom: 0; padding: 22px 8px 5px;
  background: linear-gradient(transparent, rgba(0, 0, 0, .88));
  transition: opacity .2s; z-index: 3;
}
#stage.idle #controls { opacity: 0; pointer-events: none; }
#bar { position: relative; height: 14px; display: flex; align-items: center; cursor: pointer; touch-action: none; }
#bar .track { position: relative; flex: 1; height: 4px; border-radius: 2px; background: rgba(255, 255, 255, .25); }
#bar:hover .track, #bar.drag .track { height: 6px; }
#bar .buf, #bar .played { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 2px; }
#bar .buf { background: rgba(255, 255, 255, .35); }
#bar .played { background: #e5383b; }
#bar .knob {
  position: absolute; top: 50%; width: 12px; height: 12px; margin: -6px 0 0 -6px;
  border-radius: 50%; background: #e5383b; transform: scale(0); transition: transform .1s;
}
#bar:hover .knob, #bar.drag .knob { transform: scale(1); }
#bar .tip {
  position: absolute; bottom: 16px; transform: translateX(-50%); display: none;
  padding: 2px 5px; border-radius: 3px; background: rgba(0, 0, 0, .85); font-size: 11px;
  font-variant-numeric: tabular-nums; pointer-events: none;
}
#bar:hover .tip, #bar.drag .tip { display: block; }
.row { display: flex; align-items: center; gap: 2px; height: 32px; }
.spacer { flex: 1; min-width: 0; }
button {
  appearance: none; position: relative; flex: none; display: grid; place-items: center;
  width: 30px; height: 30px; padding: 0; border: 0; border-radius: 6px;
  background: transparent; color: #fff; font: 600 12px system-ui, sans-serif; cursor: pointer;
}
button:hover { background: rgba(255, 255, 255, .16); }
button svg { width: 20px; height: 20px; fill: currentColor; pointer-events: none; }
button.txt { width: auto; min-width: 30px; padding: 0 5px; }
button.on::after {
  content: ""; position: absolute; left: 7px; right: 7px; bottom: 3px; height: 2px;
  border-radius: 1px; background: #e5383b;
}
button.skip span {
  position: absolute; left: 50%; top: 50%; transform: translate(-50%, -32%);
  font-size: 7px; font-weight: 700; pointer-events: none;
}
#time { padding: 0 6px; font-size: 12px; opacity: .9; white-space: nowrap; font-variant-numeric: tabular-nums; }
.vol { display: flex; align-items: center; }
#vol {
  -webkit-appearance: none; appearance: none; width: 70px; height: 4px; margin: 0 4px 0 2px;
  border-radius: 2px; outline: none; cursor: pointer;
  background: linear-gradient(to right, #fff var(--p, 100%), rgba(255, 255, 255, .3) var(--p, 100%));
}
#vol::-webkit-slider-thumb {
  -webkit-appearance: none; width: 12px; height: 12px; border-radius: 50%; background: #fff;
}
#volpct { width: 34px; font-size: 11px; text-align: right; opacity: .9; font-variant-numeric: tabular-nums; }
@media (max-width: 520px) { #time, #volpct { display: none; } }
@media (max-width: 430px) { .opt { display: none; } #vol { width: 54px; } }
@media (max-width: 300px) { .skip { display: none; } }
`;

  // ---------- small helpers ----------

  const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

  function fmt(t) {
    if (!isFinite(t) || t < 0) t = 0;
    t = Math.floor(t);
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = String(t % 60).padStart(2, '0');
    return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
  }

  // Build elements without innerHTML (YouTube enforces Trusted Types).
  function h(doc, tag, props, ...kids) {
    const el = doc.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v);
    }
    for (const kid of kids) if (kid != null) el.append(kid);
    return el;
  }

  function icon(doc, name) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = doc.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    const path = doc.createElementNS(NS, 'path');
    path.setAttribute('d', ICONS[name]);
    svg.append(path);
    return svg;
  }

  function send(msg) {
    try {
      const p = chrome.runtime.sendMessage(msg);
      if (p && p.catch) p.catch(() => {});
    } catch (_) {}
  }

  function toast(text, action) {
    document.querySelectorAll('.pipx-toast').forEach((t) => t.remove());
    const t = h(document, 'div', { class: 'pipx-toast' }, h(document, 'span', { text }));
    if (action) {
      t.append(h(document, 'button', {
        text: action.label,
        onclick: (e) => { e.stopPropagation(); t.remove(); action.run(); },
      }));
    }
    (document.body || document.documentElement).append(t);
    setTimeout(() => t.remove(), action ? 9000 : 3500);
  }

  // ---------- settings ----------

  // captionShift: seconds the subtitles run ahead of the video clock (so the
  // text is on screen as the words are spoken). autoPip: open on tab switch.
  const settings = { captionSize: 20, captionBg: 0.7, captionsOn: true, captionShift: 0.15, autoPip: true };
  try {
    chrome.storage.local.get('pipxSettings', (r) => {
      if (r && r.pipxSettings) Object.assign(settings, r.pipxSettings);
      armAuto();
    });
  } catch (_) {}
  const saveSettings = () => {
    try { chrome.storage.local.set({ pipxSettings: settings }); } catch (_) {}
  };

  // ---------- YouTube bridge ----------

  const ytCaps = new Map(); // video id -> { vid, lang, cues }
  let lastYtCap = null;
  let state = null; // the open PiP session, or null

  const ytBridged = () => IS_YT && document.documentElement.dataset.pipxBridge === '1';
  const ytCmd = (cmd, arg) => window.postMessage({ __pipxToPage: true, cmd, arg }, location.origin);

  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data || e.data.__pipxFromPage !== true) return;
    const d = e.data.data;
    if (!d) return;
    if (e.data.type === 'captions' && Array.isArray(d.cues)) {
      ytCaps.delete(d.vid);
      ytCaps.set(d.vid, d);
      lastYtCap = d;
      if (ytCaps.size > 20) ytCaps.delete(ytCaps.keys().next().value);
    } else if (e.data.type === 'state' && state) {
      state.ytVol = clamp((Number(d.volume) || 0) / 100);
      state.ytMuted = !!d.muted;
      if (d.vid) state.ytVid = d.vid;
      if (state.ui) state.ui.updateVol();
    }
  });

  function ytVideoId() {
    const v = new URLSearchParams(location.search).get('v');
    if (v) return v;
    const m = location.pathname.match(/\/(?:shorts|embed|live)\/([\w-]{6,})/);
    return m ? m[1] : '';
  }

  function ytCcButton() {
    const b = document.querySelector('#movie_player .ytp-subtitles-button') ||
      document.querySelector('.ytp-subtitles-button');
    return b && b.style.display !== 'none' ? b : null;
  }

  // true / false, or null when the video has no CC button.
  function ytCcPressed() {
    const b = ytCcButton();
    return b ? b.getAttribute('aria-pressed') === 'true' : null;
  }

  const ytAdShowing = () =>
    !!document.querySelector('#movie_player.ad-showing, .html5-video-player.ad-showing');

  // No caption data for this video yet (e.g. YouTube loaded it before we were
  // listening): ask the player to download it again so the bridge can see it.
  function maybeReloadYtCaptions(s) {
    if (!ytBridged() || ytCcPressed() !== true) return;
    const vid = s.ytVid || ytVideoId();
    const now = Date.now();
    if (s.reloadVid !== vid) {
      // On a video change, give YouTube a moment to fetch them on its own.
      s.reloadAt = s.reloadVid === undefined ? 0 : now;
      s.reloadVid = vid;
      s.reloadTries = 0;
    }
    if (s.reloadTries >= 6 || now - s.reloadAt < 2500) return;
    s.reloadAt = now;
    s.reloadTries++;
    ytCmd('reloadCaptions');
  }

  function ytCueLines(t, s) {
    const vid = (s && s.ytVid) || ytVideoId();
    const cap = ytCaps.get(vid) || (vid ? null : lastYtCap);
    if (!cap || !cap.cues.length) return null;
    const active = [];
    for (const c of cap.cues) {
      if (c.s > t) break;
      if (t < c.e) active.push(c.t);
    }
    const lines = [];
    for (const text of active.slice(-2)) {
      for (const l of text.split('\n')) if (l.trim()) lines.push(l.trim());
    }
    return lines.slice(-3);
  }

  // ---------- caption sources ----------

  function readDomLines() {
    for (const sel of IS_YT ? YT_CAPTION_SELECTORS : DOM_CAPTION_SELECTORS) {
      const els = document.querySelectorAll(sel);
      if (!els.length) continue;
      const lines = [];
      for (const el of els) {
        const text = (el.innerText || el.textContent || '').trim();
        for (const l of text.split('\n')) if (l.trim()) lines.push(l.trim());
      }
      if (lines.length) return lines;
    }
    return [];
  }

  const isSubTrack = (tr) => tr.kind === 'subtitles' || tr.kind === 'captions';

  function trackLines(video) {
    const out = [];
    for (const tr of video.textTracks) {
      if (!isSubTrack(tr) || tr.mode === 'disabled' || !tr.activeCues) continue;
      for (const cue of tr.activeCues) {
        const text = String(cue.text || '')
          .replace(/<[^>]*>/g, '')
          .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
        for (const l of text.split('\n')) if (l.trim()) out.push(l.trim());
      }
    }
    return out;
  }

  function hasSubTrack(video) {
    for (const tr of video.textTracks) if (isSubTrack(tr)) return true;
    return false;
  }

  // Turn on the first subtitle track (hidden: we draw it ourselves).
  function ensureTrack(video, s) {
    let first = null;
    for (const tr of video.textTracks) {
      if (!isSubTrack(tr)) continue;
      if (tr.mode !== 'disabled') return;
      if (!first) first = tr;
    }
    if (first) {
      s.trackRestore.push([first, first.mode]);
      first.mode = 'hidden';
    }
  }

  // Natively "showing" tracks would be drawn twice; hide them while in PiP.
  function hideNativeTracks(video, s) {
    for (const tr of video.textTracks) {
      if (isSubTrack(tr) && tr.mode === 'showing') {
        s.trackRestore.push([tr, 'showing']);
        tr.mode = 'hidden';
      }
    }
  }

  // The subtitle lines to show right now, from the best available source.
  function captionLines(video, s) {
    if (!s.captionsOn) return [];
    if (IS_YT) {
      if (ytAdShowing()) return readDomLines();
      const cues = ytCueLines(video.currentTime + (Number(settings.captionShift) || 0), s);
      if (cues) return cues;
      maybeReloadYtCaptions(s);
      return readDomLines();
    }
    if (s.mode === 'doc') hideNativeTracks(video, s);
    const lines = readDomLines();
    return lines.length ? lines : trackLines(video);
  }

  function initCaptions(video, s) {
    s.captionsOn = settings.captionsOn;
    if (IS_YT) {
      const pressed = ytCcPressed();
      if (pressed !== null) s.captionsOn = pressed;
      ytCmd('getState');
    } else if (s.mode === 'doc') {
      hideNativeTracks(video, s);
      if (s.trackRestore.length) s.captionsOn = true;
      else if (s.captionsOn) ensureTrack(video, s);
    } else if (s.captionsOn) {
      ensureTrack(video, s);
    }
  }

  function toggleCaptionsFor(video, s) {
    s.captionsOn = !s.captionsOn;
    settings.captionsOn = s.captionsOn;
    saveSettings();
    let msg = s.captionsOn ? 'Subtitles on' : 'Subtitles off';
    if (IS_YT) {
      const pressed = ytCcPressed();
      if (pressed !== null && pressed !== s.captionsOn) ytCcButton().click();
      if (s.captionsOn && pressed === null && !ytCueLines(video.currentTime, s)) {
        msg = 'No subtitles for this video';
      }
    } else if (s.captionsOn) {
      ensureTrack(video, s);
      if (!hasSubTrack(video) && !readDomLines().length) msg = 'Subtitles on (none found yet)';
    }
    return msg;
  }

  // ---------- finding the video ----------

  function scoreVideo(v) {
    if (!v.isConnected) return 0;
    if (v.readyState === 0 && !v.currentSrc && !v.srcObject) return 0;
    const r = v.getBoundingClientRect();
    const area = r.width * r.height;
    if (area < 2000 && v.paused) return 0;
    return area + (v.paused ? 0 : 1e8) + (v.currentTime > 0 ? 1e6 : 0) + 1;
  }

  function findVideo() {
    if (IS_YT) {
      const v = document.querySelector('#movie_player video') ||
        document.querySelector('.html5-video-player video');
      if (v && (v.currentSrc || v.readyState > 0)) return v;
    }
    let best = null;
    let bestScore = 0;
    for (const v of document.querySelectorAll('video')) {
      const s = scoreVideo(v);
      if (s > bestScore) { bestScore = s; best = v; }
    }
    return best;
  }

  function score() {
    if (state) return 1e12;
    const v = findVideo();
    return v ? scoreVideo(v) || 1 : 0;
  }

  // ---------- automatic open ----------
  // Chrome fires the "enterpictureinpicture" media action when the user
  // switches away from a tab that is playing; inside it a PiP window may be
  // opened without a click.

  const AUTO_OK = IS_YT && window.top === window;

  function autoOpen(reason) {
    if (!AUTO_OK || !settings.autoPip || state || document.pictureInPictureElement) return;
    const v = findVideo();
    if (!v || v.paused || v.ended) return;
    open(v, { auto: reason });
  }

  function armAuto() {
    if (!AUTO_OK) return;
    document.documentElement.dataset.pipxAuto = settings.autoPip ? '1' : '0';
    try {
      navigator.mediaSession.setActionHandler('enterpictureinpicture',
        settings.autoPip ? () => autoOpen('tab') : null);
    } catch (_) {}
  }

  // An automatically opened window closes again when the user comes back.
  function watchReturn(s, auto, on) {
    s.auto = auto;
    if (!auto) return;
    const back = () => { if (state === s && s.auto) close(); };
    on(document, 'visibilitychange', () => { if (document.visibilityState === 'visible' && s.auto === 'tab') back(); });
    on(window, 'focus', () => { if (s.auto === 'app') back(); });
  }

  // The browser lost focus to another app (told by background.js). Chrome only
  // allows opening here if the page was clicked in the last few seconds.
  try {
    chrome.runtime.onMessage.addListener((msg) => {
      if (!msg || msg.type !== 'app-blur') return;
      if (navigator.userActivation && !navigator.userActivation.isActive) return;
      autoOpen('app');
    });
  } catch (_) {}

  // ---------- open / close ----------

  async function toggle(opts) {
    if (state) { close(); return 'closed'; }
    if (document.pictureInPictureElement) {
      try { await document.exitPictureInPicture(); } catch (_) {}
      return 'closed';
    }
    const video = findVideo();
    if (!video) {
      if (!(opts && opts.quiet)) toast('PiP+: no video found on this page');
      return 'novideo';
    }
    return open(video);
  }

  async function open(video, opts) {
    if (state) return 'opened';
    const auto = (opts && opts.auto) || '';
    if (!('documentPictureInPicture' in window) || settings.forceClassic) return openClassic(video, auto);

    const vw = video.videoWidth || 16;
    const vh = video.videoHeight || 9;
    let width = Math.round(clamp(screen.availWidth * 0.28, 360, 640));
    let height = Math.round((width * vh) / vw);
    const maxH = Math.round(screen.availHeight * 0.6);
    if (height > maxH) { height = maxH; width = Math.round((height * vw) / vh); }

    let pipWin;
    try {
      pipWin = await window.documentPictureInPicture.requestWindow({ width, height });
    } catch (err) {
      if (auto) return 'needs-gesture';
      // Chrome wants a click inside the page itself; offer one.
      toast('PiP+ needs one click on the page', { label: 'Open PiP+', run: () => open(video) });
      return 'needs-gesture';
    }

    try {
      build(pipWin, video, auto);
    } catch (err) {
      console.error('[PiP+]', err);
      teardown();
      try { pipWin.close(); } catch (_) {}
      toast('PiP+ could not open: ' + (err && err.message ? err.message : err));
      return 'error';
    }
    return 'opened';
  }

  // ---------- classic mode (browsers without Document PiP) ----------
  // The video and its subtitles are painted onto a canvas, and the canvas is
  // what goes into the browser's ordinary Picture-in-Picture window.

  function wrapLine(ctx, text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return [text];
    const out = [];
    let cur = '';
    for (const word of text.split(/\s+/)) {
      const next = cur ? cur + ' ' + word : word;
      if (cur && ctx.measureText(next).width > maxWidth) { out.push(cur); cur = word; }
      else cur = next;
    }
    if (cur) out.push(cur);
    return out;
  }

  function drawCaptions(ctx, w, hgt, lines) {
    if (!lines.length) return;
    const size = Math.max(12, Math.round(w * 0.031 * (settings.captionSize / 20)));
    ctx.font = `500 ${size}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const rows = [];
    for (const l of lines) rows.push(...wrapLine(ctx, l, w * 0.9));
    const lineH = Math.round(size * 1.35);
    let y = hgt - Math.round(hgt * 0.06) - lineH * rows.length + lineH / 2;
    for (const row of rows) {
      const tw = ctx.measureText(row).width + size * 0.9;
      ctx.fillStyle = `rgba(8, 8, 8, ${settings.captionBg})`;
      ctx.fillRect(Math.round((w - tw) / 2), Math.round(y - lineH / 2), Math.round(tw), lineH);
      ctx.fillStyle = '#fff';
      ctx.fillText(row, w / 2, y);
      y += lineH;
    }
  }

  async function openClassic(video, auto) {
    if (state) return 'opened';
    if (typeof video.requestPictureInPicture !== 'function') {
      toast('PiP+: this browser does not let extensions open Picture-in-Picture');
      return 'unsupported';
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const out = document.createElement('video');
    const s = {
      mode: 'classic', video, out, pipWin: null, cleanups: [], trackRestore: [],
      placeholder: null, parent: null, next: null, captionsOn: settings.captionsOn,
      ytVol: null, ytMuted: null, ui: null, note: '', noteUntil: 0,
    };
    const on = (target, type, fn, opts) => {
      target.addEventListener(type, fn, opts);
      s.cleanups.push(() => target.removeEventListener(type, fn, opts));
    };

    function draw() {
      const vw = video.videoWidth || 640;
      const vh = video.videoHeight || 360;
      const k = Math.min(1, 1280 / vw);
      const w = Math.round((vw * k) / 2) * 2;
      const hgt = Math.round((vh * k) / 2) * 2;
      if (canvas.width !== w || canvas.height !== hgt) { canvas.width = w; canvas.height = hgt; }
      try { ctx.drawImage(video, 0, 0, w, hgt); } catch (_) {}
      try { drawCaptions(ctx, w, hgt, captionLines(video, s)); } catch (_) {}
      if (s.note && Date.now() < s.noteUntil) drawCaptions(ctx, w, hgt * 0.25, [s.note]);
    }

    try {
      draw();
      out.muted = true;
      out.playsInline = true;
      out.srcObject = canvas.captureStream(30);
      out.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none;';
      (document.body || document.documentElement).append(out);
      s.cleanups.push(() => { out.srcObject = null; out.remove(); });
      await out.play();
      await out.requestPictureInPicture();
    } catch (err) {
      for (const fn of s.cleanups) { try { fn(); } catch (_) {} }
      if (auto) return 'needs-gesture';
      if (err && err.name === 'NotAllowedError') {
        toast('PiP+ needs one click on the page', { label: 'Open PiP+', run: () => openClassic(video) });
        return 'needs-gesture';
      }
      try {
        await video.requestPictureInPicture();
        toast('PiP+: opened basic Picture-in-Picture (subtitles not available here)');
        return 'opened-native';
      } catch (_) {
        toast('PiP+ could not open Picture-in-Picture here');
        return 'error';
      }
    }

    state = s;
    initCaptions(video, s);
    s.flash = (text) => { s.note = text; s.noteUntil = Date.now() + 1200; };

    const timer = setInterval(draw, 33);
    s.cleanups.push(() => clearInterval(timer));
    if (IS_YT) {
      const poll = setInterval(() => ytCmd('getState'), 1000);
      s.cleanups.push(() => clearInterval(poll));
    }

    // Keep the PiP window's play/pause button and the real video in step.
    const safePlay = (el) => { const p = el.play(); if (p && p.catch) p.catch(() => {}); };
    on(out, 'pause', () => { if (state === s && !video.paused) video.pause(); });
    on(out, 'play', () => { if (video.paused) safePlay(video); });
    on(video, 'pause', () => { if (!out.paused) out.pause(); });
    on(video, 'play', () => { if (out.paused) safePlay(out); });
    on(out, 'leavepictureinpicture', teardown);

    send({ type: 'pip-state', on: true });
    watchReturn(s, auto, on);
    if (!auto) toast('PiP+ classic mode: Alt+↑/↓ volume, Alt+M mute, Alt+C subtitles (on this page)');
    return 'opened';
  }

  // Volume in classic mode (the PiP window itself cannot hold controls).
  function classicVolume(delta) {
    const s = state;
    const v = s.video;
    const bridged = ytBridged();
    const cur = bridged && s.ytVol != null ? s.ytVol : v.volume;
    const muted = bridged && s.ytMuted != null ? s.ytMuted : v.muted;
    if (delta === 0) {
      const m = !muted;
      if (bridged) { s.ytMuted = m; ytCmd(m ? 'mute' : 'unMute'); } else v.muted = m;
      s.flash(m ? 'Muted' : 'Volume ' + Math.round(cur * 100) + '%');
      return;
    }
    const nv = clamp(Math.round(((muted ? 0 : cur) + delta) * 100) / 100);
    if (bridged) {
      s.ytVol = nv;
      if (nv > 0) s.ytMuted = false;
      ytCmd('setVolume', Math.round(nv * 100));
    } else {
      v.volume = nv;
      if (nv > 0) v.muted = false;
    }
    s.flash('Volume ' + Math.round(nv * 100) + '%');
  }

  function close() {
    if (!state) return;
    const win = state.pipWin;
    const classic = state.mode === 'classic';
    teardown();
    if (classic) {
      try {
        if (document.pictureInPictureElement) document.exitPictureInPicture().catch(() => {});
      } catch (_) {}
    } else {
      try { win.close(); } catch (_) {}
    }
  }

  function teardown() {
    if (!state) return;
    const s = state;
    state = null;
    for (const fn of s.cleanups) { try { fn(); } catch (_) {} }
    try {
      if (s.placeholder && s.placeholder.isConnected) {
        s.placeholder.replaceWith(s.video);
      } else if (s.parent && s.parent.isConnected) {
        const before = s.next && s.next.parentNode === s.parent ? s.next : null;
        s.parent.insertBefore(s.video, before);
      }
    } catch (_) {}
    if (s.placeholder) s.placeholder.remove();
    for (const [tr, mode] of s.trackRestore) { try { tr.mode = mode; } catch (_) {} }
    send({ type: 'pip-state', on: false });
  }

  // ---------- the PiP window ----------

  function build(pipWin, video, auto) {
    const doc = pipWin.document;
    const cleanups = [];
    const on = (target, type, fn, opts) => {
      target.addEventListener(type, fn, opts);
      cleanups.push(() => target.removeEventListener(type, fn, opts));
    };

    state = {
      mode: 'doc', pipWin, video, cleanups,
      placeholder: null, parent: null, next: null,
      trackRestore: [], captionsOn: settings.captionsOn,
      ytVol: null, ytMuted: null, lastCap: null, ui: null,
    };
    const s = state;

    doc.title = 'PiP+ · ' + (document.title || 'Video');
    try {
      const sheet = new pipWin.CSSStyleSheet();
      sheet.replaceSync(PIP_CSS);
      doc.adoptedStyleSheets = [sheet];
    } catch (_) {
      doc.head.append(h(doc, 'style', { text: PIP_CSS }));
    }

    // --- elements ---
    const btn = (title, iconName, cls) => {
      const b = h(doc, 'button', { title, 'aria-label': title, class: cls || '', tabindex: '-1' });
      if (iconName) b.append(icon(doc, iconName));
      return b;
    };
    const txtBtn = (title, text, cls) =>
      h(doc, 'button', { title, 'aria-label': title, class: 'txt ' + (cls || ''), tabindex: '-1', text });

    const captions = h(doc, 'div', { id: 'captions' });
    const osd = h(doc, 'div', { id: 'osd' });
    const buf = h(doc, 'div', { class: 'buf' });
    const played = h(doc, 'div', { class: 'played' });
    const knob = h(doc, 'div', { class: 'knob' });
    const track = h(doc, 'div', { class: 'track' }, buf, played, knob);
    const tip = h(doc, 'div', { class: 'tip' });
    const bar = h(doc, 'div', { id: 'bar' }, track, tip);

    const playBtn = btn('Play / pause (Space)', 'play');
    const backBtn = btn('Back 10 seconds (J)', 'replay', 'skip');
    backBtn.append(h(doc, 'span', { text: '10' }));
    const fwdBtn = btn('Forward 10 seconds (L)', 'forward', 'skip');
    fwdBtn.append(h(doc, 'span', { text: '10' }));
    const nextBtn = IS_YT ? btn('Next video (N)', 'next', 'opt') : null;
    const time = h(doc, 'span', { id: 'time', text: '0:00 / 0:00' });
    const muteBtn = btn('Mute (M)', 'vol');
    const vol = h(doc, 'input', {
      id: 'vol', type: 'range', min: '0', max: '100', step: '1', tabindex: '-1',
      title: 'Volume (↑ / ↓ or mouse wheel)',
    });
    const volPct = h(doc, 'span', { id: 'volpct' });
    const ccBtn = btn('Subtitles (C)', 'cc');
    const capMinus = txtBtn('Smaller subtitles (-)', 'A−', 'opt');
    const capPlus = txtBtn('Larger subtitles (+)', 'A+', 'opt');
    const speedBtn = txtBtn('Playback speed (S)', '1×', 'opt');
    const autoBtn = txtBtn('Open automatically when you leave the YouTube tab (A)', 'Auto', 'opt');
    const tabBtn = btn('Back to tab', 'tab');

    const controls = h(doc, 'div', { id: 'controls' },
      bar,
      h(doc, 'div', { class: 'row' },
        playBtn, backBtn, fwdBtn, nextBtn, time,
        h(doc, 'div', { class: 'spacer' }),
        h(doc, 'div', { class: 'vol' }, muteBtn, vol, volPct),
        ccBtn, capMinus, capPlus, speedBtn, AUTO_OK ? autoBtn : null, tabBtn));
    const stage = h(doc, 'div', { id: 'stage' }, captions, osd, controls);
    doc.body.append(stage);

    // Keep keyboard focus on the window, not on individual buttons.
    on(controls, 'mousedown', (e) => { if (e.target !== vol) e.preventDefault(); });

    // --- move the video in, leaving a placeholder on the page ---
    const rect = video.getBoundingClientRect();
    const placeholder = h(document, 'div', {
      class: 'pipx-placeholder' + (IS_YT ? ' pipx-placeholder--fill' : ''),
    },
      h(document, 'div', { text: 'Playing in Picture-in-Picture' }),
      h(document, 'button', {
        class: 'pipx-ph-btn', text: 'Bring video back',
        onclick: (e) => { e.preventDefault(); e.stopPropagation(); close(); },
      }));
    if (!IS_YT) {
      placeholder.style.width = Math.max(rect.width, 200) + 'px';
      placeholder.style.height = Math.max(rect.height, 120) + 'px';
    }
    s.parent = video.parentNode;
    s.next = video.nextSibling;
    s.placeholder = placeholder;
    s.parent.insertBefore(placeholder, video);
    stage.prepend(video);

    // --- timeline ---
    let dragging = false;
    let dragRatio = 0;

    function range() {
      if (isFinite(video.duration) && video.duration > 0) return [0, video.duration];
      const sk = video.seekable;
      if (sk && sk.length) return [sk.start(0), sk.end(sk.length - 1)];
      return [0, 0];
    }
    function setBar(p) {
      p = clamp(p);
      played.style.width = p * 100 + '%';
      knob.style.left = p * 100 + '%';
    }
    function updateTime() {
      const [a, b] = range();
      const t = video.currentTime;
      const span = b - a;
      if (!dragging) setBar(span > 0 ? (t - a) / span : 0);
      if (isFinite(video.duration)) time.textContent = fmt(t) + ' / ' + fmt(video.duration);
      else time.textContent = b - t < 15 ? '● LIVE' : '-' + fmt(b - t);
      let end = 0;
      const bf = video.buffered;
      for (let i = 0; i < bf.length; i++) if (bf.start(i) <= t + 0.5) end = Math.max(end, bf.end(i));
      buf.style.width = (span > 0 ? clamp((end - a) / span) : 0) * 100 + '%';
    }
    function seekTo(t) {
      const [a, b] = range();
      if (b <= a) return;
      t = clamp(t, a, b);
      if (ytBridged()) ytCmd('seekTo', t);
      else video.currentTime = t;
    }
    function seekBy(d) {
      seekTo(video.currentTime + d);
      flash((d > 0 ? '+' : '−') + Math.abs(d) + 's');
    }

    const ratioAt = (e) => {
      const r = track.getBoundingClientRect();
      return r.width ? clamp((e.clientX - r.left) / r.width) : 0;
    };
    on(bar, 'pointerdown', (e) => {
      dragging = true;
      dragRatio = ratioAt(e);
      bar.classList.add('drag');
      try { bar.setPointerCapture(e.pointerId); } catch (_) {}
      setBar(dragRatio);
      e.preventDefault();
    });
    on(bar, 'pointermove', (e) => {
      const p = ratioAt(e);
      const [a, b] = range();
      tip.textContent = fmt(a + p * (b - a) - (isFinite(video.duration) ? 0 : a));
      tip.style.left = p * 100 + '%';
      if (dragging) { dragRatio = p; setBar(p); }
    });
    const endDrag = (commit) => () => {
      if (!dragging) return;
      dragging = false;
      bar.classList.remove('drag');
      if (commit) {
        const [a, b] = range();
        seekTo(a + dragRatio * (b - a));
      }
    };
    on(bar, 'pointerup', endDrag(true));
    on(bar, 'pointercancel', endDrag(false));

    // --- play / pause ---
    function updatePlay() {
      playBtn.replaceChildren(icon(doc, video.paused ? 'play' : 'pause'));
    }
    function togglePlay() {
      if (video.paused) {
        const p = video.play();
        if (p && p.catch) p.catch(() => {});
      } else {
        video.pause();
      }
    }

    // --- volume ---
    const curVol = () => (ytBridged() && s.ytVol != null ? s.ytVol : video.volume);
    const curMuted = () => (ytBridged() && s.ytMuted != null ? s.ytMuted : video.muted);

    function updateVol() {
      const v = curVol();
      const m = curMuted();
      const shown = Math.round((m ? 0 : v) * 100);
      vol.value = String(shown);
      vol.style.setProperty('--p', shown + '%');
      volPct.textContent = shown + '%';
      muteBtn.replaceChildren(icon(doc, m || v === 0 ? 'muted' : v < 0.5 ? 'volLow' : 'vol'));
    }
    function setVolume(v) {
      v = clamp(Math.round(v * 100) / 100);
      if (ytBridged()) {
        s.ytVol = v;
        if (v > 0) s.ytMuted = false;
        ytCmd('setVolume', Math.round(v * 100));
      } else {
        video.volume = v;
        if (v > 0) video.muted = false;
      }
      updateVol();
      flash('Volume ' + Math.round(v * 100) + '%');
    }
    function nudgeVolume(d) {
      setVolume((curMuted() ? 0 : curVol()) + d);
    }
    function toggleMute() {
      const m = !curMuted();
      if (!m && curVol() === 0) { setVolume(0.5); return; }
      if (ytBridged()) {
        s.ytMuted = m;
        ytCmd(m ? 'mute' : 'unMute');
      } else {
        video.muted = m;
      }
      updateVol();
      flash(m ? 'Muted' : 'Volume ' + Math.round(curVol() * 100) + '%');
    }

    // --- speed ---
    function updateSpeed() {
      speedBtn.textContent = video.playbackRate + '×';
    }
    function cycleSpeed() {
      const i = SPEEDS.indexOf(video.playbackRate);
      const r = SPEEDS[(i + 1) % SPEEDS.length];
      if (ytBridged()) ytCmd('setPlaybackRate', r);
      else video.playbackRate = r;
      flash('Speed ' + r + '×');
    }

    // --- captions ---
    function applyCapStyle() {
      stage.style.setProperty('--cap-size', settings.captionSize + 'px');
      stage.style.setProperty('--cap-bg', String(settings.captionBg));
    }
    function capSize(d) {
      settings.captionSize = clamp(settings.captionSize + d, 10, 48);
      saveSettings();
      applyCapStyle();
      flash('Subtitle size ' + settings.captionSize);
    }
    function renderCaptions() {
      const lines = captionLines(video, s);
      const key = lines.join('\n');
      if (key === s.lastCap) return;
      s.lastCap = key;
      captions.replaceChildren(...lines.map((l) => h(doc, 'div', { class: 'line', text: l })));
    }
    function capShift(d) {
      settings.captionShift = clamp(Math.round(((Number(settings.captionShift) || 0) + d) * 100) / 100, -5, 5);
      saveSettings();
      s.lastCap = null;
      renderCaptions();
      const v = settings.captionShift;
      flash(v === 0 ? 'Subtitle timing: normal' : 'Subtitles ' + Math.abs(v).toFixed(2) + 's ' + (v > 0 ? 'earlier' : 'later'));
    }
    function toggleAuto() {
      if (!AUTO_OK) return;
      settings.autoPip = !settings.autoPip;
      saveSettings();
      armAuto();
      autoBtn.classList.toggle('on', settings.autoPip);
      // Turned off from inside an auto-opened window: keep this one open.
      if (!settings.autoPip) s.auto = '';
      flash(settings.autoPip ? 'Auto-open on' : 'Auto-open off');
    }
    function updateCc() {
      ccBtn.classList.toggle('on', s.captionsOn);
    }
    function toggleCaptions() {
      const msg = toggleCaptionsFor(video, s);
      updateCc();
      renderCaptions();
      flash(msg);
    }

    // --- on-screen message + auto-hiding controls ---
    let osdTimer = 0;
    function flash(text) {
      osd.textContent = text;
      osd.classList.add('show');
      pipWin.clearTimeout(osdTimer);
      osdTimer = pipWin.setTimeout(() => osd.classList.remove('show'), 900);
    }
    let hideTimer = 0;
    function poke() {
      stage.classList.remove('idle');
      pipWin.clearTimeout(hideTimer);
      hideTimer = pipWin.setTimeout(() => {
        if (!video.paused && !dragging && !controls.matches(':hover')) stage.classList.add('idle');
      }, 2500);
    }

    // --- wiring ---
    on(playBtn, 'click', togglePlay);
    on(backBtn, 'click', () => seekBy(-10));
    on(fwdBtn, 'click', () => seekBy(10));
    if (nextBtn) on(nextBtn, 'click', () => ytCmd('nextVideo'));
    on(muteBtn, 'click', toggleMute);
    on(vol, 'input', () => setVolume(Number(vol.value) / 100));
    on(vol, 'change', () => vol.blur());
    on(ccBtn, 'click', toggleCaptions);
    on(capMinus, 'click', () => capSize(-2));
    on(capPlus, 'click', () => capSize(2));
    on(speedBtn, 'click', cycleSpeed);
    on(autoBtn, 'click', toggleAuto);
    on(tabBtn, 'click', () => { send({ type: 'focus-tab' }); close(); });

    on(stage, 'click', (e) => { if (e.target === video || e.target === stage) togglePlay(); });
    on(stage, 'mousemove', poke);
    on(stage, 'mouseleave', () => { if (!video.paused && !dragging) stage.classList.add('idle'); });
    on(stage, 'wheel', (e) => {
      e.preventDefault();
      nudgeVolume(e.deltaY < 0 ? 0.05 : -0.05);
      poke();
    }, { passive: false });

    on(doc, 'keydown', (e) => {
      if (e.altKey && e.code === 'KeyP') { e.preventDefault(); close(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      switch (e.key) {
        case ' ': case 'k': case 'K': togglePlay(); break;
        case 'ArrowLeft': seekBy(-5); break;
        case 'ArrowRight': seekBy(5); break;
        case 'j': case 'J': seekBy(-10); break;
        case 'l': case 'L': seekBy(10); break;
        case 'ArrowUp': nudgeVolume(0.05); break;
        case 'ArrowDown': nudgeVolume(-0.05); break;
        case 'm': case 'M': toggleMute(); break;
        case 'c': case 'C': toggleCaptions(); break;
        case 's': case 'S': cycleSpeed(); break;
        case 'n': case 'N': if (IS_YT) ytCmd('nextVideo'); break;
        case '+': case '=': capSize(2); break;
        case '-': case '_': capSize(-2); break;
        case ']': capShift(0.1); break;
        case '[': capShift(-0.1); break;
        case 'a': case 'A': toggleAuto(); break;
        default: return;
      }
      e.preventDefault();
      poke();
    });

    on(video, 'play', () => { updatePlay(); poke(); });
    on(video, 'pause', () => { updatePlay(); stage.classList.remove('idle'); });
    on(video, 'timeupdate', updateTime);
    on(video, 'durationchange', updateTime);
    on(video, 'progress', updateTime);
    on(video, 'seeked', updateTime);
    on(video, 'volumechange', () => { if (!ytBridged()) updateVol(); });
    on(video, 'ratechange', updateSpeed);

    // The PiP window stays visible, so its timers are never throttled.
    const capTimer = pipWin.setInterval(renderCaptions, 100);
    cleanups.push(() => pipWin.clearInterval(capTimer));
    // ...and subtitles are also checked on every video frame, so a line
    // appears on the frame it is due instead of up to 100 ms later.
    if (typeof video.requestVideoFrameCallback === 'function') {
      let vfc = 0;
      const onFrame = () => {
        if (state !== s) return;
        renderCaptions();
        vfc = video.requestVideoFrameCallback(onFrame);
      };
      vfc = video.requestVideoFrameCallback(onFrame);
      cleanups.push(() => { try { video.cancelVideoFrameCallback(vfc); } catch (_) {} });
    }
    if (IS_YT) {
      // Keeps the current video id and volume in step with the player.
      const poll = pipWin.setInterval(() => ytCmd('getState'), 1000);
      cleanups.push(() => pipWin.clearInterval(poll));
    }

    on(pipWin, 'pagehide', teardown);
    watchReturn(s, auto, on);
    autoBtn.classList.toggle('on', !!settings.autoPip);

    // --- initial state ---
    initCaptions(video, s);
    s.ui = { updateVol };
    applyCapStyle();
    updatePlay();
    updateTime();
    updateVol();
    updateSpeed();
    updateCc();
    renderCaptions();
    poke();
    send({ type: 'pip-state', on: true });
  }

  // ---------- page-level triggers ----------

  // Alt+P on the page.
  window.addEventListener('keydown', (e) => {
    if (!e.altKey || e.ctrlKey || e.metaKey) return;
    if (state && state.mode === 'classic') {
      let handled = true;
      if (e.code === 'ArrowUp') classicVolume(0.05);
      else if (e.code === 'ArrowDown') classicVolume(-0.05);
      else if (e.code === 'KeyM') classicVolume(0);
      else if (e.code === 'KeyC') state.flash(toggleCaptionsFor(state.video, state));
      else handled = false;
      if (handled) { e.preventDefault(); e.stopPropagation(); return; }
    }
    if (e.code !== 'KeyP') return;
    if (!state && !findVideo()) return;
    e.preventDefault();
    e.stopPropagation();
    toggle();
  }, true);

  // Button in the YouTube player bar.
  if (IS_YT) {
    setInterval(() => {
      const rc = document.querySelector('#movie_player .ytp-right-controls') ||
        document.querySelector('.ytp-right-controls');
      if (!rc || rc.querySelector('.pipx-yt-btn')) return;
      const label = 'PiP+ with subtitles (Alt+P)';
      const b = h(document, 'button', {
        class: 'ytp-button pipx-yt-btn', title: label, 'aria-label': label,
        onclick: (e) => { e.preventDefault(); e.stopPropagation(); toggle(); },
      }, icon(document, 'pip'));
      rc.prepend(b);
    }, 1500);
  }

  window.__pipx = { toggle, score, toast, isActive: () => !!state };
})();
