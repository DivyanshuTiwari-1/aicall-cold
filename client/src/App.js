import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "react-query";
import { Toaster } from "react-hot-toast";

// Context
import { AuthProvider, useAuth } from "./contexts/AuthContext";

// Components
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Campaigns from "./pages/Campaigns";
import Contacts from "./pages/Contacts";
import Calls from "./pages/Calls";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import VoiceStudio from "./pages/VoiceStudio";
import LiveMonitor from "./pages/LiveMonitor";
import AIIntelligence from "./pages/AIIntelligence";
import KnowledgeBase from "./pages/KnowledgeBase";
import Compliance from "./pages/Compliance";
import ExecutiveDashboard from "./pages/ExecutiveDashboard";
import LoadingSpinner from "./components/LoadingSpinner";

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

    if (loading) {
        return <LoadingSpinner / > ;
    }

    return user ? children : < Navigate to = "/login" / > ;
};

// Public Route Component (redirect if already logged in)
const PublicRoute = ({ children }) => {
    const { user, loading } = useAuth();

    if (loading) {
        return <LoadingSpinner / > ;
    }

    return user ? < Navigate to = "/dashboard" / > : children;
};

function App() {
    return ( <
        QueryClientProvider client = { queryClient } >
        <
        AuthProvider >
        <
        Router >
        <
        div className = "App" >
        <
        Toaster position = "top-right"
        toastOptions = {
            {
                duration: 4000,
                style: {
                    background: "#363636",
                    color: "#fff",
                },
                success: {
                    duration: 3000,
                    iconTheme: {
                        primary: "#22c55e",
                        secondary: "#fff",
                    },
                },
                error: {
                    duration: 5000,
                    iconTheme: {
                        primary: "#ef4444",
                        secondary: "#fff",
                    },
                },
            }
        }
        /> <
        Routes > { /* Public Routes */ } <
        Route path = "/login"
        element = { <
            PublicRoute >
            <
            Login / >
            <
            /PublicRoute>
        }
        /> <
        Route path = "/register"
        element = { <
            PublicRoute >
            <
            Register / >
            <
            /PublicRoute>
        }
        /> { / * Protected Routes * / } <
        Route path = "/"
        element = { <
            ProtectedRoute >
            <
            Layout / >
            <
            /ProtectedRoute>
        } >
        <
        Route index element = { < Navigate to = "/dashboard"
            replace / >
        }
        /> <
        Route path = "dashboard"
        element = { < Dashboard / > }
        /> <
        Route path = "executive"
        element = { < ExecutiveDashboard / > }
        /> <
        Route path = "campaigns"
        element = { < Campaigns / > }
        /> <
        Route path = "calls"
        element = { < Calls / > }
        /> <
        Route path = "live-monitor"
        element = { < LiveMonitor / > }
        /> <
        Route path = "voice-studio"
        element = { < VoiceStudio / > }
        /> <
        Route path = "ai-intelligence"
        element = { < AIIntelligence / > }
        /> <
        Route path = "knowledge-base"
        element = { < KnowledgeBase / > }
        /> <
        Route path = "compliance"
        element = { < Compliance / > }
        /> <
        Route path = "contacts"
        element = { < Contacts / > }
        /> <
        Route path = "analytics"
        element = { < Analytics / > }
        /> <
        Route path = "settings"
        element = { < Settings / > }
        /> < /
        Route > { /* Catch all route */ } <
        Route path = "*"
        element = { < Navigate to = "/dashboard"
            replace / >
        }
        /> < /
        Routes > <
        /div> < /
        Router > <
        /AuthProvider> < /
        QueryClientProvider >
    );
}

export default App;