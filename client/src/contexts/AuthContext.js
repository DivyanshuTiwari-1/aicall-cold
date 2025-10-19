import React, { createContext, useContext, useState, useEffect } from "react";
// Assuming the import path is correct and 'api' handles Axios/fetch
import api from "../services/api";

const AuthContext = createContext();

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        // Correct usage of Error object
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        checkAuthStatus();
    }, []);

    const checkAuthStatus = async () => {
        try {
            const token = localStorage.getItem("token");
            if (!token) {
                setLoading(false);
                return;
            }

            // Set token in API client
            api.defaults.headers.common.Authorization = `Bearer ${token}`;

            // Verify token with backend
            // Using a try/catch block ensures we handle 401s here gracefully
            const response = await api.get("/auth/profile");

            if (response.data.success) {
                setUser(response.data.user);
            } else {
                localStorage.removeItem("token");
                delete api.defaults.headers.common.Authorization;
            }
        } catch (error) {
            console.error("Auth check failed:", error);
            localStorage.removeItem("token");
            delete api.defaults.headers.common.Authorization;
        } finally {
            setLoading(false);
        }
    };

    const login = async (email, password) => {
        try {
            const response = await api.post("/auth/login", { email, password });

            if (response.data.success) {
                const { token, user: userData } = response.data;
                localStorage.setItem("token", token);
                api.defaults.headers.common.Authorization = `Bearer ${token}`;
                setUser(userData);
                return { success: true, user: userData };
            }

            return { success: false, message: response.data.message };
        } catch (error) {
            console.error("Login error:", error);
            return {
                success: false,
                // Using optional chaining safely here
                message: error?.response?.data?.message || "Login failed. Please try again.",
            };
        }
    };

    const register = async (userData) => {
        try {
            const response = await api.post("/auth/register", userData);

            if (response.data.success) {
                const { token, user: newUser } = response.data;
                localStorage.setItem("token", token);
                api.defaults.headers.common.Authorization = `Bearer ${token}`;
                setUser(newUser);
                return { success: true, user: newUser };
            }

            return {
                success: false,
                message: response.data.message,
                errors: response.data.errors,
            };
        } catch (error) {
            console.error("Registration error:", error);
            return {
                success: false,
                message: error?.response?.data?.message || "Registration failed. Please try again.",
                errors: error?.response?.data?.errors || null,
            };
        }
    };

    const logout = () => {
        localStorage.removeItem("token");
        delete api.defaults.headers.common.Authorization;
        setUser(null);
    };

    const updateUser = (userData) => {
        setUser((prevUser) => ({ ...prevUser, ...userData }));
    };

    const value = {
        user,
        loading,
        login,
        register,
        logout,
        updateUser,
        isAuthenticated: !!user,
    };

    // FIX: Removed the unnecessary semicolon after the function body and cleaned up the return format.
    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
