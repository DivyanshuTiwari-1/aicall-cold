import React, { useState, useEffect } from "react";
import {
  BookOpenIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { knowledgeAPI } from "../services/knowledge";
import toast from "react-hot-toast";

const KnowledgeBase = () => {
  const [knowledgeEntries, setKnowledgeEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [newEntry, setNewEntry] = useState({
    question: "",
    answer: "",
    category: "",
    confidence: 0.9,
  });

  // Load knowledge entries
  useEffect(() => {
    loadKnowledgeEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadKnowledgeEntries = async () => {
    try {
      setLoading(true);
      const response = await knowledgeAPI.getKnowledgeEntries({
        search: searchTerm,
        category: selectedCategory,
      });
      setKnowledgeEntries(response.entries || []);
    } catch (error) {
      console.error("Error loading knowledge entries:", error);
      toast.error("Failed to load knowledge entries");
    } finally {
      setLoading(false);
    }
  };

  // Search and filter debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadKnowledgeEntries();
    }, 300);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, selectedCategory]);

  const handleAddEntry = async (e) => {
    e.preventDefault();
    try {
      await knowledgeAPI.createKnowledgeEntry(newEntry);
      toast.success("Knowledge entry added successfully");
      setNewEntry({ question: "", answer: "", category: "", confidence: 0.9 });
      setShowAddForm(false);
      loadKnowledgeEntries();
    } catch (error) {
      console.error("Error adding knowledge entry:", error);
      toast.error("Failed to add knowledge entry");
    }
  };

  const handleUpdateEntry = async (e) => {
    e.preventDefault();
    try {
      await knowledgeAPI.updateKnowledgeEntry(editingEntry.id, editingEntry);
      toast.success("Knowledge entry updated successfully");
      setEditingEntry(null);
      loadKnowledgeEntries();
    } catch (error) {
      console.error("Error updating knowledge entry:", error);
      toast.error("Failed to update knowledge entry");
    }
  };

  const handleDeleteEntry = async (id) => {
    if (window.confirm("Are you sure you want to delete this knowledge entry?")) {
      try {
        await knowledgeAPI.deleteKnowledgeEntry(id);
        toast.success("Knowledge entry deleted successfully");
        loadKnowledgeEntries();
      } catch (error) {
        console.error("Error deleting knowledge entry:", error);
        toast.error("Failed to delete knowledge entry");
      }
    }
  };

  const categories = [...new Set(knowledgeEntries.map((entry) => entry.category))].filter(Boolean);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Knowledge Base</h1>
          <p className="text-gray-600">
            Manage your AI's knowledge base for accurate and consistent responses.
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <PlusIcon className="h-4 w-4 mr-2" />
          Add FAQ
        </button>
      </div>

      {/* Add/Edit Form */}
      {(showAddForm || editingEntry) && (
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {editingEntry ? "Edit Knowledge Entry" : "Add New Knowledge Entry"}
          </h3>
          <form onSubmit={editingEntry ? handleUpdateEntry : handleAddEntry}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Question</label>
                <input
                  type="text"
                  value={editingEntry ? editingEntry.question : newEntry.question}
                  onChange={(e) =>
                    editingEntry
                      ? setEditingEntry({ ...editingEntry, question: e.target.value })
                      : setNewEntry({ ...newEntry, question: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="What is your pricing?"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <input
                  type="text"
                  value={editingEntry ? editingEntry.category : newEntry.category}
                  onChange={(e) =>
                    editingEntry
                      ? setEditingEntry({ ...editingEntry, category: e.target.value })
                      : setNewEntry({ ...newEntry, category: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Pricing"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Answer</label>
              <textarea
                value={editingEntry ? editingEntry.answer : newEntry.answer}
                onChange={(e) =>
                  editingEntry
                    ? setEditingEntry({ ...editingEntry, answer: e.target.value })
                    : setNewEntry({ ...newEntry, answer: e.target.value })
                }
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Our pricing starts at $99/month for the basic plan..."
                required
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confidence Level: {editingEntry ? editingEntry.confidence : newEntry.confidence}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={editingEntry ? editingEntry.confidence : newEntry.confidence}
                onChange={(e) =>
                  editingEntry
                    ? setEditingEntry({
                        ...editingEntry,
                        confidence: parseFloat(e.target.value),
                      })
                    : setNewEntry({ ...newEntry, confidence: parseFloat(e.target.value) })
                }
                className="w-full"
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setEditingEntry(null);
                }}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {editingEntry ? "Update" : "Add"} Entry
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search & Filter */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <MagnifyingGlassIcon className="h-5 w-5 mr-2" />
          Search Knowledge Base
        </h3>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by question or answer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="md:w-48">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Knowledge Entries List */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
            <p className="mt-2 text-gray-600">Loading knowledge entries...</p>
          </div>
        ) : knowledgeEntries.length === 0 ? (
          <div className="text-center py-8">
            <BookOpenIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No knowledge entries found</p>
          </div>
        ) : (
          knowledgeEntries.map((entry) => (
            <div
              key={entry.id}
              className="bg-white rounded-lg shadow-sm p-6 border border-gray-200"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h4 className="text-lg font-medium text-gray-900">{entry.question}</h4>
                    {entry.category && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {entry.category}
                      </span>
                    )}
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      {Math.round(entry.confidence * 100)}% confidence
                    </span>
                  </div>
                  <p className="text-gray-700 mb-3">{entry.answer}</p>
                  <div className="flex items-center text-sm text-gray-500">
                    <span>Created: {new Date(entry.createdAt).toLocaleDateString()}</span>
                    {entry.updatedAt !== entry.createdAt && (
                      <span className="ml-4">
                        Updated: {new Date(entry.updatedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2 ml-4">
                  <button
                    onClick={() => setEditingEntry(entry)}
                    className="p-2 text-gray-400 hover:text-blue-600"
                    title="Edit"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteEntry(entry.id)}
                    className="p-2 text-gray-400 hover:text-red-600"
                    title="Delete"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default KnowledgeBase;
