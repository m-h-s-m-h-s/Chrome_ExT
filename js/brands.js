/**
 * brands.js - A centralized list of supported brands.
 *
 * This file contains the array of brand names that the extension will actively look for.
 * The list is converted into a Set for highly efficient lookups, ensuring performance
 * even with tens of thousands of brands.
 *
 * To add, remove, or change supported brands, simply edit the `brandsArray` below.
 * The brand names should be in lowercase to ensure case-insensitive matching.
 *
 * @module brands
 */

// To add a new brand, add its lowercase name to this array.
// For example: `const brandsArray = ['nike', 'adidas', 'ugg', 'your brand here'];`
const brandsArray = [
  'ruggable',
  'creed',
  'nike',
  'adidas',
  'ugg',
  'lululemon',
  'levis',
  'samsung',
  'apple',
  'sony',
  'lego',
  'patagonia',
  'the north face',
  'coach',
  'michael kors',
  'kate spade',
  'tory burch',
  'gucci',
  'louis vuitton',
  'prada',
  'chanel'
];

// We use a Set for O(1) lookups, which is crucial for performance with large lists.
const SUPPORTED_BRANDS_SET = new Set(brandsArray);

// We also expose the original array for operations that require iteration, like `startsWith`.
const SUPPORTED_BRANDS_ARRAY = brandsArray;

// Making the Set and Array available to other scripts.
if (typeof window !== 'undefined') {
  window.SUPPORTED_BRANDS_SET = SUPPORTED_BRANDS_SET;
  window.SUPPORTED_BRANDS_ARRAY = SUPPORTED_BRANDS_ARRAY;
} 