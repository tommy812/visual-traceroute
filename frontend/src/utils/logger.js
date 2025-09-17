/**
 * Frontend logger utility for development and production
 */

const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = {
  debug: (...args) => {
    if (isDevelopment) {
      console.log('🐛', ...args);
    }
  },

  info: (...args) => {
    if (isDevelopment) {
      console.log('ℹ️', ...args);
    }
  },

  warn: (...args) => {
    console.warn('⚠️', ...args);
  },

  error: (...args) => {
    console.error('❌', ...args);
  }
};

export default logger;
