import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const zonesConfigPath = path.join(projectRoot, 'zones.config.json');

export interface Zone {
  min: number;
  max: number;
  description: string;
  unit?: string;
}

export interface SportZones {
  [zoneName: string]: Zone;
}

export interface ZonesConfig {
  sports: {
    running: SportZones;
    cycling: SportZones;
  };
  metadata: {
    version: string;
    description: string;
    defaultSport: string;
    autoCalculate: boolean;
    userSettings: {
      running: {
        maxHeartRate: number;
        restingHeartRate: number;
      };
      cycling: {
        maxHeartRate: number;
        restingHeartRate: number;
      };
    };
  };
  powerZones?: {
    cycling: SportZones;
  };
  powerSettings?: {
    cycling: {
      ftp: number;
      autoCalculate: boolean;
    };
  };
}

/**
 * Load zones configuration from zones.config.json
 */
export function loadZonesConfig(): ZonesConfig {
  try {
    const configContent = fs.readFileSync(zonesConfigPath, 'utf-8');
    const config = JSON.parse(configContent) as ZonesConfig;
    
    // Auto-calculate zones if enabled
    if (config.metadata.autoCalculate) {
      if (config.metadata.userSettings.running.maxHeartRate > 0) {
        calculateRunningZones(config);
      }
      if (config.metadata.userSettings.cycling.maxHeartRate > 0) {
        calculateCyclingZones(config);
      }
    }
    
    // Auto-calculate power zones if enabled
    if (config.powerSettings?.cycling.autoCalculate && config.powerSettings.cycling.ftp > 0) {
      calculateCyclingPowerZones(config);
    }
    
    return config;
  } catch (error) {
    console.error('Error loading zones config:', error);
    // Return default empty config
    return getDefaultConfig();
  }
}

/**
 * Calculate running heart rate zones based on max heart rate
 * Uses standard percentages for running zones
 */
function calculateRunningZones(config: ZonesConfig): void {
  const maxHR = config.metadata.userSettings.running.maxHeartRate;
  
  config.sports.running["Zone 1"].min = Math.round(maxHR * 0.50);
  config.sports.running["Zone 1"].max = Math.round(maxHR * 0.60);
  
  config.sports.running["Low Zone 2"].min = Math.round(maxHR * 0.60);
  config.sports.running["Low Zone 2"].max = Math.round(maxHR * 0.65);
  
  config.sports.running["High Zone 2"].min = Math.round(maxHR * 0.65);
  config.sports.running["High Zone 2"].max = Math.round(maxHR * 0.70);
  
  config.sports.running["Zone 3"].min = Math.round(maxHR * 0.70);
  config.sports.running["Zone 3"].max = Math.round(maxHR * 0.80);
  
  config.sports.running["Zone 4"].min = Math.round(maxHR * 0.80);
  config.sports.running["Zone 4"].max = Math.round(maxHR * 0.90);
  
  config.sports.running["Zone 5"].min = Math.round(maxHR * 0.90);
  config.sports.running["Zone 5"].max = 999; // Keep max as 999 for Zone 5
}

/**
 * Calculate cycling heart rate zones based on max heart rate
 * Uses standard percentages for cycling zones (typically 5-10 bpm lower than running)
 */
function calculateCyclingZones(config: ZonesConfig): void {
  const maxHR = config.metadata.userSettings.cycling.maxHeartRate;
  
  config.sports.cycling["Zone 1"].min = Math.round(maxHR * 0.50);
  config.sports.cycling["Zone 1"].max = Math.round(maxHR * 0.60);
  
  config.sports.cycling["Low Zone 2"].min = Math.round(maxHR * 0.60);
  config.sports.cycling["Low Zone 2"].max = Math.round(maxHR * 0.65);
  
  config.sports.cycling["High Zone 2"].min = Math.round(maxHR * 0.65);
  config.sports.cycling["High Zone 2"].max = Math.round(maxHR * 0.70);
  
  config.sports.cycling["Zone 3"].min = Math.round(maxHR * 0.70);
  config.sports.cycling["Zone 3"].max = Math.round(maxHR * 0.80);
  
  config.sports.cycling["Zone 4"].min = Math.round(maxHR * 0.80);
  config.sports.cycling["Zone 4"].max = Math.round(maxHR * 0.90);
  
  config.sports.cycling["Zone 5"].min = Math.round(maxHR * 0.90);
  config.sports.cycling["Zone 5"].max = 999; // Keep max as 999 for Zone 5
}

/**
 * Calculate cycling power zones based on FTP (Functional Threshold Power)
 * Uses standard FTP-based percentages
 */
function calculateCyclingPowerZones(config: ZonesConfig): void {
  if (!config.powerZones?.cycling || !config.powerSettings?.cycling.ftp) {
    return;
  }
  
  const ftp = config.powerSettings.cycling.ftp;
  
  config.powerZones.cycling["Zone 1"].min = 0;
  config.powerZones.cycling["Zone 1"].max = Math.round(ftp * 0.55);
  
  config.powerZones.cycling["Zone 2"].min = Math.round(ftp * 0.56);
  config.powerZones.cycling["Zone 2"].max = Math.round(ftp * 0.75);
  
  config.powerZones.cycling["Zone 3"].min = Math.round(ftp * 0.76);
  config.powerZones.cycling["Zone 3"].max = Math.round(ftp * 0.90);
  
  config.powerZones.cycling["Zone 4"].min = Math.round(ftp * 0.91);
  config.powerZones.cycling["Zone 4"].max = Math.round(ftp * 1.05);
  
  config.powerZones.cycling["Zone 5"].min = Math.round(ftp * 1.06);
  config.powerZones.cycling["Zone 5"].max = Math.round(ftp * 1.20);
  
  config.powerZones.cycling["Zone 6"].min = Math.round(ftp * 1.21);
  config.powerZones.cycling["Zone 6"].max = 9999; // Keep max as 9999 for Zone 6
}

/**
 * Get default empty configuration
 */
function getDefaultConfig(): ZonesConfig {
  return {
    sports: {
      running: {
        "Zone 1": { min: 0, max: 0, description: "Active Recovery - Easy conversational pace" },
        "Low Zone 2": { min: 0, max: 0, description: "Aerobic Base - Comfortable endurance pace" },
        "High Zone 2": { min: 0, max: 0, description: "Aerobic Base - Moderate endurance pace" },
        "Zone 3": { min: 0, max: 0, description: "Aerobic Threshold - Comfortably hard pace" },
        "Zone 4": { min: 0, max: 0, description: "Lactate Threshold - Hard sustainable pace" },
        "Zone 5": { min: 0, max: 999, description: "VO2 Max - Very hard to maximal effort" }
      },
      cycling: {
        "Zone 1": { min: 0, max: 0, description: "Active Recovery - Easy spinning, minimal effort" },
        "Low Zone 2": { min: 0, max: 0, description: "Aerobic Base - Comfortable endurance riding" },
        "High Zone 2": { min: 0, max: 0, description: "Aerobic Base - Moderate endurance riding" },
        "Zone 3": { min: 0, max: 0, description: "Aerobic Threshold - Tempo riding pace" },
        "Zone 4": { min: 0, max: 0, description: "Lactate Threshold - Hard sustainable cycling effort" },
        "Zone 5": { min: 0, max: 999, description: "VO2 Max - Very hard to maximal cycling effort" }
      }
    },
    metadata: {
      version: "2.0",
      description: "Multi-sport HR zones configuration with cycling-specific zones",
      defaultSport: "running",
      autoCalculate: false,
      userSettings: {
        running: {
          maxHeartRate: 0,
          restingHeartRate: 0
        },
        cycling: {
          maxHeartRate: 0,
          restingHeartRate: 0
        }
      }
    },
    powerZones: {
      cycling: {
        "Zone 1": { min: 0, max: 0, description: "Active Recovery - Easy spinning, minimal power output", unit: "watts" },
        "Zone 2": { min: 0, max: 0, description: "Aerobic Base - Comfortable endurance power", unit: "watts" },
        "Zone 3": { min: 0, max: 0, description: "Aerobic Threshold - Tempo power output", unit: "watts" },
        "Zone 4": { min: 0, max: 0, description: "Lactate Threshold - Functional Threshold Power (FTP)", unit: "watts" },
        "Zone 5": { min: 0, max: 0, description: "VO2 Max - Hard anaerobic power", unit: "watts" },
        "Zone 6": { min: 0, max: 9999, description: "Anaerobic Capacity - Maximal power output", unit: "watts" }
      }
    },
    powerSettings: {
      cycling: {
        ftp: 0,
        autoCalculate: false
      }
    }
  };
}

/**
 * Get which heart rate zone a given heart rate falls into for a specific sport
 */
export function getHeartRateZone(heartRate: number, sport: 'running' | 'cycling', config: ZonesConfig): { zoneName: string; zone: Zone } | null {
  const zones = config.sports[sport];
  
  for (const [zoneName, zone] of Object.entries(zones)) {
    if (heartRate >= zone.min && (heartRate <= zone.max || zone.max >= 999)) {
      return { zoneName, zone };
    }
  }
  
  return null;
}

/**
 * Get which power zone a given power value falls into for cycling
 */
export function getPowerZone(power: number, config: ZonesConfig): { zoneName: string; zone: Zone } | null {
  if (!config.powerZones?.cycling) {
    return null;
  }
  
  const zones = config.powerZones.cycling;
  
  for (const [zoneName, zone] of Object.entries(zones)) {
    if (power >= zone.min && (power <= zone.max || zone.max >= 9999)) {
      return { zoneName, zone };
    }
  }
  
  return null;
}

/**
 * Get all zones for a specific sport
 */
export function getSportZones(sport: 'running' | 'cycling', config: ZonesConfig): SportZones {
  return config.sports[sport];
}

/**
 * Get power zones for cycling
 */
export function getCyclingPowerZones(config: ZonesConfig): SportZones | null {
  return config.powerZones?.cycling || null;
}
