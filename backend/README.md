# Traceroute Visualization Backend

A RESTful API backend for the traceroute network visualization application, built with Node.js, Express, and Supabase.

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Supabase account and project

### Installation

1. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment Setup:**
   ```bash
   cp .env.example .env
   ```

4. **Configure your `.env` file:**
   ```env
   # Supabase Configuration
   SUPABASE_URL=https://your-project-ref.supabase.co
   SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

   # Server Configuration
   PORT=3001
   NODE_ENV=development

   # CORS Configuration
   FRONTEND_URL=http://localhost:3000
   ```

5. **Start the development server:**
   ```bash
   npm run dev
   ```

The server will start on `http://localhost:3001`

## 📊 Database Schema

The backend works with the following Supabase tables:

```sql
-- Traceroute methods table
CREATE TABLE traceroute_methods (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  version TEXT,
  description TEXT
);

-- Trace runs table
CREATE TABLE trace_runs (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL,
  destination TEXT NOT NULL,
  method_id INTEGER REFERENCES traceroute_methods(id),
  raw_output TEXT,
  parameters JSONB
);

-- Hops table
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
```

## 🛠 API Endpoints

### Base URL: `http://localhost:3001/api/traceroute`

#### Health Check
- **GET** `/health` - Check API health status

#### Traceroute Methods
- **GET** `/methods` - Get all traceroute methods

#### Trace Runs
- **GET** `/runs` - Get all trace runs with filtering
  - Query params: `destination`, `method_id`, `start_date`, `end_date`, `limit`, `offset`
- **GET** `/runs/:id` - Get specific trace run with hops

#### Hops
- **GET** `/runs/:trace_run_id/hops` - Get hops for a specific trace run

#### Network Data (Main Frontend Endpoint)
- **GET** `/network-data` - Get aggregated data for visualization
  - Query params: `destinations`, `start_date`, `end_date`, `method_id`

#### Utilities
- **GET** `/destinations` - Get unique destination list

## 📝 API Response Format

All endpoints return JSON in this format:

```json
{
  "success": true|false,
  "data": [...],
  "count": number,
  "error": "error message (if success: false)",
  "details": "detailed error info (if error)"
}
```

## 🔧 Development

### Available Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm test` - Run tests (not implemented yet)

### Project Structure

```
backend/
├── config/
│   └── database.js          # Supabase configuration
├── controllers/
│   └── tracerouteController.js  # Business logic
├── middleware/
│   └── errorHandler.js      # Error handling
├── routes/
│   └── traceroute.js        # API routes
├── .env.example             # Environment template
├── package.json
├── server.js                # Main server file
└── README.md
```

## 🔒 Security Features

- **Helmet.js** - Security headers
- **Rate Limiting** - 1000 requests per 15 minutes per IP
- **CORS** - Configured for frontend URL
- **Environment Variables** - Sensitive data protection
- **Input Validation** - Query parameter validation

## 🚨 Error Handling

The API includes comprehensive error handling:

- Database connection errors
- Supabase-specific errors
- Validation errors
- 404 Not Found errors
- Rate limiting errors

## 📈 Next Steps

## 🗃 Caching Strategy

The backend ships with two lightweight in-memory caches:

1. 30‑day raw trace run slice cache (`cache/networkDataCache.js`)
2. Aggregated paths query cache (`cache/aggregatedCache.js`)

These improve latency and reduce database pressure. However, the frontend also implements a cache (see `frontend/src/services/networkDataCache.js` & `dataRepository.js`) that supports stale‑while‑revalidate behavior and background prefetch of the last 30 days.

### Frontend‑Only Mode

If you want all caching to occur exclusively in the browser, set:

```
FRONTEND_CACHE_ONLY=1
```

When this flag is enabled:
- Backend caches become no-ops (they never store or return entries)
- Controllers continue to call the same cache APIs without modification
- Logging with `CACHE_DEBUG=1` will indicate that caches are disabled

This mode is useful if you deploy multiple stateless backend instances without a shared cache layer (e.g. Redis) and prefer to avoid inconsistent cache behavior.

### Debugging

Enable verbose logging of cache actions:

```
CACHE_DEBUG=1
```

### Future Improvements
To add a distributed cache later, you can replace the in-memory classes with Redis (keeping the same method signatures) without touching controller logic.

1. **Data Processing**: Implement data transformation from database format to frontend format
2. **Caching**: Add Redis caching for better performance
3. **Authentication**: Add user authentication if needed
4. **Testing**: Add unit and integration tests
5. **Documentation**: Add Swagger/OpenAPI documentation
6. **Monitoring**: Add logging and monitoring

## 🤝 Contributing

1. Follow the existing code style
2. Add proper error handling
3. Update documentation
4. Test your changes

## 📞 Support

If you encounter any issues:

1. Check the server logs
2. Verify your Supabase configuration
3. Ensure all environment variables are set correctly
4. Check the database connection

For more help, please refer to the main project documentation. 