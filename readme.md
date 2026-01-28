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

5. Configure your heart rate and power zones (optional but recommended for zone analysis):
```bash
# Copy the example zones configuration file
cp zones.config.json.example zones.config.json

# Edit zones.config.json with your personal zones
# You can either:
# - Manually enter your zone min/max values for running and cycling
# - Set autoCalculate: true and enter your maxHeartRate and FTP values
```

The zones configuration file allows you to:
- Define sport-specific heart rate zones (running and cycling)
- Configure power zones for cycling (requires FTP)
- Choose between manual zone entry or auto-calculation from max heart rate/FTP
- Enable zone analysis in activity heart rate data

**Note:** `zones.config.json` is in `.gitignore` and won't be committed to the repository. Your personal zones remain private.

6. Build the MCP server:
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

### 1. `getLastActivity`

Gets your most recent activity with automatic heart rate analysis. Perfect for quick queries like "get my last run" or "get my run yesterday".

**Parameters:**
- `activityType` (optional): Filter by activity type (e.g., "Run", "Ride", "BackcountrySki", "Swim"). If not provided, returns the most recent activity of any type.

**Returns:**
- Basic activity info (name, type, date, distance, moving time, elevation gain)
- For runs: Automatic pace calculation (minutes:seconds per mile)
- If heart rate data exists: Automatic heart rate statistics and zone analysis
- All distances in miles, elevation in feet

**Example Requests:**
- "Get my last run"
- "Get my last cycling activity"
- "Show me my most recent backcountry ski"
- "What was my last activity?"

---

### 2. `getActivitiesByDate`

Get activities within a date range with powerful filtering and aggregation capabilities. Supports both listing individual activities and calculating aggregate statistics.

**Parameters:**
- `startDate` (required): Start date in ISO format (YYYY-MM-DD)
- `endDate` (optional): End date in ISO format (YYYY-MM-DD). Defaults to today if not provided.
- `activityTypes` (optional): Array of activity types to filter by (e.g., `["Run", "Ride", "BackcountrySki"]`). If not provided, returns all activity types.
- `hasHeartRate` (optional): Boolean filter to only include activities with heart rate data
- `aggregate` (optional): If `true`, returns aggregated statistics instead of individual activities. Automatically paginates through all pages to get complete totals.
- `count` (optional): Number of activities to retrieve (max 100). Only used when `aggregate` is `false`.

**Returns (when `aggregate: false`):**
- List of activities with ID, name, distance, elevation gain, and date

**Returns (when `aggregate: true`):**
- Total activities count
- Total distance (miles)
- Total elevation gain (feet)
- Total moving time (hours and minutes)
- Breakdown by activity type (if multiple types included)

**Example Requests:**
- "How many miles did I run last month?" → `{ startDate: "2025-01-01", endDate: "2025-01-31", activityTypes: ["Run"], aggregate: true }`
- "How much vertical elevation did I cover running and backcountry skiing last year?" → `{ startDate: "2024-01-01", endDate: "2024-12-31", activityTypes: ["Run", "BackcountrySki"], aggregate: true }`
- "Show me all my activities from last week" → `{ startDate: "2025-01-15", endDate: "2025-01-22", aggregate: false, count: 50 }`
- "List my cycling activities with heart rate from the past month" → `{ startDate: "2024-12-22", activityTypes: ["Ride"], hasHeartRate: true, aggregate: false }`
- "What's my total distance for 2025?" → `{ startDate: "2025-01-01", aggregate: true }`

**Note:** When using `aggregate: true`, the tool automatically fetches all activities across all pages to ensure accurate totals, even for large date ranges.

---

### 3. `getActivityById`

Retrieves detailed information about a specific activity by its Strava activity ID.

**Parameters:**
- `activityId` (required): The Strava activity ID (number)

**Returns:**
- Activity name, type, date
- Distance (miles)
- Moving time (minutes)
- Elevation gain (feet, if available)
- Average and max heart rate (if available)

**Example Requests:**
- "Get details for activity 1234567890"
- "Show me activity ID 987654321"

---

### 4. `getActivityHeartRate`

Gets detailed heart rate data for a specific activity, including comprehensive zone analysis if zones are configured in `zones.config.json`.

**Parameters:**
- `activityId` (required): The ID of the activity to get heart rate data for

**Returns:**
- Activity name, type, and date
- Heart rate statistics (average, min, max)
- Zone analysis (if zones configured):
  - Time spent in each zone (minutes and percentage)
  - Average heart rate per zone
  - Zone breakdown sorted by time spent

**Example Requests:**
- "Show me the heart rate zone breakdown for activity 1234567890"
- "Analyze the heart rate zones for my last run" (requires getting activity ID first)
- "What zones did I spend time in during activity 987654321?"

---

### 5. `getActivityLaps`

Get lap-by-lap data for an activity including heart rate and elevation per lap. Useful for analyzing interval workouts or structured training sessions.

**Parameters:**
- `activityId` (required): The ID of the activity to get lap data for

**Returns:**
- For each lap:
  - Lap number
  - Distance (miles)
  - Moving time
  - Average pace (for runs)
  - Average heart rate (if available)
  - Elevation gain (feet, if available)
  - Max heart rate (if available)

**Example Requests:**
- "Show me the lap breakdown for activity 1234567890"
- "What were my lap times and heart rates for my interval run?" (requires activity ID)

---

### Zone Analysis

When heart rate zones are configured in `zones.config.json`, the `getActivityHeartRate` and `getLastActivity` tools automatically analyze your heart rate data and provide:

- **Time in zones**: Minutes and seconds spent in each configured zone
- **Percentage breakdown**: What percentage of your activity was spent in each zone
- **Zone statistics**: Average, min, and max heart rate for each zone
- **Sorted results**: Zones ordered by time spent (most time first)

The analysis automatically detects the sport type (running vs cycling) and uses the appropriate zones from your configuration. If the activity type doesn't match running or cycling, it defaults to running zones (configurable in `zones.config.json`).

**Zone Analysis Example Output:**
```
Zone Analysis (running):
Total Time: 45 minutes

Time in Zones:
- High Zone 2: 20 min (44%) - Avg HR: 145 bpm
- Low Zone 2: 15 min (33%) - Avg HR: 140 bpm
- Zone 3: 7 min (16%) - Avg HR: 150 bpm
- Zone 1: 3 min (7%) - Avg HR: 135 bpm
```

---

## Example Interactions

Once your MCP server is connected to Claude, you can ask questions like:

### Quick Activity Queries
- "Get my last run" (automatically includes HR analysis and pace)
- "Get my run yesterday" (automatically includes HR analysis)
- "Show me my most recent cycling activity"
- "What was my last backcountry ski?"

### Aggregate Statistics
- "How many miles did I run last month?"
- "How much vertical elevation did I cover running and backcountry skiing last year?"
- "What's my total distance for 2025?"
- "How many activities did I do in January?"
- "Show me my total elevation gain for all activities this year"

### Heart Rate Analysis
- "What was my average heart rate during my last cycling activity?"
- "Show me the heart rate zone breakdown for my last run"
- "How much time did I spend in Zone 4 during my recent activities?"
- "Analyze the heart rate zones for activity 1234567890"

### Activity Lists and Filtering
- "Show me all my swim workouts from the past month"
- "List my running activities with heart rate from last week"
- "What cycling activities did I do in December?"
- "Show me my activities from January 1st to January 15th"

### Detailed Analysis
- "Get details for activity 1234567890"
- "Show me the lap breakdown for my interval run"
- "What were my lap times and heart rates for activity 987654321?"

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
