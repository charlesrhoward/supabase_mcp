const http = require('http');

console.log('Testing server connection...');

// Simple HTTP request to test if the server is running
const options = {
  hostname: 'localhost',
  port: process.env.PORT || 3000,
  path: '/',
  method: 'GET'
};

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('RESPONSE:', data);
    console.log('Server is running correctly!');
    process.exit(0);
  });
});

req.on('error', (e) => {
  console.error('Error connecting to server:', e.message);
  console.log('Make sure the server is running with: npm run dev');
  process.exit(1);
});

req.end();
