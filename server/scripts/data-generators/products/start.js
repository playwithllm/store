const dotenv = require("dotenv");
dotenv.config();

const path = require("path");
const { run } = require('./migrate');

// Resolve path relative to the current script's location
const filePath = path.resolve(__dirname, "./products-light.csv");
console.log('Starting data generator...');
console.log('Using file path:', filePath);

// Wrap in an async IIFE to use await and better handle errors
(async () => {
  try {
    console.log('Running data migration with file:', filePath);
    await run(filePath);
    console.log('Data generator completed successfully.');
  } catch (error) {
    console.error('Error during data generation:', error);
    // Print more detailed error information
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    if (error.details) {
      console.error('Error details:', error.details);
    }

    console.error('Error message:', error.message);
  }
})();
