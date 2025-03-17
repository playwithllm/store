
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
import { imageSearchProducts } from '../data/products';

interface SearchBarProps {
  onSearch: (query: string) => void;
  onImageSearch: (results: any[]) => void;
}

const SearchBar = ({ onSearch, onImageSearch }: SearchBarProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleTextSearch = () => {
    if (searchQuery.trim()) {
      onSearch(searchQuery);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTextSearch();
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    onSearch('');
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
      // In a real app, this would send the image to a server for visual search
      const results = await imageSearchProducts(file);
      onImageSearch(results);
    } catch (error) {
      console.error('Error processing image search:', error);
    } finally {
      setIsLoading(false);
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
    >
      <InputBase
        sx={{ ml: 1, flex: 1 }}
        placeholder="Search for products..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onKeyPress={handleKeyPress}
        inputProps={{ 'aria-label': 'search products' }}
      />
      
      {searchQuery && (
        <IconButton 
          aria-label="clear search" 
          onClick={handleClearSearch}
          sx={{ p: '10px' }}
        >
          <ClearIcon />
        </IconButton>
      )}
      
      <IconButton 
        type="button" 
        sx={{ p: '10px' }} 
        aria-label="search"
        onClick={handleTextSearch}
      >
        <SearchIcon />
      </IconButton>
      
      <Divider sx={{ height: 28, m: 0.5 }} orientation="vertical" />
      
      <Box sx={{ position: 'relative' }}>
        <input
          accept="image/*"
          type="file"
          id="image-upload"
          onChange={handleImageUpload}
          style={{ display: 'none' }}
        />
        <label htmlFor="image-upload">
          <IconButton 
            color="primary" 
            aria-label="upload image for search" 
            component="span"
            sx={{ p: '10px' }}
            disabled={isLoading}
          >
            {isLoading ? <CircularProgress size={24} /> : <ImageIcon />}
          </IconButton>
        </label>
        {selectedImage && !isLoading && (
          <Typography variant="caption" sx={{ position: 'absolute', bottom: -20, right: 0, whiteSpace: 'nowrap' }}>
            Image selected
          </Typography>
        )}
      </Box>
    </Paper>
  );
};

export default SearchBar;
