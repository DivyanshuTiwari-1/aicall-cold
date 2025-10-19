import { DocumentArrowUpIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useQuery } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import { campaignsAPI } from '../services/campaigns';
import { usersAPI } from '../services/users';
import LoadingSpinner from './LoadingSpinner';

const AssignLeadsModal = ({ isOpen, onClose, selectedContacts, onAssign, isLoading }) => {
    const [formData, setFormData] = useState({
        agentId: '',
        expiresAt: '',
        campaignId: ''
    });

    // Fetch users and campaigns
    const { data: usersData } = useQuery({
        queryKey: ['users'],
        queryFn: () => usersAPI.getUsers()
    });
    const { data: campaignsData } = useQuery({
        queryKey: ['campaigns'],
        queryFn: () => campaignsAPI.getCampaigns()
    });

    const users = usersData?.users || [];
    const campaigns = campaignsData?.campaigns || [];
    const agents = users.filter(u => u.roleType === 'agent' && u.isActive);

    useEffect(() => {
        if (isOpen) {
            // Set default expiration to 24 hours from now
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            setFormData(prev => ({
                ...prev,
                expiresAt: tomorrow.toISOString().slice(0, 16)
            }));
        }
    }, [isOpen]);

    const handleSubmit = (e) => {
        e.preventDefault();

        if (!formData.agentId) {
            alert('Please select an agent');
            return;
        }

        if (selectedContacts.length === 0) {
            alert('Please select contacts to assign');
            return;
        }

        const assignmentData = {
            contactIds: selectedContacts.map(c => c.id),
            assignedTo: formData.agentId,
            expiresAt: formData.expiresAt ? new Date(formData.expiresAt).toISOString() : null
        };

        onAssign(assignmentData.contactIds, assignmentData.assignedTo);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                {/* Background overlay */}
                <div
                    className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
                    onClick={onClose}
                />

                {/* Modal panel */}
                <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900">
                            Assign Leads to Agent
                        </h3>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-500 transition-colors"
                        >
                            <XMarkIcon className="h-6 w-6" />
                        </button>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit}>
                        <div className="px-6 py-4 space-y-4">
                            {/* Selected Contacts Count */}
                            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                                <div className="flex items-center">
                                    <DocumentArrowUpIcon className="h-5 w-5 text-blue-400 mr-2" />
                                    <span className="text-sm font-medium text-blue-800">
                                        {selectedContacts.length} contact{selectedContacts.length !== 1 ? 's' : ''} selected
                                    </span>
                                </div>
                            </div>

                            {/* Agent Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Assign to Agent <span className="text-red-500">*</span>
                                </label>
                                <select
                                    name="agentId"
                                    value={formData.agentId}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                >
                                    <option value="">Choose an agent...</option>
                                    {agents.map(agent => (
                                        <option key={agent.id} value={agent.id}>
                                            {agent.firstName} {agent.lastName} {agent.assignedLeadsCount > 0 && ` (${agent.assignedLeadsCount} already assigned)`}
                                        </option>
                                    ))}
                                </select>
                                {formData.agentId && (
                                    <div className="mt-2 text-sm text-gray-600">
                                        {(() => {
                                            const agent = agents.find(a => a.id === formData.agentId);
                                            return agent ? (
                                                <div>
                                                    <div>Daily Target: {agent.dailyCallTarget} calls</div>
                                                    <div>Currently Assigned: {agent.assignedLeadsCount} leads</div>
                                                    <div>Status: {agent.isAvailable ? 'Available' : 'Busy'}</div>
                                                </div>
                                            ) : null;
                                        })()}
                                    </div>
                                )}
                            </div>

                            {/* Campaign Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Campaign (Optional)
                                </label>
                                <select
                                    name="campaignId"
                                    value={formData.campaignId}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">No specific campaign</option>
                                    {campaigns.map(campaign => (
                                        <option key={campaign.id} value={campaign.id}>
                                            {campaign.name} ({campaign.type})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Expiration Date */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Assignment Expires
                                </label>
                                <input
                                    type="datetime-local"
                                    name="expiresAt"
                                    value={formData.expiresAt}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Leads will be reassigned if not completed by this time
                                </p>
                            </div>

                            {/* Selected Contacts Preview */}
                            {selectedContacts.length > 0 && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Selected Contacts ({selectedContacts.length})
                                    </label>
                                    <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-md">
                                        {selectedContacts.slice(0, 10).map((contact, index) => (
                                            <div key={contact.id} className="px-3 py-2 text-sm border-b border-gray-100 last:border-b-0">
                                                <div className="font-medium">{contact.firstName} {contact.lastName}</div>
                                                <div className="text-gray-500">{contact.phone} • {contact.company || 'No company'}</div>
                                            </div>
                                        ))}
                                        {selectedContacts.length > 10 && (
                                            <div className="px-3 py-2 text-sm text-gray-500 text-center">
                                                ...and {selectedContacts.length - 10} more contacts
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end space-x-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                disabled={isLoading}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                                disabled={isLoading || !formData.agentId || selectedContacts.length === 0}
                            >
                                {isLoading ? (
                                    <>
                                        <LoadingSpinner size="sm" />
                                        <span className="ml-2">Assigning...</span>
                                    </>
                                ) : (
                                    `Assign ${selectedContacts.length} Lead${selectedContacts.length !== 1 ? 's' : ''}`
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default AssignLeadsModal;
