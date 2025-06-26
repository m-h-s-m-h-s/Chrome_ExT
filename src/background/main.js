/**
 * @file src/background/main.js
 * @description The background service worker for the ChaChing Extension.
 *
 * This script is the persistent "brain" of the extension. It is event-driven
 * and handles tasks that are not tied to a specific webpage's lifecycle.
 *
 * Key Responsibilities:
 * - Handling extension lifecycle events (onInstalled, onUpdated).
 * - Storing tab-specific data (e.g., the detected brand).
 * - Creating the right-click context menu.
 * - Aggregating analytics events.
 *
 * @version 2.2.0
 */

/**
 * A central configuration object for settings used throughout the background script.
 * @const {Object}
 */
const CONFIG = {
  ANALYTICS_ENABLED: true, // A global flag to enable or disable analytics logging.
  BADGE_COLORS: {
    DETECTED: '#4CAF50', // The color for the badge when a product is found.
    ERROR: '#F44336'    // A color for potential error states.
  }
};

/**
 * A Map to store product detection data on a per-tab basis.
 * The key is the tab ID (number), and the value is the detection result object.
 * This is used to pass data to the popup when it opens.
 * @type {Map<number, Object>}
 */
const detectedProducts = new Map();

/**
* Listens for the `onInstalled` event, which fires when the extension is first
* installed, updated to a new version, or when the browser is updated.
*/
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[Background] onInstalled event fired. Reason:', details.reason);
  
  // On first installation, set up the default user preferences in storage.
  if (details.reason === 'install') {
    chrome.storage.sync.set({
      enabled: true,
      autoShow: true,
      minConfidence: 50,
      blacklistedDomains: [],
      installDate: new Date().toISOString(),
      version: chrome.runtime.getManifest().version
    }, () => {
      console.log('[Background] Default preferences have been set.');
    });
    
    // Open a welcome page in a new tab to greet the user.
    chrome.tabs.create({
      url: 'https://chaching.me/welcome?source=chrome-extension'
    });
  }
  
  // If the extension was updated, we can perform migration tasks or show a notification.
  if (details.reason === 'update') {
    const { previousVersion, currentVersion } = {
      previousVersion: details.previousVersion,
      currentVersion: chrome.runtime.getManifest().version
    };
    
    console.log(`[Background] Extension updated from v${previousVersion} to v${currentVersion}.`);
    
    // Example: Show an update notification if it's a major version change.
    if (previousVersion && previousVersion.split('.')[0] !== currentVersion.split('.')[0]) {
      showUpdateNotification(currentVersion);
    }
  }

  // Create the right-click context menu item upon installation.
  // This is placed inside onInstalled to ensure it's only created once.
  chrome.contextMenus.create({
    id: 'search-chaching',
    title: 'Search "%s" on ChaChing', // '%s' is a placeholder for the selected text.
    contexts: ['selection'] // This menu item will only appear when text is selected.
  });
});

/**
 * The central message listener for the extension. It handles all communication
 * from content scripts and the popup UI.
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Background] Message received:', { type: request.type, sender_tab: sender.tab?.id });
  
  switch (request.type) {
    // A content script has detected a product on a page.
    case 'PRODUCT_DETECTED':
      handleProductDetection(request.data, sender.tab);
      sendResponse({ success: true, message: 'Product data received.' });
      break;
      
    // A script is sending an analytics event to be logged.
    case 'TRACK_EVENT':
      trackAnalyticsEvent(request.data);
      sendResponse({ success: true });
      break;
      
    // The popup is requesting the data for its current tab.
    case 'GET_TAB_DATA':
      const tabData = detectedProducts.get(sender.tab?.id);
      sendResponse({ success: true, data: tabData });
      break;
      
    // A script is asking to clear the data for a tab (e.g., on re-detect).
    case 'CLEAR_TAB_DATA':
      if (sender.tab?.id) {
        detectedProducts.delete(sender.tab.id);
        // updateIcon(sender.tab.id, false); // Icon updates disabled for MVP.
      }
      sendResponse({ success: true });
      break;
      
    default:
      console.warn('[Background] Received an unknown message type:', request.type);
      sendResponse({ success: false, error: 'Unknown message type' });
  }
  
  return true; // Required for asynchronous `sendResponse`.
});

/**
 * Handles the data received from a content script when a product is detected.
 * This function stores the data and updates the browser UI (badge text).
 *
 * @param {Object} data - The detection data from the content script.
 * @param {chrome.tabs.Tab} tab - The tab object where the detection occurred.
 */
function handleProductDetection(data, tab) {
  if (!tab?.id) {
    console.warn('[Background] Received product detection from a tab without an ID.', tab);
    return;
  }
  
  console.log(`[Background] Storing product data for tab ${tab.id}:`, data.title);
  
  // Store the complete detection data in our Map, keyed by the tab ID.
  detectedProducts.set(tab.id, {
    ...data,
    detectedAt: new Date().toISOString(),
    tabId: tab.id,
    domain: new URL(tab.url).hostname // Storing domain for potential analytics.
  });
  
  // Update the extension's badge to show the confidence score.
  // This provides immediate visual feedback to the user in the toolbar.
  chrome.action.setBadgeText({
    text: `${data.confidence}%`,
    tabId: tab.id
  });
  
  // Set the background color of the badge for better visibility.
  chrome.action.setBadgeBackgroundColor({
    color: CONFIG.BADGE_COLORS.DETECTED,
    tabId: tab.id
  });
  
  // Log a specific analytics event for the detection.
  trackAnalyticsEvent({
    event: 'product_detected',
    confidence: data.confidence,
    domain: new URL(tab.url).hostname,
    // Add other boolean flags for easier analysis.
    hasPrice: !!data.productInfo.price,
    hasImage: data.productInfo.images.length > 0
  });
}

/**
 * A placeholder function for updating the extension's icon.
 * Currently disabled for the MVP to use Chrome's default icon.
 *
 * @param {number} tabId - The ID of the tab to update the icon for.
 * @param {boolean} isActive - Whether to show the active or inactive icon.
 */
function updateIcon(tabId, isActive) {
  // This functionality is disabled for the MVP. To re-enable, you would uncomment
  // the code below and re-introduce the ICON_STATES to the CONFIG object.
  /*
  const iconSet = isActive ? CONFIG.ICON_STATES.ACTIVE : CONFIG.ICON_STATES.INACTIVE;
  chrome.action.setIcon({ path: iconSet, tabId: tabId });
  */
}

/**
 * Listens for when a tab is closed. We use this to perform garbage collection
 * and remove the data for the closed tab from our `detectedProducts` Map.
 */
chrome.tabs.onRemoved.addListener((tabId) => {
  if (detectedProducts.has(tabId)) {
    detectedProducts.delete(tabId);
    console.log(`[Background] Cleaned up data for closed tab: ${tabId}`);
  }
});

/**
 * Listens for when a tab is updated (e.g., the user navigates to a new URL).
 * We clear the stored data and badge text for that tab to ensure freshness.
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // We only care about events where the URL has changed.
  if (changeInfo.url) {
    if (detectedProducts.has(tabId)) {
      detectedProducts.delete(tabId);
    }
    // Reset the badge text for the new page.
    chrome.action.setBadgeText({ text: '', tabId: tabId });
    console.log(`[Background] Cleared data for tab ${tabId} due to navigation.`);
  }
});

/**
 * A mock analytics tracking function. In a real-world scenario, this would send
 * data to a service like Google Analytics, Mixpanel, or a private analytics endpoint.
 * For now, it just logs the event to the console.
 *
 * @param {Object} eventData - The event data to be logged.
 */
function trackAnalyticsEvent(eventData) {
  if (!CONFIG.ANALYTICS_ENABLED) return;
  
  // Enrich the event data with common properties for better context.
  const enrichedData = {
    ...eventData,
    extensionVersion: chrome.runtime.getManifest().version,
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString()
  };
  
  console.log('[Background] Analytics Event:', enrichedData);
  
  // TODO: Replace with a real analytics service call.
  // Example: fetch('https://analytics.chaching.me/track', { method: 'POST', body: JSON.stringify(enrichedData) });
}

/**
 * Shows a system notification to the user. Used here to announce updates.
 *
 * @param {string} version - The new version number to display in the message.
 */
function showUpdateNotification(version) {
  chrome.notifications.create('update-notification', {
    type: 'basic',
    // In an MVP without icons, we can use a data URI or a bundled HTML file URL.
    // However, for notifications, a proper iconUrl is strongly recommended.
    // Since we removed icons, this might fail silently. A better approach for production
    // would be to keep at least one icon for notifications.
    iconUrl: 'popup.html', // Placeholder, might not render correctly.
    title: 'ChaChing Searcher Updated!',
    message: `Extension updated to version ${version}. Click to see what's new!`,
    buttons: [{ title: 'View Changes' }],
    priority: 1
  });
}

/**
 * Listens for clicks on buttons within our created notifications.
 */
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (notificationId === 'update-notification' && buttonIndex === 0) {
    // Open the changelog page when the "View Changes" button is clicked.
    chrome.tabs.create({ url: 'https://chaching.me/extension-changelog' });
  }
});

/**
 * Listens for clicks on the context menu item we created.
 */
chrome.contextMenus.onClicked.addListener((info, tab) => {
  // Ensure the click was on our specific menu item and that text was selected.
  if (info.menuItemId === 'search-chaching' && info.selectionText) {
    // Sanitize and format the selected text for the search query.
    const query = info.selectionText
      .replace(/[^\w\s\-\.']/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\s/g, '+');
    const searchUrl = `https://chaching.me/us/search?query=${query}`;
    
    chrome.tabs.create({ url: searchUrl });
    
    trackAnalyticsEvent({
      event: 'context_menu_search',
      // Truncate search text for privacy in analytics.
      searchText: info.selectionText.substring(0, 50)
    });
  }
});

/**
 * A periodic task that runs to clean up any stale data from the `detectedProducts` Map.
 * This is a safeguard against memory leaks if the `onRemoved` or `onUpdated` tab
 * listeners were to fail for any reason.
 */
setInterval(() => {
  const now = Date.now();
  const MAX_AGE = 30 * 60 * 1000; // 30 minutes in milliseconds.
  
  for (const [tabId, data] of detectedProducts.entries()) {
    const detectedTime = new Date(data.detectedAt).getTime();
    if (now - detectedTime > MAX_AGE) {
      detectedProducts.delete(tabId);
      console.log(`[Background] Cleaned up stale data for tab (via setInterval): ${tabId}`);
    }
  }
}, 5 * 60 * 1000); // Run this cleanup task every 5 minutes.

console.log('[Background] Service worker initialized successfully.'); 