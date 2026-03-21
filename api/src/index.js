import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { checkIPFSConnection } from './services/ipfs.js';

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

// Start server
async function startServer() {
  try {
    // Check IPFS connection on startup
    const ipfsConnected = await checkIPFSConnection();
    if (!ipfsConnected) {
      console.warn('WARNING: IPFS connection failed. API will start but file operations may fail.');
      console.warn('Please ensure IPFS is running on', config.IPFS_API_URL);
    }
    
    app.listen(config.API_PORT, () => {
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
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

// Start the server
startServer();