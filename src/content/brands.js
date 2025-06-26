/**
 * brands.js - A centralized list of supported brands and their cashback levels.
 *
 * This file contains the array of brand objects that the extension will actively look for.
 * Each object contains a brand name and its associated cashback percentage.
 * The list is converted into a Map for highly efficient O(1) lookups.
 *
 * To add, remove, or change supported brands, simply edit the `brands` array below.
 * The brand names should be in lowercase to ensure case-insensitive matching.
 *
 * @module brands
 */

// To add a new brand, add its object to this array with a name and cashback level.
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

// Normalize all brand names in the array for consistent matching.
const normalizedBrands = brands.map(brand => ({
  ...brand,
  name: normalizeBrand(brand.name)
}));

// We use a Map for O(1) lookups, mapping brand names to their full object.
const SUPPORTED_BRANDS_MAP = new Map(normalizedBrands.map(brand => [brand.name, brand]));

// We also expose an array of just the brand names for operations that require it.
const SUPPORTED_BRANDS_ARRAY = normalizedBrands.map(brand => brand.name);

// Making the Map and Array available to other scripts.
if (typeof window !== 'undefined') {
  window.SUPPORTED_BRANDS_MAP = SUPPORTED_BRANDS_MAP;
  window.SUPPORTED_BRANDS_ARRAY = SUPPORTED_BRANDS_ARRAY;
} 