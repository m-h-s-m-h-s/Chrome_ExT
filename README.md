# ChaChing Browser Extension (v2.0)

An intelligent browser extension that finds the best Cash Back deals from ChaChing, ensuring you never miss out on savings, no matter where you shop online.

This extension uses a modern, event-driven architecture. It programmatically injects its logic onto pages only when needed, ensuring minimal performance impact and maximum compatibility with other extensions.

---

## ✨ Key Features

-   **Event-Driven Architecture**: The extension no longer runs on every page. Its background script listens for navigation events and only injects its logic onto relevant shopping sites, making it highly efficient.
-   **Programmatic Injection**: By injecting its UI last, the extension ensures its notification appears on top of other page elements and competing extension banners.
-   **Robust Overlay Handling**: Implements a sophisticated `MutationObserver` to watch for other extensions trying to add overlays, dynamically re-adjusting its `z-index` to always win the "z-index war."
-   **Shadow DOM Encapsulation**: The UI is rendered inside a Shadow DOM, preventing any style conflicts with the host page or other extensions.
-   **Brand-Focused Detection**: Uses a robust "voting" system to accurately determine the brand of a product on a page. It scans for all potential brand mentions and then determines which of the **officially supported brands** has the most evidence.
-   **Dynamic Cashback**: The notification dynamically displays the correct cashback percentage for each specific brand, which is managed in a central list.

---

## 🚀 For a New Developer: Getting Started in 30 Minutes

Your goal is to understand the project and be able to confidently make changes. Here's your quick start guide.

### 1. The Big Picture (5 Minutes)

-   **What it does**: When a user visits a **product detail page**, the extension's background script injects a detector to figure out the **brand**. If the brand is on our supported list, it then injects a UI notification offering to search for that brand on ChaChing.
-   **Core Principle**: The logic is **event-driven and programmatic**. It does *not* use a persistent content script. The background script is the brain, deciding when and where to activate.
-   **Key Challenge**: The web is a battleground for user attention. This extension is architected to be a "good citizen" while still ensuring its notification is visible by loading last and intelligently managing its stacking order (`z-index`).

### 2. File Structure (5 Minutes)

The project is organized into a `src` directory. The architecture is now centered around the background script.

```
WebExt/
├── src/
│   ├── background/
│   │   └── main.js          # The *most important* script. It controls everything.
│   ├── content/
│   │   ├── main.js          # The on-page UI script. Injected only when a brand is found.
│   │   ├── detector.js      # The "brain" for finding the brand on a page.
│   │   ├── brands.js        # YOUR BRAND LIST & CASHBACK LEVELS.
│   │   └── styles.css       # The CSS for the on-page notification.
│   └── shared/
│       └── utils.js         # Shared helper functions.
├── manifest.json            # The main extension configuration file.
└── README.md                # This file.
```

### 3. The Core Logic Flow (10 Minutes)

This is how a detection happens:

1.  A user navigates to a new page. The `tabs.onUpdated` event fires.
2.  **`background/main.js`** catches this event.
3.  It programmatically injects `detector.js` and its dependencies (`utils.js`, `brands.js`) into the tab.
4.  It executes `detector.detectBrandOnPage()` within the tab and gets the result back.
5.  **If and only if** a supported brand is found, the background script then injects `styles.css` and `content/main.js` to show the notification.
6.  **`content/main.js`**, once injected, uses a `MutationObserver` to ensure its `z-index` remains the highest on the page, guaranteeing visibility.

### 4. Your Most Common Task: Managing the Brand List (5 Minutes)

You will frequently need to add, remove, or update brands and their cashback levels.

1.  Open the file: **`src/content/brands.js`**.
2.  The `brands` constant is an array of objects. Each object needs a `name` (lowercase) and a `cashback` (number) property.
    ```javascript
    const brands = [
      { name: 'nike', cashback: 12 },
      { name: 'adidas', cashback: 11 },
      // ... more brands
    ];
    ```
3.  Save the file and [reload the extension](chrome://extensions/).

### 5. How to Test (5 Minutes)
1.  Load the extension as "unpacked" in `chrome://extensions`.
2.  Open the **service worker console** by clicking the "service worker" link for the extension in `chrome://extensions`. This is where all the background script logs will appear.
3.  Open the regular DevTools console (`Cmd+Opt+I`) on a shopping site to see logs from the content scripts *after* they are injected.
4.  Navigate to a product page. Watch the service worker console to see the injection flow and detection results.

---

## 📜 License

This project is open-source and available under the [MIT License](LICENSE).

