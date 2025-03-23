const express = require("express");
const router = express.Router();
const Product = require("./product/schema");
const MultimodalProcessor = require("./product/MultimodalProcessor");
const mongoose = require("mongoose");

const model = "Product";

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


const getAll = async (query) => {
  try {
    const { keyword } = query;
    const filter = {};
    if (keyword) {
      filter.$or = [
        { name: { $regex: keyword, $options: "i" } },
        { category: { $regex: keyword, $options: "i" } },
      ];
    }

    // pick 20 even though it says getAll

    const items = await Product.find(filter).limit(20);
    logger.info(`getAll(): ${model} fetched`, { count: items.length });
    return items;
  } catch (error) {
    logger.error(`getAll(): Failed to get ${model}`, error);
    throw new AppError(`Failed to get ${model}`, error.message);
  }
};

const ragSearch = async (queryObject) => {
  try {
    if (!queryObject) {
      return getAll({});
    }

    const { keyword: query } = queryObject;
    if (!query) {
      return getAll({});
    }

    const searchText = String(query).trim();
    logger.info(`ragSearch(): ${model} searched`, {
      query: searchText,
    });
    
    // Create and initialize MultimodalProcessor with enhanced logging
    const multimodalProcessor = new MultimodalProcessor();
    await multimodalProcessor.init();
    await multimodalProcessor.initializeCollection();
    
    // Test connection to Milvus
    const isConnected = await multimodalProcessor.testConnection();
    if (!isConnected) {
      logger.warn(`ragSearch(): Failed to connect to Milvus`);
      return getAll({ keyword: searchText }); // Fallback to regular text search
    }
    
    // Modify search parameters based on query characteristics
    let limit = 10;
    let useHybridSearch = true;
    
    // If query is very short (1-2 words), increase result limit for better coverage
    if (searchText.split(/\s+/).length <= 2) {
      limit = 16;
      logger.debug("Using increased limit for short query");
    }
    
    // Handle specific query types differently
    if (searchText.length >= 30) {
      // Long queries likely have more specific intent
      limit = 8;
      logger.debug("Using decreased limit for long, specific query");
    }
    
    // Perform RAG search with optimized parameters
    const results = await multimodalProcessor.ragSearch(
      Product,
      searchText,
      limit
    );

    if (!results || results.length === 0) {
      logger.warn(`ragSearch(): No results found, falling back to keyword search`);
      return getAll({ keyword: searchText }); // Fallback to regular text search
    }

    logger.info(`ragSearch(): ${model} searched successfully`, {
      query: searchText,
      resultCount: results.length,
      // Log search method distribution for analysis
      methodCounts: results.reduce((counts, product) => {
        const method = product._searchMethod || 'unknown';
        counts[method] = (counts[method] || 0) + 1;
        return counts;
      }, {})
    });

    return results;
  } catch (error) {
    logger.error(`ragSearch(): Failed to search ${model}`, error);
    throw new AppError(`Failed to search ${model}`, error.message);
  }
};

/**
 * Validate base64 image data
 * @param {String} base64Data - Base64 encoded image string
 * @returns {Object} - Validation result with status and imageData
 */
const validateImageData = (base64Data) => {
  if (!base64Data) {
    return { valid: false, message: "No image data provided" };
  }
  
  // Check if it's a valid image format
  const validImagePrefixes = [
    'data:image/jpeg;base64,',
    'data:image/png;base64,',
    'data:image/gif;base64,',
    'data:image/webp;base64,'
  ];
  
  // Extract data without prefix
  let imageData = base64Data;
  let hasValidPrefix = false;
  
  for (const prefix of validImagePrefixes) {
    if (base64Data.startsWith(prefix)) {
      imageData = base64Data.substring(prefix.length);
      hasValidPrefix = true;
      break;
    }
  }
  
  // If no valid prefix but contains a comma, try to extract data part
  if (!hasValidPrefix && base64Data.includes(',')) {
    imageData = base64Data.split(',')[1];
  }
  
  // Basic validation - check if it looks like valid base64
  const base64Regex = /^[A-Za-z0-9+/=]+$/;
  if (!base64Regex.test(imageData)) {
    return { valid: false, message: "Invalid base64 encoding" };
  }
  
  return { valid: true, imageData };
};

/**
 * Process the image file and create a temporary file
 * @param {Buffer} imageBuffer - Buffer containing image data
 * @returns {Object} - Object containing file path and unique ID
 */
const processImageFile = (imageBuffer) => {
  // Generate unique ID using timestamp and random string
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 10);
  const id = `search_${timestamp}_${randomStr}`;
  
  // Create temporary file path
  const tempFilePath = `/tmp/${id}.jpg`;
  
  // Get file size for logging
  const fileSizeKB = Math.round(imageBuffer.length / 1024);
  
  // Save buffer to temporary file for processing
  require('fs').writeFileSync(tempFilePath, imageBuffer);
  
  logger.info("Image saved to temporary file", { 
    id, 
    path: tempFilePath,
    sizeKB: fileSizeKB 
  });
  
  return { id, tempFilePath, fileSizeKB };
};

/**
 * Process image search request
 * @param {String} base64Image - Base64 encoded image string
 * @returns {Promise<Array>} - Array of matching products
 */
const processImageSearch = async (base64Image) => {
  try {
    // Validate image data
    const validation = validateImageData(base64Image);
    if (!validation.valid) {
      logger.error(`processImageSearch(): ${validation.message}`);
      return [];
    }

    logger.info("processImageSearch(): Processing image search request");
    
    // Create buffer from validated base64 string
    const imageBuffer = Buffer.from(validation.imageData, 'base64');
    
    // Process image file
    const { id, tempFilePath, fileSizeKB } = processImageFile(imageBuffer);
    
    // Create and initialize MultimodalProcessor
    const multimodalProcessor = new MultimodalProcessor();
    await multimodalProcessor.init();
    await multimodalProcessor.initializeCollection();
    
    // Generate image caption to use for search
    const imageCaption = await multimodalProcessor.generateCaption(id, tempFilePath);
    logger.info("processImageSearch(): Generated caption", { 
      caption: imageCaption,
      imageSizeKB: fileSizeKB 
    });
    
    // Use RAG search with the generated caption
    const results = await multimodalProcessor.ragSearch(
      Product,
      imageCaption,
      10
    );
    
    // Clean up temporary file
    try {
      require('fs').unlinkSync(tempFilePath);
      logger.debug("Temporary image file removed", { path: tempFilePath });
    } catch (err) {
      logger.error("Error cleaning up temp file", err);
    }
    
    return results;
  } catch (error) {
    logger.error(`processImageSearch(): Failed to process image search`, error);
    throw new AppError("Failed to process image search", error.message);
  }
};

/**
 * @route   GET /api/products
 * @desc    Get all products with optional filtering
 * @access  Public
 */
router.get("/", async (req, res) => {
  try {
    const { category, inStock, minPrice, maxPrice } = req.query;

    // Build filter object for MongoDB query
    const filter = {};

    if (category) {
      // Using case-insensitive regex for category filtering
      filter.category = { $regex: new RegExp(category, "i") };
    }

    if (inStock !== undefined) {
      filter.inStock = inStock === "true";
    }

    if (minPrice !== undefined) {
      filter.price = filter.price || {};
      filter.price.$gte = parseFloat(minPrice);
    }

    if (maxPrice !== undefined) {
      filter.price = filter.price || {};
      filter.price.$lte = parseFloat(maxPrice);
    }

    // Fetch products from MongoDB with filters
    const products = await Product.find(filter);

    res.json({
      success: true,
      count: products.length,
      data: products,
    });
  } catch (error) {
    console.error("Error getting products:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve products",
      error: process.env.NODE_ENV === "production" ? {} : error,
    });
  }
});

router.get(
  "/search",
  async (req, res, next) => {
    try {
      const items = await ragSearch(req.query);
      res.json(items);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/products/image-search
 * @desc    Search products using an image
 * @access  Public
 */
router.post("/image-search", async (req, res, next) => {
  try {
    const { image } = req.body;
    
    if (!image) {
      return res.status(400).json({
        success: false,
        message: "No image data provided"
      });
    }
    
    // Validate the image size roughly
    if (image.length > 2000000) { // ~2MB in base64
      return res.status(400).json({
        success: false,
        message: "Image too large, please use an image under 1.5MB"
      });
    }
    
    const results = await processImageSearch(image);
    
    if (!results || results.length === 0) {
      logger.warn("No results found for image search");
      // Return empty array with status for clarity
      return res.json({
        success: true,
        count: 0,
        data: []
      });
    } else {
      logger.success(`Image search returned ${results.length} products`);
    }
    
    res.json(results);
  } catch (error) {
    logger.error("Error in image search endpoint:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process image search",
      error: process.env.NODE_ENV === "production" ? {} : error.message
    });
  }
});

/**
 * @route   GET /api/products/:id
 * @desc    Get a single product by ID
 * @access  Public
 */
router.get("/:id", async (req, res) => {
  try {
    const id = req.params.id;

    // First try to find by MongoDB _id if it's a valid ObjectId
    let product;
    if (mongoose.Types.ObjectId.isValid(id)) {
      product = await Product.findById(id);
    }

    // If not found, try to find by sourceId
    if (!product) {
      product = await Product.findOne({ sourceId: id });
    }

    if (!product) {
      return res.status(404).json({
        success: false,
        message: `Product with id ${id} not found`,
      });
    }

    res.json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error("Error getting product by ID:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve the product",
      error: process.env.NODE_ENV === "production" ? {} : error,
    });
  }
});

/**
 * @route   GET /api/products/category/:category
 * @desc    Get products by category
 * @access  Public
 */
router.get("/category/:category", async (req, res) => {
  try {
    const category = req.params.category;

    // Using case-insensitive regex for category matching
    const categoryProducts = await Product.find({
      category: { $regex: new RegExp(category, "i") },
    });

    if (categoryProducts.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No products found in category "${category}"`,
      });
    }

    res.json({
      success: true,
      count: categoryProducts.length,
      data: categoryProducts,
    });
  } catch (error) {
    console.error("Error getting products by category:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve products by category",
      error: process.env.NODE_ENV === "production" ? {} : error,
    });
  }
});

module.exports = router;
