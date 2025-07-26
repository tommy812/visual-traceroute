# 🚀 Backend Setup Guide

## Step 1: Supabase Database Setup

### 1.1 Create Supabase Project
1. Go to [supabase.com](https://supabase.com) and sign up/sign in
2. Create a new project
3. Wait for the project to initialize

### 1.2 Create Database Tables
Go to the SQL Editor in your Supabase dashboard and run these commands:

```sql
-- Create traceroute methods table
CREATE TABLE traceroute_methods (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  version TEXT,
  description TEXT
);

-- Create trace runs table
CREATE TABLE trace_runs (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL,
  destination TEXT NOT NULL,
  method_id INTEGER REFERENCES traceroute_methods(id),
  raw_output TEXT,
  parameters JSONB
);

-- Create hops table
CREATE TABLE hops (
  id SERIAL PRIMARY KEY,
  trace_run_id INTEGER REFERENCES trace_runs(id) ON DELETE CASCADE,
  hop_number INTEGER NOT NULL,
  ip TEXT,
  hostname TEXT,
  rtt1 DOUBLE PRECISION,
  rtt2 DOUBLE PRECISION,
  rtt3 DOUBLE PRECISION,
  extra JSONB
);

-- Insert sample traceroute method
INSERT INTO traceroute_methods (name, version, description) VALUES 
('traceroute', '1.0', 'Standard traceroute tool'),
('mtr', '0.95', 'My traceroute - network diagnostic tool'),
('paris-traceroute', '0.93', 'Paris traceroute with MPLS support');
```

### 1.3 Get API Keys
1. In your Supabase project dashboard, go to **Settings** → **API**
2. Copy the following values:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon public key** (starts with `eyJhbGciOiJIUzI1NiIs...`)
   - **service_role secret key** (starts with `eyJhbGciOiJIUzI1NiIs...`)

## Step 2: Backend Configuration

### 2.1 Environment Setup
1. Copy the environment template:
   ```bash
   cp env.example .env
   ```

2. Edit the `.env` file with your Supabase credentials:
   ```env
   # Supabase Configuration
   SUPABASE_URL=https://your-project-ref.supabase.co
   SUPABASE_ANON_KEY=your_anon_key_here
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

   # Server Configuration
   PORT=3001
   NODE_ENV=development

   # CORS Configuration
   FRONTEND_URL=http://localhost:3000
   ```

### 2.2 Start the Backend
```bash
npm run dev
```

The server will start on `http://localhost:3001`

## Step 3: Test the Setup

### 3.1 Check Server Health
Visit: `http://localhost:3001/health`

You should see:
```json
{
  "success": true,
  "message": "Server is running",
  "timestamp": "2025-01-XX...",
  "environment": "development"
}
```

### 3.2 Test Database Connection
Visit: `http://localhost:3001/api/traceroute/health`

You should see:
```json
{
  "success": true,
  "message": "Traceroute controller is healthy",
  "database_status": "connected"
}
```

### 3.3 Test API Endpoints
1. **Methods**: `http://localhost:3001/api/traceroute/methods`
2. **Destinations**: `http://localhost:3001/api/traceroute/destinations`
3. **Network Data**: `http://localhost:3001/api/traceroute/network-data`

## Step 4: Add Sample Data (Optional)

To test with sample data, run this SQL in your Supabase SQL Editor:

```sql
-- Insert sample trace runs
INSERT INTO trace_runs (timestamp, destination, method_id) VALUES 
('2025-01-11 12:00:00+00', 'google.com', 1),
('2025-01-11 12:01:00+00', 'facebook.com', 1),
('2025-01-11 12:02:00+00', 'github.com', 1);

-- Insert sample hops for google.com trace (trace_run_id = 1)
INSERT INTO hops (trace_run_id, hop_number, ip, hostname, rtt1, rtt2, rtt3) VALUES 
(1, 1, '192.168.1.1', 'router.local', 1.2, 1.1, 1.3),
(1, 2, '10.0.0.1', 'gateway.isp.com', 15.4, 15.2, 15.6),
(1, 3, '8.8.8.8', 'dns.google', 25.1, 24.9, 25.3);

-- Insert sample hops for facebook.com trace (trace_run_id = 2)
INSERT INTO hops (trace_run_id, hop_number, ip, hostname, rtt1, rtt2, rtt3) VALUES 
(2, 1, '192.168.1.1', 'router.local', 1.1, 1.2, 1.0),
(2, 2, '10.0.0.1', 'gateway.isp.com', 15.1, 15.3, 15.0),
(2, 3, '157.240.1.1', 'facebook-edge.net', 28.2, 28.5, 28.1);

-- Insert sample hops for github.com trace (trace_run_id = 3)
INSERT INTO hops (trace_run_id, hop_number, ip, hostname, rtt1, rtt2, rtt3) VALUES 
(3, 1, '192.168.1.1', 'router.local', 1.0, 1.1, 1.2),
(3, 2, '10.0.0.1', 'gateway.isp.com', 15.0, 15.1, 15.2),
(3, 3, '140.82.112.3', 'github.com', 18.5, 18.3, 18.7);
```

## Step 5: Troubleshooting

### Common Issues:

1. **"Database connection failed"**
   - Check your SUPABASE_URL and SUPABASE_ANON_KEY
   - Ensure your Supabase project is active
   - Verify the tables were created correctly

2. **"Port already in use"**
   - Change the PORT in your .env file
   - Or stop any process using port 3001

3. **CORS errors**
   - Verify FRONTEND_URL in .env matches your React app URL
   - Check that the frontend is running on the specified port

4. **"Module not found" errors**
   - Run `npm install` again
   - Delete `node_modules` and `package-lock.json`, then run `npm install`

### Logs
Check the console output when starting the server. It will show:
- ✅ Database connection status
- 🚀 Server startup confirmation
- ❌ Any errors with details

## Next Steps

After the backend is running successfully:
1. The APIs are ready to serve data
2. In the next step, we'll connect the frontend to these APIs
3. We'll transform the database data into the format your frontend expects

## 📚 API Documentation

Once running, visit `http://localhost:3001/` for a list of all available endpoints. 