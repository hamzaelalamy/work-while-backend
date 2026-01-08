// src/services/authService.js
import apiClient, { API_ENDPOINTS, handleApiError } from '../config/apiConfig';

const authService = {
  /**
   * Register a new user
   */
  register: async (userData) => {
    try {
      console.log('Registering user with data:', userData);
      
      const payload = {
        firstName: userData.firstName,
        lastName: userData.lastName,
        email: userData.email,
        password: userData.password,
        role: userData.role || 'candidate'
      };
      
      const response = await apiClient.post(API_ENDPOINTS.AUTH.REGISTER, payload);
      
      // Extract data from the nested response structure
      const { data } = response.data;
      
      return {
        user: data.user,
        token: data.token,
        userId: data.user._id,
        role: data.user.role
      };
    } catch (error) {
      console.error('Registration error:', error);
      const errorInfo = handleApiError(error);
      throw new Error(errorInfo.message);
    }
  },

  /**
   * Login user
   */
  login: async (credentials) => {
    try {
      console.log('Logging in user with credentials:', { email: credentials.email });
      
      const response = await apiClient.post(API_ENDPOINTS.AUTH.LOGIN, credentials);
      
      // Extract data from the nested response structure
      const { data } = response.data;
      
      return {
        user: data.user,
        token: data.token,
        userId: data.user._id,
        role: data.user.role
      };
    } catch (error) {
      console.error('Login error:', error);
      const errorInfo = handleApiError(error);
      throw new Error(errorInfo.message);
    }
  },

  /**
   * Logout user
   */
  logout: async () => {
    try {
      await apiClient.post(API_ENDPOINTS.AUTH.LOGOUT);
      return true;
    } catch (error) {
      console.error('Logout error:', error);
      // Even if API call fails, we should clear local data
      return true;
    }
  },

  /**
   * Get current user profile
   */
  getCurrentUser: async () => {
    try {
      const response = await apiClient.get(API_ENDPOINTS.AUTH.ME);
      const { data } = response.data;
      
      return {
        user: data.user,
        userId: data.user._id,
        role: data.user.role
      };
    } catch (error) {
      console.error('Get current user error:', error);
      const errorInfo = handleApiError(error);
      throw new Error(errorInfo.message);
    }
  },

  /**
   * Forgot password
   */
  forgotPassword: async (email) => {
    try {
      const response = await apiClient.post(API_ENDPOINTS.AUTH.FORGOT_PASSWORD, { email });
      return response.data;
    } catch (error) {
      console.error('Forgot password error:', error);
      const errorInfo = handleApiError(error);
      throw new Error(errorInfo.message);
    }
  },

  /**
   * Reset password
   */
  resetPassword: async (token, password) => {
    try {
      const response = await apiClient.post(API_ENDPOINTS.AUTH.RESET_PASSWORD, {
        token,
        password
      });
      
      const { data } = response.data;
      
      return {
        user: data.user,
        token: data.token,
        userId: data.user._id,
        role: data.user.role
      };
    } catch (error) {
      console.error('Reset password error:', error);
      const errorInfo = handleApiError(error);
      throw new Error(errorInfo.message);
    }
  }
};

export default authService;