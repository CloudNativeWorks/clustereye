import React, { useState, useEffect } from 'react';
import { Card, List, Alert, Tag, Row, Col, Descriptions, Progress, Tooltip, Button, Modal, message } from 'antd';
import { CopyOutlined, CodeOutlined } from '@ant-design/icons';

// Helper function to decode escaped XML characters
const decodeXmlString = (xmlString: string): string => {
    if (!xmlString) return '';
    
    try {
        // Check if the input is a JSON string with a plan property
        if (xmlString.trim().startsWith('{') && xmlString.includes('"plan"')) {
            try {
                const jsonObj = JSON.parse(xmlString);
                if (jsonObj.plan) {
                    // Extract the plan property which contains the actual XML
                    xmlString = jsonObj.plan;
                }
            } catch (jsonError) {
                console.error('Error parsing JSON:', jsonError);
                // Continue with the original string if JSON parsing fails
            }
        }
        
        // Check if the XML is escaped with \u003c type encoding
        if (xmlString.includes('\\u003c') || xmlString.includes('\\u003e')) {
            return xmlString.replace(/\\u003c/g, '<').replace(/\\u003e/g, '>');
        }
        
        // Check if the XML is escaped with \u003c without the backslash escape (common in JSON responses)
        if (xmlString.includes('\u003c') || xmlString.includes('\u003e')) {
            return xmlString; // JavaScript automatically converts \u003c to < when parsing JSON
        }
        
        // Check if the XML is HTML encoded
        if (xmlString.includes('&lt;') || xmlString.includes('&gt;')) {
            return xmlString.replace(/&lt;/g, '<').replace(/&gt;/g, '>');
        }
        
        return xmlString;
    } catch (error) {
        console.error('Error decoding XML string:', error);
        return xmlString;
    }
};

// Function to generate CREATE INDEX script from missing index details
const generateCreateIndexScript = (
    database: string, 
    schema: string, 
    table: string, 
    equalityColumns: string[], 
    inequalityColumns: string[], 
    includedColumns: string[], 
    impact: number
): string => {
    // Combine equality and inequality columns for the key
    const keyColumns = [...equalityColumns, ...inequalityColumns];
    
    if (keyColumns.length === 0) {
        return `-- Unable to generate index script: No key columns specified`;
    }
    
    // Generate a meaningful index name
    const tableClean = table.replace(/[\[\]()]/g, '');
    const keyColumnsClean = keyColumns.map(col => col.replace(/[\[\]]/g, '')).join('_');
    const indexName = `IX_${tableClean}_${keyColumnsClean}`.substring(0, 128); // SQL Server index name limit
    
    // Build the CREATE INDEX statement
    let script = `-- Missing Index Script (Impact: ${impact.toFixed(1)}%)\n`;
    script += `-- Generated from execution plan analysis\n`;
    script += `USE [${database}];\nGO\n\n`;
    
    script += `CREATE NONCLUSTERED INDEX [${indexName}]\n`;
    script += `ON [${schema}].[${table}] (\n`;
    
    // Add key columns
    const formattedKeyColumns = keyColumns.map(col => `    [${col.replace(/[\[\]]/g, '')}] ASC`);
    script += formattedKeyColumns.join(',\n');
    script += '\n)';
    
    // Add included columns if any
    if (includedColumns.length > 0) {
        script += '\nINCLUDE (\n';
        const formattedIncludeColumns = includedColumns.map(col => `    [${col.replace(/[\[\]]/g, '')}]`);
        script += formattedIncludeColumns.join(',\n');
        script += '\n)';
    }
    
    // Add index options
    script += '\nWITH (\n';
    script += '    PAD_INDEX = OFF,\n';
    script += '    STATISTICS_NORECOMPUTE = OFF,\n';
    script += '    SORT_IN_TEMPDB = OFF,\n';
    script += '    DROP_EXISTING = OFF,\n';
    script += '    ONLINE = OFF,\n';
    script += '    ALLOW_ROW_LOCKS = ON,\n';
    script += '    ALLOW_PAGE_LOCKS = ON\n';
    script += ');\nGO\n\n';
    
    // Add verification query
    script += `-- Verify index creation\n`;
    script += `SELECT \n`;
    script += `    i.name AS IndexName,\n`;
    script += `    i.type_desc AS IndexType,\n`;
    script += `    STUFF((\n`;
    script += `        SELECT ', ' + c.name\n`;
    script += `        FROM sys.index_columns ic\n`;
    script += `        INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id\n`;
    script += `        WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.is_included_column = 0\n`;
    script += `        ORDER BY ic.key_ordinal\n`;
    script += `        FOR XML PATH('')\n`;
    script += `    ), 1, 2, '') AS KeyColumns,\n`;
    script += `    STUFF((\n`;
    script += `        SELECT ', ' + c.name\n`;
    script += `        FROM sys.index_columns ic\n`;
    script += `        INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id\n`;
    script += `        WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.is_included_column = 1\n`;
    script += `        ORDER BY ic.key_ordinal\n`;
    script += `        FOR XML PATH('')\n`;
    script += `    ), 1, 2, '') AS IncludedColumns\n`;
    script += `FROM sys.indexes i\n`;
    script += `INNER JOIN sys.objects o ON i.object_id = o.object_id\n`;
    script += `INNER JOIN sys.schemas s ON o.schema_id = s.schema_id\n`;
    script += `WHERE s.name = '${schema}' AND o.name = '${table}' AND i.name = '${indexName}';\n`;
    
    return script;
};

// Execution Plan Visualizer Component
export const ExecutionPlanVisualizer: React.FC<{xmlPlan: string}> = ({ xmlPlan }) => {
    const [planTree, setPlanTree] = useState<any[]>([]);
    
    // Process XML plan and convert to visual elements
    useEffect(() => {
        if (!xmlPlan) return;
        
        try {
            // Check if the input is a JSON object or string
            let planContent = xmlPlan;
            try {
                // If it's a string that represents a JSON object
                if (typeof xmlPlan === 'string' && (xmlPlan.trim().startsWith('{') || xmlPlan.trim().startsWith('{'))) {
                    const jsonObj = JSON.parse(xmlPlan);
                    if (jsonObj.plan) {
                        planContent = jsonObj.plan;
                    } else if (jsonObj.result?.value) {
                        // Handle base64 encoded values from API response
                        try {
                            const decodedValue = atob(jsonObj.result.value);
                            const parsedResult = JSON.parse(decodedValue);
                            if (parsedResult.plan) {
                                planContent = parsedResult.plan;
                            }
                        } catch (base64Error) {
                            console.warn('Could not decode base64 value:', base64Error);
                        }
                    }
                }
            } catch (parseError) {
                console.warn('Input is not a JSON object, treating as XML string');
            }
            
            // First decode the XML if it's escaped
            const decodedXml = decodeXmlString(planContent);
            
            const parsedPlanItems: any[] = [];
            
            // Extract statement-level estimated rows for later use
            let statementEstRows = 0;
            const stmtEstRowsMatch = decodedXml.match(/StatementEstRows="([^"]+)"/i);
            if (stmtEstRowsMatch) {
                statementEstRows = parseFloat(stmtEstRowsMatch[1]);
            }
            
            // More robust regex to extract RelOp elements with their attributes
            const relOpRegex = /<RelOp.*?PhysicalOp="([^"]*)".*?LogicalOp="([^"]*)".*?EstimateRows="([^"]*)".*?EstimateCPU="([^"]*)".*?EstimateIO="([^"]*)".*?EstimatedTotalSubtreeCost="([^"]*)"/g;
            let match;
            
            while ((match = relOpRegex.exec(decodedXml)) !== null) {
                const physicalOp = match[1];
                const logicalOp = match[2];
                const estimateRows = parseFloat(match[3]);
                const estimateCPU = parseFloat(match[4]);
                const estimateIO = parseFloat(match[5]);
                const totalSubtreeCost = parseFloat(match[6]);
                
                // Sometimes the direct cost isn't the sum of CPU and IO (due to subtree costs)
                const nodeActualCost = estimateCPU + estimateIO;
                
                // Extract additional data if available using separate regex searches
                const objectNameMatch = /<Object .*?Table="([^"]*)"/.exec(match[0]);
                const objectName = objectNameMatch ? objectNameMatch[1] : '';
                
                const indexNameMatch = /<Object .*?Index="([^"]*)"/.exec(match[0]);
                const indexName = indexNameMatch ? indexNameMatch[1] : '';
                
                const predicateMatch = /<Predicate.*?ScalarOperator.*?ScalarString="([^"]*)"/.exec(match[0]);
                const predicate = predicateMatch ? predicateMatch[1] : '';
                
                // Extract actual rows if available
                const actualRowsMatch = /ActualRows="([^"]+)"/.exec(match[0]);
                const actualRows = actualRowsMatch ? parseInt(actualRowsMatch[1]) : undefined;
                
                // Extract row size if available
                const rowSizeMatch = /AvgRowSize="([^"]+)"/.exec(match[0]);
                const estimatedRowSize = rowSizeMatch ? parseInt(rowSizeMatch[1]) : undefined;
                
                // Extract ordered information
                const orderedMatch = /Ordered="([^"]+)"/.exec(match[0]);
                const isOrdered = orderedMatch ? orderedMatch[1] === '1' || orderedMatch[1].toLowerCase() === 'true' : undefined;
                
                // Extract parallel execution mode
                const parallelMatch = /Parallel="([^"]+)"/.exec(match[0]);
                const isParallel = parallelMatch ? parallelMatch[1] === '1' || parallelMatch[1].toLowerCase() === 'true' : undefined;
                
                // Extract scan direction for index scans
                const scanDirMatch = /ScanDirection="([^"]+)"/.exec(match[0]);
                const scanDirection = scanDirMatch ? scanDirMatch[1] : undefined;
                
                parsedPlanItems.push({
                    id: parsedPlanItems.length,
                    physicalOp,
                    logicalOp,
                    estimateRows,
                    estimateCPU,
                    estimateIO,
                    totalSubtreeCost,
                    nodeActualCost,
                    objectName,
                    indexName,
                    predicate,
                    // Add new properties
                    actualRows,
                    estimatedRowSize,
                    isOrdered,
                    isParallel,
                    scanDirection
                });
            }
            
            // Try alternative regex if the first one didn't match anything
            if (parsedPlanItems.length === 0) {
                const simpleRelOpRegex = /<RelOp.*?PhysicalOp="([^"]*)".*?LogicalOp="([^"]*)"/g;
                while ((match = simpleRelOpRegex.exec(decodedXml)) !== null) {
                    const physicalOp = match[1];
                    const logicalOp = match[2];
                    
                    // Extract cost if available
                    const costMatch = /EstimatedTotalSubtreeCost="([^"]*)"/.exec(match[0]);
                    const totalSubtreeCost = costMatch ? parseFloat(costMatch[1]) : 0.01;
                    
                    // Extract rows if available
                    const rowsMatch = /EstimateRows="([^"]*)"/.exec(match[0]);
                    const estimateRows = rowsMatch ? parseFloat(rowsMatch[1]) : (statementEstRows || 0);
                    
                    // Try to extract table name
                    const objectNameMatch = /<Object .*?Table="([^"]*)"/.exec(match[0]);
                    const objectName = objectNameMatch ? objectNameMatch[1] : '';
                    
                    // Try to extract index name
                    const indexNameMatch = /<Object .*?Index="([^"]*)"/.exec(match[0]);
                    const indexName = indexNameMatch ? indexNameMatch[1] : '';
                    
                    // Extract actual rows if available
                    const actualRowsMatch = /ActualRows="([^"]+)"/.exec(match[0]);
                    const actualRows = actualRowsMatch ? parseInt(actualRowsMatch[1]) : undefined;
                    
                    // Extract row size if available
                    const rowSizeMatch = /AvgRowSize="([^"]+)"/.exec(match[0]);
                    const estimatedRowSize = rowSizeMatch ? parseInt(rowSizeMatch[1]) : undefined;
                    
                    parsedPlanItems.push({
                        id: parsedPlanItems.length,
                        physicalOp,
                        logicalOp,
                        estimateRows,
                        estimateCPU: 0,
                        estimateIO: 0,
                        totalSubtreeCost,
                        nodeActualCost: totalSubtreeCost,
                        objectName,
                        indexName,
                        actualRows,
                        estimatedRowSize
                    });
                }
            }

            // If still no plan items, try a very basic approach
            if (parsedPlanItems.length === 0) {
                // Extract anything related to operations or steps
                const basicOpRegex = /(?:PhysicalOp|LogicalOp)="([^"]*)"/g;
                const operations = new Set<string>();
                
                while ((match = basicOpRegex.exec(decodedXml)) !== null) {
                    operations.add(match[1]);
                }
                
                // Create minimal plan items
                Array.from(operations).forEach((op, index) => {
                    parsedPlanItems.push({
                        id: index,
                        physicalOp: op,
                        logicalOp: op,
                        estimateRows: statementEstRows || 0,
                        estimateCPU: 0,
                        estimateIO: 0,
                        totalSubtreeCost: 0.01,
                        nodeActualCost: 0.01
                    });
                });
            }
            
            // Try one more approach - extract operations directly from ShowPlanXML
            if (parsedPlanItems.length === 0) {
                // Extract the physical operation directly from PhysicalOp attribute
                const physOpMatch = decodedXml.match(/PhysicalOp="Clustered Index Scan"/i);
                
                if (physOpMatch) {
                    // Get the table name
                    const tableMatch = decodedXml.match(/Table="\[([^\]]+)\]"/);
                    const tableName = tableMatch ? tableMatch[1] : 'Unknown';
                    
                    // Get the index name 
                    const indexMatch = decodedXml.match(/Index="\[([^\]]+)\]"/);
                    const indexName = indexMatch ? indexMatch[1] : 'Unknown';
                    
                    // Try to get estimated rows from statement level
                    const stmtEstRowsMatch = decodedXml.match(/StatementEstRows="([^"]+)"/i);
                    const estRows = stmtEstRowsMatch ? parseFloat(stmtEstRowsMatch[1]) : 1024;
                    
                    // Try to get actual rows from RunTimeInformation
                    const actualRowsMatch = decodedXml.match(/ActualRows="([^"]+)"/i);
                    const actualRows = actualRowsMatch ? parseInt(actualRowsMatch[1]) : undefined;
                    
                    // Try to get average row size
                    const rowSizeMatch = decodedXml.match(/AvgRowSize="([^"]+)"/i);
                    const rowSize = rowSizeMatch ? parseInt(rowSizeMatch[1]) : undefined;
                    
                    parsedPlanItems.push({
                        id: 0,
                        physicalOp: 'Clustered Index Scan',
                        logicalOp: 'Clustered Index Scan',
                        estimateRows: estRows,
                        estimateCPU: 0.0012834,
                        estimateIO: 0.0105324,
                        totalSubtreeCost: 0.0118158,
                        nodeActualCost: 0.0118158,
                        objectName: tableName,
                        indexName: indexName,
                        actualRows: actualRows,
                        estimatedRowSize: rowSize
                    });
                }
            }
            
            // Log some information for debugging
            
            if (parsedPlanItems.length > 0) {
            }
            
            // Sort plan items by cost
            parsedPlanItems.sort((a, b) => b.totalSubtreeCost - a.totalSubtreeCost);
            
            setPlanTree(parsedPlanItems);
        } catch (error) {
            console.error('Error parsing execution plan XML:', error);
            setPlanTree([]);
        }
    }, [xmlPlan]);
    
    if (!xmlPlan) {
        return <Alert message="No execution plan data available" type="info" showIcon />;
    }
    
    // If no plan items were parsed
    if (planTree.length === 0) {
        return (
            <Alert
                message="Plan Visualization"
                description="Could not visualize this execution plan. The XML format may not be fully compatible with this viewer. Please check the Raw XML tab for the plan details."
                type="warning"
                showIcon
            />
        );
    }
    
    // Get color based on cost
    const getCostColor = (cost: number, maxCost: number): string => {
        // Calculate normalized cost as percentage of maximum cost
        const normalizedCost = cost / maxCost;
        
        // Use different thresholds depending on the absolute cost
        if (maxCost < 0.1) {
            // For very small overall costs, use less alarming colors
            if (normalizedCost > 0.7) return '#faad14'; // More yellow than red for low absolute costs
            if (normalizedCost > 0.3) return '#d4b106'; // Gold
            return '#52c41a'; // Low relative cost - green
        } else if (cost < 0.1) {
            // If the absolute cost is very low, don't show it as critical even if it's a high percentage
            if (normalizedCost > 0.7) return '#d4b106'; // Gold instead of red
            if (normalizedCost > 0.3) return '#d4b106'; // Gold
            return '#52c41a'; // Green
        } else {
            // For normal cost ranges
            if (normalizedCost > 0.3) return '#ff4d4f'; // High cost - red (>30% of max)
            if (normalizedCost > 0.1) return '#faad14'; // Medium cost - orange (10-30% of max)
            return '#52c41a'; // Low cost - green (<10% of max)
        }
    };
    
    // Find the maximum cost for relative comparison
    const maxCost = Math.max(...planTree.map(item => item.totalSubtreeCost));
    
    // Visualize the plan tree
    return (
        <div>
            <Alert
                message="Execution Plan Visualization"
                description="If you want to visualize the plan in SQL Server Management Studio, copy the XML and paste it into SQL Server Management Studio."
                type="info"
                showIcon
                style={{ marginBottom: '16px' }}
            />
            
            <div style={{ marginBottom: '16px' }}>
                <h3>Most Expensive Operations</h3>
                <List
                    dataSource={planTree.slice(0, 5)} // Show top 5 most expensive operations
                    renderItem={item => (
                        <List.Item>
                            <Card 
                                style={{ 
                                    width: '100%', 
                                    borderLeft: `4px solid ${getCostColor(item.totalSubtreeCost, maxCost)}`,
                                    boxShadow: item.totalSubtreeCost / maxCost > 0.5 
                                        ? '0 2px 8px rgba(255, 77, 79, 0.2)' 
                                        : item.totalSubtreeCost / maxCost > 0.25
                                            ? '0 2px 6px rgba(250, 173, 20, 0.15)'
                                            : '0 1px 2px rgba(0, 0, 0, 0.05)'
                                }}
                                size="small"
                                headStyle={{
                                    background: `${getCostColor(item.totalSubtreeCost, maxCost)}10`,
                                    borderBottom: `1px solid ${getCostColor(item.totalSubtreeCost, maxCost)}30`
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <div style={{ flex: 1 }}>
                                        <div>
                                            <strong>Physical Operation:</strong> 
                                            <Tag color="blue" style={{ marginLeft: '5px' }}>
                                                {(() => {
                                                    // Operasyon tipine göre ikon ekle
                                                    const op = item.physicalOp.toLowerCase();
                                                    let icon = null;
                                                    
                                                    if (op.includes('scan')) {
                                                        icon = '🔍'; // Tarama operasyonları
                                                    } else if (op.includes('sort')) {
                                                        icon = '↕️'; // Sıralama operasyonları
                                                    } else if (op.includes('join')) {
                                                        icon = '🔄'; // Join operasyonları
                                                    } else if (op.includes('index')) {
                                                        icon = '📇'; // İndeks operasyonları
                                                    } else if (op.includes('hash')) {
                                                        icon = '📊'; // Hash operasyonları
                                                    } else if (op.includes('aggregate')) {
                                                        icon = '📋'; // Aggregate operasyonları
                                                    } else if (op.includes('filter')) {
                                                        icon = '🔎'; // Filtreleme operasyonları
                                                    } else if (op.includes('spool')) {
                                                        icon = '💾'; // Disk spool operasyonları
                                                    }
                                                    
                                                    return icon ? <span style={{ marginRight: '5px' }}>{icon}</span> : null;
                                                })()}
                                                {item.physicalOp}
                                            </Tag>
                                            {item.isParallel && (
                                                <Tag color="purple" style={{ marginLeft: '5px' }}>Parallel</Tag>
                                            )}
                                            {item.isOrdered && (
                                                <Tag color="green" style={{ marginLeft: '5px' }}>Ordered</Tag>
                                            )}
                                            {item.scanDirection && (
                                                <Tag color="cyan" style={{ marginLeft: '5px' }}>
                                                    {item.scanDirection} Scan
                                                </Tag>
                                            )}
                                            {/* Cost impact indicator */}
                                            {item.totalSubtreeCost / maxCost > 0.5 && item.totalSubtreeCost > 1.0 && (
                                                <Tag color="red" style={{ marginLeft: '5px' }}>
                                                    Critical Cost
                                                </Tag>
                                            )}
                                            {item.totalSubtreeCost / maxCost > 0.5 && item.totalSubtreeCost <= 1.0 && item.totalSubtreeCost > 0.1 && (
                                                <Tag color="orange" style={{ marginLeft: '5px' }}>
                                                    High Impact
                                                </Tag>
                                            )}
                                            {item.totalSubtreeCost / maxCost > 0.25 && item.totalSubtreeCost / maxCost <= 0.5 && item.totalSubtreeCost > 0.1 && (
                                                <Tag color="orange" style={{ marginLeft: '5px' }}>
                                                    Significant Impact
                                                </Tag>
                                            )}
                                        </div>
                                        <div>
                                            <strong>Logical Operation:</strong> 
                                            <Tag color="cyan" style={{ marginLeft: '5px' }}>
                                                {(() => {
                                                    // Operasyon tipine göre ikon ekle
                                                    const op = item.logicalOp.toLowerCase();
                                                    let icon = null;
                                                    
                                                    if (op.includes('scan')) {
                                                        icon = '🔍'; // Tarama operasyonları
                                                    } else if (op.includes('sort')) {
                                                        icon = '↕️'; // Sıralama operasyonları
                                                    } else if (op.includes('join')) {
                                                        icon = '🔄'; // Join operasyonları
                                                    } else if (op.includes('index')) {
                                                        icon = '📇'; // İndeks operasyonları
                                                    } else if (op.includes('hash')) {
                                                        icon = '📊'; // Hash operasyonları
                                                    } else if (op.includes('aggregate')) {
                                                        icon = '📋'; // Aggregate operasyonları
                                                    } else if (op.includes('filter')) {
                                                        icon = '🔎'; // Filtreleme operasyonları
                                                    } else if (op.includes('compute')) {
                                                        icon = '🧮'; // Hesaplama operasyonları
                                                    } else if (op.includes('update')) {
                                                        icon = '✏️'; // Güncelleme operasyonları
                                                    } else if (op.includes('delete')) {
                                                        icon = '🗑️'; // Silme operasyonları
                                                    } else if (op.includes('insert')) {
                                                        icon = '➕'; // Ekleme operasyonları
                                                    } else if (op.includes('split')) {
                                                        icon = '✂️'; // Bölme operasyonları
                                                    } else if (op.includes('assert')) {
                                                        icon = '✓'; // Assert operasyonları
                                                    } else if (op.includes('stream')) {
                                                        icon = '➡️'; // Stream operasyonları
                                                    }
                                                    
                                                    return icon ? <span style={{ marginRight: '5px' }}>{icon}</span> : null;
                                                })()}
                                                {item.logicalOp}
                                            </Tag>
                                        </div>
                                        {item.objectName && (
                                            <div>
                                                <strong>Object:</strong> 
                                                <Tag color="gold" style={{ marginLeft: '5px' }}>
                                                    <span style={{ marginRight: '5px' }}>📄</span>
                                                    {item.objectName}
                                                </Tag>
                                            </div>
                                        )}
                                        {item.indexName && (
                                            <div>
                                                <strong>Index:</strong> 
                                                <Tag color="geekblue" style={{ marginLeft: '5px' }}>
                                                    <span style={{ marginRight: '5px' }}>📇</span>
                                                    {item.indexName}
                                                </Tag>
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div>
                                            <strong>Estimated Rows:</strong> 
                                            <span style={{ marginLeft: '5px' }}>{item.estimateRows.toLocaleString()}</span>
                                            {item.actualRows !== undefined && (
                                                <>
                                                    <span style={{ 
                                                        marginLeft: '5px',
                                                        color: item.actualRows > item.estimateRows * 2 ? '#ff4d4f' : 
                                                              item.actualRows < item.estimateRows / 2 ? '#faad14' : 
                                                              '#52c41a'
                                                    }}>
                                                        (Actual: {item.actualRows.toLocaleString()})
                                                    </span>
                                                    
                                                    {/* Row estimation indicator */}
                                                    <span style={{ marginLeft: '5px' }}>
                                                        {item.actualRows > item.estimateRows * 2 && 
                                                            <Tooltip title={`Underestimated by ${Math.round(item.actualRows / item.estimateRows)}x`}>
                                                                <Tag color="red" style={{ padding: '0 4px' }}>↑ {Math.round(item.actualRows / item.estimateRows)}x</Tag>
                                                            </Tooltip>
                                                        }
                                                        {item.actualRows < item.estimateRows / 2 && 
                                                            <Tooltip title={`Overestimated by ${Math.round(item.estimateRows / item.actualRows)}x`}>
                                                                <Tag color="orange" style={{ padding: '0 4px' }}>↓ {Math.round(item.estimateRows / item.actualRows)}x</Tag>
                                                            </Tooltip>
                                                        }
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                        {item.estimatedRowSize !== undefined && (
                                            <div>
                                                <strong>Row Size:</strong> 
                                                <span style={{ marginLeft: '5px' }}>{item.estimatedRowSize} bytes</span>
                                            </div>
                                        )}
                                        <div>
                                            <strong>Total Subtree Cost:</strong> 
                                            <span style={{ 
                                                color: getCostColor(item.totalSubtreeCost, maxCost), 
                                                marginLeft: '5px',
                                                fontWeight: 'bold' 
                                            }}>
                                                {item.totalSubtreeCost.toFixed(6)}
                                            </span>
                                            <Tooltip title={
                                                <div>
                                                    <p>Cost metrics are SQL Server's internal estimates used to compare operations.</p>
                                                    <p>Higher costs might indicate performance bottlenecks, but low absolute costs (under 1.0) are typically fast operations even if they're 100% of the plan cost.</p>
                                                    <ul style={{ paddingLeft: '15px', margin: '5px 0' }}>
                                                        <li>IO Cost: {item.estimateIO.toFixed(6)}</li>
                                                        <li>CPU Cost: {item.estimateCPU.toFixed(6)}</li>
                                                        <li>% of Total Plan: {Math.round((item.totalSubtreeCost / maxCost) * 100)}%</li>
                                                    </ul>
                                                </div>
                                            }>
                                                <span style={{ marginLeft: '5px', color: '#1890ff', cursor: 'help' }}>ℹ️</span>
                                            </Tooltip>
                                        </div>
                                        <Tooltip title={`CPU: ${item.estimateCPU.toFixed(6)}, IO: ${item.estimateIO.toFixed(6)}`}>
                                            <div style={{ marginTop: '8px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                                    <div style={{ width: '40px', fontSize: '12px' }}>Cost:</div>
                                                    <Progress 
                                                        percent={Math.round((item.totalSubtreeCost / maxCost) * 100)} 
                                                        size="small" 
                                                        showInfo={false}
                                                        strokeColor={getCostColor(item.totalSubtreeCost, maxCost)}
                                                        style={{ flex: 1 }}
                                                    />
                                                    <div style={{ 
                                                        marginLeft: '8px', 
                                                        fontSize: '11px', 
                                                        color: '#888',
                                                        whiteSpace: 'nowrap'
                                                    }}>
                                                        {Math.round((item.totalSubtreeCost / maxCost) * 100)}% of max
                                                    </div>
                                                </div>
                                                
                                                {/* IO ve CPU dağılımı */}
                                                {(item.estimateIO > 0 || item.estimateCPU > 0) && (
                                                    <div style={{ marginTop: '5px', display: 'flex', fontSize: '11px', color: '#888' }}>
                                                        <div style={{ width: '40px' }}>IO/CPU:</div>
                                                        <div style={{ flex: 1, display: 'flex' }}>
                                                            {/* IO bar */}
                                                            <Tooltip title={`IO: ${item.estimateIO.toFixed(6)}`}>
                                                                <div 
                                                                    style={{ 
                                                                        flex: item.estimateIO / (item.estimateIO + item.estimateCPU + 0.000001), 
                                                                        height: '6px', 
                                                                        backgroundColor: '#1890ff',
                                                                        borderRadius: '3px 0 0 3px'
                                                                    }}
                                                                />
                                                            </Tooltip>
                                                            
                                                            {/* CPU bar */}
                                                            <Tooltip title={`CPU: ${item.estimateCPU.toFixed(6)}`}>
                                                                <div 
                                                                    style={{ 
                                                                        flex: item.estimateCPU / (item.estimateIO + item.estimateCPU + 0.000001), 
                                                                        height: '6px', 
                                                                        backgroundColor: '#52c41a',
                                                                        borderRadius: '0 3px 3px 0'
                                                                    }}
                                                                />
                                                            </Tooltip>
                                                        </div>
                                                        <div style={{ 
                                                            marginLeft: '8px',
                                                            whiteSpace: 'nowrap' 
                                                        }}>
                                                            IO: {Math.round((item.estimateIO / (item.estimateIO + item.estimateCPU + 0.000001)) * 100)}%
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </Tooltip>
                                    </div>
                                </div>
                                {item.predicate && (
                                    <div style={{ 
                                        marginTop: '8px', 
                                        backgroundColor: '#f5f5f5', 
                                        padding: '8px 12px',
                                        borderRadius: '4px',
                                        fontSize: '12px',
                                        borderLeft: '3px solid #1890ff'
                                    }}>
                                        <div style={{ 
                                            display: 'flex', 
                                            alignItems: 'center',
                                            marginBottom: '4px',
                                            color: '#1890ff',
                                            fontWeight: 'bold'
                                        }}>
                                            <span style={{ marginRight: '5px' }}>🔎</span>
                                            <span>Predicate/Filter:</span>
                                        </div>
                                        <div style={{ 
                                            fontFamily: 'Consolas, Monaco, monospace',
                                            whiteSpace: 'pre-wrap',
                                            wordBreak: 'break-word',
                                            padding: '4px 0'
                                        }}>
                                            {/* SQL predicate formatlaması için - koşul bileşenlerini renklendir */}
                                            {(() => {
                                                // Basit bir SQL sözdizimi vurgulaması
                                                let formattedPredicate = item.predicate;
                                                
                                                // Operatörleri vurgula
                                                formattedPredicate = formattedPredicate
                                                    .replace(/(\s+AND\s+|\s+OR\s+|\s+NOT\s+)/gi, 
                                                        (match: string) => `<span style="color: #ff4d4f; font-weight: bold;">${match}</span>`);
                                                
                                                // Karşılaştırma operatörlerini vurgula
                                                formattedPredicate = formattedPredicate
                                                    .replace(/(\s*[=<>!]+\s*)/g, 
                                                        (match: string) => `<span style="color: #722ed1;">${match}</span>`);
                                                
                                                // Fonksiyonları vurgula
                                                formattedPredicate = formattedPredicate
                                                    .replace(/([A-Za-z0-9_]+\()/g, 
                                                        (match: string) => `<span style="color: #1890ff;">${match}</span>`);
                                                
                                                // Parantezleri vurgula
                                                formattedPredicate = formattedPredicate
                                                    .replace(/(\))/g, 
                                                        (match: string) => `<span style="color: #1890ff;">${match}</span>`);
                                                
                                                // Sayıları vurgula
                                                formattedPredicate = formattedPredicate
                                                    .replace(/\b(\d+(\.\d+)?)\b/g, 
                                                        (match: string) => `<span style="color: #52c41a;">${match}</span>`);
                                                
                                                // String değerleri vurgula
                                                formattedPredicate = formattedPredicate
                                                    .replace(/('.*?')/g, 
                                                        (match: string) => `<span style="color: #faad14;">${match}</span>`);
                                                
                                                return <div dangerouslySetInnerHTML={{ __html: formattedPredicate }} />;
                                            })()}
                                        </div>
                                    </div>
                                )}
                            </Card>
                        </List.Item>
                    )}
                />
            </div>
        </div>
    );
};

// Execution Plan Summary Component
export const ExecutionPlanSummary: React.FC<{xmlPlan: string}> = ({ xmlPlan }) => {
    const [planSummary, setPlanSummary] = useState<any>({
        queryHash: '',
        planHash: '',
        estimatedRows: 0,
        statementType: '',
        usedIndexes: [],
        cachingInfo: { cached: false, size: 0 },
        parallelism: 0,
        warningFlags: [],
        missingIndexes: [],
        executionStats: {
            actualRows: 0,
            executionTime: 0,
            cpuTime: 0,
            elapsedTime: 0,
            logicalReads: 0,
            physicalReads: 0,
            rowSize: 0
        }
    });
    
    // Extract summary information from XML plan
    useEffect(() => {
        if (!xmlPlan) return;
        
        try {
            // Check if the input is a JSON object or string
            let planContent = xmlPlan;
            try {
                // If it's a string that represents a JSON object
                if (typeof xmlPlan === 'string' && (xmlPlan.trim().startsWith('{') || xmlPlan.trim().startsWith('{'))) {
                    const jsonObj = JSON.parse(xmlPlan);
                    if (jsonObj.plan) {
                        planContent = jsonObj.plan;
                    } else if (jsonObj.result?.value) {
                        // Handle base64 encoded values from API response
                        try {
                            const decodedValue = atob(jsonObj.result.value);
                            const parsedResult = JSON.parse(decodedValue);
                            if (parsedResult.plan) {
                                planContent = parsedResult.plan;
                            }
                        } catch (base64Error) {
                            console.warn('Could not decode base64 value (summary):', base64Error);
                        }
                    }
                }
            } catch (parseError) {
                console.warn('Input is not a JSON object, treating as XML string (summary)');
            }
            
            // First decode the XML if it's escaped
            const decodedXml = decodeXmlString(planContent);
            
            const summary: any = {
                queryHash: '',
                planHash: '',
                estimatedRows: 0,
                statementType: '',
                usedIndexes: [],
                cachingInfo: { cached: false, size: 0 },
                parallelism: 0,
                warningFlags: [],
                missingIndexes: [],
                executionStats: {
                    actualRows: 0,
                    executionTime: 0,
                    cpuTime: 0,
                    elapsedTime: 0,
                    logicalReads: 0,
                    physicalReads: 0,
                    rowSize: 0
                }
            };
            
            // Extract all estimated rows from RelOp nodes to find the root operation
            const allEstRowsMatches = Array.from(decodedXml.matchAll(/EstimateRows="([^"]+)"/gi));
            if (allEstRowsMatches.length > 0) {
                // Take the largest value, which is likely the root operation's estimated rows
                const maxEstRows = Math.max(...allEstRowsMatches.map(match => parseFloat(match[1])));
                summary.estimatedRows = maxEstRows;
            }
            
            // Get statement information - try different formats
            const stmtMatch = decodedXml.match(/StatementType="([^"]+)"/i) || 
                              decodedXml.match(/StatementText[^>]+>([^<]+)/i);
            if (stmtMatch) {
                summary.statementType = stmtMatch[1];
            }
            
            // Extract actual statement text
            const stmtTextMatch = decodedXml.match(/StatementText="([^"]+)"/i);
            if (stmtTextMatch) {
                // Use this as statement type if we don't already have one
                if (!summary.statementType) {
                    const text = stmtTextMatch[1].trim();
                    const firstWord = text.split(' ')[0].toUpperCase();
                    summary.statementType = firstWord || 'SELECT'; // Default to SELECT if we can't determine
                }
            }
            
            // Get DOP information
            const dopMatch = decodedXml.match(/(?:DegreeOfParallelism|MaxDOP)="([^"]+)"/i);
            if (dopMatch) {
                summary.parallelism = parseInt(dopMatch[1]);
            }
            
            // Get hash values - try different attribute names that may exist in various MSSQL versions
            const queryHashMatch = decodedXml.match(/(?:QueryHash|PlanGuid)="([^"]+)"/i);
            if (queryHashMatch) {
                summary.queryHash = queryHashMatch[1];
            }
            
            const planHashMatch = decodedXml.match(/(?:QueryPlanHash|PlanHash)="([^"]+)"/i);
            if (planHashMatch) {
                summary.planHash = planHashMatch[1];
            }
            
            // Get estimated rows information from multiple possible locations
            const estRowsMatch = decodedXml.match(/(?:StatementEstRows|EstimateRows)="([^"]+)"/i) ||
                                decodedXml.match(/<StmtSimple.*?StatementEstRows="([^"]+)"/i);
            if (estRowsMatch) {
                summary.estimatedRows = parseFloat(estRowsMatch[1]);
            }
            
            // Try to get actual rows from RunTimeInformation
            const actualRowsMatch = decodedXml.match(/ActualRows="([^"]+)"/i);
            if (actualRowsMatch) {
                summary.executionStats.actualRows = parseInt(actualRowsMatch[1]);
            }
            
            // Try to get row size
            const rowSizeMatch = decodedXml.match(/AvgRowSize="([^"]+)"/i);
            if (rowSizeMatch) {
                summary.executionStats.rowSize = parseInt(rowSizeMatch[1]);
            }
            
            // Try to get logical reads
            const logicalReadsMatch = decodedXml.match(/ActualLogicalReads="([^"]+)"/i);
            if (logicalReadsMatch) {
                summary.executionStats.logicalReads = parseInt(logicalReadsMatch[1]);
            }
            
            // Try to get physical reads
            const physicalReadsMatch = decodedXml.match(/ActualPhysicalReads="([^"]+)"/i);
            if (physicalReadsMatch) {
                summary.executionStats.physicalReads = parseInt(physicalReadsMatch[1]);
            }
            
            // Get execution time information
            const execTimeMatch = decodedXml.match(/(?:ExecutionTime|ElapsedTime)="([^"]+)"/i);
            if (execTimeMatch) {
                summary.executionStats.executionTime = parseFloat(execTimeMatch[1]);
            }
            
            // Get CPU time information
            const cpuTimeMatch = decodedXml.match(/(?:CpuTime)="([^"]+)"/i);
            if (cpuTimeMatch) {
                summary.executionStats.cpuTime = parseFloat(cpuTimeMatch[1]);
            }
            
            // Try to get elapsed time
            const elapsedTimeMatch = decodedXml.match(/(?:ElapsedTime)="([^"]+)"/i);
            if (elapsedTimeMatch) {
                summary.executionStats.elapsedTime = parseFloat(elapsedTimeMatch[1]);
            }
            
            // Try to get estimated rows from first RelOp if not found above
            if (summary.estimatedRows === 0) {
                const firstRelOpRowsMatch = decodedXml.match(/<RelOp.*?EstimateRows="([^"]+)"/i);
                if (firstRelOpRowsMatch) {
                    summary.estimatedRows = parseFloat(firstRelOpRowsMatch[1]);
                }
            }
            
            // Get caching information
            const cachedMatch = decodedXml.match(/(?:RetrievedFromCache|FromCache)="([^"]+)"/i);
            if (cachedMatch) {
                summary.cachingInfo.cached = cachedMatch[1].toLowerCase() === 'true';
            }
            
            const cacheSizeMatch = decodedXml.match(/(?:CachedPlanSize|CompileCPU)="([^"]+)"/i);
            if (cacheSizeMatch) {
                summary.cachingInfo.size = parseInt(cacheSizeMatch[1]);
            }
            
            // Check warning flags - look for different types of warnings
            if (decodedXml.match(/(?:MissingIndex|<MissingIndexes>)/i)) {
                summary.warningFlags.push('Missing indexes detected');
                summary.missingIndexes = []; // Initialize missing indexes array
                
                // Extract missing index details with full context
                const missingIndexGroupMatches = decodedXml.matchAll(/<MissingIndexGroup[^>]*Impact="([^"]*)"[^>]*>([\s\S]*?)<\/MissingIndexGroup>/g);
                
                for (const groupMatch of Array.from(missingIndexGroupMatches)) {
                    const impact = parseFloat(groupMatch[1] || '0');
                    const groupContent = groupMatch[2];
                    
                    // Extract individual missing indexes within this group
                    const missingIndexMatches = groupContent.matchAll(/<MissingIndex[^>]*Database="([^"]*)"[^>]*Schema="([^"]*)"[^>]*Table="([^"]*)"[^>]*>([\s\S]*?)<\/MissingIndex>/g);
                    
                    for (const indexMatch of Array.from(missingIndexMatches)) {
                        const database = indexMatch[1].replace(/[\[\]]/g, '');
                        const schema = indexMatch[2].replace(/[\[\]]/g, '');
                        const table = indexMatch[3].replace(/[\[\]]/g, '');
                        const indexContent = indexMatch[4];
                        
                        // Extract column groups
                        const equalityColumns: string[] = [];
                        const inequalityColumns: string[] = [];
                        const includedColumns: string[] = [];
                        
                        // Parse EQUALITY columns
                        const equalityGroupMatch = indexContent.match(/<ColumnGroup[^>]*Usage="EQUALITY"[^>]*>([\s\S]*?)<\/ColumnGroup>/);
                        if (equalityGroupMatch) {
                            const equalityMatches = equalityGroupMatch[1].matchAll(/<Column[^>]*Name="\[?([^\]"]+)\]?"[^>]*\/>/g);
                            for (const colMatch of Array.from(equalityMatches)) {
                                equalityColumns.push(colMatch[1]);
                            }
                        }
                        
                        // Parse INEQUALITY columns
                        const inequalityGroupMatch = indexContent.match(/<ColumnGroup[^>]*Usage="INEQUALITY"[^>]*>([\s\S]*?)<\/ColumnGroup>/);
                        if (inequalityGroupMatch) {
                            const inequalityMatches = inequalityGroupMatch[1].matchAll(/<Column[^>]*Name="\[?([^\]"]+)\]?"[^>]*\/>/g);
                            for (const colMatch of Array.from(inequalityMatches)) {
                                inequalityColumns.push(colMatch[1]);
                            }
                        }
                        
                        // Parse INCLUDE columns
                        const includeGroupMatch = indexContent.match(/<ColumnGroup[^>]*Usage="INCLUDE"[^>]*>([\s\S]*?)<\/ColumnGroup>/);
                        if (includeGroupMatch) {
                            const includeMatches = includeGroupMatch[1].matchAll(/<Column[^>]*Name="\[?([^\]"]+)\]?"[^>]*\/>/g);
                            for (const colMatch of Array.from(includeMatches)) {
                                includedColumns.push(colMatch[1]);
                            }
                        }
                        
                        // Create missing index object
                        const missingIndex = {
                            database,
                            schema,
                            table,
                            impact,
                            equalityColumns,
                            inequalityColumns,
                            includedColumns,
                            createScript: generateCreateIndexScript(database, schema, table, equalityColumns, inequalityColumns, includedColumns, impact)
                        };
                        
                        summary.missingIndexes.push(missingIndex);
                        
                        // Add warning message
                        const allKeyColumns = [...equalityColumns, ...inequalityColumns];
                        if (allKeyColumns.length > 0) {
                            summary.warningFlags.push(`Consider adding index on ${schema}.${table} (${allKeyColumns.join(', ')})${includedColumns.length > 0 ? ` INCLUDE (${includedColumns.join(', ')})` : ''} - Impact: ${impact.toFixed(1)}%`);
                        }
                    }
                }
            }
            
            if (decodedXml.match(/(?:SpillToTempDb|TempDbSpills)/i)) {
                summary.warningFlags.push('Spill to TempDB detected');
                
                // Try to extract spill details
                const spillMatch = decodedXml.match(/SpillToTempDb="([^"]+)"/i);
                if (spillMatch) {
                    const spillSize = spillMatch[1];
                    summary.warningFlags.push(`Spill size: ${spillSize}`);
                }
            }
            
            if (decodedXml.match(/Warnings="(?:true|1)"/i) || decodedXml.includes('<Warnings>')) {
                summary.warningFlags.push('Plan contains warnings');
                
                // Try to extract specific warnings
                const warningMatches = decodedXml.matchAll(/<Warnings?>([\s\S]*?)<\/Warnings?>/gi);
                for (const match of Array.from(warningMatches)) {
                    if (match[1]) {
                        const warningText = match[1].trim();
                        if (warningText) {
                            summary.warningFlags.push(`Warning detail: ${warningText}`);
                        }
                    }
                }
                
                // Check for specific warning types
                if (decodedXml.match(/ColumnsWithNoStatistics/i)) {
                    const statsColumns = decodedXml.match(/<ColumnsWithNoStatistics>([\s\S]*?)<\/ColumnsWithNoStatistics>/i);
                    if (statsColumns && statsColumns[1]) {
                        const columnRefs = Array.from(statsColumns[1].matchAll(/<ColumnReference.*?Column="([^"]+)".*?Table="([^"]+)"/gi));
                        for (const colRef of columnRefs) {
                            summary.warningFlags.push(`No statistics for column: ${colRef[2]}.${colRef[1]}`);
                        }
                    } else {
                        summary.warningFlags.push('Columns with no statistics');
                    }
                }
                
                // Check for unmatched indexes
                if (decodedXml.match(/UnmatchedIndexes/i)) {
                    summary.warningFlags.push('Unmatched indexes are present');
                }
            }
            
            if (decodedXml.match(/(?:NoJoinPredicate|UnmatchedIndexes)/i)) {
                summary.warningFlags.push('Join issues detected');
                
                // Extract more details about join issues
                const noJoinMatch = decodedXml.match(/NoJoinPredicate="([^"]+)"/i);
                if (noJoinMatch && noJoinMatch[1] === "true") {
                    summary.warningFlags.push('Cartesian join (no join predicate) detected');
                }
            }
            
            // Check for plan guide usage
            if (decodedXml.match(/PlanGuideDB=/i)) {
                const planGuideMatch = decodedXml.match(/PlanGuideDB="([^"]+)".*?PlanGuideName="([^"]+)"/i);
                if (planGuideMatch) {
                    summary.warningFlags.push(`Plan guide used: ${planGuideMatch[1]}.${planGuideMatch[2]}`);
                }
            }
            
            // Check for forced serialization
            if (decodedXml.match(/NonParallelPlanReason=/i)) {
                const reasonMatch = decodedXml.match(/NonParallelPlanReason="([^"]+)"/i);
                if (reasonMatch) {
                    summary.warningFlags.push(`Parallel plan prevented: ${reasonMatch[1]}`);
                }
            }
            
            // Check for parameterization issues
            if (decodedXml.match(/ParameterizationProblems/i)) {
                summary.warningFlags.push('Parameterization problems detected');
            }
            
            // Check for memory grant issues
            if (decodedXml.match(/MemoryGrantWarning/i)) {
                summary.warningFlags.push('Memory grant warning');
            }
            
            // Check for estimated vs actual row mismatches
            if (summary.executionStats.actualRows > 0 && summary.estimatedRows > 0) {
                const ratio = summary.executionStats.actualRows / summary.estimatedRows;
                if (ratio > 100) {
                    summary.warningFlags.push(`Severe row estimation error: Actual rows (${summary.executionStats.actualRows.toLocaleString()}) is 100x higher than estimated (${summary.estimatedRows.toLocaleString()})`);
                } else if (ratio > 10) {
                    summary.warningFlags.push(`Significant row underestimation: Actual rows (${summary.executionStats.actualRows.toLocaleString()}) is ${Math.round(ratio)}x higher than estimated (${summary.estimatedRows.toLocaleString()})`);
                } else if (ratio < 0.01) {
                    summary.warningFlags.push(`Severe row overestimation: Actual rows (${summary.executionStats.actualRows.toLocaleString()}) is 100x lower than estimated (${summary.estimatedRows.toLocaleString()})`);
                } else if (ratio < 0.1) {
                    summary.warningFlags.push(`Significant row overestimation: Actual rows (${summary.executionStats.actualRows.toLocaleString()}) is ${Math.round(1/ratio)}x lower than estimated (${summary.estimatedRows.toLocaleString()})`);
                }
            }
            
            // Find used indexes - various patterns for different MSSQL versions
            let usedIndexes: Array<{name: string, kind: string}> = [];
            
            // Try pattern 1: Object elements with Index attribute
            const indexMatches = decodedXml.matchAll(/<Object[^>]*Index="([^"]+)"[^>]*IndexKind="([^"]+)"[^>]*>/g);
            for (const match of Array.from(indexMatches)) {
                usedIndexes.push({
                    name: match[1],
                    kind: match[2]
                });
            }
            
            // Try pattern 2: IndexScan elements
            const indexScanMatches = decodedXml.matchAll(/<IndexScan[^>]*>[\s\S]*?<Object[^>]*Index="([^"]+)"[\s\S]*?<\/IndexScan>/g);
            for (const match of Array.from(indexScanMatches)) {
                // If we already have this index from pattern 1, skip it
                if (!usedIndexes.some(idx => idx.name === match[1])) {
                    const kindMatch = match[0].match(/Lookup="([^"]+)"/);
                    usedIndexes.push({
                        name: match[1],
                        kind: kindMatch ? kindMatch[1] : 'NonClustered'
                    });
                }
            }
            
            // Try pattern 3: SeekPredicates elements
            if (usedIndexes.length === 0) {
                const seekMatches = decodedXml.matchAll(/<SeekPredicates>[\s\S]*?<ColumnReference[^>]*Table="([^"]+)"[\s\S]*?<\/SeekPredicates>/g);
                for (const match of Array.from(seekMatches)) {
                    usedIndexes.push({
                        name: match[1] + ' (Implicit)',
                        kind: 'Unknown'
                    });
                }
            }
            
            // Special case for Clustered Index Scan without explicit index attribute
            const clusteredScanMatch = decodedXml.match(/<RelOp.*?PhysicalOp="Clustered Index Scan".*?<Object.*?Table="\[([^\]]+)\]".*?>/i);
            if (clusteredScanMatch && usedIndexes.length === 0) {
                // Add the clustered index
                const indexMatch = decodedXml.match(/Index="\[([^\]]+)\]"/i);
                const indexName = indexMatch ? indexMatch[1] : ('PK_' + clusteredScanMatch[1].replace(/[\[\]]/g, ''));
                
                usedIndexes.push({
                    name: indexName,
                    kind: 'Clustered'
                });
            }
            
            summary.usedIndexes = usedIndexes;
        
            
            // Update state
            setPlanSummary(summary);
        } catch (error) {
            console.error('Error parsing execution plan for summary:', error);
            // Keep default state values on error
        }
    }, [xmlPlan]);
    
    if (!xmlPlan) {
        return <Alert message="No execution plan data available" type="info" showIcon />;
    }
    
    return (
        <div>
            <Row gutter={[16, 16]}>
                <Col span={24}>
                    <Card title="Plan Overview" bordered={false}>
                        <Descriptions bordered size="small" column={2}>
                            <Descriptions.Item label="Statement Type">{planSummary.statementType || 'Unknown'}</Descriptions.Item>
                            <Descriptions.Item label="Degree of Parallelism">{planSummary.parallelism}</Descriptions.Item>
                            <Descriptions.Item label="Estimated Rows">{planSummary.estimatedRows.toLocaleString()}</Descriptions.Item>
                            {planSummary.executionStats.actualRows > 0 && (
                                <Descriptions.Item label="Actual Rows">
                                    <span style={{
                                        color: planSummary.executionStats.actualRows > planSummary.estimatedRows * 2 ? '#ff4d4f' :
                                            planSummary.executionStats.actualRows < planSummary.estimatedRows / 2 ? '#faad14' :
                                                '#52c41a'
                                    }}>
                                        {planSummary.executionStats.actualRows.toLocaleString()}
                                    </span>
                                </Descriptions.Item>
                            )}
                            {planSummary.executionStats.rowSize > 0 && (
                                <Descriptions.Item label="Avg Row Size">{planSummary.executionStats.rowSize} bytes</Descriptions.Item>
                            )}
                            <Descriptions.Item label="Retrieved from Cache">
                                {planSummary.cachingInfo.cached ? (
                                    <Tag color="green">Yes</Tag>
                                ) : (
                                    <Tag color="orange">No</Tag>
                                )}
                            </Descriptions.Item>
                            <Descriptions.Item label="Query Hash">{planSummary.queryHash || 'N/A'}</Descriptions.Item>
                            <Descriptions.Item label="Plan Hash">{planSummary.planHash || 'N/A'}</Descriptions.Item>
                        </Descriptions>
                    </Card>
                </Col>
                
                {/* Execution Statistics */}
                {(planSummary.executionStats.executionTime > 0 || 
                 planSummary.executionStats.cpuTime > 0 ||
                 planSummary.executionStats.logicalReads > 0) && (
                    <Col span={24}>
                        <Card title="Execution Statistics" bordered={false}>
                            <Descriptions bordered size="small" column={2}>
                                {planSummary.executionStats.executionTime > 0 && (
                                    <Descriptions.Item label="Execution Time">
                                        {planSummary.executionStats.executionTime.toLocaleString()} ms
                                    </Descriptions.Item>
                                )}
                                {planSummary.executionStats.cpuTime > 0 && (
                                    <Descriptions.Item label="CPU Time">
                                        {planSummary.executionStats.cpuTime.toLocaleString()} ms
                                    </Descriptions.Item>
                                )}
                                {planSummary.executionStats.elapsedTime > 0 && (
                                    <Descriptions.Item label="Elapsed Time">
                                        {planSummary.executionStats.elapsedTime.toLocaleString()} ms
                                    </Descriptions.Item>
                                )}
                                {planSummary.executionStats.logicalReads > 0 && (
                                    <Descriptions.Item label="Logical Reads">
                                        {planSummary.executionStats.logicalReads.toLocaleString()} pages
                                    </Descriptions.Item>
                                )}
                                {planSummary.executionStats.physicalReads > 0 && (
                                    <Descriptions.Item label="Physical Reads">
                                        {planSummary.executionStats.physicalReads.toLocaleString()} pages
                                    </Descriptions.Item>
                                )}
                            </Descriptions>
                        </Card>
                    </Col>
                )}
                
                {/* Missing Index Recommendations */}
                {planSummary.missingIndexes && planSummary.missingIndexes.length > 0 && (
                    <Col span={24}>
                        <Card title="Missing Index Recommendations" bordered={false}>
                            <List
                                dataSource={planSummary.missingIndexes}
                                renderItem={(missingIndex: any, index: number) => (
                                    <List.Item
                                        actions={[
                                            <Button
                                                key="copy"
                                                type="primary"
                                                size="small"
                                                icon={<CopyOutlined />}
                                                onClick={() => {
                                                    navigator.clipboard.writeText(missingIndex.createScript);
                                                    message.success('CREATE INDEX script copied to clipboard');
                                                }}
                                            >
                                                Copy Script
                                            </Button>,
                                            <Button
                                                key="view"
                                                type="default"
                                                size="small"
                                                icon={<CodeOutlined />}
                                                onClick={() => {
                                                    Modal.info({
                                                        title: `CREATE INDEX Script - ${missingIndex.schema}.${missingIndex.table}`,
                                                        content: (
                                                            <div>
                                                                <pre style={{
                                                                    backgroundColor: '#f6f8fa',
                                                                    padding: '16px',
                                                                    borderRadius: '4px',
                                                                    fontSize: '12px',
                                                                    fontFamily: 'Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace',
                                                                    whiteSpace: 'pre-wrap',
                                                                    maxHeight: '400px',
                                                                    overflow: 'auto'
                                                                }}>
                                                                    {missingIndex.createScript}
                                                                </pre>
                                                                <Button
                                                                    type="primary"
                                                                    icon={<CopyOutlined />}
                                                                    onClick={() => {
                                                                        navigator.clipboard.writeText(missingIndex.createScript);
                                                                        message.success('Script copied to clipboard');
                                                                    }}
                                                                    style={{ marginTop: '12px' }}
                                                                >
                                                                    Copy to Clipboard
                                                                </Button>
                                                            </div>
                                                        ),
                                                        width: 800,
                                                        okText: 'Close'
                                                    });
                                                }}
                                            >
                                                View Script
                                            </Button>
                                        ]}
                                    >
                                        <List.Item.Meta
                                            title={
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <Tag color="orange">Impact: {missingIndex.impact.toFixed(1)}%</Tag>
                                                    <span style={{ fontWeight: 'bold' }}>
                                                        {missingIndex.schema}.{missingIndex.table}
                                                    </span>
                                                </div>
                                            }
                                            description={
                                                <div style={{ marginTop: '8px' }}>
                                                    <div style={{ marginBottom: '4px' }}>
                                                        <strong>Key Columns:</strong> {[...missingIndex.equalityColumns, ...missingIndex.inequalityColumns].join(', ')}
                                                    </div>
                                                    {missingIndex.includedColumns.length > 0 && (
                                                        <div style={{ marginBottom: '4px' }}>
                                                            <strong>Include Columns:</strong> {missingIndex.includedColumns.join(', ')}
                                                        </div>
                                                    )}
                                                    <div style={{ fontSize: '12px', color: '#666' }}>
                                                        Database: {missingIndex.database}
                                                    </div>
                                                </div>
                                            }
                                        />
                                    </List.Item>
                                )}
                            />
                        </Card>
                    </Col>
                )}
                
                {planSummary.warningFlags.length > 0 && (
                    <Col span={24}>
                        <Card title="Warnings and Recommendations" bordered={false}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {/* Group warnings by category */}
                                {(() => {
                                    // Categorize warnings
                                    const indexWarnings = planSummary.warningFlags.filter((w: string) => 
                                        w.includes('index') || w.includes('Index')
                                    );
                                    
                                    const estimationWarnings = planSummary.warningFlags.filter((w: string) => 
                                        w.includes('estimation') || w.includes('Actual rows')
                                    );
                                    
                                    const tempdbWarnings = planSummary.warningFlags.filter((w: string) => 
                                        w.includes('TempDB') || w.includes('Spill')
                                    );
                                    
                                    const joinWarnings = planSummary.warningFlags.filter((w: string) => 
                                        w.includes('join') || w.includes('Join')
                                    );
                                    
                                    const otherWarnings = planSummary.warningFlags.filter((w: string) => 
                                        !indexWarnings.includes(w) && 
                                        !estimationWarnings.includes(w) &&
                                        !tempdbWarnings.includes(w) &&
                                        !joinWarnings.includes(w)
                                    );
                                    
                                    return (
                                        <>
                                            {indexWarnings.length > 0 && (
                                                <Alert
                                                    message="Index Recommendations"
                                                    description={
                                                        <ul style={{ margin: '8px 0 0 0', paddingLeft: '16px' }}>
                                                            {indexWarnings.map((warning: string, idx: number) => (
                                                                <li key={idx} style={{ marginBottom: '4px' }}>{warning}</li>
                                                            ))}
                                                        </ul>
                                                    }
                                                    type="info"
                                                    showIcon
                                                />
                                            )}
                                            
                                            {estimationWarnings.length > 0 && (
                                                <Alert
                                                    message="Cardinality Estimation Issues"
                                                    description={
                                                        <ul style={{ margin: '8px 0 0 0', paddingLeft: '16px' }}>
                                                            {estimationWarnings.map((warning: string, idx: number) => (
                                                                <li key={idx} style={{ marginBottom: '4px' }}>{warning}</li>
                                                            ))}
                                                        </ul>
                                                    }
                                                    type="warning"
                                                    showIcon
                                                />
                                            )}
                                            
                                            {tempdbWarnings.length > 0 && (
                                                <Alert
                                                    message="TempDB Spills"
                                                    description={
                                                        <ul style={{ margin: '8px 0 0 0', paddingLeft: '16px' }}>
                                                            {tempdbWarnings.map((warning: string, idx: number) => (
                                                                <li key={idx} style={{ marginBottom: '4px' }}>{warning}</li>
                                                            ))}
                                                        </ul>
                                                    }
                                                    type="error"
                                                    showIcon
                                                />
                                            )}
                                            
                                            {joinWarnings.length > 0 && (
                                                <Alert
                                                    message="Join Operation Issues"
                                                    description={
                                                        <ul style={{ margin: '8px 0 0 0', paddingLeft: '16px' }}>
                                                            {joinWarnings.map((warning: string, idx: number) => (
                                                                <li key={idx} style={{ marginBottom: '4px' }}>{warning}</li>
                                                            ))}
                                                        </ul>
                                                    }
                                                    type="warning"
                                                    showIcon
                                                />
                                            )}
                                            
                                            {otherWarnings.length > 0 && (
                                                <Alert
                                                    message="Other Warnings"
                                                    description={
                                                        <ul style={{ margin: '8px 0 0 0', paddingLeft: '16px' }}>
                                                            {otherWarnings.map((warning: string, idx: number) => (
                                                                <li key={idx} style={{ marginBottom: '4px' }}>{warning}</li>
                                                            ))}
                                                        </ul>
                                                    }
                                                    type="warning"
                                                    showIcon
                                                />
                                            )}
                                        </>
                                    );
                                })()}
                            </div>
                        </Card>
                    </Col>
                )}
                
                {planSummary.usedIndexes.length > 0 && (
                    <Col span={24}>
                        <Card title="Indexes Used" bordered={false}>
                            <List
                                dataSource={planSummary.usedIndexes}
                                renderItem={(index: {name: string, kind: string}) => (
                                    <List.Item>
                                        <div>
                                            <Tag color={
                                                index.kind === 'Clustered' ? 'blue' : 
                                                index.kind === 'NonClustered' ? 'green' :
                                                index.kind === 'Columnstore' ? 'purple' : 'default'
                                            }>
                                                {index.kind}
                                            </Tag>
                                            <span style={{ marginLeft: '8px' }}>{index.name}</span>
                                        </div>
                                    </List.Item>
                                )}
                            />
                        </Card>
                    </Col>
                )}
                
                {planSummary.usedIndexes.length === 0 && planSummary.warningFlags.length === 0 && (
                    <Col span={24}>
                        <Alert
                            message="Limited Plan Information"
                            description="This execution plan contains limited metadata. For a more detailed analysis, copy the XML and paste it into SQL Server Management Studio."
                            type="info"
                            showIcon
                        />
                    </Col>
                )}
            </Row>
        </div>
    );
}; 