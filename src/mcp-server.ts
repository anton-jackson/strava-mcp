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

// Helper functions to convert metric to imperial
function metersToMiles(meters: number): number {
  return meters * 0.000621371;
}

function metersToFeet(meters: number): number {
  return meters * 3.28084;
}

function formatDistance(meters: number): string {
  const miles = metersToMiles(meters);
  if (miles < 0.1) {
    return `${Math.round(miles * 5280)} ft`;
  }
  return `${miles.toFixed(2)} mi`;
}

function formatElevation(meters: number): string {
  const feet = metersToFeet(meters);
  return `${Math.round(feet)} ft`;
}

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

// Get Activity by ID Tool
const getActivityById = {
  name: 'getActivityById',
  description: 'Get detailed information about a specific activity by its ID',
  inputSchema: z.object({
    activityId: z.number().describe('The ID of the activity to retrieve')
  }),
  execute: async ({ activityId }: { activityId: number }) => {
    const stravaClient = new StravaClient();
    const activity = await stravaClient.getActivity(activityId);
    
    const details = [
      `🏃 ${activity.name}`,
      `Type: ${activity.type}`,
      `Date: ${new Date(activity.start_date).toLocaleDateString()}`,
      `Distance: ${formatDistance(activity.distance)}`,
      `Moving Time: ${Math.floor(activity.moving_time / 60)} minutes`,
      activity.total_elevation_gain ? `Elevation Gain: ${formatElevation(activity.total_elevation_gain)}` : null,
      activity.has_heartrate ? `Average HR: ${activity.average_heartrate} bpm` : null,
      activity.has_heartrate ? `Max HR: ${activity.max_heartrate} bpm` : null
    ].filter(Boolean).join('\n');

    return {
      content: [{
        type: "text" as const,
        text: details
      }]
    };
  }
};

// Get Activity Heart Rate Tool
const getActivityHeartRate = {
  name: 'getActivityHeartRate',
  description: 'Get detailed heart rate data for a specific activity, including zone analysis if zones are configured',
  inputSchema: z.object({
    activityId: z.number().describe('The ID of the activity to get heart rate data for')
  }),
  execute: async ({ activityId }: { activityId: number }) => {
    const stravaClient = new StravaClient();
    
    try {
      const heartRateData = await stravaClient.getHeartRateData(activityId);
      
      if (!heartRateData.has_heartrate) {
        return {
          content: [{ type: "text" as const, text: "❌ This activity does not have heart rate data" }],
          isError: true
        };
      }

      // Build response text
      let responseText = `❤️ ${heartRateData.activity_name}\n`;
      responseText += `Activity Type: ${heartRateData.activity_type}\n`;
      responseText += `Date: ${new Date(heartRateData.start_date).toLocaleDateString()}\n\n`;
      
      // Heart rate stats
      if (heartRateData.heart_rate_stats) {
        responseText += `Heart Rate Statistics:\n`;
        responseText += `- Average: ${heartRateData.heart_rate_stats.avg} bpm\n`;
        responseText += `- Min: ${heartRateData.heart_rate_stats.min} bpm\n`;
        responseText += `- Max: ${heartRateData.heart_rate_stats.max} bpm\n\n`;
      }
      
      // Zone analysis
      if (heartRateData.zone_analysis && !heartRateData.zone_analysis.error) {
        const zoneAnalysis = heartRateData.zone_analysis;
        responseText += `Zone Analysis (${zoneAnalysis.sport}):\n`;
        responseText += `Total Time: ${zoneAnalysis.total_time_minutes} minutes\n\n`;
        responseText += `Time in Zones:\n`;
        
        for (const zone of zoneAnalysis.zones) {
          responseText += `- ${zone.zone_name}: ${zone.time_minutes} min (${zone.percentage}%)`;
          if (zone.average_heart_rate) {
            responseText += ` - Avg HR: ${zone.average_heart_rate} bpm`;
          }
          responseText += `\n`;
        }
      } else if (heartRateData.zone_analysis?.error) {
        responseText += `\n⚠️ Zone analysis unavailable: ${heartRateData.zone_analysis.error}\n`;
        responseText += `Configure zones in zones.config.json to enable zone analysis.\n`;
      }

      return {
        content: [{
          type: "text" as const,
          text: responseText
        }]
      };
    } catch (error) {
      return {
        content: [{ 
          type: "text" as const, 
          text: `❌ Error retrieving heart rate data: ${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
};

// Get Activities by Date Tool
const getActivitiesByDate = {
  name: 'getActivitiesByDate',
  description: 'Get activities within a specific date range. Supports filtering by activity type and aggregation for stats queries.',
  inputSchema: z.object({
    startDate: z.string().describe('Start date in ISO format (YYYY-MM-DD)'),
    endDate: z.string().optional().describe('End date in ISO format (YYYY-MM-DD). Defaults to today if not provided.'),
    activityTypes: z.array(z.string()).optional().describe('Filter by activity types (e.g., ["Run", "Ride", "BackcountrySki"]). If not provided, returns all activity types.'),
    hasHeartRate: z.boolean().optional().describe('Filter to only activities with heart rate data'),
    aggregate: z.boolean().optional().describe('If true, returns aggregated statistics (total distance, elevation, etc.) instead of individual activities'),
    count: z.number().min(1).max(100).optional().describe('Number of activities to retrieve (max 100). Only used when aggregate is false.')
  }),
  execute: async ({ startDate, endDate, activityTypes, hasHeartRate, aggregate, count }: { 
    startDate: string; 
    endDate?: string; 
    activityTypes?: string[];
    hasHeartRate?: boolean;
    aggregate?: boolean;
    count?: number;
  }) => {
    const stravaClient = new StravaClient();
    const end = endDate ? new Date(endDate) : new Date();
    const start = new Date(startDate);
    
    // When aggregating, fetch ALL activities by paginating through all pages
    // Otherwise, just fetch the requested count
    let activities;
    if (aggregate) {
      activities = await stravaClient.getAllActivitiesByDate(start, end, 200);
    } else {
      activities = await stravaClient.getActivitiesByDate(
        start,
        end,
        1,
        Math.min(count || 10, 100)
      );
    }

    // Apply filters
    let filteredActivities = activities;
    
    if (activityTypes && activityTypes.length > 0) {
      const typeLower = activityTypes.map(t => t.toLowerCase());
      filteredActivities = filteredActivities.filter((activity: Activity) => 
        typeLower.includes(activity.type.toLowerCase())
      );
    }
    
    if (hasHeartRate) {
      filteredActivities = filteredActivities.filter((activity: Activity) => activity.has_heartrate);
    }

    // If aggregating, return totals
    if (aggregate) {
      const totalDistance = filteredActivities.reduce((sum: number, a: Activity) => sum + a.distance, 0);
      const totalElevation = filteredActivities.reduce((sum: number, a: Activity) => sum + (a.total_elevation_gain || 0), 0);
      const totalMovingTime = filteredActivities.reduce((sum: number, a: Activity) => sum + a.moving_time, 0);
      const activityCount = filteredActivities.length;
      
      // Group by type for breakdown
      const byType: { [key: string]: { count: number; distance: number; elevation: number } } = {};
      filteredActivities.forEach((activity: Activity) => {
        const type = activity.type;
        if (!byType[type]) {
          byType[type] = { count: 0, distance: 0, elevation: 0 };
        }
        byType[type].count++;
        byType[type].distance += activity.distance;
        byType[type].elevation += (activity.total_elevation_gain || 0);
      });

      let responseText = `📊 Activity Summary (${start.toLocaleDateString()} - ${end.toLocaleDateString()})\n\n`;
      responseText += `Total Activities: ${activityCount}\n`;
      responseText += `Total Distance: ${formatDistance(totalDistance)}\n`;
      responseText += `Total Elevation Gain: ${formatElevation(totalElevation)}\n`;
      responseText += `Total Moving Time: ${Math.floor(totalMovingTime / 3600)}h ${Math.floor((totalMovingTime % 3600) / 60)}m\n\n`;
      
      if (Object.keys(byType).length > 1) {
        responseText += `Breakdown by Type:\n`;
        Object.entries(byType).forEach(([type, stats]) => {
          responseText += `- ${type}: ${stats.count} activities, ${formatDistance(stats.distance)}, ${formatElevation(stats.elevation)} elevation\n`;
        });
      }

      return {
        content: [{
          type: "text" as const,
          text: responseText
        }]
      };
    }

    // Return individual activities
    const limitedActivities = filteredActivities.slice(0, Math.min(count || 10, 100));
    return {
      content: limitedActivities.map((activity: Activity) => ({
        type: "text" as const,
        text: `🏃 ${activity.name} (ID: ${activity.id}) — ${formatDistance(activity.distance)}${activity.total_elevation_gain ? `, ${formatElevation(activity.total_elevation_gain)} elevation gain` : ''} on ${new Date(activity.start_date).toLocaleDateString()}`
      }))
    };
  }
};

// Get Last Activity Tool
const getLastActivity = {
  name: 'getLastActivity',
  description: 'Get the most recent activity with automatic heart rate analysis. Optionally filter by activity type (e.g., "Run", "Ride"). For runs, includes pace analysis.',
  inputSchema: z.object({
    activityType: z.string().optional().describe('Filter by activity type (e.g., "Run", "Ride", "BackcountrySki"). If not provided, returns the most recent activity of any type.')
  }),
  execute: async ({ activityType }: { activityType?: string }) => {
    const stravaClient = new StravaClient();
    
    try {
      // Get recent activities (last 30 days, fetch more to find the right type)
      const activities = await stravaClient.getActivitiesByDate(
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        new Date(),
        1,
        50 // Get more to find the right type
      );

      // Filter by type if specified
      let filteredActivities = activities;
      if (activityType) {
        filteredActivities = activities.filter((activity: Activity) => 
          activity.type.toLowerCase() === activityType.toLowerCase()
        );
      }

      if (filteredActivities.length === 0) {
        return {
          content: [{ 
            type: "text" as const, 
            text: `❌ No ${activityType ? activityType + ' ' : ''}activities found in the last 30 days` 
          }],
          isError: true
        };
      }

      const lastActivity = filteredActivities[0];
      const isRun = lastActivity.type.toLowerCase().includes('run');

      // Build basic activity info
      let responseText = `🏃 ${lastActivity.name}\n`;
      responseText += `Type: ${lastActivity.type}\n`;
      responseText += `Date: ${new Date(lastActivity.start_date).toLocaleDateString()}\n`;
      responseText += `Distance: ${formatDistance(lastActivity.distance)}\n`;
      responseText += `Moving Time: ${Math.floor(lastActivity.moving_time / 60)}:${String(lastActivity.moving_time % 60).padStart(2, '0')}\n`;
      
      // Calculate pace for runs
      if (isRun && lastActivity.distance > 0) {
        const paceSecondsPerMile = lastActivity.moving_time / metersToMiles(lastActivity.distance);
        const paceMinutes = Math.floor(paceSecondsPerMile / 60);
        const paceSeconds = Math.floor(paceSecondsPerMile % 60);
        responseText += `Pace: ${paceMinutes}:${String(paceSeconds).padStart(2, '0')} per mile\n`;
      }
      
      if (lastActivity.total_elevation_gain) {
        responseText += `Elevation Gain: ${formatElevation(lastActivity.total_elevation_gain)}\n`;
      }
      responseText += `\n`;

      // Automatically include heart rate analysis if available
      if (lastActivity.has_heartrate) {
        const heartRateData = await stravaClient.getHeartRateData(lastActivity.id);
        
        if (heartRateData.has_heartrate) {
          responseText += `Heart Rate Statistics:\n`;
          if (heartRateData.heart_rate_stats) {
            responseText += `- Average: ${heartRateData.heart_rate_stats.avg} bpm\n`;
            responseText += `- Min: ${heartRateData.heart_rate_stats.min} bpm\n`;
            responseText += `- Max: ${heartRateData.heart_rate_stats.max} bpm\n\n`;
          }
          
          // Zone analysis
          if (heartRateData.zone_analysis && !heartRateData.zone_analysis.error) {
            const zoneAnalysis = heartRateData.zone_analysis;
            responseText += `Zone Analysis (${zoneAnalysis.sport}):\n`;
            responseText += `Total Time: ${zoneAnalysis.total_time_minutes} minutes\n\n`;
            responseText += `Time in Zones:\n`;
            
            for (const zone of zoneAnalysis.zones) {
              responseText += `- ${zone.zone_name}: ${zone.time_minutes} min (${zone.percentage}%)`;
              if (zone.average_heart_rate) {
                responseText += ` - Avg HR: ${zone.average_heart_rate} bpm`;
              }
              responseText += `\n`;
            }
          } else if (heartRateData.zone_analysis?.error) {
            responseText += `\n⚠️ Zone analysis unavailable: ${heartRateData.zone_analysis.error}\n`;
            responseText += `Configure zones in zones.config.json to enable zone analysis.\n`;
          }
        }
      } else {
        responseText += `\nℹ️ This activity does not have heart rate data.\n`;
      }

      return {
        content: [{
          type: "text" as const,
          text: responseText
        }]
      };
    } catch (error) {
      return {
        content: [{ 
          type: "text" as const, 
          text: `❌ Error retrieving last activity: ${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
};

// Get Activity Laps Tool
const getActivityLaps = {
  name: 'getActivityLaps',
  description: 'Get lap-by-lap data for an activity including heart rate and elevation per lap',
  inputSchema: z.object({
    activityId: z.number().describe('The ID of the activity to get lap data for')
  }),
  execute: async ({ activityId }: { activityId: number }) => {
    const stravaClient = new StravaClient();
    
    try {
      const lapData = await stravaClient.getActivityLapsWithData(activityId);
      
      if (lapData.laps.length === 0) {
        return {
          content: [{ type: "text" as const, text: `❌ ${lapData.message || 'This activity has no lap data'}` }],
          isError: true
        };
      }

      let responseText = `🏃 ${lapData.activity_name}\n`;
      responseText += `Activity Type: ${lapData.activity_type}\n`;
      responseText += `Total Laps: ${lapData.total_laps}\n\n`;
      
      lapData.laps.forEach((lap: any, index: number) => {
        responseText += `Lap ${lap.lap_index || index + 1}: ${lap.lap_name}\n`;
        responseText += `  Distance: ${lap.distance_miles.toFixed(2)} mi\n`;
        responseText += `  Time: ${Math.floor(lap.elapsed_time / 60)}:${String(lap.elapsed_time % 60).padStart(2, '0')}\n`;
        
        if (lap.elevation_gain_feet) {
          responseText += `  Elevation Gain: ${formatElevation(lap.elevation_gain_meters)}\n`;
        }
        
        if (lap.elevation) {
          responseText += `  Elevation Range: ${Math.round(lap.elevation.min_feet)} - ${Math.round(lap.elevation.max_feet)} ft\n`;
        }
        
        if (lap.heart_rate) {
          responseText += `  Heart Rate: Avg ${Math.round(lap.heart_rate.average)} bpm`;
          if (lap.heart_rate.max) {
            responseText += `, Max ${Math.round(lap.heart_rate.max)} bpm`;
          }
          responseText += `\n`;
          
          // Zone analysis for lap
          if (lap.heart_rate.zone_analysis && !lap.heart_rate.zone_analysis.error) {
            const topZones = lap.heart_rate.zone_analysis.zones
              .filter((z: any) => z.percentage > 0)
              .slice(0, 3);
            if (topZones.length > 0) {
              responseText += `  Top Zones: ${topZones.map((z: any) => `${z.zone_name} (${z.percentage}%)`).join(', ')}\n`;
            }
          }
        }
        
        responseText += `\n`;
      });

      return {
        content: [{
          type: "text" as const,
          text: responseText
        }]
      };
    } catch (error) {
      return {
        content: [{ 
          type: "text" as const, 
          text: `❌ Error retrieving lap data: ${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
};

// Register tools with the server
server.tool(
  getLastActivity.name,
  getLastActivity.description,
  getLastActivity.inputSchema?.shape ?? {},
  getLastActivity.execute
);

server.tool(
  getActivityById.name,
  getActivityById.description,
  getActivityById.inputSchema?.shape ?? {},
  getActivityById.execute
);

server.tool(
  getActivityHeartRate.name,
  getActivityHeartRate.description,
  getActivityHeartRate.inputSchema?.shape ?? {},
  getActivityHeartRate.execute
);

server.tool(
  getActivitiesByDate.name,
  getActivitiesByDate.description,
  getActivitiesByDate.inputSchema?.shape ?? {},
  getActivitiesByDate.execute
);

server.tool(
  getActivityLaps.name,
  getActivityLaps.description,
  getActivityLaps.inputSchema?.shape ?? {},
  getActivityLaps.execute
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