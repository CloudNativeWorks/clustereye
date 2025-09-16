import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Select, Table, Badge, message, Modal, Steps, Row, Col, Card, Progress, Spin, Input, Pagination, Typography, TimePicker, Button, Statistic, Tooltip, Tag, Layout, Tabs, Space, Empty, Alert } from 'antd';
import axios from 'axios';
import { useLocation } from 'react-router-dom';
import { CopyOutlined, ReloadOutlined, InfoCircleOutlined, DownloadOutlined, DatabaseOutlined, BarChartOutlined, SettingOutlined, UserOutlined, TeamOutlined, RobotOutlined, FileSearchOutlined, DeleteOutlined, ClusterOutlined, FileTextOutlined, CaretDownOutlined, ClockCircleOutlined, CheckOutlined, CloseOutlined, EyeOutlined } from '@ant-design/icons';
import { Dayjs } from 'dayjs';
import CountUp from 'react-countup';
import MonacoEditor from './monacoeditor';
import { store } from './redux/store';
import { incrementUsage } from './redux/aiLimitSlice';
import PostgresIcon from './icons/postgresql';
import AIAnalysisRenderer from './components/AIAnalysisRenderer';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

// Custom styles for tabs
import './postgrepaTabs.css';

const { Option } = Select;
const { Step } = Steps;
const { Search } = Input;
const { Paragraph, Text } = Typography;

interface Database {
    datname: string;
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
    PGVersion: string;
}
interface ClusterData {
    [key: string]: Node[];
}

// New connection metrics interfaces
interface ConnectionMetricsData {
    _field: string;
    _measurement: string;
    _start: string;
    _stop: string;
    _time: string;
    _value: number;
    agent_id: string;
    host: string;
    metric_type: string;
    result: string;
    table: number;
    application?: string;
    database?: string;
}

interface ConnectionMetricsResponse {
    data: ConnectionMetricsData[];
    status: string;
}

// Transaction metrics interfaces
interface TransactionMetricsData {
    _field: string;
    _measurement: string;
    _start: string;
    _stop: string;
    _time: string;
    _value: number;
    agent_id: string;
    database: string;
    host: string;
    metric_type: string;
    result: string;
    table: number;
}

interface TransactionMetricsResponse {
    data: TransactionMetricsData[];
    status: string;
}

interface TransactionSummary {
    total_commits: number;
    total_rollbacks: number;
    commit_rate: number;
    rollback_rate: number;
    rollback_ratio: number;
    commit_rollback_ratio: number;
    timestamp: string;
}

interface TransactionByDatabase {
    database: string;
    commits: number;
    rollbacks: number;
    commit_rate: number;
    rollback_rate: number;
    rollback_ratio: number;
    timestamp: string;
}

interface TransactionChartData {
    time: number;
    formattedTime: string;
    [key: string]: number | string; // Dynamic database keys like "commits_dbname", "rollbacks_dbname"
}

interface ConnectionSummary {
    active: number;
    available: number;
    total: number;
    idle: number;
    idle_in_transaction: number;
    utilization_percent: number;
    max_connections: number;
    effective_max_connections: number;
    blocked: number;
    blocking: number;
    long_running_queries: number;
    timestamp: string;
}

interface ConnectionByApplication {
    application: string;
    count: number;
    timestamp: string;
}

interface ConnectionByDatabase {
    database: string;
    count: number;
    timestamp: string;
}

// Database size interfaces for capacity planning
interface DatabaseSizeData {
    _field: string;
    _measurement: string;
    _start: string;
    _stop: string;
    _time: string;
    _value: number;
    agent_id: string;
    database: string;
    host: string;
    metric_type: string;
    result: string;
    table: number;
}

interface DatabaseSizeResponse {
    data: DatabaseSizeData[];
    status: string;
}

interface DatabaseSizeSummary {
    database: string;
    size_bytes: number;
    size_mb: number;
    formatted_size: string;
    timestamp: string;
}

interface DatabaseSizeChartData {
    time: number;
    formattedTime: string;
    [key: string]: number | string; // Dynamic database keys
}

// Capacity prediction interfaces
interface DatabaseCapacityPrediction {
    database: string;
    period: string;
    current_size_mb: number;
    predicted_size_mb: number;
    growth_rate_mb_per_day: number;
    confidence_level: 'low' | 'medium' | 'high';
    volatility: 'low' | 'medium' | 'high';
}

// Lock metrics interfaces
interface LockMetricsData {
    _field: string;
    _measurement: string;
    _start: string;
    _stop: string;
    _time: string;
    _value: number;
    agent_id: string;
    host: string;
    metric_type: string;
    result: string;
    table: number;
    mode?: string;
}

interface LockMetricsResponse {
    data: LockMetricsData[];
    status: string;
}

interface LockSummary {
    total_waiting: number;
    total_granted: number;
    lock_contention_ratio: number;
    avg_waiting_locks: number;
    avg_granted_locks: number;
    max_waiting_locks: number;
    max_granted_locks: number;
    timestamp: string;
}

interface LockByMode {
    mode: string;
    waiting_count: number;
    granted_count: number;
    contention_ratio: number;
    timestamp: string;
}

// New interface for PostgreSQL index metrics data
interface IndexMetricsData {
    _field: string;
    _measurement: string;
    _start: string;
    _stop: string;
    _time: string;
    _value: number | string;
    agent_id: string;
    host: string;
    index: string;
    metric_type: string;
    result: string;
    schema: string;
    table: string;
}

interface IndexMetricsResponse {
    data: IndexMetricsData[];
    status: string;
}

interface IndexMetricsSummary {
    index: string;
    schema: string;
    table: string;
    scans: number;
    tuples_read: number;
    tuples_fetched: number;
    timestamp: string;
}

interface QueryResultDbStats {
    datid: number;
    datname: string;
    numbackends: number;
    xact_commit: number;
    xact_rollback: number;
    blks_read: number;
    blks_hit: number;
    tup_returned: number;
    tup_fetched: number;
    tup_inserted: number;
    tup_updated: number;
    tup_deleted: number;
    conflicts: number;
    temp_files: number;
    temp_bytes: number;
    deadlocks: number;
    blk_read_time: number;
    blk_write_time: number;
    stats_reset: string;
    // Ekstra alanlar için:
    // active_time, session_time, vb.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
}

interface QueryResultUnusedIndexes {

    indextype: string;
    schemaname: string;
    tablename: string;
    indexname: string;
    idx_columns: string;
    id_scan_count: number;
    index_size: number;
}

interface QueryResultIndexBloat {
    db_name: string;
    schema_name: string;
    table_name: string;
    index_name: string;
    num_rows: number;
    total_pages: number;
    expected_pages: number;
    bloat_pages: number;
    bloat_ratio: number;
    fragmentation_level: number;
}

interface QueryResultTableBloat {
    db_name: string;
    schema_name: string;
    table_name: string;
    num_rows: number;
    total_pages: number;
    table_size: number;
    dead_tuples: number;
    free_space: number;
    free_percent: number;
    bloat_ratio: number;
    fragmentation_level: number;
}


interface QueryResultCacheHitRatio {
    rolname: string;
    calls: number;
    shared_blks_hit: number;
    shared_blks_read: number;
    hit_cache_ratio: number;
    query: string;
}

interface QueryResultUserAccessList {
    username: string;
    isSuperuser: boolean;
}

interface QueryResultLongRunning {
    datName: string;
    pid: number;
    userName: string;
    applicationName: string;
    queryStart: string;
    state: string;
    waitEventType: string | null;
    waitEvent: string | null;
    query: string;
    duration: number;
}

interface QueryResultLock {
    waitingQuery: string;
    waitingPid: number;
    waitingQueryStart: string;
    waitingLockType: string;
    waitingLockMode: string;
    blockingQuery: string;
    blockingPid: number;
    blockingQueryStart: string;
    blockingLockType: string;
    blockingLockMode: string;
    blockingGranted: boolean;
    waitingClient: string | null;
    blockingClient: string | null;
}



interface QueryResult {
    total_connections?: number;
    non_idle_connections?: number;
    max_connections?: number;
    connections_utilization_pctg?: number;
    application_name?: string;
    state?: string;
    connection_count?: number;
    // Top CPU sorgusu için eklenen alanlar
    usename?: string;
    db_name?: string;
    total_time?: number;
    calls?: number;
    mean?: number;
    cpu_portion_pctg?: number;
    short_query?: string;
}

// Active Queries interfaces
interface ActiveQueryDetail {
    query: string;
    duration_seconds: number;
    database: string;
    username: string;
    application: string;
    state: string;
    wait_event_type: string;
    wait_event: string;
    timestamp: string;
}

interface ActiveQueryDetailsResponse {
    data: ActiveQueryDetail[];
    status: string;
}

interface ActiveQueryCountData {
    _field: string;
    _measurement: string;
    _start: string;
    _stop: string;
    _time: string;
    _value: number;
    agent_id: string;
    host: string;
    metric_type: string;
    result: string;
    table: number;
}

interface ActiveQueryCountResponse {
    data: ActiveQueryCountData[];
    status: string;
}

// Real-time Active Query interface (direct SQL query result)
interface RealTimeActiveQuery {
    database_name: string;
    username: string;
    application_name: string;
    client_addr: string;
    state: string;
    duration_seconds: number;
    wait_event_type: string | null;
    wait_event: string | null;
    query: string;
}

// Query History interfaces
interface QueryHistoryDetail {
    query: string;
    duration_seconds: number;
    database: string;
    username: string;
    application: string;
    pid: number;
    query_start: string;
    completion_time: string;
    timestamp: string;
}

interface QueryHistoryResponse {
    data: QueryHistoryDetail[];
    status: string;
}

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



const showCommandModal = (command: string) => {
    const commandString: string = command

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
                            color: '#722ed1'
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
                        content: `can you analyze this postgresql query? Please provide insights about the performance and any improvement recommendations. If there are performance problems, please suggest indexes that would improve the query also you can rewrite the query to be more efficient and give me the rewritten query using proper PostgreSQL syntax.\n\nQuery: ${commandString}`
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
                        <RobotOutlined style={{ fontSize: '20px', color: '#722ed1' }} />
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
                            backgroundColor: '#ffffff',
                            borderRadius: '8px',
                            maxHeight: '50vh',
                            overflowY: 'auto'
                        }}>
                            <AIAnalysisRenderer
                                content={data.choices[0].message.content}
                                dbType="postgres"
                            />
                        </div>

                        <div style={{
                            fontSize: '12px',
                            color: '#888',
                            textAlign: 'right',
                            marginTop: '8px',
                            borderTop: '1px solid #f0f0f0',
                            paddingTop: '8px'
                        }}>
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
                <FileSearchOutlined style={{ fontSize: '20px', color: '#722ed1' }} />
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
                        readOnly={true} // Salt okunur
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
                    onClick={handleAIAnalysis}
                    type="primary"
                    icon={<RobotOutlined />}
                    style={{
                        backgroundColor: '#722ed1',
                        borderColor: '#722ed1'
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

const roundDown = (value: number): string => {
    const factor = Math.pow(10, 2); // İki ondalık basamak için 10^2
    return (Math.floor(value * factor) / factor).toFixed(2);
};

const columns = [
    {
        title: 'Total Connections',
        dataIndex: 'total_connections',
        key: 'total_connections',
    },
    {
        title: 'Non-Idle Connections',
        dataIndex: 'non_idle_connections',
        key: 'non_idle_connections',
    },
    {
        title: 'Max Connections',
        dataIndex: 'max_connections',
        key: 'max_connections',
    },
    {
        title: 'Connections Utilization (%)',
        dataIndex: 'connections_utilization_pctg',
        key: 'connections_utilization_pctg',
    },
];

const columnsTopCpu = [
    {
        title: 'User Name',
        dataIndex: 'usename',
        key: 'usename',
    },
    {
        title: 'Database Name',
        dataIndex: 'db_name',
        key: 'db_name',
    },
    {
        title: 'Total Time',
        dataIndex: 'total_time',
        key: 'total_time',
    },
    {
        title: 'Calls',
        dataIndex: 'calls',
        key: 'calls',
    },
    {
        title: 'Mean (ms)',
        dataIndex: 'mean',
        key: 'mean',
    },
    {
        title: 'CPU Portion (%)',
        dataIndex: 'cpu_portion_pctg',
        key: 'cpu_portion_pctg',
    },
    {
        title: 'Query',
        dataIndex: 'short_query',
        key: 'short_query',
        render: (command: string) => (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>
                    {command.length > 20 ? command.substring(0, 40) + '...' : command}
                </span>
                <button onClick={() => showCommandModal(command)}>Show Query</button>
            </div>
        ),
    },
];

const columnsCacheHitRatio = [
    {
        title: 'User Name',
        dataIndex: 'rolname',
        key: 'rolname',
    },
    {
        title: 'Calls',
        dataIndex: 'calls',
        key: 'calls',
    },
    {
        title: 'Read From Cache',
        dataIndex: 'shared_blks_hit',
        key: 'shared_blks_hit',
    },
    {
        title: 'Read From Disk',
        dataIndex: 'shared_blks_read',
        key: 'shared_blks_read',
    },
    {
        title: 'Cache Hit Ratio',
        dataIndex: 'hit_cache_ratio',
        key: 'hit_cache_ratio',
        render: (text: number | null | undefined) => {
            return text !== null && text !== undefined ? roundDown(text) : '';
        },
    },
    {
        title: 'Query',
        dataIndex: 'query',
        key: 'query',
        render: (command: string) => (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>
                    {command.length > 20 ? command.substring(0, 40) + '...' : command}
                </span>
                <button onClick={() => showCommandModal(command)}>Show Query</button>
            </div>
        ),
    },
];

const columnsLongRunning = [
    {
        title: 'Duration',
        dataIndex: 'duration',
        key: 'duration',
    },
    {
        title: 'Database Name',
        dataIndex: 'datName',
        key: 'datName',
    },
    {
        title: 'PID',
        dataIndex: 'pid',
        key: 'pid',
    },
    {
        title: 'User Name',
        dataIndex: 'userName',
        key: 'userName',
    },
    {
        title: 'Application Name',
        dataIndex: 'applicationName',
        key: 'applicationName',
    },
    {
        title: 'Query Start',
        dataIndex: 'queryStart',
        key: 'queryStart',
    },
    {
        title: 'Wait Event Type',
        dataIndex: 'waitEventType',
        key: 'waitEventType',
    },
    {
        title: 'Wait Event',
        dataIndex: 'waitEvent',
        key: 'waitEvent',
    },
    {
        title: 'State',
        dataIndex: 'state',
        key: 'state',
    },
    {
        title: 'Query',
        dataIndex: 'query',
        key: 'query',
        render: (command: string) => (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>
                    {command.length > 20 ? command.substring(0, 40) + '...' : command}
                </span>
                <button onClick={() => showCommandModal(command)}>Show Query</button>
            </div>
        ),
    },
];

const columnsLocks = [
    {
        title: 'Waiting Query',
        dataIndex: 'waitingQuery',
        key: 'waitingQuery',
        render: (command: string) => (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>
                    {command.length > 20 ? command.substring(0, 40) + '...' : command}
                </span>
                <button onClick={() => showCommandModal(command)}>Show Query</button>
            </div>
        ),
    },
    {
        title: 'Waiting PID',
        dataIndex: 'waitingPid',
        key: 'waitingPid',
    },
    {
        title: 'Waiting Query Start',
        dataIndex: 'waitingQueryStart',
        key: 'waitingQueryStart',
    },
    {
        title: 'Waiting Lock Type',
        dataIndex: 'waitingLockType',
        key: 'waitingLockType',
    },
    {
        title: 'Waiting Lock Mode',
        dataIndex: 'waitingLockMode',
        key: 'waitingLockMode',
    },
    {
        title: 'Blocking Query',
        dataIndex: 'blockingQuery',
        key: 'blockingQuery',
        render: (command: string) => (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>
                    {command.length > 20 ? command.substring(0, 40) + '...' : command}
                </span>
                <button onClick={() => showCommandModal(command)}>Show Query</button>
            </div>
        ),
    },
    {
        title: 'Blocking PID',
        dataIndex: 'blockingPid',
        key: 'blockingPid',
    },
    {
        title: 'Blocking Query Start',
        dataIndex: 'blockingQueryStart',
        key: 'blockingQueryStart',
    },
    {
        title: 'Blocking Lock Type',
        dataIndex: 'blockingLockType',
        key: 'blockingLockType',
    },
    {
        title: 'Blocking Lock Mode',
        dataIndex: 'blockingLockMode',
        key: 'blockingLockMode',
    },
    {
        title: 'Blocking Granted',
        dataIndex: 'blockingGranted',
        key: 'blockingGranted',
        render: (granted: boolean) => (granted ? 'Yes' : 'No'),
    },
    {
        title: 'Waiting Client',
        dataIndex: 'waitingClient',
        key: 'waitingClient',
    },
    {
        title: 'Blocking Client',
        dataIndex: 'blockingClient',
        key: 'blockingClient',
    },
];


const columnsNonIdleConns = [
    {
        title: 'Application Name',
        dataIndex: 'application_name',
        key: 'application_name',
    },
    {
        title: 'State',
        dataIndex: 'state',
        key: 'state',
    },
    {
        title: 'Connection Count',
        dataIndex: 'connection_count',
        key: 'connection_count',
    },
];

const UserAccessListColumns = [
    {
        title: 'User Name',
        dataIndex: 'username',
        key: 'username'
    },
    {
        title: 'Super User',
        dataIndex: 'isSuperuser',
        key: 'isSuperuser',
        render: (isSuperuser: boolean) => {
            return isSuperuser ? <Tag color="blue">Yes</Tag> : <Tag color="green">No</Tag>;
        },
    },
];

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

interface HistoricalCpuData {
    _field: string;
    _measurement: string;
    _start: string;
    _stop: string;
    _time: string;
    _value: number;
    agent_id: string;
    host: string;
    metric_type: string;
    result: string;
    table: number;
}

interface HistoricalCpuResponse {
    data: HistoricalCpuData[];
    status: string;
}

// Cache Hit Ratio metrics interfaces
interface CacheHitMetricsData {
    _field: string;
    _measurement: string;
    _start: string;
    _stop: string;
    _time: string;
    _value: number;
    agent_id: string;
    database: string;
    host: string;
    metric_type: string;
    result: string;
    table: number;
}

interface CacheHitMetricsResponse {
    data: {
        raw_data: CacheHitMetricsData[];
    };
    summary: {
        avg_cache_hit_ratio_percent: number;
        latest_cache_hit_ratio_percent: number;
        total_measurements: number;
    };
    status: string;
}

interface CacheHitSummary {
    total_blocks_hit: number;
    total_blocks_read: number;
    cache_hit_ratio: number;
    avg_cache_hit_ratio: number;
    timestamp: string;
}

interface CacheHitByDatabase {
    database: string;
    blocks_hit: number;
    blocks_read: number;
    cache_hit_ratio: number;
    timestamp: string;
}

// Deadlocks metrics interfaces
interface DeadlocksMetricsData {
    _field: string;
    _measurement: string;
    _start: string;
    _stop: string;
    _time: string;
    _value: number;
    agent_id: string;
    database: string;
    host: string;
    metric_type: string;
    result: string;
    table: number;
}

interface DeadlocksMetricsResponse {
    data: DeadlocksMetricsData[];
    status: string;
}

interface DeadlocksSummary {
    total_deadlocks: number;
    current_deadlocks: number;
    deadlock_rate: number;
    avg_deadlocks_per_hour: number;
    timestamp: string;
}

interface DeadlocksByDatabase {
    database: string;
    deadlocks: number;
    deadlock_rate: number;
    timestamp: string;
}

// Replication metrics interfaces
interface ReplicationMetricsData {
    _field: string;
    _measurement: string;
    _start: string;
    _stop: string;
    _time: string;
    _value: number | string;
    agent_id: string;
    client_addr: string;
    host: string;
    metric_type: string;
    result: string;
    state: string;
    table: number;
}

interface ReplicationMetricsResponse {
    data: ReplicationMetricsData[];
    status: string;
}

interface ReplicationSummary {
    avg_write_lag: number;
    avg_flush_lag: number;
    avg_replay_lag: number;
    max_write_lag: number;
    max_flush_lag: number;
    max_replay_lag: number;
    total_replicas: number;
    healthy_replicas: number;
    timestamp: string;
}

interface ReplicationByReplica {
    client_addr: string;
    state: string;
    write_lag: number;
    flush_lag: number;
    replay_lag: number;
    max_lag: number;
    status: 'healthy' | 'warning' | 'critical';
    timestamp: string;
}

const PostgrePA: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [loadingClusterName, setLoadingClusterName] = useState(false);
    const [loadingPgLogs, setLoadingPgLogs] = useState(false);
    const [clusterNames, setClusterNames] = useState<string[]>([]); // Tüm cluster isimleri
    const [nodeName, setNodeName] = useState(''); // Initial empty, will be set in useEffect
    const [data, setData] = useState<Record<string, Node[]>>({}); // API'den gelen veri yapısına uygun tip
    const [nodeInfo, setNodeInfo] = useState<{ name: string; status: string; PGVersion: string }[]>([]);
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const clusterNameFromURL = queryParams.get('clusterName') || '';
    const hostNameFromURL = queryParams.get('hostName') || '';
    const [clusterName, setClusterName] = useState(clusterNameFromURL);
    const [queryResults, setQueryResults] = useState<QueryResult[]>([]);
    const [queryResultsNonIdleConns, setQueryResultsNonIdleConns] = useState<QueryResult[]>([]);
    const [queryResultsCacheHitRatio, setQueryResultsCacheHitRatio] = useState<QueryResultCacheHitRatio[]>([]);
    const [queryResultsUserAccessList, setQueryResultsUserAccessList] = useState<QueryResultUserAccessList[]>([]);
    const [queryResultsLongRunning, setQueryResultsLongRunning] = useState<QueryResultLongRunning[]>([]);
    const [queryResultsLocks, setQueryResultsLocks] = useState<QueryResultLock[]>([]);
    const [queryResultsUnusedIndexes, setQueryResultsUnusedIndexes] = useState<QueryResultUnusedIndexes[]>([]);
    const [queryResultsIndexBloat, setQueryResultsIndexBloat] = useState<QueryResultIndexBloat[]>([]);
    const [queryResultsTableBloat, setQueryResultsTableBloat] = useState<QueryResultTableBloat[]>([]);
    const [queryResultsDbStats, setQueryResultsDbStats] = useState<QueryResultDbStats[]>([]);
    const [queryResultsTopCpu, setQueryResultsTopCpu] = useState<QueryResult[]>([]);
    
    // Database size state variables for capacity planning
    const [databaseSizeData, setDatabaseSizeData] = useState<DatabaseSizeSummary[]>([]);
    const [databaseSizeChartData, setDatabaseSizeChartData] = useState<DatabaseSizeChartData[]>([]);
    const [databaseCapacityPredictions, setDatabaseCapacityPredictions] = useState<DatabaseCapacityPrediction[]>([]);
    const [isLoadingDatabaseSize, setIsLoadingDatabaseSize] = useState(false);
    const [isLoadingQueryResults, setIsLoadingQueryResults] = useState(true);
    const [isLoadingLongRunningQueryResults, setIsLoadingLongRunningQueryResults] = useState(false);
    const [isLoadingLocksQueryResults, setIsLoadingLocksQueryResults] = useState(false);
    const [isLoadingNonIdleQueryResults, setIsLoadingNonIdleQueryResults] = useState(true);
    const [isLoadingCacheHitQueryResults, setIsLoadingCacheHitQueryResults] = useState(true);
    const [isLoadingTopCpuResults, setIsLoadingTopCpuResults] = useState(false);
    const [isLoadingUserAccessListResults, setIsLoadingUserAccessListResults] = useState(true);
    const [isLoadingUnusedIndexesResults, setIsLoadingUnusedIndexesResults] = useState(true);
    const [isLoadingIndexBloatResults, setIsLoadingIndexBloatResults] = useState(true);
    const [isLoadingTableBloatResults, setIsLoadingTableBloatResults] = useState(true);
    const [isLoadingDbStatsResults, setIsLoadingDbStatsResults] = useState(true);
    const [selectedFullPath, setSelectedFullPath] = useState<string | null>(null);
    const [currentStep, setCurrentStep] = useState(0);
    const [activeTab, setActiveTab] = useState('1'); // Set initial active tab to '1' for Connections tab
    const [selectedDatabase, setSelectedDatabase] = useState('postgres');
    const [databaseNames, setDatabaseNames] = useState<string[]>([]);
    const [pgLogFiles, setPgLogFiles] = useState<LogFile[]>([]);
    const [startTime, setStartTime] = useState<Dayjs | null>(null);
    const [endTime, setEndTime] = useState<Dayjs | null>(null);
    const [filter, setFilter] = useState('ALL');
    const [logContent, setLogContent] = useState<string>('');
    const [refreshInterval, setRefreshInterval] = useState(0);
    const [countdown, setCountdown] = useState(refreshInterval);
    const [searchText, setSearchText] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const linesPerPage = 200;
    const [minDuration, setMinDuration] = useState('');
    // Prevent duplicate API calls
    const [manualNodeChangeInProgress, setManualNodeChangeInProgress] = useState(false);

    // Yeni state değişkenleri
    const [selectedSubMenu, setSelectedSubMenu] = useState<string>('connections'); // Default to connections
    const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
    const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
    const [isLoadingDatabases, setIsLoadingDatabases] = useState<boolean>(false);

    // Historical CPU data states
    const [historicalCpuData, setHistoricalCpuData] = useState<HistoricalCpuData[]>([]);
    const [isLoadingHistoricalCpu, setIsLoadingHistoricalCpu] = useState(false);
    const [cpuTimeRange, setCpuTimeRange] = useState('1h');
    const [currentCpuUsage, setCurrentCpuUsage] = useState<number>(0);

    // New connection metrics states
    const [connectionMetrics, setConnectionMetrics] = useState<ConnectionMetricsData[]>([]);
    const [connectionSummary, setConnectionSummary] = useState<ConnectionSummary | null>(null);
    const [connectionsByApplication, setConnectionsByApplication] = useState<ConnectionByApplication[]>([]);
    const [connectionsByDatabase, setConnectionsByDatabase] = useState<ConnectionByDatabase[]>([]);
    const [connectionTimeRange, setConnectionTimeRange] = useState('1h');
    const [isLoadingConnectionMetrics, setIsLoadingConnectionMetrics] = useState(false);
    const [connectionHistoricalData, setConnectionHistoricalData] = useState<ConnectionMetricsData[]>([]);

    // Lock metrics states
    const [lockMetrics, setLockMetrics] = useState<LockMetricsData[]>([]);
    const [lockSummary, setLockSummary] = useState<LockSummary | null>(null);
    const [lockByMode, setLockByMode] = useState<LockByMode[]>([]);
    const [lockTimeRange, setLockTimeRange] = useState('1h');
    const [isLoadingLockMetrics, setIsLoadingLockMetrics] = useState(false);
    const [lockHistoricalData, setLockHistoricalData] = useState<LockMetricsData[]>([]);

    // Transaction metrics states
    const [transactionMetrics, setTransactionMetrics] = useState<TransactionMetricsData[]>([]);
    const [transactionSummary, setTransactionSummary] = useState<TransactionSummary | null>(null);
    const [transactionsByDatabase, setTransactionsByDatabase] = useState<TransactionByDatabase[]>([]);
    const [transactionTimeRange, setTransactionTimeRange] = useState('1h');
    const [isLoadingTransactionMetrics, setIsLoadingTransactionMetrics] = useState(false);
    const [transactionHistoricalData, setTransactionHistoricalData] = useState<TransactionChartData[]>([]);

    // Cache Hit Ratio metrics states
    const [cacheHitMetrics, setCacheHitMetrics] = useState<CacheHitMetricsData[]>([]);
    const [cacheHitSummary, setCacheHitSummary] = useState<CacheHitSummary | null>(null);
    const [cacheHitByDatabase, setCacheHitByDatabase] = useState<CacheHitByDatabase[]>([]);
    const [cacheHitTimeRange, setCacheHitTimeRange] = useState('1h');
    const [isLoadingCacheHitMetrics, setIsLoadingCacheHitMetrics] = useState(false);
    const [cacheHitHistoricalData, setCacheHitHistoricalData] = useState<CacheHitMetricsData[]>([]);

    // Deadlocks metrics states
    const [deadlocksMetrics, setDeadlocksMetrics] = useState<DeadlocksMetricsData[]>([]);
    const [deadlocksSummary, setDeadlocksSummary] = useState<DeadlocksSummary | null>(null);
    const [deadlocksByDatabase, setDeadlocksByDatabase] = useState<DeadlocksByDatabase[]>([]);
    const [deadlocksTimeRange, setDeadlocksTimeRange] = useState('1h');
    const [isLoadingDeadlocksMetrics, setIsLoadingDeadlocksMetrics] = useState(false);
    const [deadlocksHistoricalData, setDeadlocksHistoricalData] = useState<DeadlocksMetricsData[]>([]);

    // Replication metrics states
    const [replicationMetrics, setReplicationMetrics] = useState<ReplicationMetricsData[]>([]);
    const [replicationSummary, setReplicationSummary] = useState<ReplicationSummary | null>(null);
    const [replicationByReplica, setReplicationByReplica] = useState<ReplicationByReplica[]>([]);
    const [replicationTimeRange, setReplicationTimeRange] = useState('1h');
    const [isLoadingReplicationMetrics, setIsLoadingReplicationMetrics] = useState(false);
    const [replicationHistoricalData, setReplicationHistoricalData] = useState<ReplicationMetricsData[]>([]);
    
    // Index metrics states
    const [indexMetrics, setIndexMetrics] = useState<IndexMetricsData[]>([]);
    const [indexMetricsSummaries, setIndexMetricsSummaries] = useState<IndexMetricsSummary[]>([]);
    const [indexTimeRange, setIndexTimeRange] = useState('1h');
    const [isLoadingIndexMetrics, setIsLoadingIndexMetrics] = useState(false);

    // Active queries states
    // Real-time Active Queries state (direct SQL)
    const [realTimeActiveQueries, setRealTimeActiveQueries] = useState<RealTimeActiveQuery[]>([]);
    const [isLoadingRealTimeActiveQueries, setIsLoadingRealTimeActiveQueries] = useState(false);
    
    // Query History state
    const [queryHistoryDetails, setQueryHistoryDetails] = useState<QueryHistoryDetail[]>([]);
    const [queryHistoryTimeRange, setQueryHistoryTimeRange] = useState('5m');
    const [isLoadingQueryHistory, setIsLoadingQueryHistory] = useState(false);

    // Add isFirstRender at component top level, not inside useEffect
    const isFirstRender = useRef(true);
    const previousNodeRef = useRef<string>('');

    // Table bloat recommendation modal function
    const showTableBloatRecommendationModal = (record: QueryResultTableBloat) => {
        // Copy function for commands
        const copyCommand = (command: string) => {
            navigator.clipboard.writeText(command).then(() => {
                message.success('Command copied to clipboard!');
            }).catch(() => {
                message.error('Failed to copy command');
            });
        };

        // Commands for different cleanup methods
        const commands = [
            {
                title: 'VACUUM',
                description: 'Removes dead tuples but doesn\'t reclaim disk space',
                command: `VACUUM ${record.schema_name}.${record.table_name};`,
                color: '#52c41a',
                icon: '🧹'
            },
            {
                title: 'VACUUM FULL',
                description: 'Reduces physical table size but requires exclusive lock',
                command: `VACUUM FULL ${record.schema_name}.${record.table_name};`,
                color: '#fa8c16',
                icon: '🔧'
            },
            {
                title: 'CLUSTER',
                description: 'Rewrites table according to an index. Cleans bloat but requires lock',
                command: `CLUSTER ${record.schema_name}.${record.table_name} USING ${record.table_name}_pkey;`,
                color: '#1890ff',
                icon: '⚡'
            },
            {
                title: 'pg_repack (Recommended)',
                description: 'Preferred for cleaning bloat without downtime',
                command: `pg_repack -t ${record.schema_name}.${record.table_name} -d ${selectedDatabase}`,
                color: '#722ed1',
                icon: '🚀'
            }
        ];

        // Recommendation based on bloat ratio
        const getRecommendation = (bloatRatio: number) => {
            if (bloatRatio < 10) {
                return { text: 'VACUUM is sufficient', color: '#52c41a', icon: '✅' };
            } else if (bloatRatio <= 25) {
                return { text: 'Consider VACUUM FULL', color: '#fa8c16', icon: '⚠️' };
            } else {
                return { text: 'Use pg_repack (no downtime)', color: '#f5222d', icon: '🚨' };
            }
        };

        const recommendation = getRecommendation(record.bloat_ratio);

        Modal.info({
            title: (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    fontSize: '18px',
                    fontWeight: 600
                }}>
                    <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #722ed1 0%, #531dab 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '20px'
                    }}>
                        🧹
                    </div>
                    Table Bloat Cleanup Recommendations
                </div>
            ),
            content: (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '24px',
                    padding: '8px 0'
                }}>
                    {/* Table Information */}
                    <div style={{
                        background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                        borderRadius: '12px',
                        padding: '20px',
                        border: '1px solid #bae7ff'
                    }}>
                        <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: '#0958d9' }}>
                            📊 Table Information
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '14px' }}>
                            <div><strong>Table:</strong> {record.schema_name}.{record.table_name}</div>
                            <div><strong>Rows:</strong> {record.num_rows.toLocaleString()}</div>
                            <div><strong>Table Size:</strong> {formatBytes(record.table_size)}</div>
                            <div><strong>Dead Tuples:</strong> {record.dead_tuples.toLocaleString()}</div>
                            <div><strong>Free Space:</strong> {formatBytes(record.free_space)} ({record.free_percent.toFixed(2)}%)</div>
                            <div><strong>Bloat Ratio:</strong> <span style={{ color: recommendation.color, fontWeight: 600 }}>{record.bloat_ratio.toFixed(2)}%</span></div>
                        </div>
                    </div>

                    {/* Recommendation */}
                    <div style={{
                        background: `linear-gradient(135deg, ${recommendation.color}15 0%, ${recommendation.color}08 100%)`,
                        borderRadius: '12px',
                        padding: '16px',
                        border: `1px solid ${recommendation.color}40`
                    }}>
                        <div style={{ 
                            fontSize: '16px', 
                            fontWeight: 600, 
                            color: recommendation.color,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}>
                            <span style={{ fontSize: '20px' }}>{recommendation.icon}</span>
                            Recommendation: {recommendation.text}
                        </div>
                        <div style={{ marginTop: '8px', fontSize: '14px', color: '#666' }}>
                            {record.bloat_ratio > 25 ? 
                                'High bloat detected! Consider immediate action to prevent performance degradation.' :
                                record.bloat_ratio > 10 ?
                                'Moderate bloat detected. Plan for cleanup during maintenance window.' :
                                'Low bloat level. Regular VACUUM should be sufficient.'
                            }
                        </div>
                    </div>

                    {/* Commands */}
                    <div>
                        <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', color: '#262626' }}>
                            🛠️ Cleanup Commands
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {commands.map((cmd, index) => (
                                <div key={index} style={{
                                    background: `linear-gradient(135deg, ${cmd.color}10 0%, ${cmd.color}05 100%)`,
                                    borderRadius: '8px',
                                    padding: '16px',
                                    border: `1px solid ${cmd.color}30`,
                                    transition: 'all 0.2s ease'
                                }}>
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'flex-start',
                                        marginBottom: '8px'
                                    }}>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px'
                                        }}>
                                            <span style={{ fontSize: '18px' }}>{cmd.icon}</span>
                                            <span style={{ 
                                                fontSize: '14px', 
                                                fontWeight: 600, 
                                                color: cmd.color 
                                            }}>
                                                {cmd.title}
                                            </span>
                                        </div>
                                        <Button
                                            size="small"
                                            icon={<CopyOutlined />}
                                            onClick={() => copyCommand(cmd.command)}
                                            style={{
                                                borderColor: cmd.color,
                                                color: cmd.color
                                            }}
                                        >
                                            Copy
                                        </Button>
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                                        {cmd.description}
                                    </div>
                                    <div style={{
                                        background: '#f6f6f6',
                                        borderRadius: '6px',
                                        padding: '12px',
                                        fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                                        fontSize: '13px',
                                        color: '#2c2c2c',
                                        border: '1px solid #e8e8e8',
                                        wordBreak: 'break-all'
                                    }}>
                                        {cmd.command}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Best Practices */}
                    <div style={{
                        background: 'linear-gradient(135deg, #f6ffed 0%, #f0f9e8 100%)',
                        borderRadius: '12px',
                        padding: '20px',
                        border: '1px solid #b7eb8f'
                    }}>
                        <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: '#389e0d' }}>
                            💡 Best Practices
                        </div>
                        <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: '#262626' }}>
                            <li style={{ marginBottom: '8px' }}>If bloat ratio &lt; 10%: VACUUM is sufficient</li>
                            <li style={{ marginBottom: '8px' }}>If bloat ratio 10-25%: Consider VACUUM FULL during maintenance window</li>
                            <li style={{ marginBottom: '8px' }}>If bloat ratio &gt; 25%: Use pg_repack (no downtime required)</li>
                            <li style={{ marginBottom: '8px' }}>In production: Always prefer pg_repack to avoid locks</li>
                            <li>Schedule regular VACUUM operations to prevent future bloat</li>
                        </ul>
                    </div>
                </div>
            ),
            width: '90%',
            style: { top: '20px' },
            className: 'table-bloat-recommendations-modal',
            maskClosable: true,
            okText: 'Close'
        });
    };

    const formatLogContent = (content: string) => {
        return content.split('\n')
            .filter(line => {
                if (filter === 'ERROR' && !line.includes('ERROR')) return false;
                if (filter === 'WARN' && !line.includes('WARN')) return false;
                if (filter === 'FATAL' && !line.includes('FATAL')) return false;
                if (searchText && !line.toLowerCase().includes(searchText.toLowerCase())) return false;
                // Duration filtresi
                const durationMatch = line.match(/duration: ([\d.]+) ms/);
                if (durationMatch && minDuration) {
                    const duration = parseFloat(durationMatch[1]);
                    return duration > parseFloat(minDuration);
                }

                return true;
            })
            .map((line, index) => {
                const datePattern = /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/;
                let formattedLine = line.replace(datePattern, match => `<span style="color: blue;">${match}</span>`);

                formattedLine = formattedLine
                    .replace(/ERROR/g, '<span style="color: red;">ERROR</span>')
                    .replace(/WARN/g, '<span style="color: orange;">WARN</span>')
                    .replace(/FATAL/g, '<span style="color: red;">FATAL</span>');
                return `<div>${index + 1}: ${formattedLine}</div>`;
            })
            .join('\n');
    };
    const formattedContent = formatLogContent(logContent);

    const paginatedContent = () => {
        const start = (currentPage - 1) * linesPerPage;
        const end = start + linesPerPage;
        return formattedContent.split('\n').slice(start, end).join('\n');
    };

    const totalLines = formattedContent.split('\n').length;

    const createMarkup = () => ({ __html: paginatedContent() });

    // Fetch real-time active queries using direct SQL
    const fetchRealTimeActiveQueries = async (nodeName: string) => {
        setIsLoadingRealTimeActiveQueries(true);
        
        try {
            const agentId = `agent_${nodeName}`;
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
                    query_id: 'pg_active_queries',
                    command: `SELECT 
                        datname AS database_name,
                        usename AS username,
                        application_name,
                        client_addr,
                        state,
                        EXTRACT(EPOCH FROM (NOW() - query_start)) AS duration_seconds,
                        wait_event_type,
                        wait_event,
                        CASE 
                            WHEN query IS NULL THEN 'NULL_QUERY'
                            WHEN LENGTH(TRIM(query)) = 0 THEN 'EMPTY_QUERY'
                            ELSE query
                        END AS query
                    FROM pg_stat_activity
                    WHERE state = 'active' and usename!='replicator'
                      AND pid <> pg_backend_pid()
                      AND query NOT LIKE '%pg_stat_activity%'
                    ORDER BY duration_seconds DESC`
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
                        const queryResults: RealTimeActiveQuery[] = [];

                        // Check if query returned any rows
                        if (parsedResult.rows_returned === 0 || parsedResult.message) {
                            // No active queries found
                            setRealTimeActiveQueries([]);
                            return;
                        }

                        // Check if it's a single result object or multiple results
                        if (parsedResult.row_count !== undefined) {
                            // Multiple results format
                            const rowCount = parsedResult.row_count || 0;
                            for (let i = 0; i < rowCount; i++) {
                                queryResults.push({
                                    database_name: parsedResult[`database_name_${i}`] || '',
                                    username: parsedResult[`username_${i}`] || '',
                                    application_name: parsedResult[`application_name_${i}`] || '',
                                    client_addr: parsedResult[`client_addr_${i}`] || '',
                                    state: parsedResult[`state_${i}`] || '',
                                    duration_seconds: parseFloat(parsedResult[`duration_seconds_${i}`]) || 0,
                                    wait_event_type: parsedResult[`wait_event_type_${i}`] || null,
                                    wait_event: parsedResult[`wait_event_${i}`] || null,
                                    query: parsedResult[`query_${i}`] || ''
                                });
                            }
                        } else if (parsedResult.database_name !== undefined && parsedResult.query !== undefined) {
                            // Single result format - only add if we have actual query data
                            queryResults.push({
                                database_name: parsedResult.database_name || '',
                                username: parsedResult.username || '',
                                application_name: parsedResult.application_name || '',
                                client_addr: parsedResult.client_addr || '',
                                state: parsedResult.state || '',
                                duration_seconds: parseFloat(parsedResult.duration_seconds) || 0,
                                wait_event_type: parsedResult.wait_event_type || null,
                                wait_event: parsedResult.wait_event || null,
                                query: parsedResult.query || ''
                            });
                        }

                        setRealTimeActiveQueries(queryResults);
                    } catch (error) {
                        console.error('Error parsing active queries result:', error);
                        setRealTimeActiveQueries([]);
                    }
                } else {
                    console.error('Unexpected result type:', result.type_url);
                    setRealTimeActiveQueries([]);
                }
            } else {
                console.error('Invalid response format:', data);
                setRealTimeActiveQueries([]);
            }
        } catch (error) {
            console.error('Error fetching real-time active queries:', error);
            setRealTimeActiveQueries([]);
        } finally {
            setIsLoadingRealTimeActiveQueries(false);
        }
    };

    const fetchQueryHistory = async (nodeName: string, range: string = queryHistoryTimeRange) => {
        const agentId = `agent_${nodeName.replace(/\./g, '-')}`;
        setIsLoadingQueryHistory(true);
        
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(
                `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/metrics/postgresql/performance/query-history?agent_id=${agentId}&range=${range}`,
                { 
                    credentials: 'include',
                    headers: {
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    }
                }
            );

            if (!response.ok) {
                throw new Error('Failed to fetch query history');
            }

            const data: QueryHistoryResponse = await response.json();
            
            if (data.status === 'success' && data.data) {
                setQueryHistoryDetails(data.data);
            } else {
                setQueryHistoryDetails([]);
            }
        } catch (error) {
            console.error('Error fetching query history:', error);
            setQueryHistoryDetails([]);
        } finally {
            setIsLoadingQueryHistory(false);
        }
    };

    const fetchQueryResults = async (nodeName: string) => {
        try {
            setIsLoadingQueryResults(true)
            const agentId = `agent_${nodeName}`;
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
                    query_id: 'pg_connstats',
                    command: `SELECT
                        A.total_connections,
                        A.non_idle_connections,
                        B.max_connections,
                        ROUND((100 * A.total_connections::NUMERIC / B.max_connections::NUMERIC), 2) AS connections_utilization_pctg
                    FROM
                        (SELECT COUNT(1) AS total_connections, SUM(CASE WHEN state != 'idle' THEN 1 ELSE 0 END) AS non_idle_connections FROM pg_stat_activity) A,
                        (SELECT setting AS max_connections FROM pg_settings WHERE name = 'max_connections') B;`
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

                        // Sorgu sonucunu array formatına dönüştür
                        const queryResult = {
                            total_connections: parsedResult.total_connections || 0,
                            non_idle_connections: parsedResult.non_idle_connections || 0,
                            max_connections: parsedResult.max_connections || 0,
                            connections_utilization_pctg: parsedResult.connections_utilization_pctg || 0
                        };

                        // Array formatında state'e kaydet
                        setQueryResults([queryResult]);
                    } catch (error) {
                        console.error('Error parsing result:', error);
                    }
                } else {
                    console.error('Unexpected result type:', result.type_url);
                }
            } else {
                console.error('Invalid response format:', data);
            }
            setIsLoadingQueryResults(false);
        } catch (error) {
            console.error('Error fetching data:', error);
            setIsLoadingQueryResults(false);
        }
    };

    const fetchQueryNonIdleConnsResults = async (nodeName: string) => {
        try {
            setIsLoadingNonIdleQueryResults(true)
            const agentId = `agent_${nodeName}`;
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
                    query_id: 'pg_conns_appname',
                    command: `SELECT 
                        application_name, 
                        state, 
                        COUNT(*) AS connection_count
                    FROM pg_stat_activity
                    WHERE application_name IS NOT NULL
                    GROUP BY application_name, state
                    ORDER BY application_name, state;`
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

                        // Yeni veri yapısını işle
                        const queryResult = [];
                        const rowCount = parsedResult.row_count || 0;

                        for (let i = 0; i < rowCount; i++) {
                            if (parsedResult[`application_name_${i}`] !== '') {
                                queryResult.push({
                                    application_name: parsedResult[`application_name_${i}`],
                                    state: parsedResult[`state_${i}`],
                                    connection_count: parseInt(parsedResult[`connection_count_${i}`]) || 0
                                });
                            }
                        }

                        setQueryResultsNonIdleConns(queryResult);
                    } catch (error) {
                        console.error('Error parsing result:', error);
                    }
                } else {
                    console.error('Unexpected result type:', result.type_url);
                }
            } else {
                console.error('Invalid response format:', data);
            }
            setIsLoadingNonIdleQueryResults(false);
        } catch (error) {
            console.error('Error fetching data:', error);
            setIsLoadingNonIdleQueryResults(false);
        }
    };

    const fetchQueryCacheHitRatioResults = async (nodeName: string) => {
        try {
            setIsLoadingCacheHitQueryResults(true);
            const agentId = `agent_${nodeName}`;

            const query = `
                WITH statements AS (
                    SELECT * FROM pg_stat_statements pss
                    JOIN pg_roles pr ON (userid=oid)
                )
                SELECT rolname, calls, 
                    shared_blks_hit,
                    shared_blks_read,
                    shared_blks_hit/(shared_blks_hit+shared_blks_read)::NUMERIC*100 hit_cache_ratio,
                    query
                FROM statements
                WHERE calls > 0
                AND shared_blks_hit > 0
                ORDER BY calls DESC, hit_cache_ratio ASC
                LIMIT 5;
            `;

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
                    query_id: 'pg_cachehitratio',
                    command: query,
                    database: 'postgres'
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

                        // Hata kontrolü
                        if (parsedResult.status === 'error' && parsedResult.message && parsedResult.message.includes('pg_stat_statements')) {
                            // pg_stat_statements extension'ı yüklü değil
                            message.error({
                                content: (
                                    <div>
                                        <p><strong>Error:</strong> pg_stat_statements extension is not installed.</p>
                                        <p>To install the extension, run the following SQL command as a superuser:</p>
                                        <pre style={{ background: '#f5f5f5', padding: '10px', borderRadius: '4px' }}>
                                            CREATE EXTENSION pg_stat_statements;
                                        </pre>
                                        <p>After installation, you may need to restart the PostgreSQL server.</p>
                                    </div>
                                ),
                                duration: 10
                            });
                            setQueryResultsCacheHitRatio([]);
                            setIsLoadingCacheHitQueryResults(false);
                            return;
                        }

                        // Sorgu sonucunu array formatına dönüştür
                        const queryResult: QueryResultCacheHitRatio[] = [];

                        // Agent'dan gelen yanıt formatı farklı olabilir
                        if (parsedResult.status === 'success' && parsedResult.row_count > 0) {
                            // Standart format
                            const rowCount = parsedResult.row_count || 0;

                            for (let i = 0; i < rowCount; i++) {
                                if (parsedResult[`rolname_${i}`] !== '') {
                                    queryResult.push({
                                        rolname: parsedResult[`rolname_${i}`],
                                        calls: parseInt(parsedResult[`calls_${i}`]) || 0,
                                        shared_blks_hit: parseInt(parsedResult[`shared_blks_hit_${i}`]) || 0,
                                        shared_blks_read: parseInt(parsedResult[`shared_blks_read_${i}`]) || 0,
                                        hit_cache_ratio: parseFloat(parsedResult[`hit_cache_ratio_${i}`]) || 0,
                                        query: parsedResult[`query_${i}`]
                                    });
                                }
                            }
                        } else if (parsedResult.status === 'success' && parsedResult.rows && parsedResult.rows.length > 0) {
                            // Alternatif format - rows array'i içinde
                            parsedResult.rows.forEach((row: any) => {
                                queryResult.push({
                                    rolname: row.rolname || '',
                                    calls: parseInt(row.calls) || 0,
                                    shared_blks_hit: parseInt(row.shared_blks_hit) || 0,
                                    shared_blks_read: parseInt(row.shared_blks_read) || 0,
                                    hit_cache_ratio: parseFloat(row.hit_cache_ratio) || 0,
                                    query: row.query || ''
                                });
                            });
                        } else if (parsedResult.status === 'success' && parsedResult.data && parsedResult.data.length > 0) {
                            // Başka bir alternatif format - data array'i içinde
                            parsedResult.data.forEach((row: any) => {
                                queryResult.push({
                                    rolname: row.rolname || '',
                                    calls: parseInt(row.calls) || 0,
                                    shared_blks_hit: parseInt(row.shared_blks_hit) || 0,
                                    shared_blks_read: parseInt(row.shared_blks_read) || 0,
                                    hit_cache_ratio: parseFloat(row.hit_cache_ratio) || 0,
                                    query: row.query || ''
                                });
                            });
                        } else if (parsedResult.status === 'success' && parsedResult.result && parsedResult.result.length > 0) {
                            // Başka bir alternatif format - result array'i içinde
                            parsedResult.result.forEach((row: any) => {
                                queryResult.push({
                                    rolname: row.rolname || '',
                                    calls: parseInt(row.calls) || 0,
                                    shared_blks_hit: parseInt(row.shared_blks_hit) || 0,
                                    shared_blks_read: parseInt(row.shared_blks_read) || 0,
                                    hit_cache_ratio: parseFloat(row.hit_cache_ratio) || 0,
                                    query: row.query || ''
                                });
                            });
                        } else if (parsedResult.status === 'success' && parsedResult.map) {
                            // Map formatı - doğrudan map içinde
                            const row = parsedResult.map;
                            queryResult.push({
                                rolname: row.rolname || '',
                                calls: parseInt(row.calls) || 0,
                                shared_blks_hit: parseInt(row.shared_blks_hit) || 0,
                                shared_blks_read: parseInt(row.shared_blks_read) || 0,
                                hit_cache_ratio: parseFloat(row.hit_cache_ratio) || 0,
                                query: row.query || ''
                            });
                        } else if (parsedResult.status === 'success') {
                            // Doğrudan nesne formatı - console'da gördüğümüz format
                            // Bu durumda parsedResult'ın kendisi bir nesne olabilir
                            if (parsedResult.rolname) {
                                queryResult.push({
                                    rolname: parsedResult.rolname || '',
                                    calls: parseInt(parsedResult.calls) || 0,
                                    shared_blks_hit: parseInt(parsedResult.shared_blks_hit) || 0,
                                    shared_blks_read: parseInt(parsedResult.shared_blks_read) || 0,
                                    hit_cache_ratio: parseFloat(parsedResult.hit_cache_ratio) || 0,
                                    query: parsedResult.query || ''
                                });
                            }
                        }

                        setQueryResultsCacheHitRatio(queryResult);
                    } catch (error) {
                        console.error('Error parsing result:', error);
                    }
                } else {
                    console.error('Unexpected result type:', result.type_url);
                }
            } else {
                console.error('Invalid response format:', data);
            }
            setIsLoadingCacheHitQueryResults(false);
        } catch (error) {
            console.error('Error fetching data:', error);
            setIsLoadingCacheHitQueryResults(false);
        }
    };

    const fetchQueryUserAccessList = async (nodeName: string) => {
        try {
            setIsLoadingUserAccessListResults(true);
            const agentId = `agent_${nodeName}`;

            const query = `
                SELECT usename, usesuper FROM pg_user;
            `;

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
                    query_id: 'pg_user_access_list',
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

                        const queryResult: QueryResultUserAccessList[] = [];

                        // Agent'dan gelen yanıt formatı farklı olabilir
                        if (parsedResult.status === 'success' && parsedResult.row_count > 0) {
                            // Standart format
                            const rowCount = parsedResult.row_count || 0;

                            for (let i = 0; i < rowCount; i++) {
                                if (parsedResult[`usename_${i}`] !== '') {
                                    queryResult.push({
                                        username: parsedResult[`usename_${i}`],
                                        isSuperuser: parsedResult[`usesuper_${i}`] === true
                                    });
                                }
                            }
                        } else if (parsedResult.status === 'success' && parsedResult.rows && parsedResult.rows.length > 0) {
                            // Alternatif format - rows array'i içinde
                            parsedResult.rows.forEach((row: any) => {
                                queryResult.push({
                                    username: row.usename || '',
                                    isSuperuser: row.usesuper === true
                                });
                            });
                        } else if (parsedResult.status === 'success' && parsedResult.data && parsedResult.data.length > 0) {
                            // Başka bir alternatif format - data array'i içinde
                            parsedResult.data.forEach((row: any) => {
                                queryResult.push({
                                    username: row.usename || '',
                                    isSuperuser: row.usesuper === true
                                });
                            });
                        } else if (parsedResult.status === 'success' && parsedResult.result && parsedResult.result.length > 0) {
                            // Başka bir alternatif format - result array'i içinde
                            parsedResult.result.forEach((row: any) => {
                                queryResult.push({
                                    username: row.usename || '',
                                    isSuperuser: row.usesuper === true
                                });
                            });
                        } else if (parsedResult.status === 'success' && parsedResult.map) {
                            // Map formatı - doğrudan map içinde
                            const row = parsedResult.map;
                            queryResult.push({
                                username: row.usename || '',
                                isSuperuser: row.usesuper === true
                            });
                        } else if (parsedResult.status === 'success') {
                            // Doğrudan nesne formatı
                            if (parsedResult.usename) {
                                queryResult.push({
                                    username: parsedResult.usename || '',
                                    isSuperuser: parsedResult.usesuper === true
                                });
                            }
                        }

                        setQueryResultsUserAccessList(queryResult);
                    } catch (error) {
                        console.error('Error parsing user access list result:', error);
                    }
                } else {
                    console.error('Unexpected user access list result type:', result.type_url);
                }
            } else {
                console.error('Invalid user access list response format:', data);
            }
            setIsLoadingUserAccessListResults(false);
        } catch (error) {
            console.error('Error fetching user access list data:', error);
            setIsLoadingUserAccessListResults(false);
        }
    };


    const fetchQueryLongRunningResults = async (nodeName: string) => {
        try {
            setIsLoadingLongRunningQueryResults(true);
            const agentId = `agent_${nodeName}`;

            const query = `
                SELECT 
                    datname as datName,
                    pid,
                    usename as userName,
                    application_name as applicationName,
                    query_start as queryStart,
                    state,
                    wait_event_type as waitEventType,
                    wait_event as waitEvent,
                    query,
                    EXTRACT(EPOCH FROM (now() - query_start))::int as duration
                FROM pg_stat_activity 
                WHERE state != 'idle' 
                AND pid != pg_backend_pid() 
                AND EXTRACT(EPOCH FROM (now() - query_start)) > 1 
                AND usename != 'replica'
                ORDER BY duration DESC;
            `;

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
                    query_id: 'pg_longrunning',
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

                        // Sorgu sonucunu array formatına dönüştür
                        const queryResult: QueryResultLongRunning[] = [];

                        // Agent'dan gelen yanıt formatı farklı olabilir
                        if (parsedResult.status === 'success' && parsedResult.row_count > 0) {
                            // Standart format
                            const rowCount = parsedResult.row_count || 0;

                            for (let i = 0; i < rowCount; i++) {
                                if (parsedResult[`datName_${i}`] !== '') {
                                    queryResult.push({
                                        datName: parsedResult[`datName_${i}`],
                                        pid: parseInt(parsedResult[`pid_${i}`]) || 0,
                                        userName: parsedResult[`userName_${i}`],
                                        applicationName: parsedResult[`applicationName_${i}`],
                                        queryStart: parsedResult[`queryStart_${i}`],
                                        state: parsedResult[`state_${i}`],
                                        waitEventType: parsedResult[`waitEventType_${i}`] || null,
                                        waitEvent: parsedResult[`waitEvent_${i}`] || null,
                                        query: parsedResult[`query_${i}`],
                                        duration: parseInt(parsedResult[`duration_${i}`]) || 0
                                    });
                                }
                            }
                        } else if (parsedResult.status === 'success' && parsedResult.rows && parsedResult.rows.length > 0) {
                            // Alternatif format - rows array'i içinde
                            parsedResult.rows.forEach((row: any) => {
                                queryResult.push({
                                    datName: row.datname || '',
                                    pid: parseInt(row.pid) || 0,
                                    userName: row.username || '',
                                    applicationName: row.applicationname || '',
                                    queryStart: row.querystart || '',
                                    state: row.state || '',
                                    waitEventType: row.waiteventtype || null,
                                    waitEvent: row.waitevent || null,
                                    query: row.query || '',
                                    duration: parseInt(row.duration) || 0
                                });
                            });
                        } else if (parsedResult.status === 'success' && parsedResult.data && parsedResult.data.length > 0) {
                            // Başka bir alternatif format - data array'i içinde
                            parsedResult.data.forEach((row: any) => {
                                queryResult.push({
                                    datName: row.datname || '',
                                    pid: parseInt(row.pid) || 0,
                                    userName: row.username || '',
                                    applicationName: row.applicationname || '',
                                    queryStart: row.querystart || '',
                                    state: row.state || '',
                                    waitEventType: row.waiteventtype || null,
                                    waitEvent: row.waitevent || null,
                                    query: row.query || '',
                                    duration: parseInt(row.duration) || 0
                                });
                            });
                        } else if (parsedResult.status === 'success' && parsedResult.result && parsedResult.result.length > 0) {
                            // Başka bir alternatif format - result array'i içinde
                            parsedResult.result.forEach((row: any) => {
                                queryResult.push({
                                    datName: row.datname || '',
                                    pid: parseInt(row.pid) || 0,
                                    userName: row.username || '',
                                    applicationName: row.applicationname || '',
                                    queryStart: row.querystart || '',
                                    state: row.state || '',
                                    waitEventType: row.waiteventtype || null,
                                    waitEvent: row.waitevent || null,
                                    query: row.query || '',
                                    duration: parseInt(row.duration) || 0
                                });
                            });
                        } else if (parsedResult.status === 'success' && parsedResult.map) {
                            // Map formatı - doğrudan map içinde
                            const row = parsedResult.map;
                            queryResult.push({
                                datName: row.datname || '',
                                pid: parseInt(row.pid) || 0,
                                userName: row.username || '',
                                applicationName: row.applicationname || '',
                                queryStart: row.querystart || '',
                                state: row.state || '',
                                waitEventType: row.waiteventtype || null,
                                waitEvent: row.waitevent || null,
                                query: row.query || '',
                                duration: parseInt(row.duration) || 0
                            });
                        } else if (parsedResult.status === 'success') {
                            // Doğrudan nesne formatı - console'da gördüğümüz format
                            // Bu durumda parsedResult'ın kendisi bir nesne olabilir
                            if (parsedResult.datname) {
                                queryResult.push({
                                    datName: parsedResult.datname || '',
                                    pid: parseInt(parsedResult.pid) || 0,
                                    userName: parsedResult.username || '',
                                    applicationName: parsedResult.applicationname || '',
                                    queryStart: parsedResult.querystart || '',
                                    state: parsedResult.state || '',
                                    waitEventType: parsedResult.waiteventtype || null,
                                    waitEvent: parsedResult.waitevent || null,
                                    query: parsedResult.query || '',
                                    duration: parseInt(parsedResult.duration) || 0
                                });
                            }
                        }

                        setQueryResultsLongRunning(queryResult);
                    } catch (error) {
                        console.error('Error parsing result:', error);
                    }
                } else {
                    console.error('Unexpected result type:', result.type_url);
                }
            } else {
                console.error('Invalid response format:', data);
            }
            setIsLoadingLongRunningQueryResults(false);
        } catch (error) {
            console.error('Error fetching data:', error);
            setIsLoadingLongRunningQueryResults(false);
        }
    };

    const fetchQueryLocksResults = async (nodeName: string) => {
        try {
            setIsLoadingLocksQueryResults(true);
            const agentId = `agent_${nodeName}`;

            const query = `WITH lock_info AS (
                     SELECT 
                         pg_locks.locktype,
                         pg_locks.database,
                         pg_locks.relation,
                         pg_locks.page,
                         pg_locks.tuple,
                         pg_locks.virtualxid,
                         pg_locks.transactionid,
                         pg_locks.classid,
                         pg_locks.objid,
                         pg_locks.objsubid,
                         pg_locks.virtualtransaction,
                         pg_locks.pid,
                         pg_locks.mode,
                         pg_locks.granted,
                         pg_stat_activity.query AS query_text,
                         pg_stat_activity.state AS query_state,
                         pg_stat_activity.query_start,
                         pg_stat_activity.application_name,
                         pg_stat_activity.client_addr,
                         pg_stat_activity.client_port
                     FROM pg_locks
                     JOIN pg_stat_activity ON pg_locks.pid = pg_stat_activity.pid
                 )
                 SELECT 
                     waiting.query_text AS waiting_query,
                     waiting.pid AS waiting_pid,
                     waiting.query_start AS waiting_query_start,
                     waiting.locktype AS waiting_locktype,
                     waiting.mode AS waiting_lockmode,
                     blocking.query_text AS blocking_query,
                     blocking.pid AS blocking_pid,
                     blocking.query_start AS blocking_query_start,
                     blocking.locktype AS blocking_locktype,
                     blocking.mode AS blocking_lockmode,
                     blocking.granted AS blocking_granted,
                     waiting.client_addr AS waiting_client,
                     blocking.client_addr AS blocking_client
                 FROM 
                     lock_info waiting
                 JOIN 
                     lock_info blocking ON 
                         waiting.locktype = blocking.locktype
                         AND waiting.database IS NOT DISTINCT FROM blocking.database
                         AND waiting.relation IS NOT DISTINCT FROM blocking.relation
                         AND waiting.page IS NOT DISTINCT FROM blocking.page
                         AND waiting.tuple IS NOT DISTINCT FROM blocking.tuple
                         AND waiting.virtualxid IS NOT DISTINCT FROM blocking.virtualxid
                         AND waiting.transactionid IS NOT DISTINCT FROM blocking.transactionid
                         AND waiting.classid IS NOT DISTINCT FROM blocking.classid
                         AND waiting.objid IS NOT DISTINCT FROM blocking.objid
                         AND waiting.objsubid IS NOT DISTINCT FROM blocking.objsubid
                         AND waiting.pid != blocking.pid
                 WHERE 
                     waiting.granted = false
                     AND blocking.granted = true
                 ORDER BY 
                     waiting.query_start;`;

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
                    query_id: 'pg_locks',
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

                        // Sorgu sonucunu array formatına dönüştür
                        const queryResult = [];
                        const rowCount = parsedResult.row_count || 0;

                        for (let i = 0; i < rowCount; i++) {
                            if (parsedResult[`waiting_query_${i}`] !== '') {
                                queryResult.push({
                                    waitingQuery: parsedResult[`waiting_query_${i}`],
                                    waitingPid: parsedResult[`waiting_pid_${i}`],
                                    waitingQueryStart: parsedResult[`waiting_query_start_${i}`],
                                    waitingLockType: parsedResult[`waiting_locktype_${i}`],
                                    waitingLockMode: parsedResult[`waiting_lockmode_${i}`],
                                    blockingQuery: parsedResult[`blocking_query_${i}`],
                                    blockingPid: parsedResult[`blocking_pid_${i}`],
                                    blockingQueryStart: parsedResult[`blocking_query_start_${i}`],
                                    blockingLockType: parsedResult[`blocking_locktype_${i}`],
                                    blockingLockMode: parsedResult[`blocking_lockmode_${i}`],
                                    blockingGranted: parsedResult[`blocking_granted_${i}`] === 'true',
                                    waitingClient: parsedResult[`waiting_client_${i}`],
                                    blockingClient: parsedResult[`blocking_client_${i}`]
                                });
                            }
                        }

                        setQueryResultsLocks(queryResult);
                    } catch (error) {
                        console.error('Error parsing result:', error);
                    }
                } else {
                    console.error('Unexpected result type:', result.type_url);
                }
            } else {
                console.error('Invalid response format:', data);
            }
            setIsLoadingLocksQueryResults(false);
        } catch (error) {
            console.error('Error fetching data:', error);
            setIsLoadingLocksQueryResults(false);
        }
    };

    const fetchSystemMetrics = async (nodeNameParam: string) => {
        if (!nodeNameParam) {
            console.error('METRICS: fetchSystemMetrics called without nodeName');
            return;
        }


        // Set loading state
        setIsLoadingMetrics(true);

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 90000);

            const agentId = `agent_${nodeNameParam}`;
            const url = `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/agents/${agentId}/metrics`;

            const token = localStorage.getItem('token');
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                credentials: 'include',
                signal: controller.signal
            });
            clearTimeout(timeoutId);


            if (!response.ok) {
                throw new Error(`Error fetching metrics: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            // Metrics data from response (API returns data in a 'data' object, not 'metrics')
            const metricsData = data.data || data.metrics || data;

            // Directly set the metrics state without delay or timeout
            setSystemMetrics({
                cpu_usage: metricsData?.cpu_usage || 0,
                cpu_cores: metricsData?.cpu_cores || 0,
                memory_usage: metricsData?.memory_usage || 0,
                total_memory: metricsData?.total_memory || 0,
                free_memory: metricsData?.free_memory || 0,
                load_average_1m: metricsData?.load_average_1m || 0,
                load_average_5m: metricsData?.load_average_5m || 0,
                load_average_15m: metricsData?.load_average_15m || 0,
                total_disk: metricsData?.total_disk || 0,
                free_disk: metricsData?.free_disk || 0,
                os_version: metricsData?.os_version || 'Unknown',
                kernel_version: metricsData?.kernel_version || 'Unknown',
                uptime: metricsData?.uptime || 0
            });


            // Force DOM update using requestAnimationFrame
            requestAnimationFrame(() => {
                const container = document.getElementById('metrics-container');
                if (container) {
                    // Adding a temporary class to trigger reflow
                    container.classList.add('metrics-updated');
                    // Read offsetHeight to force reflow
                    const _ = container.offsetHeight;
                    // Remove class
                    container.classList.remove('metrics-updated');

                    // Metrics yükleme durumunu burada kapatalım
                    setIsLoadingMetrics(false);
                } else {
                    // Container bulunamasa bile loading state'i kapatalım
                    setIsLoadingMetrics(false);
                }
            });
        } catch (error) {
            console.error('METRICS: Error fetching system metrics:', error);

            // Show error message to user
            message.error(`Failed to load metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);

            // Set default metrics in case of error
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
                os_version: 'Error',
                kernel_version: 'Error',
                uptime: 0
            });
        } finally {
            // Always log completion

            // Loading state'i finally bloğunda kapamıyoruz, 
            // bu değer başarılı fetch sonrası yukarıda kapatılıyor
        }
    };

    const formatUptime = (uptimeSeconds: number) => {
        const secondsInMinute = 60;
        const secondsInHour = secondsInMinute * 60;
        const secondsInDay = secondsInHour * 24;

        const days = Math.floor(uptimeSeconds / secondsInDay);
        const hoursLeft = uptimeSeconds % secondsInDay;
        const hours = Math.floor(hoursLeft / secondsInHour);
        const minutesLeft = hoursLeft % secondsInHour;
        const minutes = Math.floor(minutesLeft / secondsInMinute);

        return `${days} days, ${hours} hours, ${minutes} minutes`;
    };

    const fetchHistoricalCpuData = async (nodeName: string, range: string = cpuTimeRange) => {
        try {
            setIsLoadingHistoricalCpu(true);
            const agentId = `agent_${nodeName}`;

            const token = localStorage.getItem('token');
            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/metrics/postgresql/system/cpu?agent_id=${agentId}&range=${range}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('API response not ok');
            }

            const data: HistoricalCpuResponse = await response.json();

            if (data.status === 'success' && data.data) {
                // Separate CPU cores and usage data
                const cpuCoresData = data.data.filter(item => item._field === 'cpu_cores');
                const cpuUsageData = data.data.filter(item => item._field === 'cpu_usage');

                // Debug: Log raw CPU usage data to see what values we're getting

                // Process the data for chart display
                const chartData = cpuUsageData.map(item => {
                    // Normalize CPU value - it might be in wrong units
                    let normalizedValue = item._value;

                    // If the value is too large (like microseconds or nanoseconds), normalize it
                    if (normalizedValue > 10000) {
                        // Assume it's in microseconds, divide by 10000 to get percentage
                        normalizedValue = normalizedValue / 10000;
                    } else if (normalizedValue > 1000) {
                        // Assume it's in some other unit, divide by 1000
                        normalizedValue = normalizedValue / 1000;
                    }

                    // Ensure the value is within reasonable CPU percentage range (0-100)
                    normalizedValue = Math.min(Math.max(normalizedValue, 0), 100);

                    return {
                        ...item,
                        _value: normalizedValue,
                        originalValue: item._value, // Keep original for debugging
                        time: new Date(item._time).getTime(),
                        formattedTime: range.includes('d') || range === '7d' || range === '30d' || 
                                     parseInt(range.replace(/\D/g, '')) >= 24 ? 
                            new Date(item._time).toLocaleDateString('tr-TR', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit'
                            }) :
                            new Date(item._time).toLocaleTimeString('tr-TR', {
                                hour: '2-digit',
                                minute: '2-digit'
                            })
                    };
                })
                .sort((a, b) => a.time - b.time); // Sort by timestamp

                // Remove duplicate timestamps by keeping only the latest value for each minute
                const uniqueChartData = chartData.reduce((acc, item) => {
                    const existing = acc.find(x => x.formattedTime === item.formattedTime);
                    if (!existing) {
                        acc.push(item);
                    } else if (item.time > existing.time) {
                        // Replace with newer data for same minute
                        const index = acc.indexOf(existing);
                        acc[index] = item;
                    }
                    return acc;
                }, [] as typeof chartData);

                setHistoricalCpuData(uniqueChartData);

                // Set current CPU usage from the latest data point
                if (uniqueChartData.length > 0) {
                    setCurrentCpuUsage(uniqueChartData[uniqueChartData.length - 1]._value);
                }
            } else {
                console.error('Invalid historical CPU response format:', data);
                setHistoricalCpuData([]);
                setCurrentCpuUsage(0);
            }
        } catch (error) {
            console.error('Error fetching historical CPU data:', error);
            message.error('Failed to fetch historical CPU data');
            setHistoricalCpuData([]);
            setCurrentCpuUsage(0);
        } finally {
            setIsLoadingHistoricalCpu(false);
        }
    };

    // New connection metrics API functions
    const fetchConnectionMetrics = async (nodeName: string, range: string = connectionTimeRange) => {
        try {
            setIsLoadingConnectionMetrics(true);
            const agentId = `agent_${nodeName}`;
            const token = localStorage.getItem('token');
            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/metrics/postgresql/database/connections?agent_id=${agentId}&range=${range}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('API response not ok');
            }

            const data: ConnectionMetricsResponse = await response.json();

            if (data.data && Array.isArray(data.data)) {
                setConnectionMetrics(data.data);

                // Group data by field type
                const groupedData = data.data.reduce((acc, item) => {
                    if (!acc[item._field]) {
                        acc[item._field] = [];
                    }
                    acc[item._field].push(item);
                    return acc;
                }, {} as Record<string, ConnectionMetricsData[]>);

                // Extract latest summary metrics
                const getLatestValue = (field: string): number => {
                    const fieldData = groupedData[field];
                    if (fieldData && fieldData.length > 0) {
                        const latest = fieldData.sort((a, b) => new Date(b._time).getTime() - new Date(a._time).getTime())[0];
                        return Math.round(latest._value); // Round to integer for connection counts
                    }
                    return 0;
                };

                // Create connection summary
                const summary: ConnectionSummary = {
                    active: getLatestValue('active'),
                    available: getLatestValue('available'),
                    total: getLatestValue('total'),
                    idle: getLatestValue('idle'),
                    idle_in_transaction: getLatestValue('idle_in_transaction'),
                    utilization_percent: Math.round(getLatestValue('utilization_percent') * 10) / 10, // Keep 1 decimal for percentage
                    max_connections: getLatestValue('max_connections'),
                    effective_max_connections: getLatestValue('effective_max_connections'),
                    blocked: getLatestValue('blocked'),
                    blocking: getLatestValue('blocking'),
                    long_running_queries: getLatestValue('long_running_queries'),
                    timestamp: new Date().toISOString()
                };

                setConnectionSummary(summary);

                // Process by_application data
                const byApplicationData = groupedData['by_application'] || [];
                const appConnections = byApplicationData.reduce((acc, item) => {
                    if (item.application) {
                        const existing = acc.find(a => a.application === item.application);
                        if (existing) {
                            existing.count = Math.max(existing.count, Math.round(item._value));
                        } else {
                            acc.push({
                                application: item.application,
                                count: Math.round(item._value),
                                timestamp: item._time
                            });
                        }
                    }
                    return acc;
                }, [] as ConnectionByApplication[]);

                setConnectionsByApplication(appConnections);

                // Process by_database data
                const byDatabaseData = groupedData['by_database'] || [];
                const dbConnections = byDatabaseData.reduce((acc, item) => {
                    if (item.database) {
                        const existing = acc.find(d => d.database === item.database);
                        if (existing) {
                            existing.count = Math.max(existing.count, Math.round(item._value));
                        } else {
                            acc.push({
                                database: item.database,
                                count: Math.round(item._value),
                                timestamp: item._time
                            });
                        }
                    }
                    return acc;
                }, [] as ConnectionByDatabase[]);
                setConnectionsByDatabase(dbConnections);

                // Prepare historical chart data
                const activeData = groupedData['active'] || [];
                const availableData = groupedData['available'] || [];
                const totalData = groupedData['total'] || [];

                const chartData = activeData.map(item => ({
                    ...item,
                    time: new Date(item._time).getTime(),
                    formattedTime: range.includes('d') || range === '7d' || range === '30d' || 
                                 parseInt(range.replace(/\D/g, '')) >= 24 ? 
                        new Date(item._time).toLocaleDateString('tr-TR', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit'
                        }) :
                        new Date(item._time).toLocaleTimeString('tr-TR', {
                            hour: '2-digit',
                            minute: '2-digit'
                        }),
                    active: item._value,
                    available: availableData.find(a => a._time === item._time)?._value || 0,
                    total: totalData.find(t => t._time === item._time)?._value || 0
                }))
                .sort((a, b) => a.time - b.time);

                // Remove duplicate timestamps by keeping only the latest value for each minute
                const uniqueChartData = chartData.reduce((acc, item) => {
                    const existing = acc.find(x => x.formattedTime === item.formattedTime);
                    if (!existing) {
                        acc.push(item);
                    } else if (item.time > existing.time) {
                        // Replace with newer data for same minute
                        const index = acc.indexOf(existing);
                        acc[index] = item;
                    }
                    return acc;
                }, [] as typeof chartData);

                setConnectionHistoricalData(uniqueChartData);

            } else {
                console.error('Invalid connection metrics response format:', data);
                setConnectionMetrics([]);
                setConnectionSummary(null);
                setConnectionsByApplication([]);
                setConnectionsByDatabase([]);
                setConnectionHistoricalData([]);
            }
        } catch (error) {
            console.error('Error fetching connection metrics:', error);
            message.error('Failed to fetch connection metrics');
            setConnectionMetrics([]);
            setConnectionSummary(null);
            setConnectionsByApplication([]);
            setConnectionsByDatabase([]);
            setConnectionHistoricalData([]);
        } finally {
            setIsLoadingConnectionMetrics(false);
        }
    };

    const fetchQueryTopCpuResults = useCallback(async (nodeName: string) => {
        if (!nodeName) return;
        try {
            setIsLoadingTopCpuResults(true);
            const agentId = `agent_${nodeName}`;

            // PostgreSQL versiyonunu kontrol et
            const selectedNodeInfo = nodeInfo.find(node => node.name === nodeName);
            const PGVersion = selectedNodeInfo ? selectedNodeInfo.PGVersion : 'unknown';

            // Versiyon numarasını çıkar (örn: "14.7" -> 14)
            const pgVersionMajor = parseInt(PGVersion.split('.')[0]);

            // Versiyona göre sorgu seç
            let query;
            if (pgVersionMajor < 13) {
                query = `SELECT  pu.usename, pd.datname as db_name, round(pss.total_time::numeric, 2) as total_time, pss.calls, round(pss.mean_time::numeric, 2) as mean, round((100 * pss.total_time / sum(pss.total_time::numeric) OVER ())::numeric, 2) as cpu_portion_pctg, pss.query as short_query FROM pg_stat_statements pss JOIN pg_database pd ON pd.oid = pss.dbid JOIN pg_user pu ON pu.usesysid = pss.userid where pd.datname not in ('pmm_user','postgres') ORDER BY pss.total_time DESC LIMIT 10;`;
            } else {
                query = `SELECT  pu.usename, pd.datname as db_name, round((pss.total_exec_time + pss.total_plan_time)::numeric, 2) as total_time, pss.calls, round((pss.mean_exec_time + pss.mean_plan_time)::numeric, 2) as mean, round((100 * (pss.total_exec_time + pss.total_plan_time) / sum((pss.total_exec_time + pss.total_plan_time)::numeric) OVER ())::numeric, 2) as cpu_portion_pctg, pss.query as short_query FROM pg_stat_statements pss JOIN pg_database pd ON pd.oid = pss.dbid JOIN pg_user pu ON pu.usesysid = pss.userid where pd.datname not in ('pmm_user','postgres') ORDER BY (pss.total_exec_time + pss.total_plan_time) DESC LIMIT 10;`;
            }

            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/agents/${agentId}/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    query_id: 'pg_topcpu',
                    command: query,
                    database: 'postgres'
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

                        if (parsedResult.status === 'error' && parsedResult.message && parsedResult.message.includes('pg_stat_statements')) {
                            message.error({
                                content: (
                                    <div>
                                        <p><strong>Error:</strong> pg_stat_statements extension is not installed.</p>
                                        <p>To install the extension, run the following SQL command as a superuser:</p>
                                        <pre style={{ background: '#f5f5f5', padding: '10px', borderRadius: '4px' }}>
                                            CREATE EXTENSION pg_stat_statements;
                                        </pre>
                                        <p>After installation, you may need to restart the PostgreSQL server.</p>
                                    </div>
                                ),
                                duration: 10
                            });
                            setQueryResultsTopCpu([]);
                            return;
                        }

                        const queryResult = [];
                        const rowCount = parsedResult.row_count || 0;

                        for (let i = 0; i < rowCount; i++) {
                            if (parsedResult[`usename_${i}`] !== '') {
                                queryResult.push({
                                    usename: parsedResult[`usename_${i}`],
                                    db_name: parsedResult[`db_name_${i}`],
                                    total_time: parsedResult[`total_time_${i}`],
                                    calls: parsedResult[`calls_${i}`],
                                    mean: parsedResult[`mean_${i}`],
                                    cpu_portion_pctg: parsedResult[`cpu_portion_pctg_${i}`],
                                    short_query: parsedResult[`short_query_${i}`]
                                });
                            }
                        }

                        setQueryResultsTopCpu(queryResult);
                    } catch (error) {
                        console.error('Error parsing result:', error);
                        message.error('Error parsing query result');
                        setQueryResultsTopCpu([]);
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching data:', error);
            message.error('Error fetching query results');
            setQueryResultsTopCpu([]);
        } finally {
            setIsLoadingTopCpuResults(false);
        }
    }, [nodeInfo]); // Sadece nodeInfo'yu dependency olarak ekliyoruz


    const fetchQueryUnusedIndexes = async (nodeName: string, dbName: string) => {
        try {
            setIsLoadingUnusedIndexesResults(true);
            const agentId = `agent_${nodeName}`;

            const query = `
                select 'regular index' as indextype,
                    stats_child.schemaname,
                    stats_child.relname AS tablename,
                    c.relname as indexname,
                    index_columns.idx_columns as idx_columns,
                    stats_child.idx_scan as id_scan_count,
                    pg_relation_size(stats_child.indexrelid) as index_size 
                from pg_class c 
                join pg_index idx_parent on idx_parent.indexrelid = c.oid 
                join pg_catalog.pg_stat_user_indexes stats_child on c.oid = stats_child.indexrelid, 
                LATERAL (
                    SELECT string_agg(attname, ', ' order by attnum) AS idx_columns 
                    FROM pg_attribute 
                    WHERE attrelid = c.oid
                ) index_columns 
                where c.relkind = 'i' 
                AND 0 <>ALL (idx_parent.indkey) 
                AND NOT idx_parent.indisunique  
                AND NOT EXISTS (
                    SELECT 1 
                    FROM pg_catalog.pg_constraint cc 
                    WHERE cc.conindid = idx_parent.indexrelid
                ) 
                AND NOT EXISTS (
                    SELECT 1 
                    FROM pg_inherits pi 
                    where pi.inhrelid = c.oid
                ) 
                and stats_child.relname not like '%template%'
                and stats_child.idx_scan = 0  -- Hiç kullanılmayan indexleri göster
                order by stats_child.schemaname, stats_child.relname;
            `;

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
                    query_id: 'unused_indexes',
                    command: query,
                    database: dbName // Database seçimini burada yapıyoruz
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

                        if (parsedResult.status === 'success' && parsedResult.row_count > 0) {
                            const unusedIndexes: QueryResultUnusedIndexes[] = [];
                            const rowCount = parsedResult.row_count || 0;

                            for (let i = 0; i < rowCount; i++) {
                                unusedIndexes.push({
                                    indextype: parsedResult[`indextype_${i}`],
                                    schemaname: parsedResult[`schemaname_${i}`],
                                    tablename: parsedResult[`tablename_${i}`],
                                    indexname: parsedResult[`indexname_${i}`],
                                    idx_columns: parsedResult[`idx_columns_${i}`],
                                    id_scan_count: parsedResult[`id_scan_count_${i}`] || 0,
                                    index_size: parseInt(parsedResult[`index_size_${i}`])
                                });
                            }

                            setQueryResultsUnusedIndexes(unusedIndexes);
                        } else {
                            setQueryResultsUnusedIndexes([]);
                        }
                    } catch (error) {
                        console.error('Error parsing unused indexes result:', error);
                        message.error('Error parsing unused indexes data');
                        setQueryResultsUnusedIndexes([]);
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching unused indexes:', error);
            message.error('Failed to fetch unused indexes');
            setQueryResultsUnusedIndexes([]);
        } finally {
            setIsLoadingUnusedIndexesResults(false);
        }
    };

    const fetchQueryIndexBloat = async (nodeName: string, dbName: string) => {
        try {
            setIsLoadingIndexBloatResults(true);
            const agentId = `agent_${nodeName}`;

            const query = `
                WITH index_bloat AS (
                    SELECT
                        current_database() AS db_name,
                        n.nspname AS schema_name,
                        t.relname AS table_name,
                        i.indexrelid::regclass::text AS index_name,
                        t.reltuples::bigint AS num_rows,
                        t.relpages::bigint AS total_pages,
                        CEIL(t.reltuples * (pg_column_size(t) + 4) / 8192.0) AS expected_pages,
                        t.relpages - CEIL(t.reltuples * (pg_column_size(t) + 4) / 8192.0) AS bloat_pages
                    FROM
                        pg_stat_user_indexes i
                        JOIN pg_class t ON i.relid = t.oid
                        JOIN pg_namespace n ON t.relnamespace = n.oid
                    WHERE
                        t.relpages > 0
                )
                SELECT
                    db_name,
                    schema_name,
                    table_name,
                    index_name,
                    num_rows,
                    total_pages,
                    expected_pages,
                    bloat_pages,
                    bloat_pages / total_pages::float*100 AS bloat_ratio,
                    CASE 
                        WHEN bloat_pages / total_pages::float*100 >= 50 THEN 3
                        WHEN bloat_pages / total_pages::float*100 >= 25 THEN 2
                        WHEN bloat_pages / total_pages::float*100 > 0 THEN 1
                        ELSE 0
                    END AS fragmentation_level
                FROM index_bloat
                WHERE bloat_pages > 0
                ORDER BY bloat_ratio DESC;
            `;

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
                    query_id: 'pg_index_bloat',
                    command: query,
                    database: dbName
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

                        const queryResult: QueryResultIndexBloat[] = [];

                        // Agent'dan gelen yanıt formatı farklı olabilir
                        if (parsedResult.status === 'success' && parsedResult.row_count > 0) {
                            // Standart format
                            const rowCount = parsedResult.row_count || 0;

                            for (let i = 0; i < rowCount; i++) {
                                if (parsedResult[`db_name_${i}`] !== '') {
                                    queryResult.push({
                                        db_name: parsedResult[`db_name_${i}`],
                                        schema_name: parsedResult[`schema_name_${i}`],
                                        table_name: parsedResult[`table_name_${i}`],
                                        index_name: parsedResult[`index_name_${i}`],
                                        num_rows: parseInt(parsedResult[`num_rows_${i}`]) || 0,
                                        total_pages: parseInt(parsedResult[`total_pages_${i}`]) || 0,
                                        expected_pages: parseInt(parsedResult[`expected_pages_${i}`]) || 0,
                                        bloat_pages: parseInt(parsedResult[`bloat_pages_${i}`]) || 0,
                                        bloat_ratio: parseFloat(parsedResult[`bloat_ratio_${i}`]) || 0,
                                        fragmentation_level: parseInt(parsedResult[`fragmentation_level_${i}`]) || 0
                                    });
                                }
                            }
                        } else if (parsedResult.status === 'success' && parsedResult.rows && parsedResult.rows.length > 0) {
                            // Alternatif format - rows array'i içinde
                            parsedResult.rows.forEach((row: any) => {
                                queryResult.push({
                                    db_name: row.db_name || '',
                                    schema_name: row.schema_name || '',
                                    table_name: row.table_name || '',
                                    index_name: row.index_name || '',
                                    num_rows: parseInt(row.num_rows) || 0,
                                    total_pages: parseInt(row.total_pages) || 0,
                                    expected_pages: parseInt(row.expected_pages) || 0,
                                    bloat_pages: parseInt(row.bloat_pages) || 0,
                                    bloat_ratio: parseFloat(row.bloat_ratio) || 0,
                                    fragmentation_level: parseInt(row.fragmentation_level) || 0
                                });
                            });
                        } else if (parsedResult.status === 'success' && parsedResult.data && parsedResult.data.length > 0) {
                            // Başka bir alternatif format - data array'i içinde
                            parsedResult.data.forEach((row: any) => {
                                queryResult.push({
                                    db_name: row.db_name || '',
                                    schema_name: row.schema_name || '',
                                    table_name: row.table_name || '',
                                    index_name: row.index_name || '',
                                    num_rows: parseInt(row.num_rows) || 0,
                                    total_pages: parseInt(row.total_pages) || 0,
                                    expected_pages: parseInt(row.expected_pages) || 0,
                                    bloat_pages: parseInt(row.bloat_pages) || 0,
                                    bloat_ratio: parseFloat(row.bloat_ratio) || 0,
                                    fragmentation_level: parseInt(row.fragmentation_level) || 0
                                });
                            });
                        } else if (parsedResult.status === 'success' && parsedResult.result && parsedResult.result.length > 0) {
                            // Başka bir alternatif format - result array'i içinde
                            parsedResult.result.forEach((row: any) => {
                                queryResult.push({
                                    db_name: row.db_name || '',
                                    schema_name: row.schema_name || '',
                                    table_name: row.table_name || '',
                                    index_name: row.index_name || '',
                                    num_rows: parseInt(row.num_rows) || 0,
                                    total_pages: parseInt(row.total_pages) || 0,
                                    expected_pages: parseInt(row.expected_pages) || 0,
                                    bloat_pages: parseInt(row.bloat_pages) || 0,
                                    bloat_ratio: parseFloat(row.bloat_ratio) || 0,
                                    fragmentation_level: parseInt(row.fragmentation_level) || 0
                                });
                            });
                        } else if (parsedResult.status === 'success' && parsedResult.map) {
                            // Map formatı - doğrudan map içinde
                            const row = parsedResult.map;
                            queryResult.push({
                                db_name: row.db_name || '',
                                schema_name: row.schema_name || '',
                                table_name: row.table_name || '',
                                index_name: row.index_name || '',
                                num_rows: parseInt(row.num_rows) || 0,
                                total_pages: parseInt(row.total_pages) || 0,
                                expected_pages: parseInt(row.expected_pages) || 0,
                                bloat_pages: parseInt(row.bloat_pages) || 0,
                                bloat_ratio: parseFloat(row.bloat_ratio) || 0,
                                fragmentation_level: parseInt(row.fragmentation_level) || 0
                            });
                        } else if (parsedResult.status === 'success') {
                            // Doğrudan nesne formatı
                            if (parsedResult.db_name) {
                                queryResult.push({
                                    db_name: parsedResult.db_name || '',
                                    schema_name: parsedResult.schema_name || '',
                                    table_name: parsedResult.table_name || '',
                                    index_name: parsedResult.index_name || '',
                                    num_rows: parseInt(parsedResult.num_rows) || 0,
                                    total_pages: parseInt(parsedResult.total_pages) || 0,
                                    expected_pages: parseInt(parsedResult.expected_pages) || 0,
                                    bloat_pages: parseInt(parsedResult.bloat_pages) || 0,
                                    bloat_ratio: parseFloat(parsedResult.bloat_ratio) || 0,
                                    fragmentation_level: parseInt(parsedResult.fragmentation_level) || 0
                                });
                            }
                        }

                        setQueryResultsIndexBloat(queryResult);
                    } catch (error) {
                        console.error('Error parsing index bloat result:', error);
                    }
                } else {
                    console.error('Unexpected index bloat result type:', result.type_url);
                }
            } else {
                console.error('Invalid index bloat response format:', data);
            }
            setIsLoadingIndexBloatResults(false);
        } catch (error) {
            console.error('Error fetching index bloat data:', error);
            setIsLoadingIndexBloatResults(false);
        }
    };

    const fetchQueryTableBloat = async (nodeName: string, dbName: string) => {
        try {
            setIsLoadingTableBloatResults(true);
            const agentId = `agent_${nodeName}`;

            // First, ensure pgstattuple extension is created
            const extensionQuery = `CREATE EXTENSION IF NOT EXISTS pgstattuple;`;
            
            const token = localStorage.getItem('token');
            
            // Create extension first
            await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/agents/${agentId}/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                credentials: 'include',
                body: JSON.stringify({
                    query_id: 'pg_create_pgstattuple_extension',
                    command: extensionQuery,
                    database: dbName
                })
            });

            // Now fetch table bloat data
            const query = `
                WITH table_stats AS (
                    SELECT
                        current_database() AS db_name,
                        s.schemaname AS schema_name,
                        s.relname AS table_name,
                        COALESCE(s.n_tup_ins + s.n_tup_upd + s.n_tup_del, 0) AS num_rows,
                        COALESCE(pg_relation_size(c.oid) / 8192, 0) AS total_pages,
                        COALESCE(pg_relation_size(c.oid), 0) AS table_size,
                        COALESCE(s.n_dead_tup, 0) AS dead_tuples,
                        -- Calculate estimated bloat based on dead tuples and table size
                        CASE 
                            WHEN pg_relation_size(c.oid) > 0 AND s.n_dead_tup > 0
                            THEN CAST((s.n_dead_tup::float / GREATEST(s.n_tup_ins + s.n_tup_upd + s.n_tup_del, 1)) * 100 AS NUMERIC(10,2))
                            ELSE 0
                        END AS estimated_bloat_percent
                    FROM pg_stat_user_tables s
                    JOIN pg_class c ON c.relname = s.relname
                    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = s.schemaname
                    WHERE s.schemaname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
                    AND c.relkind = 'r'
                    AND pg_relation_size(c.oid) > 0
                ),
                table_bloat AS (
                    SELECT
                        db_name,
                        schema_name,
                        table_name,
                        num_rows,
                        total_pages,
                        table_size,
                        dead_tuples,
                        dead_tuples * 100 AS free_space, -- Estimate free space based on dead tuples
                        estimated_bloat_percent AS free_percent,
                        estimated_bloat_percent AS bloat_ratio
                    FROM table_stats
                    WHERE dead_tuples > 0 OR estimated_bloat_percent > 0
                )
                SELECT
                    db_name,
                    schema_name,
                    table_name,
                    num_rows,
                    total_pages,
                    table_size,
                    dead_tuples,
                    free_space,
                    free_percent,
                    free_percent AS bloat_ratio,
                    CASE 
                        WHEN free_percent >= 50 THEN 3
                        WHEN free_percent >= 25 THEN 2
                        WHEN free_percent > 10 THEN 1
                        ELSE 0
                    END AS fragmentation_level
                FROM table_bloat
                WHERE free_percent > 0
                ORDER BY free_percent DESC;
            `;

            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/agents/${agentId}/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                credentials: 'include',
                body: JSON.stringify({
                    query_id: 'pg_table_bloat',
                    command: query,
                    database: dbName
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

                        const queryResult: QueryResultTableBloat[] = [];

                        // Agent'dan gelen yanıt formatı farklı olabilir
                        if (parsedResult.status === 'success' && parsedResult.row_count > 0) {
                            // Standart format
                            const rowCount = parsedResult.row_count || 0;

                            for (let i = 0; i < rowCount; i++) {
                                if (parsedResult[`db_name_${i}`] !== '') {
                                    queryResult.push({
                                        db_name: parsedResult[`db_name_${i}`],
                                        schema_name: parsedResult[`schema_name_${i}`],
                                        table_name: parsedResult[`table_name_${i}`],
                                        num_rows: parseInt(parsedResult[`num_rows_${i}`]) || 0,
                                        total_pages: parseInt(parsedResult[`total_pages_${i}`]) || 0,
                                        table_size: parseInt(parsedResult[`table_size_${i}`]) || 0,
                                        dead_tuples: parseInt(parsedResult[`dead_tuples_${i}`]) || 0,
                                        free_space: parseInt(parsedResult[`free_space_${i}`]) || 0,
                                        free_percent: parseFloat(parsedResult[`free_percent_${i}`]) || 0,
                                        bloat_ratio: parseFloat(parsedResult[`bloat_ratio_${i}`]) || 0,
                                        fragmentation_level: parseInt(parsedResult[`fragmentation_level_${i}`]) || 0
                                    });
                                }
                            }
                        } else if (parsedResult.status === 'success' && parsedResult.rows && parsedResult.rows.length > 0) {
                            // Alternatif format - rows array'i içinde
                            parsedResult.rows.forEach((row: any) => {
                                queryResult.push({
                                    db_name: row.db_name || '',
                                    schema_name: row.schema_name || '',
                                    table_name: row.table_name || '',
                                    num_rows: parseInt(row.num_rows) || 0,
                                    total_pages: parseInt(row.total_pages) || 0,
                                    table_size: parseInt(row.table_size) || 0,
                                    dead_tuples: parseInt(row.dead_tuples) || 0,
                                    free_space: parseInt(row.free_space) || 0,
                                    free_percent: parseFloat(row.free_percent) || 0,
                                    bloat_ratio: parseFloat(row.bloat_ratio) || 0,
                                    fragmentation_level: parseInt(row.fragmentation_level) || 0
                                });
                            });
                        } else if (parsedResult.status === 'success' && parsedResult.data && parsedResult.data.length > 0) {
                            // Başka bir alternatif format - data array'i içinde
                            parsedResult.data.forEach((row: any) => {
                                queryResult.push({
                                    db_name: row.db_name || '',
                                    schema_name: row.schema_name || '',
                                    table_name: row.table_name || '',
                                    num_rows: parseInt(row.num_rows) || 0,
                                    total_pages: parseInt(row.total_pages) || 0,
                                    table_size: parseInt(row.table_size) || 0,
                                    dead_tuples: parseInt(row.dead_tuples) || 0,
                                    free_space: parseInt(row.free_space) || 0,
                                    free_percent: parseFloat(row.free_percent) || 0,
                                    bloat_ratio: parseFloat(row.bloat_ratio) || 0,
                                    fragmentation_level: parseInt(row.fragmentation_level) || 0
                                });
                            });
                        } else if (parsedResult.status === 'success' && parsedResult.result && parsedResult.result.length > 0) {
                            // Başka bir alternatif format - result array'i içinde
                            parsedResult.result.forEach((row: any) => {
                                queryResult.push({
                                    db_name: row.db_name || '',
                                    schema_name: row.schema_name || '',
                                    table_name: row.table_name || '',
                                    num_rows: parseInt(row.num_rows) || 0,
                                    total_pages: parseInt(row.total_pages) || 0,
                                    table_size: parseInt(row.table_size) || 0,
                                    dead_tuples: parseInt(row.dead_tuples) || 0,
                                    free_space: parseInt(row.free_space) || 0,
                                    free_percent: parseFloat(row.free_percent) || 0,
                                    bloat_ratio: parseFloat(row.bloat_ratio) || 0,
                                    fragmentation_level: parseInt(row.fragmentation_level) || 0
                                });
                            });
                        } else if (parsedResult.status === 'success' && parsedResult.map) {
                            // Map formatı - doğrudan map içinde
                            const row = parsedResult.map;
                            queryResult.push({
                                db_name: row.db_name || '',
                                schema_name: row.schema_name || '',
                                table_name: row.table_name || '',
                                num_rows: parseInt(row.num_rows) || 0,
                                total_pages: parseInt(row.total_pages) || 0,
                                table_size: parseInt(row.table_size) || 0,
                                dead_tuples: parseInt(row.dead_tuples) || 0,
                                free_space: parseInt(row.free_space) || 0,
                                free_percent: parseFloat(row.free_percent) || 0,
                                bloat_ratio: parseFloat(row.bloat_ratio) || 0,
                                fragmentation_level: parseInt(row.fragmentation_level) || 0
                            });
                        } else if (parsedResult.status === 'success') {
                            // Doğrudan nesne formatı
                            if (parsedResult.db_name) {
                                queryResult.push({
                                    db_name: parsedResult.db_name || '',
                                    schema_name: parsedResult.schema_name || '',
                                    table_name: parsedResult.table_name || '',
                                    num_rows: parseInt(parsedResult.num_rows) || 0,
                                    total_pages: parseInt(parsedResult.total_pages) || 0,
                                    table_size: parseInt(parsedResult.table_size) || 0,
                                    dead_tuples: parseInt(parsedResult.dead_tuples) || 0,
                                    free_space: parseInt(parsedResult.free_space) || 0,
                                    free_percent: parseFloat(parsedResult.free_percent) || 0,
                                    bloat_ratio: parseFloat(parsedResult.bloat_ratio) || 0,
                                    fragmentation_level: parseInt(parsedResult.fragmentation_level) || 0
                                });
                            }
                        }

                        setQueryResultsTableBloat(queryResult);
                    } catch (error) {
                        console.error('Error parsing table bloat result:', error);
                        message.error('Error parsing table bloat data');
                        setQueryResultsTableBloat([]);
                    }
                } else {
                    console.error('Unexpected table bloat result type:', result.type_url);
                    message.error('Unexpected table bloat result format');
                    setQueryResultsTableBloat([]);
                }
            } else {
                console.error('Invalid table bloat response format:', data);
                message.error('Invalid table bloat response');
                setQueryResultsTableBloat([]);
            }
        } catch (error) {
            console.error('Error fetching table bloat data:', error);
            message.error('Failed to fetch table bloat data');
            setQueryResultsTableBloat([]);
        } finally {
            setIsLoadingTableBloatResults(false);
        }
    };

    const fetchQueryDbStats = async (nodeName: string, dbName: string) => {
        try {
            setIsLoadingDbStatsResults(true);
            const agentId = `agent_${nodeName}`;

            const query = `SELECT * FROM pg_stat_database WHERE datname = '${dbName}';`;

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
                    query_id: 'pg_db_stats',
                    command: query,
                    database: dbName
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

                        if (parsedResult.status === 'success') {
                            // API'den gelen veriyi kontrol et
                            const dbStats: QueryResultDbStats[] = [{
                                datid: parseInt(parsedResult.datid) || 0,
                                datname: dbName, // Her zaman seçilen database adını kullan
                                numbackends: parseInt(parsedResult.numbackends) || 0,
                                xact_commit: parseInt(parsedResult.xact_commit) || 0,
                                xact_rollback: parseInt(parsedResult.xact_rollback) || 0,
                                blks_read: parseInt(parsedResult.blks_read) || 0,
                                blks_hit: parseInt(parsedResult.blks_hit) || 0,
                                tup_returned: parseInt(parsedResult.tup_returned) || 0,
                                tup_fetched: parseInt(parsedResult.tup_fetched) || 0,
                                tup_inserted: parseInt(parsedResult.tup_inserted) || 0,
                                tup_updated: parseInt(parsedResult.tup_updated) || 0,
                                tup_deleted: parseInt(parsedResult.tup_deleted) || 0,
                                conflicts: parseInt(parsedResult.conflicts) || 0,
                                temp_files: parseInt(parsedResult.temp_files) || 0,
                                temp_bytes: parseInt(parsedResult.temp_bytes) || 0,
                                deadlocks: parseInt(parsedResult.deadlocks) || 0,
                                blk_read_time: parseFloat(parsedResult.blk_read_time) || 0,
                                blk_write_time: parseFloat(parsedResult.blk_write_time) || 0,
                                stats_reset: parsedResult.stats_reset
                            }];

                            setQueryResultsDbStats(dbStats);
                        } else {
                            console.error('Invalid database stats data:', parsedResult);
                            setQueryResultsDbStats([]);
                        }
                    } catch (error) {
                        console.error('Error parsing db stats result:', error);
                        message.error('Error parsing database statistics data');
                        setQueryResultsDbStats([]);
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching db stats:', error);
            message.error('Failed to fetch database statistics');
            setQueryResultsDbStats([]);
        } finally {
            setIsLoadingDbStatsResults(false);
        }
    };

    const fetchDatabaseSizeData = async (nodeName: string, range: string = '1d') => {
        try {
            setIsLoadingDatabaseSize(true);
            const agentId = `agent_${nodeName}`;
            
            const token = localStorage.getItem('token');
            const response = await axios.get(
                `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/metrics/postgresql/database/sizes`, 
                {
                    params: {
                        agent_id: agentId,
                        range: range
                    },
                    headers: {
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    }
                }
            );

            if (response.data.status === 'success' && response.data.data) {
                const rawData: DatabaseSizeData[] = response.data.data;
                
                // Process data for summary table
                const summaryData: DatabaseSizeSummary[] = [];
                const databaseMap = new Map<string, { size_bytes: number; size_mb: number; timestamp: string }>();
                
                // Group data by database and get latest values
                rawData.forEach(point => {
                    if (point._field === 'size_bytes' || point._field === 'size_mb') {
                        const key = `${point.database}_${point._field}`;
                        const existing = databaseMap.get(point.database) || { size_bytes: 0, size_mb: 0, timestamp: point._time };
                        
                        if (point._field === 'size_bytes') {
                            existing.size_bytes = point._value;
                        } else if (point._field === 'size_mb') {
                            existing.size_mb = point._value;
                        }
                        
                        existing.timestamp = point._time;
                        databaseMap.set(point.database, existing);
                    }
                });
                
                // Convert to summary format
                databaseMap.forEach((data, database) => {
                    summaryData.push({
                        database,
                        size_bytes: data.size_bytes,
                        size_mb: data.size_mb,
                        formatted_size: formatBytes(data.size_bytes),
                        timestamp: data.timestamp
                    });
                });
                
                // Sort by size descending
                summaryData.sort((a, b) => b.size_bytes - a.size_bytes);
                setDatabaseSizeData(summaryData);
                
                // Calculate capacity predictions
                calculateCapacityPredictions(rawData);
                
                // Process data for chart
                const timeMap = new Map<string, DatabaseSizeChartData>();
                rawData.forEach(point => {
                    if (point._field === 'size_mb') {
                        const date = new Date(point._time);
                        const timeKey = date.getTime().toString();
                        
                        if (!timeMap.has(timeKey)) {
                            const isLongRange = range.includes('d') || range === '7d' || 
                                              parseInt(range.replace(/\D/g, '')) >= 24;
                            
                            timeMap.set(timeKey, {
                                time: date.getTime(),
                                formattedTime: isLongRange ? 
                                    date.toLocaleDateString() : 
                                    date.toLocaleTimeString()
                            });
                        }
                        
                        const chartData = timeMap.get(timeKey)!;
                        chartData[`${point.database}_size`] = Math.round(point._value * 100) / 100;
                    }
                });
                
                const chartArray = Array.from(timeMap.values()).sort((a, b) => a.time - b.time);
                setDatabaseSizeChartData(chartArray);
            }
        } catch (error) {
            console.error('Error fetching database size data:', error);
            message.error('Failed to fetch database size data');
            setDatabaseSizeData([]);
            setDatabaseSizeChartData([]);
            setDatabaseCapacityPredictions([]);
        } finally {
            setIsLoadingDatabaseSize(false);
        }
    };

    // Helper function to format bytes
    const formatBytes = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

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

    // Calculate capacity predictions based on historical data
    const calculateCapacityPredictions = (rawData: DatabaseSizeData[]) => {
        try {
            const predictions: DatabaseCapacityPrediction[] = [];
            
            // Group data by database
            const databaseGroups = rawData.reduce((acc, point) => {
                if (point._field === 'size_mb') {
                    if (!acc[point.database]) {
                        acc[point.database] = [];
                    }
                    acc[point.database].push(point);
                }
                return acc;
            }, {} as Record<string, DatabaseSizeData[]>);

            // Calculate predictions for each database
            Object.entries(databaseGroups).forEach(([database, dataPoints]) => {
                if (dataPoints.length < 2) return; // Need at least 2 points for growth calculation

                // Sort by time
                const sortedData = dataPoints.sort((a, b) => new Date(a._time).getTime() - new Date(b._time).getTime());
                
                // Get current size (latest data point)
                const currentSize = sortedData[sortedData.length - 1]._value;
                
                // Calculate daily growth rate using linear regression approach
                const timePoints = sortedData.map(point => new Date(point._time).getTime());
                const sizePoints = sortedData.map(point => point._value);
                
                // Simple linear regression to find growth rate
                const n = timePoints.length;
                const sumX = timePoints.reduce((sum, time) => sum + time, 0);
                const sumY = sizePoints.reduce((sum, size) => sum + size, 0);
                const sumXY = timePoints.reduce((sum, time, index) => sum + time * sizePoints[index], 0);
                const sumXX = timePoints.reduce((sum, time) => sum + time * time, 0);
                
                const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
                
                // Convert slope from MB per millisecond to MB per day
                const dailyGrowthMB = slope * (24 * 60 * 60 * 1000);
                
                // Calculate volatility (coefficient of variation)
                const mean = sumY / n;
                const variance = sizePoints.reduce((sum, size) => sum + Math.pow(size - mean, 2), 0) / n;
                const stdDev = Math.sqrt(variance);
                const coefficientOfVariation = mean > 0 ? stdDev / mean : 0;
                
                const volatility = coefficientOfVariation > 0.1 ? 'high' : coefficientOfVariation > 0.05 ? 'medium' : 'low';
                
                // Time span for confidence calculation
                const timeSpanDays = (timePoints[timePoints.length - 1] - timePoints[0]) / (24 * 60 * 60 * 1000);
                
                // Create predictions for different time periods
                const periods = [
                    { name: '1 Month', days: 30 },
                    { name: '3 Months', days: 90 },
                    { name: '6 Months', days: 180 },
                    { name: '1 Year', days: 365 }
                ];

                periods.forEach(period => {
                    const predictedSize = Math.max(0, currentSize + (dailyGrowthMB * period.days));
                    const confidence = timeSpanDays > 7 ? 'high' : timeSpanDays > 3 ? 'medium' : 'low';
                    
                    predictions.push({
                        database,
                        period: period.name,
                        current_size_mb: currentSize,
                        predicted_size_mb: predictedSize,
                        growth_rate_mb_per_day: dailyGrowthMB,
                        confidence_level: confidence,
                        volatility
                    });
                });
            });

            setDatabaseCapacityPredictions(predictions);
        } catch (error) {
            console.error('Error calculating capacity predictions:', error);
            setDatabaseCapacityPredictions([]);
        }
    };

    const handleDatabaseChange = (value: string) => {

        // Aynı database seçildiyse tekrar istek atma
        if (value === selectedDatabase) {
            return;
        }

        setSelectedDatabase(value);

        if (nodeName) {
            // Sadece aktif tab için veri çek
            if (activeTab === '3') { // Indexes tab'i
                if (selectedSubMenu === 'index-usage') {
                    fetchQueryUnusedIndexes(nodeName, value);
                } else if (selectedSubMenu === 'index-bloat') {
                    fetchQueryIndexBloat(nodeName, value);
                } else if (selectedSubMenu === 'table-bloat') {
                    fetchQueryTableBloat(nodeName, value);
                }
            } else if (activeTab === '6') { // Stats tab'i
                fetchQueryDbStats(nodeName, value);
            } else if (activeTab === '8') { // Capacity Planning tab'i
                fetchDatabaseSizeData(nodeName);
            }
        }
    };

    const handleNodeChange = (value: string) => {
        // Aynı node'u tekrar seçme durumunda işlem yapmayı engelleyelim
        if (value === nodeName) {
            return;
        }


        // Node değişiminden önce bayrağı aktifleştir
        setManualNodeChangeInProgress(true);

        // Node değiştir
        setNodeName(value);
        setCurrentStep(2);

        // Reset all query results when node changes
        setQueryResults([]);
        setQueryResultsNonIdleConns([]);
        setQueryResultsCacheHitRatio([]);
        setQueryResultsUserAccessList([]);
        setQueryResultsLongRunning([]);
        setQueryResultsLocks([]);
        setQueryResultsTopCpu([]);
        setDatabaseSizeData([]);
        setDatabaseSizeChartData([]);
        setDatabaseCapacityPredictions([]);

        // Database listesini yükle - aktif tab hangisi olursa olsun
        fetchDatabases(value);

        // Load data for the current active tab and selected submenu
        if (activeTab === '2' && selectedSubMenu === 'top-cpu') {
            fetchQueryTopCpuResults(value);
        } else if (activeTab === '2' && selectedSubMenu === 'long-running') {
            fetchQueryLongRunningResults(value);
        } else if (activeTab === '2' && selectedSubMenu === 'blocking') {
            fetchQueryLocksResults(value);
        } else if (activeTab === '2' && selectedSubMenu === 'cache-hit') {
            fetchQueryCacheHitRatioResults(value);
        } else if (activeTab === '1' && selectedSubMenu === 'connections') {
            fetchQueryResults(value);
        } else if (activeTab === '1' && selectedSubMenu === 'connections-by-app') {
            fetchQueryNonIdleConnsResults(value);
        } else if (activeTab === '4') {
            fetchSystemMetrics(value);
        } else if (activeTab === '5') {
            fetchPostgresLogs(value);
        } else if (activeTab === '7') {
            fetchQueryUserAccessList(value);
        } else if (activeTab === '8') {
            fetchDatabaseSizeData(value);
        }

        // Daha uzun bir süre için flag'i aktif tut
        setTimeout(() => {
            setManualNodeChangeInProgress(false);
        }, 3000); // 3 saniye boyunca aktif tut 
    };

    const handleLogFileChange = async (selectedFileName: string) => {
        const selectedLogFile = pgLogFiles.find(log => log.name === selectedFileName);
        if (selectedLogFile) {
            setLoading(true);
            setCurrentStep(3)
            setSelectedFullPath(selectedLogFile.fullPath);
            const postData = {
                ...selectedLogFile,
                hostname: nodeName,
                fullPath: selectedLogFile.fullPath,
            };

            const token = localStorage.getItem('token');
            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/parse_postgres_log`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify(postData)
            });

            setLoading(false);
            if (response.ok) {
                const data = await response.json();
                if (data.error) {
                    // Hata mesajını kullanıcıya göster
                    message.error(data.error);
                    setLogContent(""); // logContent'i boşalt
                } else {
                    setLogContent(data.content);
                }
            } else {
                console.error('Failed to fetch log content');
            }
        }
    };

    const handleFilterLogs = async (selectedFullPath: string, startTime: Dayjs, endTime: Dayjs) => {
        const selectedLogFile = pgLogFiles.find(logFile => logFile.fullPath === selectedFullPath);
        if (selectedLogFile && startTime && endTime) {
            setLoading(true);

            const formattedStartDate = startTime.format('HH:mm:ss');
            const formattedEndDate = endTime.format('HH:mm:ss');

            const postData = {
                ...selectedLogFile,
                hostname: nodeName,
                startDate: formattedStartDate,
                endDate: formattedEndDate
            };

            const token = localStorage.getItem('token');
            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/parse_postgres_log_with_date`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify(postData)
            });

            setLoading(false);
            if (response.ok) {
                const data = await response.json();
                if (data.error) {
                    message.error(data.error);
                    setLogContent("");
                } else {
                    setLogContent(data.content);
                }
            } else {
                console.error('Failed to fetch log content');
                message.error('Failed to fetch log content');
            }
        }
    };


    const fetchDatabases = async (nodeName: string) => {
        try {
            setIsLoadingDatabases(true);
            const agentId = `agent_${nodeName}`;

            const query = `
                SELECT datname 
                FROM pg_database 
                WHERE datistemplate = false 
                AND datname NOT IN ('postgres', 'template0', 'template1')
                ORDER BY datname;
            `;

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
                    query_id: 'pg_databases',
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

                        const databases: Database[] = [];

                        // Agent'dan gelen yanıt formatı farklı olabilir
                        if (parsedResult.status === 'success' && parsedResult.row_count > 0) {
                            // Standart format
                            const rowCount = parsedResult.row_count || 0;

                            for (let i = 0; i < rowCount; i++) {
                                if (parsedResult[`datname_${i}`] !== '') {
                                    databases.push({
                                        datname: parsedResult[`datname_${i}`]
                                    });
                                }
                            }
                        } else if (parsedResult.status === 'success' && parsedResult.rows && parsedResult.rows.length > 0) {
                            // Alternatif format - rows array'i içinde
                            parsedResult.rows.forEach((row: any) => {
                                if (row.datname) {
                                    databases.push({
                                        datname: row.datname
                                    });
                                }
                            });
                        } else if (parsedResult.status === 'success' && parsedResult.data && parsedResult.data.length > 0) {
                            // Başka bir alternatif format - data array'i içinde
                            parsedResult.data.forEach((row: any) => {
                                if (row.datname) {
                                    databases.push({
                                        datname: row.datname
                                    });
                                }
                            });
                        } else if (parsedResult.status === 'success' && parsedResult.result && parsedResult.result.length > 0) {
                            // Başka bir alternatif format - result array'i içinde
                            parsedResult.result.forEach((row: any) => {
                                if (row.datname) {
                                    databases.push({
                                        datname: row.datname
                                    });
                                }
                            });
                        } else if (parsedResult.status === 'success' && parsedResult.map) {
                            // Map formatı - doğrudan map içinde
                            if (parsedResult.map.datname) {
                                databases.push({
                                    datname: parsedResult.map.datname
                                });
                            }
                        } else if (parsedResult.status === 'success' && parsedResult.datname) {
                            // Doğrudan nesne formatı
                            databases.push({
                                datname: parsedResult.datname
                            });
                        }

                        // Veritabanı isimlerini ayarla
                        const dbNames = databases.map(db => db.datname);
                        setDatabaseNames(dbNames);

                        // Eğer henüz bir database seçili değilse ve liste boş değilse
                        if (!selectedDatabase && dbNames.length > 0) {
                            const firstDb = dbNames[0];
                            setSelectedDatabase(firstDb);

                            // İlk database için verileri çek
                            fetchQueryUnusedIndexes(nodeName, firstDb);
                            fetchQueryIndexBloat(nodeName, firstDb);
                            fetchQueryTableBloat(nodeName, firstDb);
                            fetchQueryDbStats(nodeName, firstDb);
                        }
                    } catch (error) {
                        console.error('Error parsing databases result:', error);
                        message.error('Error parsing database list');
                    }
                } else {
                    console.error('Unexpected databases result type:', result.type_url);
                    message.error('Unexpected response format');
                }
            } else {
                console.error('Invalid databases response format:', data);
                message.error('Invalid response format');
            }
        } catch (error) {
            console.error('Error fetching databases:', error);
            message.error('Failed to fetch databases');
            setDatabaseNames([]);
        } finally {
            setIsLoadingDatabases(false);
        }
    };

    const fetchPostgresLogs = async (nodeName: string) => {
        try {
            setLoadingPgLogs(true);

            // Axios ile POST isteği yaparak JSON body içinde nodeName gönder
            const response = await axios.post(`https://dbstatus-api.hepsi.io/get_postgres_logs`, {
                nodeName: nodeName // Burada JSON body içinde nodeName kullan
            });

            if (response.data && response.data.recentFiles) {
                const logs = response.data.recentFiles.map((file: LogFile) => {
                    return {
                        name: file.name, // 'name' özelliğini ayarla
                        path: response.data.logPath,
                        fullPath: `${response.data.logPath}/${file.name}`,
                        timeRange: file.timeRange // 'timeRange' özelliği varsa ekle
                    };
                });
                setPgLogFiles(logs);
            } else {
                message.error('No log files found for the selected node');
            }
        } catch (error) {
            console.error('Error fetching log files:', error);
            message.error('Failed to fetch log files');
        } finally {
            setLoadingPgLogs(false);
        }
    };



    useEffect(() => {
        let countdownTimer: number | null = null;

        // refreshInterval değiştiğinde countdown'ı sıfırla
        setCountdown(refreshInterval);

        if (refreshInterval > 0) {
            countdownTimer = window.setInterval(() => {
                setCountdown((prevCount) => {
                    // countdown 1'e ulaştığında refresh interval'a geri dön
                    if (prevCount <= 1) {
                        return refreshInterval;
                    }
                    // değilse 1 azalt
                    return prevCount - 1;
                });
            }, 1000);
        }

        // Clean up function
        return () => {
            if (countdownTimer) {
                window.clearInterval(countdownTimer);
            }
        };
    }, [refreshInterval]);

    // Ana veri çekme useEffect
    useEffect(() => {
        // Log ne zaman useEffect çalıştığını

        // No interval refresh if refreshInterval is 0
        if (refreshInterval === 0) {
            return;
        }

        // Skip if node not selected
        if (!nodeName) {
            return;
        }


        let intervalId: number | null = null;

        // Function to fetch data periodically
        const fetchData = async () => {
            // Skip if manual node change is in progress
            if (manualNodeChangeInProgress) {
                return;
            }


            // Only fetch data based on the current selected tab/submenu
            try {
                if (selectedSubMenu === 'connections') {
                    await fetchQueryResults(nodeName);
                } else if (selectedSubMenu === 'connections-by-app') {
                    await fetchQueryNonIdleConnsResults(nodeName);
                } else if (selectedSubMenu === 'top-cpu') {
                    await fetchQueryTopCpuResults(nodeName);
                } else if (selectedSubMenu === 'cache-hit') {
                    await fetchQueryCacheHitRatioResults(nodeName);
                } else if (selectedSubMenu === 'long-running') {
                    await fetchQueryLongRunningResults(nodeName);
                } else if (selectedSubMenu === 'blocking') {
                    await fetchQueryLocksResults(nodeName);
                } else if (selectedSubMenu === 'index-usage' && selectedDatabase) {
                    await fetchQueryUnusedIndexes(nodeName, selectedDatabase);
                } else if (selectedSubMenu === 'index-bloat' && selectedDatabase) {
                    await fetchQueryIndexBloat(nodeName, selectedDatabase);
                } else if (selectedSubMenu === 'table-bloat' && selectedDatabase) {
                    await fetchQueryTableBloat(nodeName, selectedDatabase);
                } else if (selectedSubMenu === 'system') {
                    await fetchSystemMetrics(nodeName);
                } else if (selectedSubMenu === 'db-stats' && selectedDatabase) {
                    await fetchQueryDbStats(nodeName, selectedDatabase);
                } else if (selectedSubMenu === 'user-access-list') {
                    await fetchQueryUserAccessList(nodeName);
                } else if (selectedSubMenu === 'cache-hit-metrics') {
                    await fetchCacheHitMetrics(nodeName, cacheHitTimeRange);
                } else if (selectedSubMenu === 'deadlocks') {
                    await fetchDeadlocksMetrics(nodeName, deadlocksTimeRange);
                } else if (selectedSubMenu === 'replication') {
                    await fetchReplicationMetrics(nodeName, replicationTimeRange);
                } else if (selectedSubMenu === 'locks') {
                    await fetchLockMetrics(nodeName, lockTimeRange);
                } else if (selectedSubMenu === 'index-metrics') {
                    await fetchIndexMetrics(nodeName, indexTimeRange);
                }
            } catch (error) {
                console.error('Error in periodic refresh:', error);
            }
        };

        // Set up the interval
        intervalId = window.setInterval(fetchData, refreshInterval * 1000);

        // Cleanup function
        return () => {
            if (intervalId !== null) {
                clearInterval(intervalId);
            }
        };
    }, [refreshInterval, nodeName, selectedSubMenu, selectedDatabase, manualNodeChangeInProgress, activeTab]);

    // Ana useEffect'e currentStep ayarlamayı ekleyelim
    useEffect(() => {
        if (nodeName) {
            // activeTab değerine göre currentStep'i ayarlama
            if (activeTab === '3' || activeTab === '6') {
                setCurrentStep(3);
            } else if (activeTab === '4' || activeTab === '5' || activeTab === '7' || activeTab === '8') {
                setCurrentStep(2);
            } else {
                setCurrentStep(2);
            }
        }
    }, [nodeName, activeTab]);

    // Capacity Planning tab için veri çekme useEffect'i
    useEffect(() => {
        if (nodeName && activeTab === '8') {
            fetchDatabaseSizeData(nodeName);
        }
    }, [nodeName, activeTab]);

    // API'den veri çekme ve cluster isimlerini ayarlama.
    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoadingClusterName(true)
                const response = await axios.get(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/status/postgres`, {
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                    },
                    withCredentials: true
                });

                if (response.data && response.data.data && Array.isArray(response.data.data)) {
                    const clusterData: ClusterData[] = response.data.data;

                    // Cluster isimlerini çıkarmak için döngü
                    const clusterNames = clusterData.map(obj => Object.keys(obj)[0]);
                    const data = clusterData.reduce<Record<string, Node[]>>((acc, curr) => {
                        const key = Object.keys(curr)[0];
                        return { ...acc, [key]: curr[key] };
                    }, {});

                    setData(data);
                    setClusterNames(clusterNames);
                } else {
                    console.error('Invalid API response structure');
                }
                setLoadingClusterName(false)
            } catch (error) {
                console.error('Error fetching data:', error);
                setLoadingClusterName(false)
            }
        };
        fetchData();
    }, []);


    useEffect(() => {
        if (clusterName) {
            setCurrentStep(1);
            const selectedCluster = data[clusterName];
            if (selectedCluster) {
                const nodeInfo = selectedCluster.map(node => ({
                    name: node.Hostname,
                    status: node.NodeStatus,
                    PGVersion: node.PGVersion
                }));
                setNodeInfo(nodeInfo);

                // If hostName parameter is provided in URL, select that node
                if (hostNameFromURL && nodeInfo.some(node => node.name === hostNameFromURL)) {
                    setNodeName(hostNameFromURL);
                    setCurrentStep(2);

                    // Since we're using the Top CPU tab by default, fetch its data
                    setTimeout(() => {
                        fetchQueryTopCpuResults(hostNameFromURL);
                    }, 100);
                }
            } else {
                setNodeInfo([]);
            }
        } else {
            setNodeInfo([]);
        }
    }, [clusterName, data, hostNameFromURL]);

    const infoTexts: { [key: string]: string } = {
        "active_time": "Time spent executing SQL statements in this database, in milliseconds.",
        "blk_read_time": "Time spent reading data file blocks by backends in this database, in milliseconds (if track_io_timing is enabled, otherwise zero)",
        "blk_write_time": "Time spent writing data file blocks by backends in this database, in milliseconds (if track_io_timing is enabled, otherwise zero)",
        "blks_hit": "Number of times disk blocks were found already in the buffer cache, so that a read was not necessary (this only includes hits in the PostgreSQL buffer cache, not the operating system's file system cache)",
        "blks_read": "Number of disk blocks read in this database",
        "conflicts": "Number of queries canceled due to conflicts with recovery in this database. (Conflicts occur only on standby servers; see pg_stat_database_conflicts for details.)",
        "deadlocks": "Number of deadlocks detected in this database",
        "idle_in_transaction_time": "Time spent idling while in a transaction in this database, in milliseconds (this corresponds to the states idle in transaction and idle in transaction (aborted) in pg_stat_activity)",
        "numbackends": "Number of backends currently connected to this database, or NULL for shared objects. This is the only column in this view that returns a value reflecting current state; all other columns return the accumulated values since the last reset.",
        "session_time": "Time spent by database sessions in this database, in milliseconds (note that statistics are only updated when the state of a session changes, so if sessions have been idle for a long time, this idle time won't be included)",
        "sessions": "Total number of sessions established to this database",
        "sessions_abandoned": "Number of database sessions to this database that were terminated because connection to the client was lost",
        "sessions_fatal": "Number of database sessions to this database that were terminated by fatal errors",
        "sessions_killed": "Number of database sessions to this database that were terminated by operator intervention",
        "stats_reset": "Time at which these statistics were last reset",
        "temp_bytes": "Total amount of data written to temporary files by queries in this database. All temporary files are counted, regardless of why the temporary file was created, and regardless of the log_temp_files setting.",
        "temp_files": "Number of temporary files created by queries in this database. All temporary files are counted, regardless of why the temporary file was created (e.g., sorting or hashing), and regardless of the log_temp_files setting.",
        "tup_deleted": "Number of rows deleted by queries in this database",
        "tup_updated": "Number of rows updated by queries in this database",
        "tup_inserted": "Number of rows inserted by queries in this database",
        "tup_fetched": "Number of live rows fetched by index scans in this database",
        "tup_returned": "Number of live rows fetched by sequential scans and index entries returned by index scans in this database",
        "xact_commit": "Number of transactions in this database that have been committed",
        "xact_rollback": "Number of transactions in this database that have been rolled back",
    };

    const exportToCsv = (filename: string, rows: QueryResultUserAccessList[]) => {
        // Sütun başlıklarını bir dizi olarak tanımla
        const headers = ["User Name", "Super User"];

        // CSV başlıklarını ve içeriğini oluştur
        const csvContent =
            headers.join(",") + // Başlıkları birleştir
            "\n" +
            rows
                .map(row => [
                    row.username, // username değerini al
                    row.isSuperuser ? "Yes" : "No" // isSuperuser boolean değerini "Yes" veya "No" olarak çevir
                ].join(","))
                .join("\n"); // Her satır için birleştir

        // Blob ile CSV dosyasını oluştur ve indir
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const renderStatistics = (data: QueryResultDbStats) => {
        return Object.entries(data).map(([key, value]) => {
            if (value == null || key === 'datid') return null; // Exclude null values and datid

            let formattedValue = value;
            if (key === 'stats_reset') {
                const date = new Date(value);
                formattedValue = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
            } else if (typeof value === 'object' && value.Valid !== undefined) {
                formattedValue = value.Valid ? (value.Float64 || value.Int64) : 0;
            } else if (key === 'datname' && (value === 0 || value === '0')) {
                // Fix for datname showing 0
                formattedValue = selectedDatabase;
            }

            const infoText = infoTexts[key];

            return (
                <Col span={8} key={key} style={{ marginBottom: 20 }}>
                    <Card
                        bordered={false}
                        title={
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <span style={{ color: 'gray', marginRight: '8px' }}>{key.replace(/_/g, ' ').toUpperCase()}</span>
                                {infoText && (
                                    <Tooltip title={infoText}>
                                        <InfoCircleOutlined style={{ color: 'blue', marginRight: '8px' }} />
                                    </Tooltip>
                                )}
                            </div>
                        }
                    >
                        <Statistic
                            loading={isLoadingDbStatsResults}
                            value={formattedValue}
                            valueRender={() => (
                                key !== 'stats_reset' && key !== 'datname' ?
                                    <CountUp end={formattedValue} duration={1} /> :
                                    <span>{formattedValue}</span>
                            )}
                        />
                    </Card>
                </Col>
            );
        }).filter(Boolean); // Filter out null values
    };




    // Alt menü seçildiğinde
    const handleSubMenuClick = (key: string) => {

        // Eğer önceki seçilen alt menü ile aynıysa, tekrar API çağrısı yapmayı önlemek için return
        if (key === selectedSubMenu) {
            return;
        }

        // İsteklerin çakışmaması için manuel değişiklik bayrağını aktifleştirelim
        setManualNodeChangeInProgress(true);

        // Alt menü tipine göre işlem yap ve activeTab değerini güncelle
        switch (key) {
            case 'user-access-list':
                setSelectedSubMenu('user-access-list');
                setActiveTab('7');
                break;
            case 'system':
                setSelectedSubMenu('system');
                setActiveTab('4');
                break;
            case 'transactions':
                setSelectedSubMenu('transactions');
                setActiveTab('5');
                break;
            case 'db-stats':
                setSelectedSubMenu('db-stats');
                setActiveTab('6');
                break;
            case 'capacity-planning':
                setSelectedSubMenu('capacity-planning');
                setActiveTab('8');
                break;
            case 'pgbouncer':
            case 'connections':
            case 'connections-by-app':
                setSelectedSubMenu(key);
                setActiveTab('1');
                break;
            case 'top-cpu':
            case 'blocking':
            case 'long-running':
            case 'cache-hit':
            case 'cache-hit-metrics':
            case 'deadlocks':
            case 'locks':
            case 'replication':
            case 'active-queries':
            case 'query-history':
                setSelectedSubMenu(key);
                setActiveTab('2');
                break;
            case 'index-usage':
            case 'index-bloat':
            case 'index-metrics':
                setSelectedSubMenu(key);
                setActiveTab('3');
                // Indexes tab'ına geçildiğinde database listesini yükle
                if (nodeName) {
                    fetchDatabases(nodeName);
                }
                break;
            default:
                setSelectedSubMenu(key);
        }

        // Alt menü değiştiğinde verileri hemen yükleyelim (nodeName varsa)
        if (nodeName) {
            switch (key) {
                case 'top-cpu':
                    fetchQueryTopCpuResults(nodeName);
                    break;
                case 'long-running':
                    fetchQueryLongRunningResults(nodeName);
                    break;
                case 'blocking':
                    fetchQueryLocksResults(nodeName);
                    break;
                case 'cache-hit':
                    fetchQueryCacheHitRatioResults(nodeName);
                    break;
                case 'cache-hit-metrics':
                    fetchCacheHitMetrics(nodeName, cacheHitTimeRange);
                    break;
                case 'deadlocks':
                    fetchDeadlocksMetrics(nodeName, deadlocksTimeRange);
                    break;
                case 'locks':
                    fetchLockMetrics(nodeName, lockTimeRange);
                    break;
                case 'replication':
                    fetchReplicationMetrics(nodeName, replicationTimeRange);
                    break;
                case 'active-queries':
                    fetchRealTimeActiveQueries(nodeName);
                    break;
                case 'query-history':
                    fetchQueryHistory(nodeName, queryHistoryTimeRange);
                    break;
                case 'connections':
                case 'connections-by-app':
                    fetchConnectionMetrics(nodeName, connectionTimeRange);
                    break;
                case 'transactions':
                    fetchTransactionMetrics(nodeName, transactionTimeRange);
                    break;
                case 'user-access-list':
                    fetchQueryUserAccessList(nodeName);
                    break;
                case 'system':
                    fetchSystemMetrics(nodeName);
                    break;
                case 'logs':
                    fetchPostgresLogs(nodeName);
                    break;
                case 'index-usage':
                    if (selectedDatabase) {
                        fetchQueryUnusedIndexes(nodeName, selectedDatabase);
                    }
                    break;
                case 'index-bloat':
                    if (selectedDatabase) {
                        fetchQueryIndexBloat(nodeName, selectedDatabase);
                    }
                    break;
                case 'table-bloat':
                    if (selectedDatabase) {
                        fetchQueryTableBloat(nodeName, selectedDatabase);
                    }
                    break;
                case 'index-metrics':
                    fetchIndexMetrics(nodeName, indexTimeRange);
                    break;
                case 'db-stats':
                    if (selectedDatabase) {
                        fetchQueryDbStats(nodeName, selectedDatabase);
                    }
                    break;
                case 'capacity-planning':
                    fetchDatabaseSizeData(nodeName);
                    break;
            }
        }

        // Bayrağı belirli bir süre sonra sıfırlayalım
        setTimeout(() => {
            setManualNodeChangeInProgress(false);
        }, 1000);
    };

    // Render fonksiyonları
    const renderConnectionsContent = () => {
        switch (selectedSubMenu) {
            case 'connections':
                return (
                    <div style={{ padding: '16px' }}>
                        {/* Time Range and Refresh Controls */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '20px',
                            padding: '12px',
                            background: 'linear-gradient(90deg, #f0f2ff 0%, #f9f0ff 100%)',
                            borderRadius: '8px',
                            border: '1px solid #d9d9d9'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ fontWeight: 500, color: '#722ed1' }}>Time Range:</span>
                                <Select
                                    value={connectionTimeRange}
                                    onChange={(value) => {
                                        setConnectionTimeRange(value);
                                        if (nodeName) {
                                            fetchConnectionMetrics(nodeName, value);
                                        }
                                    }}
                                    size="small"
                                    style={{ width: 80 }}
                                >
                                    <Option value="15m">15m</Option>
                                    <Option value="1h">1h</Option>
                                    <Option value="3h">3h</Option>
                                    <Option value="6h">6h</Option>
                                    <Option value="12h">12h</Option>
                                    <Option value="1d">1d</Option>
                                    <Option value="3d">3d</Option>
                                    <Option value="7d">7d</Option>
                                </Select>
                            </div>
                            <Button
                                type="primary"
                                onClick={() => {
                                    if (nodeName) {
                                        fetchConnectionMetrics(nodeName, connectionTimeRange);
                                    }
                                }}
                                icon={<ReloadOutlined />}
                                loading={isLoadingConnectionMetrics}
                                disabled={!nodeName}
                                style={{ background: '#722ed1', borderColor: '#722ed1' }}
                            >
                                Refresh
                            </Button>
                        </div>

                        {!nodeName && (
                            <Alert
                                message="Please select a node to view connection metrics"
                                type="info"
                                showIcon
                                style={{ marginBottom: '16px' }}
                            />
                        )}

                        {isLoadingConnectionMetrics ? (
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
                                <div style={{ textAlign: 'center' }}>
                                    <Spin size="large" />
                                    <div style={{ marginTop: '15px', color: '#722ed1', fontWeight: 'bold' }}>
                                        Loading Connection Metrics...
                                    </div>
                                </div>
                            </div>
                        ) : connectionSummary ? (
                            <>
                                {/* Connection Summary Cards */}
                                <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
                                    <Col xs={24} sm={12} md={8} lg={6}>
                                        <Card hoverable style={{ textAlign: 'center', height: '120px' }}>
                                            <div style={{ position: 'relative' }}>
                                                <Tooltip title="Connections currently executing queries or commands. These are actively processing database operations." placement="top">
                                                    <InfoCircleOutlined
                                                        style={{
                                                            position: 'absolute',
                                                            top: '-8px',
                                                            right: '-8px',
                                                            color: '#1890ff',
                                                            fontSize: '14px',
                                                            cursor: 'help'
                                                        }}
                                                    />
                                                </Tooltip>
                                                <Statistic
                                                    title="Active Connections"
                                                    value={connectionSummary.active}
                                                    valueStyle={{ color: '#52c41a', fontSize: '28px' }}
                                                    prefix={<TeamOutlined />}
                                                />
                                            </div>
                                        </Card>
                                    </Col>
                                    <Col xs={24} sm={12} md={8} lg={6}>
                                        <Card hoverable style={{ textAlign: 'center', height: '120px' }}>
                                            <div style={{ position: 'relative' }}>
                                                <Tooltip title="Number of connections that can still be established before reaching max_connections limit." placement="top">
                                                    <InfoCircleOutlined
                                                        style={{
                                                            position: 'absolute',
                                                            top: '-8px',
                                                            right: '-8px',
                                                            color: '#1890ff',
                                                            fontSize: '14px',
                                                            cursor: 'help'
                                                        }}
                                                    />
                                                </Tooltip>
                                                <Statistic
                                                    title="Available Connections"
                                                    value={connectionSummary.available}
                                                    valueStyle={{ color: '#1890ff', fontSize: '28px' }}
                                                    prefix={<DatabaseOutlined />}
                                                />
                                            </div>
                                        </Card>
                                    </Col>
                                    <Col xs={24} sm={12} md={8} lg={6}>
                                        <Card hoverable style={{ textAlign: 'center', height: '120px' }}>
                                            <div style={{ position: 'relative' }}>
                                                <Tooltip title="Total number of current database connections from all applications and users." placement="top">
                                                    <InfoCircleOutlined
                                                        style={{
                                                            position: 'absolute',
                                                            top: '-8px',
                                                            right: '-8px',
                                                            color: '#1890ff',
                                                            fontSize: '14px',
                                                            cursor: 'help'
                                                        }}
                                                    />
                                                </Tooltip>
                                                <Statistic
                                                    title="Total Connections"
                                                    value={connectionSummary.total}
                                                    valueStyle={{ color: '#722ed1', fontSize: '28px' }}
                                                    prefix={<ClusterOutlined />}
                                                />
                                            </div>
                                        </Card>
                                    </Col>
                                    <Col xs={24} sm={12} md={8} lg={6}>
                                        <Card hoverable style={{ textAlign: 'center', height: '120px' }}>
                                            <div style={{ position: 'relative' }}>
                                                <Tooltip title="Percentage of max_connections currently in use. High values (>80%) may indicate connection pooling issues." placement="top">
                                                    <InfoCircleOutlined
                                                        style={{
                                                            position: 'absolute',
                                                            top: '-8px',
                                                            right: '-8px',
                                                            color: '#1890ff',
                                                            fontSize: '14px',
                                                            cursor: 'help'
                                                        }}
                                                    />
                                                </Tooltip>
                                                <Statistic
                                                    title="Utilization %"
                                                    value={connectionSummary.utilization_percent}
                                                    precision={1}
                                                    valueStyle={{
                                                        color: connectionSummary.utilization_percent > 80 ? '#ff4d4f' : '#52c41a',
                                                        fontSize: '28px'
                                                    }}
                                                    suffix="%"
                                                />
                                            </div>
                                        </Card>
                                    </Col>
                                </Row>

                                {/* Additional Metrics */}
                                <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
                                    <Col xs={24} sm={12} md={8}>
                                        <Card title={
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <span>Idle Connections</span>
                                                <Tooltip title="Connections that are connected but not currently executing any queries. Normal in connection pooling scenarios." placement="top">
                                                    <InfoCircleOutlined
                                                        style={{
                                                            color: '#1890ff',
                                                            fontSize: '14px',
                                                            cursor: 'help'
                                                        }}
                                                    />
                                                </Tooltip>
                                            </div>
                                        } size="small" hoverable>
                                            <Statistic value={connectionSummary.idle} valueStyle={{ color: '#faad14' }} />
                                        </Card>
                                    </Col>
                                    <Col xs={24} sm={12} md={8}>
                                        <Card title={
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <span>Idle in Transaction</span>
                                                <Tooltip title="Connections in a transaction but not executing queries. High numbers may indicate application issues or long-running transactions." placement="top">
                                                    <InfoCircleOutlined
                                                        style={{
                                                            color: '#1890ff',
                                                            fontSize: '14px',
                                                            cursor: 'help'
                                                        }}
                                                    />
                                                </Tooltip>
                                            </div>
                                        } size="small" hoverable>
                                            <Statistic value={connectionSummary.idle_in_transaction} valueStyle={{ color: '#fa8c16' }} />
                                        </Card>
                                    </Col>
                                    <Col xs={24} sm={12} md={8}>
                                        <Card title={
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <span>Max Connections</span>
                                                <Tooltip title="Maximum number of concurrent connections allowed by PostgreSQL configuration (max_connections setting)." placement="top">
                                                    <InfoCircleOutlined
                                                        style={{
                                                            color: '#1890ff',
                                                            fontSize: '14px',
                                                            cursor: 'help'
                                                        }}
                                                    />
                                                </Tooltip>
                                            </div>
                                        } size="small" hoverable>
                                            <Statistic value={connectionSummary.max_connections} valueStyle={{ color: '#722ed1' }} />
                                        </Card>
                                    </Col>
                                    <Col xs={24} sm={12} md={8}>
                                        <Card title={
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <span>Blocked Connections</span>
                                                <Tooltip title="Connections waiting for locks held by other transactions. High numbers indicate locking contention issues." placement="top">
                                                    <InfoCircleOutlined
                                                        style={{
                                                            color: '#1890ff',
                                                            fontSize: '14px',
                                                            cursor: 'help'
                                                        }}
                                                    />
                                                </Tooltip>
                                            </div>
                                        } size="small" hoverable>
                                            <Statistic
                                                value={connectionSummary.blocked}
                                                valueStyle={{ color: connectionSummary.blocked > 0 ? '#ff4d4f' : '#52c41a' }}
                                            />
                                        </Card>
                                    </Col>
                                    <Col xs={24} sm={12} md={8}>
                                        <Card title={
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <span>Blocking Connections</span>
                                                <Tooltip title="Connections holding locks that are blocking other transactions. Should be investigated if count is high." placement="top">
                                                    <InfoCircleOutlined
                                                        style={{
                                                            color: '#1890ff',
                                                            fontSize: '14px',
                                                            cursor: 'help'
                                                        }}
                                                    />
                                                </Tooltip>
                                            </div>
                                        } size="small" hoverable>
                                            <Statistic
                                                value={connectionSummary.blocking}
                                                valueStyle={{ color: connectionSummary.blocking > 0 ? '#ff4d4f' : '#52c41a' }}
                                            />
                                        </Card>
                                    </Col>
                                    <Col xs={24} sm={12} md={8}>
                                        <Card title={
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <span>Long Running Queries</span>
                                                <Tooltip title="Number of queries running longer than expected. May indicate performance issues or inefficient queries." placement="top">
                                                    <InfoCircleOutlined
                                                        style={{
                                                            color: '#1890ff',
                                                            fontSize: '14px',
                                                            cursor: 'help'
                                                        }}
                                                    />
                                                </Tooltip>
                                            </div>
                                        } size="small" hoverable>
                                            <Statistic
                                                value={connectionSummary.long_running_queries}
                                                valueStyle={{ color: connectionSummary.long_running_queries > 0 ? '#fa8c16' : '#52c41a' }}
                                            />
                                        </Card>
                                    </Col>
                                </Row>

                                {/* Historical Chart */}
                                {connectionHistoricalData.length > 0 && (
                                    <Card
                                        title="Connection History"
                                        style={{ marginTop: '16px' }}
                                    >
                                        <div style={{ height: '300px' }}>
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={connectionHistoricalData}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                                    <XAxis
                                                        dataKey="formattedTime"
                                                        tick={{ fontSize: 12 }}
                                                        angle={-45}
                                                        textAnchor="end"
                                                        height={60}
                                                    />
                                                    <YAxis tick={{ fontSize: 12 }} />
                                                    <RechartsTooltip
                                                        formatter={(value, name) => {
                                                            const nameStr = name as string;
                                                            if (nameStr === 'active') {
                                                                return [value, 'Active Connections'];
                                                            } else if (nameStr === 'available') {
                                                                return [value, 'Available Connections'];
                                                            } else if (nameStr === 'total') {
                                                                return [value, 'Total Connections'];
                                                            }
                                                            return [value, nameStr]; // Fallback
                                                        }}
                                                        labelFormatter={(label) => `Time: ${label}`}
                                                    />
                                                    <Line
                                                        type="monotone"
                                                        dataKey="active"
                                                        stroke="#52c41a"
                                                        strokeWidth={2}
                                                        name="Active Connections"
                                                    />
                                                    <Line
                                                        type="monotone"
                                                        dataKey="available"
                                                        stroke="#1890ff"
                                                        strokeWidth={2}
                                                        name="Available Connections"
                                                    />
                                                    <Line
                                                        type="monotone"
                                                        dataKey="total"
                                                        stroke="#722ed1"
                                                        strokeWidth={2}
                                                        name="Total Connections"
                                                    />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </Card>
                                )}
                            </>
                        ) : (
                            <Empty description="No connection data available" />
                        )}
                    </div>
                );
            case 'connections-by-app':
                return (
                    <div style={{ padding: '16px' }}>
                        {/* Controls */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '20px',
                            padding: '12px',
                            background: 'linear-gradient(90deg, #f0f2ff 0%, #f9f0ff 100%)',
                            borderRadius: '8px',
                            border: '1px solid #d9d9d9'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ fontWeight: 500, color: '#722ed1' }}>Time Range:</span>
                                <Select
                                    value={connectionTimeRange}
                                    onChange={(value) => {
                                        setConnectionTimeRange(value);
                                        if (nodeName) {
                                            fetchConnectionMetrics(nodeName, value);
                                        }
                                    }}
                                    size="small"
                                    style={{ width: 80 }}
                                >
                                    <Option value="15m">15m</Option>
                                    <Option value="1h">1h</Option>
                                    <Option value="3h">3h</Option>
                                    <Option value="6h">6h</Option>
                                    <Option value="12h">12h</Option>
                                    <Option value="1d">1d</Option>
                                    <Option value="3d">3d</Option>
                                    <Option value="7d">7d</Option>
                                </Select>
                            </div>
                            <Button
                                type="primary"
                                onClick={() => {
                                    if (nodeName) {
                                        fetchConnectionMetrics(nodeName, connectionTimeRange);
                                    }
                                }}
                                icon={<ReloadOutlined />}
                                loading={isLoadingConnectionMetrics}
                                disabled={!nodeName}
                                style={{ background: '#722ed1', borderColor: '#722ed1' }}
                            >
                                Refresh
                            </Button>
                        </div>

                        {isLoadingConnectionMetrics ? (
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
                                <div style={{ textAlign: 'center' }}>
                                    <Spin size="large" />
                                    <div style={{ marginTop: '15px', color: '#722ed1', fontWeight: 'bold' }}>
                                        Loading Connection Data...
                                    </div>
                                </div>
                            </div>
                        ) : connectionsByApplication.length > 0 ? (
                            <>
                                {/* Applications Table */}
                                <Card title="Connections by Application" style={{ marginBottom: '24px' }}>
                                    <Table
                                        dataSource={connectionsByApplication.map((app, index) => ({ ...app, key: index }))}
                                        columns={[
                                            {
                                                title: 'Application Name',
                                                dataIndex: 'application',
                                                key: 'application',
                                                render: (text: string) => (
                                                    <span style={{ fontWeight: 500 }}>{text}</span>
                                                )
                                            },
                                            {
                                                title: 'Connection Count',
                                                dataIndex: 'count',
                                                key: 'count',
                                                render: (count: number) => (
                                                    <Tag color="blue" style={{ fontSize: '14px', padding: '4px 8px' }}>
                                                        {count}
                                                    </Tag>
                                                )
                                            },
                                            {
                                                title: 'Last Seen',
                                                dataIndex: 'timestamp',
                                                key: 'timestamp',
                                                render: (timestamp: string) => (
                                                    <span style={{ color: '#666' }}>
                                                        {new Date(timestamp).toLocaleString()}
                                                    </span>
                                                )
                                            }
                                        ]}
                                        pagination={false}
                                        size="small"
                                        scroll={{ x: 'max-content' }}
                                    />
                                </Card>

                                {/* Database breakdown if available */}
                                {connectionsByDatabase.length > 0 && (
                                    <Card title="Connections by Database">
                                        <Table
                                            dataSource={connectionsByDatabase.map((db, index) => ({ ...db, key: index }))}
                                            columns={[
                                                {
                                                    title: 'Database Name',
                                                    dataIndex: 'database',
                                                    key: 'database',
                                                    render: (text: string) => (
                                                        <span style={{ fontWeight: 500 }}>{text}</span>
                                                    )
                                                },
                                                {
                                                    title: 'Connection Count',
                                                    dataIndex: 'count',
                                                    key: 'count',
                                                    render: (count: number) => (
                                                        <Tag color="green" style={{ fontSize: '14px', padding: '4px 8px' }}>
                                                            {count}
                                                        </Tag>
                                                    )
                                                },
                                                {
                                                    title: 'Last Seen',
                                                    dataIndex: 'timestamp',
                                                    key: 'timestamp',
                                                    render: (timestamp: string) => (
                                                        <span style={{ color: '#666' }}>
                                                            {new Date(timestamp).toLocaleString()}
                                                        </span>
                                                    )
                                                }
                                            ]}
                                            pagination={false}
                                            size="small"
                                            scroll={{ x: 'max-content' }}
                                        />
                                    </Card>
                                )}
                            </>
                        ) : (
                            <Empty description="No application connection data available" />
                        )}
                    </div>
                );
            default:
                return (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px', flexDirection: 'column' }}>
                        <InfoCircleOutlined style={{ fontSize: '48px', color: '#1890ff', marginBottom: '16px' }} />
                        <Text type="secondary">Please select a submenu item from the left sidebar</Text>
                    </div>
                );
        }
    };

    const renderQueriesContent = () => {
        switch (selectedSubMenu) {
            case 'top-cpu':
                return (
                    <div style={{ marginTop: 10 }}>
                        <Table
                            pagination={false}
                            loading={isLoadingTopCpuResults}
                            dataSource={queryResultsTopCpu.map((result, index) => ({ ...result, key: `cpu-${index}` }))}
                            columns={columnsTopCpu}
                            scroll={{ x: 'max-content' }}
                            rowKey="key"
                            footer={() => (
                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <button onClick={() => fetchQueryTopCpuResults(nodeName)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                                        <ReloadOutlined style={{ color: 'black', fontSize: '16px' }} />
                                        <span style={{ marginLeft: '5px', color: 'black' }}>Refresh</span>
                                    </button>
                                </div>
                            )}
                            title={() => (
                                <div style={{ display: 'flex', alignItems: 'left' }}>
                                </div>
                            )}
                        />
                    </div>
                );
            case 'blocking':
                return (
                    <div style={{ marginTop: 10 }}>
                        <Table
                            pagination={false}
                            loading={isLoadingLocksQueryResults}
                            dataSource={queryResultsLocks.map((result, index) => ({ ...result, key: `lock-${index}` }))}
                            columns={columnsLocks}
                            scroll={{ x: 'max-content' }}
                            rowKey="key"
                            footer={() => (
                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <button onClick={() => fetchQueryLocksResults(nodeName)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                                        <ReloadOutlined style={{ color: 'black', fontSize: '16px' }} />
                                        <span style={{ marginLeft: '5px', color: 'black' }}>Refresh</span>
                                    </button>
                                </div>
                            )}
                            title={() => (
                                <div style={{ display: 'flex', alignItems: 'left' }}>
                                </div>
                            )}
                        />
                    </div>
                );
            case 'long-running':
                return (
                    <div style={{ marginTop: 10 }}>
                        <Table
                            pagination={false}
                            loading={isLoadingLongRunningQueryResults}
                            dataSource={queryResultsLongRunning.map((result, index) => ({ ...result, key: `long-${index}` }))}
                            columns={columnsLongRunning}
                            scroll={{ x: 'max-content' }}
                            rowKey="key"
                            footer={() => (
                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <button onClick={() => fetchQueryLongRunningResults(nodeName)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                                        <ReloadOutlined style={{ color: 'black', fontSize: '16px' }} />
                                        <span style={{ marginLeft: '5px', color: 'black' }}>Refresh</span>
                                    </button>
                                </div>
                            )}
                            title={() => (
                                <div style={{ display: 'flex', alignItems: 'left' }}>
                                </div>
                            )}
                        />
                    </div>
                );

            case 'cache-hit-metrics':
                return (
                    <div style={{ padding: '16px' }}>
                        {/* Time Range and Refresh Controls */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '20px',
                            padding: '12px',
                            background: 'linear-gradient(90deg, #f0f2ff 0%, #f9f0ff 100%)',
                            borderRadius: '8px',
                            border: '1px solid #d9d9d9'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ fontWeight: 500, color: '#722ed1' }}>Time Range:</span>
                                <Select
                                    value={cacheHitTimeRange}
                                    onChange={(value) => {
                                        setCacheHitTimeRange(value);
                                        if (nodeName) {
                                            fetchCacheHitMetrics(nodeName, value);
                                        }
                                    }}
                                    size="small"
                                    style={{ width: 80 }}
                                >
                                    <Option value="15m">15m</Option>
                                    <Option value="1h">1h</Option>
                                    <Option value="3h">3h</Option>
                                    <Option value="6h">6h</Option>
                                    <Option value="12h">12h</Option>
                                    <Option value="1d">1d</Option>
                                    <Option value="3d">3d</Option>
                                    <Option value="7d">7d</Option>
                                </Select>
                            </div>
                            <Button
                                type="primary"
                                onClick={() => {
                                    if (nodeName) {
                                        fetchCacheHitMetrics(nodeName, cacheHitTimeRange);
                                    }
                                }}
                                icon={<ReloadOutlined />}
                                loading={isLoadingCacheHitMetrics}
                                disabled={!nodeName}
                                style={{ background: '#722ed1', borderColor: '#722ed1' }}
                            >
                                Refresh
                            </Button>
                        </div>

                        {!nodeName && (
                            <Alert
                                message="Please select a node to view cache hit metrics"
                                type="info"
                                showIcon
                                style={{ marginBottom: '16px' }}
                            />
                        )}

                        {isLoadingCacheHitMetrics ? (
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
                                <div style={{ textAlign: 'center' }}>
                                    <Spin size="large" />
                                    <div style={{ marginTop: '15px', color: '#722ed1', fontWeight: 'bold' }}>
                                        Loading Cache Hit Metrics...
                                    </div>
                                </div>
                            </div>
                        ) : cacheHitSummary ? (
                            <>
                                {/* Show info message if only hit data is available */}
                                {cacheHitSummary.total_blocks_read === 0 && cacheHitSummary.total_blocks_hit > 0 && (
                                    <Alert
                                        message="Cache Hit Metrics Information"
                                        description="Currently showing only cache hit data. Cache read data is not available, so cache hit ratios are calculated assuming optimal cache performance."
                                        type="info"
                                        showIcon
                                        style={{ marginBottom: '16px' }}
                                        closable
                                    />
                                )}

                                {/* Cache Hit Summary Cards */}
                                <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
                                    <Col xs={24} sm={12} md={8} lg={6}>
                                        <Card hoverable style={{ textAlign: 'center', height: '120px' }}>
                                            <div style={{ position: 'relative' }}>
                                                <Tooltip title="Total blocks read from cache (buffer pool hits). Higher values indicate efficient cache usage." placement="top">
                                                    <InfoCircleOutlined
                                                        style={{
                                                            position: 'absolute',
                                                            top: '-8px',
                                                            right: '-8px',
                                                            color: '#1890ff',
                                                            fontSize: '14px',
                                                            cursor: 'help'
                                                        }}
                                                    />
                                                </Tooltip>
                                                <Statistic
                                                    title="Blocks Hit"
                                                    value={cacheHitSummary.total_blocks_hit}
                                                    valueStyle={{ color: '#52c41a', fontSize: '24px' }}
                                                    prefix={<DatabaseOutlined />}
                                                />
                                            </div>
                                        </Card>
                                    </Col>
                                    <Col xs={24} sm={12} md={8} lg={6}>
                                        <Card hoverable style={{ textAlign: 'center', height: '120px' }}>
                                            <div style={{ position: 'relative' }}>
                                                <Tooltip title="Total blocks read from disk (cache misses). Lower values indicate better cache performance." placement="top">
                                                    <InfoCircleOutlined
                                                        style={{
                                                            position: 'absolute',
                                                            top: '-8px',
                                                            right: '-8px',
                                                            color: '#1890ff',
                                                            fontSize: '14px',
                                                            cursor: 'help'
                                                        }}
                                                    />
                                                </Tooltip>
                                                <Statistic
                                                    title="Blocks Read"
                                                    value={cacheHitSummary.total_blocks_read}
                                                    valueStyle={{ color: '#faad14', fontSize: '24px' }}
                                                    prefix={<FileSearchOutlined />}
                                                />
                                            </div>
                                        </Card>
                                    </Col>
                                    <Col xs={24} sm={12} md={8} lg={6}>
                                        <Card hoverable style={{ textAlign: 'center', height: '120px' }}>
                                            <div style={{ position: 'relative' }}>
                                                <Tooltip title="Percentage of blocks served from cache vs disk. Higher values (>95%) indicate optimal cache performance." placement="top">
                                                    <InfoCircleOutlined
                                                        style={{
                                                            position: 'absolute',
                                                            top: '-8px',
                                                            right: '-8px',
                                                            color: '#1890ff',
                                                            fontSize: '14px',
                                                            cursor: 'help'
                                                        }}
                                                    />
                                                </Tooltip>
                                                <Statistic
                                                    title="Cache Hit Ratio"
                                                    value={cacheHitSummary.cache_hit_ratio}
                                                    precision={1}
                                                    valueStyle={{
                                                        color: cacheHitSummary.cache_hit_ratio >= 95 ? '#52c41a' :
                                                            cacheHitSummary.cache_hit_ratio >= 85 ? '#faad14' : '#ff4d4f',
                                                        fontSize: '24px'
                                                    }}
                                                    suffix="%"
                                                />
                                            </div>
                                        </Card>
                                    </Col>
                                </Row>

                                {/* Database Breakdown */}
                                {cacheHitByDatabase.length > 0 && (
                                    <Card title="Cache Hit Ratio by Database" style={{ marginBottom: '24px' }}>
                                    <Table
                                            dataSource={cacheHitByDatabase.map((db, index) => ({ ...db, key: index }))}
                                        columns={[
                                            {
                                                    title: 'Database',
                                                    dataIndex: 'database',
                                                    key: 'database',
                                                render: (text: string) => (
                                                        <span style={{ fontWeight: 500 }}>{text}</span>
                                                    )
                                                },
                                                {
                                                    title: 'Blocks Hit',
                                                    dataIndex: 'blocks_hit',
                                                    key: 'blocks_hit',
                                                    render: (count: number) => (
                                                        <Tag color="green" style={{ fontSize: '14px', padding: '4px 8px' }}>
                                                            {count.toLocaleString()}
                                                    </Tag>
                                                )
                                            },
                                                {
                                                    title: 'Blocks Read',
                                                    dataIndex: 'blocks_read',
                                                    key: 'blocks_read',
                                                    render: (count: number) => (
                                                        <Tag color="orange" style={{ fontSize: '14px', padding: '4px 8px' }}>
                                                            {count.toLocaleString()}
                                                        </Tag>
                                                    )
                                                },
                                                {
                                                    title: 'Cache Hit Ratio',
                                                    dataIndex: 'cache_hit_ratio',
                                                    key: 'cache_hit_ratio',
                                                    render: (ratio: number) => (
                                                        <span style={{
                                                            color: ratio >= 95 ? '#52c41a' : ratio >= 85 ? '#faad14' : '#ff4d4f',
                                                            fontWeight: 'bold'
                                                        }}>
                                                            {ratio}%
                                                        </span>
                                                    )
                                                }
                                            ]}
                                            pagination={false}
                                            size="small"
                                            scroll={{ x: 'max-content' }}
                                        />
                                    </Card>
                                )}

                                {/* Historical Chart */}
                                {cacheHitHistoricalData.length > 0 && (
                                    <Card
                                        title="Cache Hit Ratio History"
                                        style={{ marginTop: '16px' }}
                                    >
                                        <div style={{ height: '300px' }}>
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={cacheHitHistoricalData}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                                    <XAxis
                                                        dataKey="formattedTime"
                                                        tick={{ fontSize: 12 }}
                                                        angle={-45}
                                                        textAnchor="end"
                                                        height={60}
                                                    />
                                                    <YAxis
                                                        tick={{ fontSize: 12 }}
                                                        domain={[0, 100]}
                                                        label={{ value: 'Cache Hit Ratio (%)', angle: -90, position: 'insideLeft' }}
                                                    />
                                                    <RechartsTooltip
                                                        formatter={(value, name) => [`${Number(value).toFixed(1)}%`, 'Cache Hit Ratio']}
                                                        labelFormatter={(label) => `Time: ${label}`}
                                                    />
                                                    <Line
                                                        type="monotone"
                                                        dataKey="cache_hit_ratio"
                                                        stroke="#1890ff"
                                                        strokeWidth={2}
                                                        name="Cache Hit Ratio"
                                                    />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </Card>
                                )}
                            </>
                        ) : (
                            <Empty description="No cache hit data available" />
                        )}
                    </div>
                );
            case 'deadlocks':
                return (
                    <div style={{ padding: '16px' }}>
                        {/* Time Range and Refresh Controls */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '20px',
                            padding: '12px',
                            background: 'linear-gradient(90deg, #f0f2ff 0%, #f9f0ff 100%)',
                            borderRadius: '8px',
                            border: '1px solid #d9d9d9'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ fontWeight: 500, color: '#722ed1' }}>Time Range:</span>
                                <Select
                                    value={deadlocksTimeRange}
                                    onChange={(value) => {
                                        setDeadlocksTimeRange(value);
                                        if (nodeName) {
                                            fetchDeadlocksMetrics(nodeName, value);
                                        }
                                    }}
                                    size="small"
                                    style={{ width: 80 }}
                                >
                                    <Option value="15m">15m</Option>
                                    <Option value="1h">1h</Option>
                                    <Option value="3h">3h</Option>
                                    <Option value="6h">6h</Option>
                                    <Option value="12h">12h</Option>
                                    <Option value="1d">1d</Option>
                                    <Option value="3d">3d</Option>
                                    <Option value="7d">7d</Option>
                                </Select>
                            </div>
                            <Button
                                type="primary"
                                onClick={() => {
                                    if (nodeName) {
                                        fetchDeadlocksMetrics(nodeName, deadlocksTimeRange);
                                    }
                                }}
                                icon={<ReloadOutlined />}
                                loading={isLoadingDeadlocksMetrics}
                                disabled={!nodeName}
                                style={{ background: '#722ed1', borderColor: '#722ed1' }}
                            >
                                Refresh
                            </Button>
                        </div>

                        {!nodeName && (
                            <Alert
                                message="Please select a node to view deadlock metrics"
                                type="info"
                                showIcon
                                style={{ marginBottom: '16px' }}
                            />
                        )}

                        {isLoadingDeadlocksMetrics ? (
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
                                <div style={{ textAlign: 'center' }}>
                                    <Spin size="large" />
                                    <div style={{ marginTop: '15px', color: '#722ed1', fontWeight: 'bold' }}>
                                        Loading Deadlock Metrics...
                                    </div>
                                </div>
                            </div>
                        ) : deadlocksSummary ? (
                            <>
                                {/* Deadlock Summary Cards */}
                                <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
                                    <Col xs={24} sm={12} md={8} lg={6}>
                                        <Card hoverable style={{ textAlign: 'center', height: '120px' }}>
                                            <div style={{ position: 'relative' }}>
                                                <Tooltip title="Total number of deadlocks detected. Deadlocks occur when transactions wait for each other in a cycle." placement="top">
                                                    <InfoCircleOutlined
                                                        style={{
                                                            position: 'absolute',
                                                            top: '-8px',
                                                            right: '-8px',
                                                            color: '#1890ff',
                                                            fontSize: '14px',
                                                            cursor: 'help'
                                                        }}
                                                    />
                                                </Tooltip>
                                                <Statistic
                                                    title="Total Deadlocks"
                                                    value={deadlocksSummary.total_deadlocks}
                                                    valueStyle={{
                                                        color: deadlocksSummary.total_deadlocks > 0 ? '#ff4d4f' : '#52c41a',
                                                        fontSize: '24px'
                                                    }}
                                                    prefix={deadlocksSummary.total_deadlocks > 0 ? <CloseOutlined /> : <CheckOutlined />}
                                                />
                                            </div>
                                        </Card>
                                    </Col>
                                    <Col xs={24} sm={12} md={8} lg={6}>
                                        <Card hoverable style={{ textAlign: 'center', height: '120px' }}>
                                            <div style={{ position: 'relative' }}>
                                                <Tooltip title="Current number of deadlocks. This shows the latest deadlock count from the monitoring period." placement="top">
                                                    <InfoCircleOutlined
                                                        style={{
                                                            position: 'absolute',
                                                            top: '-8px',
                                                            right: '-8px',
                                                            color: '#1890ff',
                                                            fontSize: '14px',
                                                            cursor: 'help'
                                                        }}
                                                    />
                                                </Tooltip>
                                                <Statistic
                                                    title="Current Deadlocks"
                                                    value={deadlocksSummary.current_deadlocks}
                                                    valueStyle={{
                                                        color: deadlocksSummary.current_deadlocks > 0 ? '#faad14' : '#52c41a',
                                                        fontSize: '24px'
                                                    }}
                                                    prefix={<DatabaseOutlined />}
                                                />
                                            </div>
                                        </Card>
                                    </Col>
                                    <Col xs={24} sm={12} md={8} lg={6}>
                                        <Card hoverable style={{ textAlign: 'center', height: '120px' }}>
                                            <div style={{ position: 'relative' }}>
                                                <Tooltip title="Rate of deadlocks per second. Lower values are better. Values >0.1/s may indicate application issues." placement="top">
                                                    <InfoCircleOutlined
                                                        style={{
                                                            position: 'absolute',
                                                            top: '-8px',
                                                            right: '-8px',
                                                            color: '#1890ff',
                                                            fontSize: '14px',
                                                            cursor: 'help'
                                                        }}
                                                    />
                                                </Tooltip>
                                                <Statistic
                                                    title="Deadlock Rate"
                                                    value={deadlocksSummary.deadlock_rate}
                                                    precision={1}
                                                    valueStyle={{
                                                        color: deadlocksSummary.deadlock_rate > 0.1 ? '#ff4d4f' :
                                                            deadlocksSummary.deadlock_rate > 0 ? '#faad14' : '#52c41a',
                                                        fontSize: '24px'
                                                    }}
                                                    suffix="/s"
                                                />
                                            </div>
                                        </Card>
                                    </Col>
                                    <Col xs={24} sm={12} md={8} lg={6}>
                                        <Card hoverable style={{ textAlign: 'center', height: '120px' }}>
                                            <div style={{ position: 'relative' }}>
                                                <Tooltip title="Average deadlocks per hour. Helps identify deadlock trends over time." placement="top">
                                                    <InfoCircleOutlined
                                                        style={{
                                                            position: 'absolute',
                                                            top: '-8px',
                                                            right: '-8px',
                                                            color: '#1890ff',
                                                            fontSize: '14px',
                                                            cursor: 'help'
                                                        }}
                                                    />
                                                </Tooltip>
                                                <Statistic
                                                    title="Avg/Hour"
                                                    value={deadlocksSummary.avg_deadlocks_per_hour}
                                                    precision={1}
                                                    valueStyle={{
                                                        color: deadlocksSummary.avg_deadlocks_per_hour > 10 ? '#ff4d4f' :
                                                            deadlocksSummary.avg_deadlocks_per_hour > 1 ? '#faad14' : '#52c41a',
                                                        fontSize: '24px'
                                                    }}
                                                />
                                            </div>
                                        </Card>
                                    </Col>
                                </Row>

                                {/* Database Breakdown */}
                                {deadlocksByDatabase.length > 0 && (
                                    <Card title="Deadlocks by Database" style={{ marginBottom: '24px' }}>
                                        <Table
                                            dataSource={deadlocksByDatabase.map((db, index) => ({ ...db, key: index }))}
                                            columns={[
                                            {
                                                title: 'Database',
                                                dataIndex: 'database',
                                                key: 'database',
                                                render: (text: string) => (
                                                    <span style={{ fontWeight: 500 }}>{text}</span>
                                                )
                                            },
                                            {
                                                    title: 'Deadlocks',
                                                    dataIndex: 'deadlocks',
                                                    key: 'deadlocks',
                                                    render: (count: number) => (
                                                        <Tag color={count > 0 ? "red" : "green"} style={{ fontSize: '14px', padding: '4px 8px' }}>
                                                            {count}
                                                        </Tag>
                                                    )
                                                },
                                                {
                                                    title: 'Deadlock Rate',
                                                    dataIndex: 'deadlock_rate',
                                                    key: 'deadlock_rate',
                                                    render: (rate: number) => (
                                                        <span style={{
                                                            color: rate > 0.1 ? '#ff4d4f' : rate > 0 ? '#faad14' : '#52c41a'
                                                        }}>
                                                            {rate}/s
                                                        </span>
                                                    )
                                                },
                                                {
                                                    title: 'Last Updated',
                                                    dataIndex: 'timestamp',
                                                    key: 'timestamp',
                                                    render: (timestamp: string) => (
                                                        <span style={{ color: '#666' }}>
                                                            {new Date(timestamp).toLocaleString()}
                                                        </span>
                                                    )
                                                }
                                            ]}
                                            pagination={false}
                                            size="small"
                                            scroll={{ x: 'max-content' }}
                                        />
                                    </Card>
                                )}

                                {/* Historical Chart */}
                                {deadlocksHistoricalData.length > 0 && (
                                    <Card
                                        title="Deadlock History"
                                        style={{ marginTop: '16px' }}
                                    >
                                        <div style={{ height: '300px' }}>
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={deadlocksHistoricalData}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                                    <XAxis
                                                        dataKey="formattedTime"
                                                        tick={{ fontSize: 12 }}
                                                        angle={-45}
                                                        textAnchor="end"
                                                        height={60}
                                                    />
                                                    <YAxis
                                                        tick={{ fontSize: 12 }}
                                                        domain={[0, 'dataMax']}
                                                        label={{ value: 'Deadlock Count', angle: -90, position: 'insideLeft' }}
                                                    />
                                                    <RechartsTooltip
                                                        formatter={(value, name) => [Number(value), 'Deadlocks']}
                                                        labelFormatter={(label) => `Time: ${label}`}
                                                    />
                                                    <Line
                                                        type="monotone"
                                                        dataKey="_value"
                                                        stroke="#ff4d4f"
                                                        strokeWidth={2}
                                                        name="Deadlocks"
                                                    />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </Card>
                                )}
                            </>
                        ) : (
                            <Empty description="No deadlock data available" />
                        )}
                    </div>
                );
            case 'replication':
                return (
                    <div style={{ padding: '16px' }}>
                        {/* Time Range and Refresh Controls */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '20px',
                            padding: '12px',
                            background: 'linear-gradient(90deg, #f0f2ff 0%, #f9f0ff 100%)',
                            borderRadius: '8px',
                            border: '1px solid #d9d9d9'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ fontWeight: 500, color: '#722ed1' }}>Time Range:</span>
                                <Select
                                    value={replicationTimeRange}
                                    onChange={(value) => {
                                        setReplicationTimeRange(value);
                                        if (nodeName) {
                                            fetchReplicationMetrics(nodeName, value);
                                        }
                                    }}
                                    size="small"
                                    style={{ width: 80 }}
                                >
                                    <Option value="15m">15m</Option>
                                    <Option value="1h">1h</Option>
                                    <Option value="3h">3h</Option>
                                    <Option value="6h">6h</Option>
                                    <Option value="12h">12h</Option>
                                    <Option value="1d">1d</Option>
                                    <Option value="3d">3d</Option>
                                    <Option value="7d">7d</Option>
                                </Select>
                            </div>
                            <Button
                                type="primary"
                                onClick={() => {
                                    if (nodeName) {
                                        fetchReplicationMetrics(nodeName, replicationTimeRange);
                                    }
                                }}
                                icon={<ReloadOutlined />}
                                loading={isLoadingReplicationMetrics}
                                disabled={!nodeName}
                                style={{ background: '#722ed1', borderColor: '#722ed1' }}
                            >
                                Refresh
                            </Button>
                        </div>

                        {!nodeName && (
                            <Alert
                                message="Please select a node to view replication metrics"
                                type="info"
                                showIcon
                                style={{ marginBottom: '16px' }}
                            />
                        )}

                        {isLoadingReplicationMetrics ? (
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
                                <div style={{ textAlign: 'center' }}>
                                    <Spin size="large" />
                                    <div style={{ marginTop: '15px', color: '#722ed1', fontWeight: 'bold' }}>
                                        Loading Replication Metrics...
                                    </div>
                                </div>
                            </div>
                        ) : replicationSummary ? (
                            <>
                                {/* Replication Summary Cards */}
                                <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
                                    <Col xs={24} sm={12} md={8} lg={6}>
                                        <Card hoverable style={{ textAlign: 'center', height: '120px' }}>
                                            <div style={{ position: 'relative' }}>
                                                <Tooltip title="Average time for master to write changes to its WAL. Lower is better (<10ms ideal)." placement="top">
                                                    <InfoCircleOutlined
                                                        style={{
                                                            position: 'absolute',
                                                            top: '-8px',
                                                            right: '-8px',
                                                            color: '#1890ff',
                                                            fontSize: '14px',
                                                            cursor: 'help'
                                                        }}
                                                    />
                                                </Tooltip>
                                                <Statistic
                                                    title="Avg Write Lag"
                                                    value={replicationSummary.avg_write_lag}
                                                    precision={3}
                                                    valueStyle={{
                                                        color: replicationSummary.avg_write_lag > 0.1 ? '#ff4d4f' :
                                                            replicationSummary.avg_write_lag > 0.01 ? '#faad14' : '#52c41a',
                                                        fontSize: '24px'
                                                    }}
                                                    suffix="s"
                                                />
                                            </div>
                                        </Card>
                                    </Col>
                                    <Col xs={24} sm={12} md={8} lg={6}>
                                        <Card hoverable style={{ textAlign: 'center', height: '120px' }}>
                                            <div style={{ position: 'relative' }}>
                                                <Tooltip title="Average time for replica to flush received data to disk. Should be <100ms." placement="top">
                                                    <InfoCircleOutlined
                                                        style={{
                                                            position: 'absolute',
                                                            top: '-8px',
                                                            right: '-8px',
                                                            color: '#1890ff',
                                                            fontSize: '14px',
                                                            cursor: 'help'
                                                        }}
                                                    />
                                                </Tooltip>
                                                <Statistic
                                                    title="Avg Flush Lag"
                                                    value={replicationSummary.avg_flush_lag}
                                                    precision={3}
                                                    valueStyle={{
                                                        color: replicationSummary.avg_flush_lag > 0.1 ? '#ff4d4f' :
                                                            replicationSummary.avg_flush_lag > 0.01 ? '#faad14' : '#52c41a',
                                                        fontSize: '24px'
                                                    }}
                                                    suffix="s"
                                                />
                                            </div>
                                        </Card>
                                    </Col>
                                    <Col xs={24} sm={12} md={8} lg={6}>
                                        <Card hoverable style={{ textAlign: 'center', height: '120px' }}>
                                            <div style={{ position: 'relative' }}>
                                                <Tooltip title="Average time for replica to apply changes to database. Should be <100ms." placement="top">
                                                    <InfoCircleOutlined
                                                        style={{
                                                            position: 'absolute',
                                                            top: '-8px',
                                                            right: '-8px',
                                                            color: '#1890ff',
                                                            fontSize: '14px',
                                                            cursor: 'help'
                                                        }}
                                                    />
                                                </Tooltip>
                                                <Statistic
                                                    title="Avg Replay Lag"
                                                    value={replicationSummary.avg_replay_lag}
                                                    precision={3}
                                                    valueStyle={{
                                                        color: replicationSummary.avg_replay_lag > 0.1 ? '#ff4d4f' :
                                                            replicationSummary.avg_replay_lag > 0.01 ? '#faad14' : '#52c41a',
                                                        fontSize: '24px'
                                                    }}
                                                    suffix="s"
                                                />
                                            </div>
                                        </Card>
                                    </Col>
                                    <Col xs={24} sm={12} md={8} lg={6}>
                                        <Card hoverable style={{ textAlign: 'center', height: '120px' }}>
                                            <div style={{ position: 'relative' }}>
                                                <Tooltip title="Number of healthy replicas vs total replicas. All replicas should be healthy." placement="top">
                                                    <InfoCircleOutlined
                                                        style={{
                                                            position: 'absolute',
                                                            top: '-8px',
                                                            right: '-8px',
                                                            color: '#1890ff',
                                                            fontSize: '14px',
                                                            cursor: 'help'
                                                        }}
                                                    />
                                                </Tooltip>
                                                <Statistic
                                                    title="Replica Health"
                                                    value={`${replicationSummary.healthy_replicas}/${replicationSummary.total_replicas}`}
                                                    valueStyle={{
                                                        color: replicationSummary.healthy_replicas === replicationSummary.total_replicas ? '#52c41a' :
                                                            replicationSummary.healthy_replicas >= replicationSummary.total_replicas * 0.8 ? '#faad14' : '#ff4d4f',
                                                        fontSize: '24px'
                                                    }}
                                                    prefix={replicationSummary.healthy_replicas === replicationSummary.total_replicas ? <CheckOutlined /> : <CloseOutlined />}
                                                />
                                            </div>
                                        </Card>
                                    </Col>
                                </Row>

                                {/* Maximum Lag Metrics */}
                                <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
                                    <Col xs={24} sm={12} md={8}>
                                        <Card title={
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <span>Max Write Lag</span>
                                                <Tooltip title="Maximum write lag across all replicas. High values indicate potential issues." placement="top">
                                                    <InfoCircleOutlined
                                                        style={{
                                                            color: '#1890ff',
                                                            fontSize: '14px',
                                                            cursor: 'help'
                                                        }}
                                                    />
                                                </Tooltip>
                                            </div>
                                        } size="small" hoverable>
                                            <Statistic
                                                value={replicationSummary.max_write_lag}
                                                precision={3}
                                                suffix="s"
                                                valueStyle={{
                                                    color: replicationSummary.max_write_lag > 0.1 ? '#ff4d4f' :
                                                        replicationSummary.max_write_lag > 0.01 ? '#faad14' : '#52c41a'
                                                }}
                                            />
                                        </Card>
                                    </Col>
                                    <Col xs={24} sm={12} md={8}>
                                        <Card title={
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <span>Max Flush Lag</span>
                                                <Tooltip title="Maximum flush lag across all replicas. Monitor for disk I/O issues." placement="top">
                                                    <InfoCircleOutlined
                                                        style={{
                                                            color: '#1890ff',
                                                            fontSize: '14px',
                                                            cursor: 'help'
                                                        }}
                                                    />
                                                </Tooltip>
                                            </div>
                                        } size="small" hoverable>
                                            <Statistic
                                                value={replicationSummary.max_flush_lag}
                                                precision={3}
                                                suffix="s"
                                                valueStyle={{
                                                    color: replicationSummary.max_flush_lag > 0.1 ? '#ff4d4f' :
                                                        replicationSummary.max_flush_lag > 0.01 ? '#faad14' : '#52c41a'
                                                }}
                                            />
                                        </Card>
                                    </Col>
                                    <Col xs={24} sm={12} md={8}>
                                        <Card title={
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <span>Max Replay Lag</span>
                                                <Tooltip title="Maximum replay lag across all replicas. High values affect read replica consistency." placement="top">
                                                    <InfoCircleOutlined
                                                        style={{
                                                            color: '#1890ff',
                                                            fontSize: '14px',
                                                            cursor: 'help'
                                                        }}
                                                    />
                                                </Tooltip>
                                            </div>
                                        } size="small" hoverable>
                                            <Statistic
                                                value={replicationSummary.max_replay_lag}
                                                precision={3}
                                                suffix="s"
                                                valueStyle={{
                                                    color: replicationSummary.max_replay_lag > 0.1 ? '#ff4d4f' :
                                                        replicationSummary.max_replay_lag > 0.01 ? '#faad14' : '#52c41a'
                                                }}
                                            />
                                        </Card>
                                    </Col>
                                </Row>

                                {/* Replica Breakdown */}
                                {replicationByReplica.length > 0 && (
                                    <Card title="Replication Status by Replica" style={{ marginBottom: '24px' }}>
                                        <Table
                                            dataSource={replicationByReplica.map((replica, index) => ({ ...replica, key: index }))}
                                            columns={[
                                                {
                                                    title: 'Replica Address',
                                                    dataIndex: 'client_addr',
                                                    key: 'client_addr',
                                                render: (text: string) => (
                                                        <span style={{ fontWeight: 500 }}>{text}</span>
                                                )
                                            },
                                            {
                                                title: 'State',
                                                dataIndex: 'state',
                                                key: 'state',
                                                    render: (state: string) => (
                                                        <Tag color={state === 'streaming' ? 'green' : 'orange'}>
                                                            {state.toUpperCase()}
                                                    </Tag>
                                                )
                                            },
                                            {
                                                    title: 'Write Lag',
                                                    dataIndex: 'write_lag',
                                                    key: 'write_lag',
                                                    render: (lag: number) => (
                                                        <span style={{
                                                            color: lag > 0.1 ? '#ff4d4f' : lag > 0.01 ? '#faad14' : '#52c41a'
                                                        }}>
                                                            {lag.toFixed(3)}s
                                                        </span>
                                                    )
                                                },
                                                {
                                                    title: 'Flush Lag',
                                                    dataIndex: 'flush_lag',
                                                    key: 'flush_lag',
                                                    render: (lag: number) => (
                                                        <span style={{
                                                            color: lag > 0.1 ? '#ff4d4f' : lag > 0.01 ? '#faad14' : '#52c41a'
                                                        }}>
                                                            {lag.toFixed(3)}s
                                                        </span>
                                                    )
                                                },
                                                {
                                                    title: 'Replay Lag',
                                                    dataIndex: 'replay_lag',
                                                    key: 'replay_lag',
                                                    render: (lag: number) => (
                                                        <span style={{
                                                            color: lag > 0.1 ? '#ff4d4f' : lag > 0.01 ? '#faad14' : '#52c41a'
                                                        }}>
                                                            {lag.toFixed(3)}s
                                                    </span>
                                                )
                                                },
                                                {
                                                    title: 'Max Lag',
                                                    dataIndex: 'max_lag',
                                                    key: 'max_lag',
                                                    render: (lag: number) => (
                                                        <span style={{
                                                            color: lag > 0.1 ? '#ff4d4f' : lag > 0.01 ? '#faad14' : '#52c41a',
                                                            fontWeight: 'bold'
                                                        }}>
                                                            {lag.toFixed(3)}s
                                                        </span>
                                                    )
                                                },
                                                {
                                                    title: 'Health Status',
                                                    dataIndex: 'status',
                                                    key: 'status',
                                                    render: (status: 'healthy' | 'warning' | 'critical') => (
                                                        <Tag color={
                                                            status === 'healthy' ? 'green' :
                                                                status === 'warning' ? 'orange' : 'red'
                                                        }>
                                                            {status.toUpperCase()}
                                                        </Tag>
                                                    )
                                                }
                                            ]}
                                            pagination={false}
                                        size="small"
                                        scroll={{ x: 'max-content' }}
                                    />
                                </Card>
                                )}

                                {/* Historical Chart */}
                                {replicationHistoricalData.length > 0 && (
                                    <Card
                                        title="Replication Lag History"
                                        style={{ marginTop: '16px' }}
                                    >
                                        <div style={{ height: '300px' }}>
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={replicationHistoricalData}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                                    <XAxis
                                                        dataKey="formattedTime"
                                                        tick={{ fontSize: 12 }}
                                                        angle={-45}
                                                        textAnchor="end"
                                                        height={60}
                                                    />
                                                    <YAxis
                                                        tick={{ fontSize: 12 }}
                                                        domain={[0, 'dataMax']}
                                                        label={{ value: 'Lag (seconds)', angle: -90, position: 'insideLeft' }}
                                                    />
                                                    <RechartsTooltip
                                                        formatter={(value, name) => {
                                                            const nameStr = name as string;
                                                            console.log('Replication tooltip name:', nameStr, 'value:', value); // Debug log
                                                            let lagType = nameStr;
                                                            if (nameStr === 'write_lag') {
                                                                lagType = 'Write Lag';
                                                            } else if (nameStr === 'flush_lag') {
                                                                lagType = 'Flush Lag';
                                                            } else if (nameStr === 'replay_lag') {
                                                                lagType = 'Replay Lag';
                                                            }
                                                            return [`${Number(value).toFixed(3)}s`, lagType];
                                                        }}
                                                        labelFormatter={(label) => `Time: ${label}`}
                                                    />
                                                    <Line
                                                        type="monotone"
                                                        dataKey="write_lag"
                                                        stroke="#1890ff"
                                                        strokeWidth={2}
                                                        name="Write Lag"
                                                    />
                                                    <Line
                                                        type="monotone"
                                                        dataKey="flush_lag"
                                                        stroke="#52c41a"
                                                        strokeWidth={2}
                                                        name="Flush Lag"
                                                    />
                                                    <Line
                                                        type="monotone"
                                                        dataKey="replay_lag"
                                                        stroke="#722ed1"
                                                        strokeWidth={2}
                                                        name="Replay Lag"
                                                    />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </Card>
                                )}
                            </>
                        ) : (
                            <Empty description="No replication data available" />
                        )}
                    </div>

                );
            case 'locks':
                return (
                    <div style={{ padding: '16px' }}>
                        {/* Time Range and Refresh Controls */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '20px',
                            padding: '12px',
                            background: 'linear-gradient(90deg, #f0f2ff 0%, #f9f0ff 100%)',
                            borderRadius: '8px',
                            border: '1px solid #d9d9d9'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ fontWeight: 500, color: '#722ed1' }}>Time Range:</span>
                                <Select
                                    value={lockTimeRange}
                                    onChange={(value) => {
                                        setLockTimeRange(value);
                                        if (nodeName) {
                                            fetchLockMetrics(nodeName, value);
                                        }
                                    }}
                                    size="small"
                                    style={{ width: 80 }}
                                >
                                    <Option value="15m">15m</Option>
                                    <Option value="1h">1h</Option>
                                    <Option value="3h">3h</Option>
                                    <Option value="6h">6h</Option>
                                    <Option value="12h">12h</Option>
                                    <Option value="1d">1d</Option>
                                    <Option value="3d">3d</Option>
                                    <Option value="7d">7d</Option>
                                </Select>
                            </div>
                            <Button
                                type="primary"
                                onClick={() => {
                                    if (nodeName) {
                                        fetchLockMetrics(nodeName, lockTimeRange);
                                    }
                                }}
                                icon={<ReloadOutlined />}
                                loading={isLoadingLockMetrics}
                                disabled={!nodeName}
                                style={{ background: '#722ed1', borderColor: '#722ed1' }}
                            >
                                Refresh
                            </Button>
                        </div>

                        {!nodeName && (
                            <Alert
                                message="Please select a node to view lock metrics"
                                type="info"
                                showIcon
                                style={{ marginBottom: '16px' }}
                            />
                        )}

                        {isLoadingLockMetrics ? (
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
                                <div style={{ textAlign: 'center' }}>
                                    <Spin size="large" />
                                    <div style={{ marginTop: '15px', color: '#722ed1', fontWeight: 'bold' }}>
                                        Loading Lock Metrics...
                                    </div>
                                </div>
                            </div>
                        ) : lockSummary ? (
                            <>
                                {/* Lock Summary Cards */}
                                <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
                                    <Col xs={24} sm={12} md={8} lg={6}>
                                        <Card hoverable style={{ textAlign: 'center', height: '120px' }}>
                                            <div style={{ position: 'relative' }}>
                                                <Tooltip title="Number of transactions waiting for locks. High values indicate lock contention." placement="top">
                                                    <InfoCircleOutlined
                                                        style={{
                                                            position: 'absolute',
                                                            top: '-8px',
                                                            right: '-8px',
                                                            color: '#1890ff',
                                                            fontSize: '14px',
                                                            cursor: 'help'
                                                        }}
                                                    />
                                                </Tooltip>
                                                <Statistic
                                                    title="Waiting Locks"
                                                    value={lockSummary.total_waiting}
                                                    valueStyle={{
                                                        color: lockSummary.total_waiting > 10 ? '#ff4d4f' :
                                                            lockSummary.total_waiting > 0 ? '#faad14' : '#52c41a',
                                                        fontSize: '24px'
                                                    }}
                                                    prefix={lockSummary.total_waiting > 0 ? <CloseOutlined /> : <CheckOutlined />}
                                                />
                                            </div>
                                        </Card>
                                    </Col>
                                    <Col xs={24} sm={12} md={8} lg={6}>
                                        <Card hoverable style={{ textAlign: 'center', height: '120px' }}>
                                            <div style={{ position: 'relative' }}>
                                                <Tooltip title="Average number of locks waiting at any given time." placement="top">
                                                    <InfoCircleOutlined
                                                        style={{
                                                            position: 'absolute',
                                                            top: '-8px',
                                                            right: '-8px',
                                                            color: '#1890ff',
                                                            fontSize: '14px',
                                                            cursor: 'help'
                                                        }}
                                                    />
                                                </Tooltip>
                                                <Statistic
                                                    title="Avg Waiting"
                                                    value={lockSummary.avg_waiting_locks}
                                                    valueStyle={{ color: '#1890ff', fontSize: '24px' }}
                                                    prefix={<ClockCircleOutlined />}
                                                />
                                            </div>
                                        </Card>
                                    </Col>
                                    <Col xs={24} sm={12} md={8} lg={6}>
                                        <Card hoverable style={{ textAlign: 'center', height: '120px' }}>
                                            <div style={{ position: 'relative' }}>
                                                <Tooltip title="Maximum number of locks that were waiting simultaneously." placement="top">
                                                    <InfoCircleOutlined
                                                        style={{
                                                            position: 'absolute',
                                                            top: '-8px',
                                                            right: '-8px',
                                                            color: '#1890ff',
                                                            fontSize: '14px',
                                                            cursor: 'help'
                                                        }}
                                                    />
                                                </Tooltip>
                                                <Statistic
                                                    title="Max Waiting"
                                                    value={lockSummary.max_waiting_locks}
                                                    valueStyle={{
                                                        color: lockSummary.max_waiting_locks > 50 ? '#ff4d4f' :
                                                            lockSummary.max_waiting_locks > 20 ? '#faad14' : '#52c41a',
                                                        fontSize: '24px'
                                                    }}
                                                />
                                            </div>
                                        </Card>
                                    </Col>
                                </Row>

                                {/* Additional Granted Locks Metrics */}
                                {lockSummary.total_granted > 0 && (
                                    <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
                                        <Col xs={24} sm={12} md={8}>
                                            <Card title={
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                    <span>Total Granted</span>
                                                    <Tooltip title="Total number of locks currently granted. These are active locks being held by transactions." placement="top">
                                                        <InfoCircleOutlined
                                                            style={{
                                                                color: '#1890ff',
                                                                fontSize: '14px',
                                                                cursor: 'help'
                                                            }}
                                                        />
                                                    </Tooltip>
                                                </div>
                                            } size="small" hoverable>
                                                <Statistic
                                                    value={lockSummary.total_granted}
                                                    valueStyle={{ color: '#52c41a' }}
                                                    prefix={<CheckOutlined />}
                                                />
                                            </Card>
                                        </Col>
                                        <Col xs={24} sm={12} md={8}>
                                            <Card title={
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                    <span>Avg Granted</span>
                                                    <Tooltip title="Average number of granted locks over the selected time period." placement="top">
                                                        <InfoCircleOutlined
                                                            style={{
                                                                color: '#1890ff',
                                                                fontSize: '14px',
                                                                cursor: 'help'
                                                            }}
                                                        />
                                                    </Tooltip>
                                                </div>
                                            } size="small" hoverable>
                                                <Statistic
                                                    value={lockSummary.avg_granted_locks}
                                                    valueStyle={{ color: '#1890ff' }}
                                                />
                                            </Card>
                                        </Col>
                                        <Col xs={24} sm={12} md={8}>
                                            <Card title={
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                    <span>Max Granted</span>
                                                    <Tooltip title="Maximum number of locks that were granted simultaneously." placement="top">
                                                        <InfoCircleOutlined
                                                            style={{
                                                                color: '#1890ff',
                                                                fontSize: '14px',
                                                                cursor: 'help'
                                                            }}
                                                        />
                                                    </Tooltip>
                                                </div>
                                            } size="small" hoverable>
                                                <Statistic
                                                    value={lockSummary.max_granted_locks}
                                                    valueStyle={{ color: '#722ed1' }}
                                                />
                                            </Card>
                                        </Col>
                                        <Col xs={24} sm={12} md={8}>
                                            <Card title={
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                    <span>Lock Contention</span>
                                                    <Tooltip title="Percentage of locks that are waiting vs total locks. Lower is better." placement="top">
                                                        <InfoCircleOutlined
                                                            style={{
                                                                color: '#1890ff',
                                                                fontSize: '14px',
                                                                cursor: 'help'
                                                            }}
                                                        />
                                                    </Tooltip>
                                                </div>
                                            } size="small" hoverable>
                                                <Statistic
                                                    value={lockSummary.lock_contention_ratio}
                                                    precision={1}
                                                    suffix="%"
                                                    valueStyle={{
                                                        color: lockSummary.lock_contention_ratio > 20 ? '#ff4d4f' :
                                                            lockSummary.lock_contention_ratio > 10 ? '#faad14' : '#52c41a'
                                                    }}
                                                />
                                            </Card>
                                        </Col>
                                    </Row>
                                )}

                                {/* Historical Chart */}
                                {lockHistoricalData.length > 0 && (
                                    <Card
                                        title="Lock Activity History"
                                        style={{ marginTop: '16px' }}
                                    >
                                        <div style={{ height: '300px' }}>
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={lockHistoricalData}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                                    <XAxis
                                                        dataKey="formattedTime"
                                                        tick={{ fontSize: 12 }}
                                                        angle={-45}
                                                        textAnchor="end"
                                                        height={60}
                                                    />
                                                    <YAxis
                                                        tick={{ fontSize: 12 }}
                                                        domain={[0, 'dataMax']}
                                                        label={{ value: 'Lock Count', angle: -90, position: 'insideLeft' }}
                                                    />
                                                    <RechartsTooltip
                                                        formatter={(value, name) => {
                                                            const nameStr = name as string;
                                                            if (nameStr === 'waiting_locks') {
                                                                return [Number(value), 'Waiting Locks'];
                                                            } else if (nameStr === 'granted_locks') {
                                                                return [Number(value), 'Granted Locks'];
                                                            }
                                                            return [Number(value), nameStr];
                                                        }}
                                                        labelFormatter={(label) => `Time: ${label}`}
                                                    />
                                                    <Line
                                                        type="monotone"
                                                        dataKey="waiting_locks"
                                                        stroke="#ff4d4f"
                                                        strokeWidth={2}
                                                        name="Waiting Locks"
                                                    />
                                                    <Line
                                                        type="monotone"
                                                        dataKey="granted_locks"
                                                        stroke="#52c41a"
                                                        strokeWidth={2}
                                                        name="Granted Locks"
                                                    />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </Card>
                                )}
                            </>
                        ) : (
                            <Empty description="No lock metrics data available" />
                        )}
                    </div>
                );
            case 'active-queries':
                return (
                    <div style={{ padding: '16px' }}>
                        {/* Refresh Controls */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '20px',
                            padding: '12px',
                            background: 'linear-gradient(90deg, #f0f2ff 0%, #f9f0ff 100%)',
                            borderRadius: '8px',
                            border: '1px solid #d9d9d9'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ fontWeight: 500, color: '#722ed1' }}>Real-time Active Queries</span>
                                <Tag color="green">Live Data</Tag>
                            </div>
                            <Button
                                type="primary"
                                onClick={() => {
                                    if (nodeName) {
                                        fetchRealTimeActiveQueries(nodeName);
                                    }
                                }}
                                icon={<ReloadOutlined />}
                                loading={isLoadingRealTimeActiveQueries}
                                disabled={!nodeName}
                                style={{ background: '#722ed1', borderColor: '#722ed1' }}
                            >
                                Refresh
                            </Button>
                        </div>

                        {!nodeName && (
                            <Alert
                                message="Please select a node to view active queries"
                                type="info"
                                showIcon
                                style={{ marginBottom: '16px' }}
                            />
                        )}

                        {/* Active Queries Count Card */}
                        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
                            <Col xs={24} sm={12} md={8} lg={6}>
                                <Card hoverable style={{ textAlign: 'center', height: '120px' }}>
                                    <div style={{ position: 'relative' }}>
                                        <Tooltip title="Current number of active queries running on the database" placement="top">
                                            <InfoCircleOutlined
                                                style={{
                                                    position: 'absolute',
                                                    top: '-8px',
                                                    right: '-8px',
                                                    color: '#1890ff',
                                                    fontSize: '14px',
                                                    cursor: 'help'
                                                }}
                                            />
                                        </Tooltip>
                                        <Statistic
                                            title="Active Queries Count"
                                            value={realTimeActiveQueries.length}
                                            valueStyle={{ 
                                                color: realTimeActiveQueries.length > 10 ? '#ff4d4f' : 
                                                       realTimeActiveQueries.length > 5 ? '#faad14' : '#52c41a',
                                                fontSize: '24px' 
                                            }}
                                            prefix={<DatabaseOutlined />}
                                        />
                                    </div>
                                </Card>
                            </Col>
                        </Row>

                        {isLoadingRealTimeActiveQueries ? (
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
                                <div style={{ textAlign: 'center' }}>
                                    <Spin size="large" />
                                    <div style={{ marginTop: '15px', color: '#722ed1', fontWeight: 'bold' }}>
                                        Loading Real-time Active Queries...
                                    </div>
                                </div>
                            </div>
                        ) : realTimeActiveQueries && realTimeActiveQueries.length > 0 ? (
                            <Table
                                dataSource={realTimeActiveQueries.map((query, index) => ({ ...query, key: `active-${index}` }))}
                                expandable={{
                                    expandedRowRender: (record: RealTimeActiveQuery) => (
                                        <div style={{ 
                                            padding: '16px',
                                            backgroundColor: '#f9f9f9',
                                            borderRadius: '6px',
                                            border: '1px solid #e8e8e8',
                                            width: '100%',
                                            maxWidth: '100%',
                                            overflow: 'hidden'
                                        }}>
                                            <div style={{ marginBottom: '12px' }}>
                                                <strong style={{ color: '#722ed1', fontSize: '14px' }}>Complete Query:</strong>
                                            </div>
                                            <pre style={{
                                                backgroundColor: '#ffffff',
                                                padding: '12px',
                                                borderRadius: '4px',
                                                border: '1px solid #d9d9d9',
                                                fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                                                fontSize: '12px',
                                                lineHeight: '1.5',
                                                whiteSpace: 'pre-wrap',
                                                wordWrap: 'break-word',
                                                wordBreak: 'break-word',
                                                overflowWrap: 'anywhere',
                                                maxHeight: '300px',
                                                overflowY: 'auto',
                                                overflowX: 'hidden',
                                                width: '100%',
                                                maxWidth: '100%',
                                                boxSizing: 'border-box',
                                                margin: 0
                                            }}>
                                                {record.query}
                                            </pre>
                                        </div>
                                    ),
                                    expandRowByClick: true,
                                    rowExpandable: (record: RealTimeActiveQuery) => !!(record.query && record.query.length > 50),
                                }}
                                columns={[
                                    {
                                        title: 'Query',
                                        dataIndex: 'query',
                                        key: 'query',
                                        width: 300,
                                        render: (text: string, record: RealTimeActiveQuery) => (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div style={{ 
                                                    maxWidth: '280px', 
                                                    overflow: 'hidden', 
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap'
                                                }}>
                                                    {text}
                                                </div>
                                                {text && text.length > 50 && (
                                                    <Tooltip title="Click row to expand and see full query">
                                                        <EyeOutlined style={{ color: '#722ed1', cursor: 'pointer' }} />
                                                    </Tooltip>
                                                )}
                                            </div>
                                        ),
                                    },
                                    {
                                        title: 'Duration (seconds)',
                                        dataIndex: 'duration_seconds',
                                        key: 'duration_seconds',
                                        render: (duration: number) => (
                                            <Tag color={duration > 60 ? 'red' : duration > 30 ? 'orange' : 'green'}>
                                                {duration.toFixed(2)}s
                                            </Tag>
                                        ),
                                        sorter: (a: RealTimeActiveQuery, b: RealTimeActiveQuery) => a.duration_seconds - b.duration_seconds,
                                    },
                                    {
                                        title: 'Database',
                                        dataIndex: 'database_name',
                                        key: 'database_name',
                                    },
                                    {
                                        title: 'Username',
                                        dataIndex: 'username',
                                        key: 'username',
                                    },
                                    {
                                        title: 'Application',
                                        dataIndex: 'application_name',
                                        key: 'application_name',
                                        width: 200,
                                        render: (text: string) => (
                                            <Tooltip title={text}>
                                                <div style={{ 
                                                    maxWidth: '200px', 
                                                    overflow: 'hidden', 
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap'
                                                }}>
                                                    {text}
                                                </div>
                                            </Tooltip>
                                        ),
                                    },
                                    {
                                        title: 'Client Address',
                                        dataIndex: 'client_addr',
                                        key: 'client_addr',
                                    },
                                    {
                                        title: 'State',
                                        dataIndex: 'state',
                                        key: 'state',
                                        render: (state: string) => (
                                            <Tag color={state === 'active' ? 'green' : state === 'idle' ? 'blue' : 'orange'}>
                                                {state}
                                            </Tag>
                                        ),
                                    },
                                    {
                                        title: 'Wait Event Type',
                                        dataIndex: 'wait_event_type',
                                        key: 'wait_event_type',
                                        render: (text: string | null) => text || '-',
                                    },
                                    {
                                        title: 'Wait Event',
                                        dataIndex: 'wait_event',
                                        key: 'wait_event',
                                        render: (text: string | null) => text || '-',
                                    },
                                ]}
                                pagination={{ pageSize: 10 }}
                                scroll={{ x: 'max-content' }}
                                rowKey="key"
                                className="active-queries-table"
                                style={{ 
                                    width: '100%',
                                    maxWidth: '100%',
                                    overflow: 'hidden'
                                }}
                            />
                        ) : (
                            <Empty description="No active queries found" />
                        )}
                    </div>
                );
            case 'query-history':
                return (
                    <div style={{ padding: '16px' }}>
                        {/* Time Range and Refresh Controls */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '20px',
                            padding: '12px',
                            background: 'linear-gradient(90deg, #f0f2ff 0%, #f9f0ff 100%)',
                            borderRadius: '8px',
                            border: '1px solid #d9d9d9'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ fontWeight: 500, color: '#722ed1' }}>Time Range:</span>
                                <Select
                                    value={queryHistoryTimeRange}
                                    onChange={(value) => {
                                        setQueryHistoryTimeRange(value);
                                        if (nodeName) {
                                            fetchQueryHistory(nodeName, value);
                                        }
                                    }}
                                    size="small"
                                    style={{ width: 80 }}
                                >
                                    <Option value="5m">5m</Option>
                                    <Option value="15m">15m</Option>
                                    <Option value="1h">1h</Option>
                                    <Option value="3h">3h</Option>
                                    <Option value="6h">6h</Option>
                                    <Option value="12h">12h</Option>
                                    <Option value="1d">1d</Option>
                                    <Option value="3d">3d</Option>
                                    <Option value="7d">7d</Option>
                                </Select>
                            </div>
                            <Button
                                type="primary"
                                onClick={() => {
                                    if (nodeName) {
                                        fetchQueryHistory(nodeName, queryHistoryTimeRange);
                                    }
                                }}
                                icon={<ReloadOutlined />}
                                loading={isLoadingQueryHistory}
                                disabled={!nodeName}
                                style={{ background: '#722ed1', borderColor: '#722ed1' }}
                            >
                                Refresh
                            </Button>
                        </div>

                        {!nodeName && (
                            <Alert
                                message="Please select a node to view query history"
                                type="info"
                                showIcon
                                style={{ marginBottom: '16px' }}
                            />
                        )}

                        {isLoadingQueryHistory ? (
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
                                <div style={{ textAlign: 'center' }}>
                                    <Spin size="large" />
                                    <div style={{ marginTop: '15px', color: '#722ed1', fontWeight: 'bold' }}>
                                        Loading Query History...
                                    </div>
                                </div>
                            </div>
                        ) : queryHistoryDetails && queryHistoryDetails.length > 0 ? (
                            <Table
                                dataSource={queryHistoryDetails.map((query, index) => ({ ...query, key: `history-${index}` }))}
                                expandable={{
                                    expandedRowRender: (record: QueryHistoryDetail) => (
                                        <div style={{ 
                                            padding: '16px',
                                            backgroundColor: '#f9f9f9',
                                            borderRadius: '6px',
                                            border: '1px solid #e8e8e8',
                                            width: '100%',
                                            maxWidth: '100%',
                                            overflow: 'hidden'
                                        }}>
                                            <div style={{ marginBottom: '12px' }}>
                                                <strong style={{ color: '#722ed1', fontSize: '14px' }}>Complete Query:</strong>
                                            </div>
                                            <pre style={{
                                                backgroundColor: '#ffffff',
                                                padding: '12px',
                                                borderRadius: '4px',
                                                border: '1px solid #d9d9d9',
                                                fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                                                fontSize: '12px',
                                                lineHeight: '1.5',
                                                whiteSpace: 'pre-wrap',
                                                wordWrap: 'break-word',
                                                wordBreak: 'break-word',
                                                overflowWrap: 'anywhere',
                                                maxHeight: '300px',
                                                overflowY: 'auto',
                                                overflowX: 'hidden',
                                                width: '100%',
                                                maxWidth: '100%',
                                                boxSizing: 'border-box',
                                                margin: 0
                                            }}>
                                                {record.query}
                                            </pre>
                                        </div>
                                    ),
                                    expandRowByClick: true,
                                    rowExpandable: (record: QueryHistoryDetail) => !!(record.query && record.query.length > 50),
                                }}
                                columns={[
                                    {
                                        title: 'Query',
                                        dataIndex: 'query',
                                        key: 'query',
                                        width: 300,
                                        render: (text: string, record: QueryHistoryDetail) => (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div style={{ 
                                                    maxWidth: '280px', 
                                                    overflow: 'hidden', 
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap'
                                                }}>
                                                    {text}
                                                </div>
                                                {text && text.length > 50 && (
                                                    <Tooltip title="Click row to expand and see full query">
                                                        <EyeOutlined style={{ color: '#722ed1', cursor: 'pointer' }} />
                                                    </Tooltip>
                                                )}
                                            </div>
                                        ),
                                    },
                                    {
                                        title: 'Duration (seconds)',
                                        dataIndex: 'duration_seconds',
                                        key: 'duration_seconds',
                                        render: (duration: number) => (
                                            <Tag color={duration > 60 ? 'red' : duration > 30 ? 'orange' : 'green'}>
                                                {duration.toFixed(2)}s
                                            </Tag>
                                        ),
                                        sorter: (a: QueryHistoryDetail, b: QueryHistoryDetail) => a.duration_seconds - b.duration_seconds,
                                    },
                                    {
                                        title: 'Database',
                                        dataIndex: 'database',
                                        key: 'database',
                                    },
                                    {
                                        title: 'Username',
                                        dataIndex: 'username',
                                        key: 'username',
                                    },
                                    {
                                        title: 'Application',
                                        dataIndex: 'application',
                                        key: 'application',
                                        width: 200,
                                        render: (text: string) => (
                                            <Tooltip title={text}>
                                                <div style={{ 
                                                    maxWidth: '200px', 
                                                    overflow: 'hidden', 
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap'
                                                }}>
                                                    {text}
                                                </div>
                                            </Tooltip>
                                        ),
                                    },
                                    {
                                        title: 'PID',
                                        dataIndex: 'pid',
                                        key: 'pid',
                                        render: (pid: number) => (
                                            <Tag color="blue">{pid}</Tag>
                                        ),
                                    },
                                    {
                                        title: 'Query Start',
                                        dataIndex: 'query_start',
                                        key: 'query_start',
                                        render: (timestamp: string) => new Date(timestamp).toLocaleString(),
                                        sorter: (a: QueryHistoryDetail, b: QueryHistoryDetail) => 
                                            new Date(a.query_start).getTime() - new Date(b.query_start).getTime(),
                                    },
                                    {
                                        title: 'Completion Time',
                                        dataIndex: 'completion_time',
                                        key: 'completion_time',
                                        render: (timestamp: string) => new Date(timestamp).toLocaleString(),
                                        sorter: (a: QueryHistoryDetail, b: QueryHistoryDetail) => 
                                            new Date(a.completion_time).getTime() - new Date(b.completion_time).getTime(),
                                    },
                                ]}
                                pagination={{ pageSize: 10 }}
                                scroll={{ x: 'max-content' }}
                                rowKey="key"
                                className="query-history-table"
                                style={{ 
                                    width: '100%',
                                    maxWidth: '100%',
                                    overflow: 'hidden'
                                }}
                            />
                        ) : (
                            <Empty description="No query history found" />
                        )}
                    </div>
                );
            default:
                return (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px', flexDirection: 'column' }}>
                        <InfoCircleOutlined style={{ fontSize: '48px', color: '#1890ff', marginBottom: '16px' }} />
                        <Text type="secondary">Please select a submenu item from the left sidebar</Text>
                    </div>
                );
        }
    };

    const renderIndexesContent = () => {
                const renderUnusedIndexesTable = () => {
            // Get unique schema, table, and index names for filter
            const uniqueSchemas = [...new Set(queryResultsUnusedIndexes.map(item => item.schemaname))].sort();
            const uniqueTables = [...new Set(queryResultsUnusedIndexes.map(item => item.tablename))].sort();
            const uniqueIndexes = [...new Set(queryResultsUnusedIndexes.map(item => item.indexname))].sort();

            return (
                <Table
                    dataSource={queryResultsUnusedIndexes}
                    columns={[
                        {
                            title: 'Schema',
                            dataIndex: 'schemaname',
                            key: 'schemaname',
                            filters: uniqueSchemas.map(schema => ({ text: schema, value: schema })),
                            onFilter: (value, record) => record.schemaname === value,
                            filterSearch: true,
                        },
                        {
                            title: 'Table',
                            dataIndex: 'tablename',
                            key: 'tablename',
                            filters: uniqueTables.map(table => ({ text: table, value: table })),
                            onFilter: (value, record) => record.tablename === value,
                            filterSearch: true,
                        },
                        {
                            title: 'Index',
                            dataIndex: 'indexname',
                            key: 'indexname',
                            filters: uniqueIndexes.map(index => ({ text: index, value: index })),
                            onFilter: (value, record) => record.indexname === value,
                            filterSearch: true,
                        },
                    {
                        title: 'Index Columns',
                        dataIndex: 'idx_columns',
                        key: 'idx_columns',
                    },
                    {
                        title: 'Scan Count',
                        dataIndex: 'id_scan_count',
                        key: 'id_scan_count',
                        render: (text: number) => (
                            <Tag color={text === 0 ? 'red' : 'green'}>
                                {text}
                            </Tag>
                        ),
                    },
                    {
                        title: 'Index Size',
                        dataIndex: 'index_size',
                        key: 'index_size',
                        render: (bytes: number) => formatBytes(bytes),
                    },
                    {
                        title: 'Drop Command',
                        key: 'action',
                        render: (_, record) => (
                            <Button
                                type="link"
                                onClick={() => {
                                    const dropCommand = `DROP INDEX IF EXISTS ${record.schemaname}.${record.indexname};`;
                                    showCommandModal(dropCommand);
                                }}
                                icon={<DeleteOutlined />}
                            >
                                Show Drop Command
                            </Button>
                        ),
                    },
                                                ]}
                        pagination={{ pageSize: 10 }}
                        scroll={{ x: 'max-content' }}
                    />
            );
        };

        const renderIndexBloatTable = () => {
            // Get unique schema, table, and index names for filter
            const uniqueSchemas = [...new Set(queryResultsIndexBloat.map(item => item.schema_name))].sort();
            const uniqueTables = [...new Set(queryResultsIndexBloat.map(item => item.table_name))].sort();
            const uniqueIndexes = [...new Set(queryResultsIndexBloat.map(item => item.index_name))].sort();

            return (
                <Table
                    dataSource={queryResultsIndexBloat}
                    columns={[
                        {
                            title: 'Schema',
                            dataIndex: 'schema_name',
                            key: 'schema_name',
                            filters: uniqueSchemas.map(schema => ({ text: schema, value: schema })),
                            onFilter: (value, record) => record.schema_name === value,
                            filterSearch: true,
                        },
                        {
                            title: 'Table',
                            dataIndex: 'table_name',
                            key: 'table_name',
                            filters: uniqueTables.map(table => ({ text: table, value: table })),
                            onFilter: (value, record) => record.table_name === value,
                            filterSearch: true,
                        },
                        {
                            title: 'Index',
                            dataIndex: 'index_name',
                            key: 'index_name',
                            filters: uniqueIndexes.map(index => ({ text: index, value: index })),
                            onFilter: (value, record) => record.index_name === value,
                            filterSearch: true,
                        },
                    {
                        title: 'Bloat Ratio',
                        dataIndex: 'bloat_ratio',
                        key: 'bloat_ratio',
                        render: (ratio: number) => (
                            <Tag color={ratio >= 50 ? 'red' : ratio >= 25 ? 'orange' : 'green'}>
                                {ratio.toFixed(2)}%
                            </Tag>
                        ),
                    },
                    {
                        title: 'Fragmentation Level',
                        dataIndex: 'fragmentation_level',
                        key: 'fragmentation_level',
                        render: (level: number) => (
                            <Tag color={level === 3 ? 'red' : level === 2 ? 'orange' : 'green'}>
                                {level === 3 ? 'High' : level === 2 ? 'Medium' : 'Low'}
                            </Tag>
                        ),
                    },
                    {
                        title: 'Index Size',
                        dataIndex: 'total_pages',
                        key: 'total_pages',
                        render: (pages: number) => formatBytes(pages * 8192), // PostgreSQL page size is 8KB
                    },
                    {
                        title: 'Bloat Size',
                        dataIndex: 'bloat_pages',
                        key: 'bloat_pages',
                        render: (pages: number) => formatBytes(pages * 8192),
                    },
                    ]}
                    pagination={{ pageSize: 10 }}
                    scroll={{ x: 'max-content' }}
                />
            );
        };

        const renderTableBloatTable = () => {
            // Get unique schema and table names for filter
            const uniqueSchemas = [...new Set(queryResultsTableBloat.map(item => item.schema_name))].sort();
            const uniqueTables = [...new Set(queryResultsTableBloat.map(item => item.table_name))].sort();

            return (
                <Table
                    dataSource={queryResultsTableBloat}
                    columns={[
                        {
                            title: 'Schema',
                            dataIndex: 'schema_name',
                            key: 'schema_name',
                            filters: uniqueSchemas.map(schema => ({ text: schema, value: schema })),
                            onFilter: (value, record) => record.schema_name === value,
                            filterSearch: true,
                        },
                        {
                            title: 'Table',
                            dataIndex: 'table_name',
                            key: 'table_name',
                            filters: uniqueTables.map(table => ({ text: table, value: table })),
                            onFilter: (value, record) => record.table_name === value,
                            filterSearch: true,
                        },
                        {
                            title: 'Rows',
                            dataIndex: 'num_rows',
                            key: 'num_rows',
                            render: (rows: number) => rows.toLocaleString(),
                            sorter: (a, b) => a.num_rows - b.num_rows,
                        },
                        {
                            title: 'Table Size',
                            dataIndex: 'table_size',
                            key: 'table_size',
                            render: (size: number) => formatBytes(size),
                            sorter: (a, b) => a.table_size - b.table_size,
                        },
                        {
                            title: 'Dead Tuples',
                            dataIndex: 'dead_tuples',
                            key: 'dead_tuples',
                            render: (deadTuples: number) => deadTuples.toLocaleString(),
                            sorter: (a, b) => a.dead_tuples - b.dead_tuples,
                        },
                        {
                            title: 'Free Space',
                            dataIndex: 'free_space',
                            key: 'free_space',
                            render: (freeSpace: number) => formatBytes(freeSpace),
                            sorter: (a, b) => a.free_space - b.free_space,
                        },
                        {
                            title: 'Bloat Ratio',
                            dataIndex: 'bloat_ratio',
                            key: 'bloat_ratio',
                            render: (ratio: number) => (
                                <Tag color={ratio >= 50 ? 'red' : ratio >= 25 ? 'orange' : ratio >= 10 ? 'yellow' : 'green'}>
                                    {ratio.toFixed(2)}%
                                </Tag>
                            ),
                            sorter: (a, b) => a.bloat_ratio - b.bloat_ratio,
                        },
                        {
                            title: 'Fragmentation Level',
                            dataIndex: 'fragmentation_level',
                            key: 'fragmentation_level',
                            render: (level: number) => (
                                <Tag color={level === 3 ? 'red' : level === 2 ? 'orange' : level === 1 ? 'yellow' : 'green'}>
                                    {level === 3 ? 'High' : level === 2 ? 'Medium' : level === 1 ? 'Low' : 'Minimal'}
                                </Tag>
                            ),
                            sorter: (a, b) => a.fragmentation_level - b.fragmentation_level,
                        },
                        {
                            title: 'Actions',
                            key: 'actions',
                            render: (_, record) => (
                                <Button
                                    type="primary"
                                    size="small"
                                    onClick={() => showTableBloatRecommendationModal(record)}
                                    icon={<DeleteOutlined />}
                                >
                                    Show Recommendations
                                </Button>
                            ),
                        },
                    ]}
                    pagination={{ pageSize: 10 }}
                    scroll={{ x: 'max-content' }}
                    loading={isLoadingTableBloatResults}
                />
            );
        };

        const renderIndexMetricsTable = () => {
            if (isLoadingIndexMetrics) {
                return (
                    <div style={{ textAlign: 'center', padding: '50px' }}>
                        <Spin size="large" />
                        <p style={{ marginTop: '20px' }}>Loading index metrics...</p>
                    </div>
                );
            }

            if (!indexMetricsSummaries || indexMetricsSummaries.length === 0) {
                return (
                    <Empty 
                        description="No index metrics data available" 
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                );
            }

            return (
                <>
                    <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <span style={{ marginRight: '8px' }}>Time Range:</span>
                            <Select
                                value={indexTimeRange}
                                onChange={setIndexTimeRange}
                                style={{ width: 120 }}
                                options={[
                                    { value: '15m', label: 'Last 15 minutes' },
                                    { value: '1h', label: 'Last 1 hour' },
                                    { value: '6h', label: 'Last 6 hours' },
                                    { value: '12h', label: 'Last 12 hours' },
                                    { value: '24h', label: 'Last 24 hours' },
                                    { value: '7d', label: 'Last 7 days' },
                                ]}
                            />
                        </div>
                        <Button
                            type="primary"
                            onClick={() => {
                                if (nodeName) {
                                    fetchIndexMetrics(nodeName, indexTimeRange);
                                }
                            }}
                            icon={<ReloadOutlined />}
                            loading={isLoadingIndexMetrics}
                        >
                            Refresh
                        </Button>
                    </div>
                    <Table
                        dataSource={indexMetricsSummaries}
                        columns={[
                            {
                                title: 'Schema',
                                dataIndex: 'schema',
                                key: 'schema',
                            },
                            {
                                title: 'Table',
                                dataIndex: 'table',
                                key: 'table',
                            },
                            {
                                title: 'Index',
                                dataIndex: 'index',
                                key: 'index',
                            },
                            {
                                title: 'Scan Count',
                                dataIndex: 'scans',
                                key: 'scans',
                                sorter: (a, b) => a.scans - b.scans,
                                render: (scans: number) => (
                                    <Tag color={scans === 0 ? 'red' : scans < 10 ? 'orange' : 'green'}>
                                        {scans.toLocaleString()}
                                    </Tag>
                                ),
                            },
                            {
                                title: 'Tuples Read',
                                dataIndex: 'tuples_read',
                                key: 'tuples_read',
                                sorter: (a, b) => a.tuples_read - b.tuples_read,
                                render: (tuples: number) => tuples.toLocaleString(),
                            },
                            {
                                title: 'Tuples Fetched',
                                dataIndex: 'tuples_fetched',
                                key: 'tuples_fetched',
                                sorter: (a, b) => a.tuples_fetched - b.tuples_fetched,
                                render: (tuples: number) => tuples.toLocaleString(),
                            },
                            {
                                title: 'Efficiency',
                                key: 'efficiency',
                                render: (_, record) => {
                                    const efficiency = record.tuples_read > 0 
                                        ? (record.tuples_fetched / record.tuples_read * 100).toFixed(2) 
                                        : 'N/A';
                                    
                                    let color = 'green';
                                    if (efficiency !== 'N/A') {
                                        const effValue = parseFloat(efficiency);
                                        if (effValue < 50) color = 'red';
                                        else if (effValue < 80) color = 'orange';
                                    }
                                    
                                    return (
                                        <Tag color={efficiency === 'N/A' ? 'default' : color}>
                                            {efficiency === 'N/A' ? efficiency : `${efficiency}%`}
                                        </Tag>
                                    );
                                },
                            },
                        ]}
                        pagination={{ pageSize: 10 }}
                        scroll={{ x: 'max-content' }}
                    />
                </>
            );
        };

        return (
            <div style={{ padding: '24px' }}>
                <Row gutter={[16, 16]}>
                    <Col span={24}>
                        {selectedSubMenu === 'index-usage' && renderUnusedIndexesTable()}
                        {selectedSubMenu === 'index-bloat' && renderIndexBloatTable()}
                        {selectedSubMenu === 'table-bloat' && renderTableBloatTable()}
                        {selectedSubMenu === 'index-metrics' && renderIndexMetricsTable()}
                    </Col>
                </Row>
            </div>
        );
    };

    // Metrics verilerini otomatik olarak çekecek useEffect
    useEffect(() => {
        // Bu flag component unmount olduğunda API çağrısını önlemek için
        let isMounted = true;

        // Node değiştiğinde ve bir node seçili olduğunda ve 
        // system tab aktif olduğunda metrics verilerini çek
        if (nodeName && activeTab === '4') {

            // Loading state'i başlangıçta aktif et
            setIsLoadingMetrics(true);

            // Önce cache'den kontrol edelim
            try {
                const cachedData = localStorage.getItem('cachedMetrics');
                if (cachedData) {
                    const cache = JSON.parse(cachedData);
                    // Only use cache if it's for the same node and not too old (15 minutes)
                    if (cache.nodeName === nodeName && Date.now() - cache.timestamp < 15 * 60 * 1000) {
                        setSystemMetrics(cache.metrics);
                        message.info('Showing cached metrics data. Refreshing in background...');
                    }
                }
            } catch (e) {
                console.warn('METRICS: Failed to load from cache', e);
            }

            // Sadece bir kez metrics API'ı çağrılacak,
            // Önceden başarısız bir istekten sonra bile ikinci istek yapılıyordu
            // Bu sorunu çözmek için ikinci istek tamamen kaldırıldı
            const fetchInitialData = async () => {
                if (isMounted && activeTab === '4') {
                    try {
                        await fetchSystemMetrics(nodeName);
                        await fetchHistoricalCpuData(nodeName, cpuTimeRange);
                        // İkinci istek artık yapılmıyor - bu bölüm kaldırıldı
                    } catch (error) {
                        console.error('METRICS: Error in first API request:', error);
                        setIsLoadingMetrics(false);
                    }
                }
            };

            // İlk isteği 300ms gecikme ile başlat (bileşenin mount olması için)
            const delayedInitialFetch = setTimeout(() => {
                fetchInitialData();
            }, 300);

            // Cleanup function - component unmount olduğunda veya dependencies değiştiğinde
            return () => {
                isMounted = false;
                clearTimeout(delayedInitialFetch);
            };
        }
    }, [nodeName, activeTab, cpuTimeRange]); // Sadece node veya tab değiştiğinde tetikle

    useEffect(() => {
        if (selectedDatabase && nodeName) {
            // handleDatabaseChange zaten bu işi yapıyor, 
            // burada tekrar çağırmaya gerek yok
            return;
        }
    }, [selectedDatabase]);

    // Cluster veya node değişiminde, previousNodeRef'i güncelleyelim
    useEffect(() => {
        // Cluster değiştiğinde, node referansını sıfırlayalım
        if (clusterName) {
            previousNodeRef.current = '';
        }

        // Node değiştiğinde
        if (nodeName) {
            previousNodeRef.current = nodeName;
        }
    }, [clusterName, nodeName]);


    // Transaction metrics API function
    const fetchTransactionMetrics = async (nodeName: string, range: string = transactionTimeRange) => {
        try {
            setIsLoadingTransactionMetrics(true);
            const agentId = `agent_${nodeName}`;

            const token = localStorage.getItem('token');
            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/metrics/postgresql/database/transactions?agent_id=${agentId}&range=${range}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('API response not ok');
            }

            const data: TransactionMetricsResponse = await response.json();

            if (data.data && Array.isArray(data.data)) {
                setTransactionMetrics(data.data);

                // Group data by field type and database
                const groupedData = data.data.reduce((acc, item) => {
                    if (!acc[item._field]) {
                        acc[item._field] = [];
                    }
                    acc[item._field].push(item);
                    return acc;
                }, {} as Record<string, TransactionMetricsData[]>);

                // Get latest values for summary
                const getLatestValue = (field: string): number => {
                    const fieldData = groupedData[field];
                    if (fieldData && fieldData.length > 0) {
                        const latest = fieldData.sort((a, b) => new Date(b._time).getTime() - new Date(a._time).getTime())[0];
                        return Math.round(latest._value);
                    }
                    return 0;
                };

                // Calculate rates by comparing first and last values over time period
                const calculateRate = (field: string): number => {
                    const fieldData = groupedData[field];
                    if (fieldData && fieldData.length > 1) {
                        const sorted = fieldData.sort((a, b) => new Date(a._time).getTime() - new Date(b._time).getTime());
                        const first = sorted[0];
                        const last = sorted[sorted.length - 1];
                        const timeDiffSeconds = (new Date(last._time).getTime() - new Date(first._time).getTime()) / 1000;
                        const valueDiff = last._value - first._value;

                        // Handle counter resets (when last value is less than first value)
                        if (valueDiff < 0) {
                            console.warn(`Counter reset detected for ${field}: first=${first._value}, last=${last._value}`);
                            return 0; // Return 0 for negative rates (counter reset scenario)
                        }

                        return timeDiffSeconds > 0 ? Math.round((valueDiff / timeDiffSeconds) * 10) / 10 : 0;
                    }
                    return 0;
                };

                const commitRate = calculateRate('xact_commit');
                const rollbackRate = calculateRate('xact_rollback');

                // Define system databases to exclude
                const systemDatabases = ['postgres', 'template0', 'template1'];

                // Process by database data (exclude system databases)
                const databaseMap = new Map<string, TransactionByDatabase>();

                data.data.forEach(item => {
                    // Skip system databases
                    if (systemDatabases.includes(item.database)) {
                        return;
                    }

                    if (!databaseMap.has(item.database)) {
                        databaseMap.set(item.database, {
                            database: item.database,
                            commits: 0,
                            rollbacks: 0,
                            commit_rate: 0,
                            rollback_rate: 0,
                            rollback_ratio: 0,
                            timestamp: item._time
                        });
                    }

                    const dbData = databaseMap.get(item.database)!;
                    if (item._field === 'xact_commit') {
                        dbData.commits = Math.round(item._value);
                    } else if (item._field === 'xact_rollback') {
                        dbData.rollbacks = Math.round(item._value);
                    }
                });

                // Calculate rates and ratios for each database
                databaseMap.forEach((dbData, database) => {
                    const dbCommits = groupedData['xact_commit']?.filter(d => d.database === database) || [];
                    const dbRollbacks = groupedData['xact_rollback']?.filter(d => d.database === database) || [];

                    if (dbCommits.length > 1) {
                        const sorted = dbCommits.sort((a, b) => new Date(a._time).getTime() - new Date(b._time).getTime());
                        const first = sorted[0];
                        const last = sorted[sorted.length - 1];
                        const timeDiffSeconds = (new Date(last._time).getTime() - new Date(first._time).getTime()) / 1000;
                        const valueDiff = last._value - first._value;
                        // Handle counter resets for database-level commit rates
                        dbData.commit_rate = (timeDiffSeconds > 0 && valueDiff >= 0) ? Math.round((valueDiff / timeDiffSeconds) * 10) / 10 : 0;
                    }

                    if (dbRollbacks.length > 1) {
                        const sorted = dbRollbacks.sort((a, b) => new Date(a._time).getTime() - new Date(b._time).getTime());
                        const first = sorted[0];
                        const last = sorted[sorted.length - 1];
                        const timeDiffSeconds = (new Date(last._time).getTime() - new Date(first._time).getTime()) / 1000;
                        const valueDiff = last._value - first._value;
                        // Handle counter resets for database-level rollback rates
                        dbData.rollback_rate = (timeDiffSeconds > 0 && valueDiff >= 0) ? Math.round((valueDiff / timeDiffSeconds) * 10) / 10 : 0;
                    }

                    const totalTx = dbData.commits + dbData.rollbacks;
                    dbData.rollback_ratio = totalTx > 0 ? Math.round((dbData.rollbacks / totalTx) * 1000) / 10 : 0;
                });

                setTransactionsByDatabase(Array.from(databaseMap.values()));

                // Calculate overall totals and rates by summing up all databases
                const databaseArray = Array.from(databaseMap.values());
                const totalCommitsAllDb = databaseArray.reduce((sum, db) => sum + db.commits, 0);
                const totalRollbacksAllDb = databaseArray.reduce((sum, db) => sum + db.rollbacks, 0);
                const totalCommitRateAllDb = databaseArray.reduce((sum, db) => sum + db.commit_rate, 0);
                const totalRollbackRateAllDb = databaseArray.reduce((sum, db) => sum + db.rollback_rate, 0);

                // Create transaction summary with aggregated data from all databases
                const summary: TransactionSummary = {
                    total_commits: totalCommitsAllDb,
                    total_rollbacks: totalRollbacksAllDb,
                    commit_rate: Math.round(totalCommitRateAllDb * 10) / 10,
                    rollback_rate: Math.round(totalRollbackRateAllDb * 10) / 10,
                    rollback_ratio: totalCommitsAllDb > 0 ? Math.round((totalRollbacksAllDb / (totalCommitsAllDb + totalRollbacksAllDb)) * 1000) / 10 : 0,
                    commit_rollback_ratio: totalRollbacksAllDb > 0 ? Math.round((totalCommitsAllDb / totalRollbacksAllDb) * 10) / 10 : totalCommitsAllDb > 0 ? 999 : 0,
                    timestamp: new Date().toISOString()
                };

                setTransactionSummary(summary);

                // Prepare historical chart data - separate by database
                const commitData = groupedData['xact_commit'] || [];
                const rollbackData = groupedData['xact_rollback'] || [];

                // Get all unique databases (exclude system databases)
                const allDatabases = [...new Set([
                    ...commitData.map(item => item.database),
                    ...rollbackData.map(item => item.database)
                ])]
                .filter(db => !systemDatabases.includes(db))
                .sort();

                // Group by timestamp and organize by database
                const timeGrouped = {} as Record<string, TransactionChartData>;

                // Process commits by database
                commitData.forEach(item => {
                    // Skip system databases
                    if (systemDatabases.includes(item.database)) {
                        return;
                    }

                    const timeKey = item._time;
                    if (!timeGrouped[timeKey]) {
                        timeGrouped[timeKey] = {
                            time: new Date(item._time).getTime(),
                            formattedTime: range.includes('d') || range === '7d' || range === '30d' || 
                                         parseInt(range.replace(/\D/g, '')) >= 24 ? 
                                new Date(item._time).toLocaleDateString('tr-TR', {
                                    year: 'numeric',
                                    month: '2-digit',
                                    day: '2-digit'
                                }) :
                                new Date(item._time).toLocaleTimeString('tr-TR', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })
                        };
                        // Initialize all databases
                        allDatabases.forEach(db => {
                            timeGrouped[timeKey][`commits_${db}`] = 0;
                            timeGrouped[timeKey][`rollbacks_${db}`] = 0;
                        });
                    }
                    timeGrouped[timeKey][`commits_${item.database}`] = item._value;
                });

                // Process rollbacks by database
                rollbackData.forEach(item => {
                    // Skip system databases
                    if (systemDatabases.includes(item.database)) {
                        return;
                    }

                    const timeKey = item._time;
                    if (!timeGrouped[timeKey]) {
                        timeGrouped[timeKey] = {
                            time: new Date(item._time).getTime(),
                            formattedTime: new Date(item._time).toLocaleTimeString('tr-TR', {
                                hour: '2-digit',
                                minute: '2-digit'
                            })
                        };
                        // Initialize all databases
                        allDatabases.forEach(db => {
                            timeGrouped[timeKey][`commits_${db}`] = 0;
                            timeGrouped[timeKey][`rollbacks_${db}`] = 0;
                        });
                    }
                    timeGrouped[timeKey][`rollbacks_${item.database}`] = item._value;
                });

                // Convert to chart data format and sort
                const chartData = Object.values(timeGrouped)
                    .sort((a, b) => (a.time as number) - (b.time as number));

                // Remove duplicate timestamps by keeping only the latest value for each minute
                const uniqueChartData = chartData.reduce((acc, item) => {
                    const existing = acc.find(x => x.formattedTime === item.formattedTime);
                    if (!existing) {
                        acc.push(item);
                    } else if ((item.time as number) > (existing.time as number)) {
                        // Replace with newer data for same minute
                        const index = acc.indexOf(existing);
                        acc[index] = item;
                    }
                    return acc;
                }, [] as typeof chartData);

                // Store database list for chart rendering
                (uniqueChartData as any).databases = allDatabases;

                setTransactionHistoricalData(uniqueChartData);

            } else {
                console.error('Invalid transaction metrics response format:', data);
                setTransactionMetrics([]);
                setTransactionSummary(null);
                setTransactionsByDatabase([]);
                setTransactionHistoricalData([] as TransactionChartData[]);
            }
        } catch (error) {
            console.error('Error fetching transaction metrics:', error);
            message.error('Failed to fetch transaction metrics');
            setTransactionMetrics([]);
            setTransactionSummary(null);
            setTransactionsByDatabase([]);
            setTransactionHistoricalData([] as TransactionChartData[]);
        } finally {
            setIsLoadingTransactionMetrics(false);
        }
    };


    // Cache Hit Ratio metrics API functions
    const fetchCacheHitMetrics = async (nodeName: string, range: string = cacheHitTimeRange) => {
        try {
            setIsLoadingCacheHitMetrics(true);
            const agentId = `agent_${nodeName}`;

            const token = localStorage.getItem('token');
            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/metrics/postgresql/database/cache?agent_id=${agentId}&range=${range}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('API response not ok');
            }

            const data: CacheHitMetricsResponse = await response.json();

            if (data.status === 'success' && data.data && data.data.raw_data && Array.isArray(data.data.raw_data)) {
                setCacheHitMetrics(data.data.raw_data);

                // Group data by field type and database
                const groupedData = data.data.raw_data.reduce((acc, item) => {
                    const key = `${item.database}_${item._field}`;
                    if (!acc[key]) {
                        acc[key] = [];
                    }
                    acc[key].push(item);
                    return acc;
                }, {} as Record<string, CacheHitMetricsData[]>);

                // Calculate overall cache hit ratio from latest values
                let totalBlocksHit = 0;
                let totalBlocksRead = 0;
                const databaseMap = new Map<string, CacheHitByDatabase>();

                // Process each database
                const databases = [...new Set(data.data.raw_data.map(item => item.database))];

                databases.forEach(database => {
                    const hitData = groupedData[`${database}_blks_hit`] || [];
                    const readData = groupedData[`${database}_blks_read`] || [];

                    if (hitData.length > 0) {
                        // Get latest values
                        const latestHit = hitData.sort((a: CacheHitMetricsData, b: CacheHitMetricsData) => new Date(b._time).getTime() - new Date(a._time).getTime())[0];
                        const blocksHit = Math.round(latestHit._value);

                        let blocksRead = 0;
                        let cacheHitRatio = 100; // Default to 100% if no read data available

                        if (readData.length > 0) {
                            const latestRead = readData.sort((a: CacheHitMetricsData, b: CacheHitMetricsData) => new Date(b._time).getTime() - new Date(a._time).getTime())[0];
                            blocksRead = Math.round(latestRead._value);
                            const totalBlocks = blocksHit + blocksRead;
                            cacheHitRatio = totalBlocks > 0 ? Math.round((blocksHit / totalBlocks) * 1000) / 10 : 0;
                        }

                        totalBlocksHit += blocksHit;
                        totalBlocksRead += blocksRead;

                        databaseMap.set(database, {
                            database,
                            blocks_hit: blocksHit,
                            blocks_read: blocksRead,
                            cache_hit_ratio: cacheHitRatio,
                            timestamp: latestHit._time
                        });
                    }
                });

                // Calculate overall cache hit ratio
                const totalBlocks = totalBlocksHit + totalBlocksRead;
                const overallCacheHitRatio = totalBlocks > 0 ? Math.round((totalBlocksHit / totalBlocks) * 1000) / 10 : 0;

                const summary: CacheHitSummary = {
                    total_blocks_hit: totalBlocksHit,
                    total_blocks_read: totalBlocksRead,
                    cache_hit_ratio: overallCacheHitRatio,
                    avg_cache_hit_ratio: overallCacheHitRatio,
                    timestamp: new Date().toISOString()
                };

                setCacheHitSummary(summary);
                setCacheHitByDatabase(Array.from(databaseMap.values()));

                // Prepare historical chart data for cache hit ratio over time
                const hitSeries = data.data.raw_data.filter(item => item._field === 'blks_hit');
                const readSeries = data.data.raw_data.filter(item => item._field === 'blks_read');

                const historicalData = hitSeries.map(hitItem => {
                    const readItem = readSeries.find(r => r._time === hitItem._time && r.database === hitItem.database);
                    const blocksHit = hitItem._value;
                    const blocksRead = readItem ? readItem._value : 0;

                    let ratio = 100; // Default to 100% if no read data
                    if (readItem) {
                        const totalBlocks = blocksHit + blocksRead;
                        ratio = totalBlocks > 0 ? Math.round((blocksHit / totalBlocks) * 1000) / 10 : 0;
                    }

                    return {
                        ...hitItem,
                        cache_hit_ratio: ratio,
                        blocks_hit: blocksHit,
                        blocks_read: blocksRead,
                        time: new Date(hitItem._time).getTime(),
                        formattedTime: new Date(hitItem._time).toLocaleTimeString('tr-TR', {
                            hour: '2-digit',
                            minute: '2-digit'
                        })
                    };
                })
                .sort((a, b) => a.time - b.time);

                // Remove duplicate timestamps by keeping only the latest value for each minute
                const uniqueHistoricalData = historicalData.reduce((acc, item) => {
                    const existing = acc.find(x => x.formattedTime === item.formattedTime);
                    if (!existing) {
                        acc.push(item);
                    } else if (item.time > existing.time) {
                        // Replace with newer data for same minute
                        const index = acc.indexOf(existing);
                        acc[index] = item;
                    }
                    return acc;
                }, [] as typeof historicalData);

                setCacheHitHistoricalData(uniqueHistoricalData);

            } else {
                console.error('Invalid cache hit metrics response format:', data);
                setCacheHitMetrics([]);
                setCacheHitSummary(null);
                setCacheHitByDatabase([]);
                setCacheHitHistoricalData([]);
            }
        } catch (error) {
            console.error('Error fetching cache hit metrics:', error);
            message.error('Failed to fetch cache hit metrics');
            setCacheHitMetrics([]);
            setCacheHitSummary(null);
            setCacheHitByDatabase([]);
            setCacheHitHistoricalData([]);
        } finally {
            setIsLoadingCacheHitMetrics(false);
        }
    };

    // Deadlocks metrics API functions
    const fetchDeadlocksMetrics = async (nodeName: string, range: string = deadlocksTimeRange) => {
        try {
            setIsLoadingDeadlocksMetrics(true);
            const agentId = `agent_${nodeName}`;

            const token = localStorage.getItem('token');
            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/metrics/postgresql/database/deadlocks?agent_id=${agentId}&range=${range}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('API response not ok');
            }

            const data: DeadlocksMetricsResponse = await response.json();

            if (data.status === 'success' && data.data && Array.isArray(data.data)) {
                setDeadlocksMetrics(data.data);

                // Group data by database
                const groupedData = data.data.reduce((acc: Record<string, DeadlocksMetricsData[]>, item: DeadlocksMetricsData) => {
                    if (!acc[item.database]) {
                        acc[item.database] = [];
                    }
                    acc[item.database].push(item);
                    return acc;
                }, {});

                // Calculate overall deadlocks from latest values
                let totalDeadlocks = 0;
                const databaseMap = new Map<string, DeadlocksByDatabase>();

                // Process each database
                const databases = [...new Set(data.data.map((item: DeadlocksMetricsData) => item.database))];

                databases.forEach((database: string) => {
                    const deadlocksData = groupedData[database] || [];

                    if (deadlocksData.length > 0) {
                        // Get latest values
                        const latestDeadlocks = deadlocksData.sort((a, b) => new Date(b._time).getTime() - new Date(a._time).getTime())[0];
                        const deadlocks = Math.round(latestDeadlocks._value);

                        // Calculate rate if we have more than one data point
                        let deadlockRate = 0;
                        if (deadlocksData.length > 1) {
                            const sorted = deadlocksData.sort((a, b) => new Date(a._time).getTime() - new Date(b._time).getTime());
                            const first = sorted[0];
                            const last = sorted[sorted.length - 1];
                            const timeDiffSeconds = (new Date(last._time).getTime() - new Date(first._time).getTime()) / 1000;
                            const valueDiff = last._value - first._value;

                            // Handle counter resets (when last value is less than first value)
                            deadlockRate = (timeDiffSeconds > 0 && valueDiff >= 0) ? Math.round((valueDiff / timeDiffSeconds) * 10) / 10 : 0;
                        }

                        totalDeadlocks += deadlocks;

                        databaseMap.set(database, {
                            database,
                            deadlocks: deadlocks,
                            deadlock_rate: deadlockRate,
                            timestamp: latestDeadlocks._time
                        });
                    }
                });

                // Calculate overall deadlock rate
                const overallRate = databaseMap.size > 0 ?
                    Array.from(databaseMap.values()).reduce((sum, db) => sum + db.deadlock_rate, 0) / databaseMap.size : 0;

                const summary: DeadlocksSummary = {
                    total_deadlocks: totalDeadlocks,
                    current_deadlocks: totalDeadlocks,
                    deadlock_rate: Math.round(overallRate * 10) / 10,
                    avg_deadlocks_per_hour: Math.round(overallRate * 3600 * 10) / 10,
                    timestamp: new Date().toISOString()
                };

                setDeadlocksSummary(summary);
                setDeadlocksByDatabase(Array.from(databaseMap.values()));

                // Prepare historical chart data for deadlock trends over time
                const historicalData = data.data.map(item => ({
                    ...item,
                    time: new Date(item._time).getTime(),
                    formattedTime: range.includes('d') || range === '7d' || range === '30d' || 
                                 parseInt(range.replace(/\D/g, '')) >= 24 ? 
                        new Date(item._time).toLocaleDateString('tr-TR', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit'
                        }) :
                        new Date(item._time).toLocaleTimeString('tr-TR', {
                            hour: '2-digit',
                            minute: '2-digit'
                        })
                }))
                .sort((a, b) => a.time - b.time);

                // Remove duplicate timestamps by keeping only the latest value for each minute
                const uniqueHistoricalData = historicalData.reduce((acc, item) => {
                    const existing = acc.find(x => x.formattedTime === item.formattedTime);
                    if (!existing) {
                        acc.push(item);
                    } else if (item.time > existing.time) {
                        // Replace with newer data for same minute
                        const index = acc.indexOf(existing);
                        acc[index] = item;
                    }
                    return acc;
                }, [] as typeof historicalData);

                setDeadlocksHistoricalData(uniqueHistoricalData);

            } else {
                console.error('Invalid deadlocks metrics response format:', data);
                setDeadlocksMetrics([]);
                setDeadlocksSummary(null);
                setDeadlocksByDatabase([]);
                setDeadlocksHistoricalData([]);
            }
        } catch (error) {
            console.error('Error fetching deadlocks metrics:', error);
            message.error('Failed to fetch deadlocks metrics');
            setDeadlocksMetrics([]);
            setDeadlocksSummary(null);
            setDeadlocksByDatabase([]);
            setDeadlocksHistoricalData([]);
        } finally {
            setIsLoadingDeadlocksMetrics(false);
        }
    };

    // Replication metrics API functions
    const fetchReplicationMetrics = async (nodeName: string, range: string = replicationTimeRange) => {
        try {
            setIsLoadingReplicationMetrics(true);
            const agentId = `agent_${nodeName}`;

            const token = localStorage.getItem('token');
            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/metrics/postgresql/database/replication?agent_id=${agentId}&range=${range}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('API response not ok');
            }

            const data: ReplicationMetricsResponse = await response.json();

            if (data.status === 'success' && data.data && Array.isArray(data.data)) {
                setReplicationMetrics(data.data);

                // Group data by client_addr and field type
                const groupedByReplica = data.data.reduce((acc, item) => {
                    if (!acc[item.client_addr]) {
                        acc[item.client_addr] = {};
                    }
                    if (!acc[item.client_addr][item._field]) {
                        acc[item.client_addr][item._field] = [];
                    }
                    acc[item.client_addr][item._field].push(item);
                    return acc;
                }, {} as Record<string, Record<string, ReplicationMetricsData[]>>);

                // Process replication data by replica
                const replicaMap = new Map<string, ReplicationByReplica>();
                let totalWriteLag = 0;
                let totalFlushLag = 0;
                let totalReplayLag = 0;
                let maxWriteLag = 0;
                let maxFlushLag = 0;
                let maxReplayLag = 0;
                let replicaCount = 0;

                Object.keys(groupedByReplica).forEach(clientAddr => {
                    const replicaData = groupedByReplica[clientAddr];

                    // Get latest lag values for this replica
                    const getLatestLagValue = (fieldName: string): number => {
                        const fieldData = replicaData[fieldName] || [];
                        if (fieldData.length > 0) {
                            const latest = fieldData.sort((a, b) => new Date(b._time).getTime() - new Date(a._time).getTime())[0];
                            const value = typeof latest._value === 'number' ? latest._value : parseFloat(latest._value as string) || 0;
                            return Math.round(value * 1000) / 1000; // Round to 3 decimal places for lag times
                        }
                        return 0;
                    };

                    const writeLag = getLatestLagValue('write_lag');
                    const flushLag = getLatestLagValue('flush_lag');
                    const replayLag = getLatestLagValue('replay_lag');
                    const maxLag = Math.max(writeLag, flushLag, replayLag);

                    // Determine health status based on lag times
                    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
                    if (maxLag > 1.0) { // >1 second is critical
                        status = 'critical';
                    } else if (maxLag > 0.1) { // >100ms is warning
                        status = 'warning';
                    }

                    // Get state from latest record
                    const stateData = replicaData['flush_lag'] || replicaData['write_lag'] || replicaData['replay_lag'] || [];
                    const state = stateData.length > 0 ? stateData[0].state : 'unknown';

                    replicaMap.set(clientAddr, {
                        client_addr: clientAddr,
                        state: state,
                        write_lag: writeLag,
                        flush_lag: flushLag,
                        replay_lag: replayLag,
                        max_lag: maxLag,
                        status: status,
                        timestamp: new Date().toISOString()
                    });

                    // Accumulate for overall stats
                    totalWriteLag += writeLag;
                    totalFlushLag += flushLag;
                    totalReplayLag += replayLag;
                    maxWriteLag = Math.max(maxWriteLag, writeLag);
                    maxFlushLag = Math.max(maxFlushLag, flushLag);
                    maxReplayLag = Math.max(maxReplayLag, replayLag);
                    replicaCount++;
                });

                setReplicationByReplica(Array.from(replicaMap.values()));

                // Calculate overall summary
                const healthyReplicas = Array.from(replicaMap.values()).filter(r => r.status === 'healthy').length;

                const summary: ReplicationSummary = {
                    avg_write_lag: replicaCount > 0 ? Math.round((totalWriteLag / replicaCount) * 1000) / 1000 : 0,
                    avg_flush_lag: replicaCount > 0 ? Math.round((totalFlushLag / replicaCount) * 1000) / 1000 : 0,
                    avg_replay_lag: replicaCount > 0 ? Math.round((totalReplayLag / replicaCount) * 1000) / 1000 : 0,
                    max_write_lag: Math.round(maxWriteLag * 1000) / 1000,
                    max_flush_lag: Math.round(maxFlushLag * 1000) / 1000,
                    max_replay_lag: Math.round(maxReplayLag * 1000) / 1000,
                    total_replicas: replicaCount,
                    healthy_replicas: healthyReplicas,
                    timestamp: new Date().toISOString()
                };

                setReplicationSummary(summary);

                // Prepare historical chart data
                const writeLagSeries = data.data.filter(item => item._field === 'write_lag');
                const flushLagSeries = data.data.filter(item => item._field === 'flush_lag');
                const replayLagSeries = data.data.filter(item => item._field === 'replay_lag');

                const historicalData = writeLagSeries.map(item => {
                    const flushLagItem = flushLagSeries.find(r => r._time === item._time && r.client_addr === item.client_addr);
                    const replayLagItem = replayLagSeries.find(r => r._time === item._time && r.client_addr === item.client_addr);

                    const writeLagValue = typeof item._value === 'number' ? item._value : parseFloat(item._value as string) || 0;
                    const flushLagValue = flushLagItem && typeof flushLagItem._value === 'number' ? flushLagItem._value : parseFloat((flushLagItem?._value as string) || '0') || 0;
                    const replayLagValue = replayLagItem && typeof replayLagItem._value === 'number' ? replayLagItem._value : parseFloat((replayLagItem?._value as string) || '0') || 0;

                    return {
                        ...item,
                        write_lag: writeLagValue,
                        flush_lag: flushLagValue,
                        replay_lag: replayLagValue,
                        time: new Date(item._time).getTime(),
                        formattedTime: new Date(item._time).toLocaleTimeString('tr-TR', {
                            hour: '2-digit',
                            minute: '2-digit'
                        })
                    };
                })
                .sort((a, b) => a.time - b.time);

                // Remove duplicate timestamps by keeping only the latest value for each minute
                const uniqueHistoricalData = historicalData.reduce((acc, item) => {
                    const existing = acc.find(x => x.formattedTime === item.formattedTime);
                    if (!existing) {
                        acc.push(item);
                    } else if (item.time > existing.time) {
                        // Replace with newer data for same minute
                        const index = acc.indexOf(existing);
                        acc[index] = item;
                    }
                    return acc;
                }, [] as typeof historicalData);

                setReplicationHistoricalData(uniqueHistoricalData);

            } else {
                console.error('Invalid replication metrics response format:', data);
                setReplicationMetrics([]);
                setReplicationSummary(null);
                setReplicationByReplica([]);
                setReplicationHistoricalData([]);
            }
        } catch (error) {
            console.error('Error fetching replication metrics:', error);
            message.error('Failed to fetch replication metrics');
            setReplicationMetrics([]);
            setReplicationSummary(null);
            setReplicationByReplica([]);
            setReplicationHistoricalData([]);
        } finally {
            setIsLoadingReplicationMetrics(false);
        }
    };

    // Lock metrics API function
    const fetchLockMetrics = async (nodeName: string, range: string = lockTimeRange) => {
        try {
            setIsLoadingLockMetrics(true);
            const agentId = `agent_${nodeName}`;

            const token = localStorage.getItem('token');
            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/metrics/postgresql/database/locks?agent_id=${agentId}&range=${range}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('API response not ok');
            }

            const data: LockMetricsResponse = await response.json();

            if (data.status === 'success' && data.data && Array.isArray(data.data)) {
                setLockMetrics(data.data);

                // Group data by field type for better processing
                const groupedData = data.data.reduce((acc, item) => {
                    if (!acc[item._field]) {
                        acc[item._field] = [];
                    }
                    acc[item._field].push(item);
                    return acc;
                }, {} as Record<string, LockMetricsData[]>);

                // Process waiting locks
                const waitingData = groupedData['waiting'] || [];
                const grantedData = groupedData['granted'] || [];

                let currentWaiting = 0;
                let currentGranted = 0;
                let avgWaiting = 0;
                let avgGranted = 0;
                let maxWaiting = 0;
                let maxGranted = 0;

                if (waitingData.length > 0) {
                    // Get latest waiting locks
                    const sortedWaiting = waitingData.sort((a, b) => new Date(b._time).getTime() - new Date(a._time).getTime());
                    currentWaiting = Math.round(sortedWaiting[0]._value);
                    
                    // Calculate averages and max
                    avgWaiting = Math.round(waitingData.reduce((sum, item) => sum + item._value, 0) / waitingData.length);
                    maxWaiting = Math.round(Math.max(...waitingData.map(item => item._value)));
                }

                if (grantedData.length > 0) {
                    const sortedGranted = grantedData.sort((a, b) => new Date(b._time).getTime() - new Date(a._time).getTime());
                    currentGranted = Math.round(sortedGranted[0]._value);
                    
                    // Calculate averages and max for granted locks too
                    avgGranted = Math.round(grantedData.reduce((sum, item) => sum + item._value, 0) / grantedData.length);
                    maxGranted = Math.round(Math.max(...grantedData.map(item => item._value)));
                }



                const summary: LockSummary = {
                    total_waiting: currentWaiting,
                    total_granted: currentGranted,
                    lock_contention_ratio: currentGranted > 0 ? Math.round((currentWaiting / (currentWaiting + currentGranted)) * 1000) / 10 : 0,
                    avg_waiting_locks: avgWaiting,
                    avg_granted_locks: avgGranted,
                    max_waiting_locks: maxWaiting,
                    max_granted_locks: maxGranted,
                    timestamp: new Date().toISOString()
                };

                setLockSummary(summary);

                // Prepare historical chart data with both waiting and granted locks
                const historicalData = waitingData.map(waitingItem => {
                    const grantedItem = grantedData.find(g => g._time === waitingItem._time);
                    
                    return {
                        ...waitingItem,
                        time: new Date(waitingItem._time).getTime(),
                        formattedTime: range.includes('d') || range === '7d' || range === '30d' || 
                                     parseInt(range.replace(/\D/g, '')) >= 24 ? 
                            new Date(waitingItem._time).toLocaleDateString('tr-TR', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit'
                            }) :
                            new Date(waitingItem._time).toLocaleTimeString('tr-TR', {
                                hour: '2-digit',
                                minute: '2-digit'
                            }),
                        waiting_locks: waitingItem._value,
                        granted_locks: grantedItem ? grantedItem._value : 0
                    };
                })
                .sort((a, b) => a.time - b.time); // Sort by timestamp

                // Remove duplicate timestamps by keeping only the latest value for each minute
                const uniqueData = historicalData.reduce((acc, item) => {
                    const existing = acc.find(x => x.formattedTime === item.formattedTime);
                    if (!existing) {
                        acc.push(item);
                    } else if (item.time > existing.time) {
                        // Replace with newer data for same minute
                        const index = acc.indexOf(existing);
                        acc[index] = item;
                    }
                    return acc;
                }, [] as typeof historicalData);

                setLockHistoricalData(uniqueData);

            } else {
                console.error('Invalid lock metrics response format:', data);
                setLockMetrics([]);
                setLockSummary(null);
                setLockByMode([]);
                setLockHistoricalData([]);
            }
        } catch (error) {
            console.error('Error fetching lock metrics:', error);
            message.error('Failed to fetch lock metrics');
            setLockMetrics([]);
            setLockSummary(null);
            setLockByMode([]);
            setLockHistoricalData([]);
        } finally {
            setIsLoadingLockMetrics(false);
        }
    };
    
    // Index metrics API function
    const fetchIndexMetrics = async (nodeName: string, range: string = indexTimeRange) => {
        try {
            setIsLoadingIndexMetrics(true);
            const agentId = `agent_${nodeName}`;
            
            const token = localStorage.getItem('token');
            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/metrics/postgresql/database/indexes?agent_id=${agentId}&range=${range}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                credentials: 'include',
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data: IndexMetricsResponse = await response.json();

            if (data.status === 'success' && data.data && data.data.length > 0) {
                // Set raw metrics data
                setIndexMetrics(data.data);

                // Process metrics for visualization
                const latestTimestamp = new Date().toISOString();

                // Group metrics by index
                const indexGroups: Record<string, Record<string, number | string>> = {};
                
                data.data.forEach(metric => {
                    const indexKey = `${metric.schema}.${metric.table}.${metric.index}`;
                    
                    if (!indexGroups[indexKey]) {
                        indexGroups[indexKey] = {
                            index: metric.index,
                            schema: metric.schema,
                            table: metric.table,
                            scans: 0,
                            tuples_read: 0,
                            tuples_fetched: 0
                        };
                    }
                    
                    if (metric._field === 'scans' && typeof metric._value === 'number') {
                        indexGroups[indexKey].scans = metric._value;
                    } else if (metric._field === 'tuples_read' && typeof metric._value === 'number') {
                        indexGroups[indexKey].tuples_read = metric._value;
                    } else if (metric._field === 'tuples_fetched' && typeof metric._value === 'number') {
                        indexGroups[indexKey].tuples_fetched = metric._value;
                    }
                });

                // Convert to array format
                const indexSummaries: IndexMetricsSummary[] = Object.values(indexGroups).map(index => ({
                    index: index.index as string,
                    schema: index.schema as string,
                    table: index.table as string,
                    scans: index.scans as number,
                    tuples_read: index.tuples_read as number,
                    tuples_fetched: index.tuples_fetched as number,
                    timestamp: latestTimestamp
                }));

                setIndexMetricsSummaries(indexSummaries);
            }
        } catch (error) {
            console.error('Error fetching index metrics:', error);
            message.error('Failed to fetch index metrics');
            setIndexMetrics([]);
            setIndexMetricsSummaries([]);
        } finally {
            setIsLoadingIndexMetrics(false);
        }
    };


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
                        <PostgresIcon />
                        <Typography.Title level={4} style={{ margin: 0 }}>PostgreSQL Performance Analytics</Typography.Title>
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
                            <Badge count={countdown} offset={[-5, -30]} style={{ backgroundColor: '#722ed1' }} />
                        )}
                    </div>
                </div>

                <Steps current={currentStep}>
                    <Step title="Select Cluster" />
                    <Step title="Select Node" />
                    {(activeTab === '3' || activeTab === '6') && <Step title="Select Database" />}
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
                                background: 'linear-gradient(90deg, #f0f2ff 0%, #f9f0ff 100%)',
                                borderBottom: '1px solid #f0f0f0',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}>
                                <ClusterOutlined style={{ color: '#722ed1' }} />
                                <span style={{ fontWeight: 500, color: '#595959' }}>PostgreSQL Cluster</span>
                            </div>
                            <div style={{ padding: '12px' }}>
                                <Select
                                    showSearch
                                    value={clusterName}
                                    onChange={setClusterName}
                                    style={{ width: '100%' }}
                                    placeholder="Select a PostgreSQL cluster"
                                    filterOption={(input, option) =>
                                        option?.children
                                            ? option.children.toString().toLowerCase().includes(input.toLowerCase())
                                            : false
                                    }
                                    loading={loadingClusterName}
                                    size="large"
                                    suffixIcon={<CaretDownOutlined style={{ color: '#722ed1' }} />}
                                    dropdownStyle={{ boxShadow: '0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 9px 28px 8px rgba(0, 0, 0, 0.05)' }}
                                >
                                    {clusterNames.map((name, index) => (
                                        <Option key={`cluster-${name}-${index}`} value={name} style={{ padding: '8px 12px' }}>
                                            <span style={{ fontWeight: 500 }}>{name}</span>
                                        </Option>
                                    ))}
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
                                background: 'linear-gradient(90deg, #f0f2ff 0%, #f9f0ff 100%)',
                                borderBottom: '1px solid #f0f0f0',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}>
                                <DatabaseOutlined style={{ color: '#722ed1' }} />
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
                                    suffixIcon={<CaretDownOutlined style={{ color: '#722ed1' }} />}
                                    notFoundContent={
                                        clusterName
                                            ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No nodes found" />
                                            : <div style={{ textAlign: 'center', padding: '12px' }}>Please select a cluster first</div>
                                    }
                                    dropdownStyle={{ boxShadow: '0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 9px 28px 8px rgba(0, 0, 0, 0.05)' }}
                                    disabled={!clusterName}
                                >
                                    {nodeInfo.map(node => (
                                        <Option key={node.name} value={node.name} style={{ padding: '8px 12px' }}>
                                            <Space>
                                                {node.status === "OK" ?
                                                    <Badge status="success" text={null} /> :
                                                    <Badge status="warning" text={null} />
                                                }
                                                <span style={{ fontWeight: 500 }}>{node.name}</span>
                                                <Tag color={node.status === "OK" ? "green" : "orange"} style={{ marginLeft: 'auto' }}>
                                                    {node.status || 'Unknown'}
                                                </Tag>
                                                <Tag color="blue">{node.PGVersion || 'Unknown'}</Tag>
                                            </Space>
                                        </Option>
                                    ))}
                                </Select>
                            </div>
                        </div>
                    </Col>



                    {activeTab === '6' && (
                        <Col span={8} style={{ paddingRight: '10px' }}>
                            <div style={{
                                borderRadius: '8px',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                                overflow: 'hidden',
                                border: '1px solid #f0f0f0'
                            }}>
                                <div style={{
                                    padding: '8px 12px',
                                    background: 'linear-gradient(90deg, #f0f2ff 0%, #f9f0ff 100%)',
                                    borderBottom: '1px solid #f0f0f0',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}>
                                    <DatabaseOutlined style={{ color: '#722ed1' }} />
                                    <span style={{ fontWeight: 500, color: '#595959' }}>Database</span>
                                </div>
                                <div style={{ padding: '12px' }}>
                                    <Select
                                        value={selectedDatabase}
                                        onChange={handleDatabaseChange}
                                        style={{ width: '100%' }}
                                        loading={isLoadingDatabases}
                                        showSearch
                                        placeholder="Select a database"
                                        size="large"
                                        suffixIcon={<CaretDownOutlined style={{ color: '#722ed1' }} />}
                                        dropdownStyle={{ boxShadow: '0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 9px 28px 8px rgba(0, 0, 0, 0.05)' }}
                                        disabled={!nodeName}
                                    >
                                        {databaseNames.map((db, index) => (
                                            <Option key={`db-${db}-${index}`} value={db} style={{ padding: '8px 12px' }}>
                                                <Space>
                                                    <DatabaseOutlined style={{ color: '#336791' }} />
                                                    <span style={{ fontWeight: 500 }}>{db}</span>
                                                </Space>
                                            </Option>
                                        ))}
                                    </Select>
                                </div>
                            </div>
                        </Col>
                    )}

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
                                    background: 'linear-gradient(90deg, #f0f2ff 0%, #f9f0ff 100%)',
                                    borderBottom: '1px solid #f0f0f0',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}>
                                    <DatabaseOutlined style={{ color: '#722ed1' }} />
                                    <span style={{ fontWeight: 500, color: '#595959' }}>Database</span>
                                </div>
                                <div style={{ padding: '12px' }}>
                                    <Select
                                        value={selectedDatabase}
                                        onChange={handleDatabaseChange}
                                        style={{ width: '100%' }}
                                        loading={isLoadingDatabases}
                                        showSearch
                                        placeholder="Select a database"
                                        size="large"
                                        suffixIcon={<CaretDownOutlined style={{ color: '#722ed1' }} />}
                                        dropdownStyle={{ boxShadow: '0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 9px 28px 8px rgba(0, 0, 0, 0.05)' }}
                                        disabled={!nodeName}
                                    >
                                        {databaseNames.map((db, index) => (
                                            <Option key={`db-${db}-${index}`} value={db} style={{ padding: '8px 12px' }}>
                                                <Space>
                                                    <DatabaseOutlined style={{ color: '#336791' }} />
                                                    <span style={{ fontWeight: 500 }}>{db}</span>
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
                        // Yeni tab'a geçerken varsayılan alt menüyü ayarla
                        if (key === '1') handleSubMenuClick('connections');
                        else if (key === '2') handleSubMenuClick('top-cpu');
                        else if (key === '3') handleSubMenuClick('index-usage');
                        else if (key === '4') handleSubMenuClick('system');
                        else if (key === '5') handleSubMenuClick('transactions');
                        else if (key === '6') handleSubMenuClick('db-stats');
                        else if (key === '7') handleSubMenuClick('user-access-list');
                        else if (key === '8') handleSubMenuClick('capacity-planning');
                    }}
                    style={{
                        margin: '0',
                        padding: '8px 16px 0'
                    }}
                    tabBarStyle={{
                        marginBottom: 0,
                        color: '#722ed1',
                        fontWeight: '500'
                    }}
                    items={[
                        {
                            key: '1',
                            label: <span style={{ padding: '0 8px' }}><TeamOutlined /> Connections</span>,
                            children: null
                        },
                        {
                            key: '2',
                            label: <span style={{ padding: '0 8px' }}><BarChartOutlined /> Queries</span>,
                            children: null
                        },
                        {
                            key: '3',
                            label: <span style={{ padding: '0 8px' }}><DatabaseOutlined /> Indexes</span>,
                            children: null
                        },
                        {
                            key: '4',
                            label: <span style={{ padding: '0 8px' }}><SettingOutlined /> System</span>,
                            children: null
                        },
                        {
                            key: '5',
                            label: <span style={{ padding: '0 8px' }}><ClockCircleOutlined /> Transactions</span>,
                            children: null
                        },
                        {
                            key: '6',
                            label: <span style={{ padding: '0 8px' }}><DatabaseOutlined /> DB Stats</span>,
                            children: null
                        },
                        {
                            key: '7',
                            label: <span style={{ padding: '0 8px' }}><UserOutlined /> User Access</span>,
                            children: null
                        },
                        {
                            key: '8',
                            label: <span style={{ padding: '0 8px' }}><BarChartOutlined /> Capacity Planning</span>,
                            children: null
                        }
                    ]}
                />

                {activeTab === '1' && (
                    <Card style={{ borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderRadius: 0 }}>
                        <Tabs
                            activeKey={selectedSubMenu}
                            onChange={handleSubMenuClick}
                            tabBarStyle={{ color: '#722ed1' }}
                            items={[

                                {
                                    key: 'connections',
                                    label: 'Connections Summary',
                                    children: renderConnectionsContent()
                                },
                                {
                                    key: 'connections-by-app',
                                    label: 'Connections by Application',
                                    children: renderConnectionsContent()
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
                            tabBarStyle={{ color: '#722ed1' }}
                            items={[
                                {
                                    key: 'top-cpu',
                                    label: 'Top Queries',
                                    children: renderQueriesContent()
                                },
                                {
                                    key: 'blocking',
                                    label: 'Blocking Queries',
                                    children: renderQueriesContent()
                                },
                                {
                                    key: 'long-running',
                                    label: 'Long Running Queries',
                                    children: renderQueriesContent()
                                },

                                {
                                    key: 'cache-hit-metrics',
                                    label: 'Cache Hit Metrics',
                                    children: renderQueriesContent()
                                },
                                {
                                    key: 'deadlocks',
                                    label: 'Deadlocks',
                                    children: renderQueriesContent()
                                },
                                {
                                    key: 'locks',
                                    label: 'Lock Metrics',
                                    children: renderQueriesContent()
                                },
                                {
                                    key: 'replication',
                                    label: 'Replication',
                                    children: renderQueriesContent()
                                },
                                {
                                    key: 'active-queries',
                                    label: 'Active Queries',
                                    children: renderQueriesContent()
                                },
                                {
                                    key: 'query-history',
                                    label: 'Query History',
                                    children: renderQueriesContent()
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
                            tabBarStyle={{ color: '#722ed1' }}
                            items={[
                                {
                                    key: 'index-usage',
                                    label: 'Unused Indexes',
                                    children: renderIndexesContent()
                                },
                                {
                                    key: 'index-bloat',
                                    label: 'Index Bloat Ratio',
                                    children: renderIndexesContent()
                                },
                                {
                                    key: 'table-bloat',
                                    label: 'Table Bloat Ratio',
                                    children: renderIndexesContent()
                                },
                                {
                                    key: 'index-metrics',
                                    label: 'Index Metrics',
                                    children: renderIndexesContent()
                                }
                            ]}
                        />
                    </Card>
                )}

                {activeTab === '4' && (
                    <Card style={{ borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderRadius: 0 }}>
                        <div id="metrics-container" key={`metrics-${Date.now()}`}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                <h2 style={{ color: isLoadingMetrics ? '#722ed1' : 'inherit' }}>
                                    System Metrics {isLoadingMetrics ? '(Loading...)' : ''}
                                </h2>
                                <div>
                                    <Button
                                        type="primary"
                                        onClick={() => {
                                            // Reset state before fetching - ensures visual changes
                                            setSystemMetrics(null);
                                            setIsLoadingMetrics(true);

                                            // Sadece bir istek gönder
                                            if (nodeName) {
                                                fetchSystemMetrics(nodeName)
                                                    .catch(err => {
                                                        console.error('METRICS: Button request error:', err);
                                                        setIsLoadingMetrics(false);
                                                    });
                                                fetchHistoricalCpuData(nodeName, cpuTimeRange);
                                            }
                                        }}
                                        icon={<ReloadOutlined />}
                                        loading={isLoadingMetrics}
                                        disabled={!nodeName || isLoadingMetrics}
                                        style={{ background: '#722ed1', fontWeight: 'bold' }}
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

                            {nodeName && isLoadingMetrics && (
                                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px', border: '1px dashed #d9d9d9', borderRadius: '8px', background: '#fafafa' }}>
                                    <div style={{ textAlign: 'center' }}>
                                        <Spin size="large" />
                                        <div style={{ marginTop: '15px', color: '#722ed1', fontWeight: 'bold' }}>
                                            Loading System Metrics...
                                        </div>
                                        <div style={{ maxWidth: '80%', margin: '10px auto', color: '#666' }}>
                                            This may take up to 60 seconds. If data doesn't appear, please use the refresh button.
                                        </div>
                                    </div>
                                </div>
                            )}

                            {nodeName && !isLoadingMetrics && !systemMetrics && (
                                <Alert
                                    message="No metrics data available"
                                    description="The server didn't return any metrics data. Please try refreshing or check server logs."
                                    type="warning"
                                    showIcon
                                    style={{ marginBottom: '16px' }}
                                />
                            )}

                            {nodeName && !isLoadingMetrics && systemMetrics && (
                                <>
                                    <Row gutter={16}>
                                        <Col span={8}>
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
                                                        percent={Math.min(100, parseFloat(((currentCpuUsage || 0) / (systemMetrics?.cpu_cores || 1)).toFixed(1)))}
                                                        strokeColor={(currentCpuUsage || 0) / (systemMetrics?.cpu_cores || 1) > 70 ? '#ff4d4f' : '#52c41a'}
                                                        format={(percent) => (
                                                            <div>
                                                                <div style={{ fontSize: '24px', color: '#262626' }}>
                                                                    {parseFloat((currentCpuUsage || 0).toFixed(1))}%
                                                                </div>
                                                                <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
                                                                    Current Usage
                                                                </div>
                                                            </div>
                                                        )}
                                                    />
                                                </div>
                                                <div style={{ textAlign: 'center' }}>
                                                    <div style={{ marginBottom: '8px' }}>
                                                        <Text type="secondary">Per Core Usage: </Text>
                                                        <Text strong>{parseFloat(((currentCpuUsage || 0) / (systemMetrics?.cpu_cores || 1)).toFixed(1))}%</Text>
                                                    </div>
                                                </div>
                                            </Card>
                                        </Col>
                                        <Col span={8}>
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
                                                                value={formatBytes((systemMetrics?.total_memory || 0) * 1024 * 1024)}
                                                                valueStyle={{ fontSize: '14px' }}
                                                            />
                                                        </Col>
                                                        <Col>
                                                            <Statistic
                                                                title="Free"
                                                                value={formatBytes((systemMetrics?.free_memory || 0) * 1024 * 1024)}
                                                                valueStyle={{ fontSize: '14px' }}
                                                            />
                                                        </Col>
                                                    </Row>
                                                </div>
                                            </Card>
                                        </Col>
                                        <Col span={8}>
                                            <Card
                                                title="Load Average"
                                                hoverable
                                                style={{ height: '340px' }}
                                            >
                                                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                                                    <Progress
                                                        type="dashboard"
                                                        width={180}
                                                        percent={Math.min(100, ((systemMetrics?.load_average_1m || 0) / (systemMetrics?.cpu_cores || 1) * 100))}
                                                        strokeColor={
                                                            (systemMetrics?.load_average_1m || 0) / (systemMetrics?.cpu_cores || 1) > 1 ? '#ff4d4f' :
                                                                (systemMetrics?.load_average_1m || 0) / (systemMetrics?.cpu_cores || 1) > 0.7 ? '#faad14' : '#52c41a'
                                                        }
                                                        format={() => (
                                                            <div>
                                                                <div style={{ fontSize: '24px', color: '#262626' }}>
                                                                    {parseFloat((systemMetrics?.load_average_1m || 0).toFixed(2))}
                                                                </div>
                                                                <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
                                                                    1 min
                                                                </div>
                                                            </div>
                                                        )}
                                                    />
                                                </div>
                                                <div style={{ textAlign: 'center' }}>
                                                    <Row justify="space-around">
                                                        <Col>
                                                            <Statistic
                                                                title="5 min"
                                                                value={parseFloat((systemMetrics?.load_average_5m || 0).toFixed(2))}
                                                                valueStyle={{ fontSize: '14px' }}
                                                            />
                                                        </Col>
                                                        <Col>
                                                            <Statistic
                                                                title="15 min"
                                                                value={parseFloat((systemMetrics?.load_average_15m || 0).toFixed(2))}
                                                                valueStyle={{ fontSize: '14px' }}
                                                            />
                                                        </Col>
                                                    </Row>
                                                </div>
                                            </Card>
                                        </Col>
                                    </Row>
                                    <Row gutter={16} style={{ marginTop: '16px' }}>
                                        <Col span={24}>
                                            <Card
                                                title="System Information"
                                                hoverable
                                            >
                                                <Row justify="start" gutter={16}>
                                                    <Col>
                                                        <Space direction="vertical" size="small">
                                                            <div>
                                                                <Text type="secondary">Operating System: </Text>
                                                                <Text strong>{systemMetrics?.os_version || 'Unknown'}</Text>
                                                            </div>
                                                            <div>
                                                                <Text type="secondary">Kernel Version: </Text>
                                                                <Text strong>{systemMetrics?.kernel_version || 'Unknown'}</Text>
                                                            </div>
                                                            <div>
                                                                <Text type="secondary">System Uptime: </Text>
                                                                <Text strong>{formatUptime(systemMetrics?.uptime || 0)}</Text>
                                                            </div>
                                                        </Space>
                                                    </Col>
                                                </Row>
                                            </Card>
                                        </Col>
                                    </Row>

                                    <Row gutter={16} style={{ marginTop: '16px' }}>
                                        <Col span={24}>
                                            <Card
                                                title={
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                        <span>CPU Usage History</span>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <span style={{ fontSize: '14px', color: '#595959' }}>Time Range:</span>
                                                                <Select
                                                                    value={cpuTimeRange}
                                                                    onChange={(value) => {
                                                                        setCpuTimeRange(value);
                                                                        if (nodeName) {
                                                                            fetchHistoricalCpuData(nodeName, value);
                                                                        }
                                                                    }}
                                                                    size="small"
                                                                    style={{ width: 80 }}
                                                                >
                                                                    <Option value="1h">1h</Option>
                                                                    <Option value="3h">3h</Option>
                                                                    <Option value="6h">6h</Option>
                                                                    <Option value="12h">12h</Option>
                                                                    <Option value="24h">24h</Option>
                                                                    <Option value="3d">3d</Option>
                                                                    <Option value="7d">7d</Option>
                                                                </Select>
                                                            </div>
                                                            <Button
                                                                type="default"
                                                                size="small"
                                                                onClick={() => {
                                                                    if (nodeName) {
                                                                        fetchHistoricalCpuData(nodeName, cpuTimeRange);
                                                                    }
                                                                }}
                                                                icon={<ReloadOutlined />}
                                                                loading={isLoadingHistoricalCpu}
                                                                disabled={!nodeName || isLoadingHistoricalCpu}
                                                            >
                                                                Refresh
                                                            </Button>
                                                        </div>
                                                    </div>
                                                }
                                                hoverable
                                                style={{ minHeight: '400px' }}
                                            >
                                                {isLoadingHistoricalCpu ? (
                                                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
                                                        <div style={{ textAlign: 'center' }}>
                                                            <Spin size="large" />
                                                            <div style={{ marginTop: '15px', color: '#722ed1', fontWeight: 'bold' }}>
                                                                Loading Historical CPU Data...
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : historicalCpuData.length === 0 ? (
                                                    <div style={{ textAlign: 'center', padding: '60px 0', color: '#8c8c8c' }}>
                                                        <BarChartOutlined style={{ fontSize: '48px', marginBottom: '16px' }} />
                                                        <div>No historical CPU data available</div>
                                                        <div style={{ fontSize: '12px', marginTop: '8px' }}>
                                                            Please select a node and refresh to load data
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div style={{ height: cpuTimeRange === '3d' || cpuTimeRange === '7d' ? '350px' : '300px' }}>
                                                        <ResponsiveContainer width="100%" height="100%">
                                                            <LineChart
                                                                data={historicalCpuData}
                                                                margin={{
                                                                    top: 20,
                                                                    right: 30,
                                                                    left: 20,
                                                                    bottom: cpuTimeRange === '3d' || cpuTimeRange === '7d' ? 60 : 5,
                                                                }}
                                                            >
                                                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                                                <XAxis
                                                                    dataKey="formattedTime"
                                                                    tick={{ fontSize: cpuTimeRange === '3d' || cpuTimeRange === '7d' ? 10 : 12 }}
                                                                    angle={-45}
                                                                    textAnchor="end"
                                                                    height={cpuTimeRange === '3d' || cpuTimeRange === '7d' ? 80 : 60}
                                                                    tickFormatter={(value) => {
                                                                        if (cpuTimeRange === '3d' || cpuTimeRange === '7d') {
                                                                            // For longer time ranges, abbreviate the date format
                                                                            const parts = value.split(' ');
                                                                            if (parts.length >= 2) {
                                                                                // Return date and time in more compact format
                                                                                return parts[0] + '\n' + parts[1];
                                                                            }
                                                                        }
                                                                        return value;
                                                                    }}
                                                                />
                                                                <YAxis
                                                                    tick={{ fontSize: 12 }}
                                                                    domain={[0, 100]}
                                                                    label={{ value: 'CPU Usage (%)', angle: -90, position: 'insideLeft' }}
                                                                />
                                                                <RechartsTooltip
                                                                    formatter={(value, name) => [
                                                                        `${Number(value).toFixed(2)}%`,
                                                                        'CPU Usage'
                                                                    ]}
                                                                    labelFormatter={(label) => `Time: ${label}`}
                                                                    contentStyle={{
                                                                        backgroundColor: '#fff',
                                                                        border: '1px solid #d9d9d9',
                                                                        borderRadius: '6px'
                                                                    }}
                                                                />
                                                                <Line
                                                                    type="monotone"
                                                                    dataKey="_value"
                                                                    stroke="#722ed1"
                                                                    strokeWidth={2}
                                                                    dot={{ fill: '#722ed1', strokeWidth: 2, r: 3 }}
                                                                    activeDot={{ r: 5, stroke: '#722ed1', strokeWidth: 2 }}
                                                                />
                                                            </LineChart>
                                                        </ResponsiveContainer>
                                                    </div>
                                                )}
                                            </Card>
                                        </Col>
                                    </Row>
                                </>
                            )}
                        </div>
                    </Card>
                )}

                {activeTab === '5' && (
                    <Card style={{ borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderRadius: 0 }}>
                        <div style={{ padding: '16px' }}>
                            {/* Time Range and Refresh Controls */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '20px',
                                padding: '12px',
                                background: 'linear-gradient(90deg, #f0f2ff 0%, #f9f0ff 100%)',
                                borderRadius: '8px',
                                border: '1px solid #d9d9d9'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <span style={{ fontWeight: 500, color: '#722ed1' }}>Time Range:</span>
                                    <Select
                                        value={transactionTimeRange}
                                        onChange={(value) => {
                                            setTransactionTimeRange(value);
                                            if (nodeName) {
                                                fetchTransactionMetrics(nodeName, value);
                                            }
                                        }}
                                        size="small"
                                        style={{ width: 80 }}
                                    >
                                        <Option value="15m">15m</Option>
                                        <Option value="1h">1h</Option>
                                        <Option value="3h">3h</Option>
                                        <Option value="6h">6h</Option>
                                        <Option value="12h">12h</Option>
                                        <Option value="1d">1d</Option>
                                        <Option value="3d">3d</Option>
                                        <Option value="7d">7d</Option>
                                    </Select>
                                </div>
                                <Button
                                    type="primary"
                                    onClick={() => {
                                        if (nodeName) {
                                            fetchTransactionMetrics(nodeName, transactionTimeRange);
                                        }
                                    }}
                                    icon={<ReloadOutlined />}
                                    loading={isLoadingTransactionMetrics}
                                    disabled={!nodeName}
                                    style={{ background: '#722ed1', borderColor: '#722ed1' }}
                                >
                                    Refresh
                                </Button>
                            </div>

                            {!nodeName && (
                                <Alert
                                    message="Please select a node to view transaction metrics"
                                    type="info"
                                    showIcon
                                    style={{ marginBottom: '16px' }}
                                />
                            )}

                            {isLoadingTransactionMetrics ? (
                                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
                                    <div style={{ textAlign: 'center' }}>
                                        <Spin size="large" />
                                        <div style={{ marginTop: '15px', color: '#722ed1', fontWeight: 'bold' }}>
                                            Loading Transaction Metrics...
                                        </div>
                                    </div>
                                </div>
                            ) : transactionSummary ? (
                                <>
                                    {/* Counter Reset Warning */}
                                    {(transactionSummary.commit_rate === 0 && transactionSummary.total_commits > 0) && (
                                        <Alert
                                            message="Transaction Rate Information"
                                            description="Rates are showing 0/s because database statistics were recently reset or PostgreSQL was restarted. Total counts are accurate, but rate calculations need time to stabilize."
                                            type="info"
                                            showIcon
                                            style={{ marginBottom: '16px' }}
                                            closable
                                        />
                                    )}

                                    {/* Transaction Summary Cards */}
                                    <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
                                        <Col xs={24} sm={12} md={8} lg={6}>
                                            <Card hoverable style={{ textAlign: 'center', height: '120px' }}>
                                                <div style={{ position: 'relative' }}>
                                                    <Tooltip title="Total number of successfully committed transactions. Higher values indicate good transaction throughput." placement="top">
                                                        <InfoCircleOutlined
                                                            style={{
                                                                position: 'absolute',
                                                                top: '-8px',
                                                                right: '-8px',
                                                                color: '#1890ff',
                                                                fontSize: '14px',
                                                                cursor: 'help'
                                                            }}
                                                        />
                                                    </Tooltip>
                                                    <Statistic
                                                        title="Total Commits"
                                                        value={transactionSummary.total_commits}
                                                        valueStyle={{ color: '#52c41a', fontSize: '28px' }}
                                                        prefix={<CheckOutlined />}
                                                    />
                                                </div>
                                            </Card>
                                        </Col>
                                        <Col xs={24} sm={12} md={8} lg={6}>
                                            <Card hoverable style={{ textAlign: 'center', height: '120px' }}>
                                                <div style={{ position: 'relative' }}>
                                                    <Tooltip title="Total number of rolled back transactions. High values may indicate application errors or conflicts." placement="top">
                                                        <InfoCircleOutlined
                                                            style={{
                                                                position: 'absolute',
                                                                top: '-8px',
                                                                right: '-8px',
                                                                color: '#1890ff',
                                                                fontSize: '14px',
                                                                cursor: 'help'
                                                            }}
                                                        />
                                                    </Tooltip>
                                                    <Statistic
                                                        title="Total Rollbacks"
                                                        value={transactionSummary.total_rollbacks}
                                                        valueStyle={{
                                                            color: (() => {
                                                                const totalTransactions = transactionSummary.total_commits + transactionSummary.total_rollbacks;
                                                                const rollbackPercentage = totalTransactions > 0 ? (transactionSummary.total_rollbacks / totalTransactions) * 100 : 0;

                                                                if (rollbackPercentage < 1) return '#52c41a'; // Green for <1%
                                                                if (rollbackPercentage < 5) return '#faad14'; // Orange for 1-5%
                                                                return '#ff4d4f'; // Red for >5%
                                                            })(),
                                                            fontSize: '28px'
                                                        }}
                                                        prefix={(() => {
                                                            const totalTransactions = transactionSummary.total_commits + transactionSummary.total_rollbacks;
                                                            const rollbackPercentage = totalTransactions > 0 ? (transactionSummary.total_rollbacks / totalTransactions) * 100 : 0;

                                                            if (rollbackPercentage < 1) return <CheckOutlined />; // Checkmark for healthy (<1%)
                                                            return <CloseOutlined />; // X for problematic (>=1%)
                                                        })()}
                                                    />
                                                </div>
                                            </Card>
                                        </Col>
                                        <Col xs={24} sm={12} md={8} lg={6}>
                                            <Card hoverable style={{ textAlign: 'center', height: '120px' }}>
                                                <div style={{ position: 'relative' }}>
                                                    <Tooltip title="Rate of transaction commits per second. Indicates database transaction processing speed." placement="top">
                                                        <InfoCircleOutlined
                                                            style={{
                                                                position: 'absolute',
                                                                top: '-8px',
                                                                right: '-8px',
                                                                color: '#1890ff',
                                                                fontSize: '14px',
                                                                cursor: 'help'
                                                            }}
                                                        />
                                                    </Tooltip>
                                                    <Statistic
                                                        title="Commit Rate"
                                                        value={transactionSummary.commit_rate}
                                                        precision={1}
                                                        valueStyle={{ color: '#1890ff', fontSize: '28px' }}
                                                        suffix="/s"
                                                    />
                                                </div>
                                            </Card>
                                        </Col>
                                        <Col xs={24} sm={12} md={8} lg={6}>
                                            <Card hoverable style={{ textAlign: 'center', height: '120px' }}>
                                                <div style={{ position: 'relative' }}>
                                                    <Tooltip title="Percentage of transactions that were rolled back. Values >5% may indicate issues with application logic or database conflicts." placement="top">
                                                        <InfoCircleOutlined
                                                            style={{
                                                                position: 'absolute',
                                                                top: '-8px',
                                                                right: '-8px',
                                                                color: '#1890ff',
                                                                fontSize: '14px',
                                                                cursor: 'help'
                                                            }}
                                                        />
                                                    </Tooltip>
                                                    <Statistic
                                                        title="Rollback Ratio"
                                                        value={transactionSummary.rollback_ratio}
                                                        precision={1}
                                                        valueStyle={{
                                                            color: transactionSummary.rollback_ratio > 5 ? '#ff4d4f' :
                                                                transactionSummary.rollback_ratio > 2 ? '#faad14' : '#52c41a',
                                                            fontSize: '28px'
                                                        }}
                                                        suffix="%"
                                                    />
                                                </div>
                                            </Card>
                                        </Col>
                                    </Row>

                                    {/* Additional Metrics */}
                                    <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
                                        <Col xs={24} sm={12} md={8}>
                                            <Card title={
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                    <span>Rollback Rate</span>
                                                    <Tooltip title="Rate of transaction rollbacks per second. Should be monitored if consistently high." placement="top">
                                                        <InfoCircleOutlined
                                                            style={{
                                                                color: '#1890ff',
                                                                fontSize: '14px',
                                                                cursor: 'help'
                                                            }}
                                                        />
                                                    </Tooltip>
                                                </div>
                                            } size="small" hoverable>
                                                <Statistic
                                                    value={transactionSummary.rollback_rate}
                                                    precision={1}
                                                    suffix="/s"
                                                    valueStyle={{
                                                        color: transactionSummary.rollback_rate > 1 ? '#ff4d4f' : '#52c41a'
                                                    }}
                                                />
                                            </Card>
                                        </Col>
                                        <Col xs={24} sm={12} md={8}>
                                            <Card title={
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                    <span>Commit:Rollback Ratio</span>
                                                    <Tooltip title="Ratio of commits to rollbacks. Higher values (>20:1) indicate healthy transaction processing." placement="top">
                                                        <InfoCircleOutlined
                                                            style={{
                                                                color: '#1890ff',
                                                                fontSize: '14px',
                                                                cursor: 'help'
                                                            }}
                                                        />
                                                    </Tooltip>
                                                </div>
                                            } size="small" hoverable>
                                                <Statistic
                                                    value={transactionSummary.commit_rollback_ratio === 999 ? '∞' : transactionSummary.commit_rollback_ratio}
                                                    precision={transactionSummary.commit_rollback_ratio === 999 ? 0 : 1}
                                                    valueStyle={{
                                                        color: transactionSummary.commit_rollback_ratio > 20 ? '#52c41a' :
                                                            transactionSummary.commit_rollback_ratio > 10 ? '#faad14' : '#ff4d4f'
                                                    }}
                                                    suffix={transactionSummary.commit_rollback_ratio !== 999 ? ':1' : ''}
                                                />
                                            </Card>
                                        </Col>
                                    </Row>

                                    {/* Database Breakdown */}
                                    {transactionsByDatabase.length > 0 && (
                                        <Card title="Transactions by Database" style={{ marginBottom: '24px' }}>
                                            <Table
                                                dataSource={transactionsByDatabase.map((db, index) => ({ ...db, key: index }))}
                                                columns={[
                                                    {
                                                        title: 'Database',
                                                        dataIndex: 'database',
                                                        key: 'database',
                                                        render: (text: string) => (
                                                            <span style={{ fontWeight: 500 }}>{text}</span>
                                                        )
                                                    },
                                                    {
                                                        title: 'Commits',
                                                        dataIndex: 'commits',
                                                        key: 'commits',
                                                        render: (count: number) => (
                                                            <Tag color="green" style={{ fontSize: '14px', padding: '4px 8px' }}>
                                                                {count}
                                                            </Tag>
                                                        )
                                                    },
                                                    {
                                                        title: 'Rollbacks',
                                                        dataIndex: 'rollbacks',
                                                        key: 'rollbacks',
                                                        render: (count: number) => (
                                                            <Tag color={count > 0 ? "red" : "green"} style={{ fontSize: '14px', padding: '4px 8px' }}>
                                                                {count}
                                                            </Tag>
                                                        )
                                                    },
                                                    {
                                                        title: 'Commit Rate',
                                                        dataIndex: 'commit_rate',
                                                        key: 'commit_rate',
                                                        render: (rate: number) => `${rate}/s`
                                                    },
                                                    {
                                                        title: 'Rollback Rate',
                                                        dataIndex: 'rollback_rate',
                                                        key: 'rollback_rate',
                                                        render: (rate: number) => (
                                                            <span style={{ color: rate > 1 ? '#ff4d4f' : '#52c41a' }}>
                                                                {rate}/s
                                                    </span>
                                                )
                                            },
                                            {
                                                        title: 'Rollback Ratio',
                                                        dataIndex: 'rollback_ratio',
                                                        key: 'rollback_ratio',
                                                        render: (ratio: number) => (
                                                            <span style={{
                                                                color: ratio > 5 ? '#ff4d4f' : ratio > 2 ? '#faad14' : '#52c41a'
                                                            }}>
                                                                {ratio}%
                                                    </span>
                                                )
                                            }
                                        ]}
                                                pagination={false}
                                        size="small"
                                        scroll={{ x: 'max-content' }}
                                    />
                                </Card>
                                    )}

                                                                    {/* Historical Chart */}
                                {transactionHistoricalData.length > 0 && (
                                    <Card
                                        title="Transaction History by Database"
                                        style={{ marginTop: '16px' }}
                                    >
                                        <div style={{ height: '400px' }}>
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={transactionHistoricalData}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                                    <XAxis
                                                        dataKey="formattedTime"
                                                        tick={{ fontSize: 12 }}
                                                        angle={-45}
                                                        textAnchor="end"
                                                        height={60}
                                                    />
                                                    <YAxis tick={{ fontSize: 12 }} />
                                                    <RechartsTooltip
                                                        formatter={(value, name) => {
                                                            const nameStr = name as string;
                                                            const firstUnderscoreIndex = nameStr.indexOf('_');
                                                            if (firstUnderscoreIndex === -1) return [value, nameStr];
                                                            
                                                            const type = nameStr.substring(0, firstUnderscoreIndex);
                                                            const database = nameStr.substring(firstUnderscoreIndex + 1);
                                                            return [value, `${database} (${type === 'commits' ? 'Commits' : 'Rollbacks'})`];
                                                        }}
                                                        labelFormatter={(label) => `Time: ${label}`}
                                                    />
                                                    {/* Generate Lines for each database dynamically */}
                                                    {(() => {
                                                        const databases = (transactionHistoricalData as any).databases || [];
                                                        const colors = ['#52c41a', '#1890ff', '#722ed1', '#fa8c16', '#f5222d', '#13c2c2', '#eb2f96', '#52c41a'];
                                                        
                                                        return databases.flatMap((database: string, index: number) => {
                                                            const commitColor = colors[index % colors.length];
                                                            const rollbackColor = colors[(index + Math.floor(colors.length/2)) % colors.length];
                                                            
                                                            return [
                                                                <Line
                                                                    key={`commits_${database}`}
                                                                    type="monotone"
                                                                    dataKey={`commits_${database}`}
                                                                    stroke={commitColor}
                                                                    strokeWidth={2}
                                                                    name={`commits_${database}`}
                                                                    connectNulls={false}
                                                                    dot={{ r: 2 }}
                                                                    strokeDasharray={undefined}
                                                                />,
                                                                <Line
                                                                    key={`rollbacks_${database}`}
                                                                    type="monotone"
                                                                    dataKey={`rollbacks_${database}`}
                                                                    stroke={rollbackColor}
                                                                    strokeWidth={2}
                                                                    name={`rollbacks_${database}`}
                                                                    connectNulls={false}
                                                                    dot={{ r: 2 }}
                                                                    strokeDasharray="5 5"
                                                                />
                                                            ];
                                                        });
                                                    })()}
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                        <div style={{ marginTop: '16px' }}>
                                            {/* Line type legend */}
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '12px', marginBottom: '12px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <div style={{ width: '12px', height: '2px', backgroundColor: '#52c41a' }}></div>
                                                    <span>Solid lines = Commits</span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <div style={{ width: '12px', height: '2px', background: 'repeating-linear-gradient(to right, #1890ff 0, #1890ff 3px, transparent 3px, transparent 6px)' }}></div>
                                                    <span>Dashed lines = Rollbacks</span>
                                                </div>
                                            </div>
                                            
                                            {/* Database colors legend */}
                                            <div style={{ fontSize: '11px', color: '#666' }}>
                                                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Database Colors:</div>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                                                    {(() => {
                                                        const databases = (transactionHistoricalData as any).databases || [];
                                                        const colors = ['#52c41a', '#1890ff', '#722ed1', '#fa8c16', '#f5222d', '#13c2c2', '#eb2f96', '#52c41a'];
                                                        
                                                        return databases.map((database: string, index: number) => {
                                                            const color = colors[index % colors.length];
                                                            return (
                                                                <div key={database} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                    <div style={{ width: '8px', height: '8px', backgroundColor: color, borderRadius: '50%' }}></div>
                                                                    <span>{database}</span>
                                                                </div>
                                                            );
                                                        });
                                                    })()}
                                                </div>
                                            </div>
                                        </div>
                                    </Card>
                                )}
                            </>
                        ) : (
                                <Empty description="No transaction data available" />
                            )}
                        </div>
                    </Card>
                )}

                {activeTab === '6' && (
                    <Card>
                        <div style={{ marginTop: 10 }}>
                            <div style={{ marginTop: 20 }}>
                                {queryResultsDbStats ? (
                                    queryResultsDbStats.length > 0 ? (
                                        queryResultsDbStats.map((stats, index) => (
                                            <div key={index}>
                                                <Row gutter={16}>
                                                    {renderStatistics(stats)}
                                                </Row>
                                            </div>
                                        ))
                                    ) : (
                                        <p>error: no data.</p>
                                    )
                                ) : (
                                    <p>no user database selected.</p>
                                )}
                            </div>
                        </div>
                    </Card>
                )}

                {activeTab === '7' && (
                    <Card>
                        <div style={{ marginTop: 10 }}>
                            <Table loading={isLoadingUserAccessListResults} dataSource={queryResultsUserAccessList} columns={UserAccessListColumns} scroll={{ x: 'max-content' }}
                                footer={() => (
                                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                        <button onClick={() => exportToCsv("users.csv", queryResultsUserAccessList)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                                            <DownloadOutlined style={{ color: 'black', fontSize: '16px' }} />
                                            <span style={{ marginLeft: '5px', color: 'black' }}>Export CSV</span>
                                        </button>
                                    </div>
                                )}
                                title={() => (
                                    <div style={{ display: 'flex', alignItems: 'left' }}>
                                    </div>
                                )} />
                        </div>
                    </Card>
                )}

                {activeTab === '8' && (
                    <Card>
                        <div style={{ marginTop: 10 }}>
                            {/* Time Range Selector */}
                            <div style={{ marginBottom: 16 }}>
                                <Select
                                    defaultValue="1d"
                                    style={{ width: 120 }}
                                    onChange={(range) => {
                                        if (nodeName) {
                                            fetchDatabaseSizeData(nodeName, range);
                                        }
                                    }}
                                >
                                    <Option value="1h">1 Hour</Option>
                                    <Option value="6h">6 Hours</Option>
                                    <Option value="24h">24 Hours</Option>
                                    <Option value="7d">7 Days</Option>
                                    <Option value="30d">30 Days</Option>
                                </Select>
                            </div>

                            {/* Database Sizes Summary Table */}
                            <Card 
                                title={
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <DatabaseOutlined style={{ color: '#722ed1' }} />
                                        <span>Database Sizes</span>
                                    </div>
                                }
                                style={{ marginBottom: 16 }}
                            >
                                <Table
                                    loading={isLoadingDatabaseSize}
                                    dataSource={databaseSizeData}
                                    rowKey="database"
                                    columns={[
                                        {
                                            title: 'Database',
                                            dataIndex: 'database',
                                            key: 'database',
                                            render: (text) => (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <DatabaseOutlined style={{ color: '#336791' }} />
                                                    <strong>{text}</strong>
                                                </div>
                                            )
                                        },
                                        {
                                            title: 'Size',
                                            dataIndex: 'size_mb',
                                            key: 'size_mb',
                                            sorter: (a, b) => a.size_mb - b.size_mb,
                                            render: (value) => (
                                                <span style={{ fontWeight: 500 }}>
                                                    {formatMB(Number(value))}
                                                </span>
                                            )
                                        },
                                        {
                                            title: 'Last Updated',
                                            dataIndex: 'timestamp',
                                            key: 'timestamp',
                                            render: (timestamp) => new Date(timestamp).toLocaleString()
                                        }
                                    ]}
                                    pagination={{ pageSize: 10 }}
                                    size="small"
                                />
                            </Card>

                            {/* Historical Chart */}
                            {databaseSizeChartData.length > 0 && (
                                <Card
                                    title={
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <BarChartOutlined style={{ color: '#722ed1' }} />
                                            <span>Database Size Trends</span>
                                        </div>
                                    }
                                >
                                    <div style={{ height: '400px' }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={databaseSizeChartData}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                                <XAxis
                                                    dataKey="formattedTime"
                                                    tick={{ fontSize: 12 }}
                                                    angle={-45}
                                                    textAnchor="end"
                                                    height={60}
                                                />
                                                <YAxis 
                                                    tick={{ fontSize: 12 }} 
                                                    label={{ value: 'Size (MB)', angle: -90, position: 'insideLeft' }}
                                                />
                                                <RechartsTooltip
                                                    formatter={(value, name) => {
                                                        const nameStr = name as string;
                                                        const database = nameStr.replace('_size', '');
                                                        return [`${Number(value).toFixed(2)} MB`, database];
                                                    }}
                                                    labelFormatter={(label) => `Time: ${label}`}
                                                />
                                                {/* Generate Lines for each database dynamically */}
                                                {(() => {
                                                    const databaseNames = Array.from(
                                                        new Set(
                                                            databaseSizeChartData.flatMap(point =>
                                                                Object.keys(point).filter(key => key.endsWith('_size'))
                                                            )
                                                        )
                                                    );
                                                    
                                                    const colors = ['#1890ff', '#52c41a', '#722ed1', '#fa8c16', '#f5222d', '#13c2c2', '#eb2f96'];
                                                    
                                                    return databaseNames.map((sizeKey, index) => (
                                                        <Line
                                                            key={sizeKey}
                                                            type="monotone"
                                                            dataKey={sizeKey}
                                                            stroke={colors[index % colors.length]}
                                                            strokeWidth={2}
                                                            dot={{ r: 4 }}
                                                        />
                                                    ));
                                                })()}
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </Card>
                            )}

                            {/* Capacity Predictions Table */}
                            {databaseCapacityPredictions.length > 0 && (
                                <Card
                                    title={
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <ClockCircleOutlined style={{ color: '#722ed1' }} />
                                            <span>Capacity Predictions</span>
                                        </div>
                                    }
                                    style={{ marginTop: 16 }}
                                >
                                    <Table
                                        loading={isLoadingDatabaseSize}
                                        dataSource={(() => {
                                            // Group predictions by database for better UX
                                            const groupedData = new Map();
                                            databaseCapacityPredictions.forEach(prediction => {
                                                if (!groupedData.has(prediction.database)) {
                                                    groupedData.set(prediction.database, {
                                                        database: prediction.database,
                                                        current_size_mb: prediction.current_size_mb,
                                                        growth_rate_mb_per_day: prediction.growth_rate_mb_per_day,
                                                        confidence_level: prediction.confidence_level,
                                                        volatility: prediction.volatility,
                                                        predictions: {}
                                                    });
                                                }
                                                groupedData.get(prediction.database).predictions[prediction.period] = prediction.predicted_size_mb;
                                            });
                                            return Array.from(groupedData.values());
                                        })()}
                                        rowKey="database"
                                        columns={[
                                            {
                                                title: 'Database',
                                                dataIndex: 'database',
                                                key: 'database',
                                                render: (text) => (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <DatabaseOutlined style={{ color: '#336791' }} />
                                                        <strong>{text}</strong>
                                                    </div>
                                                ),
                                                fixed: 'left',
                                                width: 150
                                            },
                                            {
                                                title: 'Current Size',
                                                dataIndex: 'current_size_mb',
                                                key: 'current_size_mb',
                                                render: (value) => (
                                                    <span style={{ fontWeight: 500 }}>
                                                        {formatMB(Number(value))}
                                                    </span>
                                                ),
                                                width: 120
                                            },
                                            {
                                                title: '1 Month',
                                                key: 'prediction_1_month',
                                                render: (_, record) => {
                                                    const predicted = record.predictions['1 Month'] || record.current_size_mb;
                                                    const growth = predicted - record.current_size_mb;
                                                    const color = growth > 0 ? '#fa8c16' : growth < 0 ? '#52c41a' : '#1890ff';
                                                    return (
                                                        <div>
                                                            <div style={{ fontWeight: 500, fontSize: '13px' }}>
                                                                {formatMB(Number(predicted))}
                                                            </div>
                                                            <div style={{ fontSize: '11px', color }}>
                                                                {growth > 0 ? '+' : ''}{formatGrowthMB(Math.abs(Number(growth)))}
                                                            </div>
                                                        </div>
                                                    );
                                                },
                                                width: 100
                                            },
                                            {
                                                title: '3 Months',
                                                key: 'prediction_3_months',
                                                render: (_, record) => {
                                                    const predicted = record.predictions['3 Months'] || record.current_size_mb;
                                                    const growth = predicted - record.current_size_mb;
                                                    const color = growth > 0 ? '#fa8c16' : growth < 0 ? '#52c41a' : '#1890ff';
                                                    return (
                                                        <div>
                                                            <div style={{ fontWeight: 500, fontSize: '13px' }}>
                                                                {formatMB(Number(predicted))}
                                                            </div>
                                                            <div style={{ fontSize: '11px', color }}>
                                                                {growth > 0 ? '+' : ''}{formatGrowthMB(Math.abs(Number(growth)))}
                                                            </div>
                                                        </div>
                                                    );
                                                },
                                                width: 100
                                            },
                                            {
                                                title: '6 Months',
                                                key: 'prediction_6_months',
                                                render: (_, record) => {
                                                    const predicted = record.predictions['6 Months'] || record.current_size_mb;
                                                    const growth = predicted - record.current_size_mb;
                                                    const color = growth > 0 ? '#fa8c16' : growth < 0 ? '#52c41a' : '#1890ff';
                                                    return (
                                                        <div>
                                                            <div style={{ fontWeight: 500, fontSize: '13px' }}>
                                                                {formatMB(Number(predicted))}
                                                            </div>
                                                            <div style={{ fontSize: '11px', color }}>
                                                                {growth > 0 ? '+' : ''}{formatGrowthMB(Math.abs(Number(growth)))}
                                                            </div>
                                                        </div>
                                                    );
                                                },
                                                width: 100
                                            },
                                            {
                                                title: '1 Year',
                                                key: 'prediction_1_year',
                                                render: (_, record) => {
                                                    const predicted = record.predictions['1 Year'] || record.current_size_mb;
                                                    const growth = predicted - record.current_size_mb;
                                                    const color = growth > 0 ? '#fa8c16' : growth < 0 ? '#52c41a' : '#1890ff';
                                                    return (
                                                        <div>
                                                            <div style={{ fontWeight: 500, fontSize: '13px' }}>
                                                                {formatMB(Number(predicted))}
                                                            </div>
                                                            <div style={{ fontSize: '11px', color }}>
                                                                {growth > 0 ? '+' : ''}{formatGrowthMB(Math.abs(Number(growth)))}
                                                            </div>
                                                        </div>
                                                    );
                                                },
                                                width: 100
                                            },
                                            {
                                                title: 'Growth Rate',
                                                dataIndex: 'growth_rate_mb_per_day',
                                                key: 'growth_rate_mb_per_day',
                                                render: (value) => {
                                                    const color = value > 0 ? '#fa8c16' : value < 0 ? '#52c41a' : '#1890ff';
                                                    return (
                                                        <span style={{ color, fontWeight: 500, fontSize: '12px' }}>
                                                            {value > 0 ? '+' : ''}{Number(value).toFixed(2)} MB/day
                                                        </span>
                                                    );
                                                },
                                                width: 110
                                            },
                                            {
                                                title: 'Confidence',
                                                dataIndex: 'confidence_level',
                                                key: 'confidence_level',
                                                render: (level) => {
                                                    const color = level === 'high' ? 'green' : level === 'medium' ? 'orange' : 'red';
                                                    return <Tag color={color} style={{ fontSize: '11px' }}>{level.toUpperCase()}</Tag>;
                                                },
                                                width: 90
                                            },
                                            {
                                                title: 'Volatility',
                                                dataIndex: 'volatility',
                                                key: 'volatility',
                                                render: (level) => {
                                                    const color = level === 'low' ? 'green' : level === 'medium' ? 'orange' : 'red';
                                                    return <Tag color={color} style={{ fontSize: '11px' }}>{level.toUpperCase()}</Tag>;
                                                },
                                                width: 90
                                            }
                                        ]}
                                        pagination={{ pageSize: 10 }}
                                        size="small"
                                        scroll={{ x: 'max-content' }}
                                    />
                                </Card>
                            )}

                            {/* Empty State */}
                            {!isLoadingDatabaseSize && databaseSizeData.length === 0 && (
                                <Empty
                                    description="No database size data available"
                                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                                />
                            )}
                        </div>
                    </Card>
                )}
            </Layout>
                    </div>
                );
};

export default PostgrePA;




