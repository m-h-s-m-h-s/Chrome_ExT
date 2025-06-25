/**
 * utils.js - Utility functions for the Chaching Product Searcher Extension
 * 
 * This module provides common utility functions used throughout the extension
 * for text processing, URL generation, and data validation.
 * 
 * @module utils
 * @author Chaching Product Searcher Extension
 * @version 1.0.0
 */

/**
 * Configuration object containing extension settings and constants
 * @const {Object} CONFIG
 */
const CONFIG = {
  CHACHING_BASE_URL: 'https://chaching.me/us/search',
  NOTIFICATION_DURATION: 5000,
  DEBOUNCE_DELAY: 300,
  MAX_TITLE_LENGTH: 200,
  MIN_TITLE_LENGTH: 3
};

/**
 * Sanitizes a product title for use in URL parameters
 * Removes special characters, extra spaces, and converts spaces to dashes
 * 
 * @param {string} title - The raw product title to sanitize
 * @returns {string} The sanitized title suitable for URL parameters
 * 
 * @example
 * sanitizeProductTitle("Apple iPhone 14 Pro - 128GB") 
 * // Returns: "Apple-iPhone-14-Pro-128GB"
 */
function sanitizeProductTitle(title) {
  if (!title || typeof title !== 'string') {
    console.warn('[Utils] Invalid title provided to sanitizeProductTitle:', title);
    return '';
  }

  return title
    // Remove HTML tags if any
    .replace(/<[^>]*>/g, '')
    // Remove special characters except spaces, letters, numbers, and basic punctuation
    .replace(/[^\w\s\-\.]/g, ' ')
    // Replace multiple spaces with single space
    .replace(/\s+/g, ' ')
    // Trim whitespace from ends
    .trim()
    // Replace spaces with dashes
    .replace(/\s/g, '-')
    // Remove multiple consecutive dashes
    .replace(/-+/g, '-')
    // Remove dashes from start and end
    .replace(/^-+|-+$/g, '');
}

/**
 * Generates a Chaching search URL for a given product title
 * 
 * @param {string} productTitle - The product title to search for
 * @returns {string} The complete Chaching search URL
 * 
 * @example
 * generateChachingUrl("Nike Air Max 90")
 * // Returns: "https://chaching.me/us/search?query=Nike-Air-Max-90"
 */
function generateChachingUrl(productTitle) {
  const sanitizedTitle = sanitizeProductTitle(productTitle);
  
  if (!sanitizedTitle) {
    console.error('[Utils] Failed to generate URL: Invalid product title');
    return CONFIG.CHACHING_BASE_URL;
  }

  return `${CONFIG.CHACHING_BASE_URL}?query=${encodeURIComponent(sanitizedTitle)}`;
}

/**
 * Validates if a string is a valid product title
 * 
 * @param {string} title - The title to validate
 * @returns {boolean} True if the title is valid, false otherwise
 */
function isValidProductTitle(title) {
  if (!title || typeof title !== 'string') {
    return false;
  }

  const trimmedTitle = title.trim();
  return trimmedTitle.length >= CONFIG.MIN_TITLE_LENGTH && 
         trimmedTitle.length <= CONFIG.MAX_TITLE_LENGTH;
}

/**
 * Debounces a function to prevent excessive calls
 * 
 * @param {Function} func - The function to debounce
 * @param {number} delay - The delay in milliseconds
 * @returns {Function} The debounced function
 */
function debounce(func, delay = CONFIG.DEBOUNCE_DELAY) {
  let timeoutId;
  
  return function debounced(...args) {
    const context = this;
    
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func.apply(context, args);
    }, delay);
  };
}

/**
 * Extracts domain name from a URL
 * 
 * @param {string} url - The URL to extract domain from
 * @returns {string} The domain name or empty string if invalid
 * 
 * @example
 * extractDomain("https://www.amazon.com/product/123")
 * // Returns: "amazon"
 */
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    
    // Remove www. prefix if present
    const domain = hostname.replace(/^www\./, '');
    
    // Extract the main domain name (e.g., "amazon" from "amazon.com")
    const parts = domain.split('.');
    return parts.length > 1 ? parts[parts.length - 2] : parts[0];
  } catch (error) {
    console.error('[Utils] Failed to extract domain:', error);
    return '';
  }
}

/**
 * Logs a message with consistent formatting
 * 
 * @param {string} level - Log level (info, warn, error)
 * @param {string} module - Module name
 * @param {string} message - Log message
 * @param {*} [data] - Optional data to log
 */
function log(level, module, message, data) {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${module}]`;
  
  switch (level) {
    case 'info':
      console.log(`${prefix} ${message}`, data || '');
      break;
    case 'warn':
      console.warn(`${prefix} ${message}`, data || '');
      break;
    case 'error':
      console.error(`${prefix} ${message}`, data || '');
      break;
    default:
      console.log(`${prefix} ${message}`, data || '');
  }
}

/**
 * Creates a throttled version of a function
 * 
 * @param {Function} func - The function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} The throttled function
 */
function throttle(func, limit) {
  let inThrottle;
  let lastResult;
  
  return function throttled(...args) {
    const context = this;
    
    if (!inThrottle) {
      inThrottle = true;
      lastResult = func.apply(context, args);
      
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
    
    return lastResult;
  };
}

// Export functions for use in other modules
// Note: In Chrome extensions, we'll use these as global functions
if (typeof window !== 'undefined') {
  window.ChachingUtils = {
    CONFIG,
    sanitizeProductTitle,
    generateChachingUrl,
    isValidProductTitle,
    debounce,
    throttle,
    extractDomain,
    log
  };
} 