import dotenv from 'dotenv';
dotenv.config();

// This will be replaced with the actual MCP SDK import once available
// import { MCPServer } from '@anthropic/mcp-sdk';
const MCPServer = {
  create: (config: any) => {
    console.log('MCP Server created with config:', config);
    return {
      addTool: (tool: any) => {
        console.log('Tool added:', tool);
      },
      start: () => {
        console.log('MCP Server started on port', process.env.MCP_SERVER_PORT || 3000);
      }
    };
  }
};

// Create the MCP server
const server = MCPServer.create({
  name: process.env.MCP_SERVER_NAME || 'strava-mcp',
  description: 'A Model Context Protocol server for Strava API integration'
});

// Import and register tools
// We'll implement these in later steps

// Start the server
async function main() {
  try {
    // Initialize connections and tools
    // server.addTool(...);
    
    // Start server
    server.start();
  } catch (error) {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  }
}

main();
