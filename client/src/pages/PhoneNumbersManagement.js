import {
    CheckCircleIcon,
    PlusIcon,
    TrashIcon,
    UserIcon,
    XCircleIcon,
} from '@heroicons/react/24/outline';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';
import phoneNumbersAPI from '../services/phoneNumbers';

const PhoneNumbersManagement = () => {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterAssigned, setFilterAssigned] = useState('all');

  // Form state
  const [newNumber, setNewNumber] = useState({
    phoneNumber: '',
    provider: 'telnyx',
    countryCode: 'US',
  });

  const [bulkNumbers, setBulkNumbers] = useState('');

  // Fetch phone numbers
  const { data: numbersData, isLoading } = useQuery({
    queryKey: ['phone-numbers', filterStatus, filterAssigned],
    queryFn: () =>
      phoneNumbersAPI.getAllPhoneNumbers({
        status: filterStatus,
        assigned: filterAssigned,
      }),
    refetchInterval: 30000,
  });

  // Add number mutation
  const addNumberMutation = useMutation({
    mutationFn: phoneNumbersAPI.addPhoneNumber,
    onSuccess: () => {
      toast.success('Phone number added successfully');
      setShowAddModal(false);
      setNewNumber({ phoneNumber: '', provider: 'telnyx', countryCode: 'US' });
      queryClient.invalidateQueries({ queryKey: ['phone-numbers'] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to add phone number');
    },
  });

  // Bulk upload mutation
  const bulkUploadMutation = useMutation({
    mutationFn: phoneNumbersAPI.bulkUploadPhoneNumbers,
    onSuccess: (data) => {
      const { results } = data;
      toast.success(
        `Upload complete: ${results.added.length} added, ${results.skipped.length} skipped, ${results.errors.length} errors`
      );
      setShowBulkUploadModal(false);
      setBulkNumbers('');
      queryClient.invalidateQueries({ queryKey: ['phone-numbers'] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to upload phone numbers');
    },
  });

  // Delete number mutation
  const deleteNumberMutation = useMutation({
    mutationFn: phoneNumbersAPI.deletePhoneNumber,
    onSuccess: () => {
      toast.success('Phone number deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['phone-numbers'] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to delete phone number');
    },
  });

  // Unassign number mutation
  const unassignNumberMutation = useMutation({
    mutationFn: phoneNumbersAPI.unassignPhoneNumber,
    onSuccess: () => {
      toast.success('Phone number unassigned successfully');
      queryClient.invalidateQueries({ queryKey: ['phone-numbers'] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to unassign phone number');
    },
  });

  const handleAddNumber = () => {
    addNumberMutation.mutate(newNumber);
  };

  const handleBulkUpload = () => {
    // Parse bulk numbers (one per line, format: +1234567890,telnyx,US)
    const lines = bulkNumbers.split('\n').filter((line) => line.trim());
    const phoneNumbers = lines.map((line) => {
      const parts = line.split(',').map((p) => p.trim());
      return {
        phoneNumber: parts[0],
        provider: parts[1] || 'telnyx',
        countryCode: parts[2] || 'US',
      };
    });

    bulkUploadMutation.mutate(phoneNumbers);
  };

  const handleDelete = (numberId) => {
    if (window.confirm('Are you sure you want to delete this phone number?')) {
      deleteNumberMutation.mutate(numberId);
    }
  };

  const handleUnassign = (numberId) => {
    if (window.confirm('Are you sure you want to unassign this phone number?')) {
      unassignNumberMutation.mutate(numberId);
    }
  };

  const phoneNumbers = numbersData?.phoneNumbers || [];

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>Phone Numbers Management</h1>
          <p className='text-gray-600'>Manage phone numbers for outbound calling</p>
        </div>
        <div className='flex items-center space-x-3'>
          <button
            onClick={() => setShowBulkUploadModal(true)}
            className='px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center'
          >
            <PlusIcon className='h-5 w-5 mr-2' />
            Bulk Upload
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className='px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center'
          >
            <PlusIcon className='h-5 w-5 mr-2' />
            Add Number
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className='bg-white rounded-lg shadow p-4'>
        <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
            >
              <option value='all'>All Statuses</option>
              <option value='active'>Active</option>
              <option value='inactive'>Inactive</option>
            </select>
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>Assignment</label>
            <select
              value={filterAssigned}
              onChange={(e) => setFilterAssigned(e.target.value)}
              className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
            >
              <option value='all'>All Numbers</option>
              <option value='true'>Assigned</option>
              <option value='false'>Available</option>
            </select>
          </div>
          <div className='flex items-end'>
            <div className='text-sm text-gray-600'>
              <p>Total: {phoneNumbers.length}</p>
              <p>
                Available: {phoneNumbers.filter((n) => !n.assigned_to).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Phone Numbers List */}
      <div className='bg-white rounded-lg shadow overflow-hidden'>
        <div className='overflow-x-auto'>
          <table className='min-w-full divide-y divide-gray-200'>
            <thead className='bg-gray-50'>
              <tr>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Phone Number
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Provider
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Country
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Status
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Assigned To
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Daily Limit
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className='bg-white divide-y divide-gray-200'>
              {phoneNumbers.length === 0 ? (
                <tr>
                  <td colSpan='7' className='px-6 py-12 text-center text-gray-500'>
                    <div className='flex flex-col items-center'>
                      <UserIcon className='h-12 w-12 text-gray-400 mb-3' />
                      <p className='text-lg font-medium'>No phone numbers found</p>
                      <p className='text-sm'>Add phone numbers to get started</p>
                    </div>
                  </td>
                </tr>
              ) : (
                phoneNumbers.map((number) => (
                  <tr key={number.id} className='hover:bg-gray-50'>
                    <td className='px-6 py-4 whitespace-nowrap'>
                      <div className='text-sm font-medium text-gray-900'>
                        {number.phone_number}
                      </div>
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap'>
                      <div className='text-sm text-gray-900'>{number.provider}</div>
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap'>
                      <div className='text-sm text-gray-900'>{number.country_code}</div>
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap'>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          number.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {number.status === 'active' ? (
                          <CheckCircleIcon className='h-4 w-4 mr-1' />
                        ) : (
                          <XCircleIcon className='h-4 w-4 mr-1' />
                        )}
                        {number.status}
                      </span>
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap'>
                      {number.assigned_to ? (
                        <div className='text-sm'>
                          <div className='font-medium text-gray-900'>
                            {number.agent_first_name} {number.agent_last_name}
                          </div>
                          <div className='text-gray-500'>{number.agent_email}</div>
                        </div>
                      ) : (
                        <span className='text-sm text-gray-500'>Available</span>
                      )}
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap'>
                      {number.assigned_to ? (
                        <div className='text-sm text-gray-900'>
                          {number.calls_made_today || 0} / {number.daily_limit || 0}
                        </div>
                      ) : (
                        <span className='text-sm text-gray-500'>-</span>
                      )}
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2'>
                      {number.assigned_to ? (
                        <button
                          onClick={() => handleUnassign(number.id)}
                          className='text-orange-600 hover:text-orange-900'
                        >
                          Unassign
                        </button>
                      ) : (
                        <button
                          onClick={() => handleDelete(number.id)}
                          className='text-red-600 hover:text-red-900'
                        >
                          <TrashIcon className='h-5 w-5' />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Number Modal */}
      {showAddModal && (
        <div className='fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4'>
          <div className='bg-white rounded-lg max-w-md w-full p-6'>
            <h2 className='text-xl font-bold text-gray-900 mb-4'>Add Phone Number</h2>
            <div className='space-y-4'>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-2'>
                  Phone Number *
                </label>
                <input
                  type='text'
                  placeholder='+12025550123'
                  value={newNumber.phoneNumber}
                  onChange={(e) =>
                    setNewNumber({ ...newNumber, phoneNumber: e.target.value })
                  }
                  className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-2'>
                  Provider *
                </label>
                <select
                  value={newNumber.provider}
                  onChange={(e) => setNewNumber({ ...newNumber, provider: e.target.value })}
                  className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                >
                  <option value='telnyx'>Telnyx</option>
                  <option value='twilio'>Twilio</option>
                </select>
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-2'>
                  Country Code *
                </label>
                <input
                  type='text'
                  placeholder='US'
                  maxLength='2'
                  value={newNumber.countryCode}
                  onChange={(e) =>
                    setNewNumber({ ...newNumber, countryCode: e.target.value.toUpperCase() })
                  }
                  className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                />
              </div>
            </div>
            <div className='mt-6 flex items-center justify-end space-x-3'>
              <button
                onClick={() => setShowAddModal(false)}
                className='px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50'
              >
                Cancel
              </button>
              <button
                onClick={handleAddNumber}
                disabled={addNumberMutation.isLoading || !newNumber.phoneNumber}
                className='px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400'
              >
                {addNumberMutation.isLoading ? 'Adding...' : 'Add Number'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Upload Modal */}
      {showBulkUploadModal && (
        <div className='fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4'>
          <div className='bg-white rounded-lg max-w-2xl w-full p-6'>
            <h2 className='text-xl font-bold text-gray-900 mb-4'>Bulk Upload Phone Numbers</h2>
            <p className='text-sm text-gray-600 mb-4'>
              Enter one phone number per line. Format: +1234567890,provider,countryCode
              <br />
              Example: +12025550123,telnyx,US
            </p>
            <textarea
              value={bulkNumbers}
              onChange={(e) => setBulkNumbers(e.target.value)}
              rows={10}
              placeholder='+12025550123,telnyx,US&#10;+12025550124,telnyx,US&#10;+14155550125,telnyx,US'
              className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm'
            />
            <div className='mt-6 flex items-center justify-end space-x-3'>
              <button
                onClick={() => setShowBulkUploadModal(false)}
                className='px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50'
              >
                Cancel
              </button>
              <button
                onClick={handleBulkUpload}
                disabled={bulkUploadMutation.isLoading || !bulkNumbers.trim()}
                className='px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400'
              >
                {bulkUploadMutation.isLoading ? 'Uploading...' : 'Upload Numbers'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PhoneNumbersManagement;
