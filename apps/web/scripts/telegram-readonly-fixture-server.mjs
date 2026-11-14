import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

/** Test-only loopback static fixture; no SPA fallback or user-file endpoint. */
export function createReadonlyFixtureServer(directory) {
 const output = resolve(directory);
 return createServer(async (request, response) => {
  try {
   const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
   const file = resolve(output, `.${pathname === '/' ? '/index.html' : pathname}`);
   if (!file.startsWith(output + sep)) { response.writeHead(404).end(); return; }
   const bytes = await readFile(file);
   response.writeHead(200, { 'Content-Type': file.endsWith('.html') ? 'text/html' : file.endsWith('.js') ? 'text/javascript' : 'application/octet-stream', 'Cache-Control': 'no-store' }).end(bytes);
  } catch {
   if (!response.headersSent) response.writeHead(404);
   response.end();
  }
 });
}
