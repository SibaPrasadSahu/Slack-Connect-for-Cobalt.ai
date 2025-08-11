💬 Slack Message Scheduler
A full-stack web app that lets you connect your Slack workspace, send instant 
messages, and schedule messages for the future — even after signing out.

🛠 TECH STACK

- 🎨 Frontend: React, Vite, Axios
- 🖥 Backend: Node.js, Express, Mongoose, JWT
- 💾 Database: MongoDB (Atlas or local)
- ☁ Deployment: Vercel (frontend), Render (backend), 
MongoDB Atlas (database)



📥SETUP INSTRUCTIONS

1️⃣PREREQUISITES:
Make sure you have:

- 📦 Node.js (>= 18.x) → Download from nodejs.org
- 📦 npm (comes with Node.js)
- 🗄 MongoDB: Install MongoDB Community Edition 
(https://www.mongodb.com/try/download/community)

verify installation using:
>> node -v && npm -v

A successful installation would output version of 
node and npm.

Now, after installing node, proceed to the following.

2️⃣ CLONE THE REPOSITORY
Open terminal and clone the repository:
- git clone https://github.com/SibaPrasadSahu/Slack-Connect-for-Cobalt.ai.git
- cd Slack-Connect-for-Cobalt.ai

3️⃣ SLACK APP SETUP

1. Go to Slack API - Your Apps
2. Click Create New App → From Scratch
3. Now under OAuth & Permissions:

a. Put the Redirect URL (for local dev) as:
http://localhost:4000/api/auth/callback

b. Set up Scopes (User Token):
chat:write
chat:write.public
channels:read
channels:history
groups:read

4. Install the app to your workspace.

5. Copy:
- Client ID
- Client Secret
Both will these be then put to the .env file

4️⃣ BACKEND SETUP

1. Open terminal and go into backend folder:
>> cd backend
>> npm install

This will install all the dependencies.

2. Make the .env file in /backend:

- PORT=4000
- MONGO_URI=mongodb://localhost:27017/slack_scheduler
- JWT_SECRET=replace_with_a_long_random_string
- SLACK_CLIENT_ID=your_slack_client_id
- SLACK_CLIENT_SECRET=your_slack_client_secret
- SLACK_SIGNING_SECRET=your_slack_signing_secret
- SLACK_REDIRECT_URI=http://localhost:4000/api/auth/callback
- FRONTEND_ORIGIN=http://localhost:5173
- SCHEDULER_POLL_MS=3000

Next, delete the .env.example file as you made the environment variables.

3. Start Backend:
>> npm run dev

Leave the current terminal as it is and open a new terminal.
In this current terminal backend is running.

5️⃣ FRONTEND SETUP

1. Go into the front end folder
>> npm install

2. Create .env file in the front end folder.
Next, add VITE_API_BASE=http://localhost:4000

After that delte the .env.example file as you've added the .env file.
3. Start Front End:
npm run dev

Leave this terminal running. This is where the front end 
is hosted.

6️⃣ RUNNING THE APPLICATION

Open a new tab in browser and paste the link for front end:
http://localhost:5173

Now, you have slack scheduler running.
____________________________________________________________________________________

🏗 Architectural Overview

The app uses Slack OAuth to let users securely connect their workspace. Once authorized, 
the backend stores a workspace-specific token in MongoDB and sets a JWT 
session cookie so the frontend can make authenticated API calls.

For token management, the backend retrieves the token from the
database for each request, refreshes it if needed, and keeps 
it hidden from the client for security.

Scheduled messages are stored in MongoDB with their send time and status. A backend scheduler 
runs periodically, picks due messages, sends them to Slack, and updates their 
status (with retries if needed). Sent messages include a Slack permalink so users can verify delivery.

🔐 OAuth Flow
   - 🖱 User clicks “Sign in with Slack” → Redirects to Slack OAuth page
   - 📩 Slack sends an authorization code to backend endpoint: /api/auth/callback
   - 🔄 Backend exchanges the code for an access token & stores it securely in MongoDB
   - 🍪 Sets a JWT session cookie in the browser for authentication

🔑 Token Management
   - 🗂 Tokens stored per teamId in the TokenModel collection
   - 🔍 Each request reads the JWT from the cookie to find the user/team
   - 💬 Messages are sent using that team’s Slack token

⏰ Scheduled Task Handling
   - 🔄 Scheduler polls the database every SCHEDULER_POLL_MS
   - 📬 Picks all due messages and sends them via the Slack API
   - ✅ Updates status to "sent" if delivered
   - ♻ If failed — retries with backoff until sent successfully

____________________________________________________________________________________

🧠 Challenges & Learnings

   - Deploying the backend was initially challenging due to confusion 
   around configuring environment variables. I experimented with 
   different combinations to identify the most appropriate and 
   functional setup.

   - The next hurdle was connecting the database to the backend. I 
   learned that only trusted IPs can access the database, so I updated 
   MongoDB’s settings to include the backend’s IP addresses, which 
   resolved the issue.
