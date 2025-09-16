import React, { useState, useEffect } from "react";
import Hexagon from "react-hexagon";
import { isEmpty, times } from "lodash";
import { NodeType } from "../type";
import { STATUS_COLORS } from "../constants";
import MongoIcon from "../icons/mongo";
import PostgresIcon from "../icons/postgresql";
import MssqlIcon from "../icons/mssql";
import { Popover, Tag, Button, Tooltip } from "antd";
import { CheckOutlined, InfoCircleOutlined } from '@ant-design/icons';

interface HexagonGridProps {
  nodes: NodeType[];
  gridWidth: number;
  gridHeight: number;
  x?: number;
  y?: number;
  agentStatuses: { [key: string]: boolean };
  failoverInfo?: { [key: string]: { message: string, acknowledged: boolean } };
  onAcknowledgeFailover?: (nodeId: string) => void;
}

interface RowDimensions {
  y: string;
  height: string;
  width: number;
  marginLeft?: string;
}

const getGridDimensions = (gridWidth: number, gridHeight: number, N: number) => {
  const a = (5 * gridHeight) / (gridWidth * Math.sqrt(2));
  const b = gridHeight / (2 * gridWidth) - 2;

  const columns = Math.ceil((-b + Math.sqrt(b * b + 4 * N * a)) / (2 * a));

  const hexSize = Math.floor(gridWidth / (4 * columns + 0.5));
  const rows = Math.ceil(N / columns);

  return {
    columns,
    hexSize,
    hexWidth: hexSize * 2,
    hexHeight: Math.ceil(hexSize * Math.sqrt(3)),
    rows
  };
};

// Add this CSS animation at the top of the file after imports
const pulsingAnimation = `
@keyframes pulse {
  0% {
    filter: brightness(100%);
    stroke-width: 10;
  }
  50% {
    filter: brightness(110%);
    stroke-width: 15;
  }
  100% {
    filter: brightness(100%);
    stroke-width: 10;
  }
}
`;

// Helper function to shorten MSSQL version
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

const HexagonGrid: React.FC<HexagonGridProps> = ({
  nodes,
  gridHeight,
  gridWidth,
  x = 0,
  y = 0,
  agentStatuses,
  failoverInfo = {},
  onAcknowledgeFailover
}) => {
  // Ensure nodes is always an array
  const safeNodes = nodes || [];

  const [state, setState] = useState({
    columns: 1,
    hexSize: 1,
    hexWidth: 1,
    hexHeight: 1,
    rows: 0
  });

  useEffect(() => {
    if (!isEmpty(safeNodes) && gridWidth > 0 && gridHeight > 0) {
      setState(getGridDimensions(gridWidth, gridHeight, safeNodes.length));
    }
  }, [safeNodes, gridWidth, gridHeight]);

  const evaluateNodeStatus = (node: NodeType) => {
    const type = node.MongoStatus ? 'mongodb' : node.PGServiceStatus ? 'postgresql' : 'mssql';
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
    // Else if disk space is low, warning
    else if (Number(node.freediskpercent || node.FDPercent || 0) < 25) {
      priority = 2;
    }

    return priority;
  };

  const renderPopoverContent = (node: NodeType) => (
    <div style={{ minWidth: '300px' }}>
      <div style={{ 
        margin: '-12px -16px',
        padding: '16px',
        borderBottom: '1px solid #f0f0f0',
        background: (() => {
          const status = evaluateNodeStatus(node);
          if (status === 1) return '#fff1f0';
          if (status === 2) return '#fffbe6';
          return '#f6ffed';
        })(),
        borderRadius: '8px 8px 0 0'
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px'
        }}>
          {node.MongoStatus ? (
            <MongoIcon size="24" color="#00684A" />
          ) : node.PGServiceStatus ? (
            <PostgresIcon size="24" color="#336791" />
          ) : (
            <MssqlIcon size="24" color="#CC2927" />
          )}
          <span style={{ 
            fontWeight: 600, 
            fontSize: '16px',
            color: '#262626' 
          }}>Node Details - {node.Hostname}</span>
        </div>
      </div>
      <div style={{ padding: '16px 0' }}>
        {node.Hostname && failoverInfo[node.Hostname] && !failoverInfo[node.Hostname].acknowledged && (
          <div style={{
            margin: '0 0 16px 0',
            padding: '12px',
            background: '#fffbe6',
            border: '1px solid #ffe58f',
            borderRadius: '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <InfoCircleOutlined style={{ color: '#d48806', marginTop: '2px' }} />
              <div>
                <div style={{ fontWeight: 500, color: '#d48806', marginBottom: '4px' }}>Failover Detected</div>
                <div style={{ fontSize: '13px', color: '#262626' }}>{failoverInfo[node.Hostname].message}</div>
              </div>
            </div>
            {onAcknowledgeFailover && (
              <Tooltip title="Acknowledge">
                <Button
                  type="text"
                  icon={<CheckOutlined />}
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (node.Hostname) {
                      onAcknowledgeFailover(node.Hostname);
                    }
                  }}
                  style={{ color: '#d48806', marginLeft: 'auto' }}
                />
              </Tooltip>
            )}
          </div>
        )}

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
            marginBottom: '12px' 
          }}>
            <span style={{ 
              fontWeight: 600,
              fontSize: '15px',
              color: '#262626'
            }}>Status</span>
            <Tag color={
              evaluateNodeStatus(node) === 1 ? 'error' :
              evaluateNodeStatus(node) === 2 ? 'warning' : 'success'
            } style={{ 
              padding: '4px 12px',
              fontSize: '14px',
              fontWeight: 500
            }}>
              {node.status || node.NodeStatus || node.HARole}
            </Tag>
          </div>
          <div style={{ 
            fontSize: '14px', 
            color: '#595959',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '4px 0',
              borderBottom: '1px solid #f0f0f0',
              paddingBottom: '8px',
              marginBottom: '4px'
            }}>
              <span>Agent Status:</span>
              <Tag color={node.Hostname && agentStatuses[node.Hostname] ? 'success' : 'error'} style={{ 
                padding: '2px 8px',
                fontSize: '13px'
              }}>
                {node.Hostname && agentStatuses[node.Hostname] ? 'Connected' : 'Disconnected'}
              </Tag>
            </div>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '4px 0'
            }}>
              <span>Cluster Name:</span>
              <span style={{ 
                fontWeight: 500,
                color: '#262626'
              }}>{node.ClusterName}</span>
            </div>
            {node.MongoStatus && (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '4px 0'
              }}>
                <span>MongoDB Service:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ 
                    fontWeight: 500,
                    color: node.MongoStatus === 'RUNNING' ? '#52c41a' : '#f5222d'
                  }}>{node.MongoStatus}</span>
                  {node.port && (
                    <span style={{ 
                      color: '#8c8c8c',
                      fontSize: '13px',
                      padding: '0 6px',
                      background: '#f5f5f5',
                      borderRadius: '4px'
                    }}>Port: {node.port}</span>
                  )}
                </div>
              </div>
            )}
            {node.MongoVersion && (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '4px 0'
              }}>
                <span>MongoDB Version:</span>
                <span style={{ fontWeight: 500 }}>{node.MongoVersion}</span>
              </div>
            )}
            {node.PGServiceStatus && (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '4px 0'
              }}>
                <span>PostgreSQL Service:</span>
                <span style={{ 
                  fontWeight: 500,
                  color: node.PGServiceStatus === 'RUNNING' ? '#52c41a' : '#f5222d'
                }}>{node.PGServiceStatus}</span>
              </div>
            )}
            {node.PGVersion && (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '4px 0'
              }}>
                <span>PostgreSQL Version:</span>
                <span style={{ fontWeight: 500 }}>{node.PGVersion}</span>
              </div>
            )}
            {node.Status && !node.MongoStatus && !node.PGServiceStatus && (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '4px 0'
              }}>
                <span>MSSQL Service:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ 
                    fontWeight: 500,
                    color: node.Status === 'RUNNING' ? '#52c41a' : '#f5222d'
                  }}>{node.Status}</span>
                  {node.Port && (
                    <span style={{ 
                      color: '#8c8c8c',
                      fontSize: '13px',
                      padding: '0 6px',
                      background: '#f5f5f5',
                      borderRadius: '4px'
                    }}>Port: {node.Port}</span>
                  )}
                </div>
              </div>
            )}
            {node.Version && !node.MongoStatus && !node.PGServiceStatus && (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '4px 0'
              }}>
                <span>Version:</span>
                <span style={{ fontWeight: 500 }}>{shortenMssqlVersion(node.Version)}</span>
              </div>
            )}
            {node.Edition && !node.MongoStatus && !node.PGServiceStatus && (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '4px 0'
              }}>
                <span>Edition:</span>
                <span style={{ fontWeight: 500 }}>{node.Edition}</span>
              </div>
            )}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '4px 0',
              borderTop: '1px solid #f0f0f0',
              marginTop: '4px',
              paddingTop: '8px'
            }}>
              <span>Database Type:</span>
              <span style={{ fontWeight: 500, color: '#262626' }}>
                {node.MongoStatus ? 'MongoDB' : node.PGServiceStatus ? 'PostgreSQL' : 'MSSQL'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const getHexProps = (node: NodeType) => {
    const isFailed = evaluateNodeStatus(node) === 1;
    const isMongo = Boolean(node.MongoStatus);
    const hasFailover = node.Hostname && failoverInfo[node.Hostname] && !failoverInfo[node.Hostname].acknowledged;

    // Create a style tag for the animation if it doesn't exist
    if (hasFailover && !document.getElementById('pulse-animation')) {
      const styleSheet = document.createElement('style');
      styleSheet.id = 'pulse-animation';
      styleSheet.textContent = pulsingAnimation;
      document.head.appendChild(styleSheet);
    }

    return {
      style: {
        fill: isFailed ? (hasFailover ? "#fff6e5" : "#FFFFFF") : STATUS_COLORS[isFailed ? "RED" : "GREEN"],
        stroke: isFailed ? STATUS_COLORS.RED : "#FFFFFF",
        strokeWidth: isFailed ? "10" : "1",
        cursor: "pointer",
        animation: hasFailover ? "pulse 2s infinite" : "none",
        filter: hasFailover ? "drop-shadow(0 0 8px rgba(250, 173, 20, 0.5))" : "none",
      }
    };
  };

  const renderHexagonContent = (node: NodeType) => {
    const isFailed = evaluateNodeStatus(node) === 1;
    const isMongo = Boolean(node.MongoStatus);
    const isPg = Boolean(node.PGServiceStatus);
    const isMssql = !isMongo && !isPg;
    
    if (isFailed) {
      return (
        <foreignObject 
          x="20%" 
          y={isMongo ? "20%" : "25%"}
          width="60%" 
          height="60%"
        >
          <div style={{ 
            width: '100%', 
            height: '100%', 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            transform: 'scale(1.2)'
          }}>
            {isMongo ? (
              <MongoIcon size="180" color="#00684A" />
            ) : isPg ? (
              <PostgresIcon size="200" color="#336791" />
            ) : (
              <MssqlIcon size="200" color="#CC2927" />
            )}
          </div>
        </foreignObject>
      );
    }
    return null;
  };

  const getHexDimensions = (row: number, col: number) => {
    const dimensions = {
      width: `${state.hexWidth}px`,
      height: `${state.hexHeight}px`,
      x: col * state.hexSize * 3
    };
    if (row % 2 === 1) {
      dimensions.x += state.hexSize * (3 / 2);
    }
    return dimensions;
  };

  const getRowDimensions = (row: number): RowDimensions => {
    const dimensions: RowDimensions = {
      y: `${row * (state.hexSize * (Math.sqrt(3) / 2))}px`,
      height: `${state.hexHeight}px`,
      width: gridWidth
    };
    if (row % 2 === 0) {
      dimensions.marginLeft = `${(state.hexSize / 2) * 3}px`;
    }
    return dimensions;
  };

  return (
    <svg width={gridWidth} height={gridHeight} x={x} y={y}>
      {times(state.rows, (row) => {
        const remaining = safeNodes.length - row * state.columns;
        const columns = remaining < state.columns ? remaining : state.columns;
        const rowDim = getRowDimensions(row);
        return (
          <svg
            key={row}
            width={rowDim.width}
            height={rowDim.height}
            y={rowDim.y}
          >
            {times(columns, (col) => {
              const iHexagon = row * state.columns + col;
              const node = safeNodes[iHexagon];
              const hexDim = getHexDimensions(row, col);
              const hexProps = getHexProps(node);
              return (
                <Popover
                  key={iHexagon}
                  content={renderPopoverContent(node)}
                  trigger="hover"
                  placement="right"
                >
                  <svg
                    height={hexDim.height}
                    width={hexDim.width}
                    x={`${hexDim.x}px`}
                  >
                    <Hexagon {...hexProps} flatTop>
                      {renderHexagonContent(node)}
                    </Hexagon>
                  </svg>
                </Popover>
              );
            })}
          </svg>
        );
      })}
    </svg>
  );
};

export default HexagonGrid; 