import React, { useState, useEffect } from 'react';
import { 
    Card, 
    Table, 
    Button, 
    Modal, 
    Form, 
    Input, 
    Select, 
    TimePicker, 
    Space, 
    Tag, 
    Tabs,
    message,
    Tooltip,
    DatePicker,
    Checkbox,
    Divider,
    Row,
    Col,
    Dropdown
} from 'antd';
import { 
    PlusOutlined, 
    DownloadOutlined, 
    PlayCircleOutlined, 
    PauseCircleOutlined,
    DeleteOutlined,
    EditOutlined,
    FileExcelOutlined,
    FileTextOutlined,
    DownOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Report, ReportHistory } from '../interfaces/Report';

const { TabPane } = Tabs;
const { Option } = Select;

const Reports: React.FC = () => {
    const [reports, setReports] = useState<Report[]>([]);
    const [history, setHistory] = useState<ReportHistory[]>([]);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [isComprehensiveModalVisible, setIsComprehensiveModalVisible] = useState(false);
    const [form] = Form.useForm();
    const [comprehensiveForm] = Form.useForm();
    const [editingReport, setEditingReport] = useState<Report | null>(null);
    const [availableClusters, setAvailableClusters] = useState<any[]>([]);
    const [selectedClusters, setSelectedClusters] = useState<string[]>([]);
    const [availableNodes, setAvailableNodes] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [lastReportData, setLastReportData] = useState<any>(null);
    const [lastReportConfig, setLastReportConfig] = useState<any>(null);

    // Fetch reports and history
    useEffect(() => {
        fetchReports();
        fetchHistory();
        fetchAvailableClusters();
    }, []);

    const fetchReports = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/reports`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                }
            });
            const data = await response.json();
            setReports(data.reports);
        } catch (error) {
            console.error('Error fetching reports:', error);
            message.error('Failed to fetch reports');
        }
    };

    const fetchHistory = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/reports/history`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                }
            });
            const data = await response.json();
            setHistory(data.history);
        } catch (error) {
            console.error('Error fetching history:', error);
            message.error('Failed to fetch report history');
        }
    };

    const fetchAvailableClusters = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/status/nodeshealth`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                }
            });
            const data = await response.json();
            
            // Extract cluster information from nodes health data
            const clusters: any[] = [];
            
            // Process MongoDB clusters
            if (data.mongodb) {
                data.mongodb.forEach((cluster: any) => {
                    const clusterName = Object.keys(cluster)[0];
                    const nodes = cluster[clusterName];
                    clusters.push({
                        id: clusterName,
                        name: clusterName,
                        type: 'MongoDB',
                        nodes: nodes.length,
                        nodeList: nodes.map((n: any) => ({
                            hostname: n.Hostname,
                            agentID: n.AgentID || `agent_${n.Hostname}`,
                            isPrimary: n.IsPrimary,
                            status: n.MongoStatus || 'Unknown'
                        }))
                    });
                });
            }
            
            // Process PostgreSQL clusters
            if (data.postgresql) {
                data.postgresql.forEach((cluster: any) => {
                    const clusterName = Object.keys(cluster)[0];
                    const nodes = cluster[clusterName];
                    clusters.push({
                        id: clusterName,
                        name: clusterName,
                        type: 'PostgreSQL',
                        nodes: nodes.length,
                        nodeList: nodes.map((n: any) => ({
                            hostname: n.Hostname,
                            agentID: n.AgentID || `agent_${n.Hostname}`,
                            role: n.Role || 'Unknown',
                            status: n.Status || 'Unknown'
                        }))
                    });
                });
            }
            
            // Process MSSQL clusters
            if (data.mssql) {
                data.mssql.forEach((cluster: any) => {
                    const clusterName = Object.keys(cluster)[0];
                    const nodes = cluster[clusterName];
                    clusters.push({
                        id: clusterName,
                        name: clusterName,
                        type: 'MSSQL',
                        nodes: nodes.length,
                        nodeList: nodes.map((n: any) => ({
                            hostname: n.Hostname,
                            agentID: n.AgentID || `agent_${n.Hostname}`,
                            status: n.Status || 'Unknown'
                        }))
                    });
                });
            }
            
            setAvailableClusters(clusters);
        } catch (error) {
            console.error('Error fetching clusters:', error);
            message.error('Failed to fetch available clusters');
        }
    };

    const handleCreateReport = () => {
        setEditingReport(null);
        form.resetFields();
        setIsModalVisible(true);
    };

    const handleEditReport = (report: Report) => {
        setEditingReport(report);
        form.setFieldsValue({
            ...report,
            time: dayjs(report.schedule.time, 'HH:mm')
        });
        setIsModalVisible(true);
    };

    const handleModalOk = async () => {
        try {
            const values = await form.validateFields();
            const reportData = {
                ...values,
                schedule: {
                    ...values.schedule,
                    time: values.time.format('HH:mm')
                }
            };

            const url = editingReport 
                ? `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/reports/${editingReport.id}`
                : `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/reports`;
            
            const method = editingReport ? 'PUT' : 'POST';

            const token = localStorage.getItem('token');
            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify(reportData)
            });

            if (!response.ok) throw new Error('Failed to save report');

            message.success(`Report ${editingReport ? 'updated' : 'created'} successfully`);
            setIsModalVisible(false);
            fetchReports();
        } catch (error) {
            console.error('Error saving report:', error);
            message.error('Failed to save report');
        }
    };

    const handleDownloadPDF = async (fileUrl: string) => {
        try {
            const response = await fetch(fileUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'report.pdf';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Error downloading PDF:', error);
            message.error('Failed to download PDF');
        }
    };

    const handleToggleStatus = async (report: Report) => {
        try {
            const newStatus = report.status === 'active' ? 'paused' : 'active';
            const token = localStorage.getItem('token');
            await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/reports/${report.id}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ status: newStatus })
            });

            message.success(`Report ${newStatus}`);
            fetchReports();
        } catch (error) {
            console.error('Error updating report status:', error);
            message.error('Failed to update report status');
        }
    };

    const handleDeleteReport = async (reportId: string) => {
        try {
            const token = localStorage.getItem('token');
            await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/reports/${reportId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                }
            });

            message.success('Report deleted');
            fetchReports();
        } catch (error) {
            console.error('Error deleting report:', error);
            message.error('Failed to delete report');
        }
    };

    const handleTestReport = async () => {
        try {
            message.loading({ content: 'Generating report...', key: 'report' });

            // Get date range for last 24 hours
            const endDate = dayjs().format('YYYY-MM-DDTHH:mm:ssZ');
            const startDate = dayjs().subtract(24, 'hours').format('YYYY-MM-DDTHH:mm:ssZ');

            // Fetch nodes health data
            const token = localStorage.getItem('token');
            const nodesResponse = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/status/nodeshealth`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                }
            });
            const nodesResponseData = await nodesResponse.json();
            const nodesData = nodesResponseData.mongodb || [];
            console.log('Nodes data:', nodesData);

            // Fetch recent alarms with date filter
            const alarmsResponse = await fetch(
                `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/status/alarms?` + 
                `start_time=${startDate}&end_time=${endDate}`,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    }
                }
            );
            const alarmsResponseData = await alarmsResponse.json();
            const allAlarms = alarmsResponseData.data?.alarms || [];
            
            // Sort alarms by date (newest first) and take top 5
            const alarmsData = allAlarms
                .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .slice(0, 5);
                
            console.log('Alarms data:', alarmsData);

            // Create a temporary div to render the report content
            const reportContainer = document.createElement('div');
            reportContainer.style.padding = '20px';
            reportContainer.style.backgroundColor = 'white';
            reportContainer.style.width = '800px';
            reportContainer.style.position = 'absolute';
            reportContainer.style.left = '-9999px';
            reportContainer.style.top = '0';
            reportContainer.style.fontFamily = 'Arial, sans-serif';

            // Helper function to format bytes
            const formatBytes = (bytes: number) => {
                const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
                if (bytes === 0) return '0 B';
                const i = Math.floor(Math.log(bytes) / Math.log(1024));
                return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
            };

            // Process nodes data to create cluster summaries
            const processMongoDBClusters = (clusters: any[]) => {
                return clusters.map(cluster => {
                    const clusterName = Object.keys(cluster)[0];
                    const nodes = cluster[clusterName];
                    
                    return {
                        name: clusterName,
                        type: 'MongoDB',
                        totalNodes: nodes.length,
                        running: nodes.filter((n: any) => n.MongoStatus === 'RUNNING').length,
                        version: nodes[0]?.MongoVersion || 'N/A',
                        locations: [...new Set(nodes.map((n: any) => n.Location))].join(', '),
                        avgDiskFree: (nodes.reduce((sum: number, n: any) => {
                            const diskGB = parseFloat(n.FreeDisk);
                            return sum + (isNaN(diskGB) ? 0 : diskGB);
                        }, 0) / nodes.length).toFixed(1) + 'G',
                        avgMemory: formatBytes(nodes.reduce((sum: number, n: any) => sum + (n.TotalMemory || 0), 0) / nodes.length),
                        primary: nodes.find((n: any) => n.NodeStatus === 'PRIMARY')?.Hostname || 'N/A',
                        secondaries: nodes.filter((n: any) => n.NodeStatus === 'SECONDARY').length
                    };
                });
            };

            const processPostgreSQLClusters = (clusters: any[]) => {
                return clusters.map(cluster => {
                    const clusterName = Object.keys(cluster)[0];
                    const nodes = cluster[clusterName];
                    
                    return {
                        name: clusterName,
                        type: 'PostgreSQL',
                        totalNodes: nodes.length,
                        running: nodes.filter((n: any) => n.PGServiceStatus === 'RUNNING').length,
                        version: nodes[0]?.PGVersion || 'N/A',
                        locations: [...new Set(nodes.map((n: any) => n.Location))].join(', '),
                        avgDiskFree: (nodes.reduce((sum: number, n: any) => {
                            const diskGB = n.FreeDisk?.split(' ')[0];
                            return sum + (isNaN(diskGB) ? 0 : parseFloat(diskGB));
                        }, 0) / nodes.length).toFixed(1) + ' GB',
                        avgMemory: formatBytes(nodes.reduce((sum: number, n: any) => sum + (n.TotalMemory || 0), 0) / nodes.length),
                        master: nodes.find((n: any) => n.NodeStatus === 'MASTER')?.Hostname || 'N/A',
                        slaves: nodes.filter((n: any) => n.NodeStatus === 'SLAVE').length
                    };
                });
            };

            const processMSSQLClusters = (clusters: any[]) => {
                return clusters.map(cluster => {
                    const clusterName = Object.keys(cluster)[0];
                    const nodes = cluster[clusterName];
                    
                    return {
                        name: clusterName || 'Standalone',
                        type: 'MSSQL',
                        totalNodes: nodes.length,
                        running: nodes.filter((n: any) => n.Status === 'RUNNING').length,
                        version: nodes[0]?.Version?.split(' ')[0] + ' ' + (nodes[0]?.Version?.split(' ')[1] || '') || 'N/A',
                        locations: [...new Set(nodes.map((n: any) => n.Location))].join(', '),
                        avgDiskFree: (nodes.reduce((sum: number, n: any) => {
                            const diskGB = parseFloat(n.FreeDisk?.split(' ')[0]);
                            return sum + (isNaN(diskGB) ? 0 : diskGB);
                        }, 0) / nodes.length).toFixed(1) + ' GB',
                        avgMemory: formatBytes(nodes.reduce((sum: number, n: any) => sum + (n.TotalMemory || 0), 0) / nodes.length),
                        primary: nodes.find((n: any) => n.HARole === 'PRIMARY' || n.NodeStatus === 'PRIMARY')?.Hostname || 
                                 (nodes[0]?.HARole === 'STANDALONE' ? nodes[0]?.Hostname : 'N/A'),
                        secondaries: nodes.filter((n: any) => n.HARole === 'SECONDARY' || n.NodeStatus === 'SECONDARY').length
                    };
                });
            };

            // Process all clusters
            const mongoDBClusters = processMongoDBClusters(nodesResponseData.mongodb || []);
            const postgreSQLClusters = processPostgreSQLClusters(nodesResponseData.postgresql || []);
            const mssqlClusters = processMSSQLClusters(nodesResponseData.mssql || []);
            const allClusters = [...mongoDBClusters, ...postgreSQLClusters, ...mssqlClusters];

            // Process nodes data to create cluster summaries
            const processMongoDBNodes = (clusters: any[]) => {
                return clusters.map(cluster => {
                    const clusterName = Object.keys(cluster)[0];
                    const nodes = cluster[clusterName];
                    
                    return {
                        clusterName,
                        type: 'MongoDB',
                        nodes: nodes.map((node: any) => ({
                            hostname: node.Hostname,
                            status: node.MongoStatus,
                            nodeType: node.NodeStatus,
                            version: node.MongoVersion,
                            location: node.Location,
                            freeDisk: node.FreeDisk,
                            totalMemory: formatBytes(node.TotalMemory),
                            vcpu: node.TotalVCPU,
                            replicationLag: node.ReplicationLagSec,
                            ip: node.IP,
                            port: node.Port
                        }))
                    };
                });
            };

            const processPostgreSQLNodes = (clusters: any[]) => {
                return clusters.map(cluster => {
                    const clusterName = Object.keys(cluster)[0];
                    const nodes = cluster[clusterName];
                    
                    return {
                        clusterName,
                        type: 'PostgreSQL',
                        nodes: nodes.map((node: any) => ({
                            hostname: node.Hostname,
                            status: node.PGServiceStatus,
                            nodeType: node.NodeStatus,
                            version: node.PGVersion,
                            location: node.Location,
                            freeDisk: node.FreeDisk,
                            totalMemory: formatBytes(node.TotalMemory),
                            vcpu: node.TotalVCPU,
                            replicationLag: node.ReplicationLagSec,
                            ip: node.IP,
                            bouncer: node.PGBouncerStatus
                        }))
                    };
                });
            };

            const processMSSQLNodes = (clusters: any[]) => {
                return clusters.map(cluster => {
                    const clusterName = Object.keys(cluster)[0];
                    const nodes = cluster[clusterName];
                    
                    return {
                        clusterName: clusterName || 'Standalone',
                        type: 'MSSQL',
                        nodes: nodes.map((node: any) => ({
                            hostname: node.Hostname,
                            status: node.Status,
                            nodeType: node.HARole || node.NodeStatus,
                            version: node.Version?.split(' ')[0] + ' ' + (node.Version?.split(' ')[1] || ''),
                            location: node.Location,
                            freeDisk: node.FreeDisk,
                            totalMemory: formatBytes(node.TotalMemory),
                            vcpu: node.TotalVCPU,
                            replicationLag: 'N/A',
                            ip: node.IP,
                            port: node.Port
                        }))
                    };
                });
            };

            // Process all nodes
            const mongoDBNodes = processMongoDBNodes(nodesResponseData.mongodb || []);
            const postgreSQLNodes = processPostgreSQLNodes(nodesResponseData.postgresql || []);
            const mssqlNodes = processMSSQLNodes(nodesResponseData.mssql || []);
            const allNodes = [...mongoDBNodes, ...postgreSQLNodes, ...mssqlNodes];

            // Create HTML content with inline styles
            const content = `
                <div style="font-family: Arial, sans-serif !important; color: #000000;">
                    <div style="text-align: center; margin-bottom: 30px; padding: 20px; background-color: #f0f2f5; border-radius: 8px;">
                        <h1 style="color: #1890ff; margin: 0; font-size: 28px; font-weight: bold;">System Health Report</h1>
                        <p style="color: #666; margin: 10px 0 0 0; font-size: 14px;">Generated on: ${dayjs().format('YYYY-MM-DD HH:mm:ss')}</p>
                    </div>
                    
                    <div style="margin-bottom: 40px;">
                        <h2 style="color: #1890ff; font-size: 22px; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #1890ff;">
                            Cluster Health Summary
                        </h2>
                        ${allClusters.map((cluster: any) => `
                            <div style="background-color: #fafafa; border: 1px solid #e8e8e8; padding: 20px; margin-bottom: 20px; border-radius: 8px;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                                    <h3 style="margin: 0; color: #333; font-size: 18px;">${cluster.name}</h3>
                                    <span style="
                                        padding: 4px 8px;
                                        border-radius: 4px;
                                        background-color: ${cluster.type === 'MongoDB' ? '#00684A' : cluster.type === 'PostgreSQL' ? '#336791' : '#52c41a'};
                                        color: white;
                                        font-size: 12px;
                                    ">${cluster.type}</span>
                                </div>
                                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; font-size: 14px;">
                                    <div style="background: white; padding: 10px; border-radius: 4px; border: 1px solid #e8e8e8;">
                                        <strong>Nodes:</strong> ${cluster.totalNodes} (${cluster.running} running)
                                    </div>
                                    <div style="background: white; padding: 10px; border-radius: 4px; border: 1px solid #e8e8e8;">
                                        <strong>Version:</strong> ${cluster.version}
                                    </div>
                                    <div style="background: white; padding: 10px; border-radius: 4px; border: 1px solid #e8e8e8;">
                                        <strong>Locations:</strong> ${cluster.locations}
                                    </div>
                                    <div style="background: white; padding: 10px; border-radius: 4px; border: 1px solid #e8e8e8;">
                                        <strong>Avg Free Disk:</strong> ${cluster.avgDiskFree}
                                    </div>
                                    <div style="background: white; padding: 10px; border-radius: 4px; border: 1px solid #e8e8e8;">
                                        <strong>Avg Memory:</strong> ${cluster.avgMemory}
                                    </div>
                                    <div style="background: white; padding: 10px; border-radius: 4px; border: 1px solid #e8e8e8;">
                                        <strong>${cluster.type === 'MongoDB' ? 'Primary' : cluster.type === 'PostgreSQL' ? 'Master' : 'Primary'}:</strong> ${cluster.type === 'MongoDB' ? cluster.primary : cluster.type === 'PostgreSQL' ? cluster.master : cluster.primary}
                                    </div>
                                    <div style="background: white; padding: 10px; border-radius: 4px; border: 1px solid #e8e8e8;">
                                        <strong>${cluster.type === 'MongoDB' ? 'Secondaries' : cluster.type === 'PostgreSQL' ? 'Slaves' : 'Secondaries'}:</strong> ${cluster.type === 'MongoDB' ? cluster.secondaries : cluster.type === 'PostgreSQL' ? cluster.slaves : cluster.secondaries}
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>

                    <div style="margin-bottom: 40px;">
                        <h2 style="color: #1890ff; font-size: 22px; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #1890ff;">
                            Node Status Details
                        </h2>
                        ${allNodes.map(cluster => `
                            <div style="margin-bottom: 30px;">
                                <div style="display: flex; align-items: center; margin-bottom: 15px;">
                                    <h3 style="margin: 0; color: #333; font-size: 18px;">${cluster.clusterName}</h3>
                                    <span style="
                                        margin-left: 10px;
                                        padding: 4px 8px;
                                        border-radius: 4px;
                                        background-color: ${cluster.type === 'MongoDB' ? '#00684A' : cluster.type === 'PostgreSQL' ? '#336791' : '#52c41a'};
                                        color: white;
                                        font-size: 12px;
                                    ">${cluster.type}</span>
                                </div>
                                <div style="overflow-x: auto;">
                                    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                                        <thead>
                                            <tr style="background-color: #fafafa;">
                                                <th style="padding: 12px; border: 1px solid #e8e8e8; text-align: left;">Hostname</th>
                                                <th style="padding: 12px; border: 1px solid #e8e8e8; text-align: left;">Status</th>
                                                <th style="padding: 12px; border: 1px solid #e8e8e8; text-align: left;">Role</th>
                                                <th style="padding: 12px; border: 1px solid #e8e8e8; text-align: left;">Version</th>
                                                <th style="padding: 12px; border: 1px solid #e8e8e8; text-align: left;">Location</th>
                                                <th style="padding: 12px; border: 1px solid #e8e8e8; text-align: left;">Free Disk</th>
                                                <th style="padding: 12px; border: 1px solid #e8e8e8; text-align: left;">Memory</th>
                                                <th style="padding: 12px; border: 1px solid #e8e8e8; text-align: left;">vCPU</th>
                                                <th style="padding: 12px; border: 1px solid #e8e8e8; text-align: left;">Replication Lag</th>
                                                ${cluster.type === 'PostgreSQL' ? `
                                                    <th style="padding: 12px; border: 1px solid #e8e8e8; text-align: left;">PgBouncer</th>
                                                ` : `
                                                    <th style="padding: 12px; border: 1px solid #e8e8e8; text-align: left;">Port</th>
                                                `}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${cluster.nodes.map((node: any) => `
                                                <tr>
                                                    <td style="padding: 12px; border: 1px solid #e8e8e8;">
                                                        ${node.hostname}
                                                        <div style="font-size: 11px; color: #666;">${node.ip}</div>
                                                    </td>
                                                    <td style="padding: 12px; border: 1px solid #e8e8e8;">
                                                        <span style="
                                                            padding: 4px 8px;
                                                            border-radius: 4px;
                                                            background-color: ${node.status === 'RUNNING' ? '#52c41a' : '#ff4d4f'};
                                                            color: white;
                                                            font-size: 11px;
                                                        ">${node.status}</span>
                                                    </td>
                                                    <td style="padding: 12px; border: 1px solid #e8e8e8;">
                                                        <span style="
                                                            padding: 4px 8px;
                                                            border-radius: 4px;
                                                            background-color: ${
                                                                node.nodeType === 'PRIMARY' || node.nodeType === 'MASTER' ? '#1890ff' :
                                                                node.nodeType === 'SECONDARY' || node.nodeType === 'SLAVE' ? '#52c41a' :
                                                                node.nodeType === 'STANDALONE' ? '#52c41a' :
                                                                '#faad14'
                                                            };
                                                            color: white;
                                                            font-size: 11px;
                                                        ">${node.nodeType}</span>
                                                    </td>
                                                    <td style="padding: 12px; border: 1px solid #e8e8e8;">${node.version}</td>
                                                    <td style="padding: 12px; border: 1px solid #e8e8e8;">${node.location}</td>
                                                    <td style="padding: 12px; border: 1px solid #e8e8e8;">${node.freeDisk}</td>
                                                    <td style="padding: 12px; border: 1px solid #e8e8e8;">${node.totalMemory}</td>
                                                    <td style="padding: 12px; border: 1px solid #e8e8e8;">${node.vcpu}</td>
                                                    <td style="padding: 12px; border: 1px solid #e8e8e8;">
                                                        ${node.replicationLag === 0 ? 
                                                            '<span style="color: #52c41a;">No Lag</span>' : 
                                                            node.replicationLag === 'N/A' ?
                                                                '<span style="color: #666;">N/A</span>' :
                                                            `<span style="color: #ff4d4f;">${node.replicationLag}s</span>`
                                                        }
                                                    </td>
                                                    ${cluster.type === 'PostgreSQL' ? `
                                                        <td style="padding: 12px; border: 1px solid #e8e8e8;">
                                                            ${node.bouncer === 'N/A' ? 
                                                                '<span style="color: #666;">N/A</span>' :
                                                                `<span style="color: ${node.bouncer === 'RUNNING' ? '#52c41a' : '#ff4d4f'}">${node.bouncer}</span>`
                                                            }
                                                        </td>
                                                    ` : `
                                                        <td style="padding: 12px; border: 1px solid #e8e8e8;">${node.port}</td>
                                                    `}
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        `).join('')}
                    </div>

                </div>
            `;

            reportContainer.innerHTML = content;
            document.body.appendChild(reportContainer);

            // Wait for fonts and styles to load
            await new Promise(resolve => setTimeout(resolve, 2000));

            try {
                // Generate PDF with simplified settings
                const pdf = new jsPDF('p', 'pt', 'a4');
                const canvas = await html2canvas(reportContainer, {
                    scale: 1.5,
                    useCORS: true,
                    logging: true,
                    backgroundColor: '#ffffff',
                    windowWidth: 800,
                    windowHeight: reportContainer.offsetHeight,
                    onclone: (_document, element) => {
                        element.style.width = '800px';
                        element.style.height = 'auto';
                        element.style.margin = '0';
                        element.style.padding = '20px';
                    }
                });

                const imgData = canvas.toDataURL('image/jpeg', 1.0);
                const pageWidth = pdf.internal.pageSize.getWidth();
                const pageHeight = pdf.internal.pageSize.getHeight();
                const imgWidth = canvas.width;
                const imgHeight = canvas.height;
                const ratio = pageWidth / imgWidth;

                let heightLeft = imgHeight * ratio;
                let position = 0;
                let page = 1;

                pdf.addImage(imgData, 'JPEG', 0, position, pageWidth, imgHeight * ratio);

                while (heightLeft >= pageHeight) {
                    position = -pageHeight * page;
                    pdf.addPage();
                    pdf.addImage(imgData, 'JPEG', 0, position, pageWidth, imgHeight * ratio);
                    heightLeft -= pageHeight;
                    page++;
                }

                pdf.save('system-health-report.pdf');
                document.body.removeChild(reportContainer);
                message.success({ content: 'Report generated successfully', key: 'report' });
            } catch (error) {
                console.error('Error in PDF generation:', error);
                message.error({ content: 'Failed to generate report', key: 'report' });
                document.body.removeChild(reportContainer);
            }
        } catch (error) {
            console.error('Error generating report:', error);
            message.error({ content: 'Failed to generate report', key: 'report' });
        }
    };

    const handleComprehensiveReport = () => {
        comprehensiveForm.resetFields();
        comprehensiveForm.setFieldsValue({
            timeRange: { type: 'relative', relative: '1d' },
            sections: {
                systemMetrics: true,
                diskAnalysis: true,
                mongoAnalysis: { enabled: true, includeCollections: true, includeIndexes: true, includePerformance: true },
                postgresAnalysis: { enabled: true, includeBloat: true, includeSlowQueries: true, includeConnections: true },
                mssqlAnalysis: { enabled: true, includeCapacityPlanning: true, includePerformance: true },
                alarmsAnalysis: true,
                recommendations: true
            }
        });
        setIsComprehensiveModalVisible(true);
    };

    const handleGenerateComprehensiveReport = async () => {
        try {
            const values = await comprehensiveForm.validateFields();
            setLoading(true);
            message.loading({ content: 'Generating comprehensive report...', key: 'comprehensive-report' });

            const token = localStorage.getItem('token');
            
            // Get selected node agent IDs  
            const selectedNodes = values.nodes || [];
            
            const reportRequest = {
                timeRange: values.timeRange,
                clusters: selectedNodes,
                sections: values.sections
            };

            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/reports/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify(reportRequest)
            });

            if (!response.ok) {
                throw new Error('Failed to generate report');
            }

            const reportData = await response.json();
            console.log('Report data received:', reportData);
            
            // Store report data and config for export capabilities
            setLastReportData(reportData.data);
            setLastReportConfig(values);
            
            // Generate PDF from the report data
            await generateComprehensivePDF(reportData.data, values);
            
            message.success({ content: 'Comprehensive report generated successfully!', key: 'comprehensive-report' });
            setIsComprehensiveModalVisible(false);
            
        } catch (error) {
            console.error('Error generating comprehensive report:', error);
            message.error({ content: 'Failed to generate comprehensive report', key: 'comprehensive-report' });
        } finally {
            setLoading(false);
        }
    };

    const generateComprehensivePDF = async (reportData: any, config: any) => {
        // Create a temporary div for PDF generation
        const reportContainer = document.createElement('div');
        reportContainer.style.padding = '20px';
        reportContainer.style.backgroundColor = 'white';
        reportContainer.style.width = '800px';
        reportContainer.style.position = 'absolute';
        reportContainer.style.left = '-9999px';
        reportContainer.style.top = '0';
        reportContainer.style.fontFamily = 'Arial, sans-serif';

        // Get selected node names
        const selectedNodeNames = (config.clusters || []).map((nodeId: string) => {
            return nodeId.replace('agent_', '');
        }).join(', ');

        // Format time range for display
        const timeRangeDisplay = config.timeRange.type === 'relative' 
            ? `Last ${config.timeRange.relative}`
            : `${dayjs(config.timeRange.absolute.startDate).format('YYYY-MM-DD HH:mm')} to ${dayjs(config.timeRange.absolute.endDate).format('YYYY-MM-DD HH:mm')}`;
            
        console.log('Generating PDF with data:', reportData);
        console.log('reportData keys in PDF:', Object.keys(reportData || {}));
        console.log('cpuTrends in PDF:', reportData.cpuTrends?.length || 0);
        console.log('memoryTrends in PDF:', reportData.memoryTrends?.length || 0);
        console.log('capacityPlanning in PDF:', reportData.capacityPlanning);
        console.log('capacityPlanning.memoryTrends:', reportData.capacityPlanning?.memoryTrends?.length || 0);
        console.log('Sample memory trend data:', reportData.capacityPlanning?.memoryTrends?.[0]);

        // Generate Recent Alarms section separately to avoid TypeScript issues
        const recentAlarmsSection = `
            <div style="margin-bottom: 40px;">
                <h2 style="color: #1890ff; font-size: 22px; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #1890ff;">
                    Recent Alarms (Last 24 Hours)
                </h2>
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                    <thead>
                        <tr style="background-color: #fafafa;">
                            <th style="padding: 12px; border: 1px solid #e8e8e8; text-align: left; font-weight: bold;">Severity</th>
                            <th style="padding: 12px; border: 1px solid #e8e8e8; text-align: left; font-weight: bold;">Type</th>
                            <th style="padding: 12px; border: 1px solid #e8e8e8; text-align: left; font-weight: bold;">Host</th>
                            <th style="padding: 12px; border: 1px solid #e8e8e8; text-align: left; font-weight: bold;">Message</th>
                            <th style="padding: 12px; border: 1px solid #e8e8e8; text-align: left; font-weight: bold;">Time</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(reportData.recentAlarms || []).map((alarm: any) => `
                            <tr>
                                <td style="padding: 12px; border: 1px solid #e8e8e8;">
                                    <span style="
                                        padding: 4px 8px;
                                        border-radius: 4px;
                                        background-color: ${alarm.severity === 'critical' ? '#ff4d4f' : alarm.severity === 'warning' ? '#faad14' : '#1890ff'};
                                        color: white;
                                        font-size: 12px;
                                        display: inline-block;
                                    ">${alarm.severity.toUpperCase()}</span>
                                </td>
                                <td style="padding: 12px; border: 1px solid #e8e8e8;">${alarm.metric_name}</td>
                                <td style="padding: 12px; border: 1px solid #e8e8e8;">${alarm.agent_id.replace('agent_', '')}</td>
                                <td style="padding: 12px; border: 1px solid #e8e8e8;">${alarm.message.length > 100 ? alarm.message.substring(0, 100) + '...' : alarm.message}</td>
                                <td style="padding: 12px; border: 1px solid #e8e8e8;">${dayjs(alarm.created_at).format('YYYY-MM-DD HH:mm')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                
                <div style="margin-top: 15px; display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div style="background: #fff2e8; padding: 12px; border-radius: 6px; text-align: center;">
                        <strong style="color: #fa8c16;">Total Alarms</strong>
                        <div style="font-size: 24px; font-weight: bold; color: #fa8c16; margin-top: 5px;">
                            ${(reportData.recentAlarms || []).length}
                        </div>
                    </div>
                    <div style="background: #fff1f0; padding: 12px; border-radius: 6px; text-align: center;">
                        <strong style="color: #ff4d4f;">Critical Events</strong>
                        <div style="font-size: 24px; font-weight: bold; color: #ff4d4f; margin-top: 5px;">
                            ${(reportData.recentAlarms || []).filter((alarm: any) => alarm.severity === 'critical').length}
                        </div>
                    </div>
                </div>
            </div>
        `;

        const content = `
            <div style="max-width: 800px; margin: 0 auto; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6;">
                <!-- Header Section -->
                <div style="text-align: center; margin-bottom: 50px; padding: 30px; background: linear-gradient(135deg, #1890ff 0%, #40a9ff 100%); border-radius: 10px; color: white;">
                    <div style="background: white; display: inline-block; padding: 15px 25px; border-radius: 50px; margin-bottom: 20px;">
                        <h1 style="color: #1890ff; font-size: 36px; margin: 0; font-weight: 700;">
                            ClusterEye
                        </h1>
                    </div>
                    <h2 style="font-size: 28px; margin: 0 0 15px 0; font-weight: 600;">
                        Comprehensive Database Report
                    </h2>
                    <div style="background: rgba(255,255,255,0.2); padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <p style="font-size: 16px; margin: 0;">
                            <strong>Generated:</strong> ${dayjs().format('YYYY-MM-DD HH:mm:ss')}
                        </p>
                        <p style="font-size: 16px; margin: 5px 0 0 0;">
                            <strong>Nodes:</strong> ${selectedNodeNames}
                        </p>
                        <p style="font-size: 16px; margin: 5px 0 0 0;">
                            <strong>Time Range:</strong> ${timeRangeDisplay}
                        </p>
                    </div>
                </div>

                <!-- Executive Summary -->
                <div style="margin-bottom: 40px; padding: 25px; background: #f8f9fa; border-radius: 10px; border-left: 5px solid #52c41a;">
                    <h2 style="color: #52c41a; font-size: 22px; margin-bottom: 15px; font-weight: 600;">
                        📊 Executive Summary
                    </h2>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                        <div>
                            <p style="font-size: 14px; color: #666; margin: 0;">Total Clusters Analyzed</p>
                            <p style="font-size: 24px; font-weight: bold; color: #1890ff; margin: 5px 0;">${(config.clusters || []).length}</p>
                        </div>
                        <div>
                            <p style="font-size: 14px; color: #666; margin: 0;">Analysis Period</p>
                            <p style="font-size: 16px; font-weight: bold; color: #1890ff; margin: 5px 0;">${timeRangeDisplay}</p>
                        </div>
                    </div>
                    <div style="margin-top: 15px; padding: 15px; background: white; border-radius: 6px;">
                        <h4 style="margin: 0 0 10px 0; color: #262626;">Report Sections Included:</h4>
                        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                            ${config.sections.systemMetrics ? '<span style="background: #e6f7ff; color: #1890ff; padding: 4px 8px; border-radius: 4px; font-size: 12px;">System Metrics</span>' : ''}
                            ${config.sections.diskAnalysis ? '<span style="background: #e6f7ff; color: #1890ff; padding: 4px 8px; border-radius: 4px; font-size: 12px;">Disk Analysis</span>' : ''}
                            ${config.sections.mongoAnalysis?.enabled ? '<span style="background: #e6f7ff; color: #1890ff; padding: 4px 8px; border-radius: 4px; font-size: 12px;">MongoDB</span>' : ''}
                            ${config.sections.postgresAnalysis?.enabled ? '<span style="background: #e6f7ff; color: #1890ff; padding: 4px 8px; border-radius: 4px; font-size: 12px;">PostgreSQL</span>' : ''}
                            ${config.sections.mssqlAnalysis?.enabled ? '<span style="background: #e6f7ff; color: #1890ff; padding: 4px 8px; border-radius: 4px; font-size: 12px;">MSSQL</span>' : ''}
                            ${config.sections.alarmsAnalysis ? '<span style="background: #e6f7ff; color: #1890ff; padding: 4px 8px; border-radius: 4px; font-size: 12px;">Alarms</span>' : ''}
                            ${config.sections.recommendations ? '<span style="background: #e6f7ff; color: #1890ff; padding: 4px 8px; border-radius: 4px; font-size: 12px;">Capacity Planning</span>' : ''}
                        </div>
                    </div>
                </div>

                ${config.sections.systemMetrics ? `
                    <div style="margin-bottom: 50px; padding: 25px; background: white; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border-left: 5px solid #1890ff;">
                        <div style="display: flex; align-items: center; margin-bottom: 20px;">
                            <div style="background: #1890ff; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 15px; font-size: 18px;">
                                📊
                            </div>
                            <h2 style="color: #1890ff; font-size: 24px; margin: 0; font-weight: 600;">
                                CPU & Memory Performance
                            </h2>
                        </div>
                        <p style="margin-bottom: 20px; color: #666; font-size: 16px;">
                            CPU and Memory utilization analysis with min/max/avg statistics and trends
                        </p>
                        <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e6f7ff 100%); padding: 20px; border-radius: 8px; border: 1px solid #d6f7ff;">
                            <!-- CPU Analysis Section -->
                            <div style="margin-bottom: 30px; padding: 20px; background: white; border-radius: 8px; border: 1px solid #e8f4ff;">
                                <h3 style="margin: 0 0 15px 0; color: #1890ff; font-size: 18px; font-weight: 600;">🖥️ CPU Performance</h3>
                                ${(() => {
                                    const cpuData = reportData.capacityPlanning?.cpuTrends || [];
                                    if (cpuData.length === 0) return '<div style="color: #ff4d4f;">❌ No CPU data available</div>';
                                    
                                    const values = cpuData.map((d: any) => d._value).filter((v: any) => v !== null && v !== undefined);
                                    if (values.length === 0) return '<div style="color: #ff4d4f;">❌ No valid CPU data</div>';
                                    
                                    const min = Math.min(...values);
                                    const max = Math.max(...values);
                                    const avg = values.reduce((a: any, b: any) => a + b, 0) / values.length;
                                    
                                    const minPoint = cpuData.find((d: any) => d._value === min);
                                    const maxPoint = cpuData.find((d: any) => d._value === max);
                                    
                                    return `
                                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                                            <div style="text-align: center; padding: 12px; background: #f0f9ff; border-radius: 6px;">
                                                <p style="margin: 0; color: #666; font-size: 12px;">Minimum</p>
                                                <p style="margin: 5px 0 0 0; font-size: 20px; font-weight: bold; color: #52c41a;">${min.toFixed(1)}%</p>
                                                <p style="margin: 5px 0 0 0; font-size: 10px; color: #999;">${minPoint ? new Date(minPoint._time).toLocaleString() : 'N/A'}</p>
                                            </div>
                                            <div style="text-align: center; padding: 12px; background: #fff7e6; border-radius: 6px;">
                                                <p style="margin: 0; color: #666; font-size: 12px;">Average</p>
                                                <p style="margin: 5px 0 0 0; font-size: 20px; font-weight: bold; color: #fa8c16;">${avg.toFixed(1)}%</p>
                                                <p style="margin: 5px 0 0 0; font-size: 10px; color: #999;">${cpuData.length} data points</p>
                                            </div>
                                            <div style="text-align: center; padding: 12px; background: #fff1f0; border-radius: 6px;">
                                                <p style="margin: 0; color: #666; font-size: 12px;">Maximum</p>
                                                <p style="margin: 5px 0 0 0; font-size: 20px; font-weight: bold; color: #ff4d4f;">${max.toFixed(1)}%</p>
                                                <p style="margin: 5px 0 0 0; font-size: 10px; color: #999;">${maxPoint ? new Date(maxPoint._time).toLocaleString() : 'N/A'}</p>
                                            </div>
                                        </div>
                                        <div style="height: 100px; background: linear-gradient(135deg, #f0f9ff 0%, #e6f7ff 100%); border-radius: 6px; padding: 15px; position: relative; overflow: hidden;">
                                            ${cpuData.slice(-15).map((point: any, index: number) => {
                                                const height = (point._value / max) * 70;
                                                const left = 15 + index * (750 / 15);
                                                return `<div style="position: absolute; bottom: 15px; left: ${left}px; width: 4px; height: ${height}px; background: #1890ff; border-radius: 2px;" title="${point._value}% at ${new Date(point._time).toLocaleString()}"></div>`;
                                            }).join('')}
                                            <div style="position: absolute; bottom: 5px; right: 15px; font-size: 10px; color: #999;">Latest: ${cpuData.slice(-1)[0]?._value?.toFixed(1) || 0}%</div>
                                            <div style="position: absolute; bottom: 5px; left: 15px; font-size: 10px; color: #999;">15 points timeline</div>
                                        </div>
                                    `;
                                })()}
                            </div>
                            
                            <!-- Memory Analysis Section -->
                            <div style="margin-bottom: 30px; padding: 20px; background: white; border-radius: 8px; border: 1px solid #f6ffed;">
                                <h3 style="margin: 0 0 15px 0; color: #52c41a; font-size: 18px; font-weight: 600;">🧠 Memory Performance</h3>
                                ${(() => {
                                    // Try multiple possible paths for memory data
                                    let memoryData = reportData.capacityPlanning?.memoryTrends?.filter((m: any) => m._field === 'memory_usage' || m._field === 'free_memory') || [];
                                    
                                    // If no data found in capacityPlanning, try direct access
                                    if (memoryData.length === 0) {
                                        memoryData = reportData.memoryTrends?.filter((m: any) => m._field === 'memory_usage' || m._field === 'free_memory') || [];
                                    }
                                    
                                    console.log('Memory data found:', memoryData.length, 'items');
                                    console.log('Sample memory data:', memoryData[0]);
                                    
                                    if (memoryData.length === 0) return '<div style="color: #ff4d4f;">❌ No Memory data available</div>';
                                    
                                    const values = memoryData.map((d: any) => d._value).filter((v: any) => v !== null && v !== undefined);
                                    console.log('Memory values sample:', values.slice(0, 5));
                                    console.log('Min/Max values:', Math.min(...values), Math.max(...values));
                                    if (values.length === 0) return '<div style="color: #ff4d4f;">❌ No valid Memory data</div>';
                                    
                                    const min = Math.min(...values);
                                    const max = Math.max(...values);
                                    const avg = values.reduce((a: any, b: any) => a + b, 0) / values.length;
                                    
                                    const minPoint = memoryData.find((d: any) => d._value === min);
                                    const maxPoint = memoryData.find((d: any) => d._value === max);
                                    
                                    // Determine format based on field name and value ranges
                                    const field = memoryData[0]?._field || '';
                                    const maxVal = Math.max(...values);
                                    
                                    // If field is memory_usage AND values are reasonable percentage range (0-100)
                                    const isPercentage = field === 'memory_usage' && maxVal <= 100 && Math.min(...values) >= 0;
                                    
                                    console.log('Field type:', field, 'Max value:', maxVal, 'Is percentage:', isPercentage);
                                    const formatValue = (val: number) => {
                                        if (isPercentage) {
                                            return val.toFixed(1) + '%';
                                        } else if (val > 1024*1024*1024) {
                                            // If value is very large, assume bytes
                                            return (val/1024/1024/1024).toFixed(1) + ' GB';
                                        } else if (val > 1024*1024) {
                                            // If moderately large, assume KB or MB
                                            return (val/1024/1024).toFixed(1) + ' MB';
                                        } else {
                                            // If smaller, could be MB already or percentage
                                            return val.toFixed(1) + ' MB';
                                        }
                                    };
                                    
                                    return `
                                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                                            <div style="text-align: center; padding: 12px; background: #f0f9ff; border-radius: 6px;">
                                                <p style="margin: 0; color: #666; font-size: 12px;">Minimum</p>
                                                <p style="margin: 5px 0 0 0; font-size: 20px; font-weight: bold; color: #52c41a;">${formatValue(min)}</p>
                                                <p style="margin: 5px 0 0 0; font-size: 10px; color: #999;">${minPoint ? new Date(minPoint._time).toLocaleString() : 'N/A'}</p>
                                            </div>
                                            <div style="text-align: center; padding: 12px; background: #fff7e6; border-radius: 6px;">
                                                <p style="margin: 0; color: #666; font-size: 12px;">Average</p>
                                                <p style="margin: 5px 0 0 0; font-size: 20px; font-weight: bold; color: #fa8c16;">${formatValue(avg)}</p>
                                                <p style="margin: 5px 0 0 0; font-size: 10px; color: #999;">${memoryData.length} data points</p>
                                            </div>
                                            <div style="text-align: center; padding: 12px; background: #fff1f0; border-radius: 6px;">
                                                <p style="margin: 0; color: #666; font-size: 12px;">Maximum</p>
                                                <p style="margin: 5px 0 0 0; font-size: 20px; font-weight: bold; color: #ff4d4f;">${formatValue(max)}</p>
                                                <p style="margin: 5px 0 0 0; font-size: 10px; color: #999;">${maxPoint ? new Date(maxPoint._time).toLocaleString() : 'N/A'}</p>
                                            </div>
                                        </div>
                                        <div style="height: 100px; background: linear-gradient(135deg, #f6ffed 0%, #e6ffe6 100%); border-radius: 6px; padding: 15px; position: relative; overflow: hidden;">
                                            ${memoryData.slice(-15).map((point: any, index: number) => {
                                                const height = (point._value / max) * 70;
                                                const left = 15 + index * (750 / 15);
                                                const displayValue = isPercentage ? point._value.toFixed(1) + '%' : (point._value/1024/1024/1024).toFixed(1) + ' GB';
                                                return `<div style="position: absolute; bottom: 15px; left: ${left}px; width: 4px; height: ${height}px; background: #52c41a; border-radius: 2px;" title="${displayValue} at ${new Date(point._time).toLocaleString()}"></div>`;
                                            }).join('')}
                                            <div style="position: absolute; bottom: 5px; right: 15px; font-size: 10px; color: #999;">Latest: ${formatValue(memoryData.slice(-1)[0]?._value || 0)}</div>
                                            <div style="position: absolute; bottom: 5px; left: 15px; font-size: 10px; color: #999;">15 points timeline</div>
                                        </div>
                                    `;
                                })()}
                            </div>
                        </div>
                    </div>

                ${reportData.mongoAnalysis ? `
                                <div style="margin-top: 20px; padding: 15px; background: white; border-radius: 6px; border: 1px solid #d9d9d9;">
                                    <h4 style="margin: 0 0 15px 0; color: #333;">MongoDB Analysis Results</h4>
                                    ${Object.entries(reportData.mongoAnalysis).map(([agentId, data]: [string, any]) => `
                                        <div style="margin-bottom: 20px; padding: 15px; background: #f8f8f8; border-radius: 4px;">
                                            <strong style="color: #52c41a; font-size: 16px;">${agentId.replace('agent_', '')}:</strong>
                                            
                                            ${data.collections ? (() => {
                                                try {
                                                    const decoded = JSON.parse(atob(data.collections.value));
                                                    if (decoded.status === 'success') {
                                                        return `
                                                            <div style="margin-top: 12px; padding: 10px; background: white; border-radius: 4px;">
                                                                <strong>🗃️ Databases:</strong>
                                                                <div style="margin-top: 8px; font-size: 11px;">
                                                                    ${(decoded.data || []).slice(0, 5).map((db: any) => `
                                                                        <span style="display: inline-block; margin: 2px 4px; padding: 2px 6px; background: #e6fffb; border-radius: 2px;">
                                                                            ${db.name}: ${db.sizeOnDisk ? Math.round(db.sizeOnDisk / 1024 / 1024) + 'MB' : 'N/A'}
                                                                        </span>
                                                                    `).join('')}
                                                                </div>
                                                            </div>
                                                        `;
                                                    } else {
                                                        return `<div style="margin-top: 8px; color: #ff4d4f; font-size: 11px;">❌ ${decoded.message}</div>`;
                                                    }
                                                } catch (e) {}
                                                return '<div style="margin-top: 8px; color: #999;">🗃️ Collections: Processing...</div>';
                                            })() : '<div style="margin-top: 8px; color: #999;">🗃️ Collections: N/A</div>'}
                                            
                                            ${data.indexUsage ? (() => {
                                                try {
                                                    const decoded = JSON.parse(atob(data.indexUsage.value));
                                                    if (decoded.status === 'success') {
                                                        return `
                                                            <div style="margin-top: 12px; padding: 10px; background: white; border-radius: 4px;">
                                                                <strong>📇 Index Analysis:</strong>
                                                                <div style="margin-top: 8px; font-size: 11px; color: #52c41a;">
                                                                    ✅ Index usage statistics analyzed
                                                                </div>
                                                            </div>
                                                        `;
                                                    } else {
                                                        return `<div style="margin-top: 8px; color: #ff4d4f; font-size: 11px;">❌ ${decoded.message}</div>`;
                                                    }
                                                } catch (e) {}
                                                return '<div style="margin-top: 8px; color: #999;">📇 Indexes: Processing...</div>';
                                            })() : '<div style="margin-top: 8px; color: #999;">📇 Indexes: N/A</div>'}
                                            
                                            ${data.performance ? (() => {
                                                try {
                                                    const decoded = JSON.parse(atob(data.performance.value));
                                                    if (decoded.status === 'success') {
                                                        return `
                                                            <div style="margin-top: 12px; padding: 10px; background: white; border-radius: 4px;">
                                                                <strong>⚡ Performance Metrics:</strong>
                                                                <div style="margin-top: 8px; font-size: 11px; color: #52c41a;">
                                                                    ✅ Performance analysis completed
                                                                </div>
                                                            </div>
                                                        `;
                                                    } else {
                                                        return `<div style="margin-top: 8px; color: #ff4d4f; font-size: 11px;">❌ ${decoded.message}</div>`;
                                                    }
                                                } catch (e) {}
                                                return '<div style="margin-top: 8px; color: #999;">⚡ Performance: Processing...</div>';
                                            })() : '<div style="margin-top: 8px; color: #999;">⚡ Performance: N/A</div>'}
                                        </div>
                                    `).join('')}
                                </div>
                            ` : ''}
                        </div>
                    </div>
                ` : ''}

                ${config.sections.diskAnalysis ? `
                    <div style="margin-bottom: 50px; padding: 25px; background: white; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border-left: 5px solid #fa8c16;">
                        <div style="display: flex; align-items: center; margin-bottom: 20px;">
                            <div style="background: #fa8c16; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 15px; font-size: 18px;">
                                💾
                            </div>
                            <h2 style="color: #fa8c16; font-size: 24px; margin: 0; font-weight: 600;">
                                Disk Analysis & Capacity Planning
                            </h2>
                        </div>
                        <p style="margin-bottom: 20px; color: #666; font-size: 16px;">
                            Storage utilization patterns, growth trends, and filesystem analysis
                        </p>
                        <div style="background: linear-gradient(135deg, #fff7e6 0%, #ffeee6 100%); padding: 20px; border-radius: 8px; border: 1px solid #ffd6b8;">
                            <div style="background: rgba(250, 140, 22, 0.1); padding: 12px; border-radius: 6px;">
                                <p style="margin: 0; font-size: 14px; color: #fa8c16;"><strong>💽 Storage Data:</strong> ${reportData.diskAnalysis ? Object.keys(reportData.diskAnalysis).length : 0} metrics collected</p>
                                <p style="margin: 8px 0 0 0; font-size: 14px; color: #666;"><em>Disk utilization trends, filesystem details, and growth projections analyzed</em></p>
                            </div>
                        </div>
                    </div>
                ` : ''}

                ${config.sections.mongoAnalysis?.enabled ? `
                    <div style="margin-bottom: 50px; padding: 25px; background: white; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border-left: 5px solid #52c41a;">
                        <div style="display: flex; align-items: center; margin-bottom: 20px;">
                            <div style="background: #52c41a; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 15px; font-size: 18px;">
                                🍃
                            </div>
                            <h2 style="color: #52c41a; font-size: 24px; margin: 0; font-weight: 600;">
                                MongoDB Analysis
                            </h2>
                        </div>
                        <p style="margin-bottom: 20px; color: #666; font-size: 16px;">
                            ${config.sections.mongoAnalysis.includeCollections ? 'Collections, ' : ''}
                            ${config.sections.mongoAnalysis.includeIndexes ? 'Indexes, ' : ''}
                            ${config.sections.mongoAnalysis.includePerformance ? 'Performance ' : ''}
                            analysis for MongoDB clusters
                        </p>
                        <div style="background: linear-gradient(135deg, #f6ffed 0%, #e6f7ff 100%); padding: 20px; border-radius: 8px; border: 1px solid #b7eb8f;">
                            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                                ${config.sections.mongoAnalysis.includeCollections ? `
                                    <div style="background: white; padding: 15px; border-radius: 6px; text-align: center;">
                                        <p style="margin: 0; color: #666; font-size: 14px;">Collections</p>
                                        <p style="margin: 5px 0 0 0; font-size: 16px; font-weight: bold; color: #52c41a;">
                                            ${reportData.mongoAnalysis ? '✅ Analyzed' : '❌ No Data'}
                                        </p>
                                    </div>
                                ` : ''}
                                ${config.sections.mongoAnalysis.includeIndexes ? `
                                    <div style="background: white; padding: 15px; border-radius: 6px; text-align: center;">
                                        <p style="margin: 0; color: #666; font-size: 14px;">Indexes</p>
                                        <p style="margin: 5px 0 0 0; font-size: 16px; font-weight: bold; color: #52c41a;">
                                            ${reportData.mongoAnalysis ? '✅ Analyzed' : '❌ No Data'}
                                        </p>
                                    </div>
                                ` : ''}
                                ${config.sections.mongoAnalysis.includePerformance ? `
                                    <div style="background: white; padding: 15px; border-radius: 6px; text-align: center;">
                                        <p style="margin: 0; color: #666; font-size: 14px;">Performance</p>
                                        <p style="margin: 5px 0 0 0; font-size: 16px; font-weight: bold; color: #52c41a;">
                                            ${reportData.mongoAnalysis ? '✅ Analyzed' : '❌ No Data'}
                                        </p>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                ` : ''}

                ${config.sections.postgresAnalysis?.enabled ? `
                    <div style="margin-bottom: 50px; padding: 25px; background: white; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border-left: 5px solid #1890ff;">
                        <div style="display: flex; align-items: center; margin-bottom: 20px;">
                            <div style="background: #1890ff; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 15px; font-size: 18px;">
                                🐘
                            </div>
                            <h2 style="color: #1890ff; font-size: 24px; margin: 0; font-weight: 600;">
                                PostgreSQL Analysis
                            </h2>
                        </div>
                        <p style="margin-bottom: 20px; color: #666; font-size: 16px;">
                            Bloat analysis, top queries, and connection statistics for PostgreSQL clusters
                        </p>
                        <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e6f7ff 100%); padding: 20px; border-radius: 8px; border: 1px solid #d6f7ff;">
                            
                            ${reportData.postgresAnalysis ? `
                                <div style="margin-top: 20px; padding: 15px; background: white; border-radius: 6px; border: 1px solid #d9d9d9;">
                                    <h4 style="margin: 0 0 15px 0; color: #333;">PostgreSQL Analysis Results</h4>
                                    ${Object.entries(reportData.postgresAnalysis).map(([agentId, data]: [string, any]) => `
                                        <div style="margin-bottom: 20px; padding: 15px; background: #f8f8f8; border-radius: 4px;">
                                            <strong style="color: #1890ff; font-size: 16px;">${agentId.replace('agent_', '')}:</strong>
                                            
                                            ${data.connectionStats ? (() => {
                                                try {
                                                    const decoded = JSON.parse(atob(data.connectionStats.value));
                                                    if (decoded.status === 'success') {
                                                        return `
                                                            <div style="margin-top: 12px; padding: 10px; background: white; border-radius: 4px;">
                                                                <strong>🔗 Connection Analysis:</strong>
                                                                <div style="margin-top: 8px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; font-size: 11px;">
                                                                    <span>Idle: ${decoded.count_0 || 0}</span>
                                                                    <span>Active: ${decoded.count_1 || 0}</span>
                                                                    <span>Total: ${(decoded.count_0 || 0) + (decoded.count_1 || 0)}</span>
                                                                </div>
                                                            </div>
                                                        `;
                                                    }
                                                } catch (e) {}
                                                return '<div style="margin-top: 8px; color: #999;">🔗 Connections: Processing...</div>';
                                            })() : '<div style="margin-top: 8px; color: #999;">🔗 Connections: N/A</div>'}
                                            
                                            ${data.tableBloat ? (() => {
                                                try {
                                                    const decoded = JSON.parse(atob(data.tableBloat.value));
                                                    if (decoded.status === 'success') {
                                                        return `
                                                            <div style="margin-top: 12px; padding: 10px; background: white; border-radius: 4px;">
                                                                <strong>📊 Table Sizes (Top 5):</strong>
                                                                <div style="margin-top: 8px; font-size: 11px;">
                                                                    ${(decoded.data || []).slice(0, 5).map((table: any) => `
                                                                        <div style="margin: 2px 0; padding: 2px 0;">
                                                                            ${table.schemaname}.${table.tablename}: ${table.size}
                                                                        </div>
                                                                    `).join('')}
                                                                </div>
                                                            </div>
                                                        `;
                                                    }
                                                } catch (e) {}
                                                return '<div style="margin-top: 8px; color: #999;">📊 Table Analysis: Processing...</div>';
                                            })() : '<div style="margin-top: 8px; color: #999;">📊 Table Analysis: N/A</div>'}
                                            
                                            ${data.topQueries ? (() => {
                                                try {
                                                    const decoded = JSON.parse(atob(data.topQueries.value));
                                                    if (decoded.status === 'success') {
                                                        return `
                                                            <div style="margin-top: 12px; padding: 10px; background: white; border-radius: 4px;">
                                                                <strong>🔍 Active Queries:</strong>
                                                                <div style="margin-top: 8px; font-size: 11px;">
                                                                    ${(decoded.data || []).slice(0, 3).map((query: any) => `
                                                                        <div style="margin: 4px 0; padding: 4px; background: #f0f0f0; border-radius: 2px;">
                                                                            <strong>${query.usename}</strong>: ${(query.query || '').substring(0, 80)}${query.query?.length > 80 ? '...' : ''}
                                                                            <br><span style="color: #666;">State: ${query.state}</span>
                                                                        </div>
                                                                    `).join('')}
                                                                </div>
                                                            </div>
                                                        `;
                                                    }
                                                } catch (e) {}
                                                return '<div style="margin-top: 8px; color: #999;">🔍 Queries: Processing...</div>';
                                            })() : '<div style="margin-top: 8px; color: #999;">🔍 Queries: N/A</div>'}
                                        </div>
                                    `).join('')}
                                </div>
                            ` : ''}
                        </div>
                    </div>
                ` : ''}

                ${config.sections.mssqlAnalysis?.enabled ? `
                    <div style="margin-bottom: 50px; padding: 25px; background: white; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border-left: 5px solid #722ed1;">
                        <div style="display: flex; align-items: center; margin-bottom: 20px;">
                            <div style="background: #722ed1; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 15px; font-size: 18px;">
                                🗄️
                            </div>
                            <h2 style="color: #722ed1; font-size: 24px; margin: 0; font-weight: 600;">
                                MSSQL Analysis
                            </h2>
                        </div>
                        <p style="margin-bottom: 20px; color: #666; font-size: 16px;">
                            ${config.sections.mssqlAnalysis.includeCapacityPlanning ? 'Capacity planning, ' : ''}
                            ${config.sections.mssqlAnalysis.includePerformance ? 'Performance ' : ''}
                            analysis for MSSQL Server clusters
                        </p>
                        <div style="background: linear-gradient(135deg, #f9f0ff 0%, #f0e6ff 100%); padding: 20px; border-radius: 8px; border: 1px solid #d3adf7;">
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                                ${config.sections.mssqlAnalysis.includeCapacityPlanning ? `
                                    <div style="background: white; padding: 15px; border-radius: 6px; text-align: center;">
                                        <p style="margin: 0; color: #666; font-size: 14px;">Capacity Planning</p>
                                        <p style="margin: 5px 0 0 0; font-size: 16px; font-weight: bold; color: #722ed1;">
                                            ${reportData.mssqlAnalysis?.capacity ? '✅ Analyzed' : '📊 Ready'}
                                        </p>
                                    </div>
                                ` : ''}
                                ${config.sections.mssqlAnalysis.includePerformance ? `
                                    <div style="background: white; padding: 15px; border-radius: 6px; text-align: center;">
                                        <p style="margin: 0; color: #666; font-size: 14px;">Performance</p>
                                        <p style="margin: 5px 0 0 0; font-size: 16px; font-weight: bold; color: #722ed1;">
                                            ${reportData.mssqlAnalysis?.performance ? '✅ Analyzed' : '📊 Ready'}
                                        </p>
                                    </div>
                                ` : ''}
                            </div>
                            <div style="background: rgba(114, 46, 209, 0.1); padding: 12px; border-radius: 6px;">
                                <p style="margin: 0; font-size: 14px; color: #722ed1;"><strong>🗄️ MSSQL Data:</strong> Connection patterns and performance metrics analyzed</p>
                            </div>
                        </div>
                    </div>
                ` : ''}

                ${config.sections.postgresAnalysis?.enabled ? `
                    <div style="margin-bottom: 50px; padding: 25px; background: white; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border-left: 5px solid #1890ff;">
                        <div style="display: flex; align-items: center; margin-bottom: 20px;">
                            <div style="background: #1890ff; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 15px; font-size: 18px;">
                                🐘
                            </div>
                            <h2 style="color: #1890ff; font-size: 24px; margin: 0; font-weight: 600;">
                                PostgreSQL Analysis
                            </h2>
                        </div>
                        <p style="margin-bottom: 20px; color: #666; font-size: 16px;">
                            ${config.sections.postgresAnalysis.includeBloat ? 'Bloat analysis, ' : ''}
                            ${config.sections.postgresAnalysis.includeSlowQueries ? 'Slow queries, ' : ''}
                            ${config.sections.postgresAnalysis.includeConnections ? 'Connections ' : ''}
                            analysis for PostgreSQL clusters
                        </p>
                        <div style="background: linear-gradient(135deg, #e6f7ff 0%, #f0f9ff 100%); padding: 20px; border-radius: 8px; border: 1px solid #91d5ff;">
                            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                                ${config.sections.postgresAnalysis.includeBloat ? `
                                    <div style="background: white; padding: 15px; border-radius: 6px; text-align: center;">
                                        <p style="margin: 0; color: #666; font-size: 14px;">Table/Index Bloat</p>
                                        <p style="margin: 5px 0 0 0; font-size: 16px; font-weight: bold; color: #1890ff;">
                                            ${reportData.postgresAnalysis?.bloat ? '✅ Analyzed' : '📊 Ready'}
                                        </p>
                                    </div>
                                ` : ''}
                                ${config.sections.postgresAnalysis.includeSlowQueries ? `
                                    <div style="background: white; padding: 15px; border-radius: 6px; text-align: center;">
                                        <p style="margin: 0; color: #666; font-size: 14px;">Slow Queries</p>
                                        <p style="margin: 5px 0 0 0; font-size: 16px; font-weight: bold; color: #1890ff;">
                                            ${reportData.postgresAnalysis?.slowQueries ? '✅ Analyzed' : '📊 Ready'}
                                        </p>
                                    </div>
                                ` : ''}
                                ${config.sections.postgresAnalysis.includeConnections ? `
                                    <div style="background: white; padding: 15px; border-radius: 6px; text-align: center;">
                                        <p style="margin: 0; color: #666; font-size: 14px;">Connections</p>
                                        <p style="margin: 5px 0 0 0; font-size: 16px; font-weight: bold; color: #1890ff;">
                                            ${reportData.postgresAnalysis?.connections ? '✅ Analyzed' : '📊 Ready'}
                                        </p>
                                    </div>
                                ` : ''}
                            </div>
                            <div style="background: rgba(24, 144, 255, 0.1); padding: 12px; border-radius: 6px;">
                                <p style="margin: 0; font-size: 14px; color: #1890ff;"><strong>🐘 PostgreSQL Data:</strong> Performance and optimization insights collected</p>
                            </div>
                        </div>
                    </div>
                ` : ''}

                ${config.sections.alarmsAnalysis ? `
                    <div style="margin-bottom: 50px; padding: 25px; background: white; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border-left: 5px solid #ff4d4f;">
                        <div style="display: flex; align-items: center; margin-bottom: 20px;">
                            <div style="background: #ff4d4f; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 15px; font-size: 18px;">
                                🚨
                            </div>
                            <h2 style="color: #ff4d4f; font-size: 24px; margin: 0; font-weight: 600;">
                                Alarms & Monitoring
                            </h2>
                        </div>
                        <p style="margin-bottom: 20px; color: #666; font-size: 16px;">
                            Alarm statistics, trends, and critical events for the selected time period
                        </p>
                        <div style="background: linear-gradient(135deg, #fff1f0 0%, #ffebe6 100%); padding: 20px; border-radius: 8px; border: 1px solid #ffb3b3;">
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                                <div style="background: white; padding: 15px; border-radius: 6px; text-align: center;">
                                    <p style="margin: 0; color: #666; font-size: 14px;">Total Alarms</p>
                                    <p style="margin: 5px 0 0 0; font-size: 20px; font-weight: bold; color: #ff4d4f;">
                                        ${reportData.alarmsData ? Object.keys(reportData.alarmsData).length : 0}
                                    </p>
                                </div>
                                <div style="background: white; padding: 15px; border-radius: 6px; text-align: center;">
                                    <p style="margin: 0; color: #666; font-size: 14px;">Critical Events</p>
                                    <p style="margin: 5px 0 0 0; font-size: 20px; font-weight: bold; color: #ff4d4f;">
                                        ${reportData.alarmsData ? '📊 Tracked' : '⏳ Pending'}
                                    </p>
                                </div>
                            </div>
                            <div style="background: rgba(255, 77, 79, 0.1); padding: 12px; border-radius: 6px;">
                                <p style="margin: 0; font-size: 14px; color: #ff4d4f;"><strong>🚨 Monitoring Data:</strong> Alarm patterns and severity trends analyzed</p>
                            </div>
                            
                            ${recentAlarmsSection}
                        </div>
                    </div>
                ` : ''}

                ${config.sections.recommendations ? `
                    <div style="margin-bottom: 50px; padding: 25px; background: white; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border-left: 5px solid #722ed1;">
                        <div style="display: flex; align-items: center; margin-bottom: 20px;">
                            <div style="background: #722ed1; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 15px; font-size: 18px;">
                                📈
                            </div>
                            <h2 style="color: #722ed1; font-size: 24px; margin: 0; font-weight: 600;">
                                Capacity Planning & Recommendations
                            </h2>
                        </div>
                        <p style="margin-bottom: 20px; color: #666; font-size: 16px;">
                            Resource utilization trends, growth projections, and optimization recommendations
                        </p>
                        <div style="background: linear-gradient(135deg, #f9f0ff 0%, #f0e6ff 100%); padding: 20px; border-radius: 8px; border: 1px solid #d3adf7;">
                            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr 1fr; gap: 12px; margin-bottom: 15px;">
                                <div style="background: white; padding: 12px; border-radius: 6px; text-align: center;">
                                    <p style="margin: 0; color: #666; font-size: 12px;">Disk Growth</p>
                                    <p style="margin: 3px 0 0 0; font-size: 14px; font-weight: bold; color: #722ed1;">
                                        ${reportData.capacityPlanning?.diskTrends ? `${reportData.capacityPlanning.diskTrends.length} trends` : '❌ No Data'}
                                    </p>
                                </div>
                                <div style="background: white; padding: 12px; border-radius: 6px; text-align: center;">
                                    <p style="margin: 0; color: #666; font-size: 12px;">Memory</p>
                                    <p style="margin: 3px 0 0 0; font-size: 14px; font-weight: bold; color: #722ed1;">
                                        ${reportData.capacityPlanning?.memoryTrends ? `${reportData.capacityPlanning.memoryTrends.length} trends` : '❌ No Data'}
                                    </p>
                                </div>
                                <div style="background: white; padding: 12px; border-radius: 6px; text-align: center;">
                                    <p style="margin: 0; color: #666; font-size: 12px;">CPU</p>
                                    <p style="margin: 3px 0 0 0; font-size: 14px; font-weight: bold; color: #722ed1;">
                                        ${reportData.capacityPlanning?.cpuTrends ? `${reportData.capacityPlanning.cpuTrends.length} trends` : '❌ No Data'}
                                    </p>
                                </div>
                                <div style="background: white; padding: 12px; border-radius: 6px; text-align: center;">
                                    <p style="margin: 0; color: #666; font-size: 12px;">Connections</p>
                                    <p style="margin: 3px 0 0 0; font-size: 14px; font-weight: bold; color: #722ed1;">
                                        ${reportData.capacityPlanning?.connectionTrends ? '📊' : '⏳'}
                                    </p>
                                </div>
                                <div style="background: white; padding: 12px; border-radius: 6px; text-align: center;">
                                    <p style="margin: 0; color: #666; font-size: 12px;">DB Size</p>
                                    <p style="margin: 3px 0 0 0; font-size: 14px; font-weight: bold; color: #722ed1;">
                                        ${reportData.capacityPlanning?.databaseSizeTrends ? '📊' : '⏳'}
                                    </p>
                                </div>
                            </div>
                            <div style="background: rgba(114, 46, 209, 0.1); padding: 12px; border-radius: 6px;">
                                <p style="margin: 0; font-size: 14px; color: #722ed1;"><strong>📈 Forecasting:</strong> Trend analysis and capacity recommendations generated</p>
                            </div>
                            
                            ${reportData.capacityPlanning ? `
                                <div style="margin-top: 20px; padding: 15px; background: white; border-radius: 6px; border: 1px solid #d9d9d9;">
                                    <h4 style="margin: 0 0 15px 0; color: #333;">Capacity Planning Metrics</h4>
                                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                                        ${reportData.capacityPlanning.diskTrends ? `
                                            <div style="padding: 10px; background: #f8f8f8; border-radius: 4px;">
                                                <strong>💾 Disk Trends:</strong> ${reportData.capacityPlanning.diskTrends.length} data points
                                                ${reportData.capacityPlanning.diskTrends.slice(0, 3).map((trend: any) => `
                                                    <div style="font-size: 11px; margin-top: 4px; color: #666;">
                                                        ${trend.agent_id?.replace('agent_', '')}: ${trend._field?.includes('disk') ? Math.round((trend._value || 0) / 1024 / 1024 / 1024 * 100) / 100 + ' GB' : Math.round(trend._value || 0) + '%'}
                                                    </div>
                                                `).join('')}
                                            </div>
                                        ` : ''}
                                        ${reportData.capacityPlanning.cpuTrends ? `
                                            <div style="padding: 10px; background: #f8f8f8; border-radius: 4px;">
                                                <strong>⚡ CPU Trends:</strong> ${reportData.capacityPlanning.cpuTrends.length} data points
                                                ${reportData.capacityPlanning.cpuTrends.slice(0, 3).map((trend: any) => `
                                                    <div style="font-size: 11px; margin-top: 4px; color: #666;">
                                                        ${trend.agent_id?.replace('agent_', '')}: ${Math.round(trend._value || 0)}%
                                                    </div>
                                                `).join('')}
                                            </div>
                                        ` : ''}
                                        ${reportData.capacityPlanning.connectionTrends ? `
                                            <div style="padding: 10px; background: #f8f8f8; border-radius: 4px;">
                                                <strong>🔗 Connection Analysis:</strong> ${reportData.capacityPlanning.connectionTrends.length} data points
                                                <div style="margin-top: 8px;">
                                                    ${(() => {
                                                        const available = reportData.capacityPlanning.connectionTrends.filter((t: any) => t._field === 'available');
                                                        const total = reportData.capacityPlanning.connectionTrends.filter((t: any) => t._field === 'total');
                                                        const max_conn = reportData.capacityPlanning.connectionTrends.filter((t: any) => t._field === 'max_connections');
                                                        return `
                                                            <div style="font-size: 11px; line-height: 1.4;">
                                                                ${available.length > 0 ? `<div>📊 Available: ${Math.round(available.slice(-1)[0]?._value || 0)}</div>` : ''}
                                                                ${total.length > 0 ? `<div>🔢 Current: ${Math.round(total.slice(-1)[0]?._value || 0)}</div>` : ''}
                                                                ${max_conn.length > 0 ? `<div>🏁 Max: ${Math.round(max_conn.slice(-1)[0]?._value || 0)}</div>` : ''}
                                                                ${total.length > 0 && max_conn.length > 0 ? `<div style="color: ${(total.slice(-1)[0]?._value / max_conn.slice(-1)[0]?._value) > 0.8 ? '#ff4d4f' : '#52c41a'};">📈 Usage: ${Math.round((total.slice(-1)[0]?._value / max_conn.slice(-1)[0]?._value) * 100)}%</div>` : ''}
                                                            </div>
                                                        `;
                                                    })()}
                                                </div>
                                            </div>
                                        ` : ''}
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;

        reportContainer.innerHTML = content;
        document.body.appendChild(reportContainer);

        // Wait for fonts and styles to load
        await new Promise(resolve => setTimeout(resolve, 1000));

        try {
            const pdf = new jsPDF('p', 'pt', 'a4');
            const canvas = await html2canvas(reportContainer, {
                scale: 1.5,
                useCORS: true,
                backgroundColor: '#ffffff',
                windowWidth: 800,
            });

            const imgData = canvas.toDataURL('image/jpeg', 1.0);
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            const ratio = pageWidth / imgWidth;

            let heightLeft = imgHeight * ratio;
            let position = 0;
            let page = 1;

            pdf.addImage(imgData, 'JPEG', 0, position, pageWidth, imgHeight * ratio);

            while (heightLeft >= pageHeight) {
                position = -pageHeight * page;
                pdf.addPage();
                pdf.addImage(imgData, 'JPEG', 0, position, pageWidth, imgHeight * ratio);
                heightLeft -= pageHeight;
                page++;
            }

            pdf.save(`comprehensive-report-${dayjs().format('YYYY-MM-DD-HH-mm')}.pdf`);
            
        } finally {
            document.body.removeChild(reportContainer);
        }
    };

    const exportToCSV = (reportData: any, config: any) => {
        const csvData = [];
        const timestamp = dayjs().format('YYYY-MM-DD HH:mm:ss');
        const selectedNodeNames = (config.clusters || []).map((nodeId: string) => {
            return nodeId.replace('agent_', '');
        }).join(', ');

        csvData.push(['ClusterEye Comprehensive Report']);
        csvData.push(['Generated', timestamp]);
        csvData.push(['Nodes', selectedNodeNames]);
        csvData.push(['Time Range', config.timeRange.type === 'relative' 
            ? `Last ${config.timeRange.relative}`
            : `${dayjs(config.timeRange.absolute.startDate).format('YYYY-MM-DD HH:mm')} to ${dayjs(config.timeRange.absolute.endDate).format('YYYY-MM-DD HH:mm')}`]);
        csvData.push([]);

        if (config.sections.systemMetrics && reportData.systemMetrics) {
            csvData.push(['System Performance Metrics']);
            csvData.push(['Metric Type', 'Value', 'Timestamp']);
            Object.entries(reportData.systemMetrics).forEach(([key, value]: [string, any]) => {
                if (Array.isArray(value)) {
                    value.forEach((item: any) => {
                        csvData.push([key, item.value || '', item.timestamp || '']);
                    });
                }
            });
            csvData.push([]);
        }

        if (config.sections.diskAnalysis && reportData.diskAnalysis) {
            csvData.push(['Disk Analysis']);
            csvData.push(['Filesystem', 'Mount Point', 'Used %', 'Total GB', 'Timestamp']);
            Object.entries(reportData.diskAnalysis).forEach(([_key, value]: [string, any]) => {
                if (Array.isArray(value)) {
                    value.forEach((item: any) => {
                        csvData.push([
                            item.filesystem || '',
                            item.mount_point || '',
                            item.used_percent || '',
                            item.total_gb || '',
                            item.timestamp || ''
                        ]);
                    });
                }
            });
            csvData.push([]);
        }

        if (config.sections.mongoAnalysis?.enabled && reportData.mongoAnalysis) {
            csvData.push(['MongoDB Analysis']);
            if (reportData.mongoAnalysis.collections) {
                csvData.push(['Collections', 'Document Count', 'Size MB']);
                reportData.mongoAnalysis.collections.forEach((col: any) => {
                    csvData.push([col.name || '', col.count || '', col.size || '']);
                });
                csvData.push([]);
            }
            if (reportData.mongoAnalysis.indexes) {
                csvData.push(['Indexes', 'Size MB', 'Usage']);
                reportData.mongoAnalysis.indexes.forEach((idx: any) => {
                    csvData.push([idx.name || '', idx.size || '', idx.accesses || '']);
                });
                csvData.push([]);
            }
        }

        if (config.sections.alarmsAnalysis && reportData.alarmsData) {
            csvData.push(['Alarms Analysis']);
            csvData.push(['Alarm Type', 'Count', 'Severity']);
            Object.entries(reportData.alarmsData).forEach(([_key, value]: [string, any]) => {
                csvData.push([_key, value.count || '', value.severity || '']);
            });
            csvData.push([]);
        }

        const csvContent = csvData.map(row => 
            row.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(',')
        ).join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `comprehensive-report-${dayjs().format('YYYY-MM-DD-HH-mm')}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const exportToExcel = async (reportData: any, config: any) => {
        try {
            const XLSX = await import('xlsx');
            const workbook = XLSX.utils.book_new();
            
            const selectedNodeNames = (config.clusters || []).map((nodeId: string) => {
                return nodeId.replace('agent_', '');
            }).join(', ');

            const summaryData = [
                ['ClusterEye Comprehensive Report'],
                ['Generated', dayjs().format('YYYY-MM-DD HH:mm:ss')],
                ['Nodes', selectedNodeNames],
                ['Time Range', config.timeRange.type === 'relative' 
                    ? `Last ${config.timeRange.relative}`
                    : `${dayjs(config.timeRange.absolute.startDate).format('YYYY-MM-DD HH:mm')} to ${dayjs(config.timeRange.absolute.endDate).format('YYYY-MM-DD HH:mm')}`]
            ];
            const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
            XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

            if (config.sections.systemMetrics && reportData.systemMetrics) {
                const systemMetricsData = [['Metric Type', 'Value', 'Timestamp']];
                Object.entries(reportData.systemMetrics).forEach(([key, value]: [string, any]) => {
                    if (Array.isArray(value)) {
                        value.forEach((item: any) => {
                            systemMetricsData.push([key, item.value || '', item.timestamp || '']);
                        });
                    }
                });
                const systemSheet = XLSX.utils.aoa_to_sheet(systemMetricsData);
                XLSX.utils.book_append_sheet(workbook, systemSheet, 'System Metrics');
            }

            if (config.sections.diskAnalysis && reportData.diskAnalysis) {
                const diskData = [['Filesystem', 'Mount Point', 'Used %', 'Total GB', 'Timestamp']];
                Object.entries(reportData.diskAnalysis).forEach(([_key, value]: [string, any]) => {
                    if (Array.isArray(value)) {
                        value.forEach((item: any) => {
                            diskData.push([
                                item.filesystem || '',
                                item.mount_point || '',
                                item.used_percent || '',
                                item.total_gb || '',
                                item.timestamp || ''
                            ]);
                        });
                    }
                });
                const diskSheet = XLSX.utils.aoa_to_sheet(diskData);
                XLSX.utils.book_append_sheet(workbook, diskSheet, 'Disk Analysis');
            }

            if (config.sections.mongoAnalysis?.enabled && reportData.mongoAnalysis) {
                if (reportData.mongoAnalysis.collections) {
                    const collectionsData = [['Collection Name', 'Document Count', 'Size MB']];
                    reportData.mongoAnalysis.collections.forEach((col: any) => {
                        collectionsData.push([col.name || '', col.count || '', col.size || '']);
                    });
                    const collectionsSheet = XLSX.utils.aoa_to_sheet(collectionsData);
                    XLSX.utils.book_append_sheet(workbook, collectionsSheet, 'MongoDB Collections');
                }
                
                if (reportData.mongoAnalysis.indexes) {
                    const indexesData = [['Index Name', 'Size MB', 'Usage Count']];
                    reportData.mongoAnalysis.indexes.forEach((idx: any) => {
                        indexesData.push([idx.name || '', idx.size || '', idx.accesses || '']);
                    });
                    const indexesSheet = XLSX.utils.aoa_to_sheet(indexesData);
                    XLSX.utils.book_append_sheet(workbook, indexesSheet, 'MongoDB Indexes');
                }
            }

            if (config.sections.alarmsAnalysis && reportData.alarmsData) {
                const alarmsData = [['Alarm Type', 'Count', 'Severity']];
                Object.entries(reportData.alarmsData).forEach(([_key, value]: [string, any]) => {
                    alarmsData.push([_key, value.count || '', value.severity || '']);
                });
                const alarmsSheet = XLSX.utils.aoa_to_sheet(alarmsData);
                XLSX.utils.book_append_sheet(workbook, alarmsSheet, 'Alarms Analysis');
            }

            XLSX.writeFile(workbook, `comprehensive-report-${dayjs().format('YYYY-MM-DD-HH-mm')}.xlsx`);
            
        } catch (error) {
            message.error('Excel export failed. Please try CSV export instead.');
            console.error('Excel export error:', error);
        }
    };

    const reportColumns: ColumnsType<Report> = [
        {
            title: 'Name',
            dataIndex: 'name',
            key: 'name',
            width: 200,
        },
        {
            title: 'Description',
            dataIndex: 'description',
            key: 'description',
            width: 300,
        },
        {
            title: 'Schedule',
            key: 'schedule',
            width: 200,
            render: (_, record) => (
                <Space>
                    <Tag>{record.schedule.frequency}</Tag>
                    <span>{record.schedule.time}</span>
                </Space>
            ),
        },
        {
            title: 'Delivery',
            key: 'delivery',
            width: 200,
            render: (_, record) => (
                <Space>
                    <Tag>{record.delivery.type}</Tag>
                    <span>{record.delivery.destination}</span>
                </Space>
            ),
        },
        {
            title: 'Status',
            key: 'status',
            width: 100,
            render: (_, record) => (
                <Tag color={record.status === 'active' ? 'green' : 'orange'}>
                    {record.status}
                </Tag>
            ),
        },
        {
            title: 'Last Generated',
            dataIndex: 'lastGenerated',
            key: 'lastGenerated',
            width: 200,
            render: (text) => text ? dayjs(text).format('YYYY-MM-DD HH:mm:ss') : '-',
        },
        {
            title: 'Actions',
            key: 'actions',
            width: 200,
            render: (_, record) => (
                <Space>
                    <Tooltip title={record.status === 'active' ? 'Pause' : 'Activate'}>
                        <Button
                            type="text"
                            icon={record.status === 'active' ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                            onClick={() => handleToggleStatus(record)}
                        />
                    </Tooltip>
                    <Tooltip title="Edit">
                        <Button
                            type="text"
                            icon={<EditOutlined />}
                            onClick={() => handleEditReport(record)}
                        />
                    </Tooltip>
                    <Tooltip title="Delete">
                        <Button
                            type="text"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => handleDeleteReport(record.id)}
                        />
                    </Tooltip>
                </Space>
            ),
        },
    ];

    const historyColumns: ColumnsType<ReportHistory> = [
        {
            title: 'Report Name',
            key: 'reportName',
            width: 200,
            render: (_, record) => {
                const report = reports.find(r => r.id === record.reportId);
                return report?.name || 'Unknown';
            },
        },
        {
            title: 'Generated At',
            dataIndex: 'generatedAt',
            key: 'generatedAt',
            width: 200,
            render: (text) => dayjs(text).format('YYYY-MM-DD HH:mm:ss'),
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            width: 100,
            render: (status) => (
                <Tag color={status === 'success' ? 'green' : 'red'}>
                    {status}
                </Tag>
            ),
        },
        {
            title: 'Actions',
            key: 'actions',
            width: 100,
            render: (_, record) => (
                record.fileUrl && (
                    <Tooltip title="Download PDF">
                        <Button
                            type="text"
                            icon={<DownloadOutlined />}
                            onClick={() => handleDownloadPDF(record.fileUrl!)}
                        />
                    </Tooltip>
                )
            ),
        },
    ];

    return (
        <div style={{ padding: '24px' }}>
            <Card>
                <Tabs defaultActiveKey="reports">
                    <TabPane tab="Scheduled Reports" key="reports">
                        <div style={{ marginBottom: 16, display: 'flex', gap: '8px' }}>
                            <Button
                                type="primary"
                                icon={<PlusOutlined />}
                                onClick={handleCreateReport}
                            >
                                Create Report
                            </Button>
                            <Button
                                type="default"
                                icon={<DownloadOutlined />}
                                onClick={handleTestReport}
                            >
                                Test Report
                            </Button>
                            <Button
                                type="primary"
                                icon={<DownloadOutlined />}
                                onClick={handleComprehensiveReport}
                                style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
                            >
                                Comprehensive Report
                            </Button>
                            {lastReportData && lastReportConfig && (
                                <Dropdown
                                    menu={{
                                        items: [
                                            {
                                                key: 'csv',
                                                icon: <FileTextOutlined />,
                                                label: 'Export as CSV',
                                                onClick: () => exportToCSV(lastReportData, lastReportConfig)
                                            },
                                            {
                                                key: 'excel',
                                                icon: <FileExcelOutlined />,
                                                label: 'Export as Excel',
                                                onClick: () => exportToExcel(lastReportData, lastReportConfig)
                                            }
                                        ]
                                    }}
                                    trigger={['click']}
                                >
                                    <Button icon={<DownOutlined />}>
                                        Export Data
                                    </Button>
                                </Dropdown>
                            )}
                        </div>
                        <Table
                            columns={reportColumns}
                            dataSource={reports || []}
                            rowKey="id"
                            pagination={{ pageSize: 10 }}
                        />
                    </TabPane>
                    <TabPane tab="Report History" key="history">
                        <Table
                            columns={historyColumns}
                            dataSource={history || []}
                            rowKey="id"
                            pagination={{ pageSize: 10 }}
                        />
                    </TabPane>
                </Tabs>
            </Card>

            <Modal
                title={editingReport ? 'Edit Report' : 'Create Report'}
                open={isModalVisible}
                onOk={handleModalOk}
                onCancel={() => setIsModalVisible(false)}
                width={800}
            >
                <Form
                    form={form}
                    layout="vertical"
                    initialValues={{
                        schedule: { frequency: 'daily' },
                        delivery: { type: 'email' },
                        content: { type: 'alarms' },
                        status: 'active'
                    }}
                >
                    <Form.Item
                        name="name"
                        label="Report Name"
                        rules={[{ required: true }]}
                    >
                        <Input />
                    </Form.Item>

                    <Form.Item
                        name="description"
                        label="Description"
                        rules={[{ required: true }]}
                    >
                        <Input.TextArea />
                    </Form.Item>

                    <Form.Item
                        name={['schedule', 'frequency']}
                        label="Frequency"
                        rules={[{ required: true }]}
                    >
                        <Select>
                            <Option value="daily">Daily</Option>
                            <Option value="weekly">Weekly</Option>
                            <Option value="monthly">Monthly</Option>
                        </Select>
                    </Form.Item>

                    <Form.Item
                        name="time"
                        label="Time"
                        rules={[{ required: true }]}
                    >
                        <TimePicker format="HH:mm" />
                    </Form.Item>

                    <Form.Item
                        name={['delivery', 'type']}
                        label="Delivery Method"
                        rules={[{ required: true }]}
                    >
                        <Select>
                            <Option value="email">Email</Option>
                            <Option value="slack">Slack</Option>
                        </Select>
                    </Form.Item>

                    <Form.Item
                        name={['delivery', 'destination']}
                        label="Destination"
                        rules={[{ required: true }]}
                    >
                        <Input placeholder="Email address or Slack channel" />
                    </Form.Item>

                    <Form.Item
                        name={['content', 'type']}
                        label="Report Content"
                        rules={[{ required: true }]}
                    >
                        <Select>
                            <Option value="general_health">General Health</Option>
                        </Select>
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                title="Generate Comprehensive Report"
                open={isComprehensiveModalVisible}
                onOk={handleGenerateComprehensiveReport}
                onCancel={() => setIsComprehensiveModalVisible(false)}
                width={900}
                confirmLoading={loading}
            >
                <Form
                    form={comprehensiveForm}
                    layout="vertical"
                    initialValues={{
                        timeRange: { type: 'relative', relative: '1d' },
                        sections: {
                            systemMetrics: true,
                            diskAnalysis: true,
                            alarmsAnalysis: true
                        }
                    }}
                >
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item
                                name="clusters"
                                label="Select Clusters"
                                rules={[{ required: true, message: 'Please select at least one cluster' }]}
                            >
                                <Select
                                    mode="multiple"
                                    placeholder="Select clusters to include in report"
                                    optionFilterProp="children"
                                    onChange={(clusters: string[]) => {
                                        setSelectedClusters(clusters);
                                        // Update available nodes based on selected clusters
                                        const nodes = clusters.flatMap(clusterId => {
                                            const cluster = availableClusters.find(c => c.id === clusterId);
                                            return cluster ? cluster.nodeList.map((node: any) => ({
                                                id: node.agentID,
                                                name: node.hostname,
                                                clusterId: clusterId,
                                                clusterName: cluster.name,
                                                type: cluster.type,
                                                role: node.isPrimary ? 'PRIMARY' : (node.role || 'SECONDARY'),
                                                status: node.status
                                            })) : [];
                                        });
                                        setAvailableNodes(nodes);
                                    }}
                                >
                                    {availableClusters.map(cluster => (
                                        <Option key={cluster.id} value={cluster.id}>
                                            <Tag color={cluster.type === 'MongoDB' ? 'green' : cluster.type === 'PostgreSQL' ? 'blue' : 'orange'}>
                                                {cluster.type}
                                            </Tag>
                                            {cluster.name} ({cluster.nodes} nodes)
                                        </Option>
                                    ))}
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item
                                name="nodes"
                                label="Select Nodes"
                                rules={[{ required: true, message: 'Please select at least one node' }]}
                            >
                                <Select
                                    mode="multiple"
                                    placeholder="Select nodes to include in report"
                                    optionFilterProp="children"
                                    disabled={selectedClusters.length === 0}
                                >
                                    {availableNodes.map(node => (
                                        <Option key={node.id} value={node.id}>
                                            <Space>
                                                <Tag color={node.type === 'MongoDB' ? 'green' : node.type === 'PostgreSQL' ? 'blue' : 'orange'}>
                                                    {node.type}
                                                </Tag>
                                                <Tag color={node.role === 'PRIMARY' || node.role === 'Leader' ? 'blue' : 'default'}>
                                                    {node.role}
                                                </Tag>
                                                <span>{node.name}</span>
                                                <span style={{ color: '#666' }}>({node.clusterName})</span>
                                            </Space>
                                        </Option>
                                    ))}
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>
                    
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item
                                name={['timeRange', 'type']}
                                label="Time Range Type"
                            >
                                <Select>
                                    <Option value="relative">Relative</Option>
                                    <Option value="absolute">Absolute</Option>
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>

                    <Form.Item
                        noStyle
                        shouldUpdate={(prevValues, curValues) => 
                            prevValues.timeRange?.type !== curValues.timeRange?.type
                        }
                    >
                        {({ getFieldValue }) => {
                            const timeRangeType = getFieldValue(['timeRange', 'type']);
                            
                            if (timeRangeType === 'relative') {
                                return (
                                    <Form.Item
                                        name={['timeRange', 'relative']}
                                        label="Time Period"
                                    >
                                        <Select>
                                            <Option value="1h">Last 1 Hour</Option>
                                            <Option value="1d">Last 1 Day</Option>
                                            <Option value="7d">Last 7 Days</Option>
                                            <Option value="30d">Last 30 Days</Option>
                                        </Select>
                                    </Form.Item>
                                );
                            } else {
                                return (
                                    <Row gutter={16}>
                                        <Col span={12}>
                                            <Form.Item
                                                name={['timeRange', 'absolute', 'startDate']}
                                                label="Start Date"
                                            >
                                                <DatePicker showTime style={{ width: '100%' }} />
                                            </Form.Item>
                                        </Col>
                                        <Col span={12}>
                                            <Form.Item
                                                name={['timeRange', 'absolute', 'endDate']}
                                                label="End Date"
                                            >
                                                <DatePicker showTime style={{ width: '100%' }} />
                                            </Form.Item>
                                        </Col>
                                    </Row>
                                );
                            }
                        }}
                    </Form.Item>

                    <Divider>Report Sections</Divider>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item
                                name={['sections', 'systemMetrics']}
                                valuePropName="checked"
                            >
                                <Checkbox>System Performance Metrics</Checkbox>
                            </Form.Item>
                            
                            <Form.Item
                                name={['sections', 'diskAnalysis']}
                                valuePropName="checked"
                            >
                                <Checkbox>Disk Analysis & Trends</Checkbox>
                            </Form.Item>
                            
                            <Form.Item
                                name={['sections', 'alarmsAnalysis']}
                                valuePropName="checked"
                            >
                                <Checkbox>Alarms Analysis</Checkbox>
                            </Form.Item>
                            
                            <Form.Item
                                name={['sections', 'recommendations']}
                                valuePropName="checked"
                            >
                                <Checkbox>Capacity Planning & Recommendations</Checkbox>
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item
                                name={['sections', 'mongoAnalysis', 'enabled']}
                                valuePropName="checked"
                            >
                                <Checkbox>MongoDB Analysis</Checkbox>
                            </Form.Item>
                            
                            <Form.Item
                                name={['sections', 'postgresAnalysis', 'enabled']}
                                valuePropName="checked"
                            >
                                <Checkbox>PostgreSQL Analysis</Checkbox>
                            </Form.Item>
                            
                            <Form.Item
                                name={['sections', 'mssqlAnalysis', 'enabled']}
                                valuePropName="checked"
                            >
                                <Checkbox>MSSQL Analysis</Checkbox>
                            </Form.Item>
                        </Col>
                    </Row>

                    <Form.Item
                        noStyle
                        shouldUpdate={(prevValues, curValues) => 
                            prevValues.sections?.mongoAnalysis?.enabled !== curValues.sections?.mongoAnalysis?.enabled
                        }
                    >
                        {({ getFieldValue }) => {
                            const mongoEnabled = getFieldValue(['sections', 'mongoAnalysis', 'enabled']);
                            
                            if (mongoEnabled) {
                                return (
                                    <div style={{ marginLeft: 24, marginBottom: 16 }}>
                                        <p style={{ marginBottom: 8, fontWeight: 'bold' }}>MongoDB Analysis Options:</p>
                                        <Form.Item
                                            name={['sections', 'mongoAnalysis', 'includeCollections']}
                                            valuePropName="checked"
                                        >
                                            <Checkbox>Include Collections Analysis</Checkbox>
                                        </Form.Item>
                                        <Form.Item
                                            name={['sections', 'mongoAnalysis', 'includeIndexes']}
                                            valuePropName="checked"
                                        >
                                            <Checkbox>Include Index Analysis</Checkbox>
                                        </Form.Item>
                                        <Form.Item
                                            name={['sections', 'mongoAnalysis', 'includePerformance']}
                                            valuePropName="checked"
                                        >
                                            <Checkbox>Include Performance Metrics</Checkbox>
                                        </Form.Item>
                                    </div>
                                );
                            }
                            return null;
                        }}
                    </Form.Item>

                    <Form.Item
                        noStyle
                        shouldUpdate={(prevValues, curValues) => 
                            prevValues.sections?.postgresAnalysis?.enabled !== curValues.sections?.postgresAnalysis?.enabled
                        }
                    >
                        {({ getFieldValue }) => {
                            const postgresEnabled = getFieldValue(['sections', 'postgresAnalysis', 'enabled']);
                            
                            if (postgresEnabled) {
                                return (
                                    <div style={{ marginLeft: 24, marginBottom: 16 }}>
                                        <p style={{ marginBottom: 8, fontWeight: 'bold' }}>PostgreSQL Analysis Options:</p>
                                        <Form.Item
                                            name={['sections', 'postgresAnalysis', 'includeBloat']}
                                            valuePropName="checked"
                                        >
                                            <Checkbox>Include Bloat Analysis</Checkbox>
                                        </Form.Item>
                                        <Form.Item
                                            name={['sections', 'postgresAnalysis', 'includeSlowQueries']}
                                            valuePropName="checked"
                                        >
                                            <Checkbox>Include Slow Queries</Checkbox>
                                        </Form.Item>
                                        <Form.Item
                                            name={['sections', 'postgresAnalysis', 'includeConnections']}
                                            valuePropName="checked"
                                        >
                                            <Checkbox>Include Connection Statistics</Checkbox>
                                        </Form.Item>
                                    </div>
                                );
                            }
                            return null;
                        }}
                    </Form.Item>

                    <Form.Item
                        noStyle
                        shouldUpdate={(prevValues, curValues) => 
                            prevValues.sections?.mssqlAnalysis?.enabled !== curValues.sections?.mssqlAnalysis?.enabled
                        }
                    >
                        {({ getFieldValue }) => {
                            const mssqlEnabled = getFieldValue(['sections', 'mssqlAnalysis', 'enabled']);
                            
                            if (mssqlEnabled) {
                                return (
                                    <div style={{ marginLeft: 24, marginBottom: 16 }}>
                                        <p style={{ marginBottom: 8, fontWeight: 'bold' }}>MSSQL Analysis Options:</p>
                                        <Form.Item
                                            name={['sections', 'mssqlAnalysis', 'includeCapacityPlanning']}
                                            valuePropName="checked"
                                        >
                                            <Checkbox>Include Capacity Planning</Checkbox>
                                        </Form.Item>
                                        <Form.Item
                                            name={['sections', 'mssqlAnalysis', 'includePerformance']}
                                            valuePropName="checked"
                                        >
                                            <Checkbox>Include Performance Analysis</Checkbox>
                                        </Form.Item>
                                    </div>
                                );
                            }
                            return null;
                        }}
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default Reports; 