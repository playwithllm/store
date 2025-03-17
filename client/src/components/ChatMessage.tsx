
import { Box, Avatar, Typography, Paper, Card } from '@mui/material';
import { ChatMessage as ChatMessageType } from '../data/chatMessages';
import { SmartToy as BotIcon, Person as PersonIcon } from '@mui/icons-material';

interface ChatMessageProps {
  message: ChatMessageType;
}

const ChatMessage = ({ message }: ChatMessageProps) => {
  const isUser = message.sender === 'user';
  
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        mb: 2,
      }}
    >
      {!isUser && (
        <Avatar sx={{ bgcolor: 'primary.main', mr: 1 }}>
          <BotIcon />
        </Avatar>
      )}
      
      <Box sx={{ maxWidth: '70%' }}>
        <Paper
          elevation={1}
          sx={{
            p: 2,
            bgcolor: isUser ? 'primary.main' : 'background.paper',
            color: isUser ? 'white' : 'text.primary',
            borderRadius: isUser ? '20px 20px 5px 20px' : '20px 20px 20px 5px',
          }}
        >
          <Typography variant="body1">{message.text}</Typography>
          
          {message.image && (
            <Card sx={{ mt: 1, overflow: 'hidden', maxWidth: 200 }}>
              <img 
                src={message.image} 
                alt="Shared in chat" 
                style={{ width: '100%', display: 'block' }} 
              />
            </Card>
          )}
        </Paper>
        
        <Typography
          variant="caption"
          sx={{
            mt: 0.5,
            display: 'block',
            textAlign: isUser ? 'right' : 'left',
            color: 'text.secondary',
          }}
        >
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Typography>
      </Box>
      
      {isUser && (
        <Avatar sx={{ bgcolor: 'secondary.main', ml: 1 }}>
          <PersonIcon />
        </Avatar>
      )}
    </Box>
  );
};

export default ChatMessage;
