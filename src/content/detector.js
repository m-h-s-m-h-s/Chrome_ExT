/**
 * @file src/content/detector.js
 * @description The brand detection engine for the ChaChing Extension.
 *
 * @version 3.0.0
 *
 * **********************************************************************************
 *
 * This script is injected on-demand by the background script. Its purpose is to
 * analyze the DOM of a webpage and determine, with a reasonable degree of certainty,
 * which brand's product is being displayed.
 *
 * It uses a pure "voting" system to make its final decision:
 * 1.  **Gather Candidates**: It runs multiple independent "strategies" to find any
 *     and all text on the page that *could* be a brand name. This includes checking
 *     meta tags, structured data (JSON-LD), titles, breadcrumbs, and more.
 * 2.  **Tally Votes**: It then iterates through our official list of supported brands
 *     (from `brands.js`). For each supported brand, it checks how many of the
 *     candidates found on the page contain that brand's name.
 * 3.  **Declare Winner**: The supported brand with the most "votes" is declared the
 *     winner.
 *
 * This approach is robust because it doesn't rely on a single, fragile CSS selector.
 * Even if one strategy fails, the others can still provide enough evidence to
 * make a correct determination.
 *
 * **********************************************************************************
 */

/**
 * The ProductDetector class encapsulates all logic for detecting product pages.
 * It uses a weighted scoring system based on a variety of positive and negative
 * signals found on the page.
 * 
 * @class ProductDetector
 */
class ProductDetector {
  /**
   * Initializes the detector. Currently, the constructor is empty as the
   * indicators and weights have been deprecated in favor of the voting system,
   * but the class structure is kept for clarity and future expansion.
   */
  constructor() {
    /**
     * A comprehensive dictionary of keywords, patterns, and selectors that serve as
     * indicators for different page elements. This is the "knowledge base" of the detector.
     * @type {Object}
     */
    this.indicators = {
      // Price-related patterns, covering various currencies and formats.
      pricePatterns: [
        /\$\s*[\d,]+\.?\d*/,     // USD: $99.99
        /€\s*[\d,]+\.?\d*/,      // EUR: €99.99
        /£\s*[\d,]+\.?\d*/,      // GBP: £99.99
        /¥\s*[\d,]+\.?\d*/,      // JPY/CNY: ¥999
        /₹\s*[\d,]+\.?\d*/,      // INR: ₹999
        /R\$\s*[\d,]+\.?\d*/,    // BRL: R$99.99
        /\d+\.\d{2}\s*(USD|EUR|GBP|CAD|AUD)/, // e.g., 99.99 USD
        /price[:\s]+[\d,]+\.?\d*/i, // "Price: 99.99"
        /cost[:\s]+[\d,]+\.?\d*/i,
        /msrp[:\s]+[\d,]+\.?\d*/i
      ],

      // Keywords found in interactive elements that signal e-commerce functionality.
      actionButtons: [
        'add to cart', 'add to basket', 'add to bag', 'buy now', 'buy it now',
        'purchase', 'add to wishlist', 'save for later', 'preorder', 'pre-order',
        'notify me', 'out of stock', 'sold out', 'check availability'
      ],

      // Common fragments found in the ID or CLASS attributes of action buttons.
      actionButtonAttributes: [
        'add-to-cart', 'addtocart', 'product-add', 'buy-now', 'add_to_cart'
      ],

      // Common labels for product-specific details.
      productMetadata: [
        'sku', 'model', 'upc', 'isbn', 'asin', 'product code', 'item number',
        'part number', 'style', 'color', 'size', 'quantity', 'in stock',
        'availability', 'ships from', 'sold by', 'fulfilled by'
      ],

      // Indicators of user reviews and ratings sections.
      reviewIndicators: [
        'reviews', 'ratings', 'stars', 'customer reviews', 'product reviews',
        'rating', 'rated', 'out of 5', '★', '☆' // Star symbols
      ],

      // Structured Data types (from Schema.org) that are strong PDP signals.
      structuredDataTypes: ['Product', 'Offer', 'AggregateRating', 'Review'],

      // --- Negative Signals: Heuristics for Search/Category Pages ---
      // These keywords strongly suggest the page is a list of products, not a single product.
      searchPageKeywords: [
        'search results for', 'products found', 'items found', 'sort by', 'filter by',
        'view all', 'shop all', 'showing 1-', 'of over', 'of about', 'items per page'
      ]
    };

    /**
     * The scoring system. Each signal has a weight. The final score is a sum of the
     * weights of all detected signals. Negative weights are penalties for signals
     * that indicate a non-PDP page.
     * @type {Object}
     */
    this.weights = {
      // --- Positive Weights ---
      price: 25,            // Finding a price is a very strong signal.
      actionButton: 20,     // E-commerce buttons are a strong signal.
      productTitle: 15,     // A clear title is important.
      productImage: 10,     // Product pages usually have prominent images.
      metadata: 5,          // Details like SKU/model are a good sign.
      reviews: 10,          // A reviews section is common on PDPs.
      structuredData: 15,   // JSON-LD for 'Product' is a very reliable signal.
      urlPattern: 5,        // URL contains '/product/', '/dp/', etc.
      breadcrumb: 5,        // Breadcrumbs help confirm page hierarchy.

      // --- Negative Weights ---
      searchPageSignal: -20, // Penalty for finding search page keywords.
      // A scaling penalty applied for each distinct product-like item found.
      penaltyPerProduct: -5
    };

    /**
     * The confidence score is the final calculated score. If it exceeds this threshold,
     * the page is considered a product page. This value is tuned to balance sensitivity
     * (finding all PDPs) and specificity (not flagging non-PDPs).
     * @type {number}
     */
    this.confidenceThreshold = 50;
  }

  /**
   * The main detection method. It orchestrates the brand discovery and voting process.
   * This is the primary entry point called by the background script after injection.
   *
   * @returns {Object|null} If a supported brand wins the vote, it returns a result object
   * containing the brand's name, cashback, and the page title. Otherwise, it returns null.
   */
  detectBrandOnPage() {
    ChachingUtils.log('info', 'Detector', 'Starting brand detection...');
    
    // Step 1: Gather all possible brand mentions from the page.
    const candidates = this.findAllBrandCandidates();
    // Step 2: Tally votes and determine the winning *supported* brand.
    const bestBrand = this.determineBestBrandByVotes(candidates);
    
    if (bestBrand) {
      // The winner is now the full brand object from our map.
      ChachingUtils.log('info', 'Detector', `SUCCESS: Determined best brand is "${bestBrand.name}".`);
      const title = this.extractProductTitle();
      return {
        isSupported: true,
        productInfo: { 
          brand: bestBrand.name, 
          title: title,
          cashback: bestBrand.cashback // Pass cashback level
        }
      };
    }
    
    ChachingUtils.log('info', 'Detector', 'No supported brand won the vote on this page.');
    return null;
  }
  
  /**
   * Aggregates all potential brand candidates from a product detail page using multiple strategies.
   * This function's sole purpose is to gather as much evidence as possible. Each strategy
   * adds potential brand names to the `candidates` array.
   *
   * @returns {string[]} An array of all found brand name candidates, including duplicates.
   */
  findAllBrandCandidates() {
    let candidates = [];

    // Strategy 1: Structured Data (JSON-LD)
    // This is often the most reliable source if present. We look for a <script> tag
    // with type "application/ld+json" and parse it to find a `brand` property.
    const structuredDataScript = document.querySelector('script[type="application/ld+json"]');
    if (structuredDataScript) {
        try {
            const data = JSON.parse(structuredDataScript.textContent);
            const brand = data.brand?.name || data.brand;
            if (typeof brand === 'string' && brand.trim()) candidates.push(brand.trim());
        } catch (e) { /* Ignore parsing errors, as the JSON may be malformed. */ }
    }

    // Strategy 2: Page Title Search
    // We iterate through our list of supported brands and check if any of them
    // appear in the product title. We use a regex with word boundaries (\\b)
    // to ensure we match whole words only (e.g., "levis" not "levinson").
    const productTitle = this.extractProductTitle();
    if (productTitle) {
      const lowerCaseTitle = productTitle.toLowerCase();
      SUPPORTED_BRANDS_ARRAY.forEach(brand => {
        // Use a regex with word boundaries (\\b) to ensure whole-word matching.
        // This prevents 'levis' from matching inside 'levinson'.
        const brandRegex = new RegExp(`\\b${brand}\\b`, 'i'); // Case-insensitive regex
        if (brandRegex.test(lowerCaseTitle)) {
          const match = lowerCaseTitle.match(brandRegex);
          if (match) {
            // Find the original casing from the title for accuracy.
            const originalCasingBrand = productTitle.substring(match.index, match.index + match[0].length);
            candidates.push(originalCasingBrand);
            ChachingUtils.log('info', 'Detector', `Found candidate from title via regex: "${originalCasingBrand}"`);
          }
        }
      });
    }

    // Strategy 3: Open Graph Meta Tags
    // Social sharing meta tags like `og:brand` or `product:brand` are strong indicators.
    const ogBrandElement = document.querySelector('meta[property="product:brand"], meta[property="og:brand"]');
    if (ogBrandElement && ogBrandElement.content) candidates.push(ogBrandElement.content.trim());

    // Strategy 4: Semantic HTML Attributes
    // We check for common HTML5 microdata attributes (`itemprop`) and other
    // `data-*` attributes or class names that are commonly used for brands.
    const brandSelectors = ['[itemprop="brand"] [itemprop="name"]', '[itemprop="brand"]', '[data-product-brand]', '.product-brand', '[class*="brand-name"]'];
    for (const selector of brandSelectors) {
      const element = document.querySelector(selector);
      if (element && element.innerText?.trim()) candidates.push(element.innerText.trim());
    }

    // Strategy 5: Visible Key-Value Pairs
    // Look for text elements (like <span> or <th>) that contain the word "Brand"
    // and then try to extract the text from the element that follows.
    const potentialLabels = document.querySelectorAll('span, dt, th, b, strong');
    for (const label of potentialLabels) {
        if (label.innerText?.trim().toLowerCase().startsWith('brand')) {
            let valueElement = label.nextElementSibling;
            // Robustly find the value, even if it's not an immediate sibling.
            if (!valueElement && label.parentElement) valueElement = label.parentElement.nextElementSibling;
            if (valueElement?.firstElementChild) valueElement = valueElement.firstElementChild; // Handle nested values.
            if (valueElement && valueElement.innerText?.trim()) candidates.push(valueElement.innerText.trim());
        }
    }

    // Strategy 6: Breadcrumbs
    // The second-to-last item in a breadcrumb trail is often the brand or category,
    // which can be a useful signal.
    const breadcrumbItems = document.querySelectorAll('[class*="breadcrumb"] a');
    if (breadcrumbItems.length > 1) {
      const brandCandidate = breadcrumbItems[breadcrumbItems.length - 2].innerText.trim();
      if (brandCandidate.length > 2 && !['home', 'products', 'shop'].includes(brandCandidate.toLowerCase())) {
        candidates.push(brandCandidate);
      }
    }

    // Strategy 7: Open Graph Site Name
    // The `og:site_name` can sometimes be the brand name itself, especially on brand homepages.
    const ogSiteName = document.querySelector('meta[property="og:site_name"]');
    if (ogSiteName && ogSiteName.content) candidates.push(ogSiteName.content.trim());
    
    // Strategy 8: Domain Name Extraction
    // As a final fallback, the domain name itself can be a strong clue (e.g., nike.com).
    const domain = this.extractMainDomain(window.location.hostname);
    if (domain) {
        candidates.push(domain);
        ChachingUtils.log('info', 'Detector', `Found candidate from domain: "${domain}"`);
    }
    
    ChachingUtils.log('info', 'Detector', `Found ${candidates.length} total brand candidates:`, candidates);
    return candidates;
  }

  /**
   * Extracts the main part of a domain name, ignoring subdomains and TLDs.
   * e.g., 'www.levi.co.uk' becomes 'levi'. This helps normalize domain-based candidates.
   *
   * @param {string} hostname - The full hostname from the URL.
   * @returns {string|null} The extracted main domain name.
   */
  extractMainDomain(hostname) {
    if (!hostname) return null;
    // This regex is designed to handle common TLDs, including multi-part ones like .co.uk.
    const domainParts = hostname.split('.');
    if (domainParts.length >= 2) {
      // Handles domain.com, domain.co.uk, etc. by taking the part before the TLD.
      return domainParts[domainParts.length - 2];
    }
    return hostname; // Fallback for simple hostnames like 'localhost'.
  }

  /**
   * Determines the most likely brand by counting which supported brand appears most often
   * within a list of candidates found on the page.
   *
   * @param {string[]} candidates - An array of potential brand names found on the page.
   * @returns {Object|null} The winning brand object (including name and cashback) from our supported list, or null.
   */
  determineBestBrandByVotes(candidates) {
    if (!candidates || candidates.length === 0) return null;

    // Use a Map to store the vote count for each of our supported brands.
    const voteCounts = new Map();

    // For each of our officially supported brands, count how many times it appears
    // within the candidates gathered from the page.
    for (const supportedBrandName of SUPPORTED_BRANDS_MAP.keys()) {
      candidates.forEach(candidate => {
        // We normalize both the candidate and the brand name to ensure a
        // case-insensitive and clean comparison.
        // e.g., check if the candidate "Levi's® Premium" includes "levis".
        if (normalizeBrand(candidate).includes(supportedBrandName)) {
          // If it does, cast a vote for that SUPPORTED brand.
          voteCounts.set(supportedBrandName, (voteCounts.get(supportedBrandName) || 0) + 1);
        }
      });
    }

    if (voteCounts.size === 0) {
      ChachingUtils.log('info', 'Detector', 'No supported brands were found within any of the page candidates.');
      return null;
    }

    // Find the supported brand that received the most votes.
    let maxVotes = 0;
    let winningBrandName = null;
    for (const [brandName, votes] of voteCounts.entries()) {
      if (votes > maxVotes) {
        maxVotes = votes;
        winningBrandName = brandName;
      }
    }
    
    if (winningBrandName) {
      ChachingUtils.log('info', 'Detector', `Votes tallied. Winning brand is "${winningBrandName}" with ${maxVotes} votes.`);
      // Return the full brand object from the map, which includes the cashback level.
      return SUPPORTED_BRANDS_MAP.get(winningBrandName);
    }

    return null;
  }

  /**
   * A simplified helper function to extract the product title for context.
   * This is not part of the primary detection logic but provides text for the notification.
   *
   * @returns {string|null} The extracted product title.
   */
  extractProductTitle() {
    const h1Element = document.querySelector('h1');
    if (h1Element && h1Element.innerText?.trim()) return h1Element.innerText.trim();

    const ogTitleElement = document.querySelector('meta[property="og:title"]');
    if (ogTitleElement && ogTitleElement.content) return ogTitleElement.content.trim();

    // The document title is used as a last resort.
    return document.title.trim();
  }

  /**
   * Detects price information on the page, looking in both the body text and meta tags.
   *
   * @returns {Object} An object containing `found` (boolean), `price` (string), and `currency` (string).
   */
  detectPrice() {
    const pageText = document.body.innerText;
    
    for (const pattern of this.indicators.pricePatterns) {
      const match = pageText.match(pattern);
      if (match) {
        // Attempt to extract the currency symbol for more accurate data.
        let currency = 'USD'; // Default currency
        if (match[0].includes('$')) currency = 'USD';
        else if (match[0].includes('€')) currency = 'EUR';
        else if (match[0].includes('£')) currency = 'GBP';
        else if (match[0].includes('¥')) currency = 'JPY';
        else if (match[0].includes('₹')) currency = 'INR';
        else if (match[0].includes('R$')) currency = 'BRL';
        
        return { found: true, price: match[0], currency: currency };
      }
    }

    // As a fallback, check for price information in common e-commerce meta tags.
    const priceMetaTags = [
      'meta[property="product:price:amount"]',
      'meta[property="og:price:amount"]',
      'meta[itemprop="price"]'
    ];

    for (const selector of priceMetaTags) {
      const metaTag = document.querySelector(selector);
      if (metaTag && metaTag.content) {
        return { found: true, price: metaTag.content, currency: this.getCurrencyFromMeta() };
      }
    }

    return { found: false };
  }

  /**
   * Detects common e-commerce action buttons (e.g., "Add to Cart").
   * It checks both actual <button> elements and the general page text as a fallback.
   * It now also checks the ID and CLASS attributes of buttons for more reliability.
   *
   * @returns {boolean} True if any action button indicators are found.
   */
  detectActionButtons() {
    // Prioritize checking actual interactive elements.
    const buttons = document.querySelectorAll('button, input[type="button"], input[type="submit"], a.button, a.btn');
    
    for (const button of buttons) {
      const buttonText = (button.innerText?.toLowerCase() || button.value?.toLowerCase() || '');
      const btnId = button.id?.toLowerCase() || '';
      const btnClass = button.className?.toLowerCase() || '';

      // Check #1: The button's visible text.
      for (const indicator of this.indicators.actionButtons) {
        if (buttonText.includes(indicator)) {
          ChachingUtils.log('info', 'ProductDetector', `Action button found by text: "${indicator}"`);
          return true;
        }
      }

      // Check #2: The button's ID and CLASS attributes.
      // This is often more reliable than visible text.
      for (const attrIndicator of this.indicators.actionButtonAttributes) {
        if (btnId.includes(attrIndicator) || btnClass.includes(attrIndicator)) {
          ChachingUtils.log('info', 'ProductDetector', `Action button found by attribute: "${attrIndicator}"`);
          return true;
        }
      }
    }

    // As a fallback, check the entire page's text content. This can help on pages
    // that use non-standard elements for buttons.
    const pageText = document.body.innerText.toLowerCase();
    return this.indicators.actionButtons.some(indicator => pageText.includes(indicator));
  }

  /**
   * Detects the main product images on the page. It looks for images within common
   * e-commerce gallery containers or those with specific semantic attributes.
   *
   * @returns {Array<string>} An array of URLs for the detected product images (up to 5).
   */
  detectProductImages() {
    const images = [];
    
    // A list of CSS selectors for common product image containers and elements.
    const imageSelectors = [
      'img[class*="product-image"]',
      'img[class*="product-photo"]',
      'img[id*="product-image"]',
      'img[itemprop="image"]', // Schema.org standard
      '.product-images img',
      '.gallery img',
      'picture img',
      'img[data-zoom]',
      'img[data-magnify]'
    ];

    for (const selector of imageSelectors) {
      const imgs = document.querySelectorAll(selector);
      imgs.forEach(img => {
        // Basic filtering to ignore tiny icons or tracking pixels.
        if (img.src && img.width > 100 && img.height > 100) {
          images.push(img.src);
        }
      });
    }

    // Also check the Open Graph image, as it's often a high-quality product shot.
    const ogImage = document.querySelector('meta[property="og:image"]');
    if (ogImage && ogImage.content) {
      images.push(ogImage.content);
    }

    // Return a unique set of image URLs, capped at 5 to keep it manageable.
    return [...new Set(images)].slice(0, 5);
  }

  /**
   * Detects if the page contains common product metadata keywords (e.g., "SKU", "Model").
   *
   * @returns {boolean} True if any metadata keywords are found in the page text.
   */
  detectProductMetadata() {
    const pageText = document.body.innerText.toLowerCase();
    return this.indicators.productMetadata.some(metadata => pageText.includes(metadata));
  }

  /**
   * Detects if the page has a customer reviews or ratings section.
   *
   * @returns {boolean} True if review-related elements or text are found.
   */
  detectReviews() {
    // Check for common review-related text content.
    const pageText = document.body.innerText.toLowerCase();
    const hasReviewText = this.indicators.reviewIndicators.some(indicator =>
      pageText.includes(indicator.toLowerCase())
    );

    // Also check for star rating elements, which are very common.
    const starElements = document.querySelectorAll('[class*="star"], [class*="rating"], [aria-label*="rating"]');
    
    return hasReviewText || starElements.length > 0;
  }

  /**
   * Detects and parses structured data (JSON-LD) on the page. This is a highly reliable
   * source of product information if available.
   *
   * @returns {Object} An object containing `found` (boolean) and `productName` if a
   *                   product schema is detected.
   */
  detectStructuredData() {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    
    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent);
        
        // A helper function to find a 'Product' type in the JSON-LD data,
        // which can sometimes be nested inside a '@graph' array.
        const findProduct = (graph) => graph.find(item =>
          item['@type'] === 'Product' || (Array.isArray(item['@type']) && item['@type'].includes('Product'))
        );

        let productNode = null;
        if (data['@type'] === 'Product') {
          productNode = data;
        } else if (Array.isArray(data['@graph'])) {
          productNode = findProduct(data['@graph']);
        }
        
        if (productNode) {
          return {
            found: true,
            productName: productNode.name,
            brand: productNode.brand?.name || productNode.brand, // Brand can be an object or a string
            price: productNode.offers?.price,
            currency: productNode.offers?.priceCurrency
          };
        }
      } catch (e) {
        // The JSON might be invalid, so we ignore it and continue.
        ChachingUtils.log('warn', 'ProductDetector', 'Could not parse JSON-LD script.', e);
      }
    }

    return { found: false };
  }

  /**
   * Detects common product-related patterns in the page URL (e.g., "/product/").
   *
   * @returns {boolean} True if the URL matches a known product page pattern.
   */
  detectProductUrlPattern() {
    const url = window.location.href.toLowerCase();
    
    const productUrlPatterns = [
      /\/product\//, /\/products\//, /\/item\//, /\/items\//, /\/p\//,
      /\/dp\//,        // Amazon's pattern
      /\/gp\/product/, // Another Amazon pattern
      /\/itm\//,       // eBay's pattern
      /\/ip\//,        // Walmart's pattern
      /[-_]p\d+/,      // e.g., "product-p12345"
      /\/sku[\/-]/, /\/pid[\/-]/, /\/prod\d+/,
      /\/article\//, /\/goods\//
    ];

    return productUrlPatterns.some(pattern => pattern.test(url));
  }

  /**
   * Detects if breadcrumb navigation is present on the page. Breadcrumbs are a good
   * indicator of a structured e-commerce site.
   *
   * @returns {boolean} True if breadcrumb navigation elements are found.
   */
  detectBreadcrumbs() {
    const breadcrumbSelectors = [
      '[class*="breadcrumb"]',
      '[id*="breadcrumb"]',
      'nav[aria-label*="breadcrumb"]', // More semantic selector
      'nav ol',
      'nav ul'
    ];

    for (const selector of breadcrumbSelectors) {
      const element = document.querySelector(selector);
      // Check for the element and common separators.
      if (element && (element.innerText.includes('>') || element.innerText.includes('/'))) {
        return true;
      }
    }

    return false;
  }

  /**
   * A helper function to get currency from meta tags, used as a fallback by detectPrice().
   *
   * @returns {string} The detected currency code (e.g., "USD"), or a default.
   */
  getCurrencyFromMeta() {
    const currencyMeta = document.querySelector('meta[property="product:price:currency"], meta[property="og:price:currency"]');
    return currencyMeta?.content || 'USD'; // Default to USD if not found.
  }
}

// Export the detector class instance for use in content.js
if (typeof window !== 'undefined') {
  window.ProductDetector = ProductDetector;
} 