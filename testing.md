# Complete Web Interface Testing Plan

## Prerequisites

### 1. Setup & Launch

- Start Docker containers: `docker-compose up -d`
- Seed sample data: `docker exec -it ai_dialer_server node server/scripts/seed-sample-data.js`
- Access frontend: `http://localhost:3001`
- Backend API: `http://localhost:3000`

### 2. Default Test Credentials

- Admin: `admin@demo.com` / `password123`
- Create additional test users for role testing

## Testing Sections

### A. Authentication & Authorization

#### Login & Registration

1. **Register New Organization**

- Navigate to `/register`
- Fill: Organization Name, Email, Password, First/Last Name
- Verify: Redirects to Executive Dashboard (first user is admin)
- Check: Token stored in localStorage

2. **Login with Existing User**

- Navigate to `/login`
- Use: `admin@demo.com` / `password123`
- Verify: Redirects to role-specific dashboard
- Check: Sidebar shows role-appropriate menu items

3. **Role-Based Redirect Testing**

- Login as Admin → Redirects to `/executive`
- Login as Manager → Redirects to `/manager`
- Login as Agent → Redirects to `/agent`
- Login as Data Uploader → Redirects to `/data-uploader`

4. **Protected Routes**

- Logout and try accessing `/dashboard` → Redirects to `/login`
- Access routes without permission → Should block access

#### Logout

- Click user menu → Logout
- Verify: Redirects to `/login`
- Check: Token removed from localStorage

### B. User Management (Admin Only)

1. **View Users** (`/users`)

- Check: Stats cards show user counts by role
- Verify: Table displays all organization users

2. **Create User**

- Click "Add User" button
- Fill: Email, First/Last Name, Role (dropdown), Daily Call Target, Password
- Submit form
- Verify: New user appears in table with correct role badge

3. **Edit User**

- Click edit icon on any user
- Modify: First Name, Role, Daily Call Target
- Submit form
- Verify: Changes reflected in table

4. **Delete User**

- Click delete icon
- Confirm deletion
- Verify: User marked as inactive

5. **Role Assignment**

- Create users with each role: admin, manager, agent, data_uploader
- Login as each user
- Verify: Correct dashboard and navigation access

### C. Dashboard Testing

#### Executive Dashboard (`/executive` - Admin Only)

1. Check: Revenue Impact, Cost Efficiency, ROI, CSAT metrics
2. Verify: Charts render correctly
3. Check: Real-time updates via WebSocket

#### Manager Dashboard (`/manager` - Manager Only)

1. Check: Total Calls, Completed Calls, Conversion Rate, Active Agents
2. Verify: Team Performance section shows agent list
3. Check: Live Calls section (if calls active)
4. Verify: Recent Activity feed

#### Agent Dashboard (`/agent` - Agent Only)

1. Check: Personal call statistics
2. Verify: Assigned leads display (Pending/Completed tabs)
3. Test: Manual calling interface
4. Check: Recent call history
5. Verify: Daily target progress

#### Data Uploader Dashboard (`/data-uploader`)

1. Check: Upload statistics (Total Uploads, Contacts, Success Rate)
2. Verify: Recent uploads list with status badges
3. Check: Upload guidelines display

### D. Campaign Management (`/campaigns`)

1. **View Campaigns**

- Check: Stats cards (Total, Active, Paused, Completed)
- Verify: Campaign list with status badges
- Check: Search and filter functionality

2. **Create Campaign**

- Click "Create Campaign" button
- Fill: Name, Type (sales/recruitment/support/survey), Voice Persona
- Toggle: Auto Retry, Best Time Calling, Emotion Detection
- Submit form
- Verify: New campaign appears in list

3. **Campaign Controls**

- Test: Start campaign button → Status changes to "active"
- Test: Pause campaign → Status changes to "paused"
- Test: Stop campaign → Status changes to "completed"
- Verify: Real-time status updates via WebSocket

4. **Edit Campaign**

- Click edit button on campaign
- Modify campaign details
- Submit form
- Verify: Changes reflected

5. **Delete Campaign**

- Click delete button
- Confirm deletion
- Verify: Campaign removed from list

### E. Contact Management (`/contacts`)

1. **View Contacts**

- Check: Stats cards (Total, Active, Called, Converted)
- Verify: Contact list displays with all fields
- Check: Search by name/email/phone

2. **Create Contact**

- Click "Add Contact" button
- Fill: First/Last Name, Phone, Email, Company, Title, Campaign
- Submit form
- Verify: New contact in list

3. **Bulk Import Contacts**

- Click "Upload Contacts" button
- Select CSV file (format: first_name, last_name, phone, email, company, title)
- Upload file
- Verify: Success message shows number imported
- Check: New contacts appear in list

4. **Edit Contact**

- Click edit icon
- Modify contact details
- Submit form
- Verify: Changes saved

5. **Delete Contact**

- Select contact(s) using checkboxes
- Click delete button
- Confirm deletion
- Verify: Contact(s) removed

6. **Bulk Actions**

- Select multiple contacts
- Test bulk assignment to campaign
- Verify: Contacts updated

### F. Lead Assignment (`/lead-assignment` - Admin/Manager)

1. **View Assignments**

- Check: Assignment statistics
- Verify: Assignment list with agent names
- Check: Filter by campaign, status

2. **Manual Assignment**

- Click "Assign Leads" button
- Select contacts from list
- Choose agent from dropdown
- Submit assignment
- Verify: Leads assigned to agent
- Check: WebSocket notification sent

3. **Bulk Assignment**

- Select multiple contacts
- Assign to agent
- Verify: All contacts assigned

4. **Lead Reuse Settings**

- Click "Reuse Settings" button
- Configure: Enable/Disable, Delay Hours, Max Attempts
- Save settings
- Verify: Settings saved

5. **Unpicked Leads**

- View unpicked leads section
- Trigger manual reuse
- Verify: Leads reassigned

### G. Manual Calling (Agent Dashboard)

1. **View Assigned Leads**

- Navigate to `/agent`
- Check: Pending leads list
- Verify: Lead details display

2. **Initiate Manual Call**

- Click "Call" button on a lead
- Verify: Softphone interface opens
- Check: Call status updates

3. **Log Call Outcome**

- During/after call, select outcome (interested/not_interested/callback/no_answer/voicemail)
- Add notes
- Submit log
- Verify: Lead moves to "Completed" tab
- Check: Call logged in database

4. **Real-time Call Updates**

- During call, verify: Duration timer updates
- Check: WebSocket updates for call status

### H. Call History (`/calls`)

1. **View Calls**

- Check: Stats cards (Total, Answered, Missed, Avg Duration)
- Verify: Call list with outcome badges
- Check: Filter by campaign, outcome, emotion, date range

2. **View Call Details**

- Click "View" button on any call
- Verify modal shows:
 - Call metadata (duration, outcome, timestamp)
 - Full transcript
 - AI analysis (intent, emotions, sentiment)
 - Emotion timeline
 - Tags and objections

3. **Download Transcript**

- Click download button
- Verify: Transcript file downloads

4. **Search Calls**

- Use search bar to find specific calls
- Verify: Results filtered correctly

### I. Live Monitor (`/live-monitor` - Admin/Manager/Agent)

1. **View Live Calls**

- Check: Active calls display in real-time (refreshes every 5 seconds)
- Verify: Call cards show contact name, agent, duration

2. **Monitor Specific Call**

- Click on a live call
- Verify: Real-time conversation history updates
- Check: Emotion indicators display
- Verify: Knowledge suggestions appear

3. **Conversation Context**

- Check: Detected intent displays
- Verify: Current emotion state shows
- Check: Sentiment score updates

4. **Knowledge Suggestions**

- Verify: Relevant knowledge base entries appear
- Check: Suggestions based on conversation context

### J. AI Intelligence (`/ai-intelligence`)

1. **Emotion Analytics**

- Check: Emotion distribution chart
- Verify: Top emotions list with percentages
- Check: Date range filter (7d, 30d, custom)

2. **Intent Analytics**

- Verify: Intent distribution chart
- Check: Intent types (purchase, objection, question, interested, not_interested)
- Check: Confidence scores display

3. **Emotion Heatmap**

- Verify: Heatmap renders with time/emotion data
- Check: Hover shows detailed values
- Verify: Date filtering works

4. **Call Analysis**

- Click on any analyzed call
- Verify modal shows:
 - Emotion journey timeline
 - Detected intents with confidence
 - Auto-generated tags
 - Objections detected
 - Highlights
 - Empathy score (for agent calls)

5. **Agent Empathy Scores**

- Check: Agent empathy leaderboard
- Verify: Scores calculated correctly
- Check: Filter by date range

6. **Emotion Journey**

- View emotion journey for specific call
- Verify: Timeline shows emotion changes
- Check: Volatility indicators

### K. Analytics (`/analytics`)

1. **Dashboard Analytics**

- Check: Total Calls, Conversion Rate, Avg Call Duration, Total Revenue
- Verify: Date range selector works (7d, 30d, custom)
- Check: Charts render (Line chart, Pie chart)

2. **Agent Performance**

- Select agent from dropdown
- Verify: Agent-specific metrics display
- Check: Call statistics, outcomes, performance trends

3. **Team Leaderboard**

- Verify: Agent ranking by calls/conversions
- Check: Performance indicators
- Verify: Real-time updates

4. **Conversion Funnel**

- Check: Funnel visualization
- Verify: Stages (Total → Answered → Interested → Converted)
- Check: Percentages calculated correctly

### L. Voice Studio (`/voice-studio` - Admin/Manager)

1. **View Voice Personas**

- Check: Available voice personas list
- Verify: Voice attributes (accent, tone, emotion range)

2. **Play Voice Samples**

- Click play button on voice persona
- Verify: Audio sample plays

3. **Clone Custom Voice**

- Click "Clone Custom Voice" button
- Verify: Modal/form opens for voice cloning

### M. Knowledge Base (`/knowledge-base`)

1. **View Knowledge Entries**

- Check: Entry list displays
- Verify: Categories display
- Check: Search functionality

2. **Create Knowledge Entry**

- Click "Add Entry" button
- Fill: Question, Answer, Category, Tags
- Submit form
- Verify: New entry appears in list

3. **Edit Knowledge Entry**

- Click edit icon
- Modify entry details
- Submit form
- Verify: Changes saved

4. **Delete Knowledge Entry**

- Click delete icon
- Confirm deletion
- Verify: Entry removed

5. **Search Knowledge Base**

- Use search bar
- Verify: Results filtered by keyword
- Check: Category filtering

6. **Test in Live Calls**

- During live call monitoring
- Verify: Relevant knowledge entries suggested
- Check: Match based on conversation context

### N. Scripts (`/scripts`)

1. **View Scripts**

- Check: Script list displays
- Verify: Filter by type (opening, objection_handling, closing, general)
- Check: Search by name/content

2. **Create Script**

- Click "Create Script" button
- Fill: Name, Type, Content, Variables
- Submit form
- Verify: New script in list

3. **Edit Script**

- Click edit icon
- Modify script content
- Submit form
- Verify: Changes saved

4. **Delete Script**

- Click delete icon
- Confirm deletion
- Verify: Script removed

5. **Test Script Variables**

- Create script with variables (e.g., {first_name}, {company})
- Verify: Variables display correctly

### O. Compliance (`/compliance` - Admin/Manager)

1. **DNC Registry**

- Check: DNC records list
- Verify: Phone numbers display

2. **Add to DNC**

- Click "Add to DNC" button
- Enter: Phone number, Reason
- Submit form
- Verify: Number added to registry
- Check: System won't call DNC numbers

3. **Remove from DNC**

- Click remove icon on DNC record
- Confirm removal
- Verify: Number removed

4. **Compliance Metrics**

- Check: Total DNC Records, Compliance Rate
- Verify: Metrics calculated correctly

5. **Audit Logs**

- Verify: Audit log list displays
- Check: Log entries show action, user, timestamp
- Verify: Filter by date/action type

### P. Billing (`/billing` - Admin/Manager)

1. **View Credit Balance**

- Check: Current credit balance displays
- Verify: Credit usage chart

2. **Credit Transactions**

- Verify: Transaction history list
- Check: Transaction types (purchase, consumption, refund)
- Check: Amounts and timestamps

3. **Purchase Credits**

- Click "Purchase Credits" button
- Enter: Amount, Payment method
- Submit purchase
- Verify: Credits added to balance
- Check: Transaction logged

4. **Usage Analytics**

- Check: Credit consumption by campaign
- Verify: Charts display usage trends
- Check: Date range filtering

5. **Credit Alerts**

- Verify: Low credit warnings display
- Check: Alert thresholds configurable

### Q. Settings (`/settings`)

1. **Profile Settings**

- View: User profile information
- Edit: First/Last Name, Email
- Submit changes
- Verify: Profile updated

2. **Change Password**

- Enter: Current Password, New Password, Confirm Password
- Submit form
- Verify: Password changed successfully
- Test: Login with new password

3. **Preferences**

- Configure: Voice Persona, Time Zone, Calling Hours
- Toggle: Notifications (Email, Call Alerts, Campaign Updates)
- Save preferences
- Verify: Settings saved

4. **Organization Settings** (Admin only)

- Edit: Organization name, domain
- Configure: Features, timezone
- Save settings
- Verify: Changes applied

### R. Real-time Features (WebSocket)

1. **Live Call Updates**

- Open Live Monitor page
- Start a call (manually or automated)
- Verify: Call appears in real-time without refresh

2. **Lead Assignment Notifications**

- Have manager assign lead to agent
- Agent dashboard should show notification
- Verify: New lead appears without refresh

3. **Campaign Status Updates**

- Start/pause campaign
- Verify: Status updates across all connected clients
- Check: No page refresh needed

4. **Call Completion Events**

- Complete a call
- Verify: Dashboard stats update automatically
- Check: Call appears in call history immediately

### S. Data Uploader Features

1. **Upload Contacts** (`/data-uploader`)

- Click "Upload Contacts" button
- Select CSV file
- Upload file
- Verify: Success message with import count
- Check: Upload statistics updated

2. **View Upload History**

- Check: Recent uploads list
- Verify: Status badges (success/error)
- Check: Import counts display

3. **Upload Guidelines**

- Verify: Guidelines display required/optional columns
- Check: File size limits shown

### T. Error Handling & Edge Cases

1. **Invalid Form Inputs**

- Try submitting forms with missing required fields
- Verify: Validation errors display
- Check: User-friendly error messages

2. **Network Errors**

- Simulate network failure (disconnect internet)
- Verify: Error toast notifications appear
- Check: Loading states handle correctly

3. **Unauthorized Access**

- Try accessing admin routes as agent
- Verify: Access denied or redirect
- Check: Appropriate error message

4. **Token Expiration**

- Wait for token to expire (or manually delete)
- Verify: Redirects to login
- Check: Re-login works correctly

5. **Empty States**

- View pages with no data
- Verify: Empty state messages display
- Check: Call-to-action buttons present

### U. Performance Testing

1. **Large Datasets**

- Import 1000+ contacts
- Verify: List pagination works
- Check: Search/filter performance

2. **Concurrent Users**

- Login from multiple browsers/devices
- Verify: All receive real-time updates
- Check: No conflicts in data

3. **Page Load Times**

- Measure initial load time
- Check: Lazy loading for images/charts
- Verify: Loading spinners during data fetch

## Testing Checklist Summary

- [ ] Authentication (Login, Register, Logout, Protected Routes)
- [ ] User Management (Create, Edit, Delete, Role Assignment)
- [ ] All Dashboards (Executive, Manager, Agent, Data Uploader)
- [ ] Campaigns (CRUD operations, Status controls)
- [ ] Contacts (CRUD, Bulk Import, Search/Filter)
- [ ] Lead Assignment (Manual, Bulk, Reuse Settings)
- [ ] Manual Calling (Initiate, Log Outcome, Softphone)
- [ ] Call History (View, Details, Transcript, AI Analysis)
- [ ] Live Monitor (Real-time updates, Conversation tracking)
- [ ] AI Intelligence (Emotions, Intents, Heatmap, Empathy)
- [ ] Analytics (Dashboard, Agent Performance, Leaderboard)
- [ ] Voice Studio (Voice Personas, Samples)
- [ ] Knowledge Base (CRUD, Search, Live Suggestions)
- [ ] Scripts (CRUD, Variables, Types)
- [ ] Compliance (DNC Registry, Audit Logs, Metrics)
- [ ] Billing (Credits, Transactions, Purchase, Analytics)
- [ ] Settings (Profile, Password, Preferences)
- [ ] Real-time Features (WebSocket updates across all modules)
- [ ] Data Upload (CSV import, History, Guidelines)
- [ ] Error Handling (Validation, Network, Authorization)
- [ ] Performance (Large datasets, Concurrent users)

## Test Data

Use `server/scripts/seed-sample-data.js` to populate:

- 1 Demo Organization
- 1 Admin User (admin@demo.com / password123)
- 2 Sample Campaigns (Q4 Sales Outreach, Tech Recruitment)
- 5 Sample Contacts
- Sample Knowledge Base Entries

Create additional test users via User Management UI for role testing.
