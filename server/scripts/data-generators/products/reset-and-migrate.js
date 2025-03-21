const dotenv = require("dotenv");
dotenv.config();

const path = require("path");
const { cleanup, run } = require("./migrate");

// Resolve path relative to the current script's location
const filePath = path.resolve(__dirname, "./products-light.csv");

console.log('Starting database reset and migration process...');

// Wrap in an async IIFE to use await and better handle errors
(async () => {
  try {
    // Step 1: Reset the database
    console.log('Resetting database...');
    await cleanup();
    console.log('Database reset complete!');
    
    // Small pause to ensure all connections are properly closed
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Step 2: Run the migration
    console.log('Starting data migration with file:', filePath);
    await run(filePath);
    console.log('Data migration completed successfully!');
    
    console.log('Reset and migration process completed successfully.');
  } catch (error) {
    console.error('Error during reset and migration process:', error);
    // Print more detailed error information
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    if (error.details) {
      console.error('Error details:', error.details);
    }
    console.error('Error message:', error.message);
    process.exit(1);
  }
})();
