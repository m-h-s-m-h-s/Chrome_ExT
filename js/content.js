/**
 * content.js - Main Content Script for Chaching Product Searcher
 * 
 * This script coordinates the product detection and user interface components.
 * It runs on every page, detects product pages, and shows a notification to
 * search for cashback deals on chaching.me.
 * 
 * @module content
 * @author Chaching Product Searcher Extension
 * @version 1.0.0
 */

/**
 * Main content script class that manages the extension's functionality
 * 
 * @class ChachingContentScript
 */
class ChachingContentScript {
  constructor() {
    /**
     * Product detector instance
     * @type {ProductDetector}
     */
    this.detector = new ProductDetector();

    /**
     * Current page detection result
     * @type {Object|null}
     */
    this.detectionResult = null;

    /**
     * Flag to track if notification is already shown
     * @type {boolean}
     */
    this.notificationShown = false;

    /**
     * User preferences loaded from storage
     * @type {Object}
     */
    this.preferences = {
      enabled: true,
      autoShow: true,
      minConfidence: 50,
      blacklistedDomains: []
    };

    /**
     * Initialize the content script
     */
    this.init();
  }

  /**
   * Initializes the content script by loading preferences and starting detection
   */
  async init() {
    try {
      // Load user preferences
      await this.loadPreferences();

      // Check if extension is enabled for this domain
      if (!this.isEnabledForCurrentDomain()) {
        ChachingUtils.log('info', 'ContentScript', 'Extension disabled for this domain');
        return;
      }

      // Wait for page to fully load
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.startDetection());
      } else {
        // DOM already loaded
        this.startDetection();
      }

      // Listen for messages from popup/background
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        this.handleMessage(request, sender, sendResponse);
        return true; // Keep message channel open for async response
      });

      // Listen for URL changes (for single-page applications)
      this.observeUrlChanges();

    } catch (error) {
      ChachingUtils.log('error', 'ContentScript', 'Initialization failed', error);
    }
  }

  /**
   * Loads user preferences from Chrome storage
   */
  async loadPreferences() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(this.preferences, (items) => {
        this.preferences = { ...this.preferences, ...items };
        ChachingUtils.log('info', 'ContentScript', 'Preferences loaded', this.preferences);
        resolve();
      });
    });
  }

  /**
   * Checks if the extension is enabled for the current domain
   * 
   * @returns {boolean} True if enabled
   */
  isEnabledForCurrentDomain() {
    const currentDomain = ChachingUtils.extractDomain(window.location.href);
    return this.preferences.enabled && 
           !this.preferences.blacklistedDomains.includes(currentDomain);
  }

  /**
   * Starts the product page detection process
   */
  startDetection() {
    // Debounced detection to avoid multiple rapid calls
    const detectPage = ChachingUtils.debounce(() => {
      ChachingUtils.log('info', 'ContentScript', 'Starting product detection');
      
      // Run detection
      this.detectionResult = this.detector.detectProductPage();
      
      // Handle detection result
      if (this.detectionResult.isProductPage && 
          this.detectionResult.confidence >= this.preferences.minConfidence) {
        
        ChachingUtils.log('info', 'ContentScript', 'Product page detected', {
          confidence: this.detectionResult.confidence,
          title: this.detectionResult.productInfo.title
        });

        // Show notification if auto-show is enabled
        if (this.preferences.autoShow && !this.notificationShown) {
          this.showNotification();
        }

        // Notify background script
        this.notifyBackgroundScript();
      } else {
        ChachingUtils.log('info', 'ContentScript', 'Not a product page or low confidence', {
          confidence: this.detectionResult.confidence
        });
      }
    }, 500);

    // Run detection
    detectPage();
  }

  /**
   * Shows the Chaching search notification on the page
   */
  showNotification() {
    // Prevent duplicate notifications
    if (this.notificationShown || !this.detectionResult?.productInfo?.title) {
      return;
    }

    // Create notification element
    const notification = this.createNotificationElement();
    
    // Add to page
    document.body.appendChild(notification);
    this.notificationShown = true;

    // Animate in
    setTimeout(() => {
      notification.classList.add('chaching-show');
    }, 100);

    // Auto-hide after delay (unless user interacts)
    setTimeout(() => {
      if (!notification.classList.contains('chaching-hover')) {
        this.hideNotification(notification);
      }
    }, 8000);
  }

  /**
   * Creates the notification DOM element
   * 
   * @returns {HTMLElement} The notification element
   */
  createNotificationElement() {
    const notification = document.createElement('div');
    notification.className = 'chaching-notification';
    notification.innerHTML = `
      <div class="chaching-notification-content">
        <div class="chaching-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7V12C2 16.5 4.5 20.74 8.5 22.5L12 24L15.5 22.5C19.5 20.74 22 16.5 22 12V7L12 2Z" fill="#4CAF50"/>
            <path d="M12 6L14.5 11L20 11.5L16 15L17 20.5L12 18L7 20.5L8 15L4 11.5L9.5 11L12 6Z" fill="white"/>
          </svg>
        </div>
        <div class="chaching-text">
          <div class="chaching-title">Find cashback deals!</div>
          <div class="chaching-subtitle">Search for "${this.truncateTitle(this.detectionResult.productInfo.title)}" on Chaching</div>
        </div>
        <div class="chaching-actions">
          <button class="chaching-btn chaching-btn-primary" id="chaching-search">
            Search Now
          </button>
          <button class="chaching-btn chaching-btn-secondary" id="chaching-close">
            ✕
          </button>
        </div>
      </div>
      <div class="chaching-confidence">
        Confidence: ${this.detectionResult.confidence}%
      </div>
    `;

    // Add event listeners
    notification.querySelector('#chaching-search').addEventListener('click', () => {
      this.searchOnChaching();
      this.hideNotification(notification);
    });

    notification.querySelector('#chaching-close').addEventListener('click', () => {
      this.hideNotification(notification);
    });

    // Track hover state
    notification.addEventListener('mouseenter', () => {
      notification.classList.add('chaching-hover');
    });

    notification.addEventListener('mouseleave', () => {
      notification.classList.remove('chaching-hover');
    });

    return notification;
  }

  /**
   * Truncates long product titles for display
   * 
   * @param {string} title - The product title
   * @returns {string} Truncated title
   */
  truncateTitle(title) {
    const maxLength = 50;
    if (title.length <= maxLength) return title;
    return title.substring(0, maxLength - 3) + '...';
  }

  /**
   * Hides and removes the notification
   * 
   * @param {HTMLElement} notification - The notification element
   */
  hideNotification(notification) {
    notification.classList.remove('chaching-show');
    notification.classList.add('chaching-hide');
    
    setTimeout(() => {
      notification.remove();
    }, 300);
  }

  /**
   * Opens Chaching search for the detected product
   */
  searchOnChaching() {
    if (!this.detectionResult?.productInfo?.title) {
      ChachingUtils.log('error', 'ContentScript', 'No product title available for search');
      return;
    }

    const chachingUrl = ChachingUtils.generateChachingUrl(this.detectionResult.productInfo.title);
    
    // Track search event
    this.trackEvent('search_initiated', {
      product_title: this.detectionResult.productInfo.title,
      confidence: this.detectionResult.confidence,
      source_domain: window.location.hostname
    });

    // Open in new tab
    window.open(chachingUrl, '_blank');
  }

  /**
   * Notifies the background script about the detection
   */
  notifyBackgroundScript() {
    chrome.runtime.sendMessage({
      type: 'PRODUCT_DETECTED',
      data: {
        url: window.location.href,
        title: this.detectionResult.productInfo.title,
        confidence: this.detectionResult.confidence,
        productInfo: this.detectionResult.productInfo
      }
    });
  }

  /**
   * Handles messages from other extension components
   * 
   * @param {Object} request - The message request
   * @param {Object} sender - The message sender
   * @param {Function} sendResponse - Function to send response
   */
  handleMessage(request, sender, sendResponse) {
    ChachingUtils.log('info', 'ContentScript', 'Message received', request);

    switch (request.type) {
      case 'GET_DETECTION_RESULT':
        sendResponse({
          success: true,
          data: this.detectionResult
        });
        break;

      case 'TRIGGER_SEARCH':
        this.searchOnChaching();
        sendResponse({ success: true });
        break;

      case 'SHOW_NOTIFICATION':
        if (!this.notificationShown && this.detectionResult?.isProductPage) {
          this.showNotification();
        }
        sendResponse({ success: true });
        break;

      case 'RE_DETECT':
        this.notificationShown = false;
        this.startDetection();
        sendResponse({ success: true });
        break;

      default:
        sendResponse({ success: false, error: 'Unknown message type' });
    }
  }

  /**
   * Observes URL changes for single-page applications
   */
  observeUrlChanges() {
    let lastUrl = window.location.href;
    
    // Check for URL changes periodically
    setInterval(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        ChachingUtils.log('info', 'ContentScript', 'URL changed, re-detecting');
        
        // Reset state
        this.notificationShown = false;
        this.detectionResult = null;
        
        // Remove any existing notifications
        document.querySelectorAll('.chaching-notification').forEach(el => el.remove());
        
        // Re-run detection
        setTimeout(() => this.startDetection(), 1000);
      }
    }, 1000);
  }

  /**
   * Tracks analytics events
   * 
   * @param {string} eventName - The event name
   * @param {Object} eventData - Additional event data
   */
  trackEvent(eventName, eventData) {
    chrome.runtime.sendMessage({
      type: 'TRACK_EVENT',
      data: {
        event: eventName,
        ...eventData,
        timestamp: new Date().toISOString()
      }
    });
  }
}

// Initialize the content script when the extension loads
if (typeof window !== 'undefined' && !window.chachingContentScript) {
  window.chachingContentScript = new ChachingContentScript();
} 