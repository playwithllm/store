const mongoose = require("mongoose");
const path = require("path");
const Product = require("../../../routes/product/schema");
const { parseProductsCSV } = require("./parse-products");
const MultimodalProcessor = require("../../../routes/product/MultimodalProcessor");

// Configuration
const CONFIG = {
  mongodb: {
    uri: process.env.MONGODB_URI || "mongodb://localhost:27017/pwllmstoredb",
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true
    }
  },
  batch: {
    start: parseInt(process.env.BATCH_START, 10) || 0,
    size: parseInt(process.env.BATCH_SIZE, 10) || 10
  },
  processing: {
    delayMs: parseInt(process.env.PROCESSING_DELAY_MS, 10) || 1000,
    concurrency: parseInt(process.env.PROCESSING_CONCURRENCY, 10) || 3
  },
  multimodal: {
    // LLM provider configuration
    llm: {
      // Use environment variables with fallbacks
      defaultProvider: process.env.LLM_DEFAULT_PROVIDER || "ollama",
      ollama: {
        baseUrl: process.env.OLLAMA_URL || "http://192.168.4.106:11434",
        models: {
          multimodal: process.env.OLLAMA_MODEL_MULTIMODAL || "llama3.2",
          text: process.env.OLLAMA_MODEL_TEXT || "gemma3:12b",
          coder: process.env.OLLAMA_MODEL_CODER || "qwen2.5-coder:32b",
          embedding: process.env.OLLAMA_MODEL_EMBEDDING || "nomic-embed-text"
        }
      },
      alternative: {
        baseUrl: process.env.ALT_LLM_URL || "http://192.168.4.28:8000",
        models: {
          multimodal: process.env.ALT_MODEL_MULTIMODAL || "OpenGVLab/InternVL2_5-1B-MPO",
          text: process.env.ALT_MODEL_TEXT || "gemma3:12b"
        }
      }
    },
    // Milvus configuration
    milvus: {
      address: process.env.MILVUS_ADDRESS || "localhost:19530",
      collection: process.env.MILVUS_COLLECTION || "multimodal_collection_pwllm"
    },
    // Storage configuration for images
    storage: {
      baseImagePath: process.env.IMAGE_STORAGE_PATH || path.join(process.cwd(), "uploads"),
      maxImageSize: parseInt(process.env.MAX_IMAGE_SIZE, 10) || 5 * 1024 * 1024,
      allowedFormats: (process.env.ALLOWED_IMAGE_FORMATS || "jpg,jpeg,png").split(",")
    }
  }
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
  }
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
      logger.debug("Current products after reset", { count: savedProducts.length });
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
      logger.debug(`Downloading image for product ${product.id}`, { url: product.image });
      imagePath = await multimodalProcessor.downloadImage(product.id, product.image);
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
      const fs = require('fs');
      if (!fs.existsSync(imagePath)) {
        logger.error(`Image file does not exist at path: ${imagePath}`);
        return { basicCaption: null, imageEmbedding: null };
      }
    } catch (fsError) {
      logger.error(`Error checking if image file exists: ${imagePath}`, fsError);
    }

    // Generate both caption and embedding in parallel
    logger.debug(`Starting parallel processing for product ${product.id} image`);
    let basicCaption = null;
    let imageEmbedding = null;
    
    try {
      basicCaption = await multimodalProcessor.generateCaption(product.id, imagePath, product.name);
      logger.debug(`Caption generated for product ${product.id}`, { caption: basicCaption });
    } catch (captionError) {
      logger.error(`Error generating caption for product ${product.id}`, captionError);
    }
    
    try {
      imageEmbedding = await multimodalProcessor.getImageEmbedding(imagePath);
      logger.debug(`Image embedding generated for product ${product.id}`, {
        embeddingLength: imageEmbedding ? imageEmbedding.length : 0
      });
    } catch (embeddingError) {
      logger.error(`Error generating image embedding for product ${product.id}`, embeddingError);
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
async function storeProductVector(multimodalProcessor, product, textEmbedding, imageEmbedding) {
  try {
    const insertData = {
      collection_name: multimodalProcessor.collectionName,
      fields_data: [
        {
          id: generateUniqueId(),
          product_name_vector: textEmbedding,
          image_vector: imageEmbedding,
          metadata: {
            productId: product.id,
            created_at: new Date().toISOString(),
          },
        },
      ],
    };

    const { IDs } = await multimodalProcessor.milvusClient.insert(insertData);
    await multimodalProcessor.milvusClient.flush({
      collection_names: [multimodalProcessor.collectionName],
    });

    logger.success(`Vector embedding stored for product ${product.id}`, { IDs });
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
  return parseInt(
    Date.now().toString() + Math.floor(Math.random() * 1000)
  );
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
    logger.info(`Processing product ${index} of ${total}`, {
      id: product.id,
      name: product.name
    });

    // Check if product already exists in both databases
    const existingProduct = await Product.findOne({ sourceId: product.id });
    
    logger.debug(`Checking if product exists in Milvus: ${product.id}`);
    let existingVector = [];
    try {
      existingVector = await multimodalProcessor.searchByMetadata({
        productId: product.id,
      });
    } catch (searchError) {
      logger.error(`Error searching Milvus for product ${product.id}`, searchError);
    }

    logger.debug(`Product ${product.id} existence check:`, {
      existsInMongoDB: !!existingProduct,
      existsInMilvus: existingVector && existingVector.length > 0
    });

    if (existingProduct && existingVector && existingVector.length > 0) {
      logger.info(`Product ${product.id} already exists in both databases, skipping`);
      return;
    }

    // Get the image URL - handle both single image and images array format
    const imageUrl = product.image || (product.images && product.images.length > 0 ? product.images[0] : null);
    
    // Process image and get analysis
    logger.debug(`Starting image processing for product ${product.id}`, {
      hasImage: !!imageUrl,
      imagePath: imageUrl
    });

    const productWithImage = { ...product, image: imageUrl };
    const { basicCaption, imageEmbedding } = await processProductImage(
      multimodalProcessor,
      productWithImage
    );

    logger.debug(`Image processing results for product ${product.id}:`, {
      hasCaption: !!basicCaption,
      hasEmbedding: !!imageEmbedding
    });

    // Create MongoDB document if needed
    if (!existingProduct) {
      logger.debug(`Creating MongoDB document for product ${product.id}`);
      const mongoProduct = {
        ...product,
        image: imageUrl,
        caption: basicCaption,
      };
      const result = await createProduct(mongoProduct);
      logger.success(`MongoDB document created`, { id: result._id });
    }

    // Store vector embedding if needed
    if ((!existingVector || !existingVector.length) && imageEmbedding) {
      // Create text embedding from product data
      const textToEmbed = [
        product.name,
        product.category,
        basicCaption,
      ]
        .filter(Boolean)
        .join(" ");

      logger.debug(`Creating text embedding for product ${product.id}`, { text: textToEmbed });
      
      try {
        const textEmbedding = await multimodalProcessor.getEmbedding(
          textToEmbed,
          false
        );
        
        logger.debug(`Text embedding created for product ${product.id}`, {
          embeddingLength: textEmbedding ? textEmbedding.length : 0
        });

        // Store vector in Milvus
        await storeProductVector(
          multimodalProcessor,
          product,
          textEmbedding,
          imageEmbedding
        );
      } catch (embeddingError) {
        logger.error(`Failed to create text embedding for product ${product.id}`, embeddingError);
      }
    } else {
      logger.debug(`Skipping vector creation for product ${product.id}`, {
        existingVectorCount: existingVector ? existingVector.length : 0,
        hasImageEmbedding: !!imageEmbedding
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
        await processProduct(product, multimodalProcessor, start + i + 1, batch.length);
        // Add a small delay between processing
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (processError) {
        logger.error(`Error processing product at index ${i}`, processError);
      }
    }

    logger.success("Products successfully populated");

    // Final verification
    const stats = await multimodalProcessor.getCollectionStats();
    logger.info("Final collection stats", stats);

    const savedProducts = await multimodalProcessor.listAllProducts();
    logger.info("Total saved products", { count: savedProducts ? savedProducts.length : 0 });
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
    const llmProvider = CONFIG.multimodal.llm.defaultProvider;
    const llmConnected = await multimodalProcessor.testLLMConnection();
    if (llmConnected) {
      logger.info(`Connected to LLM provider (${llmProvider})`);
    } else {
      logger.info(`Using fallback LLM provider (switched from ${llmProvider})`);
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
