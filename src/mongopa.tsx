import React, { useState, useEffect } from 'react';
import { Select, message, Modal, Steps, Row, Col, Card, Progress, Spin, Input, Pagination, Typography, TimePicker, Button, Statistic, Tooltip, Tag, Layout, Tabs, Space, Menu, List, Alert, DatePicker, Radio, Divider, Drawer, Descriptions, Empty, Badge, Table, InputNumber, Checkbox } from 'antd';
import axios from 'axios';
import { useLocation } from 'react-router-dom';
import { CopyOutlined, ReloadOutlined, InfoCircleOutlined, DownloadOutlined, DatabaseOutlined, BarChartOutlined, SettingOutlined, UserOutlined, TeamOutlined, RobotOutlined, FileSearchOutlined, DeleteOutlined, FileTextOutlined, LineChartOutlined, ClusterOutlined, CaretDownOutlined } from '@ant-design/icons';
import { Dayjs } from 'dayjs';
import CountUp from 'react-countup';
import MonacoEditor from './monacoeditor';
import { store } from './redux/store';
import { incrementUsage } from './redux/aiLimitSlice';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import AIAnalysisRenderer from './components/AIAnalysisRenderer';
import { useQuery, useQueryClient, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area, Legend } from 'recharts';
import IconMongo from './icons/mongo';

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
    MongoVersion?: string;
    MongoStatus?: string;
    ReplicaSetName?: string;
    IsPrimary?: boolean;
    ClusterName?: string;
    IP?: string;
    Port?: string;
    Location?: string;
}

interface ClusterData {
    [key: string]: Node[];
}

// Result interfaces for MongoDB queries
interface QueryResultServerInfo {
    version: string;
    host: string;
    process: string;
    pid: number;
    uptime: number;
    uptimeMillis: number;
    uptimeEstimate: number;
    localTime: string;
    storageEngine: string;
    repl?: {
        setName: string;
        ismaster: boolean;
        secondary: boolean;
        primary: string;
        me: string;
        hosts: string[];
    };
    sharding?: {
        configsvrConnectionString: string;
        lastSeenConfigServerOpTime: any;
        maxChunkSizeInBytes: number;
    };
}

interface QueryResultConnections {
    current: number;
    available: number;
    totalCreated: number;
    active: number;
    inactive: number;
    exhaustIsMaster: number;
    exhaustHello: number;
    awaitingTopologyChanges: number;
}

interface QueryResultDatabaseStats {
    db: string;
    collections: number;
    views: number;
    objects: number;
    avgObjSize: number;
    dataSize: number;
    storageSize: number;
    indexes: number;
    indexSize: number;
    totalSize: number;
    scaleFactor: number;
    fsUsedSize: number;
    fsTotalSize: number;
}

interface QueryResultCollectionStats {
    ns: string;
    size: number;
    count: number;
    avgObjSize: number;
    storageSize: number;
    nindexes: number;
    totalIndexSize: number;
    indexSizes: { [key: string]: number };
    capped: boolean;
    wiredTiger?: any;
}

interface QueryResultOperationStats {
    insert: number;
    query: number;
    update: number;
    delete: number;
    getmore: number;
    command: number;
}

interface QueryResultCurrentOps {
    inprog: Array<{
        opid: number;
        active: boolean;
        secs_running: number;
        microsecs_running: number;
        op: string;
        ns: string;
        command: any;
        client: string;
        appName?: string;
        connectionId: number;
        currentOpTime: string;
        waitingForLock: boolean;
        lockStats?: any;
        planSummary?: string;
        numYields?: number;
        desc?: string;
        host?: string;
        threaded?: boolean;
        type?: string;
        effectiveUsers?: Array<{ user: string; db: string }>;
        clientMetadata?: any;
        cursor?: any;
        lsid?: any;
        locks?: any;
        waitingForFlowControl?: boolean;
        flowControlStats?: any;
    }>;
}

interface QueryResultReplicationStatus {
    set: string;
    date: string;
    myState: number;
    term: number;
    syncSourceHost: string;
    syncSourceId: number;
    heartbeatIntervalMillis: number;
    majorityVoteCount: number;
    writeMajorityCount: number;
    votingMembersCount: number;
    writableVotingMembersCount: number;
    members: Array<{
        _id: number;
        name: string;
        health: number;
        state: number;
        stateStr: string;
        uptime: number;
        optime: any;
        optimeDate: string;
        syncSourceHost: string;
        syncSourceId: number;
        infoMessage?: string;
        electionTime?: any;
        electionDate?: string;
        configVersion: number;
        configTerm: number;
        self?: boolean;
    }>;
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
    database?: string;
    collection?: string;
}

interface MetricsResponse {
    data: MetricDataPoint[];
    status: string;
}

interface ChartDataPoint {
    time: string;
    timestamp?: number;
    operations_insert?: number;
    operations_query?: number;
    operations_update?: number;
    operations_delete?: number;
    operations_getmore?: number;
    operations_command?: number;
    cpu_usage?: number;
    cpu_cores?: number;
    memory_usage?: number;
    memory_total?: number;
    free_memory?: number;
    used_memory?: number;
    disk_usage?: number;
    disk_total?: number;
    free_disk?: number;
    used_disk?: number;
    disk_usage_percent?: number;
    oplog_count?: number;
    oplog_max_size_mb?: number;
    oplog_size_mb?: number;
    oplog_storage_mb?: number;
    oplog_utilization_percent?: number;
    oplog_first_entry_timestamp?: number;
    oplog_last_entry_timestamp?: number;
    oplog_safe_downtime_hours?: number;
    oplog_time_window_hours?: number;
    oplog_time_window_seconds?: number;
    [key: string]: any;
}

interface ReplicationSummary {
    avg_replication_lag_seconds: number;
    latest_replication_lag_seconds: number;
    latest_timestamp: string;
    max_replication_lag_seconds: number;
    min_replication_lag_seconds: number;
    total_measurements: number;
}

interface ReplicationMetricsResponse {
    data: {
        agent_id: string;
        all_data: MetricDataPoint[];
        summary: ReplicationSummary;
    };
    status: string;
}

interface OplogMetrics {
    oplog_count: number;
    oplog_max_size_mb: number;
    oplog_size_mb: number;
    oplog_storage_mb: number;
    oplog_utilization_percent: number;
    oplog_first_entry_timestamp: number;
    oplog_last_entry_timestamp: number;
    oplog_safe_downtime_hours: number;
    oplog_time_window_hours: number;
    oplog_time_window_seconds: number;
}

interface OplogMetricsResponse {
    data: MetricDataPoint[];
    status: string;
}

interface OperationSummary {
    total_ops_per_sec: number;
    operations_tracked: number;
    data_points: number;
    peak_command_rate: number;
    peak_update_rate: number;
    peak_query_rate: number;
    peak_getmore_rate: number;
    peak_insert_rate: number;
    peak_delete_rate: number;
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

function formatUptime(uptimeSeconds: number): string {
    const days = Math.floor(uptimeSeconds / 86400);
    const hours = Math.floor((uptimeSeconds % 86400) / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = uptimeSeconds % 60;

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0) parts.push(`${seconds}s`);

    return parts.join(' ') || '0s';
}

function formatTimestamp(timestamp: number): string {
    if (!timestamp || timestamp === 0) return 'N/A';
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
}

function formatHours(hours: number): string {
    if (hours < 1) {
        return `${Math.round(hours * 60)}m`;
    } else if (hours < 24) {
        return `${hours.toFixed(1)}h`;
    } else {
        const days = Math.floor(hours / 24);
        const remainingHours = hours % 24;
        return `${days}d ${remainingHours.toFixed(1)}h`;
    }
}

// MongoDB Icon component - proper MongoDB leaf logo
const MongoIcon: React.FC<{ size?: number }> = ({ size = 24 }) => (
    <IconMongo size={size.toString()} color="#47A248" />
);

// Main component wrapper with React Query
const MongoPAWrapper: React.FC = () => {
    return (
        <QueryClientProvider client={queryClient}>
            <MongoPA />
        </QueryClientProvider>
    );
};

// Main component
const MongoPA: React.FC = () => {
    // State variables
    const [clusterName, setClusterName] = useState<string>('');
    const [clusterNames, setClusterNames] = useState<string[]>([]);
    const [loadingClusterName, setLoadingClusterName] = useState<boolean>(true);
    const [data, setData] = useState<Record<string, Node[]>>({});
    const [nodeInfo, setNodeInfo] = useState<Node[]>([]);
    const [nodeName, setNodeName] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [currentStep, setCurrentStep] = useState<number>(0);
    const [databaseNames, setDatabaseNames] = useState<string[]>([]);
    const [selectedDatabase, setSelectedDatabase] = useState<string>('');
    const [activeTab, setActiveTab] = useState<string>('1');
    const [selectedSubMenu, setSelectedSubMenu] = useState<string>('connections');
    const [serverInfo, setServerInfo] = useState<QueryResultServerInfo | null>(null);
    const [connections, setConnections] = useState<QueryResultConnections | null>(null);
    const [databaseStats, setDatabaseStats] = useState<QueryResultDatabaseStats[]>([]);
    const [collectionStats, setCollectionStats] = useState<QueryResultCollectionStats[]>([]);
    const [operationStats, setOperationStats] = useState<QueryResultOperationStats | null>(null);
    const [operationSummary, setOperationSummary] = useState<OperationSummary | null>(null);
    const [currentOps, setCurrentOps] = useState<QueryResultCurrentOps | null>(null);
    const [replicationStatus, setReplicationStatus] = useState<QueryResultReplicationStatus | null>(null);
    const [replicationSummary, setReplicationSummary] = useState<ReplicationSummary | null>(null);
    const [oplogMetrics, setOplogMetrics] = useState<OplogMetrics | null>(null);
    const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
    const [refreshInterval, setRefreshInterval] = useState<number>(0); // 0 means no auto-refresh
    const [countdown, setCountdown] = useState<number>(0);

    // Historical metrics state
    const [cpuHistoricalData, setCpuHistoricalData] = useState<ChartDataPoint[]>([]);
    const [memoryHistoricalData, setMemoryHistoricalData] = useState<ChartDataPoint[]>([]);
    const [connectionsHistoricalData, setConnectionsHistoricalData] = useState<ChartDataPoint[]>([]);
    const [operationsHistoricalData, setOperationsHistoricalData] = useState<ChartDataPoint[]>([]);
    const [databaseHistoricalData, setDatabaseHistoricalData] = useState<ChartDataPoint[]>([]);
    const [replicationHistoricalData, setReplicationHistoricalData] = useState<ChartDataPoint[]>([]);
    const [oplogHistoricalData, setOplogHistoricalData] = useState<ChartDataPoint[]>([]);
    const [systemCpuHistoricalData, setSystemCpuHistoricalData] = useState<ChartDataPoint[]>([]);
    const [systemMemoryHistoricalData, setSystemMemoryHistoricalData] = useState<ChartDataPoint[]>([]);
    const [systemDiskHistoricalData, setSystemDiskHistoricalData] = useState<ChartDataPoint[]>([]);
    const [historicalDataLoading, setHistoricalDataLoading] = useState<boolean>(false);
    const [cpuDataLoading, setCpuDataLoading] = useState<boolean>(false);
    const [memoryDataLoading, setMemoryDataLoading] = useState<boolean>(false);
    const [connectionsDataLoading, setConnectionsDataLoading] = useState<boolean>(false);
    const [operationsDataLoading, setOperationsDataLoading] = useState<boolean>(false);
    const [databaseDataLoading, setDatabaseDataLoading] = useState<boolean>(false);
    const [replicationDataLoading, setReplicationDataLoading] = useState<boolean>(false);
    const [oplogDataLoading, setOplogDataLoading] = useState<boolean>(false);
    const [systemCpuDataLoading, setSystemCpuDataLoading] = useState<boolean>(false);
    const [systemMemoryDataLoading, setSystemMemoryDataLoading] = useState<boolean>(false);
    const [systemDiskDataLoading, setSystemDiskDataLoading] = useState<boolean>(false);
    const [databaseStorageHistoricalData, setDatabaseStorageHistoricalData] = useState<ChartDataPoint[]>([]);
    const [databaseStorageDataLoading, setDatabaseStorageDataLoading] = useState<boolean>(false);
    const [databaseStorage7DayData, setDatabaseStorage7DayData] = useState<ChartDataPoint[]>([]);
    const [databaseStorage7DayLoading, setDatabaseStorage7DayLoading] = useState<boolean>(false);
    const [currentOpsDataLoading, setCurrentOpsDataLoading] = useState<boolean>(false);
    const [selectedTimeRange, setSelectedTimeRange] = useState<string>('1h');
    const [currentOpsMinSeconds, setCurrentOpsMinSeconds] = useState<number>(1.0);

    // Collection metrics state
    const [collectionMetricsData, setCollectionMetricsData] = useState<any[]>([]); // For table (current data)
    const [collectionMetricsLoading, setCollectionMetricsLoading] = useState<boolean>(false);
    const [collectionHistoricalData, setCollectionHistoricalData] = useState<any[]>([]); // For chart (historical data)
    const [collectionHistoricalLoading, setCollectionHistoricalLoading] = useState<boolean>(false);
    const [availableDatabases, setAvailableDatabases] = useState<string[]>([]);
    const [databasesLoading, setDatabasesLoading] = useState<boolean>(false);
    
    // Index usage state
    const [indexUsageData, setIndexUsageData] = useState<any>(null);
    const [indexUsageLoading, setIndexUsageLoading] = useState<boolean>(false);
    
    // Collection pagination and filtering
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [pageSize, setPageSize] = useState<number>(10);
    const [sortBy, setSortBy] = useState<string>('usage'); // 'usage', 'name', 'size', 'documents'
    
    // Collection selection for chart
    const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
    const MAX_SELECTED_COLLECTIONS = 10;

    // Command modal state
    const [commandModalVisible, setCommandModalVisible] = useState<boolean>(false);
    const [selectedCommand, setSelectedCommand] = useState<any>(null);
    const [commandModalTitle, setCommandModalTitle] = useState<string>('MongoDB Command Details');

    const showCurrentOpCommandModal = (command: any, title: string = 'MongoDB Command Details') => {
        setSelectedCommand(command);
        setCommandModalTitle(title);
        setCommandModalVisible(true);
    };

    // Modal state variables
    const [modalTitle, setModalTitle] = useState<string>('');
    const [modalContent, setModalContent] = useState<string>('');
    const [modalVisible, setModalVisible] = useState<boolean>(false);
    const [modalDatabase, setModalDatabase] = useState<string>('');

    // Prevent duplicate API calls
    const [manualNodeChangeInProgress, setManualNodeChangeInProgress] = useState<boolean>(false);
    // Track if auto-selection message has been shown
    const [autoSelectionMessageShown, setAutoSelectionMessageShown] = useState<boolean>(false);

    // URL params
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const clusterNameFromURL = queryParams.get('clusterName') || queryParams.get('replicaSet') || '';
    const hostNameFromURL = queryParams.get('hostName') || '';

    // React Query client
    const queryClient = useQueryClient();

    // Fetch MongoDB clusters with React Query
    const { data: clusterData, isLoading, isError } = useQuery({
        queryKey: ['mongodb-clusters'],
        queryFn: async () => {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/status/nodeshealth`, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                }
            });

            // Check if mongodb data exists in response
            if (response.data && response.data.mongodb && Array.isArray(response.data.mongodb)) {
                return response.data.mongodb;
            }

            throw new Error("No MongoDB data found in response");
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
            setLoadingClusterName(false);

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
                    message.info('Standalone MongoDB node detected - automatically selected');
                    setAutoSelectionMessageShown(true);
                }
            } else if (standaloneClusters.length > 0 && !clusterName) {
                // Mix of standalone and cluster nodes, auto-select standalone if no cluster selected
                selectedCluster = 'Standalone';
                if (!autoSelectionMessageShown) {
                    message.info('Auto-selected standalone MongoDB cluster');
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
            setLoadingClusterName(false);
        }
    }, [isError]);

    // Function for showing command modal (for MongoDB queries/commands)
    const showCommandModal = (command: string, commandType: 'query' | 'command' = 'command') => {
        const handleCopy = () => {
            navigator.clipboard.writeText(command);
            message.success('Command copied to clipboard!');
        };

        const handleAIAnalysis = async () => {
            // AI Analysis implementation similar to other PA pages
            const state = store.getState();
            const { dailyUsageCount, dailyLimit, lastResetDate } = state.aiLimit;

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

            let analysisModal: any = null;

            try {
                analysisModal = Modal.info({
                    title: 'AI MongoDB Analysis',
                    content: (
                        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                            <Spin size="large" />
                            <div style={{ marginTop: '20px', fontSize: '16px', color: '#47A248' }}>
                                AI is analyzing your MongoDB command...
                            </div>
                            <div style={{ marginTop: '10px', fontSize: '14px', color: '#888' }}>
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
                            content: `Can you analyze this MongoDB ${commandType}? Please provide insights about the performance and any improvement recommendations. If there are performance problems, please suggest indexes that would improve the query performance and provide optimized alternatives.\n\n${commandType === 'query' ? 'Query' : 'Command'}: ${command}`
                        }],
                        temperature: 0,
                        top_p: 0.01,
                        max_tokens: 0,
                        max_completion_tokens: 0,
                        stream: false
                    })
                });

                const data = await response.json();
                store.dispatch(incrementUsage());
                analysisModal.destroy();

                const updatedState = store.getState();
                const updatedCount = updatedState.aiLimit.dailyUsageCount;
                const remainingCount = dailyLimit - updatedCount;

                Modal.info({
                    title: (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <RobotOutlined style={{ fontSize: '20px', color: '#47A248' }} />
                            AI MongoDB Analysis Results
                        </div>
                    ),
                    content: (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', maxHeight: '50vh', overflowY: 'auto' }}>
                                <AIAnalysisRenderer
                                    content={data.choices[0].message.content}
                                    dbType="mongodb"
                                />
                            </div>
                            <div style={{ fontSize: '12px', color: '888', textAlign: 'right', marginTop: '8px', borderTop: '1px solid #f0f0f0', paddingTop: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '5px' }}>
                                    <RobotOutlined />
                                    <span>Daily usage: {updatedCount}/{dailyLimit} (Remaining: {remainingCount})</span>
                                </div>
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
                if (analysisModal) {
                    analysisModal.destroy();
                }
                console.error('Error during AI analysis:', error);
                message.error('Failed to analyze command with AI');
            }
        };

        Modal.info({
            title: (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileSearchOutlined style={{ fontSize: '20px', color: '#47A248' }} />
                    MongoDB {commandType === 'query' ? 'Query' : 'Command'} Details
                </div>
            ),
            content: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ padding: '16px', backgroundColor: '#f5f5f5', borderRadius: '4px', border: '1px solid #d9d9d9', maxHeight: '50vh', overflowY: 'auto' }}>
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
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '16px 0 0 0' }}>
                    <Button
                        onClick={handleAIAnalysis}
                        type="primary"
                        icon={<RobotOutlined />}
                        style={{ backgroundColor: '#47A248', borderColor: '#47A248' }}
                    >
                        AI Analysis
                    </Button>
                    <Button onClick={handleCopy} icon={<CopyOutlined />}>
                        Copy
                    </Button>
                    <Button onClick={() => Modal.destroyAll()}>
                        Close
                    </Button>
                </div>
            )
        });
    };

    // Fetch MongoDB replication lag metrics from InfluxDB
    const fetchReplicationMetrics = async (nodeName: string, timeRange: string = '1h') => {
        if (!nodeName) return;

        try {
            setReplicationDataLoading(true);
            const agentId = `agent_${nodeName}`;

            const response = await fetch(
                `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/metrics/mongodb/replication/lag?agent_id=${agentId}&range=${timeRange}`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                    },
                    credentials: 'include'
                }
            );

            if (!response.ok) {
                throw new Error('Failed to fetch replication metrics');
            }

            const data: ReplicationMetricsResponse = await response.json();

            if (data.status === 'success' && data.data && data.data.all_data && Array.isArray(data.data.all_data)) {
                // Group data by member and time
                const timeMap: { [key: string]: ChartDataPoint } = {};
                const members = new Set<string>();

                data.data.all_data.forEach((point: MetricDataPoint) => {
                    const timeKey = point._time;
                    const member = (point as any).member;

                    if (member) {
                        members.add(member);

                        if (!timeMap[timeKey]) {
                            timeMap[timeKey] = {
                                time: new Date(point._time).toLocaleTimeString(),
                                timestamp: new Date(point._time).getTime()
                            };
                        }

                        // Store lag value for this member (convert ms to seconds for better readability)
                        const memberKey = `${member.replace(/[.:]/g, '_')}_lag_ms_num`;
                        timeMap[timeKey][memberKey] = point._value;
                    }
                });

                // Convert to array and sort by timestamp
                const sortedData = Object.values(timeMap).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
                setReplicationHistoricalData(sortedData);

                // Set replication status with summary data
                if (data.data.summary) {
                    const summary = data.data.summary;

                    // Save summary data for statistics display
                    setReplicationSummary(summary);

                    setReplicationStatus({
                        set: 'Unknown', // Not available in this endpoint
                        date: new Date().toISOString(),
                        myState: 1,
                        term: 0,
                        syncSourceHost: '',
                        syncSourceId: 0,
                        heartbeatIntervalMillis: 0,
                        majorityVoteCount: 0,
                        writeMajorityCount: 0,
                        votingMembersCount: Array.from(members).length,
                        writableVotingMembersCount: Array.from(members).length,
                        members: Array.from(members).map((member, index) => ({
                            _id: index,
                            name: member,
                            health: 1,
                            state: 2,
                            stateStr: 'SECONDARY',
                            uptime: 0,
                            optime: {},
                            optimeDate: new Date().toISOString(),
                            syncSourceHost: '',
                            syncSourceId: 0,
                            configVersion: 1,
                            configTerm: 1
                        }))
                    });
                }

            } else {
                console.error('Invalid replication metrics response:', data);
                message.error('Failed to retrieve replication metrics');
            }
        } catch (error) {
            console.error('Error fetching replication metrics:', error);
            message.error('Failed to fetch replication metrics');
        } finally {
            setReplicationDataLoading(false);
        }
    };

    // Fetch MongoDB oplog metrics from InfluxDB
    const fetchOplogMetrics = async (nodeName: string, timeRange: string = '1h') => {
        if (!nodeName) return;

        try {
            setOplogDataLoading(true);
            const agentId = `agent_${nodeName}`;

            const response = await fetch(
                `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/metrics/mongodb/replication/oplog?agent_id=${agentId}&range=${timeRange}`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                    },
                    credentials: 'include'
                }
            );

            if (!response.ok) {
                throw new Error('Failed to fetch oplog metrics');
            }

            const data: OplogMetricsResponse = await response.json();

            if (data.status === 'success' && data.data && Array.isArray(data.data)) {
                // Group data by field type and time
                const timeMap: { [key: string]: ChartDataPoint } = {};

                data.data.forEach((point: MetricDataPoint) => {
                    const timeKey = point._time;
                    if (!timeMap[timeKey]) {
                        timeMap[timeKey] = {
                            time: new Date(point._time).toLocaleTimeString(),
                            timestamp: new Date(point._time).getTime()
                        };
                    }

                    // Map field values
                    if (point._field === 'oplog_count') {
                        timeMap[timeKey].oplog_count = point._value;
                    } else if (point._field === 'oplog_max_size_mb') {
                        timeMap[timeKey].oplog_max_size_mb = point._value;
                    } else if (point._field === 'oplog_size_mb') {
                        timeMap[timeKey].oplog_size_mb = point._value;
                    } else if (point._field === 'oplog_storage_mb') {
                        timeMap[timeKey].oplog_storage_mb = point._value;
                    } else if (point._field === 'oplog_utilization_percent') {
                        timeMap[timeKey].oplog_utilization_percent = point._value;
                    } else if (point._field === 'oplog_first_entry_timestamp') {
                        timeMap[timeKey].oplog_first_entry_timestamp = point._value;
                    } else if (point._field === 'oplog_last_entry_timestamp') {
                        timeMap[timeKey].oplog_last_entry_timestamp = point._value;
                    } else if (point._field === 'oplog_safe_downtime_hours') {
                        timeMap[timeKey].oplog_safe_downtime_hours = point._value;
                    } else if (point._field === 'oplog_time_window_hours') {
                        timeMap[timeKey].oplog_time_window_hours = point._value;
                    } else if (point._field === 'oplog_time_window_seconds') {
                        timeMap[timeKey].oplog_time_window_seconds = point._value;
                    }
                });

                // Convert to array and sort by timestamp
                const sortedData = Object.values(timeMap).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
                setOplogHistoricalData(sortedData);

                // Set current oplog metrics from latest data
                const latestData = sortedData[sortedData.length - 1];
                if (latestData) {
                    setOplogMetrics({
                        oplog_count: latestData.oplog_count || 0,
                        oplog_max_size_mb: latestData.oplog_max_size_mb || 0,
                        oplog_size_mb: latestData.oplog_size_mb || 0,
                        oplog_storage_mb: latestData.oplog_storage_mb || 0,
                        oplog_utilization_percent: latestData.oplog_utilization_percent || 0,
                        oplog_first_entry_timestamp: latestData.oplog_first_entry_timestamp || 0,
                        oplog_last_entry_timestamp: latestData.oplog_last_entry_timestamp || 0,
                        oplog_safe_downtime_hours: latestData.oplog_safe_downtime_hours || 0,
                        oplog_time_window_hours: latestData.oplog_time_window_hours || 0,
                        oplog_time_window_seconds: latestData.oplog_time_window_seconds || 0
                    });
                }

            } else {
                console.error('Invalid oplog metrics response:', data);
                message.error('Failed to retrieve oplog metrics');
            }
        } catch (error) {
            console.error('Error fetching oplog metrics:', error);
            message.error('Failed to fetch oplog metrics');
        } finally {
            setOplogDataLoading(false);
        }
    };

    // Fetch MongoDB connections metrics from InfluxDB
    const fetchConnectionsMetrics = async (nodeName: string, timeRange: string = '1h') => {
        if (!nodeName) return;

        try {
            setConnectionsDataLoading(true);
            const agentId = `agent_${nodeName}`;

            const response = await fetch(
                `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/metrics/mongodb/database/connections?agent_id=${agentId}&range=${timeRange}`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                    },
                    credentials: 'include'
                }
            );

            if (!response.ok) {
                throw new Error('Failed to fetch connections metrics');
            }

            const data = await response.json();

            if (data.status === 'success' && data.data && Array.isArray(data.data)) {
                // Group data by field type (available, current)
                const groupedData: { [key: string]: MetricDataPoint[] } = {};

                data.data.forEach((point: MetricDataPoint) => {
                    if (!groupedData[point._field]) {
                        groupedData[point._field] = [];
                    }
                    groupedData[point._field].push(point);
                });

                // Sort by time and create chart data
                const chartData: ChartDataPoint[] = [];
                const timeMap: { [key: string]: ChartDataPoint } = {};

                Object.keys(groupedData).forEach(field => {
                    groupedData[field].forEach(point => {
                        const timeKey = point._time;
                        if (!timeMap[timeKey]) {
                            timeMap[timeKey] = {
                                time: timeKey,
                                timestamp: new Date(point._time).getTime()
                            };
                        }

                        if (field === 'available') {
                            timeMap[timeKey].connections_available = point._value;
                        } else if (field === 'current') {
                            timeMap[timeKey].connections_current = point._value;
                        }
                    });
                });

                // Convert to array and sort by timestamp
                const sortedData = Object.values(timeMap).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
                setConnectionsHistoricalData(sortedData);

                // Also set current connections data for stats display
                const latestData = sortedData[sortedData.length - 1];
                if (latestData) {
                    setConnections({
                        current: Math.round(latestData.connections_current || 0),
                        available: Math.round(latestData.connections_available || 0),
                        totalCreated: 0, // Not available in this endpoint
                        active: 0, // Not available in this endpoint
                        inactive: 0, // Not available in this endpoint
                        exhaustIsMaster: 0, // Not available in this endpoint
                        exhaustHello: 0, // Not available in this endpoint
                        awaitingTopologyChanges: 0 // Not available in this endpoint
                    });
                }

            } else {
                console.error('Invalid connections metrics response:', data);
                message.error('Failed to retrieve connections metrics');
            }
        } catch (error) {
            console.error('Error fetching connections metrics:', error);
            message.error('Failed to fetch connections metrics');
        } finally {
            setConnectionsDataLoading(false);
        }
    };

    // Fetch MongoDB Server Information
    const fetchServerInfo = async (nodeName: string) => {
        if (!nodeName) return;

        try {
            setLoading(true);
            const agentId = `agent_${nodeName}`;

            const command = 'db.runCommand({serverStatus: 1})';

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
                    query_id: 'mongodb_server_info',
                    command: command
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
                        const decodedValue = atob(result.value);
                        const parsedResult = JSON.parse(decodedValue);

                        if (parsedResult.status === 'success' && parsedResult.data) {
                            const serverData = parsedResult.data;
                            const serverInfo: QueryResultServerInfo = {
                                version: serverData.version || '',
                                host: serverData.host || '',
                                process: serverData.process || '',
                                pid: serverData.pid || 0,
                                uptime: serverData.uptime || 0,
                                uptimeMillis: serverData.uptimeMillis || 0,
                                uptimeEstimate: serverData.uptimeEstimate || 0,
                                localTime: serverData.localTime || '',
                                storageEngine: serverData.storageEngine?.name || '',
                                repl: serverData.repl,
                                sharding: serverData.sharding
                            };

                            setServerInfo(serverInfo);
                        } else {
                            console.error('Invalid server info data:', parsedResult);
                            message.error('Failed to retrieve server information');
                        }
                    } catch (parseError) {
                        console.error('Error parsing server info result:', parseError);
                        message.error('Failed to parse server information');
                    }
                } else {
                    console.error('Unexpected result format:', result);
                    message.error('Unexpected server info response format');
                }
            } else {
                console.error('Invalid API response:', data);
                message.error('Failed to retrieve server information');
            }
        } catch (error) {
            console.error('Error fetching server info:', error);
            message.error('Failed to fetch server information');
        } finally {
            setLoading(false);
        }
    };

    // Check if agent has gRPC connection
    const checkAgentGrpcConnection = async (agentId: string): Promise<boolean> => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/status/agents`, {
                headers: {
                    'Accept': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                credentials: 'include'
            });

            if (!response.ok) {
                return false;
            }

            const data = await response.json();
            if (data.status === "success" && Array.isArray(data.data?.agents)) {
                const agent = data.data.agents.find((agent: any) => agent.id === agentId);
                return agent?.grpc_connected === true;
            }
            return false;
        } catch (error) {
            console.error('Error checking agent gRPC connection:', error);
            return false;
        }
    };

    // Fetch Current Operations
    const fetchCurrentOps = async (nodeName: string, minSeconds: number = 1.0) => {
        if (!nodeName) return;

        // Önce agent'ın gRPC bağlantısı olup olmadığını kontrol et
        const agentId = `agent_${nodeName}`;
        
        try {
            setCurrentOpsDataLoading(true);
            const isGrpcConnected = await checkAgentGrpcConnection(agentId);
            
            if (!isGrpcConnected) {
                message.warning(`Agent ${nodeName} is not connected via gRPC. Cannot execute currentOp query.`);
                setCurrentOpsDataLoading(false);
                return;
            }
            
            const token = localStorage.getItem('token');
            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/agents/${agentId}/mongo/currentop`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                credentials: 'include',
                body: JSON.stringify({
                    secs_running: minSeconds
                })
            });

            if (!response.ok) {
                throw new Error('API response not ok');
            }

            const data = await response.json();
            if (data.result && data.result.type_url === 'type.googleapis.com/google.protobuf.Value') {
                try {
                    const decodedValue = atob(data.result.value);
                    const parsedResult = JSON.parse(decodedValue);
                    
                    if (parsedResult.result && parsedResult.result.inprog) {
                        const currentOpsData: QueryResultCurrentOps = {
                            inprog: parsedResult.result.inprog || []
                        };
                        setCurrentOps(currentOpsData);
                        console.log('Current operations loaded:', currentOpsData.inprog.length, 'operations');
                    } else {
                        console.error('Invalid current operations structure:', parsedResult);
                        message.error('Failed to parse current operations data');
                    }
                } catch (parseError) {
                    console.error('Error parsing base64 current operations data:', parseError);
                    message.error('Failed to decode current operations response');
                }
            } else {
                console.error('Invalid current operations response format:', data);
                message.error('Failed to retrieve current operations');
            }
        } catch (error) {
            console.error('Error fetching current operations:', error);
            message.error('Failed to fetch current operations');
        } finally {
            setCurrentOpsDataLoading(false);
        }
    };

    // Fetch MongoDB Databases
    const fetchDatabases = async (nodeName: string): Promise<string[]> => {
        if (!nodeName) return [];

        try {
            const agentId = `agent_${nodeName}`;
            const command = 'db.adminCommand("listDatabases")';

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
                    query_id: 'mongodb_list_databases',
                    command: command
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
                        const decodedValue = atob(result.value);
                        const parsedResult = JSON.parse(decodedValue);

                        if (parsedResult.status === 'success' && parsedResult.data && parsedResult.data.databases) {
                            return parsedResult.data.databases.map((db: any) => db.name);
                        }
                    } catch (parseError) {
                        console.error('Error parsing databases result:', parseError);
                    }
                }
            }
            return [];
        } catch (error) {
            console.error('Error fetching databases:', error);
            return [];
        }
    };

    // Fetch MongoDB operations metrics from InfluxDB (Rate endpoint)
    const fetchOperationsMetrics = async (nodeName: string, timeRange: string = '1h') => {
        if (!nodeName) return;

        try {
            setOperationsDataLoading(true);
            const agentId = `agent_${nodeName}`;

            const token = localStorage.getItem('token');
            const response = await fetch(
                `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/metrics/mongodb/database/operations-rate?agent_id=${agentId}&range=${timeRange}`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    },
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.status === 'success' && data.data) {
                // Process rate data from all_data
                const timeMap: { [time: string]: ChartDataPoint } = {};

                if (data.data.all_data && Array.isArray(data.data.all_data)) {
                    data.data.all_data.forEach((point: any) => {
                        const timeKey = new Date(point._time).toLocaleString();

                        if (!timeMap[timeKey]) {
                            timeMap[timeKey] = {
                                time: timeKey,
                                timestamp: new Date(point._time).getTime()
                            };
                        }

                        // Map field names to our operation types
                        const fieldMapping: { [key: string]: string } = {
                            'command': 'operations_command',
                            'delete': 'operations_delete',
                            'getmore': 'operations_getmore',
                            'insert': 'operations_insert',
                            'query': 'operations_query',
                            'update': 'operations_update'
                        };

                        const operationField = fieldMapping[point._field];
                        if (operationField) {
                            timeMap[timeKey][operationField] = Math.round(point._value * 100) / 100; // Round to 2 decimals
                        }
                    });
                }

                // Convert to array and sort by timestamp
                const sortedData = Object.values(timeMap).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

                setOperationsHistoricalData(sortedData);

                // Set operation statistics from summary (rate data)
                if (data.data.summary) {
                    const summary = data.data.summary;
                    setOperationStats({
                        insert: Math.round((summary.insert_ops_per_sec?.avg || 0) * 100) / 100,
                        query: Math.round((summary.query_ops_per_sec?.avg || 0) * 100) / 100,
                        update: Math.round((summary.update_ops_per_sec?.avg || 0) * 100) / 100,
                        delete: Math.round((summary.delete_ops_per_sec?.avg || 0) * 100) / 100,
                        getmore: Math.round((summary.getmore_ops_per_sec?.avg || 0) * 100) / 100,
                        command: Math.round((summary.command_ops_per_sec?.avg || 0) * 100) / 100
                    });

                    // Set additional summary data for display
                    setOperationSummary({
                        total_ops_per_sec: summary.total_ops_per_sec || 0,
                        operations_tracked: summary.operations_tracked || 6,
                        data_points: summary.command_ops_per_sec?.data_points || 0,
                        peak_command_rate: summary.command_ops_per_sec?.max || 0,
                        peak_update_rate: summary.update_ops_per_sec?.max || 0,
                        peak_query_rate: summary.query_ops_per_sec?.max || 0,
                        peak_getmore_rate: summary.getmore_ops_per_sec?.max || 0,
                        peak_insert_rate: summary.insert_ops_per_sec?.max || 0,
                        peak_delete_rate: summary.delete_ops_per_sec?.max || 0
                    });
                }

                message.success('Operations metrics loaded successfully');
            } else {
                throw new Error('Invalid response format');
            }
        } catch (error) {
            console.error('Error fetching operations metrics:', error);
            message.error('Failed to fetch operations metrics');
        } finally {
            setOperationsDataLoading(false);
        }
    };

    // Fetch MongoDB system CPU metrics from InfluxDB
    const fetchSystemCpuMetrics = async (nodeName: string, timeRange: string = '1h') => {
        if (!nodeName) return;

        try {
            setSystemCpuDataLoading(true);
            const agentId = `agent_${nodeName}`;

            const response = await fetch(
                `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/metrics/mongodb/system/cpu?agent_id=${agentId}&range=${timeRange}`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                    },
                    credentials: 'include'
                }
            );

            if (!response.ok) {
                throw new Error('Failed to fetch system CPU metrics');
            }

            const data = await response.json();

            if (data.status === 'success' && data.data && Array.isArray(data.data)) {
                // Group data by field type (cpu_usage, cpu_cores)
                const timeMap: { [key: string]: ChartDataPoint } = {};

                data.data.forEach((point: MetricDataPoint) => {
                    const timeKey = point._time;
                    if (!timeMap[timeKey]) {
                        const date = new Date(point._time);
                        const isLongRange = timeRange.includes('d') || timeRange === '7d' || timeRange === '30d' || 
                                          parseInt(timeRange.replace(/\D/g, '')) >= 24;
                        timeMap[timeKey] = {
                            time: isLongRange ? date.toLocaleDateString() : date.toLocaleTimeString(),
                            timestamp: date.getTime()
                        };
                    }

                    if (point._field === 'cpu_usage') {
                        timeMap[timeKey].cpu_usage = point._value;
                    } else if (point._field === 'cpu_cores') {
                        timeMap[timeKey].cpu_cores = point._value;
                    }
                });

                // Convert to array and sort by timestamp
                const sortedData = Object.values(timeMap).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
                setSystemCpuHistoricalData(sortedData);

                // Update system metrics with latest data
                const latestData = sortedData[sortedData.length - 1];
                if (latestData) {
                    setSystemMetrics({
                        cpu_usage: latestData.cpu_usage || 0,
                        cpu_cores: latestData.cpu_cores || 0,
                        memory_usage: 0, // Will be updated when memory endpoint is implemented
                        total_memory: 0,
                        free_memory: 0,
                        load_average_1m: 0,
                        load_average_5m: 0,
                        load_average_15m: 0,
                        total_disk: 0,
                        free_disk: 0,
                        os_version: '',
                        kernel_version: '',
                        uptime: 0
                    });
                }

            } else {
                console.error('Invalid system CPU metrics response:', data);
                message.error('Failed to retrieve system CPU metrics');
            }
        } catch (error) {
            console.error('Error fetching system CPU metrics:', error);
            message.error('Failed to fetch system CPU metrics');
        } finally {
            setSystemCpuDataLoading(false);
        }
    };

    // Fetch MongoDB system memory metrics from InfluxDB
    const fetchSystemMemoryMetrics = async (nodeName: string, timeRange: string = '1h') => {
        if (!nodeName) return;

        try {
            setSystemMemoryDataLoading(true);
            const agentId = `agent_${nodeName}`;

            const response = await fetch(
                `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/metrics/mongodb/system/memory?agent_id=${agentId}&range=${timeRange}`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                    },
                    credentials: 'include'
                }
            );

            if (!response.ok) {
                throw new Error('Failed to fetch system memory metrics');
            }

            const data = await response.json();

            if (data.status === 'success' && data.data && Array.isArray(data.data)) {
                // Group data by field type (free_memory, memory_usage, total_memory)
                const timeMap: { [key: string]: ChartDataPoint } = {};

                data.data.forEach((point: MetricDataPoint) => {
                    const timeKey = point._time;
                    if (!timeMap[timeKey]) {
                        const date = new Date(point._time);
                        const isLongRange = timeRange.includes('d') || timeRange === '7d' || timeRange === '30d' || 
                                          parseInt(timeRange.replace(/\D/g, '')) >= 24;
                        timeMap[timeKey] = {
                            time: isLongRange ? date.toLocaleDateString() : date.toLocaleTimeString(),
                            timestamp: date.getTime()
                        };
                    }

                    if (point._field === 'free_memory') {
                        timeMap[timeKey].free_memory = point._value;
                    } else if (point._field === 'memory_usage') {
                        timeMap[timeKey].memory_usage = point._value;
                    } else if (point._field === 'total_memory') {
                        timeMap[timeKey].memory_total = point._value;
                    }
                });

                // Calculate used memory for each data point
                Object.values(timeMap).forEach(dataPoint => {
                    if (dataPoint.memory_total && dataPoint.free_memory) {
                        dataPoint.used_memory = dataPoint.memory_total - dataPoint.free_memory;
                    }
                });

                // Convert to array and sort by timestamp
                const sortedData = Object.values(timeMap).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
                setSystemMemoryHistoricalData(sortedData);

                // Update system metrics with latest data
                const latestData = sortedData[sortedData.length - 1];
                if (latestData) {
                    setSystemMetrics(prevMetrics => ({
                        cpu_usage: prevMetrics?.cpu_usage || 0,
                        cpu_cores: prevMetrics?.cpu_cores || 0,
                        memory_usage: latestData.memory_usage || 0,
                        total_memory: latestData.memory_total || 0,
                        free_memory: latestData.free_memory || 0,
                        load_average_1m: 0,
                        load_average_5m: 0,
                        load_average_15m: 0,
                        total_disk: 0,
                        free_disk: 0,
                        os_version: '',
                        kernel_version: '',
                        uptime: 0
                    }));
                }

            } else {
                console.error('Invalid system memory metrics response:', data);
                message.error('Failed to retrieve system memory metrics');
            }
        } catch (error) {
            console.error('Error fetching system memory metrics:', error);
            message.error('Failed to fetch system memory metrics');
        } finally {
            setSystemMemoryDataLoading(false);
        }
    };

    // Fetch MongoDB system disk metrics from InfluxDB
    const fetchSystemDiskMetrics = async (nodeName: string, timeRange: string = '1h') => {
        if (!nodeName) return;

        try {
            setSystemDiskDataLoading(true);
            const agentId = `agent_${nodeName}`;

            const response = await fetch(
                `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/metrics/mongodb/system/disk?agent_id=${agentId}&range=${timeRange}`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                    },
                    credentials: 'include'
                }
            );

            if (!response.ok) {
                throw new Error('Failed to fetch system disk metrics');
            }

            const data = await response.json();

            if (data.status === 'success' && data.data && Array.isArray(data.data)) {
                // Group data by field type (free_disk, total_disk)
                const timeMap: { [key: string]: ChartDataPoint } = {};

                data.data.forEach((point: MetricDataPoint) => {
                    const timeKey = point._time;
                    if (!timeMap[timeKey]) {
                        const date = new Date(point._time);
                        const isLongRange = timeRange.includes('d') || timeRange === '7d' || timeRange === '30d' || 
                                          parseInt(timeRange.replace(/\D/g, '')) >= 24;
                        timeMap[timeKey] = {
                            time: isLongRange ? date.toLocaleDateString() : date.toLocaleTimeString(),
                            timestamp: date.getTime()
                        };
                    }

                    if (point._field === 'free_disk') {
                        timeMap[timeKey].free_disk = point._value;
                    } else if (point._field === 'total_disk') {
                        timeMap[timeKey].disk_total = point._value;
                    }
                });

                // Calculate used disk and usage percentage for each data point
                Object.values(timeMap).forEach(dataPoint => {
                    if (dataPoint.disk_total && dataPoint.free_disk) {
                        dataPoint.used_disk = dataPoint.disk_total - dataPoint.free_disk;
                        dataPoint.disk_usage_percent = ((dataPoint.used_disk / dataPoint.disk_total) * 100);
                    }
                });

                // Convert to array and sort by timestamp
                const sortedData = Object.values(timeMap).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
                setSystemDiskHistoricalData(sortedData);

                // Update system metrics with latest data
                const latestData = sortedData[sortedData.length - 1];
                if (latestData) {
                    setSystemMetrics(prevMetrics => ({
                        cpu_usage: prevMetrics?.cpu_usage || 0,
                        cpu_cores: prevMetrics?.cpu_cores || 0,
                        memory_usage: prevMetrics?.memory_usage || 0,
                        total_memory: prevMetrics?.total_memory || 0,
                        free_memory: prevMetrics?.free_memory || 0,
                        load_average_1m: 0,
                        load_average_5m: 0,
                        load_average_15m: 0,
                        total_disk: latestData.disk_total || 0,
                        free_disk: latestData.free_disk || 0,
                        os_version: '',
                        kernel_version: '',
                        uptime: 0
                    }));
                }

            } else {
                console.error('Invalid system disk metrics response:', data);
                message.error('Failed to retrieve system disk metrics');
            }
        } catch (error) {
            console.error('Error fetching system disk metrics:', error);
            message.error('Failed to fetch system disk metrics');
        } finally {
            setSystemDiskDataLoading(false);
        }
    };

    // Fetch MongoDB database storage metrics for 7-day capacity planning
    const fetchDatabaseStorage7DayMetrics = async (nodeName: string) => {
        if (!nodeName) return;

        try {
            setDatabaseStorage7DayLoading(true);
            const agentId = `agent_${nodeName}`;

            const response = await fetch(
                `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/metrics/mongodb/database/storage?agent_id=${agentId}&range=1d`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                    },
                    credentials: 'include'
                }
            );

            if (!response.ok) {
                throw new Error('Failed to fetch 7-day database storage metrics');
            }

            const data = await response.json();

            if (data.status === 'success' && data.data && Array.isArray(data.data)) {
                // Group data by field type and database
                const timeMap: { [key: string]: ChartDataPoint } = {};
                const databases = new Set<string>();

                data.data.forEach((point: MetricDataPoint) => {
                    const timeKey = point._time;
                    const database = point.database || 'unknown';
                    databases.add(database);

                    if (!timeMap[timeKey]) {
                        timeMap[timeKey] = {
                            time: new Date(point._time).toLocaleString(),
                            timestamp: new Date(point._time).getTime()
                        };
                    }

                    // Store field values with database prefix for multiple databases
                    if (point._field === 'data_size_mb') {
                        timeMap[timeKey][`${database}_data_size_mb`] = point._value;
                        timeMap[timeKey].data_size_mb = (timeMap[timeKey].data_size_mb || 0) + point._value;
                    } else if (point._field === 'index_size_mb') {
                        timeMap[timeKey][`${database}_index_size_mb`] = point._value;
                        timeMap[timeKey].index_size_mb = (timeMap[timeKey].index_size_mb || 0) + point._value;
                    } else if (point._field === 'storage_size_mb') {
                        timeMap[timeKey][`${database}_storage_size_mb`] = point._value;
                        timeMap[timeKey].storage_size_mb = (timeMap[timeKey].storage_size_mb || 0) + point._value;
                    }
                });

                // Convert to array and sort by timestamp
                const sortedData = Object.values(timeMap).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
                setDatabaseStorage7DayData(sortedData);

                

            } else {
                console.error('Invalid 7-day database storage metrics response:', data);
                message.error('Failed to retrieve 7-day database storage metrics');
            }
        } catch (error) {
            console.error('Error fetching 7-day database storage metrics:', error);
            message.error('Failed to fetch 7-day database storage metrics');
        } finally {
            setDatabaseStorage7DayLoading(false);
        }
    };

    // Fetch MongoDB database storage metrics from InfluxDB
    const fetchDatabaseStorageMetrics = async (nodeName: string, timeRange: string = '1h') => {
        if (!nodeName) return;

        try {
            setDatabaseStorageDataLoading(true);
            const agentId = `agent_${nodeName}`;

            const response = await fetch(
                `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/metrics/mongodb/database/storage?agent_id=${agentId}&range=${timeRange}`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                    },
                    credentials: 'include'
                }
            );

            if (!response.ok) {
                throw new Error('Failed to fetch database storage metrics');
            }

            const data = await response.json();

            if (data.status === 'success' && data.data && Array.isArray(data.data)) {
                // Group data by field type and database
                const timeMap: { [key: string]: ChartDataPoint } = {};
                const databases = new Set<string>();

                data.data.forEach((point: MetricDataPoint) => {
                    const timeKey = point._time;
                    const database = point.database || 'unknown';
                    databases.add(database);

                    if (!timeMap[timeKey]) {
                        timeMap[timeKey] = {
                            time: new Date(point._time).toLocaleTimeString(),
                            timestamp: new Date(point._time).getTime()
                        };
                    }

                    // Store field values with database prefix for multiple databases
                    if (point._field === 'data_size_mb') {
                        timeMap[timeKey][`${database}_data_size_mb`] = point._value;
                        timeMap[timeKey].data_size_mb = (timeMap[timeKey].data_size_mb || 0) + point._value;
                    } else if (point._field === 'index_size_mb') {
                        timeMap[timeKey][`${database}_index_size_mb`] = point._value;
                        timeMap[timeKey].index_size_mb = (timeMap[timeKey].index_size_mb || 0) + point._value;
                    } else if (point._field === 'storage_size_mb') {
                        timeMap[timeKey][`${database}_storage_size_mb`] = point._value;
                        timeMap[timeKey].storage_size_mb = (timeMap[timeKey].storage_size_mb || 0) + point._value;
                    }
                });

                // Convert to array and sort by timestamp
                const sortedData = Object.values(timeMap).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
                setDatabaseStorageHistoricalData(sortedData);


            } else {
                console.error('Invalid database storage metrics response:', data);
                message.error('Failed to retrieve database storage metrics');
            }
        } catch (error) {
            console.error('Error fetching database storage metrics:', error);
            message.error('Failed to fetch database storage metrics');
        } finally {
            setDatabaseStorageDataLoading(false);
        }
    };

    // Fetch available databases for collections
    const fetchAvailableDatabases = async (nodeName: string) => {
        if (!nodeName) return;

        try {
            setDatabasesLoading(true);
            const agentId = `agent_${nodeName}`;
            
            const token = localStorage.getItem('token');
            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/metrics/mongodb/database/list?agent_id=${agentId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.data && Array.isArray(result.data)) {
                // Filter out system databases
                const userDatabases = result.data.filter((db: string) => 
                    !['admin', 'local', 'config'].includes(db)
                );
                setAvailableDatabases(userDatabases);
                setDatabaseNames(userDatabases); // Also populate the main database dropdown
                
                // Auto-select first database if none selected
                if (userDatabases.length > 0 && !selectedDatabase) {
                    setSelectedDatabase(userDatabases[0]);
                }
            } else {
                console.warn('Unexpected database list response format:', result);
                setAvailableDatabases([]);
            }
        } catch (error) {
            console.error('Error fetching available databases:', error);
            message.error('Failed to fetch database list');
            setAvailableDatabases([]);
        } finally {
            setDatabasesLoading(false);
        }
    };

    // Fetch current collection metrics for table display
    const fetchCollectionMetrics = async (nodeName: string, database: string) => {
        if (!nodeName || !database) return;

        try {
            setCollectionMetricsLoading(true);
            const agentId = `agent_${nodeName}`;
            
            const token = localStorage.getItem('token');
            const response = await fetch(
                `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/metrics/mongodb/database/collections/current?agent_id=${agentId}&database=${database}`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    }
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.data && Array.isArray(result.data)) {
                setCollectionMetricsData(result.data);
                autoSelectTopCollections(result.data); // Auto-select top 5 collections
            } else {
                console.warn('Unexpected collection metrics response format:', result);
                setCollectionMetricsData([]);
            }
        } catch (error) {
            console.error('Error fetching collection metrics:', error);
            message.error('Failed to fetch collection metrics');
            setCollectionMetricsData([]);
        } finally {
            setCollectionMetricsLoading(false);
        }
    };

    // Fetch index usage statistics
    const fetchIndexUsageStats = async (nodeName: string, database: string) => {
        if (!nodeName || !database) return;

        try {
            setIndexUsageLoading(true);
            const agentId = `agent_${nodeName}`;
            
            const token = localStorage.getItem('token');
            const response = await fetch(
                `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/metrics/mongodb/database/${database}/index-stats?agent_id=${agentId}`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    }
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.status === 'success' && result.data) {
                // Parse collections JSON string if needed
                let processedData = { ...result.data };
                if (typeof result.data.collections === 'string') {
                    try {
                        processedData.collections = JSON.parse(result.data.collections);
                    } catch (parseError) {
                        console.error('Error parsing collections JSON:', parseError);
                        processedData.collections = [];
                    }
                } else if (!Array.isArray(result.data.collections)) {
                    // If collections is not an array, initialize as empty array
                    processedData.collections = [];
                }
                
                console.log('Index usage data processed:', processedData);
                setIndexUsageData(processedData);
            } else {
                console.warn('Unexpected index usage response format:', result);
                setIndexUsageData(null);
            }
        } catch (error) {
            console.error('Error fetching index usage stats:', error);
            message.error('Failed to fetch index usage statistics');
            setIndexUsageData(null);
        } finally {
            setIndexUsageLoading(false);
        }
    };

    // Cache for collection historical data
    const collectionHistoricalCache = React.useRef(new Map());
    
    // Fetch historical collection metrics for chart display with caching
    const fetchCollectionHistoricalData = React.useCallback(async (nodeName: string, database: string, timeRange: string = '1h') => {
        if (!nodeName || !database) return;

        // Check cache first
        const cacheKey = `${nodeName}-${database}-${timeRange}`;
        const cached = collectionHistoricalCache.current.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < 15000) { // 15 second cache
            setCollectionHistoricalData(cached.data);
            setCollectionHistoricalLoading(false); // Clear loading state when using cache
            return;
        }

        try {
            setCollectionHistoricalLoading(true);
            const agentId = `agent_${nodeName}`;
            
            const token = localStorage.getItem('token');
            const response = await fetch(
                `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/metrics/mongodb/database/collections?agent_id=${agentId}&database=${database}&range=${timeRange}`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    }
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.data && Array.isArray(result.data)) {
                setCollectionHistoricalData(result.data);
                
                // Cache the result
                collectionHistoricalCache.current.set(cacheKey, {
                    data: result.data,
                    timestamp: Date.now()
                });
            } else {
                console.warn('Unexpected collection historical response format:', result);
                setCollectionHistoricalData([]);
            }
        } catch (error) {
            console.error('Error fetching collection historical data:', error);
            message.error('Failed to fetch collection historical data');
            setCollectionHistoricalData([]);
        } finally {
            setCollectionHistoricalLoading(false);
        }
    }, []); // dependency array for useCallback

    // Collection selection handlers
    const handleCollectionSelect = (collectionName: string, checked: boolean) => {
        setSelectedCollections(prev => {
            if (checked) {
                // Check limit
                if (prev.length >= MAX_SELECTED_COLLECTIONS) {
                    message.warning(`Maximum ${MAX_SELECTED_COLLECTIONS} collections can be selected for chart`);
                    return prev;
                }
                return [...prev, collectionName];
            } else {
                return prev.filter(name => name !== collectionName);
            }
        });
    };

    const handleSelectAllCollections = (checked: boolean) => {
        if (checked) {
            // Select first N collections up to the limit
            const collectionsToSelect = collectionMetricsData
                .slice(0, MAX_SELECTED_COLLECTIONS)
                .map(item => item.collection);
            setSelectedCollections(collectionsToSelect);
            
            if (collectionMetricsData.length > MAX_SELECTED_COLLECTIONS) {
                message.info(`Selected first ${MAX_SELECTED_COLLECTIONS} collections (limit reached)`);
            }
        } else {
            setSelectedCollections([]);
        }
    };

    // Auto-select top collections by size when data loads
    const autoSelectTopCollections = (data: any[]) => {
        if (selectedCollections.length === 0 && data.length > 0) {
            const topCollections = data
                .sort((a, b) => (b.data_size_mb || 0) - (a.data_size_mb || 0))
                .slice(0, Math.min(5, MAX_SELECTED_COLLECTIONS))
                .map(item => item.collection);
            setSelectedCollections(topCollections);
        }
    };

    // Index usage helper functions
    const calculateSummaryStats = (collections: any[]) => {
        if (!collections || collections.length === 0) {
            return { totalCollections: 0, totalIndexes: 0, unusedIndexes: 0, highUsageCollections: 0, totalOperations: 0 };
        }

        let totalIndexes = 0, unusedIndexes = 0, highUsageCollections = 0, totalOperations = 0;

        collections.forEach(collection => {
            if (collection.indexes && Array.isArray(collection.indexes)) {
                totalIndexes += collection.indexes.length;
                let collectionOps = 0;
                collection.indexes.forEach((index: any) => {
                    const ops = index.ops || 0;
                    if (ops === 0) unusedIndexes++;
                    collectionOps += ops;
                    totalOperations += ops;
                });
                if (collectionOps > 1000000) highUsageCollections++;
            }
        });

        return { totalCollections: collections.length, totalIndexes, unusedIndexes, highUsageCollections, totalOperations };
    };

    const filterAndSortCollections = (collections: any[]) => {
        if (!collections || collections.length === 0) return [];

        let filtered = collections.filter(collection =>
            collection.collectionName?.toLowerCase().includes(searchTerm.toLowerCase())
        );

        filtered.sort((a, b) => {
            switch (sortBy) {
                case 'name': return (a.collectionName || '').localeCompare(b.collectionName || '');
                case 'size': return (b.storageSize || 0) - (a.storageSize || 0);
                case 'documents': return (b.documentCount || 0) - (a.documentCount || 0);
                case 'usage':
                default:
                    const aOps = (a.indexes || []).reduce((sum: number, idx: any) => sum + (idx.ops || 0), 0);
                    const bOps = (b.indexes || []).reduce((sum: number, idx: any) => sum + (idx.ops || 0), 0);
                    return bOps - aOps;
            }
        });

        return filtered;
    };

    const getPaginatedCollections = () => {
        const filtered = filterAndSortCollections(indexUsageData?.collections || []);
        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        return { data: filtered.slice(startIndex, endIndex), total: filtered.length };
    };

    // AI Analysis for MongoDB Oplog when utilization is high
    const handleOplogAIAnalysis = async (oplogData: {
        oplog_count: number;
        oplog_max_size_mb: number;
        oplog_size_mb: number;
        oplog_storage_mb: number;
        oplog_utilization_percent: number;
        oplog_first_entry_timestamp: number;
        oplog_last_entry_timestamp: number;
        oplog_safe_downtime_hours: number;
        oplog_time_window_hours: number;
        oplog_time_window_seconds: number;
        replica_set?: string;
    }) => {
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
                title: 'ClusterEye AI Oplog Analysis',
                content: (
                    <div style={{
                        textAlign: 'center',
                        padding: '40px 20px'
                    }}>
                        <Spin size="large" />
                        <div style={{
                            marginTop: '20px',
                            fontSize: '16px',
                            color: '#47A248'
                        }}>
                            AI is analyzing your MongoDB oplog utilization...
                        </div>
                        <div style={{
                            marginTop: '10px',
                            fontSize: '14px',
                            color: '#888'
                        }}>
                            Generating optimization recommendations
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
                        content: `Analyze this MongoDB oplog high utilization issue and provide specific solutions:

**Current Oplog Situation:**
- **Oplog Entry Count:** ${Math.round(oplogData.oplog_count).toLocaleString()} entries
- **Current Oplog Size:** ${oplogData.oplog_size_mb.toFixed(1)} MB
- **Maximum Oplog Size:** ${oplogData.oplog_max_size_mb.toFixed(1)} MB
- **Oplog Storage Used:** ${oplogData.oplog_storage_mb.toFixed(1)} MB
- **⚠️ Utilization:** ${oplogData.oplog_utilization_percent.toFixed(1)}% (CRITICAL - Over 90%)
- **Available Space:** ${(oplogData.oplog_max_size_mb - oplogData.oplog_size_mb).toFixed(1)} MB
- **🕒 Time Window:** ${oplogData.oplog_time_window_hours.toFixed(1)} hours (oplog coverage)
- **⏰ Safe Downtime:** ${oplogData.oplog_safe_downtime_hours.toFixed(1)} hours (max secondary downtime)
- **First Entry:** ${formatTimestamp(oplogData.oplog_first_entry_timestamp)}
- **Last Entry:** ${formatTimestamp(oplogData.oplog_last_entry_timestamp)}
${oplogData.replica_set ? `- **Replica Set:** ${oplogData.replica_set}` : ''}

**Important Context:** Oplog reaching 100% is not an error itself - MongoDB oplog is a capped collection that overwrites old entries. The REAL RISK is if replica nodes fall behind and experience "oplog gaps" requiring full initial sync.

**Please provide:**
1. **Immediate Actions** (2-3 urgent steps to prevent replication gaps)
2. **Oplog Size Optimization** (how to resize oplog safely)
3. **Replication Lag Monitoring** (prevent secondary nodes from falling behind)
4. **Write Operation Analysis** (potential causes of high oplog growth)

Keep response under 250 words, focus on preventing replication gaps rather than just oplog fullness. This is about replica set health.`
                    }],
                    temperature: 0,
                    top_p: 0.01,
                    max_tokens: 350,
                    max_completion_tokens: 350,
                    stream: false
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
                        <RobotOutlined style={{ fontSize: '20px', color: '#47A248' }} />
                        <span>ClusterEye AI Oplog Optimization</span>
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
                                dbType="mongodb"
                            />
                        </div>
                        <div style={{
                            fontSize: '12px',
                            color: '#888',
                            textAlign: 'right',
                            padding: '8px',
                            backgroundColor: '#fff1f0',
                            borderRadius: '4px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            border: '1px solid #ffccc7'
                        }}>
                            <span style={{ color: '#cf1322' }}>
                                <RobotOutlined style={{ marginRight: '4px' }} />
                                🚨 Critical Oplog Analysis
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
            console.error('Error during AI oplog analysis:', error);
            message.error('Failed to analyze oplog with AI');
        }
    };

    // AI Analysis for MongoDB Working Set when it's too large
    const handleWorkingSetAIAnalysis = async (workingSetData: {
        indexSize: number;
        activeData: number;
        connectionOverhead: number;
        workingSetMB: number;
        availableRAM: number;
        ramUsagePercent: string;
    }) => {
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
                title: 'ClusterEye AI Working Set Analysis',
                content: (
                    <div style={{
                        textAlign: 'center',
                        padding: '40px 20px'
                    }}>
                        <Spin size="large" />
                        <div style={{
                            marginTop: '20px',
                            fontSize: '16px',
                            color: '#47A248'
                        }}>
                            AI is analyzing your MongoDB working set...
                        </div>
                        <div style={{
                            marginTop: '10px',
                            fontSize: '14px',
                            color: '#888'
                        }}>
                            Generating optimization recommendations
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
                        content: `Analyze this MongoDB working set that's too large for available RAM and provide specific optimization recommendations:

**Current Situation:**
- Index Size: ${workingSetData.indexSize.toFixed(1)} MB (must be in RAM)
- Estimated Active Data: ${workingSetData.activeData.toFixed(1)} MB (~25% of total data)
- Connection Overhead: ${workingSetData.connectionOverhead.toFixed(1)} MB
- **Total Working Set: ${workingSetData.workingSetMB.toFixed(1)} MB**
- **Available RAM: ${formatBytes(workingSetData.availableRAM, 0)}**
- **RAM Usage: ${workingSetData.ramUsagePercent}%** ⚠️ TOO HIGH

**Please provide:**
1. **Immediate Actions** (2-3 specific steps to reduce working set)
2. **Index Optimization** (which indexes to review/remove)
3. **Memory Scaling** (recommended RAM upgrade if needed)
4. **Connection Tuning** (reduce connection overhead)

Keep response under 200 words, focus on actionable MongoDB-specific recommendations.`
                    }],
                    temperature: 0,
                    top_p: 0.01,
                    max_tokens: 300,
                    max_completion_tokens: 300,
                    stream: false
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
                        <RobotOutlined style={{ fontSize: '20px', color: '#47A248' }} />
                        <span>ClusterEye AI Working Set Recommendations</span>
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
                                dbType="mongodb"
                            />
                        </div>
                        <div style={{
                            fontSize: '12px',
                            color: '#888',
                            textAlign: 'right',
                            padding: '8px',
                            backgroundColor: '#f0f9f0',
                            borderRadius: '4px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <span style={{ color: '#47A248' }}>
                                <RobotOutlined style={{ marginRight: '4px' }} />
                                Powered by ClusterEye AI
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
            console.error('Error during AI working set analysis:', error);
            message.error('Failed to analyze working set with AI');
        }
    };

    // Node change handler
    const handleNodeChange = (value: string) => {
        if (manualNodeChangeInProgress) return;

        setManualNodeChangeInProgress(true);
        setNodeName(value);
        setCurrentStep(2);

        // Reset states
        setServerInfo(null);
        setConnections(null);
        setDatabaseStats([]);
        setCollectionStats([]);
        setOperationStats(null);
        setOperationSummary(null);
        setCurrentOps(null);
        setReplicationStatus(null);
        setReplicationSummary(null);
        setOplogMetrics(null);
        setSystemMetrics(null);
        setConnectionsHistoricalData([]);
        setReplicationHistoricalData([]);
        setOplogHistoricalData([]);
        setOperationsHistoricalData([]);
        setSystemCpuHistoricalData([]);
        setSystemMemoryHistoricalData([]);
        setSystemDiskHistoricalData([]);
        setDatabaseStorageHistoricalData([]);
        setDatabaseStorage7DayData([]);

        // Fetch initial data based on current tab and submenu
        Promise.all([
            // Only fetch databases if we're on collections submenu or if it's needed
            (() => {
                if (activeTab === '3' && (selectedSubMenu === 'collections' || selectedSubMenu === 'index-usage')) {
                    return fetchAvailableDatabases(value);
                }
                return Promise.resolve();
            })(),
            // Dynamically fetch data based on current tab and submenu
            (() => {
                if (activeTab === '1') {
                    // Server tab
                    if (selectedSubMenu === 'connections') {
                        return fetchConnectionsMetrics(value, selectedTimeRange);
                    } else if (selectedSubMenu === 'replication') {
                        return fetchReplicationMetrics(value, selectedTimeRange);
                    }
                } else if (activeTab === '2') {
                    // Queries tab
                    if (selectedSubMenu === 'operations') {
                        return fetchOperationsMetrics(value, selectedTimeRange);
                    }
                } else if (activeTab === '3') {
                    // Database tab
                    if (selectedSubMenu === 'database-stats') {
                        return Promise.all([
                            fetchDatabaseStorageMetrics(value, selectedTimeRange),
                            fetchSystemDiskMetrics(value, selectedTimeRange)
                        ]);
                    }
                    return Promise.resolve();
                } else if (activeTab === '4') {
                    // System tab
                    if (selectedSubMenu === 'system-cpu') {
                        return fetchSystemCpuMetrics(value, selectedTimeRange);
                    } else if (selectedSubMenu === 'system-memory') {
                        return fetchSystemMemoryMetrics(value, selectedTimeRange);
                    } else if (selectedSubMenu === 'system-disk') {
                        return fetchSystemDiskMetrics(value, selectedTimeRange);
                    }
                    return Promise.resolve();
                }
                return Promise.resolve();
            })()
        ]).finally(() => {
            setManualNodeChangeInProgress(false);
        });
    };

    // Database change handler
    const handleDatabaseChange = (value: string) => {
        setSelectedDatabase(value);
        setCurrentStep(3);
        
        // Clear selections when changing database
        setSelectedCollections([]);
        
        // If we're on collections submenu, fetch collection data immediately
        if (selectedSubMenu === 'collections' && nodeName) {
            fetchCollectionMetrics(nodeName, value);
            fetchCollectionHistoricalData(nodeName, value, selectedTimeRange);
        }
        
        // If we're on index-usage submenu, fetch index data immediately
        if (selectedSubMenu === 'index-usage' && nodeName) {
            fetchIndexUsageStats(nodeName, value);
        }
    };

    // Sub menu click handler - fetch data but prevent duplicate calls
    const handleSubMenuClick = (key: string) => {
        setSelectedSubMenu(key);

        // Fetch data based on selected submenu if we have a node selected and not already loading
        if (nodeName) {
            switch (key) {
                case 'connections':
                    if (!connectionsDataLoading) {
                        fetchConnectionsMetrics(nodeName, selectedTimeRange);
                    }
                    break;
                case 'replication':
                    if (!replicationDataLoading) {
                        fetchReplicationMetrics(nodeName, selectedTimeRange);
                    }
                    break;
                case 'oplog':
                    if (!oplogDataLoading) {
                        fetchOplogMetrics(nodeName, selectedTimeRange);
                    }
                    break;
                case 'operations':
                    if (!operationsDataLoading) {
                        fetchOperationsMetrics(nodeName, selectedTimeRange);
                    }
                    break;
                case 'current-ops':
                    if (!currentOpsDataLoading) {
                        fetchCurrentOps(nodeName, currentOpsMinSeconds);
                    }
                    break;
                case 'database-stats':
                    if (!databaseStorageDataLoading) {
                        fetchDatabaseStorageMetrics(nodeName, selectedTimeRange);
                    }
                    if (!databaseStorage7DayLoading) {
                        fetchDatabaseStorage7DayMetrics(nodeName);
                    }
                    if (!systemDiskDataLoading) {
                        fetchSystemDiskMetrics(nodeName, selectedTimeRange);
                    }
                    break;
                case 'working-set':
                    // Working set analysis needs both database storage and system metrics
                    if (!databaseStorageDataLoading) {
                        fetchDatabaseStorageMetrics(nodeName, selectedTimeRange);
                    }
                    if (!databaseStorage7DayLoading) {
                        fetchDatabaseStorage7DayMetrics(nodeName);
                    }
                    if (!systemCpuDataLoading) {
                        fetchSystemCpuMetrics(nodeName, selectedTimeRange);
                    }
                    if (!systemMemoryDataLoading) {
                        fetchSystemMemoryMetrics(nodeName, selectedTimeRange);
                    }
                    if (!systemDiskDataLoading) {
                        fetchSystemDiskMetrics(nodeName, selectedTimeRange);
                    }
                    break;
                case 'collections':
                    if (!databasesLoading) {
                        fetchAvailableDatabases(nodeName);
                    }
                    if (selectedDatabase && !collectionMetricsLoading) {
                        fetchCollectionMetrics(nodeName, selectedDatabase);
                        fetchCollectionHistoricalData(nodeName, selectedDatabase, selectedTimeRange);
                    }
                    break;
                case 'index-usage':
                    if (!databasesLoading) {
                        fetchAvailableDatabases(nodeName);
                    }
                    if (selectedDatabase && !indexUsageLoading) {
                        fetchIndexUsageStats(nodeName, selectedDatabase);
                    }
                    break;
                case 'system-metrics':
                case 'system-cpu':
                    if (!systemCpuDataLoading) {
                        fetchSystemCpuMetrics(nodeName, selectedTimeRange);
                    }
                    break;
                case 'system-memory':
                    if (!systemMemoryDataLoading) {
                        fetchSystemMemoryMetrics(nodeName, selectedTimeRange);
                    }
                    break;
                case 'system-disk':
                    if (!systemDiskDataLoading) {
                        fetchSystemDiskMetrics(nodeName, selectedTimeRange);
                    }
                    break;
                default:
                    break;
            }
        }
    };

    // Time range change handler
    const handleTimeRangeChange = (value: string) => {
        setSelectedTimeRange(value);

        // Refetch data for current submenu with new time range
        if (nodeName) {
            switch (selectedSubMenu) {
                case 'connections':
                    fetchConnectionsMetrics(nodeName, value);
                    break;
                case 'replication':
                    fetchReplicationMetrics(nodeName, value);
                    break;
                case 'oplog':
                    fetchOplogMetrics(nodeName, value);
                    break;
                case 'operations':
                    fetchOperationsMetrics(nodeName, value);
                    break;
                case 'database-stats':
                    fetchDatabaseStorageMetrics(nodeName, value);
                    // Fetch 7-day data for capacity planning (doesn't change with time range selection)
                    fetchDatabaseStorage7DayMetrics(nodeName);
                    // Also fetch system disk metrics for disk capacity prediction
                    fetchSystemDiskMetrics(nodeName, value);
                    break;
                case 'working-set':
                    fetchDatabaseStorageMetrics(nodeName, value);
                    // Fetch 7-day data for capacity planning (doesn't change with time range selection)
                    fetchDatabaseStorage7DayMetrics(nodeName);
                    // Also fetch system metrics for working set calculation
                    fetchSystemCpuMetrics(nodeName, value);
                    fetchSystemMemoryMetrics(nodeName, value);
                    fetchSystemDiskMetrics(nodeName, value);
                    break;
                case 'collections':
                    if (selectedDatabase) {
                        // Clear historical data and show loading immediately
                        setCollectionHistoricalData([]);
                        setCollectionHistoricalLoading(true);
                        // Clear cache to force fresh data fetch for new time range
                        collectionHistoricalCache.current.clear();
                        // Table data doesn't need to be refetched on time range change
                        fetchCollectionHistoricalData(nodeName, selectedDatabase, value);
                    }
                    break;
                case 'system-cpu':
                case 'system-metrics':
                    fetchSystemCpuMetrics(nodeName, value);
                    break;
                case 'system-memory':
                    fetchSystemMemoryMetrics(nodeName, value);
                    break;
                case 'system-disk':
                    fetchSystemDiskMetrics(nodeName, value);
                    break;
                default:
                    break;
            }
        }
    };

    // Effect for cluster data changes
    useEffect(() => {
        if (clusterName && data[clusterName]) {
            const nodes = data[clusterName];
            setNodeInfo(nodes);
            setCurrentStep(1);

            if (hostNameFromURL && nodes.some(node => node.Hostname === hostNameFromURL)) {
                setNodeName(hostNameFromURL);
                setCurrentStep(2);
            } else if (nodes.length === 1) {
                setNodeName(nodes[0].Hostname);
                setCurrentStep(2);
            } else if (nodes.length > 1) {
                setCurrentStep(1);
                setNodeName('');
            }
        }
    }, [clusterName, data, hostNameFromURL]);

    // Effect for node selection
    useEffect(() => {
        if (nodeName && currentStep === 1) {
            handleNodeChange(nodeName);
        }
    }, [nodeName, currentStep]);

    // Render functions for different tabs
    const renderServerTab = () => {
        switch (selectedSubMenu) {
            case 'connections':
                return (
                    <div>
                        {/* Time Range Selector */}
                        <Card style={{ marginBottom: '16px' }}>
                            <Row gutter={[16, 16]} align="middle">
                                <Col>
                                    <span style={{ fontWeight: 500, marginRight: '8px' }}>Time Range:</span>
                                </Col>
                                <Col>
                                    <Select
                                        value={selectedTimeRange}
                                        onChange={handleTimeRangeChange}
                                        style={{ width: '120px' }}
                                        options={[
                                            { label: '15 minutes', value: '15m' },
                                            { label: '1 hour', value: '1h' },
                                            { label: '3 hours', value: '3h' },
                                            { label: '6 hours', value: '6h' },
                                            { label: '12 hours', value: '12h' },
                                            { label: '1 day', value: '1d' },
                                            { label: '3 days', value: '3d' },
                                            { label: '7 days', value: '7d' }
                                        ]}
                                    />
                                </Col>
                                <Col style={{ marginLeft: 'auto' }}>
                                    <Button
                                        type="primary"
                                        icon={<ReloadOutlined />}
                                        onClick={() => fetchConnectionsMetrics(nodeName, selectedTimeRange)}
                                        loading={connectionsDataLoading}
                                        style={{
                                            background: '#47A248',
                                            borderColor: '#47A248'
                                        }}
                                    >
                                        Refresh
                                    </Button>
                                </Col>
                            </Row>
                        </Card>

                        {/* Current Connection Stats */}
                        {connections && (
                            <Card title="Current Connection Statistics" style={{ marginBottom: '16px' }}>
                                <Row gutter={[16, 16]}>
                                    <Col span={12}>
                                        <Statistic
                                            title="Current Connections"
                                            value={connections.current}
                                            valueStyle={{ color: '#cf1322' }}
                                            suffix="connections"
                                        />
                                    </Col>
                                    <Col span={12}>
                                        <Statistic
                                            title="Available Connections"
                                            value={connections.available}
                                            valueStyle={{ color: '#1890ff' }}
                                            suffix="connections"
                                        />
                                    </Col>
                                </Row>
                            </Card>
                        )}

                        {/* Connections Chart */}
                        <Card
                            title="MongoDB Connections Over Time"
                            loading={connectionsDataLoading}
                            extra={
                                <Tooltip title="Shows current and available connections over time">
                                    <InfoCircleOutlined />
                                </Tooltip>
                            }
                        >
                            {connectionsHistoricalData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={400}>
                                    <LineChart data={connectionsHistoricalData}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis
                                            dataKey="time"
                                            tick={{ fontSize: 12 }}
                                            angle={-45}
                                            textAnchor="end"
                                            height={60}
                                        />
                                        <YAxis />
                                        <RechartsTooltip
                                            formatter={(value: any, name: string) => {
                                                const label = name === 'connections_current' ? 'Current' :
                                                    name === 'connections_available' ? 'Available' : name;
                                                return [Math.round(value), label];
                                            }}
                                            labelFormatter={(label) => `Time: ${label}`}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="connections_current"
                                            stroke="#cf1322"
                                            strokeWidth={2}
                                            name="Current Connections"
                                            dot={{ r: 4 }}
                                            activeDot={{ r: 6 }}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="connections_available"
                                            stroke="#1890ff"
                                            strokeWidth={2}
                                            name="Available Connections"
                                            dot={{ r: 4 }}
                                            activeDot={{ r: 6 }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '40px' }}>
                                    <Empty description="No connection data available" />
                                </div>
                            )}
                        </Card>
                    </div>
                );

            case 'replication':
                // Get unique members from replication data for chart lines
                const members = new Set<string>();
                const memberColors = ['#1890ff', '#52c41a', '#fa8c16', '#eb2f96', '#722ed1', '#13c2c2'];

                if (replicationHistoricalData.length > 0) {
                    Object.keys(replicationHistoricalData[0]).forEach(key => {
                        if (key.endsWith('_lag_ms_num')) {
                            const member = key.replace('_lag_ms_num', '').replace(/_/g, ':');
                            members.add(member);
                        }
                    });
                }

                return (
                    <div>
                        {/* Time Range Selector */}
                        <Card style={{ marginBottom: '16px' }}>
                            <Row gutter={[16, 16]} align="middle">
                                <Col>
                                    <span style={{ fontWeight: 500, marginRight: '8px' }}>Time Range:</span>
                                </Col>
                                <Col>
                                    <Select
                                        value={selectedTimeRange}
                                        onChange={handleTimeRangeChange}
                                        style={{ width: '120px' }}
                                        options={[
                                            { label: '15 minutes', value: '15m' },
                                            { label: '1 hour', value: '1h' },
                                            { label: '3 hours', value: '3h' },
                                            { label: '6 hours', value: '6h' },
                                            { label: '12 hours', value: '12h' },
                                            { label: '1 day', value: '1d' },
                                            { label: '3 days', value: '3d' },
                                            { label: '7 days', value: '7d' }
                                        ]}
                                    />
                                </Col>
                                <Col style={{ marginLeft: 'auto' }}>
                                    <Button
                                        type="primary"
                                        icon={<ReloadOutlined />}
                                        onClick={() => fetchReplicationMetrics(nodeName, selectedTimeRange)}
                                        loading={replicationDataLoading}
                                        style={{
                                            background: '#47A248',
                                            borderColor: '#47A248'
                                        }}
                                    >
                                        Refresh
                                    </Button>
                                </Col>
                            </Row>
                        </Card>

                        {/* Replication Summary Stats */}
                        {replicationStatus && (
                            <Card title="Replication Summary" style={{ marginBottom: '16px' }}>
                                <Row gutter={[16, 16]}>
                                    <Col span={6}>
                                        <Statistic
                                            title="Replica Set Members"
                                            value={replicationStatus.votingMembersCount}
                                            valueStyle={{ color: '#1890ff' }}
                                            suffix="nodes"
                                        />
                                    </Col>
                                    <Col span={6}>
                                        <Statistic
                                            title="Latest Lag"
                                            value={(() => {
                                                // Calculate latest lag from the most recent data
                                                if (replicationHistoricalData.length > 0) {
                                                    const latestData = replicationHistoricalData[replicationHistoricalData.length - 1];
                                                    const lagValues = Object.keys(latestData)
                                                        .filter(key => key.endsWith('_lag_ms_num'))
                                                        .map(key => latestData[key] || 0);
                                                    return lagValues.length > 0 ? Math.max(...lagValues).toFixed(1) : '0.0';
                                                }
                                                return replicationSummary?.latest_replication_lag_seconds
                                                    ? (replicationSummary.latest_replication_lag_seconds * 1000).toFixed(1)
                                                    : '0.0';
                                            })()}
                                            valueStyle={{ color: '#52c41a' }}
                                            suffix="ms"
                                        />
                                    </Col>
                                    <Col span={6}>
                                        <Statistic
                                            title="Max Lag"
                                            value={replicationSummary?.max_replication_lag_seconds
                                                ? (replicationSummary.max_replication_lag_seconds * 1000).toFixed(1)
                                                : '0.0'}
                                            valueStyle={{ color: '#fa8c16' }}
                                            suffix="ms"
                                        />
                                    </Col>
                                    <Col span={6}>
                                        <Statistic
                                            title="Avg Lag"
                                            value={replicationSummary?.avg_replication_lag_seconds
                                                ? (replicationSummary.avg_replication_lag_seconds * 1000).toFixed(1)
                                                : '0.0'}
                                            valueStyle={{ color: '#722ed1' }}
                                            suffix="ms"
                                        />
                                    </Col>
                                </Row>
                            </Card>
                        )}

                        {/* Replica Set Members */}
                        {members.size > 0 && (
                            <Card title="Replica Set Members" style={{ marginBottom: '16px' }}>
                                <Row gutter={[16, 16]}>
                                    {Array.from(members).map((member, index) => {
                                        // Determine member status from nodeshealth data
                                        let memberStatus = 'SECONDARY';
                                        let statusColor = '#1890ff'; // Blue for secondary
                                        let nodeVersion = '';
                                        let nodeLocationInfo = '';

                                        // Find the node in the cluster data using hostname
                                        if (clusterName && data[clusterName]) {
                                            const actualClusterKey = clusterName === 'Standalone' ? '' : clusterName;
                                            const clusterNodes = data[actualClusterKey] || data[clusterName];
                                            
                                            // Try to match by different formats
                                            const nodeData = clusterNodes.find(node => {
                                                // Direct hostname match
                                                if (node.Hostname === member) return true;
                                                
                                                // IP:Port format match
                                                const nodeIpPort = `${node.IP}:${node.Port || '27017'}`;
                                                if (nodeIpPort === member) return true;
                                                
                                                // Extract hostname/IP from member (remove port)
                                                const memberHostname = member.split(':')[0];
                                                if (node.Hostname === memberHostname || node.IP === memberHostname) return true;
                                                
                                                // Handle potential IP format variations
                                                // Sometimes IP might come as "10:30:101:125" instead of "10.30.101.125"
                                                const normalizedMemberIP = member.replace(/:/g, '.').split('.').slice(0, 4).join('.');
                                                if (node.IP === normalizedMemberIP) return true;
                                                
                                                return false;
                                            });

                                            if (nodeData) {
                                                // Use actual node status from nodeshealth
                                                if (nodeData.IsPrimary === true || nodeData.NodeStatus === 'PRIMARY') {
                                                    memberStatus = 'PRIMARY';
                                                    statusColor = '#52c41a'; // Green for primary
                                                } else if (nodeData.NodeStatus === 'SECONDARY') {
                                                    memberStatus = 'SECONDARY';
                                                    statusColor = '#1890ff'; // Blue for secondary
                                                } else if (nodeData.NodeStatus === 'ARBITER') {
                                                    memberStatus = 'ARBITER';
                                                    statusColor = '#fa8c16'; // Orange for arbiter
                                                } else {
                                                    memberStatus = nodeData.NodeStatus || 'UNKNOWN';
                                                    statusColor = '#8c8c8c'; // Gray for unknown
                                                }
                                                nodeVersion = nodeData.MongoVersion || '';
                                                nodeLocationInfo = nodeData.Location || '';
                                            }
                                        }

                                        return (
                                            <Col span={8} key={member}>
                                                <Card size="small" style={{ textAlign: 'center' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                                        <div
                                                            style={{
                                                                width: '12px',
                                                                height: '12px',
                                                                borderRadius: '50%',
                                                                backgroundColor: memberColors[index % memberColors.length]
                                                            }}
                                                        />
                                                        <span style={{ fontWeight: 500, fontSize: '13px' }}>{member}</span>
                                                    </div>
                                                    <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                        <Tag 
                                                            color={
                                                                memberStatus === 'PRIMARY' ? 'green' : 
                                                                memberStatus === 'SECONDARY' ? 'blue' : 
                                                                memberStatus === 'ARBITER' ? 'orange' : 'default'
                                                            } 
                                                            style={{ margin: 0, fontSize: '11px', fontWeight: 500 }}
                                                        >
                                                            {memberStatus}
                                                        </Tag>
                                                        {nodeVersion && (
                                                            <div style={{ fontSize: '10px', color: '#8c8c8c' }}>
                                                                v{nodeVersion}
                                                            </div>
                                                        )}
                                                        {nodeLocationInfo && (
                                                            <div style={{ fontSize: '10px', color: '#8c8c8c' }}>
                                                                📍 {nodeLocationInfo}
                                                            </div>
                                                        )}
                                                    </div>
                                                </Card>
                                            </Col>
                                        );
                                    })}
                                </Row>
                            </Card>
                        )}

                        {/* Replication Lag Chart */}
                        <Card
                            title="MongoDB Replication Lag Over Time"
                            loading={replicationDataLoading}
                            extra={
                                <Tooltip title="Shows replication lag in milliseconds for each replica set member">
                                    <InfoCircleOutlined />
                                </Tooltip>
                            }
                        >
                            {replicationHistoricalData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={400}>
                                    <LineChart data={replicationHistoricalData}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis
                                            dataKey="time"
                                            tick={{ fontSize: 12 }}
                                            angle={-45}
                                            textAnchor="end"
                                            height={60}
                                        />
                                        <YAxis
                                            label={{ value: 'Lag (ms)', angle: -90, position: 'insideLeft' }}
                                        />
                                        <RechartsTooltip
                                            formatter={(value: any, name: string) => {
                                                const memberName = name.replace('_lag_ms_num', '').replace(/_/g, ':');
                                                return [Math.round(value), `${memberName} Lag`];
                                            }}
                                            labelFormatter={(label) => `Time: ${label}`}
                                        />
                                        {Array.from(members).map((member, index) => {
                                            const dataKey = member.replace(/[.:]/g, '_') + '_lag_ms_num';
                                            return (
                                                <Line
                                                    key={member}
                                                    type="monotone"
                                                    dataKey={dataKey}
                                                    stroke={memberColors[index % memberColors.length]}
                                                    strokeWidth={2}
                                                    name={`${member}_lag_ms_num`}
                                                    dot={{ r: 3 }}
                                                    activeDot={{ r: 5 }}
                                                    connectNulls={false}
                                                />
                                            );
                                        })}
                                    </LineChart>
                                </ResponsiveContainer>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '40px' }}>
                                    <Empty description="No replication data available" />
                                </div>
                            )}
                        </Card>
                    </div>
                );

            case 'oplog':
                return (
                    <div>
                        {/* Time Range Selector */}
                        <Card style={{ marginBottom: '16px' }}>
                            <Row gutter={[16, 16]} align="middle">
                                <Col>
                                    <span style={{ fontWeight: 500, marginRight: '8px' }}>Time Range:</span>
                                </Col>
                                <Col>
                                    <Select
                                        value={selectedTimeRange}
                                        onChange={handleTimeRangeChange}
                                        style={{ width: '120px' }}
                                        options={[
                                            { label: '15 minutes', value: '15m' },
                                            { label: '1 hour', value: '1h' },
                                            { label: '3 hours', value: '3h' },
                                            { label: '6 hours', value: '6h' },
                                            { label: '12 hours', value: '12h' },
                                            { label: '1 day', value: '1d' },
                                            { label: '3 days', value: '3d' },
                                            { label: '7 days', value: '7d' }
                                        ]}
                                    />
                                </Col>
                                <Col style={{ marginLeft: 'auto' }}>
                                    <Button
                                        type="primary"
                                        icon={<ReloadOutlined />}
                                        onClick={() => fetchOplogMetrics(nodeName, selectedTimeRange)}
                                        loading={oplogDataLoading}
                                        style={{
                                            background: '#47A248',
                                            borderColor: '#47A248'
                                        }}
                                    >
                                        Refresh
                                    </Button>
                                </Col>
                            </Row>
                        </Card>

                        {/* Current Oplog Stats */}
                        {oplogMetrics && (
                            <Card title="Current Oplog Statistics" style={{ marginBottom: '16px' }}>
                                <Row gutter={[16, 16]}>
                                    <Col span={8}>
                                        <Statistic
                                            title="Oplog Entry Count"
                                            value={Math.round(oplogMetrics.oplog_count).toLocaleString()}
                                            valueStyle={{ color: '#1890ff' }}
                                            suffix="entries"
                                        />
                                    </Col>
                                    <Col span={8}>
                                        <Statistic
                                            title="Oplog Size"
                                            value={`${oplogMetrics.oplog_size_mb.toFixed(1)} MB`}
                                            valueStyle={{ color: '#52c41a' }}
                                        />
                                    </Col>
                                    <Col span={8}>
                                        <Statistic
                                            title="Oplog Utilization"
                                            value={oplogMetrics.oplog_utilization_percent.toFixed(1)}
                                            valueStyle={{ 
                                                color: oplogMetrics.oplog_utilization_percent > 90 ? '#cf1322' : 
                                                       oplogMetrics.oplog_utilization_percent > 75 ? '#fa8c16' : '#52c41a' 
                                            }}
                                            suffix="%"
                                        />
                                    </Col>
                                </Row>
                                <Row gutter={[16, 16]} style={{ marginTop: '16px' }}>
                                    <Col span={8}>
                                        <Statistic
                                            title="Max Oplog Size"
                                            value={`${oplogMetrics.oplog_max_size_mb.toFixed(1)} MB`}
                                            valueStyle={{ color: '#722ed1' }}
                                        />
                                    </Col>
                                    <Col span={8}>
                                        <Statistic
                                            title="Oplog Storage"
                                            value={`${oplogMetrics.oplog_storage_mb.toFixed(1)} MB`}
                                            valueStyle={{ color: '#fa8c16' }}
                                        />
                                    </Col>
                                    <Col span={8}>
                                        <Statistic
                                            title="Available Space"
                                            value={`${(oplogMetrics.oplog_max_size_mb - oplogMetrics.oplog_size_mb).toFixed(1)} MB`}
                                            valueStyle={{ color: '#13c2c2' }}
                                        />
                                    </Col>
                                </Row>

                                {/* Oplog Utilization Progress */}
                                <Row style={{ marginTop: '16px' }}>
                                    <Col span={24}>
                                        <div style={{ marginBottom: '8px' }}>
                                            <span style={{ fontWeight: 500 }}>Oplog Space Utilization</span>
                                        </div>
                                        <Progress
                                            percent={oplogMetrics.oplog_utilization_percent}
                                            strokeColor={
                                                oplogMetrics.oplog_utilization_percent > 90 ? '#cf1322' : 
                                                oplogMetrics.oplog_utilization_percent > 75 ? '#fa8c16' : '#52c41a'
                                            }
                                            format={percent => `${Math.round((percent || 0) * 10) / 10}% Used`}
                                            style={{ marginBottom: '8px' }}
                                        />
                                                                                 {oplogMetrics.oplog_utilization_percent > 90 && (
                                             <Alert
                                                 message="High Oplog Utilization Warning"
                                                 description="Oplog is over 90% full. Consider increasing oplog size or reviewing retention policies."
                                                 type="error"
                                                 showIcon
                                                 style={{ marginTop: '8px' }}
                                                 action={
                                                     <Button 
                                                         type="primary"
                                                         icon={<RobotOutlined />}
                                                         onClick={() => handleOplogAIAnalysis({
                                                             oplog_count: oplogMetrics.oplog_count,
                                                             oplog_max_size_mb: oplogMetrics.oplog_max_size_mb,
                                                             oplog_size_mb: oplogMetrics.oplog_size_mb,
                                                             oplog_storage_mb: oplogMetrics.oplog_storage_mb,
                                                             oplog_utilization_percent: oplogMetrics.oplog_utilization_percent,
                                                             oplog_first_entry_timestamp: oplogMetrics.oplog_first_entry_timestamp,
                                                             oplog_last_entry_timestamp: oplogMetrics.oplog_last_entry_timestamp,
                                                             oplog_safe_downtime_hours: oplogMetrics.oplog_safe_downtime_hours,
                                                             oplog_time_window_hours: oplogMetrics.oplog_time_window_hours,
                                                             oplog_time_window_seconds: oplogMetrics.oplog_time_window_seconds,
                                                             replica_set: replicationStatus?.set
                                                         })}
                                                         style={{
                                                             background: '#47A248',
                                                             borderColor: '#47A248'
                                                         }}
                                                         size="small"
                                                     >
                                                         Get AI Recommendations
                                                     </Button>
                                                 }
                                             />
                                         )}
                                                                                 {oplogMetrics.oplog_utilization_percent > 75 && oplogMetrics.oplog_utilization_percent <= 90 && (
                                             <Alert
                                                 message="Moderate Oplog Utilization"
                                                 description="Oplog is over 75% full. Monitor utilization and plan for potential size increase."
                                                 type="warning"
                                                 showIcon
                                                 style={{ marginTop: '8px' }}
                                                 action={
                                                     <Button 
                                                         type="default"
                                                         icon={<RobotOutlined />}
                                                         onClick={() => handleOplogAIAnalysis({
                                                             oplog_count: oplogMetrics.oplog_count,
                                                             oplog_max_size_mb: oplogMetrics.oplog_max_size_mb,
                                                             oplog_size_mb: oplogMetrics.oplog_size_mb,
                                                             oplog_storage_mb: oplogMetrics.oplog_storage_mb,
                                                             oplog_utilization_percent: oplogMetrics.oplog_utilization_percent,
                                                             oplog_first_entry_timestamp: oplogMetrics.oplog_first_entry_timestamp,
                                                             oplog_last_entry_timestamp: oplogMetrics.oplog_last_entry_timestamp,
                                                             oplog_safe_downtime_hours: oplogMetrics.oplog_safe_downtime_hours,
                                                             oplog_time_window_hours: oplogMetrics.oplog_time_window_hours,
                                                             oplog_time_window_seconds: oplogMetrics.oplog_time_window_seconds,
                                                             replica_set: replicationStatus?.set
                                                         })}
                                                         style={{
                                                             borderColor: '#47A248',
                                                             color: '#47A248'
                                                         }}
                                                         size="small"
                                                     >
                                                         Get AI Advice
                                                     </Button>
                                                 }
                                             />
                                         )}
                                    </Col>
                                </Row>
                            </Card>
                        )}

                        {/* Oplog Time Window & Safety Metrics */}
                        {oplogMetrics && (
                            <Card title="Oplog Time Window & Safety Metrics" style={{ marginBottom: '16px' }}>
                                <Row gutter={[16, 16]}>
                                    <Col span={8}>
                                        <Statistic
                                            title="Oplog Time Window"
                                            value={formatHours(oplogMetrics.oplog_time_window_hours)}
                                            valueStyle={{ color: '#1890ff' }}
                                            prefix={<DatabaseOutlined />}
                                        />
                                        <div style={{ fontSize: '12px', color: '#8c8c8c', marginTop: '4px' }}>
                                            Total time coverage of oplog entries
                                        </div>
                                    </Col>
                                    <Col span={8}>
                                        <Statistic
                                            title="Safe Downtime Window"
                                            value={formatHours(oplogMetrics.oplog_safe_downtime_hours)}
                                            valueStyle={{ 
                                                color: oplogMetrics.oplog_safe_downtime_hours < 1 ? '#cf1322' : 
                                                       oplogMetrics.oplog_safe_downtime_hours < 6 ? '#fa8c16' : '#52c41a' 
                                            }}
                                            prefix={<SettingOutlined />}
                                        />
                                        <div style={{ fontSize: '12px', color: '#8c8c8c', marginTop: '4px' }}>
                                            Max safe secondary downtime
                                        </div>
                                    </Col>
                                    <Col span={8}>
                                        <Statistic
                                            title="Safety Status"
                                            value={(() => {
                                                const hours = oplogMetrics.oplog_safe_downtime_hours;
                                                if (hours < 1) return "⚠️ Critical";
                                                if (hours < 6) return "⏰ Warning";
                                                return "✅ Healthy";
                                            })()}
                                            valueStyle={{
                                                color: oplogMetrics.oplog_safe_downtime_hours < 1 ? '#cf1322' : 
                                                       oplogMetrics.oplog_safe_downtime_hours < 6 ? '#fa8c16' : '#52c41a'
                                            }}
                                        />
                                        <div style={{ fontSize: '12px', color: '#8c8c8c', marginTop: '4px' }}>
                                            Based on current oplog retention
                                        </div>
                                    </Col>
                                </Row>
                                <Row gutter={[16, 16]} style={{ marginTop: '16px' }}>
                                    <Col span={12}>
                                        <Card size="small" style={{ textAlign: 'center', backgroundColor: '#f9f9f9' }}>
                                            <div style={{ fontSize: '12px', color: '#8c8c8c', marginBottom: '4px' }}>
                                                First Oplog Entry
                                            </div>
                                            <div style={{ fontWeight: 500, color: '#595959' }}>
                                                {formatTimestamp(oplogMetrics.oplog_first_entry_timestamp)}
                                            </div>
                                        </Card>
                                    </Col>
                                    <Col span={12}>
                                        <Card size="small" style={{ textAlign: 'center', backgroundColor: '#f9f9f9' }}>
                                            <div style={{ fontSize: '12px', color: '#8c8c8c', marginBottom: '4px' }}>
                                                Last Oplog Entry
                                            </div>
                                            <div style={{ fontWeight: 500, color: '#595959' }}>
                                                {formatTimestamp(oplogMetrics.oplog_last_entry_timestamp)}
                                            </div>
                                        </Card>
                                    </Col>
                                </Row>

                                {/* Safety Recommendations */}
                                {oplogMetrics.oplog_safe_downtime_hours < 6 && (
                                    <Alert
                                        style={{ marginTop: '16px' }}
                                        message="Low Safe Downtime Window"
                                        description={
                                            oplogMetrics.oplog_safe_downtime_hours < 1 
                                                ? `🚨 Critical: Only ${formatHours(oplogMetrics.oplog_safe_downtime_hours)} safe downtime! Secondary nodes risk falling behind and requiring full initial sync.`
                                                : `⚠️ Warning: ${formatHours(oplogMetrics.oplog_safe_downtime_hours)} safe downtime. Consider increasing oplog size or monitoring replication lag more closely.`
                                        }
                                        type={oplogMetrics.oplog_safe_downtime_hours < 1 ? 'error' : 'warning'}
                                        showIcon
                                    />
                                )}
                            </Card>
                        )}

                        {/* Oplog Information Card */}
                        <Card 
                            title={
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <InfoCircleOutlined style={{ color: '#1890ff' }} />
                                    Understanding Oplog Utilization
                                </div>
                            } 
                            style={{ marginBottom: '16px' }}
                        >
                            <Alert
                                message="Important: Oplog reaching 100% is not an error by itself"
                                description={
                                    <div>
                                        <p style={{ margin: '8px 0' }}>
                                            <strong>Normal Behavior:</strong> MongoDB oplog is designed as a capped collection that automatically overwrites old entries when full.
                                        </p>
                                        <p style={{ margin: '8px 0' }}>
                                            <strong>⚠️ Critical Risk:</strong> If replica nodes fall behind in replication speed, or if a secondary node is offline for too long while the primary has already deleted old oplog entries:
                                        </p>
                                        <ul style={{ margin: '8px 0 8px 20px', lineHeight: '1.6' }}>
                                            <li><strong>Oplog Gap:</strong> Secondary node experiences an oplog gap and cannot resume replication</li>
                                            <li><strong>Initial Sync Required:</strong> Secondary must perform a full initial sync (heavy operation)</li>
                                            <li><strong>Data Risk:</strong> Risk of data loss if no proper backups exist during resync</li>
                                        </ul>
                                        <p style={{ margin: '8px 0 0 0', fontWeight: 500, color: '#1890ff' }}>
                                            💡 <strong>Best Practice:</strong> Monitor replication lag and ensure adequate oplog size for your write workload.
                                        </p>
                                    </div>
                                }
                                type="info"
                                showIcon
                                style={{ backgroundColor: '#f6ffed', border: '1px solid #b7eb8f' }}
                            />
                        </Card>

                        {/* Oplog Charts */}
                        <Row gutter={[16, 16]}>
                            <Col span={8}>
                                <Card
                                    title="Oplog Size & Utilization Over Time"
                                    loading={oplogDataLoading}
                                    extra={
                                        <Tooltip title="Shows oplog size, max size, and utilization percentage over time">
                                            <InfoCircleOutlined />
                                        </Tooltip>
                                    }
                                >
                                    {oplogHistoricalData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height={300}>
                                            <LineChart data={oplogHistoricalData}>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis
                                                    dataKey="time"
                                                    tick={{ fontSize: 11 }}
                                                    angle={-45}
                                                    textAnchor="end"
                                                    height={50}
                                                />
                                                <YAxis
                                                    yAxisId="size"
                                                    label={{ value: 'Size (MB)', angle: -90, position: 'insideLeft' }}
                                                />
                                                <YAxis
                                                    yAxisId="percent"
                                                    orientation="right"
                                                    label={{ value: 'Utilization (%)', angle: 90, position: 'insideRight' }}
                                                    domain={[0, 100]}
                                                />
                                                <RechartsTooltip
                                                    formatter={(value: any, name: string) => {
                                                        if (name === 'oplog_size_mb') {
                                                            return [`${Number(value).toFixed(1)} MB`, 'Oplog Size'];
                                                        } else if (name === 'oplog_max_size_mb') {
                                                            return [`${Number(value).toFixed(1)} MB`, 'Max Oplog Size'];
                                                        } else if (name === 'oplog_utilization_percent') {
                                                            return [`${Number(value).toFixed(1)}%`, 'Utilization'];
                                                        }
                                                        return [value, name];
                                                    }}
                                                    labelFormatter={(label) => `Time: ${label}`}
                                                />
                                                <Line
                                                    yAxisId="size"
                                                    type="monotone"
                                                    dataKey="oplog_size_mb"
                                                    stroke="#52c41a"
                                                    strokeWidth={2}
                                                    name="oplog_size_mb"
                                                    dot={{ r: 3 }}
                                                    activeDot={{ r: 5 }}
                                                />
                                                <Line
                                                    yAxisId="size"
                                                    type="monotone"
                                                    dataKey="oplog_max_size_mb"
                                                    stroke="#722ed1"
                                                    strokeWidth={2}
                                                    name="oplog_max_size_mb"
                                                    dot={{ r: 3 }}
                                                    activeDot={{ r: 5 }}
                                                    strokeDasharray="5 5"
                                                />
                                                <Line
                                                    yAxisId="percent"
                                                    type="monotone"
                                                    dataKey="oplog_utilization_percent"
                                                    stroke="#cf1322"
                                                    strokeWidth={3}
                                                    name="oplog_utilization_percent"
                                                    dot={{ r: 4 }}
                                                    activeDot={{ r: 6 }}
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div style={{ textAlign: 'center', padding: '40px' }}>
                                            <Empty description="No oplog size data available" />
                                        </div>
                                    )}
                                </Card>
                            </Col>
                            <Col span={8}>
                                <Card
                                    title="Oplog Entry Count & Storage Over Time"
                                    loading={oplogDataLoading}
                                    extra={
                                        <Tooltip title="Shows oplog entry count and storage usage over time">
                                            <InfoCircleOutlined />
                                        </Tooltip>
                                    }
                                >
                                    {oplogHistoricalData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height={300}>
                                            <LineChart data={oplogHistoricalData}>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis
                                                    dataKey="time"
                                                    tick={{ fontSize: 11 }}
                                                    angle={-45}
                                                    textAnchor="end"
                                                    height={50}
                                                />
                                                <YAxis
                                                    yAxisId="count"
                                                    label={{ value: 'Entry Count', angle: -90, position: 'insideLeft' }}
                                                    tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`}
                                                />
                                                <YAxis
                                                    yAxisId="storage"
                                                    orientation="right"
                                                    label={{ value: 'Storage (MB)', angle: 90, position: 'insideRight' }}
                                                />
                                                <RechartsTooltip
                                                    formatter={(value: any, name: string) => {
                                                        if (name === 'oplog_count') {
                                                            return [Math.round(value).toLocaleString(), 'Entry Count'];
                                                        } else if (name === 'oplog_storage_mb') {
                                                            return [`${Number(value).toFixed(1)} MB`, 'Storage Size'];
                                                        }
                                                        return [value, name];
                                                    }}
                                                    labelFormatter={(label) => `Time: ${label}`}
                                                />
                                                <Line
                                                    yAxisId="count"
                                                    type="monotone"
                                                    dataKey="oplog_count"
                                                    stroke="#1890ff"
                                                    strokeWidth={2}
                                                    name="oplog_count"
                                                    dot={{ r: 3 }}
                                                    activeDot={{ r: 5 }}
                                                />
                                                <Line
                                                    yAxisId="storage"
                                                    type="monotone"
                                                    dataKey="oplog_storage_mb"
                                                    stroke="#fa8c16"
                                                    strokeWidth={2}
                                                    name="oplog_storage_mb"
                                                    dot={{ r: 3 }}
                                                    activeDot={{ r: 5 }}
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div style={{ textAlign: 'center', padding: '40px' }}>
                                            <Empty description="No oplog entry data available" />
                                        </div>
                                    )}
                                </Card>
                            </Col>
                            <Col span={8}>
                                <Card
                                    title="Safe Downtime & Time Window"
                                    loading={oplogDataLoading}
                                    extra={
                                        <Tooltip title="Shows safe downtime hours and oplog time window coverage">
                                            <InfoCircleOutlined />
                                        </Tooltip>
                                    }
                                >
                                    {oplogHistoricalData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height={300}>
                                            <LineChart data={oplogHistoricalData}>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis
                                                    dataKey="time"
                                                    tick={{ fontSize: 11 }}
                                                    angle={-45}
                                                    textAnchor="end"
                                                    height={50}
                                                />
                                                <YAxis
                                                    label={{ value: 'Hours', angle: -90, position: 'insideLeft' }}
                                                />
                                                <RechartsTooltip
                                                    formatter={(value: any, name: string) => {
                                                        if (name === 'oplog_safe_downtime_hours') {
                                                            return [`${Number(value).toFixed(1)}h`, 'Safe Downtime'];
                                                        } else if (name === 'oplog_time_window_hours') {
                                                            return [`${Number(value).toFixed(1)}h`, 'Time Window'];
                                                        }
                                                        return [value, name];
                                                    }}
                                                    labelFormatter={(label) => `Time: ${label}`}
                                                />
                                                <Line
                                                    type="monotone"
                                                    dataKey="oplog_safe_downtime_hours"
                                                    stroke="#52c41a"
                                                    strokeWidth={3}
                                                    name="oplog_safe_downtime_hours"
                                                    dot={{ r: 4 }}
                                                    activeDot={{ r: 6 }}
                                                />
                                                <Line
                                                    type="monotone"
                                                    dataKey="oplog_time_window_hours"
                                                    stroke="#1890ff"
                                                    strokeWidth={2}
                                                    name="oplog_time_window_hours"
                                                    dot={{ r: 3 }}
                                                    activeDot={{ r: 5 }}
                                                    strokeDasharray="5 5"
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div style={{ textAlign: 'center', padding: '40px' }}>
                                            <Empty description="No time window data available" />
                                        </div>
                                    )}
                                </Card>
                            </Col>
                        </Row>
                    </div>
                );

            default:
                return (
                    <div style={{ textAlign: 'center', padding: '40px' }}>
                        <Empty description="Please select a connection metric to view" />
                    </div>
                );
        }
    };

    const renderDatabaseTab = () => {
        switch (selectedSubMenu) {
            case 'database-stats':
                // Calculate current totals from latest data
                const latestData = databaseStorageHistoricalData.length > 0
                    ? databaseStorageHistoricalData[databaseStorageHistoricalData.length - 1]
                    : null;

                return (
                    <div>
                        {/* Time Range Selector */}
                        <Card style={{ marginBottom: '16px' }}>
                            <Row gutter={[16, 16]} align="middle">
                                <Col>
                                    <span style={{ fontWeight: 500, marginRight: '8px' }}>Time Range:</span>
                                </Col>
                                <Col>
                                    <Select
                                        value={selectedTimeRange}
                                        onChange={handleTimeRangeChange}
                                        style={{ width: '120px' }}
                                        options={[
                                            { label: '15 minutes', value: '15m' },
                                            { label: '1 hour', value: '1h' },
                                            { label: '3 hours', value: '3h' },
                                            { label: '6 hours', value: '6h' },
                                            { label: '12 hours', value: '12h' },
                                            { label: '1 day', value: '1d' },
                                            { label: '3 days', value: '3d' },
                                            { label: '7 days', value: '7d' }
                                        ]}
                                    />
                                </Col>
                                <Col style={{ marginLeft: 'auto' }}>
                                    <Button
                                        type="primary"
                                        icon={<ReloadOutlined />}
                                        onClick={() => fetchDatabaseStorageMetrics(nodeName, selectedTimeRange)}
                                        loading={databaseStorageDataLoading}
                                        style={{
                                            background: '#47A248',
                                            borderColor: '#47A248'
                                        }}
                                    >
                                        Refresh
                                    </Button>
                                </Col>
                            </Row>
                        </Card>

                        {/* Current Database Storage Stats */}
                        {latestData && (
                            <Card title="Current Database Storage Statistics" style={{ marginBottom: '16px' }}>
                                <Row gutter={[16, 16]}>
                                    <Col span={6}>
                                        <Statistic
                                            title="Total Data Size"
                                            value={`${(latestData.data_size_mb || 0).toFixed(1)} MB`}
                                            valueStyle={{ color: '#1890ff' }}
                                            prefix={<DatabaseOutlined />}
                                        />
                                    </Col>
                                    <Col span={6}>
                                        <Statistic
                                            title="Total Index Size"
                                            value={`${(latestData.index_size_mb || 0).toFixed(1)} MB`}
                                            valueStyle={{ color: '#52c41a' }}
                                            prefix={<BarChartOutlined />}
                                        />
                                    </Col>
                                    <Col span={6}>
                                        <Statistic
                                            title="Total Storage Size"
                                            value={`${(latestData.storage_size_mb || 0).toFixed(1)} MB`}
                                            valueStyle={{ color: '#fa8c16' }}
                                            prefix={<FileTextOutlined />}
                                        />
                                    </Col>
                                    <Col span={6}>
                                        <Statistic
                                            title="Index/Data Ratio"
                                            value={(() => {
                                                const dataSize = latestData.data_size_mb || 0;
                                                const indexSize = latestData.index_size_mb || 0;
                                                if (dataSize === 0) return '0:1';
                                                const ratio = (indexSize / dataSize).toFixed(2);
                                                return `${ratio}:1`;
                                            })()}
                                            valueStyle={{ color: '#722ed1' }}
                                            prefix={<SettingOutlined />}
                                        />
                                    </Col>
                                </Row>
                            </Card>
                        )}

                        {/* Storage Growth Trend - Based on 7-day data for accurate capacity planning */}
                        {databaseStorage7DayData.length > 1 && (() => {
                            const firstData = databaseStorage7DayData[0];
                            const lastData = databaseStorage7DayData[databaseStorage7DayData.length - 1];
                            const dataGrowth = ((lastData.data_size_mb || 0) - (firstData.data_size_mb || 0));
                            const indexGrowth = ((lastData.index_size_mb || 0) - (firstData.index_size_mb || 0));
                            const storageGrowth = ((lastData.storage_size_mb || 0) - (firstData.storage_size_mb || 0));

                            // Calculate disk capacity prediction based on 7-day growth trend
                            const calculateDiskPrediction = () => {
                                if (!systemMetrics || storageGrowth <= 0) return null;

                                // Using 7-day data for more accurate growth prediction
                                const timeRangeInDays = 7;

                                // Daily growth rate in MB (based on 7-day trend)
                                const dailyGrowthMB = storageGrowth / timeRangeInDays;
                                
                                // Available disk space in MB
                                const freeDiskMB = systemMetrics.free_disk / (1024 * 1024);
                                
                                // Days until disk is full
                                const daysUntilFull = freeDiskMB / dailyGrowthMB;

                                // Format the time period
                                const formatTimePeriod = (days: number): string => {
                                    if (days < 1) {
                                        const hours = Math.round(days * 24);
                                        return `${hours} hour${hours !== 1 ? 's' : ''}`;
                                    } else if (days < 7) {
                                        return `${Math.round(days)} day${Math.round(days) !== 1 ? 's' : ''}`;
                                    } else if (days < 30) {
                                        const weeks = Math.round(days / 7);
                                        return `${weeks} week${weeks !== 1 ? 's' : ''}`;
                                    } else if (days < 365) {
                                        const months = Math.round(days / 30);
                                        return `${months} month${months !== 1 ? 's' : ''}`;
                                    } else {
                                        const years = Math.round(days / 365);
                                        return `${years} year${years !== 1 ? 's' : ''}`;
                                    }
                                };

                                return {
                                    dailyGrowthMB,
                                    daysUntilFull,
                                    formattedTime: formatTimePeriod(daysUntilFull),
                                    freeDiskMB,
                                    status: daysUntilFull < 30 ? 'critical' : daysUntilFull < 90 ? 'warning' : 'good'
                                };
                            };

                            const diskPrediction = calculateDiskPrediction();

                            return (
                                <Card 
                                    title="Storage Growth Trend & Capacity Planning (7-Day Analysis)" 
                                    style={{ marginBottom: '16px' }}
                                    loading={databaseStorage7DayLoading}
                                >
                                    {/* 7-Day Analysis Info */}
                                    <Alert
                                        message="Based on 7-Day Growth Analysis"
                                        description="Capacity planning calculations use the last 7 days of storage data for more accurate and reliable growth predictions, smoothing out short-term fluctuations."
                                        type="info"
                                        showIcon
                                        style={{ marginBottom: '16px', backgroundColor: '#f0f9ff', border: '1px solid #bae6fd' }}
                                    />

                                    {/* Growth Statistics */}
                                    <Row gutter={[16, 16]}>
                                        <Col span={6}>
                                                                                    <Statistic
                                            title="Data Size Change"
                                            value={`${dataGrowth >= 0 ? '+' : ''}${dataGrowth.toFixed(2)} MB`}
                                            valueStyle={{ color: dataGrowth >= 0 ? '#52c41a' : '#cf1322' }}
                                            suffix="(7 days)"
                                        />
                                    </Col>
                                    <Col span={6}>
                                        <Statistic
                                            title="Index Size Change"
                                            value={`${indexGrowth >= 0 ? '+' : ''}${indexGrowth.toFixed(2)} MB`}
                                            valueStyle={{ color: indexGrowth >= 0 ? '#52c41a' : '#cf1322' }}
                                            suffix="(7 days)"
                                        />
                                    </Col>
                                    <Col span={6}>
                                        <Statistic
                                            title="Storage Size Change"
                                            value={`${storageGrowth >= 0 ? '+' : ''}${storageGrowth.toFixed(2)} MB`}
                                            valueStyle={{ color: storageGrowth >= 0 ? '#52c41a' : '#cf1322' }}
                                            suffix="(7 days)"
                                        />
                                        </Col>
                                        <Col span={6}>
                                            <Statistic
                                                title="Daily Growth Rate"
                                                value={diskPrediction ? `+${diskPrediction.dailyGrowthMB.toFixed(2)} MB` : 'N/A'}
                                                valueStyle={{ color: '#1890ff' }}
                                                suffix="/day"
                                            />
                                        </Col>
                                    </Row>

                                    {/* Disk Capacity Prediction */}
                                    {diskPrediction && systemMetrics && (
                                        <>
                                            <Divider />
                                            <Row gutter={[16, 16]}>
                                                <Col span={8}>
                                                    <Card size="small" style={{ textAlign: 'center', backgroundColor: '#f9f9f9' }}>
                                                        <Statistic
                                                            title="Available Disk Space"
                                                            value={formatBytes(systemMetrics.free_disk, 1)}
                                                            valueStyle={{ color: '#52c41a' }}
                                                            prefix={<DatabaseOutlined />}
                                                        />
                                                    </Card>
                                                </Col>
                                                <Col span={8}>
                                                    <Card size="small" style={{ textAlign: 'center', backgroundColor: '#f9f9f9' }}>
                                                        <Statistic
                                                            title="Total Disk Capacity"
                                                            value={formatBytes(systemMetrics.total_disk, 1)}
                                                            valueStyle={{ color: '#1890ff' }}
                                                            prefix={<BarChartOutlined />}
                                                        />
                                                    </Card>
                                                </Col>
                                                <Col span={8}>
                                                    <Card 
                                                        size="small" 
                                                        style={{ 
                                                            textAlign: 'center',
                                                            backgroundColor: diskPrediction.status === 'critical' ? '#fff1f0' : 
                                                                         diskPrediction.status === 'warning' ? '#fffbe6' : '#f6ffed'
                                                        }}
                                                    >
                                                        <Statistic
                                                            title="Estimated Disk Full"
                                                            value={diskPrediction.formattedTime}
                                                            valueStyle={{ 
                                                                color: diskPrediction.status === 'critical' ? '#cf1322' : 
                                                                       diskPrediction.status === 'warning' ? '#fa8c16' : '#52c41a',
                                                                fontSize: '18px',
                                                                fontWeight: 'bold'
                                                            }}
                                                            prefix={
                                                                diskPrediction.status === 'critical' ? '⚠️' : 
                                                                diskPrediction.status === 'warning' ? '⏰' : '✅'
                                                            }
                                                        />
                                                        <div style={{ 
                                                            fontSize: '11px', 
                                                            color: '#888', 
                                                            marginTop: '4px' 
                                                        }}>
                                                            Based on current growth rate
                                                        </div>
                                                    </Card>
                                                </Col>
                                            </Row>

                                            {/* Warning/Recommendation Alert */}
                                            {diskPrediction.status !== 'good' && (
                                                <Alert
                                                    style={{ marginTop: '16px' }}
                                                    message="Disk Capacity Warning"
                                                    description={
                                                        diskPrediction.status === 'critical' 
                                                            ? `🚨 Critical: Disk will be full in ${diskPrediction.formattedTime}! Consider immediate action to free up space or expand storage.`
                                                            : `⚠️ Warning: Disk will be full in ${diskPrediction.formattedTime}. Plan for storage expansion or data cleanup.`
                                                    }
                                                    type={diskPrediction.status === 'critical' ? 'error' : 'warning'}
                                                    showIcon
                                                />
                                            )}
                                        </>
                                    )}
                                </Card>
                            );
                        })()}

                      {/* Database Storage Chart */}
                        <Card
                            title="MongoDB Database Storage Over Time"
                            loading={databaseStorageDataLoading}
                            extra={
                                <Tooltip title="Shows data size, index size, and storage size over time for all databases">
                                    <InfoCircleOutlined />
                                </Tooltip>
                            }
                        >
                            {databaseStorageHistoricalData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={400}>
                                    <LineChart data={databaseStorageHistoricalData}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis
                                            dataKey="time"
                                            tick={{ fontSize: 12 }}
                                            angle={-45}
                                            textAnchor="end"
                                            height={60}
                                        />
                                        <YAxis
                                            label={{ value: 'Size (MB)', angle: -90, position: 'insideLeft' }}
                                        />
                                        <RechartsTooltip
                                            formatter={(value: any, name: string) => {
                                                let label = name;
                                                if (name === 'data_size_mb') label = 'Total Data Size';
                                                else if (name === 'index_size_mb') label = 'Total Index Size';
                                                else if (name === 'storage_size_mb') label = 'Total Storage Size';
                                                return [`${Number(value).toFixed(1)} MB`, label];
                                            }}
                                            labelFormatter={(label) => `Time: ${label}`}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="data_size_mb"
                                            stroke="#1890ff"
                                            strokeWidth={3}
                                            name="data_size_mb"
                                            dot={{ r: 4 }}
                                            activeDot={{ r: 6 }}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="index_size_mb"
                                            stroke="#52c41a"
                                            strokeWidth={3}
                                            name="index_size_mb"
                                            dot={{ r: 4 }}
                                            activeDot={{ r: 6 }}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="storage_size_mb"
                                            stroke="#fa8c16"
                                            strokeWidth={3}
                                            name="storage_size_mb"
                                            dot={{ r: 4 }}
                                            activeDot={{ r: 6 }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '40px' }}>
                                    <Empty description="No database storage data available" />
                                </div>
                            )}
                        </Card>
                    </div>
                );

            case 'working-set':
                // Calculate current totals from latest data
                const latestDataWorkingSet = databaseStorageHistoricalData.length > 0
                    ? databaseStorageHistoricalData[databaseStorageHistoricalData.length - 1]
                    : null;

                return (
                    <div>
                        {/* Time Range Selector */}
                        <Card style={{ marginBottom: '16px' }}>
                            <Row gutter={[16, 16]} align="middle">
                                <Col>
                                    <span style={{ fontWeight: 500, marginRight: '8px' }}>Time Range:</span>
                                </Col>
                                <Col>
                                    <Select
                                        value={selectedTimeRange}
                                        onChange={handleTimeRangeChange}
                                        style={{ width: '120px' }}
                                        options={[
                                            { label: '15 minutes', value: '15m' },
                                            { label: '1 hour', value: '1h' },
                                            { label: '3 hours', value: '3h' },
                                            { label: '6 hours', value: '6h' },
                                            { label: '12 hours', value: '12h' },
                                            { label: '1 day', value: '1d' },
                                            { label: '3 days', value: '3d' },
                                            { label: '7 days', value: '7d' }
                                        ]}
                                    />
                                </Col>
                                <Col style={{ marginLeft: 'auto' }}>
                                    <Button
                                        type="primary"
                                        icon={<ReloadOutlined />}
                                        onClick={() => fetchDatabaseStorageMetrics(nodeName, selectedTimeRange)}
                                        loading={databaseStorageDataLoading}
                                        style={{
                                            background: '#47A248',
                                            borderColor: '#47A248'
                                        }}
                                    >
                                        Refresh
                                    </Button>
                                </Col>
                            </Row>
                        </Card>

                        {/* MongoDB Working Set Analysis */}
                        {latestDataWorkingSet && systemMetrics && systemMetrics.total_memory > 0 ? (
                            <Card title="MongoDB Working Set Analysis" style={{ marginBottom: '16px' }}
                                extra={
                                    <Tooltip title="Working Set = Indexes + Active Data + Connection Overhead. Ideally should fit in RAM for optimal performance.">
                                        <InfoCircleOutlined />
                                    </Tooltip>
                                }>
                                <Row gutter={[16, 16]}>
                                    <Col span={6}>
                                        <Statistic
                                            title="Index Size (Must be in RAM)"
                                            value={`${(latestDataWorkingSet.index_size_mb || 0).toFixed(1)} MB`}
                                            valueStyle={{ color: '#1890ff' }}
                                            prefix={<BarChartOutlined />}
                                        />
                                    </Col>
                                    <Col span={6}>
                                        <Statistic
                                            title="Estimated Active Data (~25%)"
                                            value={`${((latestDataWorkingSet.data_size_mb || 0) * 0.25).toFixed(1)} MB`}
                                            valueStyle={{ color: '#fa8c16' }}
                                            prefix={<DatabaseOutlined />}
                                        />
                                    </Col>
                                    <Col span={6}>
                                        <Statistic
                                            title="Connection Overhead"
                                            value={(() => {
                                                const currentConnections = connections?.current || 50; // fallback estimate
                                                const connectionOverhead = currentConnections * 1; // ~1MB per connection
                                                return `${connectionOverhead.toFixed(1)} MB`;
                                            })()}
                                            valueStyle={{ color: '#722ed1' }}
                                            prefix={<TeamOutlined />}
                                        />
                                    </Col>
                                    <Col span={6}>
                                        <Statistic
                                            title="Estimated Working Set"
                                            value={(() => {
                                                const indexSize = latestDataWorkingSet.index_size_mb || 0;
                                                const activeData = (latestDataWorkingSet.data_size_mb || 0) * 0.25;
                                                const currentConnections = connections?.current || 50;
                                                const connectionOverhead = currentConnections * 1;
                                                const workingSet = indexSize + activeData + connectionOverhead;
                                                return `${workingSet.toFixed(1)} MB`;
                                            })()}
                                            valueStyle={{ color: '#47A248' }}
                                            prefix={<SettingOutlined />}
                                        />
                                    </Col>
                                </Row>

                                {/* Working Set vs RAM Analysis */}
                                <Row gutter={[16, 16]} style={{ marginTop: '16px' }}>
                                    <Col span={12}>
                                        <Card size="small" style={{ textAlign: 'center' }}>
                                            <Statistic
                                                title="Available System RAM"
                                                value={formatBytes(systemMetrics.total_memory, 0)}
                                                valueStyle={{ color: '#1890ff' }}
                                            />
                                        </Card>
                                    </Col>
                                    <Col span={12}>
                                        <Card size="small" style={{ textAlign: 'center' }}>
                                            <Statistic
                                                title="Working Set Fit Status"
                                                value={(() => {
                                                    const indexSize = latestDataWorkingSet.index_size_mb || 0;
                                                    const activeData = (latestDataWorkingSet.data_size_mb || 0) * 0.25;
                                                    const currentConnections = connections?.current || 50;
                                                    const connectionOverhead = currentConnections * 1;
                                                    const workingSetMB = indexSize + activeData + connectionOverhead;
                                                    const workingSetBytes = workingSetMB * 1024 * 1024;
                                                    const availableRAM = systemMetrics.total_memory;

                                                    if (workingSetBytes <= availableRAM * 0.7) {
                                                        return "✅ Excellent Fit";
                                                    } else if (workingSetBytes <= availableRAM * 0.9) {
                                                        return "⚠️ Tight Fit";
                                                    } else {
                                                        return "❌ Too Large";
                                                    }
                                                })()}
                                                valueStyle={{
                                                    color: (() => {
                                                        const indexSize = latestDataWorkingSet.index_size_mb || 0;
                                                        const activeData = (latestDataWorkingSet.data_size_mb || 0) * 0.25;
                                                        const currentConnections = connections?.current || 50;
                                                        const connectionOverhead = currentConnections * 1;
                                                        const workingSetMB = indexSize + activeData + connectionOverhead;
                                                        const workingSetBytes = workingSetMB * 1024 * 1024;
                                                        const availableRAM = systemMetrics.total_memory;

                                                        if (workingSetBytes <= availableRAM * 0.7) {
                                                            return '#52c41a'; // Green
                                                        } else if (workingSetBytes <= availableRAM * 0.9) {
                                                            return '#fa8c16'; // Orange
                                                        } else {
                                                            return '#cf1322'; // Red
                                                        }
                                                    })()
                                                }}
                                            />
                                        </Card>
                                    </Col>
                                </Row>

                                {/* Performance Recommendations */}
                                <Row style={{ marginTop: '16px' }}>
                                    <Col span={24}>
                                        <Alert
                                            message="Performance Recommendations"
                                            description={(() => {
                                                const indexSize = latestDataWorkingSet.index_size_mb || 0;
                                                const activeData = (latestDataWorkingSet.data_size_mb || 0) * 0.25;
                                                const currentConnections = connections?.current || 50;
                                                const connectionOverhead = currentConnections * 1;
                                                const workingSetMB = indexSize + activeData + connectionOverhead;
                                                const workingSetBytes = workingSetMB * 1024 * 1024;
                                                const availableRAM = systemMetrics.total_memory;
                                                const ramUsagePercent = ((workingSetBytes / availableRAM) * 100).toFixed(1);
                                                
                                                if (workingSetBytes <= availableRAM * 0.7) {
                                                    return `✅ Working set (${workingSetMB.toFixed(1)} MB) uses ${ramUsagePercent}% of RAM. Excellent performance expected. All indexes fit in memory with room for growth.`;
                                                } else if (workingSetBytes <= availableRAM * 0.9) {
                                                    return `⚠️ Working set (${workingSetMB.toFixed(1)} MB) uses ${ramUsagePercent}% of RAM. Monitor memory usage closely. Consider adding more RAM or optimizing indexes.`;
                                                } else {
                                                    return `❌ Working set (${workingSetMB.toFixed(1)} MB) uses ${ramUsagePercent}% of RAM. Performance degradation likely due to disk I/O. Urgent: Add more RAM or reduce index size.`;
                                                }
                                            })()}
                                            type={(() => {
                                                const indexSize = latestDataWorkingSet.index_size_mb || 0;
                                                const activeData = (latestDataWorkingSet.data_size_mb || 0) * 0.25;
                                                const currentConnections = connections?.current || 50;
                                                const connectionOverhead = currentConnections * 1;
                                                const workingSetMB = indexSize + activeData + connectionOverhead;
                                                const workingSetBytes = workingSetMB * 1024 * 1024;
                                                const availableRAM = systemMetrics.total_memory;
                                                
                                                if (workingSetBytes <= availableRAM * 0.7) {
                                                    return "success";
                                                } else if (workingSetBytes <= availableRAM * 0.9) {
                                                    return "warning";
                                                } else {
                                                    return "error";
                                                }
                                            })()}
                                            showIcon
                                            action={(() => {
                                                // Show AI Analysis button only for "Too Large" cases
                                                const indexSize = latestDataWorkingSet.index_size_mb || 0;
                                                const activeData = (latestDataWorkingSet.data_size_mb || 0) * 0.25;
                                                const currentConnections = connections?.current || 50;
                                                const connectionOverhead = currentConnections * 1;
                                                const workingSetMB = indexSize + activeData + connectionOverhead;
                                                const workingSetBytes = workingSetMB * 1024 * 1024;
                                                const availableRAM = systemMetrics.total_memory;
                                                const ramUsagePercent = ((workingSetBytes / availableRAM) * 100).toFixed(1);
                                                
                                                if (workingSetBytes > availableRAM * 0.9) {
                                                    return (
                                                        <Button 
                                                            type="primary"
                                                            icon={<RobotOutlined />}
                                                            onClick={() => handleWorkingSetAIAnalysis({
                                                                indexSize,
                                                                activeData,
                                                                connectionOverhead,
                                                                workingSetMB,
                                                                availableRAM,
                                                                ramUsagePercent
                                                            })}
                                                            style={{
                                                                background: '#47A248',
                                                                borderColor: '#47A248'
                                                            }}
                                                        >
                                                            Get AI Recommendations
                                                        </Button>
                                                    );
                                                }
                                                return null;
                                            })()}
                                        />
                                    </Col>
                                </Row>
                            </Card>
                        ) : databaseStorageDataLoading || systemMemoryDataLoading ? (
                            <Card title="MongoDB Working Set Analysis">
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '60px 40px',
                                    textAlign: 'center'
                                }}>
                                    <Spin size="large" />
                                    <div style={{
                                        marginTop: '20px',
                                        fontSize: '16px',
                                        color: '#47A248',
                                        fontWeight: 500
                                    }}>
                                        Loading Working Set Analysis...
                                    </div>
                                    <div style={{
                                        marginTop: '8px',
                                        fontSize: '14px',
                                        color: '#888'
                                    }}>
                                        {databaseStorageDataLoading && systemMemoryDataLoading 
                                            ? 'Fetching database storage and system memory metrics'
                                            : databaseStorageDataLoading 
                                                ? 'Fetching database storage metrics'
                                                : 'Fetching system memory metrics'
                                        }
                                    </div>
                                </div>
                            </Card>
                        ) : (
                            <Card title="MongoDB Working Set Analysis">
                                <Empty
                                    description={
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ marginBottom: '8px', fontSize: '16px', color: '#595959' }}>
                                                Working Set Analysis Unavailable
                                            </div>
                                            <div style={{ fontSize: '14px', color: '#888' }}>
                                                This analysis requires both database storage metrics and system memory data.
                                                <br />
                                                Please ensure metrics are being collected from the selected MongoDB node.
                                            </div>
                                        </div>
                                    }
                                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                                >
                                    <Button 
                                        type="primary"
                                        icon={<ReloadOutlined />}
                                        onClick={() => {
                                            fetchDatabaseStorageMetrics(nodeName, selectedTimeRange);
                                            fetchSystemMemoryMetrics(nodeName, selectedTimeRange);
                                        }}
                                        style={{
                                            background: '#47A248',
                                            borderColor: '#47A248'
                                        }}
                                    >
                                        Retry Loading Data
                                    </Button>
                                </Empty>
                            </Card>
                        )}
                    </div>
                );

            case 'collections':
                return (
                    <div>
                        {/* Time Range and Refresh Controls */}
                        <Card style={{ marginBottom: '16px' }}>
                            <Row gutter={[16, 16]} align="middle">
                                <Col>
                                    <span style={{ fontWeight: 500, marginRight: '8px' }}>Time Range:</span>
                                </Col>
                                <Col>
                                    <Select
                                        value={selectedTimeRange}
                                        onChange={handleTimeRangeChange}
                                        style={{ width: '120px' }}
                                        options={[
                                            { label: '1 hour', value: '1h' },
                                            { label: '3 hours', value: '3h' },
                                            { label: '6 hours', value: '6h' },
                                            { label: '12 hours', value: '12h' },
                                            { label: '1 day', value: '1d' },
                                            { label: '3 days', value: '3d' },
                                            { label: '7 days', value: '7d' }
                                        ]}
                                    />
                                </Col>
                                <Col style={{ marginLeft: 'auto' }}>
                                    <Button
                                        type="primary"
                                        icon={<ReloadOutlined />}
                                        onClick={() => {
                                            if (selectedDatabase) {
                                                fetchCollectionMetrics(nodeName, selectedDatabase);
                                                fetchCollectionHistoricalData(nodeName, selectedDatabase, selectedTimeRange);
                                            }
                                        }}
                                        loading={collectionMetricsLoading || collectionHistoricalLoading}
                                        style={{
                                            background: '#47A248',
                                            borderColor: '#47A248'
                                        }}
                                    >
                                        Refresh
                                    </Button>
                                </Col>
                            </Row>
                        </Card>

                        {/* Collection Metrics Table */}
                        {selectedDatabase && (
                            <Card 
                                title={
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span>{`Collections in ${selectedDatabase}`}</span>
                                        {selectedCollections.length > 0 && (
                                            <Tag color="green" style={{ marginLeft: '16px' }}>
                                                Selected for Chart: {selectedCollections.length}/{MAX_SELECTED_COLLECTIONS}
                                            </Tag>
                                        )}
                                    </div>
                                }
                                loading={collectionMetricsLoading}
                            >
                                {collectionMetricsData.length > 0 ? (
                                    <Table
                                        dataSource={collectionMetricsData}
                                        columns={[
                                            {
                                                title: (
                                                    <Checkbox 
                                                        checked={selectedCollections.length > 0 && selectedCollections.length === Math.min(collectionMetricsData.length, MAX_SELECTED_COLLECTIONS)}
                                                        indeterminate={selectedCollections.length > 0 && selectedCollections.length < Math.min(collectionMetricsData.length, MAX_SELECTED_COLLECTIONS)}
                                                        onChange={(e: any) => handleSelectAllCollections(e.target.checked)}
                                                    >
                                                        Chart
                                                    </Checkbox>
                                                ),
                                                dataIndex: 'collection',
                                                key: 'select',
                                                width: 80,
                                                render: (collection) => (
                                                    <Checkbox
                                                        checked={selectedCollections.includes(collection)}
                                                        onChange={(e: any) => handleCollectionSelect(collection, e.target.checked)}
                                                        disabled={!selectedCollections.includes(collection) && selectedCollections.length >= MAX_SELECTED_COLLECTIONS}
                                                    />
                                                ),
                                            },
                                            {
                                                title: 'Collection Name',
                                                dataIndex: 'collection',
                                                key: 'collection',
                                                width: 200,
                                                sorter: (a, b) => a.collection.localeCompare(b.collection),
                                                render: (name) => (
                                                    <span style={{ fontWeight: 500 }}>{name}</span>
                                                ),
                                            },
                                            {
                                                title: 'Document Count',
                                                dataIndex: 'document_count',
                                                key: 'document_count',
                                                width: 120,
                                                sorter: (a, b) => (a.document_count || 0) - (b.document_count || 0),
                                                render: (count) => (
                                                    <span style={{ 
                                                        color: count > 1000000 ? '#f5222d' : count > 100000 ? '#fa8c16' : count > 10000 ? '#fadb14' : '#52c41a',
                                                        fontWeight: 500 
                                                    }}>
                                                        {count ? count.toLocaleString() : '0'}
                                                    </span>
                                                ),
                                            },
                                            {
                                                title: 'Data Size (MB)',
                                                dataIndex: 'data_size_mb',
                                                key: 'data_size_mb',
                                                width: 120,
                                                sorter: (a, b) => (a.data_size_mb || 0) - (b.data_size_mb || 0),
                                                defaultSortOrder: 'descend',
                                                render: (size) => (
                                                    <span style={{ 
                                                        color: size > 1000 ? '#f5222d' : size > 100 ? '#fa8c16' : size > 10 ? '#fadb14' : '#52c41a',
                                                        fontWeight: 500 
                                                    }}>
                                                        {size ? `${size.toFixed(2)} MB` : '0 MB'}
                                                    </span>
                                                ),
                                            },
                                            {
                                                title: 'Storage Size (MB)',
                                                dataIndex: 'storage_size_mb',
                                                key: 'storage_size_mb',
                                                width: 140,
                                                sorter: (a, b) => (a.storage_size_mb || 0) - (b.storage_size_mb || 0),
                                                render: (size) => (
                                                    <span style={{ 
                                                        color: size > 1000 ? '#f5222d' : size > 100 ? '#fa8c16' : size > 10 ? '#fadb14' : '#52c41a',
                                                        fontWeight: 500 
                                                    }}>
                                                        {size ? `${size.toFixed(2)} MB` : '0 MB'}
                                                    </span>
                                                ),
                                            },
                                            {
                                                title: 'Index Size (MB)',
                                                dataIndex: 'index_size_mb',
                                                key: 'index_size_mb',
                                                width: 120,
                                                sorter: (a, b) => (a.index_size_mb || 0) - (b.index_size_mb || 0),
                                                render: (size) => (
                                                    <span style={{ 
                                                        color: size > 100 ? '#f5222d' : size > 50 ? '#fa8c16' : size > 10 ? '#fadb14' : '#52c41a',
                                                        fontWeight: 500 
                                                    }}>
                                                        {size ? `${size.toFixed(2)} MB` : '0 MB'}
                                                    </span>
                                                ),
                                            },
                                            {
                                                title: 'Avg Doc Size (Bytes)',
                                                dataIndex: 'avg_document_size_bytes',
                                                key: 'avg_document_size_bytes',
                                                width: 160,
                                                sorter: (a, b) => (a.avg_document_size_bytes || 0) - (b.avg_document_size_bytes || 0),
                                                render: (size) => (
                                                    <span style={{ 
                                                        color: size > 10000 ? '#f5222d' : size > 5000 ? '#fa8c16' : size > 1000 ? '#fadb14' : '#52c41a',
                                                        fontWeight: 500 
                                                    }}>
                                                        {size ? `${size.toLocaleString()} B` : '0 B'}
                                                    </span>
                                                ),
                                            },
                                            {
                                                title: 'Index Count',
                                                dataIndex: 'index_count',
                                                key: 'index_count',
                                                width: 100,
                                                sorter: (a, b) => (a.index_count || 0) - (b.index_count || 0),
                                                render: (count) => (
                                                    <span style={{ 
                                                        color: count > 20 ? '#f5222d' : count > 10 ? '#fa8c16' : count > 5 ? '#fadb14' : '#52c41a',
                                                        fontWeight: 500 
                                                    }}>
                                                        {count || 0}
                                                    </span>
                                                ),
                                            },
                                        ]}
                                        pagination={{
                                            pageSize: 10,
                                            showSizeChanger: true,
                                            showQuickJumper: true,
                                            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} collections`,
                                        }}
                                        size="small"
                                        scroll={{ x: 800 }}
                                        rowClassName={(record) => 
                                            record.data_size_mb > 1000 ? 'high-size-row' : 
                                            record.data_size_mb > 100 ? 'medium-size-row' : 
                                            'low-size-row'
                                        }
                                    />
                                ) : (
                                    <Empty description="No collection data available" />
                                )}
                            </Card>
                        )}

                        {/* Collection Growth Chart */}
                        {selectedDatabase && selectedCollections.length > 0 && (
                            collectionHistoricalLoading ? (
                                <Card 
                                    title={`Collection Size Growth - ${selectedDatabase} (Loading...)`}
                                    style={{ marginTop: '16px' }}
                                >
                                    <div style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Spin size="large" />
                                    </div>
                                </Card>
                            ) : collectionHistoricalData.length > 0 ? (
                            <Card 
                                title={`Collection Size Growth - ${selectedDatabase} (${selectedCollections.length} selected, ${selectedTimeRange})`}
                                style={{ marginTop: '16px' }}
                            >
                                <div style={{ height: '400px', width: '100%' }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={(() => {
                                            // Transform data to group by time with collection-specific fields
                                            const timeGroups: { [key: string]: any } = {};
                                            const collections = new Set<string>();
                                            
                                            collectionHistoricalData.forEach(item => {
                                                if (!item.timestamp) return;
                                                
                                                const timeKey = new Date(item.timestamp).toLocaleString();
                                                const collectionName = item.collection || 'unknown';
                                                
                                                // Only process selected collections
                                                if (!selectedCollections.includes(collectionName)) return;
                                                
                                                collections.add(collectionName);
                                                
                                                if (!timeGroups[timeKey]) {
                                                    timeGroups[timeKey] = {
                                                        time: timeKey,
                                                        timestamp_ms: new Date(item.timestamp).getTime()
                                                    };
                                                }
                                                
                                                // Add collection-specific metrics
                                                timeGroups[timeKey][`${collectionName}_data_size`] = item.data_size_mb || 0;
                                                timeGroups[timeKey][`${collectionName}_storage_size`] = item.storage_size_mb || 0;
                                                timeGroups[timeKey][`${collectionName}_index_size`] = item.index_size_mb || 0;
                                                timeGroups[timeKey][`${collectionName}_document_count`] = item.document_count || 0;
                                            });
                                            
                                            const chartData = Object.values(timeGroups).sort((a: any, b: any) => a.timestamp_ms - b.timestamp_ms);
                                            return chartData;
                                        })()}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                            <XAxis 
                                                dataKey="time"
                                                angle={-45}
                                                textAnchor="end"
                                                height={100}
                                                fontSize={10}
                                                interval="preserveStartEnd"
                                            />
                                            <YAxis 
                                                label={{ value: 'Size (MB)', angle: -90, position: 'insideLeft' }}
                                                fontSize={12}
                                            />
                                            <RechartsTooltip 
                                                formatter={(value: any, name: string) => {
                                                    const parts = name.split('_');
                                                    const collectionName = parts[0];
                                                    const metricType = name.includes('data_size') ? 'Data Size (MB)' : 
                                                                     name.includes('storage_size') ? 'Storage Size (MB)' :
                                                                     name.includes('index_size') ? 'Index Size (MB)' : 'Document Count';
                                                    const unit = name.includes('count') ? '' : ' MB';
                                                    return [`${Number(value).toFixed(name.includes('count') ? 0 : 2)}${unit}`, `${collectionName} - ${metricType}`];
                                                }}
                                                labelFormatter={(label) => {
                                                    return `Time: ${label}`;
                                                }}
                                                labelStyle={{ color: '#333' }}
                                                contentStyle={{ 
                                                    backgroundColor: '#fff', 
                                                    border: '1px solid #d9d9d9',
                                                    borderRadius: '4px'
                                                }}
                                            />
                                            <Legend 
                                                wrapperStyle={{ paddingTop: '20px' }}
                                                formatter={(value: string) => {
                                                    const collectionName = value.split('_')[0];
                                                    return <span style={{ color: '#595959', fontSize: '12px' }}>{collectionName}</span>;
                                                }}
                                            />
                                            {(() => {
                                                const collections = selectedCollections;
                                                const colors = ['#47A248', '#1890ff', '#fa8c16', '#722ed1', '#eb2f96', '#f5222d', '#fa541c', '#13c2c2'];
                                                
                                                return collections.map((collection, index) => (
                                                    <Line 
                                                        key={`${collection}_data_size`}
                                                        type="monotone" 
                                                        dataKey={`${collection}_data_size`}
                                                        stroke={colors[index % colors.length]} 
                                                        strokeWidth={2}
                                                        dot={{ fill: colors[index % colors.length], strokeWidth: 2, r: 3 }}
                                                        activeDot={{ r: 5, stroke: colors[index % colors.length], strokeWidth: 2 }}
                                                        name={`${collection}_data_size`}
                                                        connectNulls={false}
                                                    />
                                                ));
                                            })()}
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                                <div style={{ 
                                    textAlign: 'center', 
                                    marginTop: '16px',
                                    color: '#8c8c8c',
                                    fontSize: '12px'
                                }}>
                                    Historical collection data size growth over time - Each collection shown as separate line with unique color
                                </div>
                            </Card>
                            ) : (
                                <Card 
                                    title="Collection Growth Chart" 
                                    style={{ marginTop: '16px' }}
                                >
                                    <Empty 
                                        description="No historical data available for selected collections" 
                                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                                    />
                                </Card>
                            )
                        )}

                        {/* Show message when no collections selected for chart */}
                        {selectedDatabase && collectionMetricsData.length > 0 && selectedCollections.length === 0 && (
                            <Card 
                                title="Collection Growth Chart" 
                                style={{ marginTop: '16px' }}
                            >
                                <Empty 
                                    description="Select collections from the table above to view historical growth chart" 
                                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                                />
                            </Card>
                        )}

                        {/* Show message if no database selected */}
                        {!selectedDatabase && (
                            <Card>
                                <Empty description="Please select a database from the top selection area to view collections" />
                            </Card>
                        )}

                        {/* Show message if no databases available */}
                        {availableDatabases.length === 0 && !databasesLoading && (
                            <Card>
                                <Empty description="No user databases found" />
                            </Card>
                        )}
                    </div>
                );

            case 'index-usage':
                return (
                    <div>
                        {/* Refresh Button */}
                        <Card style={{ marginBottom: '16px' }}>
                            <Row justify="end">
                                <Col>
                                    <Button
                                        type="primary"
                                        icon={<ReloadOutlined />}
                                        onClick={() => {
                                            if (selectedDatabase && nodeName) {
                                                fetchIndexUsageStats(nodeName, selectedDatabase);
                                            }
                                        }}
                                        loading={indexUsageLoading}
                                        style={{ backgroundColor: '#47A248', borderColor: '#47A248' }}
                                    >
                                        Refresh
                                    </Button>
                                </Col>
                            </Row>
                        </Card>

                        {/* Summary Cards */}
                        {selectedDatabase && indexUsageData && Array.isArray(indexUsageData.collections) && indexUsageData.collections.length > 0 && (
                            <Card style={{ marginBottom: '16px' }}>
                                <Row gutter={[16, 16]}>
                                    {(() => {
                                        const stats = calculateSummaryStats(indexUsageData.collections);
                                        return (
                                            <>
                                                <Col xs={24} sm={12} md={6}>
                                                    <Card size="small" style={{ textAlign: 'center', backgroundColor: '#f6ffed', border: '1px solid #b7eb8f' }}>
                                                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#52c41a' }}>
                                                            {stats.totalCollections}
                                                        </div>
                                                        <div style={{ color: '#595959' }}>📊 Total Collections</div>
                                                    </Card>
                                                </Col>
                                                <Col xs={24} sm={12} md={6}>
                                                    <Card size="small" style={{ textAlign: 'center', backgroundColor: '#f0f9ff', border: '1px solid #91caff' }}>
                                                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1890ff' }}>
                                                            {stats.totalIndexes}
                                                        </div>
                                                        <div style={{ color: '#595959' }}>🔍 Total Indexes</div>
                                                    </Card>
                                                </Col>
                                                <Col xs={24} sm={12} md={6}>
                                                    <Card size="small" style={{ textAlign: 'center', backgroundColor: '#fff2e8', border: '1px solid #ffbb96' }}>
                                                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#fa8c16' }}>
                                                            {stats.unusedIndexes}
                                                        </div>
                                                        <div style={{ color: '#595959' }}>⚠️ Unused Indexes</div>
                                                    </Card>
                                                </Col>
                                                <Col xs={24} sm={12} md={6}>
                                                    <Card size="small" style={{ textAlign: 'center', backgroundColor: '#fff0f6', border: '1px solid #ffadd2' }}>
                                                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#eb2f96' }}>
                                                            {stats.highUsageCollections}
                                                        </div>
                                                        <div style={{ color: '#595959' }}>🚀 High Usage Collections</div>
                                                    </Card>
                                                </Col>
                                            </>
                                        );
                                    })()}
                                </Row>
                            </Card>
                        )}

                        {/* Search and Controls */}
                        {selectedDatabase && indexUsageData && Array.isArray(indexUsageData.collections) && indexUsageData.collections.length > 0 && (
                            <Card style={{ marginBottom: '16px' }}>
                                <Row gutter={[16, 16]} align="middle">
                                    <Col xs={24} sm={8} md={10}>
                                        <Input
                                            placeholder="🔍 Search collections..."
                                            value={searchTerm}
                                            onChange={(e) => {
                                                setSearchTerm(e.target.value);
                                                setCurrentPage(1);
                                            }}
                                            allowClear
                                        />
                                    </Col>
                                    <Col xs={12} sm={8} md={7}>
                                        <Select
                                            value={sortBy}
                                            onChange={(value) => {
                                                setSortBy(value);
                                                setCurrentPage(1);
                                            }}
                                            style={{ width: '100%' }}
                                        >
                                            <Select.Option value="usage">Sort by Usage</Select.Option>
                                            <Select.Option value="name">Sort by Name</Select.Option>
                                            <Select.Option value="size">Sort by Size</Select.Option>
                                            <Select.Option value="documents">Sort by Documents</Select.Option>
                                        </Select>
                                    </Col>
                                    <Col xs={12} sm={8} md={7}>
                                        <Select
                                            value={pageSize}
                                            onChange={(value) => {
                                                setPageSize(value);
                                                setCurrentPage(1);
                                            }}
                                            style={{ width: '100%' }}
                                        >
                                            <Select.Option value={5}>Show 5 per page</Select.Option>
                                            <Select.Option value={10}>Show 10 per page</Select.Option>
                                            <Select.Option value={20}>Show 20 per page</Select.Option>
                                            <Select.Option value={50}>Show 50 per page</Select.Option>
                                        </Select>
                                    </Col>
                                </Row>
                            </Card>
                        )}

                        {/* Index Usage Statistics */}
                        {selectedDatabase && (
                            indexUsageLoading ? (
                                <Card 
                                    title={`Index Usage Statistics: ${selectedDatabase} (Loading...)`}
                                    style={{ marginTop: '16px' }}
                                >
                                    <div style={{ textAlign: 'center', padding: '40px' }}>
                                        <Spin size="large" />
                                        <div style={{ marginTop: '16px' }}>Loading index usage statistics...</div>
                                    </div>
                                </Card>
                            ) : indexUsageData && Array.isArray(indexUsageData.collections) && indexUsageData.collections.length > 0 ? (
                                (() => {
                                    const { data: paginatedCollections, total } = getPaginatedCollections();
                                    
                                    return (
                                        <Card 
                                            title={`Collections (${total} found, showing ${paginatedCollections.length})`}
                                            style={{ marginTop: '16px' }}
                                            extra={
                                                total > pageSize && (
                                                    <Pagination
                                                        current={currentPage}
                                                        total={total}
                                                        pageSize={pageSize}
                                                        onChange={setCurrentPage}
                                                        size="small"
                                                        showSizeChanger={false}
                                                        showQuickJumper
                                                        showTotal={(total, range) => 
                                                            `${range[0]}-${range[1]} of ${total} collections`
                                                        }
                                                    />
                                                )
                                            }
                                        >
                                            {paginatedCollections.length > 0 ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                    {paginatedCollections.map((collection: any, index: number) => {
                                                        const totalOps = (collection.indexes || []).reduce((sum: number, idx: any) => sum + (idx.ops || 0), 0);
                                                        const unusedIndexes = (collection.indexes || []).filter((idx: any) => (idx.ops || 0) === 0).length;
                                                        
                                                        return (
                                                            <Card
                                                                key={index}
                                                                type="inner"
                                                                size="small"
                                                                title={
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                                                                        <span style={{ fontWeight: 600, color: '#262626' }}>
                                                                            📄 {collection.collectionName}
                                                                        </span>
                                                                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                                                            <Tag color="blue" style={{ margin: 0 }}>
                                                                                {collection.documentCount?.toLocaleString()} docs
                                                                            </Tag>
                                                                            <Tag color="green" style={{ margin: 0 }}>
                                                                                {collection.storageSize ? 
                                                                                    `${(collection.storageSize / (1024 * 1024 * 1024)).toFixed(2)} GB` : 
                                                                                    '0 MB'
                                                                                }
                                                                            </Tag>
                                                                            <Tag color="purple" style={{ margin: 0 }}>
                                                                                {(collection.indexes || []).length} indexes
                                                                            </Tag>
                                                                            <Tag color={totalOps > 1000000 ? "red" : totalOps > 100000 ? "orange" : "default"} style={{ margin: 0 }}>
                                                                                {totalOps.toLocaleString()} ops
                                                                            </Tag>
                                                                            {unusedIndexes > 0 && (
                                                                                <Tag color="volcano" style={{ margin: 0 }}>
                                                                                    {unusedIndexes} unused
                                                                                </Tag>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                }
                                            style={{ marginBottom: '16px' }}
                                        >
                                            {collection.indexes && collection.indexes.length > 0 ? (
                                                <>
                                                    <Table
                                                        dataSource={collection.indexes}
                                                        pagination={false}
                                                        size="small"
                                                        columns={[
                                                            {
                                                                title: 'Index Name',
                                                                dataIndex: 'name',
                                                                key: 'name',
                                                                render: (name: string) => (
                                                                    <span style={{ fontFamily: 'monospace' }}>{name}</span>
                                                                )
                                                            },
                                                            {
                                                                title: 'Fields',
                                                                dataIndex: 'fields',
                                                                key: 'fields',
                                                                render: (fields: string[]) => (
                                                                    <div>
                                                                        {fields.map((field, i) => (
                                                                            <Tag key={i} color="orange" style={{ marginBottom: '4px' }}>
                                                                                {field}
                                                                            </Tag>
                                                                        ))}
                                                                    </div>
                                                                )
                                                            },
                                                            {
                                                                title: 'Operations',
                                                                dataIndex: 'ops',
                                                                key: 'ops',
                                                                render: (ops: number) => (
                                                                    <span style={{ 
                                                                        fontWeight: 500,
                                                                        color: ops === 0 ? '#ff4d4f' : '#52c41a'
                                                                    }}>
                                                                        {ops?.toLocaleString() || 0}
                                                                    </span>
                                                                ),
                                                                sorter: (a: any, b: any) => (a.ops || 0) - (b.ops || 0),
                                                                defaultSortOrder: 'descend' as const
                                                            },
                                                            {
                                                                title: 'Usage Status',
                                                                dataIndex: 'ops',
                                                                key: 'status',
                                                                render: (ops: number) => {
                                                                    if (ops === 0) {
                                                                        return <Tag color="red">Unused</Tag>
                                                                    } else if (ops < 100) {
                                                                        return <Tag color="orange">Low Usage</Tag>
                                                                    } else if (ops < 1000) {
                                                                        return <Tag color="blue">Medium Usage</Tag>
                                                                    } else {
                                                                        return <Tag color="green">High Usage</Tag>
                                                                    }
                                                                }
                                                            }
                                                        ]}
                                                    />
                                                    
                                                    {collection.estimatedTopQueryPattern && (
                                                        <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#f6ffed', borderRadius: '6px' }}>
                                                            <div style={{ fontWeight: 500, marginBottom: '8px', color: '#52c41a' }}>
                                                                🔍 Estimated Top Query Pattern:
                                                            </div>
                                                            <div style={{ fontFamily: 'monospace', backgroundColor: '#fff', padding: '8px', borderRadius: '4px', border: '1px solid #d9d9d9' }}>
                                                                {JSON.stringify(collection.estimatedTopQueryPattern, null, 2)}
                                                            </div>
                                                        </div>
                                                    )}
                                                </>
                                            ) : (
                                                <Empty 
                                                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                                                    description="No indexes found for this collection"
                                                />
                                            )}
                                        </Card>
                                        );
                                    })}
                                </div>
                            ) : (
                                <Empty description="No collections found with index usage data." />
                            )}
                        </Card>
                    );
                })()
            ) : (
                <Card 
                    title="Index Usage Statistics" 
                    style={{ marginTop: '16px' }}
                >
                    <Empty description="No index usage data available. Please select a database and ensure collections exist." />
                </Card>
            )
                        )}
                    </div>
                );

            default:
                return (
                    <div style={{ textAlign: 'center', padding: '40px' }}>
                        <Empty description="Please select a database metric to view" />
                    </div>
                );
        }
    };

    const renderQueriesTab = () => {
        switch (selectedSubMenu) {
            case 'operations':
                return (
                    <div>
                        {/* Time Range Selector */}
                        <Card style={{ marginBottom: '16px' }}>
                            <Row gutter={[16, 16]} align="middle">
                                <Col>
                                    <span style={{ fontWeight: 500, marginRight: '8px' }}>Time Range:</span>
                                </Col>
                                <Col>
                                    <Select
                                        value={selectedTimeRange}
                                        onChange={handleTimeRangeChange}
                                        style={{ width: '120px' }}
                                        options={[
                                            { label: '15 minutes', value: '15m' },
                                            { label: '1 hour', value: '1h' },
                                            { label: '3 hours', value: '3h' },
                                            { label: '6 hours', value: '6h' },
                                            { label: '12 hours', value: '12h' },
                                            { label: '1 day', value: '1d' },
                                            { label: '3 days', value: '3d' },
                                            { label: '7 days', value: '7d' }
                                        ]}
                                    />
                                </Col>
                                <Col style={{ marginLeft: 'auto' }}>
                                    <Button
                                        type="primary"
                                        icon={<ReloadOutlined />}
                                        onClick={() => fetchOperationsMetrics(nodeName, selectedTimeRange)}
                                        loading={operationsDataLoading}
                                        style={{
                                            background: '#47A248',
                                            borderColor: '#47A248'
                                        }}
                                    >
                                        Refresh
                                    </Button>
                                </Col>
                            </Row>
                        </Card>

                        {/* Current Operations Stats */}
                        {operationStats && (
                            <Card title="Average Operation Rates (ops/sec)" style={{ marginBottom: '16px' }}>
                                <Row gutter={[16, 16]}>
                                    <Col span={8}>
                                        <Statistic
                                            title="Commands"
                                            value={operationStats.command}
                                            valueStyle={{ color: '#722ed1' }}
                                            suffix="ops/sec"
                                            formatter={(value) => `${Math.round(Number(value))}`}
                                        />
                                    </Col>
                                    <Col span={8}>
                                        <Statistic
                                            title="Queries"
                                            value={operationStats.query}
                                            valueStyle={{ color: '#1890ff' }}
                                            suffix="ops/sec"
                                            formatter={(value) => `${Math.round(Number(value))}`}
                                        />
                                    </Col>
                                    <Col span={8}>
                                        <Statistic
                                            title="GetMore"
                                            value={operationStats.getmore}
                                            valueStyle={{ color: '#52c41a' }}
                                            suffix="ops/sec"
                                            formatter={(value) => `${Math.round(Number(value))}`}
                                        />
                                    </Col>
                                </Row>
                                <Row gutter={[16, 16]} style={{ marginTop: '16px' }}>
                                    <Col span={8}>
                                        <Statistic
                                            title="Inserts"
                                            value={operationStats.insert}
                                            valueStyle={{ color: '#fa8c16' }}
                                            suffix="ops/sec"
                                            formatter={(value) => `${Math.round(Number(value))}`}
                                        />
                                    </Col>
                                    <Col span={8}>
                                        <Statistic
                                            title="Updates"
                                            value={operationStats.update}
                                            valueStyle={{ color: '#eb2f96' }}
                                            suffix="ops/sec"
                                            formatter={(value) => `${Math.round(Number(value))}`}
                                        />
                                    </Col>
                                    <Col span={8}>
                                        <Statistic
                                            title="Deletes"
                                            value={operationStats.delete}
                                            valueStyle={{ color: '#f5222d' }}
                                            suffix="ops/sec"
                                            formatter={(value) => `${Math.round(Number(value))}`}
                                        />
                                    </Col>
                                </Row>
                            </Card>
                        )}

                        {/* Peak Operation Rates */}
                        {operationSummary && (
                            <Card title="Peak Operation Rates" style={{ marginBottom: '16px' }}>
                                <Row gutter={[16, 16]}>
                                    <Col span={8}>
                                        <Statistic
                                            title="Max Commands"
                                            value={operationSummary.peak_command_rate}
                                            valueStyle={{ color: '#722ed1' }}
                                            suffix="ops/sec"
                                            formatter={(value) => `${Math.round(Number(value))}`}
                                        />
                                    </Col>
                                    <Col span={8}>
                                        <Statistic
                                            title="Max Updates"
                                            value={operationSummary.peak_update_rate}
                                            valueStyle={{ color: '#eb2f96' }}
                                            suffix="ops/sec"
                                            formatter={(value) => `${Math.round(Number(value))}`}
                                        />
                                    </Col>
                                    <Col span={8}>
                                        <Statistic
                                            title="Data Points"
                                            value={operationSummary.data_points}
                                            valueStyle={{ color: '#13c2c2' }}
                                            suffix="measurements"
                                        />
                                    </Col>
                                </Row>
                            </Card>
                        )}

                        {/* Operations Chart */}
                        <Card
                            title="MongoDB Operations Rate Over Time (ops/sec)"
                            loading={operationsDataLoading}
                            extra={
                                <Tooltip title="Shows MongoDB operations per second over time for different operation types">
                                    <InfoCircleOutlined />
                                </Tooltip>
                            }
                        >
                            {operationsHistoricalData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={400}>
                                    <LineChart data={operationsHistoricalData}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis
                                            dataKey="time"
                                            tick={{ fontSize: 12 }}
                                            angle={-45}
                                            textAnchor="end"
                                            height={60}
                                        />
                                        <YAxis
                                            label={{ value: 'Operations Count', angle: -90, position: 'insideLeft' }}
                                        />
                                        <RechartsTooltip
                                            formatter={(value: any, name: string) => {
                                                const label = name.replace('operations_', '').replace(/\b\w/g, l => l.toUpperCase());
                                                return [Math.round(value).toLocaleString(), label];
                                            }}
                                            labelFormatter={(label) => `Time: ${label}`}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="operations_command"
                                            stroke="#722ed1"
                                            strokeWidth={2}
                                            name="Commands"
                                            dot={{ r: 3 }}
                                            activeDot={{ r: 5 }}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="operations_query"
                                            stroke="#1890ff"
                                            strokeWidth={2}
                                            name="Queries"
                                            dot={{ r: 3 }}
                                            activeDot={{ r: 5 }}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="operations_getmore"
                                            stroke="#52c41a"
                                            strokeWidth={2}
                                            name="GetMore"
                                            dot={{ r: 3 }}
                                            activeDot={{ r: 5 }}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="operations_insert"
                                            stroke="#fa8c16"
                                            strokeWidth={2}
                                            name="Inserts"
                                            dot={{ r: 3 }}
                                            activeDot={{ r: 5 }}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="operations_update"
                                            stroke="#eb2f96"
                                            strokeWidth={2}
                                            name="Updates"
                                            dot={{ r: 3 }}
                                            activeDot={{ r: 5 }}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="operations_delete"
                                            stroke="#f5222d"
                                            strokeWidth={2}
                                            name="Deletes"
                                            dot={{ r: 3 }}
                                            activeDot={{ r: 5 }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '40px' }}>
                                    <Empty description="No operations data available" />
                                </div>
                            )}
                        </Card>
                    </div>
                );

            case 'current-ops':
                const currentOpsColumns = [
                    {
                        title: 'Operation ID',
                        dataIndex: 'opid',
                        key: 'opid',
                        width: 120,
                        render: (opid: number) => <Tag color="blue">{opid}</Tag>
                    },
                    {
                        title: 'Operation',
                        dataIndex: 'op',
                        key: 'op',
                        width: 100,
                        render: (op: string) => {
                            let color = 'default';
                            switch (op) {
                                case 'query': color = 'blue'; break;
                                case 'insert': color = 'green'; break;
                                case 'update': color = 'orange'; break;
                                case 'delete': color = 'red'; break;
                                case 'command': color = 'purple'; break;
                                default: color = 'default';
                            }
                            return <Tag color={color}>{op}</Tag>;
                        }
                    },
                    {
                        title: 'Namespace',
                        dataIndex: 'ns',
                        key: 'ns',
                        width: 200,
                        ellipsis: true,
                        render: (ns: string) => <span style={{ fontFamily: 'monospace' }}>{ns}</span>
                    },
                    {
                        title: 'Running Time',
                        dataIndex: 'secs_running',
                        key: 'secs_running',
                        width: 120,
                        sorter: (a: any, b: any) => (a.secs_running || 0) - (b.secs_running || 0),
                        render: (secs: number) => {
                            const seconds = secs || 0;
                            let color = 'green';
                            if (seconds > 60) color = 'orange';
                            if (seconds > 300) color = 'red';
                            return <Tag color={color}>{seconds.toFixed(1)}s</Tag>;
                        }
                    },
                    {
                        title: 'Active',
                        dataIndex: 'active',
                        key: 'active',
                        width: 80,
                        render: (active: boolean) => (
                            <Tag color={active ? 'green' : 'default'}>
                                {active ? 'Yes' : 'No'}
                            </Tag>
                        )
                    },
                    {
                        title: 'Client',
                        dataIndex: 'client',
                        key: 'client',
                        width: 150,
                        ellipsis: true,
                        render: (client: string) => <span style={{ fontFamily: 'monospace' }}>{client}</span>
                    },
                    {
                        title: 'App Name',
                        dataIndex: 'appName',
                        key: 'appName',
                        width: 120,
                        render: (appName: string) => appName || '-'
                    },
                    {
                        title: 'Waiting for Lock',
                        dataIndex: 'waitingForLock',
                        key: 'waitingForLock',
                        width: 120,
                        render: (waiting: boolean) => (
                            <Tag color={waiting ? 'red' : 'green'}>
                                {waiting ? 'Yes' : 'No'}
                            </Tag>
                        )
                    },
                    {
                        title: 'Command',
                        dataIndex: 'command',
                        key: 'command',
                        width: 200,
                        ellipsis: true,
                        render: (command: any) => (
                            <Button
                                type="link"
                                size="small"
                                style={{ 
                                    fontFamily: 'monospace', 
                                    padding: '0',
                                    height: 'auto',
                                    textAlign: 'left'
                                }}
                                onClick={() => showCurrentOpCommandModal(command, 'MongoDB Command Details')}
                            >
                                {JSON.stringify(command).substring(0, 50)}...
                            </Button>
                        )
                    },
                    {
                        title: 'Plan Summary',
                        dataIndex: 'planSummary',
                        key: 'planSummary',
                        width: 250,
                        ellipsis: true,
                        render: (planSummary: string) => planSummary ? (
                            <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                                {planSummary}
                            </span>
                        ) : '-'
                    },
                    {
                        title: 'Yields',
                        dataIndex: 'numYields',
                        key: 'numYields',
                        width: 80,
                        align: 'right' as const,
                        sorter: (a: any, b: any) => (a.numYields || 0) - (b.numYields || 0),
                        render: (yields: number) => yields ? yields.toLocaleString() : '-'
                    },
                    {
                        title: 'Connection',
                        dataIndex: 'desc',
                        key: 'desc',
                        width: 120,
                        ellipsis: true,
                        render: (desc: string) => desc ? (
                            <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                                {desc}
                            </span>
                        ) : '-'
                    },
                    {
                        title: 'User',
                        dataIndex: 'effectiveUsers',
                        key: 'effectiveUsers',
                        width: 120,
                        render: (users: Array<{ user: string; db: string }>) => users && users.length > 0 ? (
                            <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                                {users[0].user}@{users[0].db}
                            </span>
                        ) : '-'
                    },
                    {
                        title: 'Threaded',
                        dataIndex: 'threaded',
                        key: 'threaded',
                        width: 80,
                        render: (threaded: boolean) => (
                            <Tag color={threaded ? 'green' : 'default'}>
                                {threaded ? 'Yes' : 'No'}
                            </Tag>
                        )
                    },
                    {
                        title: 'Client Info',
                        dataIndex: 'clientMetadata',
                        key: 'clientMetadata',
                        width: 120,
                        render: (clientMetadata: any) => clientMetadata ? (
                            <Button
                                type="link"
                                size="small"
                                style={{ padding: '0', height: 'auto' }}
                                onClick={() => showCurrentOpCommandModal(clientMetadata, 'Client Metadata Details')}
                            >
                                View Details
                            </Button>
                        ) : '-'
                    },
                    {
                        title: 'Cursor Info',
                        dataIndex: 'cursor',
                        key: 'cursor',
                        width: 120,
                        render: (cursor: any) => cursor ? (
                            <Button
                                type="link"
                                size="small"
                                style={{ padding: '0', height: 'auto' }}
                                onClick={() => showCurrentOpCommandModal(cursor, 'Cursor Details')}
                            >
                                View Cursor
                            </Button>
                        ) : '-'
                    }
                ];

                return (
                    <div>
                        {/* Controls */}
                        <Card style={{ marginBottom: '16px' }}>
                            <Row gutter={[16, 16]} align="middle">
                                <Col>
                                    <span style={{ fontWeight: 500, marginRight: '8px' }}>Min Running Time:</span>
                                </Col>
                                <Col>
                                    <InputNumber
                                        value={currentOpsMinSeconds}
                                        onChange={(value) => setCurrentOpsMinSeconds(value || 1.0)}
                                        min={0.1}
                                        max={3600}
                                        step={0.5}
                                        style={{ width: '120px' }}
                                        addonAfter="seconds"
                                    />
                                </Col>
                                <Col style={{ marginLeft: 'auto' }}>
                                    <Button
                                        type="primary"
                                        icon={<ReloadOutlined />}
                                        onClick={() => fetchCurrentOps(nodeName, currentOpsMinSeconds)}
                                        loading={currentOpsDataLoading}
                                        style={{
                                            background: '#47A248',
                                            borderColor: '#47A248'
                                        }}
                                    >
                                        Refresh
                                    </Button>
                                </Col>
                            </Row>
                        </Card>

                        {/* Current Operations Summary */}
                        {currentOps && (
                            <Card title="Current Operations Summary" style={{ marginBottom: '16px' }}>
                                <Row gutter={[16, 16]}>
                                    <Col span={6}>
                                        <Statistic
                                            title="Total Operations"
                                            value={currentOps.inprog.length}
                                            valueStyle={{ color: '#1890ff' }}
                                        />
                                    </Col>
                                    <Col span={6}>
                                        <Statistic
                                            title="Active Operations"
                                            value={currentOps.inprog.filter(op => op.active).length}
                                            valueStyle={{ color: '#52c41a' }}
                                        />
                                    </Col>
                                    <Col span={6}>
                                        <Statistic
                                            title="Long Running (>60s)"
                                            value={currentOps.inprog.filter(op => (op.secs_running || 0) > 60).length}
                                            valueStyle={{ color: '#fa8c16' }}
                                        />
                                    </Col>
                                    <Col span={6}>
                                        <Statistic
                                            title="Waiting for Lock"
                                            value={currentOps.inprog.filter(op => op.waitingForLock).length}
                                            valueStyle={{ color: '#f5222d' }}
                                        />
                                    </Col>
                                </Row>
                            </Card>
                        )}

                        {/* Current Operations Table */}
                        <Card
                            title="Current Operations"
                            loading={currentOpsDataLoading}
                            extra={
                                <Tooltip title="Shows currently running operations on the MongoDB instance">
                                    <InfoCircleOutlined />
                                </Tooltip>
                            }
                        >
                            {currentOps && currentOps.inprog.length > 0 ? (
                                <Table
                                    columns={currentOpsColumns}
                                    dataSource={currentOps.inprog}
                                    rowKey="opid"
                                    pagination={{
                                        pageSize: 20,
                                        showSizeChanger: true,
                                        showQuickJumper: true,
                                        showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} operations`
                                    }}
                                    scroll={{ x: 2200 }}
                                    size="middle"
                                />
                            ) : (
                                <div style={{ textAlign: 'center', padding: '40px' }}>
                                    <Empty description="No current operations found" />
                                </div>
                            )}
                        </Card>

                        {/* Command Modal */}
                        <Modal
                            title={commandModalTitle}
                            open={commandModalVisible}
                            onCancel={() => setCommandModalVisible(false)}
                            footer={[
                                <Button 
                                    key="copy" 
                                    onClick={() => {
                                        navigator.clipboard.writeText(JSON.stringify(selectedCommand, null, 2));
                                        message.success('Command copied to clipboard!');
                                    }}
                                >
                                    Copy
                                </Button>,
                                <Button key="close" onClick={() => setCommandModalVisible(false)}>
                                    Close
                                </Button>
                            ]}
                            width={800}
                        >
                            <div style={{ 
                                backgroundColor: '#f6f8fa', 
                                border: '1px solid #d1d9e0',
                                borderRadius: '6px',
                                padding: '16px',
                                fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                                fontSize: '13px',
                                lineHeight: '1.45',
                                overflow: 'auto',
                                maxHeight: '500px'
                            }}>
                                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                    {selectedCommand ? JSON.stringify(selectedCommand, null, 2) : ''}
                                </pre>
                            </div>
                        </Modal>
                    </div>
                );

            default:
                return (
                    <div style={{ textAlign: 'center', padding: '40px' }}>
                        <Empty description="Please select an operation metric to view" />
                    </div>
                );
        }
    };

    const renderSystemTab = () => {
        switch (selectedSubMenu) {
            case 'system-cpu':
                return (
                    <div>
                        {/* Time Range Selector */}
                        <Card style={{ marginBottom: '16px' }}>
                            <Row gutter={[16, 16]} align="middle">
                                <Col>
                                    <span style={{ fontWeight: 500, marginRight: '8px' }}>Time Range:</span>
                                </Col>
                                <Col>
                                    <Select
                                        value={selectedTimeRange}
                                        onChange={handleTimeRangeChange}
                                        style={{ width: '120px' }}
                                        options={[
                                            { label: '15 minutes', value: '15m' },
                                            { label: '1 hour', value: '1h' },
                                            { label: '3 hours', value: '3h' },
                                            { label: '6 hours', value: '6h' },
                                            { label: '12 hours', value: '12h' },
                                            { label: '1 day', value: '1d' },
                                            { label: '3 days', value: '3d' },
                                            { label: '7 days', value: '7d' }
                                        ]}
                                    />
                                </Col>
                                <Col style={{ marginLeft: 'auto' }}>
                                    <Button
                                        type="primary"
                                        icon={<ReloadOutlined />}
                                        onClick={() => fetchSystemCpuMetrics(nodeName, selectedTimeRange)}
                                        loading={systemCpuDataLoading}
                                        style={{
                                            background: '#47A248',
                                            borderColor: '#47A248'
                                        }}
                                    >
                                        Refresh
                                    </Button>
                                </Col>
                            </Row>
                        </Card>

                        {/* Current System Stats */}
                        {systemMetrics && (
                            <Card title="Current System Statistics" style={{ marginBottom: '16px' }}>
                                <Row gutter={[16, 16]}>
                                    <Col span={6}>
                                        <Statistic
                                            title="CPU Usage"
                                            value={Math.round(systemMetrics.cpu_usage * 10) / 10}
                                            valueStyle={{ color: systemMetrics.cpu_usage > 80 ? '#cf1322' : systemMetrics.cpu_usage > 60 ? '#fa8c16' : '#52c41a' }}
                                            suffix="%"
                                            precision={1}
                                        />
                                    </Col>
                                    <Col span={6}>
                                        <Statistic
                                            title="CPU Cores"
                                            value={systemMetrics.cpu_cores}
                                            valueStyle={{ color: '#1890ff' }}
                                            suffix="cores"
                                        />
                                    </Col>
                                    <Col span={6}>
                                        <Statistic
                                            title="CPU Load per Core"
                                            value={(systemMetrics.cpu_usage / Math.max(systemMetrics.cpu_cores, 1))}
                                            valueStyle={{ color: '#722ed1' }}
                                            suffix="% per core"
                                            precision={1}
                                        />
                                    </Col>
                                    <Col span={6}>
                                        <Statistic
                                            title="System Status"
                                            value={systemMetrics.cpu_usage < 60 ? "Healthy" : systemMetrics.cpu_usage < 80 ? "Warning" : "Critical"}
                                            valueStyle={{
                                                color: systemMetrics.cpu_usage < 60 ? '#52c41a' :
                                                    systemMetrics.cpu_usage < 80 ? '#fa8c16' : '#cf1322'
                                            }}
                                        />
                                    </Col>
                                </Row>
                            </Card>
                        )}

                        {/* System CPU Chart */}
                        <Card
                            title="MongoDB System CPU Usage Over Time"
                            loading={systemCpuDataLoading}
                            extra={
                                <Tooltip title="Shows CPU usage percentage and core count over time">
                                    <InfoCircleOutlined />
                                </Tooltip>
                            }
                        >
                            {systemCpuHistoricalData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={400}>
                                    <LineChart data={systemCpuHistoricalData}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis
                                            dataKey="time"
                                            tick={{ fontSize: 12 }}
                                            angle={-45}
                                            textAnchor="end"
                                            height={60}
                                        />
                                        <YAxis
                                            yAxisId="usage"
                                            label={{ value: 'CPU Usage (%)', angle: -90, position: 'insideLeft' }}
                                            domain={[0, 100]}
                                        />
                                        <YAxis
                                            yAxisId="cores"
                                            orientation="right"
                                            label={{ value: 'CPU Cores', angle: 90, position: 'insideRight' }}
                                        />
                                        <RechartsTooltip
                                            formatter={(value: any, name: string) => {
                                                if (name === 'cpu_usage') {
                                                    return [`${Math.round(value * 10) / 10}%`, 'CPU Usage'];
                                                } else if (name === 'cpu_cores') {
                                                    return [`${value}`, 'CPU Cores'];
                                                }
                                                return [value, name];
                                            }}
                                            labelFormatter={(label, payload) => {
                                                if (payload && payload.length > 0 && payload[0].payload?.timestamp) {
                                                    const date = new Date(payload[0].payload.timestamp);
                                                    return `Time: ${date.toLocaleString()}`;
                                                }
                                                return `Time: ${label}`;
                                            }}
                                        />
                                        <Line
                                            yAxisId="usage"
                                            type="monotone"
                                            dataKey="cpu_usage"
                                            stroke="#cf1322"
                                            strokeWidth={3}
                                            name="cpu_usage"
                                            dot={{ r: 4 }}
                                            activeDot={{ r: 6 }}
                                        />
                                        <Line
                                            yAxisId="cores"
                                            type="monotone"
                                            dataKey="cpu_cores"
                                            stroke="#1890ff"
                                            strokeWidth={2}
                                            name="cpu_cores"
                                            dot={{ r: 3 }}
                                            activeDot={{ r: 5 }}
                                            strokeDasharray="5 5"
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '40px' }}>
                                    <Empty description="No system CPU data available" />
                                </div>
                            )}
                        </Card>
                    </div>
                );

            case 'system-memory':
                return (
                    <div>
                        {/* Time Range Selector */}
                        <Card style={{ marginBottom: '16px' }}>
                            <Row gutter={[16, 16]} align="middle">
                                <Col>
                                    <span style={{ fontWeight: 500, marginRight: '8px' }}>Time Range:</span>
                                </Col>
                                <Col>
                                    <Select
                                        value={selectedTimeRange}
                                        onChange={handleTimeRangeChange}
                                        style={{ width: '120px' }}
                                        options={[
                                            { label: '15 minutes', value: '15m' },
                                            { label: '1 hour', value: '1h' },
                                            { label: '3 hours', value: '3h' },
                                            { label: '6 hours', value: '6h' },
                                            { label: '12 hours', value: '12h' },
                                            { label: '1 day', value: '1d' },
                                            { label: '3 days', value: '3d' },
                                            { label: '7 days', value: '7d' }
                                        ]}
                                    />
                                </Col>
                                <Col style={{ marginLeft: 'auto' }}>
                                    <Button
                                        type="primary"
                                        icon={<ReloadOutlined />}
                                        onClick={() => fetchSystemMemoryMetrics(nodeName, selectedTimeRange)}
                                        loading={systemMemoryDataLoading}
                                        style={{
                                            background: '#47A248',
                                            borderColor: '#47A248'
                                        }}
                                    >
                                        Refresh
                                    </Button>
                                </Col>
                            </Row>
                        </Card>

                        {/* Current Memory Stats */}
                        {systemMetrics && (
                            <Card title="Current Memory Statistics" style={{ marginBottom: '16px' }}>
                                <Row gutter={[16, 16]}>
                                    <Col span={6}>
                                        <Statistic
                                            title="Memory Usage"
                                            value={Math.round(systemMetrics.memory_usage * 10) / 10}
                                            valueStyle={{ color: systemMetrics.memory_usage > 85 ? '#cf1322' : systemMetrics.memory_usage > 70 ? '#fa8c16' : '#52c41a' }}
                                            suffix="%"
                                            precision={1}
                                        />
                                    </Col>
                                    <Col span={6}>
                                        <Statistic
                                            title="Total Memory"
                                            value={formatBytes(systemMetrics.total_memory, 1)}
                                            valueStyle={{ color: '#1890ff' }}
                                        />
                                    </Col>
                                    <Col span={6}>
                                        <Statistic
                                            title="Free Memory"
                                            value={formatBytes(systemMetrics.free_memory, 1)}
                                            valueStyle={{ color: '#52c41a' }}
                                        />
                                    </Col>
                                    <Col span={6}>
                                        <Statistic
                                            title="Used Memory"
                                            value={formatBytes(systemMetrics.total_memory - systemMetrics.free_memory, 1)}
                                            valueStyle={{ color: '#fa8c16' }}
                                        />
                                    </Col>
                                </Row>
                                <Row gutter={[16, 16]} style={{ marginTop: '16px' }}>
                                    <Col span={12}>
                                        <Progress
                                            percent={Math.round(systemMetrics.memory_usage * 10) / 10}
                                            strokeColor={systemMetrics.memory_usage > 85 ? '#cf1322' : systemMetrics.memory_usage > 70 ? '#fa8c16' : '#52c41a'}
                                            format={percent => `${Math.round((percent || 0) * 10) / 10}% Used`}
                                        />
                                    </Col>
                                    <Col span={12}>
                                        <Statistic
                                            title="Memory Status"
                                            value={systemMetrics.memory_usage < 70 ? "Healthy" : systemMetrics.memory_usage < 85 ? "Warning" : "Critical"}
                                            valueStyle={{
                                                color: systemMetrics.memory_usage < 70 ? '#52c41a' :
                                                    systemMetrics.memory_usage < 85 ? '#fa8c16' : '#cf1322'
                                            }}
                                        />
                                    </Col>
                                </Row>
                            </Card>
                        )}

                        {/* System Memory Chart */}
                        <Card
                            title="MongoDB System Memory Usage Over Time"
                            loading={systemMemoryDataLoading}
                            extra={
                                <Tooltip title="Shows memory usage percentage, total and free memory over time">
                                    <InfoCircleOutlined />
                                </Tooltip>
                            }
                        >
                            {systemMemoryHistoricalData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={400}>
                                    <LineChart data={systemMemoryHistoricalData}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis
                                            dataKey="time"
                                            tick={{ fontSize: 12 }}
                                            angle={-45}
                                            textAnchor="end"
                                            height={60}
                                        />
                                        <YAxis
                                            yAxisId="percentage"
                                            label={{ value: 'Memory Usage (%)', angle: -90, position: 'insideLeft' }}
                                            domain={[0, 100]}
                                        />
                                        <YAxis
                                            yAxisId="bytes"
                                            orientation="right"
                                            label={{ value: 'Memory (Bytes)', angle: 90, position: 'insideRight' }}
                                            tickFormatter={(value) => formatBytes(value, 0)}
                                        />
                                        <RechartsTooltip
                                            formatter={(value: any, name: string) => {
                                                if (name === 'memory_usage') {
                                                    return [`${Math.round(value * 10) / 10}%`, 'Memory Usage'];
                                                } else if (name === 'memory_total') {
                                                    return [formatBytes(value, 1), 'Total Memory'];
                                                } else if (name === 'free_memory') {
                                                    return [formatBytes(value, 1), 'Free Memory'];
                                                } else if (name === 'used_memory') {
                                                    return [formatBytes(value, 1), 'Used Memory'];
                                                }
                                                return [value, name];
                                            }}
                                            labelFormatter={(label, payload) => {
                                                if (payload && payload.length > 0 && payload[0].payload?.timestamp) {
                                                    const date = new Date(payload[0].payload.timestamp);
                                                    return `Time: ${date.toLocaleString()}`;
                                                }
                                                return `Time: ${label}`;
                                            }}
                                        />
                                        <Line
                                            yAxisId="percentage"
                                            type="monotone"
                                            dataKey="memory_usage"
                                            stroke="#cf1322"
                                            strokeWidth={3}
                                            name="memory_usage"
                                            dot={{ r: 4 }}
                                            activeDot={{ r: 6 }}
                                        />
                                        <Line
                                            yAxisId="bytes"
                                            type="monotone"
                                            dataKey="memory_total"
                                            stroke="#1890ff"
                                            strokeWidth={2}
                                            name="memory_total"
                                            dot={{ r: 3 }}
                                            activeDot={{ r: 5 }}
                                            strokeDasharray="5 5"
                                        />
                                        <Line
                                            yAxisId="bytes"
                                            type="monotone"
                                            dataKey="free_memory"
                                            stroke="#52c41a"
                                            strokeWidth={2}
                                            name="free_memory"
                                            dot={{ r: 3 }}
                                            activeDot={{ r: 5 }}
                                        />
                                        <Line
                                            yAxisId="bytes"
                                            type="monotone"
                                            dataKey="used_memory"
                                            stroke="#fa8c16"
                                            strokeWidth={2}
                                            name="used_memory"
                                            dot={{ r: 3 }}
                                            activeDot={{ r: 5 }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '40px' }}>
                                    <Empty description="No system memory data available" />
                                </div>
                            )}
                        </Card>
                    </div>
                );

            case 'system-disk':
                return (
                    <div>
                        {/* Time Range Selector */}
                        <Card style={{ marginBottom: '16px' }}>
                            <Row gutter={[16, 16]} align="middle">
                                <Col>
                                    <span style={{ fontWeight: 500, marginRight: '8px' }}>Time Range:</span>
                                </Col>
                                <Col>
                                    <Select
                                        value={selectedTimeRange}
                                        onChange={handleTimeRangeChange}
                                        style={{ width: '120px' }}
                                        options={[
                                            { label: '15 minutes', value: '15m' },
                                            { label: '1 hour', value: '1h' },
                                            { label: '3 hours', value: '3h' },
                                            { label: '6 hours', value: '6h' },
                                            { label: '12 hours', value: '12h' },
                                            { label: '1 day', value: '1d' },
                                            { label: '3 days', value: '3d' },
                                            { label: '7 days', value: '7d' }
                                        ]}
                                    />
                                </Col>
                            </Row>
                        </Card>

                        {/* Current Disk Stats */}
                        {systemMetrics && (
                            <Card title="Current Disk Statistics" style={{ marginBottom: '16px' }}>
                                <Row gutter={[16, 16]}>
                                    <Col span={6}>
                                        <Statistic
                                            title="Total Disk Space"
                                            value={formatBytes(systemMetrics.total_disk, 1)}
                                            valueStyle={{ color: '#1890ff' }}
                                        />
                                    </Col>
                                    <Col span={6}>
                                        <Statistic
                                            title="Free Disk Space"
                                            value={formatBytes(systemMetrics.free_disk, 1)}
                                            valueStyle={{ color: '#52c41a' }}
                                        />
                                    </Col>
                                    <Col span={6}>
                                        <Statistic
                                            title="Used Disk Space"
                                            value={formatBytes(systemMetrics.total_disk - systemMetrics.free_disk, 1)}
                                            valueStyle={{ color: '#fa8c16' }}
                                        />
                                    </Col>
                                    <Col span={6}>
                                        <Statistic
                                            title="Disk Usage"
                                            value={(() => {
                                                const usedDisk = systemMetrics.total_disk - systemMetrics.free_disk;
                                                return systemMetrics.total_disk > 0
                                                    ? Math.round(((usedDisk / systemMetrics.total_disk) * 100) * 10) / 10
                                                    : 0;
                                            })()}
                                            valueStyle={{ color: '#722ed1' }}
                                            suffix="%"
                                            precision={1}
                                        />
                                    </Col>
                                </Row>
                                <Row gutter={[16, 16]} style={{ marginTop: '16px' }}>
                                    <Col span={12}>
                                        <Progress
                                            percent={(() => {
                                                const usedDisk = systemMetrics.total_disk - systemMetrics.free_disk;
                                                return systemMetrics.total_disk > 0
                                                    ? Math.round(((usedDisk / systemMetrics.total_disk) * 100) * 10) / 10
                                                    : 0;
                                            })()}
                                            strokeColor={(() => {
                                                const usedDisk = systemMetrics.total_disk - systemMetrics.free_disk;
                                                const usagePercent = systemMetrics.total_disk > 0
                                                    ? ((usedDisk / systemMetrics.total_disk) * 100)
                                                    : 0;
                                                return usagePercent > 85 ? '#cf1322' : usagePercent > 70 ? '#fa8c16' : '#52c41a';
                                            })()}
                                            format={percent => `${Math.round((percent || 0) * 10) / 10}% Used`}
                                        />
                                    </Col>
                                    <Col span={12}>
                                        <Statistic
                                            title="Disk Status"
                                            value={(() => {
                                                const usedDisk = systemMetrics.total_disk - systemMetrics.free_disk;
                                                const usagePercent = systemMetrics.total_disk > 0
                                                    ? ((usedDisk / systemMetrics.total_disk) * 100)
                                                    : 0;
                                                return usagePercent < 70 ? "Healthy" : usagePercent < 85 ? "Warning" : "Critical";
                                            })()}
                                            valueStyle={{
                                                color: (() => {
                                                    const usedDisk = systemMetrics.total_disk - systemMetrics.free_disk;
                                                    const usagePercent = systemMetrics.total_disk > 0
                                                        ? ((usedDisk / systemMetrics.total_disk) * 100)
                                                        : 0;
                                                    return usagePercent < 70 ? '#52c41a' :
                                                        usagePercent < 85 ? '#fa8c16' : '#cf1322';
                                                })()
                                            }}
                                        />
                                    </Col>
                                </Row>
                            </Card>
                        )}

                        {/* System Disk Chart */}
                        <Card
                            title="MongoDB System Disk Usage Over Time"
                            loading={systemDiskDataLoading}
                            extra={
                                <Tooltip title="Shows disk usage percentage, total and free disk space over time">
                                    <InfoCircleOutlined />
                                </Tooltip>
                            }
                        >
                            {systemDiskHistoricalData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={400}>
                                    <LineChart data={systemDiskHistoricalData}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis
                                            dataKey="time"
                                            tick={{ fontSize: 12 }}
                                            angle={-45}
                                            textAnchor="end"
                                            height={60}
                                        />
                                        <YAxis
                                            yAxisId="percentage"
                                            label={{ value: 'Disk Usage (%)', angle: -90, position: 'insideLeft' }}
                                            domain={[0, 100]}
                                        />
                                        <YAxis
                                            yAxisId="bytes"
                                            orientation="right"
                                            label={{ value: 'Disk Space (Bytes)', angle: 90, position: 'insideRight' }}
                                            tickFormatter={(value) => formatBytes(value, 0)}
                                        />
                                        <RechartsTooltip
                                            formatter={(value: any, name: string) => {
                                                if (name === 'disk_usage_percent') {
                                                    return [`${Math.round(value * 10) / 10}%`, 'Disk Usage'];
                                                } else if (name === 'disk_total') {
                                                    return [formatBytes(value, 1), 'Total Disk Space'];
                                                } else if (name === 'used_disk') {
                                                    return [formatBytes(value, 1), 'Used Disk Space'];
                                                } else if (name === 'free_disk') {
                                                    return [formatBytes(value, 1), 'Free Disk Space'];
                                                }
                                                return [value, name];
                                            }}
                                            labelFormatter={(label, payload) => {
                                                if (payload && payload.length > 0 && payload[0].payload?.timestamp) {
                                                    const date = new Date(payload[0].payload.timestamp);
                                                    return `Time: ${date.toLocaleString()}`;
                                                }
                                                return `Time: ${label}`;
                                            }}
                                        />
                                        <Line
                                            yAxisId="percentage"
                                            type="monotone"
                                            dataKey="disk_usage_percent"
                                            stroke="#cf1322"
                                            strokeWidth={3}
                                            name="disk_usage_percent"
                                            dot={{ r: 4 }}
                                            activeDot={{ r: 6 }}
                                        />
                                        <Line
                                            yAxisId="bytes"
                                            type="monotone"
                                            dataKey="disk_total"
                                            stroke="#1890ff"
                                            strokeWidth={2}
                                            name="disk_total"
                                            dot={{ r: 3 }}
                                            activeDot={{ r: 5 }}
                                            strokeDasharray="5 5"
                                        />
                                        <Line
                                            yAxisId="bytes"
                                            type="monotone"
                                            dataKey="disk_usage"
                                            stroke="#52c41a"
                                            strokeWidth={2}
                                            name="disk_usage"
                                            dot={{ r: 3 }}
                                            activeDot={{ r: 5 }}
                                        />
                                        <Line
                                            yAxisId="bytes"
                                            type="monotone"
                                            dataKey="free_disk"
                                            stroke="#fa8c16"
                                            strokeWidth={2}
                                            name="free_disk"
                                            dot={{ r: 3 }}
                                            activeDot={{ r: 5 }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '40px' }}>
                                    <Empty description="No system disk data available" />
                                </div>
                            )}
                        </Card>
                    </div>
                );

            default:
                return (
                    <div style={{ textAlign: 'center', padding: '40px' }}>
                        <Empty description="Please select a system metric to view" />
                    </div>
                );
        }
    };

    // Main render
    return (
        <div style={{ padding: '20px', background: '#f0f2f5', minHeight: '100vh' }}>
            {/* Header Card */}
            <Card
                style={{
                    borderRadius: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                    marginBottom: '20px',
                    border: '1px solid #e8e8e8'
                }}
            >
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <IconMongo />
                        <div>
                            <h2 style={{ margin: 0, color: '#47A248', fontSize: '24px', fontWeight: 600 }}>
                                MongoDB Performance Analyzer
                            </h2>
                            <p style={{ margin: 0, color: '#8c8c8c', fontSize: '14px' }}>
                                Monitor and analyze MongoDB performance metrics
                            </p>
                        </div>
                    </div>
                    <Button
                        type="primary"
                        icon={<ReloadOutlined />}
                        onClick={() => queryClient.invalidateQueries({ queryKey: ['mongodb-clusters'] })}
                        style={{
                            background: '#47A248',
                            borderColor: '#47A248',
                            borderRadius: '6px',
                            boxShadow: '0 2px 4px rgba(71, 162, 72, 0.2)'
                        }}
                    >
                        Refresh
                    </Button>
                </div>
            </Card>

            {/* Control Panel */}
            <Card style={{
                borderRadius: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                marginBottom: '20px',
                border: '1px solid #e8e8e8'
            }}>
                <Steps current={currentStep} style={{ marginBottom: '20px' }}>
                    <Step title="Select Cluster" />
                    <Step title="Select Node" />
                    {activeTab === '3' && (selectedSubMenu === 'collections' || selectedSubMenu === 'index-usage') && <Step title="Select Database" />}
                </Steps>

                <Row gutter={[20, 16]} align="middle" justify="center">
                    <Col span={8} style={{ display: 'flex', justifyContent: 'center' }}>
                        <div style={{
                            borderRadius: '8px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                            overflow: 'hidden',
                            border: '1px solid #f0f0f0',
                            width: '100%',
                            maxWidth: '350px'
                        }}>
                            <div style={{
                                padding: '8px 12px',
                                background: 'linear-gradient(90deg, #f0f9f0 0%, #f5fcf5 100%)',
                                borderBottom: '1px solid #f0f0f0',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px'
                            }}>
                                <DatabaseOutlined style={{ color: '#47A248' }} />
                                <span style={{ fontWeight: 500, color: '#595959' }}>MongoDB Cluster</span>
                            </div>
                            <div style={{ padding: '12px' }}>
                                <Select
                                    showSearch
                                    value={clusterName}
                                    onChange={setClusterName}
                                    style={{ width: '100%' }}
                                    placeholder="Select a MongoDB cluster"
                                    filterOption={(input, option) =>
                                        option?.children
                                            ? option.children.toString().toLowerCase().includes(input.toLowerCase())
                                            : false
                                    }
                                    loading={loadingClusterName}
                                    size="large"
                                    suffixIcon={<CaretDownOutlined style={{ color: '#47A248' }} />}
                                    dropdownStyle={{ boxShadow: '0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 9px 28px 8px rgba(0, 0, 0, 0.05)' }}
                                >
                                    {clusterNames.map((name, index) => {
                                        const clusterData = name === 'Standalone' ? data['Standalone'] || data[''] : data[name];
                                        return (
                                            <Option key={`cluster-${name}-${index}`} value={name} style={{ padding: '8px 12px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                    <span style={{ fontWeight: 500 }}>
                                                        {name === 'Standalone' ? 'Standalone MongoDB Instance' : name}
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

                    <Col span={8} style={{ display: 'flex', justifyContent: 'center' }}>
                        <div style={{
                            borderRadius: '8px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                            overflow: 'hidden',
                            border: '1px solid #f0f0f0',
                            width: '100%',
                            maxWidth: '350px'
                        }}>
                            <div style={{
                                padding: '8px 12px',
                                background: 'linear-gradient(90deg, #f0f9f0 0%, #f5fcf5 100%)',
                                borderBottom: '1px solid #f0f0f0',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px'
                            }}>
                                <ClusterOutlined style={{ color: '#47A248' }} />
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
                                    suffixIcon={<CaretDownOutlined style={{ color: '#47A248' }} />}
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
                                                {node.MongoStatus === "RUNNING" ?
                                                    <Badge status="success" text={null} /> :
                                                    <Badge status="warning" text={null} />
                                                }
                                                <span style={{ fontWeight: 500 }}>{node.Hostname}</span>
                                                <Tag color={node.NodeStatus === "PRIMARY" ? "red" : node.NodeStatus === "SECONDARY" ? "blue" : "orange"} style={{ marginLeft: 'auto' }}>
                                                    {node.NodeStatus || 'Unknown'}
                                                </Tag>
                                                <Tag color="green">{node.MongoVersion || 'Unknown'}</Tag>
                                                {node.ReplicaSetName && <Tag color="purple">{node.ReplicaSetName}</Tag>}
                                                {node.NodeStatus === "PRIMARY" && <Tag color="cyan">Primary</Tag>}
                                            </Space>
                                        </Option>
                                    ))}
                                </Select>
                            </div>
                        </div>
                    </Col>

                    {activeTab === '3' && (selectedSubMenu === 'collections' || selectedSubMenu === 'index-usage') && (
                        <Col span={8} style={{ display: 'flex', justifyContent: 'center' }}>
                            <div style={{
                                borderRadius: '8px',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                                overflow: 'hidden',
                                border: '1px solid #f0f0f0',
                                width: '100%',
                                maxWidth: '350px'
                            }}>
                                <div style={{
                                    padding: '8px 12px',
                                    background: 'linear-gradient(90deg, #f0f9f0 0%, #f5fcf5 100%)',
                                    borderBottom: '1px solid #f0f0f0',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px'
                                }}>
                                    <DatabaseOutlined style={{ color: '#47A248' }} />
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
                                        suffixIcon={<CaretDownOutlined style={{ color: '#47A248' }} />}
                                        dropdownStyle={{ boxShadow: '0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 9px 28px 8px rgba(0, 0, 0, 0.05)' }}
                                        disabled={!nodeName}
                                    >
                                        {databaseNames.map((name, index) => (
                                            <Option key={`db-${name}-${index}`} value={name} style={{ padding: '8px 12px' }}>
                                                <Space>
                                                    <DatabaseOutlined style={{ color: '#47A248' }} />
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
                        if (key === '1') handleSubMenuClick('connections');
                        else if (key === '2') handleSubMenuClick('operations');
                        else if (key === '3') handleSubMenuClick('database-stats');
                        else if (key === '4') handleSubMenuClick('system-cpu');
                    }}
                    style={{
                        margin: '0',
                        padding: '8px 16px 0'
                    }}
                    tabBarStyle={{
                        marginBottom: 0,
                        color: '#47A248',
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
                        }
                    ]}
                />

                {activeTab === '1' && (
                    <Card style={{ borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderRadius: 0 }}>
                        <Tabs
                            activeKey={selectedSubMenu}
                            onChange={handleSubMenuClick}
                            tabBarStyle={{ color: '#47A248' }}
                            items={[
                                {
                                    key: 'connections',
                                    label: 'Connections',
                                    children: renderServerTab()
                                },
                                {
                                    key: 'replication',
                                    label: 'Replication',
                                    children: renderServerTab()
                                },
                                {
                                    key: 'oplog',
                                    label: 'Oplog',
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
                            tabBarStyle={{ color: '#47A248' }}
                            items={[
                                {
                                    key: 'operations',
                                    label: 'Operations',
                                    children: renderQueriesTab()
                                },
                                {
                                    key: 'current-ops',
                                    label: 'Current Operations',
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
                            tabBarStyle={{ color: '#47A248' }}
                            items={[
                                {
                                    key: 'database-stats',
                                    label: 'Database Statistics',
                                    children: renderDatabaseTab()
                                },
                                {
                                    key: 'working-set',
                                    label: 'Working Set Analysis',
                                    children: renderDatabaseTab()
                                },
                                {
                                    key: 'collections',
                                    label: 'Collections',
                                    children: renderDatabaseTab()
                                },
                                {
                                    key: 'index-usage',
                                    label: 'Index Usage',
                                    children: renderDatabaseTab()
                                }
                            ]}
                        />
                    </Card>
                )}

                {activeTab === '4' && (
                    <Card style={{ borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderRadius: 0 }}>
                        <Tabs
                            activeKey={selectedSubMenu}
                            onChange={handleSubMenuClick}
                            tabBarStyle={{ color: '#47A248' }}
                            items={[
                                {
                                    key: 'system-cpu',
                                    label: 'CPU Metrics',
                                    children: renderSystemTab()
                                },
                                {
                                    key: 'system-memory',
                                    label: 'Memory Metrics',
                                    children: renderSystemTab()
                                },
                                {
                                    key: 'system-disk',
                                    label: 'Disk Metrics',
                                    children: renderSystemTab()
                                }
                            ]}
                        />
                    </Card>
                )}
            </Layout>
        </div>
    );
};

export default MongoPAWrapper; 