const express = require('express');
const router = express.Router();
const productsRoutes = require('./products');

// Mount the products routes under /api/products
router.use('/products', productsRoutes);

module.exports = router;