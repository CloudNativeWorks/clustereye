import React, { useEffect } from 'react';
import './index.css';
import { HashRouter as Router, Route, Routes, useNavigate, Navigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { message } from 'antd';

// Layouts
import MainLayout from './layout/index';

// Pages
import Login from './pages/Login';
import Dashboard from './generalDashboard';
import QueryAnalyzer from './queryAnalyzer';
import AlarmDashboard from './pages/AlarmDashboard';
import LogAnalyzer from './pages/LogAnalyzer';
import Settings from './settings';
import Home from './pages/Dashboard';
import AIAdvisory from './pages/AIAdvisory';
import PostgrePA from './postgrepa';
import MssqlPA from './mssqlpa';
import MongoPA from './mongopa';
import Reports from './pages/Reports';
import Jobs from './pages/Jobs';
import PerformanceAnalyzer from './pages/PerformanceAnalyzer';

// Store
import { setAuth, logout } from './store/authSlice';
import { isTokenExpired } from './utils/tokenUtils';
import { RootState } from './redux/store';

const queryClient = new QueryClient();

// Create a wrapper component to handle auth checks
const AuthCheck: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const dispatch = useDispatch();
    const navigate = useNavigate();

    useEffect(() => {
        const checkTokenExpiration = () => {
            const token = localStorage.getItem('token');
            const user = JSON.parse(localStorage.getItem('user') || 'null');
            
            if (token && user) {
                if (isTokenExpired()) {
                    dispatch(logout());
                    message.error('Session expired. Please login again.');
                    navigate('/login');
                } else {
                    dispatch(setAuth({
                        isLoggedIn: true,
                        user: user
                    }));
                }
            }
        };

        checkTokenExpiration();
        const interval = setInterval(checkTokenExpiration, 60000);
        return () => clearInterval(interval);
    }, [dispatch, navigate]);

    return <>{children}</>;
};

// Protected Layout component that includes the MainLayout
const ProtectedLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isLoggedIn } = useSelector((state: RootState) => state.auth);
    
    if (!isLoggedIn) {
        return <Navigate to="/login" replace />;
    }

    return <MainLayout>{children}</MainLayout>;
};

const App: React.FC = () => {
    const { isLoggedIn } = useSelector((state: RootState) => state.auth);

    return (
        <QueryClientProvider client={queryClient}>
            <Router>
                <AuthCheck>
                    <Routes>
                        {/* Public route */}
                        <Route 
                            path="/login" 
                            element={isLoggedIn ? <Navigate to="/" replace /> : <Login />} 
                        />

                        {/* Protected routes */}
                        <Route path="/" element={<ProtectedLayout><Home /></ProtectedLayout>} />
                        <Route path="/home" element={<ProtectedLayout><Home /></ProtectedLayout>} />
                        <Route path="/dashboard" element={<ProtectedLayout><Dashboard /></ProtectedLayout>} />
                        <Route path="/logs" element={<ProtectedLayout><LogAnalyzer /></ProtectedLayout>} />
                        <Route path="/alarms" element={<ProtectedLayout><AlarmDashboard /></ProtectedLayout>} />
                        <Route path="/jobs" element={<ProtectedLayout><Jobs /></ProtectedLayout>} />
                        <Route path="/reports" element={<ProtectedLayout><Reports /></ProtectedLayout>} />
                        <Route path="/settings" element={<ProtectedLayout><Settings /></ProtectedLayout>} />
                        <Route path="/queryanalyzer" element={<ProtectedLayout><QueryAnalyzer /></ProtectedLayout>} />
                        <Route path="/aiadvisory" element={<ProtectedLayout><AIAdvisory /></ProtectedLayout>} />
                        <Route path="/postgrepa" element={<ProtectedLayout><PostgrePA /></ProtectedLayout>} />
                        <Route path="/mssqlpa" element={<ProtectedLayout><MssqlPA /></ProtectedLayout>} />
                        <Route path="/mongopa" element={<ProtectedLayout><MongoPA /></ProtectedLayout>} />
                        <Route path="/performance-analyzer" element={<ProtectedLayout><PerformanceAnalyzer /></ProtectedLayout>} />
                        {/* Catch all route */}
                        <Route
                            path="*"
                            element={
                                isLoggedIn ? (
                                    <Navigate to="/" replace />
                                ) : (
                                    <Navigate to="/login" replace />
                                )
                            }
                        />
                    </Routes>
                </AuthCheck>
            </Router>
        </QueryClientProvider>
    );
};

export default App;