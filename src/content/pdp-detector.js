/**
 * @file src/content/pdp-detector.js
 * @description The Product Detail Page (PDP) detection engine for the ChaChing Extension.
 *
 * This module uses a confidence scoring system to determine if the current page is a 
 * product detail page. It requires the presence of action buttons (add to cart, buy now, etc.)
 * as a hard requirement, then accumulates confidence points from various other signals.
 * 
 * Detection Process:
 * 1. Check for action buttons (required) - if not found, immediately return false
 * 2. Calculate confidence score from other signals (0-180 possible points)
 * 3. Return true if score >= 75 points
 *
 * Troubleshooting:
 * Use the debugDetection() method in the console to see detailed results:
 * ```javascript
 * const detector = new PdpDetector();
 * console.log(detector.debugDetection());
 * ```
 *
 * @version 3.1.0
 */

/**
 * The PdpDetector class encapsulates all logic for detecting product detail pages.
 * It uses a confidence scoring system with action buttons as a mandatory requirement.
 * 
 * Scoring System:
 * - Structured Data with offer: 40 points (very high confidence)
 * - Price found: 25 points (high confidence)
 * - Product URL pattern: 25 points (high confidence)  
 * - Product images: 20 points (medium confidence)
 * - Reviews section: 15 points (medium confidence)
 * - Product description: 15 points (medium confidence)
 * - Breadcrumb navigation: 15 points (medium confidence)
 * - Shipping/delivery info: 15 points (medium confidence)
 * - Product metadata (SKU, etc): 10 points (low confidence)
 * - Product selectors (size/color): 10 points (low confidence)
 * 
 * Total possible: 180 points (requires 75+ to be considered a PDP)
 * 
 * @class PdpDetector
 */
class PdpDetector {
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
        'notify me', 'out of stock', 'sold out', 'check availability',
        'checkout', 'add-to-cart', 'add-to-basket', 'add-to-bag',
        'addtocart', 'addtobasket', 'addtobag', 'add_to_cart', 'add_to_basket', 'add_to_bag',
        'shop now', 'get it now', 'order now', 'reserve', 'add to list',
        'coming soon', 'join waitlist', 'join the waitlist', 'get notified'
      ],

      // Common fragments found in the ID or CLASS attributes of action buttons.
      actionButtonAttributes: [
        'add-to-cart', 'addtocart', 'product-add', 'buy-now', 'add_to_cart',
        'add-to-basket', 'addtobasket', 'add_to_basket', 'add-to-bag', 'addtobag', 'add_to_bag',
        'buy-button', 'purchase-button', 'checkout', 'atc-button', 'atc_button',
        'pdp-button', 'product-button', 'add-button', 'cart-button'
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
      structuredDataTypes: ['Product', 'Offer', 'AggregateRating', 'Review']
    };
  }

  /**
   * The main detection method that determines if the current page is a Product Detail Page.
   * 
   * Requirements:
   * 1. MUST have action buttons (add to cart, buy now, etc.)
   * 2. MUST accumulate at least 75 confidence points from other signals
   *
   * @returns {boolean} True if both requirements are met, false otherwise
   */
  isProductPage() {
    // REQUIREMENT 1: Must have action buttons (add to cart, buy now, etc.)
    const hasActionButtons = this.detectActionButtons();
    if (!hasActionButtons) {
      ChachingUtils.log('info', 'PdpDetector', 'No action buttons found - not a PDP');
      return false;
    }
    
    // REQUIREMENT 2: Calculate confidence score from other signals
    let confidenceScore = 0;
    const signals = {};
    
    // Check for structured data (very high confidence)
    const structuredData = this.detectStructuredData();
    if (structuredData.found && structuredData.hasOffer) {
      confidenceScore += 40;
      signals.structuredData = true;
    }
    
    // Check for price (high confidence)
    if (this.detectPrice().found) {
      confidenceScore += 25;
      signals.price = true;
    }
    
    // Check for product images (medium confidence)
    if (this.detectProductImages()) {
      confidenceScore += 20;
      signals.productImages = true;
    }
    
    // Check for product URL pattern (medium-high confidence)
    if (this.detectProductUrlPattern()) {
      confidenceScore += 25;
      signals.productUrl = true;
    }
    
    // Check for reviews (medium confidence)
    if (this.detectReviews()) {
      confidenceScore += 15;
      signals.reviews = true;
    }
    
    // Check for product description (low-medium confidence)
    if (this.detectProductDescription()) {
      confidenceScore += 15;
      signals.description = true;
    }
    
    // Check for product metadata like SKU, availability (low confidence)
    if (this.detectProductMetadata()) {
      confidenceScore += 10;
      signals.metadata = true;
    }
    
    // Check for product selectors (size, color, etc.) (low confidence)
    if (this.detectProductSelectors()) {
      confidenceScore += 10;
      signals.selectors = true;
    }
    
    // Check for breadcrumbs (medium confidence)
    if (this.detectBreadcrumbs()) {
      confidenceScore += 15;
      signals.breadcrumbs = true;
    }
    
    // Check for shipping/delivery information (medium confidence)
    if (this.detectShippingInfo()) {
      confidenceScore += 15;
      signals.shippingInfo = true;
    }
    
    // Need at least 75 points of confidence
    const isPDP = confidenceScore >= 75;
    
    ChachingUtils.log('info', 'PdpDetector', `PDP detection: ${isPDP} (score: ${confidenceScore})`, {
      hasActionButtons,
      signals,
      confidenceScore
    });
    
    return isPDP;
  }

  /**
   * Detects price information on the page by searching for currency patterns
   * in both the page text and meta tags.
   *
   * @returns {Object} Object with properties:
   *   - found {boolean} Whether a price was detected
   *   - price {string} The price string if found
   *   - currency {string} The detected currency code (USD, EUR, etc.)
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
   * Detects e-commerce action buttons that indicate purchase intent.
   * Searches for buttons by:
   * 1. Text content (add to cart, buy now, checkout, etc.)
   * 2. ID/class attributes (add-to-cart, buy-button, etc.)
   * 3. Page text as fallback for non-standard implementations
   *
   * @returns {boolean} True if any action button is found, false otherwise
   */
  detectActionButtons() {
    try {
      // Simply check if any action button text exists on the page
      const pageText = document.body?.innerText?.toLowerCase() || '';
      
      // Check for action button keywords in page text
      for (const indicator of this.indicators.actionButtons) {
        if (pageText.includes(indicator)) {
          ChachingUtils.log('info', 'PdpDetector', `Action button text found: "${indicator}"`);
          return true;
        }
      }
      
      // Also check button attributes as backup (for icon-only buttons)
      const elements = document.querySelectorAll('button, a, input[type="button"], input[type="submit"], [role="button"]');
      for (const element of elements) {
        const elementHtml = element.outerHTML.toLowerCase();
        for (const attrIndicator of this.indicators.actionButtonAttributes) {
          if (elementHtml.includes(attrIndicator)) {
            ChachingUtils.log('info', 'PdpDetector', `Action button attribute found: "${attrIndicator}"`);
            return true;
          }
        }
      }
      
      ChachingUtils.log('info', 'PdpDetector', 'No action buttons found on page');
      return false;
    } catch (error) {
      ChachingUtils.log('error', 'PdpDetector', 'Error in detectActionButtons:', error);
      return false;
    }
  }

  /**
   * Detects product metadata that indicates detailed product information.
   * Searches for keywords like: SKU, model, UPC, ISBN, availability, ships from, etc.
   *
   * @returns {boolean} True if product metadata keywords are found, false otherwise
   */
  detectProductMetadata() {
    const pageText = document.body.innerText.toLowerCase();
    return this.indicators.productMetadata.some(metadata => pageText.includes(metadata));
  }

  /**
   * Detects customer reviews and ratings sections.
   * Searches for:
   * 1. Review-related text (reviews, ratings, stars, etc.)
   * 2. Star rating elements (class or aria-label containing rating/star)
   *
   * @returns {boolean} True if reviews/ratings are found, false otherwise
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
   * Detects product page URL patterns.
   * Common patterns include: /product/, /products/, /item/, /dp/, /gp/product,
   * /itm/, /ip/, product IDs like -p12345, /sku/, /pid/, etc.
   *
   * @returns {boolean} True if URL contains product page patterns, false otherwise
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
   * Detects breadcrumb navigation which indicates site hierarchy.
   * Searches for elements with breadcrumb classes/IDs and checks for
   * common separators (>, /) in the text.
   *
   * @returns {boolean} True if breadcrumb navigation is found, false otherwise
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
   * Helper function to extract currency from meta tags.
   * Checks product:price:currency and og:price:currency meta properties.
   *
   * @returns {string} Currency code (e.g., "USD", "EUR"), defaults to "USD"
   */
  getCurrencyFromMeta() {
    const currencyMeta = document.querySelector('meta[property="product:price:currency"], meta[property="og:price:currency"]');
    return currencyMeta?.content || 'USD'; // Default to USD if not found.
  }
  
  /**
   * Detects product selectors that allow customization.
   * Searches for: size selectors, color selectors, quantity inputs,
   * and generic option/variant selectors.
   * 
   * @returns {boolean} True if product selectors are found, false otherwise
   */
  detectProductSelectors() {
    const selectors = [
      'select[name*="size"], select[name*="color"], select[name*="quantity"]',
      '[class*="size-selector"], [class*="color-selector"], [class*="qty-selector"]',
      'input[type="number"][name*="qty"], input[type="number"][name*="quantity"]',
      '[data-option-selector], [data-variant-selector]',
      '.product-options, .product-variants'
    ];
    
    for (const selector of selectors) {
      if (document.querySelector(selector)) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Detects product images including galleries or single images.
   * Searches for:
   * 1. Gallery containers (product-gallery, image-gallery, etc.)
   * 2. Single product images with appropriate size (>200x200)
   * 3. Images near add-to-cart buttons
   * 4. Thumbnail navigation indicators
   * 
   * @returns {boolean} True if product images are found, false otherwise
   */
  detectProductImages() {
    // First check for gallery containers
    const gallerySelectors = [
      '[class*="product-gallery"]',
      '[class*="image-gallery"]',
      '[class*="product-images"]',
      '[class*="product-photo"]',
      '[class*="slider"][class*="product"]',
      '[data-gallery], [data-zoom]',
      '.product-image-container',
      '.pdp-image'
    ];
    
    for (const selector of gallerySelectors) {
      const gallery = document.querySelector(selector);
      if (gallery) {
        // Check if it contains images
        const images = gallery.querySelectorAll('img');
        if (images.length > 0) {
          return true;
        }
      }
    }
    
    // Check for single product images (common on minimalist sites)
    const singleImageSelectors = [
      'img[class*="product-image"]',
      'img[class*="product-photo"]',
      'img[alt*="product"]',
      'img[itemprop="image"]',
      'main img[src*="/products/"]',
      'main img[src*="/product/"]',
      '[data-product-image] img'
    ];
    
    for (const selector of singleImageSelectors) {
      const img = document.querySelector(selector);
      if (img && img.width > 200 && img.height > 200) {
        // It's a reasonably sized product image
        return true;
      }
    }
    
    // Check for images near the add to cart button (strong signal)
    const addToCart = document.querySelector(
      'button[class*="add-to-cart"], button[class*="add-to-bag"], ' +
      '[id*="add-to-cart"], [data-add-to-cart]'
    );
    
    if (addToCart) {
      // Look for large images in the same section/container
      let container = addToCart.closest('section, article, [class*="product"], main');
      if (container) {
        const nearbyImages = container.querySelectorAll('img');
        for (const img of nearbyImages) {
          if (img.width > 200 && img.height > 200) {
            return true;
          }
        }
      }
    }
    
    // Check for thumbnail navigation (indicates gallery even if main image is single)
    const hasThumbnails = document.querySelector(
      '[class*="thumbnail"], [class*="thumb-nav"], [data-thumbnail]'
    );
    
    return !!hasThumbnails;
  }
  
  /**
   * Detects product description sections with substantial content.
   * Searches for:
   * 1. Elements with description-related classes/IDs
   * 2. Description headings followed by content (>50 chars)
   * 3. Schema.org description properties
   * 
   * @returns {boolean} True if product description is found, false otherwise
   */
  detectProductDescription() {
    const descriptionSelectors = [
      '[class*="product-description"]',
      '[class*="product-details"]',
      '[class*="product-info"]',
      '[id*="product-description"]',
      '[id*="product-details"]',
      '[data-product-description]',
      '.description',
      '#description',
      '[itemprop="description"]'
    ];
    
    for (const selector of descriptionSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim().length > 50) {
        return true;
      }
    }
    
    // Check for description headings followed by content
    const headings = document.querySelectorAll('h2, h3, h4');
    for (const heading of headings) {
      const text = heading.textContent.toLowerCase();
      if (text.includes('description') || text.includes('details') || text.includes('about')) {
        // Check if there's meaningful content after this heading
        const nextElement = heading.nextElementSibling;
        if (nextElement && nextElement.textContent.trim().length > 50) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  /**
   * Detects shipping and delivery information on the page.
   * Common indicators of product pages include shipping costs, delivery times, etc.
   * 
   * @returns {boolean} True if shipping/delivery information is found, false otherwise
   */
  detectShippingInfo() {
    const shippingKeywords = [
      'free shipping', 'shipping', 'delivery', 'ships in', 'ships within',
      'estimated delivery', 'arrives', 'get it by', 'standard shipping',
      'express shipping', 'overnight', 'expedited', 'prime delivery',
      'in stock', 'ready to ship', 'usually ships', 'delivery options',
      'shipping cost', 'shipping fee', 'delivery fee', 'ships from',
      'fulfilled by', 'dispatched from'
    ];
    
    const pageText = document.body.innerText.toLowerCase();
    return shippingKeywords.some(keyword => pageText.includes(keyword));
  }
  
  /**
   * Debug method to get detailed detection results for troubleshooting
   * @returns {Object} Detailed breakdown of all detection results
   */
  debugDetection() {
    const results = {
      url: window.location.href,
      actionButtons: {
        found: this.detectActionButtons(),
        pageText: document.body?.innerText?.substring(0, 500) || 'No page text'
      },
      scoring: {
        structuredData: this.detectStructuredData(),
        price: this.detectPrice(),
        images: this.detectProductImages(),
        urlPattern: this.detectProductUrlPattern(),
        reviews: this.detectReviews(),
        description: this.detectProductDescription(),
        metadata: this.detectProductMetadata(),
        selectors: this.detectProductSelectors(),
        breadcrumbs: this.detectBreadcrumbs(),
        shipping: this.detectShippingInfo()
      },
      totalScore: 0,
      threshold: 75
    };
    
    // Calculate score
    if (results.scoring.structuredData.found && results.scoring.structuredData.hasOffer) results.totalScore += 40;
    if (results.scoring.price.found) results.totalScore += 25;
    if (results.scoring.images) results.totalScore += 20;
    if (results.scoring.urlPattern) results.totalScore += 25;
    if (results.scoring.reviews) results.totalScore += 15;
    if (results.scoring.description) results.totalScore += 15;
    if (results.scoring.metadata) results.totalScore += 10;
    if (results.scoring.selectors) results.totalScore += 10;
    if (results.scoring.breadcrumbs) results.totalScore += 15;
    if (results.scoring.shipping) results.totalScore += 15;
    
    results.isPDP = results.actionButtons.found && results.totalScore >= results.threshold;
    
    return results;
  }
  
  /**
   * Detects structured data (JSON-LD) for Product schema with offers.
   * This is the most reliable signal for product pages.
   * 
   * @returns {Object} Object with properties:
   *   - found {boolean} Whether Product schema was found
   *   - hasOffer {boolean} Whether the product has offer/price information
   *   - productName {string} The product name if found
   *   - brand {string} The brand name if found
   *   - price {string|number} The product price if found
   */
  detectStructuredData() {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    
    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent);
        
        // Check if it's a Product with an offer
        if (data['@type'] === 'Product' && data.offers) {
          return {
            found: true,
            hasOffer: true,
            productName: data.name,
            brand: data.brand?.name || data.brand,
            price: data.offers?.price
          };
        }
        
        // Check in @graph
        if (Array.isArray(data['@graph'])) {
          const product = data['@graph'].find(item => 
            item['@type'] === 'Product' && item.offers
          );
          if (product) {
            return {
              found: true,
              hasOffer: true,
              productName: product.name,
              brand: product.brand?.name || product.brand,
              price: product.offers?.price
            };
          }
        }
      } catch (e) {
        // Invalid JSON, continue
      }
    }
    
    return { found: false, hasOffer: false };
  }
}

// Export the detector class instance for use in content.js
if (typeof window !== 'undefined') {
  window.PdpDetector = PdpDetector;
} 