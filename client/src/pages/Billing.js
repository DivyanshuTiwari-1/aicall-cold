import {
    ArrowDownTrayIcon,
    ChartBarIcon,
    CheckCircleIcon,
    ClockIcon,
    CreditCardIcon,
    CurrencyDollarIcon,
    PlusIcon
} from '@heroicons/react/24/outline';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from '../hooks/useWebSocket';
import { billingAPI } from '../services/billing';

const Billing = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { addListener, isConnected } = useWebSocket();
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [purchaseAmount, setPurchaseAmount] = useState(100);
  const [selectedPackage, setSelectedPackage] = useState('basic');

  // Fetch credit balance
  const { data: balanceData, isLoading: balanceLoading } = useQuery({
    queryKey: ['credit-balance'],
    queryFn: () => billingAPI.getBalance(),
    refetchInterval: 30000,
  });

  // Fetch transaction history
  const { data: transactionsData, isLoading: transactionsLoading } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => billingAPI.getTransactions({ limit: 50 }),
    refetchInterval: 60000,
  });

  // Fetch usage analytics
  const { data: usageData, isLoading: usageLoading } = useQuery({
    queryKey: ['usage-analytics'],
    queryFn: () => billingAPI.getUsageAnalytics('30d'),
    refetchInterval: 300000,
  });

  // Purchase credits mutation
  const purchaseMutation = useMutation({
    mutationFn: (data) => billingAPI.purchaseCredits(data),
    onSuccess: () => {
      toast.success('Credits purchased successfully');
      queryClient.invalidateQueries({ queryKey: ['credit-balance'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setShowPurchaseModal(false);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to purchase credits');
    },
  });

  // Set up WebSocket listeners for real-time updates
  useEffect(() => {
    if (!isConnected || !user?.organizationId) return;

    const handleCreditUpdate = (data) => {
      // Refresh billing data when credits are updated
      queryClient.invalidateQueries({ queryKey: ['credit-balance'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['usage-analytics'] });
    };

    addListener('credit_update', handleCreditUpdate);

    return () => {
      // Cleanup listeners when component unmounts
    };
  }, [isConnected, user?.organizationId, addListener, queryClient]);

  const handlePurchase = () => {
    const packages = {
      basic: { credits: 1000, price: 100 },
      standard: { credits: 5000, price: 450 },
      premium: { credits: 10000, price: 800 },
      enterprise: { credits: 25000, price: 1800 },
    };

    const selectedPkg = packages[selectedPackage];
    purchaseMutation.mutate({
      amount: selectedPkg.price,
      credits: selectedPkg.credits,
      package: selectedPackage,
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'purchase':
        return <PlusIcon className="h-5 w-5 text-green-600" />;
      case 'usage':
        return <ArrowDownTrayIcon className="h-5 w-5 text-red-600" />;
      case 'refund':
        return <CheckCircleIcon className="h-5 w-5 text-blue-600" />;
      default:
        return <CurrencyDollarIcon className="h-5 w-5 text-gray-600" />;
    }
  };

  const getTransactionColor = (type) => {
    switch (type) {
      case 'purchase':
        return 'text-green-600';
      case 'usage':
        return 'text-red-600';
      case 'refund':
        return 'text-blue-600';
      default:
        return 'text-gray-600';
    }
  };

  const balance = balanceData?.balance || 0;
  const transactions = transactionsData?.transactions || [];
  const usage = usageData?.usage || {};

  if (balanceLoading || transactionsLoading || usageLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Billing & Credits</h1>
          <p className="text-gray-600">Manage your credit balance and billing</p>
        </div>
        <button
          onClick={() => setShowPurchaseModal(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Purchase Credits
        </button>
      </div>

      {/* Credit Balance Card */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium">Available Credits</h2>
            <p className="text-3xl font-bold">{balance.toLocaleString()}</p>
            <p className="text-blue-100 text-sm mt-1">
              {formatCurrency(balance * 0.1)} equivalent value
            </p>
          </div>
          <div className="text-right">
            <CreditCardIcon className="h-12 w-12 text-blue-200" />
            <p className="text-blue-100 text-sm mt-2">Credits</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CurrencyDollarIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Spent</dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {formatCurrency(usage.totalSpent || 0)}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ChartBarIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Credits Used</dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {usage.creditsUsed || 0}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ClockIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Avg Cost/Call</dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {formatCurrency(usage.avgCostPerCall || 0)}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Usage Analytics */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Usage Analytics</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Daily Usage (Last 7 Days)</h4>
            <div className="space-y-2">
              {usage.dailyUsage?.map((day, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{day.date}</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-20 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${(day.credits / Math.max(...usage.dailyUsage?.map(d => d.credits) || [1])) * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium text-gray-900">{day.credits}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Usage by Feature</h4>
            <div className="space-y-2">
              {usage.usageByFeature?.map((feature, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 capitalize">{feature.name}</span>
                  <span className="text-sm font-medium text-gray-900">{feature.credits}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Transaction History */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Transaction History</h3>
        {transactions.length === 0 ? (
          <div className="text-center py-8">
            <CurrencyDollarIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No transactions</h3>
            <p className="mt-1 text-sm text-gray-500">
              Your transaction history will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Credits
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {transactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getTransactionIcon(transaction.type)}
                        <span className="ml-2 text-sm font-medium text-gray-900 capitalize">
                          {transaction.type}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{transaction.description}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm font-medium ${getTransactionColor(transaction.type)}`}>
                        {transaction.type === 'usage' ? '-' : '+'}{formatCurrency(transaction.amount)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm font-medium ${getTransactionColor(transaction.type)}`}>
                        {transaction.type === 'usage' ? '-' : '+'}{transaction.credits}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(transaction.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        transaction.status === 'completed'
                          ? 'bg-green-100 text-green-800'
                          : transaction.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {transaction.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Purchase Credits Modal */}
      {showPurchaseModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
              onClick={() => setShowPurchaseModal(false)}
            />

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Purchase Credits</h3>
                  <button
                    onClick={() => setShowPurchaseModal(false)}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <span className="sr-only">Close</span>
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Package
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { id: 'basic', name: 'Basic', credits: 1000, price: 100 },
                        { id: 'standard', name: 'Standard', credits: 5000, price: 450 },
                        { id: 'premium', name: 'Premium', credits: 10000, price: 800 },
                        { id: 'enterprise', name: 'Enterprise', credits: 25000, price: 1800 },
                      ].map((pkg) => (
                        <div
                          key={pkg.id}
                          className={`p-3 border rounded-lg cursor-pointer ${
                            selectedPackage === pkg.id
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          onClick={() => setSelectedPackage(pkg.id)}
                        >
                          <div className="text-sm font-medium text-gray-900">{pkg.name}</div>
                          <div className="text-sm text-gray-500">{pkg.credits.toLocaleString()} credits</div>
                          <div className="text-sm font-medium text-gray-900">{formatCurrency(pkg.price)}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">Total</span>
                      <span className="text-lg font-bold text-gray-900">
                        {formatCurrency(
                          [
                            { id: 'basic', price: 100 },
                            { id: 'standard', price: 450 },
                            { id: 'premium', price: 800 },
                            { id: 'enterprise', price: 1800 },
                          ].find(p => p.id === selectedPackage)?.price || 0
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    onClick={() => setShowPurchaseModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePurchase}
                    disabled={purchaseMutation.isLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {purchaseMutation.isLoading ? 'Processing...' : 'Purchase'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Billing;
