
import { useState, useEffect } from 'react';
import { 
  Container, 
  Grid, 
  Typography, 
  Box, 
  Button, 
  CircularProgress, 
  Fade,
  Alert,
  Divider
} from '@mui/material';
import ProductCard from '../components/ProductCard';
import SearchBar from '../components/SearchBar';
import { products, getMoreProducts, searchProducts, Product } from '../data/products';

const Home = () => {
  const [displayedProducts, setDisplayedProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<Product[] | null>(null);
  const [isSearchMode, setIsSearchMode] = useState(false);

  useEffect(() => {
    // Initialize with some products
    setDisplayedProducts(products.slice(0, 8));
  }, []);

  const handleLoadMore = async () => {
    setIsLoading(true);
    try {
      const newProducts = await getMoreProducts(4);
      setDisplayedProducts([...displayedProducts, ...newProducts]);
    } catch (error) {
      console.error('Error loading more products:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (query: string) => {
    if (query.trim() === '') {
      setIsSearchMode(false);
      setSearchResults(null);
      return;
    }
    
    setIsSearchMode(true);
    const results = searchProducts(query);
    setSearchResults(results);
  };

  const handleImageSearch = (results: Product[]) => {
    setIsSearchMode(true);
    setSearchResults(results);
  };

  const handleClearSearch = () => {
    setIsSearchMode(false);
    setSearchResults(null);
  };

  // Determine which products to display
  const productsToDisplay = isSearchMode && searchResults ? searchResults : displayedProducts;

  return (
    <Container maxWidth="lg">
      <Box textAlign="center" mb={6}>
        <Typography variant="h3" component="h1" gutterBottom fontWeight="bold">
          Shop the Latest Products
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" mb={4}>
          Discover amazing deals on our top-quality products
        </Typography>
      </Box>

      <SearchBar onSearch={handleSearch} onImageSearch={handleImageSearch} />
      
      {isSearchMode && (
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h6">
            {searchResults?.length === 0 
              ? 'No products found' 
              : `Found ${searchResults?.length} product${searchResults && searchResults.length !== 1 ? 's' : ''}`}
          </Typography>
          <Button variant="outlined" onClick={handleClearSearch}>
            Clear Search
          </Button>
        </Box>
      )}

      {isSearchMode && searchResults?.length === 0 ? (
        <Alert severity="info" sx={{ mb: 4 }}>
          No products match your search criteria. Try different keywords or browse our catalog.
        </Alert>
      ) : (
        <Fade in={true} timeout={500}>
          <Grid container spacing={3}>
            {productsToDisplay.map((product) => (
              <Grid item key={product.id} xs={12} sm={6} md={4} lg={3}>
                <ProductCard product={product} />
              </Grid>
            ))}
          </Grid>
        </Fade>
      )}
      
      {!isSearchMode && (
        <Box display="flex" justifyContent="center" mt={6} mb={4}>
          <Button 
            variant="contained" 
            color="primary" 
            onClick={handleLoadMore}
            disabled={isLoading}
            size="large"
            sx={{ px: 4, py: 1 }}
          >
            {isLoading ? (
              <>
                <CircularProgress size={24} color="inherit" sx={{ mr: 1 }} />
                Loading...
              </>
            ) : (
              'Load More Products'
            )}
          </Button>
        </Box>
      )}

      <Divider sx={{ my: 6 }} />
      
      <Box textAlign="center" mb={8}>
        <Typography variant="h4" component="h2" gutterBottom>
          Why Shop With Us?
        </Typography>
        <Grid container spacing={4} mt={2}>
          <Grid item xs={12} md={4}>
            <Box p={3}>
              <Typography variant="h6" gutterBottom>
                Free Shipping
              </Typography>
              <Typography variant="body2" color="text.secondary">
                On all orders over $50
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={4}>
            <Box p={3}>
              <Typography variant="h6" gutterBottom>
                30-Day Returns
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Money back guarantee
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={4}>
            <Box p={3}>
              <Typography variant="h6" gutterBottom>
                Secure Payments
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Protected by encryption
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
};

export default Home;
