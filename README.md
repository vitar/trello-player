# Audio Player Power-Up for Trello

Audio Player Power-Up is a custom Trello Power-Up that plays audio attachments on a board list. Attachments ending in `.m4a` or `.mp3` are grouped into a playlist.  The Power-Up can also store a waveform for each attachment in Trello card storage so that the waveform can be displayed later.

<img src="trello-player-screenshot.png" width="600">

The files in this repository are static and can be hosted on any static hosting provider.  GitHub Pages works well &mdash; fork https://github.com/vitar/trello-player/ repository and enable Pages to serve the files.

## Repository structure
- `src/trello-power-up/` &mdash; HTML, CSS and JavaScript that power the Trello popup experience, including the `trello-player-config.js` bootstrap that exposes runtime configuration to the player.
- `src/cloudflare-worker-cors-proxy/` &mdash; Cloudflare Worker source used to provide CORS access to Trello attachments.
- `test/` &mdash; jsdom-based smoke tests that ensure the popup loads attachments when the Trello API is mocked.

## Enabling the Power-Up in Trello
1. Open the [Trello Power-Up admin page](https://trello.com/power-ups/admin) and choose **New**.
2. Fill in the form:
   - **New Power-Up or Integration**: `Audio Player`
   - **Workspace**: choose your workspace
   - **Iframe connector URL**: the URL of `trello-player-power-up.html`
   - **Email**, **Support contact** and **Author**: your details
3. After creation open the Power-Up settings and configure:
   - **Icon**: link to `trello-player-192.png`
   - **Categories**: *Files management* and *Board utilities*
   - Enable **List actions** in **Capabilities**
   - Under **Privacy and compliance** set **Privacy URL** to the hosted `privacy.html` and answer **No** to storing Trello user personal data
4. Add the Power-Up to a board via **Power-Ups → Custom → Audio Player**.
5. In a board list open the list menu (`...`) and select **Audio Player**.

## Usage
- The popup displays all `.m4a` and `.mp3` attachments from cards in the list.
- Use **Previous** and **Next** to navigate the playlist while the audio player plays each attachment.
- Click the wrench next to the waveform area to create the waveform:
  1. Download the file.
  2. Load the downloaded file into the modal.
  3. Save the waveform back to Trello storage.

The Power-Up has been briefly tested in desktop and mobile Chrome.
_Trello mobile apps do not support custom Power-Ups._

## Proxy configuration
- `trello-player-config.js` defines `window.trelloPlayerConfig.proxyUrl`.
- During the GitHub Actions build the `Build and Publish Trello Power-Up` workflow reads the `PROXY_URL` environment variable
  (configured in the repository **Settings → Environments**) and rewrites `trello-player-config.js` in the deployment folder so
  GitHub Pages serves your private proxy URL.
- For local development you can temporarily override the proxy by editing `src/trello-power-up/trello-player-config.js` or by
  defining `window.trelloPlayerConfig.proxyUrl` in the browser console before loading attachments.

## Known issues
- This Power-Up does not conform to Trello requirements and is not publicly listed, but it can be self-hosted and enabled in your workspace.

## License
The project is released under the [Unlicense](LICENSE).  Security issues can be reported by opening an issue in this repository as described in [SECURITY.md](SECURITY.md).

## Development
The project is being developed and maintained using OpenAI Codex with minimal manual intervention.

## Test automation
The `test` folder contains a small Node.js script that loads
`trello-player-power-up-popup.html` in a mock Trello environment using
[jsdom](https://github.com/jsdom/jsdom). The test reads the HTML from disk so it
always matches the current popup structure. Run `npm install` to fetch the test
dependency and then run `npm test` to execute `test/power-up-loading-test.js`,
which verifies that the Power-Up can load attachments when the Trello API is
mocked.

GitHub Actions can run this test automatically.  A workflow file is provided in
`.github/workflows/test.yml` that installs dependencies and runs `npm test` on
every push or pull request targeting `main`.

## Cloudflare Worker deployment

The CORS proxy located in `src/cloudflare-worker-cors-proxy/index.js` can now be
deployed automatically through Cloudflare's GitHub connector. The Worker reads
an `ALLOWED_ORIGIN_DOMAIN` environment variable (a comma-separated list of
domains) to decide which Trello Power-Up origins can use the proxy. If the
variable is not set, it defaults to `yourdomain.com` so the previous manual
behaviour still works.

1. Update `src/cloudflare-worker-cors-proxy/wrangler.toml` if required:
   - Change the `name` field to match your Worker name in Cloudflare.
   - Optionally remove the default `ALLOWED_ORIGIN_DOMAIN` value because the
     deployment will override it with a build variable.
2. In the Cloudflare dashboard create (or open) your Worker and go to the
   **Deployments** tab. Choose **Connect to Git** and select this repository and
   the branch you want to deploy.
3. Set the connector options:
   - **Root Directory**: `src/cloudflare-worker-cors-proxy`
   - **Build command**: leave empty (Cloudflare will upload `index.js` directly
     using the Wrangler configuration).
   - **Build output directory**: leave empty.
4. After the repository is connected, open the Worker **Settings → Variables**
   page and add a plain text variable named `ALLOWED_ORIGIN_DOMAIN`. Enter the
   domain (or comma-separated domains) that should be able to call the proxy,
   such as `yourdomain.com` or `app.yourdomain.com,admin.yourdomain.com`.
5. Trigger a deployment from Cloudflare or by merging a commit into the linked
   branch. The Worker will be published automatically with the updated source.
