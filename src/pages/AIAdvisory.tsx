import React, { useState, useEffect } from 'react';
import {
    Card, Typography, Space, Alert, Button,
    Spin, Table, Tag, Collapse,
    Modal, Row, Col, List, message, Tooltip
} from 'antd';
import {
    RobotOutlined, SearchOutlined, ReloadOutlined,
    DatabaseOutlined, SettingOutlined, CodeOutlined, FileOutlined, SafetyOutlined, DashboardOutlined, CloudServerOutlined, InfoCircleOutlined, CheckCircleOutlined, WarningOutlined, CloseCircleOutlined,
    FilePdfOutlined
} from '@ant-design/icons';
import axios from 'axios';
import './Dashboard.css';
import { ColumnsType } from 'antd/es/table';
import type { Key } from 'antd/es/table/interface';
import { store } from '../redux/store';
import { incrementUsage } from '../redux/aiLimitSlice';
import { useSelector } from 'react-redux';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import autoTable from 'jspdf-autotable';

// İkon bileşenlerini import et
import MssqlIcon from '../icons/mssql';
import PostgresqlIcon from '../icons/postgresql';
import MongoDBIcon from '../icons/mongodb';

// First, make sure AIAnalysisRenderer is imported at the top of the file
import AIAnalysisRenderer from '../components/AIAnalysisRenderer';

const { Title, Text } = Typography;
const { Panel } = Collapse;

interface SystemResources {
    cpu: {
        cores: number;
        usage: number;
        model: string;
    };
    memory: {
        total: number;
        used: number;
        free: number;
        swap: {
            total: number;
            used: number;
            free: number;
        };
    };
    disk: {
        total: number;
        used: number;
        free: number;
        iops: number;
    };
}

interface DatabaseConfig {
    mongodb?: {
        path: string;
        content: string;
        parsed: Record<string, any>;
    };
    postgresql?: {
        path: string;
        content: string;
        parsed: Record<string, any>;
    };
}

interface MongoDBHealthCheck {
    check_name: string;
    status: 'OK' | 'Warning' | 'Critical' | 'Info';
    description: string;
    recommendation: string;
    details?: Record<string, any>;
}

interface NodeData {
    Type: string;
    ClusterName: string;
    Hostname: string;
    NodeStatus: string;
    ServiceStatus: string;
    FreeDisk: number;
    key: string;
    IP: string;
    Location: string;
    Version: string;
    ReplicationLag: number;
    configPath?: string;
    ConfigPath?: string;
    totalVCPU?: number;
    TotalVCPU?: number;
    totalMemory?: number;
    TotalMemory?: number;
}

interface ConfigItem {
    name: string;
    value: string;
    unit?: string;
    description?: string;
    category?: string;
    is_default?: boolean;
}

const severityColors = {
    success: 'green',
    warning: 'orange',
    error: 'red'
} as const;

type SeverityType = keyof typeof severityColors;

interface AnalysisResult {
    severity: SeverityType;
    message: string;
    recommendation: string;
}

// Byte değerini GB'a çevirmek için yardımcı fonksiyon
const byteToGB = (bytes: number | undefined): string => {
    if (!bytes || bytes === 0) return 'N/A';

    // Eğer değer zaten GB'dan küçükse (1 GB = 1024*1024*1024 byte)
    if (bytes < 1024 * 1024 * 1024) {
        // MB olarak göster
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }

    // GB olarak göster (1 GB = 1024*1024*1024 byte)
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

// Add this function to extract just the version number
const shortenMssqlVersion = (version: string): string => {
    if (!version) return '';

    // Extract just the version number (e.g., 16.0.1000.6)
    const versionMatch = version.match(/(\d+\.\d+\.\d+\.\d+)/);
    if (versionMatch) {
        return versionMatch[1];
    }

    return version;
};

const AIAdvisory: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [analyzing, setAnalyzing] = useState(false);
    const [nodes, setNodes] = useState<NodeData[]>([]);
    const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);
    const [systemResources, setSystemResources] = useState<SystemResources | null>(null);
    const [dbConfigs, setDbConfigs] = useState<DatabaseConfig | null>(null);
    const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([]);
    const [analysisModalVisible, setAnalysisModalVisible] = useState(false);

    // Yeni state'ler
    const [configModalVisible, setConfigModalVisible] = useState(false);
    const [loadingConfig, setLoadingConfig] = useState(false);
    const [configItems, setConfigItems] = useState<ConfigItem[]>([]);
    const [aiRecommendations, setAiRecommendations] = useState<ConfigItem[]>([]);

    // MSSQL Modal ve best practices için state'ler
    const [mssqlModalVisible, setMssqlModalVisible] = useState(false);
    const [loadingMssqlBestPractices, setLoadingMssqlBestPractices] = useState(false);
    const [mssqlBestPractices, setMssqlBestPractices] = useState<any>({});

    // MSSQL AI analizi için state'ler
    const [analyzingMssqlAI, setAnalyzingMssqlAI] = useState(false);
    const [mssqlAIRecommendations, setMssqlAIRecommendations] = useState<Record<string, string>>({});

    // MongoDB Modal ve health checks için state'ler
    const [mongoModalVisible, setMongoModalVisible] = useState(false);
    const [loadingMongoHealthChecks, setLoadingMongoHealthChecks] = useState(false);
    const [mongoHealthChecks, setMongoHealthChecks] = useState<Record<string, MongoDBHealthCheck[]>>({});

    // MongoDB AI analizi için state'ler
    const [analyzingMongoAI, setAnalyzingMongoAI] = useState(false);
    const [mongoAIRecommendations, setMongoAIRecommendations] = useState<Record<string, string>>({});

    // Kategori seçimi için yeni state
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [selectedCheckName, setSelectedCheckName] = useState<string | null>(null);

    // Redux'tan AI kullanım bilgisini direkt olarak alalım
    const { dailyUsageCount, dailyLimit, lastResetDate } = useSelector((state: any) => state.aiLimit);

    const fetchNodes = async () => {
        try {
            const response = await axios.get(
                `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/status/nodeshealth`,
                { withCredentials: true }
            );

            const allNodes: NodeData[] = [];

            // Process PostgreSQL nodes
            if (response.data && response.data.postgresql) {
                response.data.postgresql.forEach((cluster: any) => {
                    const clusterName = Object.keys(cluster)[0];
                    cluster[clusterName].forEach((node: any) => {
                        allNodes.push({
                            Type: 'PostgreSQL',
                            ClusterName: node.ClusterName,
                            Hostname: node.Hostname,
                            NodeStatus: node.NodeStatus,
                            ServiceStatus: node.PGServiceStatus,
                            FreeDisk: parseInt(node.FDPercent) || 0,
                            key: `pg-${node.Hostname}-${node.ClusterName}`,
                            IP: node.IP,
                            Location: node.DC || 'N/A',
                            Version: node.PGVersion,
                            ReplicationLag: parseFloat(node.ReplicationLagSec) || 0,
                            configPath: node.ConfigPath,
                            ConfigPath: node.ConfigPath,
                            totalVCPU: node.TotalVCPU,
                            TotalVCPU: node.TotalVCPU,
                            totalMemory: node.TotalMemory,
                            TotalMemory: node.TotalMemory
                        });
                    });
                });
            }

            // Process MSSQL nodes
            if (response.data && response.data.mssql) {
                response.data.mssql.forEach((cluster: any) => {
                    const clusterName = Object.keys(cluster)[0];
                    cluster[clusterName].forEach((node: any) => {
                        allNodes.push({
                            Type: 'MSSQL',
                            ClusterName: node.ClusterName,
                            Hostname: node.Hostname,
                            NodeStatus: node.NodeStatus,
                            ServiceStatus: node.Status,
                            FreeDisk: parseInt(node.FDPercent) || 0,
                            key: `mssql-${node.Hostname}-${node.ClusterName}`,
                            IP: node.IP,
                            Location: node.Location || 'N/A',
                            Version: node.Version,
                            ReplicationLag: 0, // MSSQL'de bu değer olmayabilir
                            configPath: node.ConfigPath,
                            ConfigPath: node.ConfigPath,
                            totalVCPU: node.TotalVCPU,
                            TotalVCPU: node.TotalVCPU,
                            totalMemory: node.TotalMemory,
                            TotalMemory: node.TotalMemory
                        });
                    });
                });
            }

            // Process MongoDB nodes
            if (response.data && response.data.mongodb) {
                response.data.mongodb.forEach((cluster: any) => {
                    const clusterName = Object.keys(cluster)[0];
                    cluster[clusterName].forEach((node: any) => {
                        allNodes.push({
                            Type: 'MongoDB',
                            ClusterName: node.ClusterName,
                            Hostname: node.Hostname,
                            NodeStatus: node.NodeStatus,
                            ServiceStatus: node.MongoStatus, // MongoDB'de MongoStatus field'ı kullanılıyor
                            FreeDisk: parseInt(node.FDPercent) || 0,
                            key: `mongodb-${node.Hostname}-${node.ClusterName}`,
                            IP: node.IP,
                            Location: node.Location || 'N/A',
                            Version: node.MongoVersion, // MongoDB'de MongoVersion field'ı kullanılıyor
                            ReplicationLag: parseFloat(node.ReplicationLagSec) || 0, // ReplicationLagSec field'ı
                            configPath: node.ConfigPath,
                            ConfigPath: node.ConfigPath,
                            totalVCPU: node.TotalVCPU,
                            TotalVCPU: node.TotalVCPU,
                            totalMemory: node.TotalMemory,
                            TotalMemory: node.TotalMemory
                        });
                    });
                });
            }

            setNodes(allNodes);
        } catch (error) {
            console.error('Error fetching nodes:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNodes();
    }, []);

    const fetchNodeData = async (node: NodeData) => {
        try {
            const [resourcesResponse, configsResponse] = await Promise.all([
                axios.get(
                    `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/agents/${node.Hostname}/system/resources`,
                    { withCredentials: true }
                ),
                axios.get(
                    `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/agents/${node.Hostname}/configs`,
                    { withCredentials: true }
                )
            ]);

            setSystemResources(resourcesResponse.data);
            setDbConfigs(configsResponse.data);
        } catch (error) {
            console.error('Error fetching node data:', error);
        }
    };

    const fetchPostgresqlConfig = async (node: NodeData) => {
        if (!node) {
            console.error('Node data is missing for fetchPostgresqlConfig');
            alert('Node data is missing. Cannot fetch configuration.');
            return;
        }

        // configPath kontrolü - doğru property ismini kullanmamız gerekiyor
        // Yanıtta "ConfigPath" şeklinde geliyor olabilir, bu yüzden her iki durumu da kontrol edelim
        const configPath = node.ConfigPath || node.configPath || '/etc/postgresql/postgresql.conf';

        setLoadingConfig(true);

        // Bu kontrol için farklı bir mevcut değer ekleyelim
        setConfigItems([{ name: 'Loading...', value: 'Please wait' }]);

        try {
            // agent_ önekini tekrar ekliyoruz
            const agentId = `agent_${node.Hostname}`;

            const url = `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/agents/${agentId}/postgres/config`;

            // POST metodu kullanarak ve parametreleri JSON formatında göndererek istek yapalım
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({ config_path: configPath }), // JSON formatında request body
                credentials: 'include'
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to load configuration');
            }

            const data = await response.json();

            if (data && data.configurations) {
                // Backend'in döndüğü format farklı, buna uygun dönüşüm yapalım
                const configData: ConfigItem[] = data.configurations.map((config: any) => ({
                    name: config.parameter,
                    value: String(config.value),
                    description: config.description,
                    unit: config.is_default ? 'Default' : '',
                    category: config.category,
                    is_default: Boolean(config.is_default)
                }));

                setConfigItems(configData);
            } else {
                setConfigItems([]);
                message.warning('No configuration data available');
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            // Eğer hata mesajı agent bulunamadı veya bağlantı kapalı ile ilgiliyse
            if (errorMessage.includes('agent bulunamadı veya bağlantı kapalı')) {
                setConfigItems([]);
                message.error('Cannot fetch configuration: Agent is not connected');

                // Alert bileşeni ile daha detaylı bilgi gösterelim
                Modal.error({
                    title: 'Agent Connection Error',
                    content: (
                        <div style={{ marginTop: '20px' }}>
                            <p>Unable to fetch PostgreSQL configuration because the agent is not connected to the server.</p>
                            <p>Please ensure that:</p>
                            <ul>
                                <li>The agent service is running on the server</li>
                                <li>There are no network connectivity issues</li>
                                <li>The agent has the necessary permissions</li>
                            </ul>
                        </div>
                    ),
                });
            } else {
                setConfigItems([]);
                message.error(`Failed to load configuration: ${errorMessage}`);
            }
        } finally {
            setLoadingConfig(false);
        }
    };

    // MongoDB Health Checks Analizi için
    const fetchMongoDBHealthChecks = async (node: NodeData) => {
        if (!node) {
            console.error('Node data is missing for fetchMongoDBHealthChecks');
            message.error('Node data is missing. Cannot fetch MongoDB health checks.');
            return;
        }

        setLoadingMongoHealthChecks(true);
        setMongoHealthChecks({});

                try {
            // agent_ önekini ekle
            const agentId = `agent_${node.Hostname}`;
            const baseUrl = `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/metrics/mongodb`;
            const timeRange = '1h'; // 1 hour range
            
            // Tüm MongoDB metrikleri için paralel istekler gönder
            const [
                systemCpu,
                systemMemory,
                systemDisk,
                systemResponseTime,
                dbConnections,
                dbOperations,
                dbOperationsRate,
                dbStorage,
                dbInfo,
                replStatus,
                replLag,
                replOplog,
                perfQps,
                perfReadWriteRatio,
                perfSlowQueries,
                perfQueryTime,
                perfActiveQueries,
                perfProfiler,
                perfAll
            ] = await Promise.allSettled([
                fetch(`${baseUrl}/system/cpu?agent_id=${agentId}&range=${timeRange}`, { credentials: 'include' }),
                fetch(`${baseUrl}/system/memory?agent_id=${agentId}&range=${timeRange}`, { credentials: 'include' }),
                fetch(`${baseUrl}/system/disk?agent_id=${agentId}&range=${timeRange}`, { credentials: 'include' }),
                fetch(`${baseUrl}/system/response-time?agent_id=${agentId}&range=${timeRange}`, { credentials: 'include' }),
                fetch(`${baseUrl}/database/connections?agent_id=${agentId}&range=${timeRange}`, { credentials: 'include' }),
                fetch(`${baseUrl}/database/operations?agent_id=${agentId}&range=${timeRange}`, { credentials: 'include' }),
                fetch(`${baseUrl}/database/operations-rate?agent_id=${agentId}&range=${timeRange}`, { credentials: 'include' }),
                fetch(`${baseUrl}/database/storage?agent_id=${agentId}&range=${timeRange}`, { credentials: 'include' }),
                fetch(`${baseUrl}/database/info?agent_id=${agentId}&range=${timeRange}`, { credentials: 'include' }),
                fetch(`${baseUrl}/replication/status?agent_id=${agentId}&range=${timeRange}`, { credentials: 'include' }),
                fetch(`${baseUrl}/replication/lag?agent_id=${agentId}&range=${timeRange}`, { credentials: 'include' }),
                fetch(`${baseUrl}/replication/oplog?agent_id=${agentId}&range=${timeRange}`, { credentials: 'include' }),
                fetch(`${baseUrl}/performance/qps?agent_id=${agentId}&range=${timeRange}`, { credentials: 'include' }),
                fetch(`${baseUrl}/performance/read-write-ratio?agent_id=${agentId}&range=${timeRange}`, { credentials: 'include' }),
                fetch(`${baseUrl}/performance/slow-queries?agent_id=${agentId}&range=${timeRange}`, { credentials: 'include' }),
                fetch(`${baseUrl}/performance/query-time?agent_id=${agentId}&range=${timeRange}`, { credentials: 'include' }),
                fetch(`${baseUrl}/performance/active-queries?agent_id=${agentId}&range=${timeRange}`, { credentials: 'include' }),
                fetch(`${baseUrl}/performance/profiler?agent_id=${agentId}&range=${timeRange}`, { credentials: 'include' }),
                fetch(`${baseUrl}/performance/all?agent_id=${agentId}&range=${timeRange}`, { credentials: 'include' })
            ]);

            // Başarılı olan isteklerin verilerini al
            const results: any = {};

            const processResponse = async (result: PromiseSettledResult<Response>, key: string) => {
                if (result.status === 'fulfilled' && result.value.ok) {
                    try {
                        const data = await result.value.json();
                        results[key] = data;
                    } catch (e) {
                        console.warn(`Failed to parse JSON for ${key}:`, e);
                    }
                } else {
                    console.warn(`Failed to fetch ${key}:`, result.status === 'rejected' ? result.reason : result.value.statusText);
                }
            };

            await Promise.all([
                processResponse(systemCpu, 'systemCpu'),
                processResponse(systemMemory, 'systemMemory'),
                processResponse(systemDisk, 'systemDisk'),
                processResponse(systemResponseTime, 'systemResponseTime'),
                processResponse(dbConnections, 'dbConnections'),
                processResponse(dbOperations, 'dbOperations'),
                processResponse(dbOperationsRate, 'dbOperationsRate'),
                processResponse(dbStorage, 'dbStorage'),
                processResponse(dbInfo, 'dbInfo'),
                processResponse(replStatus, 'replStatus'),
                processResponse(replLag, 'replLag'),
                processResponse(replOplog, 'replOplog'),
                processResponse(perfQps, 'perfQps'),
                processResponse(perfReadWriteRatio, 'perfReadWriteRatio'),
                processResponse(perfSlowQueries, 'perfSlowQueries'),
                processResponse(perfQueryTime, 'perfQueryTime'),
                processResponse(perfActiveQueries, 'perfActiveQueries'),
                processResponse(perfProfiler, 'perfProfiler'),
                processResponse(perfAll, 'perfAll')
            ]);

            // Sonuçları kategorilere dönüştür
            const processedData = processMongoDBResults(results);
            setMongoHealthChecks(processedData);

            const successfulRequests = Object.keys(results).length;
            message.success(`MongoDB health checks loaded successfully (${successfulRequests}/19 metrics available)`);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            if (errorMessage.includes('agent bulunamadı veya bağlantı kapalı')) {
                setMongoHealthChecks({});
                message.error('Cannot fetch health checks: Agent is not connected');

                Modal.error({
                    title: 'Agent Connection Error',
                    content: (
                        <div style={{ marginTop: '20px' }}>
                            <p>Unable to fetch MongoDB health checks because the agent is not connected to the server.</p>
                            <p>Please ensure that:</p>
                            <ul>
                                <li>The agent service is running on the server</li>
                                <li>There are no network connectivity issues</li>
                                <li>The agent has the necessary permissions</li>
                                <li>MongoDB is accessible to the agent</li>
                            </ul>
                        </div>
                    ),
                });
            } else {
                setMongoHealthChecks({});
                message.error(`Failed to load MongoDB health checks: ${errorMessage}`);
            }
        } finally {
            setLoadingMongoHealthChecks(false);
        }
    };

    // MSSQL Best Practices Analizi için
    const fetchMSSQLBestPractices = async (node: NodeData) => {
        if (!node) {
            console.error('Node data is missing for fetchMSSQLBestPractices');
            message.error('Node data is missing. Cannot fetch MSSQL best practices.');
            return;
        }

        setLoadingMssqlBestPractices(true);
        setMssqlBestPractices({});

        try {
            // agent_ önekini ekle
            const agentId = `agent_${node.Hostname}`;

            const url = `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/agents/${agentId}/mssql/bestpractices`;

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                credentials: 'include'
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to load MSSQL best practices');
            }

            const data = await response.json();

            if (data && data.status === "success" && data.results) {
                // Sonuçları kategorilere dönüştür
                const processedData = processMSSQLResults(data.results);
                setMssqlBestPractices(processedData);
                message.success('MSSQL best practices loaded successfully');
            } else {
                setMssqlBestPractices({});
                message.warning('No MSSQL best practices data available');
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            if (errorMessage.includes('agent bulunamadı veya bağlantı kapalı')) {
                setMssqlBestPractices({});
                message.error('Cannot fetch best practices: Agent is not connected');

                Modal.error({
                    title: 'Agent Connection Error',
                    content: (
                        <div style={{ marginTop: '20px' }}>
                            <p>Unable to fetch MSSQL best practices because the agent is not connected to the server.</p>
                            <p>Please ensure that:</p>
                            <ul>
                                <li>The agent service is running on the server</li>
                                <li>There are no network connectivity issues</li>
                                <li>The agent has the necessary permissions</li>
                                <li>SQL Server is accessible to the agent</li>
                            </ul>
                        </div>
                    ),
                });
            } else {
                setMssqlBestPractices({});
                message.error(`Failed to load MSSQL best practices: ${errorMessage}`);
            }
        } finally {
            setLoadingMssqlBestPractices(false);
        }
    };

    // MongoDB sonuçlarını anlamlı kategorilere dönüştürme
    const processMongoDBResults = (results: any): Record<string, MongoDBHealthCheck[]> => {
        const processedResults: Record<string, MongoDBHealthCheck[]> = {
            'system_health': [],
            'replica_set': [],
            'performance': [],
            'storage': [],
            'connections': [],
            'configuration': [],
            'oplog': []
        };

        // Helper function to get latest value from MongoDB metrics endpoint
        const getLatestValue = (data: any, field?: string): number => {
            if (!data) return 0;
            
            let dataArray: any[] = [];
            
            // Handle different response formats
            if (data.data) {
                if (Array.isArray(data.data)) {
                    // Format: {data: [...]}
                    dataArray = data.data;
                } else if (data.data.all_data && Array.isArray(data.data.all_data)) {
                    // Format: {data: {agent_id: "...", all_data: [...]}}
                    dataArray = data.data.all_data;
                }
            }
            
            if (!Array.isArray(dataArray) || dataArray.length === 0) {
                return 0;
            }
            
            // Filter by field if specified, otherwise get any field
            let filteredData = dataArray;
            if (field) {
                filteredData = dataArray.filter(item => item._field === field);
                if (filteredData.length === 0) {
                    // Fallback: if specific field not found, try any available data
                    filteredData = dataArray;
                }
            }
            
            // Sort by time to get the latest value
            filteredData.sort((a, b) => new Date(b._time).getTime() - new Date(a._time).getTime());
            
            // Return the latest value with validation
            const value = filteredData[0]?._value || 0;
            
            // Validate percentage values (should be 0-100, not 0-1 or crazy large numbers)
            if (field && (field.includes('percent') || field.includes('usage'))) {
                if (value > 100 && value < 1000) {
                    // Value might be in 0-1000 range, convert to percentage
                    return value / 10;
                } else if (value > 1000) {
                    // Value is abnormally high, probably wrong field or unit
                    console.warn(`Abnormal percentage value for ${field}:`, value);
                    return 0; // Return 0 to avoid showing wrong data
                } else if (value <= 1) {
                    // Value might be in 0-1 range (ratio), convert to percentage
                    return value * 100;
                }
            }
            
            return value;
        };

        // Helper function to get aggregated value (sum/average) from multiple fields
        const getAggregatedValue = (data: any, operation: 'sum' | 'avg' = 'avg'): number => {
            if (!data) return 0;
            
            let dataArray: any[] = [];
            
            if (data.data) {
                if (Array.isArray(data.data)) {
                    dataArray = data.data;
                } else if (data.data.all_data && Array.isArray(data.data.all_data)) {
                    dataArray = data.data.all_data;
                }
            }
            
            if (!Array.isArray(dataArray) || dataArray.length === 0) {
                return 0;
            }
            
            // Group by time to get latest values for each field
            const latestByField: { [field: string]: number } = {};
            const latestTime = dataArray.reduce((latest, item) => {
                const itemTime = new Date(item._time).getTime();
                return itemTime > latest ? itemTime : latest;
            }, 0);
            
            dataArray
                .filter(item => new Date(item._time).getTime() === latestTime)
                .forEach(item => {
                    latestByField[item._field] = item._value || 0;
                });
            
            const values = Object.values(latestByField);
            if (values.length === 0) return 0;
            
            if (operation === 'sum') {
                return values.reduce((sum, val) => sum + val, 0);
            } else {
                return values.reduce((sum, val) => sum + val, 0) / values.length;
            }
        };

        

        // System Health Checks with correct field names
        if (results.systemCpu) {
            const cpuUsage = getLatestValue(results.systemCpu, 'cpu_usage');
            
            processedResults.system_health.push({
                check_name: 'CPU Usage',
                status: cpuUsage > 80 ? 'Warning' : cpuUsage > 95 ? 'Critical' : 'OK',
                description: `Current CPU usage: ${cpuUsage.toFixed(1)}%`,
                recommendation: cpuUsage > 80 ? 
                    'High CPU usage detected. Consider scaling resources or optimizing queries.' : 
                    'CPU usage is within normal limits.',
                details: results.systemCpu
            });
        }

        if (results.systemMemory) {
            const memoryUsage = getLatestValue(results.systemMemory, 'memory_usage');
            
            processedResults.system_health.push({
                check_name: 'Memory Usage',
                status: memoryUsage > 85 ? 'Warning' : memoryUsage > 95 ? 'Critical' : 'OK',
                description: `Current memory usage: ${memoryUsage.toFixed(1)}%`,
                recommendation: memoryUsage > 85 ? 
                    'High memory usage detected. Consider increasing memory or optimizing data structures.' : 
                    'Memory usage is within normal limits.',
                details: results.systemMemory
            });
        }

        if (results.systemDisk) {
            const diskUsage = getLatestValue(results.systemDisk, 'disk_usage');
            
            processedResults.system_health.push({
                check_name: 'Disk Usage',
                status: diskUsage > 85 ? 'Warning' : diskUsage > 95 ? 'Critical' : 'OK',
                description: `Current disk usage: ${diskUsage.toFixed(1)}%`,
                recommendation: diskUsage > 85 ? 
                    'High disk usage detected. Consider cleaning up old data or expanding storage.' : 
                    'Disk usage is within normal limits.',
                details: results.systemDisk
            });
        }

        if (results.systemResponseTime) {
            const responseTime = getLatestValue(results.systemResponseTime, 'response_time_ms');
            processedResults.system_health.push({
                check_name: 'Response Time',
                status: responseTime > 100 ? 'Warning' : responseTime > 500 ? 'Critical' : 'OK',
                description: `Average response time: ${responseTime.toFixed(2)} ms`,
                recommendation: responseTime > 100 ? 
                    'High response time detected. Check network latency and query performance.' : 
                    'Response time is good.',
                details: results.systemResponseTime
            });
        }

                // Connection Health
        if (results.dbConnections) {
            const currentConnections = getLatestValue(results.dbConnections, 'current');
            const availableConnections = getLatestValue(results.dbConnections, 'available');
            const totalConnections = currentConnections + availableConnections;
            const usagePercentage = totalConnections > 0 ? (currentConnections / totalConnections) * 100 : 0;
            
            processedResults.connections.push({
                check_name: 'Connection Pool Health',
                status: usagePercentage > 80 ? 'Warning' : usagePercentage > 95 ? 'Critical' : 'OK',
                description: `Current: ${currentConnections}, Available: ${availableConnections.toFixed(0)}, Usage: ${usagePercentage.toFixed(1)}%`,
                recommendation: usagePercentage > 80 ? 
                    'High connection usage. Consider optimizing connection pooling or increasing limits.' : 
                    'Connection usage is within normal limits.',
                details: results.dbConnections
            });
        }

        // Storage Analysis
        if (results.dbStorage) {
            const dataSizeMB = getLatestValue(results.dbStorage, 'data_size_mb');
            const indexSizeMB = getLatestValue(results.dbStorage, 'index_size_mb');
            const totalSizeMB = dataSizeMB + indexSizeMB;
            
            processedResults.storage.push({
                check_name: 'Storage Efficiency',
                status: totalSizeMB > 10000 ? 'Warning' : 'OK', // Warning if > 10GB
                description: `Data: ${(dataSizeMB / 1024).toFixed(2)} GB, Index: ${(indexSizeMB / 1024).toFixed(2)} GB, Total: ${(totalSizeMB / 1024).toFixed(2)} GB`,
                recommendation: totalSizeMB > 10000 ? 
                    'Large storage usage detected. Monitor storage growth and plan for capacity expansion.' : 
                    'Storage usage is reasonable.',
                details: results.dbStorage
            });
        }

                // Performance Metrics
        if (results.perfQps) {
            const qps = getLatestValue(results.perfQps, 'qps');
            processedResults.performance.push({
                check_name: 'Queries Per Second',
                status: qps > 10000 ? 'Warning' : 'OK',
                description: `Current QPS: ${qps.toFixed(0)}`,
                recommendation: qps > 10000 ? 
                    'High query load detected. Consider query optimization and indexing.' : 
                    'Query load is manageable.',
                details: results.perfQps
            });
        }

        if (results.perfQueryTime) {
            const avgQueryTime = getLatestValue(results.perfQueryTime, 'avg_query_time_ms');
            processedResults.performance.push({
                check_name: 'Average Query Time',
                status: avgQueryTime > 100 ? 'Warning' : avgQueryTime > 500 ? 'Critical' : 'OK',
                description: `Average query time: ${avgQueryTime.toFixed(2)} ms`,
                recommendation: avgQueryTime > 100 ? 
                    'High average query time. Review slow queries and optimize indexes.' : 
                    'Query performance is good.',
                details: results.perfQueryTime
            });
        }

        if (results.perfSlowQueries) {
            const slowQueryCount = getLatestValue(results.perfSlowQueries, 'slow_query_count');
            processedResults.performance.push({
                check_name: 'Slow Query Analysis',
                status: slowQueryCount > 50 ? 'Warning' : slowQueryCount > 100 ? 'Critical' : 'OK',
                description: `Slow queries detected: ${slowQueryCount}`,
                recommendation: slowQueryCount > 50 ? 
                    'Multiple slow queries detected. Enable profiler and optimize problematic queries.' : 
                    'No significant slow query issues.',
                details: results.perfSlowQueries
            });
        }

        if (results.perfReadWriteRatio) {
            const readWriteRatio = getLatestValue(results.perfReadWriteRatio, 'read_write_ratio');
            const readPercentage = readWriteRatio * 100;
            const writePercentage = (1 - readWriteRatio) * 100;
            
            processedResults.performance.push({
                check_name: 'Read/Write Ratio',
                status: 'Info',
                description: `Read operations: ${readPercentage.toFixed(1)}%, Write operations: ${writePercentage.toFixed(1)}%`,
                recommendation: 'Monitor workload patterns for capacity planning.',
                details: results.perfReadWriteRatio
            });
        }

                // Replication Health
        if (results.replStatus) {
            const replHealth = getLatestValue(results.replStatus, 'replica_set_status');
            processedResults.replica_set.push({
                check_name: 'Replication Status',
                status: replHealth === 1 ? 'OK' : 'Warning',
                description: `Replication status: ${replHealth === 1 ? 'Healthy' : 'Issues detected'}`,
                recommendation: replHealth === 1 ? 
                    'Replication is functioning properly.' : 
                    'Check replica set configuration and member connectivity.',
                details: results.replStatus
            });
        }

        if (results.replLag) {
            const lagMs = getLatestValue(results.replLag, 'lag_ms_num');
            const lagSeconds = lagMs / 1000;
            processedResults.replica_set.push({
                check_name: 'Replication Lag',
                status: lagSeconds > 10 ? 'Warning' : lagSeconds > 60 ? 'Critical' : 'OK',
                description: `Current replication lag: ${lagSeconds.toFixed(1)} seconds (${lagMs} ms)`,
                recommendation: lagSeconds > 10 ? 
                    'High replication lag detected. Check network connectivity and secondary performance.' : 
                    'Replication lag is minimal.',
                details: results.replLag
            });
        }

        // Oplog Analysis
        if (results.replOplog) {
            const oplogSizeMB = getLatestValue(results.replOplog, 'oplog_size_mb');
            const oplogUsage = getLatestValue(results.replOplog, 'oplog_usage_percent');
            processedResults.oplog.push({
                check_name: 'Oplog Health',
                status: oplogUsage > 80 ? 'Warning' : oplogUsage > 95 ? 'Critical' : 'OK',
                description: `Oplog size: ${oplogSizeMB.toFixed(2)} MB, Usage: ${oplogUsage.toFixed(1)}%`,
                recommendation: oplogUsage > 80 ? 
                    'Oplog usage is high. Consider increasing oplog size for better replication resilience.' : 
                    'Oplog size is appropriate.',
                details: results.replOplog
            });
        }

        // Database Info
        if (results.dbInfo) {
            const dbCount = getLatestValue(results.dbInfo, 'database_count');
            const collectionCount = getLatestValue(results.dbInfo, 'collection_count');
            processedResults.configuration.push({
                check_name: 'Database Configuration',
                status: 'Info',
                description: `Databases: ${dbCount}, Collections: ${collectionCount}`,
                recommendation: 'Monitor database growth and organize collections efficiently.',
                details: results.dbInfo
            });
        }

        // Operations Analysis - Sum all operation types
        if (results.dbOperations) {
            const totalOperations = getAggregatedValue(results.dbOperations, 'sum');
            processedResults.performance.push({
                check_name: 'Database Operations',
                status: totalOperations > 50000 ? 'Warning' : 'OK',
                description: `Total operations rate: ${totalOperations.toFixed(0)} ops/sec`,
                recommendation: totalOperations > 50000 ? 
                    'High operation rate detected. Monitor for performance impact and consider scaling.' : 
                    'Operation rate is normal.',
                details: results.dbOperations
            });
        }

        // Operations Rate Analysis
        if (results.dbOperationsRate) {
            const operationsRate = getAggregatedValue(results.dbOperationsRate, 'avg');
            processedResults.performance.push({
                check_name: 'Operations Rate Trend',
                status: operationsRate > 1000 ? 'Warning' : 'OK',
                description: `Average operations rate: ${operationsRate.toFixed(0)} ops/sec`,
                recommendation: operationsRate > 1000 ? 
                    'High sustained operation rate. Consider optimizing queries and indexing.' : 
                    'Operations rate is sustainable.',
                details: results.dbOperationsRate
            });
        }

        // Active Queries Analysis
        if (results.perfActiveQueries) {
            const activeQueryCount = getLatestValue(results.perfActiveQueries, 'active_query_count');
            processedResults.performance.push({
                check_name: 'Active Queries',
                status: activeQueryCount > 100 ? 'Warning' : activeQueryCount > 500 ? 'Critical' : 'OK',
                description: `Currently active queries: ${activeQueryCount}`,
                recommendation: activeQueryCount > 100 ? 
                    'High number of active queries. Check for long-running or blocked queries.' : 
                    'Active query count is normal.',
                details: results.perfActiveQueries
            });
        }

        // Profiler Status
        if (results.perfProfiler) {
            const profilerEnabled = getLatestValue(results.perfProfiler, 'profiler_enabled');
            const slowOpThreshold = getLatestValue(results.perfProfiler, 'slow_op_threshold_ms');
            processedResults.configuration.push({
                check_name: 'Profiler Configuration',
                status: profilerEnabled ? 'Info' : 'Warning',
                description: `Profiler: ${profilerEnabled ? 'Enabled' : 'Disabled'}, Slow op threshold: ${slowOpThreshold} ms`,
                recommendation: profilerEnabled ? 
                    'Profiler is enabled for performance monitoring.' : 
                    'Consider enabling profiler for better performance insights.',
                details: results.perfProfiler
            });
        }

        return processedResults;
    };

    // Düz MSSQL sonuçlarını anlamlı kategorilere dönüştürme
    const processMSSQLResults = (results: any) => {
        const processedResults: Record<string, any[]> = {
            'server_configuration': [],
            'database_settings': [],
            'memory_cpu': [],
            'tempdb': [],
            'security': [],
            'performance': [],
            'high_availability': [],
            'io_performance': [],
            'memory_usage': [],
            'connection_analysis': []
        };

        // Server Configuration
        if (results.SqlServerVersion) {
            processedResults.server_configuration.push({
                check_name: 'SQL Server Version',
                status: 'OK',
                description: `Current version: ${results.SqlServerVersion}`,
                recommendation: 'Keep SQL Server updated with latest patches and security updates.'
            });
        }

        if (results.SqlServerEdition) {
            processedResults.server_configuration.push({
                check_name: 'SQL Server Edition',
                status: 'OK',
                description: `Current edition: ${results.SqlServerEdition}`,
                recommendation: 'Edition is appropriate for production use.'
            });
        }

        // Optimize for Ad Hoc Workloads
        if ('SqlServerConfigurations_optimize for ad hoc workloads_value_in_use' in results) {
            const adhocValue = results['SqlServerConfigurations_optimize for ad hoc workloads_value_in_use'];
            processedResults.server_configuration.push({
                check_name: 'Optimize for Ad Hoc Workloads',
                status: adhocValue === 1 ? 'OK' : 'Warning',
                description: `Current setting: ${adhocValue === 1 ? 'Enabled' : 'Disabled'}`,
                recommendation: adhocValue === 1 ?
                    'Current setting is optimal.' :
                    'Consider enabling to improve memory usage for ad hoc queries.'
            });
        }

        // Cost Threshold for Parallelism
        if ('SqlServerConfigurations_cost threshold for parallelism_value_in_use' in results) {
            const costThreshold = results['SqlServerConfigurations_cost threshold for parallelism_value_in_use'];
            processedResults.memory_cpu.push({
                check_name: 'Cost Threshold for Parallelism',
                status: costThreshold <= 5 ? 'Warning' : 'OK',
                description: `Current value: ${costThreshold}`,
                recommendation: costThreshold <= 5 ?
                    'Consider increasing to a value between 25-50 to avoid excessive parallelism.' :
                    'Current setting is appropriate.'
            });
        }

        // Max Degree of Parallelism
        if ('SqlServerConfigurations_max degree of parallelism_value_in_use' in results) {
            const maxDOP = results['SqlServerConfigurations_max degree of parallelism_value_in_use'];
            processedResults.memory_cpu.push({
                check_name: 'Max Degree of Parallelism (MAXDOP)',
                status: maxDOP === 0 ? 'Warning' : 'OK',
                description: `Current value: ${maxDOP === 0 ? 'Unlimited' : maxDOP}`,
                recommendation: maxDOP === 0 ?
                    'Consider setting a value based on CPU cores (typically ≤ 8).' :
                    'Current setting is appropriate.'
            });
        }

        // Memory Configuration
        if ('SqlServerConfigurations_max server memory (MB)_value_in_use' in results &&
            'SqlServerConfigurations_min server memory (MB)_value_in_use' in results) {
            const maxMemory = results['SqlServerConfigurations_max server memory (MB)_value_in_use'];
            const minMemory = results['SqlServerConfigurations_min server memory (MB)_value_in_use'];
            const isMaxMemoryDefault = maxMemory >= 2147483647;

            processedResults.memory_cpu.push({
                check_name: 'Memory Configuration',
                status: isMaxMemoryDefault ? 'Warning' : 'OK',
                description: `Max memory: ${maxMemory === 2147483647 ? 'Unlimited' : `${maxMemory} MB`}, Min memory: ${minMemory} MB`,
                recommendation: isMaxMemoryDefault ?
                    'Configure max server memory to leave room for the OS (typically 80% of total system memory).' :
                    'Memory configuration looks appropriate.'
            });
        }

        // TempDB Configuration
        if (('TempDBConfiguration_actual_file_count' in results || 'tempdb_file_count' in results || 'TempDBPerformance_file_configuration_file_count' in results) &&
            ('TempDBConfiguration_recommended_file_count' in results || 'tempdb_cpu_count' in results || 'TempDBPerformance_file_configuration_recommended_file_count' in results)) {

            // Get file count - try all possible field names
            const actualCount = results['TempDBConfiguration_actual_file_count'] ||
                results['tempdb_file_count'] ||
                results['TempDBPerformance_file_configuration_file_count'] ||
                results['TempDBConfiguration_files_count'] ||
                results['tempdb_files_count'] ||
                results['TempDBPerformance_file_configuration_files_count'] || 0;

            // Get recommended file count
            const recommendedCount = results['TempDBConfiguration_recommended_file_count'] ||
                results['tempdb_cpu_count'] ||
                results['TempDBPerformance_file_configuration_recommended_file_count'] || 4;

            // Check if configuration is optimal
            const isOptimal = results['tempdb_is_optimal'] ||
                results['TempDBPerformance_file_configuration_is_file_count_optimal'] ||
                (actualCount >= recommendedCount);

            // Get recommendation if available, but ensure it's logical
            const tempdbRecommendation = results['tempdb_recommendation'] ||
                (results['TempDBPerformance_file_configuration_optimization_needed'] && actualCount < recommendedCount) ?
                `TempDB file count (${actualCount}) is less than recommended (${recommendedCount}). Consider adding more files.` :
                (results['TempDBPerformance_file_configuration_optimization_needed'] && actualCount > recommendedCount) ?
                    `TempDB file count (${actualCount}) exceeds recommended (${recommendedCount}). Current configuration is acceptable.` :
                    null;

            processedResults.tempdb.push({
                check_name: 'TempDB File Count',
                status: isOptimal ? 'OK' : 'Warning',
                description: `Current files: ${actualCount}, Recommended: ${recommendedCount}`,
                recommendation: tempdbRecommendation ||
                    (isOptimal ?
                        'Current file count is appropriate.' :
                        `Consider increasing TempDB files to ${recommendedCount} to reduce allocation contention.`)
            });

            // TempDB File Size uniformity check - check all possible field names
            const fileCount = results['TempDBConfiguration_files_count'] ||
                results['tempdb_files_count'] ||
                results['TempDBPerformance_file_configuration_files_count'] || 0;

            const sizesMismatch = results['TempDBPerformance_file_configuration_is_size_equal'] === false ||
                (function () {
                    // Check manually if we have file info
                    let firstSize = null;

                    for (let i = 0; i < fileCount; i++) {
                        const currentSize = results[`TempDBConfiguration_files_${i}_size_mb`] ||
                            results[`tempdb_files_${i}_size_mb`];

                        if (!currentSize) continue;

                        if (firstSize === null) {
                            firstSize = currentSize;
                        } else if (currentSize !== firstSize) {
                            return true;
                        }
                    }
                    return false;
                })();

            if (fileCount > 1) {
                processedResults.tempdb.push({
                    check_name: 'TempDB File Size Uniformity',
                    status: sizesMismatch ? 'Warning' : 'OK',
                    description: sizesMismatch ? 'TempDB file sizes are not uniform' : 'TempDB file sizes are uniform',
                    recommendation: sizesMismatch ?
                        'For optimal performance, all TempDB data files should be the same size.' :
                        'TempDB data files have the same size, which is optimal.'
                });
            }

            // Add TempDB location check
            const tempdbLocation = results['TempDBConfiguration_files_0_physical_name'] ||
                results['tempdb_files_0_physical_name'];

            if (tempdbLocation) {
                const systemDriveRegex = /^[cC]:/;
                const isOnSystemDrive = systemDriveRegex.test(tempdbLocation);

                processedResults.tempdb.push({
                    check_name: 'TempDB Location',
                    status: isOnSystemDrive ? 'Warning' : 'OK',
                    description: `TempDB is located at: ${tempdbLocation}`,
                    recommendation: isOnSystemDrive ?
                        'Consider moving TempDB files to a dedicated drive for better performance and to avoid contention with the OS.' :
                        'TempDB is properly located on a non-system drive.'
                });
            }

            // Add TempDB size check
            const totalSize = results['tempdb_total_size_mb'] ||
                results['TempDBPerformance_file_configuration_total_size_mb'] ||
                (function () {
                    // Calculate manually if we have file info
                    let total = 0;
                    for (let i = 0; i < fileCount; i++) {
                        const size = results[`TempDBConfiguration_files_${i}_size_mb`] ||
                            results[`tempdb_files_${i}_size_mb`] || 0;
                        total += size;
                    }
                    return total;
                })();

            if (totalSize) {
                const isSmall = totalSize < 1024; // Less than 1GB is considered small

                processedResults.tempdb.push({
                    check_name: 'TempDB Size',
                    status: isSmall ? 'Warning' : 'OK',
                    description: `Total TempDB size: ${totalSize} MB`,
                    recommendation: isSmall ?
                        'Consider increasing the initial size of TempDB files to avoid frequent auto-growth events.' :
                        'TempDB size appears adequate.'
                });
            }

            // Add TempDB contention check if available
            if ('TempDBPerformance_contention_contention_level' in results) {
                const contentionLevel = results['TempDBPerformance_contention_contention_level'];
                const hasPfsGamContention = results['TempDBPerformance_contention_pfs_gam_contention_exists'] === true;

                let status = 'OK';
                if (contentionLevel === 'High') {
                    status = 'Critical';
                } else if (contentionLevel === 'Medium' || contentionLevel === 'Moderate') {
                    status = 'Warning';
                } else if (contentionLevel === 'Low' && hasPfsGamContention) {
                    status = 'Warning';
                }

                processedResults.tempdb.push({
                    check_name: 'TempDB Contention',
                    status: status,
                    description: `Contention Level: ${contentionLevel}, PFS/GAM Contention: ${hasPfsGamContention ? 'Yes' : 'No'}`,
                    recommendation: status !== 'OK' ?
                        'TempDB contention detected. Consider adding more TempDB files equal to the number of logical processors (up to 8), using trace flag 1118, and ensuring even file sizes.' :
                        'No significant TempDB contention detected.'
                });
            }

            // Add TempDB top consumers if available
            if ('TempDBPerformance_top_consumers_count' in results && results['TempDBPerformance_top_consumers_count'] > 0) {
                const topConsumer = {
                    session_id: results['TempDBPerformance_top_consumers_0_session_id'],
                    allocated_kb: results['TempDBPerformance_top_consumers_0_allocated_kb'],
                    login_name: results['TempDBPerformance_top_consumers_0_login_name'],
                    query_text: results['TempDBPerformance_top_consumers_0_query_text']
                };

                const hasHighConsumption = topConsumer.allocated_kb > 1024000; // More than 1GB

                if (hasHighConsumption) {
                    processedResults.tempdb.push({
                        check_name: 'TempDB Usage',
                        status: 'Warning',
                        description: `High TempDB usage detected by session ${topConsumer.session_id} (${topConsumer.login_name}): ${Math.round(topConsumer.allocated_kb / 1024)} MB`,
                        recommendation: 'Investigate queries consuming high TempDB space. Consider optimizing these queries or increasing TempDB size.'
                    });
                }
            }
        }

        // IO Performance Analysis
        if ('IOPerformance_database_files_count' in results) {
            const fileCount = results['IOPerformance_database_files_count'] || 0;

            // Check for high-latency files
            const highLatencyFiles: string[] = [];
            let highestStallMs = 0;
            let highestStallFile = '';

            for (let i = 0; i < fileCount; i++) {
                const avgReadStall = results[`IOPerformance_database_files_${i}_avg_read_stall_ms`] || 0;
                const avgWriteStall = results[`IOPerformance_database_files_${i}_avg_write_stall_ms`] || 0;
                const fileName = results[`IOPerformance_database_files_${i}_file_name`] || '';
                const dbName = results[`IOPerformance_database_files_${i}_database_name`] || '';
                const ioPerformance = results[`IOPerformance_database_files_${i}_io_performance`] || '';
                const totalStall = results[`IOPerformance_database_files_${i}_io_stall_ms`] || 0;

                // Check if this file has high latency (read or write stall > 20ms)
                if (avgReadStall > 20 || avgWriteStall > 20) {
                    highLatencyFiles.push(`${dbName}.${fileName} (Read: ${avgReadStall}ms, Write: ${avgWriteStall}ms)`);
                }

                // Track the file with highest stall time
                if (totalStall > highestStallMs) {
                    highestStallMs = totalStall;
                    highestStallFile = `${dbName}.${fileName}`;
                }
            }

            // Add check for high-latency files
            if (highLatencyFiles.length > 0) {
                processedResults.io_performance.push({
                    check_name: 'File IO Latency',
                    status: 'Warning',
                    description: `${highLatencyFiles.length} files with high latency detected: ${highLatencyFiles.join(', ')}`,
                    recommendation: 'Investigate disk subsystem performance for these files. Consider moving them to faster storage or redistributing IO load.'
                });
            } else {
                processedResults.io_performance.push({
                    check_name: 'File IO Latency',
                    status: 'OK',
                    description: 'No files with high IO latency detected.',
                    recommendation: 'Current IO performance for database files is good.'
                });
            }

            // Add check for drive performance if available
            if ('IOPerformance_drive_stats_count' in results && results['IOPerformance_drive_stats_count'] > 0) {
                const driveLetter = results['IOPerformance_drive_stats_0_drive_letter'] || '';
                const drivePerformance = results['IOPerformance_drive_stats_0_io_performance'] || '';
                const avgReadStall = results['IOPerformance_drive_stats_0_avg_read_stall_ms'] || 0;
                const avgWriteStall = results['IOPerformance_drive_stats_0_avg_write_stall_ms'] || 0;

                const isGoodPerformance = drivePerformance === 'Very Good' || drivePerformance === 'Good';
                const isHighLatency = avgReadStall > 20 || avgWriteStall > 20;

                processedResults.io_performance.push({
                    check_name: 'Drive Performance',
                    status: isGoodPerformance && !isHighLatency ? 'OK' : 'Warning',
                    description: `Drive ${driveLetter}: ${drivePerformance} (Read: ${avgReadStall}ms, Write: ${avgWriteStall}ms)`,
                    recommendation: isGoodPerformance && !isHighLatency ?
                        'Drive performance is good.' :
                        'Consider upgrading storage subsystem or redistributing database files across multiple drives.'
                });
            }

            // Add check for IO wait statistics if available
            if ('IOPerformance_io_wait_stats_count' in results && results['IOPerformance_io_wait_stats_count'] > 0) {
                // Look for typical IO-related wait types (PAGEIOLATCH_*, WRITELOG)
                const ioWaitTypes = [];

                for (let i = 0; i < Math.min(results['IOPerformance_io_wait_stats_count'], 10); i++) {
                    const waitType = results[`IOPerformance_io_wait_stats_${i}_wait_type`] || '';
                    const avgWaitTime = results[`IOPerformance_io_wait_stats_${i}_avg_wait_time_ms`] || 0;

                    if (waitType.includes('PAGEIOLATCH_') || waitType === 'WRITELOG') {
                        ioWaitTypes.push(`${waitType} (${avgWaitTime}ms)`);
                    }
                }

                if (ioWaitTypes.length > 0) {
                    processedResults.io_performance.push({
                        check_name: 'IO Wait Statistics',
                        status: 'Info',
                        description: `Primary IO wait types: ${ioWaitTypes.join(', ')}`,
                        recommendation: 'Monitor these IO wait types for potential performance bottlenecks.'
                    });
                }
            }

            // Check for pending IO if available
            if ('IOPerformance_pending_io_count' in results) {
                const pendingIOCount = results['IOPerformance_pending_io_count'] || 0;

                if (pendingIOCount > 10) {
                    processedResults.io_performance.push({
                        check_name: 'Pending IO Requests',
                        status: 'Warning',
                        description: `${pendingIOCount} pending IO requests detected`,
                        recommendation: 'High number of pending IO requests indicates potential storage bottlenecks. Investigate storage performance.'
                    });
                }
            }
        }

        // Memory Usage Analysis
        if ('MemoryUsage_memory_clerks_count' in results) {
            const clerkCount = results['MemoryUsage_memory_clerks_count'] || 0;

            // Calculate total memory used by top clerks
            let totalMemoryMB = 0;
            const topClerks: string[] = [];

            for (let i = 0; i < Math.min(clerkCount, 10); i++) {
                const clerkName = results[`MemoryUsage_memory_clerks_${i}_name`] || '';
                const clerkType = results[`MemoryUsage_memory_clerks_${i}_type`] || '';
                const memoryUsed = results[`MemoryUsage_memory_clerks_${i}_pages_mb`] || 0;

                totalMemoryMB += memoryUsed;

                if (memoryUsed > 100) {
                    topClerks.push(`${clerkName} (${clerkType}): ${memoryUsed} MB`);
                }
            }

            // Check Buffer Pool memory clerk specifically
            const bufferPoolMemory = results['MemoryUsage_memory_clerks_2_pages_mb'] || 0; // Usually the buffer pool is index 2
            const bufferPoolVirtualCommitted = results['MemoryUsage_memory_clerks_2_virtual_memory_committed_mb'] || 0;
            const bufferPoolVirtualReserved = results['MemoryUsage_memory_clerks_2_virtual_memory_reserved_mb'] || 0;

            // Add check for memory clerk distribution
            processedResults.memory_usage.push({
                check_name: 'Memory Clerk Distribution',
                status: 'Info',
                description: `Total memory used by top 10 memory clerks: ${totalMemoryMB} MB`,
                recommendation: 'Monitor these memory clerks for memory pressure, especially the Buffer Pool.'
            });

            // Add check for Buffer Pool specifically
            if (bufferPoolMemory > 0) {
                processedResults.memory_usage.push({
                    check_name: 'Buffer Pool Memory',
                    status: 'Info',
                    description: `Buffer Pool: ${bufferPoolMemory} MB used, ${bufferPoolVirtualCommitted} MB committed, ${bufferPoolVirtualReserved} MB reserved`,
                    recommendation: 'The Buffer Pool is the main memory consumer for SQL Server. Ensure max server memory is configured appropriately.'
                });
            }

            // Check for memory-consuming queries if available
            if ('MemoryUsage_memory_consuming_queries_count' in results && results['MemoryUsage_memory_consuming_queries_count'] > 0) {
                const queryCount = results['MemoryUsage_memory_consuming_queries_count'];

                // Check the top memory-consuming query
                const grantedMemory = results['MemoryUsage_memory_consuming_queries_0_granted_memory_mb'] || 0;
                const idealMemory = results['MemoryUsage_memory_consuming_queries_0_ideal_memory_mb'] || 0;
                const efficiency = results['MemoryUsage_memory_consuming_queries_0_memory_grant_efficiency'] || 0;

                if (grantedMemory > 100 || (grantedMemory > 0 && efficiency < 50)) {
                    // Truncate query text for display
                    let queryText = results['MemoryUsage_memory_consuming_queries_0_query_text'] || '';
                    if (queryText.length > 100) {
                        queryText = queryText.substring(0, 100) + '...';
                    }

                    processedResults.memory_usage.push({
                        check_name: 'Memory-Consuming Queries',
                        status: efficiency < 50 ? 'Warning' : 'Info',
                        description: `Top query uses ${grantedMemory} MB (${efficiency}% efficiency)`,
                        recommendation: efficiency < 50 ?
                            'Query is requesting more memory than it actually needs. Review query and update statistics.' :
                            'Monitor these queries for potential optimization opportunities.'
                    });
                }
            }

            // Add PLE status based on existing data
            if ('SystemMetrics_buffer_cache_page_life_expectancy' in results) {
                const ple = results['SystemMetrics_buffer_cache_page_life_expectancy'];
                const pleStatus = results['SystemMetrics_buffer_cache_page_life_expectancy_status'] ||
                    (ple < 300 ? 'Poor' : ple < 900 ? 'Fair' : 'Good');

                processedResults.memory_usage.push({
                    check_name: 'Page Life Expectancy (PLE)',
                    status: pleStatus === 'Good' ? 'OK' : pleStatus === 'Fair' ? 'Warning' : 'Critical',
                    description: `Current PLE: ${ple} seconds (Status: ${pleStatus})`,
                    recommendation: pleStatus === 'Good' ?
                        'PLE is healthy.' :
                        'Low PLE indicates memory pressure. Consider adding more memory or optimizing memory-intensive queries.'
                });
            }
        }

        // Security Settings
        if ('SecuritySettings_auth_mode_integrated_security_only' in results) {
            const integratedOnly = results['SecuritySettings_auth_mode_integrated_security_only'];

            processedResults.security.push({
                check_name: 'Authentication Mode',
                status: integratedOnly ? 'OK' : 'Warning',
                description: `Current mode: ${integratedOnly ? 'Windows Authentication' : 'Mixed Mode'}`,
                recommendation: integratedOnly ?
                    'Windows Authentication mode is more secure.' :
                    'If possible, consider using Windows Authentication for improved security.'
            });
        }

        // Privileged Logins Count
        if ('SecuritySettings_privileged_logins_sysadmin_count' in results) {
            const sysadminCount = results['SecuritySettings_privileged_logins_sysadmin_count'];

            processedResults.security.push({
                check_name: 'Sysadmin Role Membership',
                status: sysadminCount <= 5 ? 'OK' : 'Warning',
                description: `Current sysadmin members: ${sysadminCount}`,
                recommendation: sysadminCount <= 5 ?
                    'The number of sysadmin members is reasonable.' :
                    'Consider reducing the number of users with sysadmin privileges for improved security.'
            });
        }

        // Transparent Data Encryption
        if ('SecuritySettings_transparent_data_encryption_count' in results) {
            const tdeCount = results['SecuritySettings_transparent_data_encryption_count'];
            const dbCount = Object.keys(results).filter(key => key.startsWith('Databases_') && key.endsWith('_state')).length;

            processedResults.security.push({
                check_name: 'Transparent Data Encryption (TDE)',
                status: tdeCount > 0 ? 'OK' : 'Warning',
                description: `Databases with TDE: ${tdeCount} out of ${dbCount}`,
                recommendation: tdeCount > 0 ?
                    'TDE is being used which helps protect data at rest.' :
                    'Consider implementing TDE for databases containing sensitive information.'
            });
        }

        // Database Auto Shrink Check
        const databaseNames = new Set<string>();
        Object.keys(results).forEach(key => {
            if (key.startsWith('Databases_') && key.includes('_state')) {
                const dbName = key.split('_')[1];
                databaseNames.add(dbName);
            }
        });

        let autoShrinkEnabled = false;
        databaseNames.forEach(dbName => {
            const autoShrinkKey = `Databases_${dbName}_is_auto_shrink_on`;
            if (results[autoShrinkKey] === true) {
                autoShrinkEnabled = true;
            }
        });

        processedResults.database_settings.push({
            check_name: 'Auto Shrink Setting',
            status: autoShrinkEnabled ? 'Critical' : 'OK',
            description: autoShrinkEnabled ? 'Auto Shrink is enabled on one or more databases' : 'Auto Shrink is disabled on all databases',
            recommendation: autoShrinkEnabled ?
                'Disable Auto Shrink on all databases to prevent performance issues and file fragmentation.' :
                'Auto Shrink is correctly disabled on all databases.'
        });

        // Recovery Model Check
        const simpleRecoveryModelDbs: string[] = [];
        databaseNames.forEach(dbName => {
            const recoveryModelKey = `Databases_${dbName}_recovery_model`;
            if (results[recoveryModelKey] === 'SIMPLE') {
                simpleRecoveryModelDbs.push(dbName);
            }
        });

        if (simpleRecoveryModelDbs.length > 0) {
            processedResults.database_settings.push({
                check_name: 'Recovery Model',
                status: 'Warning',
                description: `${simpleRecoveryModelDbs.length} database(s) using SIMPLE recovery model: ${simpleRecoveryModelDbs.join(', ')}`,
                recommendation: 'Consider using FULL recovery model for production databases to enable point-in-time recovery.'
            });
        } else {
            processedResults.database_settings.push({
                check_name: 'Recovery Model',
                status: 'OK',
                description: 'All databases are using FULL or BULK_LOGGED recovery model',
                recommendation: 'Current recovery model settings are appropriate for production environments.'
            });
        }

        // Missing Indexes Check
        if ('MissingIndexes_count' in results) {
            const missingIndexCount = results['MissingIndexes_count'];

            processedResults.performance.push({
                check_name: 'Missing Indexes',
                status: missingIndexCount === 0 ? 'OK' : 'Warning',
                description: `Missing indexes detected: ${missingIndexCount}`,
                recommendation: missingIndexCount === 0 ?
                    'No missing indexes detected.' :
                    'Consider creating the recommended indexes to improve query performance.'
            });
        }

        // Buffer Cache Health
        if ('SystemMetrics_buffer_cache_page_life_expectancy' in results) {
            const ple = results['SystemMetrics_buffer_cache_page_life_expectancy'];
            const pleStatus = results['SystemMetrics_buffer_cache_page_life_expectancy_status'] ||
                (ple < 300 ? 'Poor' : ple < 900 ? 'Fair' : 'Good');

            processedResults.performance.push({
                check_name: 'Buffer Cache Health',
                status: pleStatus === 'Good' ? 'OK' : pleStatus === 'Fair' ? 'Warning' : 'Critical',
                description: `Page Life Expectancy (PLE): ${ple} seconds`,
                recommendation: pleStatus === 'Good' ?
                    'Buffer cache health is good.' :
                    'Consider adding more memory to the server or optimizing memory-intensive queries.'
            });
        }

        // SQL Agent Job Health
        if ('SystemMetrics_sql_agent_jobs_failed_count' in results && 'SystemMetrics_sql_agent_jobs_total_count' in results) {
            const failedCount = results['SystemMetrics_sql_agent_jobs_failed_count'];
            const totalCount = results['SystemMetrics_sql_agent_jobs_total_count'];

            processedResults.performance.push({
                check_name: 'SQL Agent Job Health',
                status: failedCount === 0 ? 'OK' : 'Warning',
                description: `Failed jobs: ${failedCount} out of ${totalCount}`,
                recommendation: failedCount === 0 ?
                    'All SQL Agent jobs are running successfully.' :
                    'Investigate and fix failed SQL Agent jobs.'
            });
        }

        // Wait Statistics Analysis
        if ('WaitStatistics_wait_stats_count' in results && results['WaitStatistics_wait_stats_count'] > 0) {
            const waitCount = results['WaitStatistics_wait_stats_count'];
            const topWaits = [];

            for (let i = 0; i < Math.min(waitCount, 3); i++) {
                const waitType = results[`WaitStatistics_wait_stats_${i}_wait_type`];
                const waitTimeMs = results[`WaitStatistics_wait_stats_${i}_wait_time_ms`];

                // Format wait time for display (convert to seconds or minutes if large)
                let formattedWaitTime = `${waitTimeMs} ms`;
                if (waitTimeMs > 60000) {
                    formattedWaitTime = `${(waitTimeMs / 60000).toFixed(1)} minutes`;
                } else if (waitTimeMs > 1000) {
                    formattedWaitTime = `${(waitTimeMs / 1000).toFixed(1)} seconds`;
                }

                topWaits.push(`${waitType}: ${formattedWaitTime}`);
            }

            // Determine if wait statistics indicate any specific issues
            let waitStatus = 'OK';
            let waitRecommendation = 'Current wait statistics do not indicate any specific performance issues.';

            // Check for common problematic wait types
            const waitTypes = [];
            for (let i = 0; i < waitCount; i++) {
                waitTypes.push(results[`WaitStatistics_wait_stats_${i}_wait_type`]);
            }

            if (waitTypes.some(w => w.includes('PAGEIOLATCH') || w.includes('IO_COMPLETION'))) {
                waitStatus = 'Warning';
                waitRecommendation = 'I/O related waits are high. Consider improving disk subsystem performance.';
            } else if (waitTypes.some(w => w.includes('PAGELATCH') || w.includes('CXPACKET'))) {
                waitStatus = 'Warning';
                waitRecommendation = 'Contention or excessive parallelism detected. Review MAXDOP and tempdb configuration.';
            } else if (waitTypes.some(w => w.includes('LCK_') || w.includes('LOCK'))) {
                waitStatus = 'Warning';
                waitRecommendation = 'Lock contention detected. Review query patterns and indexing.';
            }

            processedResults.performance.push({
                check_name: 'Wait Statistics',
                status: waitStatus,
                description: `Top wait types: ${topWaits.join(', ')}`,
                recommendation: waitRecommendation
            });
        }

        // High Availability Status
        if ('HighAvailabilityStatus_is_hadr_enabled' in results) {
            const hadrEnabled = results['HighAvailabilityStatus_is_hadr_enabled'];

            processedResults.high_availability.push({
                check_name: 'AlwaysOn Availability Groups',
                status: hadrEnabled ? 'OK' : 'Warning',
                description: hadrEnabled ? 'AlwaysOn Availability Groups is enabled' : 'AlwaysOn Availability Groups is not enabled',
                recommendation: hadrEnabled ?
                    'Verify your Availability Group configurations and failover settings.' :
                    'Consider implementing AlwaysOn Availability Groups for high availability.'
            });
        }

        // Add Orphaned Users Check
        if ('SecuritySettings_orphaned_users_count' in results) {
            const orphanedUsersCount = results['SecuritySettings_orphaned_users_count'];
            const orphanedUsers = [];

            // Process each orphaned user
            for (let i = 0; i < orphanedUsersCount; i++) {
                const user = {
                    username: results[`SecuritySettings_orphaned_users_${i}_username`],
                    database: results[`SecuritySettings_orphaned_users_${i}_database_name`],
                    userType: results[`SecuritySettings_orphaned_users_${i}_user_type`],
                    createDate: new Date(results[`SecuritySettings_orphaned_users_${i}_create_date`]).toLocaleDateString(),
                    modifyDate: new Date(results[`SecuritySettings_orphaned_users_${i}_modify_date`]).toLocaleDateString()
                };
                orphanedUsers.push(user);
            }

            // Group users by database
            const usersByDatabase = orphanedUsers.reduce((acc: any, user: any) => {
                if (!acc[user.database]) {
                    acc[user.database] = [];
                }
                acc[user.database].push(user);
                return acc;
            }, {});

            // Create description with grouped users
            let description = 'Orphaned users found in the following databases:\n';
            Object.entries(usersByDatabase).forEach(([database, users]) => {
                description += `\n${database} (${(users as any[]).length} users):\n`;
                (users as any[]).forEach((user: any) => {
                    description += `- ${user.username} (${user.userType})\n`;
                });
            });

            processedResults.security.push({
                check_name: 'Orphaned Users',
                status: orphanedUsersCount > 0 ? 'Warning' : 'OK',
                description: orphanedUsersCount > 0 ? description : 'No orphaned users found.',
                recommendation: orphanedUsersCount > 0 ?
                    'Clean up orphaned users to maintain security. Use sp_revokedbaccess to remove orphaned users or sp_change_users_login to fix SID mismatches.' :
                    'No action needed.'
            });
        }

        // Add Fragmented Indexes Check
        if ('FragmentedIndexes_count' in results) {
            const fragmentedIndexCount = results['FragmentedIndexes_count'];
            const fragmentedIndexes = [];

            // Process each fragmented index
            for (let i = 0; i < fragmentedIndexCount; i++) {
                const index = {
                    database: results[`FragmentedIndexes_${i}_database_name`],
                    schema: results[`FragmentedIndexes_${i}_schema_name`],
                    table: results[`FragmentedIndexes_${i}_table_name`],
                    indexName: results[`FragmentedIndexes_${i}_index_name`],
                    fragmentation: results[`FragmentedIndexes_${i}_fragmentation_percent`],
                    pageCount: results[`FragmentedIndexes_${i}_page_count`],
                    recommendedAction: results[`FragmentedIndexes_${i}_recommended_action`]
                };
                fragmentedIndexes.push(index);
            }

            // Sort indexes by fragmentation percentage
            fragmentedIndexes.sort((a, b) => b.fragmentation - a.fragmentation);

            // Create description with sorted indexes
            let description = 'Fragmented indexes found:\n';
            fragmentedIndexes.forEach((index) => {
                description += `\n${index.database}.${index.schema}.${index.table}.${index.indexName}:\n`;
                description += `- Fragmentation: ${index.fragmentation.toFixed(2)}%\n`;
                description += `- Size: ${index.pageCount} pages\n`;
                description += `- Action: ${index.recommendedAction}\n`;
            });

            processedResults.performance.push({
                check_name: 'Index Fragmentation',
                status: fragmentedIndexCount > 0 ? 'Warning' : 'OK',
                description: fragmentedIndexCount > 0 ? description : 'No significantly fragmented indexes found.',
                recommendation: fragmentedIndexCount > 0 ?
                    'Rebuild or reorganize fragmented indexes to improve query performance. Consider implementing a regular maintenance plan.' :
                    'Index fragmentation is within acceptable levels.'
            });
        }

        // Database Autogrowth Analysis
        if ('AutogrowthAnalysis_overall_status' in results) {
            const overallStatus = results['AutogrowthAnalysis_overall_status'];
            const criticalIssues = results['AutogrowthAnalysis_critical_issues_count'] || 0;
            const warningsCount = results['AutogrowthAnalysis_warnings_count'] || 0;
            const totalFiles = results['AutogrowthAnalysis_total_files'] || 0;
            const disabledGrowthCount = results['AutogrowthAnalysis_disabled_growth_count'] || 0;
            const percentGrowthCount = results['AutogrowthAnalysis_percent_growth_count'] || 0;
            const fixedGrowthCount = results['AutogrowthAnalysis_fixed_growth_count'] || 0;
            const recommendationsCount = results['AutogrowthAnalysis_recommendations_count'] || 0;

            // Determine status based on analysis results
            let status = 'OK';
            if (criticalIssues > 0) {
                status = 'Critical';
            } else if (warningsCount > 0) {
                status = 'Warning';
            } else if (overallStatus !== 'GOOD') {
                status = 'Warning';
            }

            // Build description with breakdown
            let description = `Analyzed ${totalFiles} database files. Overall status: ${overallStatus}`;
            if (disabledGrowthCount > 0 || percentGrowthCount > 0 || fixedGrowthCount > 0) {
                description += `\n\nBreakdown:`;
                if (disabledGrowthCount > 0) {
                    description += `\n- Files with disabled autogrowth: ${disabledGrowthCount}`;
                }
                if (percentGrowthCount > 0) {
                    description += `\n- Files using percentage growth: ${percentGrowthCount}`;
                }
                if (fixedGrowthCount > 0) {
                    description += `\n- Files using fixed size growth: ${fixedGrowthCount}`;
                }
            }
            if (criticalIssues > 0) {
                description += `\n\nCritical issues found: ${criticalIssues}`;
            }
            if (warningsCount > 0) {
                description += `\nWarnings: ${warningsCount}`;
            }

            // Build recommendation from available recommendations
            let recommendation = '';
            if (recommendationsCount > 0) {
                const recommendations = [];
                for (let i = 0; i < recommendationsCount; i++) {
                    const rec = results[`AutogrowthAnalysis_recommendations_${i}`];
                    if (rec) {
                        recommendations.push(rec);
                    }
                }
                recommendation = recommendations.join('\n\n');
            }

            // Fallback recommendation if none provided
            if (!recommendation) {
                if (status === 'OK') {
                    recommendation = 'Database autogrowth settings are properly configured.';
                } else {
                    recommendation = 'Review database autogrowth settings. Use fixed size growth (64-512MB) instead of percentage growth for better performance.';
                }
            }

            processedResults.database_settings.push({
                check_name: 'Database Autogrowth Configuration',
                status: status,
                description: description,
                recommendation: recommendation
            });
        }

        // Connection Analysis
        if ('ConnectionAnalysis_summary_connection_health' in results) {
            // Connection Health Summary
            const connectionHealth = results['ConnectionAnalysis_summary_connection_health'];
            const totalConnections = results['ConnectionAnalysis_summary_total_connections'] || 0;
            const totalActiveConnections = results['ConnectionAnalysis_summary_total_active_connections'] || 0;
            const totalIdleConnections = results['ConnectionAnalysis_summary_total_idle_connections'] || 0;
            const globalIdlePercentage = results['ConnectionAnalysis_summary_global_idle_percentage'] || 0;

            let connectionStatus = 'OK';
            if (connectionHealth === 'Critical') {
                connectionStatus = 'Critical';
            } else if (connectionHealth === 'Warning' || globalIdlePercentage > 80) {
                connectionStatus = 'Warning';
            }

            processedResults.connection_analysis.push({
                check_name: 'Connection Health Summary',
                status: connectionStatus,
                description: `Overall connection health: ${connectionHealth}\nTotal connections: ${totalConnections}\nActive connections: ${totalActiveConnections}\nIdle connections: ${totalIdleConnections} (${globalIdlePercentage.toFixed(1)}%)`,
                recommendation: connectionStatus === 'OK' ?
                    'Connection pool management is within acceptable limits.' :
                    'High idle connection percentage detected. Review connection pooling strategies and application connection management.'
            });

            // Connection Pool Efficiency Analysis
            const connectionsByAppCount = results['ConnectionAnalysis_connections_by_application_count'] || 0;
            const poorEfficiencyApps = [];
            const goodEfficiencyApps = [];

            for (let i = 0; i < connectionsByAppCount; i++) {
                const efficiency = results[`ConnectionAnalysis_connections_by_application_${i}_connection_efficiency`];
                const programName = results[`ConnectionAnalysis_connections_by_application_${i}_program_name`];
                const hostName = results[`ConnectionAnalysis_connections_by_application_${i}_host_name`];
                const totalConns = results[`ConnectionAnalysis_connections_by_application_${i}_total_connection_count`];

                if (efficiency === 'Poor' && totalConns > 50) {
                    poorEfficiencyApps.push(`${programName} on ${hostName} (${totalConns} connections)`);
                } else if (efficiency === 'Good') {
                    goodEfficiencyApps.push(`${programName} on ${hostName} (${totalConns} connections)`);
                }
            }

            const efficiencyStatus = poorEfficiencyApps.length > 5 ? 'Critical' : poorEfficiencyApps.length > 0 ? 'Warning' : 'OK';

            processedResults.connection_analysis.push({
                check_name: 'Connection Pool Efficiency',
                status: efficiencyStatus,
                description: `Applications with poor efficiency: ${poorEfficiencyApps.length}\nApplications with good efficiency: ${goodEfficiencyApps.length}\n\n${poorEfficiencyApps.length > 0 ? 'Poor efficiency applications:\n' + poorEfficiencyApps.slice(0, 5).join('\n') + (poorEfficiencyApps.length > 5 ? `\n... and ${poorEfficiencyApps.length - 5} more` : '') : 'All applications show good connection efficiency.'}`,
                recommendation: efficiencyStatus === 'OK' ?
                    'Connection efficiency is good across all applications.' :
                    'Multiple applications show poor connection efficiency. Implement proper connection pooling and review connection timeout settings.'
            });

            // Top Connection Consumers Analysis
            const topConsumersCount = results['ConnectionAnalysis_top_connection_consumers_count'] || 0;
            const topConsumers = [];

            for (let i = 0; i < Math.min(topConsumersCount, 5); i++) {
                const programName = results[`ConnectionAnalysis_top_connection_consumers_${i}_program_name`];
                const hostName = results[`ConnectionAnalysis_top_connection_consumers_${i}_host_name`];
                const totalConns = results[`ConnectionAnalysis_top_connection_consumers_${i}_total_connection_count`];
                const idleConns = results[`ConnectionAnalysis_top_connection_consumers_${i}_idle_connection_count`];
                const idlePercentage = results[`ConnectionAnalysis_top_connection_consumers_${i}_idle_percentage`];

                topConsumers.push(`${programName} on ${hostName}: ${totalConns} total (${idleConns} idle - ${idlePercentage.toFixed(1)}%)`);
            }

            const maxConnections = topConsumersCount > 0 ? results['ConnectionAnalysis_top_connection_consumers_0_total_connection_count'] : 0;
            const consumersStatus = maxConnections > 1000 ? 'Critical' : maxConnections > 500 ? 'Warning' : 'OK';

            processedResults.connection_analysis.push({
                check_name: 'Top Connection Consumers',
                status: consumersStatus,
                description: `Top ${Math.min(topConsumersCount, 5)} connection consumers:\n\n${topConsumers.join('\n')}`,
                recommendation: consumersStatus === 'Critical' ?
                    'Extremely high connection usage detected. Immediately review connection pooling and consider implementing connection limits.' :
                    consumersStatus === 'Warning' ?
                        'High connection usage detected. Review connection pooling settings and optimize application connection management.' :
                        'Connection usage is within normal limits.'
            });

            // Suspicious Connection Patterns
            const suspiciousCount = results['ConnectionAnalysis_summary_suspicious_applications_count'] || 0;
            const suspiciousApps = [];

            for (let i = 0; i < Math.min(suspiciousCount, 10); i++) {
                const suspiciousApp = results[`ConnectionAnalysis_summary_suspicious_applications_${i}`];
                if (suspiciousApp && !suspiciousApp.includes('Excessive connections')) {
                    suspiciousApps.push(suspiciousApp);
                }
            }

            const suspiciousStatus = suspiciousCount > 10 ? 'Critical' : suspiciousCount > 5 ? 'Warning' : suspiciousCount > 0 ? 'Info' : 'OK';

            processedResults.connection_analysis.push({
                check_name: 'Suspicious Connection Patterns',
                status: suspiciousStatus,
                description: suspiciousCount > 0 ?
                    `${suspiciousCount} suspicious connection patterns detected:\n\n${suspiciousApps.slice(0, 8).join('\n')}${suspiciousCount > 8 ? `\n... and ${suspiciousCount - 8} more patterns` : ''}` :
                    'No suspicious connection patterns detected.',
                recommendation: suspiciousStatus === 'Critical' ?
                    'Critical: Multiple applications show suspicious connection patterns. Immediate investigation required.' :
                    suspiciousStatus === 'Warning' ?
                        'Several applications show suspicious connection patterns. Review and optimize connection handling.' :
                        suspiciousStatus === 'Info' ?
                            'Some connection patterns detected. Monitor these applications for potential improvements.' :
                            'All connection patterns appear normal.'
            });

            // Idle Connection Analysis
            const idleAnalysisStatus = globalIdlePercentage > 95 ? 'Critical' : globalIdlePercentage > 85 ? 'Warning' : 'OK';

            processedResults.connection_analysis.push({
                check_name: 'Idle Connection Analysis',
                status: idleAnalysisStatus,
                description: `Global idle connection percentage: ${globalIdlePercentage.toFixed(2)}%\nTotal idle connections: ${totalIdleConnections} out of ${totalConnections}\nActive connections: ${totalActiveConnections}`,
                recommendation: idleAnalysisStatus === 'Critical' ?
                    'Extremely high idle connection percentage. Implement aggressive connection timeout policies and review application connection lifecycle management.' :
                    idleAnalysisStatus === 'Warning' ?
                        'High idle connection percentage. Consider reducing connection timeout values and implementing connection pooling best practices.' :
                        'Idle connection percentage is within acceptable limits.'
            });
        }

        return processedResults;
    };

    // MSSQL Best Practices Modal
    const getCategoryTitle = (category: string): string => {
        switch (category) {
            case 'server_configuration':
                return 'Server Configuration';
            case 'database_settings':
                return 'Database Settings';
            case 'memory_cpu':
                return 'Memory & CPU Configuration';
            case 'tempdb':
                return 'TempDB Configuration';
            case 'security':
                return 'Security Settings';
            case 'performance':
                return 'Performance Analysis';
            case 'high_availability':
                return 'High Availability';
            case 'io_performance':
                return 'IO Performance';
            case 'memory_usage':
                return 'Memory Usage';
            case 'connection_analysis':
                return 'Connection Analysis';
            default:
                return category.charAt(0).toUpperCase() + category.slice(1);
        }
    };

    const getCategoryIcon = (category: string) => {
        switch (category) {
            case 'server_configuration':
                return <DatabaseOutlined />;
            case 'database_settings':
                return <SettingOutlined />;
            case 'memory_cpu':
                return <CodeOutlined />;
            case 'tempdb':
                return <FileOutlined />;
            case 'security':
                return <SafetyOutlined />;
            case 'performance':
                return <DashboardOutlined />;
            case 'high_availability':
                return <CloudServerOutlined />;
            case 'io_performance':
                return <CodeOutlined />;
            case 'memory_usage':
                return <DatabaseOutlined />;
            case 'connection_analysis':
                return <CloudServerOutlined />;
            default:
                return <InfoCircleOutlined />;
        }
    };

    // MongoDB kategori başlıkları
    const getMongoDBCategoryTitle = (category: string): string => {
        switch (category) {
            case 'system_health':
                return 'System Health';
            case 'replica_set':
                return 'Replica Set Health';
            case 'performance':
                return 'Performance Metrics';
            case 'storage':
                return 'Storage Analysis';
            case 'connections':
                return 'Connection Pool';
            case 'configuration':
                return 'Database Configuration';
            case 'oplog':
                return 'Oplog Management';
            default:
                return category.charAt(0).toUpperCase() + category.slice(1).replace('_', ' ');
        }
    };

    const getMongoDBCategoryIcon = (category: string) => {
        switch (category) {
            case 'system_health':
                return <DashboardOutlined />;
            case 'replica_set':
                return <CloudServerOutlined />;
            case 'performance':
                return <DashboardOutlined />;
            case 'storage':
                return <FileOutlined />;
            case 'connections':
                return <CodeOutlined />;
            case 'configuration':
                return <SettingOutlined />;
            case 'oplog':
                return <DatabaseOutlined />;
            default:
                return <InfoCircleOutlined />;
        }
    };

    const analyzeConfigurations = async () => {
        if (!selectedNode) return;

        setAnalyzing(true);

        // Helper function to check if we need to reset the counter
        const shouldResetCounter = (lastResetDate: string | null): boolean => {
            if (!lastResetDate) return true;

            const lastDate = new Date(lastResetDate);
            const currentDate = new Date();

            return (
                lastDate.getFullYear() !== currentDate.getFullYear() ||
                lastDate.getMonth() !== currentDate.getMonth() ||
                lastDate.getDate() !== currentDate.getDate()
            );
        };

        const needsReset = shouldResetCounter(lastResetDate);
        const currentCount = needsReset ? 0 : dailyUsageCount;

        // Check if the user has reached their daily limit
        if (!needsReset && currentCount >= dailyLimit) {
            Modal.warning({
                title: 'Daily AI Analysis Limit Reached',
                content: (
                    <div style={{ padding: '20px 0' }}>
                        <p>You've reached your limit of {dailyLimit} AI analyses for today.</p>
                        <p>The limit will reset at midnight.</p>
                    </div>
                ),
                okText: 'Ok',
                maskClosable: true
            });
            setAnalyzing(false);
            return;
        }

        try {
            // Prepare config data to send to AI
            const configForAI = configItems.map(item => {
                return {
                    parameter: item.name,
                    value: item.value,
                    is_default: item.is_default,
                    category: item.category || 'general'
                };
            });

            // Get system resources
            const systemInfo = {
                hostname: selectedNode.Hostname,
                total_memory: selectedNode.TotalMemory || selectedNode.totalMemory,
                total_vcpu: selectedNode.TotalVCPU || selectedNode.totalVCPU,
                version: selectedNode.Version,
                node_status: selectedNode.NodeStatus,
                service_status: selectedNode.ServiceStatus
            };

            // Check if we have any configuration items
            if (configItems.length === 0) {
                Modal.error({
                    title: 'No Configuration Data',
                    content: 'Cannot perform AI analysis without configuration data. Please ensure the agent is connected and configuration is loaded.',
                });
                return;
            }

            try {
                const response = await fetch('https://o4szcpxekyj6hvcdx5ktqy2c.agents.do-ai.run/api/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer cifsE4HtBVWFEzyXrh5E5vbU-v66wK6I'
                    },
                    body: JSON.stringify({
                        messages: [{
                            role: "user",
                            content: `I need you to analyze PostgreSQL configuration parameters for the server ${selectedNode.Hostname} and suggest optimizations based on best practices. 
                            
                            System Information:
                            - Total Memory: ${byteToGB(systemInfo.total_memory)}
                            - Total vCPUs: ${systemInfo.total_vcpu}
                            - PostgreSQL Version: ${systemInfo.version}
                            
                            Current Configuration Parameters:
                            ${JSON.stringify(configForAI, null, 2)}
                            
                            Please provide:
                            1. An analysis of each parameter that could be optimized
                            2. Recommended values based on the server's resources
                            3. Brief explanation of why each change would improve performance
                            4. Any missing parameters that should be added for optimal performance`
                        }],
                        temperature: 0,
                        top_p: 0.01,
                        stream: false,
                        filter_kb_content_by_query_metadata: false,
                        include_retrieval_info: false,
                        provide_citations: true
                    })
                });

                if (!response.ok) {
                    throw new Error(`AI service responded with status: ${response.status}`);
                }

                const data = await response.json();

                if (!data || !data.choices || !data.choices[0] || !data.choices[0].message) {
                    throw new Error('Invalid response format from AI service');
                }

                // AI yanıtını parse et
                const aiResponse = data.choices[0].message.content;
                const recommendations: ConfigItem[] = [];

                // Regex ile numaralandırılmış maddeleri bul
                const regexPattern = /\d+\.\s+\*\*([\w_]+)\*\*:\s+The current value is ([^,]+),.*Recommended value:\s+([^\.]+)\.\s+(.*)/g;
                let match;

                while ((match = regexPattern.exec(aiResponse)) !== null) {
                    const paramName = match[1];
                    const currentValue = match[2];
                    const recommendedValue = match[3];
                    const explanation = match[4];

                    recommendations.push({
                        name: paramName,
                        value: recommendedValue,
                        description: explanation,
                        category: 'AI Recommendation'
                    });
                }

                setAiRecommendations(recommendations);

                // Increment usage in Redux
                store.dispatch(incrementUsage());

                // Show success message
                message.success(`AI analysis completed. ${recommendations.length} optimization recommendations found.`);

            } catch (networkError) {
                Modal.error({
                    title: 'AI Service Connection Error',
                    content: (
                        <div style={{ marginTop: '20px' }}>
                            <p>Unable to connect to the AI service. This might be due to:</p>
                            <ul>
                                <li>Network connectivity issues</li>
                                <li>AI service being temporarily unavailable</li>
                                <li>Firewall or security settings blocking the connection</li>
                            </ul>
                            <p>Please try again later or contact support if the issue persists.</p>
                        </div>
                    ),
                });
                console.error('AI service connection error:', networkError);
            }

        } catch (error) {
            console.error('Error during AI analysis:', error);
            message.error('Failed to analyze configuration with AI');
        } finally {
            setAnalyzing(false);
        }
    };

    const handleNodeAnalysis = async (record: NodeData) => {
        setSelectedNode(record);

        if (record.Type === 'PostgreSQL') {
            // PostgreSQL analizi için
            // Modal'ı açmadan önce state'i temizleyelim
            setConfigItems([]);

            // Önce modal'ı açalım
            setConfigModalVisible(true);

            // Küçük bir gecikme ile config'i getirelim (modal açıldıktan sonra)
            setTimeout(() => {
                fetchPostgresqlConfig(record);
            }, 100);
        } else if (record.Type === 'MSSQL') {
            // MSSQL analizi için
            setMssqlBestPractices({});

            // MSSQL modal'ını açalım
            setMssqlModalVisible(true);

            // Best practices'i getirelim
            setTimeout(() => {
                fetchMSSQLBestPractices(record);
            }, 100);
        } else if (record.Type === 'MongoDB') {
            // MongoDB analizi için
            setMongoHealthChecks({});

            // MongoDB modal'ını açalım
            setMongoModalVisible(true);

            // Health checks'i getirelim
            setTimeout(() => {
                fetchMongoDBHealthChecks(record);
            }, 100);
        }
    };

    const getNodeStatusColor = (record: NodeData): string => {
        const status = record.NodeStatus?.toUpperCase();
        if (status === 'PRIMARY' || status === 'MASTER') return 'green';
        if (status === 'SECONDARY' || status === 'SLAVE') return 'blue';
        return 'default';
    };

    const getServiceStatusColor = (status?: string): string => {
        if (!status) return 'default';
        switch (status.toLowerCase()) {
            case 'running':
                return 'green';
            case 'stopped':
                return 'red';
            case 'warning':
                return 'orange';
            default:
                return 'default';
        }
    };

    const columns: ColumnsType<NodeData> = [
        {
            title: 'Type',
            dataIndex: 'Type',
            key: 'type',
            render: (_, record) => (
                <Space>
                    {record.Type === 'PostgreSQL' ? (
                        <>
                            <PostgresqlIcon />
                            PostgreSQL
                        </>
                    ) : record.Type === 'MSSQL' ? (
                        <>
                            <MssqlIcon />
                            MSSQL
                        </>
                    ) : (
                        <>
                            <MongoDBIcon />
                            MongoDB
                        </>
                    )}
                </Space>
            )
        },
        {
            title: 'Cluster Name',
            dataIndex: 'ClusterName',
            key: 'clusterName',
            sorter: (a, b) => a.ClusterName.localeCompare(b.ClusterName)
        },
        {
            title: 'Hostname',
            dataIndex: 'Hostname',
            key: 'hostname',
            sorter: (a, b) => a.Hostname.localeCompare(b.Hostname)
        },
        {
            title: 'Node Status',
            dataIndex: 'NodeStatus',
            key: 'nodeStatus',
            render: (_, record: NodeData) => (
                <Tag color={getNodeStatusColor(record)}>
                    {record.NodeStatus}
                </Tag>
            )
        },
        {
            title: 'Service Status',
            dataIndex: 'ServiceStatus',
            key: 'serviceStatus',
            render: (status: string) => (
                <Tag color={getServiceStatusColor(status)}>
                    {status || 'Unknown'}
                </Tag>
            )
        },
        {
            title: 'Version',
            dataIndex: 'Version',
            key: 'version',
            render: (version: string, record: NodeData) =>
                record.Type === 'MSSQL' ? shortenMssqlVersion(version) : version
        },
        {
            title: 'Total VCPU',
            dataIndex: 'TotalVCPU',
            key: 'totalVCPU',
            render: (vcpu: number) => vcpu || 'N/A'
        },
        {
            title: 'Total Memory',
            dataIndex: 'TotalMemory',
            key: 'totalMemory',
            render: (memory: number) => byteToGB(memory)
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_: unknown, record: NodeData) => (
                <Button
                    type="primary"
                    onClick={() => handleNodeAnalysis(record)}
                    icon={<SearchOutlined />}
                >
                    Analyze
                </Button>
            )
        }
    ];

    const analysisColumns: ColumnsType<AnalysisResult> = [
        {
            title: 'Severity',
            dataIndex: 'severity',
            key: 'severity',
            render: (severity: SeverityType) => (
                <Tag color={severityColors[severity]}>
                    {severity.toString().toUpperCase()}
                </Tag>
            )
        },
        {
            title: 'Message',
            dataIndex: 'message',
            key: 'message'
        },
        {
            title: 'Recommendation',
            dataIndex: 'recommendation',
            key: 'recommendation'
        }
    ];

    const renderAnalysisResults = () => {
        return (
            <Table
                dataSource={analysisResults}
                columns={analysisColumns}
                pagination={false}
            />
        );
    };

    // AI yanıtından önerileri ve check isimlerini düzgün çıkarmak için fonksiyon
    const extractRecommendationsFromAI = (text: string): Record<string, string> => {
        console.log("Extracting recommendations from AI response:", text.substring(0, 200) + "...");
        const result: Record<string, string> = {};

        // Markdown ve diğer gereksiz kısımları temizle
        let cleanedText = text;
        if (cleanedText.includes('```')) {
            cleanedText = cleanedText.replace(/```json\n/g, '').replace(/```\n/g, '').replace(/```/g, '');
        }

        try {
            // Ana check isimlerini ve içeriklerini bul
            // Regex: "Check Name": {içerik} yapısını eşleştir
            const checkPatternRegex = /"([^"]+)":\s*{([^{]*(?:{[^}]*}[^{]*)*)}/g;
            let checkMatch;

            // Tüm check'leri bul
            while ((checkMatch = checkPatternRegex.exec(cleanedText)) !== null) {
                const checkName = checkMatch[1];
                const checkContent = checkMatch[2];

                console.log(`Found check: "${checkName}" with content length: ${checkContent.length}`);

                // Check içeriğini işle
                let formattedContent = '';

                // Importance
                const importanceMatch = checkContent.match(/"importance":\s*"([^"]*)"/);
                if (importanceMatch) {
                    formattedContent += `Importance: ${importanceMatch[1]}\n\n`;
                }

                // Remediation Steps
                const remediationMatch = checkContent.match(/"remediation_steps":\s*\[(.*?)\]/s);
                if (remediationMatch) {
                    formattedContent += 'Remediation Steps:\n';

                    // Steps içindeki her string'i çıkar: ["Step 1", "Step 2", ...]
                    const stepsText = remediationMatch[1];
                    const stepRegex = /"([^"]*)"/g;
                    let stepMatch;
                    let stepIndex = 1;

                    while ((stepMatch = stepRegex.exec(stepsText)) !== null) {
                        formattedContent += `${stepIndex}. ${stepMatch[1]}\n`;
                        stepIndex++;
                    }

                    formattedContent += '\n';
                }

                // Potential Impacts
                const impactsMatch = checkContent.match(/"potential_impacts":\s*"([^"]*)"/);
                if (impactsMatch) {
                    formattedContent += `Potential Impacts: ${impactsMatch[1]}`;
                }

                // Sonuçları kaydet
                result[checkName] = formattedContent.trim();
            }

            // Eğer hiçbir check bulunamadıysa, alternatif yaklaşımı dene
            if (Object.keys(result).length === 0) {
                console.log("No checks found with primary pattern, trying alternative approach");

                // Alternatif yaklaşım: check isimlerini önce bul, sonra içeriklerini eşleştir
                const checkNamesRegex = /"([^"]+)":\s*{/g;
                const checkNames: string[] = [];
                let nameMatch;

                while ((nameMatch = checkNamesRegex.exec(cleanedText)) !== null) {
                    checkNames.push(nameMatch[1]);
                }

                console.log("Found check names:", checkNames);

                // Şimdi her özelliği bul ve ilgili check'e ata
                checkNames.forEach(checkName => {
                    // Check içeriğini belirli bir check ismi için ara
                    const checkRegex = new RegExp(`"${checkName}":\\s*{([^}]*)}`, 's');
                    const contentMatch = cleanedText.match(checkRegex);

                    if (contentMatch) {
                        const checkContent = contentMatch[1];

                        // İçeriği formatla
                        let formattedContent = '';

                        // Importance
                        const importanceRegex = /"importance":\s*"([^"]*)"/;
                        const importanceMatch = checkContent.match(importanceRegex);
                        if (importanceMatch) {
                            formattedContent += `Importance: ${importanceMatch[1]}\n\n`;
                        }

                        // Remediation Steps - eğer var ise
                        const stepsRegex = /"remediation_steps":\s*\[(.*?)\]/s;
                        const stepsMatch = checkContent.match(stepsRegex);
                        if (stepsMatch) {
                            formattedContent += 'Remediation Steps:\n';

                            // Steps içindeki her string'i çıkar: ["Step 1", "Step 2", ...]
                            const stepsText = stepsMatch[1];
                            const stepRegex = /"([^"]*)"/g;
                            let stepMatch;
                            let stepIndex = 1;

                            while ((stepMatch = stepRegex.exec(stepsText)) !== null) {
                                formattedContent += `${stepIndex}. ${stepMatch[1]}\n`;
                                stepIndex++;
                            }

                            formattedContent += '\n';
                        }

                        // Potential Impacts
                        const impactsRegex = /"potential_impacts":\s*"([^"]*)"/;
                        const impactsMatch = checkContent.match(impactsRegex);
                        if (impactsMatch) {
                            formattedContent += `Potential Impacts: ${impactsMatch[1]}`;
                        }

                        // Sonuçları kaydet
                        result[checkName] = formattedContent.trim();
                        console.log(`Processed check: "${checkName}" with formatted content`);
                    }
                });
            }

            console.log("Extracted recommendations for checks:", Object.keys(result));
            return result;
        } catch (error) {
            console.error("Error in extractRecommendationsFromAI:", error);
            return {};
        }
    };

    // AI tarafından verilen tavsiye anahtarlarını mssqlBestPractices'teki check_name'lerle eşleştirmek için helper fonksiyon
    const matchCheckNames = (aiCheckName: string, mssqlCheckNames: string[]): string | null => {
        // Tam eşleşme varsa
        if (mssqlCheckNames.includes(aiCheckName)) {
            return aiCheckName;
        }

        // Case-insensitive eşleşme
        const lowerCaseAiCheck = aiCheckName.toLowerCase();
        for (const checkName of mssqlCheckNames) {
            if (checkName.toLowerCase() === lowerCaseAiCheck) {
                return checkName;
            }
        }

        // Yaklaşık eşleşme (substring match)
        for (const checkName of mssqlCheckNames) {
            if (checkName.toLowerCase().includes(lowerCaseAiCheck) ||
                lowerCaseAiCheck.includes(checkName.toLowerCase())) {
                console.log(`Substring match: "${aiCheckName}" matched with "${checkName}"`);
                return checkName;
            }
        }

        // Key kelimelerle eşleşme dene
        const keyWords = ['optimize', 'memory', 'parallelism', 'threshold', 'maxdop', 'authentication', 'encrypt', 'wait'];
        for (const word of keyWords) {
            if (lowerCaseAiCheck.includes(word)) {
                for (const checkName of mssqlCheckNames) {
                    if (checkName.toLowerCase().includes(word)) {
                        console.log(`Keyword match: "${aiCheckName}" matched with "${checkName}" via "${word}"`);
                        return checkName;
                    }
                }
            }
        }

        // Eşleşme bulunamadı
        return null;
    };

    // Seçilen kategori için AI analizi yapma fonksiyonu
    const analyzeMSSQLCategoryWithAI = async (category: string) => {
        // Kullanım limiti kontrolü
        const shouldResetCounter = (lastResetDate: string | null): boolean => {
            if (!lastResetDate) return true;

            const lastDate = new Date(lastResetDate);
            const currentDate = new Date();

            return (
                lastDate.getFullYear() !== currentDate.getFullYear() ||
                lastDate.getMonth() !== currentDate.getMonth() ||
                lastDate.getDate() !== currentDate.getDate()
            );
        };

        const needsReset = shouldResetCounter(lastResetDate);
        const currentCount = needsReset ? 0 : dailyUsageCount;

        // Check if the user has reached their daily limit
        if (!needsReset && currentCount >= dailyLimit) {
            Modal.warning({
                title: 'Daily AI Analysis Limit Reached',
                content: (
                    <div style={{ padding: '20px 0' }}>
                        <p>You've reached your limit of {dailyLimit} AI analyses for today.</p>
                        <p>The limit will reset at midnight.</p>
                    </div>
                ),
                okText: 'Ok',
                maskClosable: true
            });
            return;
        }

        setAnalyzingMssqlAI(true);
        setSelectedCategory(category);

        // Kategoriye ait check'leri bul
        const categoryItems = mssqlBestPractices[category] || [];

        // Sadece uyarı/kritik durumundaki check'leri filtrele
        const warningOrCriticalItems = categoryItems.filter(
            (item: any) => item.status === 'Warning' || item.status === 'Critical'
        );

        // Eğer analiz edilecek bir şey yoksa kullanıcıyı bilgilendir ve dur
        if (warningOrCriticalItems.length === 0) {
            message.info(`No warning or critical issues found in ${getCategoryTitle(category)} category.`);
            setAnalyzingMssqlAI(false);
            return;
        }

        // AI analizine gönderilecek veriyi hazırla
        const bestPracticesData: any[] = [];
        let recommendations: Record<string, string> = {};

        warningOrCriticalItems.forEach((item: any) => {
            bestPracticesData.push({
                category: getCategoryTitle(category),
                check: item.check_name,
                status: item.status,
                description: item.description,
                current_recommendation: item.recommendation
            });
        });

        try {
            // AI API'sine istek gönder
            const response = await fetch('https://o4szcpxekyj6hvcdx5ktqy2c.agents.do-ai.run/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer cifsE4HtBVWFEzyXrh5E5vbU-v66wK6I'
                },
                body: JSON.stringify({
                    messages: [{
                        role: "user",
                        content: `I need you to analyze the following SQL Server best practices check results for ${getCategoryTitle(category)} category and provide more detailed recommendations for each check that has a status of "Warning" or "Critical".
                        
                        Server Information:
                        - Hostname: ${selectedNode?.Hostname}
                        - Server Version: ${selectedNode?.Version}
                        - Total vCPU: ${selectedNode?.TotalVCPU || selectedNode?.totalVCPU || 'Unknown'} cores
                        - Total RAM: ${byteToGB(selectedNode?.TotalMemory || selectedNode?.totalMemory || 0)}
                        
                        Best Practices Results for ${getCategoryTitle(category)}:
                        ${JSON.stringify(bestPracticesData, null, 2)}
                        
                        Please provide:
                        1. For each check with status "Warning" or "Critical", provide a more detailed recommendation including:
                           - Explanation of why this setting is important (max 2 sentences)
                           - Specific steps to remediate the issue (max 3 bullet points)
                           - Potential impacts of making the change (max 1 sentence)
                        2. Format your response as a JSON object with the check name as the key and your recommendation as the value
                        3. Only include checks that need attention (Warning or Critical status)
                        4. Keep each recommendation under 200 words
                        5. Be concise and practical
                        
                        IMPORTANT: Return a valid JSON object ONLY, with no other text. Keep responses short and actionable.
                        `
                    }],
                    temperature: 0,
                    top_p: 0.01,
                    max_tokens: 2000,
                    stream: false,
                    filter_kb_content_by_query_metadata: false,
                    include_retrieval_info: false,
                    provide_citations: false
                })
            });

            if (!response.ok) {
                throw new Error(`AI service responded with status: ${response.status}`);
            }

            const data = await response.json();

            if (!data || !data.choices || !data.choices[0] || !data.choices[0].message) {
                throw new Error('Invalid response format from AI service');
            }

            // AI yanıtını parse et
            const aiResponse = data.choices[0].message.content;
            console.log("Raw AI response:", aiResponse.substring(0, 200) + "...");

            // Check if response appears to be truncated
            if (isResponseTruncated(aiResponse)) {
                console.warn("AI response appears to be truncated for category:", category);
                message.warning(`AI analysis for ${getCategoryTitle(category)} may be incomplete due to length limits.`);
            }

            // Ham yanıttan önerileri çıkar - yeni fonksiyonumuzu kullan
            const aiRecommendationsRaw = extractRecommendationsFromAI(aiResponse);
            console.log("Extracted raw recommendations:", Object.keys(aiRecommendationsRaw));

            if (Object.keys(aiRecommendationsRaw).length === 0) {
                console.warn("Could not extract any recommendations from AI response");
                throw new Error("Failed to extract recommendations from AI response");
            }

            // Sadece kategori içindeki check isimlerini al
            const categoryCheckNames = warningOrCriticalItems.map((item: any) => item.check_name);

            // Eşleştirme işlemi: AI önerilerini doğru check_name'lere map et
            const mappedRecommendations: Record<string, string> = {};

            // AI yanıtındaki her anahtar için kategori içindeki check_name ile eşleştir
            Object.entries(aiRecommendationsRaw).forEach(([aiCheckName, recommendation]) => {
                const matchedCheckName = matchCheckNames(aiCheckName, categoryCheckNames);

                if (matchedCheckName) {
                    mappedRecommendations[matchedCheckName] = recommendation as string;
                    console.log(`Matched AI check "${aiCheckName}" to category check "${matchedCheckName}"`);
                } else {
                    console.warn(`Could not match AI check "${aiCheckName}" to any category check`);
                }
            });

            // Eğer eşleşme bulunamazsa, orijinal anahtarları kullan
            if (Object.keys(mappedRecommendations).length === 0) {
                console.warn("Using raw recommendations as no mappings were found");
                recommendations = aiRecommendationsRaw;
            } else {
                recommendations = mappedRecommendations;
            }

            // Önerileri mevcut önerilerle birleştir
            const updatedRecommendations = { ...mssqlAIRecommendations, ...recommendations };
            setMssqlAIRecommendations(updatedRecommendations);

            // Increment usage in Redux
            store.dispatch(incrementUsage());

            message.success(`AI analysis for ${getCategoryTitle(category)} completed successfully`);
        } catch (error) {
            console.error('Error during AI analysis:', error);

            // Create default recommendations for warning/critical items in this category
            warningOrCriticalItems.forEach((item: any) => {
                recommendations[item.check_name] = "AI analysis failed. Please consult SQL Server documentation for best practices regarding this setting.";
            });

            const updatedRecommendations = { ...mssqlAIRecommendations, ...recommendations };
            setMssqlAIRecommendations(updatedRecommendations);

            message.error('Failed to analyze with AI. Please try again later.');
        } finally {
            setAnalyzingMssqlAI(false);
        }
    };

    // Ana analiz fonksiyonu - tüm kategorileri sırayla analiz eder
    const analyzeMSSQLWithAI = async () => {
        // Kullanım limiti kontrolü
        const shouldResetCounter = (lastResetDate: string | null): boolean => {
            if (!lastResetDate) return true;

            const lastDate = new Date(lastResetDate);
            const currentDate = new Date();

            return (
                lastDate.getFullYear() !== currentDate.getFullYear() ||
                lastDate.getMonth() !== currentDate.getMonth() ||
                lastDate.getDate() !== currentDate.getDate()
            );
        };

        const needsReset = shouldResetCounter(lastResetDate);
        const currentCount = needsReset ? 0 : dailyUsageCount;

        // Check if the user has reached their daily limit
        if (!needsReset && currentCount >= dailyLimit) {
            Modal.warning({
                title: 'Daily AI Analysis Limit Reached',
                content: (
                    <div style={{ padding: '20px 0' }}>
                        <p>You've reached your limit of {dailyLimit} AI analyses for today.</p>
                        <p>The limit will reset at midnight.</p>
                    </div>
                ),
                okText: 'Ok',
                maskClosable: true
            });
            return;
        }

        // Önerileri temizle
        setMssqlAIRecommendations({});

        // Tüm kategorileri teker teker analiz et
        message.info('Starting AI analysis for all categories. This may take a while...');
        setAnalyzingMssqlAI(true);

        try {
            // Sırayla her kategoriyi analiz et
            const categories = Object.keys(mssqlBestPractices);

            for (const category of categories) {
                // Her kategoride warning/critical olanları sayalım
                const warningOrCriticalCount = (mssqlBestPractices[category] || []).filter(
                    (item: any) => item.status === 'Warning' || item.status === 'Critical'
                ).length;

                // Eğer warning/critical yoksa bu kategoriyi atla
                if (warningOrCriticalCount === 0) {
                    console.log(`Skipping analysis for ${category} - no issues found`);
                    continue;
                }

                message.info(`Analyzing ${getCategoryTitle(category)} category...`);

                // Kategoriyi analiz et
                await analyzeMSSQLCategoryWithAI(category);

                // Her kategori bittiğinde küçük bir bekleme süresi ekleyelim, rate limiting'i önlemek için
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            message.success('AI analysis completed for all categories');
        } catch (error) {
            console.error('Error during full AI analysis:', error);
            message.error('An error occurred during analysis. Some categories may not have been analyzed.');
        } finally {
            setAnalyzingMssqlAI(false);
        }
    };

    // Belirli bir check için AI analizi yapma fonksiyonu
    const analyzeMSSQLCheckWithAI = async (category: string, checkName: string) => {
        // Kullanım limiti kontrolü
        const shouldResetCounter = (lastResetDate: string | null): boolean => {
            if (!lastResetDate) return true;

            const lastDate = new Date(lastResetDate);
            const currentDate = new Date();

            return (
                lastDate.getFullYear() !== currentDate.getFullYear() ||
                lastDate.getMonth() !== currentDate.getMonth() ||
                lastDate.getDate() !== currentDate.getDate()
            );
        };

        const needsReset = shouldResetCounter(lastResetDate);
        const currentCount = needsReset ? 0 : dailyUsageCount;

        // Check if the user has reached their daily limit
        if (!needsReset && currentCount >= dailyLimit) {
            Modal.warning({
                title: 'Daily AI Analysis Limit Reached',
                content: (
                    <div style={{ padding: '20px 0' }}>
                        <p>You've reached your limit of {dailyLimit} AI analyses for today.</p>
                        <p>The limit will reset at midnight.</p>
                    </div>
                ),
                okText: 'Ok',
                maskClosable: true
            });
            return;
        }

        setAnalyzingMssqlAI(true);
        setSelectedCategory(category);

        // Kategoriye ait check'leri bul
        const categoryItems = mssqlBestPractices[category] || [];

        // İlgili check'i bul - no status restriction
        const checkItem = categoryItems.find((item: any) => item.check_name === checkName);

        // Eğer check bulunamazsa, işlemi durdur
        if (!checkItem) {
            message.info(`Check "${checkName}" not found.`);
            setAnalyzingMssqlAI(false);
            return;
        }

        // AI analizine gönderilecek veriyi hazırla
        const bestPracticesData: any[] = [{
            category: getCategoryTitle(category),
            check: checkItem.check_name,
            status: checkItem.status,
            description: checkItem.description,
            current_recommendation: checkItem.recommendation
        }];

        let recommendations: Record<string, string> = {};

        try {
            // AI API'sine istek gönder
            const response = await fetch('https://o4szcpxekyj6hvcdx5ktqy2c.agents.do-ai.run/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer cifsE4HtBVWFEzyXrh5E5vbU-v66wK6I'
                },
                body: JSON.stringify({
                    messages: [{
                        role: "user",
                        content: `I need you to analyze the following SQL Server best practice check result and provide more detailed recommendations for this specific setting.
                        
                        Server Information:
                        - Hostname: ${selectedNode?.Hostname}
                        - Server Version: ${selectedNode?.Version}
                        - Total vCPU: ${selectedNode?.TotalVCPU || selectedNode?.totalVCPU || 'Unknown'} cores
                        - Total RAM: ${byteToGB(selectedNode?.TotalMemory || selectedNode?.totalMemory || 0)}
                        
                        Best Practice Check for ${checkName}:
                        ${JSON.stringify(bestPracticesData[0], null, 2)}
                        
                        Please provide a detailed but concise recommendation including:
                        1. Explanation of why this setting is important (max 2 sentences)
                        2. ${checkItem.status === 'OK' || checkItem.status === 'Info' ?
                                'Confirmation that the current configuration is optimal and what makes it a good configuration (max 2 bullet points)' :
                                'Specific steps to remediate the issue with exact commands (max 3 bullet points)'}
                        3. Potential impacts of the current configuration or making changes (max 1 sentence)
                        
                        Format your response as a plain string with clear sections.
                        Keep your response under 300 words and be concise but complete.
                        Focus on practical, actionable advice.
                        `
                    }],
                    temperature: 0,
                    top_p: 0.01,
                    max_tokens: 1500,
                    stream: false,
                    filter_kb_content_by_query_metadata: false,
                    include_retrieval_info: false,
                    provide_citations: false
                })
            });

            if (!response.ok) {
                throw new Error(`AI service responded with status: ${response.status}`);
            }

            const data = await response.json();

            if (!data || !data.choices || !data.choices[0] || !data.choices[0].message) {
                throw new Error('Invalid response format from AI service');
            }

            // AI yanıtını al
            const aiResponse = data.choices[0].message.content;
            console.log("Single check AI response:", aiResponse);

            // Process AI response and check for truncation
            const processedResponse = processAIResponse(aiResponse, checkName);

            // Direk yanıtı kullan (JSON parsing gerekmez)
            recommendations[checkName] = processedResponse;

            // Önerileri mevcut önerilerle birleştir
            const updatedRecommendations = { ...mssqlAIRecommendations, ...recommendations };
            setMssqlAIRecommendations(updatedRecommendations);

            // Increment usage in Redux
            store.dispatch(incrementUsage());

            message.success(`AI analysis for "${checkName}" completed successfully`);
        } catch (error) {
            console.error('Error during AI analysis:', error);

            // Create default recommendation for this check
            recommendations[checkName] = "AI analysis failed. Please consult SQL Server documentation for best practices regarding this setting.";

            const updatedRecommendations = { ...mssqlAIRecommendations, ...recommendations };
            setMssqlAIRecommendations(updatedRecommendations);

            message.error('Failed to analyze with AI. Please try again later.');
        } finally {
            setAnalyzingMssqlAI(false);
        }
    };

    // Generate PDF report of MSSQL best practices
    const generatePDFReport = async () => {
        if (!selectedNode) return;

        message.loading({ content: 'Generating PDF report...', key: 'pdfGen' });

        try {
            // Create new PDF document
            const doc = new jsPDF('p', 'mm', 'a4');
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const margin = 10;
            const contentWidth = pageWidth - (2 * margin);

            // Helper function to add text with line breaks and page breaks
            const addWrappedText = (text: string, x: number, y: number, maxWidth: number, lineHeight: number = 5) => {
                const lines = doc.splitTextToSize(text, maxWidth);
                let currentY = y;

                for (const line of lines) {
                    if (currentY > pageHeight - margin) {
                        doc.addPage();
                        currentY = margin + 10; // Reset Y position on new page with some padding
                    }
                    doc.text(line, x, currentY);
                    currentY += lineHeight;
                }

                return currentY; // Return the last Y position
            };

            // Helper function to ensure we have space for a section, add new page if needed
            const ensureSpace = (currentY: number, neededSpace: number) => {
                if (currentY + neededSpace > pageHeight - margin) {
                    doc.addPage();
                    return margin + 10;
                }
                return currentY;
            };

            // Add title with a nice purple gradient background
            const headerColor = { r: 72, g: 45, b: 140 };
            doc.setFillColor(headerColor.r, headerColor.g, headerColor.b, 0.8);
            doc.rect(0, 0, pageWidth, 25, 'F');

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(22);
            doc.setTextColor(255, 255, 255);
            doc.text('MSSQL Best Practices Analysis Report', pageWidth / 2, 17, { align: 'center' });
            doc.setFont('helvetica', 'normal');

            // Add server info in a box
            doc.setFillColor(245, 245, 255);
            doc.roundedRect(margin, 30, contentWidth, 30, 3, 3, 'F');
            doc.setFontSize(11);
            doc.setTextColor(60, 60, 60);
            doc.text(`Server: ${selectedNode.Hostname}`, margin + 4, 40);
            doc.text(`Cluster: ${selectedNode.ClusterName}`, margin + 4, 48);
            doc.text(`Version: ${shortenMssqlVersion(selectedNode.Version)}`, (pageWidth / 2) + 10, 40);
            doc.text(`Generated: ${new Date().toLocaleString()}`, (pageWidth / 2) + 10, 48);

            let yPos = 80;

            // Add AI Analysis Summary if there are AI recommendations
            const aiAnalyzedChecks = Object.keys(mssqlAIRecommendations);
            if (aiAnalyzedChecks.length > 0) {
                yPos = ensureSpace(yPos, 40);

                // AI Analysis Summary header
                doc.setFillColor(240, 248, 255);
                doc.roundedRect(margin, yPos, contentWidth, 25, 3, 3, 'F');
                doc.setFontSize(12);
                doc.setTextColor(24, 144, 255);
                doc.setFont('helvetica', 'bold');
                doc.text('AI Analysis Summary', margin + 4, yPos + 8);
                doc.setFontSize(9);
                doc.setTextColor(60, 60, 60);
                doc.setFont('helvetica', 'normal');
                doc.text(`${aiAnalyzedChecks.length} checks have been analyzed with AI-powered recommendations for enhanced insights.`, margin + 4, yPos + 18);
                yPos += 35;

                // Group AI analyzed checks by category
                const checksByCategory: Record<string, string[]> = {};
                for (const checkName of aiAnalyzedChecks) {
                    // Find which category this check belongs to
                    let foundCategory = 'Other';
                    for (const [category, items] of Object.entries(mssqlBestPractices)) {
                        if (Array.isArray(items) && items.some((item: any) => item.check_name === checkName)) {
                            foundCategory = getCategoryTitle(category);
                            break;
                        }
                    }
                    if (!checksByCategory[foundCategory]) {
                        checksByCategory[foundCategory] = [];
                    }
                    checksByCategory[foundCategory].push(checkName);
                }

                // Display AI analyzed categories and checks
                doc.setFontSize(10);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(24, 144, 255);
                doc.text('AI-Analyzed Categories:', margin + 4, yPos);
                yPos += 8;

                doc.setFontSize(8);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(0, 0, 0);

                for (const [category, checks] of Object.entries(checksByCategory)) {
                    yPos = ensureSpace(yPos, 12);

                    // Category name
                    doc.setFont('helvetica', 'bold');
                    doc.text(`• ${category} (${checks.length} checks):`, margin + 8, yPos);
                    yPos += 5;

                    // Check names (limit to avoid too much space)
                    doc.setFont('helvetica', 'normal');
                    const checksList = checks.length > 3 ?
                        checks.slice(0, 3).join(', ') + ` and ${checks.length - 3} more` :
                        checks.join(', ');
                    yPos = addWrappedText(`  ${checksList}`, margin + 12, yPos, contentWidth - 20, 4);
                    yPos += 5;
                }

                yPos += 15; // Extra space before main content
            }

            // Process each category
            for (const category of Object.keys(mssqlBestPractices)) {
                const items = mssqlBestPractices[category] || [];

                if (!items || items.length === 0) continue;

                yPos = ensureSpace(yPos, 40); // Ensure space for category header

                // Category header
                doc.setFillColor(230, 230, 250);
                doc.rect(margin, yPos, contentWidth, 10, 'F');
                doc.setFontSize(12);
                doc.setTextColor(80, 80, 120);
                doc.setFont('helvetica', 'bold');
                doc.text(getCategoryTitle(category), margin + 4, yPos + 7);
                yPos += 15;

                // Process each item in the category
                for (const item of items) {
                    yPos = ensureSpace(yPos, 30); // Minimum space for an item

                    // Item header with status
                    doc.setFillColor(245, 245, 255);
                    doc.rect(margin, yPos, contentWidth, 8, 'F');
                    doc.setFontSize(10);
                    doc.setFont('helvetica', 'bold');

                    // Helper function to convert hex to RGB
                    const hexToRgb = (hex: string) => {
                        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                        return result ? {
                            r: parseInt(result[1], 16),
                            g: parseInt(result[2], 16),
                            b: parseInt(result[3], 16)
                        } : { r: 0, g: 0, b: 0 };
                    };

                    // Status indicator with colors
                    let statusColor: string;
                    let statusBackgroundColor: string;
                    switch (item.status) {
                        case 'Critical':
                            statusColor = '#ff4d4f';
                            statusBackgroundColor = '#fff2f0';
                            break;
                        case 'Warning':
                            statusColor = '#faad14';
                            statusBackgroundColor = '#fffbe6';
                            break;
                        case 'OK':
                            statusColor = '#52c41a';
                            statusBackgroundColor = '#f6ffed';
                            break;
                        case 'Info':
                            statusColor = '#1890ff';
                            statusBackgroundColor = '#e6f7ff';
                            break;
                        default:
                            statusColor = '#666666';
                            statusBackgroundColor = '#f5f5f5';
                    }

                    // Draw check name in black
                    doc.setTextColor(0, 0, 0);
                    const checkNameText = item.check_name;
                    doc.text(checkNameText, margin + 4, yPos + 6);

                    // Calculate position for status badge
                    const checkNameWidth = doc.getTextWidth(checkNameText);
                    const statusText = `[${item.status}]`;
                    const statusBadgeX = margin + 4 + checkNameWidth + 4;
                    const statusBadgeY = yPos + 1;
                    const statusBadgeWidth = doc.getTextWidth(statusText) + 4;
                    const statusBadgeHeight = 6;

                    // Draw colored background for status badge
                    const bgColor = hexToRgb(statusBackgroundColor);
                    doc.setFillColor(bgColor.r, bgColor.g, bgColor.b);
                    doc.roundedRect(statusBadgeX - 2, statusBadgeY, statusBadgeWidth, statusBadgeHeight, 1, 1, 'F');

                    // Draw status text in appropriate color
                    const textColor = hexToRgb(statusColor);
                    doc.setTextColor(textColor.r, textColor.g, textColor.b);
                    doc.setFont('helvetica', 'bold');
                    doc.text(statusText, statusBadgeX, yPos + 6);

                    // Reset text color to black for subsequent text
                    doc.setTextColor(0, 0, 0);
                    yPos += 12;

                    // Special handling for orphaned users
                    if (item.check_name === 'Orphaned Users' && item.status === 'Warning') {
                        doc.setFontSize(9);
                        doc.setFont('helvetica', 'normal');

                        // Extract database sections from description
                        const databases = item.description.split('\n\n').slice(1); // Skip header

                        for (const dbSection of databases) {
                            yPos = ensureSpace(yPos, 15);
                            const [dbHeader, ...users] = dbSection.split('\n');

                            // Database header
                            doc.setFont('helvetica', 'bold');
                            yPos = addWrappedText(dbHeader, margin + 4, yPos, contentWidth - 8, 5);

                            // Users
                            doc.setFont('helvetica', 'normal');
                            for (const user of users) {
                                yPos = ensureSpace(yPos, 5);
                                yPos = addWrappedText(user, margin + 8, yPos, contentWidth - 12, 4);
                            }
                            yPos += 5;
                        }
                    }
                    // Special handling for fragmented indexes
                    else if (item.check_name === 'Index Fragmentation' && item.status === 'Warning') {
                        doc.setFontSize(9);
                        doc.setFont('helvetica', 'normal');

                        // Extract index sections from description
                        const indexes = item.description.split('\n\n').slice(1); // Skip header

                        for (const indexSection of indexes) {
                            yPos = ensureSpace(yPos, 20);
                            const [indexHeader, ...details] = indexSection.split('\n');

                            // Index header
                            doc.setFont('helvetica', 'bold');
                            yPos = addWrappedText(indexHeader, margin + 4, yPos, contentWidth - 8, 5);

                            // Index details
                            doc.setFont('helvetica', 'normal');
                            for (const detail of details) {
                                yPos = ensureSpace(yPos, 5);
                                yPos = addWrappedText(detail, margin + 8, yPos, contentWidth - 12, 4);
                            }
                            yPos += 5;
                        }
                    }
                    // Standard content handling for other checks
                    else {
                        doc.setFontSize(9);
                        doc.setFont('helvetica', 'normal');
                        yPos = addWrappedText(item.description, margin + 4, yPos, contentWidth - 8, 4);
                        yPos += 5;
                    }

                    // Add recommendation
                    yPos = ensureSpace(yPos, 15);
                    doc.setFont('helvetica', 'bold');
                    doc.text('Recommendation:', margin + 4, yPos);
                    yPos += 5;
                    doc.setFont('helvetica', 'normal');
                    yPos = addWrappedText(item.recommendation, margin + 4, yPos, contentWidth - 8, 4);
                    yPos += 5;

                    // Add AI recommendation if available
                    const aiRecommendation = mssqlAIRecommendations[item.check_name];
                    if (aiRecommendation) {
                        yPos = ensureSpace(yPos, 20);

                        // AI Recommendation header with icon/badge
                        doc.setFillColor(230, 247, 255); // Light blue background
                        doc.rect(margin, yPos, contentWidth, 8, 'F');
                        doc.setFontSize(9);
                        doc.setFont('helvetica', 'bold');
                        doc.setTextColor(24, 144, 255); // Blue color for AI badge
                        doc.text('AI-Powered Detailed Analysis:', margin + 4, yPos + 6);
                        doc.setTextColor(0, 0, 0); // Reset to black
                        yPos += 12;

                        // Process AI recommendation content
                        doc.setFontSize(8);
                        doc.setFont('helvetica', 'normal');

                        // Split AI recommendation into sections if it contains structured content
                        const sections = aiRecommendation.split('\n\n');
                        for (const section of sections) {
                            if (section.trim()) {
                                // Check if this is a header (like "Importance:", "Remediation Steps:", etc.)
                                if (section.includes(':') && section.split(':')[0].length < 50) {
                                    const [header, ...content] = section.split(':');
                                    if (content.length > 0) {
                                        // Header
                                        yPos = ensureSpace(yPos, 8);
                                        doc.setFont('helvetica', 'bold');
                                        doc.setTextColor(24, 144, 255);
                                        yPos = addWrappedText(`${header.trim()}:`, margin + 8, yPos, contentWidth - 16, 4);

                                        // Content
                                        doc.setFont('helvetica', 'normal');
                                        doc.setTextColor(0, 0, 0);
                                        const contentText = content.join(':').trim();
                                        if (contentText) {
                                            yPos = addWrappedText(contentText, margin + 12, yPos, contentWidth - 20, 4);
                                            yPos += 3;
                                        }
                                    } else {
                                        // Just regular text
                                        yPos = ensureSpace(yPos, 6);
                                        yPos = addWrappedText(section.trim(), margin + 8, yPos, contentWidth - 16, 4);
                                        yPos += 2;
                                    }
                                } else {
                                    // Regular paragraph
                                    yPos = ensureSpace(yPos, 6);
                                    yPos = addWrappedText(section.trim(), margin + 8, yPos, contentWidth - 16, 4);
                                    yPos += 3;
                                }
                            }
                        }
                        yPos += 5;
                    }

                    yPos += 5;
                }

                yPos += 10; // Space between categories
            }

            // Add footer to each page
            const pageCount = doc.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setTextColor(150, 150, 150);

                const footerText = Object.keys(mssqlAIRecommendations).length > 0 ?
                    `Generated by ClusterEye - MSSQL Best Practices Analysis with AI-Powered Recommendations (Page ${i} of ${pageCount})` :
                    `Generated by ClusterEye - MSSQL Best Practices Analysis (Page ${i} of ${pageCount})`;

                doc.text(
                    footerText,
                    pageWidth / 2,
                    pageHeight - margin,
                    { align: 'center' }
                );
            }

            // Save the PDF
            const fileName = `MSSQL_Best_Practices_${selectedNode.Hostname}_${new Date().toISOString().slice(0, 10)}.pdf`;
            doc.save(fileName);

            message.success({ content: 'PDF report generated successfully!', key: 'pdfGen', duration: 3 });
        } catch (error) {
            console.error('Error generating PDF:', error);
            message.error({ content: 'Failed to generate PDF report', key: 'pdfGen', duration: 3 });
        }
    };

    // AI yanıtının kesilip kesilmediğini tespit eden fonksiyon
    const isResponseTruncated = (text: string): boolean => {
        const truncationIndicators = [
            // Incomplete sentences
            /[a-z]\s*$/, // ends with lowercase letter
            /,\s*$/, // ends with comma
            /;\s*$/, // ends with semicolon
            /:\s*$/, // ends with colon
            /\(\s*$/, // ends with open parenthesis
            /\[\s*$/, // ends with open bracket
            /{\s*$/, // ends with open brace
            /\-\s*$/, // ends with dash
            // Incomplete SQL commands
            /ALTER\s+DATABASE\s*$/i,
            /ADD\s+FILE\s*$/i,
            /SIZE\s*$/i,
            // Common incomplete words at the end
            /\s+(the|and|or|with|to|for|in|on|at|by)\s*$/i
        ];

        return truncationIndicators.some(pattern => pattern.test(text.trim()));
    };

    // AI yanıtını işleyip truncation uyarısı ekleyen fonksiyon
    const processAIResponse = (response: string, checkName?: string): string => {
        const isTruncated = isResponseTruncated(response);

        if (isTruncated) {
            const warningMessage = checkName ?
                `\n\n[WARNING] Note: This AI analysis for "${checkName}" appears to be incomplete due to length limits. Consider requesting a shorter, more focused analysis.` :
                `\n\n[WARNING] Note: This AI analysis appears to be incomplete due to length limits. The response may have been truncated.`;

            return response + warningMessage;
        }

        return response;
    };

    return (
        <div style={{ padding: '24px' }}>
            <Space direction="vertical" style={{ width: '100%' }} size="large">
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: 24 }}>
                        <RobotOutlined style={{ fontSize: '24px', color: '#722ed1' }} />
                        <Title level={2} style={{ margin: 0 }}>AI Configuration Advisor</Title>
                    </div>

                    <Alert
                        message="Configuration Analysis"
                        description="Select any node from the table below to analyze its configuration and receive AI-powered recommendations for optimal performance."
                        type="info"
                        showIcon
                        style={{ marginBottom: 24 }}
                    />

                    <Table<NodeData>
                        loading={loading}
                        dataSource={nodes || []}
                        columns={columns}
                        rowKey="key"
                        pagination={{ pageSize: 10 }}
                    />
                </Card>
            </Space>

            {/* PostgreSQL konfigürasyonları için modal */}
            <Modal
                title={`PostgreSQL Configuration - ${selectedNode?.Hostname}`}
                open={configModalVisible}
                onCancel={() => setConfigModalVisible(false)}
                width={1200}
                footer={[
                    <>
                        <div style={{
                            float: 'left',
                            fontSize: '13px',
                            color: '#722ed1',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px'
                        }}>
                            <RobotOutlined />
                            <span>AI Daily Usage: <strong>{dailyUsageCount}/{dailyLimit}</strong> Remaining: <strong>{dailyLimit - dailyUsageCount}</strong></span>
                        </div>
                        <Button key="close" onClick={() => setConfigModalVisible(false)}>
                            Close
                        </Button>
                    </>
                ]}
            >
                <Row gutter={24}>
                    <Col span={12}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <Text strong>Current Configuration</Text>
                            <Button
                                type="primary"
                                icon={<ReloadOutlined />}
                                loading={loadingConfig}
                                onClick={() => selectedNode && fetchPostgresqlConfig(selectedNode)}
                            >
                                Get Current Config
                            </Button>
                        </div>
                        <Spin spinning={loadingConfig}>
                            <div style={{ maxHeight: '600px', overflow: 'auto' }}>
                                <List
                                    itemLayout="horizontal"
                                    dataSource={configItems || []}
                                    renderItem={(item) => (
                                        <List.Item>
                                            <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
                                                    <Typography.Text strong>{item.name}</Typography.Text>
                                                    {item.category && <Tag color="blue" style={{ marginLeft: '8px' }}>{item.category}</Tag>}
                                                    <Tag color={item.is_default ? "#faad14" : "default"} style={{ marginLeft: '8px' }}>
                                                        {item.is_default ? "Default" : "Custom"}
                                                    </Tag>
                                                </div>
                                                <div>Value: {item.value}</div>
                                                {item.description && <div>Description: {item.description}</div>}
                                            </div>
                                        </List.Item>
                                    )}
                                />
                            </div>
                        </Spin>
                    </Col>
                    <Col span={12}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 16
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <RobotOutlined style={{ marginRight: '8px', color: '#722ed1' }} />
                                <Text strong>AI Recommended Settings</Text>
                                {(aiRecommendations && aiRecommendations.length > 0) && (
                                    <Tag color="#722ed1" style={{ marginLeft: '8px' }}>
                                        {aiRecommendations.length} recommendations
                                    </Tag>
                                )}
                            </div>
                            <Button
                                type="primary"
                                icon={<RobotOutlined />}
                                loading={analyzing}
                                onClick={analyzeConfigurations}
                            >
                                Analyze Now
                            </Button>
                        </div>

                        <div style={{ maxHeight: '600px', overflow: 'auto' }}>
                            {(!aiRecommendations || aiRecommendations.length === 0) ? (
                                <div style={{
                                    textAlign: 'center',
                                    padding: '40px 20px',
                                    background: '#f9f0ff',
                                    borderRadius: '4px',
                                    border: '1px dashed #d3adf7'
                                }}>
                                    <RobotOutlined style={{ fontSize: '32px', color: '#722ed1', marginBottom: '16px' }} />
                                    <div>
                                        <Text>Click "Analyze Now" to get AI-powered recommendations for optimizing your PostgreSQL configuration.</Text>
                                    </div>
                                </div>
                            ) : (
                                <List
                                    itemLayout="horizontal"
                                    dataSource={aiRecommendations || []}
                                    renderItem={(item) => (
                                        <List.Item>
                                            <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
                                                    <Typography.Text strong>{item.name}</Typography.Text>
                                                    <Tag color="#722ed1" style={{ marginLeft: '8px' }}>AI Recommended</Tag>
                                                </div>
                                                <div style={{
                                                    padding: '8px',
                                                    backgroundColor: '#f6f6f6',
                                                    borderRadius: '4px',
                                                    marginBottom: '8px'
                                                }}>
                                                    <Text strong>Recommended Value:</Text> {item.value}
                                                </div>
                                                {item.description && (
                                                    <div style={{
                                                        padding: '8px',
                                                        backgroundColor: '#f9f0ff',
                                                        borderRadius: '4px',
                                                        borderLeft: '3px solid #722ed1'
                                                    }}>
                                                        <Text>{item.description}</Text>
                                                    </div>
                                                )}
                                            </div>
                                        </List.Item>
                                    )}
                                />
                            )}
                        </div>
                    </Col>
                </Row>
            </Modal>

            {/* Mevcut analiz sonuçları modalı */}
            <Modal
                title={`Analysis Results - ${selectedNode?.Hostname}`}
                open={analysisModalVisible}
                onCancel={() => setAnalysisModalVisible(false)}
                width={800}
                footer={[
                    <Button key="close" onClick={() => setAnalysisModalVisible(false)}>
                        Close
                    </Button>
                ]}
            >
                {renderAnalysisResults()}
            </Modal>

            {/* MongoDB Health Checks Modal */}
            <Modal
                title={`MongoDB Health Checks - ${selectedNode?.Hostname}`}
                open={mongoModalVisible}
                onCancel={() => setMongoModalVisible(false)}
                width={1200}
                footer={[
                    <Button key="close" onClick={() => setMongoModalVisible(false)}>
                        Close
                    </Button>
                ]}
            >
                <Spin spinning={loadingMongoHealthChecks || analyzingMongoAI} tip={analyzingMongoAI ? "Analyzing with AI..." : "Loading health checks..."}>
                    {Object.keys(mongoHealthChecks).length > 0 ? (
                        <div style={{ maxHeight: '700px', overflow: 'auto' }}>
                            <div style={{
                                background: '#f0f2f5',
                                padding: '16px',
                                borderRadius: '4px',
                                marginBottom: '16px'
                            }}>
                                <Space>
                                    <MongoDBIcon />
                                    <Typography.Title level={5} style={{ margin: 0 }}>
                                        MongoDB Health Checks Analysis
                                    </Typography.Title>
                                </Space>
                                <Typography.Text type="secondary" style={{ marginLeft: '32px', display: 'block' }}>
                                    Comprehensive health assessment covering replica sets, indexes, performance, and security.
                                </Typography.Text>
                            </div>

                            {/* Show a prominent loading indicator when AI analysis is running */}
                            {analyzingMongoAI && (
                                <Alert
                                    type="info"
                                    showIcon
                                    message="AI Analysis In Progress"
                                    description="Please wait while AI analyzes your MongoDB configuration. This may take a moment."
                                    style={{ marginBottom: '16px' }}
                                />
                            )}

                            <Collapse
                                defaultActiveKey={Object.keys(mongoHealthChecks)}
                                bordered={false}
                                expandIconPosition="end"
                                className="site-collapse-custom-collapse"
                            >
                                {Object.entries(mongoHealthChecks).map(([category, items]) => (
                                    <Panel
                                        header={
                                            <Space>
                                                {getMongoDBCategoryIcon(category)}
                                                <span style={{ fontWeight: 'bold', fontSize: '16px' }}>
                                                    {getMongoDBCategoryTitle(category)}
                                                </span>
                                                <Tag color="blue">{(items as MongoDBHealthCheck[]).length} checks</Tag>
                                            </Space>
                                        }
                                        key={category}
                                        className="site-collapse-custom-panel"
                                    >
                                        <Table
                                            dataSource={Array.isArray(items) ? items.map((item, index) => ({
                                                ...item,
                                                key: `${category}-${index}`
                                            })) : []}
                                            pagination={false}
                                            columns={[
                                                {
                                                    title: 'Check',
                                                    dataIndex: 'check_name',
                                                    key: 'check_name',
                                                    width: '25%',
                                                    render: (text) => <strong>{text}</strong>
                                                },
                                                {
                                                    title: 'Status',
                                                    dataIndex: 'status',
                                                    key: 'status',
                                                    width: '15%',
                                                    render: (status) => {
                                                        let color = 'green';
                                                        let icon = <CheckCircleOutlined />;

                                                        if (status === 'Warning') {
                                                            color = 'orange';
                                                            icon = <WarningOutlined />;
                                                        } else if (status === 'Critical') {
                                                            color = 'red';
                                                            icon = <CloseCircleOutlined />;
                                                        }

                                                        return (
                                                            <Tag color={color} icon={icon}>
                                                                {status}
                                                            </Tag>
                                                        );
                                                    },
                                                    sorter: (a, b) => {
                                                        const order = { 'Critical': 0, 'Warning': 1, 'OK': 2 };
                                                        return order[a.status as keyof typeof order] - order[b.status as keyof typeof order];
                                                    },
                                                    defaultSortOrder: 'ascend'
                                                },
                                                {
                                                    title: 'Current Status',
                                                    dataIndex: 'description',
                                                    key: 'description',
                                                    width: '30%',
                                                    render: (text) => (
                                                        <div style={{ wordBreak: 'break-word', whiteSpace: 'normal' }}>{text}</div>
                                                    )
                                                },
                                                {
                                                    title: 'Recommendation',
                                                    dataIndex: 'recommendation',
                                                    key: 'recommendation',
                                                    render: (text) => (
                                                        <div style={{
                                                            padding: '8px',
                                                            background: '#f9f0ff',
                                                            borderRadius: '4px',
                                                            borderLeft: '3px solid #722ed1'
                                                        }}>
                                                            {text}
                                                        </div>
                                                    )
                                                }
                                            ]}
                                        />
                                    </Panel>
                                ))}
                            </Collapse>

                            <div style={{ marginTop: '16px', textAlign: 'right' }}>
                                <Space>
                                    <Button
                                        icon={<ReloadOutlined />}
                                        onClick={() => selectedNode && fetchMongoDBHealthChecks(selectedNode)}
                                        disabled={loadingMongoHealthChecks}
                                    >
                                        Refresh Analysis
                                    </Button>
                                </Space>
                                <div style={{
                                    float: 'left',
                                    fontSize: '13px',
                                    color: '#722ed1',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '5px'
                                }}>
                                    <RobotOutlined />
                                    <span>AI Daily Usage: <strong>{dailyUsageCount}/{dailyLimit}</strong> Remaining: <strong>{dailyLimit - dailyUsageCount}</strong></span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div style={{
                            textAlign: 'center',
                            padding: '40px',
                            background: '#f6f6f6',
                            borderRadius: '4px'
                        }}>
                            {loadingMongoHealthChecks ? (
                                <div style={{ marginTop: '20px' }}>
                                    <Spin size="large" />
                                    <p style={{ marginTop: '16px' }}>Loading health check data...</p>
                                </div>
                            ) : (
                                <div>
                                    <div style={{ fontSize: '48px', color: '#4DB33D', marginBottom: '16px' }}>
                                        <MongoDBIcon />
                                    </div>
                                    <p>No health check data available for this node.</p>
                                    <Button
                                        type="primary"
                                        onClick={() => selectedNode && fetchMongoDBHealthChecks(selectedNode)}
                                        icon={<ReloadOutlined />}
                                    >
                                        Retry Loading Data
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </Spin>
            </Modal>

            {/* MSSQL Best Practices Modal */}
            <Modal
                title={`MSSQL Best Practices - ${selectedNode?.Hostname}`}
                open={mssqlModalVisible}
                onCancel={() => setMssqlModalVisible(false)}
                width={1200}
                footer={[
                    <Button key="close" onClick={() => setMssqlModalVisible(false)}>
                        Close
                    </Button>
                ]}
            >
                <Spin spinning={loadingMssqlBestPractices || analyzingMssqlAI} tip={analyzingMssqlAI ? "Analyzing with AI..." : "Loading best practices..."}>
                    {Object.keys(mssqlBestPractices).length > 0 ? (
                        <div style={{ maxHeight: '700px', overflow: 'auto' }}>
                            <div style={{
                                background: '#f0f2f5',
                                padding: '16px',
                                borderRadius: '4px',
                                marginBottom: '16px'
                            }}>
                                <Space>
                                    <MssqlIcon />
                                    <Typography.Title level={5} style={{ margin: 0 }}>
                                        SQL Server Best Practices Analysis
                                    </Typography.Title>
                                </Space>
                                <Typography.Text type="secondary" style={{ marginLeft: '32px', display: 'block' }}>
                                    Analyzing configuration and performance metrics to identify potential improvements.
                                </Typography.Text>
                            </div>

                            {/* Show a prominent loading indicator when AI analysis is running */}
                            {analyzingMssqlAI && (
                                <Alert
                                    type="info"
                                    showIcon
                                    message="AI Analysis In Progress"
                                    description="Please wait while AI analyzes your SQL Server configuration. This may take a moment."
                                    style={{ marginBottom: '16px' }}
                                />
                            )}

                            <Collapse
                                defaultActiveKey={Object.keys(mssqlBestPractices)}
                                bordered={false}
                                expandIconPosition="end"
                                className="site-collapse-custom-collapse"
                            >
                                {Object.entries(mssqlBestPractices).map(([category, items]) => (
                                    <Panel
                                        header={
                                            <Space>
                                                {getCategoryIcon(category)}
                                                <span style={{ fontWeight: 'bold', fontSize: '16px' }}>
                                                    {getCategoryTitle(category)}
                                                </span>
                                                <Tag color="blue">{(items as any[]).length} checks</Tag>

                                                {/* Kategori analiz butonu ekle */}
                                                <Button
                                                    type="primary"
                                                    size="small"
                                                    icon={<RobotOutlined />}
                                                    loading={analyzingMssqlAI && selectedCategory === category}
                                                    onClick={(e) => {
                                                        e.stopPropagation(); // Tıklama event'ini collapse'e iletme
                                                        setSelectedCategory(category);
                                                        analyzeMSSQLCategoryWithAI(category);
                                                    }}
                                                    disabled={analyzingMssqlAI}
                                                >
                                                    Analyze Category
                                                </Button>
                                            </Space>
                                        }
                                        key={category}
                                        className="site-collapse-custom-panel"
                                    >
                                        <Table
                                            dataSource={Array.isArray(items) ? items.map((item, index) => ({
                                                ...item,
                                                key: `${category}-${index}`
                                            })) : []}
                                            pagination={false}
                                            columns={[
                                                {
                                                    title: 'Check',
                                                    dataIndex: 'check_name',
                                                    key: 'check_name',
                                                    width: '25%',
                                                    render: (text) => <strong>{text}</strong>
                                                },
                                                {
                                                    title: 'Status',
                                                    dataIndex: 'status',
                                                    key: 'status',
                                                    width: '15%',
                                                    render: (status) => {
                                                        let color = 'green';
                                                        let icon = <CheckCircleOutlined />;

                                                        if (status === 'Warning') {
                                                            color = 'orange';
                                                            icon = <WarningOutlined />;
                                                        } else if (status === 'Critical') {
                                                            color = 'red';
                                                            icon = <CloseCircleOutlined />;
                                                        }

                                                        return (
                                                            <Tag color={color} icon={icon}>
                                                                {status}
                                                            </Tag>
                                                        );
                                                    },
                                                    sorter: (a, b) => {
                                                        const order = { 'Critical': 0, 'Warning': 1, 'OK': 2 };
                                                        return order[a.status as keyof typeof order] - order[b.status as keyof typeof order];
                                                    },
                                                    defaultSortOrder: 'ascend'
                                                },
                                                {
                                                    title: 'Current Configuration',
                                                    dataIndex: 'description',
                                                    key: 'description',
                                                    width: '30%',
                                                    render: (text) => {
                                                        // If this is a file path, format it to be more readable
                                                        if (text && typeof text === 'string' && text.includes(':\\')) {
                                                            const parts = text.split(':\\');
                                                            if (parts.length > 1) {
                                                                return (
                                                                    <Tooltip title={text}>
                                                                        <div style={{
                                                                            wordBreak: 'break-word',
                                                                            whiteSpace: 'normal',
                                                                            lineHeight: '1.5'
                                                                        }}>
                                                                            {text}
                                                                        </div>
                                                                    </Tooltip>
                                                                );
                                                            }
                                                        }
                                                        return <div style={{ wordBreak: 'break-word', whiteSpace: 'normal' }}>{text}</div>;
                                                    }
                                                },
                                                {
                                                    title: 'Recommendation',
                                                    dataIndex: 'recommendation',
                                                    key: 'recommendation',
                                                    render: (text) => (
                                                        <div style={{
                                                            padding: '8px',
                                                            background: '#f9f0ff',
                                                            borderRadius: '4px',
                                                            borderLeft: '3px solid #722ed1'
                                                        }}>
                                                            {text}
                                                        </div>
                                                    )
                                                },
                                                {
                                                    title: 'AI Recommendation',
                                                    key: 'ai_recommendation',
                                                    width: '30%',
                                                    render: (_, record) => {
                                                        const aiRecommendation = mssqlAIRecommendations[record.check_name];

                                                        if (analyzingMssqlAI && selectedCategory === category &&
                                                            record.check_name === selectedCheckName) {
                                                            return <Spin size="small" />;
                                                        }

                                                        if (!aiRecommendation) {
                                                            // Remove the condition that restricts analysis to only Warning/Critical items
                                                            return (
                                                                <Button
                                                                    type="link"
                                                                    size="small"
                                                                    disabled={analyzingMssqlAI}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation(); // Tıklama event'ini collapse'e iletme
                                                                        setSelectedCategory(category);
                                                                        setSelectedCheckName(record.check_name);
                                                                        analyzeMSSQLCheckWithAI(category, record.check_name);
                                                                    }}
                                                                >
                                                                    Analyze This Check
                                                                </Button>
                                                            );
                                                        }

                                                        // Chop recommendation if it's too long for display
                                                        const formattedRecommendation = aiRecommendation.length > 300 ?
                                                            aiRecommendation.substring(0, 300) + '...' :
                                                            aiRecommendation;

                                                        return (
                                                            <div style={{
                                                                padding: '8px',
                                                                background: '#e6f7ff',
                                                                borderRadius: '4px',
                                                                borderLeft: '3px solid #1890ff',
                                                                maxHeight: '200px',
                                                                overflow: 'auto'
                                                            }}>
                                                                <Text>{formattedRecommendation}</Text>
                                                                {aiRecommendation.length > 300 && (
                                                                    <Button
                                                                        type="link"
                                                                        size="small"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation(); // Tıklama event'ini collapse'e iletme
                                                                            Modal.info({
                                                                                title: `AI Recommendation for ${record.check_name}`,
                                                                                content: (
                                                                                    <div style={{
                                                                                        maxHeight: '60vh',
                                                                                        overflow: 'auto',
                                                                                        marginTop: '16px'
                                                                                    }}>
                                                                                        <AIAnalysisRenderer
                                                                                            content={aiRecommendation}
                                                                                            dbType="mssql"
                                                                                        />
                                                                                    </div>
                                                                                ),
                                                                                width: 800,
                                                                                okText: 'Close'
                                                                            });
                                                                        }}
                                                                    >
                                                                        View Full Recommendation
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        );
                                                    }
                                                }
                                            ]}
                                        />
                                    </Panel>
                                ))}
                            </Collapse>

                            <div style={{ marginTop: '16px', textAlign: 'right' }}>
                                <Space>
                                    <Button
                                        icon={<ReloadOutlined />}
                                        onClick={() => selectedNode && fetchMSSQLBestPractices(selectedNode)}
                                        disabled={loadingMssqlBestPractices}
                                    >
                                        Refresh Analysis
                                    </Button>
                                    <Button
                                        type="primary"
                                        icon={<FilePdfOutlined />}
                                        onClick={generatePDFReport}
                                        disabled={loadingMssqlBestPractices || Object.keys(mssqlBestPractices).length === 0}
                                    >
                                        Generate PDF Report
                                    </Button>
                                </Space>
                                <div style={{
                                    float: 'left',
                                    fontSize: '13px',
                                    color: '#722ed1',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '5px'
                                }}>
                                    <RobotOutlined />
                                    <span>AI Daily Usage: <strong>{dailyUsageCount}/{dailyLimit}</strong> Remaining: <strong>{dailyLimit - dailyUsageCount}</strong></span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div style={{
                            textAlign: 'center',
                            padding: '40px',
                            background: '#f6f6f6',
                            borderRadius: '4px'
                        }}>
                            {loadingMssqlBestPractices ? (
                                <div style={{ marginTop: '20px' }}>
                                    <Spin size="large" />
                                    <p style={{ marginTop: '16px' }}>Loading best practices data...</p>
                                </div>
                            ) : (
                                <div>
                                    <div style={{ fontSize: '48px', color: '#0078D4', marginBottom: '16px' }}>
                                        <MssqlIcon />
                                    </div>
                                    <p>No best practices data available for this node.</p>
                                    <Button
                                        type="primary"
                                        onClick={() => selectedNode && fetchMSSQLBestPractices(selectedNode)}
                                        icon={<ReloadOutlined />}
                                    >
                                        Retry Loading Data
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </Spin>
            </Modal>
        </div>
    );
};

export default AIAdvisory; 