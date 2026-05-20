"use client";
import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check session storage for existing session
        const token = sessionStorage.getItem("adminToken");
        const username = sessionStorage.getItem("adminUsername");
        if (token) {
            setUser({ role: "admin", username: username });
        }
        setLoading(false);
    }, []);

    const login = async (username, password) => {
        try {
            const response = await fetch(`/api/admin/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password }),
            });
            const data = await response.json();
            if (data.success) {
                sessionStorage.setItem("adminToken", data.token);
                sessionStorage.setItem("adminUsername", data.username);
                setUser({ role: "admin", username: data.username });
                return { success: true };
            }
            return { success: false, message: data.message };
        } catch (error) {
            return { success: false, message: "Login failed" };
        }
    };

    const logout = () => {
        sessionStorage.removeItem("adminToken");
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
