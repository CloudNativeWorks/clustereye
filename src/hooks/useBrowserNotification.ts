import { useEffect, useState } from 'react';

interface NotificationOptions {
    title: string;
    body: string;
    icon?: string;
    tag?: string;
    requireInteraction?: boolean;
}

export const useBrowserNotification = () => {
    const [permission, setPermission] = useState<NotificationPermission>('default');

    useEffect(() => {
        if ('Notification' in window) {
            setPermission(Notification.permission);
        }
    }, []);

    const requestPermission = async (): Promise<NotificationPermission> => {
        if (!('Notification' in window)) {
            console.warn('This browser does not support notifications');
            return 'denied';
        }

        const result = await Notification.requestPermission();
        setPermission(result);
        return result;
    };

    const showNotification = (options: NotificationOptions): Notification | null => {
        if (!('Notification' in window)) {
            console.warn('This browser does not support notifications');
            return null;
        }

        if (permission !== 'granted') {
            console.warn('Notification permission not granted');
            return null;
        }

        const notification = new Notification(options.title, {
            body: options.body,
            icon: options.icon || '/clustereye_logo.png',
            tag: options.tag || 'clustereye-alarm',
            requireInteraction: options.requireInteraction || false,
            badge: '/clustereye_logo.png'
        });

        // Auto close after 10 seconds if not requiring interaction
        if (!options.requireInteraction) {
            setTimeout(() => {
                notification.close();
            }, 10000);
        }

        return notification;
    };

    const showAlarmNotification = (severity: 'critical' | 'warning' | 'info', count: number, message?: string) => {
        const titles = {
            critical: '🚨 Critical Alarm!',
            warning: '⚠️ Warning Alarm',
            info: 'ℹ️ Info Alarm'
        };

        const bodies = {
            critical: `${count} critical alarm(s) detected! Immediate attention required.`,
            warning: `${count} warning alarm(s) detected. Please review.`,
            info: `${count} new alarm(s) detected.`
        };

        return showNotification({
            title: titles[severity],
            body: message || bodies[severity],
            requireInteraction: severity === 'critical',
            tag: `alarm-${severity}`
        });
    };

    return {
        permission,
        requestPermission,
        showNotification,
        showAlarmNotification,
        isSupported: 'Notification' in window
    };
};

export default useBrowserNotification; 