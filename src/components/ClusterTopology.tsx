import React, { useMemo, useState } from 'react';
import ReactFlow, { 
    Node, 
    Edge, 
    Background,
    Controls,
    ReactFlowProvider,
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
    SyncOutlined
} from '@ant-design/icons';
import { Card, Button, Badge, Divider } from 'antd';

interface TopologyProps {
    nodes: Array<{
        Hostname: string;
        NodeStatus: string;
        ReplicationLagSec: string;
        IP: string;
    }>;
    clusterName?: string;
}

const ClusterTopology: React.FC<TopologyProps> = ({ nodes, clusterName }) => {
    const [showStatusCard, setShowStatusCard] = useState(false);

    // Helper function to truncate hostname
    const truncateHostname = (hostname: string, maxLength: number = 20) => {
        return hostname.length > maxLength ? hostname.substring(0, maxLength) + '...' : hostname;
    };

    // Node'ları ve Edge'leri memoize edelim
    const { flowNodes, flowEdges } = useMemo(() => {
        const masterNode = nodes.find(n => n.NodeStatus === 'MASTER');
        const slaveNodes = nodes.filter(n => n.NodeStatus === 'SLAVE');
        
        const centerX = 400;
        const centerY = 250;
        const masterRadius = 0; // Master at center
        const slaveRadius = 220; // Slave nodes in a circle around master
        
        const flowNodes: Node[] = [];
        const flowEdges: Edge[] = [];

        // Add MASTER node at center
        if (masterNode) {
            flowNodes.push({
                id: masterNode.Hostname,
                position: { x: centerX - 85, y: centerY - 60 },
                data: { 
                    label: (
                        <div style={{ 
                            padding: '10px', 
                            fontFamily: 'Inter, system-ui, sans-serif',
                            background: 'linear-gradient(135deg, #f5f9ff 0%, #e8f0fe 100%)',
                            borderRadius: '8px',
                            border: '1px solid rgba(26, 115, 232, 0.2)'
                        }}>
                            <div style={{ 
                                display: 'flex',
                                alignItems: 'center',
                                marginBottom: '8px',
                            }}>
                                <div style={{
                                    background: '#1a73e8',
                                    padding: '6px',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    marginRight: '8px',
                                    boxShadow: '0 2px 4px rgba(26, 115, 232, 0.2)'
                                }}>
                                    <DatabaseOutlined style={{ color: 'white', fontSize: '14px' }} />
                                </div>
                                <div style={{ 
                                    fontWeight: 'bold', 
                                    fontSize: '13px',
                                    color: '#1a73e8',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                }}>
                                    {truncateHostname(masterNode.Hostname)}
                                </div>
                            </div>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                marginBottom: '10px',
                                background: '#1a73e8',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                color: 'white',
                                fontWeight: 'bold',
                                boxShadow: '0 1px 2px rgba(26, 115, 232, 0.2)'
                            }}>
                                MASTER
                            </div>
                            
                            <div style={{ background: 'white', padding: '8px', borderRadius: '6px', marginBottom: '8px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                <div style={{ 
                                    display: 'flex',
                                    alignItems: 'center',
                                    fontSize: '11px',
                                    color: '#5f6368',
                                }}>
                                    <GlobalOutlined style={{ fontSize: '10px', marginRight: 4 }} />
                                    <span>{masterNode.IP}</span>
                                </div>
                            </div>
                            
                            <div style={{ 
                                display: 'flex',
                                alignItems: 'center',
                                background: '#e6f4ea',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: '500'
                            }}>
                                <CheckCircleOutlined style={{ color: '#34a853', marginRight: 6 }} />
                                <span style={{ color: '#34a853' }}>RUNNING</span>
                            </div>
                        </div>
                    )
                },
                style: {
                    background: 'transparent',
                    border: 'none',
                    width: 170,
                },
            });
        }
        
        // Position SLAVE nodes in a circle around MASTER
        slaveNodes.forEach((node, index) => {
            const angle = (2 * Math.PI * index) / Math.max(slaveNodes.length, 1);
            const x = centerX + slaveRadius * Math.cos(angle);
            const y = centerY + slaveRadius * Math.sin(angle);
            
            const lagValue = parseFloat(node.ReplicationLagSec);
            const lagColor = lagValue > 300 ? '#ea4335' : lagValue > 100 ? '#fbbc04' : '#34a853';
            
            flowNodes.push({
                id: node.Hostname,
                position: { x: x - 85, y: y - 60 },
                data: { 
                    label: (
                        <div style={{ 
                            padding: '10px', 
                            fontFamily: 'Inter, system-ui, sans-serif',
                            background: 'linear-gradient(135deg, #f5fbf6 0%, #e6f4ea 100%)',
                            borderRadius: '8px',
                            border: '1px solid rgba(52, 168, 83, 0.2)'
                        }}>
                            <div style={{ 
                                display: 'flex',
                                alignItems: 'center',
                                marginBottom: '8px',
                            }}>
                                <div style={{
                                    background: '#34a853',
                                    padding: '6px',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    marginRight: '8px',
                                    boxShadow: '0 2px 4px rgba(52, 168, 83, 0.2)'
                                }}>
                                    <DatabaseOutlined style={{ color: 'white', fontSize: '14px' }} />
                                </div>
                                <div style={{ 
                                    fontWeight: 'bold', 
                                    fontSize: '13px',
                                    color: '#34a853',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                }}>
                                    {truncateHostname(node.Hostname)}
                                </div>
                            </div>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                marginBottom: '10px',
                                background: '#34a853',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                color: 'white',
                                fontWeight: 'bold',
                                boxShadow: '0 1px 2px rgba(52, 168, 83, 0.2)'
                            }}>
                                SLAVE
                            </div>
                            
                            <div style={{ background: 'white', padding: '8px', borderRadius: '6px', marginBottom: '8px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                <div style={{ 
                                    display: 'flex',
                                    alignItems: 'center',
                                    fontSize: '11px',
                                    color: '#5f6368',
                                    marginBottom: '4px'
                                }}>
                                    <GlobalOutlined style={{ fontSize: '10px', marginRight: 4 }} />
                                    <span>{node.IP}</span>
                                </div>
                                <div style={{ 
                                    display: 'flex',
                                    alignItems: 'center',
                                    fontSize: '11px',
                                    color: '#5f6368',
                                }}>
                                    <ClockCircleOutlined style={{ fontSize: '10px', marginRight: 4 }} />
                                    <span>Lag: {lagValue.toFixed(1)}s</span>
                                </div>
                            </div>
                            
                            <div style={{ 
                                display: 'flex',
                                alignItems: 'center',
                                background: lagValue > 300 ? '#fce8e6' : lagValue > 100 ? '#fef7e0' : '#e6f4ea',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: '500'
                            }}>
                                {lagValue > 300 ? (
                                    <WarningOutlined style={{ color: '#ea4335', marginRight: 6 }} />
                                ) : lagValue > 100 ? (
                                    <ClockCircleOutlined style={{ color: '#fbbc04', marginRight: 6 }} />
                                ) : (
                                    <CheckCircleOutlined style={{ color: '#34a853', marginRight: 6 }} />
                                )}
                                <span style={{ 
                                    color: lagValue > 300 ? '#ea4335' : lagValue > 100 ? '#fbbc04' : '#34a853'
                                }}>
                                    {lagValue > 300 ? 'Critical Delay' : lagValue > 100 ? 'Delayed' : 'Healthy'}
                                </span>
                            </div>
                        </div>
                    )
                },
                style: {
                    background: 'transparent',
                    border: 'none',
                    width: 170,
                },
            });

            if (masterNode) {
                flowEdges.push({
                    id: `${masterNode.Hostname}-${node.Hostname}`,
                    source: masterNode.Hostname,
                    target: node.Hostname,
                    type: 'smoothstep',
                    animated: true,
                    style: { 
                        stroke: lagValue > 300 ? '#ea4335' : lagValue > 100 ? '#fbbc04' : '#34a853',
                        strokeWidth: lagValue > 300 ? 2.5 : lagValue > 100 ? 2 : 1.5,
                        opacity: 0.8
                    },
                    label: `${lagValue.toFixed(1)}s`,
                    labelStyle: { 
                        fill: lagValue > 300 ? '#ea4335' : lagValue > 100 ? '#fbbc04' : '#34a853',
                        fontWeight: 'bold',
                        fontSize: '10px',
                        fontFamily: 'Inter, system-ui, sans-serif'
                    },
                    labelBgStyle: { 
                        fill: '#ffffff',
                        stroke: lagValue > 300 ? '#ea4335' : lagValue > 100 ? '#fbbc04' : '#34a853',
                        strokeWidth: 1,
                        borderRadius: 4
                    },
                    labelBgPadding: [4, 3],
                    markerEnd: {
                        type: MarkerType.ArrowClosed,
                        color: lagValue > 300 ? '#ea4335' : lagValue > 100 ? '#fbbc04' : '#34a853',
                        width: 16,
                        height: 16,
                        strokeWidth: 1
                    },
                });
            }
        });

        return { flowNodes, flowEdges };
    }, [nodes]);

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
                    background: 'linear-gradient(135deg, #336791 0%, #254E6C 100%)',
                    padding: '16px 24px',
                    borderTopLeftRadius: '16px',
                    borderTopRightRadius: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    boxShadow: '0 2px 8px rgba(51, 103, 145, 0.15)'
                }}>
                    <DatabaseOutlined style={{ color: 'white', fontSize: '24px' }} />
                    <div>
                        <h2 style={{ 
                            margin: 0, 
                            color: 'white', 
                            fontSize: '18px',
                            fontWeight: '600',
                            letterSpacing: '0.2px'
                        }}>
                            PostgreSQL Cluster Topology
                        </h2>
                        {clusterName && (
                            <div style={{ 
                                color: 'rgba(255, 255, 255, 0.9)',
                                fontSize: '13px',
                                marginTop: '2px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}>
                                <SyncOutlined style={{ fontSize: '12px' }} />
                                {clusterName}
                            </div>
                        )}
                    </div>
                </div>
                <div style={{ 
                    height: '550px', 
                    borderRadius: '12px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.08)', 
                    overflow: 'hidden',
                    border: '1px solid rgba(0,0,0,0.08)',
                    background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fb 100%)'
                }}>
                    <ReactFlow
                        nodes={flowNodes}
                        edges={flowEdges}
                        fitView
                        connectionLineType={ConnectionLineType.SmoothStep}
                        proOptions={{ hideAttribution: true }}
                        minZoom={0.2}
                        maxZoom={1.5}
                        nodesDraggable={true}
                        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
                        style={{ background: 'transparent' }}
                    >
                        <Background color="#e0e0e0" gap={22} size={1.2} />
                        <Controls 
                            position="bottom-right" 
                            showInteractive={false}
                            style={{
                                borderRadius: '8px',
                                padding: '4px',
                                backgroundColor: 'white',
                                boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                                border: '1px solid rgba(0,0,0,0.05)'
                            }}
                            onZoomIn={() => {}}
                            onZoomOut={() => {}}
                            onFitView={() => {}}
                        />
                        <Panel position="top-right">
                            <Card
                                size="small"
                                style={{
                                    position: 'absolute',
                                    right: showStatusCard ? 0 : -300,
                                    top: 0,
                                    width: 280,
                                    transition: 'right 0.3s ease',
                                    background: 'rgba(255, 255, 255, 0.95)',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                                    borderRadius: '4px'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                    <h4 style={{ margin: 0 }}>PostgreSQL Cluster</h4>
                                    <Button
                                        type="text"
                                        icon={<LeftOutlined />}
                                        onClick={() => setShowStatusCard(!showStatusCard)}
                                        style={{
                                            position: 'absolute',
                                            left: -28,
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            background: '#fff',
                                            boxShadow: '-2px 0 8px rgba(0,0,0,0.15)',
                                            borderRadius: '4px 0 0 4px',
                                            height: 32,
                                            width: 28,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                    />
                                </div>
                                <div style={{ fontSize: '13px' }}>
                                    <div style={{ marginBottom: 16 }}>
                                        <div style={{ marginBottom: 8 }}>
                                            <Badge status="success" text="Master" style={{ display: 'block', marginBottom: 4 }} />
                                            <Badge status="processing" text="Slave" style={{ display: 'block', marginBottom: 4 }} />
                                        </div>
                                    </div>
                                    <Divider style={{ margin: '12px 0' }} />
                                    <div>
                                        <div style={{ fontWeight: 500, marginBottom: 8 }}>Replication Status:</div>
                                        <div style={{ paddingLeft: 8 }}>
                                            <Badge status="success" text="Healthy (less than 100s)" style={{ display: 'block', marginBottom: 4 }} />
                                            <Badge status="warning" text="Delayed (100s - 300s)" style={{ display: 'block', marginBottom: 4 }} />
                                            <Badge status="error" text="Critical Delay (more than 300s)" style={{ display: 'block' }} />
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        </Panel>
                    </ReactFlow>
                </div>
            </div>
        </div>
    );
};

export default React.memo(ClusterTopology); 