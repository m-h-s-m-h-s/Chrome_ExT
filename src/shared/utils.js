/**
 * @file src/shared/utils.js
 * @description A collection of shared utility functions used across the extension.
 *
 * @version 3.0.0
 *
 * These helpers are injected into the content script context and are available
 * to other scripts like the detector and the main UI script.
 */

/**
 * A namespace for our utility functions to avoid polluting the global scope.
 * While the content scripts run in an isolated world, this is still good practice.
 * @namespace ChachingUtils
 */
const ChachingUtils = {
  /**
   * Normalizes a brand name for consistent, case-insensitive matching.
   * This is a critical function for the accuracy of the detection engine.
   *
   * - Converts the string to lowercase.
   * - Removes common special characters and trademarks (e.g., ®, ™, ©).
   * - Trims leading/trailing whitespace.
   *
   * @param {string} brandName - The raw brand name to be normalized.
   * @returns {string} The normalized brand name.
   */
  normalizeBrand(brandName) {
    if (!brandName) return '';
    return brandName
      .toLowerCase()
      .replace(/®|™|©/g, '') // Remove trademark symbols
      .trim();
  },

  /**
   * A simple, standardized logger to prefix all console messages from this extension.
   * This makes it much easier to filter for our extension's logs in the DevTools console.
   *
   * @param {'info' | 'warn' | 'error'} level - The log level.
   * @param {string} component - The name of the component logging the message (e.g., 'ContentScript', 'Detector').
   * @param {string} message - The main log message.
   * @param {...any} [optionalParams] - Additional data to log with the message.
   */
  log(level, component, message, ...optionalParams) {
    const logPrefix = `[ChaChing][${component}]`;
    const styles = {
      info: 'background: #222; color: #bada55',
      warn: 'background: #ffc107; color: #000',
      error: 'background: #dc3545; color: #fff',
    };

    console[level](`%c${logPrefix}`, styles[level] || styles.info, message, ...optionalParams);
  },

  /**
   * Extracts the domain name from a full URL.
   * e.g., "https://www.example.co.uk/page" becomes "example.co.uk".
   *
   * @param {string} url - The full URL.
   * @returns {string} The extracted domain name.
   */
  extractDomain(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch (error) {
      this.log('error', 'Utils', `Failed to extract domain from URL: ${url}`, error);
      return '';
    }
  },

  /**
   * Generates the search URL for chaching.me based on a search query.
   *
   * @param {string} query - The search term (e.g., brand or product title).
   * @returns {string} The full chaching.me search URL.
   */
  generateChachingUrl(query) {
    // URL-encode the query to handle special characters and spaces.
    const encodedQuery = encodeURIComponent(query);
    return `https://chaching.me/us/search?query=${encodedQuery}&source=extension`;
  },

  /**
   * A debounce function that limits the rate at which a function can be called.
   * The function will only be executed after it has not been called for `delay`
   * milliseconds. This is useful for performance-intensive tasks that might be
   * triggered rapidly, such as responding to window resizing or scroll events.
   *
   * @param {Function} func - The function to debounce.
   * @param {number} delay - The debounce delay in milliseconds.
   * @returns {Function} The debounced function.
   */
  debounce(func, delay) {
    let timeoutId;
    return function(...args) {
      // `this` and `args` are captured and applied to the original function.
      const context = this;
      // Clear the previous timeout to reset the timer.
      clearTimeout(timeoutId);
      // Set a new timeout.
      timeoutId = setTimeout(() => {
        func.apply(context, args);
      }, delay);
    };
  }
};

/**
 * Attaches the ChachingUtils namespace to the global `window` object.
 * This makes the utility functions accessible to all other scripts injected
 * into the same content script context.
 */
if (typeof window !== 'undefined') {
  window.ChachingUtils = ChachingUtils;
} 