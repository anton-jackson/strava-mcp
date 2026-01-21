# Strava MCP Server

A Model Context Protocol (MCP) server for seamlessly integrating Strava fitness data with AI assistants like Claude.

## Overview

This MCP server enables AI assistants to fetch and analyze exercise data from the Strava API. By implementing the Model Context Protocol (MCP), this server provides a standardized way for AI tools to access your fitness data, making it possible to:

- Retrieve recent activities and exercise history
- Analyze workout patterns and performance metrics
- Combine with other data sources (like nutrition or health data) for comprehensive insights
- Generate training recommendations based on historical performance

## Prerequisites

- Node.js (v16+)
- Docker (for containerization)
- A Strava API key (requires Strava developer account)
- An MCP client like Claude Desktop App or Amazon Q CLI

## Installation

1. Clone this repository:
```bash
git clone https://github.com/yourusername/strava-mcp.git
cd strava-mcp
```

2. Install dependencies:
```bash
npm install
```

3. Run the credential helper to create/update `.env` in the repo root:
```bash
# Recommended: full setup with all scopes and verification
npm run fix-permissions
```
This will guide you through the Strava OAuth flow, write `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_ACCESS_TOKEN`, and `STRAVA_REFRESH_TOKEN` to `.env`, and verify activity access.

4. (Optional) If you already have correct scopes but need a simpler flow:
```bash
npm run oauth-helper
```
This performs the OAuth exchange for `read,activity:read_all` and writes the tokens to `.env`.

5. Build the MCP server:
```bash
npm run build
```

## Running Locally

Start the MCP server:
```bash
npm start
```

### Configuring Claude Desktop

Add the following to your Claude Desktop configuration file:

- On MacOS: `~/Library/Application\ Support/Claude/claude_desktop_config.json`
- On Windows: `%APPDATA%/Claude/claude_desktop_config.json`

```json
"mcpServers": {
  "strava-mcp": {
    "command": "node",
    "args": [
      "/absolute/path/to/strava-mcp/dist/mcp-server.js"
    ]
  }
}
```

## Available Tools

This MCP server provides the following tools to AI assistants:

- `getRecentActivities`: Fetches your most recent Strava activities
- `getActivityById`: Retrieves detailed information about a specific activity
- `getAthleteStats`: Gets summary statistics about your performance
- `getActivitiesByDateRange`: Filters activities within a specific timeframe
- `getActivitiesByType`: Retrieves activities of a specific type (run, ride, swim, etc.)

## Example Interactions

Once your MCP server is connected to Claude, you can ask questions like:

- "How many miles did I run last week?"
- "What was my average heart rate during my last cycling activity?"
- "Show me all my swim workouts from the past month"
- "What's my current fitness trend based on my recent activities?"

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Helper Scripts

- `npm run fix-permissions`: Full guided OAuth with all scopes; updates `.env`; verifies Strava access. Run this first for a clean setup or when scopes are broken.
- `npm run oauth-helper`: Simpler OAuth flow for `read,activity:read_all`; updates `.env`.
- `npm run auth-tester`: Checks env vars, attempts token refresh, writes updated tokens, and verifies API access.
- `npm run refresh-token`: Minimal token refresh via `StravaClient`; assumes `.env` is already correct.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Built with the Model Context Protocol by Anthropic
- Uses the Strava API for fitness data retrieval
