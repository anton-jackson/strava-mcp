/**
 * Debug script to verify Strava client functionality
 * Run with: npx ts-node tests/debug-test.ts
 */
(async () => {
  console.log('=== Debug test script starting ===');
  
  try {
    // First, try to load the necessary modules
    console.log('Loading modules...');
    const { StravaClient } = await import('../src/strava-client');
    console.log('✅ Modules loaded successfully');
    
    // Try creating the client
    console.log('Creating StravaClient...');
    const client = new StravaClient();
    console.log('✅ StravaClient created');
    
    // Check if we have access token
    console.log('Checking for access token...');
    if (!process.env.STRAVA_ACCESS_TOKEN) {
      console.log('⚠️ No STRAVA_ACCESS_TOKEN found in environment');
      console.log('Attempting to refresh token...');
      try {
        const token = await client.refreshAccessToken();
        console.log(`✅ Token refreshed: ${token.substring(0, 5)}...`);
      } catch (refreshError) {
        console.error('❌ Failed to refresh token:', refreshError);
      }
    } else {
      console.log(`✅ STRAVA_ACCESS_TOKEN found: ${process.env.STRAVA_ACCESS_TOKEN.substring(0, 5)}...`);
    }
    
    // Attempt to get athlete info
    console.log('Attempting to get athlete info...');
    try {
      const athlete = await client.getAthlete();
      console.log(`✅ Got athlete: ${athlete.firstname} ${athlete.lastname} (ID: ${athlete.id})`);
    } catch (athleteError) {
      console.error('❌ Failed to get athlete:', athleteError);
    }
    
    console.log('=== Debug test complete ===');
  } catch (error) {
    console.error('❌ Top-level error in debug test:', error);
  }
})();