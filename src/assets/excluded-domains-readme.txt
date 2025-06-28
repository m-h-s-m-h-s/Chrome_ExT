EXCLUDED DOMAINS CONFIGURATION
==============================

The excluded-domains.json file controls which websites the ChaChing extension will NOT run on.

HOW TO ADD A DOMAIN:
1. Add the domain name to the excludedDomains array
2. Use just the main domain (e.g., "youtube.com" not "www.youtube.com")
3. The extension will exclude all subdomains automatically
4. Save the file and reload the extension

EXAMPLES:
- "youtube.com" will exclude www.youtube.com, m.youtube.com, etc.
- "google.com" will exclude mail.google.com, docs.google.com, etc.

NOTES:
- Domains are case-insensitive
- Don't include http:// or https://
- Each domain should be on its own line for readability
- The extension must be reloaded after changes 