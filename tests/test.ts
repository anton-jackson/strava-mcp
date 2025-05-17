import strava from 'strava-v3';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';

dotenv.config();

// Path to .env file for token updates
const envPath = path.resolve(process.cwd(), '.env');

export class StravaClient {
  private client: any;
  
  constructor(accessToken?: string) {
    // Configure strava with environment variables if no token provided
    if (!accessToken) {
      strava.config({
        access_token: process.env.STRAVA_ACCESS_TOKEN,
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        redirect_uri: process.env.STRAVA_REDIRECT_URI
      });
    }
    
    // Create the client instance
    this.client = accessToken ? strava.client(accessToken) : strava;
  }
  
  /**
   * Refreshes the Strava access token using the refresh token in .env
   * Updates .env file with new tokens
   * @returns The new access token
   */
  async refreshAccessToken(): Promise<string> {
    const refreshToken = process.env.STRAVA_REFRESH_TOKEN;
    const clientId = process.env.STRAVA_CLIENT_ID;
    const clientSecret = process.env.STRAVA_CLIENT_SECRET;
    
    if (!refreshToken || !clientId || !clientSecret) {
      throw new Error("Missing refresh credentials in .env (STRAVA_REFRESH_TOKEN, STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET)");
    }
    
    try {
      console.log('🔄 Refreshing Strava access token...');
      const response = await axios.post('https://www.strava.com/oauth/token', {
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      });
      
      // Update tokens in environment variables for the current process
      const newAccessToken = response.data.access_token;
      const newRefreshToken = response.data.refresh_token;
      
      if (!newAccessToken || !newRefreshToken) {
        throw new Error('Refresh response missing required tokens');
      }
      
      process.env.STRAVA_ACCESS_TOKEN = newAccessToken;
      process.env.STRAVA_REFRESH_TOKEN = newRefreshToken;
      
      // Also update .env file for persistence
      await this.updateTokensInEnvFile(newAccessToken, newRefreshToken);
      
      console.log(`✅ Token refreshed. New token expires: ${new Date(response.data.expires_at * 1000).toLocaleString()}`);
      
      // Update the client with the new token
      this.client = strava.client(newAccessToken);
      
      return newAccessToken;
    } catch (error) {
      console.error('Failed to refresh access token:', error);
      throw new Error(`Failed to refresh Strava access token: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Updates the .env file with new access and refresh tokens
   * @param accessToken - The new access token
   * @param refreshToken - The new refresh token
   */
  async updateTokensInEnvFile(accessToken: string, refreshToken: string): Promise<void> {
    try {
      let envContent = await fs.readFile(envPath, 'utf-8');
      const lines = envContent.split('\n');
      const newLines: string[] = [];
      let accessTokenUpdated = false;
      let refreshTokenUpdated = false;

      for (const line of lines) {
        if (line.startsWith('STRAVA_ACCESS_TOKEN=')) {
          newLines.push(`STRAVA_ACCESS_TOKEN=${accessToken}`);
          accessTokenUpdated = true;
        } else if (line.startsWith('STRAVA_REFRESH_TOKEN=')) {
          newLines.push(`STRAVA_REFRESH_TOKEN=${refreshToken}`);
          refreshTokenUpdated = true;
        } else if (line.trim() !== '') {
          newLines.push(line);
        }
      }

      if (!accessTokenUpdated) {
        newLines.push(`STRAVA_ACCESS_TOKEN=${accessToken}`);
      }
      if (!refreshTokenUpdated) {
        newLines.push(`STRAVA_REFRESH_TOKEN=${refreshToken}`);
      }

      await fs.writeFile(envPath, newLines.join('\n').trim() + '\n');
      console.log('✅ Tokens successfully refreshed and updated in .env file.');
    } catch (error) {
      console.error('Failed to update tokens in .env file:', error);
      // Continue execution even if file update fails
    }
  }
  
  /**
   * Helper method to handle API errors with token refresh capability
   * @param context - Description of the operation for error messages
   * @param apiCall - Function that makes the actual API call
   * @returns The result of the API call
   */
  async handleApiCall<T>(context: string, apiCall: () => Promise<T>): Promise<T> {
    try {
      return await apiCall();
    } catch (error) {
      // Check if it's an authentication error (401)
      if (this.isAuthError(error)) {
        try {
          console.log(`🔑 Authentication error in ${context}. Attempting to refresh token...`);
          await this.refreshAccessToken();
          
          // Retry the API call with the new token
          console.log(`🔄 Retrying ${context} after token refresh...`);
          return await apiCall();
        } catch (refreshError) {
          console.error(`❌ Token refresh failed: ${refreshError instanceof Error ? refreshError.message : String(refreshError)}`);
          // Fall through to normal error handling
        }
      }
      
      // Standard error handling
      console.error(`Error in ${context}:`, error);
      throw error;
    }
  }
  
  /**
   * Check if an error is an authentication error (401)
   */
  private isAuthError(error: any): boolean {
    return (
      error && 
      error.response && 
      error.response.status === 401
    );
  }
  
  async getAthlete() {
    return this.handleApiCall('getAthlete', async () => {
      return await this.client.athlete.get({});
    });
  }
  
  async getActivities(params: { before?: number; after?: number; page?: number; per_page?: number }) {
    return this.handleApiCall('getActivities', async () => {
      return await this.client.athlete.listActivities(params);
    });
  }
  
  async getActivity(id: number) {
    return this.handleApiCall(`getActivity(${id})`, async () => {
      return await this.client.activities.get({ id });
    });
  }
  
  /**
   * Get activity streams (time-series data) for a specific activity
   * @param id Activity ID
   * @param types Array of stream types to fetch (e.g., heartrate, time, distance)
   * @returns Array of stream objects
   */
  async getActivityStreams(id: number, types = ['heartrate', 'time', 'distance']) {
    return this.handleApiCall(`getActivityStreams(${id})`, async () => {
      return await this.client.activities.getStreams({
        id,
        types: types.join(','),
        resolution: 'high'
      });
    });
  }
  
  /**
   * Get activities within a specific date range
   * @param after Start date
   * @param before End date
   * @param page Page number for pagination
   * @param perPage Number of items per page
   * @returns Array of activity objects
   */
  async getActivitiesByDate(after: Date, before: Date, page = 1, perPage = 30) {
    return this.handleApiCall(`getActivitiesByDate(${after.toISOString()} - ${before.toISOString()})`, async () => {
      const afterTimestamp = Math.floor(after.getTime() / 1000);
      const beforeTimestamp = Math.floor(before.getTime() / 1000);
      
      return await this.getActivities({
        after: afterTimestamp,
        before: beforeTimestamp,
        page,
        per_page: perPage
      });
    });
  }
  
  /**
   * Get detailed heart rate data for a specific activity
   * @param activityId ID of the activity
   * @returns Heart rate data including raw time-series data
   */
  async getHeartRateData(activityId: number) {
    return this.handleApiCall(`getHeartRateData(${activityId})`, async () => {
      // Get activity details
      const activity = await this.getActivity(activityId);
      
      // Check if heart rate data exists
      if (!activity.has_heartrate) {
        return {
          activity_id: activityId,
          has_heartrate: false,
          message: "This activity does not contain heart rate data"
        };
      }
      
      // Get activity streams
      const streams = await this.getActivityStreams(activityId);
      
      // Extract the relevant streams
      const heartRateStream = streams.find((s: any) => s.type === 'heartrate');
      const timeStream = streams.find((s: any) => s.type === 'time');
      const distanceStream = streams.find((s: any) => s.type === 'distance');
      
      // Create a combined dataset if all streams exist
      let combinedData = [];
      if (heartRateStream && timeStream) {
        combinedData = heartRateStream.data.map((hr: number, index: number) => {
          const dataPoint: any = {
            heart_rate: hr,
            time_elapsed: timeStream.data[index] // in seconds
          };
          
          // Add distance if available
          if (distanceStream && index < distanceStream.data.length) {
            dataPoint.distance = distanceStream.data[index]; // in meters
          }
          
          return dataPoint;
        });
      }
      
      // Compile heart rate statistics
      const heartRateData = heartRateStream ? heartRateStream.data : [];
      const heartRateStats = heartRateData.length > 0 ? {
        min: Math.min(...heartRateData),
        max: Math.max(...heartRateData),
        avg: activity.average_heartrate,
      } : {};
      
      // Return comprehensive heart rate information
      return {
        activity_id: activityId,
        activity_name: activity.name,
        has_heartrate: true,
        athlete_id: activity.athlete.id,
        start_date: activity.start_date,
        heart_rate_stats: heartRateStats,
        heart_rate_time_series: combinedData,
        // Include the raw time-series data for custom analysis
        raw_data: {
          heart_rate: heartRateStream ? heartRateStream.data : [],
          time: timeStream ? timeStream.data : [],
          distance: distanceStream ? distanceStream.data : []
        }
      };
    });
  }
  
  /**
   * Get recent activities with heart rate data
   * @param count Number of activities to retrieve
   * @returns Array of recent activities with heart rate information
   */
  async getRecentActivitiesWithHeartRate(count = 10) {
    return this.handleApiCall(`getRecentActivitiesWithHeartRate(${count})`, async () => {
      // Get recent activities from the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const activities = await this.getActivitiesByDate(
        thirtyDaysAgo,
        new Date(),
        1,
        Math.min(count, 100)
      );
      
      // Filter to only include activities with heart rate data
      const activitiesWithHR = activities.filter((activity: any) => activity.has_heartrate);
      
      return {
        total_count: activities.length,
        activities_with_hr: activitiesWithHR.length,
        activities: activitiesWithHR.map((activity: any) => ({
          id: activity.id,
          name: activity.name,
          type: activity.type,
          start_date: activity.start_date,
          distance: activity.distance,
          moving_time: activity.moving_time,
          average_heartrate: activity.average_heartrate,
          max_heartrate: activity.max_heartrate
        }))
      };
    });
  }
}

export default StravaClient;