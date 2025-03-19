const express = require('express');
const router = express.Router();
const Product = require('./product/schema');
const mongoose = require('mongoose');

/**
 * @route   GET /api/products
 * @desc    Get all products with optional filtering
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    const { category, inStock, minPrice, maxPrice } = req.query;
    
    // Build filter object for MongoDB query
    const filter = {};
    
    if (category) {
      // Using case-insensitive regex for category filtering
      filter.category = { $regex: new RegExp(category, 'i') };
    }
    
    if (inStock !== undefined) {
      filter.inStock = inStock === 'true';
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
      data: products
    });
  } catch (error) {
    console.error('Error getting products:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve products',
      error: process.env.NODE_ENV === 'production' ? {} : error
    });
  }
});

/**
 * @route   GET /api/products/:id
 * @desc    Get a single product by ID
 * @access  Public
 */
router.get('/:id', async (req, res) => {
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
        message: `Product with id ${id} not found`
      });
    }
    
    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Error getting product by ID:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve the product',
      error: process.env.NODE_ENV === 'production' ? {} : error
    });
  }
});

/**
 * @route   GET /api/products/category/:category
 * @desc    Get products by category
 * @access  Public
 */
router.get('/category/:category', async (req, res) => {
  try {
    const category = req.params.category;
    
    // Using case-insensitive regex for category matching
    const categoryProducts = await Product.find({
      category: { $regex: new RegExp(category, 'i') }
    });
    
    if (categoryProducts.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No products found in category "${category}"`
      });
    }
    
    res.json({
      success: true,
      count: categoryProducts.length,
      data: categoryProducts
    });
  } catch (error) {
    console.error('Error getting products by category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve products by category',
      error: process.env.NODE_ENV === 'production' ? {} : error
    });
  }
});

module.exports = router;