import React, { useState, useEffect, useCallback } from 'react';
import {
     Select, Spin, Table, Button,  message,
     Tag, Card, Statistic, Row, Col, Input, Modal, Steps, Tooltip, Slider, Tabs
} from 'antd';
import type { ColumnType } from 'antd/es/table';
import type { Key } from 'react';
import axios from 'axios';
import {
    ReloadOutlined, 
    AlertOutlined,  ArrowDownOutlined, 
    ArrowUpOutlined,  DatabaseOutlined,
    FieldTimeOutlined, UserOutlined,  LoadingOutlined,
    RobotOutlined, FileTextOutlined, CopyOutlined
} from '@ant-design/icons';
import { useLocation} from 'react-router-dom';
import { useSelector } from 'react-redux';
import { store } from './redux/store';
import { incrementUsage } from './redux/aiLimitSlice';
import AIAnalysisRenderer from './components/AIAnalysisRenderer';

const { Option } = Select;
const { Step } = Steps;
const { TabPane } = Tabs;

const { Search } = Input;


interface PostgresLogEntry {
    timestamp: string;
    host?: string;
    database?: string;
    user?: string;
    level: string;
    message: string;
    duration?: number;
    statement?: string;
    connection_info?: string;
    error_detail?: string;
    query?: string;
    session_id?: string;
    process_id?: string;
    hint?: string;
    sql_state?: string;
    transaction_id?: string;
    virtual_transaction_id?: string;
    uniqueId?: number;
}

interface PlanNode {
    id: number;
    parentId: number;
    operation: string;
    cost?: { start: number; end: number };
    time?: { start: number; end: number };
    rows?: number;
    plannedRows?: number;
    buffers?: {
        shared?: { hit?: number; read?: number; dirtied?: number; written?: number; };
        local?: { hit?: number; read?: number; dirtied?: number; written?: number; };
    };
    workers?: number;
    loops?: number;
    output?: string[];
    objectName?: string;
    indexName?: string;
    scanType?: string;
    nodeType?: string;
    condition?: string;
    sort?: string[];
}

interface QueryTiming {
    name: string;
    time: number;
    percentage: number;
    calls?: number;
}

interface LogFile {
    fileName: string;
    fileSize: string;
    path: string;
    lastModified: Date;
    displayName: string;
}

interface LogStats {
    totalQueries: number;
    avgExecutionTime: number;
    slowestQuery: {
        query: string;
        time: number;
        timestamp: string;
    };
    errorCount: number;
    warningCount: number;
    infoCount: number;
    topUsers: Array<{ user: string; count: number }>;
    topDatabases: Array<{ database: string; count: number }>;
    topErrors: Array<{ error: string; count: number }>;
}

interface NodeInfo {
    Hostname: string;
    NodeStatus: string;
    Location: string;
    IP: string;
    PostgresStatus: string;
    Role: string;
    Version?: string;
    Replication?: string;
    FreeDisk?: string;
    FDPercent?: number;
    TotalDisk?: string;
}

// EmptyLogResults bileşeni
const EmptyLogResults = ({ 
    onRefresh, 
    fileName, 
    threshold,
    onThresholdChange,
    isLoading 
}: { 
    onRefresh: () => void, 
    fileName?: string,
    threshold?: number,
    onThresholdChange?: (value: number) => void,
    isLoading: boolean 
}) => (
    <div style={{ 
        textAlign: 'center', 
        padding: '30px',
        background: '#f9f9f9',
        borderRadius: '8px',
        border: '1px solid #f0f0f0',
        margin: '20px 0'
    }}>
        <div style={{ marginBottom: '20px', fontSize: '16px' }}>
            <DatabaseOutlined style={{ fontSize: '36px', color: '#1890ff', display: 'block', margin: '0 auto 16px' }} />
            <div style={{ fontWeight: 'bold', marginBottom: '12px', fontSize: '18px' }}>
                {fileName ? `Analysis Settings for "${fileName.split('/').pop()}"` : 'Log File Selected'}
            </div>
            <div style={{ color: '#666', fontSize: '14px', marginBottom: 24 }}>
                {isLoading ? 
                    'Analyzing log file, please wait...' :
                    'Set the slow query threshold below and click "Analyze Log" to start analysis.'
                }
            </div>
        </div>
        
        {/* Threshold slider */}
        {threshold !== undefined && onThresholdChange && (
            <div style={{ 
                maxWidth: 500, 
                margin: '0 auto', 
                marginBottom: 30, 
                background: 'white', 
                padding: '20px', 
                borderRadius: '8px', 
                border: '1px solid #d9d9d9',
                opacity: isLoading ? 0.7 : 1,
                pointerEvents: isLoading ? 'none' : 'auto'
            }}>
                <div style={{ marginBottom: 16, textAlign: 'center' }}>
                    <span style={{ fontSize: '16px', fontWeight: 'bold' }}>Slow Query Threshold: <span style={{ color: '#1890ff' }}>{threshold} ms</span></span>
                </div>
                <Slider
                    min={10}
                    max={1000}
                    step={10}
                    value={threshold}
                    onChange={onThresholdChange}
                    marks={{
                        10: '10ms',
                        100: '100ms',
                        500: '500ms',
                        1000: '1s'
                    }}
                    tooltip={{
                        open: true,
                        placement: 'bottom'
                    }}
                    disabled={isLoading}
                />
                <div style={{ fontSize: '12px', color: '#999', textAlign: 'center', marginTop: '12px' }}>
                    Set the minimum duration to consider a query as slow (10ms - 1000ms)
                </div>
            </div>
        )}
        
        <Button 
            type="primary" 
            icon={isLoading ? <LoadingOutlined /> : <ReloadOutlined />}
            onClick={onRefresh}
            size="large"
            disabled={isLoading}
            loading={isLoading}
            style={{ 
                fontSize: '16px', 
                height: '44px', 
                paddingLeft: '24px', 
                paddingRight: '24px',
                fontWeight: 'bold',
                boxShadow: '0 2px 10px rgba(24, 144, 255, 0.5)',
                backgroundColor: '#1890ff',
                borderColor: '#1890ff'
            }}
        >
            {isLoading ? 'Analyzing...' : 'Analyze Log'}
        </Button>
        <div style={{ marginTop: '12px', fontSize: '12px', color: '#888' }}>
            {isLoading ? 
                'Processing log file, this may take a while...' :
                'Logs will be processed according to your selected threshold'
            }
        </div>
        
        {isLoading && (
            <div style={{ marginTop: '20px' }}>
                <Spin />
                <div style={{ marginTop: '10px', color: '#1890ff' }}>
                    Analyzing log file...
                </div>
            </div>
        )}
    </div>
);

const PostgresQueryAnalyzer: React.FC = () => {
    const [clusters, setClusters] = useState<string[]>([]);
    const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
    const [nodes, setNodes] = useState<NodeInfo[]>([]);
    const [selectedNode, setSelectedNode] = useState<string | null>(null);
    const [logFiles, setLogFiles] = useState<string[]>([]);
    const [selectedLogFile, setSelectedLogFile] = useState<string | null>(null);
    const [logs, setLogs] = useState<PostgresLogEntry[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [fetchingClusters, setFetchingClusters] = useState<boolean>(false);
    const [fetchingNodes, setFetchingNodes] = useState<boolean>(false);
    const [fetchingLogFiles, setFetchingLogFiles] = useState<boolean>(false);
    const [currentStep, setCurrentStep] = useState(0);
    const [searchText, setSearchText] = useState('');
    const [filteredLogs, setFilteredLogs] = useState<PostgresLogEntry[]>([]);
    const [selectedDatabase, setSelectedDatabase] = useState<string | null>(null);
    const [selectedUser, setSelectedUser] = useState<string | null>(null);
    const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
    const [logFileStatsList, setLogFileStatsList] = useState<LogFile[]>([]);
    const [slowQueryThreshold, setSlowQueryThreshold] = useState<number>(100);
    const [stats, setStats] = useState<LogStats>({
        totalQueries: 0,
        avgExecutionTime: 0,
        slowestQuery: { query: '', time: 0, timestamp: '' },
        errorCount: 0,
        warningCount: 0,
        infoCount: 0,
        topUsers: [],
        topDatabases: [],
        topErrors: []
    });
    const [clusterData, setClusterData] = useState<any[]>([]);

    const location = useLocation();

    // Redux AI usage limit değerlerini component seviyesinde al
    const { dailyUsageCount, dailyLimit } = useSelector((state: any) => state.aiLimit);

    // Get clusterName from URL parameters
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const clusterFromUrl = params.get('clusterName');
        if (clusterFromUrl) {
            setSelectedCluster(clusterFromUrl);
        }
    }, [location]);

    // Fetch PostgreSQL clusters
    const fetchClusters = async () => {
        setFetchingClusters(true);
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/status/postgres`, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                }
            });

            if (response.data.status === "success" && Array.isArray(response.data.data)) {
                const fetchedClusters = response.data.data.map(
                    (clusterObject: any) => Object.keys(clusterObject)[0]
                );
                setClusters(fetchedClusters);
                setClusterData(response.data.data);
            } else {
                throw new Error("Unexpected API response format");
            }
        } catch (error) {
            console.error('Error fetching PostgreSQL clusters:', error);
            message.error('Failed to fetch clusters. Please try again.');
            setClusters([]);
            setClusterData([]);
        } finally {
            setFetchingClusters(false);
            setLoading(false);
        }
    };

    // Process nodes for a cluster
    const processClusterNodes = (clusterName: string) => {
        const cluster = clusterData.find(
            (cluster: any) => Object.keys(cluster)[0] === clusterName
        );

        if (!cluster) return;

        setFetchingNodes(true);
        setLoading(true);

        try {
            const nodeList = cluster[clusterName];
            const nodeInfoList: NodeInfo[] = nodeList.map((node: any) => ({
                Hostname: node.Hostname || node.nodename || '',
                NodeStatus: node.NodeStatus || 'UNKNOWN',
                Location: node.Location || 'Unknown',
                IP: node.IP || 'N/A',
                PostgresStatus: node.PGServiceStatus || 'UNKNOWN',
                Role: node.NodeStatus || 'UNKNOWN',
                Version: node.PGVersion || 'N/A',
                Replication: node.ReplicationStatus || node.ReplicationLagSec || 'N/A',
                FreeDisk: node.FreeDisk || 'N/A',
                FDPercent: node.FDPercent || 0,
                TotalDisk: node.TotalDisk || 'N/A'
            }));
            
            setNodes(nodeInfoList);
            setCurrentStep(1);

            if (nodeInfoList.length > 0) {
                message.success(`Found ${nodeInfoList.length} nodes in cluster ${clusterName}`);
            } else {
                message.warning('No nodes found in the selected cluster');
            }
        } catch (error) {
            console.error('Error processing nodes:', error);
            message.error('Failed to process nodes');
            setNodes([]);
        } finally {
            setFetchingNodes(false);
            setLoading(false);
        }

        setSelectedNode(null);
        setSelectedLogFile(null);
        setLogs([]);
    };

    // Handle cluster selection (both manual and from URL)
    const handleClusterChange = (clusterName: string) => {
        if (!clusterName) return;
        
        setSelectedCluster(clusterName);
        processClusterNodes(clusterName);
    };

    // Fetch clusters on component mount
    useEffect(() => {
        fetchClusters();
    }, []);

    // Handle URL cluster selection after clusters and data are loaded
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const clusterFromUrl = params.get('clusterName');
        
        if (clusterFromUrl && clusters.includes(clusterFromUrl) && clusterData.length > 0) {
            handleClusterChange(clusterFromUrl);
        }
    }, [clusters, clusterData]);

    // PostgreSQL log kolonları
    const columns: ColumnType<PostgresLogEntry>[] = [
        {
            title: 'Timestamp',
            dataIndex: 'timestamp',
            key: 'timestamp',
            width: '180px',
            sorter: (a: PostgresLogEntry, b: PostgresLogEntry) => 
                new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
            render: (text: string) => new Date(text).toLocaleString()
        },
        {
            title: 'Level',
            dataIndex: 'level',
            key: 'level',
            width: '100px',
            filters: [
                { text: 'LOG', value: 'LOG' },
                { text: 'ERROR', value: 'ERROR' },
                { text: 'WARNING', value: 'WARNING' },
                { text: 'INFO', value: 'INFO' },
                { text: 'FATAL', value: 'FATAL' },
                { text: 'PANIC', value: 'PANIC' }
            ],
            onFilter: (value: boolean | Key, record: PostgresLogEntry) => record.level === value,
            render: (text: string) => {
                const color = text === 'ERROR' || text === 'FATAL' || text === 'PANIC' ? 'red' : 
                             text === 'WARNING' ? 'orange' : 
                             text === 'LOG' ? 'green' : 'blue';
                return <Tag color={color}>{text}</Tag>;
            }
        },
        {
            title: 'Process ID',
            dataIndex: 'process_id',
            key: 'process_id',
            width: '100px'
        },
        {
            title: 'Database',
            dataIndex: 'database',
            key: 'database',
            width: '150px',
            filters: [],
            onFilter: (value: boolean | Key, record: PostgresLogEntry) => record.database === value,
            ellipsis: true
        },
        {
            title: 'User',
            dataIndex: 'user',
            key: 'user',
            width: '150px',
            filters: [],
            onFilter: (value: boolean | Key, record: PostgresLogEntry) => record.user === value,
            ellipsis: true
        },
        {
            title: 'Duration',
            dataIndex: 'duration',
            key: 'duration',
            width: '120px',
            sorter: (a: PostgresLogEntry, b: PostgresLogEntry) => ((a.duration || 0) / 1000) - ((b.duration || 0) / 1000),
            render: (duration: number) => duration ? `${(duration / 1000).toFixed(3)} ms` : '-'
        },
        {
            title: 'Message',
            dataIndex: 'message',
            key: 'message',
            width: '25%',
            render: (text: string, record: PostgresLogEntry) => (
                <Tooltip title={
                    <div>
                        <p>{text}</p>
                        {record.error_detail && <p style={{ color: '#ff4d4f' }}>Detail: {record.error_detail}</p>}
                        {record.hint && <p style={{ color: '#1890ff' }}>Hint: {record.hint}</p>}
                        {record.sql_state && <p>SQL State: {record.sql_state}</p>}
                    </div>
                }>
                    <span>{text.length > 100 ? `${text.substring(0, 100)}...` : text}</span>
                </Tooltip>
            )
        },
        {
            title: 'Query',
            dataIndex: 'statement',
            key: 'statement',
            width: '25%',
            render: (text: string, record: PostgresLogEntry) => {
                if (!text) return '-';
                
                if (text.length <= 100) {
                    return (
                        <Tooltip title="Click to view full query">
                            <span 
                                style={{ 
                                    cursor: 'pointer',
                                    color: '#1890ff',
                                    textDecoration: 'underline'
                                }}
                                onClick={() => showQueryModal(text, record)}
                            >
                                {text}
                            </span>
                        </Tooltip>
                    );
                }
                
                return (
                    <div>
                        <span style={{ color: '#666', marginRight: '8px' }}>
                            {`${text.substring(0, 50)}...`}
                        </span>
                        <Button 
                            type="link" 
                            onClick={() => showQueryModal(text, record)}
                            style={{ padding: '0px' }}
                        >
                            Show Full Query
                        </Button>
                    </div>
                );
            }
        }
    ];

    // Explain modal states and functions
    const [explainModalVisible, setExplainModalVisible] = useState(false);
    const [explainLoading, setExplainLoading] = useState(false);
    const [explainResults, setExplainResults] = useState('');
    const [currentQueryDetails, setCurrentQueryDetails] = useState<{
        query: string;
        database: string;
        agentId: string;
    } | null>(null);
    
    // Visualization states
    const [planVisualization, setPlanVisualization] = useState<any[]>([]);
    const [queryTimingData, setQueryTimingData] = useState<any[]>([]);

    // Function to fetch explain analyze results for PostgreSQL
    const fetchExplainAnalyze = async (queryDetails?: { query: string; database: string; agentId: string }) => {
        const details = queryDetails || currentQueryDetails;
        
        if (!details) {
            message.error('Missing query details for explain');
            return;
        }

        setExplainLoading(true);
        
        try {
            const { query, database, agentId } = details;
            const token = localStorage.getItem('token');
            // Ensure agent ID has the correct format

            const formattedAgentId = agentId.startsWith('agent_') ? agentId : `agent_${agentId}`;

            const response = await axios.post(
                `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/agents/${formattedAgentId}/explain`,
                {
                    database,
                    query
                },
                { 
                    withCredentials: true,
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    }
                }
            );
            
            // Check if response has data in any format
            if (response.data) {
                // Try different possible response formats
                let explainData = null;
                
                // Case 1: Standard format where data is in response.data.data
                if (response.data.data) {
                    explainData = response.data.data;
                }
                // Case 2: Direct response format where data is at the root
                else if (response.data.plan || response.data.query) {
                    explainData = response.data;
                }
                // Case 3: Some other format we need to guess
                else {
                    // Try to find any property that could contain the plan
                    const candidates = ['result', 'explain', 'output', 'plan', 'explain_plan'];
                    for (const candidate of candidates) {
                        if (response.data[candidate]) {
                            explainData = response.data[candidate];
                            break;
                        }
                    }
                    
                    // If still not found, use the whole response as the data
                    if (!explainData) {
                        explainData = response.data;
                    }
                }
                
                if (explainData) {
                    // Format the results
                    let formattedResults = '';
                    let planObject = null;
                    
                    // Case 1: Response has a plan property that's a JSON string
                    if (typeof explainData.plan === 'string' && explainData.plan.startsWith('{')) {
                        try {
                            // Parse the plan JSON string
                            const planData = JSON.parse(explainData.plan);
                            planObject = planData;
                            formattedResults = formatExplainPlan(explainData, planData);
                        } catch (parseError) {
                            // Just use the raw plan string if JSON parsing fails
                            formattedResults = explainData.plan || JSON.stringify(explainData, null, 2);
                        }
                    }
                    // Case 2: Plan is already an object
                    else if (typeof explainData.plan === 'object' && explainData.plan !== null) {
                        planObject = explainData.plan;
                        formattedResults = formatExplainPlan(explainData, explainData.plan);
                    }
                    // Case 3: Just use the entire data object
                    else {
                        formattedResults = `Query: ${explainData.query || 'Unknown'}\n`;
                        
                        if (explainData.database) {
                            formattedResults += `Database: ${explainData.database}\n`;
                        }
                        
                        if (explainData.status) {
                            formattedResults += `Status: ${explainData.status}\n\n`;
                        }
                        
                        // Add the rest of the data as JSON
                        formattedResults += JSON.stringify(explainData, null, 2);
                    }
                    
                    setExplainResults(formattedResults);
                    
                    // Also store the original plan object for visualization
                    if (planObject) {
                        parseQueryPlanForVisualization(planObject, explainData);
                    }
                    
                    // Close any existing modals and show explain results
                    Modal.destroyAll();
                    setExplainModalVisible(true);
                } else {
                    throw new Error('Could not extract explain results from the response');
                }
            } else {
                throw new Error('Empty response from explain API');
            }
        } catch (error: any) {
            let errorMessage = 'Failed to get query execution plan';
            
            if (axios.isAxiosError(error) && error.response) {
                errorMessage = `API Error: ${error.response.status} - ${error.response.data?.error || error.response.statusText}`;
            } else if (error.message) {
                errorMessage = `Error: ${error.message}`;
            }
            
            message.error(errorMessage);
        } finally {
            setExplainLoading(false);
        }
    };

    // Helper function to format explain plan
    const formatExplainPlan = (explainData: any, planData: any) => {
        let formattedPlan = '';
        
        // Add summary information
        formattedPlan += `Query: ${explainData.query || 'Unknown'}\n`;
        
        if (explainData.database) {
            formattedPlan += `Database: ${explainData.database}\n`;
        }
        
        if (explainData.status) {
            formattedPlan += `Status: ${explainData.status}\n`;
        }
        
        if (planData.duration_ms) {
            formattedPlan += `Execution Time: ${planData.duration_ms}ms\n`;
        }
        
        formattedPlan += '\n--- EXPLAIN ANALYZE ---\n\n';
        
        // Check if we have QUERY PLAN_ keys in the object
        const planEntries = Object.keys(planData)
            .filter(key => key.startsWith('QUERY PLAN_'))
            .sort((a, b) => {
                const numA = parseInt(a.split('_')[2]);
                const numB = parseInt(b.split('_')[2]);
                return numA - numB;
            });
        
        if (planEntries.length > 0) {
            // Add each line of the explain plan
            for (const key of planEntries) {
                formattedPlan += `${planData[key]}\n`;
            }
        } else {
            // If no QUERY PLAN_ keys, just add the rest as JSON
            formattedPlan += JSON.stringify(planData, null, 2);
        }
        
        return formattedPlan;
    };

    // Parse query plan data for visualization
    const parseQueryPlanForVisualization = (planData: any, queryData: any) => {
        try {
            // Extract plan nodes for visualization
            const nodes: PlanNode[] = [];
            const timings: QueryTiming[] = [];
            
            // Extract data from QUERY PLAN entries
            const planEntries = Object.keys(planData)
                .filter(key => key.startsWith('QUERY PLAN_'))
                .sort((a, b) => {
                    const numA = parseInt(a.split('_')[2]);
                    const numB = parseInt(b.split('_')[2]);
                    return numA - numB;
                });
            
            if (planEntries.length > 0) {
                // Process main plan nodes (operations) with improved parsing
                let currentNodeId = 0;
                const indentationStack: { level: number; nodeId: number }[] = [];
                
                for (const key of planEntries) {
                    const line = planData[key];
                    if (!line || typeof line !== 'string') continue;
                    
                    // Skip empty lines and dividers
                    if (line.trim() === '' || line.includes('---') || line.includes('===') || 
                        line.includes('Planning Time:') || line.includes('Execution Time:')) {
                        continue;
                    }
                    
                    // Calculate indentation level (usually 2 spaces per level)
                    const indentation = line.length - line.trimStart().length;
                    const trimmedLine = line.trim();
                    
                    // Parse execution time and other metrics
                    const timeMatch = trimmedLine.match(/actual time=([\d.]+)\.\.([\d.]+)/);
                    const costMatch = trimmedLine.match(/cost=([\d.]+)\.\.([\d.]+)/);
                    const rowsMatch = trimmedLine.match(/rows=(\d+)/);
                    const plannedRowsMatch = trimmedLine.match(/plan_rows=(\d+)/);
                    
                    // Extract table/object name
                    const objectMatch = trimmedLine.match(/on (\w+)/);
                    const indexMatch = trimmedLine.match(/using (\w+)/);
                    
                    // Check if this is a new operation node (starts with -> or is an operation)
                    const operationMatch = trimmedLine.match(/^(->)?\s*(Seq Scan|Index Scan|Index Only Scan|Bitmap Heap Scan|Bitmap Index Scan|Sort|Hash|Nested Loop|Hash Join|Merge Join|Aggregate|Group|GroupAggregate|Limit|Result|Unique|Subquery Scan|Function Scan|Values Scan|CTE Scan|WorkTable Scan|Foreign Scan|Custom Scan|Gather|Gather Merge|Parallel|BitmapAnd|BitmapOr|WindowAgg|SetOp|Recursive Union|Append|Merge Append|Material|Memoize)/);
                    
                    if (operationMatch) {
                        // Find parent based on indentation
                        let parentId = -1;
                        
                        // Remove all entries with equal or greater indentation
                        while (indentationStack.length > 0 && indentationStack[indentationStack.length - 1].level >= indentation) {
                            indentationStack.pop();
                        }
                        
                        // Parent is the last node in the stack
                        if (indentationStack.length > 0) {
                            parentId = indentationStack[indentationStack.length - 1].nodeId;
                        }
                        
                        // Create new node
                        const node: PlanNode = {
                            id: currentNodeId,
                            parentId: parentId,
                            operation: trimmedLine.replace(/^->/, '').trim(),
                            cost: costMatch ? { start: parseFloat(costMatch[1]), end: parseFloat(costMatch[2]) } : undefined,
                            time: timeMatch ? { start: parseFloat(timeMatch[1]), end: parseFloat(timeMatch[2]) } : undefined,
                            rows: rowsMatch ? parseInt(rowsMatch[1]) : undefined,
                            plannedRows: plannedRowsMatch ? parseInt(plannedRowsMatch[1]) : undefined,
                            objectName: objectMatch ? objectMatch[1] : undefined,
                            indexName: indexMatch ? indexMatch[1] : undefined
                        };
                        
                        nodes.push(node);
                        
                        // Add to indentation stack
                        indentationStack.push({ level: indentation, nodeId: currentNodeId });
                        currentNodeId++;
                    }
                }
                
                // Extract timing information for summary
                let totalTime = 0;
                
                // Try to find total execution time from the plan
                const totalTimeMatch = planEntries.map(key => planData[key]).join('\n').match(/Execution Time: ([\d.]+) ms/);
                if (totalTimeMatch) {
                    totalTime = parseFloat(totalTimeMatch[1]);
                } else {
                    // If no total time found, calculate from nodes
                    totalTime = nodes.reduce((sum, node) => {
                        return sum + (node.time?.end || 0);
                    }, 0);
                }
                
                if (totalTime > 0) {
                    // Create timing breakdown - only include nodes with significant time
                    nodes.forEach((node, index) => {
                        if (node.time && node.time.end > 0.1) { // Only include operations > 0.1ms
                            const operationName = node.operation.split('(')[0].trim();
                            const percentage = (node.time.end / totalTime) * 100;
                            
                            // Only include if percentage is significant (>1%) or time is >10ms
                            if (percentage > 1 || node.time.end > 10) {
                                timings.push({
                                    name: operationName,
                                    time: node.time.end,
                                    percentage: percentage,
                                    calls: node.loops || 1
                                });
                            }
                        }
                    });
                    
                    // Sort by time descending
                    timings.sort((a, b) => b.time - a.time);
                }
            }
            
            // Update state with visualization data
            setPlanVisualization(nodes);
            setQueryTimingData(timings);
            
        } catch (error) {
            console.error('Error parsing plan for visualization:', error);
            setPlanVisualization([]);
            setQueryTimingData([]);
        }
    };

    // Helper function to determine color based on execution time
    const getTimingColor = (time: number): string => {
        if (time > 1000) return 'red';
        if (time > 500) return 'orange';
        if (time > 100) return 'gold';
        if (time > 10) return 'green';
        return 'blue';
    };

    // Function to render a single plan node
    const renderPlanNode = (node: PlanNode, allNodes: PlanNode[], nodeIndex: number): React.ReactNode => {
        // Find children of this node
        const children = allNodes.filter(n => n.parentId === node.id);
        
        // Determine node color based on time if available
        const nodeColor = node.time 
            ? getTimingColor(node.time.end) 
            : '#1890ff';
        
        // Calculate total cost - using end cost directly as total cost
        const totalCost = node.cost ? node.cost.end : 0;
        
        // Check if cost is high (relative to other nodes)
        const isHighCost = node.cost && (totalCost > 100 || 
            totalCost > (allNodes.reduce((sum, n) => sum + (n.cost?.end || 0), 0) / allNodes.length) * 3);
        
        // Check if rows match planned rows - improved check for 0 rows case
        const hasRowMismatch = node.rows !== undefined && node.plannedRows !== undefined && 
            (node.rows === 0 || node.plannedRows === 0 || 
             Math.abs(node.rows - node.plannedRows) / Math.max(node.plannedRows, 1) * 100 > 10);
             
        // Calculate severity of row estimation issue
        const getRowMismatchSeverity = () => {
            if (!node.rows || node.plannedRows === undefined) return 'none';
            
            if (node.rows === 0 && node.plannedRows > 0) return 'severe'; // No rows when expected
            
            const ratio = node.rows / node.plannedRows;
            if (ratio > 10 || ratio < 0.1) return 'severe'; // 10x difference
            if (ratio > 3 || ratio < 0.3) return 'moderate'; // 3x difference
            return 'low';
        };
        
        const rowMismatchSeverity = getRowMismatchSeverity();
        
        return (
            <li key={node.id} style={{ margin: '8px 0' }}>
                <Card
                    size="small"
                    title={
                                            <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        fontSize: '12px',
                        flexWrap: 'wrap',
                        gap: '4px'
                    }}>
                        <span style={{ 
                            fontWeight: 'bold',
                            color: '#1890ff',
                            minWidth: '0',
                            flex: '1 1 auto'
                        }}>
                            {node.operation.split('(')[0].trim()}
                            {node.objectName && <span style={{ fontWeight: 'normal', color: '#666' }}> → {node.objectName}</span>}
                            {node.indexName && <span style={{ fontWeight: 'normal', color: '#52c41a' }}> [{node.indexName}]</span>}
                        </span>
                        <div style={{ display: 'flex', gap: '2px', alignItems: 'center', flexShrink: 0 }}>
                            {node.time && (
                                <Tag color={nodeColor} style={{ fontSize: '10px', padding: '0 4px', margin: 0 }}>
                                    {node.time.end.toFixed(1)}ms
                                </Tag>
                            )}
                            {isHighCost && (
                                <Tag color="orange" style={{ fontSize: '10px', padding: '0 4px', margin: 0 }}>
                                    High Cost
                                </Tag>
                            )}
                            {hasRowMismatch && (
                                <Tag color={rowMismatchSeverity === 'severe' ? 'red' : 
                                          rowMismatchSeverity === 'moderate' ? 'orange' : 'gold'} 
                                     style={{ fontSize: '10px', padding: '0 4px', margin: 0 }}>
                                    Rows ⚠
                                </Tag>
                            )}
                        </div>
                    </div>
                    }
                    style={{ 
                        maxWidth: '100%',
                        borderLeft: `4px solid ${nodeColor}`,
                        boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                        marginBottom: '8px'
                    }}
                    headStyle={{ padding: '0 8px', minHeight: '28px' }}
                    bodyStyle={{ padding: '6px 8px' }}
                >
                    {(node.cost || node.rows !== undefined || (node.loops && node.loops > 1) || 
                      (node.workers && node.workers > 0) || (node.buffers && (node.buffers.shared?.hit || node.buffers.shared?.read))) && (
                        <div style={{ 
                            fontSize: '10px', 
                            color: '#666',
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '8px',
                            marginTop: '4px'
                        }}>
                            {node.cost && (
                                <span>Cost: {node.cost.end.toFixed(0)}</span>
                            )}
                            {node.rows !== undefined && (
                                <span>
                                    Rows: {node.rows}
                                    {node.plannedRows !== undefined && node.plannedRows !== node.rows && (
                                        <span style={{ color: '#ff4d4f' }}> (est: {node.plannedRows})</span>
                                    )}
                                </span>
                            )}
                            {node.loops && node.loops > 1 && (
                                <span>Loops: {node.loops}</span>
                            )}
                            {node.workers && node.workers > 0 && (
                                <span>Workers: {node.workers}</span>
                            )}
                            {node.buffers && (node.buffers.shared?.hit || node.buffers.shared?.read) && (
                                <span>
                                    Buffers:
                                    {node.buffers.shared?.hit && ` hit=${node.buffers.shared.hit}`}
                                    {node.buffers.shared?.read && ` read=${node.buffers.shared.read}`}
                                </span>
                            )}
                        </div>
                    )}
                    
                    {children.length > 0 && (
                        <ul style={{ 
                            listStyleType: 'none', 
                            padding: '8px 0 0 16px',
                            margin: 0,
                            borderLeft: '1px dashed #d9d9d9'
                        }}>
                            {children.map((child, index) => renderPlanNode(child, allNodes, index))}
                        </ul>
                    )}
                </Card>
            </li>
        );
    };

    // Function to render the plan tree recursively
    const renderPlanTree = (nodes: PlanNode[]): React.ReactNode => {
        // Find root nodes (parentId = -1)
        const rootNodes = nodes.filter(node => node.parentId === -1);
        
        if (rootNodes.length === 0) return null;
        
        return (
            <ul style={{ 
                listStyleType: 'none', 
                padding: 0,
                maxWidth: '100%',
                margin: 0
            }}>
                {rootNodes.map((node, index) => renderPlanNode(node, nodes, index))}
            </ul>
        );
    };

    // Function to render query statistics summary (like in the image)
    const renderQueryStatistics = () => {
        if (planVisualization.length === 0) return null;

        // Calculate statistics
        const totalTime = planVisualization.reduce((sum, node) => sum + (node.time?.end || 0), 0);
        const planningTime = 0.67; // This would come from the explain output
        
        // Find slowest node
        const slowestNode = planVisualization.reduce((slowest, node) => {
            if (!node.time) return slowest;
            if (!slowest.time || node.time.end > slowest.time.end) return node;
            return slowest;
        }, planVisualization[0]);

        // Find largest node (by rows)
        const largestNode = planVisualization.reduce((largest, node) => {
            if (!node.rows) return largest;
            if (!largest.rows || node.rows > largest.rows) return node;
            return largest;
        }, planVisualization[0]);

        // Find costliest node
        const costliestNode = planVisualization.reduce((costliest, node) => {
            if (!node.cost) return costliest;
            if (!costliest.cost || node.cost.end > costliest.cost.end) return node;
            return costliest;
        }, planVisualization[0]);

        return (
            <div style={{
                display: 'flex',
                justifyContent: 'space-around',
                padding: '16px',
                backgroundColor: '#f8f9fa',
                borderRadius: '8px',
                border: '1px solid #e9ecef',
                flexWrap: 'wrap',
                gap: '16px'
            }}>
                <div style={{ textAlign: 'center', minWidth: '120px' }}>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1890ff' }}>
                        {totalTime.toFixed(2)}
                    </div>
                    <div style={{ fontSize: '12px', color: '#666' }}>execution time (ms)</div>
                </div>
                
                <div style={{ textAlign: 'center', minWidth: '120px' }}>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#52c41a' }}>
                        {planningTime.toFixed(2)}
                    </div>
                    <div style={{ fontSize: '12px', color: '#666' }}>planning time (ms)</div>
                </div>
                
                <div style={{ textAlign: 'center', minWidth: '120px' }}>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#fa8c16' }}>
                        {slowestNode.time?.end.toFixed(2) || '0'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#666' }}>slowest node (ms)</div>
                </div>
                
                <div style={{ textAlign: 'center', minWidth: '120px' }}>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#722ed1' }}>
                        {largestNode.rows?.toLocaleString() || '0'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#666' }}>largest node (rows)</div>
                </div>
                
                <div style={{ textAlign: 'center', minWidth: '120px' }}>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#ff4d4f' }}>
                        {costliestNode.cost?.end.toFixed(0) || '0'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#666' }}>costliest node</div>
                </div>
            </div>
        );
    };

    // Function to render modern plan tree (like in the image)
    const renderModernPlanTree = (nodes: PlanNode[]): React.ReactNode => {
        // Find root nodes (parentId = -1)
        const rootNodes = nodes.filter(node => node.parentId === -1);
        
        if (rootNodes.length === 0) return null;

        // Calculate total time for percentages
        const totalTime = nodes.reduce((sum, node) => sum + (node.time?.end || 0), 0);
        
        // Find special nodes for badges
        const slowestNode = nodes.reduce((slowest, node) => {
            if (!node.time) return slowest;
            if (!slowest.time || node.time.end > slowest.time.end) return node;
            return slowest;
        }, nodes[0]);

        const largestNode = nodes.reduce((largest, node) => {
            if (!node.rows) return largest;
            if (!largest.rows || node.rows > largest.rows) return node;
            return largest;
        }, nodes[0]);

        const costliestNode = nodes.reduce((costliest, node) => {
            if (!node.cost) return costliest;
            if (!costliest.cost || node.cost.end > costliest.cost.end) return node;
            return costliest;
        }, nodes[0]);

                 const renderModernPlanNode = (node: PlanNode, allNodes: PlanNode[], level: number = 0): React.ReactNode => {
             const children = allNodes.filter(n => n.parentId === node.id);
             const percentage = totalTime > 0 && node.time ? (node.time.end / totalTime) * 100 : 0;
             
             // Determine special badges
             const badges = [];
             if (node.id === slowestNode.id && node.time && node.time.end > 10) {
                 badges.push({ text: 'slowest', color: '#ff4d4f' });
             }
             if (node.id === largestNode.id && node.rows && node.rows > 100) {
                 badges.push({ text: 'largest', color: '#722ed1' });
             }
             if (node.id === costliestNode.id && node.cost && node.cost.end > 100) {
                 badges.push({ text: 'costliest', color: '#fa8c16' });
             }

             // Compact layout for deeper levels
             const isDeepLevel = level > 2;
             const cardWidth = isDeepLevel ? '160px' : '180px';
             const fontSize = isDeepLevel ? '12px' : '14px';

             // Calculate total width needed for this subtree
             const getSubtreeWidth = (n: PlanNode): number => {
                 const nodeChildren = allNodes.filter(child => child.parentId === n.id);
                 if (nodeChildren.length === 0) return 1;
                 if (nodeChildren.length === 1) return getSubtreeWidth(nodeChildren[0]);
                 return nodeChildren.reduce((sum, child) => sum + getSubtreeWidth(child), 0);
             };

             const subtreeWidth = getSubtreeWidth(node);
             const shouldUseCompactLayout = subtreeWidth > 3 || level > 1;

             return (
                 <div key={node.id} style={{ 
                     display: 'flex', 
                     flexDirection: 'column',
                     alignItems: 'center',
                     margin: shouldUseCompactLayout ? '3px' : '6px',
                     position: 'relative'
                 }}>
                     {/* Node Card */}
                     <div style={{
                         border: '1px solid #d9d9d9',
                         borderRadius: '6px',
                         padding: shouldUseCompactLayout ? '6px 8px' : '8px 10px',
                         backgroundColor: 'white',
                         minWidth: shouldUseCompactLayout ? '140px' : '160px',
                         maxWidth: shouldUseCompactLayout ? '140px' : '180px',
                         textAlign: 'center',
                         boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                         position: 'relative',
                         fontSize: shouldUseCompactLayout ? '11px' : '12px'
                     }}>
                         {/* Operation Name */}
                         <div style={{ 
                             fontWeight: 'bold', 
                             fontSize: shouldUseCompactLayout ? '11px' : '13px',
                             color: '#1890ff',
                             marginBottom: '2px',
                             lineHeight: '1.1',
                             overflow: 'hidden',
                             textOverflow: 'ellipsis',
                             whiteSpace: 'nowrap'
                         }}>
                             {node.operation.split('(')[0].trim()}
                         </div>
                         
                         {/* Object/Table info */}
                         {node.objectName && (
                             <div style={{ 
                                 fontSize: shouldUseCompactLayout ? '9px' : '10px', 
                                 color: '#666',
                                 marginBottom: '3px',
                                 overflow: 'hidden',
                                 textOverflow: 'ellipsis',
                                 whiteSpace: 'nowrap'
                             }}>
                                 on {node.objectName}
                             </div>
                         )}

                         {/* Time and Percentage - More compact */}
                         <div style={{ 
                             fontSize: shouldUseCompactLayout ? '10px' : '12px', 
                             fontWeight: 'bold',
                             color: percentage > 20 ? '#ff4d4f' : percentage > 10 ? '#fa8c16' : '#52c41a',
                             lineHeight: '1.1'
                         }}>
                             {node.time ? `${node.time.end.toFixed(0)}ms` : '<1ms'}
                             {percentage > 1 && (
                                 <span style={{ 
                                     fontSize: shouldUseCompactLayout ? '8px' : '9px', 
                                     fontWeight: 'normal',
                                     color: '#666',
                                     marginLeft: '2px'
                                 }}>
                                     ({percentage.toFixed(0)}%)
                                 </span>
                             )}
                         </div>

                         {/* Special Badges - Smaller */}
                         {badges.map((badge, index) => (
                             <div key={index} style={{
                                 position: 'absolute',
                                 top: '-5px',
                                 right: index * 35 - 5,
                                 backgroundColor: badge.color,
                                 color: 'white',
                                 padding: '1px 3px',
                                 borderRadius: '2px',
                                 fontSize: '7px',
                                 fontWeight: 'bold',
                                 zIndex: 1
                             }}>
                                 {badge.text}
                             </div>
                         ))}
                     </div>

                     {/* Connection Lines and Children - Improved Layout */}
                     {children.length > 0 && (
                         <div style={{ 
                             display: 'flex', 
                             flexDirection: 'column',
                             alignItems: 'center',
                             marginTop: '8px',
                             width: '100%'
                         }}>
                             {/* Vertical line down */}
                             <div style={{
                                 width: '1px',
                                 height: '12px',
                                 backgroundColor: '#d9d9d9'
                             }} />
                             
                             {/* Smart Children Layout */}
                             {children.length === 1 ? (
                                 // Single child - keep vertical but more compact
                                 <div style={{ marginTop: '0px' }}>
                                     {renderModernPlanNode(children[0], allNodes, level + 1)}
                                 </div>
                             ) : (
                                 // Multiple children - horizontal layout optimized
                                 <div style={{ 
                                     display: 'flex',
                                     flexDirection: 'column',
                                     alignItems: 'center',
                                     width: '100%'
                                 }}>
                                     {/* Horizontal connector line */}
                                     <div style={{
                                         width: `${Math.min(children.length * 150, 600)}px`,
                                         height: '1px',
                                         backgroundColor: '#d9d9d9',
                                         position: 'relative',
                                         marginBottom: '12px'
                                     }}>
                                         {/* Vertical lines to each child */}
                                         {children.map((_, index) => (
                                             <div key={index} style={{
                                                 position: 'absolute',
                                                 left: `${(index + 0.5) * (100 / children.length)}%`,
                                                 top: '0',
                                                 width: '1px',
                                                 height: '12px',
                                                 backgroundColor: '#d9d9d9',
                                                 transform: 'translateX(-0.5px)'
                                             }} />
                                         ))}
                                     </div>
                                     
                                     {/* Children nodes - Better spacing */}
                                     <div style={{ 
                                         display: 'flex', 
                                         justifyContent: 'center',
                                         alignItems: 'flex-start',
                                         gap: children.length > 4 ? '4px' : '8px',
                                         flexWrap: children.length > 6 ? 'wrap' : 'nowrap',
                                         maxWidth: '100%'
                                     }}>
                                         {children.map((child) => renderModernPlanNode(child, allNodes, level + 1))}
                                     </div>
                                 </div>
                             )}
                         </div>
                     )}
                 </div>
             );
         };

                 return (
             <div style={{ 
                 width: '100%',
                 overflowX: 'auto',
                 overflowY: 'visible',
                 padding: '16px 8px',
                 minHeight: '200px'
             }}>
                 <div style={{
                     display: 'flex',
                     gap: rootNodes.length > 1 ? '16px' : '0',
                     justifyContent: 'center',
                     alignItems: 'flex-start',
                     minWidth: 'max-content',
                     width: '100%',
                     flexWrap: rootNodes.length > 3 ? 'wrap' : 'nowrap'
                 }}>
                     {rootNodes.map((node) => renderModernPlanNode(node, nodes, 0))}
                 </div>
             </div>
         );
    };

    // Function to analyze performance and provide DBA insights
    const renderPerformanceAnalysis = () => {
        if (planVisualization.length === 0) {
            return (
                <div style={{ 
                    padding: '16px', 
                    backgroundColor: '#f9f9f9', 
                    borderRadius: '8px',
                    textAlign: 'center',
                    color: '#666'
                }}>
                    No performance data available for analysis
                </div>
            );
        }

        const issues: Array<{
            type: 'error' | 'warning';
            title: string;
            description: string;
            impact: string;
            node: string;
        }> = [];
        const recommendations: Array<{
            type: string;
            title: string;
            description: string;
            sql: string | null;
        }> = [];
        
        // Analyze nodes for common performance issues
        planVisualization.forEach(node => {
            // 1. Sequential Scans on large tables
            if (node.operation.includes('Seq Scan') && node.rows && node.rows > 1000) {
                issues.push({
                    type: 'warning',
                    title: 'Sequential Scan Detected',
                    description: `Sequential scan on ${node.objectName || 'table'} with ${node.rows} rows`,
                    impact: 'high',
                    node: node.operation
                });
                recommendations.push({
                    type: 'index',
                    title: 'Consider Adding Index',
                    description: `Create an index on the filtered columns for ${node.objectName || 'this table'}`,
                    sql: node.objectName ? `CREATE INDEX idx_${node.objectName}_cols ON ${node.objectName} (column_name);` : null
                });
            }

            // 2. High cost operations
            if (node.cost && node.cost.end > 1000) {
                issues.push({
                    type: 'error',
                    title: 'High Cost Operation',
                    description: `${node.operation.split('(')[0]} has cost ${node.cost.end.toFixed(0)}`,
                    impact: 'high',
                    node: node.operation
                });
            }

            // 3. Row estimation issues
            if (node.rows !== undefined && node.plannedRows !== undefined) {
                const ratio = node.rows / Math.max(node.plannedRows, 1);
                if (ratio > 10 || ratio < 0.1) {
                    issues.push({
                        type: 'warning',
                        title: 'Row Estimation Issue',
                        description: `Estimated ${node.plannedRows} rows, actual ${node.rows} rows`,
                        impact: 'medium',
                        node: node.operation
                    });
                    recommendations.push({
                        type: 'statistics',
                        title: 'Update Table Statistics',
                        description: 'Run ANALYZE to update table statistics for better planning',
                        sql: node.objectName ? `ANALYZE ${node.objectName};` : 'ANALYZE table_name;'
                    });
                }
            }

            // 4. Nested loops with high iterations
            if (node.operation.includes('Nested Loop') && node.loops && node.loops > 100) {
                issues.push({
                    type: 'error',
                    title: 'Expensive Nested Loop',
                    description: `Nested loop with ${node.loops} iterations`,
                    impact: 'high',
                    node: node.operation
                });
                recommendations.push({
                    type: 'join',
                    title: 'Consider Hash Join',
                    description: 'Increase work_mem or add indexes to enable hash joins',
                    sql: 'SET work_mem = \'256MB\';'
                });
            }

            // 5. Slow operations (>100ms)
            if (node.time && node.time.end > 100) {
                issues.push({
                    type: 'warning',
                    title: 'Slow Operation',
                    description: `${node.operation.split('(')[0]} took ${node.time.end.toFixed(1)}ms`,
                    impact: 'medium',
                    node: node.operation
                });
            }
        });

        // General recommendations
        const totalTime = planVisualization.reduce((sum, node) => sum + (node.time?.end || 0), 0);
        if (totalTime > 1000) {
            recommendations.push({
                type: 'config',
                title: 'Consider Query Optimization',
                description: `Total execution time is ${totalTime.toFixed(1)}ms. Consider optimizing this query.`,
                sql: null
            });
        }

        return (
            <div>
                {/* Issues Section */}
                {issues.length > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                        <h4 style={{ color: '#ff4d4f', margin: '0 0 8px 0' }}>⚠️ Performance Issues ({issues.length})</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {issues.slice(0, 3).map((issue, index) => (
                                <div key={index} style={{
                                    padding: '8px 12px',
                                    backgroundColor: issue.type === 'error' ? '#fff2f0' : '#fff7e6',
                                    border: `1px solid ${issue.type === 'error' ? '#ffccc7' : '#ffd591'}`,
                                    borderRadius: '4px',
                                    fontSize: '12px'
                                }}>
                                    <div style={{ fontWeight: 'bold', color: issue.type === 'error' ? '#ff4d4f' : '#fa8c16' }}>
                                        {issue.title}
                                    </div>
                                    <div style={{ color: '#666', marginTop: '2px' }}>{issue.description}</div>
                                </div>
                            ))}
                            {issues.length > 3 && (
                                <div style={{ fontSize: '11px', color: '#999', textAlign: 'center' }}>
                                    ... and {issues.length - 3} more issues
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Recommendations Section */}
                {recommendations.length > 0 && (
                    <div>
                        <h4 style={{ color: '#52c41a', margin: '0 0 8px 0' }}>💡 Recommendations ({recommendations.length})</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {recommendations.slice(0, 3).map((rec, index) => (
                                <div key={index} style={{
                                    padding: '8px 12px',
                                    backgroundColor: '#f6ffed',
                                    border: '1px solid #b7eb8f',
                                    borderRadius: '4px',
                                    fontSize: '12px'
                                }}>
                                    <div style={{ fontWeight: 'bold', color: '#52c41a' }}>{rec.title}</div>
                                    <div style={{ color: '#666', marginTop: '2px' }}>{rec.description}</div>
                                    {rec.sql && (
                                        <div style={{
                                            marginTop: '4px',
                                            padding: '4px 6px',
                                            backgroundColor: '#f0f0f0',
                                            borderRadius: '2px',
                                            fontFamily: 'monospace',
                                            fontSize: '11px',
                                            color: '#1890ff'
                                        }}>
                                            {rec.sql}
                                        </div>
                                    )}
                                </div>
                            ))}
                            {recommendations.length > 3 && (
                                <div style={{ fontSize: '11px', color: '#999', textAlign: 'center' }}>
                                    ... and {recommendations.length - 3} more recommendations
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* If no issues found */}
                {issues.length === 0 && recommendations.length === 0 && (
                    <div style={{
                        padding: '16px',
                        backgroundColor: '#f6ffed',
                        border: '1px solid #b7eb8f',
                        borderRadius: '8px',
                        textAlign: 'center',
                        color: '#52c41a'
                    }}>
                        ✅ No major performance issues detected in this query plan
                    </div>
                )}
            </div>
        );
    };

    // AI Analysis function for PostgreSQL explain plans
    const handlePostgresExplainPlanAIAnalysis = async () => {
        if (!explainResults) {
            message.error('No execution plan available for analysis');
            return;
        }

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
            // Show loading modal
            analysisModal = Modal.info({
                title: 'AI Analysis in Progress',
                content: (
                    <div style={{ textAlign: 'center', padding: '20px' }}>
                        <Spin size="large" />
                        <p style={{ marginTop: '15px' }}>Analyzing PostgreSQL execution plan...</p>
                        <p style={{ fontSize: '12px', color: '#999' }}>This may take a few moments</p>
                    </div>
                ),
                maskClosable: false,
                okButtonProps: { style: { display: 'none' } },
                cancelButtonProps: { style: { display: 'none' } }
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
                        content: `Can you analyze this PostgreSQL EXPLAIN ANALYZE output? Please provide insights about the performance and any improvement recommendations. Organize your response with sections for identified issues and specific recommendations.

If there are performance problems, please suggest indexes that would improve the query using proper PostgreSQL CREATE INDEX syntax.

EXPLAIN ANALYZE output:
${explainResults}`
                    }],
                    temperature: 0,
                    top_p: 0.01,
                    max_tokens: 0,
                    max_completion_tokens: 0,
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
            const newCount = updatedState.aiLimit.dailyUsageCount;

            if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
                // Show analysis results
                Modal.info({
                    title: (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>PostgreSQL Execution Plan Analysis</span>
                            <Tag color="blue" style={{ marginLeft: '8px' }}>
                                AI Usage: {newCount}/{dailyLimit}
                            </Tag>
                        </div>
                    ),
                    content: (
                        <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                            <AIAnalysisRenderer 
                                content={data.choices[0].message.content}
                                dbType="postgres"
                            />
                        </div>
                    ),
                    width: 1000,
                    okText: 'Close'
                });
            } else {
                throw new Error('Invalid response format from AI service');
            }
        } catch (error: any) {
            console.error('AI analysis error:', error);
            
            // Make sure to destroy the loading modal in case of error
            if (analysisModal) {
                analysisModal.destroy();
            }
            
            let errorMessage = 'Failed to analyze execution plan with AI';
            
            if (error.message) {
                errorMessage = `AI Analysis Error: ${error.message}`;
            }
            
            message.error(errorMessage);
        }
    };

    // AI Analysis function for PostgreSQL queries
    const handleQueryAIAnalysis = async (query: string) => {
        if (!query || query.trim() === '') {
            message.error('No query available for analysis');
            return;
        }

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
            // Show loading modal
            analysisModal = Modal.info({
                title: 'AI Analysis in Progress',
                content: (
                    <div style={{ textAlign: 'center', padding: '20px' }}>
                        <Spin size="large" />
                        <p style={{ marginTop: '15px' }}>Analyzing PostgreSQL query...</p>
                        <p style={{ fontSize: '12px', color: '#999' }}>This may take a few moments</p>
                    </div>
                ),
                maskClosable: false,
                okButtonProps: { style: { display: 'none' } },
                cancelButtonProps: { style: { display: 'none' } }
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
                        content: `Can you analyze this PostgreSQL query? Please provide insights about the query structure, potential performance issues, and improvement recommendations. Organize your response with clear sections for identified issues and specific recommendations.

If there are performance problems, please suggest indexes that would improve the query using proper PostgreSQL CREATE INDEX syntax.

PostgreSQL Query:
${query}`
                    }],
                    temperature: 0,
                    top_p: 0.01,
                    max_tokens: 0,
                    max_completion_tokens: 0,
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
            const newCount = updatedState.aiLimit.dailyUsageCount;

            if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
                // Show analysis results using AIAnalysisRenderer
                Modal.info({
                    title: (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>PostgreSQL Query Analysis</span>
                            <Tag color="blue" style={{ marginLeft: '8px' }}>
                                AI Usage: {newCount}/{dailyLimit}
                            </Tag>
                        </div>
                    ),
                    content: (
                        <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                            <AIAnalysisRenderer 
                                content={data.choices[0].message.content}
                                dbType="postgres"
                            />
                        </div>
                    ),
                    width: 1000,
                    okText: 'Close'
                });
            } else {
                throw new Error('Invalid response format from AI service');
            }
        } catch (error: any) {
            console.error('AI analysis error:', error);
            
            // Make sure to destroy the loading modal in case of error
            if (analysisModal) {
                analysisModal.destroy();
            }
            
            let errorMessage = 'Failed to analyze query with AI';
            
            if (error.message) {
                errorMessage = `AI Analysis Error: ${error.message}`;
            }
            
            message.error(errorMessage);
        }
    };

    const showQueryModal = (query: string, record?: PostgresLogEntry) => {
        // Get the currently selected node
        const nodeId = selectedNode || '';
        
        // Get the database from the record if available, otherwise from selected database
        const dbName = record?.database || selectedDatabase || '';

        Modal.info({
            title: 'SQL Query Analysis',
            content: (
                <div>
                    <pre style={{ 
                        whiteSpace: 'pre-wrap', 
                        wordWrap: 'break-word',
                        backgroundColor: '#f5f5f5',
                        padding: '10px',
                        borderRadius: '4px',
                        marginBottom: '16px'
                    }}>
                        {query}
                    </pre>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: '16px',
                        padding: '12px',
                        backgroundColor: '#f9f0ff',
                        borderRadius: '4px'
                    }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            color: '#722ed1'
                        }}>
                            <RobotOutlined />
                            <span>AI Daily Usage: <strong>{dailyUsageCount}/{dailyLimit}</strong> Remaining: <strong>{dailyLimit - dailyUsageCount}</strong></span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <Button 
                                type="primary"
                                icon={<DatabaseOutlined />}
                                onClick={() => {
                                    if (!nodeId) {
                                        message.error('No node selected');
                                        return;
                                    }
                                    
                                    if (!dbName) {
                                        message.error('Database information not available for this query');
                                        return;
                                    }
                                    
                                    const queryDetails = {
                                        query,
                                        database: dbName,
                                        agentId: nodeId
                                    };
                                    
                                    // Set current query details for explain (for state consistency)
                                    setCurrentQueryDetails(queryDetails);
                                    
                                    // Show loading modal
                                    Modal.info({
                                        title: 'Getting Query Execution Plan',
                                        content: (
                                            <div style={{ textAlign: 'center', padding: '20px' }}>
                                                <Spin size="large" />
                                                <p style={{ marginTop: '15px' }}>Analyzing the query execution plan...</p>
                                                <p style={{ fontSize: '12px', color: '#999' }}>This may take a few moments</p>
                                            </div>
                                        ),
                                        maskClosable: false
                                    });
                                    
                                    // Call fetchExplainAnalyze with parameters directly (no need to wait for state update)
                                    fetchExplainAnalyze(queryDetails);
                                }}
                                style={{ backgroundColor: '#1890ff' }}
                            >
                                Explain Query
                            </Button>
                            <Button 
                                type="primary"
                                icon={<RobotOutlined />}
                                onClick={() => {
                                    handleQueryAIAnalysis(query);
                                }}
                                disabled={dailyUsageCount >= dailyLimit}
                            >
                                Analyze with AI
                            </Button>
                        </div>
                    </div>
                </div>
            ),
            width: '80%',
            okText: 'Close'
        });
    };

    // Node değişikliği handler'ı
    const handleNodeChange = async (nodename: string) => {
        setSelectedNode(nodename);
        setCurrentStep(2);
        setFetchingLogFiles(true);
        setLoading(true);

        try {
            const token = localStorage.getItem('token');
            const agentId = `agent_${nodename}`;
            
            const response = await axios.get(
                `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/agents/${agentId}/postgres/logs`,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    }
                }
            );

            if (response.data && response.data.status === 'success' && Array.isArray(response.data.log_files)) {
                const logFilesData = response.data.log_files;
                const logFilesInfo: LogFile[] = [];
                
                logFilesData.forEach((file: any) => {
                    logFilesInfo.push({
                        fileName: file.name,
                        fileSize: file.size_readable || `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
                        path: file.path,
                        lastModified: new Date(file.last_modified * 1000),
                        displayName: `${file.name} (${file.size_readable || (file.size / (1024 * 1024)).toFixed(2) + ' MB'})`
                    });
                });
                
                logFilesInfo.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
                
                const filePaths = logFilesInfo.map(info => info.path);
                setLogFiles(filePaths);
                setLogFileStatsList(logFilesInfo);
                setSelectedLogFile(null);
                
                message.success(`Found ${logFilesInfo.length} log files. Please select one to analyze.`);
            }
        } catch (error) {
            console.error('Error fetching log files:', error);
            message.error('Failed to fetch log files');
            setLogFiles([]);
            setLogFileStatsList([]);
        } finally {
            setFetchingLogFiles(false);
            setLoading(false);
        }
    };

    // Log dosyası seçimi handler'ı
    const handleLogFileChange = async (logFile: string) => {
        setSelectedLogFile(logFile);
        setCurrentStep(3);
        
        if (logs.length > 0) {
            setLogs([]);
            setFilteredLogs([]);
        }
        
        message.success('Log file selected. Set the slow query threshold and click "Analyze" to start analysis.');
    };

    // Log analizi fonksiyonu
    const analyzeLogs = async () => {
        if (!selectedNode || !selectedLogFile) {
            message.error('Please select a node and log file first');
            return;
        }
        
        setLoading(true);
        setLogs([]);
        
        try {
            const token = localStorage.getItem('token');
            const agentId = `agent_${selectedNode}`;
            
            // PostgreSQL log analiz endpoint'i
            const apiUrl = `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/agents/${agentId}/postgres/logs/analyze`;
            
            const response = await axios.post(
                apiUrl,
                {
                    log_file_path: selectedLogFile,
                    slow_query_threshold_ms: slowQueryThreshold
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    },
                    timeout: 60000 // 60 saniye timeout
                }
            );

            if (response.data && response.data.status === 'success') {
                const logEntries = response.data.log_entries || [];
                
                if (logEntries.length > 0) {
                    // API yanıtını PostgresLogEntry formatına çevir
                    const enhancedLogs = logEntries.map((entry: any, index: number) => ({
                        timestamp: entry.timestamp_readable || new Date(entry.timestamp * 1000).toISOString(),
                        level: entry.log_level || entry.error_severity || 'INFO',
                        database: entry.database || '',
                        user: entry.user_name || '',
                        duration: entry.duration_ms || 0,
                        message: entry.message || '',
                        statement: entry.internal_query || '',
                        connection_info: entry.connection_from || '',
                        error_detail: entry.detail || '',
                        session_id: entry.session_id || '',
                        process_id: entry.process_id || '',
                        hint: entry.hint || '',
                        sql_state: entry.sql_state_code || '',
                        transaction_id: entry.transaction_id || '',
                        virtual_transaction_id: entry.virtual_transaction_id || '',
                        uniqueId: index // Her log kaydına benzersiz bir ID ekleyin
                    }));

                    setLogs(enhancedLogs);
                    setFilteredLogs(enhancedLogs);
                    calculateStats(enhancedLogs);
                    
                    message.success(`Successfully analyzed ${enhancedLogs.length} log entries`);
                } else {
                    message.info('No log entries found in the selected file');
                }
            } else {
                throw new Error(response.data.error || 'Failed to analyze log file');
            }
        } catch (error) {
            console.error('Error analyzing logs:', error);
            if (axios.isAxiosError(error) && error.response) {
                message.error(`Error: ${error.response.status} - ${error.response.statusText}`);
                console.error('Error response data:', error.response.data);
            } else {
                message.error('An error occurred during log analysis');
            }
            setLogs([]);
            setFilteredLogs([]);
        } finally {
            setLoading(false);
        }
    };

    // İstatistikleri hesapla
    const calculateStats = (logEntries: PostgresLogEntry[]) => {
        const newStats: LogStats = {
            totalQueries: 0,
            avgExecutionTime: 0,
            slowestQuery: { query: '', time: 0, timestamp: '' },
            errorCount: 0,
            warningCount: 0,
            infoCount: 0,
            topUsers: [],
            topDatabases: [],
            topErrors: []
        };

        const userCounts: Record<string, number> = {};
        const dbCounts: Record<string, number> = {};
        const errorCounts: Record<string, number> = {};
        let totalDuration = 0;
        let queryCount = 0;

        logEntries.forEach(log => {
            // Log seviyesi sayıları
            if (log.level === 'ERROR') newStats.errorCount++;
            else if (log.level === 'WARNING') newStats.warningCount++;
            else if (log.level === 'LOG' || log.level === 'INFO') newStats.infoCount++;

            // Sorgu istatistikleri - sadece duration'ı olan gerçek query'ler
            if (log.duration) {
                queryCount++;
                totalDuration += log.duration;

                // Kullanıcı istatistikleri - sadece gerçek query'ler için
                if (log.user) {
                    userCounts[log.user] = (userCounts[log.user] || 0) + 1;
                }

                // Veritabanı istatistikleri - sadece gerçek query'ler için
                if (log.database) {
                    dbCounts[log.database] = (dbCounts[log.database] || 0) + 1;
                }

                if (log.duration > (newStats.slowestQuery.time || 0)) {
                    newStats.slowestQuery = {
                        query: log.statement || log.message,
                        time: log.duration,
                        timestamp: log.timestamp
                    };
                }
            }

            // Hata istatistikleri
            if (log.level === 'ERROR') {
                const errorMessage = log.error_detail || log.message;
                errorCounts[errorMessage] = (errorCounts[errorMessage] || 0) + 1;
            }
        });

        // İstatistikleri hesapla ve sırala
        newStats.totalQueries = queryCount;
        newStats.avgExecutionTime = queryCount > 0 ? (totalDuration / queryCount) / 1000 : 0;
        
        newStats.topUsers = Object.entries(userCounts)
            .map(([user, count]) => ({ user, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        newStats.topDatabases = Object.entries(dbCounts)
            .map(([database, count]) => ({ database, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        newStats.topErrors = Object.entries(errorCounts)
            .map(([error, count]) => ({ error, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        setStats(newStats);
    };

    // Reset fonksiyonlarını ekle
    const resetSteps = () => {
        setSelectedCluster(null);
        setSelectedNode(null);
        setLogFiles([]);
        setSelectedLogFile(null);
        setLogs([]);
        setCurrentStep(0);
        setLoading(false);
    };

    const resetLogFileStep = () => {
        setSelectedLogFile(null);
        setCurrentStep(2);
        setLoading(false);
    };

    const resetNodeStep = () => {
        setSelectedLogFile(null);
        setSelectedNode(null);
        setLogs([]);
        setCurrentStep(1);
        setLoading(false);
    };

    // Filtreleme fonksiyonu
    const filterLogs = useCallback(() => {
        if (!logs || logs.length === 0) {
            setFilteredLogs([]);
            return;
        }

        let results = [...logs];

        // Database filtresi
        if (selectedDatabase) {
            results = results.filter(log => log.database === selectedDatabase);
        }

        // User filtresi
        if (selectedUser) {
            results = results.filter(log => log.user === selectedUser);
        }

        // Log level filtresi
        if (selectedLevel) {
            results = results.filter(log => log.level === selectedLevel);
        }

        // Metin araması
        if (searchText) {
            const searchLower = searchText.toLowerCase();
            results = results.filter(log =>
                (log.message && log.message.toLowerCase().includes(searchLower)) ||
                (log.query && log.query.toLowerCase().includes(searchLower)) ||
                (log.statement && log.statement.toLowerCase().includes(searchLower)) ||
                (log.error_detail && log.error_detail.toLowerCase().includes(searchLower))
            );
        }

        setFilteredLogs(results);
    }, [logs, selectedDatabase, selectedUser, selectedLevel, searchText]);

    // Filtreleri sıfırlama fonksiyonu
    const resetFilters = () => {
        setSelectedDatabase(null);
        setSelectedUser(null);
        setSelectedLevel(null);
        setSearchText('');
    };

    // Filtreler değiştiğinde filtrelemeyi uygula
    useEffect(() => {
        filterLogs();
    }, [filterLogs]);

    return (
        <div style={{ padding: '20px' }}>
            {/* Steps */}
            <div style={{ marginBottom: '20px' }}>
                <Steps current={currentStep}>
                    <Step title="Select Cluster" description={selectedCluster || ''} />
                    <Step title="Select Node" description={selectedNode || ''} />
                    <Step 
                        title="Select Log File" 
                        description={selectedLogFile ? selectedLogFile.split('/').pop() : ''} 
                    />
                    <Step title="Analysis" />
                </Steps>
            </div>

            {/* Cluster Selection */}
            {currentStep === 0 && (
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
                                borderBottom: '1px solid #f0f0f0',
                                backgroundColor: '#fafafa',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}>
                                <DatabaseOutlined style={{ color: '#722ed1' }} />
                                <span style={{ fontWeight: 500, color: '#595959' }}>PostgreSQL Cluster</span>
                            </div>
                            <div style={{ padding: '12px' }}>
                                <Select
                                    style={{ width: '100%' }}
                                    showSearch
                                    placeholder={fetchingClusters ? "Loading clusters..." : "Select a PostgreSQL cluster"}
                                    onChange={handleClusterChange}
                                    loading={fetchingClusters}
                                    value={selectedCluster}
                                    listHeight={250}
                                    optionLabelProp="label"
                                >
                                    {clusters.map((cluster, index) => (
                                        <Option 
                                            key={`cluster-${cluster}-${index}`} 
                                            value={cluster} 
                                            label={cluster}
                                        >
                                            <div style={{ padding: '4px 0' }}>
                                                <span style={{ fontWeight: 500 }}>{cluster}</span>
                                            </div>
                                        </Option>
                                    ))}
                                </Select>
                            </div>
                        </div>
                    </Col>
                </Row>
            )}

            {/* Node Selection */}
            {currentStep === 1 && selectedCluster && (
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
                                borderBottom: '1px solid #f0f0f0',
                                backgroundColor: '#fafafa',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}>
                                <DatabaseOutlined style={{ color: '#722ed1' }} />
                                <span style={{ fontWeight: 500, color: '#595959' }}>Database Node</span>
                            </div>
                            <div style={{ padding: '12px' }}>
                                <Select
                                    style={{ width: '100%' }}
                                    showSearch
                                    placeholder={fetchingNodes ? "Loading nodes..." : "Select a node"}
                                    onChange={(value) => handleNodeChange(value)}
                                    loading={fetchingNodes}
                                    value={selectedNode}
                                    filterOption={(input, option) =>
                                        option?.children ? 
                                            String(option.children).toLowerCase().includes(input.toLowerCase()) : 
                                            false
                                    }
                                    notFoundContent={fetchingNodes ? <Spin size="small" /> : "No nodes found"}
                                    listHeight={350}
                                    optionLabelProp="label"
                                >
                                    {nodes.map((node: NodeInfo) => {
                                        // Role ve status rengini belirle
                                        const roleColor = node.Role === 'MASTER' ? '#52c41a' : 
                                                        node.Role === 'STANDBY' ? '#1890ff' : 
                                                        '#f5222d';
                                        
                                        // PostgreSQL servis durumu rengini belirle
                                        const statusColor = node.PostgresStatus === 'RUNNING' ? '#52c41a' : '#f5222d';
                                        
                                        return (
                                            <Option 
                                                key={node.Hostname} 
                                                value={node.Hostname} 
                                                label={node.Hostname}
                                            >
                                                <div style={{ padding: '4px 0' }}>
                                                    <div style={{ fontWeight: 500 }}>{node.Hostname}</div>
                                                    <div style={{ 
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        marginTop: '4px',
                                                        alignItems: 'center'
                                                    }}>
                                                        <span style={{ fontSize: '12px', color: '#999' }}>
                                                            {node.Location || 'Unknown'}
                                                        </span>
                                                        <span>
                                                            <Tag color={roleColor} style={{ marginRight: 4 }}>
                                                                {node.Role}
                                                            </Tag>
                                                            <Tag color={statusColor}>
                                                                {node.PostgresStatus}
                                                            </Tag>
                                                        </span>
                                                    </div>
                                                </div>
                                            </Option>
                                        );
                                    })}
                                </Select>
                            </div>
                        </div>
                    </Col>
                </Row>
            )}

            {/* Log File Selection */}
            {currentStep === 2 && selectedNode && (
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
                                borderBottom: '1px solid #f0f0f0',
                                backgroundColor: '#fafafa',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}>
                                <FileTextOutlined style={{ color: '#722ed1' }} />
                                <span style={{ fontWeight: 500, color: '#595959' }}>Log File</span>
                            </div>
                            <div style={{ padding: '12px' }}>
                                <Select
                                    showSearch
                                    placeholder={fetchingLogFiles ? "Loading log files..." : "Select a log file to analyze"}
                                    style={{ width: '100%' }}
                                    onChange={handleLogFileChange}
                                    filterOption={(input, option) =>
                                        option?.children
                                            ? String(option.children).toLowerCase().includes(input.toLowerCase())
                                            : false
                                    }
                                    loading={fetchingLogFiles}
                                    notFoundContent={fetchingLogFiles ? <Spin size="small" /> : "No log files found"}
                                    value={selectedLogFile}
                                    listHeight={350}
                                    optionLabelProp="label"
                                    popupMatchSelectWidth={false}
                                >
                                    {logFileStatsList.map((logFile, index) => {
                                        // Dosya adını daha kısa göster
                                        const fileName = logFile.fileName;
                                        // Tam dosya yolunu option value olarak sakla
                                        const filePath = logFile.path;
                                        
                                        return (
                                            <Option 
                                                key={`log-${index}`} 
                                                value={filePath}
                                                label={fileName}
                                            >
                                                <div style={{ padding: '4px 0', maxWidth: '500px' }}>
                                                    <div style={{ fontWeight: 500, wordBreak: 'break-all' }}>{fileName}</div>
                                                    <div style={{ 
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        fontSize: '12px',
                                                        color: '#999',
                                                        marginTop: '4px'
                                                    }}>
                                                        <span>{logFile.fileSize}</span>
                                                        <span>{new Date(logFile.lastModified).toLocaleDateString()}</span>
                                                    </div>
                                                    <div style={{ 
                                                        fontSize: '11px', 
                                                        color: '#bbb', 
                                                        marginTop: '4px',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap'
                                                    }}>
                                                        {filePath}
                                                    </div>
                                                </div>
                                            </Option>
                                        );
                                    })}
                                </Select>
                            </div>
                        </div>
                    </Col>
                </Row>
            )}

            {/* Analysis Results */}
            {currentStep === 3 && selectedLogFile && (
                <div>
                    {logs.length === 0 ? (
                        <EmptyLogResults 
                            onRefresh={analyzeLogs}
                            fileName={selectedLogFile}
                            threshold={slowQueryThreshold}
                            onThresholdChange={setSlowQueryThreshold}
                            isLoading={loading}
                        />
                    ) : (
                        <div>
                            {/* Statistics Cards */}
                            <Card title="PostgreSQL Log Analysis" style={{ marginBottom: '20px' }}>
                                <Row gutter={16}>
                                    <Col span={8}>
                                        <Card>
                                            <Statistic
                                                title="Total Queries"
                                                value={stats.totalQueries}
                                                prefix={<DatabaseOutlined />}
                                            />
                                        </Card>
                                    </Col>
                                    <Col span={8}>
                                        <Card>
                                            <Statistic
                                                title="Avg Execution Time"
                                                value={stats.avgExecutionTime}
                                                precision={2}
                                                suffix="ms"
                                                prefix={<FieldTimeOutlined />}
                                            />
                                        </Card>
                                    </Col>
                                    <Col span={8}>
                                        <Card>
                                            <Statistic
                                                title="Error Rate"
                                                value={(stats.errorCount / logs.length) * 100}
                                                precision={2}
                                                suffix="%"
                                                valueStyle={{ color: stats.errorCount > 0 ? '#cf1322' : '#3f8600' }}
                                                prefix={<AlertOutlined />}
                                            />
                                        </Card>
                                    </Col>
                                </Row>

                                {/* Detailed Statistics */}
                                <Row gutter={16} style={{ marginTop: '16px' }}>
                                    <Col span={8}>
                                        <Card title="Top Users" size="small">
                                            {stats.topUsers.map((item, index) => (
                                                <div key={index} style={{ marginBottom: '8px' }}>
                                                    <Tag color="blue">{item.user}</Tag>
                                                    <span>{item.count} queries</span>
                                                </div>
                                            ))}
                                        </Card>
                                    </Col>
                                    <Col span={8}>
                                        <Card title="Top Databases" size="small">
                                            {stats.topDatabases.map((item, index) => (
                                                <div key={index} style={{ marginBottom: '8px' }}>
                                                    <Tag color="green">{item.database}</Tag>
                                                    <span>{item.count} queries</span>
                                                </div>
                                            ))}
                                        </Card>
                                    </Col>
                                    <Col span={8}>
                                        <Card title="Recent Errors" size="small">
                                            {stats.topErrors.map((item, index) => (
                                                <div key={index} style={{ marginBottom: '8px' }}>
                                                    <Tag color="red">Error</Tag>
                                                    <span>{item.error}</span>
                                                </div>
                                            ))}
                                        </Card>
                                    </Col>
                                </Row>
                            </Card>

                            {/* Filtreleme araçları */}
                            <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <Select
                                    allowClear
                                    placeholder="Filter by Database"
                                    style={{ width: '200px' }}
                                    value={selectedDatabase}
                                    onChange={setSelectedDatabase}
                                    options={Array.from(new Set(logs.map(log => log.database)))
                                        .filter(Boolean)
                                        .map(db => ({ label: db, value: db }))}
                                />
                                <Select
                                    allowClear
                                    placeholder="Filter by User"
                                    style={{ width: '200px' }}
                                    value={selectedUser}
                                    onChange={setSelectedUser}
                                    options={Array.from(new Set(logs.map(log => log.user)))
                                        .filter(Boolean)
                                        .map(user => ({ label: user, value: user }))}
                                />
                                <Select
                                    allowClear
                                    placeholder="Filter by Level"
                                    style={{ width: '200px' }}
                                    value={selectedLevel}
                                    onChange={setSelectedLevel}
                                    options={Array.from(new Set(logs.map(log => log.level)))
                                        .filter(Boolean)
                                        .map(level => ({ label: level, value: level }))}
                                />
                                <Search
                                    placeholder="Search in queries and messages"
                                    allowClear
                                    style={{ flex: 1 }}
                                    value={searchText}
                                    onChange={(e) => setSearchText(e.target.value)}
                                />
                                <Button
                                    icon={<ReloadOutlined />}
                                    onClick={resetFilters}
                                >
                                    Reset Filters
                                </Button>
                                <span style={{ marginLeft: '10px', color: '#666' }}>
                                    Showing {filteredLogs.length} of {logs.length} entries
                                </span>
                            </div>

                            {/* Table */}
                            <Table
                                dataSource={filteredLogs}
                                columns={columns}
                                rowKey={(record) => record.uniqueId !== undefined ? `log_${record.uniqueId}` : `${record.timestamp}_${record.process_id}_${record.level}_${Math.random().toString(36).substring(2, 9)}`}
                                pagination={{
                                    pageSize: 50,
                                    showSizeChanger: true,
                                    pageSizeOptions: ['20', '50', '100', '200'],
                                    showTotal: (total) => `Total ${total} log entries`
                                }}
                                scroll={{ x: 1500, y: 650 }}
                                size="small"
                            />
                        </div>
                    )}
                </div>
            )}

            {/* Navigation Buttons */}
            {currentStep === 3 && (
                <div style={{ 
                    marginTop: 16, 
                    display: 'flex', 
                    justifyContent: 'center', 
                    gap: 12,
                    width: '100%'
                }}>
                    <Button
                        type="default"
                        onClick={resetSteps}
                        style={{
                            backgroundColor: '#f5f5f5',
                            borderColor: '#d9d9d9',
                            color: '#000',
                            fontWeight: 500
                        }}
                        icon={<ReloadOutlined />}
                    >
                        Start Over
                    </Button>
                    <Button
                        type="default"
                        onClick={resetLogFileStep}
                        style={{
                            backgroundColor: '#e6f7ff',
                            borderColor: '#91d5ff',
                            color: '#1890ff',
                            fontWeight: 500
                        }}
                    >
                        Select New Log File
                    </Button>
                    <Button
                        type="default"
                        onClick={resetNodeStep}
                        style={{
                            backgroundColor: '#f6ffed',
                            borderColor: '#b7eb8f',
                            color: '#52c41a',
                            fontWeight: 500
                        }}
                    >
                        Select New Node
                    </Button>
                    {Array.isArray(logs) && logs.length > 0 && (
                        <Button
                            type="primary"
                            onClick={() => analyzeLogs()}
                            style={{
                                backgroundColor: '#722ed1',
                                borderColor: '#531dab',
                                fontWeight: 500
                            }}
                            icon={<ReloadOutlined spin={loading} />}
                            loading={loading}
                        >
                            Re-analyze
                        </Button>
                    )}
                </div>
            )}

            {/* Explain Results Modal */}
            <Modal
                title="Query Execution Plan"
                open={explainModalVisible}
                onCancel={() => setExplainModalVisible(false)}
                width={1000}
                bodyStyle={{ maxHeight: '80vh', overflowY: 'auto' }}
                footer={[
                    <Button key="close" onClick={() => setExplainModalVisible(false)}>
                        Close
                    </Button>,
                    <Button 
                        key="copy" 
                        type="primary" 
                        onClick={() => {
                            navigator.clipboard.writeText(explainResults);
                            message.success('Execution plan copied to clipboard');
                        }}
                    >
                        Copy to Clipboard
                    </Button>
                ]}
            >
                <Tabs defaultActiveKey="visual">
                    <TabPane tab="Visualization" key="visual">
                        {/* Performance Analysis Summary */}
                        <div style={{ marginBottom: '24px' }}>
                            <h3>🔍 Performance Analysis</h3>
                            {renderPerformanceAnalysis()}
                        </div>

                        {/* Execution time summary */}
                        {queryTimingData.length > 0 && (
                            <div style={{ marginBottom: '24px' }}>
                                <h3>⏱️ Execution Time Breakdown</h3>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {queryTimingData.map((timing, index) => (
                                        <Tag 
                                            key={index} 
                                            color={getTimingColor(timing.time)}
                                            style={{ 
                                                fontSize: '12px', 
                                                padding: '4px 8px',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center'
                                            }}
                                        >
                                            <div style={{ fontWeight: 'bold' }}>{timing.name}</div>
                                            <div>{timing.time.toFixed(1)} ms</div>
                                            <div>({timing.percentage.toFixed(1)}%)</div>
                                            {timing.calls > 1 && <div>{timing.calls} calls</div>}
                                        </Tag>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        {/* Query Statistics Summary */}
                        {planVisualization.length > 0 && (
                            <div style={{ marginBottom: '24px' }}>
                                <h3>📊 Query Statistics</h3>
                                {renderQueryStatistics()}
                            </div>
                        )}

                        {/* Operation tree visualization */}
                        <div style={{ marginBottom: '24px' }}>
                            <h3>🌳 Query Plan Tree</h3>
                            <div style={{ 
                                border: '1px solid #f0f0f0', 
                                padding: '20px',
                                borderRadius: '8px',
                                backgroundColor: '#fafafa',
                                overflow: 'auto'
                            }}>
                                {planVisualization.length > 0 ? (
                                    <div className="query-plan-tree">
                                        {renderModernPlanTree(planVisualization)}
                                    </div>
                                ) : (
                                    <div style={{ textAlign: 'center', padding: '24px' }}>
                                        No visualization data available
                                    </div>
                                )}
                            </div>
                        </div>
                    </TabPane>
                    <TabPane tab="Raw Plan" key="raw">
                        <div style={{ marginBottom: '16px', display: 'flex', gap: '8px' }}>
                            <Button 
                                type="primary"
                                onClick={() => {
                                    navigator.clipboard.writeText(explainResults);
                                    message.success('Execution plan copied to clipboard');
                                }}
                                icon={<CopyOutlined />}
                            >
                                Copy to Clipboard
                            </Button>
                            
                            <Button 
                                type="primary"
                                onClick={handlePostgresExplainPlanAIAnalysis}
                                icon={<RobotOutlined />}
                                style={{ backgroundColor: '#722ed1', borderColor: '#722ed1' }}
                            >
                                Analyze with AI
                            </Button>
                        </div>
                        <pre style={{ 
                            whiteSpace: 'pre-wrap', 
                            wordBreak: 'break-word',
                            maxHeight: '60vh',
                            overflow: 'auto',
                            padding: '16px',
                            backgroundColor: '#f9f9fb',
                            color: '#333',
                            borderRadius: '4px',
                            fontSize: '14px',
                            lineHeight: '1.5',
                            fontFamily: 'Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace',
                            border: '1px solid #e6e8eb'
                        }}>
                            {explainResults.split('\n').map((line, index) => {
                                // Add syntax highlighting
                                if (line.includes('Query:') || line.includes('Database:') || line.includes('Status:')) {
                                    return (
                                        <div key={index} style={{ color: '#93a1a1', fontWeight: 'bold', marginBottom: '4px' }}>
                                            {line}
                                        </div>
                                    );
                                } else if (line.includes('Execution Time:')) {
                                    const time = parseFloat(line.split('Execution Time:')[1].trim().split('ms')[0]);
                                    const color = time > 1000 ? '#cb4b16' : '#859900';
                                    return (
                                        <div key={index} style={{ color, fontWeight: 'bold', marginBottom: '8px' }}>
                                            {line}
                                        </div>
                                    );
                                } else if (line.includes('EXPLAIN ANALYZE')) {
                                    return (
                                        <div key={index} style={{ color: '#268bd2', fontWeight: 'bold', marginTop: '8px', marginBottom: '8px' }}>
                                            {line}
                                        </div>
                                    );
                                } else if (line.includes('(cost=')) {
                                    return (
                                        <div key={index} style={{ color: '#2aa198' }}>
                                            {line}
                                        </div>
                                    );
                                } else if (line.includes('actual time=')) {
                                    return (
                                        <div key={index} style={{ color: '#cb4b16' }}>
                                            {line}
                                        </div>
                                    );
                                } else if (line.includes('Index Scan') || line.includes('Seq Scan') || line.includes('Sort') || 
                                          line.includes('Hash Join') || line.includes('Nested Loop')) {
                                    return (
                                        <div key={index} style={{ color: '#859900', fontWeight: 'bold' }}>
                                            {line}
                                        </div>
                                    );
                                } else {
                                    return <div key={index}>{line}</div>;
                                }
                            })}
                        </pre>
                    </TabPane>
                </Tabs>
            </Modal>
        </div>
    );
};

export default PostgresQueryAnalyzer; 