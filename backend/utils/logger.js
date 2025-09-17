/**
 * Simple logger utility for consistent logging across the application
 */

const isDevelopment = process.env.NODE_ENV === 'development';
const isDebugEnabled = process.env.CACHE_DEBUG === '1' || isDevelopment;

class Logger {
  static info(message, ...args) {
    console.log('ℹ️', message, ...args);
  }

  static warn(message, ...args) {
    console.warn('⚠️', message, ...args);
  }

  static error(message, ...args) {
    console.error('❌', message, ...args);
  }

  static debug(message, ...args) {
    if (isDebugEnabled) {
      console.log('🐛', message, ...args);
    }
  }

  static success(message, ...args) {
    console.log('✅', message, ...args);
  }

  static time(label) {
    if (isDebugEnabled) {
      console.time(label);
    }
  }

  static timeEnd(label) {
    if (isDebugEnabled) {
      console.timeEnd(label);
    }
  }
}

module.exports = Logger;
