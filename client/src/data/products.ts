import axios from 'axios';

// API base URL from environment variables with fallback
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  image: string;
  category: string;
  stock: number;
  rating: number;
}

// Initialize with empty array
export const products: Product[] = [];

// Function to fetch products from the server
export const fetchProducts = async (): Promise<Product[]> => {
  try {
    const response = await axios.get(`${API_URL}/products`);
    
    if (response.data.success) {
      // Map server product structure to client Product interface
      return response.data.data.map((product: any) => ({
        id: product.id.toString(),
        name: product.name,
        price: product.price,
        description: product.description,
        image: product.image,
        category: product.category,
        stock: product.inStock ? (product.rating?.count || 10) : 0, // Use count as stock or default to 10
        rating: product.rating?.rate || 4.0 // Default rating if not available
      }));
    }
    return [];
  } catch (error) {
    console.error('Error fetching products:', error);
    return [];
  }
};

// Function to get more products (now fetches from server with pagination/offset)
export const getMoreProducts = async (count: number): Promise<Product[]> => {
  try {
    // In a real implementation, you would use query params for pagination
    // For now, we'll simulate by getting all products and filtering
    const response = await axios.get(`${API_URL}/products`);
    
    if (response.data.success) {
      const allProducts = response.data.data;
      // Get a random subset of products to simulate "more" products
      const shuffled = [...allProducts].sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, count);
      
      // Map to client format with slight modifications to make them appear different
      return selected.map((product: any) => ({
        id: `more-${product.id}`,
        name: `New ${product.name}`,
        price: product.price * 0.9, // 10% discount to simulate "new" products
        description: product.description,
        image: product.image,
        category: product.category,
        stock: product.inStock ? (product.rating?.count || 10) : 0,
        rating: product.rating?.rate || 4.0
      }));
    }
    return [];
  } catch (error) {
    console.error('Error fetching more products:', error);
    return [];
  }
};

// Search products via API
export const searchProducts = async (query: string): Promise<Product[]> => {
  try {
    // In a real implementation, the server would have a search endpoint
    // For now, we'll fetch all and filter client-side
    const response = await axios.get(`${API_URL}/products`);
    
    if (response.data.success) {
      const allProducts = response.data.data;
      const lowercaseQuery = query.toLowerCase();
      
      const filtered = allProducts.filter(
        (product: any) => 
          product.name.toLowerCase().includes(lowercaseQuery) || 
          product.description.toLowerCase().includes(lowercaseQuery) ||
          product.category.toLowerCase().includes(lowercaseQuery)
      );
      
      // Map to client format
      return filtered.map((product: any) => ({
        id: product.id.toString(),
        name: product.name,
        price: product.price,
        description: product.description,
        image: product.image,
        category: product.category,
        stock: product.inStock ? (product.rating?.count || 10) : 0,
        rating: product.rating?.rate || 4.0
      }));
    }
    return [];
  } catch (error) {
    console.error('Error searching products:', error);
    return [];
  }
};

// Image search simulation (in a real app, this would use image recognition APIs)
export const imageSearchProducts = (image: File): Promise<Product[]> => {
  return new Promise(async (resolve) => {
    // Simulate processing time
    setTimeout(async () => {
      try {
        // Get random products as results (simulating image recognition)
        const allProducts = await fetchProducts();
        const shuffled = [...allProducts].sort(() => 0.5 - Math.random());
        resolve(shuffled.slice(0, 3));
      } catch (error) {
        console.error('Error in image search:', error);
        resolve([]);
      }
    }, 2000);
  });
};
