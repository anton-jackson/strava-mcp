import strava from 'strava-v3';
import dotenv from 'dotenv';

dotenv.config();

export class StravaClient {
  private client: any;
  
  constructor(accessToken?: string) {
    // If no access token is provided, use environment variables
    this.client = new strava.client(accessToken);
  }
  
  async getAthlete() {
    try {
      return await this.client.athlete.get({});
    } catch (error) {
      console.error('Error getting athlete:', error);
      throw error;
    }
  }
  
  async getActivities(params: { before?: number; after?: number; page?: number; per_page?: number }) {
    try {
      return await this.client.athlete.listActivities(params);
    } catch (error) {
      console.error('Error getting activities:', error);
      throw error;
    }
  }
  
  async getActivity(id: number) {
    try {
      return await this.client.activities.get({ id });
    } catch (error) {
      console.error(`Error getting activity ${id}:`, error);
      throw error;
    }
  }
  
  // Add more methods as needed
}

export default StravaClient;
