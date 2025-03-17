
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

export const products: Product[] = [
  {
    id: '1',
    name: 'Premium Wireless Headphones',
    price: 199.99,
    description: 'Experience premium sound quality with these wireless headphones. Features noise cancellation and 30-hour battery life.',
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1170&q=80',
    category: 'Electronics',
    stock: 15,
    rating: 4.5
  },
  {
    id: '2',
    name: 'Smart Watch Series 6',
    price: 349.99,
    description: 'Track your fitness, heart rate, and stay connected with this premium smartwatch. Water-resistant and long battery life.',
    image: 'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1172&q=80',
    category: 'Electronics',
    stock: 10,
    rating: 4.8
  },
  {
    id: '3',
    name: 'Leather Camera Bag',
    price: 79.99,
    description: 'Stylish and durable leather camera bag with multiple compartments for your camera and accessories.',
    image: 'https://images.unsplash.com/photo-1547949003-9792a18a2601?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1170&q=80',
    category: 'Accessories',
    stock: 20,
    rating: 4.3
  },
  {
    id: '4',
    name: 'Minimalist Desk Lamp',
    price: 49.99,
    description: 'Modern and minimalist desk lamp with adjustable brightness and color temperature.',
    image: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1170&q=80',
    category: 'Home Decor',
    stock: 25,
    rating: 4.0
  },
  {
    id: '5',
    name: 'Portable Bluetooth Speaker',
    price: 129.99,
    description: 'Waterproof portable speaker with 360-degree sound and 20-hour battery life.',
    image: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1036&q=80',
    category: 'Electronics',
    stock: 18,
    rating: 4.7
  },
  {
    id: '6',
    name: 'Leather Wallet',
    price: 59.99,
    description: 'Handcrafted genuine leather wallet with RFID protection and multiple card slots.',
    image: 'https://images.unsplash.com/photo-1627123424574-724758594e93?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1171&q=80',
    category: 'Accessories',
    stock: 30,
    rating: 4.2
  },
  {
    id: '7',
    name: 'Ceramic Coffee Mug Set',
    price: 34.99,
    description: 'Set of 4 handmade ceramic coffee mugs in assorted colors. Microwave and dishwasher safe.',
    image: 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1170&q=80',
    category: 'Home Decor',
    stock: 22,
    rating: 4.4
  },
  {
    id: '8',
    name: 'Compact Digital Camera',
    price: 399.99,
    description: '20MP digital camera with 5x optical zoom and 4K video recording capability.',
    image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1164&q=80',
    category: 'Electronics',
    stock: 8,
    rating: 4.6
  }
];

// Function to get more products (simulating loading more)
export const getMoreProducts = (count: number): Promise<Product[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      // Clone and modify the existing products to create "new" ones
      const moreProducts = products.map((product, index) => ({
        ...product,
        id: `more-${index + 1}`,
        name: `New ${product.name}`,
        price: product.price * 0.9, // 10% discount on new items
      }));
      resolve(moreProducts.slice(0, count));
    }, 1000);
  });
};

// Search products
export const searchProducts = (query: string): Product[] => {
  const lowercaseQuery = query.toLowerCase();
  return products.filter(
    product => 
      product.name.toLowerCase().includes(lowercaseQuery) || 
      product.description.toLowerCase().includes(lowercaseQuery) ||
      product.category.toLowerCase().includes(lowercaseQuery)
  );
};

// Image search simulation (in a real app, this would use image recognition APIs)
export const imageSearchProducts = (image: File): Promise<Product[]> => {
  return new Promise((resolve) => {
    // Simulate processing time
    setTimeout(() => {
      // Return random products as results (simulating image recognition)
      const shuffled = [...products].sort(() => 0.5 - Math.random());
      resolve(shuffled.slice(0, 3));
    }, 2000);
  });
};
