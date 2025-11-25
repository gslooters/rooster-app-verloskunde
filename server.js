#!/usr/bin/env node
/**
 * 🚀 RAILWAY DEPLOYMENT SERVER WRAPPER
 * DRAAD53.2 Fase3 - Critical Fix voor SIGTERM crashes
 * 
 * PROBLEEM:
 * - npm >= 9.6.7 geeft SIGTERM niet door aan child processes
 * - Railway killed container na 8 seconden
 * - Health check slaagt maar app niet beschikbaar
 * 
 * OPLOSSING:
 * - Start standalone server direct via Node.js (geen npm)
 * - Zet HOSTNAME=0.0.0.0 (Railway vereiste)
 * - Gebruik Railway's $PORT dynamisch
 * - Graceful shutdown op SIGTERM
 */

const { spawn } = require('child_process');
const path = require('path');

// 🔥 CRITICAL: Railway environment setup
const PORT = process.env.PORT || 8080;
const HOSTNAME = '0.0.0.0'; // Railway vereiste

console.log('🚀 [WRAPPER] Starting Railway deployment server...');
console.log(`📋 [WRAPPER] PORT: ${PORT}`);
console.log(`📋 [WRAPPER] HOSTNAME: ${HOSTNAME}`);
console.log(`📋 [WRAPPER] NODE_ENV: ${process.env.NODE_ENV || 'production'}`);

// Path naar standalone server
const serverPath = path.join(__dirname, '.next', 'standalone', 'server.js');

console.log(`📂 [WRAPPER] Server path: ${serverPath}`);

// Start standalone server als child process
const serverProcess = spawn(
  'node',
  [serverPath],
  {
    env: {
      ...process.env,
      PORT: PORT,
      HOSTNAME: HOSTNAME,
      NODE_ENV: process.env.NODE_ENV || 'production'
    },
    stdio: 'inherit', // Pipe all output naar parent
    shell: false
  }
);

// Handle server process events
serverProcess.on('error', (error) => {
  console.error('❌ [WRAPPER] Failed to start server:', error);
  process.exit(1);
});

serverProcess.on('exit', (code, signal) => {
  if (signal) {
    console.log(`⚠️  [WRAPPER] Server killed by signal: ${signal}`);
  } else {
    console.log(`⚠️  [WRAPPER] Server exited with code: ${code}`);
  }
  
  // Exit wrapper met zelfde code
  process.exit(code || 0);
});

// 🔥 GRACEFUL SHUTDOWN HANDLERS
// Railway stuurt SIGTERM bij deployment/restart

function gracefulShutdown(signal) {
  console.log(`\n⚠️  [WRAPPER] Received ${signal}, shutting down gracefully...`);
  
  if (serverProcess && !serverProcess.killed) {
    console.log('🛑 [WRAPPER] Stopping server process...');
    
    // Stuur SIGTERM naar server
    serverProcess.kill('SIGTERM');
    
    // Force kill na 10 seconden
    const killTimeout = setTimeout(() => {
      console.log('⚠️  [WRAPPER] Force killing server (timeout)...');
      serverProcess.kill('SIGKILL');
    }, 10000);
    
    // Clear timeout als server netjes stopt
    serverProcess.on('exit', () => {
      clearTimeout(killTimeout);
      console.log('✅ [WRAPPER] Server stopped gracefully');
      process.exit(0);
    });
  } else {
    console.log('✅ [WRAPPER] No server to stop');
    process.exit(0);
  }
}

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ [WRAPPER] Uncaught exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ [WRAPPER] Unhandled rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

console.log('✅ [WRAPPER] Server wrapper started successfully');
console.log(`🌐 [WRAPPER] Server should be listening on http://${HOSTNAME}:${PORT}`);
console.log('');
