import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Card, Table, Row, Col, Typography, message, Spin, Progress, Statistic, Popover, Tag, List, Button, Tooltip, Modal, Alert } from 'antd';
import { useDispatch } from 'react-redux';
import { NodeType } from '../type';
import { flattenMongoData, flattenPostgresData, flattenMssqlData } from '../data-utils';
import axios from 'axios';
import AddServiceDropdown from '../components/AddServiceDropdown';
import {
  CheckCircleFilled,
  CloseCircleFilled,
  ClusterOutlined,
  ApiOutlined,
  WarningOutlined,
  BellOutlined,
  RightOutlined,
  CheckOutlined,
  DatabaseOutlined,
  AlertOutlined,
  FileSearchOutlined,
  DisconnectOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import MongoIcon from '../icons/mongo';
import PostgresIcon from '../icons/postgresql';
import MssqlIcon from "../icons/mssql";
import HexagonGrid from '../components/HexagonGrid';
import AlwaysOnDashboard from '../components/AlwaysOnDashboard';
import './Dashboard.css';
import { useNavigate } from 'react-router-dom';
import { setSelectedMenuItem } from '../redux/redux';
import dayjs from 'dayjs';

const { Title } = Typography;

interface ClusterInfo {
  key: string;
  name: string;
  type: 'mongodb' | 'postgresql' | 'mssql';
  warning: number;
  critical: number;
  status: 'operational' | 'failed';
}

interface DashboardData {
  mongodb: NodeType[];
  postgresql: NodeType[];
  mssql: NodeType[];
}

interface Agent {
  connection: string;
  hostname: string;
  id: string;
  ip: string;
  last_seen: string;
  status: string;
  grpc_connected?: boolean; // gRPC bağlantısı var mı (sorgu gönderilebilir mi?)
}

interface Alarm {
  alarm_id: string;
  event_id: string;
  agent_id: string;
  status: string;
  metric_name: string;
  metric_value: string;
  message: string;
  severity: 'critical' | 'warning' | 'info';
  created_at: string;
}

interface RecommendationModalState {
  visible: boolean;
  alarm: Alarm | null;
  recommendation: string;
  title: string;
}

interface AlwaysOnModalState {
  visible: boolean;
  clusterName: string;
  alwaysOnData: any;
}

const shortenMssqlVersion = (version: string): string => {
  if (!version) return '';
  
  // Extract the main version number
  const versionMatch = version.match(/Microsoft SQL Server (\d+).*?(\d+\.\d+\.\d+\.\d+)/);
  if (versionMatch) {
    return `Microsoft SQL Server ${versionMatch[1]} (${versionMatch[2]})`;
  }
  
  // If we can't parse it, return a shorter version
  if (version.length > 50) {
    return version.substring(0, 50) + '...';
  }
  
  return version;
};

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [data, setData] = useState<DashboardData>({ mongodb: [], postgresql: [], mssql: [] });
  const [agentStatuses, setAgentStatuses] = useState<{ [key: string]: boolean }>({});
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [alarmsLoading, setAlarmsLoading] = useState(true);
  const [initialAlarmsLoad, setInitialAlarmsLoad] = useState(true);
  const [acknowledgedAlarms, setAcknowledgedAlarms] = useState<Set<string>>(new Set());
  const [failoverInfo, setFailoverInfo] = useState<{
    [key: string]: { message: string; acknowledged: boolean };
  }>({});
  const [promotionModalVisible, setPromotionModalVisible] = useState(false);
  const [promotingNode, setPromotingNode] = useState<NodeType | null>(null);
  const [promotionLoading, setPromotionLoading] = useState(false);
  const [recommendationModal, setRecommendationModal] = useState<RecommendationModalState>({
    visible: false,
    alarm: null,
    recommendation: "",
    title: ""
  });
  const [alwaysOnModal, setAlwaysOnModal] = useState<AlwaysOnModalState>({
    visible: false,
    clusterName: "",
    alwaysOnData: null
  });
  const [disconnectedAgents, setDisconnectedAgents] = useState<Agent[]>([]);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // Helper function to evaluate node status
  const evaluateNodeStatus = (node: NodeType, type: 'mongodb' | 'postgresql' | 'mssql') => {
    const nodeStatus = type === 'mongodb'
      ? (node.status || node.NodeStatus || 'N/A')
      : (node.NodeStatus || node.status || 'N/A');

    const mongoServiceStatus = type === 'mongodb' && node.MongoStatus
      ? node.MongoStatus
      : null;

    const pgServiceStatus = type === 'postgresql' && node.PGServiceStatus
      ? node.PGServiceStatus
      : null;

    const mssqlServiceStatus = type === 'mssql' && node.Status
      ? node.Status
      : null;

    let priority = 3; // Default (normal)

    // Check if service is running
    const serviceRunning = type === 'mongodb'
      ? mongoServiceStatus === 'RUNNING'
      : type === 'postgresql'
        ? pgServiceStatus === 'RUNNING'
        : mssqlServiceStatus === 'RUNNING';

    // Check if node status is healthy
    const isHealthyStatus =
      nodeStatus === "PRIMARY" ||
      nodeStatus === "MASTER" ||
      nodeStatus === "SECONDARY" ||
      nodeStatus === "SLAVE" ||
      (type === 'mssql' && node.HARole === "STANDALONE");

    // If service is not running, critical
    if (!serviceRunning && (mongoServiceStatus || pgServiceStatus || mssqlServiceStatus)) {
      priority = 1;
    }
    // Else if node is not in healthy state, critical
    else if (!isHealthyStatus) {
      priority = 1;
    }

    return priority;
  };

  // Fetch data from API
  const fetchData = async (isBackgroundUpdate = false) => {
    try {
      if (!isBackgroundUpdate) {
        setLoading(true);
      }

      const response = await fetch(
        `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/status/nodeshealth`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
          credentials: 'include'
        }
      );

      if (!response.ok) {
        throw new Error(`API response not ok: ${response.status} ${response.statusText}`);
      }

      const responseData = await response.json();

      // Handle response data - check for different API response formats
      if (responseData && responseData.status === "success") {
        // New API format with status and data fields
        const { postgresql, mongodb, mssql } = responseData.data || {};
        
        // Process each database type separately - handle null values
        const flattenedPostgres = postgresql ? flattenPostgresData(postgresql) : [];
        const flattenedMongo = mongodb ? flattenMongoData(mongodb) : [];
        const flattenedMssql = mssql ? flattenMssqlData(mssql) : [];

        setData({
          mongodb: flattenedMongo,
          postgresql: flattenedPostgres,
          mssql: flattenedMssql,
        });
      } else if (responseData && (responseData.postgresql || responseData.mongodb || responseData.mssql)) {
        // Direct API format - process each database type separately
        const flattenedPostgres = responseData.postgresql ? flattenPostgresData(responseData.postgresql) : [];
        const flattenedMongo = responseData.mongodb ? flattenMongoData(responseData.mongodb) : [];
        const flattenedMssql = responseData.mssql ? flattenMssqlData(responseData.mssql) : [];

        setData({
          mongodb: flattenedMongo,
          postgresql: flattenedPostgres,
          mssql: flattenedMssql,
        });
      } else {
        console.error("Invalid API response format:", responseData);
        if (!isBackgroundUpdate) {
          message.error("Veri alınırken hata oluştu. Geçersiz yanıt formatı.");
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      if (!isBackgroundUpdate) {
        message.error("Veriler alınırken bir hata oluştu.");
      }
    } finally {
      if (!isBackgroundUpdate) {
        setLoading(false);
      }
      if (initialLoad) {
        setInitialLoad(false);
      }
    }
  };

  // Agent durumlarını çek
  const fetchAgentStatuses = async () => {
    try {
      const token = localStorage.getItem('token');
      const agentResponse = await axios.get(
        `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/status/agents`,
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          withCredentials: true
        }
      );

      if (agentResponse.data?.status === "success" && Array.isArray(agentResponse.data?.data?.agents)) {
        const agentList = agentResponse.data.data.agents;
        const newAgentStatuses: { [key: string]: boolean } = {};
        const disconnectedList: Agent[] = [];

        agentList.forEach((agent: Agent) => {
          if (agent.hostname && agent.status) {
            const isActive = agent.status === "connected";
            newAgentStatuses[agent.hostname] = isActive;
            newAgentStatuses[agent.hostname.toLowerCase()] = isActive;
            
            // Add disconnected agents to the list
            if (!isActive) {
              disconnectedList.push(agent);
            }
          }
        });

        setAgentStatuses(newAgentStatuses);
        setDisconnectedAgents(disconnectedList);
      }
    } catch (error) {
      console.error('Error fetching agent statuses:', error);
    }
  };

  // Fetch alarms from API
  const fetchAlarms = async (isBackgroundUpdate = false) => {
    try {
      if (!isBackgroundUpdate) {
        setAlarmsLoading(true);
      }
      const token = localStorage.getItem('token');
      
      // Use the optimized recent alarms endpoint for dashboard
      const response = await axios.get(
        `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/status/alarms/recent?limit=4&unacknowledged=true`,
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          withCredentials: true
        }
      );

      if (response.data?.data?.alarms) {
        setAlarms(response.data.data.alarms);
      } else {
        setAlarms([]);
      }
    } catch (error) {
      console.error('Error fetching recent alarms:', error);
      if (!isBackgroundUpdate) {
        message.error('Son alarmlar alınırken bir hata oluştu.');
      }
      setAlarms([]);
    } finally {
      if (!isBackgroundUpdate) {
        setAlarmsLoading(false);
      }
      if (initialAlarmsLoad) {
        setInitialAlarmsLoad(false);
      }
    }
  };

  useEffect(() => {
    fetchData(false);
    fetchAgentStatuses();
    fetchAlarms(false);

    const intervalId = setInterval(() => {
      fetchData(true);
      fetchAgentStatuses();
      fetchAlarms(true);
    }, 10000);

    return () => clearInterval(intervalId);
  }, []);

  // Process clusters data
  const clustersData = useMemo(() => {
    const clusters: ClusterInfo[] = [];

    // Ensure data arrays exist before processing
    const mongoData = data.mongodb || [];
    const postgresData = data.postgresql || [];
    const mssqlData = data.mssql || [];

    // Process MongoDB clusters
    const mongoGroups = mongoData.reduce((acc, node) => {
      const clusterName = node.ClusterName || 'Unknown';
      if (!acc[clusterName]) {
        acc[clusterName] = [];
      }
      acc[clusterName].push(node);
      return acc;
    }, {} as Record<string, NodeType[]>);

    // Process PostgreSQL clusters
    const pgGroups = postgresData.reduce((acc, node) => {
      const clusterName = node.ClusterName || 'Unknown';
      if (!acc[clusterName]) {
        acc[clusterName] = [];
      }
      acc[clusterName].push(node);
      return acc;
    }, {} as Record<string, NodeType[]>);

    // Process MSSQL clusters
    const mssqlGroups = mssqlData.reduce((acc, node) => {
      const clusterName = node.ClusterName || 'Unknown';
      if (!acc[clusterName]) {
        acc[clusterName] = [];
      }
      acc[clusterName].push(node);
      return acc;
    }, {} as Record<string, NodeType[]>);

    // Add MongoDB clusters to the list
    Object.entries(mongoGroups).forEach(([name, nodes]) => {
      let criticalCount = 0;
      let warningCount = 0;

      nodes.forEach(node => {
        const priority = evaluateNodeStatus(node, 'mongodb');
        if (priority === 1) criticalCount++;
        else if (priority === 2) warningCount++;
      });

      clusters.push({
        key: `mongodb-${name}`,
        name,
        type: 'mongodb',
        warning: warningCount,
        critical: criticalCount,
        status: criticalCount > 0 ? 'failed' : 'operational'
      });
    });

    // Add PostgreSQL clusters to the list
    Object.entries(pgGroups).forEach(([name, nodes]) => {
      let criticalCount = 0;
      let warningCount = 0;

      nodes.forEach(node => {
        const priority = evaluateNodeStatus(node, 'postgresql');
        if (priority === 1) criticalCount++;
        else if (priority === 2) warningCount++;
      });

      clusters.push({
        key: `postgresql-${name}`,
        name,
        type: 'postgresql',
        warning: warningCount,
        critical: criticalCount,
        status: criticalCount > 0 ? 'failed' : 'operational'
      });
    });

    // Add MSSQL clusters to the list
    Object.entries(mssqlGroups).forEach(([name, nodes]) => {
      let criticalCount = 0;
      let warningCount = 0;

      nodes.forEach(node => {
        const priority = evaluateNodeStatus(node, 'mssql');
        if (priority === 1) criticalCount++;
        else if (priority === 2) warningCount++;
      });

      clusters.push({
        key: `mssql-${name}`,
        name,
        type: 'mssql',
        warning: warningCount,
        critical: criticalCount,
        status: criticalCount > 0 ? 'failed' : 'operational'
      });
    });

    return clusters;
  }, [data]);

  // Helper function to get cluster summary
  const getClusterSummary = (nodes: NodeType[], type: 'mongodb' | 'postgresql' | 'mssql') => {
    // Ensure nodes is an array
    const nodeArray = nodes || [];
    const total = nodeArray.length;
    const critical = nodeArray.filter(node => evaluateNodeStatus(node, type) === 1).length;
    const warning = nodeArray.filter(node => evaluateNodeStatus(node, type) === 2).length;
    const healthy = total - critical - warning;

    const onlineNodes = type === 'mongodb'
      ? nodeArray.filter(node => node.MongoStatus === 'RUNNING').length
      : type === 'postgresql'
        ? nodeArray.filter(node => node.PGServiceStatus === 'RUNNING').length
        : nodeArray.filter(node => node.Status === 'RUNNING').length;

    return {
      total,
      critical,
      warning,
      healthy,
      online: onlineNodes,
      offline: total - onlineNodes,
      status: critical > 0 ? 'Failed' : 'Operational'
    };
  };

  // Helper function to render node details in popover
  const renderNodeDetails = (nodes: NodeType[], type: 'mongodb' | 'postgresql' | 'mssql') => {
    // Ensure nodes is an array
    const nodeArray = nodes || [];
    const summary = getClusterSummary(nodeArray, type);

    return (
      <div style={{ maxWidth: '100%', paddingTop: '12px' }}>
        <div style={{
          padding: '16px',
          background: '#fafafa',
          borderRadius: '8px',
          marginBottom: '16px',
          border: '1px solid #f0f0f0'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
            padding: '0 0 12px 0',
            borderBottom: '1px dashed #d9d9d9'
          }}>
            <span style={{ fontWeight: 500 }}>Status</span>
            <Tag color={summary.status === 'Operational' ? 'success' : 'error'}>
              {summary.status}
            </Tag>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{
              padding: '12px',
              background: 'white',
              borderRadius: '6px',
              border: '1px solid #f0f0f0'
            }}>
              <div style={{ fontSize: '12px', color: '#8c8c8c', marginBottom: '4px' }}>Total Nodes</div>
              <div style={{ fontSize: '24px', fontWeight: '600', color: '#262626' }}>{summary.total}</div>
            </div>
            <div style={{
              padding: '12px',
              background: 'white',
              borderRadius: '6px',
              border: '1px solid #f0f0f0'
            }}>
              <div style={{ fontSize: '12px', color: '#8c8c8c', marginBottom: '4px' }}>Online</div>
              <div style={{
                fontSize: '24px',
                fontWeight: '600',
                color: '#52c41a',
                display: 'flex',
                alignItems: 'baseline',
                gap: '4px'
              }}>
                {summary.online}
                <span style={{ fontSize: '12px', color: '#8c8c8c', fontWeight: 'normal' }}>/ {summary.total}</span>
              </div>
            </div>
            <div style={{
              padding: '12px',
              background: 'white',
              borderRadius: '6px',
              border: '1px solid #f0f0f0'
            }}>
              <div style={{ fontSize: '12px', color: '#8c8c8c', marginBottom: '4px' }}>Healthy</div>
              <div style={{
                fontSize: '24px',
                fontWeight: '600',
                color: '#52c41a',
                display: 'flex',
                alignItems: 'baseline',
                gap: '4px'
              }}>
                {summary.healthy}
                <span style={{ fontSize: '12px', color: '#8c8c8c', fontWeight: 'normal' }}>/ {summary.total}</span>
              </div>
            </div>
            <div style={{
              padding: '12px',
              background: 'white',
              borderRadius: '6px',
              border: '1px solid #f0f0f0',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              <div>
                <div style={{ fontSize: '12px', color: '#8c8c8c' }}>Warning</div>
                <div style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#faad14'
                }}>{summary.warning}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#8c8c8c' }}>Critical</div>
                <div style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#f5222d'
                }}>{summary.critical}</div>
              </div>
            </div>
          </div>
        </div>
        <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '8px', color: '#666' }}>Node Details</div>
        {nodeArray.map((node, index) => (
          <div key={index} style={{
            padding: '12px',
            background: 'white',
            borderRadius: '6px',
            marginBottom: index < nodeArray.length - 1 ? '8px' : '0',
            border: '1px solid #f0f0f0'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '8px'
            }}>
              <span style={{
                fontWeight: 500,
                flex: '1',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>{node.Hostname}</span>
              <Tag color={
                evaluateNodeStatus(node, type) === 1 ? 'error' :
                  evaluateNodeStatus(node, type) === 2 ? 'warning' : 'success'
              }>
                {node.status || node.NodeStatus}
              </Tag>
            </div>
            <div style={{
              fontSize: '12px',
              color: '#8c8c8c',
              padding: '4px 8px',
              background: '#fafafa',
              borderRadius: '4px'
            }}>
              {node.MongoStatus && <div>Service: {node.MongoStatus} - Port: {node.port || node.Port}</div>}
              {node.PGServiceStatus && <div>Service: {node.PGServiceStatus}</div>}
              {node.Status && (
                <div>
                  Service: {node.Status}
                  {node.Port && <span> - Port: {node.Port}</span>}
                  {node.Edition && <div>Edition: {node.Edition}</div>}
                  {node.Version && <div>Version: {shortenMssqlVersion(node.Version)}</div>}
                  {node.IsHAEnabled && <div>HA Enabled: {node.IsHAEnabled ? 'Yes' : 'No'}</div>}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const clusterColumns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: ClusterInfo) => {
        const clusterNodes = record.type === 'mongodb'
          ? (data.mongodb || []).filter(node => node.ClusterName === text)
          : record.type === 'postgresql'
            ? (data.postgresql || []).filter(node => node.ClusterName === text)
            : (data.mssql || []).filter(node => node.ClusterName === text);

        return (
          <Popover
            content={renderNodeDetails(clusterNodes, record.type)}
            title={
              <div style={{
                margin: '-12px -16px',
                padding: '12px 16px',
                borderBottom: '1px solid #f0f0f0',
                background: (() => {
                  const summary = getClusterSummary(clusterNodes, record.type);
                  if (summary.critical > 0) return '#fff1f0';
                  if (summary.warning > 0) return '#fffbe6';
                  return '#f6ffed';
                })(),
                borderRadius: '8px 8px 0 0'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}>
                  {record.type === 'mongodb' ? (
                    <MongoIcon size="16" color="#00684A" />
                  ) : record.type === 'postgresql' ? (
                    <PostgresIcon size="16" color="#336791" />
                  ) : (
                    <MssqlIcon size="16" color="#CC2927" />
                  )}
                  <span style={{ fontWeight: 500 }}>Cluster Details - {text}</span>
                </div>
              </div>
            }
            overlayStyle={{
              width: '450px',
              maxWidth: '450px'
            }}
            placement="left"
            trigger="hover"
          >
            <div 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                cursor: (record.type === 'mssql' && isMssqlHAEnabled(record.name)) ? 'pointer' : 'default'
              }}
              onClick={(e) => {
                if (record.type === 'mssql' && isMssqlHAEnabled(record.name)) {
                  e.stopPropagation();
                  handleAlwaysOnClick(record.name);
                }
              }}
              title={record.type === 'mssql' && isMssqlHAEnabled(record.name) ? 'Click to view Always On Dashboard' : ''}
            >
              {record.type === 'mongodb' ? (
                <MongoIcon size="20" color="#00684A" />
              ) : record.type === 'postgresql' ? (
                <PostgresIcon size="20" color="#336791" />
              ) : (
                <MssqlIcon size="20" color="#CC2927" />
              )}
              <span>
                {text}
                {record.type === 'mssql' && isMssqlHAEnabled(record.name) && (
                  <span style={{ color: '#52c41a', fontSize: '12px', marginLeft: '8px' }}>
                    (Always On)
                  </span>
                )}
                {record.type === 'postgresql' && isPatroniEnabled(record.name) && (
                  <span style={{ color: '#336791', fontSize: '12px', marginLeft: '8px' }}>
                    (Managed by Patroni)
                  </span>
                )}
              </span>
            </div>
          </Popover>
        );
      },
    },
    {
      title: 'Warning',
      dataIndex: 'warning',
      key: 'warning',
      render: (count: number, record: ClusterInfo) => {
        if (count === 0) {
          return <span style={{ color: 'inherit' }}>{count}</span>;
        }

        // Get nodes with warning status
        const clusterNodes = record.type === 'mongodb'
          ? (data.mongodb || []).filter(node => node.ClusterName === record.name)
          : record.type === 'postgresql'
            ? (data.postgresql || []).filter(node => node.ClusterName === record.name)
            : (data.mssql || []).filter(node => node.ClusterName === record.name);

        const warningNodes = clusterNodes.filter(node =>
          evaluateNodeStatus(node, record.type) === 2
        );

        return (
          <Popover
            content={
              <div style={{ maxWidth: '300px' }}>

                <ul style={{ padding: '0 0 0 16px', margin: 0 }}>
                  {warningNodes.map((node, idx) => {
                    // Determine warning reason
                    let warningReason = 'Unknown warning state';
                    let warningDetails = '';

                    // For MongoDB specific warnings
                    if (record.type === 'mongodb') {
                      const nodeAny = node as any;
                      if (nodeAny.ReplicationStatus && nodeAny.ReplicationStatus !== 'OK') {
                        warningReason = 'Replication issue';
                        warningDetails = `Replication status: ${nodeAny.ReplicationStatus}`;
                      }
                      else if (nodeAny.ReplicationLagSec && Number(nodeAny.ReplicationLagSec) > 60) {
                        warningReason = 'High replication lag';
                        warningDetails = `Lag: ${nodeAny.ReplicationLagSec} seconds`;
                      }
                    }

                    // For PostgreSQL specific warnings
                    if (record.type === 'postgresql') {
                      const nodeAny = node as any;
                      if (nodeAny.WALArchiveStatus === 'FAILED') {
                        warningReason = 'WAL archiving failed';
                        warningDetails = 'WAL archive process is not functioning properly';
                      }
                    }

                    return (
                      <li key={idx} style={{ marginBottom: '12px' }}>
                        <b style={{ fontSize: '14px' }}>{node.Hostname || node.nodename}</b>
                        <div style={{
                          fontSize: '13px',
                          color: '#d48806',
                          marginTop: '4px',
                          background: '#fffbe6',
                          padding: '6px 10px',
                          borderRadius: '4px',
                          border: '1px solid #ffe58f'
                        }}>
                          <div style={{ fontWeight: 500 }}>{warningReason}</div>
                          <div style={{ fontSize: '12px', marginTop: '2px' }}>{warningDetails}</div>
                        </div>
                        <div style={{ fontSize: '12px', color: '#8c8c8c', marginTop: '4px' }}>
                          {node.status || node.NodeStatus ? `Role: ${node.status || node.NodeStatus}` : ''}
                          {node.IP ? ` • IP: ${node.IP}` : ''}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            }
            title={
              <span style={{ color: '#faad14' }}>
                {count} Warning {count === 1 ? 'Node' : 'Nodes'}
              </span>
            }
            placement="top"
            trigger="hover"
          >
            <span style={{
              color: '#faad14',
              cursor: 'pointer',
              padding: '2px 8px',
              background: '#fffbe6',
              borderRadius: '10px',
              border: '1px solid #ffe58f'
            }}>
              {count}
            </span>
          </Popover>
        );
      },
    },
    {
      title: 'Critical',
      dataIndex: 'critical',
      key: 'critical',
      render: (count: number, record: ClusterInfo) => {
        if (count === 0) {
          return <span style={{ color: 'inherit' }}>{count}</span>;
        }

        // Get nodes with critical status
        const clusterNodes = record.type === 'mongodb'
          ? (data.mongodb || []).filter(node => node.ClusterName === record.name)
          : record.type === 'postgresql'
            ? (data.postgresql || []).filter(node => node.ClusterName === record.name)
            : (data.mssql || []).filter(node => node.ClusterName === record.name);

        const criticalNodes = clusterNodes.filter(node =>
          evaluateNodeStatus(node, record.type) === 1
        );

        return (
          <Popover
            content={
              <div style={{ maxWidth: '300px' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>Critical Nodes:</div>
                <ul style={{ padding: '0 0 0 16px', margin: 0 }}>
                  {criticalNodes.map((node, idx) => {
                    // Determine critical reason
                    let criticalReason = 'Node in critical state';
                    let criticalDetails = '';

                    // Check for service status
                    const serviceStatus = node.MongoStatus || node.PGServiceStatus || node.Status;
                    if (serviceStatus && serviceStatus !== 'RUNNING') {
                      criticalReason = 'Service not running';
                      criticalDetails = `${record.type === 'mongodb' ? 'MongoDB' : record.type === 'postgresql' ? 'PostgreSQL' : 'MSSQL'} service status: ${serviceStatus}`;
                    }

                    // Check for node role/status
                    const nodeStatus = node.status || node.NodeStatus || node.Status;
                    const isHealthyStatus =
                      nodeStatus === "PRIMARY" ||
                      nodeStatus === "MASTER" ||
                      nodeStatus === "SECONDARY" ||
                      nodeStatus === "SLAVE" ||
                      (record.type === 'mssql' && node.HARole === "STANDALONE");

                    if (!isHealthyStatus && nodeStatus) {
                      criticalReason = 'Unhealthy node role';
                      criticalDetails = `Current role: ${nodeStatus} (expected: PRIMARY/SECONDARY/MASTER/SLAVE)`;
                    }

                    // For MongoDB specific reasons
                    if (record.type === 'mongodb') {
                      const nodeAny = node as any;
                      if (nodeAny.failoverState) {
                        criticalReason = 'Failover in progress';
                        criticalDetails = `${nodeAny.failoverState}`;
                      }
                    }

                    return (
                      <li key={idx} style={{ marginBottom: '12px' }}>
                        <b style={{ fontSize: '14px' }}>{node.Hostname || node.nodename}</b>
                        <div style={{
                          fontSize: '13px',
                          color: '#cf1322',
                          marginTop: '4px',
                          background: '#fff1f0',
                          padding: '6px 10px',
                          borderRadius: '4px',
                          border: '1px solid #ffccc7'
                        }}>
                          <div style={{ fontWeight: 500 }}>{criticalReason}</div>
                          <div style={{ fontSize: '12px', marginTop: '2px' }}>{criticalDetails}</div>
                        </div>
                        <div style={{ fontSize: '12px', color: '#8c8c8c', marginTop: '4px' }}>
                          {node.IP ? `IP: ${node.IP}` : ''}
                          {(node as any).Location ? ` • Location: ${(node as any).Location}` : ''}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            }
            title={
              <span style={{ color: '#f5222d' }}>
                {count} Critical {count === 1 ? 'Node' : 'Nodes'}
              </span>
            }
            placement="top"
            trigger="hover"
          >
            <span style={{
              color: '#f5222d',
              cursor: 'pointer',
              padding: '2px 8px',
              background: '#fff1f0',
              borderRadius: '10px',
              border: '1px solid #ffccc7'
            }}>
              {count}
            </span>
          </Popover>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: status === 'operational' ? '#52c41a' : '#f5222d',
            display: 'inline-block'
          }} />
          <span style={{ color: status === 'operational' ? '#52c41a' : '#f5222d' }}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
        </div>
      ),
    },
  ];

  // Calculate status statistics
  const statusStats = useMemo(() => {
    const clusters = clustersData || [];
    const total = clusters.length;
    const operational = clusters.filter(cluster => cluster.status === 'operational').length;
    const failed = total - operational;
    const operationalPercent = total > 0 ? Math.round((operational / total) * 100) : 0;

    return {
      total,
      operational,
      failed,
      operationalPercent
    };
  }, [clustersData]);

  // Helper function to format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);

    // UTC zamanını kullan, yerel saat dilimine çevirme
    return new Intl.DateTimeFormat('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC'  // UTC zamanını kullan
    }).format(date);
  };

  // Helper function to get severity icon
  const getSeverityIcon = (severity: string) => {
    const safeSeverity = (severity || 'info').toLowerCase();
    switch (safeSeverity) {
      case 'critical':
        return <CloseCircleFilled style={{ color: '#f5222d' }} />;
      case 'warning':
        return <WarningOutlined style={{ color: '#faad14' }} />;
      default:
        return <BellOutlined style={{ color: '#1890ff' }} />;
    }
  };

  // Acknowledge an alarm
  const handleAcknowledgeAlarm = (alarmId: string) => {
    setAcknowledgedAlarms(prev => new Set([...prev, alarmId]));
  };

  // Check if alarm is a MongoDB failover
  const isMongoFailover = (alarm: Alarm) => {
    return alarm && alarm.metric_name && alarm.metric_name.toLowerCase().includes('mongodb_failover');
  };

  // Extract failover node information from message
  const getFailoverInfo = (message: string) => {
    // Bu fonksiyonu alarm mesajınızın formatına göre özelleştirin
    // Örnek: "Failover occurred on node xyz from PRIMARY to SECONDARY"
    if (!message) return null;
    const matches = message.match(/node\s+(\S+)/i);
    return matches ? matches[1] : null;
  };

  // Render alarm content with optional failover info
  const renderAlarmContent = (alarm: Alarm) => {
    // Ensure alarm object and its properties exist
    if (!alarm) {
      return <div>Invalid alarm data</div>;
    }

    const isFailover = isMongoFailover(alarm);
    const failoverNode = isFailover ? getFailoverInfo(alarm.message || '') : null;
    const isAcknowledged = acknowledgedAlarms.has(alarm.alarm_id || '');

    // Kritik alarm türleri için öneriler
    const isCriticalAlarmType = (alarm.severity === 'critical') && (alarm.metric_name || '').includes && ((alarm.metric_name || '').includes('postgresql_service_status') ||
      (alarm.metric_name || '').includes('mssql_ag_health') ||
      (alarm.metric_name || '').includes('mongodb_service_status') ||
      (alarm.metric_name || '').includes('mssql_service_status'));

    // Recommendations özelliğini ekleyin
    const handleShowRecommendation = () => {
      let recommendation = "";
      let title = "";

      const metricName = alarm.metric_name || '';

      if (metricName.includes('postgresql_service_status')) {
        title = "PostgreSQL Service Issue Recommendation";
        recommendation =
          "1. Check if PostgreSQL service is running using: 'systemctl status postgresql'\n\n" +
          "2. If service is stopped, try restarting: 'systemctl restart postgresql'\n\n" +
          "3. Check PostgreSQL log files for errors: '/var/log/postgresql/postgresql-*.log' - You can also use ClusterEye's Log Analyzer tool to view and filter database logs\n\n" +
          "4. Verify disk space availability: 'df -h'\n\n" +
          "5. Check for connection issues with: 'pg_isready'\n\n" +
          "6. Ensure the data directory is accessible and has correct permissions";
      }
      else if (metricName.includes('mongodb_service_status')) {
        title = "MongoDB Service Issue Recommendation";
        recommendation =
          "1. Check if MongoDB service is running: 'systemctl status mongod'\n\n" +
          "2. If service is stopped, try restarting: 'systemctl restart mongod'\n\n" +
          "3. Check MongoDB log files: '/var/log/mongodb/mongod.log'\n\n" +
          "4. Verify disk space availability: 'df -h'\n\n" +
          "5. Ensure MongoDB ports are accessible: 'netstat -plnt | grep 27017'\n\n" +
          "6. Check MongoDB process: 'ps aux | grep mongod'";
      }
      else if (metricName.includes('mssql_service_status')) {
        title = "SQL Server Service Issue Recommendation";
        recommendation =
          "1. Check SQL Server service status in Services Management Console\n\n" +
          "2. Try restarting the SQL Server service\n\n" +
          "3. Check SQL Server error logs in SQL Server Configuration Manager\n\n" +
          "4. Verify disk space availability on all drives\n\n" +
          "5. Check for Windows Updates that might affect SQL Server\n\n" +
          "6. Verify SQL Server network connectivity using SQL Server Configuration Manager";
      }
      else if (metricName.includes('mssql_ag_health')) {
        title = "SQL Server AlwaysOn AG Issue Recommendation";
        recommendation =
          "1. Check the Availability Group status in SQL Server Management Studio\n\n" +
          "2. Verify network connectivity between all AG nodes\n\n" +
          "3. Check Windows Failover Cluster Manager for cluster status\n\n" +
          "4. Verify if the SQL Server service is running on all AG nodes\n\n" +
          "5. Check SQL Server error logs for AG-related errors\n\n" +
          "6. Run 'SELECT * FROM sys.dm_hadr_availability_group_states' to see AG state\n\n" +
          "7. Check for synchronization issues between replicas";
      }

      setRecommendationModal({
        visible: true,
        alarm,
        recommendation,
        title
      });
    };

    return (
      <div style={{ width: '100%' }}>
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
            {getSeverityIcon(alarm.severity)}
            <span style={{
              fontWeight: 500,
              color: '#262626'
            }}>{alarm.metric_name || 'Unknown metric'}</span>
          </div>
          <Tag color={
            (alarm.severity || 'info') === 'critical' ? 'error' :
              (alarm.severity || 'info') === 'warning' ? 'warning' : 'processing'
          }>
            {(alarm.severity || 'info').toUpperCase()}
          </Tag>
        </div>

        <div style={{
          fontSize: '14px',
          color: '#595959',
          marginBottom: '8px'
        }}>
          {(() => {
            const message = alarm.message || 'No message available';
            const metricName = alarm.metric_name || '';
            
            // Check if this is a long message or specific metric type
            const shouldTruncate = (
              metricName.includes('slow_queries') ||
              metricName.includes('deadlocks') ||
              metricName.includes('blocking') ||
              message.length > 150
            );

            if (shouldTruncate && message.length > 100) {
              return <div>{message.substring(0, 100)}...</div>;
            }
            
            return message;
          })()}
          {isFailover && !isAcknowledged && failoverNode && (
            <div style={{
              marginTop: '8px',
              padding: '8px',
              background: '#fffbe6',
              border: '1px solid #ffe58f',
              borderRadius: '4px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <span style={{ fontWeight: 500, color: '#d48806' }}>Failover Node: </span>
                <span>{failoverNode}</span>
              </div>
              <Tooltip title="Acknowledge">
                <Button
                  type="text"
                  icon={<CheckOutlined />}
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAcknowledgeAlarm(alarm.alarm_id);
                  }}
                  style={{ color: '#d48806' }}
                />
              </Tooltip>
            </div>
          )}

          {/* Kritik alarmlar için tavsiye butonu */}
          {isCriticalAlarmType && (
            <div style={{
              marginTop: '8px',
              padding: '8px',
              background: '#fff1f0',
              border: '1px solid #ffccc7',
              borderRadius: '4px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <span style={{ fontWeight: 500, color: '#cf1322' }}>Critical Issue: </span>
                <span>Review resolution steps</span>
              </div>
              <Button
                type="link"
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleShowRecommendation();
                }}
                style={{ color: '#cf1322' }}
              >
                Show recommendations
              </Button>
            </div>
          )}
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '12px',
          color: '#8c8c8c'
        }}>
          <div style={{ display: 'flex', gap: '16px' }}>
            <span>Value: {alarm.metric_value || 'N/A'}</span>
            <span>Node: {alarm.agent_id || 'Unknown'}</span>
          </div>
          <span>{formatDate(alarm.created_at || '')}</span>
        </div>
      </div>
    );
  };

  // MongoDB failover alarmlarını kontrol et ve state'i güncelle
  useEffect(() => {
    const newFailoverInfo: { [key: string]: { message: string; acknowledged: boolean } } = {};

    // Ensure alarms is an array before processing
    (alarms || []).forEach(alarm => {
      if (alarm.metric_name.toLowerCase().includes('mongodb_failover')) {
        // agent_id'den hostname'i çıkar (agent_ prefix'ini kaldır)
        const hostname = alarm.agent_id.replace('agent_', '');

        // Alarm mesajından node bilgisini çıkar
        const matches = alarm.message.match(/node\s+(\S+)/i);
        const nodeHostname = matches ? matches[1] : hostname;

        if (nodeHostname) {
          newFailoverInfo[nodeHostname] = {
            message: alarm.message,
            acknowledged: false
          };
        }
      }
    });

    setFailoverInfo(newFailoverInfo);
  }, [alarms]);

  // Failover bilgisini acknowledge et
  const handleAcknowledgeFailover = async (nodeId: string) => {
    try {
      // Mevcut alarmı bul - ensure alarms is an array
      const relevantAlarm = (alarms || []).find(alarm =>
        alarm.metric_name.toLowerCase().includes('mongodb_failover') &&
        alarm.agent_id.replace('agent_', '') === nodeId
      );

      if (relevantAlarm) {
        const token = localStorage.getItem('token');

        // API'ye acknowledge isteği gönder
        await axios.post(
          `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/status/alarms/${relevantAlarm.event_id}/acknowledge`,
          {},
          {
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            withCredentials: true
          }
        );

        // State'i güncelle
        setFailoverInfo(prev => ({
          ...prev,
          [nodeId]: {
            ...prev[nodeId],
            acknowledged: true
          }
        }));

        // Alarmları yeniden çek
        fetchAlarms();
      }
    } catch (error) {
      console.error('Error acknowledging alarm:', error);
      message.error('Alarm acknowledge edilirken bir hata oluştu.');
    }
  };

  // Promote MongoDB node to primary
  const handlePromoteNodeToPrimary = async (node: NodeType) => {
    setPromotingNode(node);
    setPromotionModalVisible(true);
  };

  // Confirm and execute promotion
  const confirmPromoteToPrimary = async () => {
    if (!promotingNode) return;

    try {
      setPromotionLoading(true);
      const token = localStorage.getItem('token');

      const response = await axios.post(
        `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/jobs/mongo/promote-primary`,
        {
          node_id: promotingNode.Hostname || promotingNode.nodename,
          cluster_name: promotingNode.ClusterName
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          withCredentials: true
        }
      );

      if (response.data && response.data.status === "success") {
        message.success(`Job created to promote ${promotingNode.Hostname || promotingNode.nodename} to PRIMARY`);
        // Navigate to jobs page to monitor the job
        dispatch(setSelectedMenuItem('jobs'));
        navigate('/jobs');
      } else {
        message.error('Failed to promote node to PRIMARY');
      }
    } catch (error) {
      console.error('Error promoting node to PRIMARY:', error);
      message.error('Failed to promote node to PRIMARY');
    } finally {
      setPromotionLoading(false);
      setPromotionModalVisible(false);
      setPromotingNode(null);
    }
  };

  const handleClustersClick = () => {
    dispatch(setSelectedMenuItem('clusters'));
    navigate('/dashboard');
  };

  const handleViewAllAlarmsClick = () => {
    dispatch(setSelectedMenuItem('alarms'));
    navigate('/alarms');
  };

  // Function to navigate to PostgreSQL Query Analyzer
  const handleLogAnalyzerNavigation = () => {
    dispatch(setSelectedMenuItem('postgresqueryanalyzer'));
    navigate('/logs');
  };

  // Check if MSSQL cluster has HA enabled
  const isMssqlHAEnabled = (clusterName: string) => {
    const mssqlNodes = (data.mssql || []).filter(node => node.ClusterName === clusterName);
    return mssqlNodes.some(node => node.IsHAEnabled === true);
  };

  // Check if PostgreSQL cluster has Patroni enabled
  const isPatroniEnabled = (clusterName: string) => {
    const postgresNodes = (data.postgresql || []).filter(node => node.ClusterName === clusterName);
    return postgresNodes.some(node => node.PatroniEnabled === true);
  };

  // Handle MSSQL Always On dashboard click
  const handleAlwaysOnClick = (clusterName: string) => {
    setAlwaysOnModal({
      visible: true,
      clusterName,
      alwaysOnData: null // We'll get fresh data in the modal render
    });
  };

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

  return (
    <div style={{ padding: '24px' }}>
      {/* Clusters Overview Section with Status */}
      <Card
        style={{
          marginBottom: '24px',
          border: '1px solid #d9d9d9',
          borderRadius: '8px',
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
            <ClusterOutlined style={{ fontSize: '24px', color: '#722ed1' }} />
            <Title level={4} style={{ margin: 0 }}>Clusters Overview</Title>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AddServiceDropdown 
              iconColor="#1890ff"
              hoverColor="#096dd9"
            />
            <Button
              type="link"
              icon={<RightOutlined />}
              onClick={handleClustersClick}
              style={{
                display: 'flex',
                alignItems: 'center',
                fontSize: '14px',
                padding: 0
              }}
            >
              Clusters
            </Button>
          </div>
        </div>
        <Spin spinning={initialLoad && loading}>
          <Row>
            {/* Status Overview */}
            <Col span={8} style={{
              borderRight: '1px solid #d9d9d9',
              paddingRight: '24px'
            }}>
              <div style={{
                textAlign: 'center',
                padding: '20px',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center'
              }}>
                <Progress
                  type="circle"
                  percent={statusStats.operationalPercent}
                  format={() => (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <span style={{ color: '#52c41a', fontSize: '28px', fontWeight: 'bold' }}>
                        {statusStats.operational}
                      </span>
                      <span style={{ fontSize: '14px', color: '#8c8c8c' }}>
                        of {statusStats.total}
                      </span>
                    </div>
                  )}
                  strokeColor={{
                    '0%': '#52c41a',
                    '100%': '#52c41a',
                  }}
                  strokeWidth={12}
                  size={180}
                  trailColor="#f0f0f0"
                />
                <Row gutter={16} style={{ marginTop: '24px' }}>
                  <Col span={12}>
                    <Statistic
                      title={<span style={{ fontSize: '14px', color: '#8c8c8c' }}>Operational</span>}
                      value={statusStats.operational}
                      valueStyle={{ color: '#52c41a', fontSize: '24px' }}
                      prefix={<CheckCircleFilled />}
                      suffix={<span style={{ fontSize: '14px', color: '#8c8c8c' }}>{`/${statusStats.total}`}</span>}
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic
                      title={<span style={{ fontSize: '14px', color: '#8c8c8c' }}>Failed</span>}
                      value={statusStats.failed}
                      valueStyle={{ color: '#f5222d', fontSize: '24px' }}
                      prefix={<CloseCircleFilled />}
                      suffix={<span style={{ fontSize: '14px', color: '#8c8c8c' }}>{`/${statusStats.total}`}</span>}
                    />
                  </Col>
                </Row>
              </div>
            </Col>

            {/* Clusters Table */}
            <Col span={16} style={{ paddingLeft: '24px' }}>
              <Table
                columns={clusterColumns}
                dataSource={clustersData || []}
                pagination={false}
                size="small"
                className="clusters-table"
                style={{
                  borderRadius: '8px',
                  background: 'white'
                }}
              />
            </Col>
          </Row>
        </Spin>
      </Card>

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

      <Row gutter={24} style={{ display: 'flex', marginBottom: '24px' }}>
        <Col span={16}>
          <Card
            style={{
              border: '1px solid #d9d9d9',
              borderRadius: '8px',
              height: '100%'
            }}
            className="dashboard-card"
          >
            <div style={{
              borderBottom: '1px solid #d9d9d9',
              marginBottom: '16px',
              paddingBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <ApiOutlined style={{ fontSize: '24px', color: '#722ed1' }} />
              <Title level={4} style={{ margin: 0 }}>Nodes Status</Title>
            </div>
            <Spin spinning={initialLoad && loading}>
              <Row>
                {/* Status Overview */}
                <Col span={8} style={{
                  borderRight: '1px solid #d9d9d9',
                  paddingRight: '24px',
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  <div style={{
                    textAlign: 'center',
                    padding: '20px',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center'
                  }}>
                    <Progress
                      type="circle"
                      percent={(() => {
                        const mongoNodes = data.mongodb || [];
                        const postgresNodes = data.postgresql || [];
                        const mssqlNodes = data.mssql || [];
                        const allNodes = [...mongoNodes, ...postgresNodes, ...mssqlNodes];
                        const total = allNodes.length;
                        const critical = allNodes.filter(
                          node => {
                            const nodeType = node.MongoStatus ? 'mongodb' : node.PGServiceStatus ? 'postgresql' : 'mssql';
                            return evaluateNodeStatus(node, nodeType) === 1;
                          }
                        ).length;
                        return total > 0 ? Math.round(((total - critical) / total) * 100) : 100;
                      })()}
                      format={() => (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <span style={{ color: '#52c41a', fontSize: '28px', fontWeight: 'bold' }}>
                            {(() => {
                              const mongoNodes = data.mongodb || [];
                              const postgresNodes = data.postgresql || [];
                              const mssqlNodes = data.mssql || [];
                              const allNodes = [...mongoNodes, ...postgresNodes, ...mssqlNodes];
                              return allNodes.filter(
                                node => {
                                  const nodeType = node.MongoStatus ? 'mongodb' : node.PGServiceStatus ? 'postgresql' : 'mssql';
                                  return evaluateNodeStatus(node, nodeType) !== 1;
                                }
                              ).length;
                            })()}
                          </span>
                          <span style={{ fontSize: '14px', color: '#8c8c8c' }}>
                            of {(() => {
                              const mongoNodes = data.mongodb || [];
                              const postgresNodes = data.postgresql || [];
                              const mssqlNodes = data.mssql || [];
                              const allNodes = [...mongoNodes, ...postgresNodes, ...mssqlNodes];
                              return allNodes.length;
                            })()}
                          </span>
                        </div>
                      )}
                      strokeColor={{
                        '0%': '#52c41a',
                        '100%': '#52c41a',
                      }}
                      strokeWidth={12}
                      size={180}
                      trailColor="#f0f0f0"
                    />
                    <Row gutter={16} style={{ marginTop: '24px' }}>
                      <Col span={12}>
                        <Statistic
                          title={<span style={{ fontSize: '14px', color: '#8c8c8c' }}>Operational</span>}
                          value={(() => {
                            const mongoNodes = data.mongodb || [];
                            const postgresNodes = data.postgresql || [];
                            const mssqlNodes = data.mssql || [];
                            const allNodes = [...mongoNodes, ...postgresNodes, ...mssqlNodes];
                            return allNodes.filter(
                              node => {
                                const nodeType = node.MongoStatus ? 'mongodb' : node.PGServiceStatus ? 'postgresql' : 'mssql';
                                return evaluateNodeStatus(node, nodeType) !== 1;
                              }
                            ).length;
                          })()}
                          valueStyle={{ color: '#52c41a', fontSize: '24px' }}
                          prefix={<CheckCircleFilled />}
                          suffix={
                            <span style={{ fontSize: '14px', color: '#8c8c8c' }}>
                              /{(() => {
                                const mongoNodes = data.mongodb || [];
                                const postgresNodes = data.postgresql || [];
                                const mssqlNodes = data.mssql || [];
                                const allNodes = [...mongoNodes, ...postgresNodes, ...mssqlNodes];
                                return allNodes.length;
                              })()}
                            </span>
                          }
                        />
                      </Col>
                      <Col span={12}>
                        <Statistic
                          title={<span style={{ fontSize: '14px', color: '#8c8c8c' }}>Failed</span>}
                          value={(() => {
                            const mongoNodes = data.mongodb || [];
                            const postgresNodes = data.postgresql || [];
                            const mssqlNodes = data.mssql || [];
                            const allNodes = [...mongoNodes, ...postgresNodes, ...mssqlNodes];
                            return allNodes.filter(
                              node => {
                                const nodeType = node.MongoStatus ? 'mongodb' : node.PGServiceStatus ? 'postgresql' : 'mssql';
                                return evaluateNodeStatus(node, nodeType) === 1;
                              }
                            ).length;
                          })()}
                          valueStyle={{ color: '#f5222d', fontSize: '24px' }}
                          prefix={<CloseCircleFilled />}
                          suffix={
                            <span style={{ fontSize: '14px', color: '#8c8c8c' }}>
                              /{(() => {
                                const mongoNodes = data.mongodb || [];
                                const postgresNodes = data.postgresql || [];
                                const mssqlNodes = data.mssql || [];
                                const allNodes = [...mongoNodes, ...postgresNodes, ...mssqlNodes];
                                return allNodes.length;
                              })()}
                            </span>
                          }
                        />
                      </Col>
                    </Row>
                  </div>
                </Col>

                {/* Hexagon Grid */}
                <Col span={16} style={{ paddingLeft: '24px' }}>
                  <div style={{
                    height: '400px',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    margin: '20px 0'
                  }}>
                    <HexagonGrid
                      nodes={[...(data.mongodb || []), ...(data.postgresql || []), ...(data.mssql || [])]}
                      gridWidth={500}
                      gridHeight={300}
                      agentStatuses={agentStatuses || {}}
                      failoverInfo={failoverInfo || {}}
                      onAcknowledgeFailover={handleAcknowledgeFailover}
                    />
                  </div>
                </Col>
              </Row>
            </Spin>
          </Card>
        </Col>

        {/* Recent Alarms Section */}
        <Col span={8}>
          <Card
            style={{
              border: '1px solid #d9d9d9',
              borderRadius: '8px',
              height: '100%'
            }}
            styles={{
              body: {
                height: 'calc(100% - 57px)', // Header height (57px) çıkarıldı
                display: 'flex',
                flexDirection: 'column'
              }
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
                <BellOutlined style={{ fontSize: '24px', color: '#722ed1' }} />
                <Title level={4} style={{ margin: 0 }}>Recent Alarms</Title>
              </div>
              {(alarms && alarms.length > 0) && (
                <Button
                  type="link"
                  icon={<RightOutlined />}
                  onClick={handleViewAllAlarmsClick}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: '14px',
                    padding: 0
                  }}
                >
                  View All
                </Button>
              )}
            </div>
            <Spin spinning={initialAlarmsLoad && alarmsLoading} style={{ flex: 1 }}>
              <List
                style={{
                  height: 'calc(100% - 24px)',
                  overflowY: 'auto'
                }}
                dataSource={alarms || []}
                renderItem={(alarm) => (
                  <List.Item
                    style={{
                      padding: '12px',
                      background: '#fafafa',
                      borderRadius: '8px',
                      marginBottom: '8px',
                      border: '1px solid #f0f0f0'
                    }}
                  >
                    {renderAlarmContent(alarm)}
                  </List.Item>
                )}
                locale={{
                  emptyText: (
                    <div style={{
                      padding: '24px',
                      textAlign: 'center',
                      color: '#8c8c8c'
                    }}>
                      <BellOutlined style={{ fontSize: '24px', marginBottom: '8px' }} />
                      <div>No active alarms</div>
                    </div>
                  )
                }}
              />
            </Spin>
          </Card>
        </Col>
      </Row>

      {/* Primary Promotion Confirmation Modal */}
      <Modal
        title="Promote to Primary Confirmation"
        open={promotionModalVisible}
        onOk={confirmPromoteToPrimary}
        confirmLoading={promotionLoading}
        onCancel={() => setPromotionModalVisible(false)}
      >
        <p>Are you sure you want to promote {promotingNode?.Hostname || promotingNode?.nodename} to PRIMARY?</p>
        <p>This will trigger a failover in the MongoDB cluster.</p>
      </Modal>

      {/* Recommendation Modal */}
      <Modal
        title={
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: 'white'
          }}>
            {recommendationModal.title && recommendationModal.title.includes('PostgreSQL') ? (
              <DatabaseOutlined style={{ fontSize: '20px' }} />
            ) : recommendationModal.title && recommendationModal.title.includes('MongoDB') ? (
              <DatabaseOutlined style={{ fontSize: '20px' }} />
            ) : recommendationModal.title && recommendationModal.title.includes('SQL Server') ? (
              <DatabaseOutlined style={{ fontSize: '20px' }} />
            ) : (
              <AlertOutlined style={{ fontSize: '20px' }} />
            )}
            <span>{recommendationModal.title}</span>
          </div>
        }
        open={recommendationModal.visible}
        onCancel={() => setRecommendationModal(prev => ({ ...prev, visible: false }))}
        footer={[
          <Button
            key="close"
            type="primary"
            size="large"
            onClick={() => setRecommendationModal(prev => ({ ...prev, visible: false }))}
            style={{
              width: '120px',
              height: '40px',
              borderRadius: '4px',
              fontWeight: 'bold'
            }}
          >
            Understood
          </Button>
        ]}
        width={700}
        styles={{
          header: {
            background: recommendationModal.title && recommendationModal.title.includes('PostgreSQL') ?
              'linear-gradient(90deg, #336791 0%, #0D4E81 100%)' :
              recommendationModal.title && recommendationModal.title.includes('MongoDB') ?
                'linear-gradient(90deg, #13AA52 0%, #006643 100%)' :
                recommendationModal.title && recommendationModal.title.includes('SQL Server') ?
                  'linear-gradient(90deg, #CC2927 0%, #8F1F1E 100%)' :
                  'linear-gradient(90deg, #722ED1 0%, #4A148C 100%)',
            borderBottom: 'none',
            borderRadius: '8px 8px 0 0',
            padding: '16px 24px',
            color: 'white'
          },
          content: {
            padding: '24px'
          },
          footer: {
            borderTop: 'none',
            padding: '0 24px 24px 24px',
            display: 'flex',
            justifyContent: 'flex-end'
          },
          body: {
            padding: '0'
          }
        }}
      >
        <div style={{
          padding: '0 0 10px 0',
          marginBottom: '20px',
          borderBottom: '1px solid #f0f0f0'
        }}>
          <Alert
            message="Critical Service Issue Detected"
            description={
              <span>
                This is a high-priority alert that requires immediate attention.
                The following steps will help you diagnose and resolve the issue.
              </span>
            }
            type="error"
            showIcon
            style={{
              marginBottom: '16px',
              borderLeft: '4px solid #ff4d4f'
            }}
          />
        </div>

        <div style={{
          whiteSpace: 'pre-wrap',
          fontSize: '14px',
          lineHeight: '1.8',
          maxHeight: '60vh',
          overflow: 'auto',
          padding: '0 10px'
        }}>
          {recommendationModal.recommendation.split('\n\n').map((paragraph, index) => {
            // Check if this is a numbered instruction
            const instructionMatch = paragraph.match(/^(\d+)\.\s+(.*)/);

            if (instructionMatch) {
              // This is a numbered instruction
              const [_, number, text] = instructionMatch;

              // Check if this is the PostgreSQL log files instruction with Log Analyzer mention
              const isLogAnalyzerInstruction =
                number === "3" &&
                text.includes("PostgreSQL log files") &&
                text.includes("Log Analyzer");

              return (
                <div
                  key={index}
                  style={{
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px'
                  }}
                >
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: recommendationModal.title && recommendationModal.title.includes('PostgreSQL') ?
                      '#336791' :
                      recommendationModal.title && recommendationModal.title.includes('MongoDB') ?
                        '#13AA52' :
                        recommendationModal.title && recommendationModal.title.includes('SQL Server') ?
                          '#CC2927' :
                          '#722ED1',
                    color: 'white',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    fontWeight: 'bold',
                    fontSize: '14px',
                    flexShrink: 0
                  }}>
                    {number}
                  </div>
                  <div style={{
                    padding: '12px',
                    backgroundColor: '#f9f9fb',
                    borderRadius: '4px',
                    border: '1px solid #eee',
                    flexGrow: 1,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                  }}>
                    {text}

                    {isLogAnalyzerInstruction && (
                      <div style={{ marginTop: '12px' }}>
                        <Button
                          type="primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLogAnalyzerNavigation();
                          }}
                          icon={<FileSearchOutlined />}
                          style={{
                            background: '#336791',
                            borderColor: '#336791'
                          }}
                        >
                          Open PostgreSQL Log Analyzer
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            } else {
              // This is a regular paragraph
              return (
                <p key={index} style={{ marginBottom: '16px' }}>
                  {paragraph}
                </p>
              );
            }
          })}
        </div>
      </Modal>

      {/* Always On Dashboard Modal */}
      <Modal
        title={
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: 'white'
          }}>
            <MssqlIcon size="20" color="white" />
            <span>SQL Server Always On Dashboard - {alwaysOnModal.clusterName}</span>
          </div>
        }
        open={alwaysOnModal.visible}
        onCancel={() => setAlwaysOnModal(prev => ({ ...prev, visible: false }))}
        footer={null}
        width={1200}
        styles={{
          header: {
            background: 'linear-gradient(90deg, #CC2927 0%, #8F1F1E 100%)',
            borderBottom: 'none',
            borderRadius: '8px 8px 0 0',
            padding: '16px 24px',
            color: 'white'
          },
          content: {
            padding: '0'
          },
          body: {
            padding: '24px',
            maxHeight: '80vh',
            overflow: 'auto'
          }
        }}
      >
        {alwaysOnModal.visible && (() => {
          // Get fresh data every time modal renders
          const mssqlNodes = (data.mssql || []).filter(node => node.ClusterName === alwaysOnModal.clusterName);
          const haEnabledNode = mssqlNodes.find(node => node.IsHAEnabled === true && node.AlwaysOnMetrics);
          
          if (haEnabledNode && haEnabledNode.AlwaysOnMetrics) {
            return (
              <AlwaysOnDashboard 
                data={haEnabledNode.AlwaysOnMetrics} 
                clusterName={alwaysOnModal.clusterName}
              />
            );
          } else {
            return (
              <div style={{ 
                padding: '40px', 
                textAlign: 'center', 
                color: '#8c8c8c' 
              }}>
                <DatabaseOutlined style={{ fontSize: '48px', marginBottom: '16px' }} />
                <div>No Always On data available for this cluster</div>
              </div>
            );
          }
        })()}
      </Modal>
    </div>
  );
};

export default Dashboard; 