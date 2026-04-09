import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { checkIPFSConnection, closeIPFSClient } from './services/ipfs.js';

// Import routes
import issueRouter from './routes/issue.js';
import verifyRouter from './routes/verify.js';
import revokeRouter from './routes/revoke.js';

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'], // Add frontend URLs
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting: 100 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: {
    error: 'Too many requests',
    message: 'Rate limit exceeded. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Check IPFS connection
    const ipfsConnected = await checkIPFSConnection();
    
    const healthStatus = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        api: 'healthy',
        ipfs: ipfsConnected ? 'healthy' : 'unhealthy',
        blockchain: 'unknown' // TODO: Add Stacks node health check
      },
      version: '1.0.0'
    };
    
    const statusCode = ipfsConnected ? 200 : 503;
    res.status(statusCode).json(healthStatus);
  } catch (error) {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      message: 'Health check failed'
    });
  }
});

// API routes
app.use('/api/issue', issueRouter);
app.use('/api/verify', verifyRouter);
app.use('/api/revoke', revokeRouter);

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'Certivert API',
    version: '1.0.0',
    description: 'Blockchain-based academic certificate verification system',
    endpoints: {
      'POST /api/issue': 'Issue a new certificate',
      'GET /api/verify/:certId': 'Verify a certificate by ID',
      'POST /api/revoke': 'Revoke a certificate',
      'GET /health': 'Health check endpoint'
    },
    network: config.STACKS_NETWORK,
    contractAddress: config.CONTRACT_ADDRESS
  });
});

// 404 handler for unmatched routes
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

// Server instance reference for graceful shutdown
let server = null;

// Start server
async function startServer() {
  try {
    // Check IPFS connection on startup
    const ipfsConnected = await checkIPFSConnection();
    if (!ipfsConnected) {
      console.warn('WARNING: IPFS connection failed. API will start but file operations may fail.');
      console.warn('Please ensure IPFS is running on', config.IPFS_API_URL);
    }
    
    server = app.listen(config.API_PORT, () => {
      console.log('='.repeat(60));
      console.log('🚀 Certivert API Server Started');
      console.log('='.repeat(60));
      console.log(`📡 Port: ${config.API_PORT}`);
      console.log(`🌐 Network: ${config.STACKS_NETWORK}`);
      console.log(`🔗 Stacks API: ${config.STACKS_API_URL}`);
      console.log(`📝 Contract: ${config.CONTRACT_ADDRESS}`);
      console.log(`💾 IPFS: ${config.IPFS_API_URL}`);
      console.log(`✅ IPFS Connected: ${ipfsConnected ? 'Yes' : 'No'}`);
      console.log('='.repeat(60));
      console.log('📍 Endpoints:');
      console.log(`   POST http://localhost:${config.API_PORT}/api/issue`);
      console.log(`   GET  http://localhost:${config.API_PORT}/api/verify/:certId`);
      console.log(`   POST http://localhost:${config.API_PORT}/api/revoke`);
      console.log(`   GET  http://localhost:${config.API_PORT}/health`);
      console.log('='.repeat(60));
    });

    // Handle server startup errors
    server.on('error', (err) => {
      server = null; // Reset server reference on error
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${config.API_PORT} is already in use. Please:`);
        console.error('   1. Kill the existing process using the port');
        console.error('   2. Change API_PORT in your .env file');
        console.error('   3. Use: lsof -ti:3001 | xargs kill');
      } else {
        console.error('Server startup error:', err);
      }
      process.exit(1);
    });

    // Set server timeout to prevent hanging connections
    server.keepAliveTimeout = 60000; // 60 seconds
    server.headersTimeout = 65000;   // 65 seconds (should be higher than keepAliveTimeout)
    
  } catch (error) {
    console.error('Failed to start server:', error);
    server = null; // Ensure server reference is null on error
    process.exit(1);
  }
}

// Graceful shutdown function
async function gracefulShutdown(signal) {
  console.log(`${signal} received. Initiating graceful shutdown...`);
  
  // Clean up IPFS client connections
  console.log('Cleaning up IPFS client...');
  closeIPFSClient();
  
  if (server) {
    console.log('Closing HTTP server...');
    
    // Close the server to stop accepting new connections
    server.close((err) => {
      if (err) {
        console.error('Error closing HTTP server:', err);
        process.exit(1);
      }
      
      console.log('HTTP server closed successfully.');
      
      // Force exit after 10 seconds if process doesn't exit naturally
      setTimeout(() => {
        console.warn('Forcing process exit after 10 seconds...');
        process.exit(0);
      }, 10000);
      
      // Exit gracefully once all connections are closed
      process.exit(0);
    });
    
    // Immediately destroy all active connections to prevent hanging
    setTimeout(() => {
      console.log('Destroying remaining connections...');
      server.closeAllConnections?.();
    }, 5000);
  } else {
    console.log('No server instance found. Exiting immediately.');
    process.exit(0);
  }
}

// Handle graceful shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions to prevent hanging
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  
  // Only attempt graceful shutdown if server is running
  if (server && server.listening) {
    gracefulShutdown('UNCAUGHT_EXCEPTION');
  } else {
    // If no server or server not listening, just clean up IPFS and exit
    console.log('Server not running, cleaning up and exiting...');
    closeIPFSClient();
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  
  // Only attempt graceful shutdown if server is running
  if (server && server.listening) {
    gracefulShutdown('UNHANDLED_REJECTION');
  } else {
    // If no server or server not listening, just clean up IPFS and exit
    console.log('Server not running, cleaning up and exiting...');
    closeIPFSClient();
    process.exit(1);
  }
});

// Start the server
startServer();