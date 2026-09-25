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
*   so credentials are dropped when a redirect leaves Trello (e.g. to signed storage URLs).
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
      return response;
    }
    const location = response.headers.get("Location");
    const nextUrl = location ? parseHttpsUrl(location, url) : null;
    if (!nextUrl) {
      return new Response("Bad upstream redirect", { status: 502 });
    }
    url = nextUrl;
  }
  return new Response("Too many upstream redirects", { status: 502 });
}

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Methods": ALLOWED_METHODS.join(","),
      "Access-Control-Max-Age": "86400",
    };
    const allowedOrigins = resolveAllowedOrigins(env);
    if (allowedOrigins.length === 0) {
      return new Response("Proxy is not configured: set ALLOWED_ORIGIN_DOMAIN", { status: 500 });
    }

    const url = new URL(request.url);
    const targetUrl = parseHttpsUrl(url.searchParams.get("url"));
    const origin = request.headers.get("Origin");

    if (!targetUrl || !isTrelloHost(targetUrl)) {
      return new Response("Forbidden", { status: 403 });
    }

    if (
      !origin ||
      !allowedOrigins.some((domain) => originMatchesAllowedDomain(origin, domain))
    ) {
      return new Response("Forbidden", { status: 403 });
    }

    if (!ALLOWED_METHODS.includes(request.method)) {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { ...corsHeaders, Allow: ALLOWED_METHODS.join(", ") },
      });
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

    try {
      let response = await fetchUpstream(
        targetUrl,
        request.method,
        request.headers.get("x-trello-auth")
      );
      response = new Response(response.body, response);
      response.headers.delete("Set-Cookie");
      response.headers.set("Access-Control-Allow-Origin", origin);
      response.headers.set("Vary", "Origin");
      response.headers.set("Cache-Control", "private, max-age=86400");

      return response;
    } catch (err) {
      console.error("Proxy fetch error:", err);
      return new Response("Proxy fetch error", { status: 502 });
    }
  }
};
