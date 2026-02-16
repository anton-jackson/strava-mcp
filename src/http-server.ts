import http from "node:http";
import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer, initializeStrava } from './server-factory.js';

// Load .env file explicitly from project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const envPath = path.join(projectRoot, '.env');
dotenv.config({ path: envPath });

const PORT = parseInt(process.env.PORT || "3000", 10);
const API_KEY = process.env.MCP_API_KEY;

if (!API_KEY) {
  console.error("FATAL: MCP_API_KEY environment variable is required.");
  console.error("Set it in .env or as an environment variable.");
  console.error("Generate one with: openssl rand -hex 32");
  process.exit(1);
}

/**
 * Validate Bearer token from the Authorization header
 */
function authenticate(req: http.IncomingMessage): boolean {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }
  // Constant-time comparison to prevent timing attacks
  const token = authHeader.slice(7);
  if (token.length !== API_KEY!.length) return false;
  let result = 0;
  for (let i = 0; i < token.length; i++) {
    result |= token.charCodeAt(i) ^ API_KEY!.charCodeAt(i);
  }
  return result === 0;
}

async function main() {
  console.log("Starting Strava MCP Server (HTTP)...");

  // Initialize Strava client and refresh token
  await initializeStrava();

  console.log("MCP server ready to accept connections.");

  // Create HTTP server
  const httpServer = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://localhost:${PORT}`);

    // Health check endpoint (no auth required)
    if (url.pathname === "/health" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }

    // Only serve /mcp
    if (url.pathname !== "/mcp") {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not Found" }));
      return;
    }

    // Auth check for all /mcp requests
    if (!authenticate(req)) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Unauthorized" },
        id: null
      }));
      return;
    }

    // In stateless mode, create a new transport + server per request
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,  // stateless mode
    });
    const mcpServer = createServer();
    await mcpServer.connect(transport);

    // Delegate to MCP transport handler
    try {
      await transport.handleRequest(req, res);
    } catch (error) {
      console.error("Error handling MCP request:", error);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal error" },
          id: null
        }));
      }
    }
  });

  httpServer.listen(PORT, () => {
    console.log(`Strava MCP HTTP Server listening on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log("Received SIGTERM, shutting down...");
    httpServer.close(() => {
      console.log("HTTP server closed.");
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log("Received SIGINT, shutting down...");
    httpServer.close(() => {
      console.log("HTTP server closed.");
      process.exit(0);
    });
  });
}

main().catch((error) => {
  console.error("Failed to start HTTP server:", error);
  process.exit(1);
});
