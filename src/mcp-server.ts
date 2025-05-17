import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { z } from "zod";

// Load .env file explicitly from project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const envPath = path.join(projectRoot, '.env');
dotenv.config({ path: envPath });

// Import your Strava client
import StravaClient from './strava-client.js';

interface Activity {
  id: number;
  name: string;
  type: string;
  start_date: string;
  start_date_local?: string;
  distance: number;
  moving_time: number;
  total_elevation_gain?: number;
  has_heartrate: boolean;
  average_heartrate?: number;
  max_heartrate?: number;
}

// Create an MCP server
const server = new McpServer({
  name: "Strava MCP Server",
  version: "1.0.0"
});

// Activity schema for output
const activitySchema = z.object({
  id: z.number(),
  name: z.string(),
  type: z.string(),
  start_date: z.string(),
  start_date_local: z.string().optional(),
  distance: z.number(),
  moving_time: z.number(),
  total_elevation_gain: z.number().optional(),
  has_heartrate: z.boolean(),
  average_heartrate: z.number().optional(),
  max_heartrate: z.number().optional()
});

// Get Recent Activities Tool
const getRecentActivities = {
  name: 'getRecentActivities',
  description: 'Get the most recent activities from Strava',
  inputSchema: z.object({
    count: z.number().min(1).max(100).default(10).describe('Number of activities to retrieve (max 100)')
  }),
  execute: async ({ count }: { count: number }) => {
    const stravaClient = new StravaClient();
    const activities = await stravaClient.getActivitiesByDate(
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      new Date(),
      1,
      Math.min(count || 10, 100)
    );

    return {
      content: activities.map((activity: Activity) => ({
        type: "text" as const,
        text: `🏃 ${activity.name} (ID: ${activity.id}) — ${activity.distance}m on ${new Date(activity.start_date).toLocaleDateString()}`
      }))
    };
  }
};

// Get Activity Heart Rate Tool
const getActivityHeartRate = {
  name: 'getActivityHeartRate',
  description: 'Get heart rate data for a specific activity',
  inputSchema: z.object({
    activityId: z.number().describe('The ID of the activity to get heart rate data for')
  }),
  execute: async ({ activityId }: { activityId: number }) => {
    const stravaClient = new StravaClient();
    const activity = await stravaClient.getActivity(activityId);
    
    if (!activity.has_heartrate) {
      return {
        content: [{ type: "text" as const, text: "❌ This activity does not have heart rate data" }],
        isError: true
      };
    }

    return {
      content: [{
        type: "text" as const,
        text: `❤️ ${activity.name}\nAverage HR: ${activity.average_heartrate} bpm\nMax HR: ${activity.max_heartrate} bpm`
      }]
    };
  }
};

// Get Recent Activities with Heart Rate Tool
const getRecentActivitiesWithHeartRate = {
  name: 'getRecentActivitiesWithHeartRate',
  description: 'Get recent activities that have heart rate data',
  inputSchema: z.object({
    count: z.number().min(1).max(100).default(10).describe('Number of activities to retrieve (max 100)')
  }),
  execute: async ({ count }: { count: number }) => {
    const stravaClient = new StravaClient();
    const activities = await stravaClient.getActivitiesByDate(
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      new Date(),
      1,
      Math.min(count || 10, 100)
    );

    const activitiesWithHeartRate = activities.filter((activity: Activity) => activity.has_heartrate);

    return {
      content: activitiesWithHeartRate.map((activity: Activity) => ({
        type: "text" as const,
        text: `🏃 ${activity.name} (ID: ${activity.id}) — Avg HR: ${activity.average_heartrate} bpm, Max HR: ${activity.max_heartrate} bpm`
      }))
    };
  }
};

// Get Activities by Date Tool
const getActivitiesByDate = {
  name: 'getActivitiesByDate',
  description: 'Get activities within a specific date range',
  inputSchema: z.object({
    startDate: z.string().describe('Start date in ISO format (YYYY-MM-DD)'),
    endDate: z.string().describe('End date in ISO format (YYYY-MM-DD)'),
    count: z.number().min(1).max(100).default(10).describe('Number of activities to retrieve (max 100)')
  }),
  execute: async ({ startDate, endDate, count }: { startDate: string; endDate: string; count: number }) => {
    const stravaClient = new StravaClient();
    const activities = await stravaClient.getActivitiesByDate(
      new Date(startDate),
      new Date(endDate),
      1,
      Math.min(count || 10, 100)
    );

    return {
      content: activities.map((activity: Activity) => ({
        type: "text" as const,
        text: `🏃 ${activity.name} (ID: ${activity.id}) — ${activity.distance}m on ${new Date(activity.start_date).toLocaleDateString()}`
      }))
    };
  }
};

// Register tools with the server
server.tool(
  getRecentActivities.name,
  getRecentActivities.description,
  getRecentActivities.inputSchema?.shape ?? {},
  getRecentActivities.execute
);

server.tool(
  getActivityHeartRate.name,
  getActivityHeartRate.description,
  getActivityHeartRate.inputSchema?.shape ?? {},
  getActivityHeartRate.execute
);

server.tool(
  getRecentActivitiesWithHeartRate.name,
  getRecentActivitiesWithHeartRate.description,
  getRecentActivitiesWithHeartRate.inputSchema?.shape ?? {},
  getRecentActivitiesWithHeartRate.execute
);

server.tool(
  getActivitiesByDate.name,
  getActivitiesByDate.description,
  getActivitiesByDate.inputSchema?.shape ?? {},
  getActivitiesByDate.execute
);

// Start the server
async function startServer() {
  try {
    console.error("Starting Strava MCP Server...");
    
    // Test Strava connection and refresh token if needed
    const stravaClient = new StravaClient();
    try {
      console.error("Initializing Strava client...");
      await stravaClient.initialize();
      console.error("✅ Strava connection successful!");
    } catch (error) {
      console.error("❌ Strava connection failed:", error);
      throw error;
    }
    
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error(`Strava MCP Server connected via Stdio. Tools registered.`);
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();