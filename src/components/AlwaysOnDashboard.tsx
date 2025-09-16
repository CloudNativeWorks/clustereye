import React, { useMemo, useState, useEffect } from 'react';
import { Card, Row, Col, Table, Tag, Progress, Statistic, Typography, Space, Alert, Tooltip } from 'antd';
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
  DatabaseOutlined,
  CloudServerOutlined,
  SyncOutlined,
  ClusterOutlined,
  GlobalOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

interface AlwaysOnData {
  Replicas: Array<{
    Role: string;
    JoinState: string;
    ReplicaName: string;
    FailoverMode: string;
    SuspendReason: string;
    ConnectedState: boolean;
    ConnectionState: string;
    AvailabilityMode: string;
    SynchronizationMode: string;
  }>;
  Databases: Array<{
    EndOfLogLsn: string;
    RecoveryLsn: string;
    RedoQueueKb: number;
    ReplicaName: string;
    DatabaseName: string;
    LastSentTime: string;
    LastCommitLsn: string;
    SuspendReason: string;
    TruncationLsn: string;
    LastCommitTime: string;
    LastRedoneTime: string;
    LogSendQueueKb: number;
    LastHardenedTime: string;
    LastReceivedTime: string;
    RedoRateKbPerSec: number;
    LogSendRateKbPerSec: number;
    SynchronizationState: string;
  }>;
  LocalRole: string;
  ClusterName: string;
  HealthState: string;
  RedoQueueKb: number;
  FailoverMode: string;
  LogSendQueueKb: number;
  PrimaryReplica: string;
  LastFailoverTime: string;
  OperationalState: string;
  ReplicationLagMs: number;
  SynchronizationMode: string;
  Listeners?: Array<{
    Port: number;
    DnsName: string;
    SubnetMask: string;
    IpAddresses: string[] | null;
    ListenerName: string;
    ListenerState: string;
  }>;
}

interface AlwaysOnDashboardProps {
  data: AlwaysOnData;
  clusterName: string;
}

const AlwaysOnDashboard: React.FC<AlwaysOnDashboardProps> = ({ data, clusterName }) => {
  // State for last update time
  const [lastUpdateTime, setLastUpdateTime] = useState<Date>(new Date());
  const [, forceUpdate] = useState({});

  // Update last update time when data changes
  useEffect(() => {
    setLastUpdateTime(new Date());
  }, [data]);

  // Timer to update the "last updated" display every second
  useEffect(() => {
    const timer = setInterval(() => {
      forceUpdate({});
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Helper function to format last update time
  const formatLastUpdate = (date: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 10) return 'Just now';
    if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    return date.toLocaleTimeString('tr-TR');
  };

  // Helper function to get status color
  const getStatusColor = (status: string) => {
    const normalizedStatus = status?.toLowerCase();
    switch (normalizedStatus) {
      case 'connected':
      case 'synchronized':
      case 'healthy':
      case 'primary':
        return 'success';
      case 'synchronizing':
      case 'secondary':
        return 'processing';
      case 'disconnected':
      case 'not_synchronized':
      case 'unhealthy':
        return 'error';
      default:
        return 'default';
    }
  };

  // Helper function to get role icon
  const getRoleIcon = (role: string) => {
    switch (role?.toUpperCase()) {
      case 'PRIMARY':
        return <ClusterOutlined style={{ color: '#52c41a' }} />;
      case 'SECONDARY':
        return <CloudServerOutlined style={{ color: '#1890ff' }} />;
      default:
        return <DatabaseOutlined style={{ color: '#8c8c8c' }} />;
    }
  };

  // Calculate overall statistics
  const stats = useMemo(() => {
    const totalReplicas = data.Replicas?.length || 0;
    const connectedReplicas = data.Replicas?.filter(r => r.ConnectedState).length || 0;
    const healthyReplicas = data.Replicas?.filter(r => r.ConnectionState === 'CONNECTED').length || 0;
    
    const totalDatabases = data.Databases?.length || 0;
    const synchronizedDatabases = data.Databases?.filter(d => d.SynchronizationState === 'SYNCHRONIZED').length || 0;
    
    const totalRedoQueue = data.Databases?.reduce((sum, db) => sum + (db.RedoQueueKb || 0), 0) || 0;
    const totalLogSendQueue = data.Databases?.reduce((sum, db) => sum + (db.LogSendQueueKb || 0), 0) || 0;

    return {
      totalReplicas,
      connectedReplicas,
      healthyReplicas,
      totalDatabases,
      synchronizedDatabases,
      totalRedoQueue,
      totalLogSendQueue,
      healthPercent: totalReplicas > 0 ? Math.round((healthyReplicas / totalReplicas) * 100) : 100
    };
  }, [data]);

  // Replica columns for table
  const replicaColumns = [
    {
      title: 'Replica Name',
      dataIndex: 'ReplicaName',
      key: 'ReplicaName',
      render: (text: string, record: any) => (
        <Space>
          {getRoleIcon(record.Role)}
          <span style={{ fontWeight: 500 }}>{text}</span>
          <Tag color={record.Role === 'PRIMARY' ? 'gold' : 'blue'}>
            {record.Role}
          </Tag>
        </Space>
      ),
    },
    {
      title: 'Connection State',
      dataIndex: 'ConnectionState',
      key: 'ConnectionState',
      render: (state: string, record: any) => (
        <Space>
          <Tag 
            color={getStatusColor(state)}
            icon={record.ConnectedState ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
          >
            {state}
          </Tag>
        </Space>
      ),
    },
    {
      title: 'Availability Mode',
      dataIndex: 'AvailabilityMode',
      key: 'AvailabilityMode',
      render: (mode: string) => (
        <Tag color={mode === 'SYNCHRONOUS_COMMIT' ? 'green' : 'orange'}>
          {mode?.replace('_', ' ')}
        </Tag>
      ),
    },
    {
      title: 'Failover Mode',
      dataIndex: 'FailoverMode',
      key: 'FailoverMode',
      render: (mode: string) => (
        <Tag color={mode === 'AUTOMATIC' ? 'green' : 'blue'}>
          {mode}
        </Tag>
      ),
    },
    {
      title: 'Sync Mode',
      dataIndex: 'SynchronizationMode',
      key: 'SynchronizationMode',
      render: (mode: string) => (
        <Tag color={mode === 'SYNCHRONOUS_COMMIT' ? 'green' : 'orange'}>
          {mode?.replace('_', ' ')}
        </Tag>
      ),
    },
  ];

  // Database columns for table
  const databaseColumns = [
    {
      title: 'Database Name',
      dataIndex: 'DatabaseName',
      key: 'DatabaseName',
      render: (text: string) => (
        <Space>
          <DatabaseOutlined style={{ color: '#1890ff' }} />
          <span style={{ fontWeight: 500 }}>{text}</span>
        </Space>
      ),
    },
    {
      title: 'Replica',
      dataIndex: 'ReplicaName',
      key: 'ReplicaName',
    },
    {
      title: 'Sync State',
      dataIndex: 'SynchronizationState',
      key: 'SynchronizationState',
      render: (state: string) => (
        <Tag 
          color={getStatusColor(state)}
          icon={state === 'SYNCHRONIZED' ? <CheckCircleOutlined /> : <SyncOutlined spin />}
        >
          {state}
        </Tag>
      ),
    },
    {
      title: 'Redo Queue (KB)',
      dataIndex: 'RedoQueueKb',
      key: 'RedoQueueKb',
      render: (value: number) => (
        <Text type={value > 0 ? 'warning' : undefined}>
          {value?.toLocaleString() || 0}
        </Text>
      ),
    },
    {
      title: 'Log Send Queue (KB)',
      dataIndex: 'LogSendQueueKb',
      key: 'LogSendQueueKb',
      render: (value: number) => (
        <Text type={value > 0 ? 'warning' : undefined}>
          {value?.toLocaleString() || 0}
        </Text>
      ),
    },
    {
      title: 'Redo Rate (KB/s)',
      dataIndex: 'RedoRateKbPerSec',
      key: 'RedoRateKbPerSec',
      render: (value: number) => value?.toLocaleString() || 0,
    },
    {
      title: 'Log Send Rate (KB/s)',
      dataIndex: 'LogSendRateKbPerSec',
      key: 'LogSendRateKbPerSec',
      render: (value: number) => value?.toLocaleString() || 0,
    },
  ];

  // Listener columns for table
  const listenerColumns = [
    {
      title: 'Listener Name',
      dataIndex: 'ListenerName',
      key: 'ListenerName',
      render: (text: string) => (
        <Space>
          <GlobalOutlined style={{ color: '#1890ff' }} />
          <span style={{ fontWeight: 500 }}>{text}</span>
        </Space>
      ),
    },
    {
      title: 'DNS Name',
      dataIndex: 'DnsName',
      key: 'DnsName',
    },
    {
      title: 'Port',
      dataIndex: 'Port',
      key: 'Port',
      render: (port: number) => (
        <Tag color="blue">{port}</Tag>
      ),
    },
    {
      title: 'State',
      dataIndex: 'ListenerState',
      key: 'ListenerState',
      render: (state: string) => (
        <Tag 
          color={state === 'ONLINE' ? 'success' : 'error'}
          icon={state === 'ONLINE' ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
        >
          {state}
        </Tag>
      ),
    },
    {
      title: 'IP Addresses',
      dataIndex: 'IpAddresses',
      key: 'IpAddresses',
      render: (ips: string[] | null) => {
        if (!ips || ips.length === 0) {
          return <Text type="secondary">N/A</Text>;
        }
        return (
          <Space direction="vertical" size={0}>
            {ips.map((ip, index) => (
              <Text key={index} code>{ip}</Text>
            ))}
          </Space>
        );
      },
    },
    {
      title: 'Subnet Mask',
      dataIndex: 'SubnetMask',
      key: 'SubnetMask',
      render: (mask: string) => mask || <Text type="secondary">N/A</Text>,
    },
  ];

  return (
    <div style={{ padding: '0' }}>
      {/* Overall Health Alert */}
      <Alert
        message={`Availability Group Health: ${data.HealthState || 'Unknown'}`}
        description={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Text>Primary Replica: {data.PrimaryReplica || 'Unknown'} | </Text>
              <Text>Local Role: {data.LocalRole || 'Unknown'}</Text>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ClockCircleOutlined style={{ color: '#8c8c8c' }} />
              <Tooltip title={
                <div>
                  <div>Last updated at {lastUpdateTime.toLocaleString('tr-TR')}</div>
                  <div style={{ fontSize: '11px', marginTop: '4px' }}>
                    Auto-refreshes every 10 seconds
                  </div>
                </div>
              }>
                <Text type="secondary" style={{ fontSize: '12px', cursor: 'help' }}>
                  Last updated: {formatLastUpdate(lastUpdateTime)}
                </Text>
              </Tooltip>
            </div>
          </div>
        }
        type={data.HealthState === 'HEALTHY' ? 'success' : 'warning'}
        showIcon
        style={{ marginBottom: '24px' }}
      />

      {/* Statistics Overview */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Replica Health"
              value={stats.healthPercent}
              suffix="%"
              prefix={<ClusterOutlined />}
              valueStyle={{ color: stats.healthPercent >= 100 ? '#52c41a' : '#faad14' }}
            />
            <div style={{ fontSize: '12px', color: '#8c8c8c', marginTop: '4px' }}>
              {stats.healthyReplicas}/{stats.totalReplicas} replicas healthy
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Database Sync"
              value={stats.totalDatabases > 0 ? Math.round((stats.synchronizedDatabases / stats.totalDatabases) * 100) : 100}
              suffix="%"
              prefix={<DatabaseOutlined />}
              valueStyle={{ color: stats.synchronizedDatabases === stats.totalDatabases ? '#52c41a' : '#faad14' }}
            />
            <div style={{ fontSize: '12px', color: '#8c8c8c', marginTop: '4px' }}>
              {stats.synchronizedDatabases}/{stats.totalDatabases} databases synced
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Total Redo Queue"
              value={stats.totalRedoQueue}
              suffix="KB"
              prefix={<SyncOutlined />}
              valueStyle={{ color: stats.totalRedoQueue > 1000 ? '#faad14' : '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Total Log Send Queue"
              value={stats.totalLogSendQueue}
              suffix="KB"
              prefix={<SyncOutlined />}
              valueStyle={{ color: stats.totalLogSendQueue > 1000 ? '#faad14' : '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Replicas Table */}
      <Card 
        title={
          <Space>
            <ClusterOutlined style={{ color: '#CC2927' }} />
            <span>Availability Group Replicas</span>
          </Space>
        }
        style={{ marginBottom: '24px' }}
        size="small"
      >
        <Table
          columns={replicaColumns}
          dataSource={data.Replicas || []}
          pagination={false}
          size="small"
          rowKey="ReplicaName"
        />
      </Card>

      {/* Databases Table */}
      <Card 
        title={
          <Space>
            <DatabaseOutlined style={{ color: '#CC2927' }} />
            <span>Database Synchronization Status</span>
          </Space>
        }
        size="small"
      >
        <Table
          columns={databaseColumns}
          dataSource={data.Databases || []}
          pagination={false}
          size="small"
          rowKey={(record) => `${record.DatabaseName}-${record.ReplicaName}`}
        />
      </Card>

      {/* Listeners Table */}
      {data.Listeners && data.Listeners.length > 0 && (
        <Card 
          title={
            <Space>
              <GlobalOutlined style={{ color: '#CC2927' }} />
              <span>Availability Group Listeners</span>
            </Space>
          }
          size="small"
          style={{ marginTop: '24px' }}
        >
          <Table
            columns={listenerColumns}
            dataSource={data.Listeners}
            pagination={false}
            size="small"
            rowKey="ListenerName"
          />
        </Card>
      )}
    </div>
  );
};

export default AlwaysOnDashboard; 