
import { useState, useRef, useEffect } from 'react';
import { 
  Container, 
  Box, 
  TextField, 
  IconButton, 
  Paper, 
  Typography, 
  Divider,
  CircularProgress,
  InputAdornment
} from '@mui/material';
import { 
  Send as SendIcon, 
  AttachFile as AttachIcon,
  SmartToy as BotIcon
} from '@mui/icons-material';
import ChatMessage from '../components/ChatMessage';
import { ChatMessage as ChatMessageType, initialMessages, getRandomBotResponse } from '../data/chatMessages';
import { useAuth } from '../context/AuthContext';

const Chat = () => {
  const { isAuthenticated, user } = useAuth();
  const [messages, setMessages] = useState<ChatMessageType[]>(initialMessages);
  const [inputMessage, setInputMessage] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleMessageSubmit = () => {
    if (inputMessage.trim() === '' && !selectedImage) return;

    // Generate a unique ID
    const userMessageId = `user-${Date.now()}`;
    
    // Create user message object
    const userMessage: ChatMessageType = {
      id: userMessageId,
      text: inputMessage.trim(),
      sender: 'user',
      timestamp: new Date(),
    };

    // If there's a selected image, add it to the message
    if (selectedImage) {
      userMessage.image = URL.createObjectURL(selectedImage);
    }

    // Add user message to chat
    setMessages((prevMessages) => [...prevMessages, userMessage]);
    
    // Clear input and selected image
    setInputMessage('');
    setSelectedImage(null);
    
    // Simulate bot typing
    setIsTyping(true);
    
    // Simulate bot response after a delay
    setTimeout(() => {
      const botResponse: ChatMessageType = {
        id: `bot-${Date.now()}`,
        text: getRandomBotResponse(),
        sender: 'bot',
        timestamp: new Date(),
      };
      
      setMessages((prevMessages) => [...prevMessages, botResponse]);
      setIsTyping(false);
    }, 1500);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleMessageSubmit();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    }
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  return (
    <Container maxWidth="md">
      <Paper
        elevation={3}
        sx={{
          height: 'calc(100vh - 180px)',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        {/* Chat Header */}
        <Box
          sx={{
            p: 2,
            bgcolor: 'primary.main',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <BotIcon sx={{ mr: 1 }} />
          <Typography variant="h6">Customer Support</Typography>
        </Box>
        
        <Divider />
        
        {/* Messages Container */}
        <Box
          sx={{
            p: 2,
            flexGrow: 1,
            bgcolor: 'background.default',
            overflowY: 'auto',
          }}
        >
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}
          
          {isTyping && (
            <Box sx={{ display: 'flex', alignItems: 'center', ml: 2, mb: 2 }}>
              <CircularProgress size={20} sx={{ mr: 2 }} />
              <Typography variant="body2" color="text.secondary">
                Bot is typing...
              </Typography>
            </Box>
          )}
          
          <div ref={messagesEndRef} />
        </Box>
        
        <Divider />
        
        {/* Image Preview */}
        {selectedImage && (
          <Box sx={{ 
            p: 1, 
            display: 'flex', 
            alignItems: 'center',
            bgcolor: 'background.paper',
            borderTop: 1,
            borderColor: 'divider',
          }}>
            <Box
              component="img"
              src={URL.createObjectURL(selectedImage)}
              alt="Selected"
              sx={{ 
                height: 60, 
                width: 60, 
                objectFit: 'cover', 
                borderRadius: 1,
                mr: 1
              }}
            />
            <Typography variant="caption">
              {selectedImage.name}
            </Typography>
            <IconButton 
              size="small" 
              onClick={() => setSelectedImage(null)}
              sx={{ ml: 'auto' }}
            >
              <SendIcon fontSize="small" />
            </IconButton>
          </Box>
        )}
        
        {/* Input Area */}
        <Box
          sx={{
            p: 2,
            bgcolor: 'background.paper',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <input
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
            ref={fileInputRef}
          />
          
          <IconButton 
            color="primary" 
            onClick={openFileDialog}
            disabled={!!selectedImage}
          >
            <AttachIcon />
          </IconButton>
          
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Type your message..."
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            multiline
            maxRows={3}
            size="small"
            sx={{ mx: 1 }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton 
                    color="primary" 
                    onClick={handleMessageSubmit}
                    disabled={inputMessage.trim() === '' && !selectedImage}
                  >
                    <SendIcon />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </Box>
      </Paper>
    </Container>
  );
};

export default Chat;
