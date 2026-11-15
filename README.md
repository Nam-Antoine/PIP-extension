# PiP+ — Picture-in-Picture with Subtitles & Volume

A Chrome/Edge extension that opens a video in a floating window which keeps
the subtitles (CC) visible and has its own volume, seek and speed controls.

## Install

1. Open `chrome://extensions` (or `edge://extensions`).
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and pick this folder.
4. Reload any YouTube tabs that were already open.

## Browser support

| Browser | Status |
|---|---|
| Chrome, Edge, Brave, Opera, Vivaldi, Arc (version 116+) | Full PiP+ window: subtitles and all controls |
| Chromium browsers without Document Picture-in-Picture | Classic mode: subtitles are drawn into the normal PiP window; volume with Alt+Up/Down, mute Alt+M, subtitles Alt+C on the page |
| Firefox | Not supported: Firefox gives extensions no way to open Picture-in-Picture. Its built-in PiP already shows YouTube subtitles. |
| Safari | Not supported: Safari extensions must be packaged through Xcode on a Mac. |

## Use

Open it in any of three ways:

- press **Alt+P** on the page,
- click the PiP+ button in the YouTube player bar,
- click the PiP+ toolbar icon.

### Opens by itself on YouTube

While a YouTube video is playing with sound, switching to another tab opens
PiP+ automatically, and coming back to the YouTube tab closes it again.

- The first time, Chrome asks inside the PiP window whether to allow it —
  choose **Allow on every visit**.
- Chrome only does this for sites you watch video on regularly, and never for
  a paused or muted video.
- Switching to another *app* (not another tab) only opens PiP+ if you clicked
  the YouTube page in the last few seconds; Chrome does not let extensions do
  it otherwise. Press **Alt+P** before you leave instead.
- Turn it off or on with the **Auto** button (or **A**) in the PiP window.

For subtitles on YouTube, turn CC on for the video (on the YouTube player, or
with the CC button in the PiP window).

### Keys inside the PiP window

| Key | Action |
|---|---|
| Space / K | Play / pause |
| ← / → | Seek 5 seconds |
| J / L | Seek 10 seconds |
| ↑ / ↓, mouse wheel | Volume |
| M | Mute |
| C | Subtitles on / off |
| + / - | Subtitle size |
| ] / [ | Subtitles earlier / later by 0.1 s (YouTube) |
| A | Auto-open on / off (YouTube) |
| S | Playback speed |
| N | Next video (YouTube) |
| Alt+P | Close |

## Files

- `manifest.json` — extension config
- `background.js` — toolbar icon click and badge
- `content.js` — finds the video, builds the PiP window, subtitles and controls
- `content.css` — placeholder on the page and the YouTube player button
- `yt-bridge.js` — runs inside the YouTube page: caption capture and player volume/seek
