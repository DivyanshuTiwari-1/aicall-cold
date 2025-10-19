import React, { createContext, useContext, useEffect, useState } from 'react';
// Assuming the import path is correct and 'api' handles Axios/fetch
import api from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    // Correct usage of Error object
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      // Set token in API client
      api.defaults.headers.common.Authorization = `Bearer ${token}`;

      // Verify token with backend
      // Using a try/catch block ensures we handle 401s here gracefully
      const response = await api.get('/auth/profile');

      if (response.data.success) {
        setUser(response.data.user);
      } else {
        localStorage.removeItem('token');
        delete api.defaults.headers.common.Authorization;
        setUser(null);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('token');
      delete api.defaults.headers.common.Authorization;
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });

      if (response.data.success) {
        const { token, user: userData } = response.data;
        localStorage.setItem('token', token);
        api.defaults.headers.common.Authorization = `Bearer ${token}`;
        setUser(userData);
        return { success: true, user: userData };
      }

      return { success: false, message: response.data.message };
    } catch (error) {
      console.error('Login error:', error);

      // Handle specific error cases
      if (error.response?.status === 401) {
        return {
          success: false,
          message: 'Invalid email or password. Please try again.',
        };
      } else if (error.response?.status === 400) {
        return {
          success: false,
          message: error.response.data.message || 'Please check your input and try again.',
        };
      } else if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
        return {
          success: false,
          message: 'Unable to connect to server. Please check your connection.',
        };
      }

      return {
        success: false,
        message: error?.response?.data?.message || 'Login failed. Please try again.',
      };
    }
  };

  const register = async userData => {
    try {
      const response = await api.post('/auth/register', userData);

      if (response.data.success) {
        const { token, user: newUser } = response.data;
        localStorage.setItem('token', token);
        api.defaults.headers.common.Authorization = `Bearer ${token}`;
        setUser(newUser);
        return { success: true, user: newUser };
      }

      return {
        success: false,
        message: response.data.message,
        errors: response.data.errors,
      };
    } catch (error) {
      console.error('Registration error:', error);

      // Handle specific error cases
      if (error.response?.status === 409) {
        return {
          success: false,
          message: 'An account with this email already exists. Please try logging in instead.',
        };
      } else if (error.response?.status === 400) {
        return {
          success: false,
          message: error.response.data.message || 'Please check your input and try again.',
          errors: error.response.data.errors || null,
        };
      } else if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
        return {
          success: false,
          message: 'Unable to connect to server. Please check your connection.',
        };
      }

      return {
        success: false,
        message: error?.response?.data?.message || 'Registration failed. Please try again.',
        errors: error?.response?.data?.errors || null,
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    delete api.defaults.headers.common.Authorization;
    setUser(null);
    // Note: Navigation is handled in the component that calls logout
  };

  const updateUser = userData => {
    setUser(prevUser => ({ ...prevUser, ...userData }));
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    updateUser,
    isAuthenticated: !!user,
  };

  // FIX: Removed the unnecessary semicolon after the function body and cleaned up the return format.
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
