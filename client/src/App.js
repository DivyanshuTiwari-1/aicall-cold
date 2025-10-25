import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { Toaster } from 'react-hot-toast';
import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom';

// Context
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Components
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/Layout';
import LoadingSpinner from './components/LoadingSpinner';
import AgentDashboard from './pages/AgentDashboard';
import AgentNumberAssignment from './pages/AgentNumberAssignment';
import AIIntelligence from './pages/AIIntelligence';
import Analytics from './pages/Analytics';
import Billing from './pages/Billing';
import Calls from './pages/Calls';
import Campaigns from './pages/Campaigns';
import Compliance from './pages/Compliance';
import Contacts from './pages/Contacts';
import Dashboard from './pages/Dashboard';
import DataUploaderDashboard from './pages/DataUploaderDashboard';
import ExecutiveDashboard from './pages/ExecutiveDashboard';
import KnowledgeBase from './pages/KnowledgeBase';
import LeadAssignment from './pages/LeadAssignment';
import LiveMonitor from './pages/LiveMonitor';
import Login from './pages/Login';
import ManagerDashboard from './pages/ManagerDashboard';
import PhoneNumbersManagement from './pages/PhoneNumbersManagement';
import Register from './pages/Register';
import Scripts from './pages/Scripts';
import Settings from './pages/Settings';
import UserManagement from './pages/UserManagement';
import VoiceStudio from './pages/VoiceStudio';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) return <LoadingSpinner />;
  return user ? children : <Navigate to='/login' />;
};

// Default Dashboard Route Component
const DefaultDashboard = () => {
  const { user } = useAuth();
  return <Navigate to={user?.roleType === 'agent' ? '/agent' : '/dashboard'} replace />;
};

// Public Route Component (redirect if already logged in)
const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) return <LoadingSpinner />;

  // Redirect to appropriate dashboard based on role
  if (user) {
    if (user.roleType === 'agent') {
      return <Navigate to='/agent' />;
    }
    return <Navigate to='/dashboard' />;
  }

  return children;
};

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Router future={{ v7_relativeSplatPath: true }}>
            <div className='App'>
              <Toaster
                position='top-right'
                toastOptions={{
                  duration: 4000,
                  style: {
                    background: '#363636',
                    color: '#fff',
                  },
                  success: {
                    duration: 3000,
                    iconTheme: {
                      primary: '#22c55e',
                      secondary: '#fff',
                    },
                  },
                  error: {
                    duration: 5000,
                    iconTheme: {
                      primary: '#ef4444',
                      secondary: '#fff',
                    },
                  },
                }}
              />
              <Routes>
              {/* Public Routes */}
              <Route
                path='/login'
                element={
                  <PublicRoute>
                    <Login />
                  </PublicRoute>
                }
              />
              <Route
                path='/register'
                element={
                  <PublicRoute>
                    <Register />
                  </PublicRoute>
                }
              />

              {/* Protected Routes */}
              <Route
                path='/'
                element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }
              >
                {/* Default Route */}
                <Route index element={<DefaultDashboard />} />

                {/* Agent Routes */}
                <Route path='agent' element={<AgentDashboard />} />

                {/* Admin/Manager Routes */}
                <Route path='dashboard' element={<Dashboard />} />
                <Route path='executive' element={<ExecutiveDashboard />} />
                <Route path='manager' element={<ManagerDashboard />} />
                <Route path='data-uploader' element={<DataUploaderDashboard />} />
                <Route path='lead-assignment' element={<LeadAssignment />} />
                <Route path='campaigns' element={<Campaigns />} />
                <Route path='calls' element={<Calls />} />
                <Route path='live-monitor' element={<LiveMonitor />} />
                <Route path='voice-studio' element={<VoiceStudio />} />
                <Route path='ai-intelligence' element={<AIIntelligence />} />
                <Route path='knowledge-base' element={<KnowledgeBase />} />
                <Route path='compliance' element={<Compliance />} />
                <Route path='contacts' element={<Contacts />} />
                <Route path='analytics' element={<Analytics />} />
                <Route path='billing' element={<Billing />} />
                <Route path='scripts' element={<Scripts />} />
                <Route path='settings' element={<Settings />} />
                <Route path='users' element={<UserManagement />} />
                <Route path='phone-numbers' element={<PhoneNumbersManagement />} />
                <Route path='agent-assignments' element={<AgentNumberAssignment />} />
              </Route>

              {/* Catch all route */}
              <Route path='*' element={<DefaultDashboard />} />
            </Routes>
          </div>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
