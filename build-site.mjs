import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root, "dist");
const serverDir = path.join(dist, "server");
const hostingFile = path.join(root, ".openai", "hosting.json");

const files = [
  "index.html",
  "rentals.html",
  "experiences.html",
  "list.html",
  "contact.html",
  "how-it-works.html",
  "styles.css",
  "data.js",
  "app.js"
];

const directories = ["assets", "post"];

await rm(dist, { recursive: true, force: true });
await mkdir(serverDir, { recursive: true });

for (const file of files) {
  await cp(path.join(root, file), path.join(dist, file));
}

for (const directory of directories) {
  if (existsSync(path.join(root, directory))) {
    await cp(path.join(root, directory), path.join(dist, directory), { recursive: true });
  }
}

if (existsSync(hostingFile)) {
  await mkdir(path.join(dist, ".openai"), { recursive: true });
  await cp(hostingFile, path.join(dist, ".openai", "hosting.json"));
}

const worker = `const PRETTY_ROUTES = new Map([
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
    const pathname = decodeURIComponent(url.pathname.replace(/\\/$/, "") || "/");
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
`;

await writeFile(path.join(serverDir, "index.js"), worker);
