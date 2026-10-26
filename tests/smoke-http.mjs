import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';

const port = Number(process.env.SMOKE_PORT || 3147);
const baseUrl = `http://127.0.0.1:${port}`;
const env = {
  ...process.env,
  NODE_ENV: 'production',
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://example.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'ci-placeholder-public-key-not-for-runtime',
};
const server = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)],
  { env, stdio: ['ignore', 'pipe', 'pipe'] },
);

let logs = '';
server.stdout.on('data', (chunk) => { logs += chunk.toString(); });
server.stderr.on('data', (chunk) => { logs += chunk.toString(); });

async function getResponse(path) {
  const response = await fetch(`${baseUrl}${path}`, { redirect: 'manual' });
  assert.ok(
    response.status >= 200 && response.status < 400,
    `${path} returned HTTP ${response.status}\n${logs}`,
  );
  return response;
}

try {
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (server.exitCode !== null) {
      throw new Error(`Next.js server exited with ${server.exitCode}\n${logs}`);
    }
    try {
      const response = await fetch(baseUrl);
      if (response.status < 500) {
        ready = true;
        break;
      }
    } catch {
      // The server can take several seconds to open its port after startup.
    }
    await delay(500);
  }
  assert.ok(ready, `Next.js production server did not become ready\n${logs}`);

  const routes = [
    '/',
    '/sell',
    '/profile',
    '/orders',
    '/messages',
    '/signin',
    '/help',
    '/explore',
    '/manifest.webmanifest',
    '/pwa-icon/180',
    '/pwa-icon/192',
    '/pwa-icon/512',
    '/opengraph-image',
    '/sw.js',
  ];
  const results = [];
  for (const route of routes) {
    const response = await getResponse(route);
    if (route.startsWith('/pwa-icon/') || route === '/opengraph-image') {
      assert.match(response.headers.get('content-type') || '', /image\\/png/i, `${route} should return a PNG image`);
    }
    results.push(`${response.status} ${route}`);
  }
  console.log('Production HTTP smoke test passed:', results.join(', '));
} finally {
  server.kill('SIGTERM');
  await Promise.race([
    new Promise((resolve) => server.once('close', resolve)),
    delay(3000),
  ]);
}
