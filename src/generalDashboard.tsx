import React, { useEffect, useState, useRef, useCallback } from 'react';
import axios from "axios";
import { DashboardData, NodeType } from "./type";
import { flattenMongoData, flattenPostgresData, flattenMssqlData } from "./data-utils";
import './index.css';
import { useDispatch } from 'react-redux';
import { setHeadStats } from './redux/redux';
import MssqlIcon from './icons/mssql';
import MongoIcon from './icons/mongo';
import PostgresIcon from './icons/postgresql';
import { message, Tag, Spin, Card, Row, Col, Tooltip, Badge, Avatar, Segmented, Statistic, Progress, Typography, Alert, Button, Popover } from 'antd';
import NodeStatusGrid from './NodeStatusGrid';
import { useNavigate } from 'react-router-dom';
import { DatabaseOutlined, CloseCircleOutlined, ThunderboltOutlined, WarningOutlined, ExclamationCircleOutlined, FireOutlined, DisconnectOutlined, InfoCircleOutlined } from '@ant-design/icons';

const { Title } = Typography;

// Filter types
type FilterType = 'all' | 'critical' | 'warning' | 'mongodb' | 'postgresql' | 'mssql' | 'issues';

// Agent interface
interface Agent {
    connection: string;
    hostname: string;
    id: string;
    ip: string;
    last_seen: string;
    status: string;
    grpc_connected?: boolean; // gRPC bağlantısı var mı (sorgu gönderilebilir mi?)
}

// StatisticCards için props arayüzü
interface StatisticCardsProps {
    totalMongoNodes: number;
    totalPostgresNodes: number;
    totalMssqlNodes: number;
    totalCriticalNodes: number;
    totalWarningNodes: number;
    activeFilter: FilterType;
    setActiveFilter: React.Dispatch<React.SetStateAction<FilterType>>;
}

// Dinamik database türleri için arayüz
interface DatabaseStats {
  type: string;             // Database türü (mongodb, postgresql, mssql, vb.)
  count: number;            // Node sayısı
  color: string;            // Renk kodu
  borderColor: string;      // Kenarlık rengi
}

// Format the last seen time for disconnected agents
const formatLastSeen = (lastSeen: string) => {
  try {
    const lastSeenDate = new Date(lastSeen);
    const now = new Date();
    const diffMs = now.getTime() - lastSeenDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffMins > 0) {
      return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    } else {
      return 'Just now';
    }
  } catch (e) {
    return 'Unknown';
  }
};

const GeneralDashboard = () => {
    // Tip tanımlı useState
    const [data, setData] = useState<DashboardData>({ mongodb: [], postgresql: [], mssql: [] });
    const [loading, setLoading] = useState<boolean>(true);
    const [activeFilter, setActiveFilter] = useState<FilterType>('all');
    const [expandedGrids, setExpandedGrids] = useState<{mongodb: boolean, postgresql: boolean, mssql: boolean}>({ mongodb: false, postgresql: false, mssql: false });
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const [agentStatuses, setAgentStatuses] = useState<{[key: string]: boolean}>({});
    const [disconnectedAgents, setDisconnectedAgents] = useState<Agent[]>([]);
    
    // NodeStatusGrid'den gelen statü sayımları
    const [mongodbCritical, setMongodbCritical] = useState(0);
    const [mongodbWarning, setMongodbWarning] = useState(0);
    const [postgresqlCritical, setPostgresqlCritical] = useState(0);
    const [postgresqlWarning, setPostgresqlWarning] = useState(0);
    const [mssqlCritical, setMssqlCritical] = useState(0);
    const [mssqlWarning, setMssqlWarning] = useState(0);
    
    // State for warning and critical nodes details
    const [warningNodesDetails, setWarningNodesDetails] = useState<{
        mongodb: Array<{hostname: string, reason: string}>,
        postgresql: Array<{hostname: string, reason: string}>,
        mssql: Array<{hostname: string, reason: string}>
    }>({
        mongodb: [],
        postgresql: [],
        mssql: []
    });
    
    const [criticalNodesDetails, setCriticalNodesDetails] = useState<{
        mongodb: Array<{hostname: string, reason: string}>,
        postgresql: Array<{hostname: string, reason: string}>,
        mssql: Array<{hostname: string, reason: string}>
    }>({
        mongodb: [],
        postgresql: [],
        mssql: []
    });

    // Add a mounting ref to control when fetchData runs
    const isMounted = React.useRef(false);
    const intervalIdRef = React.useRef<number | null>(null);

    const fetchData = async () => {
        try {
            setLoading(true);
            
            const token = localStorage.getItem('token');
            const response = await fetch(
                `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/status/nodeshealth`, 
                {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    },
                    credentials: 'include'
                }
            );
            
            if (!response.ok) {
                throw new Error(`API response not ok: ${response.status} ${response.statusText}`);
            }
            
            // API yanıtını işle
            const responseData = await response.json();
           
            // Exit if component unmounted during fetch
            if (!isMounted.current) return;
            
            // Handle response data - check for different API response formats
            if (responseData && responseData.status === "success") {
                // New API format with status and data fields
                const { postgresql, mongodb, mssql } = responseData.data || {};
                
                // Process each database type separately - handle null values
                const flattenedPostgres = postgresql ? flattenPostgresData(postgresql) : [];
                const flattenedMongo = mongodb ? flattenMongoData(mongodb) : [];
                const flattenedMssql = mssql ? flattenMssqlData(mssql) : [];
                
                // Compare with previous data before updating state
                const hasDatabaseDataChanged = 
                    JSON.stringify(data.mongodb) !== JSON.stringify(flattenedMongo) ||
                    JSON.stringify(data.postgresql) !== JSON.stringify(flattenedPostgres) ||
                    JSON.stringify(data.mssql) !== JSON.stringify(flattenedMssql);
                
                // Only update state if data has changed
                if (hasDatabaseDataChanged) {
                setData({
                    mongodb: flattenedMongo,
                    postgresql: flattenedPostgres,
                    mssql: flattenedMssql,
                });
                }
            } else if (responseData && (responseData.postgresql || responseData.mongodb || responseData.mssql)) {
                // Direct API format - process each database type separately
                const flattenedPostgres = responseData.postgresql ? flattenPostgresData(responseData.postgresql) : [];
                const flattenedMongo = responseData.mongodb ? flattenMongoData(responseData.mongodb) : [];
                const flattenedMssql = responseData.mssql ? flattenMssqlData(responseData.mssql) : [];

                // Compare with previous data before updating state
                const hasDatabaseDataChanged = 
                    JSON.stringify(data.mongodb) !== JSON.stringify(flattenedMongo) ||
                    JSON.stringify(data.postgresql) !== JSON.stringify(flattenedPostgres) ||
                    JSON.stringify(data.mssql) !== JSON.stringify(flattenedMssql);
                
                // Only update state if data has changed
                if (hasDatabaseDataChanged) {
                setData({
                    mongodb: flattenedMongo,
                    postgresql: flattenedPostgres,
                    mssql: flattenedMssql,
                });
                }
            } else {
                console.error("Invalid API response format:", responseData);
                if (isMounted.current) {
                message.error("Veri alınırken hata oluştu. Geçersiz yanıt formatı.");
                }
            }
        } catch (error) {
            console.error("Error fetching data:", error);
            if (isMounted.current) {
            message.error("Veriler alınırken bir hata oluştu.");
            }
        } finally {
            if (isMounted.current) {
                setLoading(false);
            }
        }
    };

    // Agent durumlarını çek
    const fetchAgentStatuses = async () => {
        try {
            // localStorage'dan token al
           
            
            // API call to fetch agent statuses
            const token = localStorage.getItem('token');
            const agentResponse = await axios.get(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/status/agents`, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                withCredentials: true
            });
            
            // Exit if component unmounted during fetch
            if (!isMounted.current) return;
            
            // Check for the expected data structure
            if (agentResponse.data?.status === "success" && Array.isArray(agentResponse.data?.data?.agents)) {
                const agentList = agentResponse.data.data.agents;
                const newAgentStatuses: {[key: string]: boolean} = {};
                const disconnectedList: Agent[] = [];
                
                // Process agent statuses from the array structure
                agentList.forEach((agent: Agent) => {
                    if (agent.hostname && agent.status) {
                        // An agent is active if its status is "connected"
                        const isActive = agent.status === "connected";
                        
                        // Add with various possible hostname formats
                        newAgentStatuses[agent.hostname] = isActive;
                        newAgentStatuses[agent.hostname.toLowerCase()] = isActive;
                        
                        // Add disconnected agents to the list
                        if (!isActive) {
                            disconnectedList.push(agent);
                        }
                    }
                });
                
                // Only update state if agent statuses have changed
                const haveAgentStatusesChanged = JSON.stringify(newAgentStatuses) !== JSON.stringify(agentStatuses);
               
                if (haveAgentStatusesChanged) {
                setAgentStatuses(newAgentStatuses);
                }
                
                // Update disconnected agents list
                setDisconnectedAgents(disconnectedList);
            } else {
                console.warn('Unexpected agent status response format:', agentResponse.data);
            }
        } catch (error) {
            console.error('Error fetching agent statuses:', error);
        }
    };

    // Toplam MongoDB, PostgreSQL ve MSSQL Node Sayıları
    const totalMongoNodes = (data.mongodb || []).length;
    const totalPostgresNodes = (data.postgresql || []).length;
    const totalMssqlNodes = (data.mssql || []).length;
    
    // Toplam kritik ve uyarı durumunda olan node sayıları
    const totalCriticalNodes = mongodbCritical + postgresqlCritical + mssqlCritical;
    const totalWarningNodes = mongodbWarning + postgresqlWarning + mssqlWarning;

    // Dinamik database kartları için veri oluşturma
    const databaseStats = React.useMemo(() => [
        {
            type: 'mongodb',
            count: totalMongoNodes,
            color: '#4FAA41',
            borderColor: '#4FAA41'
        },
        {
            type: 'postgresql',
            count: totalPostgresNodes,
            color: '#336791',
            borderColor: '#336791'
        },
        {
            type: 'mssql',
            count: totalMssqlNodes,
            color: '#CC2927',
            borderColor: '#CC2927'
        },
        // Gelecekte buraya yeni database türleri eklenebilir
        // {
        //   type: 'mysql',
        //   count: totalMysqlNodes,
        //   icon: <MySQLIcon />,
        //   color: '#00758F',
        //   borderColor: '#00758F'
        // },
    ] as DatabaseStats[], [totalMongoNodes, totalPostgresNodes, totalMssqlNodes]);

    // Combine the two useEffects to avoid potential conflicts
    useEffect(() => {
        // Set mounted flag on initial render
        isMounted.current = true;
        
        // Initial data fetch
        const fetchInitialData = async () => {
            try {
                await fetchData();
                await fetchAgentStatuses();
            } catch (error) {
                console.error("Error in initial data fetch:", error);
            }
        };
        
        fetchInitialData();
        
        // Setup interval using ref to avoid re-renders 
        intervalIdRef.current = window.setInterval(() => {
            fetchData().catch(err => console.error("Error fetching data in interval:", err));
            fetchAgentStatuses().catch(err => console.error("Error fetching agent statuses in interval:", err));
        }, 5000);
        
        // Cleanup on unmount
        return () => {
            isMounted.current = false;
            if (intervalIdRef.current !== null) {
                clearInterval(intervalIdRef.current);
                intervalIdRef.current = null;
            }
        };
    }, []); // Empty dependency array - only run on mount and unmount

    // Dispatch redux action only when values change
    useEffect(() => {
        if (isMounted.current) {
        dispatch(setHeadStats({
            panelName: 'clusterheatmap',
            totalMongoNodes: totalMongoNodes,
            totalPostgresNodes: totalPostgresNodes,
            criticalNodes: totalCriticalNodes,
            warningNodes: totalWarningNodes
            }));
        }
    }, [totalMongoNodes, totalPostgresNodes, totalMssqlNodes, totalCriticalNodes, totalWarningNodes, dispatch]);

    // Set expanded grids based on critical/warning status - extract to separate useEffect with proper dependencies
    useEffect(() => {
        if (isMounted.current) {
        setExpandedGrids({
            mongodb: mongodbCritical > 0 || mongodbWarning > 0,
            postgresql: postgresqlCritical > 0 || postgresqlWarning > 0,
            mssql: mssqlCritical > 0 || mssqlWarning > 0
        });
        }
    }, [mongodbCritical, mongodbWarning, postgresqlCritical, postgresqlWarning, mssqlCritical, mssqlWarning]);

    // MongoDB statü bildirimleri
    const handleMongoStatusCount = useCallback((critical: number, warning: number, criticalDetails?: Array<{hostname: string, reason: string}>, warningDetails?: Array<{hostname: string, reason: string}>) => {
        // Only update if values have changed
        if (mongodbCritical !== critical || mongodbWarning !== warning) {
        setMongodbCritical(critical);
        setMongodbWarning(warning);
        }
        
        // Update details only if provided and changed
        if (criticalDetails && JSON.stringify(criticalNodesDetails.mongodb) !== JSON.stringify(criticalDetails)) {
            setCriticalNodesDetails(prev => ({...prev, mongodb: criticalDetails}));
        }
        
        if (warningDetails && JSON.stringify(warningNodesDetails.mongodb) !== JSON.stringify(warningDetails)) {
            setWarningNodesDetails(prev => ({...prev, mongodb: warningDetails}));
        }
    }, [mongodbCritical, mongodbWarning, criticalNodesDetails.mongodb, warningNodesDetails.mongodb]);
    
    // PostgreSQL statü bildirimleri
    const handlePostgresStatusCount = useCallback((critical: number, warning: number, criticalDetails?: Array<{hostname: string, reason: string}>, warningDetails?: Array<{hostname: string, reason: string}>) => {
        // Only update if values have changed
        if (postgresqlCritical !== critical || postgresqlWarning !== warning) {
        setPostgresqlCritical(critical);
        setPostgresqlWarning(warning);
        }
        
        // Update details only if provided and changed
        if (criticalDetails && JSON.stringify(criticalNodesDetails.postgresql) !== JSON.stringify(criticalDetails)) {
            setCriticalNodesDetails(prev => ({...prev, postgresql: criticalDetails}));
        }
        
        if (warningDetails && JSON.stringify(warningNodesDetails.postgresql) !== JSON.stringify(warningDetails)) {
            setWarningNodesDetails(prev => ({...prev, postgresql: warningDetails}));
        }
    }, [postgresqlCritical, postgresqlWarning, criticalNodesDetails.postgresql, warningNodesDetails.postgresql]);

    // MSSQL statü bildirimleri
    const handleMssqlStatusCount = useCallback((critical: number, warning: number, criticalDetails?: Array<{hostname: string, reason: string}>, warningDetails?: Array<{hostname: string, reason: string}>) => {
        // Only update if values have changed
        if (mssqlCritical !== critical || mssqlWarning !== warning) {
        setMssqlCritical(critical);
        setMssqlWarning(warning);
        }
        
        // Update details only if provided and changed
        if (criticalDetails && JSON.stringify(criticalNodesDetails.mssql) !== JSON.stringify(criticalDetails)) {
            setCriticalNodesDetails(prev => ({...prev, mssql: criticalDetails}));
        }
        
        if (warningDetails && JSON.stringify(warningNodesDetails.mssql) !== JSON.stringify(warningDetails)) {
            setWarningNodesDetails(prev => ({...prev, mssql: warningDetails}));
        }
    }, [mssqlCritical, mssqlWarning, criticalNodesDetails.mssql, warningNodesDetails.mssql]);

    // Handle node click for PostgreSQL nodes
    const handlePostgresNodeClick = useCallback((node: any) => {
        const clusterName = node.ClusterName || 'postgres';
        const hostName = node.Hostname || '';
        
        // Check if the click is for logs button
        if (node.isLogsClick) {
            // Navigate to PostgresQueryAnalyzer with cluster name
            navigate(`/postgresqueryanalyzer?clusterName=${clusterName}`);
        } else {
            // Navigate to postgrepa with both clusterName and hostName parameters
            navigate(`/postgrepa?clusterName=${clusterName}&hostName=${hostName}`);
        }
    }, [navigate]);

    // StatisticsPanel bileşeni - Tüm özet kartları ve veritabanı istatistiklerini yönetir
    const StatisticsPanel: React.FC<{
        stats: {
            totalNodes: number;
            criticalNodes: number;
            warningNodes: number;
            databaseStats: DatabaseStats[];
        },
        criticalTooltipContent: React.ReactNode | string;
        warningTooltipContent: React.ReactNode | string;
        issuesToolTipContent: React.ReactNode | string;
        activeFilter: FilterType;
        setActiveFilter: React.Dispatch<React.SetStateAction<FilterType>>;
    }> = React.memo(({ 
        stats, 
        criticalTooltipContent, 
        warningTooltipContent, 
        issuesToolTipContent, 
        activeFilter, 
        setActiveFilter 
    }) => {
        const { totalNodes, criticalNodes, warningNodes, databaseStats } = stats;
        
        // Tüm filtreleme öğelerini içeren başlık bölümü
        return (
            <div className="dashboard-header" style={{ 
                marginBottom: '20px',
                backgroundColor: '#fafafa',
                borderRadius: '8px',
                padding: '16px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
                    {/* Sol kısım - Badge'ler */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Tooltip title="All Nodes">
                            <Badge 
                                count={totalNodes} 
                                style={{ 
                                    backgroundColor: activeFilter === 'all' ? '#1890ff' : '#f5f5f5', 
                                    color: activeFilter === 'all' ? 'white' : '#1890ff',
                                    cursor: 'pointer',
                                    boxShadow: activeFilter === 'all' ? '0 0 0 2px rgba(24, 144, 255, 0.2)' : 'none'
                                }}
                                onClick={() => setActiveFilter('all')}
                            >
                                <Tag 
                                    icon={<DatabaseOutlined />} 
                                    color={activeFilter === 'all' ? 'blue' : 'default'}
                                    style={{ 
                                        padding: '5px 8px', 
                                        fontSize: '13px',
                                        cursor: 'pointer',
                                        borderRadius: '16px',
                                        fontWeight: 500
                                    }}
                                    onClick={() => setActiveFilter('all')}
                                >
                                    All
                                </Tag>
                            </Badge>
                        </Tooltip>
                        
                        <Tooltip title={criticalTooltipContent}>
                            <Badge 
                                count={criticalNodes} 
                                style={{ 
                                    backgroundColor: criticalNodes === 0 ? '#f5f5f5' : '#ff4d4f',
                                    color: criticalNodes === 0 ? '#999' : 'white',
                                    boxShadow: activeFilter === 'critical' ? '0 0 0 2px rgba(255, 77, 79, 0.2)' : 'none',
                                    cursor: 'pointer'
                                }}
                                onClick={() => setActiveFilter('critical')}
                            >
                                <Tag 
                                    icon={<CloseCircleOutlined />} 
                                    color={activeFilter === 'critical' ? 'error' : 'default'}
                                    style={{ 
                                        padding: '5px 8px', 
                                        fontSize: '13px',
                                        cursor: 'pointer',
                                        borderRadius: '16px',
                                        fontWeight: 500
                                    }}
                                    onClick={() => setActiveFilter('critical')}
                                >
                                    Critical
                                </Tag>
                            </Badge>
                        </Tooltip>
                        
                        <Tooltip title={warningTooltipContent}>
                            <Badge 
                                count={warningNodes} 
                                style={{ 
                                    backgroundColor: warningNodes === 0 ? '#f5f5f5' : '#faad14',
                                    color: warningNodes === 0 ? '#999' : 'white',
                                    boxShadow: activeFilter === 'warning' ? '0 0 0 2px rgba(250, 173, 20, 0.2)' : 'none',
                                    cursor: 'pointer'
                                }}
                                onClick={() => setActiveFilter('warning')}
                            >
                                <Tag 
                                    icon={<WarningOutlined />} 
                                    color={activeFilter === 'warning' ? 'warning' : 'default'}
                                    style={{ 
                                        padding: '5px 8px', 
                                        fontSize: '13px',
                                        cursor: 'pointer',
                                        borderRadius: '16px',
                                        fontWeight: 500
                                    }}
                                    onClick={() => setActiveFilter('warning')}
                                >
                                    Warnings
                                </Tag>
                            </Badge>
                        </Tooltip>
                        
                        <Tooltip title={issuesToolTipContent}>
                            <Badge 
                                count={criticalNodes + warningNodes} 
                                style={{ 
                                    backgroundColor: (criticalNodes + warningNodes) === 0 ? '#f5f5f5' : '#ff4d4f',
                                    color: (criticalNodes + warningNodes) === 0 ? '#999' : 'white',
                                    boxShadow: activeFilter === 'issues' ? '0 0 0 2px rgba(255, 77, 79, 0.2)' : 'none',
                                    cursor: 'pointer'
                                }}
                                onClick={() => setActiveFilter('issues')}
                            >
                                <Tag 
                                    icon={<FireOutlined />} 
                                    color={activeFilter === 'issues' ? 'error' : 'default'}
                                    style={{ 
                                        padding: '5px 8px', 
                                        fontSize: '13px',
                                        cursor: 'pointer',
                                        borderRadius: '16px',
                                        fontWeight: 500
                                    }}
                                    onClick={() => setActiveFilter('issues')}
                                >
                                    Issues
                                </Tag>
                            </Badge>
                        </Tooltip>
                    </div>
                    
                    {/* Sağ kısım - Veritabanı türleri */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
                        {databaseStats.map(db => (
                            <div
                                key={db.type}
                                style={{ 
                                    backgroundColor: activeFilter === db.type ? `${db.color}10` : '#f6f6f6',
                                    borderRadius: '40px',
                                    cursor: 'pointer',
                                    padding: '6px 12px 6px 10px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    border: activeFilter === db.type ? `1px solid ${db.color}` : '1px solid transparent',
                                    transition: 'all 0.2s ease',
                                    boxShadow: activeFilter === db.type ? `0 0 5px ${db.color}30` : 'none'
                                }}
                                onClick={() => setActiveFilter(db.type as FilterType)}
                            >
                                <div style={{ 
                                    marginRight: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    {db.type === 'mongodb' && <MongoIcon size="24" color={db.color} />}
                                    {db.type === 'postgresql' && <PostgresIcon size="24" color={db.color} />}
                                    {db.type === 'mssql' && <MssqlIcon size="24" color={db.color} />}
                                </div>
                                <div style={{ minWidth: '60px' }}>
                                    <div style={{ 
                                        display: 'flex', 
                                        justifyContent: 'space-between', 
                                        alignItems: 'center'
                                    }}>
                                        <span style={{ 
                                            fontSize: '14px', 
                                            fontWeight: 500,
                                            color: activeFilter === db.type ? db.color : '#444'
                                        }}>
                                            {db.type.charAt(0).toUpperCase() + db.type.slice(1)}
                                        </span>
                                        <span style={{ 
                                            fontSize: '15px', 
                                            fontWeight: 'bold',
                                            color: db.color,
                                            backgroundColor: activeFilter === db.type ? 'white' : 'transparent',
                                            borderRadius: '10px',
                                            padding: '0 6px',
                                            minWidth: '24px',
                                            textAlign: 'center',
                                            marginLeft: '8px'
                                        }}>
                                            {db.count}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    });

    if (loading && (data.mongodb || []).length === 0 && (data.postgresql || []).length === 0 && (data.mssql || []).length === 0) {
            return (
            <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                height: '100vh',
                flexDirection: 'column',
                gap: '16px'
            }}>
                <Spin size="large" />
                <div style={{ color: '#1890ff', fontSize: '14px' }}>Veriler yükleniyor...</div>
            </div>
        );
    }

    // Render both types of clusters mixed but sorted by priority
            return (
        <div style={{ padding: "20px" }}>
            {/* Üst başlık bölümü - tüm filtreleri ve veritabanı türlerini içerir */}
            <StatisticsPanel 
                stats={{
                    totalNodes: totalMongoNodes + totalPostgresNodes + totalMssqlNodes,
                    criticalNodes: totalCriticalNodes,
                    warningNodes: totalWarningNodes,
                    databaseStats: databaseStats
                }}
                criticalTooltipContent={
                <div style={{ maxWidth: '300px' }}>
                        {totalCriticalNodes > 0 && (
                        <div style={{ marginBottom: '8px' }}>
                                <div style={{ fontWeight: 'bold', color: '#ff4d4f' }}>Critical Nodes:</div>
                    {(criticalNodesDetails.mongodb || []).length > 0 && (
                                    <div style={{ marginLeft: '8px', marginTop: '4px' }}>
                            <div style={{ fontWeight: 'bold', color: '#4FAA41' }}>MongoDB:</div>
                            <ul style={{ margin: '4px 0 0 0', paddingLeft: '16px' }}>
                                {(criticalNodesDetails.mongodb || []).map((node, index) => (
                                    <li key={index}>
                                        <b>{node.hostname}</b>: {node.reason}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {(criticalNodesDetails.postgresql || []).length > 0 && (
                                    <div style={{ marginLeft: '8px', marginTop: '4px' }}>
                            <div style={{ fontWeight: 'bold', color: '#336791' }}>PostgreSQL:</div>
                            <ul style={{ margin: '4px 0 0 0', paddingLeft: '16px' }}>
                                {(criticalNodesDetails.postgresql || []).map((node, index) => (
                                    <li key={index}>
                                        <b>{node.hostname}</b>: {node.reason}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {(criticalNodesDetails.mssql || []).length > 0 && (
                                    <div style={{ marginLeft: '8px', marginTop: '4px' }}>
                            <div style={{ fontWeight: 'bold', color: '#CC2927' }}>MSSQL:</div>
                            <ul style={{ margin: '4px 0 0 0', paddingLeft: '16px' }}>
                                {(criticalNodesDetails.mssql || []).map((node, index) => (
                                    <li key={index}>
                                        <b>{node.hostname}</b>: {node.reason}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
                        )}
                    </div>
                }
                warningTooltipContent={
                <div style={{ maxWidth: '300px' }}>
                        {totalWarningNodes > 0 && (
                            <div>
                                <div style={{ fontWeight: 'bold', color: '#faad14' }}>Warning Issues ({totalWarningNodes}):</div>
                    {(warningNodesDetails.mongodb || []).length > 0 && (
                                    <div style={{ marginLeft: '8px', marginTop: '4px' }}>
                            <div style={{ fontWeight: 'bold', color: '#4FAA41' }}>MongoDB:</div>
                            <ul style={{ margin: '4px 0 0 0', paddingLeft: '16px' }}>
                                {(warningNodesDetails.mongodb || []).map((node, index) => (
                                    <li key={index}>
                                        <b>{node.hostname}</b>: {node.reason}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {(warningNodesDetails.postgresql || []).length > 0 && (
                                    <div style={{ marginLeft: '8px', marginTop: '4px' }}>
                            <div style={{ fontWeight: 'bold', color: '#336791' }}>PostgreSQL:</div>
                            <ul style={{ margin: '4px 0 0 0', paddingLeft: '16px' }}>
                                {(warningNodesDetails.postgresql || []).map((node, index) => (
                                    <li key={index}>
                                        <b>{node.hostname}</b>: {node.reason}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {(warningNodesDetails.mssql || []).length > 0 && (
                                    <div style={{ marginLeft: '8px', marginTop: '4px' }}>
                            <div style={{ fontWeight: 'bold', color: '#CC2927' }}>MSSQL:</div>
                            <ul style={{ margin: '4px 0 0 0', paddingLeft: '16px' }}>
                                {(warningNodesDetails.mssql || []).map((node, index) => (
                                    <li key={index}>
                                        <b>{node.hostname}</b>: {node.reason}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
                        )}
                    </div>
                }
                issuesToolTipContent={
                <div style={{ maxWidth: '300px' }}>
                    {totalCriticalNodes > 0 && (
                        <div style={{ marginBottom: '8px' }}>
                            <div style={{ fontWeight: 'bold', color: '#ff4d4f' }}>Critical Issues ({totalCriticalNodes}):</div>
                            {(criticalNodesDetails.mongodb || []).length > 0 && (
                                <div style={{ marginLeft: '8px', marginTop: '4px' }}>
                                    <div style={{ fontWeight: 'bold', color: '#4FAA41' }}>MongoDB:</div>
                                    <ul style={{ margin: '4px 0 0 0', paddingLeft: '16px' }}>
                                        {(criticalNodesDetails.mongodb || []).map((node, index) => (
                                            <li key={index}>
                                                <b>{node.hostname}</b>: {node.reason}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {(criticalNodesDetails.postgresql || []).length > 0 && (
                                <div style={{ marginLeft: '8px', marginTop: '4px' }}>
                                    <div style={{ fontWeight: 'bold', color: '#336791' }}>PostgreSQL:</div>
                                    <ul style={{ margin: '4px 0 0 0', paddingLeft: '16px' }}>
                                        {(criticalNodesDetails.postgresql || []).map((node, index) => (
                                            <li key={index}>
                                                <b>{node.hostname}</b>: {node.reason}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {(criticalNodesDetails.mssql || []).length > 0 && (
                                <div style={{ marginLeft: '8px', marginTop: '4px' }}>
                                    <div style={{ fontWeight: 'bold', color: '#CC2927' }}>MSSQL:</div>
                                    <ul style={{ margin: '4px 0 0 0', paddingLeft: '16px' }}>
                                        {(criticalNodesDetails.mssql || []).map((node, index) => (
                                            <li key={index}>
                                                <b>{node.hostname}</b>: {node.reason}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                    {totalWarningNodes > 0 && (
                        <div>
                            <div style={{ fontWeight: 'bold', color: '#faad14' }}>Warning Issues ({totalWarningNodes}):</div>
                            {(warningNodesDetails.mongodb || []).length > 0 && (
                                <div style={{ marginLeft: '8px', marginTop: '4px' }}>
                                    <div style={{ fontWeight: 'bold', color: '#4FAA41' }}>MongoDB:</div>
                                    <ul style={{ margin: '4px 0 0 0', paddingLeft: '16px' }}>
                                        {(warningNodesDetails.mongodb || []).map((node, index) => (
                                            <li key={index}>
                                                <b>{node.hostname}</b>: {node.reason}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {(warningNodesDetails.postgresql || []).length > 0 && (
                                <div style={{ marginLeft: '8px', marginTop: '4px' }}>
                                    <div style={{ fontWeight: 'bold', color: '#336791' }}>PostgreSQL:</div>
                                    <ul style={{ margin: '4px 0 0 0', paddingLeft: '16px' }}>
                                        {(warningNodesDetails.postgresql || []).map((node, index) => (
                                            <li key={index}>
                                                <b>{node.hostname}</b>: {node.reason}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {(warningNodesDetails.mssql || []).length > 0 && (
                                <div style={{ marginLeft: '8px', marginTop: '4px' }}>
                                    <div style={{ fontWeight: 'bold', color: '#CC2927' }}>MSSQL:</div>
                                    <ul style={{ margin: '4px 0 0 0', paddingLeft: '16px' }}>
                                        {(warningNodesDetails.mssql || []).map((node, index) => (
                                            <li key={index}>
                                                <b>{node.hostname}</b>: {node.reason}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                        </div>
                    }
                activeFilter={activeFilter} 
                setActiveFilter={setActiveFilter} 
            />
            
                  {/* Disconnected Agents Alert Banner */}
      {disconnectedAgents.length > 0 && (
        <Alert
          banner
          type="error"
          message={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <DisconnectOutlined style={{ fontSize: '16px', marginRight: '8px' }} />
                <span style={{ fontWeight: 'bold' }}>
                  {disconnectedAgents.length} {disconnectedAgents.length === 1 ? 'Agent' : 'Agents'} Disconnected
                </span>
              </div>
              <Popover
                content={
                  <div style={{ maxWidth: '350px' }}>
                    {disconnectedAgents.map((agent) => (
                      <div key={agent.id} style={{ 
                        padding: '8px',
                        borderBottom: '1px solid #f0f0f0',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px'
                      }}>
                        <div style={{ fontWeight: 'bold', color: '#cf1322', display: 'flex', alignItems: 'center' }}>
                          <DisconnectOutlined style={{ fontSize: '14px', marginRight: '6px' }} />
                          {agent.hostname}
                        </div>
                        <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div><b>IP:</b> {agent.ip}</div>
                          <div><b>Last Seen:</b> {formatLastSeen(agent.last_seen)}</div>
                          <div><b>Connection:</b> {agent.connection}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                }
                title="Disconnected Agents Details"
                trigger="hover"
                placement="bottomRight"
              >
                <InfoCircleOutlined style={{ fontSize: '16px', color: '#722ed1', marginLeft: '8px', cursor: 'pointer' }} />
              </Popover>
            </div>
          }
          style={{ marginBottom: '24px' }}
        />
      )}
            
            {/* Ana içerik bölümü - NodeStatusGrid bileşenleri */}
            <div style={{ marginTop: '24px' }}>
            {/* MongoDB Nodes (All) */}
            {(data.mongodb || []).length > 0 && (
                <NodeStatusGrid 
                    nodes={data.mongodb} 
                    title="MongoDB Nodes"
                    type="mongodb"
                    onStatusCount={handleMongoStatusCount}
                    activeFilter={activeFilter}
                    defaultExpanded={mongodbCritical > 0 || mongodbWarning > 0}
                    priorityFilter="all"
                    agentStatuses={agentStatuses}
                />
            )}
            
            {/* PostgreSQL Nodes (All) */}
            {(data.postgresql || []).length > 0 && (
                <NodeStatusGrid 
                    nodes={data.postgresql} 
                    title="PostgreSQL Nodes"
                    type="postgresql"
                    onStatusCount={handlePostgresStatusCount}
                    activeFilter={activeFilter}
                    onNodeClick={handlePostgresNodeClick}
                    defaultExpanded={postgresqlCritical > 0 || postgresqlWarning > 0}
                    priorityFilter="all"
                    agentStatuses={agentStatuses}
                />
            )}
            
            {/* MSSQL Nodes (All) */}
            {(data.mssql || []).length > 0 && (
                <NodeStatusGrid 
                    nodes={data.mssql} 
                    title="MSSQL Nodes"
                    type="mssql"
                    onStatusCount={handleMssqlStatusCount}
                    activeFilter={activeFilter}
                    defaultExpanded={mssqlCritical > 0 || mssqlWarning > 0}
                    priorityFilter="all"
                    agentStatuses={agentStatuses}
                />
            )}
            </div>
        </div>
    );
};

export default GeneralDashboard;
