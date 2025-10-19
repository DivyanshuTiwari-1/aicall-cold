import { useCallback, useState } from 'react';

export const useRetry = (maxRetries = 3, delay = 1000) => {
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  const retry = useCallback(async (asyncFn, context = '') => {
    if (retryCount >= maxRetries) {
      throw new Error(`Max retries (${maxRetries}) exceeded for ${context}`);
    }

    setIsRetrying(true);
    setRetryCount(prev => prev + 1);

    try {
      const result = await asyncFn();
      setRetryCount(0); // Reset on success
      return result;
    } catch (error) {
      if (retryCount < maxRetries - 1) {
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, retryCount)));
        return retry(asyncFn, context);
      } else {
        throw error;
      }
    } finally {
      setIsRetrying(false);
    }
  }, [retryCount, maxRetries, delay]);

  const resetRetry = useCallback(() => {
    setRetryCount(0);
    setIsRetrying(false);
  }, []);

  return {
    retry,
    retryCount,
    isRetrying,
    resetRetry,
    canRetry: retryCount < maxRetries,
  };
};

export default useRetry;
