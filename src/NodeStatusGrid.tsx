import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Card, Space, Row, Col, Tag, Tooltip, Button, Modal, Spin, Radio, Statistic, Select } from 'antd';
import { NodeType } from './type';
import {

  DatabaseOutlined,
  EnvironmentOutlined,
  GlobalOutlined,
  CaretRightOutlined,
  SafetyOutlined,
  AlertOutlined,
  SettingOutlined,
  LineChartOutlined,
  EyeOutlined,
  FileTextOutlined,
  WarningOutlined,
  CrownOutlined,
  ClockCircleOutlined,
  CheckOutlined,
  CloseOutlined,
  LoadingOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,

} from '@ant-design/icons';
import MssqlIcon from './icons/mssql';
import { STATUS_COLORS } from './constants';
import { useNavigate } from 'react-router-dom';
import MongoTopology from './components/MongoTopology';
import ClusterTopology from './components/ClusterTopology';
import MssqlTopology from './components/MssqlTopology';
import { message } from 'antd';
import { useSelector } from 'react-redux';
import { RootState } from './store';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

const { Option } = Select;

// Interface for response time data
interface ResponseTimeDataPoint {
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
}

interface ResponseTimeResponse {
  data: {
    agent_id: string;
    all_data: ResponseTimeDataPoint[];
  };
  status: string;
}

interface ChartDataPoint {
  time: string;
  timestamp: number;
  response_time_ms: number;
}

// Custom hook for fetching response time data (generic for both MSSQL and PostgreSQL)
const useResponseTimeData = (agentId: string | null, timeRange: string = '1h', dbType: 'mssql' | 'postgresql' | 'mongodb') => {
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchResponseTime = useCallback(async () => {
    if (!agentId) return;

    try {
      setLoading(true);
      setError(null);
      
      // Different endpoints for different database types
      const endpoint = dbType === 'mssql' 
        ? `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/mssql/response-time?agent_id=${agentId}&range=${timeRange}`
        : dbType === 'postgresql'
          ? `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/metrics/postgresql/system/response-time?agent_id=${agentId}&range=${timeRange}`
          : `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/metrics/mongodb/system/response-time?agent_id=${agentId}&range=${timeRange}`;

      const token = localStorage.getItem('token');
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch response time data');
      }

      const responseData: ResponseTimeResponse = await response.json();

      if (responseData.status === 'success' && responseData.data && responseData.data.all_data) {
        // Expected measurement name based on database type
        const expectedMeasurement = dbType === 'mssql' ? 'mssql_system' 
          : dbType === 'postgresql' ? 'postgresql_system' 
          : 'mongodb_system';
        
        // Process the data for chart
        const chartData: ChartDataPoint[] = responseData.data.all_data
          .filter(point => point._field === 'response_time_ms' && point._measurement === expectedMeasurement)
          .map(point => ({
            time: new Date(point._time).toLocaleTimeString(),
            timestamp: new Date(point._time).getTime(),
            response_time_ms: point._value
          }))
          .sort((a, b) => a.timestamp - b.timestamp);

        setData(chartData);
      } else {
        setData([]);
      }
    } catch (err) {
      console.error('Error fetching response time data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [agentId, timeRange, dbType]);

  useEffect(() => {
    fetchResponseTime();
  }, [fetchResponseTime]);

  // Auto-refresh every 60 seconds for preview charts (1h timeRange)
  useEffect(() => {
    if (!agentId || timeRange !== '1h') return;

    const interval = setInterval(() => {
      fetchResponseTime();
    }, 60000); // 60 seconds

    return () => clearInterval(interval);
  }, [agentId, timeRange, fetchResponseTime]);

  return { data, loading, error, refetch: fetchResponseTime };
};

// Small preview chart component for both MSSQL and PostgreSQL cards
const ResponseTimePreview: React.FC<{
  agentId: string;
  dbType: 'mssql' | 'postgresql' | 'mongodb';
  onChartClick: () => void;
}> = ({ agentId, dbType, onChartClick }) => {
  const { data, loading } = useResponseTimeData(agentId, '1h', dbType);

  if (loading) {
    return (
      <div style={{ 
        height: '60px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: '#f9f9f9',
        borderRadius: '4px',
        cursor: 'pointer'
      }} onClick={(e) => {
        e.stopPropagation();
        onChartClick();
      }}>
        <Spin size="small" />
        <span style={{ marginLeft: '8px', fontSize: '12px', color: '#666' }}>Loading...</span>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div style={{
        height: '60px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f9f9f9',
        borderRadius: '4px',
        cursor: 'pointer',
        color: '#999',
        fontSize: '12px'
      }} onClick={(e) => {
        e.stopPropagation();
        onChartClick();
      }}>
        No response time data
      </div>
    );
  }

  // Calculate average response time for display
  const avgResponseTime = data.length > 0 
    ? (data.reduce((sum, point) => sum + point.response_time_ms, 0) / data.length).toFixed(2)
    : '0.00';

  return (
    <div style={{
      backgroundColor: '#f0f8ff',
      borderRadius: '4px',
      padding: '8px',
      cursor: 'pointer',
      border: '1px solid #e6f4ff',
      transition: 'all 0.2s ease'
    }} 
    onClick={(e) => {
      e.stopPropagation();
      onChartClick();
    }}
    onMouseEnter={(e) => {
      e.stopPropagation();
      e.currentTarget.style.backgroundColor = '#e6f4ff';
      e.currentTarget.style.transform = 'translateY(-1px)';
    }}
    onMouseLeave={(e) => {
      e.stopPropagation();
      e.currentTarget.style.backgroundColor = '#f0f8ff';
      e.currentTarget.style.transform = 'translateY(0px)';
    }}
    >
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '4px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <ClockCircleOutlined style={{ color: '#1890ff', fontSize: '12px' }} />
          <span style={{ fontSize: '11px', color: '#666', fontWeight: 500 }}>Response Time</span>
        </div>
        <LineChartOutlined style={{ color: '#1890ff', fontSize: '12px' }} />
      </div>
      
      <div style={{ height: '40px', marginBottom: '4px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <Area
              type="monotone"
              dataKey="response_time_ms"
              stroke="#1890ff"
              fill="#1890ff"
              fillOpacity={0.3}
              strokeWidth={1.5}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      
      <div style={{ textAlign: 'center' }}>
        <span style={{ fontSize: '11px', color: '#595959' }}>
          Avg: <strong style={{ color: '#1890ff' }}>{avgResponseTime}ms</strong>
        </span>
      </div>
    </div>
  );
};

// Response time modal component for both MSSQL and PostgreSQL
const ResponseTimeModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  agentId: string;
  nodeName: string;
  dbType: 'mssql' | 'postgresql' | 'mongodb';
}> = ({ visible, onClose, agentId, nodeName, dbType }) => {
  const [timeRange, setTimeRange] = useState('1h');
  const { data, loading, refetch } = useResponseTimeData(agentId, timeRange, dbType);

  // Calculate statistics
  const stats = useMemo(() => {
    if (data.length === 0) return null;
    
    const values = data.map(d => d.response_time_ms);
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    return {
      average: avg.toFixed(3),
      minimum: min.toFixed(3),
      maximum: max.toFixed(3),
      dataPoints: values.length
    };
  }, [data]);

  const dbDisplayName = dbType === 'mssql' ? 'MSSQL' : dbType === 'postgresql' ? 'PostgreSQL' : 'MongoDB';

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ClockCircleOutlined style={{ color: '#1890ff' }} />
          <span>{dbDisplayName} Response Time Analysis - {nodeName}</span>
        </div>
      }
      open={visible}
      onCancel={onClose}
      width={900}
      footer={[
        <Button key="close" onClick={onClose}>
          Close
        </Button>
      ]}
      style={{ top: 20 }}
    >
      {/* Controls */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
        padding: '12px',
        backgroundColor: '#f9f9f9',
        borderRadius: '6px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontWeight: 500, color: '#595959' }}>Time Range:</span>
          <Select
            value={timeRange}
            onChange={setTimeRange}
            style={{ width: 140 }}
          >
            <Option value="10m">Last 10 Minutes</Option>
            <Option value="15m">Last 15 Minutes</Option>
            <Option value="30m">Last 30 Minutes</Option>
            <Option value="1h">Last 1 Hour</Option>
            <Option value="6h">Last 6 Hours</Option>
            <Option value="24h">Last 24 Hours</Option>
            <Option value="7d">Last 7 Days</Option>
          </Select>
        </div>
        
        <Button
          type="primary"
          icon={<ReloadOutlined />}
          onClick={refetch}
          loading={loading}
          style={{ backgroundColor: '#1890ff' }}
        >
          Refresh
        </Button>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <Row gutter={16} style={{ marginBottom: '16px' }}>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="Average"
                value={`${stats.average}ms`}
                valueStyle={{ color: '#1890ff', fontSize: '16px' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="Minimum"
                value={`${stats.minimum}ms`}
                valueStyle={{ color: '#52c41a', fontSize: '16px' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="Maximum"
                value={`${stats.maximum}ms`}
                valueStyle={{ color: '#ff4d4f', fontSize: '16px' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="Data Points"
                value={stats.dataPoints}
                valueStyle={{ color: '#722ed1', fontSize: '16px' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Chart */}
      <Card
        title={`${dbDisplayName} Response Time Chart`}
        style={{ height: '400px' }}
      >
        {loading ? (
          <div style={{ 
            height: '300px', 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center' 
          }}>
            <Spin size="large" />
          </div>
        ) : data.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 12 }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 12 }}
                label={{ value: 'Response Time (ms)', angle: -90, position: 'insideLeft' }}
              />
              <RechartsTooltip
                formatter={(value: any) => [`${value}ms`, 'Response Time']}
                labelFormatter={(label) => `Time: ${label}`}
              />
              <Line
                type="monotone"
                dataKey="response_time_ms"
                stroke="#1890ff"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ 
            height: '300px', 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            flexDirection: 'column',
            color: '#999'
          }}>
            <LineChartOutlined style={{ fontSize: '48px', marginBottom: '16px' }} />
            <span>No response time data available</span>
          </div>
        )}
      </Card>
    </Modal>
  );
};

// MongoDB SVG Icon Component
const MongoDBIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    id="mongodb"
    viewBox="0 0 128 128"
    width="1.9em"
    height="1.9em"
    fill="4FAA41"
    style={{ marginRight: 8, verticalAlign: 'middle' }}
  >
    <path fill="#4FAA41" fillRule="evenodd" d="M90.491 57.282c-.37-4.79-1.496-9.409-3.062-13.934-3.244-10.104-8.45-19.046-15.783-26.74-1.854-1.946-3.916-3.729-5.209-6.151-.818-1.532-1.597-3.085-2.394-4.629l-.505-1.273c-.085.292-.139.396-.142.501-.065 2.517-1.491 4.224-3.267 5.817-1.997 1.793-3.856 3.739-5.775 5.618-1.968 2.588-3.935 5.176-5.901 7.763-1.592 2.925-3.182 5.85-4.772 8.775l-3.19 8.617-.096.134c-1.756 5.768-2.622 11.698-3.048 17.688-.16 2.251.022 4.535.149 6.798.181 3.235.743 6.415 1.586 9.545 3.062 11.372 9.276 20.805 17.771 28.819 1.579 1.489 3.199 2.843 4.847 4.26.282-.965.507-1.93.763-2.895.256-.961.515-1.917.688-2.881-.174.964-.369 1.92-.562 2.881l-.826 2.895.738 2.501.684 3.884.326 4.053c-.003.823-.036 1.648.014 2.47.012.21.288.404.442.606l1.376.483 1.434.558-.246-3.603-.011-3.548.495-5.405.359-1.177 1.027-1.82c1.268-1.02 2.629-1.946 3.784-3.081 2.09-2.054 4.175-4.134 6.045-6.383 2.427-2.917 4.515-6.101 6.191-9.516 1.122-2.284 2.178-4.614 3.052-7.001.77-2.104 1.247-4.315 1.854-6.479.054-.156.126-.309.16-.468 1.254-5.841 1.465-11.741 1.004-17.682zm-23.599 49.375l-.805-1.763.805 1.763 1.183 1.01-1.183-1.01z" clipRule="evenodd"></path>
  </svg>
);

// PostgreSQL SVG Icon Component
const PostgreSQLIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    id="postgresql"
    width="1.6em"
    height="1.6em"
    preserveAspectRatio="xMinYMin meet"
    viewBox="0 0 256 264"
    fill="currentColor"
    style={{ marginRight: 8, verticalAlign: 'middle', position: 'relative', top: '2px' }}
  >
    <path d="M255.008 158.086c-1.535-4.649-5.556-7.887-10.756-8.664-2.452-.366-5.26-.21-8.583.475-5.792 1.195-10.089 1.65-13.225 1.738 11.837-19.985 21.462-42.775 27.003-64.228 8.96-34.689 4.172-50.492-1.423-57.64C233.217 10.847 211.614.683 185.552.372c-13.903-.17-26.108 2.575-32.475 4.549-5.928-1.046-12.302-1.63-18.99-1.738-12.537-.2-23.614 2.533-33.079 8.15-5.24-1.772-13.65-4.27-23.362-5.864-22.842-3.75-41.252-.828-54.718 8.685C6.622 25.672-.937 45.684.461 73.634c.444 8.874 5.408 35.874 13.224 61.48 4.492 14.718 9.282 26.94 14.237 36.33 7.027 13.315 14.546 21.156 22.987 23.972 4.731 1.576 13.327 2.68 22.368-4.85 1.146 1.388 2.675 2.767 4.704 4.048 2.577 1.625 5.728 2.953 8.875 3.74 11.341 2.835 21.964 2.126 31.027-1.848.056 1.612.099 3.152.135 4.482.06 2.157.12 4.272.199 6.25.537 13.374 1.447 23.773 4.143 31.049.148.4.347 1.01.557 1.657 1.345 4.118 3.594 11.012 9.316 16.411 5.925 5.593 13.092 7.308 19.656 7.308 3.292 0 6.433-.432 9.188-1.022 9.82-2.105 20.973-5.311 29.041-16.799 7.628-10.86 11.336-27.217 12.007-52.99.087-.729.167-1.425.244-2.088l.16-1.362 1.797.158.463.031c10.002.456 22.232-1.665 29.743-5.154 5.935-2.754 24.954-12.795 20.476-26.351"></path>
    <path fill="#336791" d="M237.906 160.722c-29.74 6.135-31.785-3.934-31.785-3.934 31.4-46.593 44.527-105.736 33.2-120.211-30.904-39.485-84.399-20.811-85.292-20.327l-.287.052c-5.876-1.22-12.451-1.946-19.842-2.067-13.456-.22-23.664 3.528-31.41 9.402 0 0-95.43-39.314-90.991 49.444.944 18.882 27.064 142.873 58.218 105.422 11.387-13.695 22.39-25.274 22.39-25.274 5.464 3.63 12.006 5.482 18.864 4.817l.533-.452c-.166 1.7-.09 3.363.213 5.332-8.026 8.967-5.667 10.541-21.711 13.844-16.235 3.346-6.698 9.302-.471 10.86 7.549 1.887 25.013 4.561 36.813-11.958l-.47 1.885c3.144 2.519 5.352 16.383 4.982 28.952-.37 12.568-.617 21.197 1.86 27.937 2.479 6.74 4.948 21.905 26.04 17.386 17.623-3.777 26.756-13.564 28.027-29.89.901-11.606 2.942-9.89 3.07-20.267l1.637-4.912c1.887-15.733.3-20.809 11.157-18.448l2.64.232c7.99.363 18.45-1.286 24.589-4.139 13.218-6.134 21.058-16.377 8.024-13.686h.002"></path>
    <path fill="#FFF" d="M108.076 81.525c-2.68-.373-5.107-.028-6.335.902-.69.523-.904 1.129-.962 1.546-.154 1.105.62 2.327 1.096 2.957 1.346 1.784 3.312 3.01 5.258 3.28.282.04.563.058.842.058 3.245 0 6.196-2.527 6.456-4.392.325-2.336-3.066-3.893-6.355-4.35M196.86 81.599c-.256-1.831-3.514-2.353-6.606-1.923-3.088.43-6.082 1.824-5.832 3.659.2 1.427 2.777 3.863 5.827 3.863.258 0 .518-.017.78-.054 2.036-.282 3.53-1.575 4.24-2.32 1.08-1.136 1.706-2.402 1.591-3.225"></path>
    <path fill="#FFF" d="M247.802 160.025c-1.134-3.429-4.784-4.532-10.848-3.28-18.005 3.716-24.453 1.142-26.57-.417 13.995-21.32 25.508-47.092 31.719-71.137 2.942-11.39 4.567-21.968 4.7-30.59.147-9.463-1.465-16.417-4.789-20.665-13.402-17.125-33.072-26.311-56.882-26.563-16.369-.184-30.199 4.005-32.88 5.183-5.646-1.404-11.801-2.266-18.502-2.376-12.288-.199-22.91 2.743-31.704 8.74-3.82-1.422-13.692-4.811-25.765-6.756-20.872-3.36-37.458-.814-49.294 7.571-14.123 10.006-20.643 27.892-19.38 53.16.425 8.501 5.269 34.653 12.913 59.698 10.062 32.964 21 51.625 32.508 55.464 1.347.449 2.9.763 4.613.763 4.198 0 9.345-1.892 14.7-8.33a529.832 529.832 0 0 1 20.261-22.926c4.524 2.428 9.494 3.784 14.577 3.92.01.133.023.266.035.398a117.66 117.66 0 0 0-2.57 3.175c-3.522 4.471-4.255 5.402-15.592 7.736-3.225.666-11.79 2.431-11.916 8.435-.136 6.56 10.125 9.315 11.294 9.607 4.074 1.02 7.999 1.523 11.742 1.523 9.103 0 17.114-2.992 23.516-8.781-.197 23.386.778 46.43 3.586 53.451 2.3 5.748 7.918 19.795 25.664 19.794 2.604 0 5.47-.303 8.623-.979 18.521-3.97 26.564-12.156 29.675-30.203 1.665-9.645 4.522-32.676 5.866-45.03 2.836.885 6.487 1.29 10.434 1.289 8.232 0 17.731-1.749 23.688-4.514 6.692-3.108 18.768-10.734 16.578-17.36zm-44.106-83.48c-.061 3.647-.563 6.958-1.095 10.414-.573 3.717-1.165 7.56-1.314 12.225-.147 4.54.42 9.26.968 13.825 1.108 9.22 2.245 18.712-2.156 28.078a36.508 36.508 0 0 1-1.95-4.009c-.547-1.326-1.735-3.456-3.38-6.404-6.399-11.476-21.384-38.35-13.713-49.316 2.285-3.264 8.084-6.62 22.64-4.813zm-17.644-61.787c21.334.471 38.21 8.452 50.158 23.72 9.164 11.711-.927 64.998-30.14 110.969a171.33 171.33 0 0 0-.886-1.117l-.37-.462c7.549-12.467 6.073-24.802 4.759-35.738-.54-4.488-1.05-8.727-.92-12.709.134-4.22.692-7.84 1.232-11.34.663-4.313 1.338-8.776 1.152-14.037.139-.552.195-1.204.122-1.978-.475-5.045-6.235-20.144-17.975-33.81-6.422-7.475-15.787-15.84-28.574-21.482 5.5-1.14 13.021-2.203 21.442-2.016zM66.674 175.778c-5.9 7.094-9.974 5.734-11.314 5.288-8.73-2.912-18.86-21.364-27.791-50.624-7.728-25.318-12.244-50.777-12.602-57.916-1.128-22.578 4.345-38.313 16.268-46.769 19.404-13.76 51.306-5.524 64.125-1.347-.184.182-.376.352-.558.537-21.036 21.244-20.537 57.54-20.485 59.759-.002.856.07 2.068.168 3.735.362 6.105 1.036 17.467-.764 30.334-1.672 11.957 2.014 23.66 10.111 32.109a36.275 36.275 0 0 0 2.617 2.468c-3.604 3.86-11.437 12.396-19.775 22.426zm22.479-29.993c-6.526-6.81-9.49-16.282-8.133-25.99 1.9-13.592 1.199-25.43.822-31.79-.053-.89-.1-1.67-.127-2.285 3.073-2.725 17.314-10.355 27.47-8.028 4.634 1.061 7.458 4.217 8.632 9.645 6.076 28.103.804 39.816-3.432 49.229-.873 1.939-1.698 3.772-2.402 5.668l-.546 1.466c-1.382 3.706-2.668 7.152-3.465 10.424-6.938-.02-13.687-2.984-18.819-8.34zm1.065 37.9c-2.026-.506-3.848-1.385-4.917-2.114.893-.42 2.482-.992 5.238-1.56 13.337-2.745 15.397-4.683 19.895-10.394 1.031-1.31 2.2-2.794 3.819-4.602l.002-.002c2.411-2.7 3.514-2.242 5.514-1.412 1.621.67 3.2 2.702 3.84 4.938.303 1.056.643 3.06-.47 4.62-9.396 13.156-23.088 12.987-32.921 10.526zm69.799 64.952c-16.316 3.496-22.093-4.829-25.9-14.346-2.457-6.144-3.665-33.85-2.808-64.447.011-.407-.047-.8-.159-1.17a15.444 15.444 0 0 0-.456-2.162c-1.274-4.452-4.379-8.176-8.104-9.72-1.48-.613-4.196-1.738-7.46-.903.696-2.868 1.903-6.107 3.212-9.614l.549-1.475c.618-1.663 1.394-3.386 2.214-5.21 4.433-9.848 10.504-23.337 3.915-53.81-2.468-11.414-10.71-16.988-23.204-15.693-7.49.775-14.343 3.797-17.761 5.53-.735.372-1.407.732-2.035 1.082.954-11.5 4.558-32.992 18.04-46.59 8.489-8.56 19.794-12.788 33.568-12.56 27.14.444 44.544 14.372 54.366 25.979 8.464 10.001 13.047 20.076 14.876 25.51-13.755-1.399-23.11 1.316-27.852 8.096-10.317 14.748 5.644 43.372 13.315 57.129 1.407 2.521 2.621 4.7 3.003 5.626 2.498 6.054 5.732 10.096 8.093 13.046.724.904 1.426 1.781 1.96 2.547-4.166 1.201-11.649 3.976-10.967 17.847-.55 6.96-4.461 39.546-6.448 51.059-2.623 15.21-8.22 20.875-23.957 24.25zm68.104-77.936c-4.26 1.977-11.389 3.46-18.161 3.779-7.48.35-11.288-.838-12.184-1.569-.42-8.644 2.797-9.547 6.202-10.503.535-.15 1.057-.297 1.561-.473.313.255.656.508 1.032.756 6.012 3.968 16.735 4.396 31.874 1.271l.166-.033c-2.042 1.909-5.536 4.471-10.49 6.772z"></path>  </svg>
);

// Job notification animation component
const JobNotificationAnimation = ({ isVisible, onAnimationEnd }: { isVisible: boolean, onAnimationEnd: () => void }) => {
  const animationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isVisible && animationRef.current) {
      const headerJobIcon = document.querySelector('.header-job-icon') as HTMLElement;

      if (headerJobIcon) {
        // Get the position of the header job icon
        const iconRect = headerJobIcon.getBoundingClientRect();

        // Start animation
        const animation = animationRef.current.animate([
          {
            opacity: 1,
            transform: 'scale(1) translate(0, 0)'
          },
          {
            opacity: 0.8,
            transform: `scale(0.8) translate(${(iconRect.left - animationRef.current.offsetLeft) / 0.8}px, ${(iconRect.top - animationRef.current.offsetTop) / 0.8}px)`
          }
        ], {
          duration: 800,
          easing: 'ease-in-out',
          fill: 'forwards'
        });

        animation.onfinish = () => {
          // Trigger small pulse animation on the job icon
          headerJobIcon.animate([
            { transform: 'scale(1)' },
            { transform: 'scale(1.2)' },
            { transform: 'scale(1)' }
          ], {
            duration: 300,
            easing: 'ease-in-out'
          });

          onAnimationEnd();
        };
      } else {
        // No header icon found, just end the animation
        setTimeout(onAnimationEnd, 800);
      }
    }
  }, [isVisible, onAnimationEnd]);

  if (!isVisible) return null;

  return (
    <div
      ref={animationRef}
      style={{
        position: 'fixed',
        zIndex: 1000,
        width: '40px',
        height: '40px',
        borderRadius: '50%',
        backgroundColor: '#1677ff',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        boxShadow: '0 3px 6px rgba(0,0,0,0.2)',
        pointerEvents: 'none'
      }}
    >
      <ClockCircleOutlined style={{ color: 'white', fontSize: '20px' }} />
    </div>
  );
};

interface NodeStatusGridProps {
  nodes: NodeType[];
  title: string;
  type: 'mongodb' | 'postgresql' | 'mssql';
  onStatusCount?: (critical: number, warning: number, criticalDetails?: Array<{hostname: string, reason: string}>, warningDetails?: Array<{hostname: string, reason: string}>) => void;
  activeFilter?: 'all' | 'critical' | 'warning' | 'mongodb' | 'postgresql' | 'mssql' | 'issues';
  onNodeClick?: (node: NodeType) => void;
  defaultExpanded?: boolean;
  priorityFilter?: 'critical' | 'warning' | 'healthy' | 'all';
  agentStatuses?: { [key: string]: boolean };
}

// Helper function to evaluate node status and assign priority
const evaluateNodeStatus = (node: NodeType, type: 'mongodb' | 'postgresql' | 'mssql') => {
  // Node basic information
  const nodeStatus = type === 'mongodb'
    ? (node.status || node.NodeStatus || 'N/A')
    : (node.NodeStatus || node.status || 'N/A');

  // Service status for MongoDB, PostgreSQL, and MSSQL
  const mongoServiceStatus = type === 'mongodb' && node.MongoStatus
    ? node.MongoStatus
    : null;

  const pgServiceStatus = type === 'postgresql' && node.PGServiceStatus
    ? node.PGServiceStatus
    : null;

  const mssqlServiceStatus = type === 'mssql' && node.Status
    ? node.Status
    : null;

  // Determine card border color based on service status and node status
  let borderColor = STATUS_COLORS.GREEN;

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

  // Determine reason for warning or critical
  let reason = '';

  // If service is not running, show red
  if (!serviceRunning && (mongoServiceStatus || pgServiceStatus || mssqlServiceStatus)) {
    borderColor = STATUS_COLORS.RED;
    reason = 'Service is not running';
  }
  // Else if node is not in healthy state, show red
  else if (!isHealthyStatus) {
    borderColor = STATUS_COLORS.RED;
    if (nodeStatus === 'N/A' || !nodeStatus) {
      reason = 'Node status unknown';
    } else {
      reason = `Node is in unhealthy state: ${nodeStatus}`;
    }
  }
  // Else if disk space is low, show yellow
  else if (Number(node.freediskpercent || node.FDPercent || 0) > 80) {
    borderColor = STATUS_COLORS.YELLOW;
    const usedPercent = Number(node.FDPercent || 0);
    const freePercent = usedPercent > 0 ? (100 - usedPercent).toFixed(1) : Number(node.freediskpercent || 0).toFixed(1);
    reason = `Low disk space (${freePercent}% free)`;
  }
  
  // If replication lag is high
  if (node.ReplicationLagSec && Number(node.ReplicationLagSec) > 30) {
    if (borderColor === STATUS_COLORS.GREEN) {
      borderColor = STATUS_COLORS.YELLOW;
      reason = `High replication lag: ${node.ReplicationLagSec}s`;
    } else if (reason) {
      reason += `, High replication lag: ${node.ReplicationLagSec}s`;
    }
  }

  // Numeric priority for sorting (critical=1, warning=2, normal=3)
  let priority = 3; // Default (normal)
  if (borderColor === STATUS_COLORS.RED) {
    priority = 1; // Critical
  } else if (borderColor === STATUS_COLORS.YELLOW) {
    priority = 2; // Warning
  }

  return {
    node,
    borderColor,
    priority,
    reason
  };
};

const NodeStatusGrid: React.FC<NodeStatusGridProps> = ({
  nodes,
  type,
  onStatusCount,
  activeFilter = 'all',
  onNodeClick,
  defaultExpanded = false,
  priorityFilter = 'all',
  agentStatuses = {}
}) => {
  // Ensure nodes is always an array to prevent undefined errors
  const safeNodes = nodes || [];

  const [expandedClusters, setExpandedClusters] = useState<Set<string>>(new Set());
  const [showTopology, setShowTopology] = useState(false);
  const [selectedCluster, setSelectedCluster] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [pgData, setPgData] = useState<any[]>([]);
  const [mssqlData, setMssqlData] = useState<any[]>([]);
  const [isSetPrimaryModalVisible, setIsSetPrimaryModalVisible] = useState(false);
  const [selectedSecondaryNode, setSelectedSecondaryNode] = useState<string>('');
  const [setPrimaryLoading, setSetPrimaryLoading] = useState(false);
  const [manuallyExpanded, setManuallyExpanded] = useState(false);
  const [progressModalVisible, setProgressModalVisible] = useState(false);
  const [progressSteps, setProgressSteps] = useState<{ text: string, status: 'waiting' | 'processing' | 'finish' | 'error' }[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const pgDataRef = useRef<any[]>([]);
  const modalContentRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // New states for Promote Slave functionality
  const [isPromoteSlaveModalVisible, setIsPromoteSlaveModalVisible] = useState(false);
  const [selectedSlaveNode, setSelectedSlaveNode] = useState<string>('');
  const [promoteSlaveLoading, setPromoteSlaveLoading] = useState(false);
  const promoteSlaveButtonRef = useRef<HTMLButtonElement>(null);
  // Add a ref to store the polling interval ID
  const promotionPollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // New states for job logs
  const [jobLogs, setJobLogs] = useState<string[]>([]);
  
  // States for disk details modal
  const [diskDetailsVisible, setDiskDetailsVisible] = useState(false);
  const [selectedNodeForDisk, setSelectedNodeForDisk] = useState<any>(null);
  const [diskDetailsLoading, setDiskDetailsLoading] = useState(false);
  const [diskDetailsData, setDiskDetailsData] = useState<any>(null);
  const [jobMetadata, setJobMetadata] = useState<any>(null);
  const [isJobLogsModalVisible, setIsJobLogsModalVisible] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  // New states for coordination logs
  const [coordinationLogs, setCoordinationLogs] = useState<string[]>([]);
  const [coordinationMetadata, setCoordinationMetadata] = useState<any>(null);
  const [activeCoordinationJobId, setActiveCoordinationJobId] = useState<string | null>(null);
  const coordinationPollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Ref for auto-scrolling logs
  const logsContainerRef = useRef<HTMLDivElement>(null);

  // Response time modal states
  const [responseTimeModalVisible, setResponseTimeModalVisible] = useState(false);
  const [selectedNodeForResponseTime, setSelectedNodeForResponseTime] = useState<{ agentId: string, nodeName: string, dbType: 'mssql' | 'postgresql' | 'mongodb' } | null>(null);

  // Use Redux state instead of local state and API calls
  const { isLoggedIn, user } = useSelector((state: RootState) => state.auth);
  const userData = useMemo(() => {
    // Debug logging

    // Check if user is admin based on role or username
    const isAdmin = user?.role?.toLowerCase() === 'admin' || user?.username?.toLowerCase() === 'admin';

    return {
      isAdmin,
      isLoggedIn,
      username: user?.username || ''
    };
  }, [isLoggedIn, user]);

  // Memoize evaluated nodes to prevent infinite renders
  const evaluatedNodes = React.useMemo(() => {
    // First evaluate all nodes for status and priority
    const evaluated = safeNodes.map(node => evaluateNodeStatus(node, type));
    // Sort all nodes by priority
    return evaluated.sort((a, b) => a.priority - b.priority);
  }, [safeNodes, type]);

  // Filter nodes based on priorityFilter if specified
  const filteredNodes = React.useMemo(() => {
    if (priorityFilter === 'all') {
      return evaluatedNodes;
    }

    const filtered = evaluatedNodes.filter(node => {
      if (priorityFilter === 'critical') {
        return node.priority === 1;
      } else if (priorityFilter === 'warning') {
        return node.priority === 2;
      } else if (priorityFilter === 'healthy') {
        return node.priority === 3;
      }
      return true;
    });

    return filtered;
  }, [evaluatedNodes, priorityFilter]);

  // Calculate status counts (must use all nodes regardless of filter)
  const criticalCount = evaluatedNodes.filter(item => item.priority === 1).length;
  const warningCount = evaluatedNodes.filter(item => item.priority === 2).length;

  // Get critical and warning node details
  const criticalNodes = React.useMemo(() => 
    evaluatedNodes
      .filter(item => item.priority === 1)
      .map(item => ({
        hostname: item.node.Hostname || item.node.nodename || 'Unknown',
        reason: item.reason
      }))
  , [evaluatedNodes]);

  const warningNodes = React.useMemo(() => 
    evaluatedNodes
      .filter(item => item.priority === 2)
      .map(item => ({
        hostname: item.node.Hostname || item.node.nodename || 'Unknown',
        reason: item.reason
      }))
  , [evaluatedNodes]);

  // Notify parent component of status counts
  React.useEffect(() => {
    if (onStatusCount) {
      onStatusCount(criticalCount, warningCount, criticalNodes, warningNodes);
    }
  }, [criticalCount, warningCount, criticalNodes, warningNodes, onStatusCount]);

  // Auto-expand clusters with issues when defaultExpanded is true
  React.useEffect(() => {
    if (defaultExpanded && !manuallyExpanded) {
      // Group nodes by cluster
      const clusters: Record<string, boolean> = {};

      filteredNodes.forEach(evalNode => {
        // Only use ClusterName for grouping
        const groupName = evalNode.node.ClusterName || 'Unknown';

        // Mark cluster as having issues if any node has priority 1 or 2
        if (evalNode.priority <= 2) {
          clusters[groupName] = true;
        }
      });

      // Expand all clusters with issues
      setExpandedClusters(new Set(Object.keys(clusters).filter(name => clusters[name])));
    }
  }, [defaultExpanded, filteredNodes, manuallyExpanded]);

  // Fetch disk details for a specific node
  const fetchDiskDetails = async (node: any) => {
    setDiskDetailsLoading(true);
    try {
      const agentId = node.Hostname || node.nodename;
      const formattedAgentId = agentId.startsWith('agent_') ? agentId : `agent_${agentId}`;
      
      // Use the correct database-specific endpoint
      let endpoint = '';
      if (type === 'postgresql') {
        endpoint = `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/metrics/postgresql/system/disk?agent_id=${formattedAgentId}&range=5m`;
      } else if (type === 'mongodb') {
        endpoint = `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/metrics/mongodb/system/disk?agent_id=${formattedAgentId}&range=5m`;
      } else if (type === 'mssql') {
        endpoint = `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/mssql/system?agent_id=${formattedAgentId}&range=5m`;
      } else {
        throw new Error('Unsupported database type');
      }
      
      const response = await fetch(endpoint, { credentials: 'include' });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Disk details endpoint:', endpoint);
      console.log('Disk details API response:', data);
      setDiskDetailsData(data);
    } catch (error) {
      console.error('Failed to fetch disk details:', error);
      setDiskDetailsData(null);
    } finally {
      setDiskDetailsLoading(false);
    }
  };

  // Handle disk warning badge click
  const handleDiskWarningClick = (node: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedNodeForDisk(node);
    setDiskDetailsVisible(true);
    fetchDiskDetails(node);
  };

  // Group nodes by cluster - memoize to prevent recalculation on every render
  const groupedNodes = React.useMemo(() => {
    const grouped: Record<string, Array<{ node: NodeType, borderColor: string, priority: number, reason: string }>> = {};

    // First pass: Create groups based on ClusterName
    filteredNodes.forEach(evalNode => {
      // Always use ClusterName for grouping, regardless of service status
      const groupName = evalNode.node.ClusterName || 'Unknown';

      if (!grouped[groupName]) {
        grouped[groupName] = [];
      }
      grouped[groupName].push(evalNode);
    });

    return grouped;
  }, [filteredNodes]);

  // Filter clusters based on activeFilter
  const shouldShowNode = (node: { priority: number }, nodeType: 'mongodb' | 'postgresql' | 'mssql') => {
    switch (activeFilter) {
      case 'critical':
        return node.priority === 1;
      case 'warning':
        return node.priority === 2;
      case 'issues':
        return node.priority === 1 || node.priority === 2;
      case 'mongodb':
        return nodeType === 'mongodb';
      case 'postgresql':
        return nodeType === 'postgresql';
      case 'mssql':
        return nodeType === 'mssql';
      default:
        return true;
    }
  };

  const shouldShowCluster = (groupName: string, nodes: Array<{ node: NodeType, borderColor: string, priority: number, reason: string }>) => {
    // Always show the cluster if it has any nodes
    return nodes.length > 0;
  };

  // Bileşenin renderlanıp renderlanmayacağını belirle
  const shouldRenderComponent = React.useMemo(() => {
    // Şu durumları kontrol et
    if (filteredNodes.length === 0) {
      return false;
    }

    // Filtre türü kontrolü
    if ((activeFilter === 'mongodb' && type !== 'mongodb') ||
      (activeFilter === 'postgresql' && type !== 'postgresql') ||
      (activeFilter === 'mssql' && type !== 'mssql')) {
      return false;
    }

    // Calculate cluster priorities for sorting
    const clusterPrioritiesTemp = Object.entries(groupedNodes).map(([groupName, nodes]) => {
      // Find the highest priority (lowest number) in the cluster
      const highestPriority = Math.min(...nodes.map(item => item.priority));

      return {
        groupName,
        priority: highestPriority
      };
    }).sort((a, b) => a.priority - b.priority);

    // Check if there are any nodes matching the filter
    const hasMatchingNodesTemp = clusterPrioritiesTemp.some(({ groupName }) => {
      const nodes = groupedNodes[groupName];
      return nodes.some(node => shouldShowNode(node, type));
    });

    return hasMatchingNodesTemp;
  }, [filteredNodes, activeFilter, type, groupedNodes]);

  // Calculate cluster priorities for sorting - memoize this calculation
  const clusterPriorities = React.useMemo(() => {
    return Object.entries(groupedNodes).map(([groupName, nodes]) => {
      // Find the highest priority (lowest number) in the cluster
      const highestPriority = Math.min(...nodes.map(item => item.priority));

      return {
        groupName,
        priority: highestPriority
      };
    }).sort((a, b) => a.priority - b.priority);
  }, [groupedNodes]);

  // Toggle cluster expansion
  const toggleCluster = (clusterName: string) => {
    setManuallyExpanded(true);
    setExpandedClusters(prev => {
      const newSet = new Set(prev);
      if (newSet.has(clusterName)) {
        newSet.delete(clusterName);
      } else {
        newSet.add(clusterName);
      }
      return newSet;
    });
  };

  // MongoDB topology data transform function
  const transformMongoData = useCallback((nodes: NodeType[]) => {
    return (nodes || []).map(node => ({
      nodename: node.nodename || node.Hostname || 'Unknown',
      status: node.status || node.NodeStatus || 'UNKNOWN',
      ip: node.IP || '',
      dc: node.dc || node.DC || node.Location || 'Unknown',
      version: '0.0.0',
      freediskpercent: (node.freediskpercent || node.FDPercent || '0').toString(),
      ReplicationLagSec: typeof node.ReplicationLagSec === 'number'
        ? node.ReplicationLagSec
        : typeof node.ReplicationLagSec === 'string'
          ? parseFloat(node.ReplicationLagSec)
          : 0,
      MongoStatus: node.MongoStatus
    }));
  }, []);

  // PostgreSQL topology data transform function
  const transformPgData = useCallback((nodes: NodeType[]) => {
    return (nodes || []).map(node => ({
      Hostname: node.Hostname || node.nodename || 'Unknown',
      NodeStatus: node.NodeStatus || node.status || 'UNKNOWN',
      ReplicationLagSec: (node.ReplicationLagSec || '0').toString(),
      IP: node.IP || ''
    }));
  }, []);

  // MSSQL topology data transform function
  const transformMssqlData = useCallback((nodes: NodeType[]) => {
    return nodes.map(node => ({
      Hostname: node.Hostname || node.nodename || 'Unknown',
      NodeStatus: node.NodeStatus || node.HARole || node.status || 'UNKNOWN',
      IP: node.IP || '',
      Edition: node.Edition || '',
      Version: node.Version || '',
      Status: node.Status || 'UNKNOWN',
      ClusterName: node.ClusterName || '',
      IsHAEnabled: node.IsHAEnabled || false,
      AlwaysOnMetrics: node.AlwaysOnMetrics || undefined
    }));
  }, []);

  // Open topology function - useCallback kullan
  const openTopology = useCallback((clusterName: string, clusterNodes: NodeType[]) => {
    setLoading(true);
    setSelectedCluster(clusterName);

    // Deep copy nodes to prevent reference issues
    const nodesCopy = JSON.parse(JSON.stringify(clusterNodes));

    // Transform data based on type
    if (type === 'mongodb') {
      const transformedData = transformMongoData(nodesCopy);
      setPgData(transformedData);
    } else if (type === 'postgresql') {
      const transformedData = transformPgData(nodesCopy);
      setPgData(transformedData);
    } else {
      const transformedData = transformMssqlData(nodesCopy);
      setMssqlData(transformedData);
    }

    setShowTopology(true);

    // Delay loading to ensure DOM is ready
    setTimeout(() => {
      setLoading(false);
    }, 300);
  }, [type, transformMongoData, transformPgData, transformMssqlData]);

  // Effect to handle size and repaint
  useEffect(() => {
    if (showTopology) {
      const handleResize = () => {
        // Handle resize
      };

      handleResize();
      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
      };
    }
  }, [showTopology]);

  // Topology kapandığında yapılacak işlemler
  const handleTopologyClose = useCallback(() => {
    setShowTopology(false);
  }, []);

  // Render MongoDB topology with caching
  const renderMongoTopology = useCallback(() => {
    const data = pgData.length > 0
      ? pgData
      : transformMongoData(pgData);

    return (
      <MongoTopology
        key={`mongo-topology-${selectedCluster}`}
        nodes={data}
        replicaSetName={selectedCluster}
      />
    );
  }, [selectedCluster, pgData, transformMongoData]);

  // Render PostgreSQL topology with caching
  const renderPgTopology = useCallback(() => {
    const data = pgData.length > 0
      ? pgData
      : transformPgData(pgData);

    return (
      <ClusterTopology
        key={`cluster-topology-${selectedCluster}`}
        nodes={data}
        clusterName={selectedCluster}
      />
    );
  }, [selectedCluster, pgData, transformPgData]);

  // Render MSSQL topology with caching
  const renderMssqlTopology = useCallback(() => {
    const data = mssqlData.length > 0
      ? mssqlData
      : transformMssqlData(mssqlData);

    return (
      <MssqlTopology
        key={`mssql-topology-${selectedCluster}`}
        nodes={data}
      />
    );
  }, [selectedCluster, mssqlData, transformMssqlData]);

  // Helper function to update progress
  const updateProgress = (step: number, text: string, status: 'waiting' | 'processing' | 'finish' | 'error') => {
    setProgressSteps(prev => {
      const newSteps = [...prev];
      if (newSteps[step]) {
        newSteps[step] = { text, status };
      }
      return newSteps;
    });
    setCurrentStep(step + 1);
  };

  // Add new animation states
  const [showJobAnimation, setShowJobAnimation] = useState(false);
  const [animationPosition, setAnimationPosition] = useState({ x: 0, y: 0 });
  const setPrimaryButtonRef = useRef<HTMLButtonElement>(null);

  // Handle Set Primary functionality
  const handleSetPrimary = async () => {
    if (!selectedSecondaryNode || !selectedCluster) {
      message.error('Please select a secondary node');
      return;
    }

    setSetPrimaryLoading(true);

    // Initialize progress modal
    setProgressSteps([
      { text: 'Preparing to freeze secondary nodes', status: 'processing' },
      { text: 'Freezing secondary nodes', status: 'waiting' },
      { text: 'Waiting for freeze operations to complete', status: 'waiting' },
      { text: 'Stepping down primary node', status: 'waiting' },
      { text: 'Completing promotion process', status: 'waiting' }
    ]);
    setCurrentStep(0);
    setProgressModalVisible(true);

    // Get button position for animation start
    if (setPrimaryButtonRef.current) {
      const buttonRect = setPrimaryButtonRef.current.getBoundingClientRect();
      setAnimationPosition({
        x: buttonRect.left + buttonRect.width / 2 - 20, // Center the animation
        y: buttonRect.top + buttonRect.height / 2 - 20
      });
    }

    const token = localStorage.getItem('token');

    try {
      // Step 1: Get all secondary nodes in the cluster
      const secondaryNodes = groupedNodes[selectedCluster]?.filter(
        node => (node.node.status === 'SECONDARY' || node.node.NodeStatus === 'SECONDARY') &&
          (node.node.nodename !== selectedSecondaryNode && node.node.Hostname !== selectedSecondaryNode)
      ).map(node => node.node);

      // Update progress
      updateProgress(0, 'Found ' + secondaryNodes.length + ' secondary nodes to freeze', 'finish');

      // Step 2: Get current primary node
      const primaryNode = groupedNodes[selectedCluster]?.find(
        node => (node.node.status === 'PRIMARY' || node.node.NodeStatus === 'PRIMARY')
      )?.node;

      if (!primaryNode) {
        updateProgress(1, 'Could not find current primary node in the cluster', 'error');
        message.error('Could not find current primary node in the cluster');
        setSetPrimaryLoading(false);
        return;
      }

      // Update progress
      updateProgress(1, 'Freezing ' + secondaryNodes.length + ' secondary nodes', 'processing');

      // Start animation after first job is created
      setShowJobAnimation(true);

      // Step 3: Freeze all secondary nodes except the selected one (parallel requests)
      const freezePromises = secondaryNodes.map(async (node) => {
        const nodeHostname = node.nodename || node.Hostname;
        const nodePort = typeof node.port === 'string' ? parseInt(node.port, 10) : node.port;

        if (!nodeHostname || !nodePort) {
          console.warn(`Skipping freeze for node with missing data: ${nodeHostname}`);
          return;
        }

        const agentId = `agent_${nodeHostname}`;

        try {
          await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/jobs/mongo/freeze-secondary`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              agent_id: agentId,
              node_hostname: nodeHostname,
              port: nodePort,
              replica_set: selectedCluster,
              seconds: 60
            })
          });
          console.log(`Successfully froze node: ${nodeHostname}`);
        } catch (error) {
          console.error(`Error freezing node ${nodeHostname}:`, error);
        }
      });

      // Wait for all freeze operations to complete
      await Promise.all(freezePromises);

      // Update progress
      updateProgress(1, 'Secondary nodes frozen successfully', 'finish');
      updateProgress(2, 'Waiting 5 seconds before stepping down primary', 'processing');

      // Step 4: Wait for 5 seconds
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Update progress
      updateProgress(2, 'Wait complete', 'finish');
      updateProgress(3, 'Stepping down primary node: ' + (primaryNode.nodename || primaryNode.Hostname), 'processing');

      // Step 5: Stepdown the primary node to force election of our selected secondary
      const primaryHostname = primaryNode.nodename || primaryNode.Hostname;
      const primaryPort = typeof primaryNode.port === 'string' ? parseInt(primaryNode.port, 10) : primaryNode.port;
      const primaryAgentId = `agent_${primaryHostname}`;

      if (!primaryHostname || !primaryPort) {
        updateProgress(3, 'Primary node information is incomplete', 'error');
        message.error('Primary node information is incomplete');
        setSetPrimaryLoading(false);
        return;
      }

      const primaryResponse = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/jobs/mongo/promote-primary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          agent_id: primaryAgentId,
          node_hostname: primaryHostname,
          port: primaryPort,
          replica_set: selectedCluster,
          node_status: "PRIMARY"
        })
      });

      const primaryData = await primaryResponse.json();

      if (primaryResponse.ok) {
        updateProgress(3, 'Primary stepdown successful', 'finish');
        updateProgress(4, `${selectedSecondaryNode} should become PRIMARY shortly`, 'finish');

        // Close the Set Primary modal after a short delay
        setTimeout(() => {
          setIsSetPrimaryModalVisible(false);
        }, 1500);

        // Store job_id for tracking
        if (primaryData.data?.job_id) {
          console.log('Primary stepdown Job ID:', primaryData.data.job_id);
        }
      } else {
        updateProgress(3, 'Failed to stepdown primary node', 'error');
        updateProgress(4, primaryData.error || 'Failed to stepdown primary node', 'error');
        message.error(primaryData.error || 'Failed to stepdown primary node');
      }
    } catch (error) {
      console.error('Error during promotion process:', error);

      // Update progress with error
      const currentStepIndex = progressSteps.findIndex(step => step.status === 'processing');
      if (currentStepIndex >= 0) {
        updateProgress(currentStepIndex, `Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      }

      message.error('An error occurred during the promotion process');
    } finally {
      setSetPrimaryLoading(false);
    }
  };

  // Animation end handler
  const handleAnimationEnd = () => {
    setShowJobAnimation(false);
  };

  // Show Set Primary Modal
  const showSetPrimaryModal = (clusterName: string, nodes: NodeType[]) => {
    setSelectedCluster(clusterName);
    setIsSetPrimaryModalVisible(true);
  };

  // Handle Set Primary Modal Cancel
  const handleSetPrimaryModalCancel = () => {
    setIsSetPrimaryModalVisible(false);
    setSelectedSecondaryNode('');
  };

  // Show Promote Slave Modal
  const showPromoteSlaveModal = (clusterName: string, nodes: NodeType[]) => {
    setSelectedCluster(clusterName);
    setIsPromoteSlaveModalVisible(true);
  };

  // Handle Promote Slave Modal Cancel
  const handlePromoteSlaveModalCancel = () => {
    setIsPromoteSlaveModalVisible(false);
    setSelectedSlaveNode('');
  };

  // Handle Promote Slave functionality
  const handlePromoteSlave = async () => {
    if (!selectedSlaveNode || !selectedCluster) {
      message.error('Please select a slave node');
      return;
    }

    setPromoteSlaveLoading(true);

    // Initialize progress modal
    setProgressSteps([
      { text: 'Preparing to promote slave node', status: 'processing' },
      { text: 'Promoting slave to master', status: 'waiting' },
      { text: 'Waiting for promotion to complete', status: 'waiting' }
    ]);
    setCurrentStep(0);
    setProgressModalVisible(true);

    // Get button position for animation start
    if (promoteSlaveButtonRef.current) {
      const buttonRect = promoteSlaveButtonRef.current.getBoundingClientRect();
      setAnimationPosition({
        x: buttonRect.left + buttonRect.width / 2 - 20, // Center the animation
        y: buttonRect.top + buttonRect.height / 2 - 20
      });
    }

    const token = localStorage.getItem('token');

    try {
      // Find the selected slave node in the cluster
      const slaveNode = groupedNodes[selectedCluster]?.find(
        node => (node.node.nodename === selectedSlaveNode || node.node.Hostname === selectedSlaveNode)
      )?.node;

      if (!slaveNode) {
        updateProgress(0, 'Could not find selected slave node in the cluster', 'error');
        message.error('Could not find selected slave node in the cluster');
        setPromoteSlaveLoading(false);
        return;
      }

      // Get the data directory and data path for the node
      const dataDirectory = slaveNode.DataDirectory || ''; // Default if not available
      const dataPath = slaveNode.DataPath || ''; // Get the new DataPath field

      // Find the current master node
      const masterNode = groupedNodes[selectedCluster]?.find(
        node => (node.node.status === 'MASTER' || node.node.NodeStatus === 'MASTER')
      )?.node;

      if (!masterNode) {
        updateProgress(0, 'Could not find current master node in the cluster', 'error');
        message.error('Could not find current master node in the cluster');
        setPromoteSlaveLoading(false);
        return;
      }

      const currentHost = masterNode.nodename || masterNode.Hostname;
      const currentMasterIP = masterNode.IP || '';

      // Find all slave nodes in the cluster (excluding the one being promoted)
      const allSlaveNodes = groupedNodes[selectedCluster]?.filter(
        node => (node.node.status === 'SLAVE' || node.node.NodeStatus === 'SLAVE') &&
               (node.node.nodename !== selectedSlaveNode && node.node.Hostname !== selectedSlaveNode)
      ).map(node => ({
        hostname: node.node.nodename || node.node.Hostname,
        ip: node.node.IP || ''
      })) || [];

      // Update progress
      updateProgress(0, `Found slave node, current master and ${allSlaveNodes.length} other slave nodes`, 'finish');
      updateProgress(1, 'Promoting slave to master', 'processing');

      // Start animation after job is created
      setShowJobAnimation(true);

      // Format agent ID
      const hostname = slaveNode.nodename || slaveNode.Hostname;
      const agentId = `agent_${hostname}`;

      // Call the API
      const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/jobs/postgres/promote-master`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          agent_id: agentId,
          node_hostname: hostname,
          data_directory: dataPath,
          current_master_host: currentHost,
          current_master_ip: currentMasterIP,
          slaves: allSlaveNodes,
        })
      });

      const data = await response.json();

      if (response.ok) {
        updateProgress(1, 'Promotion command sent successfully', 'finish');
        updateProgress(2, 'Slave node should become MASTER shortly', 'processing');

        // Store job_id for tracking and start polling for process logs
        if (data.data?.job_id) {
          const jobId = data.data.job_id;
          
          // Start polling for the process logs
          pollProcessLogs(jobId);
        } else {
          updateProgress(2, 'Job created but no job ID returned', 'finish');
        }

        // Close the Promote Slave modal after a short delay
        setTimeout(() => {
          setIsPromoteSlaveModalVisible(false);
        }, 1500);
      } else {
        updateProgress(1, 'Failed to promote slave node', 'error');
        updateProgress(2, data.error || 'Failed to promote slave node', 'error');
        message.error(data.error || 'Failed to promote slave node');
      }
    } catch (error) {
      console.error('Error during promotion process:', error);

      // Update progress with error
      const currentStepIndex = progressSteps.findIndex(step => step.status === 'processing');
      if (currentStepIndex >= 0) {
        updateProgress(currentStepIndex, `Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      }

      message.error('An error occurred during the promotion process');
    } finally {
      setPromoteSlaveLoading(false);
    }
  };

  // Function to poll process logs for a specific job ID
  const pollProcessLogs = (jobId: string) => {
    // Store the active job ID
    setActiveJobId(jobId);
    
    // Clear any existing interval first
    if (promotionPollIntervalRef.current) {
      clearInterval(promotionPollIntervalRef.current);
      promotionPollIntervalRef.current = null;
    }
    
    // Set up new polling interval
    promotionPollIntervalRef.current = setInterval(async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(
          `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/process-logs?process_id=${jobId}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            }
          }
        );
        
        const result = await response.json();
        
        if (result.status === 'success') {
          // Store the logs
          if (result.logs && Array.isArray(result.logs)) {
            setJobLogs(result.logs);
          }
          
          // Store metadata
          if (result.metadata) {
            setJobMetadata(result.metadata);
            
            // Check for coordination job ID in metadata - try different possible field names
            const coordJobId = result.metadata.coordination_job_id || 
                              result.metadata.coordination_id ||
                              result.metadata.coord_job_id ||
                              result.metadata.coord_id;
            
            if (coordJobId) {
              // Start coordination polling if not already started
              if (activeCoordinationJobId !== coordJobId) {
                setActiveCoordinationJobId(coordJobId);
                pollCoordinationLogs(coordJobId);
              }
            }
          }
          
          // Update the progress with the latest logs
          if (result.logs && result.logs.length > 0) {
            // Update the progress message with the latest log
            const latestLog = result.logs[result.logs.length - 1];
            
            // Extract time info if available and show more detailed progress
            let progressMessage = latestLog;
            if (typeof latestLog === 'string' && latestLog.includes('] ')) {
              // Get the content after the timestamp
              progressMessage = latestLog.split('] ')[1] || latestLog;
            }
            
            updateProgress(2, `${progressMessage}`, 'processing');
          }
          
          // Check if the process is complete
          if (result.process_status === 'completed') {
            if (promotionPollIntervalRef.current) {
              clearInterval(promotionPollIntervalRef.current);
              promotionPollIntervalRef.current = null;
            }
            
            // Get the final status message
            const finalMessage = result.logs && result.logs.length > 0 
              ? result.logs[result.logs.length - 1]
              : 'Promotion completed successfully';
            
            updateProgress(2, finalMessage, 'finish');
            message.success('Slave node has been promoted to master successfully');
          } else if (result.process_status === 'failed') {
            if (promotionPollIntervalRef.current) {
              clearInterval(promotionPollIntervalRef.current);
              promotionPollIntervalRef.current = null;
            }
            
            // Try to get the error message
            const errorMsg = result.error || 
              (result.metadata && result.metadata.error) || 
              'Failed to promote slave node';
            
            updateProgress(2, `Promotion failed: ${errorMsg}`, 'error');
            message.error('Failed to promote slave node to master');
          }
        } else {
          // Handle API error
          console.error('Error polling process logs:', result.error);
        }
      } catch (error) {
        console.error('Error in poll interval:', error);
        // Don't stop polling on network errors, it might recover
      }
    }, 3000); // Poll every 3 seconds
    
    // Clean up interval when component unmounts
    return () => {
      if (promotionPollIntervalRef.current) {
        clearInterval(promotionPollIntervalRef.current);
        promotionPollIntervalRef.current = null;
      }
    };
  };

  // Function to poll coordination logs for a specific coordination job ID
  const pollCoordinationLogs = (coordJobId: string) => {
    // Clear any existing coordination interval first
    if (coordinationPollIntervalRef.current) {
      clearInterval(coordinationPollIntervalRef.current);
      coordinationPollIntervalRef.current = null;
    }
    
    // Set up new coordination polling interval
    coordinationPollIntervalRef.current = setInterval(async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(
          `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/process-logs?process_id=${coordJobId}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            }
          }
        );
        
        const result = await response.json();
        
        if (result.status === 'success') {
          // Store the coordination logs
          if (result.logs && Array.isArray(result.logs)) {
            setCoordinationLogs(result.logs);
          }
          
          // Store coordination metadata
          if (result.metadata) {
            setCoordinationMetadata(result.metadata);
          }
          
          // Check if the coordination process is complete
          if (result.process_status === 'completed') {
            if (coordinationPollIntervalRef.current) {
              clearInterval(coordinationPollIntervalRef.current);
              coordinationPollIntervalRef.current = null;
            }
            
            message.success('Coordination process completed successfully');
          } else if (result.process_status === 'failed') {
            if (coordinationPollIntervalRef.current) {
              clearInterval(coordinationPollIntervalRef.current);
              coordinationPollIntervalRef.current = null;
            }
            
            const errorMsg = result.error || 
              (result.metadata && result.metadata.error) || 
              'Coordination process failed';
            
            message.error(`Coordination failed: ${errorMsg}`);
          }
        } else {
          console.error('Error polling coordination logs:', result.error);
        }
      } catch (error) {
        console.error('Error in coordination poll interval:', error);
        // Don't stop polling on network errors, it might recover
      }
    }, 3000); // Poll every 3 seconds
  };

  // Add this function to render job logs modal
  const renderJobLogsModal = () => {
    return (
      <Modal
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>PostgreSQL Promotion Process Logs</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              {jobMetadata && (
                <Tag color={jobMetadata.final_status === 'completed' ? 'green' : 'red'}>
                  Promotion: {jobMetadata.final_status || 'Running'}
                </Tag>
              )}
              {coordinationMetadata && (
                <Tag color={coordinationMetadata.final_status === 'completed' ? 'green' : 'red'}>
                  Coordination: {coordinationMetadata.final_status || 'Running'}
                </Tag>
              )}
            </div>
          </div>
        }
        open={isJobLogsModalVisible}
        onCancel={() => setIsJobLogsModalVisible(false)}
        width={800}
        footer={[
          <Button key="close" onClick={() => setIsJobLogsModalVisible(false)}>
            Close
          </Button>
        ]}
      >
        {(jobMetadata || coordinationMetadata) && (
          <div style={{ marginBottom: '16px' }}>
            {/* Promotion Metadata */}
            {jobMetadata && (
              <div style={{ 
                background: '#f0f8ff', 
                padding: '16px', 
                borderRadius: '8px',
                marginBottom: '16px',
                border: '1px solid #91caff'
              }}>
                <h4 style={{ margin: '0 0 16px 0', color: '#1677ff' }}>🔄 Promotion Process</h4>
                <Row gutter={[16, 8]}>
                  <Col span={12}>
                    <Statistic
                      title="Node"
                      value={jobMetadata.hostname || 'Unknown'}
                      valueStyle={{ fontSize: '16px' }}
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic
                      title="Duration"
                      value={`${parseFloat(jobMetadata.duration_s || '0').toFixed(2)}s`}
                      valueStyle={{ fontSize: '16px' }}
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic
                      title="Initial Status"
                      value={jobMetadata.initial_node_status || 'Unknown'}
                      valueStyle={{ fontSize: '16px' }}
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic
                      title="PostgreSQL Version"
                      value={jobMetadata.pg_version || 'Unknown'}
                      valueStyle={{ fontSize: '16px' }}
                    />
                  </Col>
                  {jobMetadata.coordination_job_id && (
                    <Col span={24}>
                      <Statistic
                        title="Coordination Job ID"
                        value={jobMetadata.coordination_job_id}
                        valueStyle={{ fontSize: '14px', fontFamily: 'monospace' }}
                      />
                    </Col>
                  )}
                </Row>
              </div>
            )}

            {/* Coordination Metadata */}
            {coordinationMetadata && (
              <div style={{ 
                background: '#f6ffed', 
                padding: '16px', 
                borderRadius: '8px',
                marginBottom: '16px',
                border: '1px solid #b7eb8f'
              }}>
                <h4 style={{ margin: '0 0 16px 0', color: '#52c41a' }}>🔗 Coordination Process</h4>
                <Row gutter={[16, 8]}>
                  <Col span={12}>
                    <Statistic
                      title="Duration"
                      value={`${parseFloat(coordinationMetadata.duration_s || '0').toFixed(2)}s`}
                      valueStyle={{ fontSize: '16px' }}
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic
                      title="Status"
                      value={coordinationMetadata.final_status || 'Running'}
                      valueStyle={{ fontSize: '16px' }}
                    />
                  </Col>
                  {coordinationMetadata.nodes_coordinated && (
                    <Col span={12}>
                      <Statistic
                        title="Nodes Coordinated"
                        value={coordinationMetadata.nodes_coordinated}
                        valueStyle={{ fontSize: '16px' }}
                      />
                    </Col>
                  )}
                  {coordinationMetadata.error && (
                    <Col span={24}>
                      <Statistic
                        title="Error"
                        value={coordinationMetadata.error}
                        valueStyle={{ fontSize: '14px', color: '#ff4d4f' }}
                      />
                    </Col>
                  )}
                </Row>
              </div>
            )}
          </div>
        )}
        
        <Radio.Group 
          defaultValue="promotion" 
          buttonStyle="solid" 
          style={{ marginBottom: '16px' }}
        >
          <Radio.Button value="promotion">
            🔄 Promotion Logs ({jobLogs.length})
          </Radio.Button>
          {coordinationLogs.length > 0 && (
            <Radio.Button value="coordination">
              🔗 Coordination Logs ({coordinationLogs.length})
            </Radio.Button>
          )}
        </Radio.Group>

        {/* Promotion Logs */}
        <div 
          ref={logsContainerRef}
          style={{ 
            background: '#f9f9f9', 
            padding: '16px', 
            borderRadius: '8px', 
            maxHeight: '500px',
            overflowY: 'auto',
            border: '1px solid #d9d9d9',
            scrollBehavior: 'smooth'
          }}
        >
          <h4 style={{ margin: '0 0 12px 0', color: '#1677ff' }}>Promotion Process Logs:</h4>
          {jobLogs.length > 0 ? jobLogs.map((log, index) => {
            let timestamp = '';
            let message = log;
            
            // Try to extract timestamp from log
            if (typeof log === 'string' && log.includes('[') && log.includes(']')) {
              const parts = log.split(']');
              if (parts.length > 1) {
                timestamp = parts[0] + ']';
                message = parts.slice(1).join(']').trim();
              }
            }
            
            // Check if this is an error or warning message
            const isError = 
              message.toLowerCase().includes('error') || 
              message.toLowerCase().includes('fail') ||
              message.toLowerCase().includes('başarısız');
            
            const isWarning = 
              message.toLowerCase().includes('warning') || 
              message.toLowerCase().includes('uyarı');
            
            const isSuccess = 
              message.toLowerCase().includes('success') || 
              message.toLowerCase().includes('başarılı') ||
              message.toLowerCase().includes('promoted');
            
            let textColor = '';
            if (isError) textColor = '#ff4d4f';
            else if (isWarning) textColor = '#faad14';
            else if (isSuccess) textColor = '#52c41a';
            
            return (
              <div 
                key={`promotion-${index}`} 
                style={{ 
                  padding: '8px 12px', 
                  marginBottom: '4px', 
                  borderRadius: '4px',
                  backgroundColor: index % 2 === 0 ? '#f0f0f0' : '#f9f9f9',
                  color: textColor || 'inherit',
                  fontFamily: 'monospace'
                }}
              >
                {timestamp && (
                  <span style={{ color: '#1890ff', marginRight: '8px', fontWeight: 'bold' }}>
                    {timestamp}
                  </span>
                )}
                <span>{message}</span>
              </div>
            );
          }) : (
            <div style={{ textAlign: 'center', color: '#999', padding: '20px' }}>
              No promotion logs available
            </div>
          )}

          {/* Coordination Logs */}
          {coordinationLogs.length > 0 && (
            <>
              <div style={{ margin: '24px 0 12px 0', borderTop: '1px solid #e8e8e8', paddingTop: '16px' }}>
                <h4 style={{ margin: '0 0 12px 0', color: '#52c41a' }}>Coordination Process Logs:</h4>
              </div>
              {coordinationLogs.map((log, index) => {
                let timestamp = '';
                let message = log;
                
                // Try to extract timestamp from log
                if (typeof log === 'string' && log.includes('[') && log.includes(']')) {
                  const parts = log.split(']');
                  if (parts.length > 1) {
                    timestamp = parts[0] + ']';
                    message = parts.slice(1).join(']').trim();
                  }
                }
                
                // Check if this is an error or warning message
                const isError = 
                  message.toLowerCase().includes('error') || 
                  message.toLowerCase().includes('fail') ||
                  message.toLowerCase().includes('başarısız');
                
                const isWarning = 
                  message.toLowerCase().includes('warning') || 
                  message.toLowerCase().includes('uyarı');
                
                const isSuccess = 
                  message.toLowerCase().includes('success') || 
                  message.toLowerCase().includes('başarılı') ||
                  message.toLowerCase().includes('coordinated');
                
                let textColor = '';
                if (isError) textColor = '#ff4d4f';
                else if (isWarning) textColor = '#faad14';
                else if (isSuccess) textColor = '#52c41a';
                
                return (
                  <div 
                    key={`coordination-${index}`} 
                    style={{ 
                      padding: '8px 12px', 
                      marginBottom: '4px', 
                      borderRadius: '4px',
                      backgroundColor: index % 2 === 0 ? '#e6f7ff' : '#f0f8ff',
                      color: textColor || 'inherit',
                      fontFamily: 'monospace',
                      borderLeft: '3px solid #52c41a'
                    }}
                  >
                    {timestamp && (
                      <span style={{ color: '#52c41a', marginRight: '8px', fontWeight: 'bold' }}>
                        {timestamp}
                      </span>
                    )}
                    <span>{message}</span>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </Modal>
    );
  };

  // Update the Progress Modal to add a View Logs button
  // Find the Progress Modal section where the footer is defined and add this button
  // Inside useEffect after the other modals
  useEffect(() => {
    // Cleanup code for intervals
    return () => {
      if (promotionPollIntervalRef.current) {
        clearInterval(promotionPollIntervalRef.current);
        promotionPollIntervalRef.current = null;
      }
      if (coordinationPollIntervalRef.current) {
        clearInterval(coordinationPollIntervalRef.current);
        coordinationPollIntervalRef.current = null;
      }
    };
  }, []);

  // Auto-scroll logs to bottom when new logs arrive
  useEffect(() => {
    if (logsContainerRef.current && (jobLogs.length > 0 || coordinationLogs.length > 0)) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [jobLogs, coordinationLogs]);

  if (!shouldRenderComponent) {
    return null;
  }

  return (
    <div style={{ marginBottom: 24 }}>
      {/* Render the job notification animation */}
      <JobNotificationAnimation
        isVisible={showJobAnimation}
        onAnimationEnd={handleAnimationEnd}
      />

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {clusterPriorities.map(({ groupName }) => {
          const sortedNodes = groupedNodes[groupName];

          // Skip rendering if cluster doesn't match filter
          if (!shouldShowCluster(groupName, sortedNodes)) {
            return null;
          }

          // Determine if this cluster should be highlighted
          const hasIssues = criticalCount > 0 || warningCount > 0;

          // Count critical and warning nodes in this cluster
          const clusterCriticalCount = sortedNodes.filter(item => item.borderColor === STATUS_COLORS.RED).length;
          const clusterWarningCount = sortedNodes.filter(item => item.borderColor === STATUS_COLORS.YELLOW).length;
          const clusterIsHealthy = clusterCriticalCount === 0 && clusterWarningCount === 0;

          const isExpanded = expandedClusters.has(groupName);

          // Extract all nodes in this cluster for topology view
          const clusterNodesList = sortedNodes.map(item => item.node);

          return (
            <Card
              key={groupName}
              title={
                <div
                  className="cluster-header"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    padding: '4px 0'
                  }}
                  onClick={() => toggleCluster(groupName)}
                >
                  <span
                    style={{ display: 'flex', alignItems: 'center' }}
                  >
                    <CaretRightOutlined
                      style={{
                        marginRight: 10,
                        transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                        transition: 'transform 0.3s',
                        fontSize: '16px',
                        color: '#8c8c8c'
                      }}
                    />
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      backgroundColor: type === 'mongodb' ? '#4FAA4120' : 
                                      type === 'postgresql' ? '#33679120' : 
                                      '#CC292720',
                      padding: '6px 10px',
                      borderRadius: '8px'
                    }}>
                      {type === 'mongodb' ? (
                        <MongoDBIcon />
                      ) : type === 'postgresql' ? (
                        <PostgreSQLIcon />
                      ) : (
                        <MssqlIcon />
                      )}
                      <div style={{ fontWeight: 'bold', fontSize: '15px', marginLeft: '2px' }}>
                        {groupName}
                      </div>
                    </div>
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div>
                      {clusterCriticalCount > 0 && (
                        <Tag color="red" style={{ 
                          marginRight: 5, 
                          fontWeight: 500,
                          boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                          padding: '2px 8px'
                        }}>
                          {clusterCriticalCount} Critical
                        </Tag>
                      )}
                      {clusterWarningCount > 0 && (
                        <Tag color="orange" style={{ 
                          marginRight: 5, 
                          fontWeight: 500,
                          boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                          padding: '2px 8px'
                        }}>
                          {clusterWarningCount} Warning
                        </Tag>
                      )}
                      {clusterIsHealthy && (
                        <Tag color="green" style={{ 
                          marginRight: 5, 
                          fontWeight: 500,
                          boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                          padding: '2px 8px'
                        }}>
                          Healthy
                        </Tag>
                      )}
                      <Tag color={type === 'mongodb' ? 'blue' : 'cyan'} style={{ 
                        fontWeight: 500,
                        boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                        padding: '2px 8px'
                      }}>
                        {sortedNodes.length} Nodes
                      </Tag>
                    </div>

                    {/* Buton grubu */}
                    <Button.Group style={{
                      marginLeft: 'auto',
                      background: '#fff',
                      borderRadius: '8px',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.08)'
                    }}>
                      <Button
                        type="text"
                        icon={<LineChartOutlined />}
                        style={{ 
                          fontSize: '14px', 
                          padding: '0 10px',
                          height: '32px',
                          transition: 'all 0.3s'
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (type === 'postgresql' || type === 'mssql') {
                            const params = new URLSearchParams();
                            params.set('type', type);
                            params.set('clusterName', encodeURIComponent(groupName));
                            navigate(`/performance-analyzer?${params.toString()}`);
                          } else {
                            message.info('Metrics feature coming soon');
                          }
                        }}
                      >
                        Metrics
                      </Button>
                      {type === 'mongodb' && (
                        <Tooltip title={!userData.isLoggedIn ? "Please login first" : !userData.isAdmin ? "Admin access required" : ""}>
                          <Button
                            type="text"
                            icon={<SettingOutlined />}
                            style={{ 
                              fontSize: '14px', 
                              padding: '0 10px',
                              height: '32px',
                              transition: 'all 0.3s'
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!userData.isLoggedIn) {
                                message.warning('Please login first');
                                return;
                              }
                              if (!userData.isAdmin) {
                                message.warning('Admin access required');
                                return;
                              }
                              showSetPrimaryModal(groupName, clusterNodesList);
                            }}
                            disabled={!userData.isLoggedIn || !userData.isAdmin}
                            ref={setPrimaryButtonRef}
                          >
                            Set Primary
                          </Button>
                        </Tooltip>
                      )}
                      {type === 'postgresql' && (
                        <Tooltip title={!userData.isLoggedIn ? "Please login first" : !userData.isAdmin ? "Admin access required" : ""}>
                          <Button
                            type="text"
                            icon={<SettingOutlined />}
                            style={{ 
                              fontSize: '14px', 
                              padding: '0 10px',
                              height: '32px',
                              transition: 'all 0.3s'
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!userData.isLoggedIn) {
                                message.warning('Please login first');
                                return;
                              }
                              if (!userData.isAdmin) {
                                message.warning('Admin access required');
                                return;
                              }
                              showPromoteSlaveModal(groupName, clusterNodesList);
                            }}
                            disabled={!userData.isLoggedIn || !userData.isAdmin}
                            ref={promoteSlaveButtonRef}
                          >
                            Promote Slave
                          </Button>
                        </Tooltip>
                      )}
                      <Button
                        type="text"
                        icon={<EyeOutlined />}
                        style={{ 
                          fontSize: '14px', 
                          padding: '0 10px',
                          height: '32px',
                          transition: 'all 0.3s'
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          openTopology(groupName, clusterNodesList);
                        }}
                      >
                        View Topology
                      </Button>
                    </Button.Group>
                  </div>
                </div>
              }
              style={{
                marginBottom: 16,
                borderTop: `2px solid ${clusterCriticalCount > 0 ? STATUS_COLORS.RED :
                  clusterWarningCount > 0 ? STATUS_COLORS.YELLOW :
                    type === 'mongodb' ? '#4FAA41' :
                      type === 'postgresql' ? '#336791' :
                        '#CC2927' // MSSQL color
                  }`,
                borderRadius: '8px',
                boxShadow: clusterCriticalCount > 0 ? '0 2px 8px rgba(255, 77, 79, 0.15)' :
                          clusterWarningCount > 0 ? '0 2px 8px rgba(250, 173, 20, 0.15)' :
                          '0 2px 8px rgba(0, 0, 0, 0.05)'
              }}
              size="small"
              bordered
              className={hasIssues ? 'cluster-with-issues' : ''}
              styles={{
                body: { padding: isExpanded ? '16px' : 0, display: isExpanded ? 'block' : 'none' }
              }}
            >
              {isExpanded && (
                <Row gutter={[16, 16]} className="node-status-grid">
                  {sortedNodes
                    .filter(node => shouldShowNode(node, type))
                    .map(({ node, borderColor, reason }, index) => {
                      // Node basic information
                      const nodeName = type === 'mongodb'
                        ? (node.nodename || node.Hostname || 'N/A')
                        : (node.Hostname || node.nodename || 'N/A');

                      const nodeStatus = type === 'mongodb'
                        ? (node.status || node.NodeStatus || 'N/A')
                        : type === 'postgresql'
                          ? (node.NodeStatus || node.status || 'N/A')
                          : (node.HARole || node.NodeStatus || node.status || 'N/A');

                      const location = type === 'mongodb'
                        ? (node.dc || node.DC || node.Location || 'N/A')
                        : type === 'mssql'
                          ? (node.Location || node.DC || node.dc || 'N/A')
                        : type === 'postgresql'
                          ? (node.Location || node.DC || node.dc || 'N/A')
                        : (node.DC || node.dc || node.Location || 'N/A');

                      // Calculate free disk percentage correctly
                      // FDPercent represents used disk percentage, so free = 100 - FDPercent
                      const usedDiskPercent = Number(node.FDPercent || 0);
                      const freeDiskPercent = usedDiskPercent > 0 
                        ? (100 - usedDiskPercent) 
                        : (node.freediskpercent || 0);

                      const freeDiskData = type === 'mongodb'
                        ? (node.freediskdata || node.FreeDisk || 'N/A')
                        : (node.FreeDisk || node.freediskdata || 'N/A');

                      // Get IP address
                      const ipAddress = node.IP || 'N/A';

                      // Check agent status for this node
                      // Extract base hostname without domain
                      const baseNodeName = nodeName.split('.')[0];

                      // Check if node has an active agent
                      const isAgentConnected =
                        agentStatuses[nodeName] ||
                        agentStatuses[baseNodeName] ||
                        agentStatuses[baseNodeName.toLowerCase()] ||
                        agentStatuses[`${baseNodeName}.hepsiburada.dmz`] ||
                        agentStatuses[`${baseNodeName}.hepsi.io`] ||
                        agentStatuses[`${baseNodeName}.dpay.int`];

                      // Service status for MongoDB and PostgreSQL
                      const mongoServiceStatus = type === 'mongodb' && node.MongoStatus
                        ? node.MongoStatus
                        : null;

                      const pgServiceStatus = type === 'postgresql' && node.PGServiceStatus
                        ? node.PGServiceStatus
                        : null;

                      // Progress bar color based on free disk space percentage
                      const getDiskProgressColor = (freePercent: number) => {
                        if (freePercent < 25) return STATUS_COLORS.RED;
                        if (freePercent < 50) return STATUS_COLORS.YELLOW;
                        return STATUS_COLORS.GREEN;
                      };

                      // Handle node click
                      const handleNodeClick = () => {
                        if (onNodeClick && node) {
                          onNodeClick(node);
                        } else if (type === 'postgresql') {
                          // For PostgreSQL, navigate to postgrepa

                          navigate(`/postgrepa?clusterName=${encodeURIComponent(groupName)}&hostName=${encodeURIComponent(nodeName)}`);
                        } else if (type === 'mongodb') {
                          // For MongoDB, navigate to queryanalyzer with replicaSet
                          navigate(`/mongopa?replicaSet=${groupName}&hostName=${encodeURIComponent(nodeName)}`);
                        } else if (type === 'mssql') {
                          // For MSSQL, navigate to mssqlpa with both clusterName and hostName parameters
                          navigate(`/mssqlpa?clusterName=${encodeURIComponent(groupName)}&hostName=${encodeURIComponent(nodeName)}`);
                        }
                      };

                      return (
                        <Col xs={24} sm={12} md={8} lg={6} key={`${nodeName}-${index}`}>
                          <Card
                            size="small"
                            className={`node-card ${
                              borderColor === STATUS_COLORS.RED
                                ? 'blinking-card'
                                : borderColor === STATUS_COLORS.YELLOW
                                  ? 'warning-card'
                                  : ''
                            }`}
                            style={{
                              cursor: 'pointer',
                              borderLeft: `4px solid ${borderColor}`,
                              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                              height: '100%',
                              borderRadius: '6px',
                              position: 'relative',
                              transition: 'all 0.2s ease',
                              overflow: 'hidden'
                            }}
                            hoverable
                            styles={{
                              body: { padding: '14px' }
                            }}
                            onClick={handleNodeClick}
                          >
                            <div style={{ 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              marginBottom: 10,
                              alignItems: 'center'
                            }}>
                              <div style={{
                                fontWeight: 'bold',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                maxWidth: '70%',
                                fontSize: '15px',
                                color: '#262626'
                              }}>
                                {nodeName}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {/* Agent status indicator */}
                                <Tooltip
                                  title={isAgentConnected ? "Agent Connected" : "Agent Disconnected"}
                                  placement="top"
                                  color={isAgentConnected ? '#52c41a' : '#ff4d4f'}
                                >
                                  <div>
                                    {isAgentConnected ? (
                                      <SafetyOutlined
                                        style={{
                                          color: '#52c41a',
                                          fontSize: '18px',
                                          textShadow: '0 0 2px rgba(82, 196, 26, 0.3)'
                                        }}
                                      />
                                    ) : (
                                      <AlertOutlined
                                        style={{
                                          color: '#ff4d4f',
                                          fontSize: '18px',
                                          textShadow: '0 0 2px rgba(255, 77, 79, 0.3)'
                                        }}
                                      />
                                    )}
                                  </div>
                                </Tooltip>
                              </div>
                            </div>

                            <Space direction="vertical" size={4} style={{ width: '100%' }}>
                              <div style={{ fontSize: '13px', color: '#666', display: 'flex', alignItems: 'center' }}>
                                <Tag color={
                                  nodeStatus.includes('PRIMARY') || nodeStatus.includes('MASTER')
                                    ? 'green'
                                    : nodeStatus.includes('SECONDARY') || nodeStatus.includes('SLAVE')
                                      ? 'blue'
                                      : 'red'
                                } style={{ 
                                  margin: 0, 
                                  fontWeight: 500,
                                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                                  padding: '2px 8px'
                                }}>
                                  {nodeStatus}
                                </Tag>
                              </div>

                              {/* Warning message if node has issues */}
                              {(borderColor === STATUS_COLORS.RED || borderColor === STATUS_COLORS.YELLOW) && (
                                <Tooltip title={(reason?.includes('disk space') ? 'Click for disk details' : '') || reason || 'Issue detected'}>
                                  <div 
                                    style={{ 
                                      fontSize: '12px', 
                                      color: borderColor === STATUS_COLORS.RED ? '#ff4d4f' : '#faad14', 
                                      display: 'flex', 
                                      alignItems: 'center',
                                      marginTop: 4,
                                      marginBottom: 4,
                                      padding: '4px 6px',
                                      backgroundColor: borderColor === STATUS_COLORS.RED ? '#fff1f0' : '#fffbe6',
                                      borderRadius: '4px',
                                      border: `1px solid ${borderColor === STATUS_COLORS.RED ? '#ffccc7' : '#ffe58f'}`,
                                      cursor: reason?.includes('disk space') ? 'pointer' : 'default'
                                    }}
                                    onClick={reason?.includes('disk space') ? (e) => handleDiskWarningClick(node, e) : undefined}
                                  >
                                    {borderColor === STATUS_COLORS.RED ? 
                                      <CloseCircleOutlined style={{ marginRight: 6 }} /> : 
                                      <WarningOutlined style={{ marginRight: 6 }} />
                                    }
                                    <span style={{ fontSize: '12px', lineHeight: '1.2' }}>
                                      {reason || 'Issue detected'}
                                    </span>
                                  </div>
                                </Tooltip>
                              )}
                              
                              <div style={{ 
                                display: 'flex', 
                                flexDirection: 'column', 
                                gap: '6px',
                                marginTop: 4,
                                padding: '6px 8px',
                                backgroundColor: '#f9f9f9',
                                borderRadius: '4px'
                              }}>
                                <div style={{ fontSize: '12px', color: '#666', display: 'flex', alignItems: 'center' }}>
                                  <EnvironmentOutlined style={{ marginRight: 6, color: '#8c8c8c' }} /> 
                                  <span style={{ color: '#595959' }}>{location}</span>
                                </div>

                                <div style={{ fontSize: '12px', color: '#666', display: 'flex', alignItems: 'center' }}>
                                  <GlobalOutlined style={{ marginRight: 6, color: '#8c8c8c' }} /> 
                                  <span style={{ color: '#595959' }}>{ipAddress}</span>
                                </div>
                                
                                {/* Version information */}
                                {type === 'mongodb' && node.MongoVersion && (
                                  <div style={{ 
                                    fontSize: '12px', 
                                    color: '#666', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    backgroundColor: '#effaef', 
                                    padding: '3px 6px', 
                                    borderRadius: '3px' 
                                  }}>
                                    <SettingOutlined style={{ marginRight: 6, color: '#4FAA41' }} /> 
                                    <span style={{ color: '#4FAA41', fontWeight: 500 }}>MongoDB {node.MongoVersion}</span>
                                  </div>
                                )}
                                
                                {type === 'postgresql' && node.PGVersion && (
                                  <div style={{ 
                                    fontSize: '12px', 
                                    color: '#666', 
                                    display: 'flex', 
                                    alignItems: 'center',
                                    backgroundColor: '#edf5fa', 
                                    padding: '3px 6px', 
                                    borderRadius: '3px'
                                  }}>
                                    <SettingOutlined style={{ marginRight: 6, color: '#336791' }} /> 
                                    <span style={{ color: '#336791', fontWeight: 500 }}>
                                      PostgreSQL {node.PGVersion}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* MongoDB service status display */}
                              {mongoServiceStatus && (
                                <div style={{
                                  fontSize: '12px',
                                  color: mongoServiceStatus === 'RUNNING' ? '#52c41a' : '#ff4d4f',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between'
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <DatabaseOutlined style={{ marginRight: 6 }} /> 
                                    <span style={{ fontWeight: 500 }}>Service: {mongoServiceStatus}</span>
                                  </div>
                                  {type === 'mongodb' && node.port && (
                                    <span style={{
                                      color: '#8c8c8c',
                                      background: '#eee',
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      fontSize: '11px',
                                      fontWeight: 500
                                    }}>
                                      Port: {node.port}
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* PostgreSQL service status display */}
                              {pgServiceStatus && (
                                <div style={{
                                  fontSize: '12px',
                                  color: pgServiceStatus === 'RUNNING' ? '#52c41a' : '#ff4d4f',
                                  display: 'flex',
                                  alignItems: 'center',
                                  fontWeight: 500
                                }}>
                                  <DatabaseOutlined style={{ marginRight: 6 }} /> Service: {pgServiceStatus}
                                </div>
                              )}

                              {/* MSSQL service status display */}
                              {type === 'mssql' && node.Status && (
                                <div style={{
                                  fontSize: '12px',
                                  color: node.Status === 'RUNNING' ? '#52c41a' : '#ff4d4f',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between'
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', fontWeight: 500 }}>
                                    <DatabaseOutlined style={{ marginRight: 6 }} /> Service: {node.Status}
                                  </div>
                                  {node.Port && (
                                    <span style={{
                                      color: '#8c8c8c',
                                      background: '#eee',
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      fontSize: '11px',
                                      fontWeight: 500
                                    }}>
                                      Port: {node.Port}
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* MSSQL Response Time Preview */}
                              {type === 'mssql' && isAgentConnected && (
                                <div style={{ marginTop: '8px' }}>
                                  <ResponseTimePreview
                                    agentId={`agent_${nodeName}`}
                                    dbType="mssql"
                                    onChartClick={() => {
                                      setSelectedNodeForResponseTime({
                                        agentId: `agent_${nodeName}`,
                                        nodeName: nodeName,
                                        dbType: 'mssql'
                                      });
                                      setResponseTimeModalVisible(true);
                                    }}
                                  />
                                </div>
                              )}

                              {/* PostgreSQL Response Time Preview */}
                              {type === 'postgresql' && isAgentConnected && (
                                <div style={{ marginTop: '8px' }}>
                                  <ResponseTimePreview
                                    agentId={`agent_${nodeName}`}
                                    dbType="postgresql"
                                    onChartClick={() => {
                                      setSelectedNodeForResponseTime({
                                        agentId: `agent_${nodeName}`,
                                        nodeName: nodeName,
                                        dbType: 'postgresql'
                                      });
                                      setResponseTimeModalVisible(true);
                                    }}
                                  />
                                </div>
                              )}

                              {/* MongoDB Response Time Preview */}
                              {type === 'mongodb' && isAgentConnected && (
                                <div style={{ marginTop: '8px' }}>
                                  <ResponseTimePreview
                                    agentId={`agent_${nodeName}`}
                                    dbType="mongodb"
                                    onChartClick={() => {
                                      setSelectedNodeForResponseTime({
                                        agentId: `agent_${nodeName}`,
                                        nodeName: nodeName,
                                        dbType: 'mongodb'
                                      });
                                      setResponseTimeModalVisible(true);
                                    }}
                                  />
                                </div>
                              )}
                            </Space>
                          </Card>
                        </Col>
                      );
                    })}
                </Row>
              )}
            </Card>
          );
        })}
      </div>

      {/* Topology Modal - props optimize edildi */}
      <Modal
        title=""
        open={showTopology}
        onCancel={handleTopologyClose}
        width="90%"
        style={{ 
          top: 20,
          paddingBottom: 0
        }}
        styles={{
          body: {
            padding: 0,
            height: 'calc(95vh - 110px)',
            position: 'relative',
            overflow: 'hidden'
          },
          mask: {
            backgroundColor: 'rgba(0, 0, 0, 0.45)'
          },
          content: {
            height: '95vh',
            padding: '20px 0'
          }
        }}
        footer={null}
        destroyOnClose={false}
        maskClosable={false}
        centered
      >
        <div
          ref={modalContentRef}
          style={{
            width: '100%',
            height: '100%',
            padding: '4px',
            position: 'relative',
            display: 'flex'
          }}
        >
          {loading ? (
            <div style={{
              height: '100%',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <Spin size="large" />
              <div style={{ color: '#1890ff', fontSize: '14px' }}>Loading topology...</div>
            </div>
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                position: 'relative',
                overflow: 'hidden',
                border: '1px solid #f0f0f0',
                borderRadius: '8px'
              }}
            >
              {showTopology && (
                type === 'mongodb' ? renderMongoTopology() : type === 'postgresql' ? renderPgTopology() : renderMssqlTopology()
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* Set Primary Modal */}
      <Modal
        title={
          <div style={{
            borderBottom: '1px solid #f0f0f0',
            padding: '16px 24px',
            margin: '-20px -24px 20px'
          }}>
            <div style={{ fontSize: '18px', fontWeight: 500, marginBottom: '4px' }}>
              Set Primary Node
            </div>
            <div style={{ fontSize: '14px', color: '#666' }}>
              {selectedCluster} Replica Set
            </div>
          </div>
        }
        open={isSetPrimaryModalVisible}
        onCancel={handleSetPrimaryModalCancel}
        width={600}
        footer={[
          <Button key="cancel" onClick={handleSetPrimaryModalCancel}>
            Cancel
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={setPrimaryLoading}
            onClick={handleSetPrimary}
            danger
            ref={setPrimaryButtonRef}
          >
            Set as Primary
          </Button>
        ]}
        styles={{
          body: {
            padding: '0 24px'
          }
        }}
      >
        <Spin spinning={setPrimaryLoading}>
          <div style={{
            backgroundColor: '#fffbe6',
            border: '1px solid #ffe58f',
            borderRadius: '6px',
            padding: '12px 16px',
            marginBottom: '24px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '8px',
              color: '#d48806'
            }}>
              <WarningOutlined /> Important Information
            </div>
            <div style={{ color: '#666', fontSize: '14px' }}>
              <p style={{ margin: '0 0 8px 0' }}>
                Changing the primary node in a MongoDB replica set is a critical operation that:
              </p>
              <ul style={{
                paddingLeft: '20px',
                margin: '0 0 8px 0'
              }}>
                <li>May cause a brief interruption in write operations</li>
                <li>Could impact application performance during the failover</li>
                <li>Will trigger an election process in the replica set</li>
              </ul>
              <p style={{ margin: '8px 0 0 0', fontWeight: 500 }}>
                Please ensure this operation is necessary before proceeding.
              </p>
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <div style={{
              backgroundColor: '#e6f4ff',
              border: '1px solid #91caff',
              borderRadius: '6px',
              padding: '12px 16px',
              marginBottom: '16px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '8px',
                color: '#1677ff'
              }}>
                <CrownOutlined /> Current Primary Node
              </div>
              {groupedNodes[selectedCluster]?.filter(node =>
                (node.node.status === 'PRIMARY' || node.node.NodeStatus === 'PRIMARY')
              ).map(node => {
                const hostname = node.node.nodename || node.node.Hostname;
                const location = node.node.dc || node.node.DC || node.node.Location || 'Unknown';
                return (
                  <div key={hostname} style={{
                    backgroundColor: 'white',
                    padding: '12px',
                    borderRadius: '4px',
                    border: '1px solid #91caff'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontWeight: 500 }}>{hostname}</div>
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          <EnvironmentOutlined style={{ marginRight: '4px' }} />
                          {location}
                        </div>
                      </div>
                      <Tag color="blue">PRIMARY</Tag>
                    </div>
                  </div>
                );
              })}
            </div>

            <h3 style={{
              fontSize: '16px',
              fontWeight: 500,
              marginBottom: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span>Available Secondary Nodes</span>
              <span style={{ fontSize: '12px', color: '#666' }}>
                {groupedNodes[selectedCluster]?.filter(node =>
                  (node.node.status === 'SECONDARY' || node.node.NodeStatus === 'SECONDARY') &&
                  node.node.MongoStatus === 'RUNNING'
                ).length} nodes available
              </span>
            </h3>

            <div style={{
              backgroundColor: '#f6f6f6',
              borderRadius: '6px',
              padding: '16px'
            }}>
              <Radio.Group
                onChange={(e) => setSelectedSecondaryNode(e.target.value)}
                value={selectedSecondaryNode}
                style={{ width: '100%' }}
              >
                <Space direction="vertical" style={{ width: '100%' }}>
                  {groupedNodes[selectedCluster]?.map(node => {
                    const hostname = node.node.nodename || node.node.Hostname;
                    const location = node.node.dc || node.node.DC || node.node.Location || 'Unknown';
                    const replicationLag = node.node.ReplicationLagSec || 0;
                    const status = node.node.status || node.node.NodeStatus;
                    const mongoStatus = node.node.MongoStatus;

                    // Status badge color mapping
                    const getStatusColor = (status: string | undefined) => {
                      if (!status) return '#d9d9d9';

                      switch (status.toUpperCase()) {
                        case 'PRIMARY':
                          return '#1677ff';
                        case 'SECONDARY':
                          return '#52c41a';
                        case 'ARBITER':
                          return '#722ed1';
                        case 'HIDDEN':
                          return '#faad14';
                        default:
                          return '#d9d9d9';
                      }
                    };

                    // Skip primary nodes in the selection list
                    if (status?.toUpperCase() === 'PRIMARY') {
                      return null;
                    }

                    const isSelectable = status?.toUpperCase() === 'SECONDARY' && mongoStatus === 'RUNNING';

                    return (
                      <Radio
                        key={hostname}
                        value={hostname}
                        style={{
                          display: 'block',
                          width: '100%',
                          marginBottom: '8px',
                          backgroundColor: selectedSecondaryNode === hostname ? '#e6f7ff' : 'white',
                          padding: '12px',
                          borderRadius: '4px',
                          border: '1px solid ' + (selectedSecondaryNode === hostname ? '#91d5ff' : '#d9d9d9'),
                          opacity: isSelectable ? 1 : 0.7,
                          cursor: isSelectable ? 'pointer' : 'not-allowed'
                        }}
                        disabled={!isSelectable}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ fontWeight: 500 }}>{hostname}</div>
                            <div style={{ fontSize: '12px', color: '#666', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span>
                                <EnvironmentOutlined style={{ marginRight: '4px' }} />
                                {location}
                              </span>
                              <Tag style={{ margin: 0 }} color={mongoStatus === 'RUNNING' ? 'green' : 'red'}>
                                {mongoStatus}
                              </Tag>
                            </div>
                          </div>
                          <Space>
                            <Tag color={getStatusColor(status)}>
                              {status?.toUpperCase()}
                            </Tag>
                            {status?.toUpperCase() === 'SECONDARY' && (
                              <Tag color={replicationLag < 10 ? 'green' : replicationLag < 30 ? 'orange' : 'red'}>
                                Lag: {replicationLag}s
                              </Tag>
                            )}
                          </Space>
                        </div>
                      </Radio>
                    );
                  })}
                </Space>
              </Radio.Group>
            </div>
          </div>
        </Spin>
      </Modal>

      {/* Progress Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ClockCircleOutlined style={{ color: '#1677ff' }} />
            <span>PostgreSQL Promotion Progress</span>
          </div>
        }
        open={progressModalVisible}
        onCancel={() => {
          // Only allow closing if process is complete or errored
          const isComplete = progressSteps.every(step => step.status !== 'processing' && step.status !== 'waiting');
          const hasError = progressSteps.some(step => step.status === 'error');

          if (isComplete || hasError) {
            setProgressModalVisible(false);
          }
        }}
        footer={[
          <Button
            key="view-logs"
            type="primary"
            onClick={() => {
              if (activeJobId) {
                setIsJobLogsModalVisible(true);
              } else {
                message.info('No active job logs available');
              }
            }}
            disabled={!activeJobId || jobLogs.length === 0}
          >
            View Detailed Logs
          </Button>,
          <Button
            key="close"
            onClick={() => setProgressModalVisible(false)}
            disabled={progressSteps.some(step => step.status === 'processing')}
          >
            Close
          </Button>
        ]}
        width={500}
      >
        <div style={{ padding: '0 16px' }}>
          {progressSteps.map((step, index) => (
            <div key={index} style={{
              display: 'flex',
              alignItems: 'flex-start',
              marginBottom: '16px',
              opacity: index < currentStep || step.status === 'processing' ? 1 : 0.5
            }}>
              <div style={{
                minWidth: '28px',
                height: '28px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '12px',
                background: step.status === 'finish' ? '#52c41a' :
                  step.status === 'error' ? '#ff4d4f' :
                    step.status === 'processing' ? '#1677ff' : '#f0f0f0',
                color: step.status === 'waiting' ? '#999' : 'white'
              }}>
                {step.status === 'finish' ? (
                  <CheckOutlined />
                ) : step.status === 'error' ? (
                  <CloseOutlined />
                ) : step.status === 'processing' ? (
                  <LoadingOutlined />
                ) : index + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontWeight: 500,
                  color: step.status === 'error' ? '#ff4d4f' :
                    step.status === 'processing' ? '#1677ff' :
                      step.status === 'finish' ? '#52c41a' : '#333',
                }}>
                  {step.text}
                </div>
                {step.status === 'processing' && (
                  <div style={{ marginTop: '5px' }}>
                    <Spin size="small" />
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Final message */}
          {progressSteps.every(step => step.status === 'finish') && (
            <div style={{
              marginTop: '16px',
              padding: '12px',
              background: '#f6ffed',
              border: '1px solid #b7eb8f',
              borderRadius: '4px',
              color: '#52c41a',
              display: 'flex',
              alignItems: 'center'
            }}>
              <CheckCircleOutlined style={{ marginRight: '8px' }} />
              <span>Primary promotion completed successfully! The new topology will be reflected in a few moments.</span>
            </div>
          )}

          {/* Error message */}
          {progressSteps.some(step => step.status === 'error') && (
            <div style={{
              marginTop: '16px',
              padding: '12px',
              background: '#fff2f0',
              border: '1px solid #ffccc7',
              borderRadius: '4px',
              color: '#ff4d4f',
              display: 'flex',
              alignItems: 'center'
            }}>
              <ExclamationCircleOutlined style={{ marginRight: '8px' }} />
              <span>There was an error during the primary promotion process. Please try again or contact system administrator.</span>
            </div>
          )}
        </div>
      </Modal>

      {/* Promote Slave Modal */}
      <Modal
        title={
          <div style={{
            borderBottom: '1px solid #f0f0f0',
            padding: '16px 24px',
            margin: '-20px -24px 20px'
          }}>
            <div style={{ fontSize: '18px', fontWeight: 500, marginBottom: '4px' }}>
              Promote Slave to Master
            </div>
            <div style={{ fontSize: '14px', color: '#666' }}>
              {selectedCluster} PostgreSQL Cluster
            </div>
          </div>
        }
        open={isPromoteSlaveModalVisible}
        onCancel={handlePromoteSlaveModalCancel}
        width={600}
        footer={[
          <Button key="cancel" onClick={handlePromoteSlaveModalCancel}>
            Cancel
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={promoteSlaveLoading}
            onClick={handlePromoteSlave}
            danger
            ref={promoteSlaveButtonRef}
          >
            Promote to Master
          </Button>
        ]}
        styles={{
          body: {
            padding: '0 24px'
          }
        }}
      >
        <Spin spinning={promoteSlaveLoading}>
          <div style={{
            backgroundColor: '#fffbe6',
            border: '1px solid #ffe58f',
            borderRadius: '6px',
            padding: '12px 16px',
            marginBottom: '24px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '8px',
              color: '#d48806'
            }}>
              <WarningOutlined /> Important Information
            </div>
            <div style={{ color: '#666', fontSize: '14px' }}>
              <p style={{ margin: '0 0 8px 0' }}>
                Promoting a slave node to master in a PostgreSQL cluster is a critical operation that:
              </p>
              <ul style={{
                paddingLeft: '20px',
                margin: '0 0 8px 0'
              }}>
                <li>Will cause an immediate failover in the cluster</li>
                <li>May result in a brief interruption in both read and write operations</li>
                <li>Could impact application performance during the failover</li>
              </ul>
              <p style={{ margin: '8px 0 0 0', fontWeight: 500 }}>
                Please ensure this operation is necessary before proceeding.
              </p>
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <div style={{
              backgroundColor: '#e6f4ff',
              border: '1px solid #91caff',
              borderRadius: '6px',
              padding: '12px 16px',
              marginBottom: '16px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '8px',
                color: '#1677ff'
              }}>
                <CrownOutlined /> Current Master Node
              </div>
              {groupedNodes[selectedCluster]?.filter(node =>
                (node.node.status === 'MASTER' || node.node.NodeStatus === 'MASTER')
              ).map(node => {
                const hostname = node.node.nodename || node.node.Hostname;
                const location = node.node.dc || node.node.DC || node.node.Location || 'Unknown';
                return (
                  <div key={hostname} style={{
                    backgroundColor: 'white',
                    padding: '12px',
                    borderRadius: '4px',
                    border: '1px solid #91caff'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontWeight: 500 }}>{hostname}</div>
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          <EnvironmentOutlined style={{ marginRight: '4px' }} />
                          {location}
                        </div>
                      </div>
                      <Tag color="blue">MASTER</Tag>
                    </div>
                  </div>
                );
              })}
            </div>

            <h3 style={{
              fontSize: '16px',
              fontWeight: 500,
              marginBottom: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span>Available Slave Nodes</span>
              <span style={{ fontSize: '12px', color: '#666' }}>
                {groupedNodes[selectedCluster]?.filter(node =>
                  (node.node.status === 'SLAVE' || node.node.NodeStatus === 'SLAVE') &&
                  node.node.PGServiceStatus === 'RUNNING'
                ).length} nodes available
              </span>
            </h3>

            <div style={{
              backgroundColor: '#f6f6f6',
              borderRadius: '6px',
              padding: '16px'
            }}>
              <Radio.Group
                onChange={(e) => setSelectedSlaveNode(e.target.value)}
                value={selectedSlaveNode}
                style={{ width: '100%' }}
              >
                <Space direction="vertical" style={{ width: '100%' }}>
                  {groupedNodes[selectedCluster]?.map(node => {
                    const hostname = node.node.nodename || node.node.Hostname;
                    const location = node.node.dc || node.node.DC || node.node.Location || 'Unknown';
                    const replicationLag = node.node.ReplicationLagSec || 0;
                    const status = node.node.status || node.node.NodeStatus;
                    const pgServiceStatus = node.node.PGServiceStatus;
                    const dataDirectory = node.node.DataDirectory;

                    // Status badge color mapping
                    const getStatusColor = (status: string | undefined) => {
                      if (!status) return '#d9d9d9';

                      switch (status.toUpperCase()) {
                        case 'MASTER':
                          return '#1677ff';
                        case 'SLAVE':
                          return '#52c41a';
                        default:
                          return '#d9d9d9';
                      }
                    };

                    // Skip master nodes in the selection list
                    if (status?.toUpperCase() === 'MASTER') {
                      return null;
                    }

                    const isSelectable = status?.toUpperCase() === 'SLAVE' && pgServiceStatus === 'RUNNING';

                    return (
                      <Radio
                        key={hostname}
                        value={hostname}
                        style={{
                          display: 'block',
                          width: '100%',
                          marginBottom: '8px',
                          backgroundColor: selectedSlaveNode === hostname ? '#e6f7ff' : 'white',
                          padding: '12px',
                          borderRadius: '4px',
                          border: '1px solid ' + (selectedSlaveNode === hostname ? '#91d5ff' : '#d9d9d9'),
                          opacity: isSelectable ? 1 : 0.7,
                          cursor: isSelectable ? 'pointer' : 'not-allowed'
                        }}
                        disabled={!isSelectable}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ fontWeight: 500 }}>{hostname}</div>
                            <div style={{ fontSize: '12px', color: '#666', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span>
                                <EnvironmentOutlined style={{ marginRight: '4px' }} />
                                {location}
                              </span>
                              <Tag style={{ margin: 0 }} color={pgServiceStatus === 'RUNNING' ? 'green' : 'red'}>
                                {pgServiceStatus}
                              </Tag>
                              {dataDirectory && (
                                <span>
                                  <DatabaseOutlined style={{ marginRight: '4px' }} />
                                  {dataDirectory}
                                </span>
                              )}
                            </div>
                          </div>
                          <Space>
                            <Tag color={getStatusColor(status)}>
                              {status?.toUpperCase()}
                            </Tag>
                            {status?.toUpperCase() === 'SLAVE' && (
                              <Tag color={replicationLag < 10 ? 'green' : replicationLag < 30 ? 'orange' : 'red'}>
                                Lag: {replicationLag}s
                              </Tag>
                            )}
                          </Space>
                        </div>
                      </Radio>
                    );
                  })}
                </Space>
              </Radio.Group>
            </div>
          </div>
        </Spin>
      </Modal>

      {/* Job Logs Modal */}
      {renderJobLogsModal()}

      {/* Response Time Modal */}
      {selectedNodeForResponseTime && (
        <ResponseTimeModal
          visible={responseTimeModalVisible}
          onClose={() => {
            setResponseTimeModalVisible(false);
            setSelectedNodeForResponseTime(null);
          }}
          agentId={selectedNodeForResponseTime.agentId}
          nodeName={selectedNodeForResponseTime.nodeName}
          dbType={selectedNodeForResponseTime.dbType}
        />
      )}

      {/* Disk Details Modal */}
      <Modal
        title={`💾 Disk Space Details - ${selectedNodeForDisk?.Hostname || selectedNodeForDisk?.nodename || 'Unknown'}`}
        open={diskDetailsVisible}
        onCancel={() => {
          setDiskDetailsVisible(false);
          setSelectedNodeForDisk(null);
          setDiskDetailsData(null);
        }}
        footer={null}
        width={600}
      >
        <Spin spinning={diskDetailsLoading}>
          {diskDetailsData && diskDetailsData.status === 'success' && diskDetailsData.data?.length > 0 ? (
            <div style={{ padding: '16px 0' }}>
              <Row gutter={[16, 16]}>
                <Col span={24}>
                  <Card title="📊 Disk Usage Statistics" size="small">
                    <Row gutter={16}>
                      <Col span={6}>
                        <Statistic 
                          title="Free Space"
                          value={(() => {
                            // Find the latest free_disk value
                            const freeDiskPoints = diskDetailsData.data.filter((point: any) => point._field === 'free_disk');
                            return freeDiskPoints.length > 0 ? freeDiskPoints[freeDiskPoints.length - 1]._value : 0;
                          })()} 
                          formatter={(value) => `${(Number(value) / (1024*1024*1024)).toFixed(1)} GB`}
                          valueStyle={{ color: '#52c41a' }}
                        />
                      </Col>
                      <Col span={6}>
                        <Statistic 
                          title="Total Space"
                          value={(() => {
                            // Find the latest total_disk value
                            const totalDiskPoints = diskDetailsData.data.filter((point: any) => point._field === 'total_disk');
                            return totalDiskPoints.length > 0 ? totalDiskPoints[totalDiskPoints.length - 1]._value : 0;
                          })()} 
                          formatter={(value) => `${(Number(value) / (1024*1024*1024)).toFixed(1)} GB`}
                        />
                      </Col>
                      <Col span={6}>
                        <Statistic 
                          title="Usage"
                          value={(() => {
                            const freeDiskPoints = diskDetailsData.data.filter((point: any) => point._field === 'free_disk');
                            const totalDiskPoints = diskDetailsData.data.filter((point: any) => point._field === 'total_disk');
                            
                            const freeDisk = freeDiskPoints.length > 0 ? freeDiskPoints[freeDiskPoints.length - 1]._value : 0;
                            const totalDisk = totalDiskPoints.length > 0 ? totalDiskPoints[totalDiskPoints.length - 1]._value : 0;
                            
                            return totalDisk > 0 ? ((1 - freeDisk / totalDisk) * 100) : 0;
                          })()} 
                          formatter={(value) => `${Number(value).toFixed(1)}%`}
                          valueStyle={{ 
                            color: (() => {
                              const freeDiskPoints = diskDetailsData.data.filter((point: any) => point._field === 'free_disk');
                              const totalDiskPoints = diskDetailsData.data.filter((point: any) => point._field === 'total_disk');
                              const freeDisk = freeDiskPoints.length > 0 ? freeDiskPoints[freeDiskPoints.length - 1]._value : 0;
                              const totalDisk = totalDiskPoints.length > 0 ? totalDiskPoints[totalDiskPoints.length - 1]._value : 0;
                              const usage = totalDisk > 0 ? ((1 - freeDisk / totalDisk) * 100) : 0;
                              return usage > 80 ? '#ff4d4f' : usage > 60 ? '#faad14' : '#52c41a';
                            })()
                          }}
                        />
                      </Col>
                      <Col span={6}>
                        <Statistic 
                          title="Filesystem"
                          value={(() => {
                            // Filesystem is now stored as a tag, not a field
                            const anyPoint = diskDetailsData.data.find((point: any) => point.filesystem);
                            return anyPoint?.filesystem || 'N/A';
                          })()}
                          valueStyle={{ fontSize: '14px' }}
                        />
                      </Col>
                    </Row>
                    <Row gutter={16} style={{ marginTop: '16px' }}>
                      <Col span={12}>
                        <Statistic 
                          title="Mount Point"
                          value={(() => {
                            // Mount point is now stored as a tag, not a field
                            const anyPoint = diskDetailsData.data.find((point: any) => point.mount_point);
                            return anyPoint?.mount_point || 'N/A';
                          })()}
                          valueStyle={{ fontSize: '14px' }}
                        />
                      </Col>
                    </Row>
                  </Card>
                </Col>
                <Col span={24}>
                  <Card title="💡 Recommendations" size="small">
                    <div style={{ fontSize: '14px' }}>
                      <p><strong>When disk space is low, consider:</strong></p>
                      <ul style={{ marginLeft: '20px', marginTop: '8px' }}>
                        <li>🗂️ Archive or compress old log files</li>
                        <li>🧹 Run database maintenance (log cleanup, index optimization)</li>
                        <li>📈 Increase storage capacity or add additional disks</li>
                        <li>⚙️ Configure automated cleanup policies</li>
                        <li>📊 Monitor database growth patterns for capacity planning</li>
                      </ul>
                    </div>
                  </Card>
                </Col>
              </Row>
            </div>
          ) : diskDetailsLoading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <p>Loading disk details...</p>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <p>No disk data available for this node</p>
            </div>
          )}
        </Spin>
      </Modal>
    </div>
  );
};

export default NodeStatusGrid;