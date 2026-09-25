/**
* Trello CORS Proxy for Cloudflare Workers.
* Securely streams private Trello attachment URLs to bypass CORS restrictions in Power-Up apps.
* Converts x-trello-auth request header to Authorization header.
*
* Security rules (covered by test/cors-proxy.test.js):
* - Requests are only served for origins listed in ALLOWED_ORIGIN_DOMAIN; if it is not
*   configured, every request is refused.
* - Only https URLs on Trello hosts can be requested.
* - Trello credentials are only ever sent to Trello hosts. Redirects are followed manually
*   so credentials are dropped when a redirect leaves Trello (e.g. signed storage URLs).
* - Every request the proxy refuses or cannot complete gets the same bare 403 "Forbidden",
*   so callers cannot probe which rule failed. The reason is logged for the operator
*   (Cloudflare dashboard -> Workers -> Logs, or `wrangler tail`). Any other status comes
*   from Trello itself.
*/

// Hosts the proxy may be asked to fetch, and the only hosts that receive the
// user's Trello credentials. Never add non-Trello hosts here.
export const TRELLO_HOSTS = ["trello.com", "api.trello.com"];

const ALLOWED_METHODS = ["GET", "HEAD", "OPTIONS"];
const MAX_REDIRECTS = 5;

function resolveAllowedOrigins(env) {
  if (!env || typeof env.ALLOWED_ORIGIN_DOMAIN !== "string") {
    return [];
  }

  return env.ALLOWED_ORIGIN_DOMAIN
    .split(",")
    .map((domain) => domain.trim())
    .filter((domain) => domain.length > 0);
}

function originMatchesAllowedDomain(origin, domain) {
  if (!domain) {
    return false;
  }

  const trimmedDomain = domain.replace(/^\*\./, "");

  try {
    const originHost = new URL(origin).hostname;
    return (
      originHost === trimmedDomain ||
      originHost.endsWith(`.${trimmedDomain}`)
    );
  } catch {
    return false;
  }
}

function parseHttpsUrl(value, base) {
  try {
    const url = new URL(value, base);
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function isTrelloHost(url) {
  return TRELLO_HOSTS.includes(url.hostname);
}

// Logged rejection reasons. Keep them out of the response body.
export const REJECT_REASONS = Object.freeze({
  NOT_CONFIGURED: "not_configured",
  INVALID_TARGET: "invalid_target",
  TARGET_NOT_ALLOWED: "target_not_allowed",
  ORIGIN_NOT_ALLOWED: "origin_not_allowed",
  METHOD_NOT_ALLOWED: "method_not_allowed",
  BAD_REDIRECT: "bad_redirect",
  TOO_MANY_REDIRECTS: "too_many_redirects",
  UPSTREAM_ERROR: "upstream_error",
});

// Logs only non-sensitive request metadata: never credentials, query strings or paths.
function reject(reason, request, details = {}) {
  console.warn(
    JSON.stringify({
      event: "proxy_rejected",
      reason,
      method: request.method,
      origin: request.headers.get("Origin"),
      ...details,
    })
  );
  return new Response("Forbidden", { status: 403 });
}

function hostOf(value) {
  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}

function isRedirect(status) {
  return status >= 300 && status < 400;
}

async function fetchUpstream(targetUrl, method, authorization) {
  let url = targetUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const headers = {};
    if (authorization && isTrelloHost(url)) {
      headers["Authorization"] = authorization;
    }
    const response = await fetch(
      new Request(url.toString(), { method, headers, redirect: "manual" })
    );
    if (!isRedirect(response.status)) {
      return { response };
    }
    const location = response.headers.get("Location");
    const nextUrl = location ? parseHttpsUrl(location, url) : null;
    if (!nextUrl) {
      return { rejectReason: REJECT_REASONS.BAD_REDIRECT, host: url.hostname };
    }
    url = nextUrl;
  }
  return { rejectReason: REJECT_REASONS.TOO_MANY_REDIRECTS, host: url.hostname };
}

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Methods": ALLOWED_METHODS.join(","),
      "Access-Control-Max-Age": "86400",
    };
    const allowedOrigins = resolveAllowedOrigins(env);
    if (allowedOrigins.length === 0) {
      return reject(REJECT_REASONS.NOT_CONFIGURED, request);
    }

    const url = new URL(request.url);
    const rawTarget = url.searchParams.get("url");
    const targetUrl = parseHttpsUrl(rawTarget);
    const origin = request.headers.get("Origin");

    if (!targetUrl) {
      return reject(REJECT_REASONS.INVALID_TARGET, request, { host: hostOf(rawTarget) });
    }

    if (!isTrelloHost(targetUrl)) {
      return reject(REJECT_REASONS.TARGET_NOT_ALLOWED, request, { host: targetUrl.hostname });
    }

    if (
      !origin ||
      !allowedOrigins.some((domain) => originMatchesAllowedDomain(origin, domain))
    ) {
      return reject(REJECT_REASONS.ORIGIN_NOT_ALLOWED, request);
    }

    if (!ALLOWED_METHODS.includes(request.method)) {
      return reject(REJECT_REASONS.METHOD_NOT_ALLOWED, request);
    }

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          ...corsHeaders,
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Headers": request.headers.get("Access-Control-Request-Headers") || "*",
        },
      });
    }

    let upstream;
    try {
      upstream = await fetchUpstream(
        targetUrl,
        request.method,
        request.headers.get("x-trello-auth")
      );
    } catch (err) {
      return reject(REJECT_REASONS.UPSTREAM_ERROR, request, {
        host: targetUrl.hostname,
        error: String(err?.message ?? err),
      });
    }
    if (upstream.rejectReason) {
      return reject(upstream.rejectReason, request, { host: upstream.host });
    }

    const response = new Response(upstream.response.body, upstream.response);
    response.headers.delete("Set-Cookie");
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Vary", "Origin");
    response.headers.set("Cache-Control", "private, max-age=86400");

    return response;
  }
};
