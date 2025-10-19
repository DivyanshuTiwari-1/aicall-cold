import {
    ArrowPathIcon,
    CheckIcon,
    ClipboardDocumentIcon,
    LightBulbIcon,
    XMarkIcon
} from '@heroicons/react/24/outline';
import { useMutation, useQuery } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import { knowledgeAPI } from '../services/knowledge';
import ErrorDisplay from './ErrorDisplay';
import LoadingSpinner from './LoadingSpinner';

const KnowledgeSuggestions = ({ callId, transcript, onSuggestionSelect }) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);

  // Auto-generate query from transcript
  useEffect(() => {
    if (transcript && transcript.length > 50) {
      // Extract last few sentences as potential query
      const sentences = transcript.split(/[.!?]+/).filter(s => s.trim().length > 10);
      const lastSentences = sentences.slice(-2).join('. ').trim();
      if (lastSentences.length > 20) {
        setQuery(lastSentences);
      }
    }
  }, [transcript]);

  // Query knowledge base
  const {
    data: knowledgeData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['knowledge-query', query, callId],
    queryFn: () => knowledgeAPI.queryKnowledge({
      question: query,
      callId: callId
    }),
    enabled: query.length > 5,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Feedback mutation
  const feedbackMutation = useMutation({
    mutationFn: ({ suggestionId, wasHelpful }) =>
      knowledgeAPI.feedbackSuggestion(suggestionId, wasHelpful),
    onSuccess: () => {
      // Optionally refetch or update local state
    },
  });

  // Update suggestions when data changes
  useEffect(() => {
    if (knowledgeData?.data) {
      const { answer, suggestions: apiSuggestions, confidence } = knowledgeData.data;

      const newSuggestions = [
        {
          id: 'main',
          type: 'answer',
          content: answer,
          confidence: confidence,
          category: knowledgeData.data.category,
          isMain: true
        },
        ...(apiSuggestions || []).map((suggestion, index) => ({
          id: `suggestion-${index}`,
          type: 'suggestion',
          content: suggestion.answer,
          question: suggestion.question,
          category: suggestion.category,
          confidence: 0.8, // Default confidence for suggestions
          isMain: false
        }))
      ];

      setSuggestions(newSuggestions);
    }
  }, [knowledgeData]);

  const handleQueryChange = (e) => {
    setQuery(e.target.value);
  };

  const handleCopyToClipboard = async (content, index) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const handleSuggestionSelect = (suggestion) => {
    if (onSuggestionSelect) {
      onSuggestionSelect(suggestion);
    }
  };

  const handleFeedback = (suggestionId, wasHelpful) => {
    feedbackMutation.mutate({ suggestionId, wasHelpful });
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.8) return 'text-green-600 bg-green-100';
    if (confidence >= 0.6) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getConfidenceText = (confidence) => {
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.6) return 'Medium';
    return 'Low';
  };

  if (error) {
    return <ErrorDisplay error={error} />;
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <LightBulbIcon className="h-5 w-5 text-blue-600" />
            <h3 className="text-sm font-medium text-gray-900">Knowledge Suggestions</h3>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => refetch()}
              disabled={isLoading}
              className="p-1 text-gray-400 hover:text-gray-600"
            >
              <ArrowPathIcon className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 text-gray-400 hover:text-gray-600"
            >
              {isExpanded ? (
                <XMarkIcon className="h-4 w-4" />
              ) : (
                <LightBulbIcon className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Query Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Knowledge Base
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={query}
                onChange={handleQueryChange}
                placeholder="Ask a question or describe the situation..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                onClick={() => refetch()}
                disabled={isLoading || query.length < 5}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
              >
                {isLoading ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  'Search'
                )}
              </button>
            </div>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner size="sm" />
              <span className="ml-2 text-sm text-gray-600">Searching knowledge base...</span>
            </div>
          )}

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="space-y-3">
              {suggestions.map((suggestion, index) => (
                <div
                  key={suggestion.id}
                  className={`p-3 border rounded-lg ${
                    suggestion.isMain
                      ? 'border-blue-200 bg-blue-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getConfidenceColor(suggestion.confidence)}`}>
                          {getConfidenceText(suggestion.confidence)} Confidence
                        </span>
                        {suggestion.category && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {suggestion.category}
                          </span>
                        )}
                      </div>

                      {suggestion.question && (
                        <p className="text-sm font-medium text-gray-900 mb-1">
                          Q: {suggestion.question}
                        </p>
                      )}

                      <p className="text-sm text-gray-700">
                        {suggestion.content}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleSuggestionSelect(suggestion)}
                        className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-800"
                      >
                        Use This
                      </button>

                      <button
                        onClick={() => handleCopyToClipboard(suggestion.content, index)}
                        className="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-800"
                      >
                        {copiedIndex === index ? (
                          <>
                            <CheckIcon className="h-3 w-3 mr-1" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <ClipboardDocumentIcon className="h-3 w-3 mr-1" />
                            Copy
                          </>
                        )}
                      </button>
                    </div>

                    <div className="flex space-x-1">
                      <button
                        onClick={() => handleFeedback(suggestion.id, true)}
                        className="p-1 text-green-600 hover:text-green-800"
                        title="Helpful"
                      >
                        <CheckIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleFeedback(suggestion.id, false)}
                        className="p-1 text-red-600 hover:text-red-800"
                        title="Not helpful"
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* No Results */}
          {!isLoading && query.length > 5 && suggestions.length === 0 && (
            <div className="text-center py-8">
              <LightBulbIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 text-sm">No knowledge base suggestions found</p>
              <p className="text-gray-400 text-xs mt-1">Try rephrasing your question</p>
            </div>
          )}

          {/* Empty State */}
          {query.length <= 5 && (
            <div className="text-center py-8">
              <LightBulbIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 text-sm">Enter a question to search the knowledge base</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default KnowledgeSuggestions;
