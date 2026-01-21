import axios from 'axios';
import fs from 'fs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve repository root (one level above /scripts)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '..', '.env');

// Load current environment variables
dotenv.config();

async function testAndFixStravaAuth() {
  console.log('===== Strava Authentication Tester and Fixer =====');
  
  // Step 1: Check current credentials
  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  const refreshToken = process.env.STRAVA_REFRESH_TOKEN;
  
  console.log('Current credentials:');
  console.log(`- Client ID: ${clientId ? '✓ Present' : '✗ Missing'}`);
  console.log(`- Client Secret: ${clientSecret ? '✓ Present' : '✗ Missing'}`);
  console.log(`- Refresh Token: ${refreshToken ? '✓ Present' : '✗ Missing'}`);
  
  if (!clientId || !clientSecret || !refreshToken) {
    console.error('❌ Missing required credentials in .env file. Cannot proceed.');
    return;
  }
  
  // Step 2: Print the .env file path we're working with
  console.log(`\nUsing .env file at: ${envPath}`);
  
  try {
    // Verify .env file is readable and writable
    fs.accessSync(envPath, fs.constants.R_OK | fs.constants.W_OK);
    console.log('✓ .env file is readable and writable');
    
    // Read current content for verification
    const currentEnvContent = fs.readFileSync(envPath, 'utf8');
    console.log(`Current .env file is ${currentEnvContent.length} characters long`);
  } catch (error) {
    console.error(`❌ Error accessing .env file: ${error.message}`);
    console.log('Make sure the file exists and you have permission to read/write it');
    return;
  }
  
  // Step 3: Try to refresh the token
  console.log('\nAttempting to refresh Strava token...');
  
  try {
    const response = await axios.post('https://www.strava.com/oauth/token', {
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    });
    
    // Step 4: Extract the new tokens
    const newAccessToken = response.data.access_token;
    const newRefreshToken = response.data.refresh_token;
    const expiresAt = new Date(response.data.expires_at * 1000);
    
    console.log('✅ Token refresh successful!');
    console.log(`New access token: ${newAccessToken.substring(0, 10)}...`);
    console.log(`New refresh token: ${newRefreshToken.substring(0, 10)}...`);
    console.log(`Token expires at: ${expiresAt.toLocaleString()}`);
    
    // Step 5: Update the .env file manually
    console.log('\nUpdating .env file with new tokens...');
    
    try {
      let envContent = fs.readFileSync(envPath, 'utf8');
      
      // Replace or add the tokens
      if (envContent.includes('STRAVA_ACCESS_TOKEN=')) {
        envContent = envContent.replace(/STRAVA_ACCESS_TOKEN=.*/g, `STRAVA_ACCESS_TOKEN=${newAccessToken}`);
      } else {
        envContent += `\nSTRAVA_ACCESS_TOKEN=${newAccessToken}`;
      }
      
      if (envContent.includes('STRAVA_REFRESH_TOKEN=')) {
        envContent = envContent.replace(/STRAVA_REFRESH_TOKEN=.*/g, `STRAVA_REFRESH_TOKEN=${newRefreshToken}`);
      } else {
        envContent += `\nSTRAVA_REFRESH_TOKEN=${newRefreshToken}`;
      }
      
      // Write the updated content
      fs.writeFileSync(envPath, envContent);
      console.log('✅ .env file updated successfully');
      
      // Read and print updated file stats (not content for security)
      const updatedEnvContent = fs.readFileSync(envPath, 'utf8');
      console.log(`Updated .env file is ${updatedEnvContent.length} characters long`);
      
      // Update current process environment variables
      process.env.STRAVA_ACCESS_TOKEN = newAccessToken;
      process.env.STRAVA_REFRESH_TOKEN = newRefreshToken;
      
    } catch (writeError) {
      console.error(`❌ Error updating .env file: ${writeError.message}`);
      console.log('Manual update required. Your new tokens are:');
      console.log(`STRAVA_ACCESS_TOKEN=${newAccessToken}`);
      console.log(`STRAVA_REFRESH_TOKEN=${newRefreshToken}`);
      return;
    }
    
    // Step 6: Verify the new token works
    console.log('\nVerifying new access token with Strava API...');
    
    try {
      const verifyResponse = await axios.get('https://www.strava.com/api/v3/athlete', {
        headers: {
          'Authorization': `Bearer ${newAccessToken}`
        }
      });
      
      console.log('✅ Verification successful!');
      console.log(`Connected to Strava as: ${verifyResponse.data.firstname} ${verifyResponse.data.lastname}`);
      console.log(`Athlete ID: ${verifyResponse.data.id}`);
      
      // Try getting recent activities
      console.log('\nFetching recent activities to further verify access...');
      const activitiesResponse = await axios.get('https://www.strava.com/api/v3/athlete/activities', {
        headers: {
          'Authorization': `Bearer ${newAccessToken}`
        },
        params: {
          per_page: 3
        }
      });
      
      if (activitiesResponse.data.length > 0) {
        console.log(`✅ Successfully retrieved ${activitiesResponse.data.length} recent activities`);
        
        const mostRecent = activitiesResponse.data[0];
        console.log('Most recent activity:');
        console.log(`- Name: ${mostRecent.name}`);
        console.log(`- Type: ${mostRecent.type}`);
        console.log(`- Date: ${mostRecent.start_date}`);
      } else {
        console.log('No recent activities found, but API access is working');
      }
      
      console.log('\n===== Authentication Fixed Successfully! =====');
      console.log('Your Strava MCP server should now work correctly');
      console.log('Try running: npx ts-node src/index.ts');
      
    } catch (verifyError) {
      console.error('❌ Error verifying new token:');
      if (axios.isAxiosError(verifyError) && verifyError.response) {
        console.error('Status code:', verifyError.response.status);
        console.error('Response data:', verifyError.response.data);
      } else {
        console.error(verifyError);
      }
    }
    
  } catch (tokenError) {
    console.error('❌ Error refreshing token:');
    if (axios.isAxiosError(tokenError) && tokenError.response) {
      console.error('Status code:', tokenError.response.status);
      console.error('Response data:', tokenError.response.data);
    } else {
      console.error(tokenError);
    }
    
    console.log('\nYour refresh token may be invalid or expired.');
    console.log('You may need to re-authorize your application through the Strava website:');
    console.log('1. Go to https://www.strava.com/settings/api');
    console.log('2. Check your application settings');
    console.log('3. You might need to create a new application and go through the OAuth flow again');
  }
}

testAndFixStravaAuth();
