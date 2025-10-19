import { useCallback, useState } from 'react';

export const useLoadingStates = (initialStates = {}) => {
  const [loadingStates, setLoadingStates] = useState(initialStates);

  const setLoading = useCallback((key, isLoading) => {
    setLoadingStates(prev => ({
      ...prev,
      [key]: isLoading
    }));
  }, []);

  const setMultipleLoading = useCallback((states) => {
    setLoadingStates(prev => ({
      ...prev,
      ...states
    }));
  }, []);

  const isLoading = useCallback((key) => {
    return loadingStates[key] || false;
  }, [loadingStates]);

  const isAnyLoading = useCallback(() => {
    return Object.values(loadingStates).some(loading => loading === true);
  }, [loadingStates]);

  const resetLoading = useCallback((key) => {
    if (key) {
      setLoadingStates(prev => ({
        ...prev,
        [key]: false
      }));
    } else {
      setLoadingStates({});
    }
  }, []);

  return {
    loadingStates,
    setLoading,
    setMultipleLoading,
    isLoading,
    isAnyLoading,
    resetLoading,
  };
};

export default useLoadingStates;
