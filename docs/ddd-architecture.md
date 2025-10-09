# Trello Audio Player – DDD Diagram (ASCII/Markdown)

This document summarizes the Trello Audio Player Power-Up using Domain-Driven Design terminology. It organizes the runtime responsibilities into bounded contexts, highlights core entities/aggregates, enumerates domain events, and maps high-level flows and dependencies.

## Bounded Context Overview

| Context | Responsibilities | Key Modules | External Dependencies | Events Emitted |
| --- | --- | --- | --- | --- |
| Power-Up Activation | Register the "Audio Player" list action and open the popup modal when invoked. | `trello-player-power-up.js` | Trello Power-Up SDK (`window.TrelloPowerUp`) | `ListActionInvoked` |
| Authorization & Configuration | Collect API key, launch Trello auth popup, persist credentials, and switch UI between auth form and attachment list. | `authorizeBtn` handler, `init()` bootstrap, config bootstrap (`trello-player-config.js`) | Trello REST API (`/members/me`), Trello auth iframe, board/member storage | `AuthRequested`, `TokenValidated`, `AuthRejected` |
| Attachment Aggregation | Load list metadata, fetch cards + attachments, filter audio types, render playlist, manage selection state. | `loadPlayer`, `loadAttachment`, DOM templates | Trello REST API (`/lists/{id}/cards`), Proxy URL | `PlaylistBuilt`, `AttachmentSelected`, `AttachmentLoadFailed` |
| Playback & Waveform | Stream audio through proxy, drive `<audio>` element, manage waveform preview custom element, respond to playback controls. | `getAttachmentBlob`, `WaveformPreview` Web Component, playback button handlers | Wavesurfer.js, HTMLMediaElement | `WaveformReady`, `PlaybackStarted`, `PlaybackEnded` |
| Pitch Control | Initialize AudioWorklet, wire SoundTouch processor, expose pitch slider UI, persist per-attachment pitch preference. | `ensureSoundtouchNode`, `applyPitchValue`, slider event handlers | Web Audio API, `soundtouch-worklet.js`, Trello board shared storage | `PitchChanged`, `PitchPersisted`, `PitchUnavailable` |
| Cloudflare Proxy | Validate request origin, forward proxied attachment requests, surface CORS headers. | `src/cloudflare-worker-cors-proxy/index.js` | Cloudflare Workers, Trello attachment URLs | `ProxyRequestAuthorized`, `ProxyRequestRejected`, `ProxyError` |

## Core Entities & Aggregates

| Entity / Aggregate | Description | Lifecycle / Storage |
| --- | --- | --- |
| List Action (`Audio Player`) | Trello command entry point that exposes the modal when a user selects the action on a list. | Declared during Power-Up initialization; reused per list session. 【F:src/trello-power-up/trello-player-power-up.js†L1-L21】 |
| Authorization Session | Captures API key input, Trello OAuth token exchange, and validation status. | Uses Trello shared/private storage and reloads UI after success. 【F:src/trello-power-up/trello-player-power-up-popup.js†L39-L122】【F:src/trello-power-up/trello-player-power-up-popup.js†L442-L525】 |
| Attachment Playlist | Ordered collection of `.m4a`/`.mp3` attachments derived from list cards, with current selection tracking. | Rebuilt per load; persists pitch preferences keyed by card and attachment ID. 【F:src/trello-power-up/trello-player-power-up-popup.js†L261-L348】 |
| Waveform Preview Component | Custom element encapsulating waveform rendering, message/wrench toggles, and cleanup. | Instantiated from template; interacts with Wavesurfer lifecycle and UI state. 【F:src/trello-power-up/trello-player-power-up-popup.js†L58-L125】 |
| Pitch Preference | Per-attachment semitone offset persisted to Trello board shared storage. | Computed and saved via `applyPitchValue` and retrieved when loading attachments. 【F:src/trello-power-up/trello-player-power-up-popup.js†L238-L258】【F:src/trello-power-up/trello-player-power-up-popup.js†L327-L347】 |
| Proxy Request | Representation of an attachment fetch that is authorized and forwarded by the worker. | Validated against allowed origins, rewrapped with `Authorization` header, returns streaming response. 【F:src/cloudflare-worker-cors-proxy/index.js†L37-L91】 |

## Domain Events & Commands

```
+----------------------+-------------------------------+------------------------------+
| Event / Command      | Trigger                       | Handling Context             |
+----------------------+-------------------------------+------------------------------+
| ListActionInvoked    | User selects "Audio Player"   | Power-Up Activation opens    |
|                      | from Trello list actions.     | modal iframe.                |
| AuthRequested        | User clicks Authorize.        | Authorization context opens |
|                      |                               | Trello OAuth popup.          |
| TokenValidated       | OAuth popup posts valid token.| Authorization hides form,    |
|                      |                               | persists token, reloads UI.  |
| PlaylistBuilt        | Cards + attachments fetched.  | Attachment Aggregation fills |
|                      |                               | playlist UI.                 |
| AttachmentSelected   | User click / auto-next.       | Attachment context fetches   |
|                      |                               | audio via proxy.             |
| WaveformReady        | Waveform component loads URL. | Playback context renders UI. |
| PlaybackEnded        | `<audio>` fires `ended`.      | Auto-advances to next track. |
| PitchChanged         | Slider input/change events.   | Pitch context updates        |
|                      |                               | SoundTouch + storage.        |
| ProxyRequestRejected | Proxy rejects origin/params.  | Error surfaced to fetcher.   |
+----------------------+-------------------------------+------------------------------+
```

## Interaction Flow (ASCII)

```
[List Action]
    |
    | ListActionInvoked
    v
[Popup Init] --AuthRequested--> [Authorization]
    | (valid token)                     |
    | TokenValidated                    | ProxyRequestRejected?
    v                                   v
[Attachment Aggregation] --AttachmentSelected--> [Proxy Fetch]
    | PlaylistBuilt                                    |
    v                                                  v
[Playback & Waveform] <----WaveformReady---- [Waveform Component]
    |
    | PitchChanged / PitchPersisted
    v
[SoundTouch AudioWorklet]
```

## Cross-Cutting Concerns

- **Configuration Injection** – The popup reads `window.trelloPlayerConfig.proxyUrl`, with a default provided by `trello-player-config.js`, so deployments can swap proxy hosts without code changes. 【F:src/trello-power-up/trello-player-config.js†L1-L7】【F:src/trello-power-up/trello-player-power-up-popup.js†L21-L31】
- **Error Handling & Resilience** – Attachment loads guard against stale object URLs and restore UI selection on errors; proxy failures and authorization issues alert the user. 【F:src/trello-power-up/trello-player-power-up-popup.js†L300-L348】【F:src/trello-power-up/trello-player-power-up-popup.js†L442-L494】
- **External Libraries** – The popup relies on Wavesurfer.js for waveform rendering and a SoundTouch AudioWorklet for pitch shifting, initialized on demand to respect browser autoplay policies. 【F:src/trello-power-up/trello-player-power-up-popup.html†L58-L61】【F:src/trello-power-up/trello-player-power-up-popup.js†L200-L248】【F:src/trello-power-up/soundtouch-worklet.js†L1-L120】
- **Security Boundaries** – The Cloudflare Worker validates origin domains and converts the `x-trello-auth` header into the upstream `Authorization` header so Trello credentials never reach the browser directly. 【F:src/cloudflare-worker-cors-proxy/index.js†L37-L91】
