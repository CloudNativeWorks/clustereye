import React, { useEffect, useState } from 'react';
import { Layout, Space, Badge } from 'antd';
import Sidebar from './Sidebar';
import UserProfile from '../components/UserProfile';

import GlobalAlarmNotification from '../components/GlobalAlarmNotification';
import AlarmBadge from '../components/AlarmBadge';
import { AlertOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { setSelectedMenuItem } from '../redux/menuSlice';
import axios from 'axios';
import { RootState } from '../redux/store';

const { Content, Header, Footer } = Layout;

interface MainLayoutProps {
    children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const [jobCount, setJobCount] = useState(0);
    const collapsed = useSelector((state: RootState) => state.sidebar.collapsed);

    // Fetch job count
    useEffect(() => {
        const fetchJobCount = async () => {
            try {
                const token = localStorage.getItem('token');
                const response = await axios.get(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/jobs`, {
                    withCredentials: true,
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    }
                });

                if (response.data?.data?.jobs && Array.isArray(response.data.data.jobs)) {
                    // Filter out COMPLETED jobs (status 3 or "JOB_STATUS_COMPLETED")
                    const activeJobs = (response.data.data.jobs || []).filter((job: { status: any }) => {
                        // Check both numeric status (3) and string status ("JOB_STATUS_COMPLETED")
                        return job.status !== 3 && job.status !== "JOB_STATUS_COMPLETED" && 
                               job.status !== "COMPLETED" && job.status?.toLowerCase?.() !== "completed";
                    });
                    
                    // Set count to active jobs only
                    setJobCount((activeJobs || []).length);
                } else {
                    setJobCount(0);
                }
            } catch (error) {
                console.error('Error fetching jobs:', error);
                setJobCount(0);
            }
        };

        fetchJobCount();
        // Refresh job count every 30 seconds
        const intervalId = setInterval(fetchJobCount, 30000);
        
        return () => clearInterval(intervalId);
    }, []);

    const handleJobClick = () => {
        dispatch(setSelectedMenuItem('jobs'));
        navigate('/jobs');
    };

    return (
        <Layout style={{ minHeight: '100vh' }}>
            <Sidebar onCollapse={(value) => {}} />
            <Layout style={{ 
                marginLeft: collapsed ? 80 : 230,
                transition: 'all 0.2s ease'
            }}>
                <Header 
                    style={{
                        padding: '0 24px',
                        background: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        boxShadow: '0 1px 4px rgba(0, 0, 0, 0.03)',
                        height: '64px',
                        position: 'sticky',
                        top: 0,
                        zIndex: 1,
                        width: '100%',
                        transition: 'all 0.2s ease'
                    }}
                >
                    <Space size="middle">
                       
                        <AlarmBadge />
                        <Badge count={jobCount} overflowCount={99} style={{ marginRight: '5px', marginTop: '8px' }}>
                            <ClockCircleOutlined 
                                className="header-job-icon"
                                style={{ fontSize: '20px', cursor: 'pointer', marginRight: '3px', marginTop: '35px' }} 
                                onClick={handleJobClick}
                            />
                        </Badge>
                        <UserProfile />
                    </Space>
                </Header>
                <Content 
                    style={{ 
                        margin: '24px 16px', 
                        padding: 24, 
                        minHeight: 280,
                        background: '#fff',
                        borderRadius: '8px',
                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
                        transition: 'all 0.2s'
                    }}
                >
                    {children}
                    <GlobalAlarmNotification />
                </Content>
                <Footer
                    style={{
                        textAlign: 'center',
                        background: 'transparent',
                        color: 'rgba(0, 0, 0, 0.6)',
                        padding: '16px',
                        fontSize: '12px',
                        transition: 'all 0.2s'
                    }}
                >
                    <div>© Copyright ClusterEye 2025 All Rights Reserved.</div>
                    <div style={{ marginTop: '4px', color: 'rgba(0, 0, 0, 0.45)' }}>
                        API Version: 1.0.8, Agent Version: 1.0.35
                    </div>
                </Footer>
            </Layout>
        </Layout>
    );
};

export default MainLayout; 