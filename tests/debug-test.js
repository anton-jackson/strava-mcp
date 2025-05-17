var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
/**
 * Debug script to verify Strava client functionality
 * Run with: npx ts-node tests/debug-test.ts
 */
(async () => {
    console.log('=== Debug test script starting ===');
    try {
        // First, try to load the necessary modules
        console.log('Loading modules...');
        const { StravaClient } = await Promise.resolve().then(() => __importStar(require('../src/strava-client')));
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
            }
            catch (refreshError) {
                console.error('❌ Failed to refresh token:', refreshError);
            }
        }
        else {
            console.log(`✅ STRAVA_ACCESS_TOKEN found: ${process.env.STRAVA_ACCESS_TOKEN.substring(0, 5)}...`);
        }
        // Attempt to get athlete info
        console.log('Attempting to get athlete info...');
        try {
            const athlete = await client.getAthlete();
            console.log(`✅ Got athlete: ${athlete.firstname} ${athlete.lastname} (ID: ${athlete.id})`);
        }
        catch (athleteError) {
            console.error('❌ Failed to get athlete:', athleteError);
        }
        console.log('=== Debug test complete ===');
    }
    catch (error) {
        console.error('❌ Top-level error in debug test:', error);
    }
})();
