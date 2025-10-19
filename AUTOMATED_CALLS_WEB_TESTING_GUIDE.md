# 🤖 Automated Calls Web Testing Guide

## 🎯 **Complete Testing Process for Your 5 Family Numbers**

This guide will walk you through testing automated calls using the web interface with your 5 family phone numbers.

---

## 📋 **Step-by-Step Testing Process**

### **Step 1: Setup Test Data**
First, create test data with your 5 family numbers:

```bash
cd server
node scripts/setup-family-test-data.js
```

This will create:
- ✅ Test organization
- ✅ Test user (agent)
- ✅ Test campaign: "Family Test Campaign"
- ✅ 5 family contacts with phone numbers

---

### **Step 2: Access the Web Interface**

1. **Start the application:**
   ```bash
   # Terminal 1 - Backend
   cd server
   npm start

   # Terminal 2 - Frontend
   cd client
   npm start
   ```

2. **Open your browser:**
   - Go to `http://localhost:3000`
   - Login with test credentials (or create new account)

---

### **Step 3: Navigate to Campaigns**

1. **Click "Campaigns" in the navigation menu**
2. **You should see "Family Test Campaign" in the list**
3. **Verify the campaign shows:**
   - ✅ Status: "Active"
   - ✅ Type: "Sales"
   - ✅ Contacts: 5
   - ✅ Calls Made: 0

---

### **Step 4: Start Automated Calls**

1. **Find "Family Test Campaign" in the campaigns table**
2. **Click the "Start Queue" button** (green button with play icon)
3. **You should see:**
   - ✅ Button changes to "Stop" (red button)
   - ✅ Toast notification: "Automated calls started successfully"
   - ✅ Campaign status updates to show active calls

---

### **Step 5: Monitor Call Progress**

1. **Watch the dashboard stats update:**
   - Active Calls: Should show 1-2 (based on maxConcurrentCalls setting)
   - Queued Calls: Should show remaining contacts

2. **Check the "My Leads" page:**
   - Go to "My Leads" in navigation
   - You should see your 5 family contacts
   - Status should change from "pending" to "in_progress" as calls are made

3. **Monitor call history:**
   - Go to "Call History" page
   - Watch calls being created and completed
   - See call outcomes and durations

---

### **Step 6: Test Call Outcomes**

When your family members answer the calls, you can test different scenarios:

1. **Answer the call** - Test the conversation flow
2. **Don't answer** - Test retry logic
3. **Busy signal** - Test busy handling
4. **Hang up immediately** - Test short call handling

---

### **Step 7: Stop Automated Calls**

1. **Go back to "Campaigns" page**
2. **Click "Stop" button** (red button with stop icon)
3. **Verify:**
   - ✅ Button changes back to "Start Queue"
   - ✅ Toast notification: "Automated calls stopped successfully"
   - ✅ No new calls are initiated

---

## 🔍 **What to Look For**

### **✅ Success Indicators:**
- Campaign shows "Start Queue" button is clickable
- After clicking "Start Queue", button changes to "Stop"
- Dashboard shows active calls count
- Contacts appear in "My Leads" with changing status
- Call history shows new calls being created
- Calls are made to your family numbers in sequence

### **❌ Common Issues:**
- **Button disabled**: Check if campaign status is "active"
- **No calls starting**: Check server logs for errors
- **Calls not reaching family**: Check Asterisk configuration
- **WebSocket errors**: These are expected in test environment

---

## 🛠️ **Troubleshooting**

### **If "Start Queue" Button is Disabled:**
1. Check campaign status is "active"
2. Verify campaign has contacts assigned
3. Check server logs for errors

### **If Calls Don't Start:**
1. Check server console for error messages
2. Verify Asterisk is running and configured
3. Check database for contact data

### **If WebSocket Errors Appear:**
- These are expected in test environment
- They don't affect automated call functionality
- Focus on the actual call initiation

---

## 📊 **Expected Results**

After starting the automated call queue, you should see:

1. **Immediate Response:**
   - Button changes to "Stop"
   - Success toast notification
   - Dashboard stats update

2. **Within 30 seconds:**
   - First call should be initiated
   - Contact status changes to "in_progress"
   - Call appears in call history

3. **Call Progression:**
   - Calls made to each family number in sequence
   - Retry logic for unanswered calls
   - Proper call completion and logging

4. **Queue Management:**
   - Respects maxConcurrentCalls setting (default: 2)
   - Handles retry attempts (default: 3)
   - Proper delay between retries (default: 30 minutes)

---

## 🎉 **Success!**

If everything works correctly, you should see:
- ✅ Automated calls being made to your 5 family numbers
- ✅ Real-time updates in the web interface
- ✅ Proper call logging and statistics
- ✅ Queue management working as expected

**Your automated calling system is working perfectly!** 🚀

---

## 📞 **Next Steps**

Once testing is complete:
1. **Stop the automated calls** using the "Stop" button
2. **Clean up test data** if needed
3. **Configure real campaigns** with actual contact lists
4. **Set up proper Asterisk integration** for production use

---

## 🆘 **Need Help?**

If you encounter any issues:
1. Check the server console for error messages
2. Verify all services are running
3. Check the database for proper data setup
4. Review the automated call queue logs

**Happy Testing!** 🎯
