import dotenv from 'dotenv';
import readline from 'readline';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Resolve repository root (one level above /scripts)
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Path to .env file
const envPath = path.resolve(__dirname, '..', '.env');

// Function to get input from user
function askQuestion(query: string): Promise<string> {
  return new Promise(resolve => {
    rl.question(query, answer => {
      resolve(answer);
    });
  });
}

async function fixOAuthScopes() {
  console.log('===== Strava OAuth Permission Fixer =====');
  
  // Get current client ID and secret
  let clientId = process.env.STRAVA_CLIENT_ID;
  let clientSecret = process.env.STRAVA_CLIENT_SECRET;
  
  // If missing, ask for them
  if (!clientId) {
    clientId = await askQuestion('Enter your Strava Client ID: ');
  }
  
  if (!clientSecret) {
    clientSecret = await askQuestion('Enter your Strava Client Secret: ');
  }
  
  if (!clientId || !clientSecret) {
    console.error('❌ Client ID and Client Secret are required to proceed.');
    rl.close();
    return;
  }
  
  console.log(`Using Client ID: ${clientId}`);
  console.log(`Using Client Secret: ${clientId ? '✓ Present' : '✗ Missing'}`);
  
  // Generate OAuth URL with ALL possible scopes
  const scopes = [
    'read',
    'read_all',
    'profile:read_all',
    'profile:write',
    'activity:read',
    'activity:read_all',
    'activity:write'
  ];
  
  const authUrl = `https://www.strava.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=http://localhost/callback&approval_prompt=force&scope=${scopes.join(',')}`;
  
  console.log('\nStep 1: Open this URL in your browser to authorize your app with all scopes:');
  console.log('\n' + authUrl + '\n');
  console.log('This will ensure your app has ALL the permissions it needs.');
  console.log('After authorizing, you\'ll be redirected to a URL like:');
  console.log('http://localhost/callback?state=&code=YOUR_AUTHORIZATION_CODE');
  console.log('');
  
  // Get authorization code from user
  const authCode = await askQuestion('Enter the authorization code from the URL: ');
  
  if (!authCode) {
    console.error('❌ No authorization code provided');
    rl.close();
    return;
  }
  
  try {
    // Exchange authorization code for tokens
    console.log('\nStep 2: Exchanging code for tokens with proper scopes...');
    
    const tokenResponse = await axios.post('https://www.strava.com/oauth/token', {
      client_id: clientId,
      client_secret: clientSecret,
      code: authCode,
      grant_type: 'authorization_code'
    });
    
    // Get tokens and athlete info
    const accessToken = tokenResponse.data.access_token;
    const refreshToken = tokenResponse.data.refresh_token;
    const expiresAt = new Date(tokenResponse.data.expires_at * 1000);
    const athlete = tokenResponse.data.athlete;
    
    console.log('✅ Successfully received tokens with proper permissions!');
    console.log(`Access token: ${accessToken.substring(0, 10)}...`);
    console.log(`Refresh token: ${refreshToken.substring(0, 10)}...`);
    console.log(`Expires at: ${expiresAt.toLocaleString()}`);
    console.log(`Authenticated as: ${athlete.firstname} ${athlete.lastname}`);
    
    // Update .env file
    console.log('\nStep 3: Updating .env file with new credentials and tokens...');
    
    try {
      let envContent = '';
      
      try {
        // Read existing .env file if it exists
        envContent = fs.readFileSync(envPath, 'utf8');
      } catch (e) {
        // File doesn't exist, create new content
        envContent = '';
      }
      
      // Split into lines and process
      const lines = envContent.split('\n');
      const newLines = [];
      let clientIdUpdated = false;
      let clientSecretUpdated = false;
      let accessTokenUpdated = false;
      let refreshTokenUpdated = false;
      
      // Process existing lines
      for (const line of lines) {
        if (line.startsWith('STRAVA_CLIENT_ID=')) {
          newLines.push(`STRAVA_CLIENT_ID=${clientId}`);
          clientIdUpdated = true;
        } else if (line.startsWith('STRAVA_CLIENT_SECRET=')) {
          newLines.push(`STRAVA_CLIENT_SECRET=${clientSecret}`);
          clientSecretUpdated = true;
        } else if (line.startsWith('STRAVA_ACCESS_TOKEN=')) {
          newLines.push(`STRAVA_ACCESS_TOKEN=${accessToken}`);
          accessTokenUpdated = true;
        } else if (line.startsWith('STRAVA_REFRESH_TOKEN=')) {
          newLines.push(`STRAVA_REFRESH_TOKEN=${refreshToken}`);
          refreshTokenUpdated = true;
        } else if (line.trim() !== '') {
          newLines.push(line);
        }
      }
      
      // Add any missing variables
      if (!clientIdUpdated) {
        newLines.push(`STRAVA_CLIENT_ID=${clientId}`);
      }
      if (!clientSecretUpdated) {
        newLines.push(`STRAVA_CLIENT_SECRET=${clientSecret}`);
      }
      if (!accessTokenUpdated) {
        newLines.push(`STRAVA_ACCESS_TOKEN=${accessToken}`);
      }
      if (!refreshTokenUpdated) {
        newLines.push(`STRAVA_REFRESH_TOKEN=${refreshToken}`);
      }
      
      // Write updated content back to .env
      fs.writeFileSync(envPath, newLines.join('\n') + '\n');
      console.log('✅ .env file updated successfully with all credentials and tokens');
      
      // Update current process environment
      process.env.STRAVA_CLIENT_ID = clientId;
      process.env.STRAVA_CLIENT_SECRET = clientSecret;
      process.env.STRAVA_ACCESS_TOKEN = accessToken;
      process.env.STRAVA_REFRESH_TOKEN = refreshToken;
      
    } catch (writeError) {
      console.error(`❌ Error updating .env file: ${writeError.message}`);
      console.log('Please manually update your .env file with these values:');
      console.log(`STRAVA_CLIENT_ID=${clientId}`);
      console.log(`STRAVA_CLIENT_SECRET=${clientSecret}`);
      console.log(`STRAVA_ACCESS_TOKEN=${accessToken}`);
      console.log(`STRAVA_REFRESH_TOKEN=${refreshToken}`);
    }
    
    // Verify with API call
    console.log('\nStep 4: Verifying access to activities with new token...');
    
    try {
      // Test getting activities
      const activitiesResponse = await axios.get('https://www.strava.com/api/v3/athlete/activities', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        params: {
          per_page: 3
        }
      });
      
      console.log('✅ Success! Your app now has permission to access activities.');
      console.log(`Retrieved ${activitiesResponse.data.length} recent activities.`);
      
      if (activitiesResponse.data.length > 0) {
        const activity = activitiesResponse.data[0];
        console.log('\nMost recent activity:');
        console.log(`- Name: ${activity.name}`);
        console.log(`- Type: ${activity.type}`);
        console.log(`- Date: ${activity.start_date}`);
      }
      
      console.log('\n===== Permission Fix Complete! =====');
      console.log('Your Strava MCP server should now work correctly.');
      console.log('Try running: npx ts-node src/index.ts');
      
    } catch (verifyError) {
      console.error('❌ Error verifying activity access:');
      if (axios.isAxiosError(verifyError) && verifyError.response) {
        console.error('Status code:', verifyError.response.status);
        console.error('Response data:', verifyError.response.data);
      } else {
        console.error(verifyError);
      }
    }
    
  } catch (tokenError) {
    console.error('❌ Error exchanging code for tokens:');
    if (axios.isAxiosError(tokenError) && tokenError.response) {
      console.error('Status code:', tokenError.response.status);
      console.error('Response data:', tokenError.response.data);
    } else {
      console.error(tokenError);
    }
  }
  
  rl.close();
}

fixOAuthScopes();
