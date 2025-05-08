import StravaClient from '../strava-client';

export const getRecentActivitiesToolDefinition = {
  name: 'getRecentActivities',
  description: 'Get the most recent activities from Strava',
  parameters: {
    type: 'object',
    properties: {
      count: {
        type: 'integer',
        description: 'Number of activities to retrieve (max 100)',
        default: 10
      }
    }
  },
  handler: async ({ count = 10 }) => {
    try {
      const stravaClient = new StravaClient();
      const activities = await stravaClient.getActivities({ 
        per_page: Math.min(count, 100),
        page: 1
      });
      
      return {
        activities: activities.map((activity: any) => ({
          id: activity.id,
          name: activity.name,
          type: activity.type,
          distance: activity.distance,
          moving_time: activity.moving_time,
          elapsed_time: activity.elapsed_time,
          start_date: activity.start_date,
          start_date_local: activity.start_date_local,
          // Add more fields as needed
        }))
      };
    } catch (error) {
      console.error('Error in getRecentActivities tool:', error);
      throw error;
    }
  }
};
