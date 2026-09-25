# AGENT INSTRUCTIONS

These instructions apply to the entire repository and describe non-functional conventions that should be followed with each change.

## Asset Versioning
- HTML files reference local `.js` and `.css` files using a query string number for cache busting (e.g. `trello-player.css?6`). Whenever any referenced JS or CSS file is modified, increment the corresponding version number in all HTML files.

## Web Components
- Prefer the Web Components pattern for reusable UI logic. Define custom elements with `customElements.define`.

## Theme Support
- Support both light and dark themes by using CSS variables and the `prefers-color-scheme` media query. New styles should work in both themes.

## Coding Standards
- Use plain ES6 JavaScript without frameworks.

## Checks
- Run `npm ci` once, then `npm run check` (lint + tests + popup build) before every commit. It must pass; CI runs the same steps on every pull request (`.github/workflows/ci.yml`).
- Tests live in `test/*.test.js` and use Node's built-in `node:test` runner. Add or update tests with every behaviour change.
- Tests marked `test.todo` describe known gaps. When you fix one, turn its todo into a real test in the same change.
- Popup modules are concatenated into one scope by `scripts/build-popup.mjs`, so top-level names must be unique across `src/trello-power-up/popup/` (a test enforces this). Keep browser-independent logic in modules that do not touch `window`/`document` at import time so it can be unit tested.
- UI behaviour (audio playback, waveform, Trello auth) is not covered by automated tests yet; verify those changes manually.
