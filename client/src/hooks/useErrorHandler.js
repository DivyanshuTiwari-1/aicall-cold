import { useCallback } from 'react';
import toast from 'react-hot-toast';

export const useErrorHandler = () => {
  const handleError = useCallback((error, context = '') => {
    console.error(`Error in ${context}:`, error);

    let message = 'An unexpected error occurred';

    if (error?.response?.data?.message) {
      message = error.response.data.message;
    } else if (error?.message) {
      message = error.message;
    } else if (typeof error === 'string') {
      message = error;
    }

    // Show error toast
    toast.error(message);

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Full error object:', error);
    }
  }, []);

  const handleAsyncError = useCallback(async (asyncFn, context = '') => {
    try {
      return await asyncFn();
    } catch (error) {
      handleError(error, context);
      throw error; // Re-throw so calling code can handle if needed
    }
  }, [handleError]);

  return {
    handleError,
    handleAsyncError,
  };
};

export default useErrorHandler;
