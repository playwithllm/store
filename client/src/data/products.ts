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

// RAG Search products via API - uses the server's /search endpoint for better semantic search
export const ragSearchProducts = async (query: string): Promise<Product[]> => {
  try {
    console.log('Performing RAG search for:', query);
    const response = await axios.get(`${API_URL}/products/search`, {
      params: { 
        keyword: query,
        limit: 10
      }
    });
    
    // Server returns products directly from the RAG search
    const searchResults = response.data;
    
    if (searchResults && Array.isArray(searchResults)) {
      // Map to client format with enhanced metadata
      return searchResults.map((product: any) => ({
        id: product._id?.toString() || product.sourceId?.toString() || product.id?.toString(),
        name: product.name,
        price: product.price,
        description: product.description || '',
        image: product.image || product.images?.[0] || '',
        category: product.category,
        stock: product.inStock ? (product.rating?.count || 10) : 0,
        rating: product.rating?.rate || 4.0,
        // Add search relevance score if available
        searchScore: product.score || null,
        matchType: product.matchType || 'semantic'
      }));
    }
    return [];
  } catch (error) {
    console.error('Error performing RAG search:', error);
    // Fallback to regular search if RAG search fails
    return searchProducts(query);
  }
};

// Legacy search products via API - uses basic filtering
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

// Image search using the server's RAG functionality
export const imageSearchProducts = async (base64Image: string): Promise<Product[]> => {
  try {
    console.log('Performing image search with base64 data');
    
    // Validate image size before sending
    if (base64Image.length > 2000000) { // ~2MB in base64
      console.error('Image too large, please use a smaller image');
      return await ragSearchProducts('clothing');
    }
    
    // Send the base64 image data directly to the server
    const response = await axios.post(
      `${API_URL}/products/image-search`,
      { image: base64Image },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    // Handle response based on structure
    // If the API returns an object with success and data properties
    if (response.data && response.data.success && Array.isArray(response.data.data)) {
      if (response.data.data.length === 0) {
        console.log('No image search results, falling back to regular search');
        return await ragSearchProducts('clothing');
      }
      return response.data.data.map(mapProductToClientFormat);
    }
    
    // If the API returns an array directly
    if (Array.isArray(response.data) && response.data.length > 0) {
      return response.data.map(mapProductToClientFormat);
    }
    
    // No results found, fallback to text search
    console.log('No image search results, falling back to regular search');
    return await ragSearchProducts('clothing');
  } catch (error) {
    console.error('Error in image search:', error);
    // Fallback to a limited set of products rather than all products
    const allProducts = await fetchProducts();
    return allProducts.slice(0, 5); // Return just 5 products as fallback
  }
};

// Helper function to map server product to client format
const mapProductToClientFormat = (product: any): Product => ({
  id: product._id?.toString() || product.sourceId?.toString() || product.id?.toString(),
  name: product.name,
  price: product.price,
  description: product.description || '',
  image: product.image || product.images?.[0] || '',
  category: product.category,
  stock: product.inStock ? (product.rating?.count || 10) : 0,
  rating: product.rating?.rate || 4.0,
  matchType: product._searchMethod || 'visual'
});
