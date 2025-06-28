/**
 * @file src/content/brand-detector.js
 * @description The brand detection engine for the ChaChing Extension.
 *
 * This module uses a pure "voting" system to determine the most likely supported brand on a page.
 * It finds all potential brand candidates using various robust strategies, then tallies "votes"
 * for each of our officially supported brands based on **exact, whole-word matches** with the candidates.
 * The supported brand with the most votes wins.
 *
 * This detector is only called after the page passes PDP (Product Detail Page) detection,
 * ensuring we only detect brands on actual product pages.
 *
 * @version 2.6.0
 */
class BrandDetector {
  /**
   * The main detection method. It orchestrates the brand discovery, voting, and validation.
   *
   * @returns {Object|null} If a supported brand wins the vote, it returns a result object, otherwise null.
   * The result object includes `isSupported`, and `productInfo` which contains the `brand`, `title`, and `cashback`.
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
   * This function's sole purpose is to gather as much evidence as possible.
   *
   * @returns {string[]} An array of all found brand name candidates, including duplicates.
   */
  findAllBrandCandidates() {
    let candidates = [];

    // Strategy 1: Structured Data (JSON-LD)
    const structuredDataScript = document.querySelector('script[type="application/ld+json"]');
    if (structuredDataScript) {
        try {
            const data = JSON.parse(structuredDataScript.textContent);
            const brand = data.brand?.name || data.brand;
            if (typeof brand === 'string' && brand.trim()) candidates.push(brand.trim());
        } catch (e) { /* Ignore */ }
    }

    // Strategy 2: Title Search (Using word boundaries for accuracy)
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
    const ogBrandElement = document.querySelector('meta[property="product:brand"], meta[property="og:brand"]');
    if (ogBrandElement && ogBrandElement.content) candidates.push(ogBrandElement.content.trim());

    // Strategy 4: Semantic HTML - Check for common data attributes and class names.
    const brandSelectors = ['[itemprop="brand"] [itemprop="name"]', '[itemprop="brand"]', '[data-product-brand]', '.product-brand', '[class*="brand-name"]'];
    for (const selector of brandSelectors) {
      const element = document.querySelector(selector);
      if (element && element.innerText?.trim()) candidates.push(element.innerText.trim());
    }

    // Strategy 5: Look for visible key-value pairs (e.g., "Brand: Nike").
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

    // Strategy 6: Breadcrumbs - The second-to-last item is often the brand.
    const breadcrumbItems = document.querySelectorAll('[class*="breadcrumb"] a');
    if (breadcrumbItems.length > 1) {
      const brandCandidate = breadcrumbItems[breadcrumbItems.length - 2].innerText.trim();
      if (brandCandidate.length > 2 && !['home', 'products', 'shop'].includes(brandCandidate.toLowerCase())) {
        candidates.push(brandCandidate);
      }
    }

    // Strategy 7: Open Graph Site Name
    const ogSiteName = document.querySelector('meta[property="og:site_name"]');
    if (ogSiteName && ogSiteName.content) candidates.push(ogSiteName.content.trim());
    
    // Strategy 8: Domain Name (Robust Extraction)
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
   * e.g., 'www.levi.co.uk' becomes 'levi'.
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

    const voteCounts = new Map();

    // For each of our officially supported brands, count how many times it appears
    // within the candidates gathered from the page.
    for (const supportedBrandName of SUPPORTED_BRANDS_MAP.keys()) {
      candidates.forEach(candidate => {
        // Perform a strict, case-insensitive equality check for whole-word matching.
        if (normalizeBrand(candidate) === supportedBrandName) {
          // If it matches exactly, cast a vote for that SUPPORTED brand.
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
      // Return the full brand object from the map.
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
}

// Export the detector class instance for use in content.js
if (typeof window !== 'undefined') {
  window.BrandDetector = BrandDetector;
} 