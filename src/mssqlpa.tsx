import React, { useState, useEffect, useCallback } from 'react';
import { Select, Table, Badge, message, Modal, Steps, Row, Col, Card, Progress, Spin, Input, Pagination, Typography, TimePicker, Button, Statistic, Tooltip, Tag, Layout, Tabs, Space, Menu, List, Alert, DatePicker, Radio, Divider, Drawer, Descriptions, Empty } from 'antd';
import axios from 'axios';
import { useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { CopyOutlined, ReloadOutlined, InfoCircleOutlined, DownloadOutlined, DatabaseOutlined, BarChartOutlined, SettingOutlined, UserOutlined, TeamOutlined, RobotOutlined, FileSearchOutlined, DeleteOutlined, FileTextOutlined, LineChartOutlined, ClusterOutlined, CaretDownOutlined, CloudOutlined } from '@ant-design/icons';
import { Dayjs } from 'dayjs';
import CountUp from 'react-countup';
import MonacoEditor from './monacoeditor';
import { store } from './redux/store';
import { incrementUsage } from './redux/aiLimitSlice';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import MssqlIcon from './icons/mssql';
import { ExecutionPlanVisualizer, ExecutionPlanSummary } from './ExecutionPlanComponents';
import awsService, { CloudWatchMetric, RDSInstanceInfo } from './services/awsService';
import AIAnalysisRenderer from './components/AIAnalysisRenderer';
import { useQuery, useQueryClient, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

// Custom styles for tabs - we can reuse the postgres tabs CSS
import './postgrepaTabs.css';

// Create a client
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30000, // 30 saniye boyunca verileri taze kabul et
            retry: 1,
            refetchOnWindowFocus: false,
        },
    },
});

const { Option } = Select;
const { Step } = Steps;
const { Search } = Input;
const { Paragraph, Text } = Typography;

// Interface definitions
interface Database {
    name: string;
}

interface LogFile {
    name: string;
    path: string;
    fullPath: string;
    timeRange: string;
}

interface Node {
    Hostname: string;
    NodeStatus: string;
    Version: string;
    Edition: string;
    HARole?: string;
}

interface ClusterData {
    [key: string]: Node[];
}

// Result interfaces for MSSQL queries
interface QueryResultServerInfo {
    servername: string;
    edition: string;
    engine_version: string;
    instance_name: string;
    is_clustered: boolean;
    is_hadr_enabled: boolean;
}

interface QueryResultConnections {
    total_connections: number;
    active_connections: number;
    idle_connections: number;
    max_connections: number;
    connection_percentage: number;
}

interface QueryResultTopQueries {
    query_text: string;
    schema_name: string | null;
    object_name: string | null;
    database_name: string | null;
    query_type: string;
    execution_count: number;
    total_worker_time: number;
    avg_worker_time: number;
    total_elapsed_time: number;
    avg_elapsed_time: number;
    total_logical_reads: number;
    avg_logical_reads: number;
    last_execution_time: string;
}

interface QueryResultBlockingInfo {
    blocking_session_id: number;
    blocking_program: string;
    blocking_login: string;
    blocking_host: string;
    blocking_query: string;
    blocked_session_id: number;
    blocked_program: string;
    blocked_login: string;
    blocked_host: string;
    wait_type: string;
    wait_time: number;
    wait_resource: string;
    blocked_query: string;
}

interface QueryResultWaitStats {
    wait_type: string;
    waiting_tasks_count: number;
    wait_time_ms: number;
    max_wait_time_ms: number;
    signal_wait_time_ms: number;
}

interface QueryResultActiveQueries {
    SPID: number;
    BlkBy: number;
    ElapsedMS: number;
    ElapsedMin: number;
    CPU: number;
    IOReads: number;
    IOWrites: number;
    Executions: number;
    CommandType: string;
    ObjectName: string;
    SQLStatement: string;
    Status: string;
    Login: string;
    Host: string;
    DBName: string;
    LastWaitType: string;
    StartTime: string;
    Protocol: string;
    transaction_isolation: string;
    ConnectionWrites: number;
    ConnectionReads: number;
    ClientAddress: string;
    Authentication: string;
}

interface QueryResultIndexUsage {
    database_name: string;
    schema_name: string;
    table_name: string;
    index_name: string;
    index_id: number;
    user_seeks: number;
    user_scans: number;
    user_lookups: number;
    user_updates: number;
    last_user_seek: string;
    last_user_scan: string;
    last_user_lookup: string;
    last_user_update: string;
    avg_fragmentation_percent: number;
    page_count: number;
}

interface QueryResultDBStats {
    database_name: string;
    recovery_model: string;
    compatibility_level: number;
    log_reuse_wait_desc: string;
    page_verify_option: string;
    is_auto_create_stats_on: boolean;
    is_auto_update_stats_on: boolean;
    data_size_mb: number;
    log_size_mb: number;
    total_size_mb: number;
}

interface QueryResultBackupStatus {
    database_name: string;
    backup_type: string;
    backup_type_desc: string;
    backup_start_date: string;
    backup_finish_date: string;
    backup_size_mb: number;
    compressed_backup_size_mb: number;
    compression_ratio: number;
    backup_set_name: string;
    description: string;
    recovery_model: string;
    days_since_last_backup: number;
    backup_location: string;
    is_copy_only: boolean;
    is_damaged: boolean;
    has_backup_checksums: boolean;
    machine_name: string;
    server_name: string;
}

interface SystemMetrics {
    cpu_usage: number;
    cpu_cores: number;
    memory_usage: number;
    total_memory: number;
    free_memory: number;
    load_average_1m: number;
    load_average_5m: number;
    load_average_15m: number;
    total_disk: number;
    free_disk: number;
    os_version: string;
    kernel_version: string;
    uptime: number;
}

// Interfaces for historical metrics data
interface MetricDataPoint {
    _field: string;
    _measurement: string;
    _start: string;
    _stop: string;
    _time: string;
    _value: number;
    agent_id: string;
    result: string;
    table: number;
    host?: string;
    metric_type?: string;
    wait_type?: string;
    database?: string;
}

interface MetricsResponse {
    data: MetricDataPoint[];
    status: string;
}

// Performance metrics interface
interface PerformanceDataPoint {
    time: string;
    timestamp: number;
    batch_requests_per_sec?: number;
    buffer_cache_hit_ratio?: number;
    compilations_per_sec?: number;
    lazy_writes_per_sec?: number;
    lock_requests_per_sec?: number;
    lock_timeouts_per_sec?: number;
    lock_waits_per_sec?: number;
    page_life_expectancy?: number;
    page_reads_per_sec?: number;
    page_writes_per_sec?: number;
    recompilations_per_sec?: number;
}

// Transaction metrics interface
interface TransactionDataPoint {
    time: string;
    timestamp: number;
    active_total?: number;
    longest_running_time_seconds?: number;
    per_sec_total?: number;
    write_per_sec_total?: number;
    tempdb_free_space_kb?: number;
    update_conflict_ratio?: number;
    version_cleanup_rate_kb_per_sec?: number;
    version_generation_rate_kb_per_sec?: number;
    version_store_unit_count?: number;
    // Database-specific metrics will be stored as objects
    database_transactions?: { [database: string]: DatabaseTransactionMetrics };
}

interface DatabaseTransactionMetrics {
    active_by_database: number;
    per_sec: number;
    write_per_sec: number;
}

interface ChartDataPoint {
    time: string;
    timestamp: number;
    cpu_usage?: number;
    memory_usage?: number;
    memory_total?: number;
    memory_free?: number;
    memory_used?: number;
    active_connections?: number;
    idle_connections?: number;
    total_connections?: number;
    data_size?: number;
    log_size?: number;
    total_size?: number;
    blocking_sessions?: number;
    // Wait statistics fields - we'll store top wait types
    wait_tasks?: { [waitType: string]: number };
    wait_time_ms?: { [waitType: string]: number };
}

// Capacity planning interfaces
interface CapacityPrediction {
    period: string;
    data_size_mb: number;
    log_size_mb: number;
    total_size_mb: number;
    growth_rate_data: number;
    growth_rate_log: number;
    confidence_level: 'high' | 'medium' | 'low';
}

interface CapacityAnalysis {
    current_data_size_mb: number;
    current_log_size_mb: number;
    current_total_size_mb: number;
    daily_growth_data_mb: number;
    daily_growth_log_mb: number;
    daily_growth_total_mb: number;
    predictions: CapacityPrediction[];
    trend_analysis: {
        data_trend: 'increasing' | 'stable' | 'decreasing';
        log_trend: 'increasing' | 'stable' | 'decreasing';
        volatility: 'high' | 'medium' | 'low';
    };
    recommendations: string[];
}

// Utility functions
function formatBytes(bytes: number, decimals = 2) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    let i = 0;
    let size = bytes;

    while (size >= k && i < sizes.length - 1) {
        size /= k;
        i++;
    }

    return parseFloat(size.toFixed(dm)) + ' ' + sizes[i];
}

function formatSqlQuery(sql: string): string {
    if (!sql) return '';
    
    // Remove extra whitespace and normalize line breaks
    let formatted = sql.replace(/\s+/g, ' ').trim();
    
    // SQL keywords that should start new lines (order matters - longer phrases first)
    const keywords = [
        'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL JOIN', 'FULL OUTER JOIN',
        'GROUP BY', 'ORDER BY', 'PARTITION BY',
        'SELECT TOP', 'SELECT', 'FROM', 'WHERE', 'JOIN', 'HAVING', 'UNION', 
        'INSERT INTO', 'INSERT', 'UPDATE', 'DELETE FROM', 'DELETE',
        'CREATE TABLE', 'CREATE INDEX', 'CREATE VIEW', 'CREATE PROCEDURE', 'CREATE',
        'ALTER TABLE', 'ALTER', 'DROP TABLE', 'DROP INDEX', 'DROP VIEW', 'DROP',
        'DECLARE', 'SET', 'IF', 'ELSE', 'BEGIN', 'END',
        'CASE', 'WHEN', 'THEN', 'ELSE', 'WITH', 'AS'
    ];
    
    // Add line breaks before major keywords
    keywords.forEach(keyword => {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        formatted = formatted.replace(regex, `\n${keyword}`);
    });
    
    // Handle AND/OR in WHERE clauses with proper indentation
    formatted = formatted.replace(/\b(AND|OR)\b/gi, '\n    $1');
    
    // Handle comma-separated lists in SELECT statements
    // Look for SELECT ... FROM pattern and format columns
    formatted = formatted.replace(/(SELECT[^FROM]*?)(?=FROM)/gi, (match) => {
        return match.replace(/,(?!\s*\n)/g, ',\n    ');
    });
    
    // Handle comma-separated lists in other contexts
    formatted = formatted.replace(/,(?!\s*\n)/g, ',\n  ');
    
    // Clean up multiple consecutive newlines
    formatted = formatted.replace(/\n\s*\n/g, '\n');
    
    // Handle complex parentheses conditions
    formatted = formatted.replace(/\(\(/g, '(\n        (');
    formatted = formatted.replace(/\)\)/g, ')\n    )');
    
    // Better handling of WHERE conditions with multiple parentheses
    formatted = formatted.replace(/WHERE\s+\(\(/gi, 'WHERE (\n        (');
    
    // Split into lines and apply proper indentation
    const lines = formatted.split('\n');
    let indentLevel = 0;
    const indentedLines = lines.map(line => {
        const trimmedLine = line.trim();
        if (!trimmedLine) return '';
        
        // Decrease indent for closing keywords
        if (trimmedLine.match(/^(END|ELSE|\))/i)) {
            indentLevel = Math.max(0, indentLevel - 1);
        }
        
        let currentIndent = '    '.repeat(indentLevel);
        
        // Special indentation for specific keywords
        if (trimmedLine.match(/^(AND|OR)/i)) {
            currentIndent = '    '.repeat(Math.max(1, indentLevel));
        } else if (trimmedLine.match(/^(SELECT|FROM|WHERE|GROUP BY|ORDER BY|HAVING)/i)) {
            currentIndent = '';
        } else if (trimmedLine.match(/^(INNER JOIN|LEFT JOIN|RIGHT JOIN|FULL JOIN)/i)) {
            currentIndent = '';
        }
        
        // Increase indent for opening keywords
        if (trimmedLine.match(/^(BEGIN|CASE|IF|WHERE|SELECT)/i) && !trimmedLine.match(/^(WHERE.*\)$)/i)) {
            indentLevel++;
        }
        
        return currentIndent + trimmedLine;
    });
    
    // Clean up and return
    return indentedLines
        .filter(line => line.trim().length > 0)
        .join('\n')
        .trim();
}

// Main component wrapper with React Query
const MssqlPAWrapper: React.FC = () => {
    return (
        <QueryClientProvider client={queryClient}>
            <MssqlPA />
        </QueryClientProvider>
    );
};

// Main component
const MssqlPA: React.FC = () => {
    // Get user auth state from Redux
    const { isLoggedIn, user } = useSelector((state: any) => state.auth);
    const userData = {
        isAdmin: user?.role?.toLowerCase() === 'admin' || user?.username?.toLowerCase() === 'admin',
        isLoggedIn,
        username: user?.username || ''
    };
    
    // State variables
    const [clusterName, setClusterName] = useState<string>('');
    const [clusterNames, setClusterNames] = useState<string[]>([]);
    const [data, setData] = useState<Record<string, Node[]>>({});
    const [nodeInfo, setNodeInfo] = useState<Node[]>([]);
    const [nodeName, setNodeName] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [currentStep, setCurrentStep] = useState<number>(0);
    const [databaseNames, setDatabaseNames] = useState<string[]>([]);
    const [selectedDatabase, setSelectedDatabase] = useState<string>('');
    const [activeTab, setActiveTab] = useState<string>('1');
    const [selectedSubMenu, setSelectedSubMenu] = useState<string>('server-info');
    const [serverInfo, setServerInfo] = useState<QueryResultServerInfo | null>(null);
    const [connections, setConnections] = useState<QueryResultConnections | null>(null);
    const [topQueries, setTopQueries] = useState<QueryResultTopQueries[]>([]);
    const [activeQueries, setActiveQueries] = useState<QueryResultActiveQueries[]>([]);
    const [blockingInfo, setBlockingInfo] = useState<QueryResultBlockingInfo[]>([]);
    const [waitStats, setWaitStats] = useState<QueryResultWaitStats[]>([]);
    const [indexUsage, setIndexUsage] = useState<QueryResultIndexUsage[]>([]);
    const [dbStats, setDbStats] = useState<QueryResultDBStats[]>([]);
    const [backupStatus, setBackupStatus] = useState<QueryResultBackupStatus[]>([]);
    const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
    const [refreshInterval, setRefreshInterval] = useState<number>(0); // 0 means no auto-refresh
    const [countdown, setCountdown] = useState<number>(0);
    // Historical metrics state
    const [cpuHistoricalData, setCpuHistoricalData] = useState<ChartDataPoint[]>([]);
    const [memoryHistoricalData, setMemoryHistoricalData] = useState<ChartDataPoint[]>([]);
    const [connectionsHistoricalData, setConnectionsHistoricalData] = useState<ChartDataPoint[]>([]);
    const [databaseHistoricalData, setDatabaseHistoricalData] = useState<ChartDataPoint[]>([]);
    const [blockingHistoricalData, setBlockingHistoricalData] = useState<ChartDataPoint[]>([]);
    const [waitStatsHistoricalData, setWaitStatsHistoricalData] = useState<ChartDataPoint[]>([]);
    const [historicalDataLoading, setHistoricalDataLoading] = useState<boolean>(false);
    const [cpuDataLoading, setCpuDataLoading] = useState<boolean>(false);
    const [memoryDataLoading, setMemoryDataLoading] = useState<boolean>(false);
    const [connectionsDataLoading, setConnectionsDataLoading] = useState<boolean>(false);
    const [databaseDataLoading, setDatabaseDataLoading] = useState<boolean>(false);
    const [blockingDataLoading, setBlockingDataLoading] = useState<boolean>(false);
    const [waitStatsDataLoading, setWaitStatsDataLoading] = useState<boolean>(false);
    const [selectedTimeRange, setSelectedTimeRange] = useState<string>('1h');
    
    // AWS RDS related state
    const [isAWSRDS, setIsAWSRDS] = useState<boolean>(false);
    const [awsRegion, setAwsRegion] = useState<string>('');
    const [rdsInstanceId, setRdsInstanceId] = useState<string>('');
    const [rdsInstances, setRdsInstances] = useState<RDSInstanceInfo[]>([]);
    const [awsMetrics, setAwsMetrics] = useState<{[key: string]: CloudWatchMetric[]}>({});
    const [awsMetricsLoading, setAwsMetricsLoading] = useState<boolean>(false);

    const [awsCredentials, setAwsCredentials] = useState<any>(null); // Store credentials for AWS API calls
    
    // Performance metrics state
    const [performanceHistoricalData, setPerformanceHistoricalData] = useState<PerformanceDataPoint[]>([]);
    const [performanceDataLoading, setPerformanceDataLoading] = useState<boolean>(false);
    // Transaction metrics state
    const [transactionsHistoricalData, setTransactionsHistoricalData] = useState<TransactionDataPoint[]>([]);
    const [transactionsDataLoading, setTransactionsDataLoading] = useState<boolean>(false);
    
    // Capacity planning state
    const [capacityAnalysis, setCapacityAnalysis] = useState<CapacityAnalysis | null>(null);
    const [capacityDataLoading, setCapacityDataLoading] = useState<boolean>(false);
    
    // Modal state variables
    const [modalTitle, setModalTitle] = useState<string>('');
    const [modalContent, setModalContent] = useState<string>('');
    const [modalVisible, setModalVisible] = useState<boolean>(false);
    const [modalDatabase, setModalDatabase] = useState<string>('');
    // Execution plan state variables
    const [executionPlanLoading, setExecutionPlanLoading] = useState<boolean>(false);
    const [executionPlanVisible, setExecutionPlanVisible] = useState<boolean>(false);
    const [executionPlanData, setExecutionPlanData] = useState<string>('');
    // Prevent duplicate API calls
    const [manualNodeChangeInProgress, setManualNodeChangeInProgress] = useState<boolean>(false);
    // Track if auto-selection message has been shown
    const [autoSelectionMessageShown, setAutoSelectionMessageShown] = useState<boolean>(false);

    // Connection analysis state variables
    const [connectionAnalysisData, setConnectionAnalysisData] = useState<any>(null);
    const [connectionAnalysisLoading, setConnectionAnalysisLoading] = useState<boolean>(false);

    // URL params
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const clusterNameFromURL = queryParams.get('clusterName') || '';

    // Helper function to format MB values with smart unit conversion
    const formatMB = (mb: number): string => {
        if (mb === 0) return '0 MB';
        if (mb >= 1024 * 1024) {
            // TB
            return (mb / (1024 * 1024)).toFixed(1) + ' TB';
        } else if (mb >= 1024) {
            // GB
            return (mb / 1024).toFixed(1) + ' GB';
        } else {
            // MB
            return mb.toFixed(1) + ' MB';
        }
    };

    // Helper function to format MB values for growth indicators (more conservative conversion)
    const formatGrowthMB = (mb: number): string => {
        if (mb === 0) return '0 MB';
        if (mb >= 1024 * 1024) {
            // TB
            return (mb / (1024 * 1024)).toFixed(1) + ' TB';
        } else if (mb >= 1024) {
            // GB - only convert if >= 1GB
            return (mb / 1024).toFixed(1) + ' GB';
        } else {
            // MB - keep MB for values < 1GB
            return mb.toFixed(0) + ' MB';
        }
    };
    const hostNameFromURL = queryParams.get('hostName') || '';

    // React Query client
    const queryClient = useQueryClient();

    // Fetch MSSQL clusters with React Query
    const { data: clusterData, isLoading, isError } = useQuery({
        queryKey: ['mssql-clusters'],
        queryFn: async () => {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/status/mssql`, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                }
            });

            if (response.data.status === "success" && Array.isArray(response.data.data)) {
                return response.data.data;
            }

            throw new Error("Unexpected API response format");
        }
    });

    // Handle cluster data changes
    useEffect(() => {
        if (clusterData) {
            const fetchedClusters = clusterData.map(
                (clusterObject: any) => Object.keys(clusterObject)[0]
            );

            // Map empty cluster names to "Standalone" for display purposes
            const displayClusterNames = fetchedClusters.map((name: string) =>
                name === '' ? 'Standalone' : name
            );
            setClusterNames(displayClusterNames);

            // Create clusters data mapping, preserving original keys but also adding Standalone mapping
            const clustersData = clusterData.reduce((acc: Record<string, Node[]>, curr: any) => {
                const originalClusterName = Object.keys(curr)[0];
                const displayClusterName = originalClusterName === '' ? 'Standalone' : originalClusterName;

                // Store under both original key (for API calls) and display key (for UI)
                acc[originalClusterName] = curr[originalClusterName];
                if (originalClusterName === '') {
                    acc['Standalone'] = curr[originalClusterName];
                }
                return acc;
            }, {});
            setData(clustersData);
            // Loading state is handled by React Query (isLoading)

                    // Check for standalone clusters using display names
        const standaloneClusters = displayClusterNames.filter((name: string) => name === 'Standalone');
        const nonStandaloneClusters = displayClusterNames.filter((name: string) => name !== 'Standalone');

        // Auto-select logic - use display names
        let selectedCluster = '';
        
        if (clusterNameFromURL && displayClusterNames.includes(clusterNameFromURL)) {
            // URL specified cluster exists, use it
            selectedCluster = clusterNameFromURL;
        } else if (standaloneClusters.length === 1 && nonStandaloneClusters.length === 0) {
            // Only standalone clusters exist, auto-select the first one
            selectedCluster = 'Standalone';
            if (!autoSelectionMessageShown) {
                message.info('Standalone MSSQL node detected - automatically selected');
                setAutoSelectionMessageShown(true);
            }
        } else if (standaloneClusters.length > 0 && !clusterName) {
            // Mix of standalone and cluster nodes, auto-select standalone if no cluster selected
            selectedCluster = 'Standalone';
            if (!autoSelectionMessageShown) {
                message.info('Auto-selected standalone MSSQL cluster');
                setAutoSelectionMessageShown(true);
            }
        } else if (displayClusterNames.length > 0 && !clusterName) {
            // Auto-select first cluster if none is selected and URL doesn't specify one
            selectedCluster = displayClusterNames[0];
        }
        
        // Set the selected cluster if we have one
        if (selectedCluster && selectedCluster !== clusterName) {
            setClusterName(selectedCluster);
        }
        }
    }, [clusterData]);

    // Handle error
    useEffect(() => {
        if (isError) {
            message.error('Failed to fetch clusters. Please try again.');
            setClusterNames([]);
            setData({});
            // Loading state is handled by React Query (isLoading)
        }
    }, [isError]);

    // Listen for global AWS RDS addition events from header dropdown
    useEffect(() => {
        const handleAWSRDSAdded = (event: any) => {
            const { rdsInstance, credentials } = event.detail;
            handleAWSRDSSuccess(rdsInstance, credentials);
        };

        window.addEventListener('awsRDSAdded', handleAWSRDSAdded);
        
        return () => {
            window.removeEventListener('awsRDSAdded', handleAWSRDSAdded);
        };
    }, []);

    // Load saved RDS instances on component mount
    useEffect(() => {
        if (isLoggedIn) {
            loadSavedRDSInstances();
        }
    }, [isLoggedIn]);

    // Function for showing SQL command modal
    const showCommandModal = (command: string) => {
        // Implementation similar to postgrepa.tsx
        Modal.info({
            title: (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}>
                    <FileSearchOutlined style={{ fontSize: '20px', color: '#cc2927' }} />
                    Query Details
                </div>
            ),
            content: (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px'
                }}>
                    <div style={{
                        padding: '16px',
                        backgroundColor: '#f5f5f5',
                        borderRadius: '4px',
                        border: '1px solid #d9d9d9',
                        maxHeight: '50vh',
                        overflowY: 'auto'
                    }}>
                        <MonacoEditor
                            value={command}
                            readOnly={true}
                            height="400px"
                        />
                    </div>
                </div>
            ),
            width: '80%',
            style: { top: '20px' },
            className: 'query-details-modal',
            maskClosable: true,
            footer: (
                <div style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '8px',
                    padding: '16px 0 0 0'
                }}>
                    <Button
                        onClick={() => {
                            navigator.clipboard.writeText(command);
                            message.success('Query copied to clipboard!');
                        }}
                        icon={<CopyOutlined />}
                    >
                        Copy
                    </Button>
                    <Button onClick={() => Modal.destroyAll()}>
                        Close
                    </Button>
                </div>
            )
        });
    };

    // Data fetching functions will be implemented here
    // fetchServerInfo, fetchConnections, fetchTopQueries, etc.

    // Fetch MSSQL Server Information
    const fetchServerInfo = async (nodeName: string) => {
        if (!nodeName) return;

        try {
            setLoading(true);
            const agentId = `agent_${nodeName}`;

            const query = `SELECT SERVERPROPERTY('ServerName') AS servername, SERVERPROPERTY('Edition') AS edition, SERVERPROPERTY('ProductVersion') AS engine_version, SERVERPROPERTY('InstanceName') AS instance_name, SERVERPROPERTY('IsClustered') AS is_clustered, SERVERPROPERTY('IsHadrEnabled') AS is_hadr_enabled;`;

            const token = localStorage.getItem('token');
            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/agents/${agentId}/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                credentials: 'include',
                body: JSON.stringify({
                    query_id: 'mssql_server_info',
                    command: query
                })
            });

            if (!response.ok) {
                throw new Error('API response not ok');
            }

            const data = await response.json();
            if (data.status === 'success' && data.result) {
                const result = data.result;
                if (result.type_url === 'type.googleapis.com/google.protobuf.Value') {
                    try {
                        // Base64 decode
                        const decodedValue = atob(result.value);
                        // JSON parse
                        const parsedResult = JSON.parse(decodedValue);

                        // Agent may return data in different formats
                        if (parsedResult.status === 'success') {
                            // Extract server info from result
                            const serverInfo: QueryResultServerInfo = {
                                servername: parsedResult.servername || '',
                                edition: parsedResult.edition || '',
                                engine_version: parsedResult.engine_version || '',
                                instance_name: parsedResult.instance_name || '',
                                is_clustered: parsedResult.is_clustered === 1,
                                is_hadr_enabled: parsedResult.is_hadr_enabled === 1
                            };

                            setServerInfo(serverInfo);
                        } else {
                            console.error('Invalid server info data:', parsedResult);
                            message.error('Failed to retrieve server information');
                        }
                    } catch (error) {
                        console.error('Error parsing server info result:', error);
                        message.error('Error parsing server information');
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching server info:', error);
            message.error('Failed to fetch server information');
        } finally {
            setLoading(false);
        }
    };

    // Fetch MSSQL databases
    const fetchDatabases = async (nodeName: string): Promise<string[]> => {
        if (!nodeName) return [];

        try {
            setLoading(true);
            const agentId = `agent_${nodeName}`;

            const query = `SELECT name FROM sys.databases WHERE name NOT IN ('master', 'tempdb', 'model', 'msdb') ORDER BY name;`;

            const token = localStorage.getItem('token');
            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/agents/${agentId}/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                credentials: 'include',
                body: JSON.stringify({
                    query_id: 'mssql_databases',
                    command: query
                })
            });

            if (!response.ok) {
                throw new Error('API response not ok');
            }

            const data = await response.json();
            if (data.status === 'success' && data.result) {
                const result = data.result;
                if (result.type_url === 'type.googleapis.com/google.protobuf.Value') {
                    try {
                        // Base64 decode
                        const decodedValue = atob(result.value);
                        // JSON parse
                        const parsedResult = JSON.parse(decodedValue);

                        // Process the database list
                        const databases: string[] = [];

                        // Add system databases first
                        databases.push('master', 'msdb');

                        // Agent may return data in different formats
                        if (parsedResult.status === 'success' && parsedResult.row_count > 0) {
                            const rowCount = parsedResult.row_count || 0;

                            for (let i = 0; i < rowCount; i++) {
                                if (parsedResult[`name_${i}`]) {
                                    databases.push(parsedResult[`name_${i}`]);
                                }
                            }
                        }

                        setDatabaseNames(databases);

                        // If not already selected, set the first database as selected
                        if (!selectedDatabase && databases.length > 0) {
                            setSelectedDatabase(databases[0]);
                        }

                        // Return the database list for immediate use
                        return databases;
                    } catch (error) {
                        console.error('Error parsing databases result:', error);
                        message.error('Error parsing database list');
                        return ['master', 'msdb'];
                    }
                }
            }
            return ['master', 'msdb'];
        } catch (error) {
            console.error('Error fetching databases:', error);
            message.error('Failed to fetch database list');
            return ['master', 'msdb'];
        } finally {
            setLoading(false);
        }
    };



    // Fetch MSSQL Top Queries
    const fetchTopQueries = async (nodeName: string) => {
        if (!nodeName) return;

        try {
            setLoading(true);
            const agentId = `agent_${nodeName}`;

            const query = `
            WITH TopSP AS (
    SELECT TOP 50
        qt.text as query_text,
        OBJECT_SCHEMA_NAME(ps.object_id) as schema_name,
        OBJECT_NAME(ps.object_id) as object_name,
        DB_NAME(ps.database_id) as database_name,
        'Stored Procedure' as query_type,
        ps.execution_count,
        ps.total_worker_time,
        ps.total_worker_time * 1.0 / NULLIF(ps.execution_count, 0) as avg_worker_time,
        ps.total_elapsed_time,
        ps.total_elapsed_time * 1.0 / NULLIF(ps.execution_count, 0) as avg_elapsed_time,
        ps.total_logical_reads,
        ps.total_logical_reads * 1.0 / NULLIF(ps.execution_count, 0) as avg_logical_reads,
        ps.last_execution_time
    FROM sys.dm_exec_procedure_stats ps
    CROSS APPLY sys.dm_exec_sql_text(ps.sql_handle) as qt
    WHERE ps.total_worker_time > 0
    ORDER BY ps.total_worker_time DESC
),
TopAdHoc AS (
    SELECT TOP 50
        SUBSTRING(qt.text, (qs.statement_start_offset/2)+1, 
            ((CASE qs.statement_end_offset 
                WHEN -1 THEN DATALENGTH(qt.text) 
                ELSE qs.statement_end_offset END - qs.statement_start_offset)/2) + 1) as query_text,
        NULL as schema_name,
        NULL as object_name,
        DB_NAME(qp.dbid) as database_name,
        'Ad-hoc Query' as query_type,
        qs.execution_count,
        qs.total_worker_time,
        qs.total_worker_time * 1.0 / NULLIF(qs.execution_count, 0) as avg_worker_time,
        qs.total_elapsed_time,
        qs.total_elapsed_time * 1.0 / NULLIF(qs.execution_count, 0) as avg_elapsed_time,
        qs.total_logical_reads,
        qs.total_logical_reads * 1.0 / NULLIF(qs.execution_count, 0) as avg_logical_reads,
        qs.last_execution_time
    FROM sys.dm_exec_query_stats as qs 
    CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) as qt
    CROSS APPLY sys.dm_exec_query_plan(qs.plan_handle) as qp
    WHERE qt.text NOT LIKE '%sys.%' 
        AND qt.text NOT LIKE '%dm_exec%'
        AND qs.total_worker_time > 0
    ORDER BY qs.total_worker_time DESC
)
SELECT TOP 10 *
FROM (
    SELECT * FROM TopSP
    UNION ALL
    SELECT * FROM TopAdHoc
) AS Combined
ORDER BY total_worker_time DESC;`;

            const token = localStorage.getItem('token');
            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/agents/${agentId}/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                credentials: 'include',
                body: JSON.stringify({
                    query_id: 'mssql_top_queries',
                    command: query
                })
            });

            if (!response.ok) {
                throw new Error('API response not ok');
            }

            const data = await response.json();
            if (data.status === 'success' && data.result) {
                const result = data.result;
                if (result.type_url === 'type.googleapis.com/google.protobuf.Value') {
                    try {
                        // Base64 decode
                        const decodedValue = atob(result.value);
                        // JSON parse
                        const parsedResult = JSON.parse(decodedValue);

                        // Extract top queries
                        const queryResults: QueryResultTopQueries[] = [];

                        if (parsedResult.status === 'success' && parsedResult.row_count > 0) {
                            const rowCount = parsedResult.row_count || 0;

                            for (let i = 0; i < rowCount; i++) {
                                queryResults.push({
                                    query_text: parsedResult[`query_text_${i}`] || '',
                                    schema_name: parsedResult[`schema_name_${i}`] || null,
                                    object_name: parsedResult[`object_name_${i}`] || null,
                                    database_name: parsedResult[`database_name_${i}`] || null,
                                    query_type: parsedResult[`query_type_${i}`] || 'Ad-hoc Query',
                                    execution_count: parseInt(parsedResult[`execution_count_${i}`]) || 0,
                                    total_worker_time: parseInt(parsedResult[`total_worker_time_${i}`]) || 0,
                                    avg_worker_time: parseInt(parsedResult[`avg_worker_time_${i}`]) || 0,
                                    total_elapsed_time: parseInt(parsedResult[`total_elapsed_time_${i}`]) || 0,
                                    avg_elapsed_time: parseInt(parsedResult[`avg_elapsed_time_${i}`]) || 0,
                                    total_logical_reads: parseInt(parsedResult[`total_logical_reads_${i}`]) || 0,
                                    avg_logical_reads: parseInt(parsedResult[`avg_logical_reads_${i}`]) || 0,
                                    last_execution_time: parsedResult[`last_execution_time_${i}`] || ''
                                });
                            }

                            setTopQueries(queryResults);
                        } else {
                            console.error('Invalid top queries data:', parsedResult);
                        }
                    } catch (error) {
                        console.error('Error parsing top queries result:', error);
                        message.error('Error parsing top queries information');
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching top queries:', error);
            message.error('Failed to fetch top queries information');
        } finally {
            setLoading(false);
        }
    };

    // Fetch MSSQL Backup Status
    const fetchBackupStatus = async (nodeName: string) => {
        if (!nodeName) return;

        try {
            setLoading(true);
            const agentId = `agent_${nodeName}`;

            const query = `
            WITH BackupHistory AS (
                SELECT 
                    d.name as database_name,
                    bs.type as backup_type,
                    CASE bs.type 
                        WHEN 'D' THEN 'Full Database'
                        WHEN 'I' THEN 'Differential'
                        WHEN 'L' THEN 'Transaction Log'
                        WHEN 'F' THEN 'File or Filegroup'
                        WHEN 'G' THEN 'Differential File'
                        WHEN 'P' THEN 'Partial'
                        WHEN 'Q' THEN 'Differential Partial'
                        ELSE 'Unknown'
                    END as backup_type_desc,
                    bs.backup_start_date,
                    bs.backup_finish_date,
                    CAST(bs.backup_size / 1024.0 / 1024.0 AS DECIMAL(10,2)) as backup_size_mb,
                    CAST(bs.compressed_backup_size / 1024.0 / 1024.0 AS DECIMAL(10,2)) as compressed_backup_size_mb,
                    CASE 
                        WHEN bs.compressed_backup_size > 0 AND bs.backup_size > 0 
                        THEN CAST((1.0 - (CAST(bs.compressed_backup_size AS FLOAT) / CAST(bs.backup_size AS FLOAT))) * 100 AS DECIMAL(5,2))
                        ELSE 0.00
                    END as compression_ratio,
                    ISNULL(bs.name, 'N/A') as backup_set_name,
                    ISNULL(bs.description, 'N/A') as description,
                    d.recovery_model_desc as recovery_model,
                    DATEDIFF(DAY, bs.backup_finish_date, GETDATE()) as days_since_last_backup,
                    ISNULL(bmf.physical_device_name, 'N/A') as backup_location,
                    bs.is_copy_only,
                    bs.is_damaged,
                    bs.has_backup_checksums,
                    bs.machine_name,
                    bs.server_name,
                    ROW_NUMBER() OVER (PARTITION BY d.name, bs.type ORDER BY bs.backup_finish_date DESC) as rn
                FROM sys.databases d
                LEFT JOIN msdb.dbo.backupset bs ON d.name = bs.database_name
                LEFT JOIN msdb.dbo.backupmediafamily bmf ON bs.media_set_id = bmf.media_set_id
                WHERE d.name NOT IN ('master', 'model', 'msdb', 'tempdb')
                  AND d.state = 0  -- ONLINE
            )
            SELECT 
                database_name,
                backup_type,
                backup_type_desc,
                ISNULL(CONVERT(VARCHAR(20), backup_start_date, 120), 'Never') as backup_start_date,
                ISNULL(CONVERT(VARCHAR(20), backup_finish_date, 120), 'Never') as backup_finish_date,
                ISNULL(backup_size_mb, 0) as backup_size_mb,
                ISNULL(compressed_backup_size_mb, 0) as compressed_backup_size_mb,
                ISNULL(compression_ratio, 0) as compression_ratio,
                backup_set_name,
                description,
                recovery_model,
                ISNULL(days_since_last_backup, 9999) as days_since_last_backup,
                backup_location,
                ISNULL(is_copy_only, 0) as is_copy_only,
                ISNULL(is_damaged, 0) as is_damaged,
                ISNULL(has_backup_checksums, 0) as has_backup_checksums,
                ISNULL(machine_name, 'N/A') as machine_name,
                ISNULL(server_name, 'N/A') as server_name
            FROM BackupHistory
            WHERE rn = 1  -- Only get the most recent backup of each type for each database
            ORDER BY database_name, backup_type;`;

            const token = localStorage.getItem('token');
            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/agents/${agentId}/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                credentials: 'include',
                body: JSON.stringify({
                    query_id: 'mssql_backup_status',
                    command: query
                })
            });

            if (!response.ok) {
                throw new Error('API response not ok');
            }

            const data = await response.json();
            if (data.status === 'success' && data.result) {
                const result = data.result;
                if (result.type_url === 'type.googleapis.com/google.protobuf.Value') {
                    try {
                        // Base64 decode
                        const decodedValue = atob(result.value);
                        // JSON parse
                        const parsedResult = JSON.parse(decodedValue);

                        // Extract backup status
                        const backupResults: QueryResultBackupStatus[] = [];

                        if (parsedResult.status === 'success' && parsedResult.row_count > 0) {
                            const rowCount = parsedResult.row_count || 0;

                            for (let i = 0; i < rowCount; i++) {
                                backupResults.push({
                                    database_name: parsedResult[`database_name_${i}`] || '',
                                    backup_type: parsedResult[`backup_type_${i}`] || '',
                                    backup_type_desc: parsedResult[`backup_type_desc_${i}`] || '',
                                    backup_start_date: parsedResult[`backup_start_date_${i}`] || '',
                                    backup_finish_date: parsedResult[`backup_finish_date_${i}`] || '',
                                    backup_size_mb: parseFloat(parsedResult[`backup_size_mb_${i}`]) || 0,
                                    compressed_backup_size_mb: parseFloat(parsedResult[`compressed_backup_size_mb_${i}`]) || 0,
                                    compression_ratio: parseFloat(parsedResult[`compression_ratio_${i}`]) || 0,
                                    backup_set_name: parsedResult[`backup_set_name_${i}`] || '',
                                    description: parsedResult[`description_${i}`] || '',
                                    recovery_model: parsedResult[`recovery_model_${i}`] || '',
                                    days_since_last_backup: parseInt(parsedResult[`days_since_last_backup_${i}`]) || 0,
                                    backup_location: parsedResult[`backup_location_${i}`] || '',
                                    is_copy_only: parsedResult[`is_copy_only_${i}`] === '1' || parsedResult[`is_copy_only_${i}`] === 'true',
                                    is_damaged: parsedResult[`is_damaged_${i}`] === '1' || parsedResult[`is_damaged_${i}`] === 'true',
                                    has_backup_checksums: parsedResult[`has_backup_checksums_${i}`] === '1' || parsedResult[`has_backup_checksums_${i}`] === 'true',
                                    machine_name: parsedResult[`machine_name_${i}`] || '',
                                    server_name: parsedResult[`server_name_${i}`] || ''
                                });
                            }

                            setBackupStatus(backupResults);
                        } else {
                            console.error('Invalid backup status data:', parsedResult);
                        }
                    } catch (error) {
                        console.error('Error parsing backup status result:', error);
                        message.error('Error parsing backup status information');
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching backup status:', error);
            message.error('Failed to fetch backup status information');
        } finally {
            setLoading(false);
        }
    };

    // Fetch MSSQL Active Queries
    const fetchActiveQueries = async (nodeName: string) => {
        if (!nodeName) return;

        try {
            setLoading(true);
            const agentId = `agent_${nodeName}`;

            const query = `
SELECT
    SPID                = er.session_id
    ,BlkBy              = er.blocking_session_id
    ,ElapsedMS          = er.total_elapsed_time
,ElapsedMin = er.total_elapsed_time / 60000
    ,CPU                = er.cpu_time
    ,IOReads            = er.logical_reads + er.reads
    ,IOWrites           = er.writes
    ,Executions         = ec.execution_count
    ,CommandType        = er.command
    ,ObjectName         = OBJECT_SCHEMA_NAME(qt.objectid,dbid) + '.' + OBJECT_NAME(qt.objectid, qt.dbid)
    ,SQLStatement       =
        SUBSTRING
        (
            qt.text,
            er.statement_start_offset/2,
            (CASE WHEN er.statement_end_offset = -1
                THEN LEN(CONVERT(NVARCHAR(MAX), qt.text)) * 2
                ELSE er.statement_end_offset
                END - er.statement_start_offset)/2
        )
    ,Status             = ses.status
    ,[Login]            = ses.login_name
    ,Host               = ses.host_name
    ,DBName             = DB_NAME(er.database_id)
    ,LastWaitType       = er.last_wait_type
    ,StartTime          = er.start_time
    ,Protocol           = con.net_transport
    ,transaction_isolation =
        CASE ses.transaction_isolation_level
            WHEN 0 THEN 'Unspecified'
            WHEN 1 THEN 'Read Uncommitted'
            WHEN 2 THEN 'Read Committed'
            WHEN 3 THEN 'Repeatable'
            WHEN 4 THEN 'Serializable'
            WHEN 5 THEN 'Snapshot'
        END
    ,ConnectionWrites   = con.num_writes
    ,ConnectionReads    = con.num_reads
    ,ClientAddress      = con.client_net_address
    ,Authentication     = con.auth_scheme
FROM sys.dm_exec_requests er
LEFT JOIN sys.dm_exec_sessions ses
ON ses.session_id = er.session_id
LEFT JOIN sys.dm_exec_connections con
ON con.session_id = ses.session_id
CROSS APPLY sys.dm_exec_sql_text(er.sql_handle) AS qt
OUTER APPLY
(
    SELECT execution_count = MAX(cp.usecounts)
    FROM sys.dm_exec_cached_plans cp
    WHERE cp.plan_handle = er.plan_handle
) ec
ORDER BY
    er.blocking_session_id DESC,
    er.logical_reads + er.reads DESC,
    er.session_id;`;

            const token = localStorage.getItem('token');
            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/agents/${agentId}/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                credentials: 'include',
                body: JSON.stringify({
                    query_id: 'mssql_active_queries',
                    command: query
                })
            });

            if (!response.ok) {
                throw new Error('API response not ok');
            }

            const data = await response.json();
            if (data.status === 'success' && data.result) {
                const result = data.result;
                if (result.type_url === 'type.googleapis.com/google.protobuf.Value') {
                    try {
                        // Base64 decode
                        const decodedValue = atob(result.value);
                        // JSON parse
                        const parsedResult = JSON.parse(decodedValue);

                        // Extract active queries
                        const queryResults: QueryResultActiveQueries[] = [];

                        if (parsedResult.status === 'success' && parsedResult.row_count > 0) {
                            const rowCount = parsedResult.row_count || 0;

                            for (let i = 0; i < rowCount; i++) {
                                queryResults.push({
                                    SPID: parseInt(parsedResult[`SPID_${i}`]) || 0,
                                    BlkBy: parseInt(parsedResult[`BlkBy_${i}`]) || 0,
                                    ElapsedMS: parseInt(parsedResult[`ElapsedMS_${i}`]) || 0,
                                    ElapsedMin: parseFloat(parsedResult[`ElapsedMin_${i}`]) || 0,
                                    CPU: parseInt(parsedResult[`CPU_${i}`]) || 0,
                                    IOReads: parseInt(parsedResult[`IOReads_${i}`]) || 0,
                                    IOWrites: parseInt(parsedResult[`IOWrites_${i}`]) || 0,
                                    Executions: parseInt(parsedResult[`Executions_${i}`]) || 0,
                                    CommandType: parsedResult[`CommandType_${i}`] || '',
                                    ObjectName: parsedResult[`ObjectName_${i}`] || '',
                                    SQLStatement: parsedResult[`SQLStatement_${i}`] || '',
                                    Status: parsedResult[`Status_${i}`] || '',
                                    Login: parsedResult[`Login_${i}`] || '',
                                    Host: parsedResult[`Host_${i}`] || '',
                                    DBName: parsedResult[`DBName_${i}`] || '',
                                    LastWaitType: parsedResult[`LastWaitType_${i}`] || '',
                                    StartTime: parsedResult[`StartTime_${i}`] || '',
                                    Protocol: parsedResult[`Protocol_${i}`] || '',
                                    transaction_isolation: parsedResult[`transaction_isolation_${i}`] || '',
                                    ConnectionWrites: parseInt(parsedResult[`ConnectionWrites_${i}`]) || 0,
                                    ConnectionReads: parseInt(parsedResult[`ConnectionReads_${i}`]) || 0,
                                    ClientAddress: parsedResult[`ClientAddress_${i}`] || '',
                                    Authentication: parsedResult[`Authentication_${i}`] || ''
                                });
                            }

                            setActiveQueries(queryResults);
                        } else {
                            console.error('Invalid active queries data:', parsedResult);
                        }
                    } catch (error) {
                        console.error('Error parsing active queries result:', error);
                        message.error('Error parsing active queries information');
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching active queries:', error);
            message.error('Failed to fetch active queries information');
        } finally {
            setLoading(false);
        }
    };

    // Kill a blocking session
    const killBlockingSession = async (nodeName: string, sessionId: number) => {
        if (!nodeName || !sessionId) return;

        try {
            setLoading(true);
            const agentId = `agent_${nodeName}`;
            
            // KILL command to terminate the session
            const killCommand = `KILL ${sessionId};`;
            
            const token = localStorage.getItem('token');
            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/agents/${agentId}/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                credentials: 'include',
                body: JSON.stringify({
                    query_id: 'mssql_kill_session',
                    command: killCommand
                })
            });

            if (!response.ok) {
                throw new Error('API response not ok');
            }

            const data = await response.json();
            if (data.status === 'success') {
                message.success(`Successfully killed session ${sessionId}`);
                // Refresh blocking info to update the UI
                fetchBlockingInfo(nodeName);
            } else {
                message.error(`Failed to kill session ${sessionId}: ${data.message || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Error killing session:', error);
            message.error(`Failed to kill session ${sessionId}`);
        } finally {
            setLoading(false);
        }
    };

    // Fetch MSSQL Blocking Information
    const fetchBlockingInfo = async (nodeName: string) => {
        if (!nodeName) return;

        try {
            setLoading(true);
            const agentId = `agent_${nodeName}`;

            const query = `WITH BlockingInfo AS (
    SELECT 
        r.session_id AS blocked_session_id,
        r.blocking_session_id,
        r.wait_type,
        r.wait_time,
        r.wait_resource,
        t.text AS blocked_query,
        s.program_name AS blocked_program,
        s.login_name AS blocked_login,
        s.host_name AS blocked_host
    FROM sys.dm_exec_requests r
    INNER JOIN sys.dm_exec_sessions s ON r.session_id = s.session_id
    OUTER APPLY sys.dm_exec_sql_text(r.sql_handle) t
    WHERE r.blocking_session_id <> 0
),
BlockingSessions AS (
    SELECT 
        s.session_id AS blocking_session_id,
        COALESCE(
            t.text COLLATE DATABASE_DEFAULT,
            ib.event_info COLLATE DATABASE_DEFAULT
        ) AS blocking_query,
        s.program_name AS blocking_program,
        s.login_name AS blocking_login,
        s.host_name AS blocking_host
    FROM sys.dm_exec_sessions s
    LEFT JOIN sys.dm_exec_requests r ON s.session_id = r.session_id
    OUTER APPLY sys.dm_exec_sql_text(r.sql_handle) t
    OUTER APPLY sys.dm_exec_input_buffer(s.session_id, NULL) ib
    WHERE s.session_id IN (SELECT blocking_session_id FROM BlockingInfo)
)
SELECT 
    bi.blocking_session_id,
    bs.blocking_program,
    bs.blocking_login,
    bs.blocking_host,
    bs.blocking_query,
    bi.blocked_session_id,
    bi.blocked_program,
    bi.blocked_login,
    bi.blocked_host,
    bi.wait_type,
    bi.wait_time,
    bi.wait_resource,
    bi.blocked_query
FROM BlockingInfo bi
LEFT JOIN BlockingSessions bs ON bi.blocking_session_id = bs.blocking_session_id
ORDER BY bi.wait_time DESC;`;

            const token = localStorage.getItem('token');
            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/agents/${agentId}/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                credentials: 'include',
                body: JSON.stringify({
                    query_id: 'mssql_blocking',
                    command: query
                })
            });

            if (!response.ok) {
                throw new Error('API response not ok');
            }

            const data = await response.json();
            if (data.status === 'success' && data.result) {
                const result = data.result;
                if (result.type_url === 'type.googleapis.com/google.protobuf.Value') {
                    try {
                        // Base64 decode
                        const decodedValue = atob(result.value);
                        // JSON parse
                        const parsedResult = JSON.parse(decodedValue);

                        // Extract blocking information
                        const blockingResults: QueryResultBlockingInfo[] = [];

                        if (parsedResult.status === 'success' && parsedResult.row_count > 0) {
                            const rowCount = parsedResult.row_count || 0;

                            for (let i = 0; i < rowCount; i++) {
                                blockingResults.push({
                                    blocking_session_id: parseInt(parsedResult[`blocking_session_id_${i}`]) || 0,
                                    blocking_program: parsedResult[`blocking_program_${i}`] || '',
                                    blocking_login: parsedResult[`blocking_login_${i}`] || '',
                                    blocking_host: parsedResult[`blocking_host_${i}`] || '',
                                    blocking_query: parsedResult[`blocking_query_${i}`] || '',
                                    blocked_session_id: parseInt(parsedResult[`blocked_session_id_${i}`]) || 0,
                                    blocked_program: parsedResult[`blocked_program_${i}`] || '',
                                    blocked_login: parsedResult[`blocked_login_${i}`] || '',
                                    blocked_host: parsedResult[`blocked_host_${i}`] || '',
                                    wait_type: parsedResult[`wait_type_${i}`] || '',
                                    wait_time: parseInt(parsedResult[`wait_time_${i}`]) || 0,
                                    wait_resource: parsedResult[`wait_resource_${i}`] || '',
                                    blocked_query: parsedResult[`blocked_query_${i}`] || ''
                                });
                            }

                            setBlockingInfo(blockingResults);
                        } else if (parsedResult.status === 'success' &&
                            (parsedResult.blocked_session_id || parsedResult.blocking_session_id)) {
                            // Direct response format without using row_count
                            blockingResults.push({
                                blocking_session_id: parseInt(parsedResult.blocking_session_id) || 0,
                                blocking_program: parsedResult.blocking_program || '',
                                blocking_login: parsedResult.blocking_login || '',
                                blocking_host: parsedResult.blocking_host || '',
                                blocking_query: parsedResult.blocking_query || '',
                                blocked_session_id: parseInt(parsedResult.blocked_session_id) || 0,
                                blocked_program: parsedResult.blocked_program || '',
                                blocked_login: parsedResult.blocked_login || '',
                                blocked_host: parsedResult.blocked_host || '',
                                wait_type: parsedResult.wait_type || '',
                                wait_time: parseInt(parsedResult.wait_time) || 0,
                                wait_resource: parsedResult.wait_resource || '',
                                blocked_query: parsedResult.blocked_query || ''
                            });

                            setBlockingInfo(blockingResults);
                        } else {
                            // No blocking found is a good thing - just set empty array
                            setBlockingInfo([]);
                        }
                    } catch (error) {
                        console.error('Error parsing blocking info result:', error);
                        message.error('Error parsing blocking information');
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching blocking info:', error);
            message.error('Failed to fetch blocking information');
        } finally {
            setLoading(false);
        }
    };





    // Fetch historical CPU metrics
    const fetchCpuHistoricalData = async (nodeName: string, range: string = '1h') => {
        if (!nodeName) return;

        try {
            setCpuDataLoading(true);
            const agentId = `agent_${nodeName}`;

                    const token = localStorage.getItem('token');
        const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/metrics/cpu?agent_id=${agentId}&range=${range}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            credentials: 'include'
        });

            if (!response.ok) {
                throw new Error('Failed to fetch CPU metrics');
            }

            const data: MetricsResponse = await response.json();

            if (data.status === 'success' && data.data) {
                // Process the data for chart
                const timeMap = new Map<string, ChartDataPoint>();
                let latestCpuCores = 0;
                let latestCpuUsage = 0;
                let latestCpuTimestamp = 0;

                data.data.forEach(point => {
                    // CPU usage data for chart
                    if (point._field === 'cpu_usage' && point._measurement === 'mssql_system') {
                        const timeKey = point._time;
                        const timestamp = new Date(point._time).getTime();
                        const date = new Date(point._time);
                        const isLongRange = range.includes('d') || range === '7d' || range === '30d' || 
                                          parseInt(range.replace(/\D/g, '')) >= 24;
                        const formattedTime = isLongRange ? date.toLocaleDateString() : date.toLocaleTimeString();

                        if (!timeMap.has(timeKey)) {
                            timeMap.set(timeKey, {
                                time: formattedTime,
                                timestamp: timestamp,
                                cpu_usage: point._value
                            });
                        } else {
                            const existing = timeMap.get(timeKey)!;
                            existing.cpu_usage = point._value;
                        }

                        // Keep track of the latest CPU usage value
                        if (timestamp > latestCpuTimestamp) {
                            latestCpuTimestamp = timestamp;
                            latestCpuUsage = point._value;
                        }
                    }

                    // CPU cores info for current metrics
                    if (point._field === 'cpu_cores' && point._measurement === 'mssql_system') {
                        latestCpuCores = point._value;
                    }
                });

                // Convert map to array and sort by timestamp
                const sortedData = Array.from(timeMap.values()).sort((a, b) => a.timestamp - b.timestamp);
                setCpuHistoricalData(sortedData);

                // Update system metrics with CPU cores and latest CPU usage
                setSystemMetrics(prev => prev ? {
                    ...prev,
                    cpu_cores: latestCpuCores,
                    cpu_usage: latestCpuUsage
                } : null);
            }
        } catch (error) {
            console.error('Error fetching CPU historical data:', error);
            message.error('Failed to fetch CPU historical data');
        } finally {
            setCpuDataLoading(false);
        }
    };

    // Fetch historical Memory metrics
    const fetchMemoryHistoricalData = async (nodeName: string, range: string = '1h') => {
        if (!nodeName) return;

        try {
            setMemoryDataLoading(true);
            const agentId = `agent_${nodeName}`;

                    const token = localStorage.getItem('token');
        const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/metrics/memory?agent_id=${agentId}&range=${range}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            credentials: 'include'
        });

            if (!response.ok) {
                throw new Error('Failed to fetch memory metrics');
            }

            const data: MetricsResponse = await response.json();


            if (data.status === 'success' && data.data) {
                // Process the data for chart
                const timeMap = new Map<string, ChartDataPoint>();
                let latestTotalMemory = 0;
                let latestFreeMemory = 0;
                let latestMemoryUsage = 0;
                let latestMemoryTimestamp = 0;

                data.data.forEach(point => {
                    // Memory usage data for chart
                    if (point._field === 'memory_usage' && point._measurement === 'mssql_system') {
                        const timeKey = point._time;
                        const timestamp = new Date(point._time).getTime();
                        const date = new Date(point._time);
                        const isLongRange = range.includes('d') || range === '7d' || range === '30d' || 
                                          parseInt(range.replace(/\D/g, '')) >= 24;
                        const formattedTime = isLongRange ? date.toLocaleDateString() : date.toLocaleTimeString();

                        if (!timeMap.has(timeKey)) {
                            timeMap.set(timeKey, {
                                time: formattedTime,
                                timestamp: timestamp,
                                memory_usage: point._value
                            });
                        } else {
                            const existing = timeMap.get(timeKey)!;
                            existing.memory_usage = point._value;
                        }

                        // Keep track of the latest Memory usage value
                        if (timestamp > latestMemoryTimestamp) {
                            latestMemoryTimestamp = timestamp;
                            latestMemoryUsage = point._value;
                        }
                    }

                    // Total memory info for current metrics
                    if (point._field === 'total_memory' && point._measurement === 'mssql_system') {
                        latestTotalMemory = point._value;
                    }

                    // Free memory info for current metrics
                    if (point._field === 'free_memory' && point._measurement === 'mssql_system') {
                        latestFreeMemory = point._value;
                    }
                });

                // Convert map to array and sort by timestamp
                const sortedData = Array.from(timeMap.values()).sort((a, b) => a.timestamp - b.timestamp);
                setMemoryHistoricalData(sortedData);

                // Update system metrics with memory info and latest memory usage
                setSystemMetrics(prev => prev ? {
                    ...prev,
                    total_memory: latestTotalMemory,
                    free_memory: latestFreeMemory,
                    memory_usage: latestMemoryUsage
                } : null);
            }
        } catch (error) {
            console.error('Error fetching memory historical data:', error);
            message.error('Failed to fetch memory historical data');
        } finally {
            setMemoryDataLoading(false);
        }
    };

    // Calculate capacity planning analysis
    const calculateCapacityPlanning = (historicalData: ChartDataPoint[]): CapacityAnalysis | null => {
        if (historicalData.length < 7) return null; // Need at least 7 data points

        // Sort data by timestamp
        const sortedData = [...historicalData].sort((a, b) => a.timestamp - b.timestamp);
        
        // Get current values (latest data point)
        const latest = sortedData[sortedData.length - 1];
        const current_data_size_mb = (latest.data_size || 0) / (1024 * 1024);
        const current_log_size_mb = (latest.log_size || 0) / (1024 * 1024);
        const current_total_size_mb = current_data_size_mb + current_log_size_mb;

        // Calculate daily growth rates
        const timeSpanDays = (latest.timestamp - sortedData[0].timestamp) / (1000 * 60 * 60 * 24);
        
        if (timeSpanDays < 1) return null; // Need at least 1 day of data

        const initial_data_size_mb = (sortedData[0].data_size || 0) / (1024 * 1024);
        const initial_log_size_mb = (sortedData[0].log_size || 0) / (1024 * 1024);
        
        const daily_growth_data_mb = (current_data_size_mb - initial_data_size_mb) / timeSpanDays;
        const daily_growth_log_mb = (current_log_size_mb - initial_log_size_mb) / timeSpanDays;
        const daily_growth_total_mb = daily_growth_data_mb + daily_growth_log_mb;

        // Analyze trends
        const midPoint = Math.floor(sortedData.length / 2);
        const firstHalf = sortedData.slice(0, midPoint);
        const secondHalf = sortedData.slice(midPoint);
        
        const firstHalfAvgData = firstHalf.reduce((sum, point) => sum + ((point.data_size || 0) / (1024 * 1024)), 0) / firstHalf.length;
        const secondHalfAvgData = secondHalf.reduce((sum, point) => sum + ((point.data_size || 0) / (1024 * 1024)), 0) / secondHalf.length;
        
        const firstHalfAvgLog = firstHalf.reduce((sum, point) => sum + ((point.log_size || 0) / (1024 * 1024)), 0) / firstHalf.length;
        const secondHalfAvgLog = secondHalf.reduce((sum, point) => sum + ((point.log_size || 0) / (1024 * 1024)), 0) / secondHalf.length;

        // Determine trends
        const dataTrendThreshold = 5; // MB threshold
        const data_trend = secondHalfAvgData > firstHalfAvgData + dataTrendThreshold ? 'increasing' : 
                          secondHalfAvgData < firstHalfAvgData - dataTrendThreshold ? 'decreasing' : 'stable';
        
        const log_trend = secondHalfAvgLog > firstHalfAvgLog + dataTrendThreshold ? 'increasing' : 
                         secondHalfAvgLog < firstHalfAvgLog - dataTrendThreshold ? 'decreasing' : 'stable';

        // Calculate volatility based on standard deviation
        const dataSizes = sortedData.map(point => (point.data_size || 0) / (1024 * 1024));
        const avgDataSize = dataSizes.reduce((sum, val) => sum + val, 0) / dataSizes.length;
        const dataVariance = dataSizes.reduce((sum, val) => sum + Math.pow(val - avgDataSize, 2), 0) / dataSizes.length;
        const dataStdDev = Math.sqrt(dataVariance);
        const dataCoefficientOfVariation = avgDataSize > 0 ? dataStdDev / avgDataSize : 0;
        
        const volatility = dataCoefficientOfVariation > 0.1 ? 'high' : dataCoefficientOfVariation > 0.05 ? 'medium' : 'low';

        // Create predictions for different time periods
        const predictions: CapacityPrediction[] = [
            {
                period: '1 Month',
                data_size_mb: Math.max(0, current_data_size_mb + (daily_growth_data_mb * 30)),
                log_size_mb: Math.max(0, current_log_size_mb + (daily_growth_log_mb * 30)),
                total_size_mb: Math.max(0, current_total_size_mb + (daily_growth_total_mb * 30)),
                growth_rate_data: daily_growth_data_mb,
                growth_rate_log: daily_growth_log_mb,
                confidence_level: timeSpanDays > 7 ? 'high' : 'medium'
            },
            {
                period: '3 Months',
                data_size_mb: Math.max(0, current_data_size_mb + (daily_growth_data_mb * 90)),
                log_size_mb: Math.max(0, current_log_size_mb + (daily_growth_log_mb * 90)),
                total_size_mb: Math.max(0, current_total_size_mb + (daily_growth_total_mb * 90)),
                growth_rate_data: daily_growth_data_mb,
                growth_rate_log: daily_growth_log_mb,
                confidence_level: timeSpanDays > 14 ? 'high' : 'medium'
            },
            {
                period: '6 Months',
                data_size_mb: Math.max(0, current_data_size_mb + (daily_growth_data_mb * 180)),
                log_size_mb: Math.max(0, current_log_size_mb + (daily_growth_log_mb * 180)),
                total_size_mb: Math.max(0, current_total_size_mb + (daily_growth_total_mb * 180)),
                growth_rate_data: daily_growth_data_mb,
                growth_rate_log: daily_growth_log_mb,
                confidence_level: timeSpanDays > 30 ? 'medium' : 'low'
            },
            {
                period: '1 Year',
                data_size_mb: Math.max(0, current_data_size_mb + (daily_growth_data_mb * 365)),
                log_size_mb: Math.max(0, current_log_size_mb + (daily_growth_log_mb * 365)),
                total_size_mb: Math.max(0, current_total_size_mb + (daily_growth_total_mb * 365)),
                growth_rate_data: daily_growth_data_mb,
                growth_rate_log: daily_growth_log_mb,
                confidence_level: timeSpanDays > 30 ? 'medium' : 'low'
            }
        ];

        // Generate recommendations
        const recommendations: string[] = [];
        
        if (daily_growth_total_mb > 100) {
            recommendations.push('⚠️ High growth rate detected (>100 MB/day). Consider storage capacity planning.');
        }
        
        if (data_trend === 'increasing' && daily_growth_data_mb > 50) {
            recommendations.push('📈 Data files growing rapidly. Monitor for potential performance impact.');
        }
        
        if (log_trend === 'increasing' && daily_growth_log_mb > 20) {
            recommendations.push('📝 Transaction log growing rapidly. Consider more frequent log backups.');
        }
        
        if (volatility === 'high') {
            recommendations.push('📊 High size volatility detected. Growth predictions may be less accurate.');
        }
        
        if (daily_growth_total_mb < 0) {
            recommendations.push('📉 Database size is decreasing. This could indicate data archiving or cleanup activities.');
        }
        
        if (predictions[3].total_size_mb > current_total_size_mb * 3) {
            recommendations.push('🚀 Projected to triple in size within a year. Plan for significant storage expansion.');
        }

        if (recommendations.length === 0) {
            recommendations.push('✅ Database growth appears stable and predictable.');
        }

        return {
            current_data_size_mb,
            current_log_size_mb,
            current_total_size_mb,
            daily_growth_data_mb,
            daily_growth_log_mb,
            daily_growth_total_mb,
            predictions,
            trend_analysis: {
                data_trend,
                log_trend,
                volatility
            },
            recommendations
        };
    };

    // Fetch capacity planning data
    const fetchCapacityPlanningData = async (nodeName: string, databaseName: string) => {
        if (!nodeName || !databaseName) return;

        try {
            setCapacityDataLoading(true);
            
            // Get 30 days of historical data for better accuracy
            const agentId = `agent_${nodeName}`;
            const token = localStorage.getItem('token');
            
            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/mssql/database?agent_id=${agentId}&database=${databaseName}&range=30d`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to fetch database metrics for capacity planning');
            }

            const data: MetricsResponse = await response.json();

            if (data.status === 'success' && data.data) {
                // Process the data for capacity analysis
                const timeMap = new Map<string, ChartDataPoint>();

                data.data.forEach(point => {
                    const timeKey = point._time;
                    const timestamp = new Date(point._time).getTime();
                    const formattedTime = new Date(point._time).toLocaleTimeString();

                    if (!timeMap.has(timeKey)) {
                        timeMap.set(timeKey, {
                            time: formattedTime,
                            timestamp: timestamp
                        });
                    }

                    const existing = timeMap.get(timeKey)!;

                    // Data size
                    if (point._field === 'data_size' && point._measurement === 'mssql_database') {
                        existing.data_size = point._value;
                    }

                    // Log size
                    if (point._field === 'log_size' && point._measurement === 'mssql_database') {
                        existing.log_size = point._value;
                    }

                    // Calculate total size
                    if (existing.data_size !== undefined && existing.log_size !== undefined) {
                        existing.total_size = existing.data_size + existing.log_size;
                    }
                });

                // Convert map to array and sort by timestamp
                const sortedData = Array.from(timeMap.values()).sort((a, b) => a.timestamp - b.timestamp);
                
                // Calculate capacity analysis
                const analysis = calculateCapacityPlanning(sortedData);
                setCapacityAnalysis(analysis);
                
                if (analysis) {
                    message.success('Capacity planning analysis completed successfully');
                } else {
                    message.warning('Insufficient data for capacity analysis. Need at least 7 days of historical data.');
                }
            }
            
        } catch (error) {
            console.error('Error fetching capacity planning data:', error);
            message.error('Failed to fetch capacity planning data');
        } finally {
            setCapacityDataLoading(false);
        }
    };

    // Fetch historical Database metrics
    const fetchDatabaseHistoricalData = async (nodeName: string, databaseName: string, range: string = '1h') => {
        if (!nodeName || !databaseName) return;

        try {
            setDatabaseDataLoading(true);
            const agentId = `agent_${nodeName}`;

                    const token = localStorage.getItem('token');
        const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/mssql/database?agent_id=${agentId}&database=${databaseName}&range=${range}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            credentials: 'include'
        });

            if (!response.ok) {
                throw new Error('Failed to fetch database metrics');
            }

            const data: MetricsResponse = await response.json();

            if (data.status === 'success' && data.data) {
                // Process the data for chart
                const timeMap = new Map<string, ChartDataPoint>();
                let latestDataSize = 0;
                let latestLogSize = 0;
                let latestDatabaseTimestamp = 0;

                data.data.forEach(point => {
                    const timeKey = point._time;
                    const timestamp = new Date(point._time).getTime();
                    const formattedTime = new Date(point._time).toLocaleTimeString();

                    if (!timeMap.has(timeKey)) {
                        timeMap.set(timeKey, {
                            time: formattedTime,
                            timestamp: timestamp
                        });
                    }

                    const existing = timeMap.get(timeKey)!;

                    // Data size
                    if (point._field === 'data_size' && point._measurement === 'mssql_database') {
                        existing.data_size = point._value;

                        // Keep track of the latest data size value
                        if (timestamp >= latestDatabaseTimestamp) {
                            latestDatabaseTimestamp = timestamp;
                            latestDataSize = point._value;
                        }
                    }

                    // Log size
                    if (point._field === 'log_size' && point._measurement === 'mssql_database') {
                        existing.log_size = point._value;

                        // Keep track of the latest log size value
                        if (timestamp >= latestDatabaseTimestamp) {
                            latestDatabaseTimestamp = timestamp;
                            latestLogSize = point._value;
                        }
                    }

                    // Calculate total size
                    if (existing.data_size !== undefined && existing.log_size !== undefined) {
                        existing.total_size = existing.data_size + existing.log_size;
                    }
                });

                // Convert map to array and sort by timestamp
                const sortedData = Array.from(timeMap.values()).sort((a, b) => a.timestamp - b.timestamp);
                setDatabaseHistoricalData(sortedData);

                // Update database stats with latest values (convert bytes to MB)
                setDbStats(prev => {
                    if (prev && prev.length > 0) {
                        const updated = [...prev];
                        updated[0] = {
                            ...updated[0],
                            data_size_mb: latestDataSize / (1024 * 1024),
                            log_size_mb: latestLogSize / (1024 * 1024),
                            total_size_mb: (latestDataSize + latestLogSize) / (1024 * 1024)
                        };
                        return updated;
                    } else {
                        // Create initial database stats if none exist
                        return [{
                            database_name: databaseName,
                            recovery_model: 'Unknown',
                            compatibility_level: 0,
                            log_reuse_wait_desc: 'Unknown',
                            page_verify_option: 'Unknown',
                            is_auto_create_stats_on: false,
                            is_auto_update_stats_on: false,
                            data_size_mb: latestDataSize / (1024 * 1024),
                            log_size_mb: latestLogSize / (1024 * 1024),
                            total_size_mb: (latestDataSize + latestLogSize) / (1024 * 1024)
                        }];
                    }
                });
            }
        } catch (error) {
            console.error('Error fetching database historical data:', error);
            message.error('Failed to fetch database historical data');
        } finally {
            setDatabaseDataLoading(false);
        }
    };

    // Fetch historical Wait Statistics metrics
    const fetchWaitStatsHistoricalData = async (nodeName: string, range: string = '1h') => {
        if (!nodeName) return;

        try {
            setWaitStatsDataLoading(true);
            const agentId = `agent_${nodeName}`;

                    const token = localStorage.getItem('token');
        const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/mssql/wait?agent_id=${agentId}&range=${range}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            credentials: 'include'
        });

            if (!response.ok) {
                throw new Error('Failed to fetch wait statistics metrics');
            }

            const data: MetricsResponse = await response.json();

            if (data.status === 'success' && data.data) {
                // Process the data for chart
                const timeMap = new Map<string, ChartDataPoint>();

                data.data.forEach(point => {
                    const timeKey = point._time;
                    const timestamp = new Date(point._time).getTime();
                    const formattedTime = new Date(point._time).toLocaleTimeString();
                    const waitType = point.wait_type;

                    // Skip if wait_type is not available
                    if (!waitType) return;

                    if (!timeMap.has(timeKey)) {
                        timeMap.set(timeKey, {
                            time: formattedTime,
                            timestamp: timestamp,
                            wait_tasks: {},
                            wait_time_ms: {}
                        });
                    }

                    const existing = timeMap.get(timeKey)!;

                    // Initialize wait_tasks and wait_time_ms if they don't exist
                    if (!existing.wait_tasks) existing.wait_tasks = {};
                    if (!existing.wait_time_ms) existing.wait_time_ms = {};

                    // Tasks data
                    if (point._field === 'tasks' && point._measurement === 'mssql_waits') {
                        existing.wait_tasks[waitType] = point._value;
                    }

                    // Time data
                    if (point._field === 'time_ms' && point._measurement === 'mssql_waits') {
                        existing.wait_time_ms[waitType] = point._value;
                    }
                });

                // Convert map to array and sort by timestamp
                const sortedData = Array.from(timeMap.values()).sort((a, b) => a.timestamp - b.timestamp);
                setWaitStatsHistoricalData(sortedData);
            }
        } catch (error) {
            console.error('Error fetching wait statistics historical data:', error);
            message.error('Failed to fetch wait statistics historical data');
        } finally {
            setWaitStatsDataLoading(false);
        }
    };

    // Fetch historical Blocking metrics
    const fetchBlockingHistoricalData = async (nodeName: string, range: string = '1h') => {
        if (!nodeName) return;

        try {
            setBlockingDataLoading(true);
            const agentId = `agent_${nodeName}`;

                    const token = localStorage.getItem('token');
        const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/mssql/blocking?agent_id=${agentId}&range=${range}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            credentials: 'include'
        });

            if (!response.ok) {
                throw new Error('Failed to fetch blocking metrics');
            }

            const data: MetricsResponse = await response.json();

            if (data.status === 'success' && data.data) {
                // Process the data for chart
                const timeMap = new Map<string, ChartDataPoint>();

                data.data.forEach(point => {
                    // Blocking sessions data
                    if (point._field === 'sessions' && point._measurement === 'mssql_blocking') {
                        const timeKey = point._time;
                        const timestamp = new Date(point._time).getTime();
                        const formattedTime = new Date(point._time).toLocaleTimeString();

                        if (!timeMap.has(timeKey)) {
                            timeMap.set(timeKey, {
                                time: formattedTime,
                                timestamp: timestamp,
                                blocking_sessions: point._value
                            });
                        } else {
                            const existing = timeMap.get(timeKey)!;
                            existing.blocking_sessions = point._value;
                        }
                    }
                });

                // Convert map to array and sort by timestamp
                const sortedData = Array.from(timeMap.values()).sort((a, b) => a.timestamp - b.timestamp);
                setBlockingHistoricalData(sortedData);
            }
        } catch (error) {
            console.error('Error fetching blocking historical data:', error);
            message.error('Failed to fetch blocking historical data');
        } finally {
            setBlockingDataLoading(false);
        }
    };

    // Fetch historical Connections metrics
    const fetchConnectionsHistoricalData = async (nodeName: string, range: string = '1h') => {
        if (!nodeName) return;

        try {
            setConnectionsDataLoading(true);
            const agentId = `agent_${nodeName}`;

                    const token = localStorage.getItem('token');
        const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/mssql/connections?agent_id=${agentId}&range=${range}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            credentials: 'include'
        });

            if (!response.ok) {
                throw new Error('Failed to fetch connections metrics');
            }

            const data: MetricsResponse = await response.json();

            if (data.status === 'success' && data.data) {
                // Process the data for chart
                const timeMap = new Map<string, ChartDataPoint>();
                let latestActiveConnections = 0;
                let latestIdleConnections = 0;
                let latestTotalConnections = 0;
                let latestConnectionsTimestamp = 0;

                data.data.forEach(point => {
                    const timeKey = point._time;
                    const timestamp = new Date(point._time).getTime();
                    const formattedTime = new Date(point._time).toLocaleTimeString();

                    if (!timeMap.has(timeKey)) {
                        timeMap.set(timeKey, {
                            time: formattedTime,
                            timestamp: timestamp
                        });
                    }

                    const existing = timeMap.get(timeKey)!;

                    // Active connections data
                    if (point._field === 'active' && point._measurement === 'mssql_connections') {
                        existing.active_connections = point._value;

                        // Keep track of the latest active connections value
                        if (timestamp >= latestConnectionsTimestamp) {
                            latestConnectionsTimestamp = timestamp;
                            latestActiveConnections = point._value;
                        }
                    }

                    // Idle connections data
                    if (point._field === 'idle' && point._measurement === 'mssql_connections') {
                        existing.idle_connections = point._value;

                        // Keep track of the latest idle connections value
                        if (timestamp >= latestConnectionsTimestamp) {
                            latestConnectionsTimestamp = timestamp;
                            latestIdleConnections = point._value;
                        }
                    }

                    // Total connections data
                    if (point._field === 'total' && point._measurement === 'mssql_connections') {
                        existing.total_connections = point._value;

                        // Keep track of the latest total connections value
                        if (timestamp >= latestConnectionsTimestamp) {
                            latestConnectionsTimestamp = timestamp;
                            latestTotalConnections = point._value;
                        }
                    }
                });

                // Convert map to array and sort by timestamp
                const sortedData = Array.from(timeMap.values()).sort((a, b) => a.timestamp - b.timestamp);
                setConnectionsHistoricalData(sortedData);

                // Update connections state with latest values
                setConnections(prev => ({
                    total_connections: latestTotalConnections,
                    active_connections: latestActiveConnections,
                    idle_connections: latestIdleConnections,
                    max_connections: prev?.max_connections || 32767, // Keep existing max_connections or default to unlimited
                    connection_percentage: prev?.max_connections && prev.max_connections < 32767
                        ? (latestTotalConnections / prev.max_connections) * 100
                        : (latestActiveConnections / Math.max(latestTotalConnections, 1)) * 100
                }));
            }
        } catch (error) {
            console.error('Error fetching connections historical data:', error);
            message.error('Failed to fetch connections historical data');
        } finally {
            setConnectionsDataLoading(false);
        }
    };

    // Fetch historical Performance metrics (hybrid: rates + static values)
    const fetchPerformanceHistoricalData = async (nodeName: string, range: string = '1h') => {
        if (!nodeName) return;

        try {
            setPerformanceDataLoading(true);
            const agentId = `agent_${nodeName}`;

            // Fetch only the cumulative data, we'll calculate rates ourselves
                    const token = localStorage.getItem('token');
        const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/mssql/performance?agent_id=${agentId}&range=${range}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            credentials: 'include'
        });

            if (!response.ok) {
                throw new Error('Failed to fetch performance metrics');
            }

            const data: MetricsResponse = await response.json();

            if (data.status === 'success' && data.data) {
                
                // Group data by timestamp first
                const timeMap = new Map<string, any>();
                
                data.data.forEach((point: MetricDataPoint) => {
                    const timeKey = point._time;
                    
                    if (!timeMap.has(timeKey)) {
                        timeMap.set(timeKey, {});
                    }
                    
                    const timeData = timeMap.get(timeKey)!;
                    timeData[point._field] = point._value;
                });

                // Convert to sorted array and calculate rates
                const sortedTimes = Array.from(timeMap.keys()).sort();
                const processedData: PerformanceDataPoint[] = [];
                let previousTimeData: any = null;

                sortedTimes.forEach((timeKey, index) => {
                    const timestamp = new Date(timeKey).getTime();
                    const formattedTime = new Date(timeKey).toLocaleTimeString();
                    const currentTimeData = timeMap.get(timeKey)!;
                    
                    const entry: PerformanceDataPoint = {
                        time: formattedTime,
                        timestamp: timestamp
                    };

                    // Handle current/static values (these don't need rate calculation)
                    // Buffer cache hit ratio comes as raw value, convert to percentage
                    const rawBufferCacheRatio = currentTimeData.buffer_cache_hit_ratio || 0;
                    entry.buffer_cache_hit_ratio = rawBufferCacheRatio > 100 ? rawBufferCacheRatio / 10000 : rawBufferCacheRatio;
                    entry.page_life_expectancy = currentTimeData.page_life_expectancy || 0;

                    // Calculate rates for cumulative metrics if we have previous data
                    if (previousTimeData && index > 0) {
                        const timeDiffSeconds = (timestamp - new Date(sortedTimes[index - 1]).getTime()) / 1000;
                        
                        if (timeDiffSeconds > 0) {
                            // Calculate rates for counter metrics
                            const batchRequestsDiff = (currentTimeData.batch_requests_count || 0) - (previousTimeData.batch_requests_count || 0);
                            const compilationsDiff = (currentTimeData.compilations_count || 0) - (previousTimeData.compilations_count || 0);
                            const lazyWritesDiff = (currentTimeData.lazy_writes_count || 0) - (previousTimeData.lazy_writes_count || 0);
                            const lockRequestsDiff = (currentTimeData.lock_requests_count || 0) - (previousTimeData.lock_requests_count || 0);
                            const lockTimeoutsDiff = (currentTimeData.lock_timeouts_count || 0) - (previousTimeData.lock_timeouts_count || 0);
                            const lockWaitsDiff = (currentTimeData.lock_waits_count || 0) - (previousTimeData.lock_waits_count || 0);
                            const pageReadsDiff = (currentTimeData.page_reads_count || 0) - (previousTimeData.page_reads_count || 0);
                            const pageWritesDiff = (currentTimeData.page_writes_count || 0) - (previousTimeData.page_writes_count || 0);
                            const recompilationsDiff = (currentTimeData.recompilations_count || 0) - (previousTimeData.recompilations_count || 0);
                            
                            entry.batch_requests_per_sec = Math.max(0, batchRequestsDiff / timeDiffSeconds);
                            entry.compilations_per_sec = Math.max(0, compilationsDiff / timeDiffSeconds);
                            entry.lazy_writes_per_sec = Math.max(0, lazyWritesDiff / timeDiffSeconds);
                            entry.lock_requests_per_sec = Math.max(0, lockRequestsDiff / timeDiffSeconds);
                            entry.lock_timeouts_per_sec = Math.max(0, lockTimeoutsDiff / timeDiffSeconds);
                            entry.lock_waits_per_sec = Math.max(0, lockWaitsDiff / timeDiffSeconds);
                            entry.page_reads_per_sec = Math.max(0, pageReadsDiff / timeDiffSeconds);
                            entry.page_writes_per_sec = Math.max(0, pageWritesDiff / timeDiffSeconds);
                            entry.recompilations_per_sec = Math.max(0, recompilationsDiff / timeDiffSeconds);
                            
                        }
                    } else {
                        // First entry, set rates to 0
                        entry.batch_requests_per_sec = 0;
                        entry.compilations_per_sec = 0;
                        entry.lazy_writes_per_sec = 0;
                        entry.lock_requests_per_sec = 0;
                        entry.lock_timeouts_per_sec = 0;
                        entry.lock_waits_per_sec = 0;
                        entry.page_reads_per_sec = 0;
                        entry.page_writes_per_sec = 0;
                        entry.recompilations_per_sec = 0;
                    }

                    processedData.push(entry);
                    previousTimeData = currentTimeData;
                });

                
                setPerformanceHistoricalData(processedData);
            }
        } catch (error) {
            console.error('Error fetching performance historical data:', error);
            message.error('Failed to fetch performance historical data');
        } finally {
            setPerformanceDataLoading(false);
        }
    };

    // Fetch historical Transaction metrics (rates only for transactions, static for current values)
    const fetchTransactionsHistoricalData = async (nodeName: string, range: string = '1h') => {
        if (!nodeName) return;

        try {
            setTransactionsDataLoading(true);
            const agentId = `agent_${nodeName}`;

            // Fetch only the cumulative data, we'll calculate rates ourselves
                    const token = localStorage.getItem('token');
        const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/mssql/transactions?agent_id=${agentId}&range=${range}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            credentials: 'include'
        });

            if (!response.ok) {
                throw new Error('Failed to fetch transaction metrics');
            }

            const data: MetricsResponse = await response.json();

            if (data.status === 'success' && data.data) {
                
                // Group data by timestamp first
                const timeMap = new Map<string, {[database: string]: any}>();
                
                data.data.forEach((point: MetricDataPoint) => {
                    const timeKey = point._time;
                    
                    if (!timeMap.has(timeKey)) {
                        timeMap.set(timeKey, {});
                    }
                    
                    const timeData = timeMap.get(timeKey)!;
                    
                    if (point.database) {
                        // Database-specific data
                        if (!timeData[point.database]) {
                            timeData[point.database] = {};
                        }
                        timeData[point.database][point._field] = point._value;
                    } else {
                        // Global data
                        if (!timeData['_global']) {
                            timeData['_global'] = {};
                        }
                        timeData['_global'][point._field] = point._value;
                    }
                });

                // Convert to sorted array and calculate rates
                const sortedTimes = Array.from(timeMap.keys()).sort();
                const processedData: TransactionDataPoint[] = [];
                let previousTimeData: {[database: string]: any} | null = null;

                sortedTimes.forEach((timeKey, index) => {
                    const timestamp = new Date(timeKey).getTime();
                    const formattedTime = new Date(timeKey).toLocaleTimeString();
                    const currentTimeData = timeMap.get(timeKey)!;
                    
                    const entry: TransactionDataPoint = {
                        time: formattedTime,
                        timestamp: timestamp,
                        database_transactions: {}
                    };

                    // Handle global metrics (static values)
                    if (currentTimeData['_global']) {
                        const globalData = currentTimeData['_global'];
                        entry.active_total = globalData.active_total || 0;
                        entry.tempdb_free_space_kb = globalData.tempdb_free_space_kb || 0;
                        entry.longest_running_time_seconds = globalData.longest_running_time_seconds || 0;
                        entry.update_conflict_ratio = globalData.update_conflict_ratio || 0;
                        entry.version_store_unit_count = globalData.version_store_unit_count || 0;
                        
                        // Calculate global rates if we have previous data
                        if (previousTimeData && previousTimeData['_global'] && index > 0) {
                            const prevGlobal = previousTimeData['_global'];
                            const timeDiffSeconds = (timestamp - new Date(sortedTimes[index - 1]).getTime()) / 1000;
                            
                            if (timeDiffSeconds > 0) {
                                const countDiff = (globalData.count || 0) - (prevGlobal.count || 0);
                                const writeCountDiff = (globalData.write_count || 0) - (prevGlobal.write_count || 0);
                                const cleanupDiff = (globalData.version_cleanup_rate_kb_count || 0) - (prevGlobal.version_cleanup_rate_kb_count || 0);
                                const generationDiff = (globalData.version_generation_rate_kb_count || 0) - (prevGlobal.version_generation_rate_kb_count || 0);
                                
                                entry.per_sec_total = Math.max(0, countDiff / timeDiffSeconds);
                                entry.write_per_sec_total = Math.max(0, writeCountDiff / timeDiffSeconds);
                                entry.version_cleanup_rate_kb_per_sec = Math.max(0, cleanupDiff / timeDiffSeconds);
                                entry.version_generation_rate_kb_per_sec = Math.max(0, generationDiff / timeDiffSeconds);
                                
                            }
                        }
                    }

                    // Handle database-specific metrics
                    Object.keys(currentTimeData).forEach(dbName => {
                        if (dbName === '_global') return;
                        
                        const dbData = currentTimeData[dbName];
                        
                        if (!entry.database_transactions![dbName]) {
                            entry.database_transactions![dbName] = {
                                active_by_database: dbData.active_by_database || 0,
                                per_sec: 0,
                                write_per_sec: 0
                            };
                        }

                        // Calculate rates if we have previous data
                        if (previousTimeData && previousTimeData[dbName] && index > 0) {
                            const prevDbData = previousTimeData[dbName];
                            const timeDiffSeconds = (timestamp - new Date(sortedTimes[index - 1]).getTime()) / 1000;
                            
                            if (timeDiffSeconds > 0) {
                                const countDiff = (dbData.count || 0) - (prevDbData.count || 0);
                                const writeCountDiff = (dbData.write_count || 0) - (prevDbData.write_count || 0);
                                
                                entry.database_transactions![dbName].per_sec = Math.max(0, countDiff / timeDiffSeconds);
                                entry.database_transactions![dbName].write_per_sec = Math.max(0, writeCountDiff / timeDiffSeconds);
                                
                                if (entry.database_transactions![dbName].per_sec > 0) {
                                }
                            }
                        }
                    });

                    processedData.push(entry);
                    previousTimeData = currentTimeData;
                });

                
                // Debug latest entry
                const latestEntry = processedData[processedData.length - 1];
                if (latestEntry?.database_transactions) {
                    
                    
                    // Debug active_total vs sum of database actives
                    const dbActiveSum = Object.values(latestEntry.database_transactions).reduce((sum, db) => sum + db.active_by_database, 0);
                    const userSystemMetrics = calculateUserSystemMetrics(latestEntry);
                    
                }
                
                setTransactionsHistoricalData(processedData);
            }
        } catch (error) {
            console.error('Error fetching transaction historical data:', error);
            message.error('Failed to fetch transaction historical data');
        } finally {
            setTransactionsDataLoading(false);
        }
    };

    // Fetch both historical metrics and extract current values
    const fetchHistoricalMetrics = async (nodeName: string, range: string = '1h') => {
        if (!nodeName) return;

        setHistoricalDataLoading(true);

        try {
            // Initialize system metrics with default values
            setSystemMetrics({
                cpu_usage: 0,
                cpu_cores: 0,
                memory_usage: 0,
                total_memory: 0,
                free_memory: 0,
                load_average_1m: 0,
                load_average_5m: 0,
                load_average_15m: 0,
                total_disk: 0,
                free_disk: 0,
                os_version: 'Unknown',
                kernel_version: 'Unknown',
                uptime: 0
            });

            await Promise.all([
                fetchCpuHistoricalData(nodeName, range),
                fetchMemoryHistoricalData(nodeName, range)
            ]);
        } catch (error) {
            console.error('Error fetching historical metrics:', error);
        } finally {
            setHistoricalDataLoading(false);
        }
    };

    // Note: fetchClusterData is no longer needed as React Query handles data fetching

    // Fetch MSSQL Wait Statistics
    const fetchWaitStats = async (nodeName: string) => {
        if (!nodeName) return;

        try {
            setLoading(true);
            const agentId = `agent_${nodeName}`;

            const query = `SELECT wait_type, waiting_tasks_count, wait_time_ms, max_wait_time_ms, signal_wait_time_ms FROM sys.dm_os_wait_stats WHERE wait_type NOT LIKE 'SLEEP%' AND wait_type NOT LIKE 'RESOURCE%SEMAPHORE' AND wait_type NOT LIKE 'QUERY_OPTIMIZER%' AND wait_type NOT LIKE 'SOS%' AND wait_type NOT LIKE 'PREEMPTIVE%' ORDER BY wait_time_ms DESC;`;

            const token = localStorage.getItem('token');
            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/agents/${agentId}/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                credentials: 'include',
                body: JSON.stringify({
                    query_id: 'mssql_wait_stats',
                    command: query
                })
            });

            if (!response.ok) {
                throw new Error('API response not ok');
            }

            const data = await response.json();
            if (data.status === 'success' && data.result) {
                const result = data.result;
                if (result.type_url === 'type.googleapis.com/google.protobuf.Value') {
                    try {
                        // Base64 decode
                        const decodedValue = atob(result.value);
                        // JSON parse
                        const parsedResult = JSON.parse(decodedValue);


                        // Extract wait stats
                        const waitStatsResults: QueryResultWaitStats[] = [];

                        if (parsedResult.status === 'success' && parsedResult.row_count > 0) {
                            const rowCount = parsedResult.row_count || 0;

                            for (let i = 0; i < rowCount; i++) {
                                waitStatsResults.push({
                                    wait_type: parsedResult[`wait_type_${i}`] || '',
                                    waiting_tasks_count: parseInt(parsedResult[`waiting_tasks_count_${i}`]) || 0,
                                    wait_time_ms: parseInt(parsedResult[`wait_time_ms_${i}`]) || 0,
                                    max_wait_time_ms: parseInt(parsedResult[`max_wait_time_ms_${i}`]) || 0,
                                    signal_wait_time_ms: parseInt(parsedResult[`signal_wait_time_ms_${i}`]) || 0
                                });
                            }

                            setWaitStats(waitStatsResults);
                        } else {
                            // No wait stats found - just set empty array
                            setWaitStats([]);
                        }
                    } catch (error) {
                        console.error('Error parsing wait stats result:', error);
                        message.error('Error parsing wait statistics');
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching wait stats:', error);
            message.error('Failed to fetch wait statistics');
        } finally {
            setLoading(false);
        }
    };

    // useIndexUsageQuery hook'undaki staleTime ve gcTime değerlerini güncelleyelim
    const useIndexUsageQuery = (nodeName: string, databaseName: string) => {
        return useQuery({
            queryKey: ['index-usage', nodeName, databaseName],
            queryFn: async () => {
                if (!nodeName || !databaseName) {
                    return [];
                }

                const agentId = `agent_${nodeName}`;

                const query = `USE [${databaseName}]; SELECT DB_NAME() AS database_name, s.name AS schema_name, t.name AS table_name, i.name AS index_name, i.index_id, ius.user_seeks, ius.user_scans, ius.user_lookups, ius.user_updates, ius.last_user_seek, ius.last_user_scan, ius.last_user_lookup, ius.last_user_update, ps.avg_fragmentation_in_percent AS avg_fragmentation_percent, ps.page_count FROM sys.dm_db_index_usage_stats ius INNER JOIN sys.indexes i ON ius.object_id = i.object_id AND ius.index_id = i.index_id INNER JOIN sys.tables t ON i.object_id = t.object_id INNER JOIN sys.schemas s ON t.schema_id = s.schema_id LEFT JOIN sys.dm_db_index_physical_stats(DB_ID(), NULL, NULL, NULL, 'LIMITED') ps ON ps.object_id = i.object_id AND ps.index_id = i.index_id WHERE ius.database_id = DB_ID() AND s.name NOT IN ('sys', 'information_schema') AND t.name NOT LIKE 'sys%' AND t.name NOT LIKE 'msdb%' AND t.name NOT LIKE 'syspolicy%' AND t.name NOT LIKE 'sysjob%' AND ps.page_count > 100 AND ps.avg_fragmentation_in_percent > 10`;

                const token = localStorage.getItem('token');
                const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/agents/${agentId}/query`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        query_id: 'mssql_index_usage',
                        command: query
                    })
                });

                if (!response.ok) {
                    throw new Error('API response not ok');
                }

                const data = await response.json();
                if (data.status === 'success' && data.result) {
                    const result = data.result;
                    if (result.type_url === 'type.googleapis.com/google.protobuf.Value') {
                        try {
                            // Base64 decode
                            const decodedValue = atob(result.value);
                            // JSON parse
                            const parsedResult = JSON.parse(decodedValue);

                            // Extract index usage
                            const indexResults: QueryResultIndexUsage[] = [];

                            if (parsedResult.status === 'success' && parsedResult.row_count > 0) {
                                const rowCount = parsedResult.row_count || 0;

                                for (let i = 0; i < rowCount; i++) {
                                    indexResults.push({
                                        database_name: parsedResult[`database_name_${i}`] || '',
                                        schema_name: parsedResult[`schema_name_${i}`] || '',
                                        table_name: parsedResult[`table_name_${i}`] || '',
                                        index_name: parsedResult[`index_name_${i}`] || '',
                                        index_id: parseInt(parsedResult[`index_id_${i}`]) || 0,
                                        user_seeks: parseInt(parsedResult[`user_seeks_${i}`]) || 0,
                                        user_scans: parseInt(parsedResult[`user_scans_${i}`]) || 0,
                                        user_lookups: parseInt(parsedResult[`user_lookups_${i}`]) || 0,
                                        user_updates: parseInt(parsedResult[`user_updates_${i}`]) || 0,
                                        last_user_seek: parsedResult[`last_user_seek_${i}`] || '',
                                        last_user_scan: parsedResult[`last_user_scan_${i}`] || '',
                                        last_user_lookup: parsedResult[`last_user_lookup_${i}`] || '',
                                        last_user_update: parsedResult[`last_user_update_${i}`] || '',
                                        avg_fragmentation_percent: parseFloat(parsedResult[`avg_fragmentation_percent_${i}`]) || 0,
                                        page_count: parseInt(parsedResult[`page_count_${i}`]) || 0
                                    });
                                }

                                return indexResults;
                            }
                            return [];
                        } catch (error) {
                            console.error('Error parsing index usage result:', error);
                            throw new Error('Error parsing index usage information');
                        }
                    }
                }
                return [];
            },
            enabled: Boolean(nodeName) && Boolean(databaseName),
            staleTime: 10 * 60 * 1000, // 10 dakika boyunca önbellek taze kabul edilir
            gcTime: 30 * 60 * 1000,    // 30 dakika boyunca önbellekte tutulur
            refetchOnWindowFocus: false,
        });
    };



    // Handler functions
    const handleNodeChange = (value: string) => {
        setNodeName(value);
        setCurrentStep(2);

        // Set flag to prevent duplicate API calls from useEffect
        setManualNodeChangeInProgress(true);

        // Find the selected node to detect if it's AWS RDS
        const allNodes = Object.values(data).flat();
        const selectedNode = allNodes.find(node => node.Hostname === value);
        
        if (selectedNode) {
            handleNodeTypeDetection(selectedNode);
        }

        // Load data for the selected node based on current tab
        if (value) {
            if (activeTab === '1') {
                if (selectedSubMenu === 'server-info') {
                    fetchServerInfo(value);
                } else if (selectedSubMenu === 'connections') {
                    fetchConnectionsHistoricalData(value, selectedTimeRange);
                    fetchConnectionAnalysis(value);
                }
            } else if (activeTab === '2') {
                if (selectedSubMenu === 'top-queries') {
                    fetchTopQueries(value);
                } else if (selectedSubMenu === 'blocking') {
                    fetchBlockingInfo(value);
                    fetchBlockingHistoricalData(value, selectedTimeRange);
                } else if (selectedSubMenu === 'wait-stats') {
                    fetchWaitStats(value);
                    fetchWaitStatsHistoricalData(value, selectedTimeRange);
                }
            } else if (activeTab === '3') {
                fetchDatabases(value);
            } else if (activeTab === '4') {
                fetchHistoricalMetrics(value, selectedTimeRange);
            } else if (activeTab === '5') {
                if (selectedSubMenu === 'performance-metrics') {
                    fetchPerformanceHistoricalData(value, selectedTimeRange);
                }
            } else if (activeTab === '6') {
                if (selectedSubMenu === 'transaction-metrics') {
                    fetchTransactionsHistoricalData(value, selectedTimeRange);
                }
            }
        }

        // Reset the flag after a delay to allow for future manual changes
        setTimeout(() => {
            setManualNodeChangeInProgress(false);
        }, 500);
    };

    // handleDatabaseChange fonksiyonunu güncelleyelim - aynı veritabanı tekrar seçildiğinde cache verisini kullanacak
    const handleDatabaseChange = (value: string) => {
        // Sadece farklı bir veritabanı seçildiğinde önbelleği temizle
        if (nodeName && selectedDatabase && selectedDatabase !== value) {
            // Önceki veritabanının cache'ini temizle - yeni implementasyonda bunu kaldırıyoruz
            // queryClient.removeQueries({ queryKey: ['index-usage', nodeName, selectedDatabase] });
        } else if (nodeName && selectedDatabase && selectedDatabase === value) {
        }

        setSelectedDatabase(value);

        // Veritabanı seçildiğinde adım göstergesini güncelle
        setCurrentStep(3);

        // Eğer node ve database seçiliyse, ilgili verileri yükle
        if (nodeName && value) {
            if (activeTab === '3') {
                if (selectedSubMenu === 'database-stats') {
                    fetchDatabaseHistoricalData(nodeName, value, selectedTimeRange);
                }
                else if (selectedSubMenu === 'index-usage') {
                    // Aynı veritabanı seçildiğinde zorla yenileme yapmıyoruz
                    // Sadece farklı bir veritabanı seçildiğinde yenileme yapalım
                    if (selectedDatabase !== value) {
                        // Yeni veritabanı seçildiğinde React Query otomatik olarak yeni veriyi getirecek
                    }
                }
            }
        }
    };

    // handleSubMenuClick fonksiyonunu güncelleyelim
    const handleSubMenuClick = (key: string) => {
        // Set activeTab based on submenu selection
        let newTab = activeTab;

        switch (key) {
            case 'server-info':
            case 'connections':
                newTab = '1';
                break;
            case 'top-queries':
            case 'active-queries':
            case 'blocking':
            case 'wait-stats':
                newTab = '2';
                break;
            case 'index-usage':
            case 'database-stats':
            case 'backup-status':
            case 'capacity-planning':
                newTab = '3';
                break;
            case 'system-metrics':
                newTab = '4';
                break;
            case 'performance-metrics':
                newTab = '5';
                break;
            case 'transaction-metrics':
                newTab = '6';
                break;
            default:
                newTab = '1';
        }

        // Update states
        setSelectedSubMenu(key);
        setActiveTab(newTab);

        // Fetch data for the new submenu if we have a node selected and not already loading
        if (nodeName) {
            if (key === 'server-info' && !loading) {
                fetchServerInfo(nodeName);
            } else if (key === 'connections' && !connectionsDataLoading) {
                fetchConnectionsHistoricalData(nodeName, selectedTimeRange);
                if (!connectionAnalysisLoading) {
                    fetchConnectionAnalysis(nodeName);
                }
            } else if (key === 'top-queries' && !loading) {
                fetchTopQueries(nodeName);
            } else if (key === 'active-queries' && !loading) {
                fetchActiveQueries(nodeName);
            } else if (key === 'blocking' && !loading && !blockingDataLoading) {
                fetchBlockingInfo(nodeName);
                fetchBlockingHistoricalData(nodeName, selectedTimeRange);
            } else if (key === 'wait-stats' && !loading && !waitStatsDataLoading) {
                fetchWaitStats(nodeName);
                fetchWaitStatsHistoricalData(nodeName, selectedTimeRange);
            } else if (key === 'system-metrics' && !historicalDataLoading) {
                fetchHistoricalMetrics(nodeName, selectedTimeRange);
            } else if (key === 'performance-metrics' && !performanceDataLoading) {
                fetchPerformanceHistoricalData(nodeName, selectedTimeRange);
            } else if (key === 'transaction-metrics' && !transactionsDataLoading) {
                fetchTransactionsHistoricalData(nodeName, selectedTimeRange);
            } else if ((key === 'index-usage' || key === 'database-stats' || key === 'backup-status' || key === 'capacity-planning')) {
                // Make sure we have database list for these tabs
                if (databaseNames.length === 0) {
                    fetchDatabases(nodeName);
                }

                // Fetch data based on the selected submenu
                if (key === 'backup-status' && !loading) {
                    // Backup status doesn't require a specific database, fetch for all databases
                    fetchBackupStatus(nodeName);
                } else if (selectedDatabase) {
                    if (key === 'database-stats' && !databaseDataLoading) {
                        fetchDatabaseHistoricalData(nodeName, selectedDatabase, selectedTimeRange);
                    } else if (key === 'capacity-planning' && !capacityDataLoading) {
                        fetchCapacityPlanningData(nodeName, selectedDatabase);
                    }
                    // index-usage is handled by React Query automatically
                }
            }
        }
    };

    // AWS RDS Functions
    const fetchRDSInstances = async (region: string) => {
        try {
            setAwsMetricsLoading(true);
            const instances = await awsService.fetchRDSInstances(region);
            setRdsInstances(instances);
            message.success(`Found ${instances.length} RDS SQL Server instances in ${region}`);
        } catch (error) {
            console.error('Error fetching RDS instances:', error);
            message.error('Failed to fetch RDS instances');
        } finally {
            setAwsMetricsLoading(false);
        }
    };

    const fetchAWSMetrics = async (instanceId: string, region: string, timeRange: string = '1h') => {
        if (!instanceId || !region) return;

        try {
            setAwsMetricsLoading(true);
            const metrics = await awsService.fetchMultipleRDSMetrics(instanceId, region, timeRange, awsCredentials);
            setAwsMetrics(metrics);
        } catch (error) {
            console.error('Error fetching AWS metrics:', error);
            message.error('Failed to fetch AWS CloudWatch metrics');
        } finally {
            setAwsMetricsLoading(false);
        }
    };

    const handleNodeTypeDetection = (node: any) => {
        // Check if this is an AWS RDS node
        if (node.IsAWSRDS || node.RDSInstanceId) {
            setIsAWSRDS(true);
            setAwsRegion(node.AWSRegion || 'us-east-1');
            setRdsInstanceId(node.RDSInstanceId || node.nodename);
            
            // Use stored credentials for this node
            if (node._awsCredentials) {
                setAwsCredentials(node._awsCredentials);
                
                // Fetch AWS metrics instead of agent-based metrics
                if (node.RDSInstanceId && node.AWSRegion) {
                    fetchAWSMetrics(node.RDSInstanceId, node.AWSRegion, selectedTimeRange);
                }
            } else {
                console.warn('No AWS credentials found for RDS node:', node.nodename);
                message.warning('AWS credentials not found for this instance. CloudWatch metrics may not be available.');
            }
        } else {
            setIsAWSRDS(false);
            // Continue with normal agent-based monitoring
        }
    };

    const checkRDSConnectivity = async (instanceId: string, region: string) => {
        try {
            const isConnected = await awsService.checkRDSConnectivity(instanceId, region);
            if (isConnected) {
                message.success('Successfully connected to RDS instance');
            } else {
                message.warning('Could not establish connection to RDS instance');
            }
            return isConnected;
        } catch (error) {
            console.error('RDS connectivity check failed:', error);
            message.error('RDS connectivity check failed');
            return false;
        }
    };

    // Load saved RDS instances from database
    const loadSavedRDSInstances = async () => {
        try {
            const savedInstances = await awsService.getSavedRDSInstances();
            
            if (savedInstances.length > 0) {
                const updatedData = { ...data };
                const standaloneKey = 'AWS RDS';
                
                if (!updatedData[standaloneKey]) {
                    updatedData[standaloneKey] = [];
                }
                
                // Convert saved instances to node format
                savedInstances.forEach(instance => {
                    const jsonData = instance.jsondata;
                    const rdsNode = {
                        nodename: jsonData.displayName,
                        Hostname: jsonData.DBInstanceIdentifier,
                        NodeStatus: jsonData.DBInstanceStatus || 'available',
                        Version: jsonData.EngineVersion || 'Unknown',
                        Edition: jsonData.Engine || 'SQL Server',
                        dbType: 'MSSQL',
                        IsAWSRDS: true,
                        AWSRegion: instance.region,
                        RDSInstanceId: jsonData.DBInstanceIdentifier,
                        RDSEndpoint: jsonData.Endpoint?.Address,
                        RDSInstanceClass: jsonData.DBInstanceClass,
                        RDSEngine: jsonData.Engine,
                        RDSEngineVersion: jsonData.EngineVersion,
                        RDSMultiAZ: jsonData.MultiAZ,
                        RDSStorageType: jsonData.StorageType,
                        RDSAllocatedStorage: jsonData.AllocatedStorage,
                        Port: jsonData.Endpoint?.Port?.toString(),
                        Status: jsonData.DBInstanceStatus,
                        IP: jsonData.Endpoint?.Address,
                        Location: instance.region,
                        DC: instance.region,
                        databaseId: instance.id,
                        // Store decrypted credentials for CloudWatch access
                        _awsCredentials: jsonData.awsCredentials,
                        _sqlCredentials: jsonData.sqlCredentials
                    };
                    
                    updatedData[standaloneKey].push(rdsNode);
                });
                
                setData(updatedData);
                
                // Update cluster names to include AWS RDS if not already there
                if (!clusterNames.includes(standaloneKey)) {
                    setClusterNames([...clusterNames, standaloneKey]);
                }
            }
        } catch (error) {
            console.error('Error loading saved RDS instances:', error);
            // Don't show error message to user as this is background loading
        }
    };

    // Handle AWS RDS instance addition
    const handleAWSRDSSuccess = (rdsNode: any, credentials: any) => {
        // Store credentials for future API calls
        setAwsCredentials(credentials);
        
        // Add the new RDS node to your data structure
        const updatedData = { ...data };
        const standaloneKey = 'AWS RDS';
        
        if (!updatedData[standaloneKey]) {
            updatedData[standaloneKey] = [];
        }
        
        // Store credentials in the node for future use
        rdsNode._awsCredentials = credentials;
        
        updatedData[standaloneKey].push(rdsNode);
        setData(updatedData);
        
        // Update cluster names to include AWS RDS if not already there
        if (!clusterNames.includes(standaloneKey)) {
            setClusterNames([...clusterNames, standaloneKey]);
        }
        
        // Optionally select the new RDS instance
        setClusterName(standaloneKey);
        setNodeName(rdsNode.Hostname);
        
        message.success(`AWS RDS instance "${rdsNode.nodename}" has been added successfully!`);
    };

    // AWS RDS Info Render Function
    const renderAWSRDSInfo = () => {
        const selectedRDSInstance = rdsInstances.find(instance => 
            instance.DBInstanceIdentifier === rdsInstanceId
        );

        return (
            <Row gutter={[16, 16]}>
                <Col span={8}>
                    <Card title="RDS Instance" bordered={false}>
                        <Statistic
                            title="Instance ID"
                            value={rdsInstanceId}
                            valueStyle={{ fontSize: '16px' }}
                        />
                    </Card>
                </Col>
                <Col span={8}>
                    <Card title="Region" bordered={false}>
                        <Statistic
                            title="AWS Region"
                            value={awsRegion}
                            valueStyle={{ fontSize: '16px' }}
                        />
                    </Card>
                </Col>
                <Col span={8}>
                    <Card title="Instance Class" bordered={false}>
                        <Statistic
                            title="DB Instance Class"
                            value={selectedRDSInstance?.DBInstanceClass || 'N/A'}
                            valueStyle={{ fontSize: '16px' }}
                        />
                    </Card>
                </Col>
                <Col span={8}>
                    <Card title="Engine" bordered={false}>
                        <Statistic
                            title="SQL Server Engine"
                            value={selectedRDSInstance?.Engine || 'N/A'}
                            valueStyle={{ fontSize: '16px' }}
                        />
                    </Card>
                </Col>
                <Col span={8}>
                    <Card title="Version" bordered={false}>
                        <Statistic
                            title="Engine Version"
                            value={selectedRDSInstance?.EngineVersion || 'N/A'}
                            valueStyle={{ fontSize: '16px' }}
                        />
                    </Card>
                </Col>
                <Col span={8}>
                    <Card title="Multi-AZ" bordered={false}>
                        <Statistic
                            title="Multi-AZ Deployment"
                            value={selectedRDSInstance?.MultiAZ ? 'Enabled' : 'Disabled'}
                            valueStyle={{ 
                                fontSize: '16px',
                                color: selectedRDSInstance?.MultiAZ ? '#52c41a' : '#ff4d4f'
                            }}
                        />
                    </Card>
                </Col>
                <Col span={12}>
                    <Card title="Endpoint" bordered={false}>
                        <Statistic
                            title="Connection Endpoint"
                            value={selectedRDSInstance?.Endpoint?.Address || 'N/A'}
                            valueStyle={{ fontSize: '14px' }}
                        />
                        <div style={{ marginTop: 8, fontSize: '12px', color: '#666' }}>
                            Port: {selectedRDSInstance?.Endpoint?.Port || 'N/A'}
                        </div>
                    </Card>
                </Col>
                <Col span={12}>
                    <Card title="Storage" bordered={false}>
                        <Row>
                            <Col span={12}>
                                <Statistic
                                    title="Allocated Storage"
                                    value={selectedRDSInstance?.AllocatedStorage || 0}
                                    suffix="GB"
                                />
                            </Col>
                            <Col span={12}>
                                <Statistic
                                    title="Storage Type"
                                    value={selectedRDSInstance?.StorageType || 'N/A'}
                                />
                            </Col>
                        </Row>
                    </Card>
                </Col>
                {/* AWS CloudWatch Metrics */}
                <Col span={24}>
                    <Card title="CloudWatch Metrics" bordered={false}>
                        <Row gutter={[16, 16]}>
                            <Col span={6}>
                                <Statistic
                                    title="CPU Utilization"
                                    value={getLatestMetricValue('CPUUtilization')}
                                    suffix="%"
                                    precision={1}
                                    valueStyle={{ 
                                        color: getLatestMetricValue('CPUUtilization') > 80 ? '#ff4d4f' : '#52c41a'
                                    }}
                                />
                            </Col>
                            <Col span={6}>
                                <Statistic
                                    title="Connections"
                                    value={getLatestMetricValue('DatabaseConnections')}
                                    precision={0}
                                />
                            </Col>
                            <Col span={6}>
                                <Statistic
                                    title="Free Memory"
                                    value={formatBytes(getLatestMetricValue('FreeableMemory'))}
                                />
                            </Col>
                            <Col span={6}>
                                <Statistic
                                    title="Free Storage"
                                    value={formatBytes(getLatestMetricValue('FreeStorageSpace'))}
                                />
                            </Col>
                        </Row>
                    </Card>
                </Col>
            </Row>
        );
    };

    // Helper functions for AWS metrics
    const getLatestMetricValue = (metricName: string): number => {
        const metric = awsMetrics[metricName];
        if (!metric || metric.length === 0) return 0;
        return metric[metric.length - 1]?.value || 0;
    };

    const formatBytes = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // AWS CloudWatch Charts Render Function
    const renderAWSCloudWatchCharts = () => {
        const prepareChartData = (metricName: string) => {
            const metrics = awsMetrics[metricName] || [];
            return metrics.map(m => ({
                timestamp: new Date(m.timestamp).toLocaleTimeString(),
                value: m.value,
                label: metricName
            }));
        };

        return (
            <>
                {/* AWS CloudWatch Metrics Guide */}
                <Row gutter={[16, 16]} style={{ marginBottom: '16px' }}>
                    <Col span={24}>
                        <Alert
                            message={
                                <span>
                                    <CloudOutlined style={{ marginRight: 8 }} />
                                    AWS RDS CloudWatch Performance Metrics
                                </span>
                            }
                            description={
                                <div style={{ marginTop: '8px' }}>
                                    <p><strong>☁️ AWS CloudWatch Metrics for SQL Server RDS:</strong></p>
                                    <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                                        <li><strong>CPU Utilization:</strong> The percentage of CPU utilization. Target: &lt;80% for normal operation.</li>
                                        <li><strong>Database Connections:</strong> Number of database connections in use. Monitor for connection pool exhaustion.</li>
                                        <li><strong>Freeable Memory:</strong> Available RAM for the DB instance. Low values may indicate memory pressure.</li>
                                        <li><strong>Read/Write IOPS:</strong> I/O operations per second. High values may indicate disk bottlenecks.</li>
                                        <li><strong>Read/Write Latency:</strong> Average time per I/O operation. Target: &lt;10ms for good performance.</li>
                                    </ul>
                                    <p><strong>🔄 Data Source:</strong> Amazon CloudWatch metrics updated every minute</p>
                                    <p><strong>⚡ Performance Insights:</strong> For deeper query-level analysis, check AWS Performance Insights</p>
                                </div>
                            }
                            type="info"
                            showIcon={false}
                            closable
                            style={{ marginBottom: '16px' }}
                        />
                    </Col>
                </Row>

                {/* AWS CloudWatch Charts */}
                <Row gutter={[16, 16]}>
                    {/* CPU Utilization */}
                    <Col span={12}>
                        <Card title="CPU Utilization (%)" bordered={false}>
                            <div style={{ height: '300px' }}>
                                <ResponsiveContainer>
                                    <LineChart data={prepareChartData('CPUUtilization')}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="timestamp" />
                                        <YAxis />
                                        <RechartsTooltip />
                                        <Line type="monotone" dataKey="value" stroke="#ff6b6b" strokeWidth={2} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>
                    </Col>

                    {/* Database Connections */}
                    <Col span={12}>
                        <Card title="Database Connections" bordered={false}>
                            <div style={{ height: '300px' }}>
                                <ResponsiveContainer>
                                    <LineChart data={prepareChartData('DatabaseConnections')}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="timestamp" />
                                        <YAxis />
                                        <RechartsTooltip />
                                        <Line type="monotone" dataKey="value" stroke="#4ecdc4" strokeWidth={2} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>
                    </Col>

                    {/* Memory Metrics */}
                    <Col span={12}>
                        <Card title="Freeable Memory (Bytes)" bordered={false}>
                            <div style={{ height: '300px' }}>
                                <ResponsiveContainer>
                                    <AreaChart data={prepareChartData('FreeableMemory')}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="timestamp" />
                                        <YAxis />
                                        <RechartsTooltip />
                                        <Area type="monotone" dataKey="value" stroke="#45b7d1" fill="#45b7d1" fillOpacity={0.6} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>
                    </Col>

                    {/* Storage Space */}
                    <Col span={12}>
                        <Card title="Free Storage Space (Bytes)" bordered={false}>
                            <div style={{ height: '300px' }}>
                                <ResponsiveContainer>
                                    <AreaChart data={prepareChartData('FreeStorageSpace')}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="timestamp" />
                                        <YAxis />
                                        <RechartsTooltip />
                                        <Area type="monotone" dataKey="value" stroke="#f9ca24" fill="#f9ca24" fillOpacity={0.6} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>
                    </Col>

                    {/* Read IOPS */}
                    <Col span={12}>
                        <Card title="Read IOPS" bordered={false}>
                            <div style={{ height: '300px' }}>
                                <ResponsiveContainer>
                                    <LineChart data={prepareChartData('ReadIOPS')}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="timestamp" />
                                        <YAxis />
                                        <RechartsTooltip />
                                        <Line type="monotone" dataKey="value" stroke="#6c5ce7" strokeWidth={2} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>
                    </Col>

                    {/* Write IOPS */}
                    <Col span={12}>
                        <Card title="Write IOPS" bordered={false}>
                            <div style={{ height: '300px' }}>
                                <ResponsiveContainer>
                                    <LineChart data={prepareChartData('WriteIOPS')}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="timestamp" />
                                        <YAxis />
                                        <RechartsTooltip />
                                        <Line type="monotone" dataKey="value" stroke="#a29bfe" strokeWidth={2} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>
                    </Col>

                    {/* Read Latency */}
                    <Col span={12}>
                        <Card title="Read Latency (Seconds)" bordered={false}>
                            <div style={{ height: '300px' }}>
                                <ResponsiveContainer>
                                    <LineChart data={prepareChartData('ReadLatency')}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="timestamp" />
                                        <YAxis />
                                        <RechartsTooltip />
                                        <Line type="monotone" dataKey="value" stroke="#fd79a8" strokeWidth={2} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>
                    </Col>

                    {/* Write Latency */}
                    <Col span={12}>
                        <Card title="Write Latency (Seconds)" bordered={false}>
                            <div style={{ height: '300px' }}>
                                <ResponsiveContainer>
                                    <LineChart data={prepareChartData('WriteLatency')}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="timestamp" />
                                        <YAxis />
                                        <RechartsTooltip />
                                        <Line type="monotone" dataKey="value" stroke="#fdcb6e" strokeWidth={2} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>
                    </Col>

                    {/* Throughput Metrics */}
                    <Col span={12}>
                        <Card title="Read Throughput (Bytes/Second)" bordered={false}>
                            <div style={{ height: '300px' }}>
                                <ResponsiveContainer>
                                    <AreaChart data={prepareChartData('ReadThroughput')}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="timestamp" />
                                        <YAxis />
                                        <RechartsTooltip />
                                        <Area type="monotone" dataKey="value" stroke="#00b894" fill="#00b894" fillOpacity={0.6} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>
                    </Col>

                    <Col span={12}>
                        <Card title="Write Throughput (Bytes/Second)" bordered={false}>
                            <div style={{ height: '300px' }}>
                                <ResponsiveContainer>
                                    <AreaChart data={prepareChartData('WriteThroughput')}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="timestamp" />
                                        <YAxis />
                                        <RechartsTooltip />
                                        <Area type="monotone" dataKey="value" stroke="#e17055" fill="#e17055" fillOpacity={0.6} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>
                    </Col>
                </Row>
            </>
        );
    };

    // Note: Cluster data is now fetched automatically via React Query
    // No need for manual fetchClusterData() call

    // Update for refresh interval
    useEffect(() => {
        let countdownTimer: number | null = null;
        let refreshTimer: number | null = null;

        // Set countdown to initial refresh interval
        setCountdown(refreshInterval);

        if (refreshInterval > 0) {
            // Update countdown every second
            countdownTimer = window.setInterval(() => {
                setCountdown((prevCount) => {
                    if (prevCount <= 1) {
                        return refreshInterval;
                    }
                    return prevCount - 1;
                });
            }, 1000);

            // Refresh data when interval expires
            refreshTimer = window.setInterval(() => {
                // Skip if manual node change is in progress
                if (nodeName && !manualNodeChangeInProgress) {
                    if (activeTab === '1') {
                        if (selectedSubMenu === 'server-info') {
                            if (isAWSRDS) {
                                fetchAWSMetrics(rdsInstanceId, awsRegion, selectedTimeRange);
                            } else {
                                fetchServerInfo(nodeName);
                            }
                        } else if (selectedSubMenu === 'connections') {
                            if (!isAWSRDS) {
                                fetchConnectionsHistoricalData(nodeName, selectedTimeRange);
                                fetchConnectionAnalysis(nodeName);
                            }
                        }
                    } else if (activeTab === '2') {
                        if (selectedSubMenu === 'top-queries') {
                            fetchTopQueries(nodeName);
                        } else if (selectedSubMenu === 'blocking') {
                            fetchBlockingInfo(nodeName);
                            fetchBlockingHistoricalData(nodeName, selectedTimeRange);
                        } else if (selectedSubMenu === 'wait-stats') {
                            fetchWaitStats(nodeName);
                            fetchWaitStatsHistoricalData(nodeName, selectedTimeRange);
                        }
                    } else if (activeTab === '4') {
                        fetchHistoricalMetrics(nodeName, selectedTimeRange);
                    } else if (activeTab === '5') {
                        if (selectedSubMenu === 'performance-metrics') {
                            if (isAWSRDS) {
                                fetchAWSMetrics(rdsInstanceId, awsRegion, selectedTimeRange);
                            } else {
                                fetchPerformanceHistoricalData(nodeName, selectedTimeRange);
                            }
                        }
                    } else if (activeTab === '6') {
                        if (selectedSubMenu === 'transaction-metrics' && !isAWSRDS) {
                            fetchTransactionsHistoricalData(nodeName, selectedTimeRange);
                        }
                    }
                }
            }, refreshInterval * 1000);
        }

        // Clean up timers when component unmounts or refresh interval changes
        return () => {
            if (countdownTimer) {
                window.clearInterval(countdownTimer);
            }
            if (refreshTimer) {
                window.clearInterval(refreshTimer);
            }
        };
    }, [refreshInterval, nodeName, activeTab, selectedSubMenu, manualNodeChangeInProgress]);

    // Update UI when cluster selection changes
    useEffect(() => {
        if (clusterName) {
            setCurrentStep(1);

            // Map "Standalone" display name back to empty string for data lookup if needed
            const dataKey = clusterName === 'Standalone' ? '' : clusterName;
            const selectedCluster = data[clusterName] || data[dataKey];

            if (selectedCluster) {
                const nodes = selectedCluster.map(node => ({
                    ...node
                }));
                setNodeInfo(nodes);

                // Auto-select node from URL if provided
                if (hostNameFromURL && nodes.some(node => node.Hostname === hostNameFromURL)) {
                    setNodeName(hostNameFromURL);
                    setCurrentStep(2);

                    // Set flag to prevent duplicate API calls
                    setManualNodeChangeInProgress(true);

                    // Load initial data for the selected node based on the active tab
                    setTimeout(() => {
                        if (activeTab === '1') {
                            if (selectedSubMenu === 'server-info') {
                                fetchServerInfo(hostNameFromURL);
                            } else if (selectedSubMenu === 'connections') {
                                fetchConnectionsHistoricalData(hostNameFromURL, selectedTimeRange);
                                fetchConnectionAnalysis(hostNameFromURL);
                            }
                        } else if (activeTab === '2') {
                            if (selectedSubMenu === 'top-queries') {
                                fetchTopQueries(hostNameFromURL);
                            } else if (selectedSubMenu === 'blocking') {
                                fetchBlockingInfo(hostNameFromURL);
                            } else if (selectedSubMenu === 'wait-stats') {
                                fetchWaitStats(hostNameFromURL);
                            }
                        } else if (activeTab === '3') {
                            fetchDatabases(hostNameFromURL);
                        } else if (activeTab === '4') {
                            fetchHistoricalMetrics(hostNameFromURL, selectedTimeRange);
                        } else if (activeTab === '5') {
                            if (selectedSubMenu === 'performance-metrics') {
                                fetchPerformanceHistoricalData(hostNameFromURL, selectedTimeRange);
                            }
                        } else if (activeTab === '6') {
                            if (selectedSubMenu === 'transaction-metrics') {
                                fetchTransactionsHistoricalData(hostNameFromURL, selectedTimeRange);
                            }
                        }

                        // Reset the flag after all API calls
                        setTimeout(() => {
                            setManualNodeChangeInProgress(false);
                        }, 500);
                    }, 100);
                } else if (clusterName === 'Standalone' && nodes.length === 1) {
                    // Auto-select single node in standalone cluster
                    const singleNode = nodes[0];
                    setNodeName(singleNode.Hostname);
                    setCurrentStep(2);
                    if (!autoSelectionMessageShown) {
                        message.success(`Auto-selected standalone node: ${singleNode.Hostname}`);
                        setAutoSelectionMessageShown(true);
                    }

                    // Set flag to prevent duplicate API calls
                    setManualNodeChangeInProgress(true);

                    // Load initial data for the selected node based on the active tab
                    setTimeout(() => {
                        if (activeTab === '1') {
                            if (selectedSubMenu === 'server-info') {
                                fetchServerInfo(singleNode.Hostname);
                            } else if (selectedSubMenu === 'connections') {
                                fetchConnectionsHistoricalData(singleNode.Hostname, selectedTimeRange);
                                fetchConnectionAnalysis(singleNode.Hostname);
                            }
                        } else if (activeTab === '2') {
                            if (selectedSubMenu === 'top-queries') {
                                fetchTopQueries(singleNode.Hostname);
                            } else if (selectedSubMenu === 'blocking') {
                                fetchBlockingInfo(singleNode.Hostname);
                            } else if (selectedSubMenu === 'wait-stats') {
                                fetchWaitStats(singleNode.Hostname);
                            }
                        } else if (activeTab === '3') {
                            fetchDatabases(singleNode.Hostname);
                        } else if (activeTab === '4') {
                            fetchHistoricalMetrics(singleNode.Hostname, selectedTimeRange);
                        } else if (activeTab === '5') {
                            if (selectedSubMenu === 'performance-metrics') {
                                fetchPerformanceHistoricalData(singleNode.Hostname, selectedTimeRange);
                            }
                        } else if (activeTab === '6') {
                            if (selectedSubMenu === 'transaction-metrics') {
                                fetchTransactionsHistoricalData(singleNode.Hostname, selectedTimeRange);
                            }
                        }

                        // Reset the flag after all API calls
                        setTimeout(() => {
                            setManualNodeChangeInProgress(false);
                        }, 500);
                    }, 100);
                }
            } else {
                setNodeInfo([]);
            }
        } else {
            setNodeInfo([]);
        }
    }, [clusterName, data, hostNameFromURL, autoSelectionMessageShown]);

    // Render functions
    const renderServerTab = () => {
        switch (selectedSubMenu) {
            case 'server-info':
                return (
                    <div style={{ marginTop: 10 }}>
                        {/* AWS RDS Instance Badge */}
                        {isAWSRDS && (
                            <Alert
                                message={
                                    <span>
                                        <CloudOutlined style={{ marginRight: 8 }} />
                                        AWS RDS SQL Server Instance
                                    </span>
                                }
                                description={`Region: ${awsRegion} | Instance ID: ${rdsInstanceId}`}
                                type="success"
                                showIcon={false}
                                style={{ marginBottom: 16 }}
                            />
                        )}
                        
                        {(loading || awsMetricsLoading) ? (
                            <div style={{ textAlign: 'center', padding: '40px' }}>
                                <Spin size="large" />
                                <div style={{ marginTop: '16px' }}>
                                    Loading {isAWSRDS ? 'AWS RDS' : 'server'} information...
                                </div>
                            </div>
                        ) : isAWSRDS ? (
                            renderAWSRDSInfo()
                        ) : !serverInfo ? (
                            <Alert
                                message="No server information available"
                                description="Select a server node to view information"
                                type="info"
                                showIcon
                            />
                        ) : (
                            <Row gutter={[16, 16]}>
                                <Col span={8}>
                                    <Card title="Server" bordered={false}>
                                        <Statistic
                                            title="Server Name"
                                            value={serverInfo.servername}
                                            valueStyle={{ fontSize: '16px' }}
                                        />
                                    </Card>
                                </Col>
                                <Col span={8}>
                                    <Card title="Edition" bordered={false}>
                                        <Statistic
                                            title="SQL Server Edition"
                                            value={serverInfo.edition}
                                            valueStyle={{ fontSize: '16px' }}
                                        />
                                    </Card>
                                </Col>
                                <Col span={8}>
                                    <Card title="Version" bordered={false}>
                                        <Statistic
                                            title="Engine Version"
                                            value={serverInfo.engine_version}
                                            valueStyle={{ fontSize: '16px' }}
                                        />
                                    </Card>
                                </Col>
                                <Col span={8}>
                                    <Card title="Instance" bordered={false}>
                                        <Statistic
                                            title="Instance Name"
                                            value={serverInfo.instance_name || 'DEFAULT'}
                                            valueStyle={{ fontSize: '16px' }}
                                        />
                                    </Card>
                                </Col>
                                <Col span={8}>
                                    <Card title="Clustered" bordered={false}>
                                        <Statistic
                                            title="Is Clustered"
                                            value={serverInfo.is_clustered ? 'Yes' : 'No'}
                                            valueStyle={{
                                                fontSize: '16px',
                                                color: serverInfo.is_clustered ? '#52c41a' : '#595959'
                                            }}
                                        />
                                    </Card>
                                </Col>
                                <Col span={8}>
                                    <Card title="Always On" bordered={false}>
                                        <Statistic
                                            title="AlwaysOn Enabled"
                                            value={serverInfo.is_hadr_enabled ? 'Yes' : 'No'}
                                            valueStyle={{
                                                fontSize: '16px',
                                                color: serverInfo.is_hadr_enabled ? '#52c41a' : '#595959'
                                            }}
                                        />
                                    </Card>
                                </Col>
                            </Row>
                        )}
                    </div>
                );
            case 'connections':
                return (
                    <div style={{ marginTop: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <h2 style={{ color: connectionsDataLoading ? '#cc2927' : 'inherit' }}>
                                Connection Metrics {connectionsDataLoading ? '(Loading...)' : ''}
                            </h2>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <Select
                                    value={selectedTimeRange}
                                    onChange={(value) => {
                                        setSelectedTimeRange(value);
                                        if (nodeName) {
                                            fetchConnectionsHistoricalData(nodeName, value);
                                        }
                                    }}
                                    style={{ width: 140 }}
                                    disabled={!nodeName}
                                >
                                    <Option value="10m">Last 10 Minutes</Option>
                                    <Option value="15m">Last 15 Minutes</Option>
                                    <Option value="30m">Last 30 Minutes</Option>
                                    <Option value="1h">Last 1 Hour</Option>
                                    <Option value="6h">Last 6 Hours</Option>
                                    <Option value="24h">Last 24 Hours</Option>
                                    <Option value="7d">Last 7 Days</Option>
                                </Select>
                                <Button
                                    type="primary"
                                    onClick={() => {
                                        if (nodeName) {
                                            fetchConnectionsHistoricalData(nodeName, selectedTimeRange);
                                        }
                                    }}
                                    icon={<ReloadOutlined />}
                                    loading={connectionsDataLoading}
                                    disabled={!nodeName || connectionsDataLoading}
                                    style={{ background: '#cc2927', fontWeight: 'bold' }}
                                >
                                    Refresh Connections
                                </Button>
                            </div>
                        </div>

                        {!nodeName && (
                            <Alert
                                message="Please select a node to view connections"
                                type="info"
                                showIcon
                                style={{ marginBottom: '16px' }}
                            />
                        )}

                        {nodeName && connectionsDataLoading && (
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px', border: '1px dashed #d9d9d9', borderRadius: '8px', background: '#fafafa' }}>
                                <div style={{ textAlign: 'center' }}>
                                    <Spin size="large" />
                                    <div style={{ marginTop: '15px', color: '#cc2927', fontWeight: 'bold' }}>
                                        Loading Connection Metrics...
                                    </div>
                                </div>
                            </div>
                        )}

                        {nodeName && !connectionsDataLoading && !connections && (
                            <Alert
                                message="No connection data available"
                                description="The server didn't return any connection data. Please try refreshing."
                                type="warning"
                                showIcon
                                style={{ marginBottom: '16px' }}
                            />
                        )}

                        {nodeName && !connectionsDataLoading && connections && (
                            <>

                                {/* Connection Distribution */}
                                <Row gutter={[16, 16]} style={{ marginBottom: '16px' }}>
                                    <Col span={24}>
                                        <Card title="Connection Distribution" bordered={false}>
                                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                                                <Card.Grid style={{
                                                    width: '33.33%',
                                                    textAlign: 'center',
                                                    boxShadow: 'none',
                                                    padding: '12px'
                                                }}>
                                                    <Progress
                                                        type="circle"
                                                        percent={Math.round((connections.active_connections / Math.max(connections.total_connections, 1)) * 100)}
                                                        format={percent => `${percent}%`}
                                                        strokeColor="#52c41a"
                                                        width={120}
                                                    />
                                                    <div style={{ marginTop: '8px' }}>
                                                        <Text strong>Active ({Math.round(connections.active_connections)})</Text>
                                                    </div>
                                                </Card.Grid>
                                                <Card.Grid style={{
                                                    width: '33.33%',
                                                    textAlign: 'center',
                                                    boxShadow: 'none',
                                                    padding: '12px'
                                                }}>
                                                    <Progress
                                                        type="circle"
                                                        percent={Math.round((connections.idle_connections / Math.max(connections.total_connections, 1)) * 100)}
                                                        format={percent => `${percent}%`}
                                                        strokeColor="#1890ff"
                                                        width={120}
                                                    />
                                                    <div style={{ marginTop: '8px' }}>
                                                        <Text strong>Idle ({Math.round(connections.idle_connections)})</Text>
                                                    </div>
                                                </Card.Grid>
                                                <Card.Grid style={{
                                                    width: '33.33%',
                                                    textAlign: 'center',
                                                    boxShadow: 'none',
                                                    padding: '12px'
                                                }}>
                                                    <Progress
                                                        type="circle"
                                                        percent={100}
                                                        format={() => Math.round(connections.total_connections)}
                                                        strokeColor="#cc2927"
                                                        width={120}
                                                    />
                                                    <div style={{ marginTop: '8px' }}>
                                                        <Text strong>Total ({Math.round(connections.total_connections)})</Text>
                                                    </div>
                                                </Card.Grid>
                                            </div>
                                        </Card>
                                    </Col>
                                </Row>

                                {/* Connection Analysis - Application/Host Distribution */}
                                {connectionAnalysisData && connectionAnalysisData.connections_by_application && connectionAnalysisData.connections_by_application.length > 0 && (
                                    <Row gutter={[16, 16]} style={{ marginBottom: '16px' }}>
                                        <Col span={24}>
                                            <Card
                                                title={
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <TeamOutlined style={{ color: '#cc2927' }} />
                                                        <span>Connection Distribution by Application</span>
                                                    </div>
                                                }
                                                bordered={false}
                                                extra={
                                                    <Button
                                                        type="text"
                                                        size="small"
                                                        icon={<ReloadOutlined />}
                                                        onClick={() => {
                                                            if (nodeName) {
                                                                fetchConnectionAnalysis(nodeName);
                                                            }
                                                        }}
                                                        loading={connectionAnalysisLoading}
                                                        disabled={!nodeName}
                                                        style={{
                                                            color: '#cc2927',
                                                            border: 'none',
                                                            boxShadow: 'none'
                                                        }}
                                                        title="Refresh Connection Analysis"
                                                    />
                                                }
                                            >
                                                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                                    {connectionAnalysisData.connections_by_application.slice(0, 10).map((item: any, index: number) => (
                                                        <div key={index} style={{
                                                            display: 'flex',
                                                            justifyContent: 'space-between',
                                                            alignItems: 'center',
                                                            padding: '12px 0',
                                                            borderBottom: index < Math.min(connectionAnalysisData.connections_by_application.length - 1, 9) ? '1px solid #f0f0f0' : 'none'
                                                        }}>
                                                            <div style={{ flex: 1 }}>
                                                                <div style={{ marginBottom: '4px' }}>
                                                                    <Text strong style={{ fontSize: '14px' }}>
                                                                        {item.program_name || 'Unknown Application'}
                                                                    </Text>
                                                                </div>
                                                                <div>
                                                                    <Text type="secondary" style={{ fontSize: '12px' }}>
                                                                        {item.host_name || 'Unknown Host'}
                                                                    </Text>
                                                                </div>
                                                            </div>
                                                            <div style={{ textAlign: 'right', minWidth: '200px' }}>
                                                                <div style={{ marginBottom: '8px' }}>
                                                                    <Text strong style={{ fontSize: '16px', color: '#cc2927' }}>
                                                                        {Math.round(item.total_connection_count || 0).toLocaleString()}
                                                                    </Text>
                                                                    <Text type="secondary" style={{ marginLeft: '6px', fontSize: '12px' }}>
                                                                        Total Connections
                                                                    </Text>
                                                                </div>
                                                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                                    <Tag color="green" style={{ margin: 0 }}>
                                                                        {Math.round(item.active_connection_count || 0)} Active
                                                                    </Tag>
                                                                    <Tag color="blue" style={{ margin: 0 }}>
                                                                        {Math.round(item.idle_connection_count || 0)} Idle
                                                                    </Tag>
                                                                    {item.idle_percentage !== undefined && (
                                                                        <Tag color={item.idle_percentage > 50 ? 'orange' : 'default'} style={{ margin: 0 }}>
                                                                            {Math.round(item.idle_percentage)}% Idle
                                                                        </Tag>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </Card>
                                        </Col>
                                    </Row>
                                )}

                                {/* Historical Chart */}
                                <Row gutter={16}>
                                    <Col span={24}>
                                        <Card
                                            title={
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <LineChartOutlined style={{ color: '#cc2927' }} />
                                                        <span>Connection History</span>
                                                    </div>
                                                    <Button
                                                        type="text"
                                                        size="small"
                                                        icon={<ReloadOutlined />}
                                                        onClick={() => {
                                                            if (nodeName) {
                                                                fetchConnectionsHistoricalData(nodeName, selectedTimeRange);
                                                            }
                                                        }}
                                                        loading={connectionsDataLoading}
                                                        disabled={!nodeName}
                                                        style={{
                                                            color: '#cc2927',
                                                            border: 'none',
                                                            boxShadow: 'none'
                                                        }}
                                                        title="Refresh Connection data"
                                                    />
                                                </div>
                                            }
                                            hoverable
                                            style={{ height: '400px' }}
                                        >
                                            {connectionsDataLoading ? (
                                                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
                                                    <Spin size="large" />
                                                </div>
                                            ) : connectionsHistoricalData.length > 0 ? (
                                                <ResponsiveContainer width="100%" height={300}>
                                                    <LineChart data={connectionsHistoricalData}>
                                                        <CartesianGrid strokeDasharray="3 3" />
                                                        <XAxis
                                                            dataKey="time"
                                                            tick={{ fontSize: 12 }}
                                                            interval="preserveStartEnd"
                                                        />
                                                        <YAxis
                                                            tick={{ fontSize: 12 }}
                                                            label={{ value: 'Connections', angle: -90, position: 'insideLeft' }}
                                                        />
                                                        <RechartsTooltip
                                                            formatter={(value: any, name: string) => {
                                                                const displayName = name === 'active_connections' ? 'Active' :
                                                                    name === 'idle_connections' ? 'Idle' :
                                                                        name === 'total_connections' ? 'Total' : name;
                                                                return [value, displayName];
                                                            }}
                                                            labelFormatter={(label) => `Time: ${label}`}
                                                        />
                                                        <Line
                                                            type="monotone"
                                                            dataKey="active_connections"
                                                            stroke="#52c41a"
                                                            strokeWidth={2}
                                                            dot={false}
                                                        />
                                                        <Line
                                                            type="monotone"
                                                            dataKey="idle_connections"
                                                            stroke="#1890ff"
                                                            strokeWidth={2}
                                                            dot={false}
                                                        />
                                                        <Line
                                                            type="monotone"
                                                            dataKey="total_connections"
                                                            stroke="#cc2927"
                                                            strokeWidth={2}
                                                            dot={false}
                                                        />
                                                    </LineChart>
                                                </ResponsiveContainer>
                                            ) : (
                                                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px', flexDirection: 'column' }}>
                                                    <LineChartOutlined style={{ fontSize: '48px', color: '#d9d9d9', marginBottom: '16px' }} />
                                                    <Text type="secondary">No connection historical data available</Text>
                                                </div>
                                            )}
                                        </Card>
                                    </Col>
                                </Row>
                            </>
                        )}
                    </div>
                );
            default:
                return (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px', flexDirection: 'column' }}>
                        <InfoCircleOutlined style={{ fontSize: '48px', color: '#cc2927', marginBottom: '16px' }} />
                        <Text type="secondary">Please select a submenu item from the left sidebar</Text>
                    </div>
                );
        }
    };

    const renderQueriesTab = () => {
        switch (selectedSubMenu) {
            case 'top-queries':
                return (
                    <div>
                        <div id="top-queries-container">
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '15px'
                            }}>
                                <h2 style={{ marginBottom: 0 }}>
                                    Top Queries
                                </h2>
                                <div>
                                    <Button
                                        type="primary"
                                        onClick={() => {
                                            if (nodeName) {
                                                fetchTopQueries(nodeName);
                                            }
                                        }}
                                        icon={<ReloadOutlined />}
                                        loading={loading}
                                        disabled={!nodeName}
                                        style={{ background: '#cc2927', fontWeight: 'bold' }}
                                    >
                                        Refresh
                                    </Button>
                                </div>
                            </div>

                            {!nodeName && (
                                <Alert
                                    message="Please select a node to view top queries"
                                    type="info"
                                    showIcon
                                    style={{ marginBottom: '16px' }}
                                />
                            )}

                            {nodeName && loading && (
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    height: '300px'
                                }}>
                                    <Spin size="large" />
                                    <span style={{ marginLeft: '12px' }}>Loading top queries...</span>
                                </div>
                            )}

                            {nodeName && !loading && topQueries.length === 0 && (
                                <Alert
                                    message="No top queries found"
                                    description="Either no queries have been executed recently or the query execution statistics have been reset."
                                    type="info"
                                    showIcon
                                    style={{ marginBottom: '16px' }}
                                />
                            )}

                            {nodeName && !loading && topQueries.length > 0 && (
                                <Table
                                    dataSource={topQueries.map((q, idx) => ({ ...q, key: idx }))}
                                    columns={[
                                        {
                                            title: 'Source',
                                            key: 'source',
                                            width: 200,
                                            render: (_, record: any) => (
                                                <div>
                                                    <Tag color={record.query_type === 'Stored Procedure' ? 'blue' : 'orange'}>
                                                        {record.query_type}
                                                    </Tag>
                                                    {record.object_name && (
                                                        <div style={{ marginTop: 4, fontSize: '12px' }}>
                                                            <Text type="secondary">
                                                                {record.schema_name ? `${record.schema_name}.${record.object_name}` : record.object_name}
                                                            </Text>
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        },
                                        {
                                            title: 'Database',
                                            key: 'database',
                                            width: 120,
                                            render: (_, record: any) => {
                                                if (record.database_name) {
                                                    return (
                                                        <Tag color="green" style={{ fontWeight: 500 }}>
                                                            {record.database_name}
                                                        </Tag>
                                                    );
                                                } else {
                                                    return (
                                                        <Tag color="orange" style={{ fontWeight: 500 }}>
                                                            Unknown
                                                        </Tag>
                                                    );
                                                }
                                            }
                                        },
                                        {
                                            title: 'Query',
                                            dataIndex: 'query_text',
                                            key: 'query_text',
                                            render: (text: string, record: any) => {
                                                // Truncate long queries for display
                                                const maxLength = 100;
                                                const displayText = text.length > maxLength
                                                    ? text.substring(0, maxLength) + '...'
                                                    : text;

                                                return (
                                                    <div>
                                                        <Typography.Paragraph
                                                            ellipsis={{ rows: 2, expandable: false }}
                                                            style={{ marginBottom: 0 }}
                                                        >
                                                            <code>{displayText}</code>
                                                        </Typography.Paragraph>
                                                        <Button
                                                            type="link"
                                                            size="small"
                                                            onClick={() => {
                                                                setModalTitle('Query Text');
                                                                setModalContent(text);
                                                                // For ad-hoc queries without database info, set modalDatabase to null to trigger database selection
                                                                setModalDatabase(record.database_name || null);
                                                                setModalVisible(true);
                                                            }}
                                                            style={{ padding: 0 }}
                                                        >
                                                            View Full Query
                                                        </Button>
                                                    </div>
                                                );
                                            }
                                        },
                                        {
                                            title: 'Executions',
                                            dataIndex: 'execution_count',
                                            key: 'execution_count',
                                            sorter: (a: any, b: any) => a.execution_count - b.execution_count,
                                            render: (count: number) => count.toLocaleString()
                                        },
                                        {
                                            title: 'Total CPU Time',
                                            dataIndex: 'total_worker_time',
                                            key: 'total_worker_time',
                                            sorter: (a: any, b: any) => a.total_worker_time - b.total_worker_time,
                                            defaultSortOrder: 'descend' as const,
                                            render: (time: number) => `${(time / 1000).toFixed(2)} ms`
                                        },
                                        {
                                            title: 'Avg CPU Time',
                                            dataIndex: 'avg_worker_time',
                                            key: 'avg_worker_time',
                                            sorter: (a: any, b: any) => a.avg_worker_time - b.avg_worker_time,
                                            render: (time: number) => `${(time / 1000).toFixed(2)} ms`
                                        },
                                        {
                                            title: 'Avg Elapsed Time',
                                            dataIndex: 'avg_elapsed_time',
                                            key: 'avg_elapsed_time',
                                            sorter: (a: any, b: any) => a.avg_elapsed_time - b.avg_elapsed_time,
                                            render: (time: number) => `${(time / 1000).toFixed(2)} ms`
                                        },
                                        {
                                            title: 'Avg Logical Reads',
                                            dataIndex: 'avg_logical_reads',
                                            key: 'avg_logical_reads',
                                            sorter: (a: any, b: any) => a.avg_logical_reads - b.avg_logical_reads,
                                            render: (reads: number) => reads.toLocaleString()
                                        },
                                        {
                                            title: 'Last Execution',
                                            dataIndex: 'last_execution_time',
                                            key: 'last_execution_time',
                                            sorter: (a: any, b: any) => new Date(a.last_execution_time).getTime() - new Date(b.last_execution_time).getTime(),
                                            render: (time: string) => new Date(time).toLocaleString()
                                        }
                                    ]}
                                    pagination={{ pageSize: 10 }}
                                    scroll={{ x: 'max-content' }}
                                />
                            )}
                        </div>
                    </div>
                );
            case 'active-queries':
                return (
                    <div>
                        <div id="active-queries-container">
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '15px'
                            }}>
                                <h2 style={{ marginBottom: 0 }}>
                                    Active Queries
                                </h2>
                                <div>
                                    <Button
                                        type="primary"
                                        onClick={() => {
                                            if (nodeName) {
                                                fetchActiveQueries(nodeName);
                                            }
                                        }}
                                        icon={<ReloadOutlined />}
                                        loading={loading}
                                        disabled={!nodeName}
                                        style={{ background: '#cc2927', fontWeight: 'bold' }}
                                    >
                                        Refresh
                                    </Button>
                                </div>
                            </div>

                            {!nodeName && (
                                <Alert
                                    message="Please select a node to view active queries"
                                    type="info"
                                    showIcon
                                    style={{ marginBottom: '16px' }}
                                />
                            )}

                            {nodeName && loading && (
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    height: '300px'
                                }}>
                                    <Spin size="large" />
                                    <span style={{ marginLeft: '12px' }}>Loading active queries...</span>
                                </div>
                            )}

                            {nodeName && !loading && activeQueries.length === 0 && (
                                <Alert
                                    message="No active queries found"
                                    description="There are currently no active queries running on this server."
                                    type="info"
                                    showIcon
                                    style={{ marginBottom: '16px' }}
                                />
                            )}

                            {nodeName && !loading && activeQueries.length > 0 && (
                                <Table
                                    dataSource={activeQueries.map((q, idx) => ({ ...q, key: idx }))}
                                    columns={[
                                        {
                                            title: 'SPID',
                                            dataIndex: 'SPID',
                                            key: 'SPID',
                                            width: 80,
                                            sorter: (a: any, b: any) => a.SPID - b.SPID
                                        },
                                        {
                                            title: 'Status',
                                            dataIndex: 'Status',
                                            key: 'Status',
                                            width: 100,
                                            render: (status: string) => (
                                                <Tag color={status === 'running' ? 'green' : status === 'suspended' ? 'orange' : 'blue'}>
                                                    {status}
                                                </Tag>
                                            )
                                        },
                                        {
                                            title: 'Blocked By',
                                            dataIndex: 'BlkBy',
                                            key: 'BlkBy',
                                            width: 100,
                                            render: (blkBy: number) => blkBy > 0 ? <Tag color="red">{blkBy}</Tag> : '-'
                                        },
                                        {
                                            title: 'Database',
                                            dataIndex: 'DBName',
                                            key: 'DBName',
                                            width: 120,
                                            render: (dbName: string) => (
                                                <Tag color="blue" style={{ fontWeight: 500 }}>
                                                    {dbName || 'Unknown'}
                                                </Tag>
                                            )
                                        },
                                        {
                                            title: 'Command',
                                            dataIndex: 'CommandType',
                                            key: 'CommandType',
                                            width: 120,
                                            render: (cmd: string) => (
                                                <Tag color="purple">
                                                    {cmd || 'N/A'}
                                                </Tag>
                                            )
                                        },
                                        {
                                            title: 'SQL Statement',
                                            dataIndex: 'SQLStatement',
                                            key: 'SQLStatement',
                                            render: (text: string, record: any) => {
                                                const maxLength = 100;
                                                const displayText = text && text.length > maxLength
                                                    ? text.substring(0, maxLength) + '...'
                                                    : text || 'N/A';

                                                return (
                                                    <div>
                                                        <Typography.Paragraph
                                                            ellipsis={{ rows: 2, expandable: false }}
                                                            style={{ marginBottom: 0 }}
                                                        >
                                                            <code>{displayText}</code>
                                                        </Typography.Paragraph>
                                                        {text && (
                                                            <Button
                                                                type="link"
                                                                size="small"
                                                                onClick={() => {
                                                                    setModalTitle('SQL Statement');
                                                                    setModalContent(text);
                                                                    setModalDatabase(record.DBName || null);
                                                                    setModalVisible(true);
                                                                }}
                                                                style={{ padding: 0 }}
                                                            >
                                                                View Full Query
                                                            </Button>
                                                        )}
                                                    </div>
                                                );
                                            }
                                        },
                                        {
                                            title: 'Elapsed (min)',
                                            dataIndex: 'ElapsedMin',
                                            key: 'ElapsedMin',
                                            width: 120,
                                            sorter: (a: any, b: any) => a.ElapsedMin - b.ElapsedMin,
                                            render: (time: number) => `${time.toFixed(2)} min`
                                        },
                                        {
                                            title: 'CPU Time',
                                            dataIndex: 'CPU',
                                            key: 'CPU',
                                            width: 100,
                                            sorter: (a: any, b: any) => a.CPU - b.CPU,
                                            render: (cpu: number) => `${cpu.toLocaleString()} ms`
                                        },
                                        {
                                            title: 'IO Reads',
                                            dataIndex: 'IOReads',
                                            key: 'IOReads',
                                            width: 100,
                                            sorter: (a: any, b: any) => a.IOReads - b.IOReads,
                                            render: (reads: number) => reads.toLocaleString()
                                        },
                                        {
                                            title: 'IO Writes',
                                            dataIndex: 'IOWrites',
                                            key: 'IOWrites',
                                            width: 100,
                                            sorter: (a: any, b: any) => a.IOWrites - b.IOWrites,
                                            render: (writes: number) => writes.toLocaleString()
                                        },
                                        {
                                            title: 'Login',
                                            dataIndex: 'Login',
                                            key: 'Login',
                                            width: 120,
                                            ellipsis: true
                                        },
                                        {
                                            title: 'Host',
                                            dataIndex: 'Host',
                                            key: 'Host',
                                            width: 120,
                                            ellipsis: true
                                        },
                                        {
                                            title: 'Start Time',
                                            dataIndex: 'StartTime',
                                            key: 'StartTime',
                                            width: 150,
                                            sorter: (a: any, b: any) => new Date(a.StartTime).getTime() - new Date(b.StartTime).getTime(),
                                            render: (time: string) => time ? new Date(time).toLocaleString() : 'N/A'
                                        }
                                    ]}
                                    pagination={{ pageSize: 10 }}
                                    scroll={{ x: 'max-content' }}
                                />
                            )}
                        </div>
                    </div>
                );
            case 'blocking':
                return (
                    <div style={{ marginTop: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <h2 style={{ color: (loading || blockingDataLoading) ? '#cc2927' : 'inherit' }}>
                                Blocking Sessions {(loading || blockingDataLoading) ? '(Loading...)' : ''}
                            </h2>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <Select
                                    value={selectedTimeRange}
                                    onChange={(value) => {
                                        setSelectedTimeRange(value);
                                        if (nodeName) {
                                            fetchBlockingHistoricalData(nodeName, value);
                                        }
                                    }}
                                    style={{ width: 140 }}
                                    disabled={!nodeName}
                                >
                                    <Option value="10m">Last 10 Minutes</Option>
                                    <Option value="15m">Last 15 Minutes</Option>
                                    <Option value="30m">Last 30 Minutes</Option>
                                    <Option value="1h">Last 1 Hour</Option>
                                    <Option value="6h">Last 6 Hours</Option>
                                    <Option value="24h">Last 24 Hours</Option>
                                    <Option value="7d">Last 7 Days</Option>
                                </Select>
                                <Button
                                    type="primary"
                                    onClick={() => {
                                        if (nodeName) {
                                            fetchBlockingInfo(nodeName);
                                            fetchBlockingHistoricalData(nodeName, selectedTimeRange);
                                        }
                                    }}
                                    icon={<ReloadOutlined />}
                                    loading={loading || blockingDataLoading}
                                    disabled={!nodeName}
                                    style={{ background: '#cc2927', fontWeight: 'bold' }}
                                >
                                    Refresh Blocking
                                </Button>
                            </div>
                        </div>

                        {!nodeName && (
                            <Alert
                                message="Please select a node to view blocking information"
                                type="info"
                                showIcon
                                style={{ marginBottom: '16px' }}
                            />
                        )}

                        {nodeName && (loading || blockingDataLoading) && (
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px', border: '1px dashed #d9d9d9', borderRadius: '8px', background: '#fafafa' }}>
                                <div style={{ textAlign: 'center' }}>
                                    <Spin size="large" />
                                    <div style={{ marginTop: '15px', color: '#cc2927', fontWeight: 'bold' }}>
                                        Loading Blocking Information...
                                    </div>
                                </div>
                            </div>
                        )}

                        {nodeName && !loading && !blockingDataLoading && (
                            <>
                                {/* Current Blocking Sessions Table */}
                                {blockingInfo.length === 0 ? (
                                    <Alert
                                        message="No blocking sessions found"
                                        description="Currently there are no blocking sessions in the database."
                                        type="success"
                                        showIcon
                                        style={{ marginBottom: '16px' }}
                                    />
                                ) : (
                                    <div style={{ marginBottom: '16px' }}>
                                        <Card title="Current Blocking Sessions" bordered={false}>
                                            <Table
                                                dataSource={blockingInfo.map((b, idx) => ({ ...b, key: idx }))}
                                                columns={[
                                                    {
                                                        title: 'Blocking Session ID',
                                                        dataIndex: 'blocking_session_id',
                                                        key: 'blocking_session_id'
                                                    },
                                                    {
                                                        title: 'Blocking Program',
                                                        dataIndex: 'blocking_program',
                                                        key: 'blocking_program',
                                                        ellipsis: true
                                                    },
                                                    {
                                                        title: 'Blocking Login',
                                                        dataIndex: 'blocking_login',
                                                        key: 'blocking_login',
                                                        ellipsis: true
                                                    },
                                                    {
                                                        title: 'Blocked Session ID',
                                                        dataIndex: 'blocked_session_id',
                                                        key: 'blocked_session_id'
                                                    },
                                                    {
                                                        title: 'Blocked Program',
                                                        dataIndex: 'blocked_program',
                                                        key: 'blocked_program',
                                                        ellipsis: true
                                                    },
                                                    {
                                                        title: 'Blocked Login',
                                                        dataIndex: 'blocked_login',
                                                        key: 'blocked_login',
                                                        ellipsis: true
                                                    },
                                                    {
                                                        title: 'Wait Type',
                                                        dataIndex: 'wait_type',
                                                        key: 'wait_type',
                                                        render: (waitType: string) => (
                                                            <Tag color="blue">
                                                                {waitType || 'N/A'}
                                                            </Tag>
                                                        )
                                                    },
                                                    {
                                                        title: 'Wait Time (ms)',
                                                        dataIndex: 'wait_time',
                                                        key: 'wait_time',
                                                        sorter: (a, b) => a.wait_time - b.wait_time,
                                                        defaultSortOrder: 'descend'
                                                    },
                                                    {
                                                        title: 'Actions',
                                                        key: 'actions',
                                                        render: (_, record) => (
                                                            <Space>
                                                                <Button
                                                                    type="link"
                                                                    size="small"
                                                                    onClick={() => {
                                                                        setModalTitle('Blocking Query');
                                                                        setModalContent(record.blocking_query || 'No query available');
                                                                        setModalDatabase(selectedDatabase || 'master');
                                                                        setModalVisible(true);
                                                                    }}
                                                                >
                                                                    View Blocking Query
                                                                </Button>
                                                                <Button
                                                                    type="link"
                                                                    size="small"
                                                                    onClick={() => {
                                                                        setModalTitle('Blocked Query');
                                                                        setModalContent(record.blocked_query || 'No query available');
                                                                        setModalDatabase(selectedDatabase || 'master');
                                                                        setModalVisible(true);
                                                                    }}
                                                                >
                                                                    View Blocked Query
                                                                </Button>
                                                                <Tooltip title={!userData.isLoggedIn ? "Please login first" : !userData.isAdmin ? "Admin access required" : ""}>
                                                                    <Button
                                                                        type="primary"
                                                                        danger
                                                                        size="small"
                                                                        disabled={!userData.isLoggedIn || !userData.isAdmin}
                                                                        onClick={() => {
                                                                            if (!userData.isLoggedIn) {
                                                                                message.warning('Please login first');
                                                                                return;
                                                                            }
                                                                            if (!userData.isAdmin) {
                                                                                message.warning('Admin access required');
                                                                                return;
                                                                            }
                                                                            Modal.confirm({
                                                                                title: 'Kill Blocking Session',
                                                                                content: `Are you sure you want to kill session ID ${record.blocking_session_id}? This will terminate the blocking query.`,
                                                                                okText: 'Yes, Kill Session',
                                                                                okType: 'danger',
                                                                                cancelText: 'Cancel',
                                                                                onOk: () => {
                                                                                    killBlockingSession(nodeName, record.blocking_session_id);
                                                                                }
                                                                            });
                                                                        }}
                                                                    >
                                                                        Kill Blocking Session
                                                                    </Button>
                                                                </Tooltip>

                                                            </Space>
                                                        )
                                                    }
                                                ]}
                                                pagination={{ pageSize: 10 }}
                                                scroll={{ x: 'max-content' }}
                                            />
                                        </Card>
                                    </div>
                                )}

                                {/* Historical Chart */}
                                <Row gutter={16}>
                                    <Col span={24}>
                                        <Card
                                            title={
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <LineChartOutlined style={{ color: '#ff4d4f' }} />
                                                        <span>Blocking Sessions History</span>
                                                    </div>
                                                    <Button
                                                        type="text"
                                                        size="small"
                                                        icon={<ReloadOutlined />}
                                                        onClick={() => {
                                                            if (nodeName) {
                                                                fetchBlockingHistoricalData(nodeName, selectedTimeRange);
                                                            }
                                                        }}
                                                        loading={blockingDataLoading}
                                                        disabled={!nodeName}
                                                        style={{
                                                            color: '#ff4d4f',
                                                            border: 'none',
                                                            boxShadow: 'none'
                                                        }}
                                                        title="Refresh Blocking data"
                                                    />
                                                </div>
                                            }
                                            hoverable
                                            style={{ height: '400px' }}
                                        >
                                            {blockingDataLoading ? (
                                                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
                                                    <Spin size="large" />
                                                </div>
                                            ) : blockingHistoricalData.length > 0 ? (
                                                <ResponsiveContainer width="100%" height={300}>
                                                    <AreaChart data={blockingHistoricalData}>
                                                        <CartesianGrid strokeDasharray="3 3" />
                                                        <XAxis
                                                            dataKey="time"
                                                            tick={{ fontSize: 12 }}
                                                            interval="preserveStartEnd"
                                                        />
                                                        <YAxis
                                                            tick={{ fontSize: 12 }}
                                                            label={{ value: 'Blocking Sessions', angle: -90, position: 'insideLeft' }}
                                                        />
                                                        <RechartsTooltip
                                                            formatter={(value: any) => [`${value}`, 'Blocking Sessions']}
                                                            labelFormatter={(label) => `Time: ${label}`}
                                                        />
                                                        <Area
                                                            type="monotone"
                                                            dataKey="blocking_sessions"
                                                            stroke="#ff4d4f"
                                                            fill="#ff4d4f"
                                                            fillOpacity={0.3}
                                                        />
                                                    </AreaChart>
                                                </ResponsiveContainer>
                                            ) : (
                                                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px', flexDirection: 'column' }}>
                                                    <LineChartOutlined style={{ fontSize: '48px', color: '#d9d9d9', marginBottom: '16px' }} />
                                                    <Text type="secondary">No blocking sessions historical data available</Text>
                                                </div>
                                            )}
                                        </Card>
                                    </Col>
                                </Row>
                            </>
                        )}
                    </div>
                );
            case 'wait-stats':
                return (
                    <div style={{ marginTop: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <h2 style={{ color: (loading || waitStatsDataLoading) ? '#cc2927' : 'inherit' }}>
                                Wait Statistics {(loading || waitStatsDataLoading) ? '(Loading...)' : ''}
                            </h2>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <Select
                                    value={selectedTimeRange}
                                    onChange={(value) => {
                                        setSelectedTimeRange(value);
                                        if (nodeName) {
                                            fetchWaitStatsHistoricalData(nodeName, value);
                                        }
                                    }}
                                    style={{ width: 140 }}
                                    disabled={!nodeName}
                                >
                                    <Option value="10m">Last 10 Minutes</Option>
                                    <Option value="15m">Last 15 Minutes</Option>
                                    <Option value="30m">Last 30 Minutes</Option>
                                    <Option value="1h">Last 1 Hour</Option>
                                    <Option value="6h">Last 6 Hours</Option>
                                    <Option value="24h">Last 24 Hours</Option>
                                    <Option value="7d">Last 7 Days</Option>
                                </Select>
                                <Button
                                    type="primary"
                                    onClick={() => {
                                        if (nodeName) {
                                            fetchWaitStats(nodeName);
                                            fetchWaitStatsHistoricalData(nodeName, selectedTimeRange);
                                        }
                                    }}
                                    icon={<ReloadOutlined />}
                                    loading={loading || waitStatsDataLoading}
                                    disabled={!nodeName}
                                    style={{ background: '#cc2927', fontWeight: 'bold' }}
                                >
                                    Refresh Wait Stats
                                </Button>
                            </div>
                        </div>

                        {!nodeName && (
                            <Alert
                                message="Please select a node to view wait statistics"
                                type="info"
                                showIcon
                                style={{ marginBottom: '16px' }}
                            />
                        )}

                        {nodeName && (loading || waitStatsDataLoading) && (
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px', border: '1px dashed #d9d9d9', borderRadius: '8px', background: '#fafafa' }}>
                                <div style={{ textAlign: 'center' }}>
                                    <Spin size="large" />
                                    <div style={{ marginTop: '15px', color: '#cc2927', fontWeight: 'bold' }}>
                                        Loading Wait Statistics...
                                    </div>
                                </div>
                            </div>
                        )}

                        {nodeName && !loading && !waitStatsDataLoading && (
                            <>
                                {/* Current Wait Statistics Table */}
                                {waitStats.length === 0 ? (
                                    <Alert
                                        message="No wait statistics found"
                                        description="No significant wait types were found in the system."
                                        type="info"
                                        showIcon
                                        style={{ marginBottom: '16px' }}
                                    />
                                ) : (
                                    <div style={{ marginBottom: '16px' }}>
                                        <Card title="Current Wait Statistics" bordered={false}>
                                            <Table
                                                dataSource={waitStats.map((w, idx) => ({ ...w, key: idx }))}
                                                columns={[
                                                    {
                                                        title: 'Wait Type',
                                                        dataIndex: 'wait_type',
                                                        key: 'wait_type',
                                                        render: (waitType: string) => (
                                                            <Tag color="blue">
                                                                {waitType}
                                                            </Tag>
                                                        )
                                                    },
                                                    {
                                                        title: 'Waiting Tasks Count',
                                                        dataIndex: 'waiting_tasks_count',
                                                        key: 'waiting_tasks_count',
                                                        sorter: (a, b) => a.waiting_tasks_count - b.waiting_tasks_count,
                                                        render: (count: number) => count.toLocaleString()
                                                    },
                                                    {
                                                        title: 'Wait Time (ms)',
                                                        dataIndex: 'wait_time_ms',
                                                        key: 'wait_time_ms',
                                                        sorter: (a, b) => a.wait_time_ms - b.wait_time_ms,
                                                        defaultSortOrder: 'descend',
                                                        render: (time: number) => (
                                                            <span style={{
                                                                color: time > 100000 ? '#ff4d4f' :
                                                                    time > 10000 ? '#faad14' :
                                                                        '#52c41a'
                                                            }}>
                                                                {time.toLocaleString()}
                                                            </span>
                                                        )
                                                    },
                                                    {
                                                        title: 'Max Wait Time (ms)',
                                                        dataIndex: 'max_wait_time_ms',
                                                        key: 'max_wait_time_ms',
                                                        sorter: (a, b) => a.max_wait_time_ms - b.max_wait_time_ms,
                                                        render: (time: number) => time.toLocaleString()
                                                    },
                                                    {
                                                        title: 'Signal Wait Time (ms)',
                                                        dataIndex: 'signal_wait_time_ms',
                                                        key: 'signal_wait_time_ms',
                                                        sorter: (a, b) => a.signal_wait_time_ms - b.signal_wait_time_ms,
                                                        render: (time: number) => time.toLocaleString()
                                                    },
                                                    {
                                                        title: 'Wait/Signal Ratio',
                                                        key: 'wait_signal_ratio',
                                                        render: (_, record) => {
                                                            const ratio = record.signal_wait_time_ms > 0
                                                                ? ((record.wait_time_ms - record.signal_wait_time_ms) / record.signal_wait_time_ms).toFixed(2)
                                                                : 'N/A';
                                                            return ratio;
                                                        },
                                                        sorter: (a, b) => {
                                                            const ratioA = a.signal_wait_time_ms > 0
                                                                ? (a.wait_time_ms - a.signal_wait_time_ms) / a.signal_wait_time_ms
                                                                : 0;
                                                            const ratioB = b.signal_wait_time_ms > 0
                                                                ? (b.wait_time_ms - b.signal_wait_time_ms) / b.signal_wait_time_ms
                                                                : 0;
                                                            return ratioA - ratioB;
                                                        }
                                                    }
                                                ]}
                                                pagination={{ pageSize: 10 }}
                                                scroll={{ x: 'max-content' }}
                                            />
                                        </Card>
                                    </div>
                                )}

                                {/* Historical Chart */}
                                <Row gutter={16}>
                                    <Col span={24}>
                                        <Card
                                            title={
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <LineChartOutlined style={{ color: '#722ed1' }} />
                                                        <span>Wait Statistics History (Top 5 Wait Types)</span>
                                                    </div>
                                                    <Button
                                                        type="text"
                                                        size="small"
                                                        icon={<ReloadOutlined />}
                                                        onClick={() => {
                                                            if (nodeName) {
                                                                fetchWaitStatsHistoricalData(nodeName, selectedTimeRange);
                                                            }
                                                        }}
                                                        loading={waitStatsDataLoading}
                                                        disabled={!nodeName}
                                                        style={{
                                                            color: '#722ed1',
                                                            border: 'none',
                                                            boxShadow: 'none'
                                                        }}
                                                        title="Refresh Wait Statistics data"
                                                    />
                                                </div>
                                            }
                                            hoverable
                                            style={{ height: '400px' }}
                                        >
                                            {waitStatsDataLoading ? (
                                                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
                                                    <Spin size="large" />
                                                </div>
                                            ) : waitStatsHistoricalData.length > 0 ? (
                                                <ResponsiveContainer width="100%" height={300}>
                                                    <LineChart data={waitStatsHistoricalData}>
                                                        <CartesianGrid strokeDasharray="3 3" />
                                                        <XAxis
                                                            dataKey="time"
                                                            tick={{ fontSize: 12 }}
                                                            interval="preserveStartEnd"
                                                        />
                                                        <YAxis
                                                            tick={{ fontSize: 12 }}
                                                            label={{ value: 'Wait Time (ms)', angle: -90, position: 'insideLeft' }}
                                                            tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`}
                                                        />
                                                        <RechartsTooltip
                                                            formatter={(value: any, name: string) => {
                                                                return [`${(value / 1000000).toFixed(2)}M ms`, name];
                                                            }}
                                                            labelFormatter={(label) => `Time: ${label}`}
                                                        />
                                                        {/* Show top 5 wait types */}
                                                        {waitStatsHistoricalData.length > 0 && waitStatsHistoricalData[0].wait_time_ms &&
                                                            Object.keys(waitStatsHistoricalData[0].wait_time_ms)
                                                                .slice(0, 5)
                                                                .map((waitType, index) => {
                                                                    const colors = ['#722ed1', '#1890ff', '#52c41a', '#faad14', '#ff4d4f'];
                                                                    return (
                                                                        <Line
                                                                            key={waitType}
                                                                            type="monotone"
                                                                            dataKey={`wait_time_ms.${waitType}`}
                                                                            stroke={colors[index]}
                                                                            strokeWidth={2}
                                                                            dot={false}
                                                                            name={waitType}
                                                                        />
                                                                    );
                                                                })
                                                        }
                                                    </LineChart>
                                                </ResponsiveContainer>
                                            ) : (
                                                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px', flexDirection: 'column' }}>
                                                    <LineChartOutlined style={{ fontSize: '48px', color: '#d9d9d9', marginBottom: '16px' }} />
                                                    <Text type="secondary">No wait statistics historical data available</Text>
                                                </div>
                                            )}
                                        </Card>
                                    </Col>
                                </Row>
                            </>
                        )}
                    </div>
                );
            default:
                return (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px', flexDirection: 'column' }}>
                        <InfoCircleOutlined style={{ fontSize: '48px', color: '#cc2927', marginBottom: '16px' }} />
                        <Text type="secondary">Please select a submenu item from the left sidebar</Text>
                    </div>
                );
        }
    };

    const renderDatabaseTab = () => {
        if (!nodeName) {
            return (
                <Alert
                    message="No server node selected"
                    description="Please select a server node first"
                    type="info"
                    showIcon
                    style={{ marginTop: 16 }}
                />
            );
        }

        if (!selectedDatabase) {
            return (
                <Alert
                    message="No database selected"
                    description="Please select a database to view details"
                    type="info"
                    showIcon
                    style={{ marginTop: 16 }}
                />
            );
        }

        switch (selectedSubMenu) {
            case 'index-usage':
                return (
                    <div>
                        <div id="index-usage-container" style={{ marginTop: 10 }}>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '15px'
                            }}>
                                <h2 style={{ marginBottom: 0 }}>
                                    Index Usage for Database: <Tag color="#cc2927">{selectedDatabase}</Tag>
                                </h2>
                                <div>
                                    <Button
                                        type="primary"
                                        onClick={() => {
                                            if (nodeName && selectedDatabase) {
                                                // React Query'nin refetch fonksiyonunu kullan
                                                queryClient.invalidateQueries({
                                                    queryKey: ['index-usage', nodeName, selectedDatabase]
                                                });
                                            }
                                        }}
                                        icon={<ReloadOutlined />}
                                        loading={indexUsageQuery.isLoading}
                                        disabled={!nodeName || !selectedDatabase}
                                        style={{ background: '#cc2927', fontWeight: 'bold' }}
                                    >
                                        Refresh
                                    </Button>
                                </div>
                            </div>

                            {indexUsageQuery.isLoading && (
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    height: '300px'
                                }}>
                                    <Spin size="large" />
                                    <span style={{ marginLeft: '12px' }}>Loading index usage information...</span>
                                </div>
                            )}

                            {!indexUsageQuery.isLoading && indexUsageQuery.data?.length === 0 && (
                                <Alert
                                    message="No index usage data found"
                                    description="There might be no index usage data available for this database, or the database might not have any indexes."
                                    type="info"
                                    showIcon
                                    style={{ marginBottom: '16px' }}
                                />
                            )}

                            {!indexUsageQuery.isLoading && indexUsageQuery.data && indexUsageQuery.data.length > 0 && (
                                <Table
                                    dataSource={indexUsageQuery.data.map((idx, i) => ({ ...idx, key: i }))}
                                    columns={[
                                        {
                                            title: 'Schema',
                                            dataIndex: 'schema_name',
                                            key: 'schema_name',
                                            sorter: (a, b) => a.schema_name.localeCompare(b.schema_name),
                                            width: 100
                                        },
                                        {
                                            title: 'Table',
                                            dataIndex: 'table_name',
                                            key: 'table_name',
                                            sorter: (a, b) => a.table_name.localeCompare(b.table_name),
                                            width: 150
                                        },
                                        {
                                            title: 'Index',
                                            dataIndex: 'index_name',
                                            key: 'index_name',
                                            sorter: (a, b) => a.index_name.localeCompare(b.index_name),
                                            width: 150,
                                            render: (text, record) => (
                                                <span>
                                                    {text}
                                                    {record.index_id === 1 && (
                                                        <Tag color="blue" style={{ marginLeft: 8 }}>Clustered</Tag>
                                                    )}
                                                </span>
                                            )
                                        },
                                        {
                                            title: 'Seeks',
                                            dataIndex: 'user_seeks',
                                            key: 'user_seeks',
                                            sorter: (a, b) => a.user_seeks - b.user_seeks,
                                            defaultSortOrder: 'descend',
                                            width: 90,
                                            render: value => value.toLocaleString()
                                        },
                                        {
                                            title: 'Scans',
                                            dataIndex: 'user_scans',
                                            key: 'user_scans',
                                            sorter: (a, b) => a.user_scans - b.user_scans,
                                            width: 90,
                                            render: value => value.toLocaleString()
                                        },
                                        {
                                            title: 'Lookups',
                                            dataIndex: 'user_lookups',
                                            key: 'user_lookups',
                                            sorter: (a, b) => a.user_lookups - b.user_lookups,
                                            width: 90,
                                            render: value => value.toLocaleString()
                                        },
                                        {
                                            title: 'Updates',
                                            dataIndex: 'user_updates',
                                            key: 'user_updates',
                                            sorter: (a, b) => a.user_updates - b.user_updates,
                                            width: 90,
                                            render: value => value.toLocaleString()
                                        },
                                        {
                                            title: 'Fragmentation',
                                            dataIndex: 'avg_fragmentation_percent',
                                            key: 'avg_fragmentation_percent',
                                            sorter: (a, b) => a.avg_fragmentation_percent - b.avg_fragmentation_percent,
                                            width: 130,
                                            render: (value) => {
                                                const percent = parseFloat(value.toFixed(2));
                                                let color = 'green';
                                                if (percent > 30) color = 'red';
                                                else if (percent > 10) color = 'orange';

                                                return (
                                                    <Tooltip title={
                                                        percent > 30 ? 'High fragmentation, consider rebuild' :
                                                            percent > 10 ? 'Moderate fragmentation, consider reorganize' :
                                                                'Low fragmentation'
                                                    }>
                                                        <Tag color={color}>{percent}%</Tag>
                                                    </Tooltip>
                                                );
                                            }
                                        },
                                        {
                                            title: 'Page Count',
                                            dataIndex: 'page_count',
                                            key: 'page_count',
                                            sorter: (a, b) => a.page_count - b.page_count,
                                            width: 110,
                                            render: value => value.toLocaleString()
                                        },
                                        {
                                            title: 'Last Used',
                                            key: 'last_used',
                                            width: 150,
                                            render: (_, record) => {
                                                // Find the most recent usage time
                                                const times = [
                                                    { type: 'Seek', time: record.last_user_seek },
                                                    { type: 'Scan', time: record.last_user_scan },
                                                    { type: 'Lookup', time: record.last_user_lookup }
                                                ].filter(t => t.time);

                                                // Sort by most recent
                                                times.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

                                                if (times.length === 0) return <span>Never</span>;

                                                return (
                                                    <Tooltip title={`Last ${times[0].type}: ${new Date(times[0].time).toLocaleString()}`}>
                                                        <span>{new Date(times[0].time).toLocaleString()}</span>
                                                    </Tooltip>
                                                );
                                            }
                                        }
                                    ]}
                                    pagination={{
                                        pageSize: 10,
                                        showSizeChanger: true,
                                        pageSizeOptions: ['10', '20', '50', '100']
                                    }}
                                    scroll={{ x: 'max-content' }}
                                />
                            )}
                        </div>
                    </div>
                );
            case 'database-stats':
                return (
                    <div style={{ marginTop: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <h2 style={{ color: databaseDataLoading ? '#cc2927' : 'inherit' }}>
                                Database Metrics: <Tag color="#cc2927">{selectedDatabase}</Tag> {databaseDataLoading ? '(Loading...)' : ''}
                            </h2>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <Select
                                    value={selectedTimeRange}
                                    onChange={(value) => {
                                        setSelectedTimeRange(value);
                                        if (nodeName && selectedDatabase) {
                                            fetchDatabaseHistoricalData(nodeName, selectedDatabase, value);
                                        }
                                    }}
                                    style={{ width: 140 }}
                                    disabled={!nodeName || !selectedDatabase}
                                >
                                    <Option value="10m">Last 10 Minutes</Option>
                                    <Option value="15m">Last 15 Minutes</Option>
                                    <Option value="30m">Last 30 Minutes</Option>
                                    <Option value="1h">Last 1 Hour</Option>
                                    <Option value="6h">Last 6 Hours</Option>
                                    <Option value="24h">Last 24 Hours</Option>
                                    <Option value="7d">Last 7 Days</Option>
                                </Select>
                                <Button
                                    type="primary"
                                    onClick={() => {
                                        if (nodeName && selectedDatabase) {
                                            fetchDatabaseHistoricalData(nodeName, selectedDatabase, selectedTimeRange);
                                        }
                                    }}
                                    icon={<ReloadOutlined />}
                                    loading={databaseDataLoading}
                                    disabled={!nodeName || !selectedDatabase || databaseDataLoading}
                                    style={{ background: '#cc2927', fontWeight: 'bold' }}
                                >
                                    Refresh Database
                                </Button>
                            </div>
                        </div>

                        {!nodeName && (
                            <Alert
                                message="Please select a node to view database metrics"
                                type="info"
                                showIcon
                                style={{ marginBottom: '16px' }}
                            />
                        )}

                        {!selectedDatabase && nodeName && (
                            <Alert
                                message="Please select a database to view metrics"
                                type="info"
                                showIcon
                                style={{ marginBottom: '16px' }}
                            />
                        )}

                        {nodeName && selectedDatabase && databaseDataLoading && (
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px', border: '1px dashed #d9d9d9', borderRadius: '8px', background: '#fafafa' }}>
                                <div style={{ textAlign: 'center' }}>
                                    <Spin size="large" />
                                    <div style={{ marginTop: '15px', color: '#cc2927', fontWeight: 'bold' }}>
                                        Loading Database Metrics...
                                    </div>
                                </div>
                            </div>
                        )}

                        {nodeName && selectedDatabase && !databaseDataLoading && !dbStats?.length && (
                            <Alert
                                message="No database data available"
                                description="The server didn't return any database data. Please try refreshing."
                                type="warning"
                                showIcon
                                style={{ marginBottom: '16px' }}
                            />
                        )}

                        {nodeName && selectedDatabase && !databaseDataLoading && dbStats && dbStats.length > 0 && (
                            <>
                                {/* Current Database Summary */}
                                <Row gutter={[16, 16]} style={{ marginBottom: '16px' }}>
                                    <Col span={8}>
                                        <Card title="Data Size" bordered={false} hoverable>
                                            <div style={{ textAlign: 'center' }}>
                                                <Statistic
                                                    value={formatMB(dbStats[0].data_size_mb).replace(/ (MB|GB|TB)$/, '')}
                                                    suffix={formatMB(dbStats[0].data_size_mb).match(/ (MB|GB|TB)$/)?.[1] || 'MB'}
                                                    valueStyle={{ color: '#cc2927', fontSize: '24px' }}
                                                />
                                                <Progress
                                                    percent={Math.round((dbStats[0].data_size_mb / dbStats[0].total_size_mb) * 100)}
                                                    strokeColor="#cc2927"
                                                    size="small"
                                                    showInfo={false}
                                                    style={{ marginTop: 8 }}
                                                />
                                            </div>
                                        </Card>
                                    </Col>
                                    <Col span={8}>
                                        <Card title="Log Size" bordered={false} hoverable>
                                            <div style={{ textAlign: 'center' }}>
                                                <Statistic
                                                    value={formatMB(dbStats[0].log_size_mb).replace(/ (MB|GB|TB)$/, '')}
                                                    suffix={formatMB(dbStats[0].log_size_mb).match(/ (MB|GB|TB)$/)?.[1] || 'MB'}
                                                    valueStyle={{ color: '#1890ff', fontSize: '24px' }}
                                                />
                                                <Progress
                                                    percent={Math.round((dbStats[0].log_size_mb / dbStats[0].total_size_mb) * 100)}
                                                    strokeColor="#1890ff"
                                                    size="small"
                                                    showInfo={false}
                                                    style={{ marginTop: 8 }}
                                                />
                                            </div>
                                        </Card>
                                    </Col>
                                    <Col span={8}>
                                        <Card title="Total Size" bordered={false} hoverable>
                                            <div style={{ textAlign: 'center' }}>
                                                <Statistic
                                                    value={dbStats[0].total_size_mb.toFixed(2)}
                                                    suffix="MB"
                                                    valueStyle={{ color: '#52c41a', fontSize: '24px' }}
                                                />
                                            </div>
                                        </Card>
                                    </Col>
                                </Row>

                                {/* Historical Chart */}
                                <Row gutter={16}>
                                    <Col span={24}>
                                        <Card
                                            title={
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <LineChartOutlined style={{ color: '#cc2927' }} />
                                                        <span>Database Size History</span>
                                                    </div>
                                                    <Button
                                                        type="text"
                                                        size="small"
                                                        icon={<ReloadOutlined />}
                                                        onClick={() => {
                                                            if (nodeName && selectedDatabase) {
                                                                fetchDatabaseHistoricalData(nodeName, selectedDatabase, selectedTimeRange);
                                                            }
                                                        }}
                                                        loading={databaseDataLoading}
                                                        disabled={!nodeName || !selectedDatabase}
                                                        style={{
                                                            color: '#cc2927',
                                                            border: 'none',
                                                            boxShadow: 'none'
                                                        }}
                                                        title="Refresh Database data"
                                                    />
                                                </div>
                                            }
                                            hoverable
                                            style={{ height: '400px' }}
                                        >
                                            {databaseDataLoading ? (
                                                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
                                                    <Spin size="large" />
                                                </div>
                                            ) : databaseHistoricalData.length > 0 ? (
                                                <ResponsiveContainer width="100%" height={300}>
                                                    <AreaChart data={databaseHistoricalData}>
                                                        <CartesianGrid strokeDasharray="3 3" />
                                                        <XAxis
                                                            dataKey="time"
                                                            tick={{ fontSize: 12 }}
                                                            interval="preserveStartEnd"
                                                        />
                                                        <YAxis
                                                            tick={{ fontSize: 12 }}
                                                            label={{ value: 'Size', angle: -90, position: 'insideLeft' }}
                                                            tickFormatter={(value) => formatMB(value / (1024 * 1024))}
                                                        />
                                                        <RechartsTooltip
                                                            formatter={(value: any, name: string) => {
                                                                const displayName = name === 'data_size' ? 'Data Size' :
                                                                    name === 'log_size' ? 'Log Size' :
                                                                        name === 'total_size' ? 'Total Size' : name;
                                                                return [formatMB(value / (1024 * 1024)), displayName];
                                                            }}
                                                            labelFormatter={(label) => `Time: ${label}`}
                                                        />
                                                        <Area
                                                            type="monotone"
                                                            dataKey="data_size"
                                                            stackId="1"
                                                            stroke="#cc2927"
                                                            fill="#cc2927"
                                                            fillOpacity={0.6}
                                                        />
                                                        <Area
                                                            type="monotone"
                                                            dataKey="log_size"
                                                            stackId="1"
                                                            stroke="#1890ff"
                                                            fill="#1890ff"
                                                            fillOpacity={0.6}
                                                        />
                                                    </AreaChart>
                                                </ResponsiveContainer>
                                            ) : (
                                                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px', flexDirection: 'column' }}>
                                                    <LineChartOutlined style={{ fontSize: '48px', color: '#d9d9d9', marginBottom: '16px' }} />
                                                    <Text type="secondary">No database historical data available</Text>
                                                </div>
                                            )}
                                        </Card>
                                    </Col>
                                </Row>
                            </>
                        )}
                    </div>
                );
            case 'backup-status':
                return (
                    <div style={{ marginTop: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <h2 style={{ marginBottom: 0 }}>
                                Backup Status
                            </h2>
                            <div>
                                <Button
                                    type="primary"
                                    onClick={() => {
                                        if (nodeName) {
                                            fetchBackupStatus(nodeName);
                                        }
                                    }}
                                    icon={<ReloadOutlined />}
                                    loading={loading}
                                    disabled={!nodeName}
                                    style={{ background: '#cc2927', fontWeight: 'bold' }}
                                >
                                    Refresh
                                </Button>
                            </div>
                        </div>

                        {!nodeName && (
                            <Alert
                                message="Please select a node to view backup status"
                                type="info"
                                showIcon
                                style={{ marginBottom: '16px' }}
                            />
                        )}

                        {nodeName && loading && (
                            <div style={{
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                height: '300px'
                            }}>
                                <Spin size="large" />
                                <span style={{ marginLeft: '12px' }}>Loading backup status...</span>
                            </div>
                        )}

                        {nodeName && !loading && backupStatus.length === 0 && (
                            <Alert
                                message="No backup data found"
                                description="No backup history found for user databases on this server."
                                type="info"
                                showIcon
                                style={{ marginBottom: '16px' }}
                            />
                        )}

                        {nodeName && !loading && backupStatus.length > 0 && (
                            <Table
                                dataSource={backupStatus.map((backup, idx) => ({ ...backup, key: idx }))}
                                columns={[
                                    {
                                        title: 'Database',
                                        dataIndex: 'database_name',
                                        key: 'database_name',
                                        sorter: (a, b) => a.database_name.localeCompare(b.database_name),
                                        width: 150,
                                        filters: [...new Set(backupStatus.map(item => item.database_name))].map(db => ({
                                            text: db,
                                            value: db,
                                        })),
                                        onFilter: (value, record) => record.database_name === value,
                                        filterSearch: true,
                                        render: (text) => <Tag color="blue">{text}</Tag>
                                    },
                                    {
                                        title: 'Backup Type',
                                        dataIndex: 'backup_type_desc',
                                        key: 'backup_type_desc',
                                        sorter: (a, b) => a.backup_type_desc.localeCompare(b.backup_type_desc),
                                        width: 140,
                                        filters: [
                                            { text: 'Full Database', value: 'Full Database' },
                                            { text: 'Differential', value: 'Differential' },
                                            { text: 'Transaction Log', value: 'Transaction Log' },
                                            { text: 'File or Filegroup', value: 'File or Filegroup' },
                                            { text: 'Differential File', value: 'Differential File' },
                                            { text: 'Partial', value: 'Partial' },
                                            { text: 'Differential Partial', value: 'Differential Partial' },
                                        ],
                                        onFilter: (value, record) => record.backup_type_desc === value,
                                        render: (text, record) => {
                                            let color = 'default';
                                            if (record.backup_type === 'D') color = 'green';
                                            else if (record.backup_type === 'I') color = 'orange';
                                            else if (record.backup_type === 'L') color = 'purple';
                                            return <Tag color={color}>{text}</Tag>;
                                        }
                                    },
                                    {
                                        title: 'Last Backup',
                                        dataIndex: 'backup_finish_date',
                                        key: 'backup_finish_date',
                                        sorter: (a, b) => new Date(b.backup_finish_date).getTime() - new Date(a.backup_finish_date).getTime(),
                                        width: 160,
                                        render: (text) => text === 'Never' ? <Tag color="red">Never</Tag> : text
                                    },
                                    {
                                        title: 'Days Since',
                                        dataIndex: 'days_since_last_backup',
                                        key: 'days_since_last_backup',
                                        sorter: (a, b) => a.days_since_last_backup - b.days_since_last_backup,
                                        width: 100,
                                        render: (days) => {
                                            let color = 'green';
                                            if (days > 7) color = 'red';
                                            else if (days > 3) color = 'orange';
                                            else if (days === 9999) return <Tag color="red">Never</Tag>;
                                            return <Tag color={color}>{days} days</Tag>;
                                        }
                                    },
                                    {
                                        title: 'Size (MB)',
                                        dataIndex: 'backup_size_mb',
                                        key: 'backup_size_mb',
                                        sorter: (a, b) => a.backup_size_mb - b.backup_size_mb,
                                        width: 120,
                                        render: (size) => size > 0 ? size.toLocaleString() : 'N/A'
                                    },
                                    {
                                        title: 'Compressed (MB)',
                                        dataIndex: 'compressed_backup_size_mb',
                                        key: 'compressed_backup_size_mb',
                                        sorter: (a, b) => a.compressed_backup_size_mb - b.compressed_backup_size_mb,
                                        width: 140,
                                        render: (size) => size > 0 ? size.toLocaleString() : 'N/A'
                                    },
                                    {
                                        title: 'Compression %',
                                        dataIndex: 'compression_ratio',
                                        key: 'compression_ratio',
                                        sorter: (a, b) => a.compression_ratio - b.compression_ratio,
                                        width: 120,
                                        render: (ratio) => {
                                            if (ratio > 0) {
                                                let color = 'green';
                                                if (ratio < 20) color = 'orange';
                                                else if (ratio < 50) color = 'blue';
                                                return <Tag color={color}>{ratio.toFixed(1)}%</Tag>;
                                            }
                                            return 'N/A';
                                        }
                                    },
                                    {
                                        title: 'Recovery Model',
                                        dataIndex: 'recovery_model',
                                        key: 'recovery_model',
                                        sorter: (a, b) => a.recovery_model.localeCompare(b.recovery_model),
                                        width: 120,
                                        render: (model) => {
                                            let color = 'default';
                                            if (model === 'FULL') color = 'green';
                                            else if (model === 'SIMPLE') color = 'blue';
                                            else if (model === 'BULK_LOGGED') color = 'orange';
                                            return <Tag color={color}>{model}</Tag>;
                                        }
                                    },
                                    {
                                        title: 'Flags',
                                        key: 'flags',
                                        width: 120,
                                        render: (_, record) => (
                                            <div>
                                                {record.is_copy_only && <Tag color="purple">Copy Only</Tag>}
                                                {record.is_damaged && <Tag color="red">Damaged</Tag>}
                                                {record.has_backup_checksums && <Tag color="green">Checksum</Tag>}
                                            </div>
                                        )
                                    },
                                    {
                                        title: 'Location',
                                        dataIndex: 'backup_location',
                                        key: 'backup_location',
                                        ellipsis: true,
                                        render: (location) => (
                                            <Tooltip title={location}>
                                                <Text style={{ maxWidth: 200 }}>{location}</Text>
                                            </Tooltip>
                                        )
                                    }
                                ]}
                                pagination={{
                                    pageSize: 10,
                                    showSizeChanger: true,
                                    pageSizeOptions: ['10', '20', '50', '100']
                                }}
                                scroll={{ x: 'max-content' }}
                                size="small"
                            />
                        )}
                    </div>
                );
            case 'capacity-planning':
                return (
                    <div style={{ marginTop: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <h2 style={{ color: capacityDataLoading ? '#cc2927' : 'inherit' }}>
                                Capacity Planning: <Tag color="#cc2927">{selectedDatabase}</Tag> {capacityDataLoading ? '(Loading...)' : ''}
                            </h2>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <Button
                                    type="primary"
                                    onClick={() => {
                                        if (nodeName && selectedDatabase) {
                                            fetchCapacityPlanningData(nodeName, selectedDatabase);
                                        }
                                    }}
                                    icon={<ReloadOutlined />}
                                    loading={capacityDataLoading}
                                    disabled={!nodeName || !selectedDatabase || capacityDataLoading}
                                    style={{ background: '#cc2927', fontWeight: 'bold' }}
                                >
                                    Refresh Analysis
                                </Button>
                            </div>
                        </div>

                        {!nodeName && (
                            <Alert
                                message="Please select a node to view capacity planning"
                                type="info"
                                showIcon
                                style={{ marginBottom: '16px' }}
                            />
                        )}

                        {!selectedDatabase && nodeName && (
                            <Alert
                                message="Please select a database to view capacity planning"
                                type="info"
                                showIcon
                                style={{ marginBottom: '16px' }}
                            />
                        )}

                        {nodeName && selectedDatabase && capacityDataLoading && (
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px', border: '1px dashed #d9d9d9', borderRadius: '8px', background: '#fafafa' }}>
                                <div style={{ textAlign: 'center' }}>
                                    <Spin size="large" />
                                    <div style={{ marginTop: '15px', color: '#cc2927', fontWeight: 'bold' }}>
                                        Analyzing Growth Patterns...
                                    </div>
                                    <div style={{ marginTop: '8px', color: '#666', fontSize: '12px' }}>
                                        Calculating predictions based on historical data
                                    </div>
                                </div>
                            </div>
                        )}

                        {nodeName && selectedDatabase && !capacityDataLoading && !capacityAnalysis && (
                            <Alert
                                message="Insufficient historical data"
                                description="At least 7 days of historical data is required for accurate capacity planning analysis. Please try again later or check if the database has sufficient monitoring data."
                                type="warning"
                                showIcon
                                style={{ marginBottom: '16px' }}
                            />
                        )}

                        {nodeName && selectedDatabase && !capacityDataLoading && capacityAnalysis && (
                            <>
                                {/* Growth Analysis Overview */}
                                <Row gutter={[16, 16]} style={{ marginBottom: '16px' }}>
                                    <Col span={24}>
                                        <Alert
                                            message="📊 Database Capacity Planning Analysis"
                                            description={
                                                <div style={{ marginTop: '8px' }}>
                                                    <p><strong>Growth Analysis:</strong> Based on historical data patterns, this analysis provides storage capacity predictions and recommendations.</p>
                                                    <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                                                        <Tag color={capacityAnalysis.trend_analysis.data_trend === 'increasing' ? 'red' : capacityAnalysis.trend_analysis.data_trend === 'decreasing' ? 'green' : 'blue'}>
                                                            Data Trend: {capacityAnalysis.trend_analysis.data_trend.toUpperCase()}
                                                        </Tag>
                                                        <Tag color={capacityAnalysis.trend_analysis.log_trend === 'increasing' ? 'red' : capacityAnalysis.trend_analysis.log_trend === 'decreasing' ? 'green' : 'blue'}>
                                                            Log Trend: {capacityAnalysis.trend_analysis.log_trend.toUpperCase()}
                                                        </Tag>
                                                        <Tag color={capacityAnalysis.trend_analysis.volatility === 'high' ? 'red' : capacityAnalysis.trend_analysis.volatility === 'medium' ? 'orange' : 'green'}>
                                                            Volatility: {capacityAnalysis.trend_analysis.volatility.toUpperCase()}
                                                        </Tag>
                                                    </div>
                                                </div>
                                            }
                                            type="info"
                                            showIcon
                                            closable
                                            style={{ marginBottom: '16px' }}
                                        />
                                    </Col>
                                </Row>

                                {/* Current Status & Growth Rates */}
                                <Row gutter={[16, 16]} style={{ marginBottom: '16px' }}>
                                    <Col span={6}>
                                        <Card title="Current Data Size" bordered={false} hoverable>
                                            <div style={{ textAlign: 'center' }}>
                                                <Statistic
                                                    value={formatMB(capacityAnalysis.current_data_size_mb).replace(/ (MB|GB|TB)$/, '')}
                                                    suffix={formatMB(capacityAnalysis.current_data_size_mb).match(/ (MB|GB|TB)$/)?.[1] || 'MB'}
                                                    valueStyle={{ color: '#cc2927', fontSize: '24px' }}
                                                />
                                                <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                                                    Growth: {capacityAnalysis.daily_growth_data_mb >= 0 ? '+' : ''}{formatGrowthMB(Math.abs(capacityAnalysis.daily_growth_data_mb))}/day
                                                </div>
                                            </div>
                                        </Card>
                                    </Col>
                                    <Col span={6}>
                                        <Card title="Current Log Size" bordered={false} hoverable>
                                            <div style={{ textAlign: 'center' }}>
                                                <Statistic
                                                    value={formatMB(capacityAnalysis.current_log_size_mb).replace(/ (MB|GB|TB)$/, '')}
                                                    suffix={formatMB(capacityAnalysis.current_log_size_mb).match(/ (MB|GB|TB)$/)?.[1] || 'MB'}
                                                    valueStyle={{ color: '#1890ff', fontSize: '24px' }}
                                                />
                                                <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                                                    Growth: {capacityAnalysis.daily_growth_log_mb >= 0 ? '+' : ''}{formatGrowthMB(Math.abs(capacityAnalysis.daily_growth_log_mb))}/day
                                                </div>
                                            </div>
                                        </Card>
                                    </Col>
                                    <Col span={6}>
                                        <Card title="Total Current Size" bordered={false} hoverable>
                                            <div style={{ textAlign: 'center' }}>
                                                <Statistic
                                                    value={capacityAnalysis.current_total_size_mb.toFixed(2)}
                                                    suffix="MB"
                                                    valueStyle={{ color: '#52c41a', fontSize: '24px' }}
                                                />
                                                <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                                                    Growth: {capacityAnalysis.daily_growth_total_mb >= 0 ? '+' : ''}{formatMB(Math.abs(capacityAnalysis.daily_growth_total_mb))}/day
                                                </div>
                                            </div>
                                        </Card>
                                    </Col>
                                    <Col span={6}>
                                        <Card title="Annual Growth Rate" bordered={false} hoverable>
                                            <div style={{ textAlign: 'center' }}>
                                                <Statistic
                                                    value={(capacityAnalysis.daily_growth_total_mb * 365 / capacityAnalysis.current_total_size_mb * 100).toFixed(1)}
                                                    suffix="%"
                                                    valueStyle={{ 
                                                        color: (capacityAnalysis.daily_growth_total_mb * 365 / capacityAnalysis.current_total_size_mb * 100) > 100 ? '#ff4d4f' : '#52c41a',
                                                        fontSize: '24px' 
                                                    }}
                                                />
                                                <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                                                    Yearly size increase
                                                </div>
                                            </div>
                                        </Card>
                                    </Col>
                                </Row>

                                {/* Capacity Predictions Table */}
                                <Row gutter={[16, 16]} style={{ marginBottom: '16px' }}>
                                    <Col span={24}>
                                        <Card
                                            title={
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <LineChartOutlined style={{ color: '#cc2927' }} />
                                                    <span>Size Predictions</span>
                                                </div>
                                            }
                                            bordered={false}
                                        >
                                            <Table
                                                dataSource={capacityAnalysis.predictions.map((pred, idx) => ({ ...pred, key: idx }))}
                                                columns={[
                                                    {
                                                        title: 'Time Period',
                                                        dataIndex: 'period',
                                                        key: 'period',
                                                        render: (period: string) => (
                                                            <Tag color="blue" style={{ fontWeight: 500 }}>
                                                                {period}
                                                            </Tag>
                                                        )
                                                    },
                                                    {
                                                        title: 'Predicted Data Size',
                                                        dataIndex: 'data_size_mb',
                                                        key: 'data_size_mb',
                                                        render: (size: number) => (
                                                            <span style={{ fontWeight: 500 }}>
                                                                {formatMB(size)}
                                                            </span>
                                                        )
                                                    },
                                                    {
                                                        title: 'Predicted Log Size',
                                                        dataIndex: 'log_size_mb',
                                                        key: 'log_size_mb',
                                                        render: (size: number) => (
                                                            <span style={{ fontWeight: 500 }}>
                                                                {formatMB(size)}
                                                            </span>
                                                        )
                                                    },
                                                    {
                                                        title: 'Total Predicted Size',
                                                        dataIndex: 'total_size_mb',
                                                        key: 'total_size_mb',
                                                        render: (size: number) => (
                                                            <span style={{ 
                                                                fontWeight: 500,
                                                                color: size > capacityAnalysis.current_total_size_mb * 2 ? '#ff4d4f' : '#52c41a'
                                                            }}>
                                                                {formatMB(size)}
                                                            </span>
                                                        )
                                                    },
                                                    {
                                                        title: 'Size Increase',
                                                        key: 'size_increase',
                                                        render: (_, record: CapacityPrediction) => {
                                                            const increase = record.total_size_mb - capacityAnalysis.current_total_size_mb;
                                                            const percentage = (increase / capacityAnalysis.current_total_size_mb * 100);
                                                            return (
                                                                <div>
                                                                    <div style={{ fontWeight: 500 }}>
                                                                        +{formatGrowthMB(increase)}
                                                                    </div>
                                                                    <div style={{ fontSize: '12px', color: '#666' }}>
                                                                        ({percentage >= 0 ? '+' : ''}{percentage.toFixed(1)}%)
                                                                    </div>
                                                                </div>
                                                            );
                                                        }
                                                    },
                                                    {
                                                        title: 'Confidence',
                                                        dataIndex: 'confidence_level',
                                                        key: 'confidence_level',
                                                        render: (confidence: string) => (
                                                            <Tag color={
                                                                confidence === 'high' ? 'green' : 
                                                                confidence === 'medium' ? 'orange' : 'red'
                                                            }>
                                                                {confidence.toUpperCase()}
                                                            </Tag>
                                                        )
                                                    }
                                                ]}
                                                pagination={false}
                                                size="small"
                                            />
                                        </Card>
                                    </Col>
                                </Row>

                                {/* Growth Visualization */}
                                <Row gutter={[16, 16]} style={{ marginBottom: '16px' }}>
                                    <Col span={24}>
                                        <Card
                                            title={
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <BarChartOutlined style={{ color: '#1890ff' }} />
                                                    <span>Growth Projection Chart</span>
                                                </div>
                                            }
                                            hoverable
                                            style={{ height: '400px' }}
                                        >
                                            <ResponsiveContainer width="100%" height={300}>
                                                <AreaChart data={[
                                                    {
                                                        period: 'Current',
                                                        data_size: capacityAnalysis.current_data_size_mb,
                                                        log_size: capacityAnalysis.current_log_size_mb,
                                                        total_size: capacityAnalysis.current_total_size_mb
                                                    },
                                                    ...capacityAnalysis.predictions.map(pred => ({
                                                        period: pred.period,
                                                        data_size: pred.data_size_mb,
                                                        log_size: pred.log_size_mb,
                                                        total_size: pred.total_size_mb
                                                    }))
                                                ]}>
                                                    <CartesianGrid strokeDasharray="3 3" />
                                                    <XAxis dataKey="period" />
                                                    <YAxis 
                                                        tickFormatter={(value) => `${(value / 1024).toFixed(1)} GB`}
                                                        label={{ value: 'Size (GB)', angle: -90, position: 'insideLeft' }}
                                                    />
                                                    <RechartsTooltip 
                                                        formatter={(value: any, name: string) => {
                                                            const displayName = name === 'data_size' ? 'Data Size' :
                                                                              name === 'log_size' ? 'Log Size' : 'Total Size';
                                                            return [`${(value / 1024).toFixed(2)} GB`, displayName];
                                                        }}
                                                    />
                                                    <Area
                                                        type="monotone"
                                                        dataKey="data_size"
                                                        stackId="1"
                                                        stroke="#cc2927"
                                                        fill="#cc2927"
                                                        fillOpacity={0.6}
                                                    />
                                                    <Area
                                                        type="monotone"
                                                        dataKey="log_size"
                                                        stackId="1"
                                                        stroke="#1890ff"
                                                        fill="#1890ff"
                                                        fillOpacity={0.6}
                                                    />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </Card>
                                    </Col>
                                </Row>

                                {/* Recommendations */}
                                <Row gutter={[16, 16]}>
                                    <Col span={24}>
                                        <Card
                                            title={
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <InfoCircleOutlined style={{ color: '#1890ff' }} />
                                                    <span>Capacity Planning Recommendations</span>
                                                </div>
                                            }
                                            bordered={false}
                                        >
                                            <List
                                                dataSource={capacityAnalysis.recommendations}
                                                renderItem={(recommendation) => (
                                                    <List.Item style={{ border: 'none', padding: '8px 0' }}>
                                                        <div style={{
                                                            padding: '12px',
                                                            background: '#f6f8fa',
                                                            borderRadius: '6px',
                                                            width: '100%',
                                                            borderLeft: '3px solid #1890ff'
                                                        }}>
                                                            {recommendation}
                                                        </div>
                                                    </List.Item>
                                                )}
                                            />
                                        </Card>
                                    </Col>
                                </Row>
                            </>
                        )}
                    </div>
                );
            default:
                return (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px', flexDirection: 'column' }}>
                        <InfoCircleOutlined style={{ fontSize: '48px', color: '#cc2927', marginBottom: '16px' }} />
                        <Text type="secondary">Please select a submenu item from the left sidebar</Text>
                    </div>
                );
        }
    };

    const renderPerformanceTab = () => {
        return (
            <div style={{ marginTop: 10 }}>
                <div id="performance-container">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <h2 style={{ color: performanceDataLoading ? '#cc2927' : 'inherit' }}>
                            Performance Metrics {performanceDataLoading ? '(Loading...)' : ''}
                        </h2>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <Select
                                value={selectedTimeRange}
                                onChange={(value) => {
                                    setSelectedTimeRange(value);
                                    if (nodeName) {
                                        if (isAWSRDS) {
                                            fetchAWSMetrics(rdsInstanceId, awsRegion, value);
                                        } else {
                                            fetchPerformanceHistoricalData(nodeName, value);
                                        }
                                    }
                                }}
                                style={{ width: 140 }}
                                disabled={!nodeName}
                            >
                                <Option value="10m">Last 10 Minutes</Option>
                                <Option value="15m">Last 15 Minutes</Option>
                                <Option value="30m">Last 30 Minutes</Option>
                                <Option value="1h">Last 1 Hour</Option>
                                <Option value="6h">Last 6 Hours</Option>
                                <Option value="24h">Last 24 Hours</Option>
                                <Option value="7d">Last 7 Days</Option>
                            </Select>
                            <Button
                                type="primary"
                                onClick={() => {
                                    if (nodeName) {
                                        if (isAWSRDS) {
                                            fetchAWSMetrics(rdsInstanceId, awsRegion, selectedTimeRange);
                                        } else {
                                            fetchPerformanceHistoricalData(nodeName, selectedTimeRange);
                                        }
                                    }
                                }}
                                icon={<ReloadOutlined />}
                                loading={performanceDataLoading || awsMetricsLoading}
                                disabled={!nodeName || performanceDataLoading || awsMetricsLoading}
                                style={{ background: '#cc2927', fontWeight: 'bold' }}
                            >
                                Refresh {isAWSRDS ? 'AWS CloudWatch' : 'Performance'}
                            </Button>
                        </div>
                    </div>

                    {!nodeName && (
                        <Alert
                            message="Please select a node to view performance metrics"
                            type="info"
                            showIcon
                            style={{ marginBottom: '16px' }}
                        />
                    )}

                    {nodeName && (performanceDataLoading || awsMetricsLoading) && (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px', border: '1px dashed #d9d9d9', borderRadius: '8px', background: '#fafafa' }}>
                            <div style={{ textAlign: 'center' }}>
                                <Spin size="large" />
                                <div style={{ marginTop: '15px', color: '#cc2927', fontWeight: 'bold' }}>
                                    Loading {isAWSRDS ? 'AWS CloudWatch' : 'Performance'} Metrics...
                                </div>
                            </div>
                        </div>
                    )}

                    {nodeName && !performanceDataLoading && !awsMetricsLoading && !isAWSRDS && performanceHistoricalData.length === 0 && (
                        <Alert
                            message="No performance metrics data available"
                            description="The server didn't return any performance data. Please try refreshing."
                            type="warning"
                            showIcon
                            style={{ marginBottom: '16px' }}
                        />
                    )}

                    {/* AWS RDS CloudWatch Metrics */}
                    {nodeName && !awsMetricsLoading && isAWSRDS && Object.keys(awsMetrics).length > 0 && (
                        renderAWSCloudWatchCharts()
                    )}

                    {/* Traditional Agent-based Performance Metrics */}
                    {nodeName && !performanceDataLoading && !isAWSRDS && performanceHistoricalData.length > 0 && (
                        <>
                            {/* Performance Metrics Guide */}
                            <Row gutter={[16, 16]} style={{ marginBottom: '16px' }}>
                                <Col span={24}>
                                    <Alert
                                        message="Real-Time SQL Server Performance Metrics"
                                        description={
                                            <div style={{ marginTop: '8px' }}>
                                                <p><strong>📊 Performance Rate Metrics (Per Second):</strong></p>
                                                <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                                                    <li><strong>Batch Requests/sec:</strong> Real-time Transact-SQL command batches processed per second. Higher values indicate increased activity.</li>
                                                    <li><strong>Buffer Cache Hit Ratio:</strong> Percentage of pages found in buffer cache without disk reads. Target: &gt;95% for optimal performance.</li>
                                                    <li><strong>Page Life Expectancy:</strong> Average seconds pages remain in buffer pool. Target: &gt;300s (higher is better).</li>
                                                    <li><strong>Lock Waits/sec:</strong> Lock requests requiring wait time per second. Target: &lt;10/sec for good performance.</li>
                                                </ul>
                                                <p><strong>✅ Now Showing:</strong> Calculated per-second rates from SQL Server performance counters</p>
                                                <p><strong>🎯 Performance Targets:</strong> Buffer Cache Hit Ratio &gt;95%, Page Life Expectancy &gt;300s, Lock Waits &lt;10/sec</p>
                                            </div>
                                        }
                                        type="success"
                                        showIcon
                                        closable
                                        style={{ marginBottom: '16px' }}
                                    />
                                </Col>
                            </Row>

                            {/* Key Performance Indicators */}
                            <Row gutter={[16, 16]} style={{ marginBottom: '16px' }}>
                                <Col span={6}>
                                    <Card 
                                        title={
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span>Batch Requests/sec</span>
                                                <Tooltip title="Number of Transact-SQL command batches received per second. This indicates the level of activity on your SQL Server instance.">
                                                    <InfoCircleOutlined style={{ color: '#1890ff', fontSize: '14px' }} />
                                                </Tooltip>
                                            </div>
                                        } 
                                        bordered={false} 
                                        hoverable
                                    >
                                        <div style={{ textAlign: 'center' }}>
                                            <Statistic
                                                value={performanceHistoricalData[performanceHistoricalData.length - 1]?.batch_requests_per_sec || 0}
                                                precision={0}
                                                valueStyle={{ color: '#cc2927', fontSize: '20px' }}
                                                formatter={(value) => `${Number(value).toLocaleString()}`}
                                            />
                                        </div>
                                    </Card>
                                </Col>
                                <Col span={6}>
                                    <Card 
                                        title={
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span>Buffer Cache Hit Ratio</span>
                                                <Tooltip title="Percentage of pages found in the buffer cache without reading from disk. Higher is better. Target: >95%">
                                                    <InfoCircleOutlined style={{ color: '#1890ff', fontSize: '14px' }} />
                                                </Tooltip>
                                            </div>
                                        } 
                                        bordered={false} 
                                        hoverable
                                    >
                                        <div style={{ textAlign: 'center' }}>
                                            <Progress
                                                type="circle"
                                                size={80}
                                                percent={Math.min(100, Math.max(0, Math.round((performanceHistoricalData[performanceHistoricalData.length - 1]?.buffer_cache_hit_ratio || 0))))}
                                                strokeColor={(performanceHistoricalData[performanceHistoricalData.length - 1]?.buffer_cache_hit_ratio || 0) > 95 ? '#52c41a' : '#faad14'}
                                                format={(percent) => `${percent}%`}
                                            />
                                        </div>
                                    </Card>
                                </Col>
                                <Col span={6}>
                                    <Card 
                                        title={
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span>Page Life Expectancy</span>
                                                <Tooltip title="Average number of seconds a page stays in the buffer pool. Higher values indicate better memory utilization. Target: >300 seconds">
                                                    <InfoCircleOutlined style={{ color: '#1890ff', fontSize: '14px' }} />
                                                </Tooltip>
                                            </div>
                                        } 
                                        bordered={false} 
                                        hoverable
                                    >
                                        <div style={{ textAlign: 'center' }}>
                                            <Statistic
                                                value={performanceHistoricalData[performanceHistoricalData.length - 1]?.page_life_expectancy || 0}
                                                suffix="sec"
                                                valueStyle={{ 
                                                    color: (performanceHistoricalData[performanceHistoricalData.length - 1]?.page_life_expectancy || 0) > 300 ? '#52c41a' : '#faad14',
                                                    fontSize: '20px' 
                                                }}
                                                formatter={(value) => `${Number(value).toLocaleString()}`}
                                            />
                                        </div>
                                    </Card>
                                </Col>
                                <Col span={6}>
                                    <Card 
                                        title={
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span>Lock Waits/sec</span>
                                                <Tooltip title="Number of lock requests that cannot be satisfied immediately and must wait. Lower values are better. Target: <100/sec">
                                                    <InfoCircleOutlined style={{ color: '#1890ff', fontSize: '14px' }} />
                                                </Tooltip>
                                            </div>
                                        } 
                                        bordered={false} 
                                        hoverable
                                    >
                                        <div style={{ textAlign: 'center' }}>
                                            <Statistic
                                                value={performanceHistoricalData[performanceHistoricalData.length - 1]?.lock_waits_per_sec || 0}
                                                precision={1}
                                                valueStyle={{ 
                                                    color: (performanceHistoricalData[performanceHistoricalData.length - 1]?.lock_waits_per_sec || 0) > 1000 ? '#ff4d4f' : '#52c41a',
                                                    fontSize: '20px' 
                                                }}
                                                formatter={(value) => `${Number(value).toLocaleString()}`}
                                            />
                                        </div>
                                    </Card>
                                </Col>
                            </Row>

                            {/* Performance Charts */}
                            <Row gutter={[16, 16]}>
                                <Col span={12}>
                                    <Card
                                        title={
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <LineChartOutlined style={{ color: '#cc2927' }} />
                                                <span>Batch Requests & Compilations</span>
                                            </div>
                                        }
                                        hoverable
                                        style={{ height: '400px' }}
                                    >
                                        <ResponsiveContainer width="100%" height={300}>
                                            <LineChart data={performanceHistoricalData}>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis
                                                    dataKey="time"
                                                    tick={{ fontSize: 12 }}
                                                    interval="preserveStartEnd"
                                                />
                                                <YAxis
                                                    tick={{ fontSize: 12 }}
                                                    tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value.toString()}
                                                />
                                                <RechartsTooltip
                                                    formatter={(value: any, name: string) => [
                                                        `${Number(value).toFixed(1)}`,
                                                        name === 'batch_requests_per_sec' ? 'Batch Requests/sec' : 'Compilations/sec'
                                                    ]}
                                                    labelFormatter={(label) => `Time: ${label}`}
                                                />
                                                <Line
                                                    type="monotone"
                                                    dataKey="batch_requests_per_sec"
                                                    stroke="#cc2927"
                                                    strokeWidth={2}
                                                    dot={false}
                                                />
                                                <Line
                                                    type="monotone"
                                                    dataKey="compilations_per_sec"
                                                    stroke="#1890ff"
                                                    strokeWidth={2}
                                                    dot={false}
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card
                                        title={
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <LineChartOutlined style={{ color: '#52c41a' }} />
                                                <span>Page I/O Operations</span>
                                            </div>
                                        }
                                        hoverable
                                        style={{ height: '400px' }}
                                    >
                                        <ResponsiveContainer width="100%" height={300}>
                                            <LineChart data={performanceHistoricalData}>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis
                                                    dataKey="time"
                                                    tick={{ fontSize: 12 }}
                                                    interval="preserveStartEnd"
                                                />
                                                <YAxis
                                                    tick={{ fontSize: 12 }}
                                                    tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value.toString()}
                                                />
                                                <RechartsTooltip
                                                    formatter={(value: any, name: string) => [
                                                        `${Number(value).toFixed(1)}`,
                                                        name === 'page_reads_per_sec' ? 'Page Reads/sec' : 'Page Writes/sec'
                                                    ]}
                                                    labelFormatter={(label) => `Time: ${label}`}
                                                />
                                                <Line
                                                    type="monotone"
                                                    dataKey="page_reads_per_sec"
                                                    stroke="#52c41a"
                                                    strokeWidth={2}
                                                    dot={false}
                                                />
                                                <Line
                                                    type="monotone"
                                                    dataKey="page_writes_per_sec"
                                                    stroke="#faad14"
                                                    strokeWidth={2}
                                                    dot={false}
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </Card>
                                </Col>
                            </Row>

                            <Row gutter={[16, 16]} style={{ marginTop: '16px' }}>
                                <Col span={12}>
                                    <Card
                                        title={
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <LineChartOutlined style={{ color: '#722ed1' }} />
                                                <span>Locking Metrics</span>
                                            </div>
                                        }
                                        hoverable
                                        style={{ height: '400px' }}
                                    >
                                        <ResponsiveContainer width="100%" height={300}>
                                            <LineChart data={performanceHistoricalData}>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis
                                                    dataKey="time"
                                                    tick={{ fontSize: 12 }}
                                                    interval="preserveStartEnd"
                                                />
                                                <YAxis
                                                    tick={{ fontSize: 12 }}
                                                    tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value.toString()}
                                                />
                                                <RechartsTooltip
                                                    formatter={(value: any, name: string) => {
                                                        const displayName = name === 'lock_waits_per_sec' ? 'Lock Waits/sec' :
                                                                          name === 'lock_timeouts_per_sec' ? 'Lock Timeouts/sec' : 'Lock Requests/sec';
                                                        return [`${Number(value).toFixed(1)}`, displayName];
                                                    }}
                                                    labelFormatter={(label) => `Time: ${label}`}
                                                />
                                                <Line
                                                    type="monotone"
                                                    dataKey="lock_waits_per_sec"
                                                    stroke="#722ed1"
                                                    strokeWidth={2}
                                                    dot={false}
                                                />
                                                <Line
                                                    type="monotone"
                                                    dataKey="lock_timeouts_per_sec"
                                                    stroke="#ff4d4f"
                                                    strokeWidth={2}
                                                    dot={false}
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card
                                        title={
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <LineChartOutlined style={{ color: '#1890ff' }} />
                                                <span>Memory & Buffer Pool</span>
                                            </div>
                                        }
                                        hoverable
                                        style={{ height: '400px' }}
                                    >
                                        <ResponsiveContainer width="100%" height={300}>
                                            <LineChart data={performanceHistoricalData}>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis
                                                    dataKey="time"
                                                    tick={{ fontSize: 12 }}
                                                    interval="preserveStartEnd"
                                                />
                                                <YAxis
                                                    yAxisId="left"
                                                    tick={{ fontSize: 12 }}
                                                    label={{ value: 'Buffer Cache Hit Ratio', angle: -90, position: 'insideLeft' }}
                                                    tickFormatter={(value) => `${value.toFixed(0)}%`}
                                                />
                                                <YAxis
                                                    yAxisId="right"
                                                    orientation="right"
                                                    tick={{ fontSize: 12 }}
                                                    label={{ value: 'Page Life Expectancy (sec)', angle: 90, position: 'insideRight' }}
                                                />
                                                <RechartsTooltip
                                                    formatter={(value: any, name: string) => {
                                                        if (name === 'buffer_cache_hit_ratio') {
                                                            return [`${value.toFixed(2)}%`, 'Buffer Cache Hit Ratio'];
                                                        } else {
                                                            return [`${value} sec`, 'Page Life Expectancy'];
                                                        }
                                                    }}
                                                    labelFormatter={(label) => `Time: ${label}`}
                                                />
                                                <Line
                                                    yAxisId="left"
                                                    type="monotone"
                                                    dataKey="buffer_cache_hit_ratio"
                                                    stroke="#1890ff"
                                                    strokeWidth={2}
                                                    dot={false}
                                                />
                                                <Line
                                                    yAxisId="right"
                                                    type="monotone"
                                                    dataKey="page_life_expectancy"
                                                    stroke="#52c41a"
                                                    strokeWidth={2}
                                                    dot={false}
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </Card>
                                </Col>
                            </Row>
                        </>
                    )}
                </div>
            </div>
        );
    };

    // Helper function to calculate user and system transaction metrics
    const calculateUserSystemMetrics = (entry: TransactionDataPoint) => {
        const systemDatabases = ['master', 'msdb', 'tempdb', 'model', 'mssqlsystemresource'];
        
        let userActive = 0;
        let userTPS = 0;
        let userWriteTPS = 0;
        let systemActive = 0;
        let systemTPS = 0;
        let systemWriteTPS = 0;

        if (entry.database_transactions) {
            Object.entries(entry.database_transactions).forEach(([dbName, metrics]) => {
                if (systemDatabases.includes(dbName.toLowerCase())) {
                    systemActive += metrics.active_by_database;
                    systemTPS += metrics.per_sec;
                    systemWriteTPS += metrics.write_per_sec;
                } else {
                    userActive += metrics.active_by_database;
                    userTPS += metrics.per_sec;
                    userWriteTPS += metrics.write_per_sec;
                }
            });
        }

        // System active transactions = Total - User (to account for background processes)
        const totalActive = entry.active_total || 0;
        systemActive = Math.max(0, totalActive - userActive);

        return {
            user: { active: userActive, tps: userTPS, writeTPS: userWriteTPS },
            system: { active: systemActive, tps: systemTPS, writeTPS: systemWriteTPS }
        };
    };

    const renderTransactionsTab = () => {
        return (
            <div style={{ marginTop: 10 }}>
                <div id="transactions-container">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <h2 style={{ color: transactionsDataLoading ? '#cc2927' : 'inherit' }}>
                            Transaction Metrics {transactionsDataLoading ? '(Loading...)' : ''}
                        </h2>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <Select
                                value={selectedTimeRange}
                                onChange={(value) => {
                                    setSelectedTimeRange(value);
                                    if (nodeName) {
                                        fetchTransactionsHistoricalData(nodeName, value);
                                    }
                                }}
                                style={{ width: 140 }}
                                disabled={!nodeName}
                            >
                                <Option value="10m">Last 10 Minutes</Option>
                                <Option value="15m">Last 15 Minutes</Option>
                                <Option value="30m">Last 30 Minutes</Option>
                                <Option value="1h">Last 1 Hour</Option>
                                <Option value="6h">Last 6 Hours</Option>
                                <Option value="24h">Last 24 Hours</Option>
                                <Option value="7d">Last 7 Days</Option>
                            </Select>
                            <Button
                                type="primary"
                                onClick={() => {
                                    if (nodeName) {
                                        fetchTransactionsHistoricalData(nodeName, selectedTimeRange);
                                    }
                                }}
                                icon={<ReloadOutlined />}
                                loading={transactionsDataLoading}
                                disabled={!nodeName || transactionsDataLoading}
                                style={{ background: '#cc2927', fontWeight: 'bold' }}
                            >
                                Refresh Transactions
                            </Button>
                        </div>
                    </div>

                    {!nodeName && (
                        <Alert
                            message="Please select a node to view transaction metrics"
                            type="info"
                            showIcon
                            style={{ marginBottom: '16px' }}
                        />
                    )}

                    {nodeName && transactionsDataLoading && (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px', border: '1px dashed #d9d9d9', borderRadius: '8px', background: '#fafafa' }}>
                            <div style={{ textAlign: 'center' }}>
                                <Spin size="large" />
                                <div style={{ marginTop: '15px', color: '#cc2927', fontWeight: 'bold' }}>
                                    Loading Transaction Metrics...
                                </div>
                            </div>
                        </div>
                    )}

                    {nodeName && !transactionsDataLoading && transactionsHistoricalData.length === 0 && (
                        <Alert
                            message="No transaction metrics data available"
                            description="The server didn't return any transaction data. Please try refreshing."
                            type="warning"
                            showIcon
                            style={{ marginBottom: '16px' }}
                        />
                    )}

                    {nodeName && !transactionsDataLoading && transactionsHistoricalData.length > 0 && (
                        <>
                            {/* Transaction Metrics Guide */}
                            <Row gutter={[16, 16]} style={{ marginBottom: '16px' }}>
                                <Col span={24}>
                                    <Alert
                                        message="Real-Time Transaction Activity Analysis"
                                        description={
                                            <div style={{ marginTop: '8px' }}>
                                                <p><strong>📊 Transaction Rate Metrics (Per Second):</strong></p>
                                                <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                                                    <li><strong>Transactions/sec:</strong> Real transaction throughput calculated per second. Shows actual database workload intensity.</li>
                                                    <li><strong>Write Transactions/sec:</strong> Data modification operations (INSERT, UPDATE, DELETE) per second. Higher values indicate OLTP workloads.</li>
                                                                                                         <li><strong>Write Ratio:</strong> Percentage of transactions that modify data. &lt;20% = Read-heavy, &gt;50% = Write-heavy workload.</li>
                                                    <li><strong>Database Analysis:</strong> Per-database breakdown helps identify hotspot databases requiring optimization.</li>
                                                </ul>
                                                <p><strong>✅ Now Showing:</strong> Actual per-second rates calculated from SQL Server performance counters</p>
                                                <p><strong>🎯 Best Practices:</strong> Monitor write ratios per database, investigate databases with &gt; 100 transactions/sec, watch for sudden spikes</p>
                                            </div>
                                        }
                                        type="success"
                                        showIcon
                                        closable
                                        style={{ marginBottom: '16px' }}
                                    />
                                </Col>
                            </Row>

                            {/* Transaction Overview KPIs - User vs System Separation */}
                            <Row gutter={[16, 16]} style={{ marginBottom: '16px' }}>
                                {(() => {
                                    const latestEntry = transactionsHistoricalData[transactionsHistoricalData.length - 1];
                                    const metrics = latestEntry ? calculateUserSystemMetrics(latestEntry) : null;
                                    
                                    return (
                                        <>
                                            <Col span={6}>
                                                <Card 
                                                    title={
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <UserOutlined style={{ color: '#52c41a', fontSize: '14px' }} />
                                                            <span>User Active Transactions</span>
                                                            <Tooltip title="Active transactions in user databases (excludes system databases: master, msdb, tempdb, model). Monitor for application-related blocking.">
                                                                <InfoCircleOutlined style={{ color: '#1890ff', fontSize: '14px' }} />
                                                            </Tooltip>
                                                        </div>
                                                    } 
                                                    bordered={false} 
                                                    hoverable
                                                >
                                                    <div style={{ textAlign: 'center' }}>
                                                        <Statistic
                                                            value={Math.round(metrics?.user.active || 0)}
                                                            precision={0}
                                                            valueStyle={{ 
                                                                color: (metrics?.user.active || 0) > 50 ? '#ff4d4f' : '#52c41a',
                                                                fontSize: '24px' 
                                                            }}
                                                        />
                                                    </div>
                                                </Card>
                                            </Col>
                                            <Col span={6}>
                                                <Card 
                                                    title={
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <UserOutlined style={{ color: '#52c41a', fontSize: '14px' }} />
                                                            <span>User Transactions/sec</span>
                                                            <Tooltip title="Transaction throughput for user databases only. This represents your application workload without system overhead.">
                                                                <InfoCircleOutlined style={{ color: '#1890ff', fontSize: '14px' }} />
                                                            </Tooltip>
                                                        </div>
                                                    } 
                                                    bordered={false} 
                                                    hoverable
                                                >
                                                    <div style={{ textAlign: 'center' }}>
                                                        <Statistic
                                                            value={Math.round(metrics?.user.tps || 0)}
                                                            precision={0}
                                                            valueStyle={{ color: '#52c41a', fontSize: '20px' }}
                                                            formatter={(value) => `${Number(value).toLocaleString()}`}
                                                        />
                                                    </div>
                                                </Card>
                                            </Col>
                                            <Col span={6}>
                                                <Card 
                                                    title={
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <SettingOutlined style={{ color: '#faad14', fontSize: '14px' }} />
                                                            <span>System Active Transactions</span>
                                                            <Tooltip title="Active transactions in system databases plus SQL Server background processes. High values may indicate system maintenance issues.">
                                                                <InfoCircleOutlined style={{ color: '#1890ff', fontSize: '14px' }} />
                                                            </Tooltip>
                                                        </div>
                                                    } 
                                                    bordered={false} 
                                                    hoverable
                                                >
                                                    <div style={{ textAlign: 'center' }}>
                                                        <Statistic
                                                            value={Math.round(metrics?.system.active || 0)}
                                                            precision={0}
                                                            valueStyle={{ 
                                                                color: (metrics?.system.active || 0) > 100 ? '#ff4d4f' : '#faad14',
                                                                fontSize: '24px' 
                                                            }}
                                                        />
                                                    </div>
                                                </Card>
                                            </Col>
                                            <Col span={6}>
                                                <Card 
                                                    title={
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <SettingOutlined style={{ color: '#faad14', fontSize: '14px' }} />
                                                            <span>System Transactions/sec</span>
                                                            <Tooltip title="Transaction throughput for system databases (master, msdb, tempdb, model). Includes SQL Server internal operations.">
                                                                <InfoCircleOutlined style={{ color: '#1890ff', fontSize: '14px' }} />
                                                            </Tooltip>
                                                        </div>
                                                    } 
                                                    bordered={false} 
                                                    hoverable
                                                >
                                                    <div style={{ textAlign: 'center' }}>
                                                        <Statistic
                                                            value={Math.round(metrics?.system.tps || 0)}
                                                            precision={0}
                                                            valueStyle={{ color: '#faad14', fontSize: '20px' }}
                                                            formatter={(value) => `${Number(value).toLocaleString()}`}
                                                        />
                                                    </div>
                                                </Card>
                                            </Col>
                                        </>
                                    );
                                })()}
                            </Row>

                            {/* Additional KPIs Row */}
                            <Row gutter={[16, 16]} style={{ marginBottom: '16px' }}>
                                <Col span={6}>
                                    <Card 
                                        title={
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span>Total Transactions/sec</span>
                                                <Tooltip title="Combined user + system transaction throughput. Use this for overall system capacity planning.">
                                                    <InfoCircleOutlined style={{ color: '#1890ff', fontSize: '14px' }} />
                                                </Tooltip>
                                            </div>
                                        } 
                                        bordered={false} 
                                        hoverable
                                    >
                                        <div style={{ textAlign: 'center' }}>
                                            <Statistic
                                                value={Math.round(transactionsHistoricalData[transactionsHistoricalData.length - 1]?.per_sec_total || 0)}
                                                precision={0}
                                                valueStyle={{ color: '#cc2927', fontSize: '20px' }}
                                                formatter={(value) => `${Number(value).toLocaleString()}`}
                                            />
                                        </div>
                                    </Card>
                                </Col>
                                <Col span={6}>
                                    <Card 
                                        title={
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span>Write Transactions/sec</span>
                                                <Tooltip title="Total data modification operations (INSERT, UPDATE, DELETE) per second across all databases.">
                                                    <InfoCircleOutlined style={{ color: '#1890ff', fontSize: '14px' }} />
                                                </Tooltip>
                                            </div>
                                        } 
                                        bordered={false} 
                                        hoverable
                                    >
                                        <div style={{ textAlign: 'center' }}>
                                            <Statistic
                                                value={Math.round(transactionsHistoricalData[transactionsHistoricalData.length - 1]?.write_per_sec_total || 0)}
                                                precision={0}
                                                valueStyle={{ color: '#1890ff', fontSize: '20px' }}
                                                formatter={(value) => `${Number(value).toLocaleString()}`}
                                            />
                                        </div>
                                    </Card>
                                </Col>
                                <Col span={6}>
                                    <Card 
                                        title={
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span>TempDB Free Space</span>
                                                <Tooltip title="Available space in TempDB. Low values may indicate insufficient tempdb sizing or runaway queries creating large temp objects.">
                                                    <InfoCircleOutlined style={{ color: '#1890ff', fontSize: '14px' }} />
                                                </Tooltip>
                                            </div>
                                        } 
                                        bordered={false} 
                                        hoverable
                                    >
                                        <div style={{ textAlign: 'center' }}>
                                            <Statistic
                                                value={transactionsHistoricalData[transactionsHistoricalData.length - 1]?.tempdb_free_space_kb || 0}
                                                valueStyle={{ color: '#52c41a', fontSize: '20px' }}
                                                formatter={(value) => formatMB(Number(value) / 1024)}
                                            />
                                        </div>
                                    </Card>
                                </Col>
                                <Col span={6}>
                                    <Card 
                                        title={
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span>Active Total</span>
                                                <Tooltip title="Total active transactions including all system processes. This is the complete picture of SQL Server activity.">
                                                    <InfoCircleOutlined style={{ color: '#1890ff', fontSize: '14px' }} />
                                                </Tooltip>
                                            </div>
                                        } 
                                        bordered={false} 
                                        hoverable
                                    >
                                        <div style={{ textAlign: 'center' }}>
                                            <Statistic
                                                value={Math.round(transactionsHistoricalData[transactionsHistoricalData.length - 1]?.active_total || 0)}
                                                precision={0}
                                                valueStyle={{ 
                                                    color: (transactionsHistoricalData[transactionsHistoricalData.length - 1]?.active_total || 0) > 100 ? '#ff4d4f' : '#595959',
                                                    fontSize: '20px' 
                                                }}
                                            />
                                        </div>
                                    </Card>
                                </Col>
                            </Row>

                            {/* Database Transaction Analysis */}
                            {transactionsHistoricalData.length > 0 && transactionsHistoricalData[transactionsHistoricalData.length - 1].database_transactions && (
                                <Row gutter={[16, 16]} style={{ marginBottom: '16px' }}>
                                    <Col span={24}>
                                        <Card
                                            title={
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between', width: '100%' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <DatabaseOutlined style={{ color: '#cc2927' }} />
                                                        <span>Database Transaction Activity (User Databases Only)</span>
                                                    </div>
                                                    <Tooltip title="This table shows transaction activity for user databases only. System databases (master, msdb, tempdb, model) are filtered out for clarity.">
                                                        <InfoCircleOutlined style={{ color: '#1890ff', fontSize: '14px' }} />
                                                    </Tooltip>
                                                </div>
                                            }
                                            bordered={false}
                                        >
                                                                        {Object.entries(transactionsHistoricalData[transactionsHistoricalData.length - 1].database_transactions || {})
                                .filter(([dbName]) => {
                                    // Filter out system databases
                                    const systemDatabases = ['master', 'msdb', 'tempdb', 'model', 'mssqlsystemresource'];
                                    return !systemDatabases.includes(dbName.toLowerCase());
                                }).length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>
                                    <DatabaseOutlined style={{ fontSize: '48px', marginBottom: '16px', color: '#d9d9d9' }} />
                                    <p>No user databases with transaction activity found.</p>
                                    <p style={{ fontSize: '12px' }}>Only system databases are active, or no database-specific transaction data is available.</p>
                                </div>
                            ) : (
                                <Table
                                    dataSource={Object.entries(transactionsHistoricalData[transactionsHistoricalData.length - 1].database_transactions || {})
                                        .filter(([dbName]) => {
                                            // Filter out system databases
                                            const systemDatabases = ['master', 'msdb', 'tempdb', 'model', 'mssqlsystemresource'];
                                            return !systemDatabases.includes(dbName.toLowerCase());
                                        })
                                        .map(([dbName, metrics], index) => ({
                                            key: index,
                                            database_name: dbName,
                                            ...metrics
                                        }))
                                        .sort((a, b) => b.per_sec - a.per_sec)
                                    }
                                    columns={[
                                        {
                                            title: 'Database',
                                            dataIndex: 'database_name',
                                            key: 'database_name',
                                            render: (dbName: string) => (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <DatabaseOutlined style={{ color: '#cc2927', fontSize: '14px' }} />
                                                    <span style={{ fontWeight: 500 }}>{dbName}</span>
                                                </div>
                                            )
                                        },
                                        {
                                            title: 'Active Transactions',
                                            dataIndex: 'active_by_database',
                                            key: 'active_by_database',
                                            sorter: (a: any, b: any) => a.active_by_database - b.active_by_database,
                                            render: (value: number) => (
                                                <Tag color={value > 0 ? 'orange' : 'green'}>
                                                    {Math.round(value)}
                                                </Tag>
                                            )
                                        },
                                        {
                                            title: 'Transactions/sec',
                                            dataIndex: 'per_sec',
                                            key: 'per_sec',
                                            sorter: (a: any, b: any) => a.per_sec - b.per_sec,
                                            defaultSortOrder: 'descend' as const,
                                            render: (value: number) => (
                                                <span style={{ 
                                                    color: value > 100 ? '#cc2927' : value > 50 ? '#faad14' : '#52c41a',
                                                    fontWeight: 500 
                                                }}>
                                                    {Math.round(value).toLocaleString()}
                                                </span>
                                            )
                                        },
                                        {
                                            title: 'Write Transactions/sec',
                                            dataIndex: 'write_per_sec',
                                            key: 'write_per_sec',
                                            sorter: (a: any, b: any) => a.write_per_sec - b.write_per_sec,
                                            render: (value: number) => (
                                                <span style={{ 
                                                    color: value > 50 ? '#cc2927' : value > 25 ? '#faad14' : '#52c41a',
                                                    fontWeight: 500 
                                                }}>
                                                    {Math.round(value).toLocaleString()}
                                                </span>
                                            )
                                        },
                                        {
                                            title: 'Write Ratio',
                                            key: 'write_ratio',
                                            render: (_, record: any) => {
                                                const ratio = record.per_sec > 0 ? (record.write_per_sec / record.per_sec * 100) : 0;
                                                return (
                                                    <Progress
                                                        percent={Math.min(100, ratio)}
                                                        size="small"
                                                        format={() => `${ratio.toFixed(1)}%`}
                                                        strokeColor={ratio > 80 ? '#ff4d4f' : ratio > 50 ? '#faad14' : '#52c41a'}
                                                    />
                                                );
                                            }
                                        }
                                    ]}
                                    pagination={{ pageSize: 10 }}
                                    scroll={{ x: 'max-content' }}
                                />
                            )}
                        </Card>
                                    </Col>
                                </Row>
                            )}

                            {/* Historical Charts */}
                            <Row gutter={[16, 16]}>
                                <Col span={12}>
                                    <Card
                                        title={
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <LineChartOutlined style={{ color: '#cc2927' }} />
                                                <span>Transaction Rate History</span>
                                            </div>
                                        }
                                        hoverable
                                        style={{ height: '400px' }}
                                    >
                                        <ResponsiveContainer width="100%" height={300}>
                                            <LineChart data={transactionsHistoricalData}>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis
                                                    dataKey="time"
                                                    tick={{ fontSize: 12 }}
                                                    interval="preserveStartEnd"
                                                />
                                                <YAxis
                                                    tick={{ fontSize: 12 }}
                                                    tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value.toString()}
                                                />
                                                <RechartsTooltip
                                                    formatter={(value: any, name: string) => [
                                                        `${Math.round(Number(value)).toLocaleString()}`,
                                                        name === 'per_sec_total' ? 'Total Transactions/sec' : 'Write Transactions/sec'
                                                    ]}
                                                    labelFormatter={(label) => `Time: ${label}`}
                                                />
                                                <Line
                                                    type="monotone"
                                                    dataKey="per_sec_total"
                                                    stroke="#cc2927"
                                                    strokeWidth={2}
                                                    dot={false}
                                                />
                                                <Line
                                                    type="monotone"
                                                    dataKey="write_per_sec_total"
                                                    stroke="#1890ff"
                                                    strokeWidth={2}
                                                    dot={false}
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card
                                        title={
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <LineChartOutlined style={{ color: '#52c41a' }} />
                                                <span>Active Transactions & TempDB</span>
                                            </div>
                                        }
                                        hoverable
                                        style={{ height: '400px' }}
                                    >
                                        <ResponsiveContainer width="100%" height={300}>
                                            <LineChart data={transactionsHistoricalData}>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis
                                                    dataKey="time"
                                                    tick={{ fontSize: 12 }}
                                                    interval="preserveStartEnd"
                                                />
                                                <YAxis
                                                    yAxisId="left"
                                                    tick={{ fontSize: 12 }}
                                                    label={{ value: 'Active Transactions', angle: -90, position: 'insideLeft' }}
                                                />
                                                <YAxis
                                                    yAxisId="right"
                                                    orientation="right"
                                                    tick={{ fontSize: 12 }}
                                                    label={{ value: 'TempDB Free Space', angle: 90, position: 'insideRight' }}
                                                    tickFormatter={(value) => formatMB(value / 1024)}
                                                />
                                                <RechartsTooltip
                                                    formatter={(value: any, name: string) => {
                                                        if (name === 'active_total') {
                                                            return [`${Math.round(value)}`, 'Active Transactions'];
                                                        } else {
                                                            return [formatMB(value / 1024), 'TempDB Free Space'];
                                                        }
                                                    }}
                                                    labelFormatter={(label) => `Time: ${label}`}
                                                />
                                                <Line
                                                    yAxisId="left"
                                                    type="monotone"
                                                    dataKey="active_total"
                                                    stroke="#52c41a"
                                                    strokeWidth={2}
                                                    dot={false}
                                                />
                                                <Line
                                                    yAxisId="right"
                                                    type="monotone"
                                                    dataKey="tempdb_free_space_kb"
                                                    stroke="#faad14"
                                                    strokeWidth={2}
                                                    dot={false}
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </Card>
                                </Col>
                            </Row>
                        </>
                    )}
                </div>
            </div>
        );
    };

    const renderSystemTab = () => {
        return (
            <div style={{ marginTop: 10 }}>
                <div id="metrics-container">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <h2 style={{ color: historicalDataLoading ? '#cc2927' : 'inherit' }}>
                            System Metrics {historicalDataLoading ? '(Loading...)' : ''}
                        </h2>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <Select
                                value={selectedTimeRange}
                                onChange={(value) => {
                                    setSelectedTimeRange(value);
                                    if (nodeName) {
                                        fetchHistoricalMetrics(nodeName, value);
                                    }
                                }}
                                style={{ width: 140 }}
                                disabled={!nodeName}
                            >
                                <Option value="10m">Last 10 Minutes</Option>
                                <Option value="15m">Last 15 Minutes</Option>
                                <Option value="30m">Last 30 Minutes</Option>
                                <Option value="1h">Last 1 Hour</Option>
                                <Option value="6h">Last 6 Hours</Option>
                                <Option value="24h">Last 24 Hours</Option>
                                <Option value="7d">Last 7 Days</Option>
                            </Select>
                            <Button
                                type="primary"
                                onClick={() => {
                                    if (nodeName) {
                                        fetchHistoricalMetrics(nodeName, selectedTimeRange);
                                    }
                                }}
                                icon={<ReloadOutlined />}
                                loading={historicalDataLoading}
                                disabled={!nodeName || historicalDataLoading}
                                style={{ background: '#cc2927', fontWeight: 'bold' }}
                            >
                                Refresh Metrics
                            </Button>
                        </div>
                    </div>

                    {!nodeName && (
                        <Alert
                            message="Please select a node to view metrics"
                            type="info"
                            showIcon
                            style={{ marginBottom: '16px' }}
                        />
                    )}

                    {nodeName && historicalDataLoading && (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px', border: '1px dashed #d9d9d9', borderRadius: '8px', background: '#fafafa' }}>
                            <div style={{ textAlign: 'center' }}>
                                <Spin size="large" />
                                <div style={{ marginTop: '15px', color: '#cc2927', fontWeight: 'bold' }}>
                                    Loading System Metrics...
                                </div>
                                <div style={{ maxWidth: '80%', margin: '10px auto', color: '#666' }}>
                                    This may take up to 60 seconds. If data doesn't appear, please use the refresh button.
                                </div>
                            </div>
                        </div>
                    )}

                    {nodeName && !historicalDataLoading && !systemMetrics && (
                        <Alert
                            message="No metrics data available"
                            description="The server didn't return any metrics data. Please try refreshing or check server logs."
                            type="warning"
                            showIcon
                            style={{ marginBottom: '16px' }}
                        />
                    )}

                    {nodeName && !historicalDataLoading && systemMetrics && (
                        <>
                            {/* Current Metrics Cards */}
                            <Row gutter={16} justify="center">
                                <Col span={12}>
                                    <Card
                                        title={
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <span>CPU</span>
                                                <Tag color="blue">{systemMetrics?.cpu_cores} Cores</Tag>
                                            </div>
                                        }
                                        hoverable
                                        style={{ height: '340px' }}
                                    >
                                        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                                            <Progress
                                                type="dashboard"
                                                width={180}
                                                percent={Math.min(100, parseFloat((systemMetrics?.cpu_usage || 0).toFixed(1)))}
                                                strokeColor={(systemMetrics?.cpu_usage || 0) > 70 ? '#ff4d4f' : '#52c41a'}
                                                format={(percent) => (
                                                    <div>
                                                        <div style={{ fontSize: '24px', color: '#262626' }}>
                                                            {parseFloat((systemMetrics?.cpu_usage || 0).toFixed(1))}%
                                                        </div>
                                                        <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
                                                            MSSQL Usage
                                                        </div>
                                                    </div>
                                                )}
                                            />
                                        </div>
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ marginBottom: '8px' }}>
                                                <Text type="secondary">CPU Cores: </Text>
                                                <Text strong>{systemMetrics?.cpu_cores || 0}</Text>
                                            </div>
                                        </div>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card
                                        title="Memory"
                                        hoverable
                                        style={{ height: '340px' }}
                                    >
                                        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                                            <Progress
                                                type="dashboard"
                                                width={180}
                                                percent={parseFloat((systemMetrics?.memory_usage || 0).toFixed(1))}
                                                strokeColor={(systemMetrics?.memory_usage || 0) > 70 ? '#ff4d4f' : '#52c41a'}
                                                format={(percent) => (
                                                    <div>
                                                        <div style={{ fontSize: '24px', color: '#262626' }}>
                                                            {percent}%
                                                        </div>
                                                        <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
                                                            Used
                                                        </div>
                                                    </div>
                                                )}
                                            />
                                        </div>
                                        <div style={{ textAlign: 'center' }}>
                                            <Row justify="space-around">
                                                <Col>
                                                    <Statistic
                                                        title="Total"
                                                        value={formatBytes(systemMetrics?.total_memory || 0)}
                                                        valueStyle={{ fontSize: '14px' }}
                                                    />
                                                </Col>
                                                <Col>
                                                    <Statistic
                                                        title="Free"
                                                        value={formatBytes(systemMetrics?.free_memory || 0)}
                                                        valueStyle={{ fontSize: '14px' }}
                                                    />
                                                </Col>
                                            </Row>
                                        </div>
                                    </Card>
                                </Col>
                            </Row>

                            {/* Historical Charts */}
                            <Row gutter={16} style={{ marginTop: '16px' }}>
                                <Col span={12}>
                                    <Card
                                        title={
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <LineChartOutlined style={{ color: '#1890ff' }} />
                                                    <span>CPU Usage History</span>
                                                </div>
                                                <Button
                                                    type="text"
                                                    size="small"
                                                    icon={<ReloadOutlined />}
                                                    onClick={() => {
                                                        if (nodeName) {
                                                            fetchCpuHistoricalData(nodeName, selectedTimeRange);
                                                        }
                                                    }}
                                                    loading={cpuDataLoading}
                                                    disabled={!nodeName}
                                                    style={{
                                                        color: '#1890ff',
                                                        border: 'none',
                                                        boxShadow: 'none'
                                                    }}
                                                    title="Refresh CPU data"
                                                />
                                            </div>
                                        }
                                        hoverable
                                        style={{ height: '400px' }}
                                    >
                                        {cpuDataLoading ? (
                                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
                                                <Spin size="large" />
                                            </div>
                                        ) : cpuHistoricalData.length > 0 ? (
                                            <ResponsiveContainer width="100%" height={300}>
                                                <AreaChart data={cpuHistoricalData}>
                                                    <CartesianGrid strokeDasharray="3 3" />
                                                    <XAxis
                                                        dataKey="time"
                                                        tick={{ fontSize: 12 }}
                                                        interval="preserveStartEnd"
                                                    />
                                                    <YAxis
                                                        domain={[0, 100]}
                                                        tick={{ fontSize: 12 }}
                                                        label={{ value: 'CPU Usage (%)', angle: -90, position: 'insideLeft' }}
                                                    />
                                                    <RechartsTooltip
                                                        formatter={(value: any) => [`${value?.toFixed(2)}%`, 'CPU Usage']}
                                                        labelFormatter={(label, payload) => {
                                                            if (payload && payload.length > 0 && payload[0].payload?.timestamp) {
                                                                const date = new Date(payload[0].payload.timestamp);
                                                                return `Time: ${date.toLocaleString()}`;
                                                            }
                                                            return `Time: ${label}`;
                                                        }}
                                                    />
                                                    <Area
                                                        type="monotone"
                                                        dataKey="cpu_usage"
                                                        stroke="#1890ff"
                                                        fill="#1890ff"
                                                        fillOpacity={0.3}
                                                    />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px', flexDirection: 'column' }}>
                                                <LineChartOutlined style={{ fontSize: '48px', color: '#d9d9d9', marginBottom: '16px' }} />
                                                <Text type="secondary">No CPU historical data available</Text>
                                            </div>
                                        )}
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card
                                        title={
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <LineChartOutlined style={{ color: '#52c41a' }} />
                                                    <span>Memory Usage History</span>
                                                </div>
                                                <Button
                                                    type="text"
                                                    size="small"
                                                    icon={<ReloadOutlined />}
                                                    onClick={() => {
                                                        if (nodeName) {
                                                            fetchMemoryHistoricalData(nodeName, selectedTimeRange);
                                                        }
                                                    }}
                                                    loading={memoryDataLoading}
                                                    disabled={!nodeName}
                                                    style={{
                                                        color: '#52c41a',
                                                        border: 'none',
                                                        boxShadow: 'none'
                                                    }}
                                                    title="Refresh Memory data"
                                                />
                                            </div>
                                        }
                                        hoverable
                                        style={{ height: '400px' }}
                                    >
                                        {memoryDataLoading ? (
                                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
                                                <Spin size="large" />
                                            </div>
                                        ) : memoryHistoricalData.length > 0 ? (
                                            <ResponsiveContainer width="100%" height={300}>
                                                <AreaChart data={memoryHistoricalData}>
                                                    <CartesianGrid strokeDasharray="3 3" />
                                                    <XAxis
                                                        dataKey="time"
                                                        tick={{ fontSize: 12 }}
                                                        interval="preserveStartEnd"
                                                    />
                                                    <YAxis
                                                        domain={[0, 100]}
                                                        tick={{ fontSize: 12 }}
                                                        label={{ value: 'Memory Usage (%)', angle: -90, position: 'insideLeft' }}
                                                    />
                                                    <RechartsTooltip
                                                        formatter={(value: any) => [`${value?.toFixed(2)}%`, 'Memory Usage']}
                                                        labelFormatter={(label, payload) => {
                                                            if (payload && payload.length > 0 && payload[0].payload?.timestamp) {
                                                                const date = new Date(payload[0].payload.timestamp);
                                                                return `Time: ${date.toLocaleString()}`;
                                                            }
                                                            return `Time: ${label}`;
                                                        }}
                                                    />
                                                    <Area
                                                        type="monotone"
                                                        dataKey="memory_usage"
                                                        stroke="#52c41a"
                                                        fill="#52c41a"
                                                        fillOpacity={0.3}
                                                    />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px', flexDirection: 'column' }}>
                                                <LineChartOutlined style={{ fontSize: '48px', color: '#d9d9d9', marginBottom: '16px' }} />
                                                <Text type="secondary">No memory historical data available</Text>
                                            </div>
                                        )}
                                    </Card>
                                </Col>
                            </Row>


                        </>
                    )}
                </div>
            </div>
        );
    };

    // AI yanıtını işleme fonksiyonu

    const handleAIAnalysis = async (queryToAnalyze: string) => {
        // Check the current usage against the daily limit
        const state = store.getState();
        const { dailyUsageCount, dailyLimit, lastResetDate } = state.aiLimit;

        // Helper function to check if we need to reset
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
                okText: 'Close',
                maskClosable: true
            });
            return;
        }

        // Create a reference to store the modal instance
        let analysisModal: any = null;

        try {
            // Show loading modal first
            analysisModal = Modal.info({
                title: 'AI Query Analysis',
                content: (
                    <div style={{
                        textAlign: 'center',
                        padding: '40px 20px'
                    }}>
                        <Spin size="large" />
                        <div style={{
                            marginTop: '20px',
                            fontSize: '16px',
                            color: '#1890ff'
                        }}>
                            AI is analyzing your query...
                        </div>
                        <div style={{
                            marginTop: '10px',
                            fontSize: '14px',
                            color: '#888'
                        }}>
                            This may take a few seconds
                        </div>
                    </div>
                ),
                width: '60%',
                footer: null
            });

            const response = await fetch('https://o4szcpxekyj6hvcdx5ktqy2c.agents.do-ai.run/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer cifsE4HtBVWFEzyXrh5E5vbU-v66wK6I'
                },
                body: JSON.stringify({
                    messages: [{
                        role: "user",
                        content: `Analyze this SQL Server query and give recommendations for optimization.
Please suggest indexes if necessary and consider rewriting the query for better performance.
Query:
${queryToAnalyze.length > 2000 ? queryToAnalyze.substring(0, 2000) + '...' : queryToAnalyze}
`
                    }],
                    temperature: 0,
                    top_p: 0.01,
                    max_tokens: 4000,
                    max_completion_tokens: 4000,
                    stream: false,
                    k: 0,
                    retrieval_method: "rewrite",
                    frequency_penalty: 0,
                    presence_penalty: 0,
                    stop: "string",
                    stream_options: {
                        include_usage: true
                    },
                    filter_kb_content_by_query_metadata: false,
                    instruction_override: "string",
                    include_functions_info: false,
                    include_retrieval_info: false,
                    include_guardrails_info: false,
                    provide_citations: true
                })
            });

            const data = await response.json();

            // Increment usage in Redux
            store.dispatch(incrementUsage());

            // Destroy the loading modal
            analysisModal.destroy();

            // Get updated count for display
            const updatedState = store.getState();
            const updatedCount = updatedState.aiLimit.dailyUsageCount;
            const remainingCount = dailyLimit - updatedCount;

            // Show the results in a new modal
            Modal.info({
                title: (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        <RobotOutlined style={{ fontSize: '20px', color: '#1890ff' }} />
                        <span>AI Query Analysis Results</span>
                    </div>
                ),
                content: (
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px'
                    }}>
                        <div style={{
                            backgroundColor: '#ffffff',
                            borderRadius: '8px',
                            maxHeight: '50vh',
                            overflowY: 'auto'
                        }}>
                            <AIAnalysisRenderer
                                content={data.choices[0].message.content}
                                dbType="mssql"
                            />
                        </div>
                        <div style={{
                            fontSize: '12px',
                            color: '#888',
                            textAlign: 'right',
                            marginTop: '8px',
                            padding: '8px',
                            backgroundColor: '#f9f0ff',
                            borderRadius: '4px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <span style={{ color: '#722ed1' }}>
                                <RobotOutlined style={{ marginRight: '4px' }} />
                                AI Analysis Usage
                            </span>
                            <span>
                                Used: <strong>{updatedCount}</strong>/{dailyLimit}
                                (Remaining: <strong>{remainingCount}</strong>)
                            </span>
                        </div>
                    </div>
                ),
                width: '60%',
                okText: 'Close',
                className: 'ai-analysis-modal',
                style: { top: '20px' },
                maskClosable: true
            });
        } catch (error) {
            // Destroy the loading modal if it exists
            if (analysisModal) {
                analysisModal.destroy();
            }
            console.error('Error during AI analysis:', error);
            message.error('Failed to analyze with AI');
        }
    };

    // New function for analyzing execution plans with AI
    const handleExecutionPlanAIAnalysis = async (planData: string) => {
        // Check the current usage against the daily limit
        const state = store.getState();
        const { dailyUsageCount, dailyLimit, lastResetDate } = state.aiLimit;

        // Helper function to check if we need to reset
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
                okText: 'Close',
                maskClosable: true
            });
            return;
        }

        // Create a reference to store the modal instance
        let analysisModal: any = null;

        try {
            // Show loading modal first
            analysisModal = Modal.info({
                title: 'AI Execution Plan Analysis',
                content: (
                    <div style={{
                        textAlign: 'center',
                        padding: '40px 20px'
                    }}>
                        <Spin size="large" />
                        <div style={{
                            marginTop: '20px',
                            fontSize: '16px',
                            color: '#1890ff'
                        }}>
                            AI is analyzing your execution plan...
                        </div>
                        <div style={{
                            marginTop: '10px',
                            fontSize: '14px',
                            color: '#888'
                        }}>
                            This may take a few seconds
                        </div>
                    </div>
                ),
                width: '60%',
                footer: null
            });

            // Extract the XML plan if it's inside a JSON object
            let planXml = planData;
            try {
                if (typeof planData === 'string' &&
                    planData.trim().startsWith('{') &&
                    planData.includes('"plan"')) {

                    const jsonObj = JSON.parse(planData);
                    if (jsonObj.plan) {
                        planXml = jsonObj.plan;
                    }
                }
            } catch (error) {
                console.warn('Failed to parse JSON plan for AI analysis:', error);
            }

            const response = await fetch('https://o4szcpxekyj6hvcdx5ktqy2c.agents.do-ai.run/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer cifsE4HtBVWFEzyXrh5E5vbU-v66wK6I'
                },
                body: JSON.stringify({
                    messages: [{
                        role: "user",
                        content: `Analyze this SQL Server execution plan and provide 3 key insights:

1. **Main Bottleneck** (max 1 line)
2. **Index Recommendation** (max 1 line)
3. **Optimization Tip** (max 1 line)

Plan: ${planXml.length > 2000 ? planXml.substring(0, 2000) + '...' : planXml}

Keep response under 150 words.`
                    }],
                    temperature: 0,
                    top_p: 0.01,
                    max_tokens: 250,
                    max_completion_tokens: 250,
                    stream: false,
                    k: 0,
                    retrieval_method: "rewrite",
                    frequency_penalty: 0,
                    presence_penalty: 0,
                    stop: "string",
                    stream_options: {
                        include_usage: true
                    },
                    filter_kb_content_by_query_metadata: false,
                    instruction_override: "string",
                    include_functions_info: false,
                    include_retrieval_info: false,
                    include_guardrails_info: false,
                    provide_citations: true
                })
            });

            const data = await response.json();

            // Increment usage in Redux
            store.dispatch(incrementUsage());

            // Destroy the loading modal
            analysisModal.destroy();

            // Get updated count for display
            const updatedState = store.getState();
            const updatedCount = updatedState.aiLimit.dailyUsageCount;
            const remainingCount = dailyLimit - updatedCount;

            // Show the results in a new modal
            Modal.info({
                title: (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        <RobotOutlined style={{ fontSize: '20px', color: '#1890ff' }} />
                        <span>AI Execution Plan Analysis Results</span>
                    </div>
                ),
                content: (
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px'
                    }}>
                        <div style={{
                            backgroundColor: '#ffffff',
                            borderRadius: '8px',
                            maxHeight: '50vh',
                            overflowY: 'auto'
                        }}>
                            <AIAnalysisRenderer
                                content={data.choices[0].message.content}
                                dbType="mssql"
                            />
                        </div>
                        <div style={{
                            fontSize: '12px',
                            color: '#888',
                            textAlign: 'right',
                            marginTop: '8px',
                            padding: '8px',
                            backgroundColor: '#f9f0ff',
                            borderRadius: '4px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <span style={{ color: '#722ed1' }}>
                                <RobotOutlined style={{ marginRight: '4px' }} />
                                AI Analysis Usage
                            </span>
                            <span>
                                Used: <strong>{updatedCount}</strong>/{dailyLimit}
                                (Remaining: <strong>{remainingCount}</strong>)
                            </span>
                        </div>
                    </div>
                ),
                width: '70%',
                okText: 'Close',
                className: 'ai-analysis-modal',
                style: { top: '20px' },
                maskClosable: true
            });
        } catch (error) {
            // Destroy the loading modal if it exists
            if (analysisModal) {
                analysisModal.destroy();
            }
            console.error('Error during AI analysis:', error);
            message.error('Failed to analyze execution plan with AI');
        }
    };

    // Fetch MSSQL execution plan for a query
    const fetchExecutionPlan = async (queryText: string, queryDatabase?: string) => {
        if (!nodeName) {
            message.error('No node selected');
            return;
        }

        if (!queryText || queryText.trim() === '') {
            message.error('No query to analyze');
            return;
        }

        // If no database is provided, show database selection modal
        if (!queryDatabase) {
            let currentDatabaseNames = databaseNames;

            // Ensure we have database names before showing the selection modal
            if (currentDatabaseNames.length === 0 || (currentDatabaseNames.length <= 2 && currentDatabaseNames.includes('master'))) {
                // Show loading message while fetching databases
                const loadingModal = Modal.info({
                    title: 'Loading Database List',
                    content: (
                        <div style={{ textAlign: 'center', padding: '20px' }}>
                            <Spin size="large" />
                            <p style={{ marginTop: '15px', color: '#cc2927' }}>Loading available databases...</p>
                        </div>
                    ),
                    icon: <DatabaseOutlined style={{ color: '#cc2927' }} />,
                    footer: null,
                    maskClosable: false
                });

                // Fetch databases first and get the result directly
                try {
                    currentDatabaseNames = await fetchDatabases(nodeName);
                    loadingModal.destroy();

                    // If still no databases after fetching, use defaults
                    if (currentDatabaseNames.length === 0) {
                        currentDatabaseNames = ['master', 'msdb'];
                        message.warning('Could not load database list, using default databases');
                    }

                } catch (error) {
                    console.error('Failed to fetch databases for selection:', error);
                    loadingModal.destroy();
                    message.error('Failed to load database list');
                    return;
                }
            }

            let selectedDbForPlan = selectedDatabase || 'master';

            Modal.confirm({
                title: (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <DatabaseOutlined style={{ color: '#cc2927' }} />
                        <span>Select Database for Execution Plan</span>
                    </div>
                ),
                content: (
                    <div style={{ padding: '16px 0' }}>
                        <p style={{ marginBottom: '12px', color: '#595959' }}>
                            This query doesn't have database information. Please select which database to use for execution plan analysis:
                        </p>
                        <Select
                            placeholder="Select a database"
                            style={{ width: '100%' }}
                            defaultValue={selectedDatabase || 'master'}
                            onChange={(value) => {
                                selectedDbForPlan = value;
                            }}
                            size="large"
                        >
                            {currentDatabaseNames.map((dbName) => (
                                <Option key={dbName} value={dbName}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <DatabaseOutlined style={{ color: '#cc2927', fontSize: '14px' }} />
                                        {dbName}
                                    </div>
                                </Option>
                            ))}
                        </Select>
                        <div style={{
                            marginTop: '8px',
                            fontSize: '12px',
                            color: '#8c8c8c',
                            background: '#f6f6f6',
                            padding: '8px',
                            borderRadius: '4px'
                        }}>
                            💡 <strong>Tip:</strong> For ad-hoc queries without database context, selecting the correct database is important for accurate execution plan analysis.
                        </div>
                    </div>
                ),
                okText: 'Get Execution Plan',
                cancelText: 'Cancel',
                width: 480,
                onOk: () => {
                    fetchExecutionPlan(queryText, selectedDbForPlan);
                },
                onCancel: () => {
                    // User cancelled, do nothing
                }
            });
            return;
        }

        setExecutionPlanLoading(true);

        // Use the provided database or fall back to selected database or master
        const targetDatabase = queryDatabase || selectedDatabase || 'master';

        // Gösterimi güncelleyerek yükleme durumunu belirt
        Modal.info({
            title: 'Getting MSSQL Execution Plan',
            content: (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                    <Spin size="large" />
                    <p style={{ marginTop: '15px', color: '#cc2927' }}>Analyzing the query execution plan...</p>
                    <p style={{ fontSize: '12px', color: '#999' }}>Database: <strong style={{ color: '#cc2927' }}>{targetDatabase}</strong></p>
                    <p style={{ fontSize: '12px', color: '#999' }}>This may take a few moments</p>
                </div>
            ),
            icon: <LineChartOutlined style={{ color: '#cc2927' }} />,
            maskClosable: false
        });

        try {
            // Önce sorguyu temizle - tüm yeni satır karakterlerini ve fazla boşlukları kaldır
            const cleanQuery = queryText.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();

            // Ensure agent ID has the correct format
            const agentId = nodeName.startsWith('agent_') ? nodeName : `agent_${nodeName}`;

            let executionPlanXml = '';

            // Check if this is a stored procedure name (short text without SQL keywords)
            const isLikelyProcedureName = cleanQuery.length < 100 &&
                !cleanQuery.toUpperCase().includes('SELECT') &&
                !cleanQuery.toUpperCase().includes('INSERT') &&
                !cleanQuery.toUpperCase().includes('UPDATE') &&
                !cleanQuery.toUpperCase().includes('DELETE') &&
                !cleanQuery.toUpperCase().includes('CREATE') &&
                !cleanQuery.toUpperCase().includes('ALTER') &&
                !cleanQuery.includes(' ') ||
                cleanQuery.split(' ').length <= 3;

            // Check if this is a stored procedure (starts with CREATE PROCEDURE or looks like procedure name)
            const isStoredProcedure = cleanQuery.toUpperCase().startsWith('CREATE PROCEDURE') ||
                cleanQuery.toUpperCase().includes('CREATE PROCEDURE') ||
                isLikelyProcedureName;

            if (isStoredProcedure) {
                let procedureName = '';

                if (cleanQuery.toUpperCase().includes('CREATE PROCEDURE')) {
                    // Extract procedure name from CREATE PROCEDURE statement
                    const procedureNameMatch = cleanQuery.match(/CREATE\s+PROCEDURE\s+(?:\[?([^\s\[\]]+)\]?\.)?(?:\[?([^\s\[\]]+)\]?)/i);
                    procedureName = procedureNameMatch ? (procedureNameMatch[2] || procedureNameMatch[1]) : '';
                } else {
                    // Assume the entire clean query is the procedure name
                    procedureName = cleanQuery.trim();
                    // Remove schema prefix if exists (e.g., "dbo.ProcName" -> "ProcName")
                    if (procedureName.includes('.')) {
                        procedureName = procedureName.split('.').pop() || procedureName;
                    }
                    // Remove brackets if exists
                    procedureName = procedureName.replace(/[\[\]]/g, '');
                }

                if (procedureName) {

                    // Use the user's suggested query to get stored procedure execution plan
                    const storedProcQuery = `
                        SELECT 
                            DB_NAME(ps.database_id) AS database_name,
                            OBJECT_NAME(ps.object_id, ps.database_id) AS procedure_name,
                            qp.query_plan
                        FROM sys.dm_exec_procedure_stats AS ps
                        CROSS APPLY sys.dm_exec_query_plan(ps.plan_handle) AS qp
                        WHERE OBJECT_NAME(ps.object_id, ps.database_id) = '${procedureName}'
                            AND DB_NAME(ps.database_id) = '${targetDatabase}'`;

                    const token = localStorage.getItem('token');
                    const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/agents/${agentId}/query`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json',
                            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                        },
                        credentials: 'include',
                        body: JSON.stringify({
                            query_id: 'mssql_stored_proc_execution_plan',
                            command: storedProcQuery,
                            database: targetDatabase
                        })
                    });

                    if (response.ok) {
                        const data = await response.json();
                        if (data.status === 'success' && data.result?.type_url === 'type.googleapis.com/google.protobuf.Value') {
                            try {
                                // Base64 decode
                                const decodedValue = atob(data.result.value);
                                // JSON parse
                                const parsedResult = JSON.parse(decodedValue);

                                // Extract query_plan from the result
                                if (parsedResult.status === 'success' && parsedResult.row_count > 0) {
                                    executionPlanXml = parsedResult['query_plan_0'] || '';
                                } else if (parsedResult.query_plan) {
                                    executionPlanXml = parsedResult.query_plan;
                                }

                                if (executionPlanXml) {
                                }
                            } catch (error) {
                                console.error('Error parsing stored procedure execution plan result:', error);
                            }
                        }
                    }
                }
            }

            // If not a stored procedure or no plan found, try the regular execution plan methods
            if (!executionPlanXml) {
                // Check if query has parameters (contains @ symbols)
                const hasParameters = cleanQuery.includes('@');

                if (hasParameters) {

                    // First, try to find similar queries in plan cache
                    const planCacheQuery = `
                        SELECT TOP 1
                            qp.query_plan,
                            qs.sql_handle,
                            qs.plan_handle
                        FROM sys.dm_exec_query_stats qs
                        CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) st
                        CROSS APPLY sys.dm_exec_query_plan(qs.plan_handle) qp
                        WHERE st.text LIKE '%${cleanQuery.replace(/@\w+/g, '%').substring(0, 50)}%'
                            AND st.text NOT LIKE '%sys.dm_exec%'
                        ORDER BY qs.last_execution_time DESC`;

                    try {
                        const token = localStorage.getItem('token');
                        const cacheResponse = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/agents/${agentId}/query`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Accept': 'application/json',
                                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                            },
                            credentials: 'include',
                            body: JSON.stringify({
                                query_id: 'mssql_plan_cache_search',
                                command: planCacheQuery,
                                database: targetDatabase
                            })
                        });

                        if (cacheResponse.ok) {
                            const cacheData = await cacheResponse.json();
                            if (cacheData.status === 'success' && cacheData.result?.type_url === 'type.googleapis.com/google.protobuf.Value') {
                                try {
                                    const decodedValue = atob(cacheData.result.value);
                                    const parsedResult = JSON.parse(decodedValue);

                                    if (parsedResult.status === 'success' && parsedResult.row_count > 0) {
                                        executionPlanXml = parsedResult['query_plan_0'] || '';
                                        if (executionPlanXml) {
                                        }
                                    }
                                } catch (error) {
                                    console.error('Error parsing plan cache result:', error);
                                }
                            }
                        }
                    } catch (error) {
                        console.warn('Plan cache search failed:', error);
                    }

                    // If still no plan, try with parameter substitution
                    if (!executionPlanXml) {
                        // Replace parameters with default values for analysis
                        let modifiedQuery = cleanQuery;

                        // Apply smarter parameter replacements
                        // ID parameters - use a realistic ID value
                        modifiedQuery = modifiedQuery.replace(/@\w*[Ii][Dd]\w*/gi, "123");
                        // Control/Status parameters - use realistic values
                        modifiedQuery = modifiedQuery.replace(/@\w*[Cc]ontrol\w*/gi, "1");
                        modifiedQuery = modifiedQuery.replace(/@\w*[Ss]tatus\w*/gi, "1");
                        // String parameters in equality comparisons
                        modifiedQuery = modifiedQuery.replace(/@\w+(?=\s*(?:=|<|>|LIKE|IN))/gi, "'SampleValue'");
                        // Numeric parameters in comparisons
                        modifiedQuery = modifiedQuery.replace(/@\w+(?=\s*(?:=|<|>|\+|-|\*|\/)\s*\d)/gi, "1");
                        // Remaining parameters - use more appropriate defaults
                        modifiedQuery = modifiedQuery.replace(/@\w+/gi, "1");

                        // Add explicit database context to help with table resolution
                        modifiedQuery = `USE [${targetDatabase}]; ${modifiedQuery}`;


                        // Try using STATISTICS XML instead of SET SHOWPLAN_XML to avoid batch restrictions
                        try {
                            const token = localStorage.getItem('token');
                            const explainResponse = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/agents/${agentId}/query`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Accept': 'application/json',
                                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                                },
                                credentials: 'include',
                                body: JSON.stringify({
                                    query_id: 'mssql_execution_plan_statistics',
                                    command: `USE [${targetDatabase}]; SET STATISTICS XML ON; ${modifiedQuery}; SET STATISTICS XML OFF;`,
                                    database: targetDatabase
                                })
                            });

                            if (explainResponse.ok) {
                                const explainData = await explainResponse.json();
                                if (explainData.result?.type_url === 'type.googleapis.com/google.protobuf.Value') {
                                    try {
                                        const decodedValue = atob(explainData.result.value);
                                        const parsedResult = JSON.parse(decodedValue);

                                        // Find execution plan XML
                                        for (const key in parsedResult) {
                                            if (key.includes('Execution') || key.includes('Plan') || key.includes('XML') ||
                                                (typeof parsedResult[key] === 'string' && parsedResult[key].includes('<ShowPlanXML'))) {
                                                executionPlanXml = parsedResult[key];
                                                break;
                                            }
                                        }
                                    } catch (error) {
                                        console.error('Error parsing STATISTICS XML result:', error);
                                    }
                                }
                            }
                        } catch (error) {
                            console.warn('STATISTICS XML method failed, trying alternative:', error);
                        }

                        // If EXPLAIN doesn't work, try with /mssql/explain endpoint for parameterized query
                        if (!executionPlanXml) {
                            try {
                                const explainEndpointResponse = await axios.post(
                                    `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/agents/${agentId}/mssql/explain`,
                                    {
                                        database: targetDatabase,
                                        query: modifiedQuery
                                    },
                                    {
                                        withCredentials: true,
                                        headers: {
                                            'Content-Type': 'application/json'
                                        }
                                    }
                                );

                                if (explainEndpointResponse.data?.plan) {
                                    try {
                                        // Parse the nested JSON response
                                        const planDataString = explainEndpointResponse.data.plan;
                                        const planData = JSON.parse(planDataString);
                                        if (planData.plan) {
                                            // Decode unicode characters and get the XML
                                            executionPlanXml = planData.plan.replace(/\\u003c/g, '<').replace(/\\u003e/g, '>');
                                        }
                                    } catch (parseError) {
                                        console.warn('Failed to parse nested JSON plan:', parseError);
                                        // Fallback: try using the plan directly
                                        executionPlanXml = explainEndpointResponse.data.plan;
                                    }
                                } else if (explainEndpointResponse.data?.data?.plan) {
                                    try {
                                        // Handle nested structure
                                        const planDataString = explainEndpointResponse.data.data.plan;
                                        const planData = JSON.parse(planDataString);
                                        if (planData.plan) {
                                            executionPlanXml = planData.plan.replace(/\\u003c/g, '<').replace(/\\u003e/g, '>');
                                        }
                                    } catch (parseError) {
                                        console.warn('Failed to parse nested JSON plan (nested):', parseError);
                                        executionPlanXml = explainEndpointResponse.data.data.plan;
                                    }
                                }
                            } catch (explainEndpointError) {
                                console.warn('/mssql/explain endpoint failed for parameterized query:', explainEndpointError);
                            }
                        }

                        // Last resort: try to create a minimal stored procedure approach
                        if (!executionPlanXml) {
                            try {
                                // Create a temporary query with DECLARE statements
                                const declarePart = cleanQuery.match(/@\w+/g)?.map(param => {
                                    const paramLower = param.toLowerCase();
                                    if (paramLower.includes('id')) {
                                        return `DECLARE ${param} INT = 123;`;
                                    } else if (paramLower.includes('control') || paramLower.includes('status')) {
                                        return `DECLARE ${param} INT = 1;`;
                                    } else if (paramLower.includes('count')) {
                                        return `DECLARE ${param} INT = 1;`;
                                    } else if (paramLower.includes('name') || paramLower.includes('text')) {
                                        return `DECLARE ${param} NVARCHAR(50) = 'SampleValue';`;
                                    } else {
                                        // Default to INT with value 1 for better optimization
                                        return `DECLARE ${param} INT = 1;`;
                                    }
                                }).join(' ') || '';

                                const wrappedQuery = `USE [${targetDatabase}]; ${declarePart} ${cleanQuery}`;


                                const token = localStorage.getItem('token');
                                const declareResponse = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/agents/${agentId}/query`, {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Accept': 'application/json',
                                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                                    },
                                    credentials: 'include',
                                    body: JSON.stringify({
                                        query_id: 'mssql_execution_plan_declare',
                                        command: `SET SHOWPLAN_XML ON\nGO\n${wrappedQuery}\nGO\nSET SHOWPLAN_XML OFF`,
                                        database: targetDatabase
                                    })
                                });

                                if (declareResponse.ok) {
                                    const declareData = await declareResponse.json();
                                    if (declareData.result?.type_url === 'type.googleapis.com/google.protobuf.Value') {
                                        try {
                                            const decodedValue = atob(declareData.result.value);
                                            const parsedResult = JSON.parse(decodedValue);

                                            // Find execution plan XML
                                            for (const key in parsedResult) {
                                                if (key.includes('Execution') || key.includes('Plan') || key.includes('XML') ||
                                                    (typeof parsedResult[key] === 'string' && parsedResult[key].includes('<ShowPlanXML'))) {
                                                    executionPlanXml = parsedResult[key];
                                                    break;
                                                }
                                            }
                                        } catch (error) {
                                            console.error('Error parsing DECLARE result:', error);
                                        }
                                    }
                                }
                            } catch (error) {
                                console.warn('DECLARE approach failed:', error);
                            }
                        }
                    }
                }

                // Try the /mssql/explain endpoint for non-parameterized queries
                if (!executionPlanXml && !hasParameters) {
                    try {
                        // Add database context for better table resolution
                        const contextualQuery = `USE [${targetDatabase}]; ${cleanQuery}`;

                        const response = await axios.post(
                            `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/agents/${agentId}/mssql/explain`,
                            {
                                database: targetDatabase,
                                query: contextualQuery
                            },
                            {
                                withCredentials: true,
                                headers: {
                                    'Content-Type': 'application/json'
                                }
                            }
                        );

                        if (response.data?.plan) {
                            try {
                                // Parse the nested JSON response
                                const planDataString = response.data.plan;
                                const planData = JSON.parse(planDataString);
                                if (planData.plan) {
                                    // Decode unicode characters and get the XML
                                    executionPlanXml = planData.plan.replace(/\\u003c/g, '<').replace(/\\u003e/g, '>');
                                }
                            } catch (parseError) {
                                console.warn('Failed to parse nested JSON plan for non-parameterized query:', parseError);
                                // Fallback: try using the plan directly
                                executionPlanXml = response.data.plan;
                            }
                        } else if (response.data?.data?.plan) {
                            try {
                                // Handle nested structure
                                const planDataString = response.data.data.plan;
                                const planData = JSON.parse(planDataString);
                                if (planData.plan) {
                                    executionPlanXml = planData.plan.replace(/\\u003c/g, '<').replace(/\\u003e/g, '>');
                                }
                            } catch (parseError) {
                                console.warn('Failed to parse nested JSON plan (nested) for non-parameterized query:', parseError);
                                executionPlanXml = response.data.data.plan;
                            }
                        }
                    } catch (explainError) {
                        console.warn('mssql/explain endpoint failed:', explainError);
                    }
                }

                // Final fallback: try SHOWPLAN_XML for simple queries
                if (!executionPlanXml && !hasParameters) {
                    const token = localStorage.getItem('token');
                    const directResponse = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/agents/${agentId}/query`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json',
                            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                        },
                        credentials: 'include',
                        body: JSON.stringify({
                            query_id: 'mssql_execution_plan_direct',
                            command: `USE [${targetDatabase}]; SET SHOWPLAN_XML ON; ${cleanQuery}; SET SHOWPLAN_XML OFF;`,
                            database: targetDatabase
                        })
                    });

                    if (directResponse.ok) {
                        const directData = await directResponse.json();
                        if (directData.result?.type_url === 'type.googleapis.com/google.protobuf.Value') {
                            try {
                                const decodedValue = atob(directData.result.value);
                                const parsedResult = JSON.parse(decodedValue);

                                // Find execution plan XML
                                for (const key in parsedResult) {
                                    if (key.includes('Execution') || key.includes('Plan') || key.includes('XML') ||
                                        (typeof parsedResult[key] === 'string' && parsedResult[key].includes('<ShowPlanXML'))) {
                                        executionPlanXml = parsedResult[key];
                                        break;
                                    }
                                }
                            } catch (error) {
                                console.error('Error parsing direct execution plan result:', error);
                            }
                        }
                    }
                }
            }

            // İlk olarak yükleme modalını kaldır
            Modal.destroyAll();

            if (executionPlanXml && executionPlanXml.includes('<ShowPlanXML')) {
                // Ensure all unicode characters are properly decoded
                const cleanXml = executionPlanXml
                    .replace(/\\u003c/g, '<')
                    .replace(/\\u003e/g, '>')
                    .replace(/\\n/g, '\n')
                    .replace(/\\"/g, '"')
                    .replace(/\\\\/g, '\\');

                setExecutionPlanData(cleanXml);
                setExecutionPlanVisible(true);
            } else {
                throw new Error('No valid execution plan XML found in response');
            }

        } catch (error) {
            console.error('Error fetching execution plan:', error);
            message.error('Failed to fetch execution plan information');
            Modal.destroyAll();
        } finally {
            setExecutionPlanLoading(false);
        }
    };

    // Index Usage React Query kullanımı
    const indexUsageQuery = useIndexUsageQuery(nodeName, selectedDatabase);

    // Fetch Connection Analysis Data
    const fetchConnectionAnalysis = async (nodeName: string) => {
        if (!nodeName) return;

        try {
            setConnectionAnalysisLoading(true);
            const agentId = `agent_${nodeName}`;

            const url = `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/agents/${agentId}/mssql/bestpractices`;

            const token = localStorage.getItem('token');
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to load connection analysis');
            }

            const data = await response.json();

            if (data && data.status === "success" && data.results) {
                // Process connection analysis results
                const results = data.results;

                // Extract connection analysis data
                const connectionAnalysis = {
                    summary: {
                        connection_health: results['ConnectionAnalysis_summary_connection_health'] || 'Unknown',
                        total_connections: results['ConnectionAnalysis_summary_total_connections'] || 0,
                        total_active_connections: results['ConnectionAnalysis_summary_total_active_connections'] || 0,
                        total_idle_connections: results['ConnectionAnalysis_summary_total_idle_connections'] || 0,
                        global_idle_percentage: results['ConnectionAnalysis_summary_global_idle_percentage'] || 0,
                        suspicious_applications_count: results['ConnectionAnalysis_summary_suspicious_applications_count'] || 0,
                    },
                    connections_by_application: [] as any[],
                    top_connection_consumers: [] as any[]
                };

                // Process connections by application
                const connectionsByAppCount = results['ConnectionAnalysis_connections_by_application_count'] || 0;
                for (let i = 0; i < connectionsByAppCount; i++) {
                    connectionAnalysis.connections_by_application.push({
                        program_name: results[`ConnectionAnalysis_connections_by_application_${i}_program_name`] || '',
                        host_name: results[`ConnectionAnalysis_connections_by_application_${i}_host_name`] || '',
                        total_connection_count: results[`ConnectionAnalysis_connections_by_application_${i}_total_connection_count`] || 0,
                        active_connection_count: results[`ConnectionAnalysis_connections_by_application_${i}_active_connection_count`] || 0,
                        idle_connection_count: results[`ConnectionAnalysis_connections_by_application_${i}_idle_connection_count`] || 0,
                        idle_percentage: results[`ConnectionAnalysis_connections_by_application_${i}_idle_percentage`] || 0,
                        connection_efficiency: results[`ConnectionAnalysis_connections_by_application_${i}_connection_efficiency`] || 'Unknown'
                    });
                }

                // Process top connection consumers
                const topConsumersCount = results['ConnectionAnalysis_top_connection_consumers_count'] || 0;
                for (let i = 0; i < topConsumersCount; i++) {
                    connectionAnalysis.top_connection_consumers.push({
                        program_name: results[`ConnectionAnalysis_top_connection_consumers_${i}_program_name`] || '',
                        host_name: results[`ConnectionAnalysis_top_connection_consumers_${i}_host_name`] || '',
                        total_connection_count: results[`ConnectionAnalysis_top_connection_consumers_${i}_total_connection_count`] || 0,
                        idle_connection_count: results[`ConnectionAnalysis_top_connection_consumers_${i}_idle_connection_count`] || 0,
                        idle_percentage: results[`ConnectionAnalysis_top_connection_consumers_${i}_idle_percentage`] || 0
                    });
                }

                setConnectionAnalysisData(connectionAnalysis);
            }
        } catch (error) {
            console.error('Error fetching connection analysis:', error);
            // Don't show error message as this is an optional feature
        } finally {
            setConnectionAnalysisLoading(false);
        }
    };

    // Main render
    return (
        <div style={{ padding: '24px' }}>
            <Card
                style={{
                    marginBottom: '24px',
                    border: '1px solid #d9d9d9',
                    borderRadius: '8px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                }}
                className="dashboard-card"
            >
                <div style={{
                    borderBottom: '1px solid #d9d9d9',
                    marginBottom: '16px',
                    paddingBottom: '8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        <MssqlIcon size="24" color="#cc2927" />
                        <Typography.Title level={4} style={{ margin: 0 }}>MSSQL Performance Analytics</Typography.Title>
                    </div>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                        <span style={{ marginRight: '8px' }}>Refresh Interval:</span>
                        <Select
                            value={refreshInterval}
                            onChange={setRefreshInterval}
                            style={{ width: 70 }}
                        >
                            <Option value={0}>Off</Option>
                            <Option value={10}>10s</Option>
                            <Option value={20}>20s</Option>
                            <Option value={30}>30s</Option>
                        </Select>
                        {refreshInterval > 0 && (
                            <Badge count={countdown} offset={[-5, -30]} style={{ backgroundColor: '#cc2927' }} />
                        )}
                    </div>
                </div>

                <Steps current={currentStep}>
                    <Step title="Select Cluster" />
                    <Step title="Select Node" />
                    {activeTab === '3' && <Step title="Select Database" />}
                </Steps>

                <Row justify="center" align="middle" style={{ marginTop: 20 }}>
                    <Col span={8} style={{ paddingRight: '10px' }}>
                        <div style={{
                            borderRadius: '8px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                            overflow: 'hidden',
                            border: '1px solid #f0f0f0'
                        }}>
                            <div style={{
                                padding: '8px 12px',
                                background: 'linear-gradient(90deg, #fff0f0 0%, #fff5f5 100%)',
                                borderBottom: '1px solid #f0f0f0',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}>
                                <DatabaseOutlined style={{ color: '#cc2927' }} />
                                <span style={{ fontWeight: 500, color: '#595959' }}>MSSQL Cluster</span>
                            </div>
                            <div style={{ padding: '12px' }}>
                                <Select
                                    showSearch
                                    value={clusterName}
                                    onChange={setClusterName}
                                    style={{ width: '100%' }}
                                    placeholder="Select a MSSQL cluster"
                                    filterOption={(input, option) =>
                                        option?.children
                                            ? option.children.toString().toLowerCase().includes(input.toLowerCase())
                                            : false
                                    }
                                    loading={isLoading}
                                    size="large"
                                    suffixIcon={<CaretDownOutlined style={{ color: '#cc2927' }} />}
                                    dropdownStyle={{ boxShadow: '0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 9px 28px 8px rgba(0, 0, 0, 0.05)' }}
                                >
                                    {clusterNames.map((name, index) => {
                                        // Get the correct data for node count display
                                        const clusterData = name === 'Standalone' ? data['Standalone'] || data[''] : data[name];
                                        return (
                                            <Option key={`cluster-${name}-${index}`} value={name} style={{ padding: '8px 12px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                    <span style={{ fontWeight: 500 }}>
                                                        {name === 'Standalone' ? 'Standalone MSSQL Instance' : name}
                                                    </span>
                                                    {name === 'Standalone' && (
                                                        <Tag color="green" style={{ margin: 0, fontSize: '11px' }}>
                                                            Single Node
                                                        </Tag>
                                                    )}
                                                    {clusterData && clusterData.length > 1 && (
                                                        <Tag color="blue" style={{ margin: 0, fontSize: '11px' }}>
                                                            {clusterData.length} Nodes
                                                        </Tag>
                                                    )}
                                                </div>
                                            </Option>
                                        );
                                    })}
                                </Select>
                            </div>
                        </div>
                    </Col>

                    <Col span={8} style={{ paddingRight: '10px' }}>
                        <div style={{
                            borderRadius: '8px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                            overflow: 'hidden',
                            border: '1px solid #f0f0f0'
                        }}>
                            <div style={{
                                padding: '8px 12px',
                                background: 'linear-gradient(90deg, #fff0f0 0%, #fff5f5 100%)',
                                borderBottom: '1px solid #f0f0f0',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}>
                                <ClusterOutlined style={{ color: '#cc2927' }} />
                                <span style={{ fontWeight: 500, color: '#595959' }}>Database Node</span>
                            </div>
                            <div style={{ padding: '12px' }}>
                                <Select
                                    value={nodeName}
                                    onChange={handleNodeChange}
                                    style={{ width: '100%' }}
                                    loading={loading}
                                    showSearch
                                    placeholder="Select a database node"
                                    size="large"
                                    suffixIcon={<CaretDownOutlined style={{ color: '#cc2927' }} />}
                                    notFoundContent={
                                        clusterName
                                            ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No nodes found" />
                                            : <div style={{ textAlign: 'center', padding: '12px' }}>Please select a cluster first</div>
                                    }
                                    dropdownStyle={{ boxShadow: '0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 9px 28px 8px rgba(0, 0, 0, 0.05)' }}
                                    disabled={!clusterName}
                                >
                                    {nodeInfo.map(node => (
                                        <Option key={node.Hostname} value={node.Hostname} style={{ padding: '8px 12px' }}>
                                            <Space>
                                                {node.NodeStatus === "OK" ?
                                                    <Badge status="success" text={null} /> :
                                                    <Badge status="warning" text={null} />
                                                }
                                                <span style={{ fontWeight: 500 }}>{node.Hostname}</span>
                                                <Tag color={node.NodeStatus === "OK" ? "green" : "orange"} style={{ marginLeft: 'auto' }}>
                                                    {node.NodeStatus || 'Unknown'}
                                                </Tag>
                                                <Tag color="blue">{node.Version || 'Unknown'}</Tag>
                                                {node.Edition && <Tag color="purple">{node.Edition}</Tag>}
                                                {node.HARole && <Tag color="cyan">{node.HARole}</Tag>}
                                            </Space>
                                        </Option>
                                    ))}
                                </Select>
                            </div>
                        </div>
                    </Col>

                    {activeTab === '3' && (
                        <Col span={8} style={{ paddingRight: '10px' }}>
                            <div style={{
                                borderRadius: '8px',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                                overflow: 'hidden',
                                border: '1px solid #f0f0f0'
                            }}>
                                <div style={{
                                    padding: '8px 12px',
                                    background: 'linear-gradient(90deg, #fff0f0 0%, #fff5f5 100%)',
                                    borderBottom: '1px solid #f0f0f0',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}>
                                    <DatabaseOutlined style={{ color: '#cc2927' }} />
                                    <span style={{ fontWeight: 500, color: '#595959' }}>Database</span>
                                </div>
                                <div style={{ padding: '12px' }}>
                                    <Select
                                        value={selectedDatabase}
                                        onChange={handleDatabaseChange}
                                        style={{ width: '100%' }}
                                        loading={loading}
                                        showSearch
                                        placeholder="Select a database"
                                        size="large"
                                        suffixIcon={<CaretDownOutlined style={{ color: '#cc2927' }} />}
                                        dropdownStyle={{ boxShadow: '0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 9px 28px 8px rgba(0, 0, 0, 0.05)' }}
                                        disabled={!nodeName}
                                    >
                                        {databaseNames.map((name, index) => (
                                            <Option key={`db-${name}-${index}`} value={name} style={{ padding: '8px 12px' }}>
                                                <Space>
                                                    <DatabaseOutlined style={{ color: '#cc2927' }} />
                                                    <span style={{ fontWeight: 500 }}>{name}</span>
                                                </Space>
                                            </Option>
                                        ))}
                                    </Select>
                                </div>
                            </div>
                        </Col>
                    )}
                </Row>
            </Card>

            <Layout style={{
                background: '#fff',
                padding: '0',
                minHeight: '500px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                borderRadius: '8px',
                border: '1px solid #d9d9d9'
            }}>
                <Tabs
                    activeKey={activeTab}
                    onChange={(key) => {
                        setActiveTab(key);
                        // Set default submenu for each tab
                        if (key === '1') handleSubMenuClick('server-info');
                        else if (key === '2') handleSubMenuClick('top-queries');
                        else if (key === '3') handleSubMenuClick('index-usage');
                        else if (key === '4') handleSubMenuClick('system-metrics');
                        else if (key === '5') handleSubMenuClick('performance-metrics');
                        else if (key === '6') handleSubMenuClick('transaction-metrics');
                    }}
                    style={{
                        margin: '0',
                        padding: '8px 16px 0'
                    }}
                    tabBarStyle={{
                        marginBottom: 0,
                        color: '#cc2927',
                        fontWeight: '500'
                    }}
                    items={[
                        {
                            key: '1',
                            label: <span style={{ padding: '0 8px' }}><TeamOutlined /> Server</span>,
                            children: null
                        },
                        {
                            key: '2',
                            label: <span style={{ padding: '0 8px' }}><BarChartOutlined /> Queries</span>,
                            children: null
                        },
                        {
                            key: '3',
                            label: <span style={{ padding: '0 8px' }}><DatabaseOutlined /> Databases</span>,
                            children: null
                        },
                        {
                            key: '4',
                            label: <span style={{ padding: '0 8px' }}><SettingOutlined /> System</span>,
                            children: null
                        },
                        {
                            key: '5',
                            label: <span style={{ padding: '0 8px' }}><BarChartOutlined /> Performance</span>,
                            children: null
                        },
                        {
                            key: '6',
                            label: <span style={{ padding: '0 8px' }}><DatabaseOutlined /> Transactions</span>,
                            children: null
                        }
                    ]}
                />

                {activeTab === '1' && (
                    <Card style={{ borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderRadius: 0 }}>
                        <Tabs
                            activeKey={selectedSubMenu}
                            onChange={handleSubMenuClick}
                            tabBarStyle={{ color: '#cc2927' }}
                            items={[
                                {
                                    key: 'server-info',
                                    label: 'Server Information',
                                    children: renderServerTab()
                                },
                                {
                                    key: 'connections',
                                    label: 'Connections',
                                    children: renderServerTab()
                                }
                            ]}
                        />
                    </Card>
                )}

                {activeTab === '2' && (
                    <Card style={{ borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderRadius: 0 }}>
                        <Tabs
                            activeKey={selectedSubMenu}
                            onChange={handleSubMenuClick}
                            tabBarStyle={{ color: '#cc2927' }}
                            items={[
                                {
                                    key: 'top-queries',
                                    label: 'Top Queries',
                                    children: renderQueriesTab()
                                },
                                {
                                    key: 'active-queries',
                                    label: 'Active Queries',
                                    children: renderQueriesTab()
                                },
                                {
                                    key: 'blocking',
                                    label: 'Blocking Sessions',
                                    children: renderQueriesTab()
                                },
                                {
                                    key: 'wait-stats',
                                    label: 'Wait Statistics',
                                    children: renderQueriesTab()
                                }
                            ]}
                        />
                    </Card>
                )}

                {activeTab === '3' && (
                    <Card style={{ borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderRadius: 0 }}>
                        <Tabs
                            activeKey={selectedSubMenu}
                            onChange={handleSubMenuClick}
                            tabBarStyle={{ color: '#cc2927' }}
                            items={[
                                {
                                    key: 'index-usage',
                                    label: 'Index Usage',
                                    children: renderDatabaseTab()
                                },
                                {
                                    key: 'database-stats',
                                    label: 'Database Statistics',
                                    children: renderDatabaseTab()
                                },
                                {
                                    key: 'backup-status',
                                    label: 'Backups',
                                    children: renderDatabaseTab()
                                },
                                {
                                    key: 'capacity-planning',
                                    label: 'Capacity Planning',
                                    children: renderDatabaseTab()
                                }
                            ]}
                        />
                    </Card>
                )}

                {activeTab === '4' && (
                    <Card style={{ borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderRadius: 0 }}>
                        {renderSystemTab()}
                    </Card>
                )}

                {activeTab === '5' && (
                    <Card style={{ borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderRadius: 0 }}>
                        {renderPerformanceTab()}
                    </Card>
                )}

                {activeTab === '6' && (
                    <Card style={{ borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderRadius: 0 }}>
                        {renderTransactionsTab()}
                    </Card>
                )}
            </Layout>

            {/* Modal for displaying query details */}
            <Modal
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileTextOutlined style={{ color: '#cc2927' }} />
                        <span>{modalTitle}</span>
                    </div>
                }
                open={modalVisible}
                onCancel={() => setModalVisible(false)}
                footer={[
                    <Button
                        key="copy-formatted"
                        icon={<CopyOutlined />}
                        onClick={() => {
                            navigator.clipboard.writeText(formatSqlQuery(modalContent));
                            message.success('Formatted query copied to clipboard');
                        }}
                    >
                        Copy Formatted
                    </Button>,
                    <Button
                        key="copy-original"
                        icon={<CopyOutlined />}
                        onClick={() => {
                            navigator.clipboard.writeText(modalContent);
                            message.success('Original query copied to clipboard');
                        }}
                    >
                        Copy Original
                    </Button>,
                    <Button
                        key="analyze"
                        type="primary"
                        icon={<RobotOutlined />}
                        onClick={() => {
                            handleAIAnalysis(modalContent);
                        }}
                        style={{ background: '#1677ff' }}
                    >
                        Analyze with AI
                    </Button>,
                    <Button
                        key="plan"
                        type="primary"
                        icon={<LineChartOutlined />}
                        onClick={() => {
                            fetchExecutionPlan(modalContent, modalDatabase);
                        }}
                        style={{ background: '#722ed1' }}
                    >
                        View Execution Plan
                    </Button>,
                    <Button key="close" onClick={() => setModalVisible(false)}>
                        Close
                    </Button>
                ]}
                width={800}
                styles={{
                    body: {
                        padding: '16px',
                        maxHeight: '70vh',
                        overflow: 'auto'
                    }
                }}
            >
                <div
                    style={{
                        background: '#1e1e1e',
                        padding: '16px',
                        borderRadius: '8px',
                        maxHeight: '60vh',
                        overflow: 'auto'
                    }}
                >
                    <SyntaxHighlighter
                        language="sql"
                        style={atomOneDark}
                        showLineNumbers={true}
                        customStyle={{
                            fontSize: '14px',
                            margin: 0,
                            backgroundColor: 'transparent'
                        }}
                        lineNumberStyle={{
                            color: '#666',
                            paddingRight: '1em',
                            borderRight: '1px solid #444',
                            marginRight: '1em'
                        }}
                        wrapLongLines={true}
                    >
                        {formatSqlQuery(modalContent)}
                    </SyntaxHighlighter>
                </div>
            </Modal>

            {/* Modal for displaying execution plan */}
            <Modal
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <LineChartOutlined style={{ color: '#cc2927' }} />
                        <span>SQL Server Execution Plan</span>
                    </div>
                }
                open={executionPlanVisible}
                onCancel={() => setExecutionPlanVisible(false)}
                footer={[
                    <Button
                        key="copy"
                        icon={<CopyOutlined />}
                        onClick={() => {
                            navigator.clipboard.writeText(executionPlanData);
                            message.success('Execution plan copied to clipboard');
                        }}
                    >
                        Copy XML
                    </Button>,
                    <Button key="close" onClick={() => setExecutionPlanVisible(false)}>
                        Close
                    </Button>
                ]}
                width={900}
                style={{ top: 20 }}
            >
                <Tabs defaultActiveKey="visual">
                    <Tabs.TabPane tab="Visual Plan" key="visual">
                        <div style={{ marginBottom: '16px' }}>
                            {/* Extract plan XML from JSON response if needed */}
                            {(() => {
                                let planXml = executionPlanData;

                                try {
                                    // Check if it's a JSON string with a plan property
                                    if (typeof executionPlanData === 'string' &&
                                        executionPlanData.trim().startsWith('{') &&
                                        executionPlanData.includes('"plan"')) {

                                        const jsonObj = JSON.parse(executionPlanData);
                                        if (jsonObj.plan) {
                                            planXml = jsonObj.plan;
                                        }
                                    }
                                } catch (error) {
                                    console.warn('Failed to parse JSON plan:', error);
                                }

                                return <ExecutionPlanVisualizer xmlPlan={planXml} />;
                            })()}
                        </div>
                    </Tabs.TabPane>

                    <Tabs.TabPane tab="Plan Details" key="details">
                        <div style={{ marginBottom: '16px' }}>
                            {/* Extract plan XML from JSON response if needed */}
                            {(() => {
                                let planXml = executionPlanData;

                                try {
                                    // Check if it's a JSON string with a plan property
                                    if (typeof executionPlanData === 'string' &&
                                        executionPlanData.trim().startsWith('{') &&
                                        executionPlanData.includes('"plan"')) {

                                        const jsonObj = JSON.parse(executionPlanData);
                                        if (jsonObj.plan) {
                                            planXml = jsonObj.plan;
                                        }
                                    }
                                } catch (error) {
                                    console.warn('Failed to parse JSON plan for details:', error);
                                }

                                return <ExecutionPlanSummary xmlPlan={planXml} />;
                            })()}
                        </div>
                    </Tabs.TabPane>

                    <Tabs.TabPane tab="Raw XML" key="xml">
                        <div style={{ marginBottom: '16px' }}>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '12px'
                            }}>
                                <Button
                                    type="primary"
                                    icon={<RobotOutlined />}
                                    onClick={() => handleExecutionPlanAIAnalysis(executionPlanData)}
                                >
                                    AI Analysis
                                </Button>
                            </div>

                            <pre style={{
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                backgroundColor: '#002b36',
                                color: '#839496',
                                padding: '16px',
                                borderRadius: '4px',
                                maxHeight: '60vh',
                                overflow: 'auto',
                                fontSize: '14px'
                            }}>
                                {executionPlanData}
                            </pre>
                        </div>
                    </Tabs.TabPane>
                </Tabs>
            </Modal>


        </div>
    );
};

export default MssqlPAWrapper; 