
import { useState } from 'react';
import { 
  Card, 
  CardMedia, 
  CardContent, 
  Typography, 
  CardActions, 
  Button, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions,
  Box,
  Rating,
  Chip,
  Grid
} from '@mui/material';
import { 
  ShoppingCart as CartIcon, 
  Visibility as VisibilityIcon 
} from '@mui/icons-material';
import { Product } from '../data/products';

interface ProductCardProps {
  product: Product;
}

const ProductCard = ({ product }: ProductCardProps) => {
  const [openModal, setOpenModal] = useState(false);

  const handleOpenModal = () => {
    setOpenModal(true);
  };

  const handleCloseModal = () => {
    setOpenModal(false);
  };

  return (
    <>
      <Card sx={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        transition: 'transform 0.3s, box-shadow 0.3s',
        '&:hover': {
          transform: 'translateY(-5px)',
          boxShadow: '0 12px 20px rgba(0,0,0,0.1)',
        }
      }}>
        <CardMedia
          component="img"
          height="200"
          image={product.image}
          alt={product.name}
          sx={{ objectFit: 'cover' }}
        />
        <CardContent sx={{ flexGrow: 1 }}>
          <Typography gutterBottom variant="h6" component="div" noWrap>
            {product.name}
          </Typography>
          <Typography variant="body1" color="text.primary" fontWeight="bold">
            ${product.price.toFixed(2)}
          </Typography>
          <Box display="flex" alignItems="center" mt={1}>
            <Rating value={product.rating} precision={0.5} size="small" readOnly />
            <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
              {product.rating}
            </Typography>
          </Box>
        </CardContent>
        <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
          <Button 
            size="small" 
            onClick={handleOpenModal}
            startIcon={<VisibilityIcon />}
          >
            Quick View
          </Button>
          <Button 
            variant="contained" 
            size="small" 
            color="primary"
            startIcon={<CartIcon />}
          >
            Add to Cart
          </Button>
        </CardActions>
      </Card>

      {/* Product Detail Modal */}
      <Dialog
        open={openModal}
        onClose={handleCloseModal}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Typography variant="h5" component="div">
            {product.name}
          </Typography>
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <CardMedia
                component="img"
                image={product.image}
                alt={product.name}
                sx={{ 
                  borderRadius: 1,
                  maxHeight: 400,
                  objectFit: 'cover',
                  width: '100%'
                }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Box mb={2}>
                <Typography variant="h6" color="primary" gutterBottom>
                  ${product.price.toFixed(2)}
                </Typography>
                <Box display="flex" alignItems="center" mb={1}>
                  <Rating value={product.rating} precision={0.5} readOnly />
                  <Typography variant="body2" sx={{ ml: 1 }}>
                    ({product.rating} stars)
                  </Typography>
                </Box>
                <Chip 
                  label={product.stock > 0 ? 'In Stock' : 'Out of Stock'} 
                  color={product.stock > 0 ? 'success' : 'error'}
                  size="small"
                  sx={{ mr: 1 }}
                />
                <Chip 
                  label={product.category} 
                  color="primary" 
                  variant="outlined"
                  size="small"
                />
              </Box>
              
              <Typography variant="body1" paragraph>
                {product.description}
              </Typography>
              
              <Box mt={3}>
                <Button 
                  variant="contained" 
                  color="primary" 
                  startIcon={<CartIcon />}
                  fullWidth
                >
                  Add to Cart
                </Button>
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseModal}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ProductCard;
