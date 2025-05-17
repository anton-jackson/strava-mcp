declare module 'strava-v3' {
    interface StravaConfig {
      access_token?: string;
      client_id?: string;
      client_secret?: string;
      redirect_uri?: string;
    }
  
    interface StravaClient {
      athlete: {
        get: (params?: any) => Promise<any>;
        listActivities: (params?: any) => Promise<any[]>;
      };
      activities: {
        get: (params: { id: number }) => Promise<any>;
        getStreams: (params: { id: number; types: string; resolution?: string }) => Promise<any[]>;
      };
      oauth: {
        refreshToken: (refreshToken: string) => Promise<any>;
      };
    }
  
    const client: (accessToken?: string) => StravaClient;
    const athlete: {
      get: (params?: any) => Promise<any>;
      listActivities: (params?: any) => Promise<any[]>;
    };
    const activities: {
      get: (params: { id: number }) => Promise<any>;
      getStreams: (params: { id: number; types: string; resolution?: string }) => Promise<any[]>;
    };
    const oauth: {
      refreshToken: (refreshToken: string) => Promise<any>;
    };
    const config: (config: StravaConfig) => void;
  
    export { client, athlete, activities, oauth, config };
}