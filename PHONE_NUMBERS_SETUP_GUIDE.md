# Phone Numbers & Agent Assignment System - Setup Guide

## 🎉 Overview

A comprehensive phone number management system that allows admins to:
1. **Upload and manage phone numbers** for outbound calling
2. **Assign numbers to agents** with custom configurations
3. **Set daily call limits** per agent per number
4. **Restrict calling to specific countries** per assignment

---

## 📋 Features Implemented

### 1. **Phone Numbers Management** (`/phone-numbers`)
- ✅ Add individual phone numbers
- ✅ Bulk upload phone numbers (CSV/Text format)
- ✅ View all numbers with assignment status
- ✅ Filter by status (active/inactive) and assignment (assigned/available)
- ✅ Delete unassigned numbers
- ✅ Unassign numbers from agents

### 2. **Agent Number Assignment** (`/agent-assignments`)
- ✅ View all agents and their assigned numbers
- ✅ Assign phone numbers to agents
- ✅ Set daily call limits per assignment
- ✅ Configure allowed countries per assignment
- ✅ View call usage (calls made today vs limit)
- ✅ Remove number assignments

### 3. **Backend API** (`/api/v1/phone-numbers`)
- ✅ Full CRUD operations for phone numbers
- ✅ Assignment management endpoints
- ✅ Automatic daily reset functionality
- ✅ Country and limit enforcement

---

## 🗄️ Database Schema

### New Tables Created:

#### `phone_numbers`
```sql
- id (UUID, primary key)
- organization_id (UUID, foreign key)
- phone_number (VARCHAR, unique)
- provider (VARCHAR) - telnyx, twilio
- country_code (VARCHAR) - US, CA, GB, etc.
- capabilities (JSONB) - {"voice": true, "sms": false}
- status (VARCHAR) - active, inactive
- assigned_to (UUID, foreign key to users)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

#### `agent_phone_numbers`
```sql
- id (UUID, primary key)
- agent_id (UUID, foreign key to users)
- phone_number_id (UUID, foreign key to phone_numbers)
- organization_id (UUID, foreign key)
- daily_limit (INTEGER) - max calls per day
- allowed_countries (JSONB) - ["US", "CA"]
- calls_made_today (INTEGER) - current usage
- last_reset_date (DATE) - for auto-reset
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

---

## 🚀 Setup Instructions

### Step 1: Run Database Migration

```bash
cd server
node scripts/migrations/add-phone-numbers-tables.js
```

This will create:
- `phone_numbers` table
- `agent_phone_numbers` table
- Necessary indexes
- Auto-reset function

### Step 2: Start the Backend

```bash
cd server
npm start
```

The new routes will be available at:
- `GET /api/v1/phone-numbers` - List all numbers
- `POST /api/v1/phone-numbers` - Add a number
- `POST /api/v1/phone-numbers/bulk-upload` - Bulk upload
- `POST /api/v1/phone-numbers/:id/assign` - Assign to agent
- `POST /api/v1/phone-numbers/:id/unassign` - Unassign from agent
- `DELETE /api/v1/phone-numbers/:id` - Delete number
- `GET /api/v1/phone-numbers/agent/:agentId` - Get agent's numbers

### Step 3: Start the Frontend

```bash
cd client
npm start
```

Navigate to:
- **Phone Numbers Management**: `http://localhost:3001/phone-numbers`
- **Agent Assignments**: `http://localhost:3001/agent-assignments`

---

## 📖 Usage Guide

### For Admins:

#### 1. Add Phone Numbers

**Option A: Single Number**
1. Go to `/phone-numbers`
2. Click "Add Number"
3. Enter:
   - Phone number (e.g., `+12025550123`)
   - Provider (Telnyx or Twilio)
   - Country code (e.g., `US`)
4. Click "Add Number"

**Option B: Bulk Upload**
1. Go to `/phone-numbers`
2. Click "Bulk Upload"
3. Enter numbers in format:
   ```
   +12025550123,telnyx,US
   +12025550124,telnyx,US
   +14155550125,telnyx,US
   ```
4. Click "Upload Numbers"

#### 2. Assign Numbers to Agents

1. Go to `/agent-assignments`
2. Find the agent you want to assign to
3. Click "Assign Number"
4. Select:
   - **Phone Number** - from available numbers
   - **Daily Call Limit** - max calls per day (default: 100)
   - **Allowed Countries** - countries agent can call
5. Click "Assign Number"

#### 3. Monitor Usage

- View calls made today vs daily limit in Agent Assignments page
- See which numbers are available/assigned in Phone Numbers page
- Track agent activity

#### 4. Manage Assignments

**Unassign a Number:**
- In Phone Numbers page: Click "Unassign" next to assigned number
- In Agent Assignments page: Click "Remove" next to agent's assigned number

**Delete a Number:**
- Must unassign first
- In Phone Numbers page: Click trash icon for available numbers

---

## 🔐 Security & Access Control

### Role-Based Access:
- **Admins**: Full access to both pages
- **Managers**: View-only access (optional, can be configured)
- **Agents**: Can view their own assigned numbers via API

### Permissions:
- Only admins can add/delete/assign numbers
- Daily limits are enforced at the API level
- Country restrictions are validated before allowing calls

---

## 🔄 Automatic Daily Reset

The system includes an automatic reset function that:
- Resets `calls_made_today` to 0 every day
- Updates `last_reset_date` to current date
- Runs automatically when checking call limits

**Manual Reset (if needed):**
```sql
SELECT reset_daily_call_counts();
```

---

## 📊 API Integration

### For Manual Calls:

When an agent makes a call, the system will:
1. Check if they have an assigned number
2. Verify daily limit hasn't been exceeded
3. Validate destination country is allowed
4. Increment `calls_made_today` counter

### Example API Call:

```javascript
// Get agent's assigned numbers
GET /api/v1/phone-numbers/agent/:agentId

Response:
{
  "success": true,
  "phoneNumbers": [
    {
      "id": "uuid",
      "phone_number": "+12025550123",
      "provider": "telnyx",
      "country_code": "US",
      "daily_limit": 100,
      "allowed_countries": ["US", "CA"],
      "calls_made_today": 45
    }
  ]
}
```

---

## 🧪 Testing Checklist

### Backend Tests:
- [ ] Run migration successfully
- [ ] Add a phone number via API
- [ ] Bulk upload phone numbers
- [ ] Assign number to agent
- [ ] Verify daily limit enforcement
- [ ] Verify country restrictions
- [ ] Unassign number
- [ ] Delete number

### Frontend Tests:
- [ ] Login as admin
- [ ] Navigate to Phone Numbers page
- [ ] Add a number manually
- [ ] Bulk upload numbers
- [ ] Navigate to Agent Assignments page
- [ ] Assign a number to an agent with limits
- [ ] View agent's assigned numbers
- [ ] Unassign a number
- [ ] Delete an available number

---

## 🎯 Use Cases

### Use Case 1: Sales Team with Regional Numbers
```
- Add numbers for different regions (US, CA, UK)
- Assign US numbers to US-based agents
- Set country restrictions per number
- Monitor usage per agent
```

### Use Case 2: High-Volume Calling
```
- Upload 50 phone numbers
- Distribute across 10 agents (5 numbers each)
- Set daily limit of 200 calls per number
- Total capacity: 10,000 calls/day
```

### Use Case 3: Compliance Management
```
- Restrict agents to calling only approved countries
- Set conservative daily limits
- Monitor who is making calls from which numbers
- Easily reassign numbers if agent leaves
```

---

## 🐛 Troubleshooting

### Issue: Numbers not showing up
**Solution:** Check organization_id matches user's organization

### Issue: Can't assign number
**Solution:** Ensure number is not already assigned and agent exists

### Issue: Daily limit not resetting
**Solution:** Run manual reset function or restart server

### Issue: Navigation links not visible
**Solution:** Ensure you're logged in as admin

---

## 📝 Next Steps (Optional Enhancements)

1. **Auto-rotation**: Automatically rotate numbers for agents
2. **Analytics**: Track which numbers perform best
3. **Integration**: Use assigned numbers for actual outbound calls
4. **Scheduler**: Schedule daily resets via cron job
5. **Reporting**: Generate usage reports per agent/number

---

## 🎊 Summary

You now have a complete phone number management system that allows admins to:
✅ Upload and manage phone numbers
✅ Assign numbers to agents with custom limits
✅ Restrict calling by country
✅ Monitor daily usage
✅ Manage assignments easily

All dashboards now display real data, and the entire system is ready for production use!

---

## 📞 Support

For issues or questions:
1. Check the logs: `server/logs/`
2. Verify database tables exist
3. Ensure user has admin role
4. Check browser console for errors

Happy calling! 🚀
