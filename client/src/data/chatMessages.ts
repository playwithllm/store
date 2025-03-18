import axios from 'axios';

// API base URL from environment variables with fallback
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  image?: string;
}

// Sample bot responses for the chat feature
export const botResponses = [
  "Hello! How can I help you today?",
  "Thank you for your question. Let me look into that for you.",
  "I'd be happy to assist with your inquiry about our products.",
  "That's a great question! Our products come with a 30-day money-back guarantee.",
  "I understand your concern. Let me connect you with a specialist who can help further.",
  "Would you like to see our current promotions and discounts?",
  "I appreciate your patience. Let me find the right information for you.",
  "Is there anything else you'd like to know about our products?",
  "Our customer satisfaction is our top priority. We'll make sure your issue is resolved.",
  "Thank you for contacting our support team. We're here to help!"
];

// Get a random bot response
export const getRandomBotResponse = (): string => {
  const randomIndex = Math.floor(Math.random() * botResponses.length);
  return botResponses[randomIndex];
};

// Initial messages for the chat
export const initialMessages: ChatMessage[] = [
  {
    id: '1',
    text: "Hello! Welcome to our e-commerce store. How can I assist you today?",
    sender: 'bot',
    timestamp: new Date(Date.now() - 60000)
  }
];

// Function to fetch chat history from the server
export const fetchChatHistory = async (): Promise<ChatMessage[]> => {
  try {
    const response = await axios.get(`${API_URL}/chat/history`);
    
    if (response.data.success) {
      return response.data.messages || initialMessages;
    }
    return initialMessages;
  } catch (error) {
    console.error('Error fetching chat history:', error);
    return initialMessages;
  }
};

// Function to send a message to the server
export const sendMessage = async (message: string): Promise<ChatMessage | null> => {
  try {
    const response = await axios.post(`${API_URL}/chat/message`, { message });
    
    if (response.data.success) {
      return response.data.message;
    }
    return null;
  } catch (error) {
    console.error('Error sending message:', error);
    return null;
  }
};
