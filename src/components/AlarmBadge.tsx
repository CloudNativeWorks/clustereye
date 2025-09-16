import React, { useEffect, useState } from 'react';
import { Badge, Button, Tooltip } from 'antd';
import { AlertOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import dayjs from 'dayjs';

const AlarmBadge: React.FC = () => {
    const [alarmCount, setAlarmCount] = useState(0);
    const [criticalCount, setCriticalCount] = useState(0);
    const navigate = useNavigate();
    const location = useLocation();
    
    const isOnAlarmPage = location.pathname === '/alarms' || location.pathname === '/';

    const fetchAlarmCount = async () => {
        try {

            const params = new URLSearchParams({
                date_from: dayjs().subtract(24, 'hours').format('YYYY-MM-DD HH:mm:ss'),
                date_to: dayjs().format('YYYY-MM-DD HH:mm:ss'),
                page: '1',
                limit: '1', // We only need the count
                unacknowledged: 'true'
            });

            const token = localStorage.getItem('token');
            const response = await axios.get(
                `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/status/alarms?${params.toString()}`,
                { 
                    withCredentials: true,
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    }
                }
            );

            if (response.data?.data?.pagination) {
                const totalCount = response.data.data.pagination.total_count || 0;
                setAlarmCount(totalCount);
                
                // Get critical alarms count
                if (totalCount > 0) {
                    const criticalParams = new URLSearchParams({
                        date_from: dayjs().subtract(24, 'hours').format('YYYY-MM-DD HH:mm:ss'),
                        date_to: dayjs().format('YYYY-MM-DD HH:mm:ss'),
                        page: '1',
                        limit: '1',
                        unacknowledged: 'true',
                        severity: 'critical'
                    });

                    const criticalResponse = await axios.get(
                        `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/status/alarms?${criticalParams.toString()}`,
                        { 
                            withCredentials: true,
                            headers: {
                                'Content-Type': 'application/json',
                                'Accept': 'application/json',
                                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                            }
                        }
                    );

                    if (criticalResponse.data?.data?.pagination) {
                        setCriticalCount(criticalResponse.data.data.pagination.total_count || 0);
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching alarm count:', error);
        }
    };

    useEffect(() => {
        // Initial fetch
        fetchAlarmCount();

        // Update every 30 seconds
        const interval = setInterval(fetchAlarmCount, 30000);

        return () => clearInterval(interval);
    }, []);

    const getBadgeColor = () => {
        if (criticalCount > 0) return '#ff4d4f'; // Red for critical
        if (alarmCount > 0) return '#faad14'; // Orange for warnings
        return '#52c41a'; // Green for no alarms
    };

    const getTooltipText = () => {
        if (alarmCount === 0) return 'No active alarms';
        if (criticalCount > 0) {
            return `${alarmCount} total alarms (${criticalCount} critical)`;
        }
        return `${alarmCount} active alarms`;
    };

    return (
        <Tooltip title={getTooltipText()}>
            <Badge 
                count={alarmCount} 
                overflowCount={999}
                offset={[0, 22]}
                style={{ 
                    backgroundColor: getBadgeColor(),
                    boxShadow: criticalCount > 0 ? '0 0 10px rgba(255, 77, 79, 0.5)' : undefined
                }}
            >
                <AlertOutlined
                    onClick={() => navigate('/alarms')}
                    style={{
                        fontSize: '20px',
                        cursor: 'pointer',
                        color: criticalCount > 0 ? '#ff4d4f' : '#666',
                        marginTop: '33px'
                    }}
                />
            </Badge>
        </Tooltip>
    );
};

export default AlarmBadge; 