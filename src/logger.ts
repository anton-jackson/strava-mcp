import fs from 'fs';
import path from 'path';

const LOG_DIR = path.join(process.cwd(), 'logs');

// Create logs directory if it doesn't exist
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR);
}

const logFilePath = path.join(LOG_DIR, `mcp-server-${new Date().toISOString().split('T')[0]}.log`);

export const logger = {
  info: (message: string, data?: any) => {
    const logEntry = `[${new Date().toISOString()}] INFO: ${message} ${data ? JSON.stringify(data) : ''}`;
    console.log(logEntry);
    fs.appendFileSync(logFilePath, `${logEntry}\n`);
  },
  
  error: (message: string, error?: any) => {
    const logEntry = `[${new Date().toISOString()}] ERROR: ${message} ${error ? JSON.stringify(error) : ''}`;
    console.error(logEntry);
    fs.appendFileSync(logFilePath, `${logEntry}\n`);
    
    if (error && error.stack) {
      fs.appendFileSync(logFilePath, `${error.stack}\n`);
    }
  },
  
  debug: (message: string, data?: any) => {
    if (process.env.DEBUG === 'true') {
      const logEntry = `[${new Date().toISOString()}] DEBUG: ${message} ${data ? JSON.stringify(data) : ''}`;
      console.log(logEntry);
      fs.appendFileSync(logFilePath, `${logEntry}\n`);
    }
  }
};