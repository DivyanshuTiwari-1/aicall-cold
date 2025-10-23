import { CheckCircleIcon, ClockIcon, PhoneIcon } from '@heroicons/react/24/solid';
import { useQuery } from '@tanstack/react-query';
import React, { useState } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';
import SimpleBrowserPhone from '../components/SimpleBrowserPhone';
import { contactsAPI } from '../services/contacts';
import { simpleCallsAPI } from '../services/simpleCalls';

/**
 * Simple Calls Page - Click-to-call from browser
 * No softphone needed!
 */
const SimpleCalls = () => {
    const [selectedContact, setSelectedContact] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Fetch contacts
    const { data: contactsData, isLoading } = useQuery({
        queryKey: ['contacts', searchTerm],
        queryFn: () => contactsAPI.getContacts({ search: searchTerm, limit: 20 })
    });

    // Fetch call history
    const { data: historyData } = useQuery({
        queryKey: ['call-history'],
        queryFn: () => simpleCallsAPI.getCallHistory({ limit: 10 })
    });

    const contacts = contactsData?.contacts || [];
    const callHistory = historyData?.calls || [];

    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
        return date.toLocaleDateString();
    };

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        📞 Browser Calling
                    </h1>
                    <p className="text-gray-600">
                        Click to call any contact directly from your browser. No softphone needed!
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Contacts List */}
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-lg shadow">
                            <div className="px-6 py-4 border-b border-gray-200">
                                <h2 className="text-lg font-semibold text-gray-900">Contacts</h2>
                                <input
                                    type="text"
                                    placeholder="Search contacts..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="mt-2 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>

                            <div className="divide-y divide-gray-200">
                                {isLoading ? (
                                    <div className="p-12 text-center">
                                        <LoadingSpinner />
                                    </div>
                                ) : contacts.length === 0 ? (
                                    <div className="p-12 text-center text-gray-500">
                                        No contacts found
                                    </div>
                                ) : (
                                    contacts.map((contact) => (
                                        <div
                                            key={contact.id}
                                            className="px-6 py-4 hover:bg-gray-50 transition-colors"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center">
                                                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                                                            <span className="text-blue-600 font-semibold">
                                                                {contact.firstName?.[0]}{contact.lastName?.[0]}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <h3 className="text-sm font-medium text-gray-900">
                                                                {contact.firstName} {contact.lastName}
                                                            </h3>
                                                            <p className="text-sm text-gray-500">
                                                                {contact.phone}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    {contact.company && (
                                                        <p className="text-xs text-gray-400 ml-13 mt-1">
                                                            {contact.company}
                                                            {contact.title && ` • ${contact.title}`}
                                                        </p>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={() => setSelectedContact(contact)}
                                                    className="ml-4 flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                                                >
                                                    <PhoneIcon className="h-4 w-4 mr-2" />
                                                    Call
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Recent Calls */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-lg shadow">
                            <div className="px-6 py-4 border-b border-gray-200">
                                <h2 className="text-lg font-semibold text-gray-900">Recent Calls</h2>
                            </div>
                            <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
                                {callHistory.length === 0 ? (
                                    <div className="p-6 text-center text-gray-500 text-sm">
                                        No call history yet
                                    </div>
                                ) : (
                                    callHistory.map((call) => (
                                        <div key={call.id} className="px-6 py-3 hover:bg-gray-50">
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-gray-900 truncate">
                                                        {call.contact.firstName} {call.contact.lastName}
                                                    </p>
                                                    <p className="text-xs text-gray-500">
                                                        {call.contact.phone}
                                                    </p>
                                                    <div className="flex items-center mt-1">
                                                        {call.answered ? (
                                                            <CheckCircleIcon className="h-3 w-3 text-green-500 mr-1" />
                                                        ) : (
                                                            <ClockIcon className="h-3 w-3 text-gray-400 mr-1" />
                                                        )}
                                                        <span className="text-xs text-gray-500">
                                                            {formatDuration(call.duration)} • {formatDate(call.createdAt)}
                                                        </span>
                                                    </div>
                                                </div>
                                                <span className={`text-xs px-2 py-1 rounded ${
                                                    call.outcome === 'interested' || call.outcome === 'scheduled'
                                                        ? 'bg-green-100 text-green-800'
                                                        : call.outcome === 'not_interested'
                                                        ? 'bg-red-100 text-red-800'
                                                        : 'bg-gray-100 text-gray-800'
                                                }`}>
                                                    {call.outcome}
                                                </span>
                                            </div>
                                            {call.notes && (
                                                <p className="text-xs text-gray-500 mt-1 truncate">
                                                    {call.notes}
                                                </p>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Info Card */}
                        <div className="mt-6 bg-blue-50 rounded-lg p-4 border border-blue-200">
                            <h3 className="text-sm font-semibold text-blue-900 mb-2">
                                🎧 Browser Calling
                            </h3>
                            <ul className="text-xs text-blue-800 space-y-1">
                                <li>✓ No softphone needed</li>
                                <li>✓ Click to call instantly</li>
                                <li>✓ Auto-saved to history</li>
                                <li>✓ Works in any browser</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>

            {/* Browser Phone Modal */}
            {selectedContact && (
                <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
                    <SimpleBrowserPhone
                        contact={selectedContact}
                        onClose={() => setSelectedContact(null)}
                    />
                </div>
            )}
        </div>
    );
};

export default SimpleCalls;
