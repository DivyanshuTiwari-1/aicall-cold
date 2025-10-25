import {
    ArrowRightOnRectangleIcon,
    BookOpenIcon,
    ChartBarIcon,
    ClipboardDocumentListIcon,
    CogIcon,
    CpuChipIcon,
    CreditCardIcon,
    DocumentTextIcon,
    EyeIcon,
    HomeIcon,
    MegaphoneIcon,
    MicrophoneIcon,
    PhoneIcon,
    ShieldCheckIcon,
    UserGroupIcon,
    UsersIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';
import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useRoleAccess } from '../hooks/useRoleAccess';

const Sidebar = ({ isOpen, onClose }) => {
  const { canViewPage } = useRoleAccess();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
    onClose(); // Close sidebar after logout
  };

  // Agent-specific simplified navigation
  const agentNavigation = [
    { name: 'Dashboard', href: '/agent', icon: HomeIcon, roles: ['agent'] },
    { name: 'My Leads', href: '/agent/leads', icon: ClipboardDocumentListIcon, roles: ['agent'] },
    { name: 'Call History', href: '/agent/calls', icon: PhoneIcon, roles: ['agent'] },
    { name: 'Settings', href: '/settings', icon: CogIcon, roles: ['agent'] },
  ];

  // Full navigation for other roles
  const fullNavigation = [
    { name: 'Dashboard', href: '/dashboard', icon: HomeIcon, roles: ['admin', 'manager', 'data_uploader'] },
    { name: 'Lead Assignment', href: '/lead-assignment', icon: ClipboardDocumentListIcon, roles: ['admin', 'manager'] },
    { name: 'Campaigns', href: '/campaigns', icon: MegaphoneIcon, roles: ['admin', 'manager'] },
    { name: 'Contacts', href: '/contacts', icon: UsersIcon, roles: ['admin', 'manager', 'data_uploader'] },
    { name: 'Calls', href: '/calls', icon: PhoneIcon, roles: ['admin', 'manager'] },
    { name: 'Live Monitor', href: '/live-monitor', icon: EyeIcon, roles: ['admin', 'manager'] },
    { name: 'Voice Studio', href: '/voice-studio', icon: MicrophoneIcon, roles: ['admin', 'manager'] },
    { name: 'AI Intelligence', href: '/ai-intelligence', icon: CpuChipIcon, roles: ['admin', 'manager'] },
    { name: 'Knowledge Base', href: '/knowledge-base', icon: BookOpenIcon, roles: ['admin', 'manager'] },
    { name: 'Compliance', href: '/compliance', icon: ShieldCheckIcon, roles: ['admin', 'manager'] },
    { name: 'Analytics', href: '/analytics', icon: ChartBarIcon, roles: ['admin', 'manager'] },
    { name: 'Billing', href: '/billing', icon: CreditCardIcon, roles: ['admin', 'manager'] },
    { name: 'User Management', href: '/users', icon: UsersIcon, roles: ['admin'] },
    { name: 'Phone Numbers', href: '/phone-numbers', icon: PhoneIcon, roles: ['admin'] },
    { name: 'Agent Assignments', href: '/agent-assignments', icon: UserGroupIcon, roles: ['admin'] },
    { name: 'Scripts', href: '/scripts', icon: DocumentTextIcon, roles: ['admin', 'manager'] },
    { name: 'Settings', href: '/settings', icon: CogIcon, roles: ['admin', 'manager'] },
  ];

  const navigation = user?.roleType === 'agent' ? agentNavigation : fullNavigation;
  const filteredNavigation = navigation.filter(item => canViewPage(item.href.split('/')[1]));

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div className='fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden' onClick={onClose} />
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className='flex items-center justify-between h-16 px-6 border-b border-gray-200'>
          <div className='flex items-center'>
            <div className='flex-shrink-0'>
              <div className='w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center'>
                <span className='text-white font-bold text-sm'>AI</span>
              </div>
            </div>
            <div className='ml-3'>
              <h1 className='text-lg font-semibold text-gray-900'>AI Dialer Pro</h1>
            </div>
          </div>
          <button
            onClick={onClose}
            className='lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100'
          >
            <XMarkIcon className='h-5 w-5' />
          </button>
        </div>

              <nav className='mt-6 px-3'>
                <div className='space-y-1'>
                  {filteredNavigation.map(item => (
                    <NavLink
                      key={item.name}
                      to={item.href}
                      className={({ isActive }) =>
                        `group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${
                          isActive
                            ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                            : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                        }`
                      }
                      onClick={onClose}
                    >
                      <item.icon className='mr-3 h-5 w-5 flex-shrink-0' aria-hidden='true' />
                      {item.name}
                    </NavLink>
                  ))}
                </div>
              </nav>

        {/* User info and logout */}
        <div className='absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center'>
              <div className='flex-shrink-0'>
                <div className='w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center'>
                  <span className='text-gray-600 font-medium text-sm'>
                    {user?.firstName?.charAt(0) || 'U'}
                  </span>
                </div>
              </div>
              <div className='ml-3'>
                <p className='text-sm font-medium text-gray-900'>
                  {user?.firstName} {user?.lastName}
                </p>
                <p className='text-xs text-gray-500'>{user?.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className='p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors'
              title='Logout'
            >
              <ArrowRightOnRectangleIcon className='h-5 w-5' />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
