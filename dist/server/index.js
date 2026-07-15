const PRETTY_ROUTES = new Map([
  ["/", "/index.html"],
  ["/rentals", "/rentals.html"],
  ["/experiences", "/experiences.html"],
  ["/list", "/list.html"],
  ["/contact", "/contact.html"],
  ["/how-it-works", "/how-it-works.html"]
]);

function withHeaders(response) {
  const headers = new Headers(response.headers);
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

async function fetchAsset(env, request, pathname) {
  const assetUrl = new URL(pathname, request.url);
  return env.ASSETS.fetch(new Request(assetUrl, request));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = decodeURIComponent(url.pathname.replace(/\/$/, "") || "/");
    const route = PRETTY_ROUTES.get(pathname) || url.pathname;
    const response = await fetchAsset(env, request, route);

    if (response.status !== 404) {
      return withHeaders(response);
    }

    return new Response("Not found", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" }
    });
  }
};
