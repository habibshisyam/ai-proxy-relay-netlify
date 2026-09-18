const DEFAULT_HEALTH_HOSTS = ["httpbin.org", "api.httpbin.org", "www.google.com"];
const DROP_HEADERS = new Set([
  "x-relay-target", "x-relay-path", "host",
  "connection", "keep-alive", "proxy-connection",
  "content-length", "transfer-encoding", "accept-encoding",
  "te", "trailer", "upgrade",
  "cf-connecting-ip", "cf-ipcountry", "cf-ray", "cf-visitor", "cf-request-id",
  "x-forwarded-for", "x-forwarded-proto", "x-real-ip",
  "x-nf-request-id", "x-nf-client-connection-ip",
]);
const DROP_RESPONSE_HEADERS = new Set([
  "content-encoding", "content-length", "transfer-encoding",
  "connection", "keep-alive", "proxy-connection",
  "te", "trailer", "upgrade",
]);

export default async function handler(request) {
  const url = new URL(request.url);

  if (url.pathname === "/__health") {
    return json({ ok: true, runtime: "netlify-edge" });
  }
  if (request.method === "CONNECT") {
    return json({ error: "CONNECT is not supported; use header relay mode" }, 405);
  }

  const target = request.headers.get("x-relay-target");
  let relayPath = request.headers.get("x-relay-path") || "/";
  if (!target) return json({ error: "Missing x-relay-target header" }, 400);
  if (!/^https?:\/\//i.test(target)) {
    return json({ error: "x-relay-target must start with http:// or https://" }, 400);
  }

  let targetUrl;
  try {
    targetUrl = new URL(target);
  } catch {
    return json({ error: "Invalid x-relay-target URL" }, 400);
  }

  const healthHosts = (Netlify.env.get("HEALTH_HOSTS") || DEFAULT_HEALTH_HOSTS.join(","))
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  if (healthHosts.includes(targetUrl.hostname.toLowerCase())) {
    return json({
      ok: true,
      service: "relay-health-shim",
      target: targetUrl.hostname.toLowerCase(),
      status: "passed",
    });
  }

  relayPath += url.search;
  const upstreamUrl = target.replace(/\/+$/, "") +
    (relayPath.startsWith("/") ? relayPath : `/${relayPath}`);

  const headers = new Headers(request.headers);
  for (const name of DROP_HEADERS) headers.delete(name);
  headers.set("accept-encoding", "identity");

  const init = {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
  };

  try {
    const upstream = await fetch(upstreamUrl, init);
    const responseHeaders = new Headers(upstream.headers);
    for (const name of DROP_RESPONSE_HEADERS) responseHeaders.delete(name);

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    return json({
      error: error?.message || "Upstream request failed",
      target: upstreamUrl,
    }, 502);
  }
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}
