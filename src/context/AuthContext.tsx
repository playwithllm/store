
import { createContext, useState, useContext, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

// Define the User type
type User = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
} | null;

// Define the context type
type AuthContextType = {
  user: User;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  updateProfile: (userData: Partial<Omit<User, 'id' | 'email'>>) => void;
  isAuthenticated: boolean;
  requestPasswordReset: (email: string) => Promise<void>;
};

// Create the context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider component
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User>(null);
  const { toast } = useToast();

  // Mock login function
  const login = async (email: string, password: string) => {
    // In a real app, this would be an API call
    return new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        // For this prototype, we'll mock a successful login with a fake user
        if (email && password) {
          setUser({
            id: '1',
            name: 'John Doe',
            email: email,
            phone: '123-456-7890',
            address: '123 Main St, Anytown USA'
          });
          localStorage.setItem('isLoggedIn', 'true');
          resolve();
        } else {
          reject(new Error('Invalid credentials'));
        }
      }, 1000);
    });
  };

  // Mock signup function
  const signup = async (name: string, email: string, password: string) => {
    // In a real app, this would be an API call
    return new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        // For this prototype, we'll mock a successful signup
        if (name && email && password) {
          setUser({
            id: '1',
            name: name,
            email: email,
            phone: '',
            address: ''
          });
          localStorage.setItem('isLoggedIn', 'true');
          resolve();
        } else {
          reject(new Error('Invalid information'));
        }
      }, 1000);
    });
  };

  // Logout function
  const logout = () => {
    setUser(null);
    localStorage.removeItem('isLoggedIn');
    toast({
      title: "Logged out",
      description: "You have been successfully logged out.",
    });
  };

  // Update profile function
  const updateProfile = (userData: Partial<Omit<User, 'id' | 'email'>>) => {
    if (user) {
      setUser({
        ...user,
        ...userData
      });
      toast({
        title: "Profile updated",
        description: "Your profile has been successfully updated.",
      });
    }
  };

  // Request password reset function
  const requestPasswordReset = async (email: string) => {
    // In a real app, this would be an API call
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        toast({
          title: "Password reset email sent",
          description: "If the email exists in our system, you will receive a password reset link shortly.",
        });
        resolve();
      }, 1000);
    });
  };

  return (
    <AuthContext.Provider value={{
      user,
      login,
      signup,
      logout,
      updateProfile,
      isAuthenticated: !!user,
      requestPasswordReset,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
