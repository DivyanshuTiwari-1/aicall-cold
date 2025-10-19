import React from 'react';
import LoadingSpinner from './LoadingSpinner';

export const PageLoading = ({ message = 'Loading...' }) => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center">
      <LoadingSpinner size="lg" />
      <p className="mt-4 text-sm text-gray-600">{message}</p>
    </div>
  </div>
);

export const SectionLoading = ({ message = 'Loading...' }) => (
  <div className="flex items-center justify-center py-12">
    <div className="text-center">
      <LoadingSpinner />
      <p className="mt-2 text-sm text-gray-600">{message}</p>
    </div>
  </div>
);

export const InlineLoading = ({ message = 'Loading...' }) => (
  <div className="flex items-center justify-center py-4">
    <LoadingSpinner size="sm" />
    <span className="ml-2 text-sm text-gray-600">{message}</span>
  </div>
);

export const ButtonLoading = ({ isLoading, children, ...props }) => (
  <button
    {...props}
    disabled={isLoading || props.disabled}
    className={`${props.className} ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
  >
    {isLoading ? (
      <div className="flex items-center">
        <LoadingSpinner size="sm" />
        <span className="ml-2">Loading...</span>
      </div>
    ) : (
      children
    )}
  </button>
);

export const TableLoading = ({ columns = 4 }) => (
  <div className="animate-pulse">
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex space-x-4">
          {Array.from({ length: columns }).map((_, j) => (
            <div key={j} className="flex-1">
              <div className="h-4 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      ))}
    </div>
  </div>
);

export const CardLoading = () => (
  <div className="animate-pulse">
    <div className="bg-white rounded-lg shadow p-6">
      <div className="space-y-4">
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        <div className="h-4 bg-gray-200 rounded w-5/6"></div>
      </div>
    </div>
  </div>
);

export const ListLoading = ({ items = 3 }) => (
  <div className="animate-pulse space-y-3">
    {Array.from({ length: items }).map((_, i) => (
      <div key={i} className="flex items-center space-x-3">
        <div className="h-10 w-10 bg-gray-200 rounded-full"></div>
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    ))}
  </div>
);

export default {
  PageLoading,
  SectionLoading,
  InlineLoading,
  ButtonLoading,
  TableLoading,
  CardLoading,
  ListLoading,
};
