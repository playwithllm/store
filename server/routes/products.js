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
    const multimodalProcessor = new MultimodalProcessor();
    await multimodalProcessor.init();
    await multimodalProcessor.initializeCollection();
    const isConnected = await multimodalProcessor.testConnection();
    if (!isConnected) {
      logger.warn(`ragSearch(): Failed to connect to Milvus`);
      return getAll({ keyword: searchText }); // Fallback to regular text search
    }

    // Perform RAG search
    const results = await multimodalProcessor.ragSearch(
      Product,
      searchText,
      10
    );

    if (!results || results.length === 0) {
      logger.warn(`ragSearch(): No results found`);
      return getAll({ keyword: searchText }); // Fallback to regular text search
    }

    logger.info(`ragSearch(): ${model} searched`, {
      query: searchText,
      resultCount: results.length,
    });

    return results;
  } catch (error) {
    logger.error(`ragSearch(): Failed to search ${model}`, error);
    throw new AppError(`Failed to search ${model}`, error.message);
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
