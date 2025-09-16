import React, { useState, useEffect } from 'react';
import { Card, Tabs, Form, Input, Button, Switch, message, Space, Table, Typography, Divider, Select, Modal, InputNumber, Row, Col, Collapse, Tag, Alert } from 'antd';
import { SettingOutlined, UserOutlined, BellOutlined, SlackOutlined, MailOutlined, PlusOutlined, EditOutlined, DeleteOutlined, WarningOutlined, DashboardOutlined, DatabaseOutlined, CloudServerOutlined, CodeOutlined, SafetyOutlined, QrcodeOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/lib/table';
import TwoFactorAuth from './components/TwoFactorAuth';

const { Title, Text } = Typography;
const { TabPane } = Tabs;
const { Panel } = Collapse;

interface User {
    id: string;
    username: string;
    email: string;
    isAdmin: boolean;
    isActive: boolean;
}

interface NotificationSettings {
    slackWebhookUrl: string;
    slackEnabled: boolean;
    emailEnabled: boolean;
    emailServer: string;
    emailPort: string;
    emailUser: string;
    emailPassword: string;
    emailFrom: string;
    emailRecipients: string[];
}

interface ThresholdSettings {
    id?: number;
    cpu_threshold: number;
    memory_threshold: number;
    disk_threshold: number;
    connection_threshold: number;
    slow_query_threshold_ms: number;
    replication_lag_threshold: number;
    blocking_query_threshold_ms: number;
}

interface AgentStatus {
    id: string;
    status: string;
    connection: string;
    hostname: string;
    ip: string;
    lastSeen: string;
}

interface AgentVersion {
    agentID: string;
    version: string;
    platform: string;
    architecture: string;
    hostname: string;
    osVersion: string;
    goVersion: string;
    reportedAt: string;
    createdAt: string;
    updatedAt: string;
    status?: string;
    connection?: string;
    ip?: string;
    lastSeen?: string;
}

// Lisans bilgileri için yeni interfaceler
interface LicenseAgent {
    hostname: string;
    agent_id: string;
}

interface License {
    id: number;
    company_name: string;
    agent_key: string;
    expiration_date: string;
    created_at: string;
    updated_at: string;
    agents: LicenseAgent[];
}

interface LicenseResponse {
    status: string;
    data: {
        licenses: License[];
    };
}

const Settings: React.FC = () => {
    // State for user management
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [userModalVisible, setUserModalVisible] = useState(false);
    const [currentUser, setCurrentUser] = useState<User | null>(null);

    // State for notification settings
    const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
        slackWebhookUrl: '',
        slackEnabled: false,
        emailEnabled: false,
        emailServer: '',
        emailPort: '',
        emailUser: '',
        emailPassword: '',
        emailFrom: '',
        emailRecipients: []
    });

    // State for threshold settings
    const [thresholdSettings, setThresholdSettings] = useState<ThresholdSettings>({
        cpu_threshold: 80,
        memory_threshold: 80,
        disk_threshold: 85,
        connection_threshold: 100,
        slow_query_threshold_ms: 1000,
        replication_lag_threshold: 300,
        blocking_query_threshold_ms: 1000
    });

    // State for licenses
    const [licenses, setLicenses] = useState<License[]>([]);
    const [licensesLoading, setLicensesLoading] = useState(false);

    const [agentVersions, setAgentVersions] = useState<AgentVersion[]>([]);
    const [versionsLoading, setVersionsLoading] = useState(false);
    const [agentStatuses, setAgentStatuses] = useState<Record<string, AgentStatus>>({});

    // State for 2FA
    const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
    const [twoFactorModalVisible, setTwoFactorModalVisible] = useState(false);
    const [twoFactorLoading, setTwoFactorLoading] = useState(false);

    // Form instances
    const [slackForm] = Form.useForm();
    const [emailForm] = Form.useForm();
    const [userForm] = Form.useForm();
    const [thresholdForm] = Form.useForm();

    // Define columns for agent versions table
    const agentVersionColumns: ColumnsType<AgentVersion> = [
        {
            title: 'Agent ID',
            dataIndex: 'agentID',
            key: 'agentID',
            width: 220,
            sorter: (a: AgentVersion, b: AgentVersion) => a.agentID.localeCompare(b.agentID)
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            width: 120,
            render: (_, record) => {
                const status = agentStatuses[record.agentID]?.status || 'unknown';
                const connection = agentStatuses[record.agentID]?.connection;
                const color = status === 'connected' ? 'green' : status === 'disconnected' ? 'red' : 'gray';
                return (
                    <Space>
                        <Tag color={color}>{status}</Tag>
                        {connection && <Tag color="blue">{connection}</Tag>}
                    </Space>
                );
            },
            filters: [
                { text: 'Connected', value: 'connected' },
                { text: 'Disconnected', value: 'disconnected' },
                { text: 'Unknown', value: 'unknown' }
            ],
            onFilter: (value, record) => (agentStatuses[record.agentID]?.status || 'unknown') === value
        },
        {
            title: 'Version',
            dataIndex: 'version',
            key: 'version',
            width: 100,
            render: (version: string) => (
                <Tag color="blue">{version}</Tag>
            )
        },
        {
            title: 'Platform',
            dataIndex: 'platform',
            key: 'platform',
            width: 100,
            filters: Array.from(new Set(agentVersions.map(av => av.platform))).map(platform => ({
                text: platform,
                value: platform
            })),
            onFilter: (value: any, record: AgentVersion) => record.platform === value
        },
        {
            title: 'Architecture',
            dataIndex: 'architecture',
            key: 'architecture',
            width: 100,
            filters: Array.from(new Set(agentVersions.map(av => av.architecture))).map(arch => ({
                text: arch,
                value: arch
            })),
            onFilter: (value: any, record: AgentVersion) => record.architecture === value
        },
        {
            title: 'Hostname',
            dataIndex: 'hostname',
            key: 'hostname',
            width: 150,
            sorter: (a: AgentVersion, b: AgentVersion) => a.hostname.localeCompare(b.hostname)
        },
        {
            title: 'IP Address',
            key: 'ip',
            width: 150,
            render: (_, record) => agentStatuses[record.agentID]?.ip || '-'
        },
        {
            title: 'OS Version',
            dataIndex: 'osVersion',
            key: 'osVersion',
            width: 150
        },
        {
            title: 'Last Seen',
            key: 'lastSeen',
            width: 180,
            render: (_, record) => {
                const lastSeen = agentStatuses[record.agentID]?.lastSeen;
                return lastSeen ? formatDateTime(lastSeen) : '-';
            },
            sorter: (a, b) => {
                const aLastSeen = agentStatuses[a.agentID]?.lastSeen || '';
                const bLastSeen = agentStatuses[b.agentID]?.lastSeen || '';
                return new Date(aLastSeen).getTime() - new Date(bLastSeen).getTime();
            }
        }
    ];

    // Fetch current user and users
    useEffect(() => {
        fetchCurrentUser();
        fetchUsers();
        fetch2FAStatus();
        
        // Only fetch these if user is admin
        const userJson = localStorage.getItem('user');
        if (userJson) {
            const userData = JSON.parse(userJson);
            const isAdmin = userData.admin === "true" || userData.role === "admin";
            
            if (isAdmin) {
                fetchNotificationSettings();
                fetchThresholdSettings();
                fetchAgentVersions();
                fetchAgentStatuses();
                fetchLicenses();

                // Optional: Set up periodic refresh for agent statuses
                const statusInterval = setInterval(fetchAgentStatuses, 30000);
                return () => clearInterval(statusInterval);
            }
        }
    }, []);

    const fetchCurrentUser = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('Authorization token not found');
            }

            // Get user info from localStorage
            const userJson = localStorage.getItem('user');
            if (!userJson) {
                throw new Error('User information not found in localStorage');
            }

            const userData = JSON.parse(userJson);
            
            setCurrentUser({
                id: userData.username, // Using username as temporary id
                username: userData.username,
                email: userData.email,
                isAdmin: userData.admin === "true" || userData.role === "admin",
                isActive: true // Assuming the user is active if they're logged in
            });

        } catch (error) {
            console.error('Error setting current user:', error);
            message.error('Failed to set current user information');
        }
    };

    const fetch2FAStatus = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;

            const response = await fetch(
                `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/2fa/status`,
                {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include'
                }
            );

            if (response.ok) {
                const data = await response.json();
                setTwoFactorEnabled(data.enabled || false);
            }
        } catch (error) {
            console.error('Error fetching 2FA status:', error);
        }
    };

    const handle2FAToggle = async (enabled: boolean) => {
        if (enabled) {
            // Show setup modal
            setTwoFactorModalVisible(true);
        } else {
            // Disable 2FA
            Modal.confirm({
                title: 'Disable Two-Factor Authentication',
                content: 'Are you sure you want to disable 2FA? This will make your account less secure.',
                okText: 'Disable 2FA',
                okType: 'danger',
                cancelText: 'Cancel',
                onOk: async () => {
                    await disable2FA();
                }
            });
        }
    };

    const disable2FA = async () => {
        setTwoFactorLoading(true);
        try {
            const token = localStorage.getItem('token');
            
            // Get user's password for verification
            const userJson = localStorage.getItem('user');
            if (!userJson) {
                throw new Error('User information not found');
            }
            
            // For now, we'll prompt for password. In production, you might want a proper modal
            const password = prompt('Please enter your password to disable 2FA:');
            if (!password) {
                setTwoFactorLoading(false);
                return;
            }
            
            const response = await fetch(
                `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/2fa/disable`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify({ password })
                }
            );

            if (response.ok) {
                setTwoFactorEnabled(false);
                message.success('Two-factor authentication has been disabled');
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to disable 2FA');
            }
        } catch (error) {
            console.error('Error disabling 2FA:', error);
            message.error('Failed to disable 2FA. Please try again.');
        } finally {
            setTwoFactorLoading(false);
        }
    };

    const handle2FASetupSuccess = () => {
        setTwoFactorEnabled(true);
        setTwoFactorModalVisible(false);
        fetch2FAStatus(); // Refresh status
    };

    const handle2FASetupCancel = () => {
        setTwoFactorModalVisible(false);
    };

    const fetchUsers = async () => {
        setLoading(true);

        try {
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('Authorization token not found');
            }

            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/users`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Error fetching users: ${response.status}`);
            }

            const data = await response.json();
            let formattedUsers: User[] = [];

            if (data.success && Array.isArray(data.users)) {
                formattedUsers = data.users.map((user: any) => ({
                    id: String(user.id),
                    username: user.username,
                    email: user.email,
                    isAdmin: user.admin === "true" || user.admin === true,
                    isActive: user.status === "active"
                }));

                // If user is not admin, filter to show only their own information
                const userJson = localStorage.getItem('user');
                if (userJson) {
                    const userData = JSON.parse(userJson);
                    const isAdmin = userData.admin === "true" || userData.role === "admin";
                    
                    if (!isAdmin) {
                        formattedUsers = formattedUsers.filter(user => user.username === userData.username);
                    }
                }
            }

            setUsers(formattedUsers);
        } catch (error) {
            console.error('Error fetching users:', error);
            message.error('Failed to fetch users');
        } finally {
            setLoading(false);
        }
    };

    const handleFetchError = (error: any, context: string) => {
        console.error(`Error ${context}:`, error);
        if (error.message.includes('403')) {
            message.error('You do not have permission to access this resource');
        } else {
            message.error(`Unable to fetch ${context}. Please try again later.`);
        }
    };

    const fetchNotificationSettings = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('Authorization token not found');
            }

            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/notification-settings`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Error fetching notification settings: ${response.status}`);
            }

            const data = await response.json();

            // API yanıtını uygun formata dönüştürüyoruz
            const formattedSettings = {
                slackWebhookUrl: data.settings?.slackWebhookUrl || '',
                slackEnabled: data.settings?.slackEnabled || false,
                emailEnabled: data.settings?.emailEnabled || false,
                emailServer: data.settings?.emailServer || '',
                emailPort: data.settings?.emailPort || '',
                emailUser: data.settings?.emailUser || '',
                emailPassword: data.settings?.emailPassword || '',
                emailFrom: data.settings?.emailFrom || '',
                emailRecipients: Array.isArray(data.settings?.emailRecipients) ? data.settings.emailRecipients : []
            };

            // Tüm değerlerin boş olup olmadığını kontrol et
            const hasData = Object.entries(formattedSettings).some(([key, value]) => {
                // Boolean değerleri kontrol etme
                if (typeof value === 'boolean') return false;
                // Array kontrolü
                if (Array.isArray(value)) return value.length > 0;
                // String kontrolü
                return value !== '';
            });


            setNotificationSettings(formattedSettings);

            // Form değerlerini güncelle
            slackForm.setFieldsValue({
                slackWebhookUrl: formattedSettings.slackWebhookUrl,
                slackEnabled: formattedSettings.slackEnabled
            });

            emailForm.setFieldsValue({
                emailEnabled: formattedSettings.emailEnabled,
                emailServer: formattedSettings.emailServer,
                emailPort: formattedSettings.emailPort,
                emailUser: formattedSettings.emailUser,
                emailPassword: formattedSettings.emailPassword,
                emailFrom: formattedSettings.emailFrom,
                emailRecipients: formattedSettings.emailRecipients
            });

            // API'den veri gelmezse veya geliştirme aşamasındaysak örnek veri göster
            if (!hasData) {
                console.log('No notification settings found in API response');

                const sampleSettings = {
                    slackWebhookUrl: 'https://hooks.slack.com/services/TXXXXXX/BXXXXXX/XXXXXXXXXX',
                    slackEnabled: true,
                    emailEnabled: false,
                    emailServer: 'smtp.example.com',
                    emailPort: '587',
                    emailUser: 'alerts@example.com',
                    emailPassword: '********',
                    emailFrom: 'alerts@example.com',
                    emailRecipients: ['admin@example.com', 'team@example.com']
                };

                setNotificationSettings(sampleSettings);

                slackForm.setFieldsValue({
                    slackWebhookUrl: sampleSettings.slackWebhookUrl,
                    slackEnabled: sampleSettings.slackEnabled
                });

                emailForm.setFieldsValue({
                    emailEnabled: sampleSettings.emailEnabled,
                    emailServer: sampleSettings.emailServer,
                    emailPort: sampleSettings.emailPort,
                    emailUser: sampleSettings.emailUser,
                    emailPassword: sampleSettings.emailPassword,
                    emailFrom: sampleSettings.emailFrom,
                    emailRecipients: sampleSettings.emailRecipients
                });
            }
        } catch (error) {
            handleFetchError(error, 'notification settings');
        }
    };

    const fetchThresholdSettings = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('Authorization token not found. Please log in again.');
            }

            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/threshold-settings`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Error fetching threshold settings: ${response.status} - ${response.statusText}`);
            }

            const responseData = await response.json();

            if (responseData.status === "success" && responseData.data) {
                const settings = responseData.data;
                setThresholdSettings(settings);
                thresholdForm.setFieldsValue(settings);
            } else {
                throw new Error('Invalid response format from server');
            }
        } catch (error) {
            handleFetchError(error, 'threshold settings');
        }
    };

    const fetchAgentVersions = async () => {
        try {
            setVersionsLoading(true);
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('Authorization token not found. Please log in again.');
            }

            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/agents/versions`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Error fetching agent versions: ${response.status} - ${response.statusText}`);
            }

            const responseData = await response.json();

            if (responseData.status === "success" && Array.isArray(responseData.data.versions)) {
                // Map snake_case to camelCase
                const formattedVersions = responseData.data.versions.map((version: any) => ({
                    agentID: version.agent_id,
                    version: version.version,
                    platform: version.platform,
                    architecture: version.architecture,
                    hostname: version.hostname,
                    osVersion: version.os_version,
                    goVersion: version.go_version,
                    reportedAt: version.reported_at,
                    createdAt: version.created_at,
                    updatedAt: version.updated_at
                }));

                setAgentVersions(formattedVersions);
            } else {
                console.warn('Invalid response format or empty versions array:', responseData);
                setAgentVersions([]);
            }
        } catch (error) {
            handleFetchError(error, 'agent versions');
        } finally {
            setVersionsLoading(false);
        }
    };

    const fetchAgentStatuses = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('Authorization token not found. Please log in again.');
            }

            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/status/agents`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Error fetching agent statuses: ${response.status} - ${response.statusText}`);
            }

            const responseData = await response.json();

            if (responseData.status === "success" && Array.isArray(responseData.data.agents)) {
                // Convert array to object with agent ID as key for easier lookup
                const statusMap = responseData.data.agents.reduce((acc: Record<string, AgentStatus>, agent: any) => {
                    acc[agent.id] = {
                        id: agent.id,
                        status: agent.status,
                        connection: agent.connection,
                        hostname: agent.hostname,
                        ip: agent.ip,
                        lastSeen: agent.last_seen
                    };
                    return acc;
                }, {});

                setAgentStatuses(statusMap);
            }
        } catch (error) {
            handleFetchError(error, 'agent statuses');
        }
    };

    // Lisans bilgilerini getir
    const fetchLicenses = async () => {
        try {
            setLicensesLoading(true);
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('Authorization token not found. Please log in again.');
            }

            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/licenses`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Error fetching licenses: ${response.status} - ${response.statusText}`);
            }

            const responseData = await response.json() as LicenseResponse;

            if (responseData.status === "success" && Array.isArray(responseData.data.licenses)) {
                setLicenses(responseData.data.licenses);
            } else {
                console.warn('Invalid response format or empty licenses array:', responseData);
                setLicenses([]);
            }
        } catch (error) {
            handleFetchError(error, 'licenses');
        } finally {
            setLicensesLoading(false);
        }
    };

    const handleSlackFormSubmit = async (values: any) => {
        try {
            // localStorage'dan token al
            const token = localStorage.getItem('token');

            if (!token) {
                throw new Error('Authorization token not found. Please log in again.');
            }

            // API'a gönderilecek verileri hazırla
            const slackData = {
                slack_webhook_url: values.slackWebhookUrl,
                slack_enabled: values.slackEnabled
            };

            // API call to save slack settings
            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/notification-settings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include',
                body: JSON.stringify(slackData)
            });

            if (!response.ok) {
                throw new Error(`Error saving slack settings: ${response.status} - ${response.statusText}`);
            }

            // Update local state
            setNotificationSettings({
                ...notificationSettings,
                slackWebhookUrl: values.slackWebhookUrl,
                slackEnabled: values.slackEnabled
            });

            message.success('Slack settings saved successfully');
        } catch (error) {
            console.error('Error saving slack settings:', error);
            message.error(`Failed to save slack settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    const handleTestSlack = async () => {
        try {
            // localStorage'dan token al
            const token = localStorage.getItem('token');

            if (!token) {
                throw new Error('Authorization token not found. Please log in again.');
            }

            // Webhook URL doğrulaması
            const webhookUrl = slackForm.getFieldValue('slackWebhookUrl');
            if (!webhookUrl) {
                throw new Error('Please enter a valid Slack webhook URL');
            }

            // API call to test slack webhook
            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/notification-settings/test-slack`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include',
                body: JSON.stringify({ webhook_url: webhookUrl })
            });

            if (!response.ok) {
                throw new Error(`Error testing Slack webhook: ${response.status} - ${response.statusText}`);
            }

            message.success('Test message sent to Slack successfully');
        } catch (error) {
            console.error('Error testing slack webhook:', error);
            message.error(`Failed to send test message to Slack: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    const handleEmailFormSubmit = async (values: any) => {
        try {
            // localStorage'dan token al
            const token = localStorage.getItem('token');

            if (!token) {
                throw new Error('Authorization token not found. Please log in again.');
            }

            // API'a gönderilecek verileri hazırla
            const emailData = {
                email_enabled: values.emailEnabled,
                email_server: values.emailServer,
                email_port: values.emailPort,
                email_user: values.emailUser,
                email_password: values.emailPassword,
                email_from: values.emailFrom,
                email_recipients: values.emailRecipients
            };

            // API call to save email settings
            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/notification-settings/email`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include',
                body: JSON.stringify(emailData)
            });

            if (!response.ok) {
                throw new Error(`Error saving email settings: ${response.status} - ${response.statusText}`);
            }

            // Update local state
            setNotificationSettings({
                ...notificationSettings,
                emailEnabled: values.emailEnabled,
                emailServer: values.emailServer,
                emailPort: values.emailPort,
                emailUser: values.emailUser,
                emailPassword: values.emailPassword,
                emailFrom: values.emailFrom,
                emailRecipients: values.emailRecipients
            });

            message.success('Email settings saved successfully');
        } catch (error) {
            console.error('Error saving email settings:', error);
            message.error(`Failed to save email settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    const handleTestEmail = async () => {
        try {
            // localStorage'dan token al
            const token = localStorage.getItem('token');

            if (!token) {
                throw new Error('Authorization token not found. Please log in again.');
            }

            // Email ayarlarını doğrula
            const emailData = emailForm.getFieldsValue();

            if (!emailData.emailServer || !emailData.emailPort || !emailData.emailUser ||
                !emailData.emailPassword || !emailData.emailFrom || !emailData.emailRecipients?.length) {
                throw new Error('Please fill in all email settings fields before testing');
            }

            // Önceki verileri API formatına dönüştür
            const formattedData = {
                email_server: emailData.emailServer,
                email_port: emailData.emailPort,
                email_user: emailData.emailUser,
                email_password: emailData.emailPassword,
                email_from: emailData.emailFrom,
                email_recipients: emailData.emailRecipients
            };

            // API call to test email
            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/notification-settings/email/test`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include',
                body: JSON.stringify(formattedData)
            });

            if (!response.ok) {
                throw new Error(`Error testing email: ${response.status} - ${response.statusText}`);
            }

            message.success('Test email sent successfully');
        } catch (error) {
            console.error('Error testing email:', error);
            message.error(`Failed to send test email: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    const showAddUserModal = () => {
        setEditingUser(null);
        userForm.resetFields();
        setUserModalVisible(true);
    };

    const showEditUserModal = (user: User) => {
        setEditingUser(user);
        userForm.setFieldsValue({
            username: user.username,
            email: user.email,
            isAdmin: user.isAdmin,
            isActive: user.isActive
        });
        setUserModalVisible(true);
    };

    const handleUserFormSubmit = async (values: any) => {
        setLoading(true);

        try {
            if (editingUser) {
                // Get current user info
                const userJson = localStorage.getItem('user');
                const currentUserData = userJson ? JSON.parse(userJson) : null;
                const isAdmin = currentUserData && (currentUserData.admin === "true" || currentUserData.role === "admin");

                // If not admin, remove admin-only fields from update
                const updateData = {
                    username: values.username,
                    email: values.email,
                    ...(isAdmin && { 
                        is_admin: values.isAdmin === true,
                        is_active: values.isActive ? "active" : "inactive"
                    })
                };

                const token = localStorage.getItem('token');
                if (!token) {
                    throw new Error('Authorization token not found');
                }

                const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/users/${editingUser.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    credentials: 'include',
                    body: JSON.stringify(updateData)
                });

                if (!response.ok) {
                    if (response.status === 403) {
                        throw new Error('permission_denied');
                    }
                    throw new Error(`Error updating user: ${response.status}`);
                }

                // Update local state
                setUsers(users.map(user =>
                    user.id === editingUser.id ? {
                        ...user,
                        username: values.username,
                        email: values.email,
                        ...(isAdmin && {
                            isAdmin: values.isAdmin,
                            isActive: values.isActive
                        })
                    } : user
                ));

                message.success('User updated successfully');
            } else {
                // Yeni kullanıcı için tüm bilgileri gönder
                const userData = {
                    username: values.username,
                    password: values.password,
                    email: values.email,
                    is_admin: values.isAdmin === true,
                    is_active: values.isActive ? "active" : "inactive"
                };



                // localStorage'dan token al
                const token = localStorage.getItem('token');

                if (!token) {
                    throw new Error('Authorization token not found. Please log in again.');
                }

                const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/users`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    credentials: 'include',
                    body: JSON.stringify(userData)
                });

                if (!response.ok) {
                    throw new Error(`Error creating user: ${response.status} - ${response.statusText}`);
                }

                const responseData = await response.json();

                // API yanıtındaki kullanıcı bilgilerini al veya varsayılan değerler kullan
                const newUser = {
                    id: responseData.id || Date.now().toString(),
                    username: values.username,
                    email: values.email || '',
                    isAdmin: values.isAdmin || false,
                    isActive: values.isActive || true
                };

                // Kullanıcı listesini güncelle
                setUsers([...users, newUser]);
                message.success('User created successfully');
            }

            setUserModalVisible(false);
        } catch (error) {
            console.error('Error in user form submit:', error);
            
            // Show user-friendly error messages
            if (error instanceof Error) {
                if (error.message === 'permission_denied') {
                    message.error('You do not have permission to change administrative settings');
                } else if (error.message.includes('403')) {
                    message.error('You do not have permission to perform this action');
                } else {
                    message.error('Failed to update user information. Please try again later.');
                }
            } else {
                message.error('An unexpected error occurred');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteUser = async (userId: string, username: string) => {
        Modal.confirm({
            title: <div style={{ 
                textAlign: 'center', 
                marginBottom: '20px',
                marginTop: '10px',
                paddingBottom: '20px',
                borderBottom: '1px solid #f0f0f0'
            }}>
                <div style={{
                    background: '#fff7e6',
                    padding: '16px',
                    borderRadius: '8px',
                    marginBottom: '16px'
                }}>
                    <WarningOutlined style={{ 
                        color: '#fa8c16',
                        fontSize: '24px',
                        marginBottom: '10px',
                        display: 'block'
                    }} />
                    <span style={{ 
                        fontSize: '16px',
                        fontWeight: 600,
                        color: '#262626'
                    }}>Delete User Account</span>
                </div>
            </div>,
            content: <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '14px', marginBottom: '16px' }}>
                        You are about to delete the user account:
                    </p>
                    <p style={{ 
                        fontSize: '16px',
                        fontWeight: 500,
                        padding: '12px',
                        background: '#fafafa',
                        borderRadius: '4px',
                        marginBottom: '16px',
                        border: '1px solid #f0f0f0'
                    }}>
                        {username}
                    </p>
                    <p style={{ 
                        fontSize: '14px',
                        color: '#fa541c'
                    }}>
                        This action cannot be undone. All data associated with this account will be permanently deleted.
                    </p>
                </div>,
            okText: 'Delete Account',
            cancelText: 'Cancel',
            width: 400,
            centered: true,
            className: 'delete-user-modal',
            icon: null,
            maskClosable: false,
            okButtonProps: {
                type: 'primary',
                danger: true,
                style: {
                    width: '100%',
                    margin: '0',
                    borderRadius: '6px',
                    height: '32px'
                }
            },
            cancelButtonProps: {
                type: 'default',
                style: {
                    width: '100%',
                    margin: '0 0 8px 0',
                    borderRadius: '6px',
                    height: '32px'
                }
            },
            async onOk() {
                try {
                    setLoading(true);

                    const token = localStorage.getItem('token');
                    if (!token) {
                        throw new Error('Authorization token not found');
                    }

                    const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/users/${userId}`, {
                        method: 'DELETE',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        credentials: 'include'
                    });

                    if (!response.ok) {
                        throw new Error(`Error deleting user: ${response.status}`);
                    }

                    setUsers(users.filter(user => user.id !== userId));
                    message.success('User account has been successfully deleted');
                } catch (error) {
                    console.error('Error deleting user:', error);
                    message.error('Failed to delete user account. Please try again later.');
                } finally {
                    setLoading(false);
                }
            },
        });
    };

    const handleThresholdFormSubmit = async (values: ThresholdSettings) => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('Authorization token not found. Please log in again.');
            }

            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/threshold-settings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include',
                body: JSON.stringify(values)
            });

            if (!response.ok) {
                throw new Error(`Error saving threshold settings: ${response.status} - ${response.statusText}`);
            }

            setThresholdSettings(values);
            message.success('Threshold settings saved successfully');
        } catch (error) {
            console.error('Error saving threshold settings:', error);
            message.error(`Failed to save threshold settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    const formatDateTime = (dateString: string) => {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('tr-TR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZone: 'UTC'
        }).format(date);
    };

    const userColumns = [
        {
            title: 'Username',
            dataIndex: 'username',
            key: 'username',
        },
        {
            title: 'Email',
            dataIndex: 'email',
            key: 'email',
        },
        {
            title: 'Admin',
            dataIndex: 'isAdmin',
            key: 'isAdmin',
            render: (isAdmin: boolean) => (
                isAdmin ? <Text type="success">Yes</Text> : <Text type="secondary">No</Text>
            )
        },
        {
            title: 'Status',
            dataIndex: 'isActive',
            key: 'isActive',
            render: (isActive: boolean) => (
                isActive ? <Text type="success">Active</Text> : <Text type="danger">Inactive</Text>
            )
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (text: string, record: User) => {
                const userJson = localStorage.getItem('user');
                const userData = userJson ? JSON.parse(userJson) : null;
                const isCurrentUserRow = userData && userData.username === record.username;
                const isAdmin = userData && (userData.admin === "true" || userData.role === "admin");

                return (
                    <Space>
                        {/* Show edit button if it's admin or user's own row */}
                        {(isAdmin || isCurrentUserRow) && (
                            <Button
                                icon={<EditOutlined />}
                                type="link"
                                onClick={() => showEditUserModal(record)}
                            />
                        )}
                        {/* Show delete button only for admins */}
                        {isAdmin && (
                            <Button
                                icon={<DeleteOutlined />}
                                type="link"
                                danger
                                onClick={() => handleDeleteUser(record.id, record.username)}
                            />
                        )}
                    </Space>
                );
            }
        }
    ];

    // Add custom styles for the delete modal
    const styles = `
        .delete-user-modal .ant-modal-confirm-btns {
            display: flex;
            flex-direction: column;
            margin-top: 24px;
        }
        .delete-user-modal .ant-modal-confirm-btns .ant-btn {
            margin: 0 !important;
            font-size: 14px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
        }
        .delete-user-modal .ant-modal-confirm-btns .ant-btn-primary {
            order: 2;
            background: #1890ff;
            border-color: #1890ff;
        }
        .delete-user-modal .ant-modal-confirm-btns .ant-btn-primary:hover {
            background: #40a9ff;
            border-color: #40a9ff;
        }
        .delete-user-modal .ant-modal-confirm-btns .ant-btn-default {
            order: 1;
            margin-bottom: 8px !important;
            border: 1px solid #d9d9d9;
        }
        .delete-user-modal .ant-modal-confirm-btns .ant-btn-default:hover {
            color: #40a9ff;
            border-color: #40a9ff;
        }
        .delete-user-modal .ant-modal-confirm-content {
            max-width: 100%;
            margin: 0;
        }
        .delete-user-modal .ant-modal-confirm-body {
            padding: 0;
        }
        .delete-user-modal .ant-modal-body {
            padding: 24px;
        }
    `;

    // Add styles for the user form modal
    const userFormStyles = `
        .user-form-modal .ant-modal-content {
            border-radius: 8px;
        }
        .user-form-modal .ant-modal-body {
            padding: 24px;
        }
        .user-form-modal .ant-form-item-label > label {
            color: #262626;
        }
        .user-form-modal .ant-switch {
            background-color: #f5f5f5;
        }
        .user-form-modal .ant-switch-checked {
            background-color: #1890ff;
        }
        .user-form-modal .ant-input-affix-wrapper {
            border-radius: 6px;
        }
        .user-form-modal .ant-input-affix-wrapper:hover,
        .user-form-modal .ant-input-affix-wrapper:focus,
        .user-form-modal .ant-input-affix-wrapper-focused {
            border-color: #40a9ff;
            box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.1);
        }
    `;

    // Add the styles to document
    React.useEffect(() => {
        const styleSheet = document.createElement("style");
        styleSheet.innerText = styles + userFormStyles;
        document.head.appendChild(styleSheet);
        return () => {
            document.head.removeChild(styleSheet);
        };
    }, []);

    return (
        <div>
            <Title level={2}><SettingOutlined /> System Settings</Title>
            <Divider />

            <Tabs defaultActiveKey="1">
                <TabPane
                    tab={<span><UserOutlined /> User Management</span>}
                    key="1"
                >
                    <Card>
                        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                            <Title level={4}>Users</Title>
                            {currentUser?.isAdmin && (
                                <Button
                                    type="primary"
                                    icon={<PlusOutlined />}
                                    onClick={showAddUserModal}
                                >
                                    Add User
                                </Button>
                            )}
                        </div>

                        <Table
                            columns={userColumns}
                            dataSource={users}
                            rowKey="id"
                            loading={loading}
                        />
                    </Card>
                </TabPane>

                <TabPane
                    tab={<span><SafetyOutlined /> Security</span>}
                    key="security"
                >
                    <Card title={<span><QrcodeOutlined /> Two-Factor Authentication</span>}>
                        <Space direction="vertical" style={{ width: '100%' }} size="large">
                            <Alert
                                message="Enhance Your Account Security"
                                description="Two-factor authentication adds an extra layer of security to your account by requiring a verification code from your mobile device in addition to your password."
                                type="info"
                                showIcon
                            />
                            
                            <div style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center',
                                padding: '16px',
                                background: '#fafafa',
                                borderRadius: '8px',
                                border: '1px solid #f0f0f0'
                            }}>
                                <div>
                                    <Title level={5} style={{ margin: 0, marginBottom: 4 }}>
                                        Two-Factor Authentication
                                    </Title>
                                    <Text type="secondary">
                                        {twoFactorEnabled 
                                            ? 'Your account is protected with 2FA' 
                                            : 'Add an extra layer of security to your account'
                                        }
                                    </Text>
                                </div>
                                <Switch
                                    checked={twoFactorEnabled}
                                    onChange={handle2FAToggle}
                                    loading={twoFactorLoading}
                                    checkedChildren="Enabled"
                                    unCheckedChildren="Disabled"
                                />
                            </div>

                            {twoFactorEnabled && (
                                <Alert
                                    message="2FA is Active"
                                    description="Your account is currently protected with two-factor authentication. You can disable it using the toggle above if needed."
                                    type="success"
                                    showIcon
                                />
                            )}
                        </Space>
                    </Card>
                </TabPane>

                {currentUser?.isAdmin && (
                    <>
                        <TabPane
                            tab={<span><BellOutlined /> Notifications</span>}
                            key="2"
                        >
                            <Card title={<span><SlackOutlined /> Slack Notifications</span>} style={{ marginBottom: 16 }}>
                                <Form
                                    form={slackForm}
                                    layout="vertical"
                                    onFinish={handleSlackFormSubmit}
                                    initialValues={{
                                        slackWebhookUrl: notificationSettings.slackWebhookUrl,
                                        slackEnabled: notificationSettings.slackEnabled
                                    }}
                                >
                                    <Form.Item
                                        name="slackEnabled"
                                        label="Enable Slack Notifications"
                                        valuePropName="checked"
                                    >
                                        <Switch />
                                    </Form.Item>

                                    <Form.Item
                                        name="slackWebhookUrl"
                                        label="Slack Webhook URL"
                                        rules={[
                                            { required: true, message: 'Please enter the Slack webhook URL' },
                                            { type: 'url', message: 'Please enter a valid URL' }
                                        ]}
                                    >
                                        <Input placeholder="https://hooks.slack.com/services/..." />
                                    </Form.Item>

                                    <Form.Item>
                                        <Space>
                                            <Button type="primary" htmlType="submit">
                                                Save Settings
                                            </Button>
                                            <Button onClick={handleTestSlack}>
                                                Test Connection
                                            </Button>
                                        </Space>
                                    </Form.Item>
                                </Form>
                            </Card>

                            <Card title={<span><MailOutlined /> Email Notifications</span>}>
                                <Form
                                    form={emailForm}
                                    layout="vertical"
                                    onFinish={handleEmailFormSubmit}
                                    initialValues={{
                                        emailEnabled: notificationSettings.emailEnabled,
                                        emailServer: notificationSettings.emailServer,
                                        emailPort: notificationSettings.emailPort,
                                        emailUser: notificationSettings.emailUser,
                                        emailPassword: notificationSettings.emailPassword,
                                        emailFrom: notificationSettings.emailFrom,
                                        emailRecipients: notificationSettings.emailRecipients
                                    }}
                                >
                                    <Form.Item
                                        name="emailEnabled"
                                        label="Enable Email Notifications"
                                        valuePropName="checked"
                                    >
                                        <Switch />
                                    </Form.Item>

                                    <Form.Item
                                        name="emailServer"
                                        label="SMTP Server"
                                        rules={[
                                            { required: true, message: 'Please enter the SMTP server' }
                                        ]}
                                    >
                                        <Input placeholder="smtp.example.com" />
                                    </Form.Item>

                                    <Form.Item
                                        name="emailPort"
                                        label="SMTP Port"
                                        rules={[
                                            { required: true, message: 'Please enter the SMTP port' }
                                        ]}
                                    >
                                        <Input placeholder="587" />
                                    </Form.Item>

                                    <Form.Item
                                        name="emailUser"
                                        label="SMTP Username"
                                        rules={[
                                            { required: true, message: 'Please enter the SMTP username' }
                                        ]}
                                    >
                                        <Input placeholder="username" />
                                    </Form.Item>

                                    <Form.Item
                                        name="emailPassword"
                                        label="SMTP Password"
                                        rules={[
                                            { required: true, message: 'Please enter the SMTP password' }
                                        ]}
                                    >
                                        <Input.Password placeholder="password" />
                                    </Form.Item>

                                    <Form.Item
                                        name="emailFrom"
                                        label="From Email Address"
                                        rules={[
                                            { required: true, message: 'Please enter the from email address' },
                                            { type: 'email', message: 'Please enter a valid email address' }
                                        ]}
                                    >
                                        <Input placeholder="alerts@example.com" />
                                    </Form.Item>

                                    <Form.Item
                                        name="emailRecipients"
                                        label="Recipients"
                                        rules={[
                                            { required: true, message: 'Please add at least one recipient' }
                                        ]}
                                    >
                                        <Select
                                            mode="tags"
                                            style={{ width: '100%' }}
                                            placeholder="Add email recipients"
                                            tokenSeparators={[',']}
                                        />
                                    </Form.Item>

                                    <Form.Item>
                                        <Space>
                                            <Button type="primary" htmlType="submit">
                                                Save Settings
                                            </Button>
                                            <Button onClick={handleTestEmail}>
                                                Test Email
                                            </Button>
                                        </Space>
                                    </Form.Item>
                                </Form>
                            </Card>
                        </TabPane>

                        <TabPane
                            tab={<span><WarningOutlined /> Thresholds</span>}
                            key="3"
                        >
                            <Form
                                form={thresholdForm}
                                layout="vertical"
                                onFinish={handleThresholdFormSubmit}
                                initialValues={thresholdSettings}
                            >
                                <Row gutter={[16, 16]}>
                                    <Col xs={24} lg={12}>
                                        <Card
                                            title={<Space><DashboardOutlined />System Resource Thresholds</Space>}
                                            className="threshold-card"
                                        >
                                            <Form.Item
                                                name="cpu_threshold"
                                                label="CPU Usage Threshold (%)"
                                                rules={[
                                                    { required: true, message: 'Please enter CPU threshold' },
                                                    { type: 'number', min: 0, max: 100, message: 'Please enter a value between 0 and 100' }
                                                ]}
                                            >
                                                <InputNumber min={0} max={100} style={{ width: '100%' }} />
                                            </Form.Item>

                                            <Form.Item
                                                name="memory_threshold"
                                                label="Memory Usage Threshold (%)"
                                                rules={[
                                                    { required: true, message: 'Please enter memory threshold' },
                                                    { type: 'number', min: 0, max: 100, message: 'Please enter a value between 0 and 100' }
                                                ]}
                                            >
                                                <InputNumber min={0} max={100} style={{ width: '100%' }} />
                                            </Form.Item>

                                            <Form.Item
                                                name="disk_threshold"
                                                label="Disk Usage Threshold (%)"
                                                rules={[
                                                    { required: true, message: 'Please enter disk threshold' },
                                                    { type: 'number', min: 0, max: 100, message: 'Please enter a value between 0 and 100' }
                                                ]}
                                            >
                                                <InputNumber min={0} max={100} style={{ width: '100%' }} />
                                            </Form.Item>
                                        </Card>
                                    </Col>

                                    <Col xs={24} lg={12}>
                                        <Card
                                            title={<Space><DatabaseOutlined />Database Performance Thresholds</Space>}
                                            className="threshold-card"
                                        >
                                            <Form.Item
                                                name="connection_threshold"
                                                label="Connection Usage Threshold (%)"
                                                tooltip="Maximum percentage of allowed connections"
                                                rules={[
                                                    { required: true, message: 'Please enter connection threshold' },
                                                    { type: 'number', min: 0, max: 100, message: 'Please enter a value between 0 and 100' }
                                                ]}
                                            >
                                                <InputNumber min={0} max={100} style={{ width: '100%' }} />
                                            </Form.Item>

                                            <Form.Item
                                                name="slow_query_threshold_ms"
                                                label="Slow Query Threshold (milliseconds)"
                                                tooltip="Queries taking longer than this will be considered slow"
                                                rules={[
                                                    { required: true, message: 'Please enter slow query threshold' },
                                                    { type: 'number', min: 0, message: 'Please enter a value greater than 0' }
                                                ]}
                                            >
                                                <InputNumber min={0} step={100} style={{ width: '100%' }} />
                                            </Form.Item>

                                            <Form.Item
                                                name="replication_lag_threshold"
                                                label="Replication Lag Threshold (seconds)"
                                                tooltip="Maximum allowed replication delay"
                                                rules={[
                                                    { required: true, message: 'Please enter replication lag threshold' },
                                                    { type: 'number', min: 0, message: 'Please enter a value greater than 0' }
                                                ]}
                                            >
                                                <InputNumber min={0} step={10} style={{ width: '100%' }} />
                                            </Form.Item>

                                            <Form.Item
                                                name="blocking_query_threshold_ms"
                                                label="Blocking Query Threshold (milliseconds)"
                                                tooltip="Queries blocking for longer than this will trigger an alert"
                                                rules={[
                                                    { required: true, message: 'Please enter blocking query threshold' },
                                                    { type: 'number', min: 0, message: 'Please enter a value greater than 0' }
                                                ]}
                                            >
                                                <InputNumber min={0} step={100} style={{ width: '100%' }} />
                                            </Form.Item>
                                        </Card>
                                    </Col>

                                    {/* Future Thresholds Section */}
                                    <Col xs={24}>
                                        <Collapse ghost>
                                            <Panel header="Advanced Thresholds" key="1">
                                                <Row gutter={[16, 16]}>
                                                    {/* Template for future thresholds */}
                                                    <Col xs={24} lg={12}>
                                                        <Card
                                                            title="Additional Thresholds"
                                                            className="threshold-card"
                                                            style={{ backgroundColor: '#fafafa' }}
                                                        >
                                                            <Text type="secondary">
                                                                Additional threshold settings will appear here when available.
                                                            </Text>
                                                        </Card>
                                                    </Col>
                                                </Row>
                                            </Panel>
                                        </Collapse>
                                    </Col>
                                </Row>

                                <Divider />

                                <Form.Item>
                                    <Button type="primary" htmlType="submit" size="large">
                                        Save All Thresholds
                                    </Button>
                                </Form.Item>
                            </Form>
                        </TabPane>

                        <TabPane
                            tab={<span><CodeOutlined /> Agents</span>}
                            key="4"
                        >
                            <Card title="Agent Version Information">
                                <Table
                                    columns={agentVersionColumns}
                                    dataSource={agentVersions}
                                    rowKey="agentID"
                                    loading={versionsLoading}
                                    pagination={{
                                        defaultPageSize: 10,
                                        showSizeChanger: true,
                                        showTotal: (total) => `Total ${total} agents`
                                    }}
                                    scroll={{ x: 1200 }}
                                />
                            </Card>
                        </TabPane>

                        <TabPane
                            tab={<span><CloudServerOutlined /> Licenses</span>}
                            key="5"
                        >
                            <Card title="License Information">
                                <Table
                                    columns={[
                                        {
                                            title: 'Company',
                                            dataIndex: 'company_name',
                                            key: 'company_name',
                                        },
                                        {
                                            title: 'License Key',
                                            dataIndex: 'agent_key',
                                            key: 'agent_key',
                                            render: (key: string) => {
                                                // Son 8 haneyi maskele
                                                const maskedKey = key.length > 8 
                                                    ? key.slice(0, -8) + "********" 
                                                    : "********"; // Eğer anahtar 8 karakterden kısaysa tamamını maskele
                                                return (
                                                    <Tag color="blue">{maskedKey}</Tag>
                                                );
                                            }
                                        },
                                        {
                                            title: 'Status',
                                            dataIndex: 'expiration_date',
                                            key: 'status',
                                            render: (date: string) => {
                                                const expiryDate = new Date(date);
                                                const now = new Date();
                                                const isExpired = expiryDate < now;
                                                
                                                return (
                                                    <Tag color={isExpired ? 'red' : 'green'}>
                                                        {isExpired ? 'Expired' : 'Active'}
                                                    </Tag>
                                                );
                                            },
                                            filters: [
                                                { text: 'Active', value: 'active' },
                                                { text: 'Expired', value: 'expired' }
                                            ],
                                            onFilter: (value, record) => {
                                                const expiryDate = new Date(record.expiration_date);
                                                const now = new Date();
                                                const isExpired = expiryDate < now;
                                                
                                                return (value === 'active' && !isExpired) || 
                                                       (value === 'expired' && isExpired);
                                            }
                                        },
                                        {
                                            title: 'Expiration Date',
                                            dataIndex: 'expiration_date',
                                            key: 'expiration_date',
                                            render: (date: string) => {
                                                const expiryDate = new Date(date);
                                                const now = new Date();
                                                const isExpired = expiryDate < now;
                                                
                                                return (
                                                    <Tag color={isExpired ? 'red' : 'green'}>
                                                        {formatDateTime(date)}
                                                    </Tag>
                                                );
                                            }
                                        },
                                        {
                                            title: 'Agents',
                                            dataIndex: 'agents',
                                            key: 'agents',
                                            render: (agents: LicenseAgent[]) => (
                                                <span>{agents.length} agent(s)</span>
                                            )
                                        },
                                        {
                                            title: 'Created At',
                                            dataIndex: 'created_at',
                                            key: 'created_at',
                                            render: (date: string) => formatDateTime(date)
                                        }
                                    ]}
                                    dataSource={licenses}
                                    rowKey="id"
                                    loading={licensesLoading}
                                    expandable={{
                                        expandedRowRender: (record) => (
                                            <Table
                                                columns={[
                                                    {
                                                        title: 'Hostname',
                                                        dataIndex: 'hostname',
                                                        key: 'hostname',
                                                    },
                                                    {
                                                        title: 'Agent ID',
                                                        dataIndex: 'agent_id',
                                                        key: 'agent_id',
                                                    }
                                                ]}
                                                dataSource={record.agents}
                                                rowKey="agent_id"
                                                pagination={false}
                                                size="small"
                                            />
                                        ),
                                        expandRowByClick: true,
                                        rowExpandable: (record) => record.agents && record.agents.length > 0,
                                    }}
                                    pagination={{
                                        defaultPageSize: 10,
                                        showSizeChanger: true,
                                        showTotal: (total) => `Total ${total} licenses`
                                    }}
                                />
                            </Card>
                        </TabPane>
                    </>
                )}
            </Tabs>

            <Modal
                title={
                    <div style={{ 
                        textAlign: 'center', 
                        marginBottom: '20px',
                        marginTop: '10px',
                        paddingBottom: '20px',
                        borderBottom: '1px solid #f0f0f0'
                    }}>
                        <div style={{
                            background: '#e6f7ff',
                            padding: '16px',
                            borderRadius: '8px',
                            marginBottom: '16px'
                        }}>
                            <UserOutlined style={{ 
                                color: '#1890ff',
                                fontSize: '24px',
                                marginBottom: '10px',
                                display: 'block'
                            }} />
                            <span style={{ 
                                fontSize: '16px',
                                fontWeight: 600,
                                color: '#262626'
                            }}>{editingUser ? "Edit User Account" : "Create New User"}</span>
                        </div>
                    </div>
                }
                visible={userModalVisible}
                onCancel={() => setUserModalVisible(false)}
                footer={null}
                centered
                width={400}
                maskClosable={false}
                className="user-form-modal"
            >
                <Form
                    form={userForm}
                    layout="vertical"
                    onFinish={handleUserFormSubmit}
                    className="user-form"
                >
                    <Form.Item
                        name="username"
                        label={<span style={{ fontSize: '14px', fontWeight: 500 }}>Username</span>}
                        rules={[
                            { required: true, message: 'Please enter username' }
                        ]}
                    >
                        <Input 
                            prefix={<UserOutlined style={{ color: '#bfbfbf' }} />} 
                            placeholder="Enter username"
                            style={{ borderRadius: '6px', height: '32px' }}
                        />
                    </Form.Item>

                    {!editingUser && (
                        <>
                            <Form.Item
                                name="password"
                                label={<span style={{ fontSize: '14px', fontWeight: 500 }}>Password</span>}
                                rules={[
                                    { required: true, message: 'Please enter password' },
                                    { min: 6, message: 'Password must be at least 6 characters' }
                                ]}
                                hasFeedback
                            >
                                <Input.Password 
                                    placeholder="Enter password"
                                    style={{ borderRadius: '6px', height: '32px' }}
                                />
                            </Form.Item>

                            <Form.Item
                                name="confirmPassword"
                                label={<span style={{ fontSize: '14px', fontWeight: 500 }}>Confirm Password</span>}
                                dependencies={['password']}
                                hasFeedback
                                rules={[
                                    { required: true, message: 'Please confirm your password' },
                                    ({ getFieldValue }) => ({
                                        validator(_, value) {
                                            if (!value || getFieldValue('password') === value) {
                                                return Promise.resolve();
                                            }
                                            return Promise.reject(new Error('The two passwords do not match'));
                                        },
                                    }),
                                ]}
                            >
                                <Input.Password 
                                    placeholder="Confirm password"
                                    style={{ borderRadius: '6px', height: '32px' }}
                                />
                            </Form.Item>
                        </>
                    )}

                    <Form.Item
                        name="email"
                        label={<span style={{ fontSize: '14px', fontWeight: 500 }}>Email</span>}
                        rules={[
                            { required: true, message: 'Please enter email' },
                            { type: 'email', message: 'Please enter a valid email' }
                        ]}
                    >
                        <Input 
                            prefix={<MailOutlined style={{ color: '#bfbfbf' }} />} 
                            placeholder="Enter email"
                            style={{ borderRadius: '6px', height: '32px' }}
                        />
                    </Form.Item>

                    <Form.Item
                        name="isAdmin"
                        label={<span style={{ fontSize: '14px', fontWeight: 500 }}>Admin User</span>}
                        valuePropName="checked"
                    >
                        <Switch 
                            disabled={!currentUser?.isAdmin}
                            checkedChildren="Yes"
                            unCheckedChildren="No"
                        />
                    </Form.Item>

                    <Form.Item
                        name="isActive"
                        label={<span style={{ fontSize: '14px', fontWeight: 500 }}>Active</span>}
                        valuePropName="checked"
                        initialValue={true}
                    >
                        <Switch 
                            disabled={!currentUser?.isAdmin}
                            checkedChildren="Yes"
                            unCheckedChildren="No"
                        />
                    </Form.Item>

                    <Form.Item style={{ marginBottom: 0, marginTop: '24px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <Button
                                type="primary"
                                htmlType="submit"
                                style={{
                                    width: '100%',
                                    borderRadius: '6px',
                                    height: '32px'
                                }}
                            >
                                {editingUser ? "Update User" : "Create User"}
                            </Button>
                            <Button
                                onClick={() => setUserModalVisible(false)}
                                style={{
                                    width: '100%',
                                    borderRadius: '6px',
                                    height: '32px'
                                }}
                            >
                                Cancel
                            </Button>
                        </div>
                    </Form.Item>
                </Form>
            </Modal>

            <TwoFactorAuth
                visible={twoFactorModalVisible}
                onCancel={handle2FASetupCancel}
                onSuccess={handle2FASetupSuccess}
                mode="setup"
                username={currentUser?.username}
            />
        </div>
    );
};

// Add this CSS to your styles
const styles = `
.threshold-card {
    height: 100%;
}

.threshold-card .ant-card-head {
    background-color: #fafafa;
    border-bottom: 1px solid #f0f0f0;
}

.threshold-card .ant-card-head-title {
    font-size: 16px;
}

.ant-collapse-ghost > .ant-collapse-item > .ant-collapse-content > .ant-collapse-content-box {
    padding: 0;
}
`;

// Add the styles to the document
const styleSheet = document.createElement("style");
styleSheet.innerText = styles;
document.head.appendChild(styleSheet);

export default Settings; 