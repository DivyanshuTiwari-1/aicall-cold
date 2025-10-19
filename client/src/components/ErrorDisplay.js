   import {
    ArrowPathIcon,
    ExclamationTriangleIcon,
    InformationCircleIcon,
    XCircleIcon
} from '@heroicons/react/24/outline';
import React from 'react';

export const ErrorAlert = ({
  error,
  onRetry,
  onDismiss,
  title = 'Error',
  showDetails = false
}) => {
  const getErrorIcon = () => {
    if (error?.status >= 500) return XCircleIcon;
    if (error?.status >= 400) return ExclamationTriangleIcon;
    return InformationCircleIcon;
  };

  const getErrorColor = () => {
    if (error?.status >= 500) return 'red';
    if (error?.status >= 400) return 'yellow';
    return 'blue';
  };

  const Icon = getErrorIcon();
  const color = getErrorColor();

  const colorClasses = {
    red: 'bg-red-50 border-red-200 text-red-800',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
  };

  const iconClasses = {
    red: 'text-red-400',
    yellow: 'text-yellow-400',
    blue: 'text-blue-400',
  };

  return (
    <div className={`rounded-md border p-4 ${colorClasses[color]}`}>
      <div className="flex">
        <div className="flex-shrink-0">
          <Icon className={`h-5 w-5 ${iconClasses[color]}`} />
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium">{title}</h3>
          <div className="mt-2 text-sm">
            <p>{error?.message || 'An unexpected error occurred'}</p>
            {showDetails && error?.details && (
              <details className="mt-2">
                <summary className="cursor-pointer">Show details</summary>
                <pre className="mt-2 text-xs bg-white p-2 rounded border overflow-auto">
                  {JSON.stringify(error.details, null, 2)}
                </pre>
              </details>
            )}
          </div>
          <div className="mt-4 flex space-x-3">
            {onRetry && (
              <button
                onClick={onRetry}
                className="inline-flex items-center text-sm font-medium hover:underline"
              >
                <ArrowPathIcon className="h-4 w-4 mr-1" />
                Try again
              </button>
            )}
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="text-sm font-medium hover:underline"
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const ErrorPage = ({
  error,
  onRetry,
  title = 'Something went wrong',
  description = 'We encountered an error while loading this page.'
}) => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6 text-center">
      <XCircleIcon className="mx-auto h-12 w-12 text-red-500" />
      <h1 className="mt-4 text-lg font-medium text-gray-900">{title}</h1>
      <p className="mt-2 text-sm text-gray-500">{description}</p>
      {error?.message && (
        <p className="mt-2 text-sm text-red-600">{error.message}</p>
      )}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-6 w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Try again
        </button>
      )}
    </div>
  </div>
);

export const ErrorBoundary = ({ children, fallback }) => {
  const [hasError, setHasError] = React.useState(false);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    const handleError = (event) => {
      setHasError(true);
      setError(event.error);
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return fallback || <ErrorPage error={error} />;
  }

  return children;
};

export const NetworkError = ({ onRetry }) => (
  <div className="text-center py-12">
    <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-yellow-500" />
    <h3 className="mt-2 text-sm font-medium text-gray-900">Network Error</h3>
    <p className="mt-1 text-sm text-gray-500">
      Please check your internet connection and try again.
    </p>
    {onRetry && (
      <button
        onClick={onRetry}
        className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
      >
        <ArrowPathIcon className="h-4 w-4 mr-2" />
        Retry
      </button>
    )}
  </div>
);

export const EmptyState = ({
  icon: Icon = ExclamationTriangleIcon,
  title,
  description,
  action
}) => (
  <div className="text-center py-12">
    <Icon className="mx-auto h-12 w-12 text-gray-400" />
    <h3 className="mt-2 text-sm font-medium text-gray-900">{title}</h3>
    <p className="mt-1 text-sm text-gray-500">{description}</p>
    {action && <div className="mt-6">{action}</div>}
  </div>
);

export default {
  ErrorAlert,
  ErrorPage,
  ErrorBoundary,
  NetworkError,
  EmptyState,
};
