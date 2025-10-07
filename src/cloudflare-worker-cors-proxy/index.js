/**
* Trello CORS Proxy for Cloudflare Workers.
* Securely streams private Trello attachment URLs to bypass CORS restrictions in Power-Up apps.
* Converts x-trello-auth request header to Authorization header.
*/
const DEFAULT_ALLOWED_ORIGIN = "yourdomain.com";

function resolveAllowedOrigins(env) {
  if (!env || !env.ALLOWED_ORIGIN_DOMAIN) {
    return [DEFAULT_ALLOWED_ORIGIN];
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
  } catch (err) {
    return origin.endsWith(trimmedDomain);
  }
}

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
      "Access-Control-Max-Age": "86400",
    };
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get("url");
    const origin = request.headers.get("Origin");
    const allowedOrigins = resolveAllowedOrigins(env);

    if (!targetUrl) {
      return new Response("Forbidden", { status: 403 });
    }

    if (
      !origin ||
      !allowedOrigins.some((domain) => originMatchesAllowedDomain(origin, domain))
    ) {
      return new Response("Forbidden", { status: 403 });
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

    const requestHeaders = {};
    if (request.headers.has("x-trello-auth")) {
      requestHeaders["Authorization"] = request.headers.get("x-trello-auth");
    }

    try {
      const upstreamRequest = new Request(targetUrl, {
        method: request.method,
        headers: requestHeaders,
        redirect: "follow",
      });

      let response = await fetch(upstreamRequest);
      response = new Response(response.body, response);
      response.headers.set("Access-Control-Allow-Origin", origin);
      response.headers.set("Vary", "Origin");

      return response;
    } catch (err) {
      return new Response("Proxy fetch error: " + err.message, { status: 500 });
    }
  }
};
