import strava from 'strava-v3';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import { loadZonesConfig, getHeartRateZone, getPowerZone } from './zones-config.js';

dotenv.config();

// Path to .env file for token updates
const envPath = path.resolve(process.cwd(), '.env');

export class StravaClient {
  private client: any;
  
  constructor(accessToken?: string) {
    // Initialize with the provided token or from env
    this.client = accessToken ? strava.client(accessToken) : strava;
  }

  /**
   * Initialize the client with a fresh token
   */
  async initialize() {
    try {
      console.error('Initializing Strava client with fresh token...');
      const newToken = await this.refreshAccessToken();
      this.client = strava.client(newToken);
      console.error('✅ Strava client initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Strava client:', error);
      throw error;
    }
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
      console.error('🔄 Refreshing Strava access token...');
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
      
      // Store tokens as plain strings
      process.env.STRAVA_ACCESS_TOKEN = String(newAccessToken);
      process.env.STRAVA_REFRESH_TOKEN = String(newRefreshToken);
      
      // Also update .env file for persistence
      await this.updateTokensInEnvFile(String(newAccessToken), String(newRefreshToken));
      
      console.error(`✅ Token refreshed. New token expires: ${new Date(response.data.expires_at * 1000).toLocaleString()}`);
      
      // Update the client with the new token
      this.client = strava.client(String(newAccessToken));
      
      return String(newAccessToken);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        console.error('Strava API Error:', {
          status: error.response.status,
          data: error.response.data
        });
        throw new Error(`Strava API Error: ${error.response.data.message || 'Unknown error'}`);
      }
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
   * Get activity laps
   * @param id Activity ID
   * @returns Array of lap objects
   */
  async getActivityLaps(id: number) {
    return this.handleApiCall(`getActivityLaps(${id})`, async () => {
      const accessToken = process.env.STRAVA_ACCESS_TOKEN;
      if (!accessToken) {
        throw new Error('STRAVA_ACCESS_TOKEN not found in environment');
      }
      
      const response = await axios.get(`https://www.strava.com/api/v3/activities/${id}/laps`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      return response.data;
    });
  }
  
  /**
   * Get activity laps with heart rate and elevation data
   * @param activityId ID of the activity
   * @returns Array of laps with heart rate and elevation analysis
   */
  async getActivityLapsWithData(activityId: number) {
    return this.handleApiCall(`getActivityLapsWithData(${activityId})`, async () => {
      // Get activity details
      const activity = await this.getActivity(activityId);
      
      // Get laps
      const laps = await this.getActivityLaps(activityId);
      
      if (laps.length === 0) {
        return {
          activity_id: activityId,
          activity_name: activity.name,
          laps: [],
          message: "This activity has no lap data"
        };
      }
      
      // Get streams for heart rate and elevation
      const streams = await this.getActivityStreams(activityId, ['heartrate', 'altitude', 'time', 'distance']);
      const heartRateStream = streams.find((s: any) => s.type === 'heartrate');
      const altitudeStream = streams.find((s: any) => s.type === 'altitude');
      const timeStream = streams.find((s: any) => s.type === 'time');
      
      // Helper functions
      const metersToFeet = (meters: number) => meters * 3.28084;
      
      // Load zones config for heart rate zone analysis
      const zonesConfig = loadZonesConfig();
      const sport = activity.type?.toLowerCase().includes('ride') || activity.type?.toLowerCase().includes('bike') 
        ? 'cycling' 
        : (zonesConfig.metadata?.defaultSport || 'running') as 'running' | 'cycling';
      
      // Process each lap
      const lapsWithData = laps.map((lap: any) => {
        const lapData: any = {
          lap_id: lap.id,
          lap_name: lap.name,
          lap_index: lap.lap_index,
          distance_miles: lap.distance * 0.000621371,
          distance_meters: lap.distance,
          elapsed_time: lap.elapsed_time,
          moving_time: lap.moving_time,
          elevation_gain_feet: lap.total_elevation_gain ? metersToFeet(lap.total_elevation_gain) : null,
          elevation_gain_meters: lap.total_elevation_gain,
          average_speed: lap.average_speed,
          max_speed: lap.max_speed
        };
        
        // Extract heart rate data for this lap using start_index and end_index
        if (heartRateStream && lap.start_index !== undefined && lap.end_index !== undefined) {
          const lapHeartRateData = heartRateStream.data.slice(lap.start_index, lap.end_index + 1);
          
          if (lapHeartRateData.length > 0) {
            lapData.heart_rate = {
              average: lap.average_heartrate || (lapHeartRateData.reduce((a: number, b: number) => a + b, 0) / lapHeartRateData.length),
              max: lap.max_heartrate || Math.max(...lapHeartRateData),
              min: Math.min(...lapHeartRateData),
              data_points: lapHeartRateData.length
            };
            
            // Zone analysis for this lap
            if (zonesConfig && zonesConfig.sports[sport]) {
              const lapZoneAnalysis = this.analyzeHeartRateZones(
                lapHeartRateData,
                sport,
                zonesConfig,
                timeStream ? timeStream.data.slice(lap.start_index, lap.end_index + 1) : []
              );
              lapData.heart_rate.zone_analysis = lapZoneAnalysis;
            }
          }
        } else if (lap.average_heartrate) {
          // Fallback to lap-level heart rate if available
          lapData.heart_rate = {
            average: lap.average_heartrate,
            max: lap.max_heartrate || null,
            min: null,
            data_points: 0
          };
        }
        
        // Extract elevation data for this lap
        if (altitudeStream && lap.start_index !== undefined && lap.end_index !== undefined) {
          const lapAltitudeData = altitudeStream.data.slice(lap.start_index, lap.end_index + 1);
          
          if (lapAltitudeData.length > 0) {
            lapData.elevation = {
              min_feet: metersToFeet(Math.min(...lapAltitudeData)),
              max_feet: metersToFeet(Math.max(...lapAltitudeData)),
              min_meters: Math.min(...lapAltitudeData),
              max_meters: Math.max(...lapAltitudeData),
              data_points: lapAltitudeData.length
            };
          }
        }
        
        return lapData;
      });
      
      return {
        activity_id: activityId,
        activity_name: activity.name,
        activity_type: activity.type,
        total_laps: laps.length,
        laps: lapsWithData
      };
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
      
      // Helper function to convert meters to miles
      const metersToMiles = (meters: number) => meters * 0.000621371;
      
      // Create a combined dataset if all streams exist
      let combinedData = [];
      if (heartRateStream && timeStream) {
        combinedData = heartRateStream.data.map((hr: number, index: number) => {
          const dataPoint: any = {
            heart_rate: hr,
            time_elapsed: timeStream.data[index] // in seconds
          };
          
          // Add distance if available (convert to miles)
          if (distanceStream && index < distanceStream.data.length) {
            dataPoint.distance_miles = metersToMiles(distanceStream.data[index]);
            dataPoint.distance_meters = distanceStream.data[index]; // keep original for reference
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
      
      // Analyze heart rate zones
      const zonesConfig = loadZonesConfig();
      // Determine sport: cycling if ride/bike, otherwise use defaultSport from config (defaults to 'running')
      const activityTypeLower = activity.type?.toLowerCase() || '';
      const sport = activityTypeLower.includes('ride') || activityTypeLower.includes('bike') 
        ? 'cycling' 
        : (zonesConfig.metadata?.defaultSport || 'running') as 'running' | 'cycling';
      
      // Group heart rate data by zones
      const zoneAnalysis = this.analyzeHeartRateZones(heartRateData, sport, zonesConfig, timeStream?.data || []);
      
      // Return comprehensive heart rate information
      return {
        activity_id: activityId,
        activity_name: activity.name,
        activity_type: activity.type,
        has_heartrate: true,
        athlete_id: activity.athlete.id,
        start_date: activity.start_date,
        heart_rate_stats: heartRateStats,
        heart_rate_time_series: combinedData,
        zone_analysis: zoneAnalysis,
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
   * Analyze heart rate data and group it into zones
   * @param heartRateData Array of heart rate values
   * @param sport Sport type ('running' or 'cycling')
   * @param zonesConfig Zones configuration
   * @param timeData Array of time values in seconds
   * @returns Zone analysis with time spent in each zone
   */
  private analyzeHeartRateZones(
    heartRateData: number[],
    sport: 'running' | 'cycling',
    zonesConfig: any,
    timeData: number[]
  ): any {
    if (heartRateData.length === 0) {
      return null;
    }
    
    // Load zones config if not provided
    const config = zonesConfig || loadZonesConfig();
    const zones = config.sports[sport];
    
    if (!zones || Object.keys(zones).length === 0) {
      return { error: 'Zones not configured for this sport' };
    }
    
    // Initialize zone counters
    const zoneTime: { [zoneName: string]: number } = {};
    const zoneDataPoints: { [zoneName: string]: number } = {};
    const zoneHeartRates: { [zoneName: string]: number[] } = {};
    
    // Initialize all zones
    for (const zoneName of Object.keys(zones)) {
      zoneTime[zoneName] = 0;
      zoneDataPoints[zoneName] = 0;
      zoneHeartRates[zoneName] = [];
    }
    
    // Calculate time intervals (assume uniform sampling if time data not available)
    let timeInterval = 1; // default 1 second
    if (timeData.length === heartRateData.length && timeData.length > 1) {
      // Calculate average interval
      const intervals = [];
      for (let i = 1; i < timeData.length; i++) {
        intervals.push(timeData[i] - timeData[i - 1]);
      }
      timeInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    }
    
    // Group each heart rate reading into zones
    for (let i = 0; i < heartRateData.length; i++) {
      const hr = heartRateData[i];
      const zoneResult = getHeartRateZone(hr, sport, config);
      
      if (zoneResult) {
        const { zoneName } = zoneResult;
        zoneTime[zoneName] += timeInterval;
        zoneDataPoints[zoneName]++;
        zoneHeartRates[zoneName].push(hr);
      }
    }
    
    // Calculate statistics for each zone
    const totalTime = heartRateData.length * timeInterval;
    const zoneBreakdown: any[] = [];
    
    for (const [zoneName, zone] of Object.entries(zones)) {
      const timeInZone = zoneTime[zoneName] || 0;
      const percentage = totalTime > 0 ? (timeInZone / totalTime) * 100 : 0;
      const avgHR = zoneHeartRates[zoneName]?.length > 0
        ? zoneHeartRates[zoneName].reduce((a, b) => a + b, 0) / zoneHeartRates[zoneName].length
        : null;
      
      zoneBreakdown.push({
        zone_name: zoneName,
        zone_info: zone,
        time_seconds: Math.round(timeInZone),
        time_minutes: Math.round(timeInZone / 60 * 10) / 10,
        percentage: Math.round(percentage * 10) / 10,
        data_points: zoneDataPoints[zoneName] || 0,
        average_heart_rate: avgHR ? Math.round(avgHR) : null,
        min_heart_rate: zoneHeartRates[zoneName]?.length > 0 ? Math.min(...zoneHeartRates[zoneName]) : null,
        max_heart_rate: zoneHeartRates[zoneName]?.length > 0 ? Math.max(...zoneHeartRates[zoneName]) : null
      });
    }
    
    return {
      sport,
      total_time_seconds: Math.round(totalTime),
      total_time_minutes: Math.round(totalTime / 60 * 10) / 10,
      zones: zoneBreakdown.sort((a, b) => b.percentage - a.percentage) // Sort by percentage descending
    };
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
          total_elevation_gain: activity.total_elevation_gain,
          average_heartrate: activity.average_heartrate,
          max_heartrate: activity.max_heartrate
        }))
      };
    });
  }
}

export default StravaClient;