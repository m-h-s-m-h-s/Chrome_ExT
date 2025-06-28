# ChaChing Browser Extension Changelog

## Version 2.3.0 (Latest)
### Major Changes
- **Configurable Domain Exclusions**: Added `excluded-domains.json` file for easy management of sites where the extension should not run
- **Improved Performance**: Extension now checks exclusions before loading brands or running detection logic
- **Bug Fix**: Fixed issue where extension was running on YouTube and other non-shopping sites

### Technical Updates
- Removed hardcoded domain exclusions from background script
- Content scripts now check exclusions list at runtime
- Simplified manifest.json exclude_matches
- Updated all documentation to reflect new architecture

### Files Added
- `src/assets/excluded-domains.json` - Master list of excluded domains
- `src/assets/excluded-domains-readme.txt` - Instructions for managing exclusions
- `CHANGELOG.md` - This changelog file

---

## Version 2.2.0
### Major Changes
- **Product Detail Page Detection**: Extension now only runs on actual product pages
- **Two-Stage Detection**: First checks if page is a PDP, then checks for supported brands
- **Reduced False Positives**: No more popups on blog posts or category pages

### Technical Updates
- Added PDP detector with confidence scoring system
- Requires action buttons + 75 confidence points for PDP classification
- Updated content script flow to check PDP before brand detection

---

## Version 2.1.1
### Features
- Initial public release
- Brand detection using voting system
- Dynamic brand list loading from CSV
- Cashback notifications
- Special merchant support

### Known Issues
- Extension running on all pages regardless of content
- No easy way to exclude domains 