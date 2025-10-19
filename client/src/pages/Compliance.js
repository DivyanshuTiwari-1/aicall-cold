import {
    CheckCircleIcon,
    DocumentTextIcon,
    ExclamationTriangleIcon,
    PhoneIcon,
    PlusIcon,
    ShieldCheckIcon,
    TrashIcon,
    XCircleIcon
} from '@heroicons/react/24/outline';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from '../hooks/useWebSocket';
import complianceAPI from '../services/compliance';
import dncAPI from '../services/dnc';

const Compliance = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { addListener, isConnected } = useWebSocket();
  const [isAddDncModalOpen, setIsAddDncModalOpen] = useState(false);
  const [newDncRecord, setNewDncRecord] = useState({
    phone: '',
    reason: '',
  });

  // Fetch DNC records
  const { data: dncData, isLoading: dncLoading } = useQuery({
    queryKey: ['dnc-records'],
    queryFn: () => dncAPI.getDncRecords(),
    refetchInterval: 30000,
  });

  // Fetch compliance metrics
  const { data: complianceData, isLoading: complianceLoading } = useQuery({
    queryKey: ['compliance-metrics'],
    queryFn: () => complianceAPI.getComplianceMetrics(),
    refetchInterval: 60000,
  });

  // Fetch audit logs
  const { data: auditData, isLoading: auditLoading } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => complianceAPI.getAuditLogs({ limit: 50 }),
    refetchInterval: 30000,
  });

  // Add DNC record mutation
  const addDncMutation = useMutation({
    mutationFn: (data) => dncAPI.addDncRecord(data),
    onSuccess: () => {
      toast.success('Number added to DNC registry');
      queryClient.invalidateQueries({ queryKey: ['dnc-records'] });
      queryClient.invalidateQueries({ queryKey: ['compliance-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      setIsAddDncModalOpen(false);
      setNewDncRecord({ phone: '', reason: '' });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to add DNC record');
    },
  });

  // Remove DNC record mutation
  const removeDncMutation = useMutation({
    mutationFn: (id) => dncAPI.removeDncRecord(id),
    onSuccess: () => {
      toast.success('Number removed from DNC registry');
      queryClient.invalidateQueries({ queryKey: ['dnc-records'] });
      queryClient.invalidateQueries({ queryKey: ['compliance-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to remove DNC record');
    },
  });

  // Set up WebSocket listeners for real-time updates
  useEffect(() => {
    if (!isConnected || !user?.organizationId) return;

    const handleComplianceUpdate = (data) => {
      // Refresh compliance data when changes occur
      queryClient.invalidateQueries({ queryKey: ['dnc-records'] });
      queryClient.invalidateQueries({ queryKey: ['compliance-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    };

    addListener('dnc_record_added', handleComplianceUpdate);
    addListener('dnc_record_removed', handleComplianceUpdate);
    addListener('compliance_violation', handleComplianceUpdate);

    return () => {
      // Cleanup listeners when component unmounts
    };
  }, [isConnected, user?.organizationId, addListener, queryClient]);

  const handleAddDnc = () => {
    if (!newDncRecord.phone.trim()) {
      toast.error('Phone number is required');
      return;
    }
    addDncMutation.mutate(newDncRecord);
  };

  const handleRemoveDnc = (id) => {
    if (window.confirm('Are you sure you want to remove this number from the DNC registry?')) {
      removeDncMutation.mutate(id);
    }
  };

  const dncRecords = dncData?.records || [];
  const metrics = complianceData?.metrics || {};
  const auditLogs = auditData?.logs || [];

  if (dncLoading || complianceLoading || auditLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Compliance & DNC Management</h1>
          <p className="text-gray-600">Manage Do Not Call registry and compliance tracking</p>
        </div>
        <button
          onClick={() => setIsAddDncModalOpen(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Add to DNC
        </button>
      </div>

      {/* Compliance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Consent Rate */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CheckCircleIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Consent Rate</dt>
                  <dd className="text-lg font-medium text-gray-900">{metrics.consentRate || 0}%</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* DNC List Size */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <XCircleIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">DNC List Size</dt>
                  <dd className="text-lg font-medium text-gray-900">{dncRecords.length}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Blocked Calls */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ShieldCheckIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Blocked Calls</dt>
                  <dd className="text-lg font-medium text-gray-900">{metrics.blockedCalls || 0}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Compliance Score */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ExclamationTriangleIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Compliance Score</dt>
                  <dd className="text-lg font-medium text-gray-900">{metrics.complianceScore || 0}%</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Consent Script Template */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Consent Script Template</h3>
        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <p className="text-sm text-gray-900 font-mono">
            Hi <code>{'{first_name}'}</code>, this is an automated call from <code>{'{company}'}</code>{' '}
            about <code>{'{topic}'}</code>. By continuing, you consent to this automated call. If you do
            not wish to be contacted, say 'Stop' or 'Remove me'.
          </p>
        </div>
        <div className="flex items-center text-green-600">
          <CheckCircleIcon className="h-5 w-5 mr-2" />
          <span className="text-sm font-medium">GDPR & DPDP Compliant</span>
        </div>
      </div>

      {/* Recent Audit Events */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Audit Events</h3>
        {auditLogs.length === 0 ? (
          <div className="text-center py-8">
            <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No audit events</h3>
            <p className="mt-1 text-sm text-gray-500">
              Audit events will appear here as they occur.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {auditLogs.map((log) => (
              <div key={log.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center">
                  <div className={`w-3 h-3 rounded-full mr-3 ${
                    log.type === 'consent' ? 'bg-green-500' :
                    log.type === 'dnc_added' ? 'bg-red-500' :
                    log.type === 'violation' ? 'bg-orange-500' : 'bg-gray-500'
                  }`} />
                  <span className="text-sm text-gray-900">{log.description}</span>
                </div>
                <span className="text-sm text-gray-500">
                  {new Date(log.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Do Not Call Registry */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Do Not Call (DNC) Registry</h3>
        {dncRecords.length === 0 ? (
          <div className="text-center py-8">
            <PhoneIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No DNC records</h3>
            <p className="mt-1 text-sm text-gray-500">
              Numbers added to the DNC registry will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Phone Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Added Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Reason
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {dncRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {record.phone}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(record.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {record.reason || 'Not specified'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleRemoveDnc(record.id)}
                        className="text-red-600 hover:text-red-900"
                        disabled={removeDncMutation.isLoading}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add DNC Modal */}
      {isAddDncModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
              onClick={() => setIsAddDncModalOpen(false)}
            />

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Add to DNC Registry</h3>
                  <button
                    onClick={() => setIsAddDncModalOpen(false)}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <XCircleIcon className="h-6 w-6" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={newDncRecord.phone}
                      onChange={(e) => setNewDncRecord({ ...newDncRecord, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="+91-9876543210"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Reason
                    </label>
                    <input
                      type="text"
                      value={newDncRecord.reason}
                      onChange={(e) => setNewDncRecord({ ...newDncRecord, reason: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="User requested, etc."
                    />
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  onClick={handleAddDnc}
                  disabled={addDncMutation.isLoading}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                >
                  {addDncMutation.isLoading ? 'Adding...' : 'Add to DNC'}
                </button>
                <button
                  onClick={() => setIsAddDncModalOpen(false)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Compliance;
