import React, { useState } from 'react';
import { Form, Input, Button, Card, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { login } from '../redux/authSlice';
import axios from 'axios';
import TwoFactorAuth from '../components/TwoFactorAuth';
import AINetworkBackground from '../components/AINetworkBackground';

const Login: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [twoFactorVisible, setTwoFactorVisible] = useState(false);
    const [pendingUser, setPendingUser] = useState<any>(null);
    const [pendingCredentials, setPendingCredentials] = useState<{username: string, password: string} | null>(null);
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const onFinish = async (values: { username: string; password: string }) => {
        setLoading(true);
        try {
            const response = await axios.post(
                `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/login`,
                values,
                { withCredentials: true }
            );

            if (response.data.success) {
                const { token, user, requires2FA } = response.data;
                
                // Convert string "false" to boolean false for admin status
                const processedUser = {
                    ...user,
                    isAdmin: user.admin === "true",  // Convert string to boolean
                    role: user.admin === "true" ? "admin" : "user"  // Add role based on admin status
                };

                // Check if 2FA is required
                if (requires2FA) {
                    setPendingCredentials(values);
                    setTwoFactorVisible(true);
                    message.info('Please enter your 2FA code to complete login');
                } else {
                    // Complete login without 2FA
                    completeLogin(token, processedUser);
                }
            } else {
                message.error('Login failed: ' + (response.data.message || 'Unknown error'));
            }
        } catch (error: any) {
            console.error('Login error:', error);
            
            // Check if this is a 2FA required error
            if (error.response?.data?.requires_2fa) {
                setPendingCredentials(values);
                setTwoFactorVisible(true);
                message.info('Please enter your 2FA code to complete login');
                return;
            }
            
            const errorMessage = error.response?.data?.message || 
                               error.response?.data?.detail || 
                               error.message ||
                               'Login failed. Please try again.';
            message.error(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const completeLogin = (token: string, user: any) => {
        // Store token and user info
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        
        // Update Redux state
        dispatch(login({ token, user }));
        
        message.success('Login successful!');
        navigate('/dashboard');
    };

    const handle2FASuccess = async (code?: string) => {
        if (pendingCredentials && code) {
            // Verify 2FA code for login
            try {
                const response = await axios.post(
                    `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/login`,
                    {
                        username: pendingCredentials.username,
                        password: pendingCredentials.password,
                        twofa_code: code
                    },
                    { withCredentials: true }
                );

                if (response.data.success) {
                    const { token, user } = response.data;
                    const processedUser = {
                        ...user,
                        isAdmin: user.admin === "true",
                        role: user.admin === "true" ? "admin" : "user"
                    };
                    completeLogin(token, processedUser);
                } else {
                    message.error('Invalid 2FA code');
                    return;
                }
            } catch (error: any) {
                console.error('2FA verification error:', error);
                message.error('Invalid 2FA code. Please try again.');
                return;
            }
        }
        setTwoFactorVisible(false);
        setPendingCredentials(null);
    };

    const handle2FACancel = () => {
        setTwoFactorVisible(false);
        setPendingCredentials(null);
        message.info('Login cancelled');
    };

    return (
        <div style={{
            height: '100vh',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #334155 100%)',
            position: 'relative',
            overflow: 'hidden'
        }}>
            <AINetworkBackground />
            <Card
                style={{
                    width: 400,
                    padding: '24px',
                    borderRadius: '12px',
                    boxShadow: '0 8px 32px rgba(59, 130, 246, 0.3), 0 0 64px rgba(147, 51, 234, 0.2)',
                    background: 'rgba(30, 41, 59, 0.9)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(59, 130, 246, 0.2)',
                    zIndex: 10,
                    position: 'relative'
                }}
                bordered={false}
            >
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <img 
                        src="/clustereye_logo.png"
                        width={220} 
                        height={110} 
                        alt="ClusterEye" 
                        style={{ 
                            objectFit: 'contain',
                            marginBottom: '1px'
                                                }} 
                    />
                    <p style={{ 
                        color: '#ffffff',
                        fontSize: '14px'
                    }}>
                        Sign in to your account
                    </p>
                </div>

                <Form
                    name="login"
                    onFinish={onFinish}
                    layout="vertical"
                    size="large"
                >
                    <Form.Item
                        name="username"
                        rules={[{ required: true, message: 'Please input your username!' }]}
                        style={{ marginBottom: '16px' }}
                        label={<span style={{ color: 'white' }}>Username</span>}
                    >
                        <Input
                            prefix={<UserOutlined style={{ color: '#bfbfbf' }} />}
                            placeholder="Username"
                            style={{ backgroundColor: 'rgba(255, 255, 255, 0.9)' }}
                        />
                    </Form.Item>

                    <Form.Item
                        name="password"
                        rules={[{ required: true, message: 'Please input your password!' }]}
                        style={{ marginBottom: '24px' }}
                        label={<span style={{ color: 'white' }}>Password</span>}
                    >
                        <Input.Password
                            prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
                            placeholder="Password"
                            style={{ backgroundColor: 'rgba(255, 255, 255, 0.9)' }}
                        />
                    </Form.Item>

                    <Form.Item>
                        <Button
                            type="primary"
                            htmlType="submit"
                            loading={loading}
                            style={{
                                width: '100%',
                                height: '40px',
                                fontSize: '16px',
                                background: 'linear-gradient(135deg, #3B82F6 0%, #9333EA 100%)',
                                border: 'none',
                                color: 'white',
                                fontWeight: 'bold',
                                borderRadius: '6px',
                                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
                            }}
                        >
                            Sign In
                        </Button>
                    </Form.Item>
                </Form>
            </Card>

            <TwoFactorAuth
                visible={twoFactorVisible}
                onCancel={handle2FACancel}
                onSuccess={handle2FASuccess}
                mode="verify"
                username={pendingCredentials?.username}
            />
        </div>
    );
};

export default Login;    