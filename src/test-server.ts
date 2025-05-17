import http from 'http';

// Test initialization message
const initMessage = {
  type: 'init',
  id: 'test-1'
};

// Test tool call message
const toolCallMessage = {
  type: 'tool_call',
  id: 'test-2',
  payload: {
    tool: 'getRecentActivities',
    parameters: {
      count: 5
    }
  }
};

// Function to send test request
async function sendTestRequest(message: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve({ statusCode: res.statusCode, response });
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error instanceof Error ? error.message : String(error)}\nResponse: ${data}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.write(JSON.stringify(message));
    req.end();
  });
}

// Run tests
async function runTests() {
  try {
    console.log('Testing server initialization...');
    const initResult = await sendTestRequest(initMessage);
    console.log('Init response:', JSON.stringify(initResult, null, 2));
    
    console.log('\nTesting tool call...');
    const toolResult = await sendTestRequest(toolCallMessage);
    console.log('Tool call response:', JSON.stringify(toolResult, null, 2));
    
    console.log('\nAll tests completed successfully!');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

runTests();