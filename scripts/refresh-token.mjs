#!/usr/bin/env node
/**
 * Refreshes the Strava access token using the refresh token in .env
 * Run with: node scripts/refresh-token.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env');

// Parse .env file
function parseEnv(content) {
  const vars = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    vars[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return vars;
}

// Update a single key in .env file
function updateEnv(content, key, value) {
  const lines = content.split('\n');
  let updated = false;
  const newLines = lines.map(line => {
    if (line.startsWith(`${key}=`)) {
      updated = true;
      return `${key}=${value}`;
    }
    return line;
  });
  if (!updated) newLines.push(`${key}=${value}`);
  return newLines.join('\n');
}

async function main() {
  const envContent = readFileSync(envPath, 'utf-8');
  const env = parseEnv(envContent);

  const { STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_REFRESH_TOKEN } = env;
  if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET || !STRAVA_REFRESH_TOKEN) {
    console.error('Missing STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, or STRAVA_REFRESH_TOKEN in .env');
    process.exit(1);
  }

  console.log('Refreshing Strava access token...');

  const resp = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      refresh_token: STRAVA_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    console.error(`Strava API error ${resp.status}: ${body}`);
    process.exit(1);
  }

  const data = await resp.json();
  const { access_token, refresh_token, expires_at } = data;

  let updated = envContent;
  updated = updateEnv(updated, 'STRAVA_ACCESS_TOKEN', access_token);
  updated = updateEnv(updated, 'STRAVA_REFRESH_TOKEN', refresh_token);
  writeFileSync(envPath, updated.trimEnd() + '\n');

  console.log(`✅ Token refreshed. Expires: ${new Date(expires_at * 1000).toLocaleString()}`);
  console.log('   .env updated. Restart the server to pick up the new token.');
}

main().catch(e => { console.error(e); process.exit(1); });
