/**
 * @file src/background/main.js
 * @description The background service worker for the ChaChing Extension.
 *
 * @see {@link https://developer.chrome.com/docs/extensions/mv3/service_workers/}
 *
 * @version 3.0.0
 *
 * **********************************************************************************
 *
 * This script is the central orchestrator for the entire extension.
 * It follows a modern, event-driven architecture. Instead of injecting content
 * scripts into every page via the manifest, this service worker listens for tab
 * updates and programmatically injects scripts only when necessary.
 *
 * ### Core Logic Flow:
 * 1.  **Listen for Navigation**: `chrome.tabs.onUpdated` fires when a user navigates.
 * 2.  **Filter and Validate**: It waits for the page to be 'complete' and checks against
 *     an exclusion list of domains (e.g., google.com) to avoid running on irrelevant pages.
 * 3.  **Inject Detector**: It injects the lightweight brand detection scripts (`detector.js`, etc.)
 *     into the active tab.
 * 4.  **Execute and Get Result**: It executes the `detectBrandOnPage()` function within the
 *     tab and gets the result back.
 * 5.  **Conditional UI Injection**: If, and only if, a supported brand is found, it then
 *     injects the UI scripts (`main.js`) and stylesheets (`styles.css`).
 *
 * This architecture is more performant, secure, and robust. It ensures that the
 * extension has a minimal footprint on non-shopping sites and allows it to reliably
 * place its UI on top of other page elements by injecting it last.
 *
 * **********************************************************************************
 */

/**
 * A central configuration object for settings used throughout the background script.
 * @const {Object}
 */
const CONFIG = {
  /**
   * A global flag to enable or disable analytics logging.
   * @type {boolean}
   */
  ANALYTICS_ENABLED: true,
  /**
   * Defines the colors for the browser action badge.
   * @type {Object}
   */
  BADGE_COLORS: {
    DETECTED: '#4CAF50', // The color for the badge when a product is found.
    ERROR: '#F44336'    // A color for potential error states.
  }
};

/**
 * A Map to store product detection data on a per-tab basis.
 * The key is the tab ID (number), and the value is the detection result object.
 * This is used to pass data to the popup when it opens and to decide if the UI
 * should be injected. Using a Map is efficient for frequent reads and writes.
 * @type {Map<number, Object>}
 */
const detectedProducts = new Map();

/**
 * A list of domains to exclude from script injection.
 * We avoid running on sites where the extension is not relevant (e.g., search engines,
 * social media) or on our own domain to prevent recursive behavior.
 * @const {string[]}
 */
const EXCLUDED_DOMAINS = [
  'chaching.me',      // The extension's own website.
  'google.com',       // Google search and services.
  'youtube.com',      // Video platform.
  'facebook.com',     // Social media.
  'twitter.com',      // Social media.
  'linkedin.com',     // Professional networking.
  'github.com',       // Code hosting.
  'wikipedia.org',    // Encyclopedia.
  'reddit.com',       // Forum.
  'localhost',        // Local development.
  '127.0.0.1'         // Local development.
];

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
 * from content scripts and the popup UI. With the new architecture, this is
 * primarily used for analytics and for the popup to retrieve data.
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Background] Message received:', { type: request.type, sender_tab: sender.tab?.id });
  
  switch (request.type) {
    // A content script is sending an analytics event to be logged.
    case 'TRACK_EVENT':
      trackAnalyticsEvent(request.data);
      sendResponse({ success: true });
      break;
      
    // The popup is requesting the data for its current tab.
    case 'GET_TAB_DATA':
      const tabData = detectedProducts.get(sender.tab?.id);
      sendResponse({ success: true, data: tabData });
      break;
      
    default:
      console.warn('[Background] Received an unknown message type:', request.type);
      sendResponse({ success: false, error: 'Unknown message type' });
  }
  
  return true; // Required for asynchronous `sendResponse`.
});

/**
 * Listens for when a tab is updated (e.g., the user navigates to a new URL).
 * This is now the main trigger for our brand detection logic.
 */
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // We only want to run our logic when the page has finished loading.
  // This prevents us from injecting scripts into a partially-loaded DOM.
  if (changeInfo.status !== 'complete' || !tab.url) {
    return;
  }
  
  // Check if the URL's domain is on our exclusion list.
  try {
    const url = new URL(tab.url);
    if (EXCLUDED_DOMAINS.some(domain => url.hostname.includes(domain))) {
      // Log for debugging but otherwise fail silently.
      console.log(`[Background] Skipping tab ${tabId} on excluded domain: ${url.hostname}`);
      return;
    }
  } catch (error) {
    // This can happen for URLs like 'about:blank' or other internal pages.
    console.warn(`[Background] Could not parse URL, skipping: ${tab.url}`, error);
    return; // Invalid URL, do nothing.
  }

  // Log that we're starting the detection process for this tab.
  console.log(`[Background] Tab ${tabId} updated to complete status. Running detector...`);

  try {
    // Step 1: Inject the detection scripts into the page.
    // These scripts are defined in manifest.json under `web_accessible_resources`.
    // We inject them together to ensure they are all available for the next step.
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: [
        "src/shared/utils.js",
        "src/content/brands.js",
        "src/content/detector.js"
      ],
    });

    // Step 2: Run the detector on the page.
    // We use `executeScript` again, but this time with a `function` property.
    // This function is serialized, sent to the tab, and executed in the
    // content script's isolated world. It has access to the DOM and the
    // scripts we just injected.
    const injectionResults = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      function: () => {
        // This function is executed in the target tab's context.
        const detector = new ProductDetector();
        // The return value of this function is sent back to our background script.
        // It must be JSON-serializable.
        return detector.detectBrandOnPage();
      },
    });

    // The result from the content script is wrapped in an array, one result per frame.
    // Since we're targeting the main frame, we only need the first result.
    const detectionResult = injectionResults[0].result;

    // Step 3: Check the result and conditionally inject the UI.
    if (detectionResult && detectionResult.isSupported) {
      console.log(`[Background] Supported brand "${detectionResult.productInfo.brand}" found on tab ${tabId}. Injecting UI...`);
      
      // Store the result for the popup. This allows the popup to display
      // information about the detected brand without having to re-run detection.
      detectedProducts.set(tabId, {
        ...detectionResult,
        detectedAt: new Date().toISOString(),
        tabId: tabId,
        domain: new URL(tab.url).hostname
      });
      
      // Inject the stylesheet for the notification.
      await chrome.scripting.insertCSS({
        target: { tabId: tabId },
        files: ["src/content/styles.css"],
      });

      // Inject the main UI script that creates and manages the notification.
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ["src/content/main.js"],
      });
      
    } else {
      // If no brand was found, we log it for debugging purposes.
      console.log(`[Background] No supported brand found on tab ${tabId}.`);
      // It's also important to clear any old data for this tab. This handles
      // cases where a user navigates from a product page to a non-product page
      // on the same domain.
      if (detectedProducts.has(tabId)) {
        detectedProducts.delete(tabId);
      }
    }
  } catch (error) {
    // This catch block handles errors from the `chrome.scripting` APIs.
    // This can happen if the page is a special Chrome page (e.g., chrome://),
    // has strict Content Security Policies that block script injection,
    // or if the tab was closed while we were trying to inject.
    console.warn(`[Background] Could not inject scripts into tab ${tabId}:`, error.message);
  }
});

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
 * listeners were to fail for any reason. It checks every 5 minutes for data
 * older than 30 minutes.
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