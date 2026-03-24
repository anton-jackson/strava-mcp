import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

export const OAUTH_CLIENT_ID = process.env.OAUTH_CLIENT_ID || 'strava-mcp';
const OAUTH_CLIENT_SECRET = process.env.OAUTH_CLIENT_SECRET;

const TOKEN_STORE_PATH = path.join(projectRoot, '.oauth-tokens.json');

interface TokenStore {
  accessTokens: Record<string, { expiresAt: number }>;
  refreshTokens: Record<string, { clientId: string }>;
}

// In-memory auth codes (5 min TTL, not persisted)
const authCodes = new Map<string, {
  clientId: string;
  redirectUri: string;
  state: string;
  expiresAt: number;
}>();

function loadTokenStore(): TokenStore {
  try {
    return JSON.parse(fs.readFileSync(TOKEN_STORE_PATH, 'utf-8'));
  } catch {
    return { accessTokens: {}, refreshTokens: {} };
  }
}

function saveTokenStore() {
  fs.writeFileSync(TOKEN_STORE_PATH, JSON.stringify(tokenStore, null, 2));
}

const tokenStore = loadTokenStore();

// 90-day access tokens — avoids constant re-auth
const ACCESS_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export function validateClient(clientId: string, clientSecret: string): boolean {
  if (!OAUTH_CLIENT_SECRET) return false;
  return clientId === OAUTH_CLIENT_ID && clientSecret === OAUTH_CLIENT_SECRET;
}

export function generateAuthCode(clientId: string, redirectUri: string, state: string): string {
  const code = crypto.randomBytes(32).toString('hex');
  authCodes.set(code, {
    clientId,
    redirectUri,
    state,
    expiresAt: Date.now() + 5 * 60 * 1000,
  });
  return code;
}

export function redeemAuthCode(
  code: string,
  clientId: string,
  redirectUri: string
): boolean {
  const entry = authCodes.get(code);
  if (!entry) return false;
  if (entry.expiresAt < Date.now()) { authCodes.delete(code); return false; }
  if (entry.clientId !== clientId || entry.redirectUri !== redirectUri) return false;
  authCodes.delete(code);
  return true;
}

export function issueTokens(clientId: string): {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
} {
  const accessToken = crypto.randomBytes(32).toString('hex');
  const refreshToken = crypto.randomBytes(32).toString('hex');
  const expiresIn = Math.floor(ACCESS_TOKEN_TTL_MS / 1000);

  tokenStore.accessTokens[accessToken] = { expiresAt: Date.now() + ACCESS_TOKEN_TTL_MS };
  tokenStore.refreshTokens[refreshToken] = { clientId };
  saveTokenStore();

  return { access_token: accessToken, refresh_token: refreshToken, token_type: 'bearer', expires_in: expiresIn };
}

export function refreshAccessToken(refreshToken: string): {
  access_token: string;
  token_type: string;
  expires_in: number;
} | null {
  const entry = tokenStore.refreshTokens[refreshToken];
  if (!entry) return null;

  const accessToken = crypto.randomBytes(32).toString('hex');
  const expiresIn = Math.floor(ACCESS_TOKEN_TTL_MS / 1000);

  tokenStore.accessTokens[accessToken] = { expiresAt: Date.now() + ACCESS_TOKEN_TTL_MS };
  saveTokenStore();

  return { access_token: accessToken, token_type: 'bearer', expires_in: expiresIn };
}

export function validateAccessToken(token: string): boolean {
  const entry = tokenStore.accessTokens[token];
  if (!entry) return false;
  if (entry.expiresAt < Date.now()) {
    delete tokenStore.accessTokens[token];
    saveTokenStore();
    return false;
  }
  return true;
}

export function authorizePage(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  error?: string;
}): string {
  const { clientId, redirectUri, state, error } = params;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Authorize – Strava MCP</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           background: #f5f5f5; display: flex; align-items: center; justify-content: center;
           min-height: 100vh; padding: 1rem; }
    .card { background: white; border-radius: 12px; padding: 2rem; max-width: 400px;
            width: 100%; box-shadow: 0 2px 16px rgba(0,0,0,0.1); text-align: center; }
    .icon { font-size: 3rem; margin-bottom: 1rem; }
    h1 { font-size: 1.4rem; font-weight: 600; margin-bottom: 0.5rem; color: #111; }
    p { color: #555; font-size: 0.95rem; margin-bottom: 1.5rem; }
    .client { font-family: monospace; background: #f0f0f0; padding: 2px 6px;
              border-radius: 4px; font-size: 0.9rem; }
    .error { color: #c00; background: #fee; border: 1px solid #fcc;
             border-radius: 6px; padding: 0.75rem; margin-bottom: 1rem; font-size: 0.9rem; }
    button { width: 100%; padding: 0.85rem; border: none; border-radius: 8px;
             font-size: 1rem; font-weight: 600; cursor: pointer; transition: opacity 0.15s; }
    .authorize { background: #FC4C02; color: white; }
    .authorize:hover { opacity: 0.9; }
    .deny { background: #eee; color: #333; margin-top: 0.75rem; }
    .deny:hover { background: #ddd; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">🚴</div>
    <h1>Authorize Strava MCP</h1>
    <p><span class="client">${escapeHtml(clientId)}</span> is requesting access to your Strava data.</p>
    ${error ? `<div class="error">${escapeHtml(error)}</div>` : ''}
    <form method="POST" action="/oauth/authorize">
      <input type="hidden" name="client_id" value="${escapeHtml(clientId)}">
      <input type="hidden" name="redirect_uri" value="${escapeHtml(redirectUri)}">
      <input type="hidden" name="state" value="${escapeHtml(state)}">
      <button type="submit" name="action" value="authorize" class="authorize">Authorize</button>
      <button type="submit" name="action" value="deny" class="deny">Deny</button>
    </form>
  </div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
