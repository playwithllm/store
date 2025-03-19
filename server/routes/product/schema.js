const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  sourceId: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    required: false,
  },
  price: {
    type: Number,
    required: true,
    default: 0,
  },
  description: {
    type: String,
    required: false,
  },
  specification: {
    type: String,
    required: false,
  },
  image: {
    type: String,
    required: false,
  },
  productUrl: {
    type: String,
    required: true,
  },
  caption: {
    type: String,
    required: false,
  },
  rating: {
    rate: {
      type: Number,
      required: false,
      default: 0,
    },
    count: {
      type: Number,
      required: false,
      default: 0,
    },
  },
  inStock: {
    type: Boolean,
    required: false,
    default: false,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Product', productSchema);
  