# ChaChing Product Searcher - Chrome Extension (v2.6)

An intelligent Chrome extension that automatically detects product detail pages for a curated list of brands and offers to find the best cashback deals on [ChaChing.me](https://chaching.me).

This extension uses a brand-focused detection engine, making it lightweight, fast, and accurate. It is performance-optimized to handle a list of 20,000+ brands without any user-facing delay.

---

## ✨ Key Features

-   **Brand-List Focused**: Activates only on product detail pages from a centrally managed list of brands.
-   **Accurate Brand Detection**: Uses a robust "voting" system. It scans the page for all potential brand mentions and then determines which of the **officially supported brands** has the most evidence.
-   **Robust Matching**: The engine uses precise, whole-word matching and a sophisticated domain parser to ensure brands are detected correctly.
-   **High-Performance**: The brand list is stored in a JavaScript `Set` for near-instantaneous lookups.
-   **User-Friendly Notification**: A large, professionally designed notification appears when a supported brand's product is detected.
-   **URL-Specific Cooldown**: To avoid being annoying, once a notification is dismissed on a page, it won't appear again on that *specific URL* for 15 minutes.

---

## 🚀 For a New Developer: Getting Started in 30 Minutes

Your goal is to understand the project and be able to confidently make changes. Here's your quick start guide.

### 1. The Big Picture (5 Minutes)

-   **What it does**: When a user visits a **product detail page**, this extension tries to figure out the **brand** of that product. If the brand is on our supported list, it shows a popup offering to search for that brand on ChaChing.
-   **Core Principle**: The logic is **brand-focused** and designed to answer the question, "Is this a page for a brand we support?" It explicitly ignores search results pages.
-   **Key Challenge**: Websites are messy. The detection logic is built to handle cases where brand names are written differently ("Levi's" vs. "levis"), embedded in longer text, or only implied by the URL (`levi.com`).

### 2. File Structure (5 Minutes)

The project is organized into a `src` directory. Familiarize yourself with this structure:

```
WebExt/
├── src/
│   ├── content/
│   │   ├── main.js          # The *most important* on-page script. It coordinates everything.
│   │   ├── detector.js      # The "brain." Contains all the logic for finding the brand.
│   │   ├── brands.js        # YOUR BRAND LIST. This is the file you will edit most often.
│   │   └── styles.css       # The CSS for the on-page notification.
│   └── shared/
│       └── utils.js         # Shared helper functions (like `normalizeBrand`).
├── manifest.json            # The main extension configuration file.
└── README.md                # This file.
```
*(The `background` and `popup` folders exist but are less critical for understanding the core detection logic.)*

### 3. The Core Logic Flow (10 Minutes)

This is how a detection happens on a product detail page:

1.  **`content/main.js`** is injected into the page.
2.  It calls `detector.detectBrandOnPage()`.
3.  **`content/detector.js`** runs `findAllBrandCandidates()`. This "discovery" phase scans the page using multiple, robust strategies to create a list of every potential brand it can find.
4.  Next, `determineBestBrandByVotes()` runs the "election":
    a. It iterates through **your official brand list** from `brands.js`.
    b. For each of your brands, it counts how many of the candidates found on the page *contain* that brand name.
    c. The brand from your list with the most mentions wins the vote.
5.  The winning, clean brand name is returned to `content/main.js`, which then shows the notification.

### 4. Your Most Common Task: Managing the Brand List (5 Minutes)

You will frequently need to add or remove brands. This is designed to be simple:
1.  Open the file: **`src/content/brands.js`**.
2.  Add or remove brand names (in lowercase) from the `brandsArray`.
3.  Save the file and [reload the extension](chrome://extensions/). That's it.

### 5. How to Test (5 Minutes)
1.  Load the extension as "unpacked" in `chrome://extensions`.
2.  Open the DevTools console (`Ctrl+Shift+I` or `Cmd+Opt+I`).
3.  Navigate to a product detail page for a supported brand.
4.  Look for the log messages from the extension, which start with `[ChaChing]`. They will show you the candidates found and which brand won the "vote." This is the best way to debug if a page isn't working as expected.

---

## 📜 License

This project is open-source and available under the [MIT License](LICENSE).

