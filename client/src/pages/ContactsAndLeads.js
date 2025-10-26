import { UserGroupIcon, UsersIcon } from '@heroicons/react/24/outline';
import React, { useState } from 'react';
import Contacts from './Contacts';
import LeadAssignment from './LeadAssignment';

const ContactsAndLeads = () => {
  const [activeTab, setActiveTab] = useState('contacts');

  const tabs = [
    { id: 'contacts', name: 'Contact Management', icon: UsersIcon },
    { id: 'assignment', name: 'Lead Assignment', icon: UserGroupIcon },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
          <p className="text-gray-600 mt-1">Manage contacts and assign leads to agents</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon
                  className={`inline-block -ml-0.5 mr-2 h-5 w-5 ${
                    activeTab === tab.id ? 'text-blue-500' : 'text-gray-400'
                  }`}
                  aria-hidden="true"
                />
                <span>{tab.name}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'contacts' && <Contacts />}
        {activeTab === 'assignment' && <LeadAssignment />}
      </div>
    </div>
  );
};

export default ContactsAndLeads;
