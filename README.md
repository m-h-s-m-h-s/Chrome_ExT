# ChaChing Browser Extension (v2.2.0)

An intelligent browser extension that finds the best Cash Back deals from ChaChing, ensuring you never miss out on savings, no matter where you shop online.

This extension is built with a focus on user privacy and efficiency. It uses the minimal set of permissions required to function, activating primarily when the user interacts with it.

---

## 💻 Installation for Development

To install and test this extension locally, follow these steps:

1.  **Open Chrome Extensions**: Type `chrome://extensions/` into your address bar and press Enter.
2.  **Enable Developer Mode**: If it's not already on, toggle the "Developer mode" switch in the top-right corner of the page.
3.  **Load the Extension**:
    -   Click the **"Load unpacked"** button that appears.
    -   In the file selection dialog, navigate to the root directory of this project (`/WebExt/`).
    -   Click the **"Select Folder"** button.

The extension should now be loaded and active. You can make changes to the code and see them reflected by reloading the extension from the `chrome://extensions` page.

---

## ✨ Key Features

-   **Privacy-Focused Permissions**: The extension uses the `activeTab` permission instead of broad `host_permissions`, meaning it only has access to a site when the user actively clicks on the extension icon.
-   **Product Page Detection**: The extension first verifies that you're on a Product Detail Page (PDP) using a confidence scoring system that checks for action buttons, prices, product images, and other e-commerce indicators.
-   **Intelligent Brand Detection**: Once a PDP is confirmed, the extension uses a sophisticated, score-based "voting" system to determine if a supported brand is present on the page.
-   **Accurate Brand Detection**: Uses a robust "voting" system based on **whole-word matching** to accurately identify brands from a dynamically loaded list.
-   **Dynamic Brand & Cashback Management**: The list of supported brands is managed in a simple `BrandList.csv` file, which is loaded dynamically. This allows for easy updates without requiring a new version of the extension. Cashback is displayed as "up to 33%".
-   **Robust Overlay Handling**: Implements a sophisticated `MutationObserver` to watch for other extensions or site elements that might cover the notification, dynamically re-adjusting its `z-index` to always win the "z-index war."
-   **Shadow DOM Encapsulation**: The UI is rendered inside a Shadow DOM, preventing any style conflicts with the host page or other extensions.

---

## 🚀 For a New Developer: Getting Started in 30 Minutes

Your goal is to understand the project and be able to confidently make changes. Here's your quick start guide.

### 1. The Big Picture (5 Minutes)

-   **What it does**: When a user visits a page, a content script is loaded that first checks if it's a Product Detail Page (PDP) by looking for e-commerce indicators like "Add to Cart" buttons and product information. If it's a PDP, it then checks for the presence of supported brands. If both conditions are met, a notification is displayed offering cashback of up to 33%. It also has special handling for a few partner merchant sites.
-   **Core Principle**: The logic is driven by a two-stage detection process: First verify it's a product page, then check for supported brands. The UI is injected only when both conditions are satisfied.
-   **Key Challenge**: The web is a battleground for user attention. This extension is architected to be a "good citizen" while still ensuring its notification is visible by loading last and intelligently managing its stacking order (`z-index`).

### 2. File Structure (5 Minutes)

The project is organized into a `src` directory.

```
WebExt/
├── src/
│   ├── assets/
│   │   └── BrandList.csv      # The master list of all supported brands.
│   ├── background/
│   │   └── main.js          # Handles background tasks and extension events.
│   ├── content/
│   │   ├── main.js          # The on-page UI and main coordination script.
│   │   ├── brand-detector.js  # The "brain" for finding the brand on a page.
│   │   ├── pdp-detector.js    # Logic for detecting if a page is a Product Detail Page.
│   │   ├── brands.js        # Dynamically loads and manages the brand list, preserving original names for display.
│   │   └── styles.css       # The CSS for the on-page notification.
│   └── shared/
│       └── utils.js         # Shared helper functions.
├── manifest.json            # The main extension configuration file.
└── README.md                # This file.
```

### 3. The Core Logic Flow (10 Minutes)

This is how a detection happens:

1.  A user navigates to a new page.
2.  The content scripts defined in `manifest.json` are loaded into the page.
3.  **`brands.js`** is called first. It asynchronously fetches and parses `assets/BrandList.csv`, creating a map where normalized brand names point to the original brand data.
4.  Once the brands are loaded, **`main.js`** initiates the detection process.
5.  **`pdp-detector.js`** first checks if the current page is a Product Detail Page by:
    - Looking for action buttons (add to cart, buy now, etc.) - this is required
    - Calculating a confidence score from other e-commerce signals (price, images, reviews, etc.)
    - Requiring at least 75 points of confidence to be considered a PDP
6.  If it's a PDP, **`brand-detector.js`** runs its strategies to find brand candidates on the page. It uses **whole-word matching** to vote for the best brand.
7.  If both a PDP is detected AND a supported brand is found (or if the site is a special partner site), **`main.js`** injects and displays the notification UI. The UI uses the original brand name from the map.
8.  The UI script uses a `MutationObserver` to ensure its `z-index` remains the highest on the page.

### 4. Your Most Common Task: Managing the Brand List (5 Minutes)

You will frequently need to add or remove brands. This is now much simpler.

1.  Open the file: **`src/assets/BrandList.csv`**.
2.  This is a standard CSV file. Add or remove brand names on new lines. The file has a header row that is ignored.
    ```csv
    "brand_name"
    "Nike"
    "Adidas"
    "Sony"
    ```
3.  Save the file.
4.  [Reload the extension](chrome://extensions/) for the changes to take effect on already-open tabs. New tabs will automatically get the updated list.

### 5. How to Test (5 Minutes)
1.  Load the extension as "unpacked" in `chrome://extensions`.
2.  Open the regular DevTools console (`Cmd+Opt+I`) on a shopping site to see logs from the content scripts.
3.  Navigate to a product page. Watch the console to see the brand loading, detection, and notification logic in action.

---

## 📜 License

This project is open-source and available under the [MIT License](LICENSE).

