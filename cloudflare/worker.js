function apiOrigin(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" ? url.origin : "";
  } catch {
    return "";
  }
}

export default {
  async fetch(request, env) {
    const requestUrl = new URL(request.url);
    const upstream = apiOrigin(env.API_ORIGIN);
    if (requestUrl.pathname === "/api" || requestUrl.pathname.startsWith("/api/")) {
      if (!upstream || !env.API_PROXY_SECRET) return Response.json({ message: "La API del club no está configurada." }, { status: 503, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
      const upstreamUrl = new URL(`${requestUrl.pathname}${requestUrl.search}`, upstream);
      const headers = new Headers(request.headers);
      headers.set("X-Forwarded-Host", requestUrl.host);
      headers.set("X-PadelBook-Proxy", env.API_PROXY_SECRET);
      if (request.headers.get("CF-Connecting-IP")) headers.set("X-Forwarded-For", request.headers.get("CF-Connecting-IP"));
      const body = ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer();
      const upstreamResponse = await fetch(new Request(upstreamUrl, { method: request.method, headers, body, redirect: "manual" }));
      const responseHeaders = new Headers(upstreamResponse.headers);
      responseHeaders.set("Cache-Control", "no-store");
      responseHeaders.set("X-Content-Type-Options", "nosniff");
      return new Response(upstreamResponse.body, { status: upstreamResponse.status, statusText: upstreamResponse.statusText, headers: responseHeaders });
    }
    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);
    headers.set("Content-Security-Policy", "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; media-src 'self'; manifest-src 'self'; upgrade-insecure-requests");
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("X-Frame-Options", "DENY");
    headers.set("X-Permitted-Cross-Domain-Policies", "none");
    headers.set("Cross-Origin-Opener-Policy", "same-origin");
    headers.set("Cross-Origin-Resource-Policy", "same-origin");
    headers.set("Origin-Agent-Cluster", "?1");
    headers.set("Strict-Transport-Security", "max-age=31536000");
    if ((headers.get("content-type") || "").includes("text/html")) headers.set("Cache-Control", "no-store");
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  },
};
