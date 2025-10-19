import { XMarkIcon } from '@heroicons/react/24/outline';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { usersAPI } from '../services/users';
import LoadingSpinner from './LoadingSpinner';

const AddUserModal = ({ isOpen, onClose, editingUser }) => {
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        firstName: '',
        lastName: '',
        roleType: 'agent',
        dailyCallTarget: 50,
    });

    const queryClient = useQueryClient();

    // Update form data when editing
    useEffect(() => {
        if (editingUser) {
            setFormData({
                email: editingUser.email,
                password: '', // Don't pre-fill password
                firstName: editingUser.firstName,
                lastName: editingUser.lastName,
                roleType: editingUser.roleType,
                dailyCallTarget: editingUser.dailyCallTarget,
            });
        } else {
            setFormData({
                email: '',
                password: '',
                firstName: '',
                lastName: '',
                roleType: 'agent',
                dailyCallTarget: 50,
            });
        }
    }, [editingUser]);

    const createMutation = useMutation({
        mutationFn: (data) => usersAPI.createUser(data),
        onSuccess: () => {
            toast.success('User created successfully!');
            queryClient.invalidateQueries({ queryKey: ['users'] });
            onClose();
            resetForm();
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Failed to create user');
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ userId, data }) => usersAPI.updateUser(userId, data),
        onSuccess: () => {
            toast.success('User updated successfully!');
            queryClient.invalidateQueries({ queryKey: ['users'] });
            onClose();
            resetForm();
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Failed to update user');
        },
    });

    const resetForm = () => {
        setFormData({
            email: '',
            password: '',
            firstName: '',
            lastName: '',
            roleType: 'agent',
            dailyCallTarget: 50,
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        if (!formData.firstName.trim() || !formData.lastName.trim() || !formData.email.trim()) {
            toast.error('Please fill in all required fields');
            return;
        }

        if (!editingUser && !formData.password.trim()) {
            toast.error('Password is required for new users');
            return;
        }

        const submitData = {...formData };

        // Remove password from update if empty
        if (editingUser && !submitData.password.trim()) {
            delete submitData.password;
        }

        if (editingUser) {
            updateMutation.mutate({ userId: editingUser.id, data: submitData });
        } else {
            createMutation.mutate(submitData);
        }
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }));
    };

    const isLoading = createMutation.isLoading || updateMutation.isLoading;

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
                            {editingUser ? 'Edit User' : 'Add New User'}
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
                            {/* First Name */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    First Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="firstName"
                                    value={formData.firstName}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Enter first name"
                                    required
                                />
                            </div>

                            {/* Last Name */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Last Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="lastName"
                                    value={formData.lastName}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Enter last name"
                                    required
                                />
                            </div>

                            {/* Email */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Email <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Enter email address"
                                    required
                                />
                            </div>

                            {/* Password */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Password {!editingUser && <span className="text-red-500">*</span>}
                                </label>
                                <input
                                    type="password"
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder={editingUser ? "Leave blank to keep current password" : "Enter password"}
                                    required={!editingUser}
                                />
                                {editingUser && (
                                    <p className="text-xs text-gray-500 mt-1">
                                        Leave blank to keep current password
                                    </p>
                                )}
                            </div>

                            {/* Role Type */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Role <span className="text-red-500">*</span>
                                </label>
                                <select
                                    name="roleType"
                                    value={formData.roleType}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                >
                                    <option value="agent">Agent</option>
                                    <option value="manager">Manager</option>
                                    <option value="admin">Admin</option>
                                    <option value="data_uploader">Data Uploader</option>
                                </select>
                                <p className="text-xs text-gray-500 mt-1">
                                    {formData.roleType === 'agent' && 'Can make calls and manage assigned leads'}
                                    {formData.roleType === 'manager' && 'Can view team performance and manage agents'}
                                    {formData.roleType === 'admin' && 'Full system access and user management'}
                                    {formData.roleType === 'data_uploader' && 'Can upload contacts and assign leads'}
                                </p>
                            </div>

                            {/* Daily Call Target */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Daily Call Target
                                </label>
                                <input
                                    type="number"
                                    name="dailyCallTarget"
                                    value={formData.dailyCallTarget}
                                    onChange={handleChange}
                                    min="1"
                                    max="200"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="50"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Number of calls this user should make per day
                                </p>
                            </div>
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
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <>
                                        <LoadingSpinner size="sm" />
                                        <span className="ml-2">{editingUser ? 'Updating...' : 'Creating...'}</span>
                                    </>
                                ) : (
                                    editingUser ? 'Update User' : 'Create User'
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default AddUserModal;
