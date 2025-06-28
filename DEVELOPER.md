# ChaChing Extension Developer Documentation

## Architecture Overview

The ChaChing browser extension detects supported brands on e-commerce product pages and displays cashback notifications. It follows a multi-stage detection process to ensure accuracy and minimize false positives.

## Detection Flow

1. **Domain Exclusion Check** (`checkExcludedDomain()`)
   - First check against `excluded-domains.json`
   - Exit immediately if domain is excluded
   - Prevents unnecessary processing on non-shopping sites

2. **Brand List Loading** (`loadBrands()`)
   - Asynchronously loads `BrandList.csv`
   - Creates normalized brand map for fast lookups
   - Only runs if domain is not excluded

3. **Product Detail Page Detection** (`PdpDetector`)
   - Verifies the page is an actual product page
   - Requires action buttons (add to cart, buy now, etc.)
   - Calculates confidence score from multiple signals
   - Must score 75+ points to be considered a PDP

4. **Brand Detection** (`BrandDetector`)
   - Only runs if PDP detection passes
   - Uses voting system to find best brand match
   - Checks multiple sources (title, meta tags, structured data, etc.)
   - Returns the brand with most votes

5. **Notification Display**
   - Shows only if both PDP and brand are detected
   - OR if site is a special merchant partner
   - Respects 15-minute dismissal window per URL

## Key Components

### Content Scripts
- **main.js**: Orchestrates the detection flow
- **pdp-detector.js**: Determines if page is a product detail page
- **brand-detector.js**: Finds supported brands on the page
- **brands.js**: Loads and manages the brand list

### Background Script
- **main.js**: Handles message passing and stores detection results
- No longer handles script injection (now via manifest.json)

### Configuration Files
- **BrandList.csv**: List of supported brands
- **excluded-domains.json**: Domains where extension won't run
- **manifest.json**: Extension configuration and permissions

## Recent Changes (v2.3.0)

### Domain Exclusion System
- Moved from hardcoded exclusions to JSON file
- Runtime checking instead of manifest-based exclusion
- Easier to update without code changes

### Simplified Architecture
- Content scripts injected via manifest.json
- Background script focused on message handling
- Removed programmatic script injection

## Development Guidelines

### Adding New Brands
1. Edit `src/assets/BrandList.csv`
2. Add brand name on new line
3. Reload extension

### Excluding Domains
1. Edit `src/assets/excluded-domains.json`
2. Add domain to array (e.g., "example.com")
3. Reload extension

### Testing PDP Detection
```javascript
// In console on a product page:
const detector = new PdpDetector();
console.log(detector.debugDetection());
```

### Common Issues

1. **Extension running on wrong sites**
   - Check excluded-domains.json
   - Verify domain matching logic

2. **Not detecting products**
   - Check PDP detection score
   - Verify action buttons are found
   - Check brand is in BrandList.csv

3. **False positives**
   - Increase PDP confidence threshold
   - Refine detection signals

## Performance Considerations

- Domain exclusion check runs first (fast fail)
- Brand list cached after first load
- Detection only runs once per page load
- Debounced to handle dynamic content

## Security Notes

- No external API calls
- All data loaded from extension resources
- No user data collection
- Minimal permissions required 