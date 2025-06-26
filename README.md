# ChaChing Product Searcher - Chrome Extension (v3.0)

An intelligent Chrome extension that dynamically detects product detail pages for a curated list of brands and offers to find the best cashback deals on [ChaChing.me](https://chaching.me).

This extension has been re-architected to use a modern, event-driven model. It programmatically injects its logic when needed, ensuring minimal performance impact and robust operation, even on complex, modern websites. It is designed to "win the z-index war" and reliably appear on top of other page content.

---

## ✨ Key Features

-   **Event-Driven Architecture**: The extension is controlled by a background service worker that listens for navigation events. It no longer runs code on every single page load.
-   **Programmatic Injection**: The detection scripts and UI are injected into a page only when the background script determines it's a potential shopping site, making the extension incredibly lightweight and efficient.
-   **Robust Brand Detection**: The core "voting" system remains, using multiple on-page signals to accurately determine the brand of a product. This is now triggered on-demand by the background script.
-   **Conflict-Resistant UI**: The notification is rendered inside a **Shadow DOM**, completely isolating its styles from the host page's CSS to prevent conflicts.
-   **Dynamic Z-Index Management**: Employs a sophisticated strategy to always appear on top. It uses a `MutationObserver` to watch for new elements being added to the page (like other extension popups) and dynamically recalculates its `z-index` to be one higher than the highest value on the page.
-   **Dynamic Cashback Display**: The notification badge dynamically shows the specific cashback percentage for the detected brand, which is managed in a central `brands.js` file.
-   **Extensive Code Comments**: The codebase is now heavily commented to explain the "why" behind the code, not just the "what."

---

## 🚀 For a New Developer: Getting Started in 30 Minutes

Your goal is to understand the project's new architecture and be able to confidently make changes.

### 1. The Big Picture (5 Minutes)

-   **What it does**: When a user navigates to a new page, the extension's **background script** wakes up. It injects a small script to detect the brand of the product on the page. If a supported brand is found, the background script then injects the main UI to display a notification.
-   **Core Principle**: The logic is now **centrally orchestrated** by the background script. Content scripts are temporary and are injected on a case-by-case basis. This is more efficient and reliable than the old model.
-   **Key Challenge**: The modern web is crowded. Other extensions (like Rakuten) also inject UI. Our primary challenge is to ensure our notification appears reliably *on top*. We solve this by injecting our UI last and by using a `MutationObserver` to dynamically adjust our `z-index` if another element tries to overlay ours.

### 2. File Structure (5 Minutes)

The project organization is key to understanding the new flow.

```
WebExt/
├── src/
│   ├── background/
│   │   └── main.js          # The NEW "BRAIN" of the extension. It orchestrates everything.
│   ├── content/
│   │   ├── main.js          # The UI script. ONLY injected if a brand is found. Manages the notification.
│   │   ├── detector.js      # The brand detection logic. Injected on-demand.
│   │   ├── brands.js        # YOUR BRAND LIST. Contains brand names and cashback levels.
│   │   └── styles.css       # The CSS for the on-page notification.
│   └── shared/
│       └── utils.js         # Shared helper functions.
├── manifest.json            # Main extension config. Now enables "scripting" permission.
└── README.md                # This file.
```

### 3. The Core Logic Flow (10 Minutes)

This is the new, event-driven detection process:

1.  A user navigates to a new URL. The `chrome.tabs.onUpdated` event fires.
2.  **`background/main.js`** catches this event. It checks if the URL is on a short exclusion list (e.g., `google.com`).
3.  If not excluded, the background script uses `chrome.scripting.executeScript` to inject the detector files (`utils.js`, `brands.js`, `detector.js`) into the tab.
4.  It then executes a function in the tab to run `new ProductDetector().detectBrandOnPage()`. The result (a brand object with cashback info, or `null`) is returned to the background script.
5.  **If a supported brand was found**, the background script proceeds. It uses `chrome.scripting.insertCSS` to inject `styles.css` and `chrome.scripting.executeScript` to inject the main UI script, `content/main.js`.
6.  **`content/main.js`** now runs. It creates the notification, populates it with the brand and cashback info, and critically, runs the `getHighestZIndex()` logic to place itself on top of all other content.

### 4. Your Most Common Task: Managing the Brand List (5 Minutes)

This part remains simple:
1.  Open the file: **`src/content/brands.js`**.
2.  Edit the `brands` array. Each entry is now an object with a `name` and a `cashback` level:
    ```javascript
    { name: 'nike', cashback: 12 },
    ```
3.  Save the file and [reload the extension](chrome://extensions/).

### 5. How to Test (5 Minutes)
1.  Load the extension as "unpacked" in `chrome://extensions`.
2.  Open the DevTools console on any webpage (`Ctrl+Shift+I` or `Cmd+Opt+I`).
3.  Click the "gear" icon in DevTools, go to the "Preferences" tab, and under the "Console" section, ensure **"Show timestamps"** is checked. This helps see the timing of events.
4.  Navigate to a product detail page.
5.  Open the **background script's console** by clicking the "service worker" link for the extension in `chrome://extensions`. This is where you will see the main orchestration logs (script injection, brand detection results).
6.  Switch back to the page's console to see the UI script logs.

---

## 📜 License

This project is open-source and available under the [MIT License](LICENSE).

