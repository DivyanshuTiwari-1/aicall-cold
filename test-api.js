const axios = require('axios');

async function testAPI() {
    try {
        console.log('Testing API endpoints...');

        // Test users API
        console.log('\n1. Testing Users API...');
        const usersResponse = await axios.get('http://localhost:3000/api/v1/users?role=agent', {
            headers: {
                'Authorization': 'Bearer test_token' // This will fail but we can see the response
            }
        });
        console.log('Users API Response:', usersResponse.data);

    } catch (error) {
        console.log('Users API Error:', error.response?.status, error.response?.data);
    }

    try {
        // Test assignments API
        console.log('\n2. Testing Assignments API...');
        const assignmentsResponse = await axios.get('http://localhost:3000/api/v1/assignments', {
            headers: {
                'Authorization': 'Bearer test_token' // This will fail but we can see the response
            }
        });
        console.log('Assignments API Response:', assignmentsResponse.data);

    } catch (error) {
        console.log('Assignments API Error:', error.response?.status, error.response?.data);
    }

    try {
        // Test contacts API
        console.log('\n3. Testing Contacts API...');
        const contactsResponse = await axios.get('http://localhost:3000/api/v1/contacts', {
            headers: {
                'Authorization': 'Bearer test_token' // This will fail but we can see the response
            }
        });
        console.log('Contacts API Response:', contactsResponse.data);

    } catch (error) {
        console.log('Contacts API Error:', error.response?.status, error.response?.data);
    }
}

testAPI();
