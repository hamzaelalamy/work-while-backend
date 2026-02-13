// src/app.js - Complete Backend Application (Rate Limiting Disabled for Testing)
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

// Import configurations et utilitaires
const { connectDB } = require('./config/database');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');

// Import routes
const authRoutes = require('./routes/auth');
const jobRoutes = require('./routes/jobs');
const userRoutes = require('./routes/users');
const applicationRoutes = require('./routes/applications');
const companyRoutes = require('./routes/companies');
const scrapingRoutes = require('./routes/scraping');
const analyticsRoutes = require('./routes/analytics');
const adminRoutes = require('./routes/adminRoutes');
const cvRoutes = require('./routes/cv');

const app = express();

// =====================================
// DATABASE CONNECTION
// =====================================
connectDB();

// =====================================
// HOURLY SCRAPING SCHEDULER
// =====================================
const { startScrapingScheduler } = require('./services/scraping/scrapingScheduler');
startScrapingScheduler();

// =====================================
// TRUST PROXY CONFIGURATION
// =====================================
// Nécessaire pour ngrok et les proxies inverses
app.set('trust proxy', 1);

// =====================================
// ENHANCED CORS CONFIGURATION - COMPLETE FIX
// =====================================
const corsOptions = {
  origin: function (origin, callback) {
    console.log(`\n🔍 CORS Check - Origin: "${origin || 'NO ORIGIN'}"`);

    // Always allow requests with no origin (Postman, mobile apps, etc.)
    if (!origin) {
      console.log('✅ CORS: No origin - ALLOWED');
      return callback(null, true);
    }

    // Define your allowed origins - EXACT MATCHES
    const allowedOrigins = [
      // Your Vercel deployments
      'https://trouvetonjob.vercel.app',
      'https://workwhile-front-d2sc.vercel.app',

      // Local development
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:5174',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5174',
    ];

    // Define patterns for dynamic domains
    const allowedPatterns = [
      /^https:\/\/.*\.vercel\.app$/,
      /^https:\/\/.*\.netlify\.app$/,
      /^https:\/\/.*\.ngrok\.io$/,
      /^https:\/\/.*\.ngrok-free\.app$/,
      /^https:\/\/.*\.ngrok\.app$/,
      /^https:\/\/.*\.ngrok\.dev$/,
    ];

    // Check exact matches first
    if (allowedOrigins.includes(origin)) {
      console.log(`✅ CORS: "${origin}" ALLOWED (exact match)`);
      return callback(null, true);
    }

    // Check pattern matches
    const matchedPattern = allowedPatterns.find(pattern => pattern.test(origin));
    if (matchedPattern) {
      console.log(`✅ CORS: "${origin}" ALLOWED (pattern: ${matchedPattern})`);
      return callback(null, true);
    }

    // Development mode - be permissive
    if (process.env.NODE_ENV === 'development') {
      console.log(`🟡 CORS: Development mode - allowing "${origin}"`);
      return callback(null, true);
    }

    // Reject the origin
    console.log(`❌ CORS: "${origin}" REJECTED`);
    console.log(`   Available origins: ${allowedOrigins.join(', ')}`);
    return callback(null, false); // Don't throw error, just return false
  },

  credentials: true,

  methods: [
    'GET',
    'POST',
    'PUT',
    'DELETE',
    'PATCH',
    'OPTIONS',
    'HEAD'
  ],

  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-Auth-Token',
    'Cache-Control',
    'Pragma',
    'ngrok-skip-browser-warning',
    'X-Forwarded-For',
    'X-Real-IP',
    'User-Agent'
  ],

  exposedHeaders: [
    'X-Auth-Token',
    'X-Total-Count',
    'X-Request-ID',
    'Access-Control-Allow-Origin'
  ],

  optionsSuccessStatus: 200,
  preflightContinue: false,
  maxAge: 86400 // 24 hours preflight cache
};

// Apply CORS middleware FIRST
app.use(cors(corsOptions));

// =====================================
// ENHANCED OPTIONS HANDLER FOR DEBUGGING
// =====================================
app.use('*', (req, res, next) => {
  if (req.method === 'OPTIONS') {
    console.log(`\n🚁 OPTIONS REQUEST DEBUG:`);
    console.log(`   Path: ${req.originalUrl}`);
    console.log(`   Origin: ${req.headers.origin || 'NO ORIGIN'}`);
    console.log(`   Method: ${req.headers['access-control-request-method'] || 'NONE'}`);
    console.log(`   Headers: ${req.headers['access-control-request-headers'] || 'NONE'}`);
    console.log(`   User-Agent: ${(req.headers['user-agent'] || '').substring(0, 50)}...`);

    // Log the response headers that will be sent
    res.on('finish', () => {
      console.log(`📤 OPTIONS RESPONSE HEADERS:`);
      console.log(`   Access-Control-Allow-Origin: ${res.get('Access-Control-Allow-Origin') || 'NOT SET'}`);
      console.log(`   Access-Control-Allow-Methods: ${res.get('Access-Control-Allow-Methods') || 'NOT SET'}`);
      console.log(`   Access-Control-Allow-Headers: ${res.get('Access-Control-Allow-Headers') || 'NOT SET'}`);
      console.log(`   Access-Control-Allow-Credentials: ${res.get('Access-Control-Allow-Credentials') || 'NOT SET'}`);
      console.log(`   Status: ${res.statusCode}\n`);
    });
  }
  next();
});

// Additional manual OPTIONS handler for auth routes (extra safety)
app.options('/api/auth/*', (req, res) => {
  console.log(`🔐 Manual OPTIONS handler for auth route: ${req.originalUrl}`);

  // Manually set CORS headers
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,PATCH,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept,Authorization,ngrok-skip-browser-warning');
  res.header('Access-Control-Max-Age', '86400');

  res.status(200).send();
});

// =====================================
// RATE LIMITING (GENERAL - KEPT)
// =====================================
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000, // Increased from 100 to 1000
  message: {
    error: 'Too many requests',
    message: 'Please try again later',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks and debug endpoints
    const skipPaths = ['/api/health', '/api/ping', '/api/cors-test', '/api/cors-debug', '/api/status'];
    return skipPaths.some(path => req.path === path);
  }
});

// Apply rate limiting to all API routes (but with higher limit)
app.use('/api', limiter);

// =====================================
// AUTH RATE LIMITING - DISABLED FOR TESTING
// =====================================
/*
// COMMENTED OUT FOR TESTING - Uncomment in production with higher limits
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Increased from 5 to 50 for testing
  message: {
    error: 'Too many authentication attempts',
    message: 'Please try again after 15 minutes'
  }
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
*/

console.log('⚠️  AUTH RATE LIMITING DISABLED FOR TESTING');

// =====================================
// BODY PARSING MIDDLEWARE
// =====================================
app.use(express.json({
  limit: process.env.MAX_JSON_SIZE || '10mb',
  verify: (req, res, buf, encoding) => {
    req.rawBody = buf;
  }
}));

app.use(express.urlencoded({
  extended: true,
  limit: process.env.MAX_URL_ENCODED_SIZE || '10mb'
}));

// =====================================
// SECURITY SANITIZATION
// =====================================
// Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// =====================================
// COMPRESSION
// =====================================
app.use(compression({
  level: parseInt(process.env.COMPRESSION_LEVEL) || 6,
  threshold: 1024, // Compress responses > 1KB
  filter: (req, res) => {
    // Don't compress responses if this request has a 'no-transform' directive
    if (req.headers['cache-control'] && req.headers['cache-control'].includes('no-transform')) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// =====================================
// STATIC FILES SERVING
// =====================================
// Servir les fichiers uploadés
const uploadsPath = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
  logger.info('📁 Created uploads directory');
}

app.use('/uploads', express.static(uploadsPath, {
  maxAge: process.env.STATIC_CACHE_TIMEOUT || '1h',
  etag: true,
  lastModified: true
}));

// =====================================
// REQUEST ID & LOGGING MIDDLEWARE
// =====================================
app.use((req, res, next) => {
  req.id = require('crypto').randomBytes(8).toString('hex');
  res.setHeader('X-Request-ID', req.id);

  // Log all requests in development
  if (process.env.NODE_ENV === 'development') {
    console.log(`📥 ${req.method} ${req.originalUrl} from ${req.headers.origin || 'no-origin'} [${req.id}]`);
  }

  next();
});

// =====================================
// TEST & DEBUG ENDPOINTS (BEFORE API ROUTES)
// =====================================

// Health check endpoint
app.get('/api/health', (req, res) => {
  const healthData = {
    status: 'OK',
    message: 'WorkWhile API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0',
    uptime: Math.floor(process.uptime()) + 's',
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB'
    },
    database: 'connected',
    features: {
      emailNotifications: process.env.FEATURE_EMAIL_NOTIFICATIONS === 'true',
      fileUpload: process.env.FEATURE_FILE_UPLOAD === 'true',
      realTimeNotifications: process.env.FEATURE_REAL_TIME_NOTIFICATIONS === 'true'
    },
    rateLimiting: {
      auth: 'DISABLED FOR TESTING',
      general: 'ENABLED (1000 req/15min)'
    }
  };

  console.log(`✅ Health check accessed from: ${req.headers.origin || 'direct access'}`);
  res.json(healthData);
});

// Simple ping endpoint
app.get('/api/ping', (req, res) => {
  console.log(`🏓 Ping from: ${req.headers.origin || 'direct access'}`);
  res.json({
    message: 'pong',
    timestamp: new Date().toISOString(),
    origin: req.headers.origin || 'no-origin',
    requestId: req.id
  });
});

// Enhanced CORS test endpoint
app.get('/api/cors-test', (req, res) => {
  const corsInfo = {
    success: true,
    message: 'CORS test successful! 🎉',
    timestamp: new Date().toISOString(),
    server: {
      environment: process.env.NODE_ENV,
      version: '1.0.0',
      uptime: Math.floor(process.uptime()) + 's'
    },
    request: {
      origin: req.headers.origin || 'No origin header',
      method: req.method,
      url: req.originalUrl,
      userAgent: req.headers['user-agent']?.substring(0, 50) + '...' || 'No user-agent',
      host: req.headers.host,
      ip: req.ip,
      forwarded: req.headers['x-forwarded-for'] || 'None'
    },
    corsHeaders: {
      'Access-Control-Allow-Origin': res.get('Access-Control-Allow-Origin') || 'Not set',
      'Access-Control-Allow-Credentials': res.get('Access-Control-Allow-Credentials') || 'Not set',
      'Access-Control-Allow-Methods': res.get('Access-Control-Allow-Methods') || 'Not set',
      'Access-Control-Allow-Headers': res.get('Access-Control-Allow-Headers') || 'Not set'
    },
    rateLimiting: {
      auth: 'DISABLED FOR TESTING',
      general: 'ACTIVE'
    }
  };

  console.log(`🧪 CORS Test from: ${req.headers.origin}`);
  res.json(corsInfo);
});

// POST version of CORS test (simulates registration/login)
app.post('/api/cors-test', (req, res) => {
  console.log(`🧪 CORS POST Test from: ${req.headers.origin}`);
  res.json({
    success: true,
    message: 'CORS POST test successful! 🎉',
    method: 'POST',
    body: req.body,
    timestamp: new Date().toISOString(),
    origin: req.headers.origin
  });
});

// Comprehensive CORS debug endpoint
app.all('/api/cors-debug', (req, res) => {
  console.log(`\n🧪 CORS DEBUG ENDPOINT HIT:`);
  console.log(`   Method: ${req.method}`);
  console.log(`   Origin: ${req.headers.origin || 'NO ORIGIN'}`);
  console.log(`   Path: ${req.originalUrl}`);
  console.log(`   Content-Type: ${req.headers['content-type'] || 'NONE'}`);
  console.log(`   Authorization: ${req.headers.authorization ? 'Present' : 'None'}`);

  res.json({
    success: true,
    message: 'CORS debug endpoint working!',
    method: req.method,
    origin: req.headers.origin,
    timestamp: new Date().toISOString(),
    requestHeaders: {
      'content-type': req.headers['content-type'],
      'authorization': req.headers.authorization ? 'Present' : 'None',
      'origin': req.headers.origin,
      'user-agent': req.headers['user-agent']?.substring(0, 100),
      'ngrok-skip-browser-warning': req.headers['ngrok-skip-browser-warning']
    },
    responseHeaders: {
      'Access-Control-Allow-Origin': res.get('Access-Control-Allow-Origin'),
      'Access-Control-Allow-Credentials': res.get('Access-Control-Allow-Credentials'),
      'Access-Control-Allow-Methods': res.get('Access-Control-Allow-Methods'),
      'Access-Control-Allow-Headers': res.get('Access-Control-Allow-Headers')
    },
    body: req.body,
    rateLimiting: {
      auth: 'DISABLED FOR TESTING'
    }
  });
});

// Status endpoint for monitoring
app.get('/api/status', (req, res) => {
  res.json({
    api: 'WorkWhile Backend API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    endpoints: {
      auth: '/api/auth',
      jobs: '/api/jobs',
      users: '/api/users',
      applications: '/api/applications',
      companies: '/api/companies',
      health: '/api/health',
      corsTest: '/api/cors-test',
      corsDebug: '/api/cors-debug'
    },
    rateLimiting: {
      auth: 'DISABLED FOR TESTING',
      general: 'ACTIVE (1000 req/15min)'
    }
  });
});

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    message: 'Welcome to WorkWhile API',
    version: '1.0.0',
    documentation: '/api/docs',
    health: '/api/health',
    status: '/api/status',
    corsTest: '/api/cors-test',
    timestamp: new Date().toISOString(),
    rateLimiting: {
      auth: 'DISABLED FOR TESTING - Ready for unlimited registration/login attempts'
    }
  });
});

// =====================================
// MAIN API ROUTES
// =====================================
app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/users', userRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/admin/scraping', scrapingRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/cv', cvRoutes);

// =====================================
// ERROR HANDLING
// =====================================

// 404 handler pour les routes API
app.use('/api/*', (req, res) => {
  logger.warn(`404 - API route not found: ${req.originalUrl}`);
  res.status(404).json({
    error: 'API Route Not Found',
    message: `The API endpoint ${req.originalUrl} does not exist`,
    availableEndpoints: [
      '/api/health',
      '/api/ping',
      '/api/cors-test',
      '/api/cors-debug',
      '/api/status',
      '/api/auth/*',
      '/api/jobs/*',
      '/api/users/*',
      '/api/applications/*',
      '/api/companies/*'
    ],
    timestamp: new Date().toISOString()
  });
});

// 404 handler général
app.use('*', (req, res) => {
  if (req.originalUrl.startsWith('/api')) {
    return res.status(404).json({
      error: 'API endpoint not found',
      path: req.originalUrl,
      suggestion: 'Check /api/status for available endpoints'
    });
  }

  res.status(404).json({
    error: 'Route not found',
    message: `The route ${req.originalUrl} does not exist on this server`,
    suggestion: 'Try /api for API endpoints'
  });
});

// Global error handler
app.use(errorHandler);

// =====================================
// SERVER STARTUP
// =====================================
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

const server = app.listen(PORT, HOST, () => {
  console.log('\n' + '='.repeat(70));
  console.log('🚀 WORKWHILE API SERVER STARTED');
  console.log('='.repeat(70));
  console.log(`📍 Server: http://${HOST}:${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔧 Process ID: ${process.pid}`);
  console.log(`💾 Node Version: ${process.version}`);
  console.log(`\n📡 Test Endpoints:`);
  console.log(`   🏥 Health: http://${HOST}:${PORT}/api/health`);
  console.log(`   🏓 Ping: http://${HOST}:${PORT}/api/ping`);
  console.log(`   🧪 CORS Test: http://${HOST}:${PORT}/api/cors-test`);
  console.log(`   🔍 CORS Debug: http://${HOST}:${PORT}/api/cors-debug`);
  console.log(`   📊 Status: http://${HOST}:${PORT}/api/status`);
  console.log(`\n📡 CORS Configuration:`);
  console.log(`   ✅ Allowed Origins:`);
  console.log(`      - https://trouvetonjob.vercel.app`);
  console.log(`      - https://workwhile-front-d2sc.vercel.app`);
  console.log(`      - localhost development servers`);
  console.log(`      - *.vercel.app, *.netlify.app, *.ngrok.* patterns`);
  console.log(`   ✅ Credentials: Enabled`);
  console.log(`   ✅ Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD`);
  console.log(`   ✅ Enhanced debugging enabled`);
  console.log(`\n🚦 Rate Limiting Status:`);
  console.log(`   ⚠️  AUTH RATE LIMITING: DISABLED FOR TESTING`);
  console.log(`   ✅ General Rate Limiting: 1000 requests/15min`);
  console.log(`   🧪 Ready for unlimited registration/login attempts!`);
  console.log('='.repeat(70));

  if (process.env.NODE_ENV === 'development') {
    console.log(`\n🔧 Development Mode Features:`);
    console.log(`   📝 Detailed request logging enabled`);
    console.log(`   🌐 Permissive CORS for unknown origins`);
    console.log(`   🐛 Enhanced error reporting`);
    console.log(`   📡 Ready for ngrok: ngrok http ${PORT}`);
    console.log(`   ⚠️  Auth rate limiting DISABLED for testing`);
    console.log(`\n💡 Pro tip: Watch this console for detailed logs!`);
  }

  console.log('\n');

  logger.info(`🚀 WorkWhile API Server started on ${HOST}:${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});

// =====================================
// GRACEFUL SHUTDOWN
// =====================================

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  logger.error('❌ Unhandled Promise Rejection:', err);
  console.log('Unhandled Promise Rejection. Shutting down...');
  server.close(() => {
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('❌ Uncaught Exception:', err);
  console.log('Uncaught Exception. Shutting down...');
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('🛑 SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    logger.info('✅ Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('🛑 SIGINT received. Shutting down gracefully...');
  server.close(() => {
    logger.info('✅ Process terminated');
    process.exit(0);
  });
});

// =====================================
// DEVELOPMENT HELPERS
// =====================================

// Log startup completion
setTimeout(() => {
  console.log(`🎉 Server fully initialized and ready to accept connections!`);
  console.log(`🧪 TESTING MODE: Auth rate limiting disabled - ready for unlimited registration/login attempts!`);
  if (process.env.NODE_ENV === 'development') {
    console.log(`🔗 Try: curl http://localhost:${PORT}/api/health`);
  }
}, 1000);

// =====================================
// EXPORT
// =====================================
module.exports = app;