import StravaClient from '../strava-client.js';
import { z } from 'zod';

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

export const getRecentActivitiesToolDefinition = {
  name: 'getRecentActivities',
  description: 'Get the most recent activities from Strava',
  parameters: {
    count: {
      type: 'number',
      description: 'Number of activities to retrieve (max 100)',
      default: 10
    }
  },
  handler: async ({ count = 10 }) => {
    try {
      const stravaClient = new StravaClient();
      
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const activities = await stravaClient.getActivitiesByDate(
        thirtyDaysAgo,
        new Date(),
        1,
        Math.min(count, 100)
      );
      
      return {
        structuredContent: {
          count: activities.length,
          activities: activities.map((activity: Activity) => ({
            id: activity.id,
            name: activity.name,
            type: activity.type,
            start_date: activity.start_date,
            start_date_local: activity.start_date_local,
            distance: activity.distance,
            moving_time: activity.moving_time,
            total_elevation_gain: activity.total_elevation_gain,
            has_heartrate: activity.has_heartrate,
            average_heartrate: activity.average_heartrate,
            max_heartrate: activity.max_heartrate
          }))
        }
      };
    } catch (error) {
      throw error;
    }
  }
};

export const getActivityHeartRateToolDefinition = {
  name: 'getActivityHeartRate',
  description: 'Get detailed heart rate data for a specific activity',
  parameters: {
    activityId: {
      type: 'number',
      description: 'ID of the activity to retrieve heart rate data for'
    }
  },
  handler: async ({ activityId }: { activityId: number }) => {
    try {
      const stravaClient = new StravaClient();
      const heartRateData = await stravaClient.getHeartRateData(activityId);
      
      return {
        structuredContent: heartRateData
      };
    } catch (error) {
      throw error;
    }
  }
};

export const getRecentActivitiesWithHeartRateToolDefinition = {
  name: 'getRecentActivitiesWithHeartRate',
  description: 'Get recent activities that include heart rate data',
  parameters: {
    count: {
      type: 'number',
      description: 'Number of activities to retrieve (max 100)',
      default: 10
    }
  },
  handler: async ({ count = 10 }) => {
    try {
      const stravaClient = new StravaClient();
      const result = await stravaClient.getRecentActivitiesWithHeartRate(count);
      
      return {
        structuredContent: result
      };
    } catch (error) {
      throw error;
    }
  }
};

export const getActivitiesByDateToolDefinition = {
  name: 'getActivitiesByDate',
  description: 'Get activities within a specific date range',
  parameters: {
    startDate: {
      type: 'string',
      description: 'Start date in ISO format (YYYY-MM-DD)'
    },
    endDate: {
      type: 'string',
      description: 'End date in ISO format (YYYY-MM-DD)'
    },
    count: {
      type: 'number',
      description: 'Number of activities to retrieve (max 100)',
      default: 30
    }
  },
  handler: async ({ startDate, endDate, count = 30 }: { startDate: string; endDate?: string; count?: number }) => {
    try {
      const stravaClient = new StravaClient();
      
      const end = endDate ? new Date(endDate) : new Date();
      const start = new Date(startDate);
      
      const activities = await stravaClient.getActivitiesByDate(
        start,
        end,
        1,
        Math.min(count, 100)
      );
      
      return {
        structuredContent: {
          count: activities.length,
          start_date: start.toISOString(),
          end_date: end.toISOString(),
          activities: activities.map((activity: Activity) => ({
            id: activity.id,
            name: activity.name,
            type: activity.type,
            start_date: activity.start_date,
            distance: activity.distance,
            moving_time: activity.moving_time,
            has_heartrate: activity.has_heartrate,
            average_heartrate: activity.average_heartrate,
            max_heartrate: activity.max_heartrate
          }))
        }
      };
    } catch (error) {
      throw error;
    }
  }
};