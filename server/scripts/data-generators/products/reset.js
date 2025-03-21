const dotenv = require("dotenv");
dotenv.config();

const { cleanup } = require("./migrate");

console.log("Resetting database...");
cleanup()
  .then(() => {
    console.log("Database reset complete.");
  })
  .catch((error) => {
    console.error("Error during database reset:", error);
    // Print more detailed error information
    if (error.stack) {
      console.error("Stack trace:", error.stack);
    }
    if (error.details) {
      console.error("Error details:", error.details);
    }

    console.error("Error message:", error.message);
  });
