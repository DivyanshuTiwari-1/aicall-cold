import { Bars3Icon } from '@heroicons/react/24/outline';
import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className='flex h-screen bg-gray-50'>
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      {/* Main content */}
      <div className='flex-1 flex flex-col overflow-hidden'>
        {/* Mobile menu button */}
        <div className='lg:hidden bg-white border-b border-gray-200 px-4 py-3'>
          <button
            onClick={() => setSidebarOpen(true)}
            className='p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100'
          >
            <Bars3Icon className='h-6 w-6' />
          </button>
        </div>
        {/* Page content */}
        <main className='flex-1 overflow-x-hidden overflow-y-auto bg-gray-50'>
          <div className='container mx-auto px-6 py-6'>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
