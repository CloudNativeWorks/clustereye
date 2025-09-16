import React, { useEffect, useState } from 'react';
import { notification } from 'antd';
import { AlertOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import dayjs from 'dayjs';


interface AlarmNotification {
    id: string;
    severity: 'critical' | 'warning' | 'info';
    message: string;
    timestamp: string;
    host: string;
    type: string;
}

const GlobalAlarmNotification: React.FC = () => {
    const [lastCheckTime, setLastCheckTime] = useState<dayjs.Dayjs>(dayjs());
    const [shownAlarmIds, setShownAlarmIds] = useState<Set<string>>(new Set());
    const navigate = useNavigate();
    const location = useLocation();

    
    // Check if we're on the alarm dashboard page
    const isOnAlarmPage = location.pathname === '/alarms' || location.pathname === '/';

    const checkForNewAlarms = async () => {
        try {
            // Only check if not on alarm page
            if (isOnAlarmPage) {
                return;
            }

            // Use recent endpoint to get only the latest alarms
            const token = localStorage.getItem('token');
            const response = await axios.get(
                `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/status/alarms/recent?limit=4&unacknowledged=true`,
                { withCredentials: true,
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    }
                }
            );

            if (response.data?.data?.alarms && Array.isArray(response.data.data.alarms)) {
                const recentAlarms = response.data.data.alarms;

                
                // Filter out alarms we've already shown notifications for
                const newAlarms = recentAlarms.filter((alarm: any) => !shownAlarmIds.has(alarm.event_id));
                
                // Only show notifications for critical alarms
                const newCriticalAlarms = newAlarms.filter((alarm: any) => alarm.severity === 'critical');
                
                if (newCriticalAlarms.length > 0) {
                    // Mark these critical alarms as shown to prevent duplicate notifications
                    const newAlarmIds = new Set(shownAlarmIds);
                    newCriticalAlarms.forEach((alarm: any) => {
                        newAlarmIds.add(alarm.event_id);
                    });
                    setShownAlarmIds(newAlarmIds);
                    
                    // Show notification for critical alarms only
                    notification.error({
                        message: 'Critical Alarm Detected!',
                        description: `${newCriticalAlarms.length} critical alarm(s) detected. Click to view details.`,
                        icon: <AlertOutlined style={{ color: '#ff4d4f' }} />,
                        duration: 10, // Auto-close after 10 seconds
                        onClick: () => {
                            navigate('/alarms');
                        },
                        style: {
                            cursor: 'pointer'
                        }
                    });
                }
                
                setLastCheckTime(dayjs());
            }
        } catch (error) {
            console.error('Error checking for new alarms:', error);
        }
    };



    useEffect(() => {
        // Reset counter and shown alarms when navigating to alarm page
        if (isOnAlarmPage) {
            setShownAlarmIds(new Set()); // Clear shown alarm IDs when user visits alarm page
            return;
        }

        // Initial check after 5 seconds
        const initialTimeout = setTimeout(() => {
            checkForNewAlarms();
        }, 5000);

        // Check every 30 seconds
        const interval = setInterval(() => {
            checkForNewAlarms();
        }, 30000);

        return () => {
            clearTimeout(initialTimeout);
            clearInterval(interval);
        };
    }, [isOnAlarmPage, lastCheckTime]);

    // Don't render anything if on alarm page or no new alarms
    if (isOnAlarmPage) {
        return null;
    }

    // No floating button needed, just notifications
    return null;
};

export default GlobalAlarmNotification; 