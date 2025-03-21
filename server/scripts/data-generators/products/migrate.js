const dotenv = require("dotenv");
dotenv.config();


const mongoose = require("mongoose");
const path = require("path");
const Product = require("../../../routes/product/schema");
const { parseProductsCSV } = require("./parse-products");
const MultimodalProcessor = require("../../../routes/product/MultimodalProcessor");
const { MultimodalConfig } = require("../../../config/llm");

// Configuration
const CONFIG = {
  mongodb: {
    uri: process.env.MONGODB_URI,
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    },
  },
  batch: {
    start: parseInt(process.env.BATCH_START, 10) || 2000,
    size: parseInt(process.env.BATCH_SIZE, 10) || 10000,
  },
  processing: {
    delayMs: parseInt(process.env.PROCESSING_DELAY_MS, 10) || 1000,
    concurrency: parseInt(process.env.PROCESSING_CONCURRENCY, 10) || 3,
  },
  // Use the imported multimodal configuration from common config file
  multimodal: MultimodalConfig,
};

// Error handling
class AppError extends Error {
  constructor(message, details) {
    super(message);
    this.name = "AppError";
    this.details = details;
  }
}

// Logger
const logger = {
  info: (message, data = {}) => {
    console.log(`[INFO] ${message}`, data);
  },
  error: (message, error) => {
    console.error(`[ERROR] ${message}`, error);
  },
  success: (message, data = {}) => {
    console.log(`[SUCCESS] ${message}`, data);
  },
  debug: (message, data = {}) => {
    // Always log debug messages during troubleshooting
    console.log(`[DEBUG] ${message}`, data);
  },
};

/**
 * Create a new product in MongoDB
 * @param {Object} data - Product data
 * @returns {Object} Created product ID
 */
const createProduct = async (data) => {
  try {
    const payload = new Product({
      ...data,
      sourceId: data.id,
    });
    const savedItem = await payload.save();
    logger.success(`Product created`, { id: savedItem._id });
    return { _id: savedItem._id };
  } catch (error) {
    logger.error(`Failed to create product`, error);
    throw new AppError(`Failed to create product`, error.message);
  }
};

/**
 * Reset both MongoDB and Milvus databases
 * @param {Object} multimodalProcessor - Instance of MultimodalProcessor
 */
const resetDatabase = async (multimodalProcessor) => {
  logger.info("Resetting databases...");

  try {
    // Reset MongoDB
    await Product.deleteMany({});
    logger.info("MongoDB products collection reset");

    // Reset Milvus if processor provided
    if (multimodalProcessor) {
      await multimodalProcessor.deleteCollection();
      logger.info("Milvus collection reset");

      // Verification
      const stats = await multimodalProcessor.getCollectionStats();
      logger.debug("Milvus collection stats after reset", stats);

      const savedProducts = await multimodalProcessor.listAllProducts();
      logger.debug("Current products after reset", {
        count: savedProducts.length,
      });
    }
  } catch (error) {
    logger.error("Error resetting databases", error);
    throw new AppError("Database reset failed", error.message);
  }
};

/**
 * Process product image to generate caption and embedding
 * @param {Object} multimodalProcessor - Instance of MultimodalProcessor
 * @param {Object} product - Product data
 * @returns {Object} Image processing results
 */
async function processProductImage(multimodalProcessor, product) {
  try {
    if (!product.image) {
      logger.debug(`No image provided for product ${product.id}`);
      return { basicCaption: null, imageEmbedding: null };
    }

    let imagePath;
    if (product.image.startsWith("http")) {
      logger.debug(`Downloading image for product ${product.id}`, {
        url: product.image,
      });
      imagePath = await multimodalProcessor.downloadImage(
        product.id,
        product.image
      );
      logger.debug(`Image downloaded to ${imagePath}`);
    } else {
      imagePath = path.join(
        multimodalProcessor.storageConfig.baseImagePath || process.cwd(),
        product.image
      );
      logger.debug(`Using local image path: ${imagePath}`);
    }

    // Check if the image file exists
    try {
      const fs = require("fs");
      if (!fs.existsSync(imagePath)) {
        logger.error(`Image file does not exist at path: ${imagePath}`);
        return { basicCaption: null, imageEmbedding: null };
      }
    } catch (fsError) {
      logger.error(
        `Error checking if image file exists: ${imagePath}`,
        fsError
      );
    }

    // Generate both caption and embedding in parallel
    logger.debug(
      `Starting parallel processing for product ${product.id} image`
    );
    let basicCaption = null;
    let imageEmbedding = null;

    try {
      basicCaption = await multimodalProcessor.generateCaption(
        product.id,
        imagePath,
        product.name
      );
      logger.debug(`Caption generated for product ${product.id}`, {
        caption: basicCaption,
      });
    } catch (captionError) {
      logger.error(
        `Error generating caption for product ${product.id}`,
        captionError
      );
    }

    try {
      imageEmbedding = await multimodalProcessor.getImageEmbedding(imagePath);
      logger.debug(`Image embedding generated for product ${product.id}`, {
        embeddingLength: imageEmbedding ? imageEmbedding.length : 0,
      });
    } catch (embeddingError) {
      logger.error(
        `Error generating image embedding for product ${product.id}`,
        embeddingError
      );
    }

    return { basicCaption, imageEmbedding };
  } catch (error) {
    logger.error(`Error processing image for product ${product.id}`, error);
    return { basicCaption: null, imageEmbedding: null };
  }
}

/**
 * Store product data in vector database
 * @param {Object} multimodalProcessor - Instance of MultimodalProcessor
 * @param {Object} product - Product data
 * @param {String} textEmbedding - Product text embedding
 * @param {String} imageEmbedding - Product image embedding
 * @returns {Array} Inserted IDs
 */
async function storeProductVector(
  multimodalProcessor,
  product,
  textEmbedding,
  imageEmbedding
) {
  try {
    // Ensure product.id is stored as string for consistent comparison later
    const productId = String(product.id);
    
    const insertData = {
      collection_name: multimodalProcessor.collectionName,
      fields_data: [
        {
          id: generateUniqueId(),
          product_name_vector: textEmbedding,
          image_vector: imageEmbedding,
          metadata: {
            productId: productId, // Store as string
            created_at: new Date().toISOString(),
          },
        },
      ],
    };

    const { IDs } = await multimodalProcessor.milvusClient.insert(insertData);
    await multimodalProcessor.milvusClient.flush({
      collection_names: [multimodalProcessor.collectionName],
    });

    logger.success(`Vector embedding stored for product ${productId}`, {
      IDs,
    });
    return IDs;
  } catch (error) {
    logger.error(`Failed to store vector for product ${product.id}`, error);
    throw new AppError("Vector storage failed", error.message);
  }
}

/**
 * Generate a unique numeric ID
 * @returns {Number} Unique ID
 */
function generateUniqueId() {
  return parseInt(Date.now().toString() + Math.floor(Math.random() * 1000));
}

/**
 * Process a single product
 * @param {Object} product - Product data
 * @param {Object} multimodalProcessor - Instance of MultimodalProcessor
 * @param {Number} index - Current index
 * @param {Number} total - Total items
 */
async function processProduct(product, multimodalProcessor, index, total) {
  try {
    // Ensure product.id is a string for consistent comparison
    const productId = String(product.id);
    
    logger.info(`Processing product ${index} of ${total}`, {
      id: productId,
      name: product.name,
    });

    // Check if product already exists in both databases
    const existingProduct = await Product.findOne({ sourceId: productId });    

    // Improved existence check logging
    const existsInMongoDB = !!existingProduct;    
    logger.debug(`Product ${productId} existence check:`, {
      existsInMongoDB,
    });

    if (existingProduct) {
      logger.info(
        `Product ${productId} already exists in MongoDB, skipping`
      );
      return;
    }

    // Get the image URL - handle both single image and images array format
    const imageUrl =
      product.image ||
      (product.images && product.images.length > 0 ? product.images[0] : null);

    // Process image and get analysis
    logger.debug(`Starting image processing for product ${productId}`, {
      hasImage: !!imageUrl,
      imagePath: imageUrl,
    });

    const productWithImage = { ...product, image: imageUrl };
    const { basicCaption, imageEmbedding } = await processProductImage(
      multimodalProcessor,
      productWithImage
    );

    logger.debug(`Image processing results for product ${productId}:`, {
      hasCaption: !!basicCaption,
      hasEmbedding: !!imageEmbedding,
    });

    // Create MongoDB document if needed
    if (!existingProduct) {
      logger.debug(`Creating MongoDB document for product ${productId}`);
      const mongoProduct = {
        ...product,
        image: imageUrl,
        caption: basicCaption,
      };
      const result = await createProduct(mongoProduct);
      logger.success(`MongoDB document created`, { id: result._id });
    }

    // Store vector embedding if needed
    if (imageEmbedding) {
      // Create text embedding from product data
      const textToEmbed = [
        product.name,
        product.category,
        product.description,
        product.specification,
        basicCaption,
      ]
        .filter(Boolean)
        .join(" | ");

      logger.debug(`Creating text embedding for product ${productId}`, {
        text: textToEmbed,
      });

      try {
        const textEmbedding = await multimodalProcessor.getEmbedding(
          textToEmbed,
          false
        );

        logger.debug(`Text embedding created for product ${productId}`, {
          embeddingLength: textEmbedding ? textEmbedding.length : 0,
        });

        // Store vector in Milvus
        await storeProductVector(
          multimodalProcessor,
          product,
          textEmbedding,
          imageEmbedding
        );
      } catch (embeddingError) {
        logger.error(
          `Failed to create text embedding for product ${productId}`,
          embeddingError
        );
      }
    } else {
      logger.debug(`Skipping vector creation for product ${productId}`, {
        existingVectorCount: existingVector ? existingVector.length : 0,
        hasImageEmbedding: !!imageEmbedding,
      });
    }

    // Get collection stats for verification
    const stats = await multimodalProcessor.getCollectionStats();
    logger.debug("Collection stats after processing", stats);
  } catch (error) {
    logger.error(`Error processing product ${product.id}`, error);
    // Continue with next product
  }
}

/**
 * Populate products from CSV file into MongoDB and Milvus
 * @param {String} filePath - Path to CSV file
 * @param {Object} multimodalProcessor - Instance of MultimodalProcessor
 */
async function populateProducts(filePath, multimodalProcessor) {
  try {
    logger.info("Populating products", { source: filePath });

    // Parse CSV data
    const products = await parseProductsCSV(filePath);
    logger.info(`Found ${products.length} products to process`);

    // Debugging - log the first product to see its structure
    if (products.length > 0) {
      logger.debug("First product structure:", products[0]);
    }

    // Get batch of products to process
    const { start, size } = CONFIG.batch;
    const end = Math.min(start + size, products.length);
    const batch = products.slice(start, end);
    logger.info(`Processing batch of ${batch.length} products`, { start, end });

    // Process products one by one for better debugging
    for (let i = 0; i < batch.length; i++) {
      const product = batch[i];
      try {
        await processProduct(
          product,
          multimodalProcessor,
          start + i + 1,
          batch.length
        );
        // Add a small delay between processing
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (processError) {
        logger.error(`Error processing product at index ${i}`, processError);
      }
    }

    logger.success("Products successfully populated");

    // Final verification
    const stats = await multimodalProcessor.getCollectionStats();
    logger.info("Final collection stats", stats);

    const savedProducts = await multimodalProcessor.listAllProducts();
    logger.info("Total saved products", {
      count: savedProducts ? savedProducts.length : 0,
    });
  } catch (error) {
    logger.error("Error in populateProducts", error);
    throw error;
  }
}

/**
 * Initialize database connections
 * @returns {Object} Initialized MultimodalProcessor
 */
async function initializeDatabases() {
  try {
    // Connect to MongoDB
    await mongoose.connect(CONFIG.mongodb.uri, CONFIG.mongodb.options);
    logger.info("Connected to MongoDB");

    // Initialize Milvus processor with the configuration
    const multimodalProcessor = new MultimodalProcessor(CONFIG.multimodal);
    await multimodalProcessor.init();
    await multimodalProcessor.initializeCollection();

    // Test connection to Milvus
    await multimodalProcessor.testConnection();
    logger.info("Connected to Milvus");

    // Test LLM connection
    const llmConnected = await multimodalProcessor.testLLMConnection();
    if (llmConnected) {
      logger.info(`Connected to Ollama LLM`);
    } else {
      logger.info(`Failed to connect to Ollama LLM`);
    }

    return multimodalProcessor;
  } catch (error) {
    logger.error("Failed to initialize databases", error);
    throw new AppError("Database initialization failed", error.message);
  }
}

/**
 * Close database connections
 */
async function closeDatabases() {
  try {
    await mongoose.connection.close();
    logger.info("Closed MongoDB connection");
  } catch (error) {
    logger.error("Error closing database connections", error);
  }
}

/**
 * Main function to run the migration
 * @param {String} filePath - Path to CSV file
 */
const run = async (filePath) => {
  let multimodalProcessor;
  try {
    multimodalProcessor = await initializeDatabases();
    await populateProducts(filePath, multimodalProcessor);
    return true; // Return a value to indicate successful completion
  } catch (error) {
    logger.error("Migration failed", error);
    throw error; // Re-throw to be caught by the caller
  } finally {
    await closeDatabases();
  }
};

/**
 * Clean up databases
 */
const cleanup = async () => {
  let multimodalProcessor;
  try {
    // Connect to databases
    await mongoose.connect(CONFIG.mongodb.uri, CONFIG.mongodb.options);
    logger.info("Connected to MongoDB");

    multimodalProcessor = new MultimodalProcessor();
    await multimodalProcessor.init();
    await multimodalProcessor.initializeCollection();
    await multimodalProcessor.testConnection();
    logger.info("Connected to Milvus");

    // Reset databases
    await resetDatabase(multimodalProcessor);
    logger.success("Database cleanup completed");
  } catch (error) {
    logger.error("Cleanup failed", error);
  } finally {
    await closeDatabases();
  }
};

module.exports = { run, cleanup };
