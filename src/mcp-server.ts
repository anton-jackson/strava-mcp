import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load .env file explicitly from project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const envPath = path.join(projectRoot, '.env');
dotenv.config({ path: envPath });

// Import shared server factory
import { createServer, initializeStrava } from './server-factory.js';

// Start the server
async function startServer() {
  try {
    console.error("Starting Strava MCP Server (stdio)...");

    // Initialize Strava client and refresh token
    await initializeStrava();

    // Create server with all tools registered
    const server = createServer();

    // Connect via stdio transport
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Strava MCP Server connected via Stdio. Tools registered.");
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
