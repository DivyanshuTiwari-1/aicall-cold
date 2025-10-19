import React, { useState, useEffect } from "react";
import {
  MagnifyingGlassIcon,
  BookOpenIcon,
  PencilIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { knowledgeAPI } from "../services/knowledge";

const KnowledgeBase = () => {
  const [knowledgeEntries, setKnowledgeEntries] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [editingEntry, setEditingEntry] = useState(null);
  const [newEntry, setNewEntry] = useState({
    question: "",
    answer: "",
    category: "",
    confidence: 0.8,
  });

  // Load knowledge entries and categories on mount
  useEffect(() => {
    loadKnowledgeEntries();
    loadCategories();
  }, []);

  const loadKnowledgeEntries = async () => {
    setLoading(true);
    try {
      const data = await knowledgeAPI.getKnowledgeEntries();
      setKnowledgeEntries(data);
    } catch (error) {
      console.error("Error loading knowledge entries:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const data = await knowledgeAPI.getCategories();
      setCategories(data.map((cat) => cat.name));
    } catch (error) {
      console.error("Error loading categories:", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingEntry) {
        await knowledgeAPI.updateEntry(editingEntry.id, editingEntry);
      } else {
        await knowledgeAPI.createEntry(newEntry);
      }
      setNewEntry({
        question: "",
        answer: "",
        category: "",
        confidence: 0.8,
      });
      setEditingEntry(null);
      loadKnowledgeEntries();
    } catch (error) {
      console.error("Error saving entry:", error);
    }
  };

  const handleDeleteEntry = async (id) => {
    if (window.confirm("Are you sure you want to delete this entry?")) {
      try {
        await knowledgeAPI.deleteEntry(id);
        loadKnowledgeEntries();
      } catch (error) {
        console.error("Error deleting entry:", error);
      }
    }
  };

  const filteredEntries = knowledgeEntries.filter((entry) => {
    const matchesSearch =
      entry.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.answer.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      selectedCategory === "" || entry.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Add/Edit Entry Form */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {editingEntry ? "Edit Knowledge Entry" : "Add New Knowledge Entry"}
        </h3>

        <form onSubmit={handleSubmit}>
          {/* Question Input */}
          <div className="mb-4">
            <label
              htmlFor="question"
              className="block text-sm font-medium text-gray-700"
            >
              Question
            </label>
            <input
              type="text"
              id="question"
              value={editingEntry ? editingEntry.question : newEntry.question}
              onChange={(e) =>
                editingEntry
                  ? setEditingEntry({
                      ...editingEntry,
                      question: e.target.value,
                    })
                  : setNewEntry({ ...newEntry, question: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              placeholder="Enter the question"
              required
            />
          </div>

          {/* Answer Input */}
          <div className="mb-4">
            <label
              htmlFor="answer"
              className="block text-sm font-medium text-gray-700"
            >
              Answer
            </label>
            <textarea
              id="answer"
              value={editingEntry ? editingEntry.answer : newEntry.answer}
              onChange={(e) =>
                editingEntry
                  ? setEditingEntry({
                      ...editingEntry,
                      answer: e.target.value,
                    })
                  : setNewEntry({ ...newEntry, answer: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              placeholder="Enter the answer"
              rows="4"
              required
            />
          </div>

          {/* Category Input */}
          <div className="mb-4">
            <label
              htmlFor="category"
              className="block text-sm font-medium text-gray-700"
            >
              Category
            </label>
            <select
              id="category"
              value={editingEntry ? editingEntry.category : newEntry.category}
              onChange={(e) =>
                editingEntry
                  ? setEditingEntry({
                      ...editingEntry,
                      category: e.target.value,
                    })
                  : setNewEntry({ ...newEntry, category: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a category</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Confidence Input */}
          <div className="mb-4">
            <label
              htmlFor="confidence"
              className="block text-sm font-medium text-gray-700"
            >
              Confidence Score:{" "}
              <span className="font-semibold">
                {Math.round(
                  (editingEntry
                    ? editingEntry.confidence
                    : newEntry.confidence) * 100
                )}
                %
              </span>
            </label>
            <input
              type="range"
              id="confidence"
              min="0"
              max="1"
              step="0.1"
              value={
                editingEntry ? editingEntry.confidence : newEntry.confidence
              }
              onChange={(e) =>
                editingEntry
                  ? setEditingEntry({
                      ...editingEntry,
                      confidence: parseFloat(e.target.value),
                    })
                  : setNewEntry({
                      ...newEntry,
                      confidence: parseFloat(e.target.value),
                    })
              }
              className="w-full"
            />
          </div>

          {/* Form Buttons */}
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => {
                setEditingEntry(null);
                setNewEntry({
                  question: "",
                  answer: "",
                  category: "",
                  confidence: 0.8,
                });
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="md:w-48">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
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
        ) : filteredEntries.length === 0 ? (
          <div className="text-center py-8">
            <BookOpenIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No knowledge entries found</p>
          </div>
        ) : (
          filteredEntries.map((entry) => (
            <div
              key={entry.id}
              className="bg-white rounded-lg shadow-sm p-6 border border-gray-200"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h4 className="text-lg font-medium text-gray-900">
                      {entry.question}
                    </h4>
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
                    <span>
                      Created: {new Date(entry.createdAt).toLocaleDateString()}
                    </span>
                    {entry.updatedAt !== entry.createdAt && (
                      <span className="ml-4">
                        Updated:{" "}
                        {new Date(entry.updatedAt).toLocaleDateString()}
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
