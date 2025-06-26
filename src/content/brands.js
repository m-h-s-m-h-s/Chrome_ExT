/**
 * @file src/content/brands.js
 * @description A centralized list of supported brands and their cashback levels.
 *
 * @version 3.0.0
 *
 * **********************************************************************************
 *
 * This file defines the brands that the extension will actively look for. It's the
 * primary configuration file that a developer will modify during normal operations.
 *
 * The data is structured as an array of objects, where each object contains:
 *   - `name`: The brand's name in lowercase. This is used for matching.
 *   - `cashback`: The integer cashback percentage associated with the brand.
 *
 * For performance, this array is converted into two data structures:
 *   - `SUPPORTED_BRANDS_MAP`: A Map where the key is the normalized brand name and
 *     the value is the full brand object. This allows for O(1) (instant) lookups
 *     to retrieve brand data, including the cashback level.
 *   - `SUPPORTED_BRANDS_ARRAY`: An array of just the brand names. This is used by
 *     the detector when it needs to iterate through all supported brand names quickly.
 *
 * **********************************************************************************
 */

// To add a new brand, add its object to this array with a name and cashback level.
// The `name` should always be lowercase for consistent matching.
// For example: `const brands = [{ name: 'nike', cashback: 8 }, ...];`
const brands = [
  { name: 'ruggable', cashback: 10 },
  { name: 'creed', cashback: 15 },
  { name: 'nike', cashback: 12 },
  { name: 'adidas', cashback: 11 },
  { name: 'ugg', cashback: 9 },
  { name: 'lululemon', cashback: 8 },
  { name: 'levis', cashback: 7 },
  { name: 'samsung', cashback: 18 },
  { name: 'apple', cashback: 5 },
  { name: 'sony', cashback: 14 },
  { name: 'lego', cashback: 6 },
  { name: 'patagonia', cashback: 13 },
  { name: 'the north face', cashback: 10 },
  { name: 'coach', cashback: 20 },
  { name: 'michael kors', cashback: 22 },
  { name: 'kate spade', cashback: 25 },
  { name: 'tory burch', cashback: 23 },
  { name: 'gucci', cashback: 30 },
  { name: 'louis vuitton', cashback: 4 },
  { name: 'prada', cashback: 7 },
  { name: 'chanel', cashback: 5 }
];

// Normalize all brand names in the array for consistent matching. This step ensures
// that any variations in the source array are cleaned up before being used.
const normalizedBrands = brands.map(brand => ({
  ...brand,
  name: normalizeBrand(brand.name)
}));

// We use a Map for O(1) lookups, mapping brand names to their full object.
// This is extremely efficient for finding a brand's data once we have its name.
const SUPPORTED_BRANDS_MAP = new Map(normalizedBrands.map(brand => [brand.name, brand]));

// We also expose an array of just the brand names for operations that require iteration
// over the names themselves, such as in the title search strategy in the detector.
const SUPPORTED_BRANDS_ARRAY = normalizedBrands.map(brand => brand.name);

// Make the Map and the Array available on the global `window` object within the
// content script's isolated world. This allows other injected scripts like `detector.js`
// to access this data.
if (typeof window !== 'undefined') {
  window.SUPPORTED_BRANDS_MAP = SUPPORTED_BRANDS_MAP;
  window.SUPPORTED_BRANDS_ARRAY = SUPPORTED_BRANDS_ARRAY;
} 