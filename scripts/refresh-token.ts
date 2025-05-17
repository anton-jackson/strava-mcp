import { StravaClient } from '../src/strava-client';

/**
 * Script to refresh the Strava API access token
 * Run with: npx ts-node scripts/refresh-token.ts
 */
async function main() {
  try {
    console.log('Starting Strava token refresh process...');
    
    // Create a Strava client
    const client = new StravaClient();
    
    // Refresh the token
    const newToken = await client.refreshAccessToken();
    
    console.log('Token refresh successful!');
    console.log('New access token:', newToken.substring(0, 10) + '...[redacted]');
    console.log('Tokens have been updated in your .env file');
    
    // Exit with success
    process.exit(0);
  } catch (error) {
    console.error('Token refresh failed:', error);
    process.exit(1);
  }
}

// Run the main function
main();