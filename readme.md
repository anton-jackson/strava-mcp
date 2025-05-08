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

3. Create a `.env` file with your Strava API credentials:
```
STRAVA_CLIENT_ID=your_client_id
STRAVA_CLIENT_SECRET=your_client_secret
STRAVA_REFRESH_TOKEN=your_refresh_token
```

4. Build the MCP server:
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
      "/absolute/path/to/strava-mcp/dist/index.js"
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

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Built with the Model Context Protocol by Anthropic
- Uses the Strava API for fitness data retrieval