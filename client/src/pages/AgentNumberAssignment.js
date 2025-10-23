import {
    CheckCircleIcon,
    PhoneIcon,
    UserGroupIcon,
    XCircleIcon,
} from '@heroicons/react/24/outline';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';
import phoneNumbersAPI from '../services/phoneNumbers';
import { usersAPI } from '../services/users';

const AgentNumberAssignment = () => {
  const queryClient = useQueryClient();
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignmentData, setAssignmentData] = useState({
    phoneNumberId: '',
    dailyLimit: 100,
    allowedCountries: ['US'],
  });

  const countryOptions = [
    { code: 'US', name: 'United States' },
    { code: 'CA', name: 'Canada' },
    { code: 'GB', name: 'United Kingdom' },
    { code: 'AU', name: 'Australia' },
    { code: 'IN', name: 'India' },
    { code: 'MX', name: 'Mexico' },
    { code: 'DE', name: 'Germany' },
    { code: 'FR', name: 'France' },
  ];

  // Fetch agents
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersAPI.getAllUsers(),
    refetchInterval: 60000,
  });

  // Fetch available phone numbers
  const { data: availableNumbersData, isLoading: numbersLoading } = useQuery({
    queryKey: ['phone-numbers-available'],
    queryFn: () => phoneNumbersAPI.getAllPhoneNumbers({ assigned: 'false', status: 'active' }),
  });

  // Fetch all phone numbers
  const { data: allNumbersData } = useQuery({
    queryKey: ['phone-numbers-all'],
    queryFn: () => phoneNumbersAPI.getAllPhoneNumbers(),
  });

  // Assign number mutation
  const assignMutation = useMutation({
    mutationFn: ({ numberId, data }) => phoneNumbersAPI.assignPhoneNumber(numberId, data),
    onSuccess: () => {
      toast.success('Phone number assigned successfully');
      setShowAssignModal(false);
      setAssignmentData({
        phoneNumberId: '',
        dailyLimit: 100,
        allowedCountries: ['US'],
      });
      queryClient.invalidateQueries({ queryKey: ['phone-numbers'] });
      queryClient.invalidateQueries({ queryKey: ['phone-numbers-available'] });
      queryClient.invalidateQueries({ queryKey: ['phone-numbers-all'] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to assign phone number');
    },
  });

  // Unassign mutation
  const unassignMutation = useMutation({
    mutationFn: phoneNumbersAPI.unassignPhoneNumber,
    onSuccess: () => {
      toast.success('Phone number unassigned successfully');
      queryClient.invalidateQueries({ queryKey: ['phone-numbers'] });
      queryClient.invalidateQueries({ queryKey: ['phone-numbers-available'] });
      queryClient.invalidateQueries({ queryKey: ['phone-numbers-all'] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to unassign phone number');
    },
  });

  const handleAssignNumber = () => {
    if (!selectedAgent || !assignmentData.phoneNumberId) {
      toast.error('Please select an agent and phone number');
      return;
    }

    assignMutation.mutate({
      numberId: assignmentData.phoneNumberId,
      data: {
        agentId: selectedAgent.id,
        dailyLimit: assignmentData.dailyLimit,
        allowedCountries: assignmentData.allowedCountries,
      },
    });
  };

  const handleUnassign = (numberId) => {
    if (window.confirm('Are you sure you want to unassign this phone number?')) {
      unassignMutation.mutate(numberId);
    }
  };

  const handleCountryToggle = (countryCode) => {
    setAssignmentData((prev) => ({
      ...prev,
      allowedCountries: prev.allowedCountries.includes(countryCode)
        ? prev.allowedCountries.filter((c) => c !== countryCode)
        : [...prev.allowedCountries, countryCode],
    }));
  };

  const agents = usersData?.users?.filter((u) => u.roleType === 'agent') || [];
  const availableNumbers = availableNumbersData?.phoneNumbers || [];
  const allNumbers = allNumbersData?.phoneNumbers || [];

  if (usersLoading) return <LoadingSpinner />;

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>Agent Number Assignment</h1>
          <p className='text-gray-600'>
            Assign phone numbers to agents with daily limits and country restrictions
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
        <div className='bg-blue-50 rounded-lg p-6'>
          <div className='flex items-center'>
            <UserGroupIcon className='h-8 w-8 text-blue-600 mr-3' />
            <div>
              <p className='text-sm font-medium text-gray-600'>Total Agents</p>
              <p className='text-2xl font-bold text-gray-900'>{agents.length}</p>
            </div>
          </div>
        </div>
        <div className='bg-green-50 rounded-lg p-6'>
          <div className='flex items-center'>
            <PhoneIcon className='h-8 w-8 text-green-600 mr-3' />
            <div>
              <p className='text-sm font-medium text-gray-600'>Available Numbers</p>
              <p className='text-2xl font-bold text-gray-900'>{availableNumbers.length}</p>
            </div>
          </div>
        </div>
        <div className='bg-purple-50 rounded-lg p-6'>
          <div className='flex items-center'>
            <CheckCircleIcon className='h-8 w-8 text-purple-600 mr-3' />
            <div>
              <p className='text-sm font-medium text-gray-600'>Assigned Numbers</p>
              <p className='text-2xl font-bold text-gray-900'>
                {allNumbers.filter((n) => n.assigned_to).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Agents List */}
      <div className='bg-white rounded-lg shadow overflow-hidden'>
        <div className='px-6 py-4 border-b border-gray-200'>
          <h2 className='text-lg font-semibold text-gray-900'>Agents</h2>
        </div>
        <div className='overflow-x-auto'>
          <table className='min-w-full divide-y divide-gray-200'>
            <thead className='bg-gray-50'>
              <tr>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Agent
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Email
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Status
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Assigned Numbers
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className='bg-white divide-y divide-gray-200'>
              {agents.length === 0 ? (
                <tr>
                  <td colSpan='5' className='px-6 py-12 text-center text-gray-500'>
                    <div className='flex flex-col items-center'>
                      <UserGroupIcon className='h-12 w-12 text-gray-400 mb-3' />
                      <p className='text-lg font-medium'>No agents found</p>
                      <p className='text-sm'>Create agents to assign phone numbers</p>
                    </div>
                  </td>
                </tr>
              ) : (
                agents.map((agent) => {
                  const assignedNumbers = allNumbers.filter(
                    (n) => n.assigned_to === agent.id
                  );
                  return (
                    <tr key={agent.id} className='hover:bg-gray-50'>
                      <td className='px-6 py-4 whitespace-nowrap'>
                        <div className='flex items-center'>
                          <div className='h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center mr-3'>
                            <span className='text-blue-600 font-semibold'>
                              {agent.firstName?.[0]}
                              {agent.lastName?.[0]}
                            </span>
                          </div>
                          <div>
                            <div className='text-sm font-medium text-gray-900'>
                              {agent.firstName} {agent.lastName}
                            </div>
                            <div className='text-sm text-gray-500'>
                              SIP: {agent.sipExtension || 'Not set'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className='px-6 py-4 whitespace-nowrap'>
                        <div className='text-sm text-gray-900'>{agent.email}</div>
                      </td>
                      <td className='px-6 py-4 whitespace-nowrap'>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            agent.isActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {agent.isActive ? (
                            <CheckCircleIcon className='h-4 w-4 mr-1' />
                          ) : (
                            <XCircleIcon className='h-4 w-4 mr-1' />
                          )}
                          {agent.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className='px-6 py-4'>
                        <div className='space-y-1'>
                          {assignedNumbers.length === 0 ? (
                            <span className='text-sm text-gray-500'>No numbers assigned</span>
                          ) : (
                            assignedNumbers.map((num) => (
                              <div
                                key={num.id}
                                className='flex items-center justify-between bg-gray-50 px-3 py-2 rounded text-sm'
                              >
                                <div>
                                  <span className='font-medium text-gray-900'>
                                    {num.phone_number}
                                  </span>
                                  <div className='text-xs text-gray-500 mt-1'>
                                    Limit: {num.calls_made_today || 0}/{num.daily_limit} •
                                    Countries: {(typeof num.allowed_countries === 'string'
                                      ? JSON.parse(num.allowed_countries || '[]')
                                      : num.allowed_countries || []).join(', ')}
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleUnassign(num.id)}
                                  className='ml-3 text-red-600 hover:text-red-900 text-xs'
                                >
                                  Remove
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </td>
                      <td className='px-6 py-4 whitespace-nowrap text-sm font-medium'>
                        <button
                          onClick={() => {
                            setSelectedAgent(agent);
                            setShowAssignModal(true);
                          }}
                          disabled={availableNumbers.length === 0}
                          className='text-blue-600 hover:text-blue-900 disabled:text-gray-400'
                        >
                          Assign Number
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assign Number Modal */}
      {showAssignModal && selectedAgent && (
        <div className='fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4'>
          <div className='bg-white rounded-lg max-w-2xl w-full p-6'>
            <h2 className='text-xl font-bold text-gray-900 mb-4'>
              Assign Number to {selectedAgent.firstName} {selectedAgent.lastName}
            </h2>

            <div className='space-y-4'>
              {/* Phone Number Selection */}
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-2'>
                  Phone Number *
                </label>
                <select
                  value={assignmentData.phoneNumberId}
                  onChange={(e) =>
                    setAssignmentData({ ...assignmentData, phoneNumberId: e.target.value })
                  }
                  className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                >
                  <option value=''>Select a phone number</option>
                  {availableNumbers.map((num) => (
                    <option key={num.id} value={num.id}>
                      {num.phone_number} ({num.country_code}) - {num.provider}
                    </option>
                  ))}
                </select>
                {availableNumbers.length === 0 && (
                  <p className='mt-2 text-sm text-red-600'>
                    No available numbers. Please add phone numbers first.
                  </p>
                )}
              </div>

              {/* Daily Limit */}
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-2'>
                  Daily Call Limit *
                </label>
                <input
                  type='number'
                  min='1'
                  max='1000'
                  value={assignmentData.dailyLimit}
                  onChange={(e) =>
                    setAssignmentData({
                      ...assignmentData,
                      dailyLimit: parseInt(e.target.value),
                    })
                  }
                  className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                />
                <p className='mt-1 text-sm text-gray-500'>
                  Maximum number of calls this agent can make per day from this number
                </p>
              </div>

              {/* Allowed Countries */}
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-2'>
                  Allowed Countries *
                </label>
                <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
                  {countryOptions.map((country) => (
                    <label
                      key={country.code}
                      className='flex items-center space-x-2 p-3 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer'
                    >
                      <input
                        type='checkbox'
                        checked={assignmentData.allowedCountries.includes(country.code)}
                        onChange={() => handleCountryToggle(country.code)}
                        className='h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded'
                      />
                      <span className='text-sm text-gray-900'>
                        {country.code} - {country.name}
                      </span>
                    </label>
                  ))}
                </div>
                <p className='mt-1 text-sm text-gray-500'>
                  Agent can only call numbers in selected countries
                </p>
                {assignmentData.allowedCountries.length === 0 && (
                  <p className='mt-2 text-sm text-red-600'>
                    Please select at least one country
                  </p>
                )}
              </div>
            </div>

            <div className='mt-6 flex items-center justify-end space-x-3'>
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedAgent(null);
                  setAssignmentData({
                    phoneNumberId: '',
                    dailyLimit: 100,
                    allowedCountries: ['US'],
                  });
                }}
                className='px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50'
              >
                Cancel
              </button>
              <button
                onClick={handleAssignNumber}
                disabled={
                  assignMutation.isLoading ||
                  !assignmentData.phoneNumberId ||
                  assignmentData.allowedCountries.length === 0
                }
                className='px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400'
              >
                {assignMutation.isLoading ? 'Assigning...' : 'Assign Number'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentNumberAssignment;
