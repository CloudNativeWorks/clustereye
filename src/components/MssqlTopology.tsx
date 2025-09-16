import React, { useMemo, useState, useEffect } from 'react';
import ReactFlow, { 
    Node, 
    Edge, 
    Background,
    Controls,
    Panel,
    ConnectionLineType,
    MarkerType
} from 'reactflow';
import 'reactflow/dist/style.css';
import { 
    DatabaseOutlined,
    CloudServerOutlined,
    CheckCircleOutlined,
    WarningOutlined,
    ClockCircleOutlined,
    GlobalOutlined,
    LeftOutlined,
    SafetyOutlined,
    LaptopOutlined,
    InfoCircleOutlined,
    SyncOutlined,
    ApiOutlined
} from '@ant-design/icons';
import { Card, Button, Badge, Divider, Tooltip } from 'antd';

interface AlwaysOnReplica {
    Role: string;
    ReplicaName: string;
    FailoverMode: string;
    ConnectedState: boolean;
    ConnectionState: string;
    AvailabilityMode: string;
    SynchronizationMode: string;
}

interface AlwaysOnDatabase {
    ReplicaName: string;
    DatabaseName: string;
    SynchronizationState: string;
    LogSendQueueKb: number;
    RedoQueueKb: number;
}

interface AlwaysOnListener {
    ListenerName: string;
    DnsName: string;
    Port: number;
    ListenerState: string;
}

interface AlwaysOnMetrics {
    Replicas: AlwaysOnReplica[];
    Databases: AlwaysOnDatabase[];
    Listeners: AlwaysOnListener[];
}

interface MssqlTopologyProps {
    nodes: Array<{
        Hostname: string;
        NodeStatus: string;
        IP: string;
        Edition?: string;
        Version?: string;
        Status?: string;
        ClusterName?: string;
        IsHAEnabled?: boolean;
        AlwaysOnMetrics?: AlwaysOnMetrics;
    }>;
}

const MssqlTopology: React.FC<MssqlTopologyProps> = ({ nodes }) => {
    const [showStatusCard, setShowStatusCard] = useState(false);
    const [dimensions, setDimensions] = useState({
        width: window.innerWidth,
        height: window.innerHeight
    });

    // Add resize event listener
    useEffect(() => {
        const handleResize = () => {
            setDimensions({
                width: window.innerWidth,
                height: window.innerHeight
            });
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Helper function to truncate hostname
    const truncateHostname = (hostname: string, maxLength: number = 18) => {
        return hostname.length > maxLength ? hostname.substring(0, maxLength) + '...' : hostname;
    };

    // Helper function to format version
    const formatVersion = (version?: string) => {
        if (!version) return null;
        
        // Extract major version number and format it nicely
        const versionMatch = version.match(/(\d{4})/);
        if (versionMatch) {
            return `SQL Server ${versionMatch[1]}`;
        }
        
        // Fallback for other version formats
        if (version.includes('2022')) return 'SQL Server 2022';
        if (version.includes('2019')) return 'SQL Server 2019';
        if (version.includes('2017')) return 'SQL Server 2017';
        if (version.includes('2016')) return 'SQL Server 2016';
        
        return 'SQL Server';
    };

    // Helper function to get synchronization color
    const getSyncColor = (syncState?: string, syncMode?: string) => {
        if (syncState === 'SYNCHRONIZED' && syncMode === 'SYNCHRONOUS_COMMIT') {
            return '#16a34a'; // Green for synchronized
        } else if (syncState === 'SYNCHRONIZING') {
            return '#f59e0b'; // Yellow for synchronizing
        } else if (syncMode === 'ASYNCHRONOUS_COMMIT') {
            return '#3b82f6'; // Blue for async
        }
        return '#dc2626'; // Red for issues
    };

    // Calculate optimal positions based on node count
    const { flowNodes, flowEdges } = useMemo(() => {
        const flowNodes: Node[] = [];
        const flowEdges: Edge[] = [];
        
        // Get AlwaysOn information from the first node that has it
        const alwaysOnNode = nodes.find(n => n.AlwaysOnMetrics);
        const alwaysOnMetrics = alwaysOnNode?.AlwaysOnMetrics;
        const listener = alwaysOnMetrics?.Listeners?.[0];
        
        const centerX = dimensions.width * 0.4;
        const centerY = dimensions.height * 0.35;
        const secondaryRadius = Math.min(dimensions.width * 0.25, dimensions.height * 0.3);
        
        // If we have a listener, show it at the top
        if (listener) {
            flowNodes.push({
                id: `listener-${listener.ListenerName}`,
                position: { x: centerX - 100, y: centerY - 300 },
                data: {
                    label: (
                        <div style={{ 
                            padding: '14px', 
                            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                            background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                            borderRadius: '12px',
                            border: '2px solid #0ea5e9',
                            boxShadow: '0 8px 25px rgba(14, 165, 233, 0.15)',
                            minWidth: '200px',
                            textAlign: 'center'
                        }}>
                            <div style={{ 
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: '10px',
                            }}>
                                <div style={{
                                    background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
                                    padding: '10px',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    marginRight: '10px',
                                    boxShadow: '0 4px 12px rgba(14, 165, 233, 0.3)'
                                }}>
                                    <ApiOutlined style={{ color: 'white', fontSize: '18px' }} />
                                </div>
                                <div>
                                    <div style={{ 
                                        fontWeight: '600', 
                                        fontSize: '15px',
                                        color: '#1f2937',
                                        marginBottom: '2px'
                                    }}>
                                        {listener.DnsName}
                                    </div>
                                    <div style={{
                                        background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
                                        padding: '3px 10px',
                                        borderRadius: '6px',
                                        fontSize: '10px',
                                        color: 'white',
                                        fontWeight: '600',
                                        display: 'inline-block',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px'
                                    }}>
                                        LISTENER
                                    </div>
                                </div>
                            </div>
                            
                            <div style={{ 
                                background: 'rgba(255, 255, 255, 0.8)', 
                                padding: '10px', 
                                borderRadius: '8px', 
                                marginBottom: '10px',
                                border: '1px solid rgba(14, 165, 233, 0.1)'
                            }}>
                                <div style={{ 
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '12px',
                                    color: '#6b7280',
                                    marginBottom: '4px'
                                }}>
                                    <GlobalOutlined style={{ fontSize: '12px', marginRight: 6, color: '#9ca3af' }} />
                                    <span style={{ fontWeight: '500' }}>Port: {listener.Port}</span>
                                </div>
                            </div>
                            
                            <div style={{ 
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: listener.ListenerState === 'ONLINE' 
                                    ? 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)' 
                                    : 'linear-gradient(135deg, #fef2f2 0%, #fecaca 100%)',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: '600',
                                border: `1px solid ${listener.ListenerState === 'ONLINE' ? '#22c55e' : '#ef4444'}`
                            }}>
                                {listener.ListenerState === 'ONLINE' ? (
                                    <CheckCircleOutlined style={{ color: '#16a34a', marginRight: 4, fontSize: '11px' }} />
                                ) : (
                                    <WarningOutlined style={{ color: '#dc2626', marginRight: 4, fontSize: '11px' }} />
                                )}
                                <span style={{ 
                                    color: listener.ListenerState === 'ONLINE' ? '#16a34a' : '#dc2626'
                                }}>
                                    {listener.ListenerState}
                                </span>
                            </div>
                        </div>
                    )
                },
                style: {
                    background: 'transparent',
                    border: 'none',
                    width: 200,
                    zIndex: 500
                },
            });
        }

        // Find primary and secondary nodes using AlwaysOn data
        let primaryNode = null;
        let secondaryNodes: any[] = [];
        
        if (alwaysOnMetrics?.Replicas) {
            // Use AlwaysOn replica information
            const primaryReplica = alwaysOnMetrics.Replicas.find(r => r.Role === 'PRIMARY');
            const secondaryReplicas = alwaysOnMetrics.Replicas.filter(r => r.Role === 'SECONDARY');
            
            if (primaryReplica) {
                primaryNode = nodes.find(n => 
                    n.Hostname.toLowerCase() === primaryReplica.ReplicaName.toLowerCase()
                );
                if (primaryNode) {
                    // Add AlwaysOn specific data to primary node
                    primaryNode = {
                        ...primaryNode,
                        ReplicaRole: 'PRIMARY',
                        SynchronizationMode: primaryReplica.SynchronizationMode,
                        ConnectionState: primaryReplica.ConnectionState,
                        AvailabilityGroupName: alwaysOnNode?.ClusterName
                    };
                }
            }
            
            secondaryReplicas.forEach(replica => {
                const node = nodes.find(n => 
                    n.Hostname.toLowerCase() === replica.ReplicaName.toLowerCase()
                );
                if (node) {
                    // Get synchronization state from database metrics
                    const dbMetrics = alwaysOnMetrics.Databases.filter(db => 
                        db.ReplicaName.toLowerCase() === replica.ReplicaName.toLowerCase()
                    );
                    const syncState = dbMetrics.length > 0 ? dbMetrics[0].SynchronizationState : 'UNKNOWN';
                    
                    secondaryNodes.push({
                        ...node,
                        ReplicaRole: 'SECONDARY',
                        SynchronizationMode: replica.SynchronizationMode,
                        SynchronizationState: syncState,
                        ConnectionState: replica.ConnectionState,
                        AvailabilityGroupName: alwaysOnNode?.ClusterName
                    });
                }
            });
        } else {
            // Fallback to old logic if no AlwaysOn data
            primaryNode = nodes.find(n => 
                n.NodeStatus === 'PRIMARY' || 
                n.NodeStatus === 'PRIMARY_ROLE'
            );
            secondaryNodes = nodes.filter(n => 
                n.NodeStatus === 'SECONDARY' || 
                n.NodeStatus === 'SECONDARY_ROLE'
            );
        }

        const otherNodes = nodes.filter(n => 
            (!primaryNode || primaryNode.Hostname !== n.Hostname) &&
            !secondaryNodes.some(s => s.Hostname === n.Hostname)
        );
        
        // Position the PRIMARY node at the center
        if (primaryNode) {
            flowNodes.push({
                id: primaryNode.Hostname,
                position: { x: centerX - 230, y: centerY - 30 },
                data: { 
                    label: (
                        <div style={{ 
                            padding: '12px', 
                            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                            background: 'linear-gradient(135deg, #fff5f5 0%, #fef2f2 100%)',
                            borderRadius: '12px',
                            border: '2px solid #dc2626',
                            boxShadow: '0 8px 25px rgba(220, 38, 38, 0.15)',
                            minWidth: '180px'
                        }}>
                            <div style={{ 
                                display: 'flex',
                                alignItems: 'center',
                                marginBottom: '10px',
                            }}>
                                <div style={{
                                    background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                                    padding: '8px',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    marginRight: '10px',
                                    boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)'
                                }}>
                                    <DatabaseOutlined style={{ color: 'white', fontSize: '16px' }} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ 
                                        fontWeight: '600', 
                                        fontSize: '14px',
                                        color: '#1f2937',
                                        marginBottom: '2px',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        {truncateHostname(primaryNode.Hostname)}
                                    </div>
                                    <div style={{
                                        background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                                        padding: '3px 8px',
                                        borderRadius: '6px',
                                        fontSize: '10px',
                                        color: 'white',
                                        fontWeight: '600',
                                        display: 'inline-block',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px'
                                    }}>
                                        PRIMARY
                                    </div>
                                </div>
                            </div>
                            
                            <div style={{ 
                                background: 'rgba(255, 255, 255, 0.8)', 
                                padding: '10px', 
                                borderRadius: '8px', 
                                marginBottom: '10px',
                                border: '1px solid rgba(220, 38, 38, 0.1)'
                            }}>
                                <div style={{ 
                                    display: 'flex',
                                    alignItems: 'center',
                                    fontSize: '11px',
                                    color: '#6b7280',
                                    marginBottom: '6px'
                                }}>
                                    <GlobalOutlined style={{ fontSize: '11px', marginRight: 6, color: '#9ca3af' }} />
                                    <span style={{ fontWeight: '500' }}>{primaryNode.IP}</span>
                                </div>
                                
                                {formatVersion(primaryNode.Version) && (
                                    <div style={{ 
                                        display: 'flex',
                                        alignItems: 'center',
                                        fontSize: '11px',
                                        color: '#6b7280',
                                        marginBottom: '6px'
                                    }}>
                                        <SafetyOutlined style={{ fontSize: '11px', marginRight: 6, color: '#9ca3af' }} />
                                        <span style={{ fontWeight: '500' }}>{formatVersion(primaryNode.Version)}</span>
                                    </div>
                                )}

                                {(primaryNode as any).AvailabilityGroupName && (
                                    <div style={{ 
                                        display: 'flex',
                                        alignItems: 'center',
                                        fontSize: '11px',
                                        color: '#6b7280',
                                    }}>
                                        <SyncOutlined style={{ fontSize: '11px', marginRight: 6, color: '#9ca3af' }} />
                                        <span style={{ fontWeight: '500' }}>{(primaryNode as any).AvailabilityGroupName}</span>
                                    </div>
                                )}
                            </div>
                            
                            <div style={{ 
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                            }}>
                                <div style={{ 
                                    display: 'flex',
                                    alignItems: 'center',
                                    background: primaryNode.Status === 'RUNNING' 
                                        ? 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)' 
                                        : primaryNode.Status === 'STOPPED' || primaryNode.Status === 'FAILED'
                                            ? 'linear-gradient(135deg, #fef2f2 0%, #fecaca 100%)'
                                            : 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
                                    padding: '4px 8px',
                                    borderRadius: '6px',
                                    fontSize: '10px',
                                    fontWeight: '600',
                                    border: `1px solid ${primaryNode.Status === 'RUNNING' 
                                        ? '#22c55e' 
                                        : primaryNode.Status === 'STOPPED' || primaryNode.Status === 'FAILED'
                                            ? '#ef4444'
                                            : '#9ca3af'}`
                                }}>
                                    {primaryNode.Status === 'RUNNING' ? (
                                        <CheckCircleOutlined style={{ color: '#16a34a', marginRight: 4, fontSize: '10px' }} />
                                    ) : primaryNode.Status === 'STOPPED' || primaryNode.Status === 'FAILED' ? (
                                        <WarningOutlined style={{ color: '#dc2626', marginRight: 4, fontSize: '10px' }} />
                                    ) : (
                                        <ClockCircleOutlined style={{ color: '#6b7280', marginRight: 4, fontSize: '10px' }} />
                                    )}
                                    <span style={{ 
                                        color: primaryNode.Status === 'RUNNING' 
                                            ? '#16a34a' 
                                            : primaryNode.Status === 'STOPPED' || primaryNode.Status === 'FAILED'
                                                ? '#dc2626'
                                                : '#6b7280'
                                    }}>
                                        {primaryNode.Status || 'UNKNOWN'}
                                    </span>
                                </div>

                                {(primaryNode as any).ConnectionState && (
                                    <Tooltip title={`${(primaryNode as any).SynchronizationMode} - ${(primaryNode as any).ConnectionState}`}>
                                        <div style={{
                                            width: '8px',
                                            height: '8px',
                                            borderRadius: '50%',
                                            backgroundColor: (primaryNode as any).ConnectionState === 'CONNECTED' ? '#16a34a' : '#dc2626',
                                            boxShadow: `0 0 0 2px ${(primaryNode as any).ConnectionState === 'CONNECTED' ? '#16a34a' : '#dc2626'}33`
                                        }} />
                                    </Tooltip>
                                )}
                            </div>
                        </div>
                    )
                },
                style: {
                    background: 'transparent',
                    border: 'none',
                    width: 190,
                    zIndex: 400
                },
            });
        }
        
        // Position SECONDARY nodes in a circle around PRIMARY
        secondaryNodes.forEach((node, index) => {
            const angle = (2 * Math.PI * index) / Math.max(secondaryNodes.length, 1) + Math.PI / 6;
            const x = centerX + secondaryRadius * Math.cos(angle);
            const y = centerY + (secondaryRadius * Math.sin(angle) * 0.5);
            
            flowNodes.push({
                id: node.Hostname,
                position: { x: x - 110, y: centerY - 30 },
                data: { 
                    label: (
                        <div style={{ 
                            padding: '12px', 
                            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                            background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
                            borderRadius: '12px',
                            border: '2px solid #16a34a',
                            boxShadow: '0 8px 25px rgba(22, 163, 74, 0.15)',
                            minWidth: '180px'
                        }}>
                            <div style={{ 
                                display: 'flex',
                                alignItems: 'center',
                                marginBottom: '10px',
                            }}>
                                <div style={{
                                    background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                                    padding: '8px',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    marginRight: '10px',
                                    boxShadow: '0 4px 12px rgba(22, 163, 74, 0.3)'
                                }}>
                                    <DatabaseOutlined style={{ color: 'white', fontSize: '16px' }} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ 
                                        fontWeight: '600', 
                                        fontSize: '14px',
                                        color: '#1f2937',
                                        marginBottom: '2px',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        {truncateHostname(node.Hostname)}
                                    </div>
                                    <div style={{
                                        background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                                        padding: '3px 8px',
                                        borderRadius: '6px',
                                        fontSize: '10px',
                                        color: 'white',
                                        fontWeight: '600',
                                        display: 'inline-block',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px'
                                    }}>
                                        SECONDARY
                                    </div>
                                </div>
                            </div>
                            
                            <div style={{ 
                                background: 'rgba(255, 255, 255, 0.8)', 
                                padding: '10px', 
                                borderRadius: '8px', 
                                marginBottom: '10px',
                                border: '1px solid rgba(22, 163, 74, 0.1)'
                            }}>
                                <div style={{ 
                                    display: 'flex',
                                    alignItems: 'center',
                                    fontSize: '11px',
                                    color: '#6b7280',
                                    marginBottom: '6px'
                                }}>
                                    <GlobalOutlined style={{ fontSize: '11px', marginRight: 6, color: '#9ca3af' }} />
                                    <span style={{ fontWeight: '500' }}>{node.IP}</span>
                                </div>
                                
                                {formatVersion(node.Version) && (
                                    <div style={{ 
                                        display: 'flex',
                                        alignItems: 'center',
                                        fontSize: '11px',
                                        color: '#6b7280',
                                        marginBottom: '6px'
                                    }}>
                                        <SafetyOutlined style={{ fontSize: '11px', marginRight: 6, color: '#9ca3af' }} />
                                        <span style={{ fontWeight: '500' }}>{formatVersion(node.Version)}</span>
                                    </div>
                                )}

                                {(node as any).AvailabilityGroupName && (
                                    <div style={{ 
                                        display: 'flex',
                                        alignItems: 'center',
                                        fontSize: '11px',
                                        color: '#6b7280',
                                    }}>
                                        <SyncOutlined style={{ fontSize: '11px', marginRight: 6, color: '#9ca3af' }} />
                                        <span style={{ fontWeight: '500' }}>{(node as any).AvailabilityGroupName}</span>
                                    </div>
                                )}
                            </div>

                            <div style={{ 
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                            }}>
                                <div style={{ 
                                    display: 'flex',
                                    alignItems: 'center',
                                    background: node.Status === 'RUNNING' 
                                        ? 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)' 
                                        : node.Status === 'STOPPED' || node.Status === 'FAILED'
                                            ? 'linear-gradient(135deg, #fef2f2 0%, #fecaca 100%)'
                                            : 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
                                    padding: '4px 8px',
                                    borderRadius: '6px',
                                    fontSize: '10px',
                                    fontWeight: '600',
                                    border: `1px solid ${node.Status === 'RUNNING' 
                                        ? '#22c55e' 
                                        : node.Status === 'STOPPED' || node.Status === 'FAILED'
                                            ? '#ef4444'
                                            : '#9ca3af'}`
                                }}>
                                    {node.Status === 'RUNNING' ? (
                                        <CheckCircleOutlined style={{ color: '#16a34a', marginRight: 4, fontSize: '10px' }} />
                                    ) : node.Status === 'STOPPED' || node.Status === 'FAILED' ? (
                                        <WarningOutlined style={{ color: '#dc2626', marginRight: 4, fontSize: '10px' }} />
                                    ) : (
                                        <ClockCircleOutlined style={{ color: '#6b7280', marginRight: 4, fontSize: '10px' }} />
                                    )}
                                    <span style={{ 
                                        color: node.Status === 'RUNNING' 
                                            ? '#16a34a' 
                                            : node.Status === 'STOPPED' || node.Status === 'FAILED'
                                                ? '#dc2626'
                                                : '#6b7280'
                                    }}>
                                        {node.Status || 'UNKNOWN'}
                                    </span>
                                </div>

                                {(node as any).SynchronizationState && (
                                    <Tooltip title={`${(node as any).SynchronizationMode} - ${(node as any).SynchronizationState}`}>
                                        <div style={{
                                            width: '8px',
                                            height: '8px',
                                            borderRadius: '50%',
                                            backgroundColor: getSyncColor((node as any).SynchronizationState, (node as any).SynchronizationMode),
                                            boxShadow: `0 0 0 2px ${getSyncColor((node as any).SynchronizationState, (node as any).SynchronizationMode)}33`
                                        }} />
                                    </Tooltip>
                                )}
                            </div>
                        </div>
                    )
                },
                style: {
                    background: 'transparent',
                    border: 'none',
                    width: 190,
                    zIndex: 300
                },
            });
        });
        
        // Position other nodes (if any) on the bottom
        otherNodes.forEach((node, index) => {
            const x = centerX - (otherNodes.length * 160) / 2 + index * 160;
            const y = centerY + 270;
            
            flowNodes.push({
                id: node.Hostname,
                position: { x: x - 75, y: y - 60 },
                data: { 
                    label: (
                        <div style={{ 
                            padding: '12px', 
                            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                            background: 'linear-gradient(135deg, #fef3f2 0%, #fee2e2 100%)',
                            borderRadius: '12px',
                            border: '2px solid #f97316',
                            boxShadow: '0 8px 25px rgba(249, 115, 22, 0.15)',
                            minWidth: '150px'
                        }}>
                            <div style={{ 
                                display: 'flex',
                                alignItems: 'center',
                                marginBottom: '10px',
                            }}>
                                <div style={{
                                    background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                                    padding: '8px',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    marginRight: '10px',
                                    boxShadow: '0 4px 12px rgba(249, 115, 22, 0.3)'
                                }}>
                                    <DatabaseOutlined style={{ color: 'white', fontSize: '14px' }} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ 
                                        fontWeight: '600', 
                                        fontSize: '13px',
                                        color: '#1f2937',
                                        marginBottom: '2px',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        {truncateHostname(node.Hostname, 15)}
                                    </div>
                                    <div style={{
                                        background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                                        padding: '3px 8px',
                                        borderRadius: '6px',
                                        fontSize: '10px',
                                        color: 'white',
                                        fontWeight: '600',
                                        display: 'inline-block',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px'
                                    }}>
                                        {node.NodeStatus || 'UNKNOWN'}
                                    </div>
                                </div>
                            </div>
                            
                            <div style={{ 
                                background: 'rgba(255, 255, 255, 0.8)', 
                                padding: '8px', 
                                borderRadius: '8px', 
                                marginBottom: '10px',
                                border: '1px solid rgba(249, 115, 22, 0.1)'
                            }}>
                                <div style={{ 
                                    display: 'flex',
                                    alignItems: 'center',
                                    fontSize: '11px',
                                    color: '#6b7280',
                                }}>
                                    <GlobalOutlined style={{ fontSize: '11px', marginRight: 6, color: '#9ca3af' }} />
                                    <span style={{ fontWeight: '500' }}>{node.IP}</span>
                                </div>
                            </div>
                            
                            <div style={{ 
                                display: 'flex',
                                alignItems: 'center',
                                background: node.Status === 'RUNNING' 
                                    ? 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)' 
                                    : node.Status === 'STOPPED' || node.Status === 'FAILED'
                                        ? 'linear-gradient(135deg, #fef2f2 0%, #fecaca 100%)'
                                        : 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
                                padding: '4px 8px',
                                borderRadius: '6px',
                                fontSize: '10px',
                                fontWeight: '600',
                                border: `1px solid ${node.Status === 'RUNNING' 
                                    ? '#22c55e' 
                                    : node.Status === 'STOPPED' || node.Status === 'FAILED'
                                        ? '#ef4444'
                                        : '#9ca3af'}`
                            }}>
                                {node.Status === 'RUNNING' ? (
                                    <CheckCircleOutlined style={{ color: '#16a34a', marginRight: 4, fontSize: '10px' }} />
                                ) : node.Status === 'STOPPED' || node.Status === 'FAILED' ? (
                                    <WarningOutlined style={{ color: '#dc2626', marginRight: 4, fontSize: '10px' }} />
                                ) : (
                                    <ClockCircleOutlined style={{ color: '#6b7280', marginRight: 4, fontSize: '10px' }} />
                                )}
                                <span style={{ 
                                    color: node.Status === 'RUNNING' 
                                        ? '#16a34a' 
                                        : node.Status === 'STOPPED' || node.Status === 'FAILED'
                                            ? '#dc2626'
                                            : '#6b7280'
                                }}>
                                    {node.Status || 'UNKNOWN'}
                                </span>
                            </div>
                        </div>
                    )
                },
                style: {
                    background: 'transparent',
                    border: 'none',
                    width: 150,
                    zIndex: 700
                },
            });
        });
        
        // Create edges with enhanced styling
        
        // Connect listener to primary node if both exist
        if (listener && primaryNode) {
            flowEdges.push({
                id: `listener-to-primary`,
                source: `listener-${listener.ListenerName}`,
                target: primaryNode.Hostname,
                type: 'smoothstep',
                animated: true,
                style: { 
                    stroke: '#0ea5e9',
                    strokeWidth: 3,
                    opacity: 0.9
                },
                markerEnd: {
                    type: MarkerType.ArrowClosed,
                    color: '#0ea5e9',
                    width: 20,
                    height: 20,
                    strokeWidth: 2
                },
                zIndex: 1000
            });
        }
        
        // Connect PRIMARY to all SECONDARY nodes
        if (primaryNode) {
            secondaryNodes.forEach((node) => {
                const syncColor = getSyncColor((node as any).SynchronizationState, (node as any).SynchronizationMode);
                const isSync = (node as any).SynchronizationMode === 'SYNCHRONOUS_COMMIT';
                const isSynchronized = (node as any).SynchronizationState === 'SYNCHRONIZED';
                
                flowEdges.push({
                    id: `primary-to-${node.Hostname}`,
                    source: primaryNode.Hostname,
                    target: node.Hostname,
                    type: 'smoothstep',
                    animated: true,
                    style: { 
                        stroke: syncColor,
                        strokeWidth: 2.5,
                        opacity: 0.85,
                        strokeDasharray: isSync ? '0' : '12,12',
                        animation: isSync ? 'none' : 'flowDash 1.5s linear infinite'
                    },
                    label: isSync ? 'Synchronous' : 'Asynchronous',
                    labelStyle: { 
                        fill: syncColor,
                        fontWeight: '600',
                        fontSize: '11px',
                        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                        transform: 'translateY(0px)'
                    },
                    labelBgStyle: { 
                        fill: '#ffffff',
                        stroke: syncColor,
                        strokeWidth: 1.5,
                        borderRadius: 6,
                        opacity: 0.95
                    },
                    labelBgPadding: [8, 5],
                    markerEnd: {
                        type: MarkerType.ArrowClosed,
                        color: syncColor,
                        width: 18,
                        height: 18,
                        strokeWidth: 1.5
                    },
                    zIndex: 1000
                });
            });
        }
        
        return { flowNodes, flowEdges };
    }, [nodes, dimensions]);

    // Get AlwaysOn group information
    const alwaysOnNode = nodes.find(n => n.AlwaysOnMetrics);
    const alwaysOnGroup = alwaysOnNode?.ClusterName;
    const listener = alwaysOnNode?.AlwaysOnMetrics?.Listeners?.[0];
    const primaryCount = nodes.filter(n => n.NodeStatus === 'PRIMARY' || 
        alwaysOnNode?.AlwaysOnMetrics?.Replicas?.some(r => r.Role === 'PRIMARY' && r.ReplicaName.toLowerCase() === n.Hostname.toLowerCase())).length;
    const secondaryCount = nodes.filter(n => n.NodeStatus === 'SECONDARY' || 
        alwaysOnNode?.AlwaysOnMetrics?.Replicas?.some(r => r.Role === 'SECONDARY' && r.ReplicaName.toLowerCase() === n.Hostname.toLowerCase())).length;

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <div style={{ 
                height: '100%',
                borderRadius: '16px',
                boxShadow: '0 10px 40px rgba(0,0,0,0.1)', 
                overflow: 'hidden',
                border: '1px solid rgba(0,0,0,0.06)',
                background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                display: 'flex',
                flexDirection: 'column'
            }}>
                <div style={{
                    background: 'linear-gradient(135deg, #0078D4 0%, #0063B1 100%)',
                    padding: '16px 24px',
                    borderTopLeftRadius: '16px',
                    borderTopRightRadius: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    boxShadow: '0 2px 8px rgba(0, 120, 212, 0.15)'
                }}>
                    <div>
                        <h2 style={{ 
                            margin: 0, 
                            color: 'white', 
                            fontSize: '18px',
                            fontWeight: '600',
                            letterSpacing: '0.2px'
                        }}>
                            SQL Server AlwaysOn Topology
                        </h2>
                        {alwaysOnGroup && (
                            <div style={{ 
                                color: 'rgba(255, 255, 255, 0.9)',
                                fontSize: '13px',
                                marginTop: '2px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}>
                                <SyncOutlined style={{ fontSize: '12px' }} />
                                {alwaysOnGroup}
                            </div>
                        )}
                    </div>
                </div>
                <style>
                    {`
                    @keyframes flowDash {
                        from {
                            stroke-dashoffset: 48;
                        }
                        to {
                            stroke-dashoffset: 0;
                        }
                    }
                    .react-flow__edge-path {
                        transition: stroke-dashoffset 0.1s linear;
                    }
                    `}
                </style>
                <ReactFlow
                    nodes={flowNodes}
                    edges={flowEdges}
                    fitView
                    connectionLineType={ConnectionLineType.SmoothStep}
                    proOptions={{ hideAttribution: true }}
                    minZoom={0.2}
                    maxZoom={1.5}
                    nodesDraggable={true}
                    defaultViewport={{ x: 0, y: 0, zoom: 0.3 }}
                    style={{ background: 'transparent', height: 'calc(100% - 68px)' }}
                    fitViewOptions={{ 
                        padding: 0.2,
                        minZoom: 0.2,
                        maxZoom: 1.5
                    }}
                >
                    <Background 
                        color="#e2e8f0" 
                        gap={24} 
                        size={1} 
                        style={{ opacity: 0.4 }}
                    />
                    <Controls 
                        position="bottom-right" 
                        showInteractive={false}
                        style={{
                            borderRadius: '12px',
                            padding: '6px',
                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                            border: '1px solid rgba(0,0,0,0.05)',
                            backdropFilter: 'blur(10px)'
                        }}
                    />
                    <Panel position="top-right">
                        <Card
                            size="small"
                            style={{
                                position: 'absolute',
                                right: showStatusCard ? 0 : -320,
                                top: 0,
                                width: 300,
                                transition: 'right 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                background: 'rgba(255, 255, 255, 0.95)',
                                boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                                borderRadius: '12px',
                                border: '1px solid rgba(0,0,0,0.06)',
                                backdropFilter: 'blur(10px)'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <div>
                                    <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1f2937' }}>
                                        SQL Server AlwaysOn
                                    </h4>
                                    {alwaysOnGroup && (
                                        <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                                            {alwaysOnGroup}
                                        </div>
                                    )}
                                    {listener && (
                                        <div style={{ fontSize: '11px', color: '#0ea5e9', marginTop: '2px', fontWeight: '500' }}>
                                            Listener: {listener.DnsName}
                                        </div>
                                    )}
                                </div>
                                <Button
                                    type="text"
                                    icon={<LeftOutlined style={{ transform: showStatusCard ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.3s' }} />}
                                    onClick={() => setShowStatusCard(!showStatusCard)}
                                    style={{
                                        position: 'absolute',
                                        left: -32,
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'rgba(255, 255, 255, 0.95)',
                                        boxShadow: '-4px 0 16px rgba(0,0,0,0.1)',
                                        borderRadius: '8px 0 0 8px',
                                        height: 36,
                                        width: 32,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        border: '1px solid rgba(0,0,0,0.06)',
                                        borderRight: 'none',
                                        backdropFilter: 'blur(10px)'
                                    }}
                                />
                            </div>
                            
                            <div style={{ fontSize: '13px' }}>
                                <div style={{ 
                                    background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                                    padding: '12px',
                                    borderRadius: '8px',
                                    marginBottom: '16px',
                                    border: '1px solid rgba(0,0,0,0.05)'
                                }}>
                                    <div style={{ fontWeight: '600', marginBottom: '8px', color: '#374151' }}>Cluster Overview</div>
                                    {listener && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                            <span style={{ color: '#6b7280' }}>Listener:</span>
                                            <span style={{ fontWeight: '600', color: '#0ea5e9' }}>{listener.ListenerState}</span>
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                        <span style={{ color: '#6b7280' }}>Primary Replicas:</span>
                                        <span style={{ fontWeight: '600', color: '#dc2626' }}>{primaryCount}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                        <span style={{ color: '#6b7280' }}>Secondary Replicas:</span>
                                        <span style={{ fontWeight: '600', color: '#16a34a' }}>{secondaryCount}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: '#6b7280' }}>Total Nodes:</span>
                                        <span style={{ fontWeight: '600', color: '#374151' }}>{nodes.length}</span>
                                    </div>
                                </div>

                                <div style={{ marginBottom: 16 }}>
                                    <div style={{ fontWeight: '600', marginBottom: '8px', color: '#374151' }}>Replica Status</div>
                                    <div style={{ paddingLeft: 4 }}>
                                        <Badge 
                                            color="#0ea5e9" 
                                            text="Listener (Load Balancer)" 
                                            style={{ display: 'block', marginBottom: 6, fontSize: '12px' }} 
                                        />
                                        <Badge 
                                            color="#dc2626" 
                                            text="Primary Replica" 
                                            style={{ display: 'block', marginBottom: 6, fontSize: '12px' }} 
                                        />
                                        <Badge 
                                            color="#16a34a" 
                                            text="Secondary Replica" 
                                            style={{ display: 'block', marginBottom: 6, fontSize: '12px' }} 
                                        />
                                        <Badge 
                                            color="#f97316" 
                                            text="Standalone/Other" 
                                            style={{ display: 'block', marginBottom: 6, fontSize: '12px' }} 
                                        />
                                    </div>
                                </div>
                                
                                <Divider style={{ margin: '16px 0' }} />
                                
                                <div>
                                    <div style={{ fontWeight: '600', marginBottom: '8px', color: '#374151' }}>Synchronization</div>
                                    <div style={{ paddingLeft: 4 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                                            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#16a34a', marginRight: 8 }} />
                                            <span style={{ fontSize: '12px', color: '#6b7280' }}>Synchronized (Solid line)</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                                            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#f59e0b', marginRight: 8 }} />
                                            <span style={{ fontSize: '12px', color: '#6b7280' }}>Synchronizing</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                                            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#3b82f6', marginRight: 8 }} />
                                            <span style={{ fontSize: '12px', color: '#6b7280' }}>Asynchronous (Dashed line)</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center' }}>
                                            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#dc2626', marginRight: 8 }} />
                                            <span style={{ fontSize: '12px', color: '#6b7280' }}>Disconnected</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </Panel>
                </ReactFlow>
            </div>
        </div>
    );
};

export default React.memo(MssqlTopology); 