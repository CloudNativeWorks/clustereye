import React, { useEffect, useState, useCallback } from 'react';
import { Card, Table, Tag, message, Spin, Badge, Button, Tooltip, Space, DatePicker, Input, Modal, Tabs, Radio, Alert, Form, Statistic, Collapse } from 'antd';
import { decodeCompressedBase64 } from '../utils/compression';
import type { ColumnsType } from 'antd/es/table';
import type { Key } from 'antd/es/table/interface';
import { AlertOutlined, CheckOutlined, CalendarOutlined, SearchOutlined, DollarOutlined, WarningOutlined, InfoCircleOutlined, RobotOutlined, CopyOutlined, DatabaseOutlined, FileSearchOutlined, LineChartOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
// Import store for AI usage tracking
import { store } from '../redux/store';
import { incrementUsage } from '../redux/aiLimitSlice';
// Import execution plan visualization components
import { ExecutionPlanVisualizer, ExecutionPlanSummary } from '../ExecutionPlanComponents';
// Import the AIAnalysisRenderer component
import AIAnalysisRenderer from '../components/AIAnalysisRenderer';

const { RangePicker } = DatePicker;
const { TabPane } = Tabs;

dayjs.extend(relativeTime);
dayjs.extend(utc);
dayjs.extend(timezone);

interface APIAlarm {
    acknowledged: boolean;
    agent_id: string;
    alarm_id: string;
    created_at: string;
    event_id: string;
    message: string;
    metric_name: string;
    metric_value: string;
    severity: 'critical' | 'warning' | 'info';
    status: string;
    database?: string; // Optional database field
}

interface AlarmFiltersResponse {
    data: {
        filters: {
            agent_id: string[];
            alarm_id: string[];
            database: string[];
            metric_name: string[];
            severity: string[];
            status: string[];
        };
        metadata: {
            available_filters: string[];
            description: Record<string, string>;
            total_categories: number;
        };
    };
    status: string;
}

interface Alarm {
    id: string;
    severity: string;
    host: string;
    type: string;
    message: string;
    timestamp: string;
    status: string;
    acknowledged: boolean;
    database?: string; // Optional database field
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
    calls?: number; // Make calls optional
}

interface MultiQueryDetails {
    queries: {
        sql: string;
        pid?: string;
        user?: string;
        database?: string;
        duration?: string;
        id: number;
    }[];
    selectedQueryIndex: number;
}

interface MongoPlanNode {
    stage: string;
    inputStage?: MongoPlanNode;
    inputStages?: MongoPlanNode[];
    filter?: any;
    indexName?: string;
    executionTimeMillisEstimate?: number;
    keysExamined?: number;
    docsExamined?: number;
    nReturned?: number;
    direction?: string;
    indexBounds?: any;
    keyPattern?: any;
    works?: number;
    advanced?: number;
    needTime?: number;
    needYield?: number;
    isMultiKey?: boolean;
    isSparse?: boolean;
    isPartial?: boolean;
    isUnique?: boolean;
    indexVersion?: number;
}

interface MongoPlanStats {
    totalKeysExamined: number;
    totalDocsExamined: number;
    executionTimeMillis: number;
    nReturned: number;
    namespace?: string;
    indexFilterSet?: boolean;
    parsedQuery?: any;
    winningPlan?: MongoPlanNode;
    rejectedPlans?: MongoPlanNode[];
}

// Add a function to highlight syntax similar to the one in queryAnalyzer.tsx
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


const AlarmDashboard: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [alarms, setAlarms] = useState<Alarm[]>([]);
    const [uniqueTypes, setUniqueTypes] = useState<string[]>([]);
    const [uniqueHosts, setUniqueHosts] = useState<string[]>([]);
    const [uniqueDatabases, setUniqueDatabases] = useState<string[]>([]);
    const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
        dayjs().subtract(24, 'hours'),
        dayjs().endOf('day')
    ]);
    // Add pagination states
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [totalAlarms, setTotalAlarms] = useState(0);
    
    // Add filter states
    const [filters, setFilters] = useState<{
        severity?: string[];
        host?: string[];
        type?: string[];
        database?: string[];
        status?: string[];
        message?: string;
    }>({});
    
    const [modalVisible, setModalVisible] = useState(false);
    const [modalContent, setModalContent] = useState('');
    const [modalTitle, setModalTitle] = useState('');
    
    // States for explain modal
    const [explainModalVisible, setExplainModalVisible] = useState(false);
    const [explainLoading, setExplainLoading] = useState(false);
    const [explainResults, setExplainResults] = useState('');
    const [currentQueryDetails, setCurrentQueryDetails] = useState<{
        query: string;
        database: string;
        agentId: string;
    } | null>(null);
    
    // Visualization states
    const [planVisualization, setPlanVisualization] = useState<PlanNode[]>([]);
    const [queryTimingData, setQueryTimingData] = useState<QueryTiming[]>([]);

    // State for handling multiple queries in one alarm
    const [multiQueryDetails, setMultiQueryDetails] = useState<MultiQueryDetails>({
        queries: [],
        selectedQueryIndex: 0
    });

    // Add state for MongoDB explain modal
    const [mongoExplainModalVisible, setMongoExplainModalVisible] = useState(false);
    const [mongoExplainLoading, setMongoExplainLoading] = useState(false);
    const [mongoExplainResults, setMongoExplainResults] = useState('');
    const [currentMongoQuery, setCurrentMongoQuery] = useState<{
        query: string;
        database: string;
        agentId: string;
    } | null>(null);

    // Background refresh control states
    const [isUserInteracting, setIsUserInteracting] = useState(false);
    const [lastUserActivity, setLastUserActivity] = useState(Date.now());
    const [hasNewAlarms, setHasNewAlarms] = useState(false);
    const [lastAlarmCount, setLastAlarmCount] = useState(0);
    
    // State for loading filter options
    const [loadingFilterOptions, setLoadingFilterOptions] = useState(false);

    // Function to fetch all filter options from all pages
    const fetchFilterOptions = async () => {
        try {
            setLoadingFilterOptions(true);
            const [startDate, endDate] = dateRange;
            
            // Use the new dedicated filters endpoint for better performance
            const params = new URLSearchParams({
                date_from: startDate.format('YYYY-MM-DD'),
                date_to: endDate.format('YYYY-MM-DD'),
                unacknowledged: 'true'
            });
            
            const token = localStorage.getItem('token');
            const response = await axios.get(
                `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/status/alarms/filters?${params.toString()}`,
                { 
                    withCredentials: true,
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    }
                }
            );
            
            if (response.data?.status === 'success' && response.data?.data?.filters) {
                const filters = response.data.data.filters as AlarmFiltersResponse['data']['filters'];
                
                // Update state with filter options
                // Note: agent_id represents hostname, so we remove 'agent_' prefix
                setUniqueHosts(filters.agent_id.map(agentId => agentId.replace('agent_', '')));
                setUniqueTypes(filters.metric_name || []);
                setUniqueDatabases(filters.database || []);
                
                console.log('Filter options loaded successfully:', {
                    hosts: filters.agent_id.length,
                    types: filters.metric_name?.length || 0,
                    databases: filters.database?.length || 0,
                    severities: filters.severity?.length || 0,
                    statuses: filters.status?.length || 0
                });
            } else {
                throw new Error('Invalid response format from filters endpoint');
            }
            
        } catch (error) {
            console.error('Error fetching filter options:', error);
            message.error('Failed to load filter options');
            
            // Fallback: Set empty arrays to prevent UI issues
            setUniqueTypes([]);
            setUniqueHosts([]);
            setUniqueDatabases([]);
        } finally {
            setLoadingFilterOptions(false);
        }
    };

    // Function to extract parameters from query
    // Function to calculate query similarity for plan cache matching
    const isGenericExecutionPlan = (planXml: string, originalQuery: string): boolean => {
        // Check for obvious generic plan indicators
        if (planXml.includes('Table="[(]"') || 
            planXml.includes('Schema="[dbo]" Table="[(]"')) {
            return true;
        }
        
        // Check if plan statement type doesn't match query type
        const queryType = originalQuery.trim().toLowerCase().split(/\s+/)[0];
        if (queryType === 'update' && planXml.includes('StatementType="SELECT"')) {
            return true;
        }
        if (queryType === 'insert' && planXml.includes('StatementType="SELECT"')) {
            return true;
        }
        if (queryType === 'delete' && planXml.includes('StatementType="SELECT"')) {
            return true;
        }
        
        // Check for suspiciously generic cardinality values
        if (planXml.includes('TableCardinality="100"') && 
            planXml.includes('EstimateRows="1"') &&
            planXml.includes('EstimatedTotalSubtreeCost="0.01"')) {
            return true;
        }
        
        // Check if plan contains actual table names from the query
        const tableNames = originalQuery.match(/(?:FROM|JOIN|UPDATE|INTO)\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi);
        if (tableNames && tableNames.length > 0) {
            const hasRelevantTables = tableNames.some(tableName => {
                const cleanTableName = tableName.replace(/^(FROM|JOIN|UPDATE|INTO)\s+/i, '').trim();
                return planXml.includes(`Table="[${cleanTableName}]"`) || 
                       planXml.includes(`Object="${cleanTableName}"`);
            });
            
            // If query has specific table names but plan doesn't reference them, it's likely generic
            if (!hasRelevantTables && !planXml.includes('Table="[(]"')) {
                return true;
            }
        }
        
        return false;
    };

    const calculateQuerySimilarity = (query1: string, query2: string): number => {
        if (!query1 || !query2) return 0;
        
        // Normalize queries for comparison
        const normalize = (q: string) => q
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .replace(/@\w+/g, 'PARAM') // Replace parameters
            .replace(/\d+/g, 'NUM')    // Replace numbers
            .replace(/['"][^'"]*['"]/g, 'STR') // Replace strings
            .trim();
        
        const norm1 = normalize(query1);
        const norm2 = normalize(query2);
        
        // Simple similarity based on common words
        const words1 = new Set(norm1.split(' ').filter(w => w.length > 2));
        const words2 = new Set(norm2.split(' ').filter(w => w.length > 2));
        
        const intersection = new Set([...words1].filter(x => words2.has(x)));
        const union = new Set([...words1, ...words2]);
        
        return union.size > 0 ? Math.round((intersection.size / union.size) * 100) : 0;
    };

    const extractQueryParameters = (query: string) => {
        const paramRegex = /\$\d+/g;
        const matches = query.match(paramRegex);
        if (!matches) return [];
        
        // Remove duplicates and sort by parameter number
        return Array.from(new Set(matches)).sort((a, b) => {
            const numA = parseInt(a.substring(1));
            const numB = parseInt(b.substring(1));
            return numA - numB;
        });
    };

    // Function to replace parameters in query
    const replaceQueryParameters = (query: string, paramValues: Record<string, string>) => {
        let replacedQuery = query;
        
        // Sort parameters by length (longest first) to avoid partial replacements
        const sortedParams = Object.keys(paramValues).sort((a, b) => b.length - a.length);
        
        for (const param of sortedParams) {
            const rawValue = paramValues[param]?.trim();
            if (rawValue === undefined) continue;

            const paramRegex = new RegExp('\\' + param + '\\b', 'g');
            
            // Special handling for different value types
            let formattedValue: string;
            
            if (rawValue === '') {
                // Empty string - replace with ''
                formattedValue = "''";
            } else if (rawValue.toLowerCase() === 'null') {
                // NULL value - replace with NULL (no quotes)
                formattedValue = "NULL";
            } else if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
                // Array parameter - handle special cases
                const arrayValue = rawValue.slice(1, -1);
                
                // Replace ANY ($n) pattern
                replacedQuery = replacedQuery.replace(
                    new RegExp(`ANY\\s*\\(\\s*\\${param}\\s*\\)`, 'g'),
                    `ANY (ARRAY[${arrayValue}])`
                );
                
                // Replace array_position($n, NULL) pattern
                replacedQuery = replacedQuery.replace(
                    new RegExp(`array_position\\(\\s*\\${param}\\s*,\\s*NULL\\)`, 'g'),
                    `array_position(ARRAY[${arrayValue}], NULL)`
                );
                
                // Replace direct parameter if not already replaced
                formattedValue = `ARRAY[${arrayValue}]`;
            } else if (!isNaN(Number(rawValue))) {
                // Numeric value - no quotes needed
                formattedValue = rawValue;
            } else {
                // String value - escape single quotes and add quotes
                const escapedValue = rawValue.replace(/'/g, "''");
                formattedValue = `'${escapedValue}'`;
            }
            
            // Replace the parameter with the formatted value
            replacedQuery = replacedQuery.replace(paramRegex, formattedValue);
        }
        
        return replacedQuery;
    };

    // State for parameter values
    const [paramValues, setParamValues] = useState<Record<string, string>>({});
    const [showParamForm, setShowParamForm] = useState(false);

    // Function to handle parameter form submission
    const handleParamSubmit = () => {
        if (!currentQueryDetails) return;
        
        // Validate all parameters have values
        const parameters = extractQueryParameters(currentQueryDetails.query);
        const missingParams = parameters.filter(param => !paramValues[param] && paramValues[param] !== '');
        
        if (missingParams.length > 0) {
            message.error(`Please provide values for all parameters: ${missingParams.join(', ')}`);
            return;
        }
        
        // Replace parameters with their values
        const replacedQuery = replaceQueryParameters(currentQueryDetails.query, paramValues);
        
        // Update the currentQueryDetails with the replaced query
        setCurrentQueryDetails({
            ...currentQueryDetails,
            query: replacedQuery
        });
        
        // First close all modals, not just the parameter form
        Modal.destroyAll();
        setShowParamForm(false);
        
        // Show a brief loading message
        message.loading('Preparing to explain query...', 1);
        
        // Execute the explain analyze with the processed query after a slight delay
        // to ensure parameter form is closed first
        setTimeout(() => {
            explainDirectQuery(
                replacedQuery,
                currentQueryDetails.database,
                currentQueryDetails.agentId
            );
        }, 300);
    };

    const mapAPIAlarmToAlarm = (apiAlarm: APIAlarm): Alarm => {
        // Helper function to extract database name from MSSQL deadlock XML
        const extractMssqlDeadlockDb = (message: string): string | undefined => {
            const xmlMatch = message.match(/<event name="xml_deadlock_report"[\s\S]*?<\/event>/);
            if (!xmlMatch) return undefined;
            
            const currentDbMatch = xmlMatch[0].match(/currentdbname="([^"]+)"/);
            return currentDbMatch ? currentDbMatch[1] : undefined;
        };
        
        // Helper function to extract database name from MSSQL blocking message
        const extractMssqlBlockingDb = (message: string): string | undefined => {
            const dbMatch = message.match(/DB=([^,]+)/);
            return dbMatch ? dbMatch[1] : undefined;
        };
        
        // Determine database value based on alarm type
        let database = apiAlarm.database;
        
        if (!database) {
            if (apiAlarm.metric_name.includes('mongodb_slow_queries')) {
                database = extractMongoDbName(apiAlarm.message);
            } else if (apiAlarm.metric_name.includes('mssql_blocking_queries')) {
                database = extractMssqlBlockingDb(apiAlarm.message);
            } else if (apiAlarm.metric_name.includes('mssql_deadlocks')) {
                database = extractMssqlDeadlockDb(apiAlarm.message);
            } else if (apiAlarm.metric_name.includes('mssql_slow_queries')) {
                database = extractMssqlSlowQueryDb(apiAlarm.message);
            }
        }
        
        return {
            id: apiAlarm.event_id,
            severity: apiAlarm.severity,
            host: apiAlarm.agent_id.replace('agent_', ''),
            type: apiAlarm.metric_name,
            message: apiAlarm.message,
            timestamp: apiAlarm.created_at.replace('Z', '+03:00'),  // Replace UTC marker with Turkish timezone
            status: apiAlarm.status,
            acknowledged: apiAlarm.acknowledged,
            database
        };
    };

    // MongoDB mesajından veritabanı adını çıkaran yardımcı fonksiyon
    const extractMongoDbName = (message: string): string | undefined => {
        // DB=database_name formatındaki metni bul
        const dbMatch = message.match(/DB=([^,]+)/);
        if (dbMatch && dbMatch[1]) {
            return dbMatch[1].trim();
        }
        return undefined;
    };
    
    // MSSQL blocking mesajından veritabanı adını çıkaran yardımcı fonksiyon
    const extractMssqlDbName = (message: string): string | undefined => {
        // DB=database_name formatındaki metni bul (Blocked session'dan)
        const dbMatch = message.match(/Blocked: SessionID=\d+, Login=[^,]+, DB=([^,]+)/);
        if (dbMatch && dbMatch[1]) {
            return dbMatch[1].trim();
        }
        return undefined;
    };

    // MSSQL slow query mesajından veritabanı adını çıkaran yardımcı fonksiyon
    const extractMssqlSlowQueryDb = (message: string): string | undefined => {
        // Look for database name in the message (e.g. DynamicsAx)
        // First try to find it in a format like "Database=DynamicsAx"
        const dbMatch = message.match(/Database=([^,\s]+)/i);
        if (dbMatch && dbMatch[1]) {
            return dbMatch[1].trim();
        }
        
        // If not found, try to extract from the query text if it has USE [DatabaseName]
        const useDbMatch = message.match(/USE\s+\[([^\]]+)\]/i);
        if (useDbMatch && useDbMatch[1]) {
            return useDbMatch[1].trim();
        }
        
        return undefined;
    };

    const fetchAlarms = async (skipDatabase = false, page = 1, isBackgroundRefresh = false) => {
        try {
            if (!isBackgroundRefresh) {
                setLoading(true);
            }
            const [startDate, endDate] = dateRange;
            

            const params = new URLSearchParams({
                date_from: startDate.format('YYYY-MM-DD'),
                date_to: endDate.format('YYYY-MM-DD'),
                page: page.toString(),
                limit: pageSize.toString(),
                unacknowledged: 'true'
            });

            // Add filter parameters
            if (filters.severity && filters.severity.length > 0) {
                params.append('severity', filters.severity.join(','));
            }
            if (filters.host && filters.host.length > 0) {
                params.append('host', filters.host.join(','));
            }
            if (filters.type && filters.type.length > 0) {
                params.append('metric', filters.type.join(','));
            }
            if (filters.database && filters.database.length > 0) {
                params.append('database', filters.database.join(','));
            }
            if (filters.status && filters.status.length > 0) {
                params.append('status', filters.status.join(','));
            }
            if (filters.message && filters.message.trim()) {
                params.append('message', filters.message.trim());
            }

            // Add parameter to skip database field if there was an error
            if (skipDatabase) {
                params.append('skip_database', 'true');
            }

            
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

            if (response.data?.data?.alarms && Array.isArray(response.data.data.alarms)) {
                const apiAlarms = response.data.data.alarms as APIAlarm[];
                const mappedAlarms = apiAlarms.map(mapAPIAlarmToAlarm);
                
                
                
                // Handle background refresh differently
                if (isBackgroundRefresh && page === 1) {
                    const newTotalCount = response.data?.data?.pagination?.total_count || mappedAlarms.length;
                    
                    // Check if there are new alarms
                    if (newTotalCount > lastAlarmCount && lastAlarmCount > 0) {
                        setHasNewAlarms(true);
                        message.info({
                            content: `${newTotalCount - lastAlarmCount} new alarm(s) detected. Click to refresh.`,
                            duration: 10,
                            onClick: () => {
                                setHasNewAlarms(false);
                                setAlarms(mappedAlarms);
                                setTotalAlarms(newTotalCount);
                                setLastAlarmCount(newTotalCount);
                            }
                        });
                    }
                    setLastAlarmCount(newTotalCount);
                } else {
                    // Normal refresh - update immediately
                    setAlarms(mappedAlarms);
                    setHasNewAlarms(false);
                    
                    // Set total count for pagination (if provided by API)
                    const totalCount = response.data?.data?.pagination?.total_count || 
                                     response.data?.data?.total || 
                                     mappedAlarms.length;
                    setTotalAlarms(totalCount);
                    setLastAlarmCount(totalCount);
                }
                
                // Note: Filter options are now loaded separately via fetchFilterOptions()
                // This improves performance by avoiding redundant filter extraction on every alarm fetch
            } else {
                console.error('Invalid alarms data format:', response.data);
                setAlarms([]);
                setTotalAlarms(0);
                message.error('Failed to fetch alarms: Invalid data format');
            }
        } catch (error: any) {
            console.error('Error fetching alarms:', error);
            
            // Check if it's the NULL database error and try again without database
            if (!skipDatabase && 
                error.response?.data?.error?.includes('converting NULL to string is unsupported') && 
                error.response?.data?.error?.includes('database')) {
                return fetchAlarms(true, page, isBackgroundRefresh);
            }
            
            setAlarms([]);
            setTotalAlarms(0);
            
            // Extract a more specific error message to display to the user
            let errorMessage = 'An error occurred while fetching alarms';
            
            if (error.response?.data?.error) {
                // Handle specific API error messages
                const apiError = error.response.data.error;
                console.error('API error:', apiError);
                
                // Check if it's the NULL database error
                if (apiError.includes('converting NULL to string is unsupported') && 
                    apiError.includes('database')) {
                    errorMessage = 'Database field issue detected. Please update the backend to handle null database values.';
                } else {
                    errorMessage = `API Error: ${apiError}`;
                }
            } else if (error.message) {
                errorMessage = `Error: ${error.message}`;
            }
            
            message.error(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    // Function to check if user is actively interacting
    const checkUserActivity = () => {
        const now = Date.now();
        const timeSinceLastActivity = now - lastUserActivity;
        const hasOpenModals = modalVisible || explainModalVisible || mongoExplainModalVisible || showParamForm;
        
        // Consider user as interacting if:
        // - Any modal is open
        // - Recent activity (within last 3 seconds) - reduced from 10 seconds
        const isInteracting = hasOpenModals || timeSinceLastActivity < 3000;
        return isInteracting;
    };

    // Track user activity - but only for significant interactions
    useEffect(() => {
        const updateActivity = () => {
            setLastUserActivity(Date.now());
        };

        // Add event listeners for significant user activity only
        // Removed mousemove to prevent constant updates
        const events = ['mousedown', 'keypress', 'scroll', 'touchstart', 'click'];
        events.forEach(event => {
            document.addEventListener(event, updateActivity, true);
        });

        return () => {
            events.forEach(event => {
                document.removeEventListener(event, updateActivity, true);
            });
        };
    }, []);

    // Update interaction state based on modals and activity
    useEffect(() => {
        const hasOpenModals = modalVisible || explainModalVisible || mongoExplainModalVisible || showParamForm;
        const isInteracting = hasOpenModals || checkUserActivity();
        setIsUserInteracting(isInteracting);
    }, [modalVisible, explainModalVisible, mongoExplainModalVisible, showParamForm, lastUserActivity]);

    // Fetch filter options when date range changes
    useEffect(() => {
        // Fetch filter options from all pages when the component mounts or date range changes
        fetchFilterOptions();
    }, [dateRange]);

    useEffect(() => {
        // Reset to first page when date range changes
        setCurrentPage(1);
        // Don't fetch here - let the currentPage useEffect handle it
        
        // Background refresh setup
        const now = dayjs();
        const isViewingRecent = dateRange[1].isAfter(now.subtract(1, 'hour'));
        
        let intervalId: number | undefined;
        let backgroundRefreshCount = 0;

        if (isViewingRecent) {
            
            // Initial background check after 10 seconds
            const initialCheckTimeout = setTimeout(() => {
                if (!checkUserActivity()) {
                    fetchAlarms(false, 1, true);
                }
            }, 10000);

            // Regular interval check every 30 seconds
            intervalId = window.setInterval(() => {
                backgroundRefreshCount++;
                
                const isInteracting = checkUserActivity();

                if (!isInteracting) {
                    fetchAlarms(false, 1, true);
                } else {
                }
            }, 30000);

            return () => {
                if (intervalId) clearInterval(intervalId);
                clearTimeout(initialCheckTimeout);
            };
        }
        
        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [dateRange]);

    // useEffect for page changes only
    useEffect(() => {
        fetchAlarms(false, currentPage, false);
    }, [currentPage]);

    // useEffect for pageSize changes - reset to page 1
    useEffect(() => {
        if (currentPage !== 1) {
            setCurrentPage(1);
        } else {
            // If already on page 1, fetch directly
            fetchAlarms(false, 1, false);
        }
    }, [pageSize]);

    // useEffect for filter changes - reset to page 1
    useEffect(() => {
        if (currentPage !== 1) {
            setCurrentPage(1);
        } else {
            // If already on page 1, fetch directly
            fetchAlarms(false, 1, false);
        }
    }, [filters]);

    const getAlarmStatus = (alarm: Alarm) => {
        if (alarm.acknowledged) return { text: 'Acknowledged', color: 'green' };
        if (alarm.status === 'resolved') return { text: 'Resolved', color: 'blue' };
        if (alarm.status === 'triggered') return { text: 'New', color: 'volcano' };
        return { text: 'Unknown', color: 'gray' };
    };

    const handleAcknowledge = async (eventId: string) => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/status/alarms/${eventId}/acknowledge`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
            });

            if (!response.ok) {
                throw new Error('Failed to acknowledge alarm');
            }

            setAlarms(prevAlarms =>
                prevAlarms.map(alarm =>
                    alarm.id === eventId
                        ? { ...alarm, acknowledged: true }
                        : alarm
                )
            );

            message.success('Alarm acknowledged successfully');
        } catch (error) {
            console.error('Error acknowledging alarm:', error);
            message.error('Failed to acknowledge alarm');
        }
    };

    const formatRelativeTime = (timestamp: string) => {
        const alarmTime = dayjs(timestamp);
        const now = dayjs();
        
        // Milisaniye cinsinden fark
        const diffMs = now.valueOf() - alarmTime.valueOf();
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    };

    const handleDateRangeChange = (
        dates: [dayjs.Dayjs | null, dayjs.Dayjs | null] | null,
    ) => {
        if (dates && dates[0] && dates[1]) {
            setDateRange([
                dates[0].startOf('day'),
                dates[1].endOf('day')
            ]);
        }
    };

    const handleShowFullMessage = (messageText: string, type: string, database?: string, agentId?: string) => {
        // First close any existing modals
        Modal.destroyAll();
        setShowParamForm(false);
        setExplainModalVisible(false);
        setMongoExplainModalVisible(false);

        if (type === 'sql_deadlock_xml') {
            // Extract XML from message
            const xmlMatch = messageText.match(/COMPRESSED_XML:[\w+/=]+/);
            if (xmlMatch) {
                handleShowMssqlDeadlock(messageText, xmlMatch[0], database, agentId);
            } else {
                message.error('Could not find deadlock XML data in the message');
            }
        } else if (type.includes('postgresql_slow_queries')) {
            // Handle PostgreSQL slow queries
            
            // Check if message contains multiple queries
            const queries = extractQueriesFromMessage(messageText);
            
            if (queries.length > 0) {
                // Store all extracted queries
                setMultiQueryDetails({
                    queries,
                    selectedQueryIndex: 0
                });
                
                // Set the first query as default selection
                const firstQuery = queries[0];
                const titlePrefix = database ? `SQL Query (${database})` : 'SQL Query';
                setModalTitle(`${titlePrefix} - Query ${1} of ${queries.length}`);
                setModalContent(firstQuery.sql);
                
                // Store current query details for explain feature
                if (database && agentId) {
                    setCurrentQueryDetails({
                        query: firstQuery.sql,
                        database: firstQuery.database || database,
                        agentId: agentId
                    });
                } else {
                    setCurrentQueryDetails(null);
                }
                
                // Show the modal with a small delay to ensure other modals are closed
                setTimeout(() => {
                    setModalVisible(true);
                }, 100);
            } else {
                // Fallback if no queries were extracted
                setModalTitle('No valid SQL queries found');
                setModalContent(messageText);
                setCurrentQueryDetails(null);
                setMultiQueryDetails({ queries: [], selectedQueryIndex: 0 });
                
                // Show the modal with a small delay to ensure other modals are closed
                setTimeout(() => {
                    setModalVisible(true);
                }, 100);
            }
        }
    };
    
    // Function to extract multiple queries from a message
    const extractQueriesFromMessage = (message: string): MultiQueryDetails['queries'] => {
        const extractedQueries: MultiQueryDetails['queries'] = [];
        
        // Split message into lines for easier processing
        const lines = message.split('\n');
        
        // Use regex to find PID lines that indicate the start of a query
        const queryStartPattern = /PID=(\d+),\s+User=([^,]+),\s+DB=([^,]+),\s+Duration=([^,]+ms),\s+Query=(.+)/;
        
        // Track current query being built
        let currentQueryIdx = -1;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Check if this line starts a new query
            const queryMatch = line.match(queryStartPattern);
            
            if (queryMatch) {
                // This is a new query start
                currentQueryIdx++;
                
                // Extract query info from match
                const [_, pid, user, database, duration, queryStart] = queryMatch;
                
                // Initialize the query object
                extractedQueries.push({
                    sql: queryStart.trim(),
                    pid,
                    user,
                    database,
                    duration,
                    id: currentQueryIdx
                });
            } else if (currentQueryIdx >= 0 && line.trim() !== '') {
                // This is a continuation of the current query
                extractedQueries[currentQueryIdx].sql += '\n' + line.trim();
            } else if (line.trim().startsWith('Query=')) {
                // Handle case where Query= appears without PID format
                currentQueryIdx++;
                const queryText = line.substring(line.indexOf('Query=') + 6).trim();
                extractedQueries.push({
                    sql: queryText,
                    id: currentQueryIdx
                });
            }
        }
        
        // If no queries were found using PID pattern, try extracting with simpler pattern
        if (extractedQueries.length === 0) {
            // Look for Query= pattern
            const queryMatch = message.match(/Query=(.+)$/s);
            if (queryMatch && queryMatch[1]) {
                extractedQueries.push({
                    sql: queryMatch[1].trim(),
                    id: 0
                });
            }
        }
        
        return extractedQueries;
    };
    
    // Function to handle query selection change
    const handleQuerySelectionChange = (queryIndex: number) => {
        if (
            multiQueryDetails.queries.length > queryIndex && 
            queryIndex >= 0
        ) {
            setMultiQueryDetails({
                ...multiQueryDetails,
                selectedQueryIndex: queryIndex
            });
            
            const selectedQuery = multiQueryDetails.queries[queryIndex];
            
            // Update modal content and title
            setModalContent(selectedQuery.sql);
            setModalTitle(`SQL Query${selectedQuery.database ? ` (${selectedQuery.database})` : ''} - Query ${queryIndex + 1} of ${multiQueryDetails.queries.length}`);
            
            // Update current query details for explain button
            if (currentQueryDetails) {
                setCurrentQueryDetails({
                    ...currentQueryDetails,
                    query: selectedQuery.sql,
                    database: selectedQuery.database || currentQueryDetails.database
                });
            }
        }
    };

    // Function to fetch explain analyze results
    const fetchExplainAnalyze = async () => {
        
        if (!currentQueryDetails) {
            message.error('Missing query details for explain. Please check database and agent information.');
            console.error("currentQueryDetails is null or undefined");
            return;
        }

        if (!currentQueryDetails.query) {
            message.error('Missing query text for explain');
            console.error("currentQueryDetails.query is missing");
            return;
        }

        if (!currentQueryDetails.database) {
            message.error('Missing database name for explain');
            console.error("currentQueryDetails.database is missing");
            return;
        }

        if (!currentQueryDetails.agentId) {
            message.error('Missing agent ID for explain');
            console.error("currentQueryDetails.agentId is missing");
            return;
        }

        // Check if query has parameters
        const parameters = extractQueryParameters(currentQueryDetails.query);
        if (parameters.length > 0 && !showParamForm) {
            setShowParamForm(true);
            // Initialize parameter values if not already set
            const initialValues: Record<string, string> = {};
            parameters.forEach(param => {
                if (!paramValues[param]) {
                    initialValues[param] = '';
                }
            });
            if (Object.keys(initialValues).length > 0) {
                setParamValues(prev => ({ ...prev, ...initialValues }));
            }
            return;
        }

        setExplainLoading(true);
        
        // Show loading message in the current modal
        setModalContent((prevContent) => {
            return `${prevContent}\n\n---\n\n**Getting query execution plan...**\nPlease wait while we analyze your query.`;
        });
        
        try {
            const { query, database, agentId } = currentQueryDetails;
            
            
            
            // Validate that all parameters have values
            const missingParams = parameters.filter(param => !paramValues[param] && paramValues[param] !== '');
            if (missingParams.length > 0) {
                message.error(`Missing values for parameters: ${missingParams.join(', ')}`);
                setShowParamForm(true);
                setExplainLoading(false);
                return;
            }

            // Replace parameters with actual values
            let finalQuery = query;
            if (parameters.length > 0) {
                finalQuery = replaceQueryParameters(query, paramValues);
            }
            
            // Ensure agent ID has the correct format
            const formattedAgentId = agentId.startsWith('agent_') ? agentId : `agent_${agentId}`;



            const response = await axios.post(
                `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/agents/${formattedAgentId}/explain`,
                {
                    database,
                    query: finalQuery
                },
                { 
                    withCredentials: true,
                    headers: {
                        'Content-Type': 'application/json'
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
                    
                    // First close the original modal, then show the explain modal
                    setModalVisible(false);
                    setTimeout(() => {
                        setExplainModalVisible(true);
                    }, 100); // Small delay to ensure the original modal is closed first
                    
                } else {
                    throw new Error('Could not extract explain results from the response');
                }
            } else {
                throw new Error('Empty response from explain API');
            }
        } catch (error: any) {
            let errorMessage = 'Failed to get query execution plan';
            
            if (error.response) {
                if (error.response.data?.error) {
                    errorMessage = `API Error: ${error.response.data.error}`;
                } else if (error.response.data) {
                    errorMessage = `API Error: ${JSON.stringify(error.response.data)}`;
                } else if (error.response.status) {
                    errorMessage = `API Error: Status ${error.response.status}`;
                }
            } else if (error.request) {
                errorMessage = 'No response received from the server';
            } else if (error.message) {
                errorMessage = `Error: ${error.message}`;
            }
            
            message.error(errorMessage);
            
            // Reset the modal content to remove loading message in case of error
            setModalContent((prevContent) => {
                return prevContent.replace(/\n\n---\n\n\*\*Getting query execution plan\.\.\.\*\*\nPlease wait while we analyze your query\./, '');
            });
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
                // Process main plan nodes (operations)
                let currentNodeId = 0;
                let parentStack: number[] = [];
                let currentIndentation = 0;
                let currentNode: PlanNode | null = null;
                
                for (const key of planEntries) {
                    const line = planData[key];
                    
                    // Skip empty lines
                    if (!line || line.trim() === '') continue;
                    
                    // Check for operation nodes (usually have 'cost=' or have indentation)
                    const indentation = line.search(/\S/); // Find first non-whitespace character
                    const isOperationNode = line.includes('cost=') || 
                                           line.includes('Seq Scan') || 
                                           line.includes('Index Scan') || 
                                           line.includes('Hash Join') ||
                                           line.includes('Sort') ||
                                           line.includes('Nested Loop') ||
                                           line.includes('Delete') ||
                                           line.includes('Update') ||
                                           line.includes('Insert') ||
                                           line.includes('Aggregate');
                                           
                    // Check for timing information
                    const isTiming = line.includes('Time:') || 
                                     line.includes('Planning:') || 
                                     line.includes('Execution Time:') ||
                                     line.includes('calls=');
                    
                    // Check if this is information about the previous node
                    const isNodeInfo = line.includes('Output:') || 
                                       line.includes('Buffers:') ||
                                       line.includes('Sort Key:') ||
                                       line.includes('Join Filter:') ||
                                       line.includes('Hash Cond:') ||
                                       line.includes('Filter:') ||
                                       line.includes('Index Cond:') ||
                                       line.includes('Rows Removed:') ||
                                       line.includes('Worker') ||
                                       line.includes('loops=');
                    
                    if (isOperationNode) {
                        // Handle indentation to determine parent-child relationships
                        if (indentation > currentIndentation) {
                            // This is a child of the previous node
                            parentStack.push(currentNodeId - 1);
                        } else if (indentation < currentIndentation) {
                            // Going back up the tree
                            const levelsUp = Math.floor((currentIndentation - indentation) / 2);
                            for (let i = 0; i < levelsUp && parentStack.length > 0; i++) {
                                parentStack.pop();
                            }
                        }
                        currentIndentation = indentation;
                        
                        // Extract cost and time information using regex
                        // Pattern for (cost=X..Y rows=Z width=W) (actual time=A..B rows=C loops=D)
                        const costMatch = line.match(/cost=([0-9.]+)\.\.([0-9.]+)/);
                        const timeMatch = line.match(/actual time=([0-9.]+)\.\.([0-9.]+)/);
                        const plannedRowsMatch = line.match(/cost=[0-9.]+\.\.[0-9.]+ rows=([0-9]+)/);
                        const actualRowsMatch = line.match(/actual time=[0-9.]+\.\.[0-9.]+ rows=([0-9]+)/);
                        const loopsMatch = line.match(/loops=([0-9]+)/);
                        
                        // Create the node object
                        currentNode = {
                            id: currentNodeId++,
                            parentId: parentStack.length > 0 ? parentStack[parentStack.length - 1] : -1,
                            operation: line.trim(),
                            cost: costMatch ? {
                                start: parseFloat(costMatch[1]),
                                end: parseFloat(costMatch[2])
                            } : undefined,
                            time: timeMatch ? {
                                start: parseFloat(timeMatch[1]),
                                end: parseFloat(timeMatch[2])
                            } : undefined,
                            rows: actualRowsMatch ? parseInt(actualRowsMatch[1]) : undefined,
                            plannedRows: plannedRowsMatch ? parseInt(plannedRowsMatch[1]) : undefined,
                            loops: loopsMatch ? parseInt(loopsMatch[1]) : undefined,
                            buffers: { 
                                shared: { 
                                    hit: undefined,
                                    read: undefined,
                                    dirtied: undefined,
                                    written: undefined
                                } 
                            },
                            output: []
                        };
                        
                        nodes.push(currentNode);
                    } else if (isNodeInfo && currentNode) {
                        // Add additional information to the current node
                        if (line.includes('Buffers: shared')) {
                            // Extract buffer information
                            const hitMatch = line.match(/hit=([0-9]+)/);
                            const readMatch = line.match(/read=([0-9]+)/);
                            const dirtiedMatch = line.match(/dirtied=([0-9]+)/);
                            const writtenMatch = line.match(/written=([0-9]+)/);
                            
                            if (!currentNode.buffers) {
                                currentNode.buffers = { 
                                    shared: {
                                        hit: undefined,
                                        read: undefined,
                                        dirtied: undefined,
                                        written: undefined
                                    } 
                                };
                            }
                            
                            if (hitMatch && currentNode.buffers.shared) {
                                currentNode.buffers.shared.hit = parseInt(hitMatch[1]);
                            }
                            if (readMatch && currentNode.buffers.shared) {
                                currentNode.buffers.shared.read = parseInt(readMatch[1]);
                            }
                            if (dirtiedMatch && currentNode.buffers.shared) {
                                currentNode.buffers.shared.dirtied = parseInt(dirtiedMatch[1]);
                            }
                            if (writtenMatch && currentNode.buffers.shared) {
                                currentNode.buffers.shared.written = parseInt(writtenMatch[1]);
                            }
                        } else if (line.includes('Output:')) {
                            // Extract output columns
                            const outputParts = line.replace('Output:', '').trim().split(',');
                            if (!currentNode.output) {
                                currentNode.output = [];
                            }
                            currentNode.output = outputParts.map((p: string) => p.trim());
                        } else if (line.includes('Sort Key:')) {
                            // Extract sort keys
                            const sortParts = line.replace('Sort Key:', '').trim().split(',');
                            currentNode.sort = sortParts.map((p: string) => p.trim());
                        } else if (line.includes('Index Cond:')) {
                            // Extract index condition
                            const condMatch = line.match(/Index Cond: (.+)/);
                            if (condMatch) {
                                currentNode.condition = condMatch[1];
                            }
                        }
                    } else if (isTiming) {
                        // Extract timing information
                        const executionTimeMatch = line.match(/Execution Time: ([0-9.]+) ms/);
                        const planningTimeMatch = line.match(/Planning Time: ([0-9.]+) ms/);
                        const triggerTimeMatch = line.match(/time=([0-9.]+) calls=([0-9]+)/);
                        
                        if (executionTimeMatch) {
                            timings.push({
                                name: 'Execution',
                                time: parseFloat(executionTimeMatch[1]),
                                percentage: 100 // Will be calculated later
                            });
                        } else if (planningTimeMatch) {
                            timings.push({
                                name: 'Planning',
                                time: parseFloat(planningTimeMatch[1]),
                                percentage: 0 // Will be calculated later
                            });
                        } else if (triggerTimeMatch) {
                            // Extract trigger name from the line
                            const triggerNameMatch = line.match(/Trigger ([a-zA-Z0-9_]+)/);
                            const triggerName = triggerNameMatch ? triggerNameMatch[1] : 'Trigger';
                            
                            timings.push({
                                name: triggerName,
                                time: parseFloat(triggerTimeMatch[1]),
                                calls: parseInt(triggerTimeMatch[2]),
                                percentage: 0 // Will be calculated later
                            });
                        }
                    }
                }
                
                // Extract additional information from duration_ms
                if (planData.duration_ms) {
                    // Add execution time if not already present
                    if (!timings.find(t => t.name === 'Execution')) {
                        timings.push({
                            name: 'Execution',
                            time: parseFloat(planData.duration_ms),
                            percentage: 100
                        });
                    }
                }
                
                // Calculate percentages for timing information
                if (timings.length > 0) {
                    const totalTime = timings.reduce((sum, timing) => sum + timing.time, 0);
                    timings.forEach(timing => {
                        timing.percentage = (timing.time / totalTime) * 100;
                    });
                    
                    // Sort by time descending
                    timings.sort((a, b) => b.time - a.time);
                }
                
                // Make a second pass through all nodes to ensure we've properly connected parent/child
                // relationships and captured all the data
                for (let i = 0; i < nodes.length; i++) {
                    const node = nodes[i];
                    // Look for missing planned/actual rows
                    if (node.rows === undefined || node.plannedRows === undefined) {
                        // Get actual node text and try to parse it again
                        const nodeText = node.operation || "";
                        
                        // For rows, try to parse from the fulltext
                        if (node.rows === undefined) {
                            const rowsMatch = nodeText.match(/actual time=[0-9.]+\.\.[0-9.]+ rows=([0-9]+)/);
                            if (rowsMatch) {
                                node.rows = parseInt(rowsMatch[1]);
                            }
                        }
                        
                        // For planned rows, try to parse from the fulltext
                        if (node.plannedRows === undefined) {
                            const plannedRowsMatch = nodeText.match(/cost=[0-9.]+\.\.[0-9.]+ rows=([0-9]+)/);
                            if (plannedRowsMatch) {
                                node.plannedRows = parseInt(plannedRowsMatch[1]);
                            }
                        }
                    }
                }
            }
            
            setPlanVisualization(nodes);
            setQueryTimingData(timings);
            
        } catch (error) {
            console.error('Error parsing plan data for visualization:', error);
            // Fallback to empty visualization
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
        
        // Extract operation type and target
        const operationParts = node.operation.trim().split(/\s+/);
        const operationType = operationParts[0];
        let indexUsed = '';
        let tableName = '';
        
        // Parse operation details based on common patterns
        if (node.operation.includes(' on ')) {
            const onParts = node.operation.split(' on ');
            if (onParts.length > 1) {
                tableName = onParts[1].split(/\s+/)[0];
            }
        }
        
        if (node.operation.includes('using ')) {
            const usingParts = node.operation.split('using ');
            if (usingParts.length > 1) {
                indexUsed = usingParts[1].split(/\s+/)[0];
            }
        }
        
        // Create a more detailed node title
        let nodeTitle = `#${nodeIndex + 1} ${operationType}`;
        if (indexUsed) {
            nodeTitle += ` using ${indexUsed}`;
        }
        if (tableName) {
            nodeTitle += ` on ${tableName}`;
        }
        
        // Set node description based on operation type
        let nodeDescription = '';
        switch (operationType.toLowerCase()) {
            case 'index':
            case 'index scan':
                nodeDescription = 'Index Scan finds records using an index.';
                break;
            case 'seq':
            case 'seq scan':
                nodeDescription = 'Sequential Scan reads every row in the table.';
                break;
            case 'hash':
            case 'hash join':
                nodeDescription = 'Hash Join builds a hash table and probes it.';
                break;
            case 'sort':
                nodeDescription = 'Sort operation sorts rows.';
                break;
            case 'nested':
            case 'nested loop':
                nodeDescription = 'Nested Loop processes each row from inputs.';
                break;
            case 'delete':
                nodeDescription = 'Delete operation removes rows.';
                break;
            case 'update':
                nodeDescription = 'Update operation modifies rows.';
                break;
            case 'insert':
                nodeDescription = 'Insert operation adds rows.';
                break;
            case 'aggregate':
                nodeDescription = 'Aggregate operation groups rows.';
                break;
            default:
                nodeDescription = `${operationType} operation.`;
        }
        
        // Time percentage if available
        const timePercentage = node.time ? 
            (node.time.end / allNodes.reduce((sum, n) => sum + (n.time?.end || 0), node.time.end)) * 100 : 
            0;
        
        return (
            <li key={node.id} style={{ 
                marginBottom: '6px', 
                maxWidth: '600px'  // Limit the maximum width of each card
            }}>
                <Card
                    bordered
                    title={
                        <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center', 
                            fontSize: '12px',  // Reduce from 13px to 12px
                            whiteSpace: 'nowrap', 
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                        }}>
                            <Tooltip title={node.operation.trim()}>
                                <span style={{ 
                                    overflow: 'hidden', 
                                    textOverflow: 'ellipsis',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '3px'  // Reduce from 4px to 3px
                                }}>
                                    {nodeTitle}
                                    
                                    {/* High cost indicator */}
                                    {isHighCost && (
                                        <Tooltip title="High cost operation!">
                                            <DollarOutlined style={{ 
                                                color: '#faad14',
                                                fontSize: '11px'  // Reduce from 12px to 11px
                                            }} />
                                        </Tooltip>
                                    )}
                                    
                                    {/* Row estimation issue indicator */}
                                    {rowMismatchSeverity !== 'none' && rowMismatchSeverity !== 'low' && (
                                        <Tooltip title={
                                            rowMismatchSeverity === 'severe' 
                                                ? 'Severe row estimation error!'
                                                : 'Moderate row estimation issue'
                                        }>
                                            <WarningOutlined style={{ 
                                                color: rowMismatchSeverity === 'severe' ? '#ff4d4f' : '#faad14',
                                                fontSize: '11px'  // Reduce from 12px to 11px
                                            }} />
                                        </Tooltip>
                                    )}
                                </span>
                            </Tooltip>
                            
                            {node.time && (
                                <Tag color={getTimingColor(node.time.end)} style={{ 
                                    marginLeft: '3px',  // Reduce from 4px to 3px 
                                    fontSize: '10px',   // Reduce from 11px to 10px
                                    padding: '0 3px',   // Reduce from 0 4px to 0 3px
                                    flexShrink: 0 
                                }}>
                                    {node.time.end.toFixed(2)}ms
                                </Tag>
                            )}
                        </div>
                    }
                    style={{ 
                        borderTop: `2px solid ${nodeColor}`,
                        boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                        fontSize: '11px'  // Reduce from 12px to 11px
                    }}
                    size="small"
                    bodyStyle={{ padding: '6px' }}  // Reduce from 8px to 6px
                    headStyle={{ padding: '0 6px', minHeight: '28px' }}  // Reduce padding and height
                >
                    <div style={{ fontSize: '11px', marginBottom: '3px' }}>  {/* Reduce sizes */}
                        <div style={{ fontSize: '10px', color: '#666', marginTop: '1px' }}>{nodeDescription}</div>
                    </div>
                    
                    <Tabs 
                        type="card" 
                        size="small" 
                        defaultActiveKey="general"
                        style={{ fontSize: '10px' }}  // Reduce from 11px to 10px
                        tabBarStyle={{ marginBottom: '3px', height: '22px' }}  // Reduce sizes
                        tabBarGutter={3}  // Reduce from 4px to 3px
                    >
                        <TabPane tab="General" key="general">
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {node.time && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>Time:</span>
                                        <span>
                                            <b style={{ color: getTimingColor(node.time.end) }}>{node.time.end.toFixed(2)}ms</b>
                                            {timePercentage > 0 && <span> | {timePercentage.toFixed(0)}%</span>}
                                        </span>
                                    </div>
                                )}
                                
                                {node.rows !== undefined && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>Rows:</span>
                                        <span>
                                            <b>{node.rows}</b>
                                            {node.plannedRows !== undefined && (
                                                <span> ({node.plannedRows})
                                                    {hasRowMismatch && (
                                                        <Tooltip 
                                                            title={
                                                                node.rows === 0 && node.plannedRows > 0 
                                                                ? "Over-estimated: No rows returned, but planner expected rows" 
                                                                : node.rows > node.plannedRows 
                                                                ? "Under-estimated: More rows than expected"
                                                                : "Over-estimated: Fewer rows than expected"
                                                            }
                                                        >
                                                            <span style={{ 
                                                                color: rowMismatchSeverity === 'severe' ? '#ff4d4f' : '#faad14', 
                                                                marginLeft: '4px', 
                                                                cursor: 'help',
                                                                fontWeight: 'bold' 
                                                            }}>
                                                                {node.rows > node.plannedRows ? '↑' : '↓'}
                                                            </span>
                                                        </Tooltip>
                                                    )}
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                )}
                                
                                {node.cost && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>Cost:</span>
                                        <span>
                                            <b style={{ 
                                                color: isHighCost ? '#faad14' : 'inherit'
                                            }}>{totalCost.toFixed(2)}</b>
                                            {node.cost.start > 0 && (
                                                <Tooltip title="Start cost..End cost">
                                                    <span style={{ marginLeft: '4px', color: '#888', fontSize: '10px', cursor: 'help' }}>
                                                        ({node.cost.start.toFixed(2)}..{node.cost.end.toFixed(2)})
                                                    </span>
                                                </Tooltip>
                                            )}
                                        </span>
                                    </div>
                                )}
                                
                                {node.loops !== undefined && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>Loops:</span>
                                        <span><b>{node.loops}</b></span>
                                    </div>
                                )}
                            </div>
                        </TabPane>
                        
                        {node.buffers && (node.buffers.shared?.hit || node.buffers.shared?.read) && (
                            <TabPane tab="IO" key="io">
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {node.buffers.shared && (
                                        <>
                                            <div style={{ fontWeight: 'bold', marginBottom: '2px', fontSize: '11px' }}>Shared:</div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                                {node.buffers.shared.hit !== undefined && (
                                                    <span>
                                                        Hit: <b>{node.buffers.shared.hit}</b>
                                                    </span>
                                                )}
                                                {node.buffers.shared.read !== undefined && (
                                                    <span>
                                                        Read: <b>{node.buffers.shared.read}</b>
                                                    </span>
                                                )}
                                                {node.buffers.shared.dirtied !== undefined && (
                                                    <span>
                                                        Dirty: <b>{node.buffers.shared.dirtied}</b>
                                                    </span>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </TabPane>
                        )}
                        
                        {node.output && node.output.length > 0 && (
                            <TabPane tab="Out" key="output">
                                <div style={{ fontSize: '11px', fontFamily: 'monospace', maxHeight: '60px', overflow: 'auto' }}>
                                    {node.output.map((line, i) => (
                                        <div key={i}>{line}</div>
                                    ))}
                                </div>
                            </TabPane>
                        )}
                        
                        {node.sort && node.sort.length > 0 && (
                            <TabPane tab="Sort" key="sort">
                                <div style={{ fontSize: '11px', maxHeight: '60px', overflow: 'auto' }}>
                                    <ul style={{ paddingLeft: '16px', margin: '2px 0' }}>
                                        {node.sort.map((key, i) => (
                                            <li key={i}>{key}</li>
                                        ))}
                                    </ul>
                                </div>
                            </TabPane>
                        )}
                    </Tabs>
                </Card>
                
                {children.length > 0 && (
                    <ul style={{ 
                        listStyleType: 'none', 
                        paddingLeft: '20px',  // Reduce from 24px to 20px
                        marginTop: '3px',     // Reduce from 4px to 3px
                        borderLeft: '1px dashed #d9d9d9'
                    }}>
                        {children.map((child, idx) => renderPlanNode(child, allNodes, nodeIndex + idx + 1))}
                    </ul>
                )}
            </li>
        );
    };

    // Function to render query statistics summary (like in the new design)
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

    // Function to render modern plan tree (like the new design)
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
    
    // Function to render the plan tree recursively (legacy - keeping for compatibility)
    const renderPlanTree = (nodes: PlanNode[]): React.ReactNode => {
        // Find root nodes (parentId = -1)
        const rootNodes = nodes.filter(node => node.parentId === -1);
        
        if (rootNodes.length === 0) return null;
        
        return (
            <ul style={{ 
                listStyleType: 'none', 
                padding: 0,
                maxWidth: '800px',  // Limit the maximum width of the tree
                margin: '0 auto'    // Center the tree in the container
            }}>
                {rootNodes.map((node, index) => renderPlanNode(node, nodes, index))}
            </ul>
        );
    };

    const columns: ColumnsType<Alarm> = [
        {
            title: 'Severity',
            dataIndex: 'severity',
            key: 'severity',
            width: 100,
            render: (severity: string) => {
                const color = 
                    severity === 'critical' ? 'red' :
                    severity === 'warning' ? 'orange' :
                    'blue';
                return <Tag color={color}>{severity.toUpperCase()}</Tag>;
            },
            filters: [
                { text: 'Critical', value: 'critical' },
                { text: 'Warning', value: 'warning' },
                { text: 'Info', value: 'info' }
            ],
            filteredValue: filters.severity || null
        },
        {
            title: 'Host',
            dataIndex: 'host',
            key: 'host',
            width: 200,
            sorter: (a, b) => a.host.localeCompare(b.host),
            filters: uniqueHosts.map(host => ({
                text: host,
                value: host
            })),
            filteredValue: filters.host || null
        },
        {
            title: 'Type',
            dataIndex: 'type',
            key: 'type',
            width: 200,
            filters: uniqueTypes.map(type => ({
                text: type,
                value: type
            })),
            filteredValue: filters.type || null,
            render: (type: string) => {
                let color = '';
                let icon = null;
                
                // Alarm tipine göre renk ve ikon belirleme
                if (type.includes('mongodb_failover')) {
                    color = 'purple';
                    icon = '🔄';
                } else if (type.includes('postgresql_slow_queries')) {
                    color = 'orange';
                    icon = '⏱️';
                } else if (type.includes('mssql_slow_queries')) {
                    color = 'orange';
                    icon = '⏱️';
                } else if (type.includes('mongodb_slow_queries')) {
                    color = 'blue';
                    icon = '⏱️';
                } else if (type.includes('mssql_blocking_queries')) {
                    color = 'volcano';
                    icon = '🔒';
                } else if (type.includes('mssql_deadlocks')) {
                    color = 'red';
                    icon = '⚠️';
                } else if (type.includes('disk_usage')) {
                    color = 'gold';
                    icon = '💾';
                } else if (type.includes('cpu_usage')) {
                    color = 'lime';
                    icon = '⚙️';
                } else if (type.includes('memory_usage')) {
                    color = 'cyan';
                    icon = '🧠';
                } else if (type.includes('agent_offline')) {
                    color = 'red';
                    icon = '🔌';
                } else if (type.includes('mongodb_replica')) {
                    color = 'geekblue';
                    icon = '🔄';
                } else if (type.includes('service_status')) {
                    color = 'volcano';
                    icon = '🚨';
                } else {
                    color = 'default';
                }
                
                // Clean up display names
                let displayType = type;
                displayType = displayType.replace('postgresql_', 'pg_');
                displayType = displayType.replace('mongodb_', 'mongo_');
                displayType = displayType.replace('mssql_', 'sql_');
                displayType = displayType.replace('_queries', '');
                displayType = displayType.replace('_usage', '');
                
                return (
                    <Tag color={color} style={{ minWidth: '100px', textAlign: 'center' }}>
                        {icon && <span style={{ marginRight: '4px' }}>{icon}</span>}
                        {displayType}
                    </Tag>
                );
            }
        },
        {
            title: 'Database',
            dataIndex: 'database',
            key: 'database',
            width: 120,
            render: (database: string | undefined, record: Alarm) => {
                // Show database name for postgresql_slow_queries and mssql_blocking_queries alarms
                if ((record.type.includes('postgresql_slow_queries') || 
                     record.type.includes('mssql_blocking_queries') ||
                     record.type.includes('mssql_deadlocks')) && 
                    database) {
                    let color = 'purple'; // Default for PostgreSQL
                    
                    if (record.type.includes('mssql_blocking_queries')) {
                        color = 'volcano';
                    } else if (record.type.includes('mssql_deadlocks')) {
                        color = 'red';
                    }
                    
                    return (
                        <Tag color={color}>
                            {database}
                        </Tag>
                    );
                }
                return null; // Don't show anything for other alarm types
            },
            // Only include in filters if it has a value
            filters: uniqueTypes.some(t => t.includes('postgresql_slow_queries') || t.includes('mssql_blocking_queries'))
                ? Array.from(new Set(alarms
                    .filter(a => (a.type.includes('postgresql_slow_queries') || a.type.includes('mssql_blocking_queries')) && a.database)
                    .map(a => a.database)
                  ))
                  .filter((db): db is string => Boolean(db))
                  .map(db => ({ text: db, value: db }))
                : undefined,
            filteredValue: filters.database || null
        },
        {
            title: 'Message',
            dataIndex: 'message',
            key: 'message',
            width: 300,
            filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }) => (
                <div style={{ padding: 8 }}>
                    <Input
                        placeholder="Search message"
                        value={selectedKeys[0]}
                        onChange={e => setSelectedKeys(e.target.value ? [e.target.value] : [])}
                        onPressEnter={() => {
                            confirm();
                            setFilters(prev => ({
                                ...prev,
                                message: selectedKeys[0] as string || undefined
                            }));
                        }}
                        style={{ width: 188, marginBottom: 8, display: 'block' }}
                    />
                    <Space>
                        <Button
                            type="primary"
                            onClick={() => {
                                confirm();
                                setFilters(prev => ({
                                    ...prev,
                                    message: selectedKeys[0] as string || undefined
                                }));
                            }}
                            size="small"
                            style={{ width: 90 }}
                        >
                            Search
                        </Button>
                        <Button
                            onClick={() => {
                                clearFilters?.();
                                setFilters(prev => ({
                                    ...prev,
                                    message: undefined
                                }));
                                confirm();
                            }}
                            size="small"
                            style={{ width: 90 }}
                        >
                            Reset
                        </Button>
                    </Space>
                </div>
            ),
            filteredValue: filters.message ? [filters.message] : null,
            filterIcon: filtered => (
                <SearchOutlined style={{ color: filtered ? '#1890ff' : undefined }} />
            ),
            render: (text: string, record: Alarm) => {
                const isPostgresSlowQuery = record.type.includes('postgresql_slow_queries');
                const isMongoSlowQuery = record.type.includes('mongodb_slow_queries');
                const isMssqlSlowQuery = record.type.includes('mssql_slow_queries');
                const isSlowQuery = isPostgresSlowQuery || isMongoSlowQuery || isMssqlSlowQuery;
                
                const isMssqlBlocking = record.type.includes('mssql_blocking_queries');
                const isMssqlDeadlock = record.type.includes('mssql_deadlocks');
                const isSqlDeadlockXml = record.type === 'mssql_deadlock_xml';
                
                const tooltipText = isSlowQuery ? 
                    'Click to view full query details' : 
                    isMssqlBlocking ?
                    'Click to view blocking details' :
                    (isMssqlDeadlock || isSqlDeadlockXml) ?
                    'Click to view deadlock graph' :
                    text;

                return (
                    <Tooltip title={tooltipText} placement="topLeft" overlayStyle={{ maxWidth: '800px' }}>
                        <div 
                            style={{ 
                                cursor: isSlowQuery || isMssqlBlocking || isMssqlDeadlock || isSqlDeadlockXml ? 'pointer' : 'default',
                                maxWidth: '600px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                            }}
                            onClick={() => {
                                if (isMongoSlowQuery) {
                                    // Display the MongoDB slow query in a modal
                                    handleShowMongoQuery(text, record.type, record.database, record.host);
                                } else if (isPostgresSlowQuery) {
                                    // Display the PostgreSQL slow query in a modal
                                    handleShowPostgresQuery(text, record.type, record.database, record.host);
                                } else if (record.type.includes('mssql_slow_queries')) {
                                    // Display the MSSQL slow query in a modal
                                    handleShowMssqlSlowQuery(text, record.type, record.database, record.host);
                                } else if (isMssqlBlocking) {
                                    // Display the MSSQL blocking query in a modal
                                    handleShowMssqlBlockingQuery(text, record.type, record.database, record.host);
                                } else if (isMssqlDeadlock) {
                                    // Extract the XML from the deadlock message
                                    const xmlMatch = text.match(/<event name="xml_deadlock_report"[\s\S]*?<\/event>/);
                                    const xmlDeadlock = xmlMatch ? xmlMatch[0] : '';
                                    
                                    if (xmlDeadlock) {
                                        // Display the MSSQL deadlock graph in a modal
                                        handleShowMssqlDeadlock(text, xmlDeadlock, record.database, record.host);
                                    } else {
                                        message.error('Could not find deadlock XML in the message');
                                    }
                                } else if (isSqlDeadlockXml) {
                                    // Extract the compressed XML from the message
                                    const xmlMatch = text.match(/COMPRESSED_XML:([\w+/=]+)/);
                                    if (xmlMatch && xmlMatch[1]) {
                                        // Display the deadlock graph in a modal using the compressed XML
                                        handleShowMssqlDeadlock(text, xmlMatch[1], record.database, record.host);
                                    } else {
                                        message.error('Could not find compressed XML data in the message');
                                    }
                                }
                            }}
                        >
                            {text}
                        </div>
                    </Tooltip>
                );
            }
        },
        {
            title: 'Time',
            dataIndex: 'timestamp',
            key: 'timestamp',
            width: 150,
            render: (timestamp: string) => {
                const time = dayjs(timestamp);
                return (
                    <Tooltip title={time.format('YYYY-MM-DD HH:mm:ss')}>
                        {formatRelativeTime(timestamp)}
                    </Tooltip>
                );
            },
            sorter: (a, b) => dayjs(a.timestamp).unix() - dayjs(b.timestamp).unix()
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            width: 120,
            render: (_, record) => {
                const status = getAlarmStatus(record);
                return <Tag color={status.color}>{status.text}</Tag>;
            },
            filters: [
                { text: 'New', value: 'triggered' },
                { text: 'Resolved', value: 'resolved' }
            ],
            filteredValue: filters.status || null
        },
        {
            title: 'Actions',
            key: 'actions',
            width: 100,
            render: (_, record: Alarm) => (
                <Space>
                    <Tooltip title={record.acknowledged ? 'Already acknowledged' : 'Acknowledge alarm'}>
                        <Button
                            type={record.acknowledged ? 'default' : 'primary'}
                            icon={<CheckOutlined />}
                            onClick={() => handleAcknowledge(record.id)}
                            disabled={record.acknowledged}
                        >
                            Ack
                        </Button>
                    </Tooltip>
                </Space>
            )
        }
    ];

    // Function to check if a query is truncated
    const isQueryTruncated = (query: string): boolean => {
        return query.includes('"$truncated"') || query.includes('{"$truncated"');
    };

    // Function to sanitize MongoDB query
    const sanitizeMongoQuery = (query: string): string => {
        try {
            // Parse the query string to JSON
            const queryObj = JSON.parse(query);
            
            if (!queryObj || typeof queryObj !== 'object') {
                console.warn('Invalid MongoDB query format:', query);
                return query;
            }
            
            // Create a new object to store sanitized query
            let sanitizedQuery: any = {};
            let commandFound = false;
            
            // Handle different operation types
            if (queryObj.find) {
                // Handle find operation
                sanitizedQuery.find = queryObj.find;
                if (queryObj.filter) sanitizedQuery.filter = queryObj.filter;
                if (queryObj.projection) sanitizedQuery.projection = queryObj.projection;
                if (queryObj.sort) sanitizedQuery.sort = queryObj.sort;
                if (queryObj.limit) sanitizedQuery.limit = queryObj.limit;
                if (queryObj.skip) sanitizedQuery.skip = queryObj.skip;
                commandFound = true;
            } else if (queryObj.aggregate) {
                // Handle aggregate operation
                sanitizedQuery.aggregate = queryObj.aggregate;
                if (queryObj.pipeline) sanitizedQuery.pipeline = queryObj.pipeline;
                if (queryObj.cursor) sanitizedQuery.cursor = queryObj.cursor;
                commandFound = true;
            } else if (queryObj.update) {
                // Handle update operation
                sanitizedQuery.update = queryObj.update;
                if (queryObj.updates) sanitizedQuery.updates = queryObj.updates;
                if (queryObj.ordered) sanitizedQuery.ordered = queryObj.ordered;
                commandFound = true;
            } else if (queryObj.delete) {
                // Handle delete operation
                sanitizedQuery.delete = queryObj.delete;
                if (queryObj.deletes) sanitizedQuery.deletes = queryObj.deletes;
                if (queryObj.ordered) sanitizedQuery.ordered = queryObj.ordered;
                commandFound = true;
            } else if (queryObj.count) {
                // Handle count operation
                sanitizedQuery.count = queryObj.count;
                if (queryObj.query) sanitizedQuery.query = queryObj.query;
                commandFound = true;
            } else if (queryObj.distinct) {
                // Handle distinct operation
                sanitizedQuery.distinct = queryObj.distinct;
                if (queryObj.key) sanitizedQuery.key = queryObj.key;
                if (queryObj.query) sanitizedQuery.query = queryObj.query;
                commandFound = true;
            } else if (queryObj.insert) {
                // Handle insert operation
                sanitizedQuery.insert = queryObj.insert;
                if (queryObj.documents) sanitizedQuery.documents = queryObj.documents;
                if (queryObj.ordered) sanitizedQuery.ordered = queryObj.ordered;
                commandFound = true;
            } else if (queryObj.findAndModify || queryObj.findandmodify) {
                // Handle findAndModify operation
                sanitizedQuery.findAndModify = queryObj.findAndModify || queryObj.findandmodify;
                if (queryObj.query) sanitizedQuery.query = queryObj.query;
                if (queryObj.sort) sanitizedQuery.sort = queryObj.sort;
                if (queryObj.update) sanitizedQuery.update = queryObj.update;
                if (queryObj.remove) sanitizedQuery.remove = queryObj.remove;
                if (queryObj.upsert) sanitizedQuery.upsert = queryObj.upsert;
                if (queryObj.fields) sanitizedQuery.fields = queryObj.fields;
                commandFound = true;
            } else if (queryObj.getMore) {
                // Handle getMore operation
                sanitizedQuery.getMore = queryObj.getMore;
                if (queryObj.collection) sanitizedQuery.collection = queryObj.collection;
                if (queryObj.batchSize) sanitizedQuery.batchSize = queryObj.batchSize;
                commandFound = true;
            } else if (queryObj.createIndexes) {
                // Handle createIndexes operation
                sanitizedQuery.createIndexes = queryObj.createIndexes;
                if (queryObj.indexes) sanitizedQuery.indexes = queryObj.indexes;
                commandFound = true;
            } else {
                // Clone the object instead of using a reference
                sanitizedQuery = JSON.parse(JSON.stringify(queryObj));
                commandFound = true;
                
                // We'll clean metadata fields later
            }
            
            // Add database name if it exists
            if (queryObj.$db) {
                sanitizedQuery.$db = queryObj.$db;
            } else if (queryObj.db) {
                sanitizedQuery.db = queryObj.db;
            }
            
            // If no command was found, try to extract pipeline and query
            if (!commandFound) {
                if (queryObj.pipeline) {
                    sanitizedQuery.pipeline = queryObj.pipeline;
                }
                if (queryObj.query) {
                    sanitizedQuery.query = queryObj.query;
                }
                
                // If still no meaningful fields, use original query
                if (Object.keys(sanitizedQuery).length === 0) {
                    console.warn("No meaningful command fields found, using original query");
                    return query;
                }
            }
            
            // List of metadata fields to remove at root level only
            const rootFieldsToRemove = [
                '$clusterTime',
                'lsid',
                '$db',
                'signature',
                'keyId',
                'hash',
                'clusterTime',
            ];
            
            // List of MongoDB BSON type operators that should NOT be removed when inside query objects
            const bsonTypeFields = [
                '$date',
                '$numberLong',
                '$numberInt',
                '$numberDecimal',
                '$binary',
                '$timestamp',
                '$oid',
                '$regex',
                '$gt',
                '$lt',
                '$gte',
                '$lte',
                '$eq',
                '$ne',
                '$exists',
                '$in',
                '$nin',
                '$and',
                '$or',
                '$not',
                '$nor',
                '$elemMatch',
                '$all'
            ];
            
            // Filter root level metadata fields
            for (const field of rootFieldsToRemove) {
                delete sanitizedQuery[field];
            }
            
            // Special case: handle $db separately
            if (Object.keys(sanitizedQuery).length > 1 && sanitizedQuery.$db) {
                delete sanitizedQuery.$db;
            }
            
            // Function to determine if a key is a query operator
            const isQueryOperator = (key: string): boolean => {
                return key.startsWith('$') && bsonTypeFields.includes(key);
            };
            
            // Recursive function to clean metadata while preserving query operators
            const cleanMetadata = (obj: any, isInsideOperator = false): any => {
                if (!obj) return obj;
                
                // Handle arrays
                if (Array.isArray(obj)) {
                    return obj.map(item => cleanMetadata(item, isInsideOperator));
                }
                
                // Handle objects
                if (typeof obj === 'object') {
                    // Check if this is a BSON type object or operator object
                    const hasOperator = Object.keys(obj).some(isQueryOperator);
                    
                    const result: any = {};
                    
                    for (const [key, value] of Object.entries(obj)) {
                        // If this is a query operator or we're inside one, keep it
                        if (isQueryOperator(key) || isInsideOperator || hasOperator) {
                            // Keep this operator/BSON type and process its contents
                            result[key] = cleanMetadata(value, true);
                        } 
                        // For normal fields, only process if not in rootFieldsToRemove
                        else if (!rootFieldsToRemove.includes(key)) {
                            result[key] = cleanMetadata(value, false);
                        }
                    }
                    
                    return result;
                }
                
                // Return primitives unchanged
                return obj;
            };
            
            // Clean the query
            const cleanedQuery = cleanMetadata(sanitizedQuery);
            
            // If cleaning resulted in empty object, use original query
            if (JSON.stringify(cleanedQuery) === '{}') {
                console.warn("Sanitization resulted in empty object, using original query");
                return query;
            }
            
            // Return the cleaned query as a formatted JSON string
            return JSON.stringify(cleanedQuery, null, 2);
        } catch (error) {
            console.error('Error sanitizing MongoDB query:', error);
            return query; // Return original query if sanitization fails
        }
    };

    // Function to fetch MongoDB explain results
    const fetchMongoExplain = async (queryDetails?: {
        query: string;
        database: string;
        agentId: string;
    }) => {
        // Eğer parametre olarak geldiyse onu kullan, yoksa state'ten al
        const currentQuery = queryDetails || currentMongoQuery;
        
        if (!currentQuery) {
            console.error('Current MongoDB Query is null:', currentQuery);
            message.error('Missing query details for explain');
            return;
        }

        setMongoExplainLoading(true);
        
        // Update the UI to show loading status within the current modal
        Modal.info({
            title: 'Getting MongoDB Query Plan',
            content: (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                    <Spin size="large" />
                    <p style={{ marginTop: '15px' }}>Analyzing the query execution plan...</p>
                    <p style={{ fontSize: '12px', color: '#999' }}>This may take a few moments</p>
                </div>
            ),
            icon: <SearchOutlined />,
            maskClosable: false
        });
        
        try {
            const { query, database, agentId } = currentQuery;
            
            // Sanitize the query before sending
            const sanitizedQuery = sanitizeMongoQuery(query);
                        
            // Ensure agent ID has the correct format
            const formattedAgentId = agentId.startsWith('agent_') ? agentId : `agent_${agentId}`;

            const response = await axios.post(
                `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/agents/${formattedAgentId}/mongo/explain`,
                {
                    database,
                    query: sanitizedQuery
                },
                { 
                    withCredentials: true,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            // Process the explain results
            if (response.data) {
                // Format the results as pretty JSON
                const formattedResults = JSON.stringify(response.data, null, 2);
                setMongoExplainResults(formattedResults);
                
                // First destroy the loading modal
                Modal.destroyAll();
                
                // Then show the explain modal
                setMongoExplainModalVisible(true);
                
            } else {
                throw new Error('Empty response from explain API');
            }
        } catch (error: any) {
            // First destroy the loading modal
            Modal.destroyAll();
            
            console.error('MongoDB explain error:', error);
            let errorMessage = 'Failed to get MongoDB query execution plan';
            
            if (error.response) {
                if (error.response.data?.error) {
                    errorMessage = `API Error: ${error.response.data.error}`;
                } else if (error.response.data) {
                    errorMessage = `API Error: ${JSON.stringify(error.response.data)}`;
                } else if (error.response.status) {
                    errorMessage = `API Error: Status ${error.response.status}`;
                }
            } else if (error.request) {
                errorMessage = 'No response received from the server';
            } else if (error.message) {
                errorMessage = `Error: ${error.message}`;
            }
            
            message.error(errorMessage);
        } finally {
            setMongoExplainLoading(false);
        }
    };

    // MongoDB sorgu modalını göster
    const handleShowMongoQuery = (messageText: string, type: string, database?: string, agentId?: string) => {
        try {
            // İlk satırdan threshold ve max duration bilgisini çıkar
            const headerMatch = messageText.match(/Found (\d+) active slow operations.*Max duration: ([\d.]+)ms/);
            const queryCount = headerMatch ? headerMatch[1] : '0';
            const maxDuration = headerMatch ? headerMatch[2] : 'N/A';

            // Sorguları ayrıştır
            const queries = messageText.split(/(?=DB=)/).slice(1); // İlk parça header olduğu için atla
            
            if (queries.length === 0) {
                message.error('No queries found in the message');
                return;
            }

            // Her sorgu için bilgileri çıkar
            const parsedQueries = queries.map(queryText => {
                const dbMatch = queryText.match(/DB=([^,]+)/);
                const collectionMatch = queryText.match(/Collection=([^,]+)/);
                const operationMatch = queryText.match(/Operation=([^,]+)/);
                const durationMatch = queryText.match(/Duration=([\d.]+)ms/);
                const clientMatch = queryText.match(/Client=([^,]+)/);
                const queryMatch = queryText.match(/Query=(.+?)(?=(?:\nDB=|\n\n|$))/s);

                let parsedQuery = '';
                let rawQuery = '';
                let sanitizedQuery = '';
                let isTruncated = false;
                
                if (queryMatch) {
                    try {
                        // Original query content
                        const queryContent = queryMatch[1].trim();
                        rawQuery = queryContent;
                        
                        // Check if query is truncated
                        isTruncated = queryContent.includes('"$truncated"') || 
                                      queryContent.includes('{"$truncated"') ||
                                      queryContent.includes('$truncated');
                        
                        // Eğer query truncated ise
                        if (isTruncated) {
                            const truncatedMatch = queryContent.match(/"{\s*\$truncated\s*":\s*"([^"]+)"/);
                            parsedQuery = truncatedMatch ? truncatedMatch[1] : queryContent;
                            sanitizedQuery = parsedQuery;
                        } else {
                            // Try to parse as JSON, but handle the case where it's not valid JSON
                            try {
                                const queryObj = JSON.parse(queryContent);
                                parsedQuery = JSON.stringify(queryObj, null, 2);
                                
                                // Apply sanitization
                                sanitizedQuery = sanitizeMongoQuery(parsedQuery);
                            } catch (parseError) {
                                // If parsing fails, use the original content
                                parsedQuery = queryContent;
                                sanitizedQuery = queryContent;
                            }
                        }
                    } catch (e) {
                        console.error('Error processing query:', e);
                        parsedQuery = queryMatch[1];
                        sanitizedQuery = queryMatch[1];
                    }
                }

                return {
                    database: dbMatch ? dbMatch[1] : 'N/A',
                    collection: collectionMatch ? collectionMatch[1] : 'N/A',
                    operation: operationMatch ? operationMatch[1] : 'N/A',
                    duration: durationMatch ? durationMatch[1] : 'N/A',
                    client: clientMatch ? clientMatch[1] : 'N/A',
                    query: parsedQuery,
                    rawQuery: rawQuery,
                    sanitizedQuery: sanitizedQuery,
                    isTruncated: isTruncated
                };
            });

            // Function to handle query AI analysis
            const handleQueryAIAnalysis = async (queryData: string) => {
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
                                content: `can you analyze this query and give me the create index command if necessary also you can rewrite the query to be more efficient and give me the rewritten query?\n\nQuery: ${queryData}`
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
                    message.error('Failed to analyze query with AI');
                }
            };

            // Modal içeriği ve görüntülenmesi
            Modal.info({
                title: 'MongoDB Slow Queries',
                width: 1000,
                    content: (
                        <div>
                            <Alert
                            message={`Found ${queryCount} slow operations (Max Duration: ${maxDuration}ms)`}
                                type="warning"
                                showIcon
                                style={{ marginBottom: '16px' }}
                            />
                            <Tabs type="card">
                            {parsedQueries.map((q, index) => (
                                <Tabs.TabPane 
                                    key={index} 
                                    tab={`Query ${index + 1} (${q.duration}ms)`}
                                >
                                    <div style={{ marginBottom: '16px' }}>
                                        <Tag color="blue">Database: {q.database}</Tag>
                                        <Tag color="green">Collection: {q.collection}</Tag>
                                        <Tag color="purple">Operation: {q.operation}</Tag>
                                        <Tag color="orange">Duration: {q.duration}ms</Tag>
                                        <Tag color="cyan">Client: {q.client}</Tag>
                                        {q.isTruncated && (
                                            <Tag color="red">Truncated Query</Tag>
                                        )}
                                        {/* Add sanitized tag and size info */}
                                        {!q.isTruncated && (
                                            <>
                                                <Tag color="green">Sanitized</Tag>
                                                <Tag color="blue">Size: {(q.sanitizedQuery.length / 1024).toFixed(1)} KB</Tag>
                                            </>
                                        )}
                                    </div>
                                    
                                    {/* CSS for syntax highlighting */}
                                    <style dangerouslySetInnerHTML={{ __html: `
                                        .json-container {
                                            background-color: #f5f5f5;
                                            padding: 10px;
                                            border-radius: 4px;
                                            max-height: 400px;
                                            overflow: auto;
                                            font-size: 14px;
                                            line-height: 1.5;
                                            font-family: Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace;
                                            white-space: pre-wrap;
                                            word-break: break-word;
                                            margin-bottom: 16px;
                                        }
                                        .json-container .string { color: #22863a; }
                                        .json-container .number { color: #005cc5; }
                                        .json-container .boolean { color: #005cc5; }
                                        .json-container .null { color: #005cc5; }
                                        .json-container .key { color: #d73a49; }
                                    `}} />

                                    {/* Use syntax highlighting for the query */}
                                    <div 
                                        className="json-container"
                                        dangerouslySetInnerHTML={{ __html: q.isTruncated 
                                            ? q.query 
                                            : syntaxHighlight(q.sanitizedQuery) 
                                        }}
                                    />

                                    <div style={{ display: 'flex', gap: '8px' }}>
                                    <Button 
                                        type="primary"
                                        onClick={() => {
                                                navigator.clipboard.writeText(q.sanitizedQuery || q.query);
                                                message.success('Query copied to clipboard');
                                        }}
                                        icon={<CopyOutlined />}
                                    >
                                        Copy Query
                                    </Button>
                                        
                                        {/* Explain button for non-truncated queries */}
                                        {!q.isTruncated && agentId && q.database !== 'N/A' && (
                                            <Button
                                                type="primary"
                                                style={{ backgroundColor: '#722ed1', borderColor: '#722ed1' }}
                                                icon={<DatabaseOutlined />}
                                                onClick={() => {
                                                    // Update state for future reference
                                                    setCurrentMongoQuery({
                                                        query: q.sanitizedQuery,
                                                        database: q.database,
                                                        agentId: agentId
                                                    });
                                                    
                                                    // Directly call fetchMongoExplain with the parameters instead of waiting for state update
                                                    fetchMongoExplain({
                                                        query: q.sanitizedQuery,
                                                        database: q.database,
                                                        agentId: agentId
                                                    });
                                                    // Modal will be handled by the fetchMongoExplain function
                                                }}
                                                loading={mongoExplainLoading && currentMongoQuery?.query === q.sanitizedQuery}
                                            >
                                                Explain Query
                                            </Button>
                                        )}

                                        {/* AI Analysis button */}
                                        {!q.isTruncated && (
                                            <Button
                                                type="primary" 
                                                onClick={() => handleQueryAIAnalysis(q.sanitizedQuery)}
                                                icon={<RobotOutlined />}
                                            >
                                                Analyze with AI
                                            </Button>
                                        )}
                                    </div>
                                    
                                    {/* Warning for truncated queries */}
                                    {q.isTruncated && (
                                        <Alert
                                            message="Query is truncated"
                                            description="This query was truncated in the logs. Analysis and explanation features are unavailable."
                                            type="warning"
                                            showIcon
                                            style={{ marginTop: '16px' }}
                                        />
                                    )}
                                </Tabs.TabPane>
                            ))}
                        </Tabs>
                    </div>
                ),
                okText: 'Close'
            });
        } catch (error) {
            console.error('Error showing MongoDB query:', error);
            message.error('Failed to parse MongoDB query');
        }
    };

    // Add parameter form modal
    const renderParameterForm = () => {
        if (!currentQueryDetails) return null;

        const parameters = extractQueryParameters(currentQueryDetails.query);
        if (parameters.length === 0) return null;

        return (
            <Modal
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <InfoCircleOutlined style={{ color: '#1890ff', fontSize: '18px' }} />
                        <span>Query Parameters Required</span>
                    </div>
                }
                open={showParamForm}
                onCancel={() => {
                    setShowParamForm(false);
                    // Show a message to indicate the operation was cancelled
                    message.info('Parameter input cancelled');
                }}
                onOk={handleParamSubmit}
                width={700}
                okText="Execute Explain"
                cancelText="Cancel"
                maskClosable={false}
                zIndex={9999} // Extremely high z-index to ensure it's always on top
                bodyStyle={{ maxHeight: '70vh', overflow: 'auto' }}
                style={{ top: '50px' }}
                keyboard={true} // Allow ESC key to close the modal
                closable={true} // Ensure the X button is visible
                destroyOnClose={true} // Clean up the DOM when closed
                maskStyle={{ backgroundColor: 'rgba(0, 0, 0, 0.65)' }} // Darker mask for better visibility
            >
                <Alert
                    message="Parameter Values Needed"
                    description="This query contains parameters ($1, $2, etc.) that need values before it can be executed. Please provide a value for each parameter below."
                    type="info"
                    showIcon
                    style={{ marginBottom: '16px' }}
                />
                
                <div style={{
                    backgroundColor: '#f5f5f5',
                    padding: '16px',
                    borderRadius: '4px',
                    marginBottom: '16px',
                    position: 'relative',
                    border: '1px solid #d9d9d9'
                }}>
                    <div style={{ 
                        position: 'absolute', 
                        top: '8px', 
                        right: '8px', 
                        backgroundColor: '#1890ff',
                        color: 'white',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '12px'
                    }}>
                        Original Query
                    </div>
                    <pre style={{ 
                        margin: 0,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        maxHeight: '200px',
                        overflow: 'auto',
                        paddingTop: '20px'
                    }}>
                        {currentQueryDetails.query}
                    </pre>
                </div>

                <div style={{ 
                    marginBottom: '8px', 
                    fontWeight: 'bold',
                    fontSize: '16px',
                    color: '#000000d9'
                }}>Parameter Values:</div>
                <Form layout="vertical">
                    {parameters.map((param) => (
                        <Form.Item
                            key={param}
                            label={
                                <span>
                                    Parameter {param}
                                    <Tooltip title="For array values, use square brackets: [1,2,3]. For strings, no need to add quotes - they will be added automatically.">
                                        <InfoCircleOutlined style={{ marginLeft: '8px' }} />
                                    </Tooltip>
                                </span>
                            }
                            required
                        >
                            <Input
                                value={paramValues[param] || ''}
                                onChange={(e) => setParamValues(prev => ({
                                    ...prev,
                                    [param]: e.target.value
                                }))}
                                placeholder="Enter value (use [1,2,3] for arrays)"
                                status={!paramValues[param] ? "error" : ""}
                                autoFocus={param === parameters[0]} // Focus on the first parameter input
                            />
                        </Form.Item>
                    ))}
                </Form>

                <div style={{
                    marginTop: '16px',
                    padding: '12px',
                    backgroundColor: '#f6ffed',
                    border: '1px solid #b7eb8f',
                    borderRadius: '4px'
                }}>
                    <strong>Example values:</strong>
                    <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
                        <li>For strings: <code>test</code> or <code>John Doe</code> (quotes added automatically)</li>
                        <li>For numbers: <code>42</code> or <code>3.14</code></li>
                        <li>For arrays: <code>[1,2,3]</code> or <code>['a','b','c']</code></li>
                        <li>For null: <code>NULL</code> or empty</li>
                    </ul>
                </div>
            </Modal>
        );
    };

    // Function to parse MongoDB explain plan
    const parseMongoExplainPlan = (plan: string): { queryPlanner: MongoPlanStats, executionStats: MongoPlanStats, serverInfo: any } | null => {
        try {
            // Validate input
            if (!plan || typeof plan !== 'string' || plan.trim() === '') {
                console.warn('Empty or invalid plan string:', plan);
                return null;
            }
            
            // Try to parse the plan string
            let planObj;
            try {
                planObj = JSON.parse(plan);
            } catch (parseError) {
                console.error('Error parsing MongoDB plan JSON:', parseError);
                // Try to parse by extracting JSON portions using regex
                const jsonMatch = plan.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    try {
                        planObj = JSON.parse(jsonMatch[0]);
                    } catch (e) {
                        console.error('Failed to extract and parse JSON from string:', e);
                        return null;
                    }
                } else {
                    return null;
                }
            }
            
            // Check if plan is already parsed JSON object
            if (typeof planObj === 'object' && planObj !== null) {
                // Extract sections from the plan
                let queryPlanner = null;
                let executionStats = null;
                let serverInfo = null;
                
                // Parse explanation based on format
                if (planObj.plan && typeof planObj.plan === 'string') {
                    // The plan is a string that needs to be parsed
                    // Use regex to extract sections from Markdown format
                    const queryPlannerMatch = planObj.plan.match(/## Query Planner\s*\n(\{[\s\S]*?\})\s*\n\s*##/);
                    const executionStatsMatch = planObj.plan.match(/## Execution Stats\s*\n(\{[\s\S]*?\})\s*\n\s*##/);
                    const serverInfoMatch = planObj.plan.match(/## Server Info\s*\n(\{[\s\S]*?\})/);
                    
                    if (queryPlannerMatch && queryPlannerMatch[1]) {
                        try {
                            queryPlanner = JSON.parse(queryPlannerMatch[1]);
                        } catch (e) {
                            console.error('Error parsing query planner:', e);
                        }
                    }
                    
                    if (executionStatsMatch && executionStatsMatch[1]) {
                        try {
                            executionStats = JSON.parse(executionStatsMatch[1]);
                        } catch (e) {
                            console.error('Error parsing execution stats:', e);
                        }
                    }
                    
                    if (serverInfoMatch && serverInfoMatch[1]) {
                        try {
                            serverInfo = JSON.parse(serverInfoMatch[1]);
                        } catch (e) {
                            console.error('Error parsing server info:', e);
                        }
                    }
                } else if (planObj.queryPlanner || planObj.executionStats) {
                    // This is already in the expected format
                    queryPlanner = planObj.queryPlanner;
                    executionStats = planObj.executionStats;
                    serverInfo = planObj.serverInfo;
                }
                
                // Create default structures for missing parts
                const defaultQueryPlanner = { 
                    totalKeysExamined: 0, 
                    totalDocsExamined: 0, 
                    executionTimeMillis: 0, 
                    nReturned: 0,
                    namespace: 'Unknown',
                    indexFilterSet: false,
                    parsedQuery: {},
                    winningPlan: { 
                        stage: 'UNKNOWN',
                        filter: {},
                        inputStage: undefined
                    },
                    rejectedPlans: []
                };
                
                const defaultExecutionStats = {
                    executionTimeMillis: 0,
                    nReturned: 0,
                    totalDocsExamined: 0,
                    totalKeysExamined: 0,
                    executionStages: {
                        stage: 'UNKNOWN',
                        nReturned: 0,
                        executionTimeMillisEstimate: 0 
                    }
                };
                
                // Ensure required properties exist in queryPlanner
                if (queryPlanner && !queryPlanner.winningPlan) {
                    queryPlanner.winningPlan = { stage: 'UNKNOWN' };
                }
                
                if (queryPlanner && !queryPlanner.rejectedPlans) {
                    queryPlanner.rejectedPlans = [];
                }
                
                return {
                    queryPlanner: queryPlanner || defaultQueryPlanner,
                    executionStats: executionStats || defaultExecutionStats,
                    serverInfo: serverInfo || {}
                };
            }
            
            return null;
        } catch (error) {
            console.error('Error parsing MongoDB explain plan:', error);
            return null;
        }
    };

    // Function to get node color based on performance
    const getMongoNodeColor = (node: MongoPlanNode): string => {
        if (!node) return '#1890ff';
        
        // If execution time is available, use it
        if (node.executionTimeMillisEstimate) {
            if (node.executionTimeMillisEstimate > 100) return '#ff4d4f'; // Very slow
            if (node.executionTimeMillisEstimate > 50) return '#faad14'; // Slow
            if (node.executionTimeMillisEstimate > 10) return '#52c41a'; // Normal
            return '#1890ff'; // Fast
        }
        
        // If keys examined vs. docs returned ratio is available
        if (node.keysExamined && node.nReturned) {
            const ratio = node.keysExamined / Math.max(node.nReturned, 1);
            if (ratio > 100) return '#ff4d4f'; // Very inefficient
            if (ratio > 10) return '#faad14'; // Inefficient
            return '#52c41a'; // Efficient
        }
        
        // Default color
        return '#1890ff';
    };

    // Function to render a MongoDB plan node
    const renderMongoPlanNode = (node: MongoPlanNode, depth: number = 0, index: number = 0, executionStats?: any): React.ReactNode => {
        if (!node) return null;
        
        const nodeColor = getMongoNodeColor(node);

        // Find execution data for this stage if available
        const stageExecutionData = findExecutionDataForStage(node, executionStats);
        
        return (
            <div key={`${depth}-${index}`} style={{ marginLeft: depth * 24, marginBottom: '12px' }}>
                <Card
                    size="small"
                    title={
                        <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            fontSize: '12px'
                        }}>
                            <span>
                                <b>{node.stage}</b>
                                {node.indexName && <span> ({node.indexName})</span>}
                            </span>
                            {stageExecutionData?.executionTimeMillisEstimate !== undefined && (
                                <Tag color={nodeColor}>
                                    {stageExecutionData.executionTimeMillisEstimate}ms
                                </Tag>
                            )}
                        </div>
                    }
                    style={{ 
                        maxWidth: '100%',
                        borderTop: `2px solid ${nodeColor}`,
                        boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                    }}
                    headStyle={{ padding: '0 12px', minHeight: '32px' }}
                    bodyStyle={{ padding: '12px' }}
                >
                    <Tabs size="small" type="card">
                        <TabPane tab="Details" key="details">
                            <div style={{ fontSize: '12px' }}>
                                {/* Keys & Docs */}
                                {((stageExecutionData && (
                                    stageExecutionData.keysExamined !== undefined || 
                                    stageExecutionData.docsExamined !== undefined
                                  )) || 
                                  node.keysExamined !== undefined || 
                                  node.docsExamined !== undefined) && (
                                    <div style={{ marginBottom: '8px' }}>
                                        {((stageExecutionData && stageExecutionData.keysExamined !== undefined) || 
                                          node.keysExamined !== undefined) && (
                                            <div>Keys Examined: <b>{stageExecutionData?.keysExamined || node.keysExamined || 0}</b></div>
                                        )}
                                        {((stageExecutionData && stageExecutionData.docsExamined !== undefined) || 
                                          node.docsExamined !== undefined) && (
                                            <div>Docs Examined: <b>{stageExecutionData?.docsExamined || node.docsExamined || 0}</b></div>
                                        )}
                                        {((stageExecutionData && stageExecutionData.nReturned !== undefined) || 
                                          node.nReturned !== undefined) && (
                                            <div>Returned: <b>{stageExecutionData?.nReturned || node.nReturned || 0}</b></div>
                                        )}
                                    </div>
                                )}
                                
                                {/* Work metrics */}
                                {((stageExecutionData && (
                                    stageExecutionData.works !== undefined || 
                                    stageExecutionData.advanced !== undefined || 
                                    stageExecutionData.needTime !== undefined
                                  )) || 
                                  node.works !== undefined || 
                                  node.advanced !== undefined || 
                                  node.needTime !== undefined) && (
                                    <div style={{ marginBottom: '8px' }}>
                                        {((stageExecutionData && stageExecutionData.works !== undefined) || 
                                          node.works !== undefined) && (
                                            <div>Works: <b>{stageExecutionData?.works || node.works || 0}</b></div>
                                        )}
                                        {((stageExecutionData && stageExecutionData.advanced !== undefined) || 
                                          node.advanced !== undefined) && (
                                            <div>Advanced: <b>{stageExecutionData?.advanced || node.advanced || 0}</b></div>
                                        )}
                                        {((stageExecutionData && stageExecutionData.needTime !== undefined) || 
                                          node.needTime !== undefined) && (
                                            <div>Need Time: <b>{stageExecutionData?.needTime || node.needTime || 0}</b></div>
                                        )}
                                    </div>
                                )}
                                
                                {/* If there's no data, show a message */}
                                {(!stageExecutionData || 
                                   (stageExecutionData.keysExamined === undefined && 
                                    stageExecutionData.docsExamined === undefined && 
                                    stageExecutionData.works === undefined)) && 
                                  (node.keysExamined === undefined && 
                                   node.docsExamined === undefined && 
                                   node.works === undefined) && (
                                    <div>No detailed metrics available</div>
                                )}
                            </div>
                        </TabPane>
                        
                        {/* Show filter tab if filter exists */}
                        {(node.filter || (stageExecutionData && stageExecutionData.filter)) && (
                            <TabPane tab="Filter" key="filter">
                                <div style={{ 
                                    fontSize: '12px', 
                                    fontFamily: 'monospace',
                                    backgroundColor: '#f5f5f5',
                                    padding: '8px',
                                    borderRadius: '4px',
                                    maxHeight: '100px',
                                    overflow: 'auto'
                                }}>
                                    <pre>{JSON.stringify(node.filter || (stageExecutionData && stageExecutionData.filter), null, 2)}</pre>
                                </div>
                            </TabPane>
                        )}
                        
                        {/* Show index tab if index info exists */}
                        {node.indexName && (
                            <TabPane tab="Index" key="index">
                                <div style={{ fontSize: '12px' }}>
                                    <div>Name: <b>{node.indexName}</b></div>
                                    {node.direction && <div>Direction: <b>{node.direction}</b></div>}
                                    {node.isMultiKey !== undefined && <div>Multi Key: <b>{node.isMultiKey ? 'Yes' : 'No'}</b></div>}
                                    {node.isSparse !== undefined && <div>Sparse: <b>{node.isSparse ? 'Yes' : 'No'}</b></div>}
                                    {node.isPartial !== undefined && <div>Partial: <b>{node.isPartial ? 'Yes' : 'No'}</b></div>}
                                    {node.isUnique !== undefined && <div>Unique: <b>{node.isUnique ? 'Yes' : 'No'}</b></div>}
                                    {node.indexVersion !== undefined && <div>Version: <b>{node.indexVersion}</b></div>}
                                    
                                    {node.keyPattern && (
                                        <div style={{ marginTop: '8px' }}>
                                            <div>Key Pattern:</div>
                                            <pre style={{ 
                                                margin: '4px 0 0 0',
                                                background: '#f5f5f5',
                                                padding: '4px',
                                                borderRadius: '4px',
                                                maxHeight: '60px',
                                                overflow: 'auto'
                                            }}>
                                                {JSON.stringify(node.keyPattern, null, 2)}
                                            </pre>
                                        </div>
                                    )}
                                    
                                    {node.indexBounds && (
                                        <div style={{ marginTop: '8px' }}>
                                            <div>Index Bounds:</div>
                                            <pre style={{ 
                                                margin: '4px 0 0 0',
                                                background: '#f5f5f5',
                                                padding: '4px',
                                                borderRadius: '4px',
                                                maxHeight: '60px',
                                                overflow: 'auto'
                                            }}>
                                                {JSON.stringify(node.indexBounds, null, 2)}
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            </TabPane>
                        )}
                    </Tabs>
                </Card>
                
                {/* Render child nodes */}
                {node.inputStage && renderMongoPlanNode(node.inputStage, depth + 1, 0, executionStats)}
                
                {node.inputStages && node.inputStages.map((stage, i) => 
                    renderMongoPlanNode(stage, depth + 1, i, executionStats)
                )}
            </div>
        );
    };

    // Function to find execution data for a plan stage
    const findExecutionDataForStage = (node: MongoPlanNode, executionStats: any): any => {
        if (!executionStats) return null;
        
        // Check if executionStages property exists and matches our node
        if (executionStats.executionStages && executionStats.executionStages.stage === node.stage) {
            // If indexName matches or they're both FETCH/IXSCAN etc.
            const stageMatches = executionStats.executionStages.stage === node.stage; 
            const indexMatches = 
                (!executionStats.executionStages.indexName && !node.indexName) || 
                (executionStats.executionStages.indexName === node.indexName);
            
            if (stageMatches && indexMatches) {
                return executionStats.executionStages;
            }
            
            // Check if input stage matches
            if (node.inputStage && executionStats.executionStages.inputStage) {
                const inputStageMatches = executionStats.executionStages.inputStage.stage === node.inputStage.stage;
                const inputIndexMatches = 
                    (!executionStats.executionStages.inputStage.indexName && !node.inputStage.indexName) || 
                    (executionStats.executionStages.inputStage.indexName === node.inputStage.indexName);
                
                if (inputStageMatches && inputIndexMatches) {
                    return executionStats.executionStages.inputStage;
                }
            }
        }
        
        // Check in allPlansExecution if present
        if (executionStats.allPlansExecution && Array.isArray(executionStats.allPlansExecution)) {
            for (const planExecution of executionStats.allPlansExecution) {
                if (planExecution && planExecution.executionStages) {
                    // Check if this execution stage matches our node
                    if (planExecution.executionStages.stage === node.stage) {
                        const stageMatches = planExecution.executionStages.stage === node.stage;
                        const indexMatches = 
                            (!planExecution.executionStages.indexName && !node.indexName) || 
                            (planExecution.executionStages.indexName === node.indexName);
                        
                        if (stageMatches && indexMatches) {
                            return planExecution.executionStages;
                        }
                        
                        // Check input stage
                        if (node.inputStage && planExecution.executionStages.inputStage) {
                            const inputStageMatches = planExecution.executionStages.inputStage.stage === node.inputStage.stage;
                            const inputIndexMatches = 
                                (!planExecution.executionStages.inputStage.indexName && !node.inputStage.indexName) || 
                                (planExecution.executionStages.inputStage.indexName === node.inputStage.indexName);
                            
                            if (inputStageMatches && inputIndexMatches) {
                                return planExecution.executionStages.inputStage;
                            }
                        }
                    }
                }
            }
        }
        
        return null;
    };

    // MongoDB Explain Results Modal
    const renderMongoExplainModal = () => {
        // Parse the plan data
        let parsedPlan = null;
        let rawPlan = mongoExplainResults || "";
        
        // Raw Plan AI Analysis function
        const handleRawPlanAIAnalysis = async () => {
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
                    title: 'AI Query Plan Analysis',
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
                                AI is analyzing your query plan...
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
                            content: `can you analyze this mongodb raw query plan? Please provide insights about the performance and any improvement recommendations. Organize your response with sections for identified issues and specific recommendations.

If there are performance problems, please suggest indexes that would improve the query using proper MongoDB syntax.

Raw Plan:
${rawPlan}`
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
                            AI Query Plan Analysis Results
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
                message.error('Failed to analyze query plan with AI');
            }
        };
        
        try {
            // Only try to parse if we have results
            if (!mongoExplainResults || mongoExplainResults.trim() === '') {
                return (
                    <Modal
                        title="MongoDB Query Execution Plan"
                        open={mongoExplainModalVisible}
                        onCancel={() => setMongoExplainModalVisible(false)}
                        width={1000}
                        footer={[
                            <Button key="close" onClick={() => setMongoExplainModalVisible(false)}>
                                Close
                            </Button>
                        ]}
                    >
                        <Alert
                            message="No plan data available"
                            description="Please run an explain query first."
                            type="info"
                            showIcon
                        />
                    </Modal>
                );
            }
            
            // Parse the main response object
            const planData = JSON.parse(mongoExplainResults);
            
            if (planData.plan && typeof planData.plan === 'string') {
                // Extract the raw plan text
                rawPlan = planData.plan;
                
                // Split the text by markdown section headers
                const sections = planData.plan.split(/##\s+/);
                
                // Process each section to extract JSON objects
                let queryPlannerData = null;
                let executionStatsData = null;
                let serverInfoData = null;
                
                for (const section of sections) {
                    if (!section.trim()) continue;
                    
                    // Extract Query Planner section
                    if (section.startsWith('Query Planner')) {
                        try {
                            const jsonText = section.replace('Query Planner', '').trim();
                            const jsonStart = jsonText.indexOf('{');
                            if (jsonStart >= 0) {
                                const jsonContent = jsonText.substring(jsonStart);
                                queryPlannerData = JSON.parse(jsonContent);
                            }
                        } catch (error) {
                            console.error('Error parsing Query Planner section:', error);
                        }
                    } 
                    // Extract Execution Stats section
                    else if (section.startsWith('Execution Stats')) {
                        try {
                            const jsonText = section.replace('Execution Stats', '').trim();
                            const jsonStart = jsonText.indexOf('{');
                            if (jsonStart >= 0) {
                                const jsonContent = jsonText.substring(jsonStart);
                                executionStatsData = JSON.parse(jsonContent);
                            }
                        } catch (error) {
                            console.error('Error parsing Execution Stats section:', error);
                        }
                    } 
                    // Extract Server Info section
                    else if (section.startsWith('Server Info')) {
                        try {
                            const jsonText = section.replace('Server Info', '').trim();
                            const jsonStart = jsonText.indexOf('{');
                            if (jsonStart >= 0) {
                                const jsonContent = jsonText.substring(jsonStart);
                                serverInfoData = JSON.parse(jsonContent);
                            }
                        } catch (error) {
                            console.error('Error parsing Server Info section:', error);
                        }
                    }
                }
                
                // If we have successfully parsed sections, create the plan object
                if (queryPlannerData || executionStatsData) {
                    parsedPlan = {
                        queryPlanner: queryPlannerData || { 
                            namespace: 'Unknown',
                            winningPlan: { stage: 'UNKNOWN' },
                            rejectedPlans: []
                        },
                        executionStats: executionStatsData || {
                            executionTimeMillis: 0,
                            nReturned: 0,
                            totalDocsExamined: 0,
                            totalKeysExamined: 0
                        },
                        serverInfo: serverInfoData || {}
                    };
                    
                }
            }
            
            // If parsing failed or no sections were found, try directly using the object
            if (!parsedPlan && planData.queryPlanner) {
                parsedPlan = planData;
            }
            
            // If still no parsedPlan, create a minimal structure
            if (!parsedPlan) {
                parsedPlan = {
                    queryPlanner: { 
                        namespace: 'Unknown',
                        indexFilterSet: false,
                        parsedQuery: {},
                        winningPlan: {
                            stage: 'UNKNOWN',
                            filter: {} as any,
                            inputStage: undefined as any
                        },
                        rejectedPlans: []
                    },
                    executionStats: {
                        executionTimeMillis: 0,
                        nReturned: 0,
                        totalDocsExamined: 0,
                        totalKeysExamined: 0
                    },
                    serverInfo: {}
                };
            }
        } catch (e) {
            console.error('Error parsing MongoDB plan:', e);
            
            // Provide a fallback empty structure
            parsedPlan = {
                queryPlanner: { 
                    namespace: 'Unknown',
                    winningPlan: {
                        stage: 'UNKNOWN'
                    },
                    rejectedPlans: []
                },
                executionStats: {
                    executionTimeMillis: 0,
                    nReturned: 0,
                    totalDocsExamined: 0,
                    totalKeysExamined: 0
                },
                serverInfo: {}
            };
        }
        
        return (
            <Modal
                title="MongoDB Query Execution Plan"
                open={mongoExplainModalVisible}
                onCancel={() => setMongoExplainModalVisible(false)}
                width={1000}
                footer={[
                    <Button key="close" onClick={() => setMongoExplainModalVisible(false)}>
                        Close
                    </Button>,
                                            <Button 
                        key="copy" 
                                                type="primary"
                                                onClick={() => {
                            navigator.clipboard.writeText(mongoExplainResults);
                            message.success('Execution plan copied to clipboard');
                                                }}
                                            >
                        Copy to Clipboard
                                            </Button>
                ]}
            >
                <Tabs defaultActiveKey="visual">
                    <TabPane tab="Visualization" key="visual">
                        {parsedPlan ? (
                            <div>
                                {/* Summary Section */}
                                <div style={{ marginBottom: '24px' }}>
                                    <h3>Query Summary</h3>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                                        <Card size="small" style={{ width: 200 }}>
                                            <Statistic
                                                title="Execution Time"
                                                value={parsedPlan?.executionStats?.executionTimeMillis || 0}
                                                suffix="ms"
                                                valueStyle={{ color: getMongoNodeColor({ 
                                                    stage: 'TOTAL', 
                                                    executionTimeMillisEstimate: parsedPlan?.executionStats?.executionTimeMillis || 0
                                                }) }}
                                            />
                                        </Card>
                                        <Card size="small" style={{ width: 200 }}>
                                            <Statistic
                                                title="Documents Examined"
                                                value={parsedPlan?.executionStats?.totalDocsExamined || 0}
                                            />
                                        </Card>
                                        <Card size="small" style={{ width: 200 }}>
                                            <Statistic
                                                title="Keys Examined"
                                                value={parsedPlan?.executionStats?.totalKeysExamined || 0}
                                            />
                                        </Card>
                                        <Card size="small" style={{ width: 200 }}>
                                            <Statistic
                                                title="Documents Returned"
                                                value={parsedPlan?.executionStats?.nReturned || 0}
                                            />
                                        </Card>
                                    </div>
                                    
                                    {/* Collection information */}
                                    {parsedPlan?.queryPlanner?.namespace && (
                                        <Alert
                                            message={`Collection: ${parsedPlan.queryPlanner.namespace}`}
                                            type="info"
                                            showIcon
                                            style={{ marginTop: '12px' }}
                                        />
                                    )}
                                </div>
                                
                                {/* Query Plan Tree */}
                                <div>
                                    <h3>Winning Plan</h3>
                                    {parsedPlan?.queryPlanner?.winningPlan ? (
                                        <div style={{ marginBottom: '24px' }}>
                                            {renderMongoPlanNode(parsedPlan.queryPlanner.winningPlan, 0, 0, parsedPlan.executionStats)}
                                        </div>
                                    ) : (
                                    <Alert
                                            message="No winning plan data available"
                                            type="warning"
                                            showIcon
                                        />
                                    )}
                                </div>
                                
                                {/* Rejected Plans */}
                                {parsedPlan?.queryPlanner?.rejectedPlans && parsedPlan.queryPlanner.rejectedPlans.length > 0 && (
                                    <div>
                                        <h3>Rejected Plans</h3>
                                        <Collapse ghost>
                                            {parsedPlan.queryPlanner.rejectedPlans.map((plan: MongoPlanNode, index: number) => (
                                                <Collapse.Panel
                                                    key={index}
                                                    header={`Rejected Plan ${index + 1}`}
                                                >
                                                    {renderMongoPlanNode(plan, 0, index, parsedPlan.executionStats)}
                                                </Collapse.Panel>
                                            ))}
                                        </Collapse>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <Alert
                                message="Could not parse plan for visualization"
                                description="The plan data could not be parsed for visual representation. Please check the raw plan tab for details."
                                type="warning"
                                showIcon
                            />
                        )}
                    </TabPane>
                    
                    <TabPane tab="Raw Plan" key="raw">
                        <div>
                            <div style={{ marginBottom: '16px' }}>
                                <Button 
                                    type="primary"
                                    icon={<RobotOutlined />}
                                    onClick={handleRawPlanAIAnalysis}
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
                                fontSize: '14px',
                                lineHeight: '1.5',
                                fontFamily: 'Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace'
                            }}>
                                {rawPlan}
                            </pre>
                        </div>
                    </TabPane>
                </Tabs>
            </Modal>
        );
    };

    // Function to handle showing MSSQL blocking query details
    const handleShowMssqlBlockingQuery = (messageText: string, type: string, database?: string, agentId?: string) => {
        try {
            // Extract threshold and max wait time from the first line
            const headerMatch = messageText.match(/Found (\d+) blocking queries .* threshold\. Max wait time: ([\d.]+) seconds/);
            const blockingCount = headerMatch ? headerMatch[1] : '0';
            const maxWaitTime = headerMatch ? headerMatch[2] : 'N/A';
            
            // Parse individual blocked and blocker pairs
            const blockedMatch = messageText.match(/Blocked: SessionID=(\d+), Login=([^,]+), DB=([^,]+), Wait=([\d.]+)s, Query=(.+?)(?=\nBlocker:|$)/s);
            const blockerMatch = messageText.match(/Blocker: SessionID=(\d+), Login=([^,]+), Query=(.+?)(?=\n|$)/s);
            
            if (!blockedMatch) {
                message.error('Could not parse blocked query details');
                return;
            }
            
            // Extract blocked query details
            const blockedSession = {
                sessionId: blockedMatch[1] || '',
                login: blockedMatch[2] || '',
                database: blockedMatch[3] || database || '',
                waitTime: blockedMatch[4] || '',
                query: blockedMatch[5] || ''
            };
            
            // Extract blocker query details (might be incomplete)
            const blockerSession = blockerMatch ? {
                sessionId: blockerMatch[1] || '',
                login: blockerMatch[2] || '',
                query: blockerMatch[3] || 'unknown'
            } : {
                sessionId: 'unknown',
                login: 'unknown',
                query: 'unknown'
            };

            Modal.info({
                title: 'SQL Server Blocking Session',
                width: 900,
                content: (
                    <div>
                        <Alert
                            message={`Found ${blockingCount} blocking queries (Max Wait Time: ${maxWaitTime} seconds)`}
                            type="warning"
                            showIcon
                            style={{ marginBottom: '16px' }}
                        />
                        
                        <div style={{ marginBottom: '24px' }}>
                            <h3>Blocked Session</h3>
                            <Card>
                                <div style={{ marginBottom: '16px' }}>
                                    <Tag color="blue">Session ID: {blockedSession.sessionId}</Tag>
                                    <Tag color="green">Login: {blockedSession.login}</Tag>
                                    <Tag color="purple">Database: {blockedSession.database}</Tag>
                                    <Tag color="red">Wait Time: {blockedSession.waitTime}s</Tag>
                                </div>
                                
                                {/* CSS for syntax highlighting */}
                                <style dangerouslySetInnerHTML={{ __html: `
                                    .sql-container {
                                        background-color: #f5f5f5;
                                        padding: 10px;
                                        border-radius: 4px;
                                        max-height: 200px;
                                        overflow: auto;
                                        font-size: 14px;
                                        line-height: 1.5;
                                        font-family: Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace;
                                        white-space: pre-wrap;
                                        word-break: break-word;
                                        margin-bottom: 16px;
                                    }
                                `}} />
                                
                                <div className="sql-container">
                                    {blockedSession.query}
                                </div>
                                
                                <Space>
                                    <Button 
                                        type="primary"
                                        onClick={() => {
                                            navigator.clipboard.writeText(blockedSession.query);
                                            message.success('Query copied to clipboard');
                                        }}
                                        icon={<CopyOutlined />}
                                    >
                                        Copy Query
                                    </Button>
                                    
                                    <Button 
                                        type="primary"
                                        onClick={() => handleQueryAIAnalysis(blockedSession.query, 'mssql')}
                                        icon={<RobotOutlined />}
                                        style={{ backgroundColor: '#cc2927', borderColor: '#cc2927' }}
                                    >
                                        Analyze With AI
                                    </Button>
                                    
                                    {agentId && (
                                        <Button 
                                            type="primary"
                                            onClick={() => fetchExecutionPlan(blockedSession.query, blockedSession.database, agentId)}
                                            icon={<LineChartOutlined />}
                                            style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
                                        >
                                            Execution Plan
                                        </Button>
                                    )}
                                </Space>
                            </Card>
                        </div>
                        
                        <div>
                            <h3>Blocking Session</h3>
                            <Card>
                                <div style={{ marginBottom: '16px' }}>
                                    <Tag color="blue">Session ID: {blockerSession.sessionId}</Tag>
                                    <Tag color="green">Login: {blockerSession.login}</Tag>
                                </div>
                                
                                <Alert
                                    message="Blocking Query"
                                    description={
                                        blockerSession.query === 'unknown' ? 
                                            "The blocking query text is not available. This might be because the session is idle or the query has completed execution but hasn't released its locks." :
                                            <div className="sql-container">{blockerSession.query}</div>
                                    }
                                    type="info"
                                    showIcon
                                    style={{ marginBottom: '16px' }}
                                />
                                
                                {blockerSession.query !== 'unknown' && (
                                    <Space>
                                        <Button 
                                            type="primary"
                                            onClick={() => {
                                                navigator.clipboard.writeText(blockerSession.query);
                                                message.success('Query copied to clipboard');
                                            }}
                                            icon={<CopyOutlined />}
                                        >
                                            Copy Query
                                        </Button>
                                        
                                        <Button 
                                            type="primary"
                                            onClick={() => handleQueryAIAnalysis(blockerSession.query, 'mssql')}
                                            icon={<RobotOutlined />}
                                            style={{ backgroundColor: '#cc2927', borderColor: '#cc2927' }}
                                        >
                                            Analyze With AI
                                        </Button>
                                        
                                        {agentId && (
                                            <Button 
                                                type="primary"
                                                onClick={() => fetchExecutionPlan(blockerSession.query, database || '', agentId)}
                                                icon={<LineChartOutlined />}
                                                style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
                                            >
                                                Execution Plan
                                            </Button>
                                        )}
                                    </Space>
                                )}
                            </Card>
                        </div>
                    </div>
                ),
                okText: 'Close'
            });
        } catch (error) {
            console.error('Error showing MSSQL blocking query:', error);
            message.error('Failed to parse MSSQL blocking query details');
        }
    };

    // Function to handle showing MSSQL deadlock query details
    const handleShowMssqlDeadlock = (messageText: string, xmlDeadlock: string, database?: string, agentId?: string) => {
        try {
            // Check if the XML is compressed (it should be base64 data without prefix now)
            if (!xmlDeadlock.startsWith('<')) {
                try {
                    const decodedXml = decodeCompressedBase64(xmlDeadlock);
                    xmlDeadlock = decodedXml;
                } catch (error) {
                    message.error('Failed to decode deadlock graph data');
                    console.error('Deadlock decode error:', error);
                    return;
                }
            }

            // Extract deadlock count and time from the message
            const headerMatch = messageText.match(/Found (\d+) deadlocks?.* on ([^:]+):/);
            // If the header match doesn't work, try to extract date from the XML
            const deadlockCount = headerMatch ? headerMatch[1] : '1';
            let deadlockDate = headerMatch ? headerMatch[2].trim() : '';
            
            // If no date from header, try to extract from XML timestamp
            if (!deadlockDate) {
                const timestampMatch = xmlDeadlock.match(/timestamp="([^"]+)"/);
                if (timestampMatch && timestampMatch[1]) {
                    // Format timestamp from 2025-05-12T19:27:00.546Z to readable date
                    try {
                        const date = new Date(timestampMatch[1]);
                        deadlockDate = date.toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        });
                    } catch (e) {
                        deadlockDate = timestampMatch[1];
                    }
                }
            }
            
            // Fallback if still no date
            if (!deadlockDate) {
                deadlockDate = new Date().toLocaleDateString('en-US');
            }
            
            // Parse the XML to extract victim process and deadlock participants
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlDeadlock, "text/xml");
            
            // Get the victim process ID
            const victimProcessNode = xmlDoc.querySelector('victim-list victimProcess');
            const victimProcessId = victimProcessNode?.getAttribute('id') || '';
            
            // Get all participating processes
            const processNodes = xmlDoc.querySelectorAll('process-list process');
            const processes = Array.from(processNodes).map(processNode => {
                const id = processNode.getAttribute('id') || '';
                const spid = processNode.getAttribute('spid') || '';
                const status = processNode.getAttribute('status') || '';
                const waitResource = processNode.getAttribute('waitresource') || '';
                const waitTime = processNode.getAttribute('waittime') || '';
                const transactionName = processNode.getAttribute('transactionname') || '';
                const isolationLevel = processNode.getAttribute('isolationlevel') || '';
                const hostname = processNode.getAttribute('hostname') || '';
                const loginname = processNode.getAttribute('loginname') || '';
                const clientapp = processNode.getAttribute('clientapp') || '';
                const database = processNode.getAttribute('currentdbname') || '';
                
                // Get input buffer (the SQL query)
                const inputBufNode = processNode.querySelector('inputbuf');
                const inputBuf = inputBufNode?.textContent?.trim() || '';
                
                // Is this the victim process?
                const isVictim = id === victimProcessId;
                
                return {
                    id,
                    spid,
                    status,
                    waitResource,
                    waitTime,
                    transactionName,
                    isolationLevel,
                    hostname,
                    loginname,
                    clientapp,
                    database,
                    inputBuf,
                    isVictim
                };
            });
            
            // Get resources being locked
            const resourceNodes = xmlDoc.querySelectorAll('resource-list keylock');
            const resources = Array.from(resourceNodes).map(resourceNode => {
                const objectname = resourceNode.getAttribute('objectname') || '';
                const indexname = resourceNode.getAttribute('indexname') || '';
                const mode = resourceNode.getAttribute('mode') || '';
                
                // Get owners of this lock
                const ownerNodes = resourceNode.querySelectorAll('owner-list owner');
                const owners = Array.from(ownerNodes).map(ownerNode => {
                    const id = ownerNode.getAttribute('id') || '';
                    const mode = ownerNode.getAttribute('mode') || '';
                    // Find the process that owns this lock
                    const ownerProcess = processes.find(p => p.id === id);
                    return {
                        id,
                        mode,
                        spid: ownerProcess?.spid || '',
                        isVictim: ownerProcess?.isVictim || false
                    };
                });
                
                // Get waiters for this lock
                const waiterNodes = resourceNode.querySelectorAll('waiter-list waiter');
                const waiters = Array.from(waiterNodes).map(waiterNode => {
                    const id = waiterNode.getAttribute('id') || '';
                    const mode = waiterNode.getAttribute('mode') || '';
                    // Find the process that is waiting for this lock
                    const waiterProcess = processes.find(p => p.id === id);
                    return {
                        id,
                        mode,
                        spid: waiterProcess?.spid || '',
                        isVictim: waiterProcess?.isVictim || false
                    };
                });
                
                return {
                    objectname,
                    indexname,
                    mode,
                    owners,
                    waiters
                };
            });

            // Open modal with deadlock information
            Modal.info({
                title: (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        <span role="img" aria-label="deadlock" style={{ fontSize: '24px' }}>🔄</span>
                        <span>SQL Server Deadlock</span>
                    </div>
                ),
                width: 1200,
                content: (
                    <div>
                        <Alert
                            message={
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '16px', fontWeight: 'bold' }}>
                                        {`Deadlock Detected: ${deadlockCount} deadlock${parseInt(deadlockCount) !== 1 ? 's' : ''} on ${deadlockDate}`}
                                    </span>
                                </div>
                            }
                            description={
                                <div>
                                    <p>A deadlock occurs when two or more transactions block each other by holding locks on resources that each transaction is trying to access.</p>
                                    <p>SQL Server automatically chooses one transaction as the deadlock victim, which is terminated with a 1205 error to break the deadlock.</p>
                                </div>
                            }
                            type="error"
                            showIcon
                            style={{ marginBottom: '16px' }}
                        />
                        
                        <Tabs defaultActiveKey="visual">
                            <TabPane tab="Visual Deadlock Graph" key="visual">
                                <div style={{ marginBottom: '16px' }}>
                                    <h3>Deadlock Participants</h3>
                                    <div style={{ 
                                        position: 'relative',
                                        backgroundColor: '#f0f2f5',
                                        borderRadius: '8px',
                                        padding: '20px',
                                        minHeight: `${Math.max(300, 100 + Math.ceil(processes.length / 2) * 250)}px`,
                                        marginBottom: '48px'
                                    }}>
                                        {/* Visual representation of the deadlock */}
                                        {processes.map((process, index) => {
                                            const xPosition = 50 + (index % 2 ? 500 : 0);  // Alternate left and right
                                            const yPosition = 50 + Math.floor(index/2) * 250;  // Stack vertically with more space
                                            
                                            return (
                                                <div key={process.id} style={{
                                                    position: 'absolute',
                                                    top: `${yPosition}px`,
                                                    left: `${xPosition}px`,
                                                    width: '300px',
                                                    padding: '16px',
                                                    backgroundColor: process.isVictim ? '#fff2f0' : '#f6ffed',
                                                    border: `2px solid ${process.isVictim ? '#ff4d4f' : '#52c41a'}`,
                                                    borderRadius: '8px',
                                                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                                                    zIndex: 2
                                                }}>
                                                    <div style={{ 
                                                        marginBottom: '8px',
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center'
                                                    }}>
                                                        <h4 style={{ margin: 0 }}>
                                                            Session ID: {process.spid}
                                                            {process.isVictim && <Tag color="red" style={{ marginLeft: '8px' }}>Victim</Tag>}
                                                        </h4>
                                                        <Tag color={process.status === 'suspended' ? 'orange' : 'green'}>
                                                            {process.status}
                                                        </Tag>
                                                    </div>
                                                    <div style={{ marginBottom: '8px', fontSize: '12px' }}>
                                                        <div><strong>Database:</strong> {process.database}</div>
                                                        <div><strong>Login:</strong> {process.loginname}</div>
                                                        <div><strong>Application:</strong> {process.clientapp}</div>
                                                        <div><strong>Isolation Level:</strong> {process.isolationLevel}</div>
                                                        {process.waitResource && (
                                                            <div><strong>Waiting for:</strong> {process.waitResource}</div>
                                                        )}
                                                        {process.waitTime && (
                                                            <div><strong>Wait time:</strong> {process.waitTime}ms</div>
                                                        )}
                                                    </div>
                                                    <div style={{
                                                        backgroundColor: '#f5f5f5',
                                                        padding: '8px',
                                                        borderRadius: '4px',
                                                        maxHeight: '80px',
                                                        overflow: 'auto',
                                                        fontSize: '12px',
                                                        fontFamily: 'monospace'
                                                    }}>
                                                        {process.inputBuf || 'No query available'}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        
                                        {/* Draw arrows between processes */}
                                        <svg width="100%" height="100%" style={{ 
                                            position: 'absolute', 
                                            top: 0, 
                                            left: 0, 
                                            zIndex: 1,
                                            pointerEvents: 'none'
                                        }}>
                                            {resources.map((resource, index) => {
                                                // For each lock resource, draw arrows from owner to waiters
                                                return resource.owners.flatMap(owner => {
                                                    return resource.waiters.map(waiter => {
                                                        // Find the process indices for owner and waiter
                                                        const ownerIndex = processes.findIndex(p => p.id === owner.id);
                                                        const waiterIndex = processes.findIndex(p => p.id === waiter.id);
                                                        
                                                        if (ownerIndex === -1 || waiterIndex === -1) return null;
                                                        
                                                        // Calculate arrow positions
                                                        const ownerX = 50 + (ownerIndex % 2 ? 500 : 0) + 300; // Right side of owner box
                                                        const ownerY = 50 + Math.floor(ownerIndex/2) * 250 + 60; // Middle of owner box
                                                        
                                                        const waiterX = 50 + (waiterIndex % 2 ? 500 : 0); // Left side of waiter box
                                                        const waiterY = 50 + Math.floor(waiterIndex/2) * 250 + 60; // Middle of waiter box
                                                        
                                                        return (
                                                            <g key={`${owner.id}-${waiter.id}-${index}`}>
                                                                <defs>
                                                                    <marker 
                                                                        id={`arrowhead-${owner.id}-${waiter.id}-${index}`} 
                                                                        markerWidth="10" 
                                                                        markerHeight="7" 
                                                                        refX="9" 
                                                                        refY="3.5" 
                                                                        orient="auto"
                                                                    >
                                                                        <polygon 
                                                                            points="0 0, 10 3.5, 0 7" 
                                                                            fill={waiter.isVictim ? "#ff4d4f" : "#1890ff"}
                                                                        />
                                                                    </marker>
                                                                </defs>
                                                                <line 
                                                                    x1={ownerX} 
                                                                    y1={ownerY} 
                                                                    x2={waiterX} 
                                                                    y2={waiterY}
                                                                    stroke={waiter.isVictim ? "#ff4d4f" : "#1890ff"}
                                                                    strokeWidth="2"
                                                                    strokeDasharray="5,5"
                                                                    markerEnd={`url(#arrowhead-${owner.id}-${waiter.id}-${index})`}
                                                                />
                                                                <text 
                                                                    x={(ownerX + waiterX) / 2} 
                                                                    y={(ownerY + waiterY) / 2 - 10}
                                                                    textAnchor="middle"
                                                                    fill={waiter.isVictim ? "#ff4d4f" : "#1890ff"}
                                                                    style={{
                                                                        fontSize: '12px',
                                                                        fontWeight: 'bold',
                                                                        backgroundColor: '#fff',
                                                                        padding: '2px'
                                                                    }}
                                                                >
                                                                    {resource.objectname.split('.').pop()}
                                                                </text>
                                                                <text 
                                                                    x={(ownerX + waiterX) / 2} 
                                                                    y={(ownerY + waiterY) / 2 + 10}
                                                                    textAnchor="middle"
                                                                    fill={waiter.isVictim ? "#ff4d4f" : "#1890ff"}
                                                                    style={{ fontSize: '10px' }}
                                                                >
                                                                    {`${owner.mode} → ${waiter.mode}`}
                                                                </text>
                                                            </g>
                                                        );
                                                    });
                                                });
                                            })}
                                        </svg>
                                    </div>
                                </div>
                                
                                <div style={{ marginTop: '24px', clear: 'both' }}>
                                    <h3>Detailed Lock Information</h3>
                                    <Table 
                                        dataSource={resources}
                                        rowKey={(record, index) => `resource-${index}`}
                                        pagination={false}
                                        size="small"
                                        columns={[
                                            {
                                                title: 'Object',
                                                dataIndex: 'objectname',
                                                key: 'objectname',
                                                render: (text) => {
                                                    const parts = text.split('.');
                                                    return parts.length > 0 ? parts[parts.length - 1] : text;
                                                }
                                            },
                                            {
                                                title: 'Index',
                                                dataIndex: 'indexname',
                                                key: 'indexname'
                                            },
                                            {
                                                title: 'Lock Mode',
                                                dataIndex: 'mode',
                                                key: 'mode',
                                                render: (text) => <Tag color="blue">{text}</Tag>
                                            },
                                            {
                                                title: 'Lock Owner',
                                                key: 'owners',
                                                render: (_, record) => (
                                                    <>
                                                        {record.owners.map((owner, idx) => (
                                                            <Tag 
                                                                key={idx} 
                                                                color={owner.isVictim ? 'red' : 'green'}
                                                                style={{ marginBottom: '4px' }}
                                                            >
                                                                Session {owner.spid} ({owner.mode})
                                                            </Tag>
                                                        ))}
                                                    </>
                                                )
                                            },
                                            {
                                                title: 'Lock Waiter',
                                                key: 'waiters',
                                                render: (_, record) => (
                                                    <>
                                                        {record.waiters.map((waiter, idx) => (
                                                            <Tag 
                                                                key={idx} 
                                                                color={waiter.isVictim ? 'red' : 'orange'}
                                                                style={{ marginBottom: '4px' }}
                                                            >
                                                                Session {waiter.spid} ({waiter.mode})
                                                            </Tag>
                                                        ))}
                                                    </>
                                                )
                                            }
                                        ]}
                                    />
                                </div>
                            </TabPane>
                            
                            <TabPane tab="Raw XML" key="raw">
                                <div style={{ marginBottom: '16px' }}>
                                    <Button 
                                        type="primary"
                                        onClick={() => {
                                            navigator.clipboard.writeText(xmlDeadlock);
                                            message.success('Deadlock XML copied to clipboard');
                                        }}
                                        icon={<CopyOutlined />}
                                    >
                                        Copy XML
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
                                    fontSize: '14px',
                                    fontFamily: 'Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace'
                                }}>
                                    {xmlDeadlock}
                                </pre>
                            </TabPane>
                        </Tabs>
                    </div>
                ),
                okText: 'Close',
                okButtonProps: { style: { marginTop: '16px' } },
                className: 'deadlock-modal',
                style: { top: '20px' }
            });
        } catch (error) {
            console.error('Error showing MSSQL deadlock:', error);
            message.error('Failed to parse MSSQL deadlock information');
            
            // If parsing failed, show the raw XML at least
            Modal.info({
                title: 'SQL Server Deadlock (Raw XML)',
                content: (
                    <div>
                        <Alert
                            message="Failed to parse deadlock graph"
                            description="Could not parse the deadlock XML into a visual representation. The raw XML is shown below."
                            type="error"
                            showIcon
                            style={{ marginBottom: '16px' }}
                        />
                        <pre style={{ 
                            whiteSpace: 'pre-wrap', 
                            wordBreak: 'break-word',
                            backgroundColor: '#f5f5f5',
                            padding: '16px',
                            borderRadius: '4px',
                            maxHeight: '60vh',
                            overflow: 'auto'
                        }}>
                            {xmlDeadlock}
                        </pre>
                    </div>
                ),
                width: 1000,
                okText: 'Close'
            });
        }
    };

    // Function to handle showing PostgreSQL slow query details 
    const handleShowPostgresQuery = (messageText: string, type: string, database?: string, agentId?: string) => {
        try {
            // Extract header information
            let thresholdDuration = '1000';
            let maxDuration = 'N/A';
            let queryCount = '1';
            
            const headerMatch = messageText.match(/Found (\d+) slow quer(?:y|ies) exceeding (\d+)ms threshold\. Max duration: ([\d.]+)ms/);
            if (headerMatch) {
                queryCount = headerMatch[1];
                thresholdDuration = headerMatch[2];
                maxDuration = headerMatch[3];
            }
            
            // Parse multiple queries based on PID pattern
            const querySegments = messageText.split(/\nPID=/).filter(Boolean);
            const headerSegment = querySegments[0];
            
            // Structure to hold parsed queries
            interface ParsedQuery {
                pid: string;
                user: string;
                db: string;
                duration: string;
                query: string;
            }
            
            const parsedQueries: ParsedQuery[] = [];
            
            // Process first segment (may be header only or may include a query)
            if (headerSegment.includes('Duration=')) {
                // First segment contains a query
                const detailsMatch = headerSegment.match(/(\d+), User=([^,]+), DB=([^,]+), Duration=([\d.]+)ms, Query=(.+)/s);
                if (detailsMatch) {
                    parsedQueries.push({
                        pid: detailsMatch[1],
                        user: detailsMatch[2],
                        db: detailsMatch[3],
                        duration: detailsMatch[4],
                        query: detailsMatch[5].trim()
                    });
                }
            }
            
            // Process remaining segments (these should all be queries)
            for (let i = 1; i < querySegments.length; i++) {
                const segment = 'PID=' + querySegments[i]; // Add back the PID= prefix
                const detailsMatch = segment.match(/PID=(\d+), User=([^,]+), DB=([^,]+), Duration=([\d.]+)ms, Query=(.+)/s);
                
                if (detailsMatch) {
                    parsedQueries.push({
                        pid: detailsMatch[1],
                        user: detailsMatch[2],
                        db: detailsMatch[3],
                        duration: detailsMatch[4],
                        query: detailsMatch[5].trim()
                    });
                }
            }
            
            // If no queries were parsed but we have a message, try to extract using other patterns
            if (parsedQueries.length === 0) {
                // Try to extract with more generic patterns
                let query = 'Query not found';
                let duration = maxDuration;
                let dbInfo = database || '';
                
                // Try different query patterns
                const queryMatch1 = messageText.match(/Query:\s*([\s\S]+)$/);
                const queryMatch2 = messageText.match(/Query=\s*([\s\S]+)$/);
                const queryMatch3 = messageText.match(/\b(SELECT|INSERT|UPDATE|DELETE|WITH|CREATE|ALTER|DROP)\b[\s\S]+$/i);
                
                if (queryMatch1) {
                    query = queryMatch1[1].trim();
                } else if (queryMatch2) {
                    query = queryMatch2[1].trim();
                } else if (queryMatch3) {
                    query = queryMatch3[0].trim();
                } else {
                    // Fallback patterns
                    const sqlPatterns = [
                        /\bSELECT\b.+\bFROM\b.+/i,
                        /\bINSERT\b.+\bINTO\b.+/i,
                        /\bUPDATE\b.+\bSET\b.+/i,
                        /\bDELETE\b.+\bFROM\b.+/i
                    ];
                    
                    for (const pattern of sqlPatterns) {
                        const match = messageText.match(pattern);
                        if (match) {
                            query = match[0].trim();
                            break;
                        }
                    }
                }
                
                // Add a generic entry if we found anything
                if (query !== 'Query not found') {
                    parsedQueries.push({
                        pid: 'Unknown',
                        user: 'Unknown',
                        db: dbInfo,
                        duration: duration,
                        query: query
                    });
                }
            }
            
            // If still no queries found, add a dummy entry with the whole message
            if (parsedQueries.length === 0) {
                parsedQueries.push({
                    pid: 'Unknown',
                    user: 'Unknown',
                    db: database || 'Unknown',
                    duration: maxDuration,
                    query: messageText
                });
            }
            
            // Get a representative database name for the title
            const representativeDb = parsedQueries.length > 0 ? 
                parsedQueries[0].db : (database || 'Unknown Database');
            
            Modal.info({
                title: `PostgreSQL Slow ${parsedQueries.length > 1 ? 'Queries' : 'Query'} (${representativeDb})`,
                width: 900,
                content: (
                    <div>
                        <div style={{ marginBottom: '16px' }}>
                            <Alert
                                message={`Found ${queryCount} slow ${parseInt(queryCount) === 1 ? 'query' : 'queries'} exceeding ${thresholdDuration} ms threshold (max: ${maxDuration} ms)`}
                                description="These queries exceeded the configured threshold for query execution time."
                                type="warning"
                                showIcon
                            />
                        </div>
                        
                        {/* Query length limitation warning */}
                        <Alert
                            message="Query Length Limitation"
                            description={
                                <div>
                                    <p>The displayed queries might be truncated if they exceed 1KB in length due to PostgreSQL's default <code>track_activity_query_size</code> parameter setting.</p>
                                    <p>To see longer queries in full, consider increasing this parameter in your PostgreSQL configuration.</p>
                                </div>
                            }
                            type="info"
                            showIcon
                            style={{ marginBottom: '16px' }}
                        />
                        
                        {parsedQueries.length > 1 ? (
                            // Multiple queries - show tabs
                            <Tabs type="card">
                                {parsedQueries.map((queryInfo, index) => (
                                    <Tabs.TabPane 
                                        key={index} 
                                        tab={
                                            <span>
                                                Query {index + 1}
                                                <Tag 
                                                    color={parseFloat(queryInfo.duration) > parseFloat(thresholdDuration) * 2 ? 'red' : 'orange'} 
                                                    style={{ marginLeft: '4px', fontSize: '10px' }}
                                                >
                                                    {queryInfo.duration}ms
                                                </Tag>
                                            </span>
                                        }
                                    >
                                        <div style={{ marginBottom: '16px' }}>
                                            <Tag color="blue">PID: {queryInfo.pid}</Tag>
                                            <Tag color="green">User: {queryInfo.user}</Tag>
                                            <Tag color="purple">Database: {queryInfo.db}</Tag>
                                            <Tag color="magenta">Duration: {queryInfo.duration}ms</Tag>
                                        </div>
                                        
                                        <div style={{ marginBottom: '16px' }}>
                                            <Button 
                                                type="primary"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(queryInfo.query);
                                                    message.success('Query copied to clipboard');
                                                }}
                                                icon={<CopyOutlined />}
                                                style={{ marginRight: '8px' }}
                                            >
                                                Copy Query
                                            </Button>
                                            
                                            {/* Explain button - only show if we have agent ID */}
                                            {agentId && (
                                                <Button
                                                    type="primary"
                                                    icon={<SearchOutlined />}
                                                    onClick={() => {
                                                        // Instead of using state, call direct query function
                                                        explainDirectQuery(
                                                            queryInfo.query,
                                                            queryInfo.db,
                                                            agentId
                                                        );
                                                    }}
                                                    style={{ 
                                                        background: '#722ed1', 
                                                        marginRight: '8px' 
                                                    }}
                                                >
                                                    Explain Query
                                                </Button>
                                            )}

                                            {/* AI Analysis button */}
                                            <Button
                                                type="primary" 
                                                onClick={() => handleQueryAIAnalysis(queryInfo.query)}
                                                icon={<RobotOutlined />}
                                            >
                                                Analyze with AI
                                            </Button>
                                        </div>
                                        
                                        <pre style={{ 
                                            whiteSpace: 'pre-wrap',
                                            backgroundColor: '#f9f9fb',
                                            padding: '16px',
                                            borderRadius: '4px',
                                            maxHeight: '400px',
                                            overflow: 'auto',
                                            fontSize: '14px',
                                            fontFamily: 'monospace',
                                            border: '1px solid #e6e8eb',
                                            color: '#333'
                                        }}>
                                            {queryInfo.query}
                                        </pre>
                                    </Tabs.TabPane>
                                ))}
                            </Tabs>
                        ) : (
                            // Single query - no tabs needed
                            <div>
                                {parsedQueries.length > 0 && (
                                    <>
                                        <div style={{ marginBottom: '16px' }}>
                                            <Tag color="blue">PID: {parsedQueries[0].pid}</Tag>
                                            <Tag color="green">User: {parsedQueries[0].user}</Tag>
                                            <Tag color="purple">Database: {parsedQueries[0].db}</Tag>
                                            <Tag color="magenta">Duration: {parsedQueries[0].duration}ms</Tag>
                                        </div>
                                        
                                        <div style={{ marginBottom: '16px' }}>
                                            <Button 
                                                type="primary"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(parsedQueries[0].query);
                                                    message.success('Query copied to clipboard');
                                                }}
                                                icon={<CopyOutlined />}
                                                style={{ marginRight: '8px' }}
                                            >
                                                Copy Query
                                            </Button>
                                            
                                            {/* Explain button - only show if we have agent ID */}
                                            {agentId && (
                                                <Button
                                                    type="primary"
                                                    icon={<SearchOutlined />}
                                                    onClick={() => {
                                                        // Instead of using state, call direct query function
                                                        explainDirectQuery(
                                                            parsedQueries[0].query,
                                                            parsedQueries[0].db,
                                                            agentId
                                                        );
                                                    }}
                                                    style={{ 
                                                        background: '#722ed1', 
                                                        marginRight: '8px' 
                                                    }}
                                                >
                                                    Explain Query
                                                </Button>
                                            )}

                                            {/* AI Analysis button */}
                                            <Button
                                                type="primary" 
                                                onClick={() => handleQueryAIAnalysis(parsedQueries[0].query)}
                                                icon={<RobotOutlined />}
                                            >
                                                Analyze with AI
                                            </Button>
                                        </div>
                                        
                                        <pre style={{ 
                                            whiteSpace: 'pre-wrap',
                                            backgroundColor: '#f9f9fb',
                                            padding: '16px',
                                            borderRadius: '4px',
                                            maxHeight: '400px',
                                            overflow: 'auto',
                                            fontSize: '14px',
                                            fontFamily: 'monospace',
                                            border: '1px solid #e6e8eb',
                                            color: '#333'
                                        }}>
                                            {parsedQueries[0].query}
                                        </pre>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                )
            });
        } catch (error) {
            console.error('Error parsing PostgreSQL slow query:', error);
            message.error('Failed to parse PostgreSQL slow query information');
            
            // Fallback - show raw message
            Modal.info({
                title: 'PostgreSQL Slow Query (Raw)',
                width: 800,
                content: (
                    <pre style={{ 
                        whiteSpace: 'pre-wrap',
                        backgroundColor: '#f9f9fb',
                        padding: '16px',
                        borderRadius: '4px',
                        maxHeight: '70vh',
                        overflow: 'auto',
                        fontSize: '14px',
                        fontFamily: 'monospace',
                        border: '1px solid #e6e8eb',
                        color: '#333'
                    }}>
                        {messageText}
                    </pre>
                )
            });
        }
    };

    // Add a new function to fetch MSSQL execution plan, copied from mssqlpa.tsx


    const fetchExecutionPlan = async (queryText: string, database: string, agentId: string) => {
        if (!agentId) {
            message.error('No agent ID provided');
            return;
        }
        
        if (!queryText || queryText.trim() === '') {
            message.error('No query to analyze');
            return;
        }

        // Show loading modal
        const loadingModal = Modal.info({
            title: 'Getting MSSQL Execution Plan',
            content: (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                    <Spin size="large" />
                    <p style={{ marginTop: '15px', color: '#cc2927' }}>Analyzing the query execution plan...</p>
                    <p style={{ fontSize: '12px', color: '#999' }}>This may take a few moments</p>
                </div>
            ),
            icon: <LineChartOutlined style={{ color: '#cc2927' }} />,
            maskClosable: false
        });
        
        try {
            // Clean the query - remove all newline characters and excess spaces
            const cleanQuery = queryText.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
            
            // Ensure agent ID has the correct format
            const formattedAgentId = agentId.startsWith('agent_') ? agentId : `agent_${agentId}`;
            
            let executionPlanXml = '';
            const targetDatabase = database || 'master';
            
            // Check if it's a stored procedure
            const isStoredProcedure = cleanQuery.toUpperCase().includes('CREATE PROCEDURE') || 
                                    (!cleanQuery.toUpperCase().includes('SELECT') && 
                                     !cleanQuery.toUpperCase().includes('INSERT') && 
                                     !cleanQuery.toUpperCase().includes('UPDATE') && 
                                     !cleanQuery.toUpperCase().includes('DELETE') &&
                                     !cleanQuery.includes('@'));
            
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
                    // Use stored procedure execution plan query
                    const storedProcQuery = `
                        SELECT 
                            DB_NAME(ps.database_id) AS database_name,
                            OBJECT_NAME(ps.object_id, ps.database_id) AS procedure_name,
                            qp.query_plan
                        FROM sys.dm_exec_procedure_stats AS ps
                        CROSS APPLY sys.dm_exec_query_plan(ps.plan_handle) AS qp
                        WHERE OBJECT_NAME(ps.object_id, ps.database_id) = '${procedureName}'
                            AND DB_NAME(ps.database_id) = '${targetDatabase}'`;
                    
                    try {
                        const token = localStorage.getItem('token');
                        const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/agents/${formattedAgentId}/query`, {
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
                                    const decodedValue = atob(data.result.value);
                                    const parsedResult = JSON.parse(decodedValue);
                                    
                                    if (parsedResult.status === 'success' && parsedResult.row_count > 0) {
                                        executionPlanXml = parsedResult['query_plan_0'] || '';
                                    } else if (parsedResult.query_plan) {
                                        executionPlanXml = parsedResult.query_plan;
                                    }
                                } catch (error) {
                                    console.error('Error parsing stored procedure execution plan result:', error);
                                }
                            }
                        }
                    } catch (error) {
                        console.warn('Stored procedure plan fetch failed:', error);
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
                        const cacheResponse = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/agents/${formattedAgentId}/query`, {
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
                                            console.log('Found execution plan from plan cache search');
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
                    
                    // If still no plan, try alternative cache search methods
                    if (!executionPlanXml) {

                        
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
                                const explainResponse = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/agents/${formattedAgentId}/query`, {
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
                                        `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/agents/${formattedAgentId}/mssql/explain`,
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
                                    const declareResponse = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/agents/${formattedAgentId}/query`, {
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
                    
                    // If still no plan, try with parameter substitution for STATISTICS XML
                    if (!executionPlanXml) {
                        // Replace parameters with default values for analysis
                        let modifiedQuery = cleanQuery;
                        
                        // Apply smarter parameter replacements
                        modifiedQuery = modifiedQuery.replace(/@\w*[Ii][Dd]\w*/gi, "123");
                        modifiedQuery = modifiedQuery.replace(/@\w*[Cc]ontrol\w*/gi, "1");
                        modifiedQuery = modifiedQuery.replace(/@\w*[Ss]tatus\w*/gi, "1");
                        modifiedQuery = modifiedQuery.replace(/@\w+(?=\s*(?:=|<|>|LIKE|IN))/gi, "'SampleValue'");
                        modifiedQuery = modifiedQuery.replace(/@\w+(?=\s*(?:=|<|>|\+|-|\*|\/)\s*\d)/gi, "1");
                        modifiedQuery = modifiedQuery.replace(/@\w+/gi, "1");
                        
                        // Add explicit database context
                        modifiedQuery = `USE [${targetDatabase}]; ${modifiedQuery}`;
                        
                        // Try using STATISTICS XML
                        try {
                            const token = localStorage.getItem('token');
                            const explainResponse = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/agents/${formattedAgentId}/query`, {
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
                            console.warn('STATISTICS XML method failed:', error);
                        }
                    }
                }
                
                // Try the /mssql/explain endpoint for non-parameterized queries
                if (!executionPlanXml && !hasParameters) {

                    try {
                        // Add database context for better table resolution
                        const contextualQuery = `USE [${targetDatabase}]; ${cleanQuery}`;

                        const response = await axios.post(
                            `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/agents/${formattedAgentId}/mssql/explain`,
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
                                    const decodedPlan = planData.plan.replace(/\\u003c/g, '<').replace(/\\u003e/g, '>');
                                    
                                    // Check if the plan is actually relevant to our query
                                    // /mssql/explain often returns generic table scan plans that are not related to the actual query
                                    const isGenericPlan = isGenericExecutionPlan(decodedPlan, cleanQuery);
                                    
                                    if (!isGenericPlan) {
                                        executionPlanXml = decodedPlan;
                                        // Valid plan found
                                    } else {
                                        // Generic/irrelevant plan, will try plan cache search
                                    }
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

                // If /mssql/explain failed or returned irrelevant plan, try plan cache search
                if (!executionPlanXml && !hasParameters) {

                    try {
                        // Try plan cache search with query keywords
                        const queryKeywords = cleanQuery.match(/(?:SELECT|UPDATE|INSERT|DELETE|FROM|WHERE|JOIN)\s+\w+/gi);
                        if (queryKeywords && queryKeywords.length > 0) {
                            const keywordPattern = queryKeywords.slice(0, 3).map(kw => 
                                `st.text LIKE '%${kw.replace(/'/g, "''").replace(/\s+/g, '%')}%'`
                            ).join(' AND ');
                            
                            const planCacheQuery = `
                                SELECT TOP 1
                                    qp.query_plan,
                                    qs.sql_handle,
                                    st.text as query_text
                                FROM sys.dm_exec_query_stats qs
                                CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) st
                                CROSS APPLY sys.dm_exec_query_plan(qs.plan_handle) qp
                                WHERE ${keywordPattern}
                                    AND st.text IS NOT NULL
                                    AND qp.query_plan IS NOT NULL
                                    AND (st.text LIKE '%${targetDatabase}%' OR st.text NOT LIKE '%USE [%')
                                ORDER BY qs.last_execution_time DESC
                            `;

                            const token = localStorage.getItem('token');
                            const cacheResponse = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/agents/${formattedAgentId}/query`, {
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
                                if (cacheData.result?.type_url === 'type.googleapis.com/google.protobuf.Value') {
                                    try {
                                        const decodedValue = atob(cacheData.result.value);
                                        const parsedResult = JSON.parse(decodedValue);
                                        
                                        if (parsedResult.status === 'success' && parsedResult.row_count > 0) {
                                            executionPlanXml = parsedResult['query_plan_0'] || '';
                                        }
                                    } catch (error) {
                                        console.error('Error parsing plan cache result:', error);
                                    }
                                }
                            }
                        }
                    } catch (error) {
                        console.warn('Plan cache search failed:', error);
                    }
                }

                // Final fallback: try SHOWPLAN_XML for simple queries
                if (!executionPlanXml && !hasParameters) {

                    const token = localStorage.getItem('token');
                    const directResponse = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/agents/${formattedAgentId}/query`, {
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
            
            // Destroy loading modal
            loadingModal.destroy();
            
            if (executionPlanXml && executionPlanXml.includes('<ShowPlanXML')) {
                // Ensure all unicode characters are properly decoded
                const cleanXml = executionPlanXml
                    .replace(/\\u003c/g, '<')
                    .replace(/\\u003e/g, '>')
                    .replace(/\\n/g, '\n')
                    .replace(/\\"/g, '"')
                    .replace(/\\\\/g, '\\');

                // Display execution plan in a modal with visualization
                Modal.info({
                    title: 'SQL Server Execution Plan',
                    content: (
                        <div style={{ maxHeight: '70vh', overflow: 'auto' }}>
                            <Tabs defaultActiveKey="visual">
                                <Tabs.TabPane tab="Visualization" key="visual">
                                    <ExecutionPlanVisualizer xmlPlan={cleanXml} />
                                </Tabs.TabPane>
                                <Tabs.TabPane tab="Summary" key="summary">
                                    <ExecutionPlanSummary xmlPlan={cleanXml} />
                                </Tabs.TabPane>
                                <Tabs.TabPane tab="Raw XML" key="raw">
                                    <div style={{ marginBottom: '16px', display: 'flex', gap: '8px' }}>
                                        <Button 
                                            type="primary"
                                            onClick={() => {
                                                navigator.clipboard.writeText(cleanXml);
                                                message.success('Execution plan copied to clipboard');
                                            }}
                                            icon={<CopyOutlined />}
                                        >
                                            Copy XML
                                        </Button>
                                        
                                        <Button 
                                            type="primary"
                                            onClick={() => handleMssqlExplainPlanAIAnalysis(cleanXml)}
                                            icon={<RobotOutlined />}
                                            style={{ backgroundColor: '#cc2927', borderColor: '#cc2927' }}
                                        >
                                            Analyze with AI
                                        </Button>
                                    </div>
                                    <pre style={{ 
                                        whiteSpace: 'pre-wrap', 
                                        wordBreak: 'break-word',
                                        backgroundColor: '#f6f8fa',
                                        padding: '16px',
                                        borderRadius: '4px',
                                        maxHeight: '60vh',
                                        overflow: 'auto',
                                        fontSize: '14px',
                                        fontFamily: 'Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace'
                                    }}>
                                        {cleanXml}
                                    </pre>
                                </Tabs.TabPane>
                            </Tabs>
                        </div>
                    ),
                    width: 1000,
                    okText: 'Close'
                });
            } else {
                // Show a user-friendly message explaining why execution plan couldn't be retrieved
                Modal.warning({
                    title: 'Execution Plan Not Available',
                    content: (
                        <div>
                            <p>The execution plan for this blocking session query could not be retrieved because:</p>
                            <ul style={{ marginTop: '12px', paddingLeft: '20px' }}>
                                <li>This is historical blocking session data (not currently running)</li>
                                <li>The query plan may no longer be in the SQL Server plan cache</li>
                                <li>Complex blocking scenarios often involve multiple queries and transactions</li>
                            </ul>
                            <p style={{ marginTop: '12px' }}>
                                <strong>Recommendation:</strong> Use the "Analyze With AI" button to get insights about the blocking query structure and potential optimizations.
                            </p>
                        </div>
                    ),
                    okText: 'Understood'
                });
                return;
            }
        } catch (error) {
            console.error('Error fetching execution plan:', error);
            message.error('Failed to fetch execution plan information');
            loadingModal.destroy();
        }
    };

    // Update handleShowMssqlSlowQuery function to handle the button label correctly
    const handleShowMssqlSlowQuery = (messageText: string, type: string, database?: string, agentId?: string) => {
        try {
            // Header bilgilerini çıkaralım
            const headerMatch = messageText.match(/Found (\d+) slow queries .* threshold\. Max duration: ([\d.]+) ms/);
            const queryCount = headerMatch ? headerMatch[1] : '0';
            const maxDuration = headerMatch ? headerMatch[2] : 'N/A';
            
            // Try to extract database name from message if not provided
            if (!database) {
                database = extractMssqlSlowQueryDb(messageText);
            }
            
            // Sorguları ayrıştıralım
            const queries = messageText.split(/Query=/).slice(1);
            
            if (queries.length === 0) {
                message.error('No SQL queries found in the message');
                return;
            }
            
            // İlk sorguyu göster ve kullanıcı detayları için multiQueryDetails'i doldur
            const multiQueryDetails: MultiQueryDetails = {
                queries: queries.map((queryText, index) => {
                    // Sorgu bilgilerini çıkar
                    let durationMatch = null;
                    
                    if (index === 0 && headerMatch) {
                        // İlk sorgu için üstteki header bilgisini kullan
                        durationMatch = headerMatch[2] + 'ms';
                    } else {
                        // Diğer sorgular için sorgunun kendi içindeki duration bilgisini bul
                        const durationRegex = /duration=(\d+(\.\d+)?)\s*ms/i;
                        const match = queryText.match(durationRegex);
                        durationMatch = match ? match[1] + 'ms' : 'N/A';
                    }
                    
                    // Look for database name in the query itself if not already found
                    let queryDatabase = database;
                    if (!queryDatabase) {
                        // Check if query has USE [Database] statement
                        const useDbMatch = queryText.match(/USE\s+\[([^\]]+)\]/i);
                        if (useDbMatch && useDbMatch[1]) {
                            queryDatabase = useDbMatch[1].trim();
                        }
                    }
                    
                    return {
                        sql: queryText.trim(),
                        duration: durationMatch,
                        database: queryDatabase,
                        id: index,
                    }
                }),
                selectedQueryIndex: 0
            };
            
            setMultiQueryDetails(multiQueryDetails);
            
            // Modal bilgilerini ayarla
            const firstQuery = multiQueryDetails.queries[0];
            const titlePrefix = database ? `SQL Server Slow Query (${database})` : 'SQL Server Slow Query';
            setModalTitle(`${titlePrefix} - Query ${1} of ${multiQueryDetails.queries.length}`);
            setModalContent(firstQuery.sql);
            
            // Execution Plan için gerekli verileri sakla - Changed to just set currentQueryDetails
            if (agentId) {
                setCurrentQueryDetails({
                    query: firstQuery.sql,
                    database: firstQuery.database || database || '',
                    agentId: agentId
                });
            } else {
                setCurrentQueryDetails(null);
            }
            
            // Modalı göster
            setModalVisible(true);
        } catch (error) {
            console.error('Error showing MSSQL slow query:', error);
            message.error('Failed to parse MSSQL slow query details');
        }
    };

    // SQL formatla ve renklendirme fonksiyonu
    const formatSqlWithSyntaxHighlight = (sql: string): string => {
        // SQL'i temizle
        const cleanedSql = sql.trim();
        
        // Temel anahtar kelimeleri tanımla
        const keywords = [
            'SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'FULL', 'ON', 'AS', 'AND', 'OR',
            'NOT', 'IN', 'EXISTS', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET', 'UNION', 'ALL',
            'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP', 'TRUNCATE', 'TABLE', 'INDEX', 'VIEW',
            'PROCEDURE', 'FUNCTION', 'TRIGGER', 'SCHEMA', 'DATABASE', 'DISTINCT', 'TOP', 'WITH', 'CTE',
            'NOLOCK', 'BEGIN', 'END', 'DECLARE', 'SET', 'EXEC', 'EXECUTE', 'CASE', 'WHEN', 'THEN', 'ELSE',
            'IS NULL', 'IS NOT NULL', 'ASC', 'DESC', 'BETWEEN', 'LIKE'
        ];
        
        // Fonksiyonları tanımla
        const functions = [
            'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'CAST', 'CONVERT', 'ISNULL', 'COALESCE', 'NULLIF',
            'DATEADD', 'DATEDIFF', 'DATENAME', 'DATEPART', 'LEN', 'SUBSTRING', 'LEFT', 'RIGHT',
            'CHARINDEX', 'PATINDEX', 'REPLACE', 'STUFF', 'UPPER', 'LOWER', 'TRIM', 'LTRIM', 'RTRIM'
        ];
        
        // Veri tiplerini tanımla
        const dataTypes = [
            'INT', 'BIGINT', 'SMALLINT', 'TINYINT', 'BIT', 'DECIMAL', 'NUMERIC', 'FLOAT', 'REAL',
            'DATETIME', 'DATETIME2', 'DATE', 'TIME', 'CHAR', 'VARCHAR', 'NVARCHAR', 'TEXT', 'NTEXT',
            'BINARY', 'VARBINARY', 'IMAGE', 'MONEY', 'UNIQUEIDENTIFIER', 'XML'
        ];
        
        // SQL'i renklendirmek için HTML olarak biçimlendir
        let formattedSql = cleanedSql
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        
        // Yorum satırlarını işaretle
        formattedSql = formattedSql.replace(/--.*$/gm, '<span style="color: #777; font-style: italic;">$&</span>');
        
        // Blok yorumlarını işaretle
        formattedSql = formattedSql.replace(/\/\*[\s\S]*?\*\//g, '<span style="color: #777; font-style: italic;">$&</span>');
        
        // String ifadelerini işaretle
        formattedSql = formattedSql.replace(/'([^']|'')*'/g, '<span style="color: #a31515;">$&</span>');
        
        // Sayıları işaretle
        formattedSql = formattedSql.replace(/\b\d+(\.\d+)?\b/g, '<span style="color: #098658;">$&</span>');
        
        // Anahtar kelimeleri işaretle (tam kelime eşleşmesi)
        keywords.forEach(keyword => {
            const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
            formattedSql = formattedSql.replace(regex, match => `<span style="color: #0000ff; font-weight: bold;">${match}</span>`);
        });
        
        // Fonksiyonları işaretle
        functions.forEach(func => {
            const regex = new RegExp(`\\b${func}\\b(?=\\s*\\()`, 'gi');
            formattedSql = formattedSql.replace(regex, match => `<span style="color: #795e26;">${match}</span>`);
        });
        
        // Veri tiplerini işaretle
        dataTypes.forEach(type => {
            const regex = new RegExp(`\\b${type}\\b`, 'gi');
            formattedSql = formattedSql.replace(regex, match => `<span style="color: #267f99;">${match}</span>`);
        });
        
        // Noktalama işaretlerini işaretle (parantezler, virgüller vs.)
        formattedSql = formattedSql
            .replace(/([(),.])/g, '<span style="color: #000000;">$1</span>');
        
        // Basit SQL formatlama - SELECT, FROM gibi ana ifadelerden sonra yeni satır ekle
        if (formattedSql.length < 10000) { // Çok uzun sorgularda performans sorunu yaşamamak için sınır koyuyoruz
            const formatKeywords = ['SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 
                                  'FULL JOIN', 'CROSS JOIN', 'GROUP BY', 'ORDER BY', 'HAVING', 'UNION'];
            
            formatKeywords.forEach(keyword => {
                const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
                formattedSql = formattedSql.replace(regex, match => `<br>${match}`);
            });
            
            // AND ve OR'dan önce hafif girinti ekle
            formattedSql = formattedSql.replace(/\b(AND|OR)\b/gi, match => `<br>&nbsp;&nbsp;${match}`);
        }
        
        return formattedSql;
    };

    // Function to handle PostgreSQL query AI analysis - similar to MongoDB query analysis
    const handleQueryAIAnalysis = async (queryText: string, databaseType?: 'postgres' | 'mssql') => {
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
        
        // Determine database type based on parameter or current modal context
        const isSqlServer = databaseType === 'mssql' || (databaseType === undefined && modalTitle?.includes('SQL Server'));
        const dbType = isSqlServer ? 'mssql' : 'postgres';
        const dbName = isSqlServer ? 'SQL Server' : 'PostgreSQL';

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
                            AI is analyzing your {dbName} query...
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

            // Create a prompt based on the database type
            const prompt = isSqlServer ?
                `Can you analyze this SQL Server query and give recommendations for optimization? 
                Please suggest indexes if necessary and consider rewriting the query for better performance.
                Query: ${queryText}` :
                `Can you analyze this PostgreSQL query and give recommendations for optimization? 
                Please suggest indexes if necessary and consider rewriting the query for better performance.
                Query: ${queryText}`;

            const response = await fetch('https://o4szcpxekyj6hvcdx5ktqy2c.agents.do-ai.run/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer cifsE4HtBVWFEzyXrh5E5vbU-v66wK6I'
                },
                body: JSON.stringify({
                    messages: [{
                        role: "user",
                        content: prompt
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
                                dbType={dbType}
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
            message.error('Failed to analyze query with AI');
        }
    };

    // Add a function to explain custom SQL queries
    const handleCustomQueryExplain = () => {
        // Create a modal with a form to input database info and query
        Modal.info({
            title: 'Explain Custom SQL Query',
            width: 800,
            content: (
                <div>
                    <Form
                        onFinish={(values) => {
                            
                            // First close the modal
                            Modal.destroyAll();
                            
                            // Delay setting state and calling explainAnalyze to ensure they happen after modal is closed
                            setTimeout(() => {
                                try {
                                    // Set currentQueryDetails with values from form
                                    const queryDetails = {
                                        query: values.query.trim(),
                                        database: values.database.trim(),
                                        agentId: values.agentId.trim()
                                    };
                                    
                                    setCurrentQueryDetails(queryDetails);
                                    
                                    // Call explainAnalyze directly with the same values to avoid async state issues
                                    const parameters = extractQueryParameters(queryDetails.query);
                                    if (parameters.length > 0 && !showParamForm) {
                                        // If there are parameters, show the parameter form first
                                        setShowParamForm(true);
                                        // Initialize parameter values if not already set
                                        const initialValues: Record<string, string> = {};
                                        parameters.forEach(param => {
                                            if (!paramValues[param]) {
                                                initialValues[param] = '';
                                            }
                                        });
                                        if (Object.keys(initialValues).length > 0) {
                                            setParamValues(prev => ({ ...prev, ...initialValues }));
                                        }
                                    } else {
                                        // If no parameters, directly explain the query
                                        // Use direct call to explain API instead of waiting for state update
                                        explainDirectQuery(
                                            queryDetails.query,
                                            queryDetails.database,
                                            queryDetails.agentId
                                        );
                                    }
                                } catch (error) {
                                    console.error("Error setting up query details:", error);
                                    message.error("Failed to setup query details");
                                }
                            }, 100);
                        }}
                        layout="vertical"
                        initialValues={{
                            // Provide default values if you want
                            database: '',
                            agentId: '',
                            query: 'SELECT * FROM users;'
                        }}
                    >
                        <Form.Item
                            label="Agent ID"
                            name="agentId"
                            rules={[{ required: true, message: 'Please enter agent ID' }]}
                            tooltip="The agent ID (with or without 'agent_' prefix)"
                        >
                            <Input placeholder="Enter agent ID (e.g. agent_postgres1)" />
                        </Form.Item>
                        
                        <Form.Item
                            label="Database Name"
                            name="database"
                            rules={[{ required: true, message: 'Please enter database name' }]}
                        >
                            <Input placeholder="Enter database name" />
                        </Form.Item>
                        
                        <Form.Item
                            label="SQL Query"
                            name="query"
                            rules={[{ required: true, message: 'Please enter SQL query' }]}
                        >
                            <Input.TextArea 
                                rows={10} 
                                placeholder="Enter your SQL query here" 
                                style={{ 
                                    fontFamily: 'monospace',
                                    fontSize: '14px'
                                }}
                            />
                        </Form.Item>
                        
                        <Form.Item>
                            <Space>
                                <Button type="primary" htmlType="submit">
                                    Explain Query
                                </Button>
                            </Space>
                        </Form.Item>
                    </Form>
                </div>
            ),
            // Add footer with a close button
            footer: [
                <Button 
                    key="close" 
                    onClick={() => Modal.destroyAll()}
                >
                    Cancel
                </Button>
            ]
        });
    };
    
    // Function to directly explain a query without relying on state updates
    const explainDirectQuery = async (query: string, database: string, agentId: string) => {
        
        if (!query || !database || !agentId) {
            message.error("Missing required query information");
            return;
        }
        
        // Check if query has parameters before proceeding
        const parameters = extractQueryParameters(query);
        if (parameters.length > 0) {
            // Store query details for use after parameter input
            setCurrentQueryDetails({
                query,
                database,
                agentId
            });
            
            // Initialize parameter values if not already set
            const initialValues: Record<string, string> = {};
            parameters.forEach(param => {
                if (!paramValues[param]) {
                    initialValues[param] = '';
                }
            });
            
            if (Object.keys(initialValues).length > 0) {
                setParamValues(prev => ({ ...prev, ...initialValues }));
            }
            
            // First close ALL modals - more reliable than just setModalVisible(false)
            Modal.destroyAll();
            setModalVisible(false);
            setExplainModalVisible(false);
            setMongoExplainModalVisible(false);
            
            // Show parameter input form after a slight delay to ensure all modals are closed
            setTimeout(() => {
                setShowParamForm(true);
            }, 200);
            
            return;
        }
        
        setExplainLoading(true);
        
        // Before executing the query, add a clear, visible overlay loading indicator to the current modal
        // This is more visible than just changing content text which might not be seen due to dangerouslySetInnerHTML
        Modal.info({
            title: 'Analyzing Query',
            content: (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                    <Spin size="large" />
                    <p style={{ marginTop: '15px', color: '#722ed1', fontWeight: 'bold' }}>
                        Getting Execution Plan...
                    </p>
                    <p style={{ fontSize: '13px', color: '#666' }}>
                        Please wait while we analyze your query. This overlay will close automatically.
                    </p>
                </div>
            ),
            icon: <SearchOutlined style={{ color: '#722ed1' }} />,
            maskClosable: false,
            footer: null
        });
        
        try {
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
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            // First close the loading overlay modal once data is received
            Modal.destroyAll();
            
            // Process the response similar to fetchExplainAnalyze
            if (response.data) {
                let explainData = null;
                
                if (response.data.data) {
                    explainData = response.data.data;
                } else if (response.data.plan || response.data.query) {
                    explainData = response.data;
                } else {
                    const candidates = ['result', 'explain', 'output', 'plan', 'explain_plan'];
                    for (const candidate of candidates) {
                        if (response.data[candidate]) {
                            explainData = response.data[candidate];
                            break;
                        }
                    }
                    
                    if (!explainData) {
                        explainData = response.data;
                    }
                }
                
                if (explainData) {
                    let formattedResults = '';
                    let planObject = null;
                    
                    if (typeof explainData.plan === 'string' && explainData.plan.startsWith('{')) {
                        try {
                            const planData = JSON.parse(explainData.plan);
                            planObject = planData;
                            formattedResults = formatExplainPlan(explainData, planData);
                        } catch (parseError) {
                            formattedResults = explainData.plan || JSON.stringify(explainData, null, 2);
                        }
                    } else if (typeof explainData.plan === 'object' && explainData.plan !== null) {
                        planObject = explainData.plan;
                        formattedResults = formatExplainPlan(explainData, explainData.plan);
                    } else {
                        formattedResults = `Query: ${explainData.query || query}\n`;
                        
                        if (explainData.database || database) {
                            formattedResults += `Database: ${explainData.database || database}\n`;
                        }
                        
                        if (explainData.status) {
                            formattedResults += `Status: ${explainData.status}\n\n`;
                        }
                        
                        formattedResults += JSON.stringify(explainData, null, 2);
                    }
                    
                    // Set results and show modal
                    setExplainResults(formattedResults);
                    
                    // Also store the original plan object for visualization
                    if (planObject) {
                        parseQueryPlanForVisualization(planObject, explainData);
                    }
                    
                    // Make sure to set currentQueryDetails for future reference
                    setCurrentQueryDetails({
                        query,
                        database,
                        agentId
                    });
                    
                    // Show the explain modal without closing the original modal
                    setExplainModalVisible(true);
                } else {
                    throw new Error('Could not extract explain results from the response');
                }
            } else {
                throw new Error('Empty response from explain API');
            }
        } catch (error: any) {
            // First close the loading overlay on error
            Modal.destroyAll();
            
            let errorMessage = 'Failed to get query execution plan';
            
            if (error.response) {
                if (error.response.data?.error) {
                    errorMessage = `API Error: ${error.response.data.error}`;
                } else if (error.response.data) {
                    errorMessage = `API Error: ${JSON.stringify(error.response.data)}`;
                } else if (error.response.status) {
                    errorMessage = `API Error: Status ${error.response.status}`;
                }
            } else if (error.request) {
                errorMessage = 'No response received from the server';
            } else if (error.message) {
                errorMessage = `Error: ${error.message}`;
            }
            
            console.error("Explain query error:", errorMessage, error);
            message.error(errorMessage);
        } finally {
            setExplainLoading(false);
        }
    };

    // Add a floating action button to bottom-right corner
    const renderFloatingActionButton = () => {
        return (
            <div style={{
                position: 'fixed',
                bottom: '24px',
                right: '24px',
                zIndex: 1000
            }}>
                <Tooltip title="Explain Custom SQL Query">
                    <Button
                        type="primary"
                        shape="circle"
                        icon={<SearchOutlined />}
                        size="large"
                        onClick={handleCustomQueryExplain}
                        style={{
                            backgroundColor: '#722ed1',
                            boxShadow: '0 3px 6px rgba(0,0,0,0.16), 0 3px 6px rgba(0,0,0,0.23)'
                        }}
                    />
                </Tooltip>
            </div>
        );
    };

    // Function to analyze PostgreSQL explain plan with AI
    const handlePostgresExplainPlanAIAnalysis = async () => {
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
                title: 'AI Query Plan Analysis',
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
                            AI is analyzing your PostgreSQL execution plan...
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
                        AI PostgreSQL Plan Analysis Results
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
            console.error('Error during PostgreSQL plan AI analysis:', error);
            message.error('Failed to analyze execution plan with AI');
        }
    };

    // Function to analyze MSSQL execution plan with AI
    const handleMssqlExplainPlanAIAnalysis = async (executionPlanXml: string) => {
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
                title: 'AI Query Plan Analysis',
                content: (
                    <div style={{
                        textAlign: 'center',
                        padding: '40px 20px'
                    }}>
                        <Spin size="large" />
                        <div style={{
                            marginTop: '20px',
                            fontSize: '16px',
                            color: '#cc2927'
                        }}>
                            AI is analyzing your SQL Server execution plan...
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
                footer: null,
                icon: <LineChartOutlined style={{ color: '#cc2927' }} />
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
                        content: `Can you analyze this SQL Server execution plan XML? Please provide insights about the performance and any improvement recommendations. Organize your response with sections for identified issues and specific recommendations.

If there are performance problems, please suggest indexes that would improve the query using proper SQL Server CREATE INDEX syntax.

Execution Plan XML:
${executionPlanXml}`
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
                        <RobotOutlined style={{ fontSize: '20px', color: '#cc2927' }} />
                        AI SQL Server Plan Analysis Results
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
                            backgroundColor: '#fff2f0',
                            borderRadius: '4px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <span style={{ color: '#cc2927' }}>
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
                maskClosable: true,
                icon: <LineChartOutlined style={{ color: '#cc2927' }} />
            });
        } catch (error) {
            // Destroy the loading modal if it exists
            if (analysisModal) {
                analysisModal.destroy();
            }
            console.error('Error during SQL Server plan AI analysis:', error);
            message.error('Failed to analyze execution plan with AI');
        }
    };

    // Add pagination change handler
    const handlePaginationChange = (page: number, size?: number) => {
        
        if (size && size !== pageSize) {
            setPageSize(size);
            // Don't set currentPage here - let the pageSize useEffect handle it
        } else {
            setCurrentPage(page);
        }
    };

    // Add filter change handler
    const handleTableChange = (pagination: any, tableFilters: any, sorter: any) => {
        
        // Update filters state - only include filters that have values
        const newFilters: typeof filters = {};
        
        if (tableFilters.severity && tableFilters.severity.length > 0) {
            newFilters.severity = tableFilters.severity;
        }
        if (tableFilters.host && tableFilters.host.length > 0) {
            newFilters.host = tableFilters.host;
        }
        if (tableFilters.type && tableFilters.type.length > 0) {
            newFilters.type = tableFilters.type;
        }
        if (tableFilters.database && tableFilters.database.length > 0) {
            newFilters.database = tableFilters.database;
        }
        if (tableFilters.status && tableFilters.status.length > 0) {
            newFilters.status = tableFilters.status;
        }
        if (tableFilters.message && tableFilters.message.length > 0) {
            newFilters.message = tableFilters.message[0];
        }
        
        
        // Only update filters if they actually changed
        if (JSON.stringify(filters) !== JSON.stringify(newFilters)) {
            setFilters(newFilters);
            // Reset to page 1 when filters change and fetch data with new filters
            setCurrentPage(1);
            // Fetch alarms with the new filters
            fetchAlarms(false, 1, false);
        }
    };

    if (loading) {
        return (
            <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                height: '100vh' 
            }}>
                <Spin size="large" />
            </div>
        );
    }

    return (
        <div style={{ padding: '24px' }}>
            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes pulse {
                    0% { opacity: 1; }
                    50% { opacity: 0.5; }
                    100% { opacity: 1; }
                }
            `}} />
            <Card
                style={{ 
                    marginBottom: '24px',
                    background: '#fff',
                    borderRadius: '8px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}
            >
                <div style={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '16px' 
                    }}>
                        <AlertOutlined style={{ 
                            fontSize: '32px', 
                            color: '#ff4d4f' 
                        }} />
                        <div>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px'
                            }}>
                                <h1 style={{ 
                                    margin: 0, 
                                    fontSize: '24px',
                                    color: '#000000d9'
                                }}>
                                    Alarm Operations Center
                                </h1>
                                <Badge 
                                    count={totalAlarms} 
                                    style={{ 
                                        backgroundColor: '#ff4d4f',
                                        fontSize: '12px',
                                        marginTop: '4px'
                                    }}
                                    overflowCount={999}
                                />
                                {hasNewAlarms && (
                                    <Badge 
                                        dot 
                                        style={{ 
                                            backgroundColor: '#52c41a',
                                            animation: 'pulse 2s infinite'
                                        }}
                                    >
                                        <Button 
                                            type="primary" 
                                            size="small"
                                            onClick={() => {
                                                setHasNewAlarms(false);
                                                fetchAlarms(false, 1, false);
                                            }}
                                            style={{
                                                backgroundColor: '#52c41a',
                                                borderColor: '#52c41a'
                                            }}
                                        >
                                            Refresh for New Alarms
                                        </Button>
                                    </Badge>
                                )}
                            </div>
                            <p style={{ 
                                margin: '4px 0 0 0',
                                opacity: 0.65,
                                color: '#000000d9'
                            }}>
                                Monitoring and managing alerts
                            </p>
                        </div>
                    </div>
                    <Space size="large" direction="vertical" style={{ alignItems: 'flex-end' }}>
                        <RangePicker
                            showTime
                            format="YYYY-MM-DD HH:mm:ss"
                            value={dateRange}
                            onChange={handleDateRangeChange}
                            style={{ minWidth: '400px' }}
                            ranges={{
                                'Last 24 Hours': [dayjs().subtract(24, 'hours'), dayjs()],
                                'Last 7 Days': [dayjs().subtract(7, 'days'), dayjs()],
                                'Last 30 Days': [dayjs().subtract(30, 'days'), dayjs()],
                            }}
                            placeholder={['Start Time', 'End Time']}
                        />
                        <div style={{ 
                            fontSize: '12px', 
                            color: '#8c8c8c',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}>
                            <CalendarOutlined />
                            Showing alarms from {dateRange[0].format('MMMM D, HH:mm')} to {dateRange[1].format('MMMM D, HH:mm')}
                        </div>
                    </Space>
                </div>
            </Card>

            <Card>
                {/* Filter controls */}
                {Object.keys(filters).length > 0 && (
                    <div style={{ 
                        marginBottom: '16px', 
                        padding: '12px', 
                        backgroundColor: '#f0f2f5', 
                        borderRadius: '6px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <div>
                            <span style={{ marginRight: '8px', color: '#666' }}>Active filters:</span>
                            {filters.severity && (
                                <Tag closable onClose={() => setFilters(prev => ({ ...prev, severity: undefined }))}>
                                    Severity: {filters.severity.join(', ')}
                                </Tag>
                            )}
                            {filters.host && (
                                <Tag closable onClose={() => setFilters(prev => ({ ...prev, host: undefined }))}>
                                    Host: {filters.host.join(', ')}
                                </Tag>
                            )}
                            {filters.type && (
                                <Tag closable onClose={() => setFilters(prev => ({ ...prev, type: undefined }))}>
                                    Type: {filters.type.join(', ')}
                                </Tag>
                            )}
                            {filters.database && (
                                <Tag closable onClose={() => setFilters(prev => ({ ...prev, database: undefined }))}>
                                    Database: {filters.database.join(', ')}
                                </Tag>
                            )}
                            {filters.status && (
                                <Tag closable onClose={() => setFilters(prev => ({ ...prev, status: undefined }))}>
                                    Status: {filters.status.join(', ')}
                                </Tag>
                            )}
                            {filters.message && (
                                <Tag closable onClose={() => setFilters(prev => ({ ...prev, message: undefined }))}>
                                    Message: "{filters.message}"
                                </Tag>
                            )}
                        </div>
                        <Button 
                            size="small" 
                            onClick={() => {
                                setFilters({});
                                // Don't set currentPage here - let the filters useEffect handle it
                            }}
                        >
                            Clear All Filters
                        </Button>
                    </div>
                )}
                
                <div style={{ marginBottom: '16px', textAlign: 'right' }}>
                    <Button 
                        type="primary" 
                        onClick={fetchFilterOptions}
                        loading={loadingFilterOptions}
                        icon={<SearchOutlined />}
                    >
                        Refresh Filter Options
                    </Button>
                    <span style={{ marginLeft: '8px', fontSize: '12px', color: '#8c8c8c' }}>
                        {loadingFilterOptions ? 'Loading filter options...' : 'Click to refresh available filter options'}
                    </span>
                </div>
                
                <Table<Alarm>
                    key={JSON.stringify(filters)} // Force re-render when filters change
                    columns={columns}
                    dataSource={alarms || []}
                    rowKey="id"
                    pagination={{
                        current: currentPage,
                        pageSize: pageSize,
                        total: totalAlarms,
                        showSizeChanger: true,
                        showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} alarms`,
                        onChange: handlePaginationChange,
                        showQuickJumper: true,
                        pageSizeOptions: ['10', '20', '50', '100']
                    }}
                    onChange={handleTableChange}
                    scroll={{ x: 1000 }}
                    locale={{ 
                        emptyText: (
                            <div style={{ padding: '24px 0', textAlign: 'center' }}>
                                <AlertOutlined style={{ fontSize: '32px', color: '#1890ff', marginBottom: '16px' }} />
                                <p style={{ fontSize: '16px', color: '#262626', margin: '0 0 8px 0' }}>No alarms detected</p>
                                <p style={{ fontSize: '14px', color: '#8c8c8c' }}>
                                    No new alarms have been triggered in the selected time period.
                                </p>
                                <p style={{ fontSize: '13px', color: '#8c8c8c', marginTop: '8px' }}>
                                    {dateRange[0].format('YYYY-MM-DD HH:mm')} to {dateRange[1].format('YYYY-MM-DD HH:mm')}
                                </p>
                            </div>
                        )
                    }}
                />
            </Card>

            <Modal
                title={modalTitle}
                open={modalVisible}
                onCancel={() => setModalVisible(false)}
                footer={[
                    <Button key="close" onClick={() => setModalVisible(false)}>
                        Close
                    </Button>,
                    <Button 
                        key="copy" 
                        type="primary" 
                        onClick={() => {
                            navigator.clipboard.writeText(modalContent);
                            message.success('Query copied to clipboard');
                        }}
                    >
                        Copy to Clipboard
                    </Button>,
                    // If it's an MSSQL slow query, show "Execution Plan" button
                    currentQueryDetails && modalTitle.includes('SQL Server') ? (
                        <>
                        <Button
                            key="executionPlan"
                            type="primary"
                            icon={<SearchOutlined />}
                            onClick={() => {
                                fetchExecutionPlan(
                                    currentQueryDetails.query,
                                    currentQueryDetails.database,
                                    currentQueryDetails.agentId
                                );
                            }}
                            style={{ background: '#cc2927' }}
                        >
                            Execution Plan
                        </Button>
                        <Button
                            key="analyzeAI"
                            type="primary"
                            icon={<RobotOutlined />}
                            onClick={() => {
                                handleQueryAIAnalysis(currentQueryDetails.query);
                            }}
                            style={{ background: '#1677ff' }}
                        >
                            Analyze with AI
                        </Button>
                        </>
                    ) : 
                    // For other database types (e.g., PostgreSQL), show "Explain Query" button
                    currentQueryDetails && (
                        <Button
                            key="explain"
                            type="primary"
                            icon={<SearchOutlined />}
                            loading={explainLoading}
                            onClick={() => {
                                // Use direct query instead of state-based approach
                                explainDirectQuery(
                                    currentQueryDetails.query,
                                    currentQueryDetails.database,
                                    currentQueryDetails.agentId
                                );
                            }}
                            style={{ background: '#722ed1' }}
                        >
                            Explain Query
                        </Button>
                    )
                ].filter(Boolean)}
                width={900}
                bodyStyle={{ maxHeight: '70vh', overflowY: 'auto' }}
            >
                {/* Query selector if multiple queries are present */}
                {multiQueryDetails.queries && multiQueryDetails.queries.length > 1 && (
                    <div style={{ marginBottom: '16px' }}>
                        <Radio.Group 
                            value={multiQueryDetails.selectedQueryIndex}
                            onChange={(e) => handleQuerySelectionChange(e.target.value)}
                            buttonStyle="solid"
                            style={{ marginBottom: '10px' }}
                        >
                            {multiQueryDetails.queries.map((q, idx) => (
                                <Radio.Button 
                                    key={idx} 
                                    value={idx}
                                    style={{ marginRight: '8px', marginBottom: '8px' }}
                                >
                                    Query {idx + 1}
                                    {q.duration && (
                                        <Tag 
                                            color={parseFloat(q.duration) > 1000 ? 'red' : 'orange'} 
                                            style={{ marginLeft: '4px', fontSize: '10px' }}
                                        >
                                            {q.duration}
                                        </Tag>
                                    )}
                                </Radio.Button>
                            ))}
                        </Radio.Group>
                        
                        {/* Show query metadata */}
                        {multiQueryDetails.queries[multiQueryDetails.selectedQueryIndex] && multiQueryDetails.queries[multiQueryDetails.selectedQueryIndex].pid && (
                            <div style={{ marginBottom: '10px', fontSize: '12px', color: '#666' }}>
                                <div>
                                    <strong>PID:</strong> {multiQueryDetails.queries[multiQueryDetails.selectedQueryIndex].pid} | 
                                    <strong> User:</strong> {multiQueryDetails.queries[multiQueryDetails.selectedQueryIndex].user} | 
                                    <strong> DB:</strong> {multiQueryDetails.queries[multiQueryDetails.selectedQueryIndex].database} | 
                                    <strong> Duration:</strong> {multiQueryDetails.queries[multiQueryDetails.selectedQueryIndex].duration}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Database-specific information alerts */}
                {modalTitle.includes('PostgreSQL') && (
                    <Alert
                        message="Query Length Limitation"
                        description={
                            <div>
                                <p>The displayed query might be truncated if it exceeds 1KB in length due to PostgreSQL's default <code>track_activity_query_size</code> parameter setting.</p>
                                <p>To see longer queries in full, consider increasing this parameter in your PostgreSQL configuration.</p>
                            </div>
                        }
                        type="info"
                        showIcon
                        style={{ marginBottom: '16px' }}
                    />
                )}
                
                {modalTitle.includes('SQL Server') && (
                    <Alert
                        message="SQL Server Slow Query"
                        description={
                            <div>
                                <p>This query exceeded the configured threshold for execution time in SQL Server.</p>
                                <p>Consider analyzing the execution plan to identify performance bottlenecks.</p>
                            </div>
                        }
                        type="info"
                        showIcon
                        style={{ marginBottom: '16px' }}
                    />
                )}

                <div
                    dangerouslySetInnerHTML={{ 
                        __html: modalTitle && modalTitle.includes('SQL Server') ? 
                            formatSqlWithSyntaxHighlight(modalContent) : 
                            modalContent
                    }}
                    style={{ 
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
                    }}
                />
            </Modal>

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
                        {/* Execution time summary */}
                        <div style={{ marginBottom: '24px' }}>
                            <h3>Execution Time Breakdown</h3>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {queryTimingData.map((timing, index) => (
                                    <Tag 
                                        key={index} 
                                        color={getTimingColor(timing.time)}
                                        style={{ 
                                            fontSize: '14px', 
                                            padding: '4px 8px',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center'
                                        }}
                                    >
                                        <div>{timing.name}</div>
                                        <div style={{ fontWeight: 'bold' }}>{timing.time.toFixed(2)} ms</div>
                                        <div>({timing.percentage.toFixed(1)}%)</div>
                                        {timing.calls && <div>{timing.calls} calls</div>}
                                    </Tag>
                                ))}
                            </div>
                        </div>
                        
                        {/* Query Statistics Summary */}
                        <div style={{ marginBottom: '24px' }}>
                            <h3>Query Statistics</h3>
                            {renderQueryStatistics()}
                        </div>

                        {/* Operation tree visualization */}
                        <div style={{ marginBottom: '24px' }}>
                            <h3>Query Plan Tree</h3>
                            <div style={{ 
                                border: '1px solid #f0f0f0', 
                                padding: '8px',
                                borderRadius: '4px',
                                backgroundColor: '#fafafa'
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

            {/* Parameter form modal */}
            {renderParameterForm()}

            {/* MongoDB Explain Results Modal */}
            {renderMongoExplainModal()}

            {/* Floating Action Button for custom SQL Explain */}
            <div style={{
                position: 'fixed',
                bottom: '24px',
                right: '24px',
                zIndex: 1000
            }}>
                <Tooltip title="Explain Custom SQL Query">
                    <Button
                        type="primary"
                        shape="circle"
                        icon={<SearchOutlined />}
                        size="large"
                        onClick={handleCustomQueryExplain}
                        style={{
                            backgroundColor: '#722ed1',
                            boxShadow: '0 3px 6px rgba(0,0,0,0.16), 0 3px 6px rgba(0,0,0,0.23)'
                        }}
                    />
                </Tooltip>
            </div>
        </div>
    );
};

export default AlarmDashboard; 