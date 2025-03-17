const express = require('express');
const router = express.Router();

// Hardcoded products data
const products = [
  {
    id: 1,
    name: "Premium Wireless Headphones",
    description: "High-quality wireless headphones with noise cancellation technology and long battery life.",
    price: 199.99,
    category: "Electronics",
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=400",
    rating: { rate: 4.8, count: 156 },
    inStock: true,
    features: ["Noise Cancellation", "40-hour Battery", "Bluetooth 5.0", "Voice Assistant Compatible"]
  },
  {
    id: 2,
    name: "Ergonomic Office Chair",
    description: "Comfortable ergonomic office chair with adjustable features for optimal posture.",
    price: 249.99,
    category: "Furniture",
    image: "https://images.unsplash.com/photo-1580480055273-228ff5388ef8?q=80&w=400",
    rating: { rate: 4.5, count: 89 },
    inStock: true,
    features: ["Adjustable Height", "Lumbar Support", "360° Swivel", "Breathable Mesh Back"]
  },
  {
    id: 3,
    name: "Smartphone Pro Max",
    description: "Latest smartphone with advanced camera and high-performance processor.",
    price: 899.99,
    category: "Electronics",
    image: "https://images.unsplash.com/photo-1598327105666-5b89351aff97?q=80&w=400",
    rating: { rate: 4.7, count: 245 },
    inStock: true,
    features: ["6.7-inch OLED Display", "Triple Camera System", "5G Compatible", "All-Day Battery Life"]
  },
  {
    id: 4,
    name: "Smart Fitness Watch",
    description: "Track your fitness goals with this advanced smartwatch featuring health monitoring.",
    price: 149.99,
    category: "Wearables",
    image: "https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?q=80&w=400",
    rating: { rate: 4.3, count: 117 },
    inStock: true,
    features: ["Heart Rate Monitor", "Sleep Tracking", "GPS", "Water Resistant"]
  },
  {
    id: 5,
    name: "Portable Bluetooth Speaker",
    description: "Powerful portable speaker with exceptional sound quality and waterproof design.",
    price: 79.99,
    category: "Electronics",
    image: "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?q=80&w=400",
    rating: { rate: 4.4, count: 78 },
    inStock: false,
    features: ["Waterproof", "10-hour Battery Life", "Built-in Microphone", "Compact Design"]
  },
  {
    id: 6,
    name: "Stainless Steel Water Bottle",
    description: "Eco-friendly insulated water bottle that keeps beverages hot or cold for hours.",
    price: 24.99,
    category: "Kitchen",
    image: "https://images.unsplash.com/photo-1523362628745-0c100150b504?q=80&w=400",
    rating: { rate: 4.9, count: 203 },
    inStock: true,
    features: ["24-hour Insulation", "BPA Free", "Leak-proof Cap", "Eco-friendly"]
  },
  {
    id: 7,
    name: "Wireless Charging Pad",
    description: "Convenient wireless charger compatible with the latest smartphones and earbuds.",
    price: 29.99,
    category: "Electronics",
    image: "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?q=80&w=400",
    rating: { rate: 4.2, count: 65 },
    inStock: true,
    features: ["Fast Charging", "Multi-device Compatible", "LED Indicator", "Slim Design"]
  },
  {
    id: 8,
    name: "Smart Home Security Camera",
    description: "HD security camera with motion detection and night vision for home monitoring.",
    price: 119.99,
    category: "Home Security",
    image: "https://images.unsplash.com/photo-1555664424-778a1e5e1b48?q=80&w=400",
    rating: { rate: 4.6, count: 112 },
    inStock: true,
    features: ["1080p HD Video", "Night Vision", "Motion Detection", "Two-way Audio"]
  }
];

/**
 * @route   GET /api/products
 * @desc    Get all products with optional filtering
 * @access  Public
 */
router.get('/', (req, res) => {
  try {
    const { category, inStock, minPrice, maxPrice } = req.query;
    
    // Apply filters if provided
    let filteredProducts = [...products];
    
    if (category) {
      filteredProducts = filteredProducts.filter(
        product => product.category.toLowerCase() === category.toLowerCase()
      );
    }
    
    if (inStock !== undefined) {
      const stockValue = inStock === 'true';
      filteredProducts = filteredProducts.filter(product => product.inStock === stockValue);
    }
    
    if (minPrice !== undefined) {
      filteredProducts = filteredProducts.filter(
        product => product.price >= parseFloat(minPrice)
      );
    }
    
    if (maxPrice !== undefined) {
      filteredProducts = filteredProducts.filter(
        product => product.price <= parseFloat(maxPrice)
      );
    }
    
    res.json({
      success: true,
      count: filteredProducts.length,
      data: filteredProducts
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
router.get('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const product = products.find(p => p.id === id);
    
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
router.get('/category/:category', (req, res) => {
  try {
    const category = req.params.category;
    const categoryProducts = products.filter(
      p => p.category.toLowerCase() === category.toLowerCase()
    );
    
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