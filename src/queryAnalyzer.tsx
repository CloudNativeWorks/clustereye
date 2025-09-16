import React, { useState, useEffect, useCallback } from 'react';
import {
    Select, Spin, Table, Button, message,
    Collapse, Tag, Card, Statistic, Row, Col, Input, Modal, Steps, Tooltip, Slider
} from 'antd';
import { Typography } from 'antd';
import axios from 'axios';
import {
    ReloadOutlined, FileSearchOutlined, BarChartOutlined,
    AlertOutlined, ClockCircleOutlined, CopyOutlined, ArrowDownOutlined, ArrowUpOutlined, CheckCircleOutlined, RobotOutlined, DatabaseOutlined
} from '@ant-design/icons';
import { Key } from 'antd/es/table/interface';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from './redux/store';
import { incrementUsage } from './redux/aiLimitSlice';
import { store } from './redux/store';
import AIAnalysisRenderer from './components/AIAnalysisRenderer';

const { Option } = Select;
const { Step } = Steps;
const { Panel } = Collapse;
const { Search } = Input;

interface NodeInfo {
    nodename: string;
    dbAgentStatus: string;
    dc: string;
    freediskdata: string;
    freediskpercent: string;
    ip: string;
    status: string;
    totalDiskSize: string;
    version: string;
    Hostname?: string;
    NodeStatus?: string;
    Location?: string;
    IP?: string;
    MongoStatus?: string;
}

interface ReplicaSetData {
    [replicasetname: string]: NodeInfo[];
}

interface LogEntry {
    t: LogTimestamp;
    s: string;
    c: string;
    id: number;
    ctx: string;
    msg: string;
    planSummary: string;
    attr: LogAttributes;
    db: string;
    uniqueId?: number;
    severity_level?: string;
    command?: string | object;
    timestamp?: number;
    timestamp_readable?: string;
    namespace?: string;
    duration_millis?: number;
}

interface LogTimestamp {
    $date: string;
}

interface LogAttributes {
    Type: string;
    Namespace: string;
    Command: unknown; // Detaylı bir yapıya sahip olduğundan dolayı `any` kullanabiliriz.
    durationMillis: number;
    planSummary: string;
    db: string;
    query?: any;
    command?: any;
}

interface LogFile {
    fileName: string;
    fileSize: string;
    path: string;
    lastModified: Date;
    displayName: string;
}

function syntaxHighlight(json: unknown): string {
    if (json === undefined || json === null) {
        return '<span class="null">null</span>';
    }

    let jsonString: string;

    // Eğer json bir string değilse, onu string'e çevir
    if (typeof json !== 'string') {
        try {
            jsonString = JSON.stringify(json, undefined, 2);
        } catch (error) {
            console.error("JSON stringification error:", error);
            return `<span class="error">Error: Could not stringify object</span>`;
        }
    } else {
        jsonString = json;
    }

    // HTML'e uygun hale getir
    jsonString = jsonString.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // JSON'un çeşitli kısımlarını renklendir
    return jsonString.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|true|false|null|-?\d+(\.\d+)?([eE][+-]?\d+)?)/g, (match: string) => {
        let cls = 'number';
        if (/^"/.test(match)) {
            if (/:$/.test(match)) {
                cls = 'key';
            } else {
                cls = 'string';
            }
        } else if (/true|false/.test(match)) {
            cls = 'boolean';
        } else if (/null/.test(match)) {
            cls = 'null';
        }
        return '<span class="' + cls + '">' + match + '</span>';
    });
}

const showCommandModal = (command: unknown) => {
    const commandString = JSON.stringify(command, null, 2);

    // Kopyala işlevi
    const handleCopy = () => {
        navigator.clipboard.writeText(commandString).then(() => {
            message.success('Query copied to clipboard!');
        });
    };

    // AI Analysis function
    const handleAIAnalysis = async () => {
        // Check the current usage against the daily limit
        const state = store.getState();
        const { dailyUsageCount, dailyLimit, lastResetDate } = state.aiLimit;

        // Helper function to check if we need to reset (copied from slice logic)
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
                        content: `can you analyze this mongodb query? Please provide insights about the performance and any improvement recommendations. If there are performance problems, please suggest indexes that would improve the query using proper MongoDB syntax.\n\nQuery: ${commandString}`
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
                        AI Query Analysis Results
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
                            backgroundColor: '#ffffff',
                            borderRadius: '4px',
                            border: '1px solid #d9d9d9',
                            maxHeight: '50vh',
                            overflowY: 'auto'
                        }}>
                            <AIAnalysisRenderer content={data.choices[0].message.content} dbType="mongodb" />
                        </div>
                        <div style={{
                            fontSize: '12px',
                            color: '#888',
                            textAlign: 'right',
                            marginTop: '8px'
                        }}>
                            Daily usage: {updatedCount}/{dailyLimit} (Remaining: {remainingCount})
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
            message.error('Failed to analyze query with AI');
        }
    };

    Modal.info({
        title: (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
            }}>
                <FileSearchOutlined style={{ fontSize: '20px', color: '#1890ff' }} />
                Query Details
            </div>
        ),
        content: (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
            }}>
                <style>{`
                    .json-container {
                        background-color: #f5f5f5;
                        padding: 16px;
                        border-radius: 4px;
                        border: 1px solid #d9d9d9;
                        max-height: 50vh;
                        overflow-y: auto;
                        font-family: Monaco, Menlo, 'Ubuntu Mono', Consolas, 'source-code-pro', monospace;
                    }
                    .json-container pre {
                        margin: 0;
                        font-size: 14px;
                        line-height: 1.5;
                        white-space: pre-wrap;
                        word-break: break-word;
                    }
                    .json-container .string { color: #22863a; }
                    .json-container .number { color: #005cc5; }
                    .json-container .boolean { color: #005cc5; }
                    .json-container .null { color: #005cc5; }
                    .json-container .key { color: #d73a49; }
                `}</style>
                <div className="json-container">
                    <pre dangerouslySetInnerHTML={{ __html: syntaxHighlight(typeof command === 'string' ? JSON.parse(command) : command) }} />
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
                    onClick={handleAIAnalysis}
                                type="primary"
                    icon={<RobotOutlined />}
                    style={{
                        backgroundColor: '#1890ff',
                        borderColor: '#1890ff'
                    }}
                >
                    AI Analysis
                            </Button>
                        <Button
                    onClick={handleCopy}
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

// EmptyLogResults bileşenini güncelle
const EmptyLogResults = ({
    onRefresh,
    fileName,
    threshold,
    onThresholdChange
}: {
    onRefresh: () => void,
    fileName?: string,
    threshold?: number,
    onThresholdChange?: (value: number) => void
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
            <FileSearchOutlined style={{ fontSize: '36px', color: '#1890ff', display: 'block', margin: '0 auto 16px' }} />
            <div style={{ fontWeight: 'bold', marginBottom: '12px', fontSize: '18px' }}>
                {fileName ? `Analysis Settings for "${fileName.split('/').pop()}"` : 'Log File Selected'}
            </div>
            <div style={{ color: '#666', fontSize: '14px', marginBottom: 24 }}>
                Set the slow query threshold below and click "Analyze Log" to start analysis.
            </div>
        </div>

        {/* Threshold slider */}
        {threshold !== undefined && onThresholdChange && (
            <div style={{ maxWidth: 500, margin: '0 auto', marginBottom: 30, background: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #d9d9d9' }}>
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
                    tooltipVisible
                    tooltipPlacement="bottom"
                />
                <div style={{ fontSize: '12px', color: '#999', textAlign: 'center', marginTop: '12px' }}>
                    Set the minimum duration to consider a query as slow (10ms - 1000ms)
                </div>
            </div>
        )}

        <Button
            type="primary"
            icon={<ReloadOutlined />}
            onClick={onRefresh}
            size="large"
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
            Analyze Log
        </Button>
        <div style={{ marginTop: '12px', fontSize: '12px', color: '#888' }}>
            Logs will be processed according to your selected threshold
        </div>
    </div>
);

const QueryAnalyzer: React.FC = () => {
    const [dbFilters, setDbFilters] = useState<{ text: string; value: string }[]>([]);
    const [replSets, setReplSets] = useState<string[]>([]);
    const [nodes, setNodes] = useState<NodeInfo[]>([]);
    const [selectedReplicaSet, setSelectedReplicaSet] = useState<string | null>(null);
    const [selectedNode, setSelectedNode] = useState<string | null>(null);
    const [logFiles, setLogFiles] = useState<string[]>([]);
    const [selectedLogFile, setSelectedLogFile] = useState<string | null>(null);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [fetchingReplSets, setFetchingReplSets] = useState<boolean>(false);
    const [fetchingNodes, setFetchingNodes] = useState<boolean>(false);
    const [fetchingLogFiles, setFetchingLogFiles] = useState<boolean>(false);
    const [currentStep, setCurrentStep] = useState(0);
    const [selectedDb, setSelectedDb] = useState<string | null>(null);
    const [searchText, setSearchText] = useState('');
    const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);
    const [stats, setStats] = useState({
        totalQueries: 0,
        avgExecutionTime: 0,
        slowestQuery: { query: '', time: 0 },
        collscanOps: 0,
        mostFrequentDb: '',
        topNamespaces: [] as { namespace: string; count: number }[],
        topOperationTypes: [] as { type: string; count: number }[]
    });
    const [logFileStats, setLogFileStats] = useState({
        errorCount: 0,
        infoCount: 0,
        warningCount: 0,
        totalCount: 0
    });
    const [logFileStatsList, setLogFileStatsList] = useState<LogFile[]>([]);
    const [slowQueryThreshold, setSlowQueryThreshold] = useState<number>(100); // Varsayılan 100ms
    const location = useLocation();
    const navigate = useNavigate();

    // Adımları sıfırlama fonksiyonu
    const resetSteps = () => {
        setSelectedReplicaSet(null);
        setSelectedNode(null);
        setLogFiles([]);
        setSelectedLogFile(null);
        setLogs([]);
        setCurrentStep(0);
        setLoading(false);
    };

    // Adımları sıfırlama fonksiyonu
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

    const truncateString = (str: string, num: number) => {
        if (str.length <= num) {
            return str;
        }
        return str.slice(0, num) + '...';
    };

    const columns = [
        {
            title: 'Timestamp',
            dataIndex: ['t', '$date'], // LogTimestamp içindeki $date alanına erişim
            key: 'timestamp',
            sorter: (a: LogEntry, b: LogEntry) => new Date(a.t.$date).getTime() - new Date(b.t.$date).getTime(),
            render: (date: string) => {
                const options: Intl.DateTimeFormatOptions = {
                    hour12: false, // 24 saat formatını kullan
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                };
                const readableDate = new Date(date).toLocaleString('en-US', options);
                return <span>{readableDate}</span>;
            }
        },
        {
            title: 'Severity',
            dataIndex: 's',
            key: 'severity',
            filters: [
                { text: 'Info', value: 'I' },
                { text: 'Warning', value: 'W' },
                { text: 'Error', value: 'E' },
                // Diğer seviyeler eklenebilir
            ],
            onFilter: (value: unknown, record: LogEntry) => record.s === value,
            render: (text: string) => {
                switch (text) {
                    case 'I':
                        return 'Info';
                    case 'W':
                        return 'Warning';
                    case 'E':
                        return 'Error';
                    default:
                        return text;
                }
            },
        },
        {
            title: 'Component',
            dataIndex: 'c',
            key: 'component',
            filters: [
                { text: 'command', value: 'command' },
                { text: 'query', value: 'query' },
                { text: 'network', value: 'network' },
                { text: 'index', value: 'index' },
                { text: 'storage', value: 'storage' },
                { text: 'replication', value: 'replication' },
                { text: 'sharding', value: 'sharding' },
                { text: 'conn', value: 'conn' }
            ],
            onFilter: (value: Key | boolean, record: LogEntry) =>
                record.c ? record.c.toLowerCase() === String(value).toLowerCase() : false,
        },
        {
            title: 'Context',
            dataIndex: 'ctx',
            key: 'context',
        },
        {
            title: 'Message',
            dataIndex: 'msg',
            key: 'message',
            sorter: (a: LogEntry, b: LogEntry) => a.msg.localeCompare(b.msg),
        },
        {
            title: 'Query Plan',
            dataIndex: ['attr', 'planSummary'],
            key: 'planSummary',
            filters: [
                { text: 'IXSCAN', value: 'IXSCAN' },
                { text: 'COLLSCAN', value: 'COLLSCAN' },
                // Daha fazla filtre eklenebilir
            ],
            onFilter: (value: boolean | React.Key, record: LogEntry) => {
                if (typeof value === 'string') {
                    return record.attr.planSummary.includes(value);
                }
                return false;
            },
        },
        {
            title: 'Database',
            dataIndex: ['attr', 'db'],
            key: 'db',
            filters: dbFilters, // Dinamik filtreler burada kullanılıyor
            onFilter: (value: Key | boolean, record: LogEntry) => record.attr.db === value,
        },
        {
            title: 'Duration (ms)',
            dataIndex: ['attr', 'durationMillis'], // LogAttributes içindeki durationMillis alanına erişim
            key: 'duration',
            sorter: (a: LogEntry, b: LogEntry) => {
                return a.attr.durationMillis - b.attr.durationMillis;
            }
        },
        {
            title: 'Query',
            dataIndex: 'command', // Direct access to command field
            key: 'query',
            render: (command: unknown, record: LogEntry) => {
                // First check the direct command field from the log entry
                let queryData = record.command || command;

                // If still no data, check attr.command
                if (!queryData && record.attr && record.attr.Command) {
                    queryData = record.attr.Command;
                }

                // If command is a string, try to parse it
                if (typeof queryData === 'string') {
                    try {
                        queryData = JSON.parse(queryData);
                    } catch (e) {
                        // If parsing fails, keep the original string
                        console.log('Failed to parse command string:', e);
                    }
                }

                // If still no data, check query field
                if (!queryData && record.attr && record.attr.query) {
                    queryData = record.attr.query;
                }

                // If no data in any field, show the message
                if (queryData === undefined || queryData === null) {
                    return <span style={{ color: '#999' }}>No query data</span>;
                }

                return (
                    <button onClick={() => showCommandModal(queryData)}>Show Query</button>
                );
            },
        },
    ];

    // Replica set verilerini almak için API çağrısı
    const fetchReplicaSets = async () => {
        setFetchingReplSets(true);
        setLoading(true);
        try {
            // localStorage'dan token al
            const token = localStorage.getItem('token');

            const response = await axios.get(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/status/mongo`, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                }
            });


            if (response.data.status === "success" && Array.isArray(response.data.data)) {
                // Yeni API yanıt formatını işle
                const fetchedReplSets = response.data.data.map(
                    (replicaSetObject: any) => Object.keys(replicaSetObject)[0]
                );
                setReplSets(fetchedReplSets);
            } else if (Array.isArray(response.data)) {
                // Eski format hala destekli
                const fetchedReplSets = response.data.map(
                    (replicaSetObject: ReplicaSetData) => Object.keys(replicaSetObject)[0]
                );
                setReplSets(fetchedReplSets);
            } else {
                throw new Error("Unexpected API response format");
            }
        } catch (error) {
            console.error('Error fetching replica sets:', error);
            message.error('Failed to fetch replica sets. Please try again.');
            setReplSets([]);
        } finally {
            setFetchingReplSets(false);
            setLoading(false);
        }
    };

    // Replica Set değiştiğinde node'ları getir
    const handleReplSetChange = useCallback(async (value: string) => {
        if (!value) return;

        setSelectedReplicaSet(value);
        setFetchingNodes(true);
        setLoading(true);

        try {
            // localStorage'dan token al
            const token = localStorage.getItem('token');

            const response = await axios.get(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/status/mongo`, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                }
            });

            let foundNodes: NodeInfo[] = [];

            if (response.data.status === "success" && Array.isArray(response.data.data)) {
                // Yeni API formatı
                const cluster = response.data.data.find(
                    (cluster: any) => Object.keys(cluster)[0] === value
                );

                if (cluster) {
                    const clusterName = Object.keys(cluster)[0];
                    const nodeList = cluster[clusterName];

                    // Her node'u NodeInfo formatına dönüştür
                    foundNodes = nodeList.map((node: any) => ({
                        nodename: node.Hostname || "unknown",
                        dbAgentStatus: node.MongoStatus || "UNKNOWN",
                        dc: node.Location || "Unknown",
                        freediskdata: node.FreeDisk || "N/A",
                        freediskpercent: node.FDPercent?.toString() || "0",
                        ip: node.IP || "N/A",
                        status: node.NodeStatus || "UNKNOWN",
                        totalDiskSize: node.TotalDisk || "N/A",
                        version: node.MongoVersion || "N/A",
                        // Orijinal alanları da sakla
                        Hostname: node.Hostname,
                        NodeStatus: node.NodeStatus,
                        Location: node.Location,
                        IP: node.IP,
                        MongoStatus: node.MongoStatus
                    }));
                }
            } else if (Array.isArray(response.data)) {
                // Eski API formatı
                const nodesData = response.data.find((item) => Object.prototype.hasOwnProperty.call(item, value));
                if (nodesData && nodesData[value]) {
                    foundNodes = nodesData[value];
                }
            }

            setNodes(foundNodes);

            // İlk node'u otomatik olarak seç
            if (foundNodes.length > 0) {
                setCurrentStep(1);
            } else {
                // Eğer node listesi boşsa, seçimi ve logları sıfırla
                message.warning('No nodes found for the selected replica set');
                setSelectedNode(null);
                setLogFiles([]);
            }
        } catch (error) {
            console.error('Error fetching nodes data:', error);
            message.error('Failed to fetch nodes data');
            setNodes([]);
            setSelectedNode(null);
            setLogFiles([]);
        } finally {
            setFetchingNodes(false);
            setLoading(false);
        }

        // Seçilen log dosyasını ve logları sıfırla
        setSelectedLogFile(null);
        setLogs([]);
    }, []);

    // Component mount olduğunda Replica Set verilerini al
    useEffect(() => {
        fetchReplicaSets();

        // URL'den replicaSet parametresini al
        const searchParams = new URLSearchParams(location.search);
        const replicaSetParam = searchParams.get('replicaSet');

        if (replicaSetParam) {
            // ReplicaSet'i ayarla ve ilgili işlevi çağır
            setSelectedReplicaSet(replicaSetParam);
            handleReplSetChange(replicaSetParam);
        }
    }, [location.search, handleReplSetChange]);

    // Verileri yenile butonu için fonksiyon
    const handleRefreshData = async () => {
        if (currentStep === 0) {
            await fetchReplicaSets();
        } else if (currentStep === 1 && selectedReplicaSet) {
            await handleReplSetChange(selectedReplicaSet);
        } else if (currentStep === 2 && selectedNode) {
            await handleNodeChange(selectedNode);
        } else if (currentStep === 3 && selectedLogFile) {
            await handleLogFileChange(selectedLogFile);
        }
    };

    const handleNodeChange = async (nodename: string) => {
        setSelectedNode(nodename);
        setCurrentStep(2);
        setFetchingLogFiles(true);
        setLoading(true);

        try {
            // localStorage'dan token al
            const token = localStorage.getItem('token');

            // Agent ID formatına dönüştür
            const agentId = `agent_${nodename}`;

            // Endpoint'i kullan
            const apiUrl = `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/agents/${agentId}/mongo/logs`;

            const response = await axios.get(
                apiUrl,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    }
                }
            );

            if (response.data && response.data.status === 'success' && Array.isArray(response.data.log_files)) {
                // API yanıtından log dosya bilgilerini doğrudan çıkar
                const logFilesData = response.data.log_files;

                const logFilesInfo: LogFile[] = [];

                // Her bir log dosyası için bilgileri kaydet - ARTIK FİLTRELEME YAPMA
                logFilesData.forEach((file: any) => {

                    // Tüm log dosyalarını kabul et, filtreleme yapma
                    logFilesInfo.push({
                        fileName: file.name,
                        fileSize: file.size_readable || `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
                        path: file.path,
                        lastModified: new Date(file.last_modified * 1000),
                        displayName: `${file.name} (${file.size_readable || (file.size / (1024 * 1024)).toFixed(2) + ' MB'})`
                    });
                });

                // Log dosyalarını son değiştirilme tarihine göre sırala (en yeni en üstte)
                logFilesInfo.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());

                if (logFilesInfo.length > 0) {
                    // Sadece path'leri kaydet
                    const filePaths = logFilesInfo.map(info => info.path);
                    setLogFiles(filePaths);

                    // İstatistikleri kaydet
                    setLogFileStatsList(logFilesInfo);

                    // Otomatik seçim yapmıyoruz, kullanıcının seçmesini bekliyoruz
                    setSelectedLogFile(null);

                    message.success(`Found ${logFilesInfo.length} log files. Please select one to analyze.`);
                } else {
                    message.info('No log files found for the selected node');
                    setLogFiles([]);
                    setLogFileStatsList([]);
                }
            } else {
                // Yanıt beklenen yapıda değilse, hata mesajı göster
                console.error('Invalid API response format:', response.data);
                message.error('Invalid response format when fetching log files');
                setLogFiles([]);
                setLogFileStatsList([]);
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

    // Log dosyası seçildiğinde çağrılacak handler
    const handleLogFileChange = async (logFile: string) => {
        setSelectedLogFile(logFile);
        setCurrentStep(3);
        // Dosya seçildiğinde hemen analiz başlatmıyoruz
        // Kullanıcının threshold'u ayarlayıp analiz butonuna tıklamasını bekliyoruz
        message.success('Log file selected. Set the slow query threshold and click "Analyze" to start analysis.');

        // Eğer zaten loglar yüklenmişse, temizle ve EmptyLogResults bileşenini göster
        if (logs.length > 0) {
            setLogs([]);
            setFilteredLogs([]);
        }
    };

    // Log dosyasını analiz etmek için API çağrısı
    const fetchParsedLogs = async (hostname: string, logFilePath: string) => {
        if (!hostname || !logFilePath) return;

        setLoading(true);
        setLogs([]);

        try {
            const token = localStorage.getItem('token');
            const agentId = `agent_${hostname}`;

            // API endpoint'i hazırla - yeni endpoint: mongo/logs/analyze
            const apiUrl = `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/agents/${agentId}/mongo/logs/analyze`;

            const response = await axios.post(
                apiUrl,
                {
                    log_file_path: logFilePath,
                    slow_query_threshold_ms: slowQueryThreshold // Kullanıcının belirlediği eşik değeri
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


            // API yanıtını kontrol et
            if (response.status === 200) {
                if (response.data && response.data.status === 'success') {
                    let logEntries = [];

                    // API yanıtı formatını kontrol et
                    if (Array.isArray(response.data.log_entries)) {
                        logEntries = response.data.log_entries;
                    } else if (response.data.data && Array.isArray(response.data.data)) {
                        logEntries = response.data.data;
                    } else if (Array.isArray(response.data)) {
                        logEntries = response.data;
                    } else {
                        console.warn('Unexpected log entries format:', response.data);
                        message.warning('The log file was processed but response format is not recognized');
                        setLoading(false);
                        return;
                    }

                    // Log dosyasının istatistiklerini güncelle
                    setLogFileStats({
                        errorCount: response.data.error_count || 0,
                        warningCount: response.data.warning_count || 0,
                        infoCount: response.data.info_count || 0,
                        totalCount: logEntries.length
                    });

                    if (logEntries.length > 0) {
                        // API yanıtını LogEntry formatına çevir
                        const enhancedLogs = logEntries.map((entry: any, index: number) => {
                            // Timestamp'i LogTimestamp formatına çevir
                            const timestamp = entry.timestamp_readable ||
                                (entry.timestamp ? new Date(entry.timestamp * 1000).toISOString() :
                                    new Date().toISOString());

                            // Log seviyesini belirle (severity)
                            const severity = entry.severity ||
                                (entry.level ? entry.level.toUpperCase().charAt(0) : 'I');

                            // Command alanı için güvenlik kontrolü yap
                            let command = entry.command || entry.Command || {};
                            if (command === undefined || command === null) {
                                command = {}; // Varsayılan boş obje
                            }

                            // Get database name from all possible locations
                            const dbName = entry.db || // Direct db field
                                entry.db_name || // db_name field
                                (entry.command && typeof entry.command === 'string' ?
                                    JSON.parse(entry.command).$db : // From command.$db if command is string
                                    entry.command?.$db) || // From command.$db if command is object
                                ''; // Default to empty string if not found

                            return {
                                uniqueId: index,
                                t: { $date: timestamp },
                                s: severity,
                                c: entry.component || entry.c || '',
                                ctx: entry.context || entry.ctx || '',
                                id: index,
                                msg: entry.message || entry.msg || '',
                                planSummary: entry.plan_summary || entry.planSummary || '',
                                command: entry.command,
                                timestamp: entry.timestamp,
                                timestamp_readable: entry.timestamp_readable,
                                namespace: entry.namespace,
                                duration_millis: entry.duration_millis,
                                attr: {
                                    Type: entry.op_type || entry.operation_type || 'query',
                                    Namespace: entry.namespace || entry.ns || '',
                                    Command: entry.command,
                                    durationMillis: entry.duration_millis || entry.durationMillis || 0,
                                    planSummary: entry.plan_summary || entry.planSummary || '',
                                    db: dbName // Use the extracted database name
                                },
                                db: dbName, // Use the extracted database name
                                severity_level: entry.severity || entry.level || 'info'
                            };
                        });

                        setLogs(enhancedLogs);
                        setFilteredLogs(enhancedLogs);

                        // Benzersiz db adlarını çıkar
                        const uniqueDbs = Array.from(
                            new Set(
                                enhancedLogs
                                    .filter((log: LogEntry) => log.attr && log.attr.db)
                                    .map((log: LogEntry) => log.attr.db)
                            )
                        );

                        const filters = uniqueDbs.map(db => ({
                            text: db as string,
                            value: db as string
                        }));

                        setDbFilters(filters);

                        message.success(`${enhancedLogs.length} log entries loaded and analyzed`);

                        // İstatistikleri hesapla (burası log seviyelerini ve COMMAND sayısını hesaplayacak)
                        calculateStats();
                    } else {
                        message.info('No query logs found in the selected file');
                    }
                } else if (response.data && response.data.status === 'error') {
                    // API'nin döndüğü hata mesajını göster
                    const errorMessage = response.data.error || 'Error analyzing log file';
                    console.error('API returned error:', errorMessage);
                    message.error(`Failed to analyze log: ${errorMessage}`);
                } else {
                    // API yanıtı uygun formatta değil
                    console.warn('Unexpected response format:', response.data);
                    message.warning('The log file was processed but no analyzable entries were found');
                }
            } else {
                message.error(`Log analysis failed: ${response.statusText}`);
            }
        } catch (error) {
            console.error('Error analyzing logs:', error);
            if (axios.isAxiosError(error) && error.response) {
                message.error(`Error: ${error.response.status} - ${error.response.statusText}`);
                console.error('Error response data:', error.response.data);
            } else {
                message.error('An error occurred during log analysis');
            }
        } finally {
            setLoading(false);
        }
    };

    // selectedNode veya selectedLogFile değiştiğinde log parsing işlemini tekrar çalıştır
    useEffect(() => {
        // Artık dosya seçildiğinde otomatik analiz yapmıyoruz
        // Bu useEffect'i kaldırıyoruz veya devre dışı bırakıyoruz
        /*
        if (selectedNode && selectedLogFile) {
            fetchParsedLogs(selectedNode, selectedLogFile);
        }
        */
    }, [selectedNode, selectedLogFile]);

    // Log verilerini filtreleme fonksiyonu
    const filterLogs = () => {
        if (!logs || logs.length === 0) {
            setFilteredLogs([]);
            return;
        }

        let results = [...logs];

        // Database filtresi uygula
        if (selectedDb) {
            results = results.filter(log =>
                log.attr && log.attr.db === selectedDb
            );
        }

        // Metin araması uygula
        if (searchText) {
            const searchLower = searchText.toLowerCase();
            results = results.filter(log =>
                (log.msg && log.msg.toLowerCase().includes(searchLower)) ||
                (log.attr && log.attr.query && JSON.stringify(log.attr.query).toLowerCase().includes(searchLower)) ||
                (log.attr && log.attr.command && JSON.stringify(log.attr.command).toLowerCase().includes(searchLower)) ||
                (log.attr && log.attr.Namespace && log.attr.Namespace.toLowerCase().includes(searchLower))
            );
        }

        setFilteredLogs(results);
    };

    // Logs veya filtreler değiştiğinde filtreleri uygula
    useEffect(() => {
        filterLogs();
        calculateStats();
    }, [logs, selectedDb, searchText]);

    // İstatistikleri hesapla
    const calculateStats = () => {
        if (!logs || logs.length === 0) {
            setStats({
                totalQueries: 0,
                avgExecutionTime: 0,
                slowestQuery: { query: '', time: 0 },
                collscanOps: 0,
                mostFrequentDb: '',
                topNamespaces: [],
                topOperationTypes: []
            });
            return;
        }

        // "command" component'li sorguları sayarak toplam sorgu sayısını hesapla
        let commandCount = 0;
        let errorCount = 0;
        let warningCount = 0;
        let infoCount = 0;

        // Ortalama yürütme süresi
        let totalExecutionTime = 0;
        let slowestQuery = { query: '', time: 0 };
        let collscanOps = 0;
        const dbCounts: Record<string, number> = {};
        const namespaces: Record<string, number> = {};
        const operationTypes: Record<string, number> = {};

        logs.forEach(log => {
            // Log seviyesini kontrol et
            if (log.s === 'E') {
                errorCount++;
            } else if (log.s === 'W') {
                warningCount++;
            } else if (log.s === 'I') {
                infoCount++;
            }

            // Component'i "command" olanları say
            if (log.c && log.c.toLowerCase() === 'command') {
                commandCount++;
            }

            // Yürütme süresi 
            if (log.attr && log.attr.durationMillis) {
                totalExecutionTime += log.attr.durationMillis;

                // En yavaş sorguyu bul
                if (log.attr.durationMillis > slowestQuery.time) {
                    slowestQuery = {
                        query: log.attr.query ? JSON.stringify(log.attr.query) :
                            log.attr.command ? JSON.stringify(log.attr.command) :
                                (log.attr.Command && Object.keys(log.attr.Command).length > 0) ?
                                    JSON.stringify(log.attr.Command) : log.msg || '',
                        time: log.attr.durationMillis
                    };
                }
            }

            // COLLSCAN sayısını bul
            if (log.attr && (
                (log.attr.planSummary && log.attr.planSummary.includes('COLLSCAN')) ||
                (log.planSummary && log.planSummary.includes('COLLSCAN')) ||
                (log.msg && log.msg.includes('COLLSCAN'))
            )) {
                collscanOps++;
            }

            // Veritabanı istatistiği
            if (log.attr && log.attr.db) {
                dbCounts[log.attr.db] = (dbCounts[log.attr.db] || 0) + 1;
            }

            // Namespace istatistiği
            if (log.attr && log.attr.Namespace) {
                namespaces[log.attr.Namespace] = (namespaces[log.attr.Namespace] || 0) + 1;
            }

            // Operation type istatistiği
            if (log.attr && log.attr.Type) {
                operationTypes[log.attr.Type] = (operationTypes[log.attr.Type] || 0) + 1;
            }
        });

        // COMMAND component'li log sayısı 0 ise, alternatif hesaplama yöntemleri deneyelim
        if (commandCount === 0) {
            // 1. Önce Command nesnesi içerisinde MongoDB operasyonu içerenleri say
            logs.forEach(log => {
                if (log.attr) {
                    if (log.attr.Command && typeof log.attr.Command === 'object') {
                        const commandObj = log.attr.Command as any;
                        const hasMongoOp = commandObj && (
                            commandObj.find || commandObj.insert || commandObj.update ||
                            commandObj.delete || commandObj.aggregate || commandObj.count ||
                            commandObj.distinct || commandObj.findAndModify
                        );

                        if (hasMongoOp) {
                            commandCount++;
                        }
                    }
                    else if (log.attr.command && typeof log.attr.command === 'object') {
                        const commandObj = log.attr.command as any;
                        const hasMongoOp = commandObj && (
                            commandObj.find || commandObj.insert || commandObj.update ||
                            commandObj.delete || commandObj.aggregate || commandObj.count ||
                            commandObj.distinct || commandObj.findAndModify
                        );

                        if (hasMongoOp) {
                            commandCount++;
                        }
                    }
                }
            });

            // Hala 0 ise, durationMillis > 0 olanları say
            if (commandCount === 0) {
                commandCount = logs.filter(log => log.attr && log.attr.durationMillis > 0).length;
            }
        }

        const totalQueries = commandCount > 0 ? commandCount : logs.length;

        // Log seviyesi sayılarını güncelle
        setLogFileStats(prevStats => ({
            ...prevStats,
            errorCount,
            warningCount,
            infoCount
        }));

        // En sık kullanılan veritabanını bulma
        let mostFrequentDb = '';
        let maxCount = 0;

        Object.entries(dbCounts).forEach(([db, count]) => {
            if (count > maxCount) {
                maxCount = count;
                mostFrequentDb = db;
            }
        });

        // En sık kullanılan namespace'leri bulma (top 5)
        const topNamespaces = Object.entries(namespaces)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([ns, count]) => ({ namespace: ns, count }));

        // En sık kullanılan operasyon tiplerini bulma
        const topOperationTypes = Object.entries(operationTypes)
            .sort((a, b) => b[1] - a[1])
            .map(([type, count]) => ({ type, count }));

        // İstatistikleri güncelle
        setStats({
            totalQueries,
            avgExecutionTime: totalQueries > 0 ? totalExecutionTime / totalQueries : 0,
            slowestQuery,
            collscanOps,
            mostFrequentDb,
            topNamespaces,
            topOperationTypes
        });
    };

    const slowestQuery = stats?.slowestQuery ? {
        attr: {
            durationMillis: stats.slowestQuery.time,
            Command: stats.slowestQuery.query,
        }
    } : null;

    const slowestQueryContent = slowestQuery ? (
        <div style={{ marginBottom: 16 }}>
           
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>Duration: {slowestQuery.attr.durationMillis} ms</span>
                <Button 
                    type="primary" 
                    onClick={() => showCommandModal(slowestQuery.attr.Command)}
                    icon={<FileSearchOutlined />}
                >
                    Show Query
                </Button>
            </div>
        </div>
    ) : null;

    return (
        <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '16px' }}>
                <Steps current={currentStep} style={{ flex: 1 }}>
                    <Step title="Select Replica Set" description={selectedReplicaSet ? ` ${selectedReplicaSet}` : ''} />
                    <Step title="Select Node" description={selectedNode ? ` ${selectedNode}` : ''} />
                    <Step
                        title="Select Log File"
                        description={
                            selectedLogFile ? (
                                <Tooltip title={selectedLogFile}>
                                    {`${truncateString(selectedLogFile, 15)}`}
                                </Tooltip>
                            ) : ''
                        }
                    />
                </Steps>
                <div style={{ marginLeft: '16px', display: 'flex', alignItems: 'center' }}>
                    <Tooltip title="Refresh Data">
                        <button
                            onClick={handleRefreshData}
                            disabled={loading}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                padding: '8px'
                            }}
                        >
                            <ReloadOutlined
                                spin={loading}
                                style={{ fontSize: '20px', color: '#1890ff' }}
                            />
                        </button>
                    </Tooltip>
                </div>
            </div>

            {currentStep === 0 && (
                <div style={{ display: 'flex', justifyContent: 'center', width: '100%', marginTop: 20 }}>
                    <div style={{ width: '50%' }}>
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
                                <span style={{ fontWeight: 500, color: '#595959' }}>MongoDB Replica Set</span>
                            </div>
                            <div style={{ padding: '12px' }}>
                    <Select
                                    style={{ width: '100%' }}
                        showSearch
                        placeholder={fetchingReplSets ? "Loading replica sets..." : "Select a replica set"}
                        optionFilterProp="children"
                        onChange={handleReplSetChange}
                        filterOption={(input, option) =>
                            option?.children
                                ? option.children.toString().toLowerCase().includes(input.toLowerCase())
                                : false
                        }
                        loading={fetchingReplSets}
                        notFoundContent={fetchingReplSets ? <Spin size="small" /> : "No replica sets found"}
                        value={selectedReplicaSet}
                                    listHeight={350}
                                    optionLabelProp="label"
                    >
                        {replSets.map(replSet => (
                                        <Option key={replSet} value={replSet} label={replSet}>
                                            <div style={{ padding: '4px 0' }}>
                                                <span style={{ fontWeight: 500 }}>{replSet}</span>
                                            </div>
                                        </Option>
                        ))}
                    </Select>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {currentStep === 1 && selectedReplicaSet && (
                <div style={{ display: 'flex', justifyContent: 'center', width: '100%', marginTop: 20 }}>
                    <div style={{ width: '80%' }}>
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
                        onChange={handleNodeChange}
                        optionFilterProp="children"
                        filterOption={(input, option) =>
                            option?.children
                                ? String(option.children).toLowerCase().includes(input.toLowerCase())
                                : false
                        }
                        value={selectedNode}
                        loading={fetchingNodes}
                        notFoundContent={fetchingNodes ? <Spin size="small" /> : "No nodes found"}
                        listHeight={400}
                        size="large"
                                    optionLabelProp="label"
                    >
                        {nodes.map(node => {
                            const nodeName = node.nodename || node.Hostname || '';
                            const nodeStatus = node.status || node.NodeStatus || '';
                            const mongoStatus = node.MongoStatus || node.dbAgentStatus || '';
                            const location = node.dc || node.Location || '';
                            const ip = node.ip || node.IP || '';
                            const version = node.version || '';

                            // Status rengini belirle
                            const statusColor = nodeStatus === 'PRIMARY' ? '#52c41a' :
                                nodeStatus === 'SECONDARY' ? '#1890ff' :
                                    nodeStatus === 'ARBITER' ? '#722ed1' : '#f5222d';

                            // MongoDB servis durumu rengini belirle
                            const mongoStatusColor = mongoStatus === 'RUNNING' ? '#52c41a' : '#f5222d';

                            return (
                                <Option
                                    key={nodeName}
                                    value={nodeName}
                                                label={nodeName}
                                >
                                    <div style={{ padding: '4px 0' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontWeight: 'bold' }}>{nodeName}</span>
                                            <span>
                                                <Tag color={statusColor} style={{ marginRight: 4 }}>
                                                    {nodeStatus}
                                                </Tag>
                                                <Tag color={mongoStatusColor}>
                                                    {mongoStatus}
                                                </Tag>
                                            </span>
                                        </div>
                                        <div style={{
                                            fontSize: '12px',
                                            color: '#999',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            marginTop: '4px'
                                        }}>
                                            <span>
                                                <span style={{ marginRight: '12px' }}>
                                                    <strong>IP:</strong> {ip}
                                                </span>
                                                <span style={{ marginRight: '12px' }}>
                                                    <strong>Location:</strong> {location}
                                                </span>
                                                {version && (
                                                    <span>
                                                        <strong>Version:</strong> {version}
                                                    </span>
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                </Option>
                            );
                        })}
                    </Select>
                    {!selectedNode && nodes.length > 0 && (
                                    <div style={{ marginTop: 5, color: '#1890ff', fontSize: 12, textAlign: 'center' }}>
                            <ArrowUpOutlined style={{ marginRight: 4 }} /> Click to open the dropdown and select a node
                        </div>
                    )}
                    {nodes.length === 0 && !fetchingNodes && (
                                    <div style={{ marginTop: 10, color: '#ff4d4f', textAlign: 'center', padding: '10px' }}>
                            <AlertOutlined style={{ marginRight: 5 }} />
                            No nodes found in this replica set. Please select a different replica set.
                        </div>
                    )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {currentStep === 2 && selectedNode && (
                <div style={{ display: 'flex', justifyContent: 'center', width: '100%', marginTop: 20 }}>
                    <div style={{ width: '80%' }}>
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
                                <FileSearchOutlined style={{ color: '#722ed1' }} />
                                <span style={{ fontWeight: 500, color: '#595959' }}>MongoDB Log Files</span>
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
                        listHeight={400}
                        size="large"
                                    optionLabelProp="label"
                                    popupMatchSelectWidth={false}
                    >
                        {logFiles.map((logFile, index) => {
                            // Dosya adı ve diğer bilgileri bul
                            const fileInfo = logFileStatsList.find(info => info.path === logFile);
                            const fileName = fileInfo ? fileInfo.fileName : logFile.split('/').pop() || logFile;
                            const fileSize = fileInfo ? fileInfo.fileSize : '';
                            const lastModified = fileInfo ? fileInfo.lastModified : null;

                            // Son değiştirilme tarihini formatlı göster
                            const formattedDate = lastModified
                                ? lastModified.toLocaleString()
                                : '';

                            return (
                                            <Option key={index} value={logFile} label={fileName}>
                                                <div style={{ padding: '4px 0', maxWidth: '500px' }}>
                                                    <div style={{ fontWeight: 500, wordBreak: 'break-all' }}>{fileName}</div>
                                                    <div style={{ 
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        fontSize: '12px',
                                                        color: '#999',
                                                        marginTop: '4px'
                                                    }}>
                                                        <span>{fileSize}</span>
                                        {formattedDate && (
                                                            <span>{formattedDate}</span>
                                        )}
                                    </div>
                                                    <div style={{ 
                                                        fontSize: '11px', 
                                                        color: '#bbb', 
                                                        marginTop: '4px',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap'
                                                    }}>
                                                        {logFile}
                                                    </div>
                                                </div>
                                </Option>
                            );
                        })}
                    </Select>
                    {!selectedLogFile && logFiles.length > 0 && (
                                    <div style={{ marginTop: 5, color: '#1890ff', fontSize: 12, textAlign: 'center' }}>
                            <ArrowUpOutlined style={{ marginRight: 4 }} /> Click to open the dropdown and select a log file
                        </div>
                    )}
                    {logFiles.length === 0 && !fetchingLogFiles && (
                                    <div style={{ marginTop: 10, color: '#ff4d4f', textAlign: 'center', padding: '10px' }}>
                            <AlertOutlined style={{ marginRight: 5 }} />
                            No log files found. Please check if logs exist for this node.
                        </div>
                    )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div style={{ margin: '20px 0', width: '100%' }}>
                {loading ? (
                    <div style={{ textAlign: 'center', marginTop: '20px', padding: '40px' }}>
                        <Spin size="large" />
                        <div style={{ marginTop: '10px' }}>Processing log data...</div>
                    </div>
                ) : (
                    <div>
                        {/* Log Dosya Bilgileri */}
                        {selectedLogFile && (
                            <Card
                                title={`Log File: ${selectedLogFile.split('/').pop()}`}
                                style={{ marginBottom: '16px' }}
                                size="small"
                                extra={
                                    <span style={{ color: logs.length > 0 ? '#52c41a' : '#1890ff' }}>
                                        {logs.length > 0 ? (
                                            <><CheckCircleOutlined /> Analysis completed</>
                                        ) : (
                                            <><ArrowDownOutlined /> Adjust threshold below and analyze</>
                                        )}
                                    </span>
                                }
                            >
                                {Array.isArray(logs) && logs.length > 0 ? (
                                    <Row gutter={16}>
                                        <Col span={6}>
                                            <Statistic
                                                title="Errors"
                                                value={logFileStats.errorCount}
                                                valueStyle={{ color: logFileStats.errorCount > 0 ? '#ff4d4f' : '#999' }}
                                            />
                                        </Col>
                                        <Col span={6}>
                                            <Statistic
                                                title="Warnings"
                                                value={logFileStats.warningCount}
                                                valueStyle={{ color: logFileStats.warningCount > 0 ? '#faad14' : '#999' }}
                                            />
                                        </Col>
                                        <Col span={6}>
                                            <Statistic
                                                title="Info"
                                                value={logFileStats.infoCount}
                                                valueStyle={{ color: '#1890ff' }}
                                            />
                                        </Col>
                                        <Col span={6}>
                                            <Statistic
                                                title="Total Lines"
                                                value={logFileStats.totalCount || (logFileStats.errorCount + logFileStats.warningCount + logFileStats.infoCount)}
                                            />
                                        </Col>
                                    </Row>
                                ) : (
                                    <div style={{ padding: '8px 0', color: '#888' }}>
                                        Analysis not started. Set the threshold value below and click "Analyze Log" to begin.'
                                    </div>
                                )}

                                {/* Dosya bilgileri */}
                                <div style={{ marginTop: '16px', color: '#888', borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
                                    {/* Dosya bilgilerini bul */}
                                    {(() => {
                                        const fileInfo = logFileStatsList.find(info => info.path === selectedLogFile);
                                        if (!fileInfo) return <p>Path: {selectedLogFile}</p>;

                                        return (
                                            <>
                                                <p>
                                                    <strong>File:</strong> {fileInfo.fileName}
                                                    <span style={{ marginLeft: '8px' }}>({fileInfo.fileSize})</span>
                                                </p>
                                                <p>
                                                    <strong>Last Modified:</strong> {fileInfo.lastModified.toLocaleString()}
                                                </p>
                                                <p><strong>Path:</strong> {fileInfo.path}</p>
                                            </>
                                        );
                                    })()}
                                </div>
                            </Card>
                        )}

                        {Array.isArray(logs) && logs.length > 0 ? (
                            <div>
                                {/* İstatistikler ve Filtreler */}
                                <div style={{ marginBottom: '20px' }}>
                                    <Collapse defaultActiveKey={['1']}>
                                        <Panel header="MongoDB Query Analysis" key="1">
                                            <Row gutter={16}>
                                                <Col span={4}>
                                                    <Card>
                                                        <Statistic
                                                            title="Total Query Operations"
                                                            value={stats.totalQueries}
                                                            prefix={<FileSearchOutlined />}
                                                        />
                                                    </Card>
                                                </Col>
                                                <Col span={4}>
                                                    <Card>
                                                        <Statistic
                                                            title="Avg Execution Time"
                                                            value={stats.avgExecutionTime.toFixed(2)}
                                                            suffix="ms"
                                                            precision={2}
                                                            prefix={<ClockCircleOutlined />}
                                                        />
                                                    </Card>
                                                </Col>
                                                <Col span={4}>
                                                    <Card>
                                                        <Statistic
                                                            title="Collection Scans"
                                                            value={stats.collscanOps}
                                                            valueStyle={{ color: stats.collscanOps > 10 ? '#cf1322' : '#3f8600' }}
                                                            prefix={<AlertOutlined />}
                                                        />
                                                        <div style={{ fontSize: '12px', color: '#999', marginTop: '5px' }}>
                                                            {stats.collscanOps > 10 ? 'High COLLSCAN operations detected!' : 'COLLSCAN operations within normal limits'}
                                                        </div>
                                                    </Card>
                                                </Col>
                                                <Col span={4}>
                                                    <Card>
                                                                <Statistic
                                                                    title="Most Used DB"
                                                            value={stats.mostFrequentDb || 'N/A'}
                                                            prefix={<BarChartOutlined />}
                                                        />
                                                    </Card>
                                                </Col>
                                                <Col span={8}>
                                                    <Card title="Slowest Query">
                                                        {slowestQueryContent}
                                                    </Card>
                                                </Col>
                                            </Row>

                                            {/* Top Namespaces ve Operation Types */}
                                            {stats.topNamespaces && stats.topNamespaces.length > 0 && (
                                                <Row gutter={16} style={{ marginTop: '16px' }}>
                                                    <Col span={12}>
                                                        <Card title="Top 5 Collections/Namespaces" size="small">
                                                            <ul style={{ paddingLeft: '20px' }}>
                                                                {stats.topNamespaces.map((item, index) => (
                                                                    <li key={index}>
                                                                        <span style={{ fontWeight: 'bold' }}>{item.namespace}</span>: {item.count} operations
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </Card>
                                                    </Col>
                                                    <Col span={12}>
                                                        <Card title="Operation Types" size="small">
                                                            <ul style={{ paddingLeft: '20px' }}>
                                                                {stats.topOperationTypes && stats.topOperationTypes.map((item, index) => (
                                                                    <li key={index}>
                                                                        <span style={{ fontWeight: 'bold' }}>{item.type}</span>: {item.count} operations
                                                                    </li>
                                                                )).slice(0, 5)}
                                                            </ul>
                                                        </Card>
                                                    </Col>
                                                </Row>
                                            )}
                                        </Panel>
                                    </Collapse>
                                </div>

                                {/* Filtreleme araçları */}
                                <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center' }}>
                                    <div style={{ marginRight: '15px', width: '250px' }}>
                                        <Select
                                            allowClear
                                            placeholder="Filter by Database"
                                            style={{ width: '100%' }}
                                            options={dbFilters}
                                            onChange={(value) => setSelectedDb(value)}
                                        />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <Search
                                            placeholder="Search in queries and commands"
                                            allowClear
                                            enterButton
                                            onSearch={(value) => setSearchText(value)}
                                            onChange={(e) => {
                                                if (!e.target.value) {
                                                    setSearchText('');
                                                }
                                            }}
                                        />
                                    </div>
                                    <div style={{ marginLeft: '15px' }}>
                                        <span style={{ marginRight: '5px' }}>
                                            Showing {filteredLogs.length} of {logs.length} log entries
                                        </span>
                                        <Button
                                            icon={<ReloadOutlined />}
                                            onClick={() => {
                                                setSelectedDb(null);
                                                setSearchText('');
                                            }}
                                        >
                                            Reset Filters
                                        </Button>
                                    </div>
                                </div>

                                <Table
                                    columns={columns}
                                    dataSource={filteredLogs}
                                    rowKey="uniqueId"
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
                        ) : (
                            selectedLogFile && (
                                <EmptyLogResults
                                    onRefresh={() => fetchParsedLogs(selectedNode as string, selectedLogFile)}
                                    fileName={selectedLogFile}
                                    threshold={slowQueryThreshold}
                                    onThresholdChange={setSlowQueryThreshold}
                                />
                            )
                        )}
                    </div>
                )}
            </div>

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
                            onClick={() => fetchParsedLogs(selectedNode as string, selectedLogFile as string)}
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
        </div>
    );
};

export default QueryAnalyzer;