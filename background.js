/**
 * background.js - Background Service Worker for Chaching Product Searcher
 * 
 * This service worker handles background tasks, message passing between
 * extension components, and manages the extension's lifecycle events.
 * 
 * Key responsibilities:
 * - Handle messages from content scripts
 * - Manage extension icon states
 * - Track analytics events
 * - Handle extension installation/updates
 * 
 * @module background
 * @author Chaching Product Searcher Extension
 * @version 1.0.0
 */

/**
 * Extension configuration
 * @const {Object}
 */
const CONFIG = {
  ANALYTICS_ENABLED: true,
  ICON_STATES: {
    INACTIVE: {
      '16': 'icons/icon16-gray.png',
      '48': 'icons/icon48-gray.png',
      '128': 'icons/icon128-gray.png'
    },
    ACTIVE: {
      '16': 'icons/icon16.png',
      '48': 'icons/icon48.png',
      '128': 'icons/icon128.png'
    }
  },
  BADGE_COLORS: {
    DETECTED: '#4CAF50',
    ERROR: '#F44336'
  }
};

/**
 * Track detected products per tab
 * @type {Map<number, Object>}
 */
const detectedProducts = new Map();

/**
 * Installation event handler
 * Runs when the extension is installed or updated
 */
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[Background] Extension installed/updated', details);
  
  // Set default preferences on first install
  if (details.reason === 'install') {
    chrome.storage.sync.set({
      enabled: true,
      autoShow: true,
      minConfidence: 50,
      blacklistedDomains: [],
      installDate: new Date().toISOString(),
      version: chrome.runtime.getManifest().version
    }, () => {
      console.log('[Background] Default preferences set');
    });
    
    // Open welcome page
    chrome.tabs.create({
      url: 'https://chaching.me/welcome?source=chrome-extension'
    });
  }
  
  // Handle updates
  if (details.reason === 'update') {
    const previousVersion = details.previousVersion;
    const currentVersion = chrome.runtime.getManifest().version;
    
    console.log(`[Background] Updated from ${previousVersion} to ${currentVersion}`);
    
    // Show update notification if major version change
    if (previousVersion && previousVersion.split('.')[0] !== currentVersion.split('.')[0]) {
      showUpdateNotification(currentVersion);
    }
  }
});

/**
 * Message handler for communication with content scripts and popup
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Background] Message received:', request.type, sender);
  
  switch (request.type) {
    case 'PRODUCT_DETECTED':
      handleProductDetection(request.data, sender.tab);
      sendResponse({ success: true });
      break;
      
    case 'TRACK_EVENT':
      trackAnalyticsEvent(request.data);
      sendResponse({ success: true });
      break;
      
    case 'GET_TAB_DATA':
      const tabData = detectedProducts.get(sender.tab?.id);
      sendResponse({ success: true, data: tabData });
      break;
      
    case 'CLEAR_TAB_DATA':
      if (sender.tab?.id) {
        detectedProducts.delete(sender.tab.id);
        updateIcon(sender.tab.id, false);
      }
      sendResponse({ success: true });
      break;
      
    default:
      console.warn('[Background] Unknown message type:', request.type);
      sendResponse({ success: false, error: 'Unknown message type' });
  }
  
  return true; // Keep message channel open for async responses
});

/**
 * Handles product detection from content scripts
 * 
 * @param {Object} data - Detection data
 * @param {chrome.tabs.Tab} tab - The tab where product was detected
 */
function handleProductDetection(data, tab) {
  if (!tab) return;
  
  console.log(`[Background] Product detected on tab ${tab.id}:`, data.title);
  
  // Store detection data
  detectedProducts.set(tab.id, {
    ...data,
    detectedAt: new Date().toISOString(),
    tabId: tab.id,
    tabUrl: tab.url,
    domain: new URL(tab.url).hostname
  });
  
  // Update extension icon to show detection
  updateIcon(tab.id, true);
  
  // Update badge with confidence score
  chrome.action.setBadgeText({
    text: `${data.confidence}%`,
    tabId: tab.id
  });
  
  chrome.action.setBadgeBackgroundColor({
    color: CONFIG.BADGE_COLORS.DETECTED,
    tabId: tab.id
  });
  
  // Track detection event
  trackAnalyticsEvent({
    event: 'product_detected',
    confidence: data.confidence,
    domain: new URL(tab.url).hostname,
    hasPrice: !!data.productInfo.price,
    hasImage: data.productInfo.images.length > 0
  });
}

/**
 * Updates the extension icon based on detection state
 * 
 * @param {number} tabId - The tab ID
 * @param {boolean} isActive - Whether a product is detected
 */
function updateIcon(tabId, isActive) {
  const iconSet = isActive ? CONFIG.ICON_STATES.ACTIVE : CONFIG.ICON_STATES.INACTIVE;
  
  chrome.action.setIcon({
    path: iconSet,
    tabId: tabId
  });
}

/**
 * Tab event handlers to clean up data when tabs are closed or updated
 */
chrome.tabs.onRemoved.addListener((tabId) => {
  detectedProducts.delete(tabId);
  console.log(`[Background] Cleaned up data for closed tab ${tabId}`);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Clear detection data when navigating to a new page
  if (changeInfo.url) {
    detectedProducts.delete(tabId);
    updateIcon(tabId, false);
    chrome.action.setBadgeText({ text: '', tabId: tabId });
    console.log(`[Background] Cleared data for tab ${tabId} due to navigation`);
  }
});

/**
 * Tracks analytics events (placeholder - implement actual analytics)
 * 
 * @param {Object} eventData - Event data to track
 */
function trackAnalyticsEvent(eventData) {
  if (!CONFIG.ANALYTICS_ENABLED) return;
  
  // Add common properties
  const enrichedData = {
    ...eventData,
    extensionVersion: chrome.runtime.getManifest().version,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent
  };
  
  console.log('[Background] Analytics event:', enrichedData);
  
  // TODO: Implement actual analytics tracking
  // This could send data to Google Analytics, Mixpanel, or a custom analytics service
  // For now, just log to console
}

/**
 * Shows a notification when the extension is updated
 * 
 * @param {string} version - The new version number
 */
function showUpdateNotification(version) {
  chrome.notifications.create('update-notification', {
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: 'Chaching Product Searcher Updated!',
    message: `Extension updated to version ${version}. Check out the new features!`,
    buttons: [
      { title: 'View Changes' }
    ],
    priority: 1
  });
}

/**
 * Handle notification button clicks
 */
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (notificationId === 'update-notification' && buttonIndex === 0) {
    chrome.tabs.create({
      url: 'https://chaching.me/extension-changelog'
    });
  }
});

/**
 * Context menu for additional functionality
 */
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'search-chaching',
    title: 'Search "%s" on Chaching',
    contexts: ['selection']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'search-chaching' && info.selectionText) {
    const searchUrl = `https://chaching.me/us/search?query=${encodeURIComponent(info.selectionText.replace(/\s+/g, '-'))}`;
    chrome.tabs.create({ url: searchUrl });
    
    trackAnalyticsEvent({
      event: 'context_menu_search',
      searchText: info.selectionText.substring(0, 50) // Truncate for privacy
    });
  }
});

/**
 * Handle extension icon click when no popup is shown
 */
chrome.action.onClicked.addListener((tab) => {
  // This only fires if there's no popup defined
  // Could be used to toggle the extension on/off or trigger detection
  console.log('[Background] Extension icon clicked on tab:', tab.id);
});

/**
 * Periodic cleanup of old detection data
 */
setInterval(() => {
  const now = Date.now();
  const maxAge = 30 * 60 * 1000; // 30 minutes
  
  for (const [tabId, data] of detectedProducts.entries()) {
    const detectedTime = new Date(data.detectedAt).getTime();
    if (now - detectedTime > maxAge) {
      detectedProducts.delete(tabId);
      console.log(`[Background] Cleaned up stale data for tab ${tabId}`);
    }
  }
}, 5 * 60 * 1000); // Run every 5 minutes

console.log('[Background] Service worker initialized'); 