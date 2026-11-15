// PiP+ background service worker: handles the toolbar icon click and the badge.

const toggleInFrame = (tabId, frameId, quiet) =>
  chrome.scripting.executeScript({
    target: { tabId, frameIds: [frameId] },
    func: (q) => (window.__pipx ? window.__pipx.toggle({ quiet: q }) : 'noscript'),
    args: [quiet],
  });

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  const tabId = tab.id;
  let result;

  try {
    // Called first, with nothing awaited before it, so the click's user
    // gesture has the best chance of reaching the page.
    const [res] = await toggleInFrame(tabId, 0, true);
    result = res && res.result;

    // Tab was open before the extension was installed: inject, then retry.
    if (result === 'noscript') {
      await chrome.scripting.insertCSS({ target: { tabId, allFrames: true }, files: ['content.css'] });
      if (/^https?:\/\/([^/]+\.)?youtube(-nocookie)?\.com\//.test(tab.url || '')) {
        await chrome.scripting.executeScript({
          target: { tabId, allFrames: true },
          files: ['yt-bridge.js'],
          world: 'MAIN',
        });
      }
      await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: ['content.js'] });
      const [res2] = await toggleInFrame(tabId, 0, true);
      result = res2 && res2.result;
    }

    // Nothing in the top frame: look for a video inside iframes.
    if (result === 'novideo') {
      const probes = await chrome.scripting.executeScript({
        target: { tabId, allFrames: true },
        func: () => (window.__pipx ? window.__pipx.score() : 0),
      });
      let best = null;
      for (const p of probes) {
        if (p.frameId === 0 || !p.result) continue;
        if (!best || p.result > best.result) best = p;
      }
      if (best) {
        await toggleInFrame(tabId, best.frameId, false);
      } else {
        await chrome.scripting.executeScript({
          target: { tabId, frameIds: [0] },
          func: () => window.__pipx && window.__pipx.toast('PiP+: no video found on this page'),
        });
      }
    }
  } catch (err) {
    // Pages extensions cannot touch (chrome://, the Web Store, ...).
    chrome.action.setBadgeBackgroundColor({ tabId, color: '#777' });
    chrome.action.setBadgeText({ tabId, text: '×' });
    setTimeout(() => chrome.action.setBadgeText({ tabId, text: '' }).catch(() => {}), 1500);
  }
});

chrome.runtime.onMessage.addListener((msg, sender) => {
  const tab = sender.tab;
  if (!tab || !tab.id || !msg) return;
  if (msg.type === 'pip-state') {
    chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: '#e5383b' });
    chrome.action.setBadgeText({ tabId: tab.id, text: msg.on ? 'ON' : '' });
  } else if (msg.type === 'focus-tab') {
    chrome.tabs.update(tab.id, { active: true });
    chrome.windows.update(tab.windowId, { focused: true });
  }
});

// Chrome lost focus to another app: let the playing tab try to open PiP+.
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId !== chrome.windows.WINDOW_ID_NONE) return;
  try {
    const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    for (const t of tabs) {
      if (t.id) chrome.tabs.sendMessage(t.id, { type: 'app-blur' }, { frameId: 0 }).catch(() => {});
    }
  } catch (_) {}
});
