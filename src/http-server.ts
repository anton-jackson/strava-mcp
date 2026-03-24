import http from "node:http";
import { randomUUID } from "node:crypto";
import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer, initializeStrava } from './server-factory.js';
import {
  OAUTH_CLIENT_ID,
  validateClient,
  validateAccessToken,
  generateAuthCode,
  redeemAuthCode,
  issueTokens,
  refreshAccessToken,
  authorizePage,
} from './oauth.js';

// Load .env file explicitly from project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const envPath = path.join(projectRoot, '.env');
dotenv.config({ path: envPath });

const PORT = parseInt(process.env.PORT || "3000", 10);
const API_KEY = process.env.MCP_API_KEY;
const SERVER_URL = process.env.SERVER_URL || 'https://strava-mcp.antonjackson.com';

if (!API_KEY) {
  console.error("FATAL: MCP_API_KEY environment variable is required.");
  process.exit(1);
}

/**
 * Accepts either the static API key (for Claude Desktop) or an OAuth access token (for web/mobile)
 */
function authenticate(req: http.IncomingMessage): boolean {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.slice(7);

  // Static API key (Claude Desktop via mcp-remote)
  if (token.length === API_KEY!.length) {
    let diff = 0;
    for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ API_KEY!.charCodeAt(i);
    if (diff === 0) return true;
  }

  // OAuth access token (claude.ai web/mobile)
  return validateAccessToken(token);
}

function parseBody(req: http.IncomingMessage): Promise<Record<string, string>> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const params: Record<string, string> = {};
        for (const [k, v] of new URLSearchParams(body)) params[k] = v;
        resolve(params);
      } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

// Session store for stateful MCP connections
const sessions = new Map<string, StreamableHTTPServerTransport>();

async function main() {
  console.log("Starting Strava MCP Server (HTTP)...");
  await initializeStrava();
  console.log("MCP server ready to accept connections.");

  const httpServer = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://localhost:${PORT}`);
    console.log(`[${new Date().toISOString()}] ${req.method} ${url.pathname} session=${req.headers['mcp-session-id'] || 'none'}`);

    // ── OAuth discovery endpoints ──────────────────────────────────────────

    if (url.pathname === '/.well-known/oauth-authorization-server' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        issuer: SERVER_URL,
        authorization_endpoint: `${SERVER_URL}/oauth/authorize`,
        token_endpoint: `${SERVER_URL}/oauth/token`,
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code', 'refresh_token'],
        code_challenge_methods_supported: [],
        token_endpoint_auth_methods_supported: ['client_secret_post'],
      }));
      return;
    }

    if (url.pathname === '/.well-known/oauth-protected-resource' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        resource: SERVER_URL,
        authorization_servers: [SERVER_URL],
      }));
      return;
    }

    // ── OAuth authorization endpoint ───────────────────────────────────────

    if (url.pathname === '/oauth/authorize') {
      if (req.method === 'GET') {
        const clientId = url.searchParams.get('client_id') || '';
        const redirectUri = url.searchParams.get('redirect_uri') || '';
        const state = url.searchParams.get('state') || '';
        const responseType = url.searchParams.get('response_type');

        if (responseType !== 'code' || !clientId || !redirectUri) {
          res.writeHead(400, { 'Content-Type': 'text/plain' });
          res.end('Bad Request: missing required parameters');
          return;
        }

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(authorizePage({ clientId, redirectUri, state }));
        return;
      }

      if (req.method === 'POST') {
        const params = await parseBody(req);
        const { client_id, redirect_uri, state, action } = params;

        if (action === 'deny') {
          const denied = new URL(redirect_uri);
          denied.searchParams.set('error', 'access_denied');
          if (state) denied.searchParams.set('state', state);
          res.writeHead(302, { Location: denied.toString() });
          res.end();
          return;
        }

        // "authorize" — generate code and redirect
        const code = generateAuthCode(client_id, redirect_uri, state);
        const callback = new URL(redirect_uri);
        callback.searchParams.set('code', code);
        if (state) callback.searchParams.set('state', state);
        res.writeHead(302, { Location: callback.toString() });
        res.end();
        return;
      }
    }

    // ── OAuth token endpoint ───────────────────────────────────────────────

    if (url.pathname === '/oauth/token' && req.method === 'POST') {
      const params = await parseBody(req);
      const { grant_type, code, redirect_uri, client_id, client_secret, refresh_token } = params;

      if (!validateClient(client_id, client_secret)) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid_client' }));
        return;
      }

      if (grant_type === 'authorization_code') {
        if (!redeemAuthCode(code, client_id, redirect_uri)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'invalid_grant' }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(issueTokens(client_id)));
        return;
      }

      if (grant_type === 'refresh_token') {
        const result = refreshAccessToken(refresh_token);
        if (!result) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'invalid_grant' }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
        return;
      }

      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'unsupported_grant_type' }));
      return;
    }

    // ── Health check ───────────────────────────────────────────────────────

    if (url.pathname === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    // ── MCP endpoint ───────────────────────────────────────────────────────

    if (url.pathname !== '/mcp') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found' }));
      return;
    }

    if (!authenticate(req)) {
      res.writeHead(401, {
        'Content-Type': 'application/json',
        'WWW-Authenticate': `Bearer realm="${SERVER_URL}", resource_metadata="${SERVER_URL}/.well-known/oauth-protected-resource"`,
      });
      res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message: 'Unauthorized' }, id: null }));
      return;
    }

    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    if (sessionId) {
      if (!sessions.has(sessionId)) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message: 'Session not found' }, id: null }));
        return;
      }
      const transport = sessions.get(sessionId)!;
      try {
        await transport.handleRequest(req, res);
      } catch (error) {
        console.error('Error handling MCP request:', error);
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal error' }, id: null }));
        }
      }
      return;
    }

    if (req.method === 'GET') {
      res.writeHead(405, { 'Content-Type': 'application/json', 'Allow': 'POST' });
      res.end(JSON.stringify({ error: 'Method Not Allowed' }));
      return;
    }

    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json', 'Allow': 'GET, POST, DELETE' });
      res.end(JSON.stringify({ error: 'Method Not Allowed' }));
      return;
    }

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sid) => { sessions.set(sid, transport); },
    });

    transport.onclose = () => {
      const sid = (transport as any).sessionId;
      if (sid) sessions.delete(sid);
    };

    const mcpServer = createServer();
    await mcpServer.connect(transport);

    try {
      await transport.handleRequest(req, res);
    } catch (error) {
      console.error('Error handling MCP request:', error);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal error' }, id: null }));
      }
    }
  });

  httpServer.listen(PORT, () => {
    console.log(`Strava MCP HTTP Server listening on port ${PORT}`);
    console.log(`MCP endpoint: ${SERVER_URL}/mcp`);
    console.log(`OAuth: ${SERVER_URL}/oauth/authorize`);
  });

  process.on('SIGTERM', () => {
    httpServer.close(() => process.exit(0));
  });
  process.on('SIGINT', () => {
    httpServer.close(() => process.exit(0));
  });
}

main().catch((error) => {
  console.error("Failed to start HTTP server:", error);
  process.exit(1);
});
