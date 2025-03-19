const { parse } = require('csv-parse');
const fs = require('fs');

/**
 * @typedef {Object} Product
 * @property {string} id - Unique identifier of the product
 * @property {string} name - Name of the product
 * @property {string} category - Product category hierarchy
 * @property {number} price - Selling price of the product
 * @property {string} modelNumber - Model number of the product
 * @property {string} aboutProduct - Description about the product
 * @property {string} specification - Product specifications
 * @property {string} technicalDetails - Technical details of the product
 * @property {string} shippingWeight - Shipping weight of the product
 * @property {string[]} images - Array of product image URLs
 * @property {string} productUrl - URL to the product page
 */

/**
 * @typedef {Object} CSVRecord
 * @property {'Uniq Id'} string
 * @property {'Product Name'} string
 * @property {'Category'} string
 * @property {'Selling Price'} string
 * @property {'Model Number'} string
 * @property {'About Product'} string
 * @property {'Product Specification'} string
 * @property {'Technical Details'} string
 * @property {'Shipping Weight'} string
 * @property {'Image'} string
 * @property {'Product Url'} string
 */

/**
 * Parses a CSV file containing product information and returns an array of product objects
 * @param {string} filePath - Path to the CSV file
 * @returns {Promise<Product[]>} Array of parsed product objects
 * @throws {Error} If file reading or parsing fails
 */
async function parseProductsCSV(filePath) {
  const parser = fs
    .createReadStream(filePath)
    .pipe(parse({
      columns: true,
      skip_empty_lines: true,
      trim: true
    }));

  /**
   * @type {Product[]}
   */
  const products = [];

  for await (/** @type {CSVRecord} */ const record of parser) {
    const product = {
      id: record['Uniq Id'],
      name: record['Product Name'],
      category: record['Category'],
      price: parseFloat(record['Selling Price'].replace('$', '')),
      modelNumber: record['Model Number'],
      aboutProduct: record['About Product'],
      specification: record['Product Specification'],
      technicalDetails: record['Technical Details'],
      shippingWeight: record['Shipping Weight'],
      images: record['Image'].split('|').filter(url => !url.includes('transparent-pixel')),
      productUrl: record['Product Url']
    };
    
    products.push(product);
  }

  return products;
}

module.exports = { parseProductsCSV };
