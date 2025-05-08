import StravaClient from '../src/strava-client';

// Mock the strava-v3 module
jest.mock('strava-v3', () => {
  return {
    client: jest.fn().mockImplementation(() => {
      return {
        athlete: {
          get: jest.fn().mockResolvedValue({ id: 1234, firstname: 'Test', lastname: 'Athlete' }),
          listActivities: jest.fn().mockResolvedValue([
            { id: 1, name: 'Morning Run', type: 'Run', distance: 5000 }
          ])
        },
        activities: {
          get: jest.fn().mockResolvedValue({ id: 1, name: 'Morning Run', type: 'Run', distance: 5000 })
        }
      };
    })
  };
});

describe('StravaClient', () => {
  let client: StravaClient;

  beforeEach(() => {
    client = new StravaClient('fake_token');
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
});
