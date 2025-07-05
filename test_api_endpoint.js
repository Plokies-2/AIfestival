#!/usr/bin/env node
/**
 * Test script to verify the LSTM API endpoint works correctly
 */

const http = require('http');

function testLSTMAPI(ticker = 'INTC') {
  console.log(`Testing LSTM API with ticker: ${ticker}`);
  
  const postData = JSON.stringify({ symbol: ticker });
  
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/lstm_prediction',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = http.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`);
    console.log(`Headers:`, res.headers);
    
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
      console.log('Received chunk:', chunk.toString());
    });
    
    res.on('end', () => {
      console.log('Response ended');
      console.log('Full response:', data);
    });
  });

  req.on('error', (e) => {
    console.error(`Request error: ${e.message}`);
  });

  req.write(postData);
  req.end();
}

// Test if server is running
const testReq = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/',
  method: 'GET'
}, (res) => {
  console.log('✅ Next.js server is running');
  console.log('Starting LSTM API test...\n');
  testLSTMAPI();
}).on('error', (e) => {
  console.error('❌ Next.js server is not running. Please start it with: npm run dev');
  process.exit(1);
});

testReq.end();
