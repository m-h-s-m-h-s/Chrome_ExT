/**
 * popup.js - Popup interface logic for Chaching Product Searcher
 * 
 * Manages the popup UI state, handles user interactions, and communicates
 * with the content script and background service worker.
 * 
 * @module popup
 * @author Chaching Product Searcher Extension
 * @version 1.0.0
 */

/**
 * Popup controller class
 * @class PopupController
 */
class PopupController {
  constructor() {
    /**
     * UI Elements
     * @type {Object}
     */
    this.elements = {
      // State containers
      loadingState: document.getElementById('loading-state'),
      noProductState: document.getElementById('no-product-state'),
      productDetectedState: document.getElementById('product-detected-state'),
      manualSearchState: document.getElementById('manual-search-state'),
      
      // Product info elements
      productTitle: document.getElementById('product-title'),
      productPrice: document.getElementById('product-price'),
      confidenceBadge: document.getElementById('confidence-badge'),
      signalList: document.getElementById('signal-list'),
      
      // Buttons
      searchChachingBtn: document.getElementById('search-chaching-btn'),
      copyTitleBtn: document.getElementById('copy-title-btn'),
      manualSearchBtn: document.getElementById('manual-search-btn'),
      manualSearchSubmit: document.getElementById('manual-search-submit'),
      backBtn: document.getElementById('back-btn'),
      settingsLink: document.getElementById('settings-link'),
      
      // Form inputs
      manualSearchInput: document.getElementById('manual-search-input'),
      autoShowToggle: document.getElementById('auto-show-toggle'),
      extensionToggle: document.getElementById('extension-toggle')
    };

    /**
     * Current state data
     * @type {Object}
     */
    this.state = {
      currentTab: null,
      detectionResult: null,
      preferences: {}
    };

    /**
     * Initialize the popup
     */
    this.init();
  }

  /**
   * Initialize the popup controller
   */
  async init() {
    try {
      // Load preferences
      await this.loadPreferences();
      
      // Get current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      this.state.currentTab = tab;
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Request detection results from content script
      await this.requestDetectionResults();
      
    } catch (error) {
      console.error('[Popup] Initialization error:', error);
      this.showError('Failed to initialize extension');
    }
  }

  /**
   * Load user preferences from storage
   */
  async loadPreferences() {
    return new Promise((resolve) => {
      chrome.storage.sync.get({
        enabled: true,
        autoShow: true,
        minConfidence: 50,
        blacklistedDomains: []
      }, (items) => {
        this.state.preferences = items;
        
        // Update UI toggles
        this.elements.autoShowToggle.checked = items.autoShow;
        this.elements.extensionToggle.checked = items.enabled;
        
        console.log('[Popup] Preferences loaded:', items);
        resolve();
      });
    });
  }

  /**
   * Set up event listeners for UI elements
   */
  setupEventListeners() {
    // Search button
    this.elements.searchChachingBtn?.addEventListener('click', () => {
      this.searchOnChaching();
    });

    // Copy title button
    this.elements.copyTitleBtn?.addEventListener('click', () => {
      this.copyProductTitle();
    });

    // Manual search button
    this.elements.manualSearchBtn?.addEventListener('click', () => {
      this.showManualSearch();
    });

    // Manual search form
    this.elements.manualSearchSubmit?.addEventListener('click', () => {
      this.performManualSearch();
    });

    this.elements.manualSearchInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.performManualSearch();
      }
    });

    // Back button
    this.elements.backBtn?.addEventListener('click', () => {
      this.hideManualSearch();
    });

    // Settings link
    this.elements.settingsLink?.addEventListener('click', (e) => {
      e.preventDefault();
      this.openSettings();
    });

    // Toggle switches
    this.elements.autoShowToggle?.addEventListener('change', (e) => {
      this.updatePreference('autoShow', e.target.checked);
    });

    this.elements.extensionToggle?.addEventListener('change', (e) => {
      this.updatePreference('enabled', e.target.checked);
    });
  }

  /**
   * Request detection results from the content script
   */
  async requestDetectionResults() {
    try {
      // First check if content script is injected
      const response = await chrome.tabs.sendMessage(this.state.currentTab.id, {
        type: 'GET_DETECTION_RESULT'
      });

      if (response?.success && response.data) {
        this.state.detectionResult = response.data;
        this.displayDetectionResult();
      } else {
        // No product detected
        this.showNoProductState();
      }
    } catch (error) {
      console.error('[Popup] Failed to get detection result:', error);
      
      // Content script might not be injected (e.g., chrome:// pages)
      if (error.message?.includes('Could not establish connection')) {
        this.showNoProductState('Extension cannot run on this page');
      } else {
        this.showNoProductState();
      }
    }
  }

  /**
   * Display the detection result in the UI
   */
  displayDetectionResult() {
    const { productInfo, confidence, signals } = this.state.detectionResult;

    // Hide loading state
    this.hideAllStates();

    if (this.state.detectionResult.isProductPage && productInfo.title) {
      // Show product detected state
      this.elements.productDetectedState.classList.remove('hidden');

      // Update product info
      this.elements.productTitle.textContent = productInfo.title;
      
      if (productInfo.price) {
        this.elements.productPrice.textContent = productInfo.price;
        this.elements.productPrice.style.display = 'inline-block';
      } else {
        this.elements.productPrice.style.display = 'none';
      }

      this.elements.confidenceBadge.textContent = `${confidence}% confidence`;

      // Display detection signals
      this.displaySignals(signals);
    } else {
      // No product detected
      this.showNoProductState();
    }
  }

  /**
   * Display detection signals
   * @param {Object} signals - Detection signals
   */
  displaySignals(signals) {
    this.elements.signalList.innerHTML = '';

    const signalDescriptions = {
      hasPrice: 'Price information found',
      hasActionButton: 'Shopping actions detected',
      hasProductImage: 'Product images found',
      hasMetadata: 'Product metadata detected',
      hasReviews: 'Customer reviews found',
      hasStructuredData: 'Structured data present',
      hasBreadcrumb: 'Breadcrumb navigation found',
      hasProductUrl: 'Product URL pattern matched'
    };

    for (const [signal, value] of Object.entries(signals)) {
      if (value && signalDescriptions[signal]) {
        const li = document.createElement('li');
        li.textContent = signalDescriptions[signal];
        this.elements.signalList.appendChild(li);
      }
    }
  }

  /**
   * Search on Chaching
   */
  async searchOnChaching() {
    if (!this.state.detectionResult?.productInfo?.title) return;

    const searchUrl = this.generateChachingUrl(this.state.detectionResult.productInfo.title);
    
    // Open in new tab
    chrome.tabs.create({ url: searchUrl });

    // Track event
    chrome.runtime.sendMessage({
      type: 'TRACK_EVENT',
      data: {
        event: 'popup_search',
        product_title: this.state.detectionResult.productInfo.title,
        confidence: this.state.detectionResult.confidence
      }
    });

    // Close popup
    window.close();
  }

  /**
   * Copy product title to clipboard
   */
  async copyProductTitle() {
    if (!this.state.detectionResult?.productInfo?.title) return;

    try {
      await navigator.clipboard.writeText(this.state.detectionResult.productInfo.title);
      
      // Show feedback
      const originalText = this.elements.copyTitleBtn.innerHTML;
      this.elements.copyTitleBtn.innerHTML = '✓ Copied!';
      this.elements.copyTitleBtn.classList.add('btn-success');
      
      setTimeout(() => {
        this.elements.copyTitleBtn.innerHTML = originalText;
        this.elements.copyTitleBtn.classList.remove('btn-success');
      }, 2000);
    } catch (error) {
      console.error('[Popup] Failed to copy:', error);
    }
  }

  /**
   * Show manual search interface
   */
  showManualSearch() {
    this.hideAllStates();
    this.elements.manualSearchState.classList.remove('hidden');
    this.elements.manualSearchInput.focus();
  }

  /**
   * Hide manual search interface
   */
  hideManualSearch() {
    this.elements.manualSearchState.classList.add('hidden');
    if (this.state.detectionResult?.isProductPage) {
      this.elements.productDetectedState.classList.remove('hidden');
    } else {
      this.elements.noProductState.classList.remove('hidden');
    }
  }

  /**
   * Perform manual search
   */
  performManualSearch() {
    const query = this.elements.manualSearchInput.value.trim();
    
    if (!query) {
      this.elements.manualSearchInput.focus();
      return;
    }

    const searchUrl = this.generateChachingUrl(query);
    
    // Open in new tab
    chrome.tabs.create({ url: searchUrl });

    // Track event
    chrome.runtime.sendMessage({
      type: 'TRACK_EVENT',
      data: {
        event: 'manual_search',
        query: query
      }
    });

    // Close popup
    window.close();
  }

  /**
   * Generate Chaching URL
   * @param {string} query - Search query
   * @returns {string} Chaching search URL
   */
  generateChachingUrl(query) {
    const sanitized = query
      .replace(/[^\w\s\-\.]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\s/g, '-');
    
    return `https://chaching.me/us/search?query=${encodeURIComponent(sanitized)}`;
  }

  /**
   * Show no product state
   * @param {string} [message] - Optional custom message
   */
  showNoProductState(message) {
    this.hideAllStates();
    this.elements.noProductState.classList.remove('hidden');
    
    if (message) {
      const p = this.elements.noProductState.querySelector('p');
      if (p) p.textContent = message;
    }
  }

  /**
   * Hide all state containers
   */
  hideAllStates() {
    this.elements.loadingState.classList.add('hidden');
    this.elements.noProductState.classList.add('hidden');
    this.elements.productDetectedState.classList.add('hidden');
    this.elements.manualSearchState.classList.add('hidden');
  }

  /**
   * Update user preference
   * @param {string} key - Preference key
   * @param {*} value - Preference value
   */
  updatePreference(key, value) {
    chrome.storage.sync.set({ [key]: value }, () => {
      console.log(`[Popup] Updated preference: ${key} = ${value}`);
      
      // Send message to content scripts to update
      chrome.tabs.sendMessage(this.state.currentTab.id, {
        type: 'PREFERENCE_UPDATED',
        data: { [key]: value }
      }).catch(() => {
        // Content script might not be injected
      });
    });
  }

  /**
   * Open settings page
   */
  openSettings() {
    chrome.runtime.openOptionsPage();
  }

  /**
   * Show error message
   * @param {string} message - Error message
   */
  showError(message) {
    this.hideAllStates();
    this.elements.noProductState.classList.remove('hidden');
    
    const h2 = this.elements.noProductState.querySelector('h2');
    const p = this.elements.noProductState.querySelector('p');
    
    if (h2) h2.textContent = 'Error';
    if (p) p.textContent = message;
  }
}

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
}); 