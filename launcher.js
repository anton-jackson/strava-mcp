// launcher.js
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// Log file for the launcher
const launcherLogFile = path.join(logsDir, `launcher-${new Date().toISOString().split('T')[0]}.log`);

// Function to log to file only
function log(message) {
  const timestamp = new Date().toISOString();
  fs.appendFileSync(launcherLogFile, `[${timestamp}] ${message}\n`);
}

// Start the server process
log('Starting MCP server...');

// Create a detached process running the server
const serverProcess = spawn('node', [path.join(__dirname, 'dist', 'index.js')], {
  detached: true,
  stdio: ['ignore', 'pipe', 'pipe'], // Redirect stdout and stderr
  env: {
    ...process.env,
    MCP_LOG_MODE: 'file_only' // Custom env variable to signal file-only logging
  }
});

// Don't wait for child process
serverProcess.unref();

// Log server output to file, not stdout
serverProcess.stdout.on('data', (data) => {
  fs.appendFileSync(path.join(logsDir, 'server-stdout.log'), data);
});

serverProcess.stderr.on('data', (data) => {
  fs.appendFileSync(path.join(logsDir, 'server-stderr.log'), data);
});

// Wait a moment for the server to start
setTimeout(() => {
  log('MCP server started successfully');
  
  // Exit the launcher, leaving the server running
  process.exit(0);
}, 1000);