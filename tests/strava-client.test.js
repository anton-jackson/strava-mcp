"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const strava_client_1 = require("../src/strava-client");
// Mock the axios module
jest.mock('axios', () => ({
    post: jest.fn().mockResolvedValue({
        data: {
            access_token: 'new_mock_access_token',
            refresh_token: 'new_mock_refresh_token',
            expires_at: Math.floor(Date.now() / 1000) + 21600 // 6 hours from now
        }
    })
}));
// Mock the fs/promises module
jest.mock('fs/promises', () => ({
    readFile: jest.fn().mockResolvedValue('STRAVA_ACCESS_TOKEN=old_token\nSTRAVA_REFRESH_TOKEN=old_refresh_token'),
    writeFile: jest.fn().mockResolvedValue(undefined)
}));
// Mock the strava-v3 module
jest.mock('strava-v3', () => {
    // Create a mock for the strava client functionality
    const mockClientFunctions = {
        athlete: {
            get: jest.fn().mockResolvedValue({
                id: 1234,
                firstname: 'Test',
                lastname: 'Athlete',
                max_heartrate: 190
            }),
            listActivities: jest.fn().mockResolvedValue([
                {
                    id: 1,
                    name: 'Morning Run',
                    type: 'Run',
                    distance: 5000,
                    start_date: '2023-01-01T08:00:00Z',
                    has_heartrate: true,
                    average_heartrate: 145,
                    max_heartrate: 175
                },
                {
                    id: 2,
                    name: 'Evening Ride',
                    type: 'Ride',
                    distance: 20000,
                    start_date: '2023-01-02T18:00:00Z',
                    has_heartrate: false
                }
            ])
        },
        activities: {
            get: jest.fn().mockResolvedValue({
                id: 1,
                name: 'Morning Run',
                type: 'Run',
                distance: 5000,
                start_date: '2023-01-01T08:00:00Z',
                has_heartrate: true,
                average_heartrate: 145,
                max_heartrate: 175,
                athlete: { id: 1234 }
            }),
            getStreams: jest.fn().mockResolvedValue([
                {
                    type: 'heartrate',
                    data: [140, 145, 150, 155, 160, 165, 170, 175, 170, 165]
                },
                {
                    type: 'time',
                    data: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90]
                },
                {
                    type: 'distance',
                    data: [0, 50, 100, 150, 200, 250, 300, 350, 400, 450]
                }
            ])
        },
        oauth: {
            refreshToken: jest.fn().mockResolvedValue({
                access_token: 'new_mock_access_token',
                refresh_token: 'new_mock_refresh_token',
                expires_at: Math.floor(Date.now() / 1000) + 21600
            })
        }
    };
    // Return a full mock with both direct exports and client function
    return {
        // Direct exports
        ...mockClientFunctions,
        // Client function that returns the same mock
        client: jest.fn().mockImplementation(() => mockClientFunctions)
    };
});
describe('StravaClient', () => {
    let client;
    // Save and restore environment variables
    const OLD_ENV = process.env;
    beforeEach(() => {
        // Setup test environment
        process.env = {
            ...OLD_ENV,
            STRAVA_CLIENT_ID: '12345',
            STRAVA_CLIENT_SECRET: 'mock_secret',
            STRAVA_REFRESH_TOKEN: 'mock_refresh_token',
            STRAVA_ACCESS_TOKEN: 'mock_access_token'
        };
        client = new strava_client_1.StravaClient('fake_token');
    });
    afterEach(() => {
        // Restore env variables
        process.env = OLD_ENV;
        jest.clearAllMocks();
    });
    it('should fetch athlete information', async () => {
        const athlete = await client.getAthlete();
        expect(athlete).toHaveProperty('id', 1234);
        expect(athlete).toHaveProperty('firstname', 'Test');
    });
    it('should fetch activities', async () => {
        const activities = await client.getActivities({ per_page: 10 });
        expect(Array.isArray(activities)).toBe(true);
        expect(activities[0]).toHaveProperty('name', 'Morning Run');
    });
    it('should fetch a specific activity', async () => {
        const activity = await client.getActivity(1);
        expect(activity).toHaveProperty('id', 1);
        expect(activity).toHaveProperty('name', 'Morning Run');
    });
    it('should fetch activity streams', async () => {
        const streams = await client.getActivityStreams(1);
        expect(Array.isArray(streams)).toBe(true);
        expect(streams).toHaveLength(3); // heartrate, time, distance
        expect(streams[0]).toHaveProperty('type', 'heartrate');
        expect(streams[0].data).toHaveLength(10);
    });
    it('should fetch activities by date range', async () => {
        const startDate = new Date('2023-01-01');
        const endDate = new Date('2023-01-31');
        const activities = await client.getActivitiesByDate(startDate, endDate);
        expect(Array.isArray(activities)).toBe(true);
        expect(activities[0]).toHaveProperty('name', 'Morning Run');
    });
    it('should fetch heart rate data for an activity', async () => {
        const heartRateData = await client.getHeartRateData(1);
        expect(heartRateData).toHaveProperty('activity_id', 1);
        expect(heartRateData).toHaveProperty('has_heartrate', true);
        expect(heartRateData).toHaveProperty('heart_rate_stats');
        expect(heartRateData.heart_rate_stats).toHaveProperty('min', 140);
        expect(heartRateData.heart_rate_stats).toHaveProperty('max', 175);
        expect(heartRateData.heart_rate_stats).toHaveProperty('avg', 145);
        expect(heartRateData).toHaveProperty('raw_data');
        expect(heartRateData.raw_data).toHaveProperty('heart_rate');
        expect(heartRateData.raw_data.heart_rate).toHaveLength(10);
    });
    it('should fetch recent activities with heart rate data', async () => {
        const result = await client.getRecentActivitiesWithHeartRate(10);
        expect(result).toHaveProperty('activities');
        expect(result).toHaveProperty('total_count', 2);
        expect(result).toHaveProperty('activities_with_hr', 1);
        expect(result.activities).toHaveLength(1);
        expect(result.activities[0]).toHaveProperty('id', 1);
        expect(result.activities[0]).toHaveProperty('average_heartrate', 145);
    });
    it('should refresh access token', async () => {
        const axios = require('axios');
        const fs = require('fs/promises');
        const newToken = await client.refreshAccessToken();
        // Check that axios.post was called with correct parameters
        expect(axios.post).toHaveBeenCalledWith('https://www.strava.com/oauth/token', {
            client_id: '12345',
            client_secret: 'mock_secret',
            refresh_token: 'mock_refresh_token',
            grant_type: 'refresh_token'
        });
        // Check that fs.writeFile was called (token update in .env)
        expect(fs.writeFile).toHaveBeenCalled();
        // Check that new token was returned
        expect(newToken).toBe('new_mock_access_token');
        // Check that env vars were updated
        expect(process.env.STRAVA_ACCESS_TOKEN).toBe('new_mock_access_token');
        expect(process.env.STRAVA_REFRESH_TOKEN).toBe('new_mock_refresh_token');
    });
});
