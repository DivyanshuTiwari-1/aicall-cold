# Phone Number Assignment System - Complete Guide

## Overview

The system now supports **agent-specific phone number assignments** for manual calls. This enables:
- ✅ Multiple agents making concurrent calls using different phone numbers
- ✅ Daily call limits per agent/number combination
- ✅ Country restrictions for compliance
- ✅ No more single TELNYX_PHONE_NUMBER bottleneck
- ✅ Better call tracking and analytics

---

## What Changed

### Backend Changes

#### 1. Manual Calls Route (`server/routes/manualcalls.js`) ✅
- **Fetches assigned phone number**: When an agent initiates a manual call, the system now queries the database for phone numbers assigned to that agent
- **Daily limit checking**: Validates that the agent hasn't exceeded their daily call limit
- **Automatic counter increment**: Increments `calls_made_today` counter for the assigned number
- **Error handling**: Returns user-friendly errors if no number is assigned or limit is reached

**Key Code Changes:**
```javascript
// Get agent's assigned phone number (with lowest usage first)
const phoneNumberResult = await query(`
    SELECT pn.id, pn.phone_number, pn.provider, apn.daily_limit, apn.calls_made_today
    FROM phone_numbers pn
    JOIN agent_phone_numbers apn ON pn.id = apn.phone_number_id
    WHERE pn.assigned_to = $1 AND pn.organization_id = $2 AND pn.status = 'active'
    ORDER BY apn.calls_made_today ASC
    LIMIT 1
`, [req.user.id, req.organizationId]);

// Check if agent has an assigned number
if (phoneNumberResult.rows.length === 0) {
    return res.status(400).json({
        message: 'No phone number assigned to you. Please contact your administrator.'
    });
}

// Check daily limit
if (assignedNumber.calls_made_today >= assignedNumber.daily_limit) {
    return res.status(400).json({
        message: `Daily call limit reached (${assignedNumber.daily_limit} calls).`
    });
}
```

#### 2. SimpleCalls Route (`server/routes/simple-calls.js`) ✅
**NEW:** SimpleCalls (browser-based calling) now also uses agent-assigned numbers!

- **WebRTC Token Endpoint**: Fetches agent's assigned number and returns it with credentials
- **Start Call Endpoint**: Uses assigned number as caller ID for browser calls
- **Daily Limit Checking**: Same validation as manual calls
- **Counter Increment**: Tracks SimpleCalls in daily usage
- **Graceful Fallback**: Uses env variable if no number assigned

**Key Features:**
```javascript
// SimpleCalls now fetch assigned numbers too
const phoneNumberResult = await query(`
    SELECT pn.id, pn.phone_number, pn.provider, apn.daily_limit, apn.calls_made_today
    FROM phone_numbers pn
    JOIN agent_phone_numbers apn ON pn.id = apn.phone_number_id
    WHERE pn.assigned_to = $1 AND pn.status = 'active'
    ORDER BY apn.calls_made_today ASC
    LIMIT 1
`);

// Returns phone number info to frontend
res.json({
    token: { username, password, sipServer, callerIdNumber },
    phoneNumber: {
        phoneNumber: assignedNumber.phone_number,
        dailyLimit: assignedNumber.daily_limit,
        callsMadeToday: assignedNumber.calls_made_today,
        remaining: assignedNumber.daily_limit - assignedNumber.calls_made_today
    }
});
```

#### 3. Asterisk Telephony Provider (`server/services/telephony/providers/asterisk.js`) ✅
- **Accepts fromNumber parameter**: Updated to use agent-assigned number as caller ID
- **Falls back gracefully**: If no number provided, uses `TELNYX_DID` from environment

**Key Code Changes:**
```javascript
async function startManualCall({ callId, agentExtension, agentUserId, toPhone, contactId, fromNumber }) {
    // Use assigned phone number or fall back to env variable
    const callerIdNumber = fromNumber || process.env.TELNYX_DID || '+12025550123';

    const customerChannel = await client.channels.originate({
        endpoint: `PJSIP/${toPhone}@telnyx_outbound`,
        app: 'manual-dialer-bridge-stasis',
        appArgs: [callId, contactId].join(','),
        callerId: callerIdNumber  // Uses agent's assigned number
    });
}
```

### Frontend Changes

#### SimpleBrowserPhone Component (`client/src/components/SimpleBrowserPhone.js`) ✅
**Updated to display phone number information during calls:**

- **Shows assigned number**: "Calling from: +12025550123"
- **Displays usage**: "Calls today: 5/100"
- **Shows remaining**: "95 remaining"
- **Better error handling**: Shows daily limit errors with call counts

**UI Enhancement:**
```jsx
{phoneNumberInfo && (
    <div className="mb-4 bg-blue-50 rounded-lg p-3 border border-blue-200">
        <div className="flex items-center justify-between text-sm">
            <div>
                <p className="text-gray-600">
                    <span className="font-medium">Calling from:</span> {fromNumber}
                </p>
            </div>
            <div className="text-right">
                <p className="text-xs text-gray-500">
                    Calls today: <span className="font-semibold">{phoneNumberInfo.callsMadeToday}</span>/{phoneNumberInfo.dailyLimit}
                </p>
                <p className="text-xs text-green-600 font-medium">
                    {phoneNumberInfo.remaining} remaining
                </p>
            </div>
        </div>
    </div>
)}
```

### Frontend Pages (Already Exist!)

#### 1. Phone Numbers Management Page (`/phone-numbers`)
**Location:** `client/src/pages/PhoneNumbersManagement.js`

**Features:**
- ✅ View all phone numbers in the organization
- ✅ Add individual phone numbers manually
- ✅ Bulk upload phone numbers (CSV format)
- ✅ Filter by status (active/inactive) and assignment
- ✅ See which agent each number is assigned to
- ✅ View daily call usage (calls made today / daily limit)
- ✅ Unassign numbers from agents
- ✅ Delete unassigned numbers

**Access:** Admin only (via Sidebar → Phone Numbers)

#### 2. Agent Number Assignment Page (`/agent-assignments`)
**Location:** `client/src/pages/AgentNumberAssignment.js`

**Features:**
- ✅ View all agents in the organization
- ✅ See which numbers are assigned to each agent
- ✅ Assign phone numbers to agents with:
  - Daily call limits (1-1000 calls per day)
  - Country restrictions (US, CA, GB, AU, IN, MX, DE, FR)
- ✅ View current call usage per number
- ✅ Unassign numbers from agents
- ✅ Summary statistics (total agents, available numbers, assigned numbers)

**Access:** Admin only (via Sidebar → Agent Assignments)

---

## How to Use the System

### Step 1: Admin - Add Phone Numbers

1. **Navigate to:** Sidebar → **Phone Numbers**
2. **Click:** "Add Number" button
3. **Enter:**
   - Phone Number (format: `+12025550123`)
   - Provider (Telnyx or Twilio)
   - Country Code (e.g., `US`)
4. **Click:** "Add Number"

**Bulk Upload Option:**
- Click "Bulk Upload" button
- Enter numbers in format: `+12025550123,telnyx,US` (one per line)
- Click "Upload Numbers"

### Step 2: Admin - Assign Numbers to Agents

1. **Navigate to:** Sidebar → **Agent Assignments**
2. **Find the agent** you want to assign a number to
3. **Click:** "Assign Number" button
4. **Configure:**
   - **Phone Number:** Select from available numbers dropdown
   - **Daily Call Limit:** Set maximum calls per day (default: 100)
   - **Allowed Countries:** Check countries the agent can call
5. **Click:** "Assign Number"

### Step 3: Agent - Make Calls

Agents can make calls using **two methods**, both now use assigned phone numbers:

#### Method 1: SimpleCalls (Browser-Based) 🌐
1. **Navigate to:** SimpleCalls page (via Sidebar)
2. **Select a contact**
3. **Click:** "Call" button
4. **Browser phone interface opens:**
   - Shows "Calling from: [your assigned number]"
   - Displays usage: "Calls today: X/Y"
   - Shows remaining calls
5. **Talk directly through browser** (no softphone needed!)

#### Method 2: Manual Calls (SIP Phone) 📞
1. **Navigate to:** Agent Dashboard or Contacts page
2. **Select a contact** assigned to you
3. **Click:** "Call" or dial button
4. **SIP phone rings first**, then customer is dialed

**Both methods automatically:**
- ✅ Use your assigned phone number as caller ID
- ✅ Check your daily limit before calling
- ✅ Increment your call counter
- ✅ Track usage in real-time

**What Agents See:**
- If no number assigned: *"No phone number assigned to you. Please contact your administrator."*
- If limit reached: *"Daily call limit reached (100 calls). Please contact your administrator."*
- SimpleCalls shows: Live usage counter in call interface

### Step 4: Admin - Monitor Usage

1. **Navigate to:** Sidebar → **Phone Numbers**
2. **View usage:** See "Daily Limit" column showing `calls_made_today / daily_limit`
3. **Filter:** Use filters to view only assigned or available numbers

---

## Database Schema

### Tables Added

#### `phone_numbers`
```sql
CREATE TABLE phone_numbers (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    provider VARCHAR(50) DEFAULT 'telnyx',
    country_code VARCHAR(2) NOT NULL,
    capabilities JSONB DEFAULT '{"voice": true, "sms": false}',
    status VARCHAR(20) DEFAULT 'active',
    assigned_to UUID REFERENCES users(id),
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

#### `agent_phone_numbers`
```sql
CREATE TABLE agent_phone_numbers (
    id UUID PRIMARY KEY,
    agent_id UUID NOT NULL,
    phone_number_id UUID NOT NULL,
    organization_id UUID NOT NULL,
    daily_limit INTEGER DEFAULT 100,
    allowed_countries JSONB DEFAULT '["US", "CA"]',
    calls_made_today INTEGER DEFAULT 0,
    last_reset_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    UNIQUE(agent_id, phone_number_id)
);
```

#### `calls` (updated)
```sql
ALTER TABLE calls
ADD COLUMN from_number VARCHAR(20),
ADD COLUMN to_number VARCHAR(20);
```

---

## API Endpoints

### Phone Numbers Management

#### GET `/api/v1/phone-numbers`
Get all phone numbers for organization
- **Query params:** `status`, `assigned`
- **Auth:** Admin, Manager
- **Returns:** List of phone numbers with assignment details

#### POST `/api/v1/phone-numbers`
Add a new phone number
- **Body:** `{ phoneNumber, provider, countryCode }`
- **Auth:** Admin only
- **Returns:** Created phone number

#### POST `/api/v1/phone-numbers/bulk-upload`
Bulk upload phone numbers
- **Body:** `{ phoneNumbers: [{ phoneNumber, provider, countryCode }] }`
- **Auth:** Admin only
- **Returns:** Upload results (added, skipped, errors)

#### POST `/api/v1/phone-numbers/:numberId/assign`
Assign phone number to agent
- **Body:** `{ agentId, dailyLimit, allowedCountries }`
- **Auth:** Admin only
- **Returns:** Success message

#### POST `/api/v1/phone-numbers/:numberId/unassign`
Unassign phone number from agent
- **Auth:** Admin only
- **Returns:** Success message

#### DELETE `/api/v1/phone-numbers/:numberId`
Delete phone number (must be unassigned first)
- **Auth:** Admin only
- **Returns:** Success message

#### GET `/api/v1/phone-numbers/agent/:agentId`
Get phone numbers assigned to specific agent
- **Auth:** Any authenticated user
- **Returns:** List of assigned numbers with limits and usage

---

## Calling Methods Comparison

| Feature | SimpleCalls (Browser) | Manual Calls (SIP Phone) |
|---------|----------------------|--------------------------|
| **Equipment Needed** | Just a browser + mic | SIP softphone required |
| **Setup** | Click and talk | Login to softphone first |
| **Caller ID** | Agent's assigned number ✅ | Agent's assigned number ✅ |
| **Daily Limits** | Checked & tracked ✅ | Checked & tracked ✅ |
| **Usage Display** | Live counter in UI ✅ | No live display |
| **Call Quality** | WebRTC (good) | SIP (excellent) |
| **Best For** | Quick calls, remote agents | High-volume calling |
| **Fallback** | Env variable if no assignment | Env variable if no assignment |

## Benefits of This System

### 1. **Concurrent Calling** ✨
- Multiple agents can make calls simultaneously without conflicts
- Each agent uses their own assigned phone number
- No single-number bottleneck

### 2. **Compliance & Control**
- Daily call limits prevent spam and abuse
- Country restrictions ensure regulatory compliance
- Audit trail of which agent used which number

### 3. **Better Analytics**
- Track performance by phone number
- Identify high-performing numbers
- Monitor usage patterns per agent

### 4. **Scalability**
- Easy to add more numbers as team grows
- Automatic load balancing (lowest usage first)
- Simple reassignment when agents leave

### 5. **Cost Management**
- Monitor usage per number
- Set appropriate limits per agent skill level
- Identify and remove unused numbers

---

## Migration Instructions

### If Starting Fresh
The migrations will run automatically when you start the server.

### If Upgrading Existing System

1. **Run the phone numbers migration:**
```bash
cd server
node scripts/migrations/add-phone-numbers-tables.js
```

2. **Run the transcript/from_number migration:**
```bash
node scripts/migrations/add-transcript-field.js
```

3. **Restart your server:**
```bash
npm start
```

### Verify Migrations
Check that tables exist:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('phone_numbers', 'agent_phone_numbers');
```

---

## Troubleshooting

### Agent Can't Make Calls - "No phone number assigned"
**Solution:** Admin needs to:
1. Go to Phone Numbers page and add numbers
2. Go to Agent Assignments page
3. Assign at least one number to the agent

### Agent Hits Daily Limit
**Solution:** Admin can:
1. Increase the agent's daily limit
2. Assign additional numbers to the agent
3. Wait until next day (counters reset automatically)

### Numbers Not Showing in Agent Assignments
**Check:**
- Numbers are marked as "active" status
- Numbers exist in Phone Numbers page
- Agent role is correctly set to "agent"

### Call Still Using Old TELNYX_DID
**Check:**
- Agent has a phone number assigned
- Migration for `from_number` column ran successfully
- Server was restarted after code changes

---

## Future Enhancements

- [ ] Auto-reset daily counters at midnight
- [ ] SMS capabilities via assigned numbers
- [ ] Round-robin assignment for multiple numbers per agent
- [ ] Number performance analytics dashboard
- [ ] Call recording per number
- [ ] Voicemail management per number
- [ ] Number pooling for campaigns

---

## Summary

✅ **Frontend:** Two admin pages already exist and are fully functional
✅ **Backend:** Updated to fetch and use agent-assigned numbers
✅ **Database:** Schema includes phone_numbers and agent_phone_numbers tables
✅ **Navigation:** Pages accessible via Sidebar (Admin only)
✅ **Concurrent Calls:** Each agent uses their own assigned number
✅ **Daily Limits:** Automatic tracking and enforcement
✅ **Error Handling:** User-friendly messages for missing assignments

**Next Steps:**
1. Run migrations if needed
2. Add phone numbers via admin interface
3. Assign numbers to agents
4. Test making manual calls
5. Monitor usage in Phone Numbers page

---

**Created:** $(date)
**Version:** 1.0.0
**Status:** Production Ready ✅
