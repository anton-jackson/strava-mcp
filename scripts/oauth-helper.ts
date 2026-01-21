import dotenv from 'dotenv';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function getInput(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
}

async function oauthHelper() {
  console.log('===== Strava OAuth Helper =====');
  console.log('This script will help you authorize your app with Strava');
  console.log('You\'ll need to complete these steps:');
  console.log('1. Get authorization code from Strava');
  console.log('2. Exchange code for tokens');
  console.log('3. Save tokens to your .env file');
  console.log('');
  
  // Check if .env has client ID and secret
  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    console.log('❌ Missing STRAVA_CLIENT_ID or STRAVA_CLIENT_SECRET in your .env file');
    console.log('Please add these values to your .env file and try again');
    rl.close();
    return;
  }
  
  // Step 1: Generate authorization URL
  const authUrl = `https://www.strava.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=http://localhost/callback&approval_prompt=force&scope=read,activity:read_all`;
  
  console.log('Step 1: Get authorization code from Strava');
  console.log('Open this URL in your browser:');
  console.log(authUrl);
  console.log('');
  console.log('Log in to Strava and authorize the app');
  console.log('You\'ll be redirected to a URL like: http://localhost/callback?state=&code=YOUR_AUTHORIZATION_CODE');
  console.log('');
  
  // Step 2: Get the authorization code from the user
  const authCode = await getInput('Enter the authorization code from the URL: ');
  
  if (!authCode) {
    console.log('❌ No authorization code provided');
    rl.close();
    return;
  }
  
  try {
    // Step 3: Exchange the code for tokens
    console.log('Step 2: Exchanging authorization code for tokens...');
    const tokenResponse = await axios.post('https://www.strava.com/oauth/token', {
      client_id: clientId,
      client_secret: clientSecret,
      code: authCode,
      grant_type: 'authorization_code'
    });
    
    const accessToken = tokenResponse.data.access_token;
    const refreshToken = tokenResponse.data.refresh_token;
    const expiresAt = new Date(tokenResponse.data.expires_at * 1000);
    const athlete = tokenResponse.data.athlete;
    
    console.log('✅ Successfully got tokens!');
    console.log(`Access token: ${accessToken.substring(0, 5)}...`);
    console.log(`Refresh token: ${refreshToken.substring(0, 5)}...`);
    console.log(`Expires at: ${expiresAt.toLocaleString()}`);
    console.log(`Authenticated as: ${athlete.firstname} ${athlete.lastname}`);
    
    // Step 4: Update .env file
  console.log('Step 3: Updating .env file...');
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const envPath = path.resolve(__dirname, '..', '.env');
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
    console.log('✅ .env file updated successfully!');
    
    console.log('');
    console.log('===== OAuth Flow Complete! =====');
    console.log('Your Strava MCP server is now authorized and ready to use');
    console.log('You can run your tests or start the MCP server');
    
  } catch (error) {
    console.error('❌ Error during token exchange:');
    if (axios.isAxiosError(error) && error.response) {
      console.error('Status code:', error.response.status);
      console.error('Response data:', error.response.data);
    } else {
      console.error(error);
    }
  } finally {
    rl.close();
  }
}

oauthHelper();