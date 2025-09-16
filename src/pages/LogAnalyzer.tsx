import React, { useState, useEffect } from 'react';
import { Radio, Space, Typography, Layout, Menu, Segmented, Row, Col, Badge, Tooltip, Alert, Spin } from 'antd';
import { FileSearchOutlined, SwapOutlined, InfoCircleOutlined } from '@ant-design/icons';
import PostgresQueryAnalyzer from '../PostgresQueryAnalyzer';
import QueryAnalyzer from '../queryAnalyzer';
import axios from 'axios';

const { Title, Text } = Typography;
const { Header, Content } = Layout;

type DatabaseType = 'mongodb' | 'postgresql' | null;

const LogAnalyzer: React.FC = () => {
    const [selectedDatabase, setSelectedDatabase] = useState<DatabaseType>(null);
    const [clusterCounts, setClusterCounts] = useState<{
        mongodb: number;
        postgresql: number;
        mssql: number;
    }>({
        mongodb: 0,
        postgresql: 0,
        mssql: 0
    });
    const [loadingClusters, setLoadingClusters] = useState(true);

    // MongoDB SVG Icon Component
    const MongoDBIcon = () => (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            id="mongodb"
            viewBox="0 0 128 128"
            width="1.6em"
            height="1.6em"
            fill="4FAA41"
            style={{ marginRight: 1, verticalAlign: 'middle' }}
        >
            <path fill="#4FAA41" fillRule="evenodd" d="M90.491 57.282c-.37-4.79-1.496-9.409-3.062-13.934-3.244-10.104-8.45-19.046-15.783-26.74-1.854-1.946-3.916-3.729-5.209-6.151-.818-1.532-1.597-3.085-2.394-4.629l-.505-1.273c-.085.292-.139.396-.142.501-.065 2.517-1.491 4.224-3.267 5.817-1.997 1.793-3.856 3.739-5.775 5.618-1.968 2.588-3.935 5.176-5.901 7.763-1.592 2.925-3.182 5.85-4.772 8.775l-3.19 8.617-.096.134c-1.756 5.768-2.622 11.698-3.048 17.688-.16 2.251.022 4.535.149 6.798.181 3.235.743 6.415 1.586 9.545 3.062 11.372 9.276 20.805 17.771 28.819 1.579 1.489 3.199 2.843 4.847 4.26.282-.965.507-1.93.763-2.895.256-.961.515-1.917.688-2.881-.174.964-.369 1.92-.562 2.881l-.826 2.895.738 2.501.684 3.884.326 4.053c-.003.823-.036 1.648.014 2.47.012.21.288.404.442.606l1.376.483 1.434.558-.246-3.603-.011-3.548.495-5.405.359-1.177 1.027-1.82c1.268-1.02 2.629-1.946 3.784-3.081 2.09-2.054 4.175-4.134 6.045-6.383 2.427-2.917 4.515-6.101 6.191-9.516 1.122-2.284 2.178-4.614 3.052-7.001.77-2.104 1.247-4.315 1.854-6.479.054-.156.126-.309.16-.468 1.254-5.841 1.465-11.741 1.004-17.682zm-23.599 49.375l-.805-1.763.805 1.763 1.183 1.01-1.183-1.01z" clipRule="evenodd"></path>
        </svg>
    );

    // PostgreSQL SVG Icon Component
    const PostgreSQLIcon = () => (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            id="postgresql"
            width="1.4em"
            height="1.4em"
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

    // Fetch cluster data to check counts
    useEffect(() => {
        const fetchClusterData = async () => {
            try {
                setLoadingClusters(true);
                const token = localStorage.getItem('token');
                const response = await axios.get(
                    `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/status/nodeshealth`,
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json',
                            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                        }
                    }
                );

                if (response.data) {
                    // Count clusters based on the new response structure
                    const mongodbClusters = response.data.mongodb ? response.data.mongodb.length : 0;
                    const postgresqlClusters = response.data.postgresql ? response.data.postgresql.length : 0;
                    const mssqlClusters = response.data.mssql ? response.data.mssql.length : 0;

                    setClusterCounts({
                        mongodb: mongodbClusters,
                        postgresql: postgresqlClusters,
                        mssql: mssqlClusters
                    });
                }
            } catch (error) {
                console.error('Error fetching cluster data:', error);
                setClusterCounts({
                    mongodb: 0,
                    postgresql: 0,
                    mssql: 0
                });
            } finally {
                setLoadingClusters(false);
            }
        };

        fetchClusterData();
    }, []);

    const renderAnalyzer = () => {
        // Show info message if both MongoDB and PostgreSQL cluster counts are 0
        if (!loadingClusters && clusterCounts.mongodb === 0 && clusterCounts.postgresql === 0) {
            return (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '48px',
                    minHeight: 'calc(100vh - 300px)'
                }}>
                    <Alert
                        message="Log Analyzer Not Available"
                        description={
                            <div>
                                <p>Log Analyzer currently only supports MongoDB and PostgreSQL databases. 
                                No MongoDB or PostgreSQL clusters were found in your environment.</p>
                                <p>Available clusters in your environment:</p>
                                <ul style={{ textAlign: 'left', marginTop: '8px' }}>
                                    <li>MongoDB Clusters: {clusterCounts.mongodb}</li>
                                    <li>PostgreSQL Clusters: {clusterCounts.postgresql}</li>
                                    <li>MSSQL Clusters: {clusterCounts.mssql} (not supported for log analysis)</li>
                                </ul>
                                {clusterCounts.mssql > 0 && (
                                    <p style={{ marginTop: '12px', fontStyle: 'italic', color: '#666' }}>
                                        Note: MSSQL log analysis will be available in future updates.
                                    </p>
                                )}
                            </div>
                        }
                        type="info"
                        icon={<InfoCircleOutlined />}
                        style={{ 
                            maxWidth: '600px', 
                            textAlign: 'left',
                            marginBottom: '24px'
                        }}
                    />
                    <FileSearchOutlined style={{ fontSize: '64px', color: '#1890ff', marginTop: '24px' }} />
                </div>
            );
        }

        switch (selectedDatabase) {
            case 'mongodb':
                return <QueryAnalyzer />;
            case 'postgresql':
                return <PostgresQueryAnalyzer />;
            default:
                return (
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '48px',
                        minHeight: 'calc(100vh - 200px)'
                    }}>
                        <FileSearchOutlined style={{ fontSize: '64px', color: '#722ed1', marginBottom: '24px' }} />
                        <Title level={2}>Select a Database Type</Title>
                        <Text type="secondary">Choose a database type from the header above to start analyzing logs</Text>
                        {!loadingClusters && (
                            <div style={{ marginTop: '16px', fontSize: '14px', color: '#666' }}>
                                Available: MongoDB ({clusterCounts.mongodb} clusters), PostgreSQL ({clusterCounts.postgresql} clusters)
                            </div>
                        )}
                    </div>
                );
        }
    };

    return (
        <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
            <Header style={{
                background: 'white',
                padding: '0 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid #d9d9d9',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px'
                }}>
                    <Title level={3} style={{ margin: 0, color: '#722ed1' }}>
                        <FileSearchOutlined style={{ marginRight: '8px' }} />
                        Log Analyzer
                    </Title>
                    {loadingClusters && (
                        <Spin size="small" />
                    )}
                </div>

                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px'
                }}>
                    {!loadingClusters && (clusterCounts.mongodb > 0 || clusterCounts.postgresql > 0) && (
                        <>
                            <Segmented
                                value={selectedDatabase || ''}
                                onChange={(value) => setSelectedDatabase(value as DatabaseType)}
                                options={[
                                    ...(clusterCounts.mongodb > 0 ? [{
                                        label: (
                                            <Tooltip title="MongoDB Log Analysis">
                                                <Space>
                                                    <MongoDBIcon />
                                                    <span>MongoDB</span>
                                                    <Badge count={clusterCounts.mongodb} size="small" style={{ backgroundColor: '#52c41a' }} />
                                                </Space>
                                            </Tooltip>
                                        ),
                                        value: 'mongodb'
                                    }] : []),
                                    ...(clusterCounts.postgresql > 0 ? [{
                                        label: (
                                            <Tooltip title="PostgreSQL Log Analysis">
                                                <Space>
                                                    <PostgreSQLIcon />
                                                    <span>PostgreSQL</span>
                                                    <Badge count={clusterCounts.postgresql} size="small" style={{ backgroundColor: '#52c41a' }} />
                                                </Space>
                                            </Tooltip>
                                        ),
                                        value: 'postgresql'
                                    }] : [])
                                ]}
                                style={{
                                    backgroundColor: '#f5f5f5',
                                    padding: '4px'
                                }}
                            />
                        </>
                    )}
                </div>
            </Header>
            <Content style={{ padding: '0' }}>
                {renderAnalyzer()}
            </Content>
        </Layout>
    );
};

export default LogAnalyzer; 