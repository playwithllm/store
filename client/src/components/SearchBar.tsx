import { useState } from 'react';
import {
  Paper,
  InputBase,
  IconButton,
  Divider,
  Box,
  CircularProgress,
  Typography
} from '@mui/material';
import {
  Search as SearchIcon,
  Image as ImageIcon,
  Clear as ClearIcon
} from '@mui/icons-material';
import { Product, imageSearchProducts, ragSearchProducts } from '../data/products';

interface SearchBarProps {
  onSearch: (results: Product[]) => void;
  onImageSearch: (results: Product[]) => void;
  handleClearSearch: () => void;
}

const SearchBar = ({ onSearch, onImageSearch, handleClearSearch }: SearchBarProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleTextSearch = async () => {
    if (searchQuery.trim()) {
      setIsLoading(true);
      try {
        const results = await ragSearchProducts(searchQuery);
        onSearch(results);
      } catch (error) {
        console.error('Error in text search:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      // Check file type
      if (!file.type.match('image.*')) {
        alert('Please upload an image file');
        return;
      }

      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Image should be less than 5MB');
        return;
      }

      setSelectedImage(file);
      processImageSearch(file);
    }
  };

  const processImageSearch = async (file: File) => {
    setIsLoading(true);
    try {
      const results = await imageSearchProducts(file);
      onImageSearch(results);
    } catch (error) {
      console.error('Error processing image search:', error);
    } finally {
      setIsLoading(false);
      setSelectedImage(null);
    }
  };

  return (
    <Paper
      component="form"
      elevation={3}
      sx={{
        p: '2px 4px',
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        mb: 4,
        borderRadius: 2
      }}
      onSubmit={(e) => {
        e.preventDefault();
        if (searchQuery.trim()) {
          handleTextSearch();
        }
      }}
    >
      <InputBase
        sx={{ ml: 1, flex: 1 }}
        placeholder="Search for products..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        inputProps={{ 'aria-label': 'search products' }}
        disabled={isLoading}
      />

      {searchQuery && (
        <IconButton
          aria-label="clear search"
          onClick={() => { handleClearSearch(); setSearchQuery(''); }}
          sx={{ p: '10px' }}
          disabled={isLoading}
        >
          <ClearIcon />
        </IconButton>
      )}

      <IconButton
        type="button"
        sx={{ p: '10px' }}
        aria-label="search"
        onClick={handleTextSearch}
        disabled={isLoading}
      >
        {isLoading ? <CircularProgress size={24} /> : <SearchIcon />}
      </IconButton>

      <Divider sx={{ height: 28, m: 0.5 }} orientation="vertical" />

      <input
        type="file"
        accept="image/*"
        id="image-upload"
        style={{ display: 'none' }}
        onChange={handleImageUpload}
        disabled={isLoading}
      />

      <IconButton
        color="primary"
        aria-label="upload picture"
        component="label"
        htmlFor="image-upload"
        sx={{ p: '10px' }}
        disabled={isLoading}
      >
        <ImageIcon />
      </IconButton>

      {selectedImage && (
        <Box sx={{ px: 2 }}>
          <Typography variant="caption" color="textSecondary">
            {selectedImage.name}
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

export default SearchBar;
