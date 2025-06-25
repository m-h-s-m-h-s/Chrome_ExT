/**
 * product-detector.js - Universal Product Page Detection Module
 * 
 * This module implements intelligent detection of product detail pages across
 * any e-commerce website by analyzing page content, structure, and common patterns.
 * 
 * @module product-detector
 * @author Chaching Product Searcher Extension
 * @version 1.0.0
 */

/**
 * ProductDetector class encapsulates all product detection logic
 * Uses multiple heuristics to determine if a page is a product detail page
 * 
 * @class ProductDetector
 */
class ProductDetector {
  constructor() {
    /**
     * Keywords that strongly indicate a product page
     * @type {Object}
     */
    this.indicators = {
      // Price-related indicators with different currency symbols
      pricePatterns: [
        /\$\s*[\d,]+\.?\d*/,     // USD: $99.99
        /€\s*[\d,]+\.?\d*/,      // EUR: €99.99
        /£\s*[\d,]+\.?\d*/,      // GBP: £99.99
        /¥\s*[\d,]+\.?\d*/,      // JPY/CNY: ¥999
        /₹\s*[\d,]+\.?\d*/,      // INR: ₹999
        /R\$\s*[\d,]+\.?\d*/,    // BRL: R$99.99
        /\d+\.\d{2}\s*(USD|EUR|GBP|CAD|AUD)/, // 99.99 USD
        /price[:\s]+[\d,]+\.?\d*/i,
        /cost[:\s]+[\d,]+\.?\d*/i,
        /msrp[:\s]+[\d,]+\.?\d*/i
      ],

      // Action buttons that indicate e-commerce functionality
      actionButtons: [
        'add to cart',
        'add to basket',
        'add to bag',
        'buy now',
        'buy it now',
        'purchase',
        'add to wishlist',
        'save for later',
        'preorder',
        'pre-order',
        'notify me',
        'out of stock',
        'sold out',
        'check availability'
      ],

      // Product-specific metadata
      productMetadata: [
        'sku',
        'model',
        'upc',
        'isbn',
        'asin',
        'product code',
        'item number',
        'part number',
        'style',
        'color',
        'size',
        'quantity',
        'in stock',
        'availability',
        'ships from',
        'sold by',
        'fulfilled by'
      ],

      // Review and rating indicators
      reviewIndicators: [
        'reviews',
        'ratings',
        'stars',
        'customer reviews',
        'product reviews',
        'rating',
        'rated',
        'out of 5',
        '★', '☆' // Star symbols
      ],

      // Structured data indicators
      structuredDataTypes: [
        'Product',
        'Offer',
        'AggregateRating',
        'Review'
      ]
    };

    /**
     * Weight values for different indicators
     * Higher weights indicate stronger product page signals
     */
    this.weights = {
      price: 25,
      actionButton: 20,
      productTitle: 15,
      productImage: 10,
      metadata: 5,
      reviews: 10,
      structuredData: 15,
      urlPattern: 5,
      breadcrumb: 5
    };

    /**
     * Minimum confidence score to consider a page as a product page
     */
    this.confidenceThreshold = 50;
  }

  /**
   * Main detection method that analyzes the current page
   * 
   * @returns {Object} Detection result with confidence score and product info
   */
  detectProductPage() {
    const startTime = performance.now();
    
    ChachingUtils.log('info', 'ProductDetector', 'Starting product page detection');

    // Initialize detection result
    const result = {
      isProductPage: false,
      confidence: 0,
      productInfo: {
        title: null,
        price: null,
        currency: null,
        availability: null,
        images: []
      },
      signals: {
        hasPrice: false,
        hasActionButton: false,
        hasProductImage: false,
        hasMetadata: false,
        hasReviews: false,
        hasStructuredData: false,
        hasBreadcrumb: false,
        hasProductUrl: false
      }
    };

    try {
      // Run all detection methods
      let score = 0;

      // Check for price indicators
      const priceData = this.detectPrice();
      if (priceData.found) {
        result.signals.hasPrice = true;
        result.productInfo.price = priceData.price;
        result.productInfo.currency = priceData.currency;
        score += this.weights.price;
      }

      // Check for action buttons
      if (this.detectActionButtons()) {
        result.signals.hasActionButton = true;
        score += this.weights.actionButton;
      }

      // Extract product title
      const title = this.extractProductTitle();
      if (title) {
        result.productInfo.title = title;
        score += this.weights.productTitle;
      }

      // Check for product images
      const images = this.detectProductImages();
      if (images.length > 0) {
        result.signals.hasProductImage = true;
        result.productInfo.images = images;
        score += this.weights.productImage;
      }

      // Check for product metadata
      if (this.detectProductMetadata()) {
        result.signals.hasMetadata = true;
        score += this.weights.metadata;
      }

      // Check for reviews
      if (this.detectReviews()) {
        result.signals.hasReviews = true;
        score += this.weights.reviews;
      }

      // Check for structured data
      const structuredData = this.detectStructuredData();
      if (structuredData.found) {
        result.signals.hasStructuredData = true;
        score += this.weights.structuredData;
        
        // Use structured data to enhance product info
        if (structuredData.productName && !result.productInfo.title) {
          result.productInfo.title = structuredData.productName;
        }
      }

      // Check URL patterns
      if (this.detectProductUrlPattern()) {
        result.signals.hasProductUrl = true;
        score += this.weights.urlPattern;
      }

      // Check for breadcrumbs
      if (this.detectBreadcrumbs()) {
        result.signals.hasBreadcrumb = true;
        score += this.weights.breadcrumb;
      }

      // Calculate final confidence score
      result.confidence = score;
      result.isProductPage = score >= this.confidenceThreshold;

      const endTime = performance.now();
      ChachingUtils.log('info', 'ProductDetector', 
        `Detection completed in ${(endTime - startTime).toFixed(2)}ms`, result);

    } catch (error) {
      ChachingUtils.log('error', 'ProductDetector', 'Detection failed', error);
    }

    return result;
  }

  /**
   * Detects price information on the page
   * 
   * @returns {Object} Price detection result
   */
  detectPrice() {
    const pageText = document.body.innerText;
    
    for (const pattern of this.indicators.pricePatterns) {
      const match = pageText.match(pattern);
      if (match) {
        // Extract currency symbol
        let currency = 'USD'; // Default
        if (match[0].includes('$')) currency = 'USD';
        else if (match[0].includes('€')) currency = 'EUR';
        else if (match[0].includes('£')) currency = 'GBP';
        else if (match[0].includes('¥')) currency = 'JPY';
        else if (match[0].includes('₹')) currency = 'INR';
        else if (match[0].includes('R$')) currency = 'BRL';
        
        return {
          found: true,
          price: match[0],
          currency: currency
        };
      }
    }

    // Check for price in meta tags
    const priceMetaTags = [
      'meta[property="product:price:amount"]',
      'meta[property="og:price:amount"]',
      'meta[itemprop="price"]'
    ];

    for (const selector of priceMetaTags) {
      const metaTag = document.querySelector(selector);
      if (metaTag && metaTag.content) {
        return {
          found: true,
          price: metaTag.content,
          currency: this.getCurrencyFromMeta()
        };
      }
    }

    return { found: false };
  }

  /**
   * Detects action buttons on the page
   * 
   * @returns {boolean} True if action buttons are found
   */
  detectActionButtons() {
    const buttons = document.querySelectorAll('button, input[type="button"], input[type="submit"], a.button, a.btn');
    
    for (const button of buttons) {
      const buttonText = button.innerText?.toLowerCase() || button.value?.toLowerCase() || '';
      
      for (const indicator of this.indicators.actionButtons) {
        if (buttonText.includes(indicator)) {
          return true;
        }
      }
    }

    // Check for action button text anywhere on page
    const pageText = document.body.innerText.toLowerCase();
    return this.indicators.actionButtons.some(indicator => 
      pageText.includes(indicator)
    );
  }

  /**
   * Extracts the most likely product title from the page
   * 
   * @returns {string|null} The extracted product title or null
   */
  extractProductTitle() {
    // Strategy 1: Check Open Graph tags
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle && ogTitle.content) {
      return this.cleanProductTitle(ogTitle.content);
    }

    // Strategy 2: Check structured data
    const structuredData = this.detectStructuredData();
    if (structuredData.productName) {
      return this.cleanProductTitle(structuredData.productName);
    }

    // Strategy 3: Check H1 tags
    const h1Tags = document.querySelectorAll('h1');
    for (const h1 of h1Tags) {
      const text = h1.innerText.trim();
      if (text && text.length > 5 && text.length < 200) {
        // Check if H1 is near price or action buttons
        const parent = h1.closest('section, article, div[class*="product"], div[id*="product"]');
        if (parent && (parent.innerText.match(/\$\d+/) || parent.innerText.match(/add to cart/i))) {
          return this.cleanProductTitle(text);
        }
      }
    }

    // Strategy 4: Check title tag
    const titleTag = document.title;
    if (titleTag && titleTag.length > 10) {
      // Remove common suffixes
      const cleaned = titleTag
        .replace(/\s*[\|\-–—]\s*.*?(amazon|ebay|walmart|shop|store|buy|sale).*$/i, '')
        .trim();
      
      if (cleaned.length > 5) {
        return this.cleanProductTitle(cleaned);
      }
    }

    // Strategy 5: Look for elements with product-related classes/ids
    const productSelectors = [
      '[class*="product-title"]',
      '[class*="product-name"]',
      '[class*="item-title"]',
      '[class*="item-name"]',
      '[id*="product-title"]',
      '[id*="product-name"]',
      '[itemprop="name"]',
      '.product-title',
      '.product-name',
      '#product-title'
    ];

    for (const selector of productSelectors) {
      const element = document.querySelector(selector);
      if (element && element.innerText) {
        return this.cleanProductTitle(element.innerText);
      }
    }

    return null;
  }

  /**
   * Cleans and normalizes a product title
   * 
   * @param {string} title - Raw title text
   * @returns {string} Cleaned title
   */
  cleanProductTitle(title) {
    return title
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/['"]/g, '')
      .substring(0, 150); // Limit length
  }

  /**
   * Detects product images on the page
   * 
   * @returns {Array} Array of product image URLs
   */
  detectProductImages() {
    const images = [];
    
    // Look for images in common product image containers
    const imageSelectors = [
      'img[class*="product-image"]',
      'img[class*="product-photo"]',
      'img[id*="product-image"]',
      'img[itemprop="image"]',
      '.product-images img',
      '.gallery img',
      'picture img',
      'img[data-zoom]',
      'img[data-magnify]'
    ];

    for (const selector of imageSelectors) {
      const imgs = document.querySelectorAll(selector);
      imgs.forEach(img => {
        if (img.src && img.width > 100 && img.height > 100) {
          images.push(img.src);
        }
      });
    }

    // Check Open Graph image
    const ogImage = document.querySelector('meta[property="og:image"]');
    if (ogImage && ogImage.content) {
      images.push(ogImage.content);
    }

    return [...new Set(images)].slice(0, 5); // Return unique images, max 5
  }

  /**
   * Detects product metadata on the page
   * 
   * @returns {boolean} True if metadata is found
   */
  detectProductMetadata() {
    const pageText = document.body.innerText.toLowerCase();
    
    return this.indicators.productMetadata.some(metadata => 
      pageText.includes(metadata)
    );
  }

  /**
   * Detects review/rating elements on the page
   * 
   * @returns {boolean} True if reviews are found
   */
  detectReviews() {
    // Check for review text
    const pageText = document.body.innerText.toLowerCase();
    const hasReviewText = this.indicators.reviewIndicators.some(indicator => 
      pageText.includes(indicator.toLowerCase())
    );

    // Check for star ratings
    const starElements = document.querySelectorAll('[class*="star"], [class*="rating"], [aria-label*="rating"]');
    
    return hasReviewText || starElements.length > 0;
  }

  /**
   * Detects structured data (JSON-LD) on the page
   * 
   * @returns {Object} Structured data result
   */
  detectStructuredData() {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    
    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent);
        
        // Check if it's a Product type
        if (data['@type'] === 'Product' || 
            (Array.isArray(data['@type']) && data['@type'].includes('Product'))) {
          return {
            found: true,
            productName: data.name,
            price: data.offers?.price,
            currency: data.offers?.priceCurrency
          };
        }

        // Check for nested Product in @graph
        if (data['@graph']) {
          const product = data['@graph'].find(item => 
            item['@type'] === 'Product' || 
            (Array.isArray(item['@type']) && item['@type'].includes('Product'))
          );
          
          if (product) {
            return {
              found: true,
              productName: product.name,
              price: product.offers?.price,
              currency: product.offers?.priceCurrency
            };
          }
        }
      } catch (e) {
        // Invalid JSON, continue
      }
    }

    return { found: false };
  }

  /**
   * Detects product-like URL patterns
   * 
   * @returns {boolean} True if URL suggests a product page
   */
  detectProductUrlPattern() {
    const url = window.location.href.toLowerCase();
    
    const productUrlPatterns = [
      /\/product\//,
      /\/products\//,
      /\/item\//,
      /\/items\//,
      /\/p\//,
      /\/dp\//,        // Amazon
      /\/gp\/product/, // Amazon
      /\/itm\//,       // eBay
      /\/ip\//,        // Walmart
      /[-_]p\d+/,      // Product ID patterns
      /\/sku[\/-]/,
      /\/pid[\/-]/,
      /\/prod\d+/,
      /\/article\//,
      /\/goods\//
    ];

    return productUrlPatterns.some(pattern => pattern.test(url));
  }

  /**
   * Detects breadcrumb navigation
   * 
   * @returns {boolean} True if breadcrumbs are found
   */
  detectBreadcrumbs() {
    const breadcrumbSelectors = [
      '[class*="breadcrumb"]',
      '[id*="breadcrumb"]',
      '[role="navigation"]',
      '[aria-label*="breadcrumb"]',
      'nav ol',
      'nav ul'
    ];

    for (const selector of breadcrumbSelectors) {
      const element = document.querySelector(selector);
      if (element && element.innerText.includes('>') || element?.innerText.includes('/')) {
        return true;
      }
    }

    return false;
  }

  /**
   * Gets currency from meta tags
   * 
   * @returns {string} Currency code
   */
  getCurrencyFromMeta() {
    const currencyMeta = document.querySelector('meta[property="product:price:currency"], meta[property="og:price:currency"]');
    return currencyMeta?.content || 'USD';
  }
}

// Export the detector instance
if (typeof window !== 'undefined') {
  window.ProductDetector = ProductDetector;
} 