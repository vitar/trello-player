# Trello CORS Proxy for Cloudflare Workers

Securely streams private Trello attachment URLs to bypass CORS restrictions in Power-Up apps.

Converts `x-trello-auth` request header to Authorization header.

## Cloudflare Worker deployment

The CORS proxy located in `index.js` can now be
deployed automatically through Cloudflare's GitHub connector. The Worker reads
an `ALLOWED_ORIGIN_DOMAIN` environment variable (a comma-separated list of
domains) to decide which Trello Power-Up origins can use the proxy. If the
variable is not set or empty, the Worker refuses every request (HTTP 500) so a
misconfigured deployment is never an open proxy.

Security rules enforced by the Worker (tested in `test/cors-proxy.test.js`):

- Only `https://` URLs on `trello.com` or `api.trello.com` can be proxied;
  anything else gets HTTP 403.
- Only `GET`, `HEAD` and `OPTIONS` are accepted.
- The `x-trello-auth` header is sent upstream as `Authorization` only to Trello
  hosts. Redirects are followed manually and the credentials are dropped when a
  redirect leaves Trello (for example to a signed storage URL).
- Every request the Worker refuses or cannot complete gets the same bare
  `403 Forbidden`, whatever the reason, so callers cannot probe which rule
  failed. The reason (`origin_not_allowed`, `target_not_allowed`,
  `not_configured`, ...) is logged as JSON; view it with `wrangler tail` or in
  the Cloudflare dashboard (**Workers → your Worker → Logs**; persistent logs
  need Workers Logs / observability enabled). Any other status comes from
  Trello. Upstream `Set-Cookie` headers are not passed to the browser.

Choosing `ALLOWED_ORIGIN_DOMAIN`: the browser's `Origin` header contains only
the scheme and host, never the path. With GitHub Pages, production
(`https://<user>.github.io/<repo>/`) and pull request previews
(`https://<user>.github.io/<repo>/preview/pr-<n>/`) therefore share one origin,
so `<user>.github.io` allows both. Never set it to `github.io`: that would allow
every GitHub Pages site.

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
