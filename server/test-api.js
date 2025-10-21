const jwt = require('jsonwebtoken');

// Create a test token
const token = jwt.sign({
  userId: 'e64a3175-c8b1-4165-b482-bee5422bdeb4',
  email: 'salman@demo.com',
  organizationId: 'test-org'
}, 'your-super-secret-jwt-key-change-this-in-production');

console.log('Test token:', token);

// Test the SIP credentials endpoint
fetch('http://localhost:3000/api/v1/users/me/sip-credentials', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
})
.then(response => response.json())
.then(data => {
  console.log('SIP Credentials Response:', JSON.stringify(data, null, 2));
})
.catch(error => {
  console.error('Error:', error.message);
});