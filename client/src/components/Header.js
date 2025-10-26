import { ArrowRightOnRectangleIcon, Bars3Icon, Cog6ToothIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Header = ({ onMenuClick }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
    setIsUserMenuOpen(false);
  };

  const handleSettingsClick = () => {
    navigate('/settings');
  };

  const isAgent = user?.roleType === 'agent';

  return (
    <header className='bg-white shadow-sm border-b border-gray-200'>
      <div className='flex items-center justify-between h-16 px-6'>
        <div className='flex items-center'>
          <button
            onClick={onMenuClick}
            className='lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100'
          >
            <Bars3Icon className='h-6 w-6' />
          </button>
          {/* Logo and Brand - Only for non-agents */}
          {!isAgent && (
            <div className='flex items-center ml-4'>
              <div className='flex items-center'>
                <div className='w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mr-3'>
                  <svg className='w-5 h-5 text-white' fill='currentColor' viewBox='0 0 20 20'>
                    <path d='M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z' />
                  </svg>
                </div>
                <div>
                  <h1 className='text-xl font-bold text-gray-900'> AI Dialer Pro </h1>
                  <p className='text-sm text-gray-500'> Emotion - Aware Voice Intelligence </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User Menu */}
        <div className='flex items-center space-x-6'>
          {/* Settings Button */}
          <button
            onClick={handleSettingsClick}
            className='p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100'
            title='Settings'
          >
            <Cog6ToothIcon className='h-6 w-6' />
          </button>

          {/* User Menu */}
          <div className='relative' ref={userMenuRef}>
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className='flex items-center space-x-2 p-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors'
            >
              <UserCircleIcon className='h-8 w-8 text-gray-400' />
              <div className='text-left'>
                <p className='text-sm font-medium text-gray-900'>
                  {user?.firstName} {user?.lastName}
                </p>
                <p className='text-xs text-gray-500 capitalize'>{user?.roleType}</p>
              </div>
            </button>

            {/* Dropdown Menu */}
            {isUserMenuOpen && (
              <div className='absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200'>
                <button
                  onClick={handleLogout}
                  className='flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors'
                >
                  <ArrowRightOnRectangleIcon className='h-4 w-4 mr-3' />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
