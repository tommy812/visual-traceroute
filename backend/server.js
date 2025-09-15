const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
require('dotenv').config();

const { testConnection } = require('./config/database');
const tracerouteRoutes = require('./routes/traceroute');
const ipgeoRoutes = require('./routes/ipgeo');
const peeringdbRoutes = require('./routes/peeringdb');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests',
    details: 'Please try again later'
  }
});
app.use(limiter);

// CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
  timestamp: (require('luxon').DateTime).now().setZone('Europe/London').toISO(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API routes
app.use('/api/traceroute', tracerouteRoutes);
app.use('/api/ipgeo', ipgeoRoutes);
app.use('/api/peeringdb', peeringdbRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Traceroute Visualization API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      traceroute: '/api/traceroute',
      documentation: 'Coming soon...'
    }
  });
});

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    // Test database connection
    console.log('🔄 Testing database connection...');
    const dbConnected = await testConnection();
    
    if (!dbConnected) {
      console.error('❌ Database connection failed. Please check your Supabase configuration.');
      process.exit(1);
    }

    // Start the server
    app.listen(PORT, async () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🌐 CORS enabled for: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
      console.log(`📚 API Documentation: http://localhost:${PORT}/`);
      console.log('✅ Server started successfully');

      // Optional automatic prewarm
      if (process.env.PREWARM_ON_START === '1') {
        try {
          const tracerouteController = require('./controllers/tracerouteController');
          const lookback = parseInt(process.env.PREWARM_LOOKBACK_MINUTES || '60', 10);
          const fastest = process.env.PREWARM_FASTEST === '1';
          const shortest = process.env.PREWARM_SHORTEST === '1';
          console.log(`🧊 Prewarming aggregated cache (lookback=${lookback}m, fastest=${fastest}, shortest=${shortest})...`);
          const r = await tracerouteController.prewarmAggregatedPaths({ lookbackMinutes: lookback, fastest, shortest });
          if (r.error) console.warn('Prewarm failed:', r.error); else console.log('✅ Prewarm done:', r);
        } catch (e) {
          console.warn('Prewarm exception:', e.message);
        }
      }
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('🔄 SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🔄 SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

startServer(); 