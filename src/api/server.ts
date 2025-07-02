#!/usr/bin/env node
/**
 * Smart Filesystem MCP - REST API Server
 * Express.js server with SwaggerUI for HTTP access to MCP tools
 */

import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import path from 'path';
import os from 'os';
import { errorHandler } from './middleware/error-handler.js';
import { apiRoutes } from './routes/index.js';
import { openApiSpec } from './schemas/openapi.js';
import { initializeSecurityController } from '../core/security-controller-v2.js';

/**
 * Smart Filesystem API Server
 */
class SmartFilesystemAPI {
  private app: express.Application;
  private port: number;
  private isWindows: boolean;

  constructor() {
    this.app = express();
    this.port = parseInt(process.env.PORT || '3000', 10);
    this.isWindows = os.platform() === 'win32';
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Setup middleware
   */
  private setupMiddleware(): void {
    // CORS - allow all origins for local development
    this.app.use(cors({
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
    }));

    // JSON parsing
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));

    // Enhanced request/response logging
    this.setupRequestLogging();
  }

  /**
   * Setup routes
   */
  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        success: true,
        data: {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      });
    });

    // API documentation with SwaggerUI
    this.app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, {
      customSiteTitle: 'Smart Filesystem MCP API',
      customfavIcon: '/favicon.ico',
      customCss: '.swagger-ui .topbar { display: none }',
      swaggerOptions: {
        persistAuthorization: true,
      }
    }));

    // API routes
    this.app.use('/api', apiRoutes);

    // Root endpoint - redirect to API docs
    this.app.get('/', (req, res) => {
      res.redirect('/api-docs');
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Route ${req.method} ${req.originalUrl} not found`,
          suggestions: [
            'Check the API documentation at /api-docs',
            'Verify the request method and URL',
            'See available endpoints in the OpenAPI spec'
          ]
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      });
    });
  }

  /**
   * Setup request/response logging middleware
   */
  private setupRequestLogging(): void {
    const enableRequestLogs = process.env.ENABLE_REQUEST_LOGS !== 'false';
    const logLevel = process.env.LOG_LEVEL || 'info';

    if (!enableRequestLogs) return;

    this.app.use((req, res, next) => {
      const start = Date.now();
      const timestamp = new Date().toLocaleTimeString('ja-JP', { hour12: false });
      
      // Log request start for debug mode
      if (logLevel === 'debug') {
        console.log(`[${timestamp}] → ${req.method} ${req.originalUrl || req.url}`);
      }

      res.on('finish', () => {
        const duration = Date.now() - start;
        const status = res.statusCode;
        const method = req.method;
        const url = req.originalUrl || req.url;
        
        // Format log message based on status (Windows-compatible)
        const errorIndicator = this.isWindows ? '[ERROR]' : '❌';
        if (status >= 400) {
          console.log(`[${timestamp}] ${errorIndicator} ${method} ${url} -> ${status} (${duration}ms)`);
        } else {
          console.log(`[${timestamp}] ${method} ${url} -> ${status} (${duration}ms)`);
        }
      });
      
      next();
    });
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    this.app.use(errorHandler);
  }

  /**
   * Get platform-appropriate symbols for display
   */
  private getSymbols() {
    if (this.isWindows && !process.env.WT_SESSION && !process.env.TERM_PROGRAM) {
      // Windows Command Prompt - use ASCII alternatives
      return {
        rocket: '[START]',
        pin: '[URL]',
        book: '[DOCS]',
        lock: '[SEC]',
        clock: '[TIME]',
        computer: '[SYS]',
        shield: '[GUARD]',
        bulb: '[TEST]',
        sparkle: '[READY]',
        cross: '[ERROR]',
        wave: '[BYE]',
        bullet: '*'
      };
    } else {
      // Unix, WSL, Windows Terminal, VS Code - use emoji
      return {
        rocket: '🚀',
        pin: '📍',
        book: '📖',
        lock: '🔒',
        clock: '⏰',
        computer: '🖥️',
        shield: '🛡️',
        bulb: '💡',
        sparkle: '✨',
        cross: '❌',
        wave: '👋',
        bullet: '•'
      };
    }
  }

  /**
   * Cross-platform console clear
   */
  private clearConsole(): void {
    if (this.isWindows) {
      // Windows: just add some newlines instead of clearing
      console.log('\n'.repeat(3));
    } else {
      // Unix: use console.clear
      console.clear();
    }
  }

  /**
   * Display startup banner with system information
   */
  private displayStartupBanner(allowedDirs: string[]): void {
    const symbols = this.getSymbols();
    const now = new Date();
    const nodeVersion = process.version;
    const environment = process.env.NODE_ENV || 'development';
    const hotReload = process.env.npm_lifecycle_event === 'api:dev';
    const platform = `${os.platform()} ${os.arch()}`;
    
    this.clearConsole();
    console.log('\n' + '='.repeat(60));
    console.log(`${symbols.rocket} Smart Filesystem MCP API Server Started`);
    console.log('='.repeat(60));
    console.log(`${symbols.pin} Server: http://127.0.0.1:${this.port}`);
    console.log(`${symbols.book} SwaggerUI: http://127.0.0.1:${this.port}/api-docs`);
    console.log(`${symbols.lock} Security: localhost-only binding`);
    console.log(`${symbols.clock} Started at: ${now.toLocaleString()}`);
    console.log('');
    console.log(`${symbols.computer}  System Information:`);
    console.log(`   Environment: ${environment}`);
    console.log(`   Platform: ${platform}`);
    console.log(`   Node.js: ${nodeVersion}`);
    console.log(`   Package: smart-fs-mcp@1.0.0`);
    console.log(`   TypeScript: enabled`);
    console.log(`   Hot reload: ${hotReload ? 'enabled (nodemon)' : 'disabled'}`);
    console.log('');
    console.log(`${symbols.shield}  Security Settings:`);
    console.log(`   Allowed directories: ${allowedDirs.length}`);
    allowedDirs.slice(0, 3).forEach(dir => {
      // Normalize path display for Windows
      const displayPath = this.isWindows ? path.normalize(dir) : dir;
      console.log(`   ${symbols.bullet} ${displayPath}`);
    });
    if (allowedDirs.length > 3) {
      console.log(`   ${symbols.bullet} ... and ${allowedDirs.length - 3} more`);
    }
    console.log('');
    console.log(`${symbols.bulb} Quick Test Commands:`);
    if (this.isWindows) {
      console.log(`   powershell "Invoke-RestMethod -Uri 'http://127.0.0.1:${this.port}/health'"`);
      console.log(`   curl.exe "http://127.0.0.1:${this.port}/api/files/info?path=./package.json"`);
    } else {
      console.log(`   curl "http://127.0.0.1:${this.port}/health"`);
      console.log(`   curl "http://127.0.0.1:${this.port}/api/files/info?path=./package.json"`);
    }
    console.log('');
    console.log(`${symbols.sparkle} Ready to accept requests!`);
    console.log('='.repeat(60));
    console.log('');
  }

  /**
   * Handle server startup errors
   */
  private handleStartupError(error: any): void {
    const symbols = this.getSymbols();
    
    this.clearConsole();
    console.log('\n' + '='.repeat(60));
    console.log(`${symbols.cross} Failed to start Smart Filesystem MCP API Server`);
    console.log('='.repeat(60));
    console.log(`[ERROR] ${error.message || error}`);
    console.log('');
    
    if (error.code === 'EADDRINUSE') {
      console.log('[INFO] Diagnostic Information:');
      console.log(`   Port ${this.port} is already in use`);
      console.log(`   Another process is likely running on this port`);
      console.log('');
      console.log('[SOLUTIONS] Suggested fixes:');
      if (this.isWindows) {
        console.log(`   1. Find and stop the process using port ${this.port}:`);
        console.log(`      netstat -ano | findstr :${this.port}`);
        console.log(`      taskkill /PID <PID> /F`);
        console.log(`   2. Use a different port:`);
        console.log(`      set PORT=3001 && npm run api:dev`);
      } else {
        console.log(`   1. Stop the process using port ${this.port}:`);
        console.log(`      lsof -ti:${this.port} | xargs kill -9`);
        console.log(`   2. Use a different port:`);
        console.log(`      PORT=3001 npm run api:dev`);
      }
      console.log(`   3. Wait a moment and try again:`);
      console.log(`      npm run api:dev`);
    } else if (error.code === 'EACCES') {
      console.log('[INFO] Diagnostic Information:');
      console.log(`   Permission denied for port ${this.port}`);
      console.log(`   Ports below 1024 require administrator privileges`);
      console.log('');
      console.log('[SOLUTIONS] Suggested fixes:');
      console.log(`   1. Use a port above 1024 (recommended):`);
      console.log(`      PORT=3000 npm run api:dev`);
      if (this.isWindows) {
        console.log(`   2. Run as administrator (not recommended):`);
        console.log(`      Right-click terminal -> Run as administrator`);
      } else {
        console.log(`   2. Run with sudo (not recommended):`);
        console.log(`      sudo npm run api:dev`);
      }
    } else {
      console.log('[INFO] Diagnostic Information:');
      console.log(`   Error code: ${error.code || 'UNKNOWN'}`);
      console.log(`   Platform: ${os.platform()} ${os.arch()}`);
      console.log(`   Node.js: ${process.version}`);
      console.log('');
      console.log('[SOLUTIONS] Suggested fixes:');
      console.log(`   1. Check system resources and permissions`);
      console.log(`   2. Verify network configuration`);
      console.log(`   3. Try restarting the development server:`);
      console.log(`      npm run api:dev`);
    }
    
    console.log('');
    console.log('[HELP] Still having issues?');
    console.log('   * Check the README.md for troubleshooting tips');
    console.log('   * Verify your Node.js version is compatible');
    console.log('   * Ensure all dependencies are installed: npm install');
    console.log('='.repeat(60));
    console.log('');
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    try {
      // Initialize security controller with current directory as default
      const allowedDirs = process.env.ALLOWED_DIRS 
        ? process.env.ALLOWED_DIRS.split(',')
        : [process.cwd()];
      
      initializeSecurityController(allowedDirs);

      // Start HTTP server with enhanced error handling
      const server = this.app.listen(this.port, '127.0.0.1', () => {
        this.displayStartupBanner(allowedDirs);
      });

      // Server error handling
      server.on('error', (error: any) => {
        this.handleStartupError(error);
        process.exit(1);
      });

      // Handle server close
      server.on('close', () => {
        console.log('\n👋 API Server stopped');
      });

    } catch (error) {
      this.handleStartupError(error);
      throw error;
    }
  }

  /**
   * Get Express app instance
   */
  getApp(): express.Application {
    return this.app;
  }
}

// Start server if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new SmartFilesystemAPI();
  
  // Graceful shutdown handling (cross-platform)
  const gracefulShutdown = (signal: string) => {
    const isWindows = os.platform() === 'win32';
    const symbols = isWindows ? {
      shutdown: '[SHUTDOWN]',
      wave: '[BYE]',
      disk: '[CLEAN]',
      check: '[OK]'
    } : {
      shutdown: '📴',
      wave: '👋',
      disk: '💾',
      check: '✅'
    };
    
    console.log(`\n\n${symbols.shutdown} Received ${signal} - Graceful shutdown initiated`);
    console.log(`${symbols.wave} Shutting down Smart Filesystem MCP API Server...`);
    console.log(`${symbols.disk} Cleaning up resources...`);
    console.log(`${symbols.check} Shutdown complete - Goodbye!`);
    process.exit(0);
  };

  // Windows has different signal handling
  if (os.platform() === 'win32') {
    // Windows: primarily SIGINT (Ctrl+C)
    process.on('SIGINT', () => gracefulShutdown('SIGINT (Ctrl+C)'));
    process.on('SIGBREAK', () => gracefulShutdown('SIGBREAK (Ctrl+Break)'));
  } else {
    // Unix-like: SIGINT and SIGTERM
    process.on('SIGINT', () => gracefulShutdown('SIGINT (Ctrl+C)'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  }

  // Handle uncaught exceptions (cross-platform)
  process.on('uncaughtException', (error) => {
    const isWindows = os.platform() === 'win32';
    const crashSymbol = isWindows ? '[CRASH]' : '💥';
    const restartSymbol = isWindows ? '[RESTART]' : '🔄';
    
    console.log('\n' + '='.repeat(60));
    console.log(`${crashSymbol} Uncaught Exception - Server Crashed`);
    console.log('='.repeat(60));
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.log(`\n${restartSymbol} Please restart the server: npm run api:dev`);
    console.log('='.repeat(60));
    process.exit(1);
  });

  // Handle unhandled promise rejections (cross-platform)
  process.on('unhandledRejection', (reason, promise) => {
    const isWindows = os.platform() === 'win32';
    const warningSymbol = isWindows ? '[WARNING]' : '⚠️';
    const restartSymbol = isWindows ? '[RESTART]' : '🔄';
    
    console.log('\n' + '='.repeat(60));
    console.log(`${warningSymbol} Unhandled Promise Rejection`);
    console.log('='.repeat(60));
    console.error('Reason:', reason);
    console.error('Promise:', promise);
    console.log(`\n${restartSymbol} Please restart the server: npm run api:dev`);
    console.log('='.repeat(60));
    process.exit(1);
  });

  // Start server with enhanced error handling
  server.start().catch((error) => {
    const isWindows = os.platform() === 'win32';
    const crashSymbol = isWindows ? '[CRITICAL]' : '💥';
    
    console.error(`\n${crashSymbol} Critical startup error occurred`);
    console.error('Details:', error.message || error);
    process.exit(1);
  });
}

export { SmartFilesystemAPI };