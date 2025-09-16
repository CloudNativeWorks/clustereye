import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, Button, message, Steps, Card, Alert, Spin } from 'antd';
import { CloudOutlined, DatabaseOutlined, CheckCircleOutlined } from '@ant-design/icons';
import awsService, { RDSInstanceInfo } from '../services/awsService';
import awsConfig from '../config/awsConfig';

const { AWS_REGIONS } = awsConfig;

const { Step } = Steps;
const { Option } = Select;

interface AddAWSRDSModalProps {
    visible: boolean;
    onCancel: () => void;
    onSuccess: (rdsInstance: any, credentials: any) => void;
}

const AddAWSRDSModal: React.FC<AddAWSRDSModalProps> = ({ visible, onCancel, onSuccess }) => {
    const [form] = Form.useForm();
    const [currentStep, setCurrentStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [selectedRegion, setSelectedRegion] = useState('us-east-1');
    const [availableInstances, setAvailableInstances] = useState<RDSInstanceInfo[]>([]);
    const [selectedInstance, setSelectedInstance] = useState<RDSInstanceInfo | null>(null);
    const [testingConnection, setTestingConnection] = useState(false);
    const [awsCredentials, setAwsCredentials] = useState({
        accessKeyId: '',
        secretAccessKey: '',
        region: 'us-east-1',
        sessionToken: '' // Optional for temporary credentials
    });
    // const [credentialsValid, setCredentialsValid] = useState(false); // Not used anymore
    const [testingCredentials, setTestingCredentials] = useState(false);
    const [sqlCredentials, setSqlCredentials] = useState({
        username: '',
        password: ''
    });
    const [connectionTested, setConnectionTested] = useState(false);

    // Reset form when modal opens/closes
    useEffect(() => {
        if (visible) {
            form.resetFields();
            setCurrentStep(0);
            setSelectedInstance(null);
            setAvailableInstances([]);

            setConnectionTested(false);
            setAwsCredentials({
                accessKeyId: '',
                secretAccessKey: '',
                region: 'us-east-1',
                sessionToken: ''
            });
            setSqlCredentials({
                username: '',
                password: ''
            });
        }
    }, [visible, form]);

    // Test AWS credentials
    const testAWSCredentials = async () => {
        if (!awsCredentials.accessKeyId || !awsCredentials.secretAccessKey) {
            message.error('Please enter AWS Access Key ID and Secret Access Key');
            return;
        }

        try {
            setTestingCredentials(true);
            
            // Test credentials by making a simple AWS API call
            const testResult = await awsService.testAWSCredentials(awsCredentials);
            
            if (testResult.success) {

                setCurrentStep(1);
                message.success('AWS credentials verified successfully!');
                
                // Auto-fetch instances for default region
                fetchRDSInstances(awsCredentials.region);
            } else {
                message.error(testResult.error || 'Invalid AWS credentials');
    
            }
        } catch (error) {
            console.error('Credentials test failed:', error);
            message.error('Failed to verify AWS credentials. Please check your credentials.');

        } finally {
            setTestingCredentials(false);
        }
    };

    // Fetch RDS instances for selected region
    const fetchRDSInstances = async (region: string) => {
        try {
            setLoading(true);
            const instances = await awsService.fetchRDSInstances(region, awsCredentials);
            
            // Filter only SQL Server instances
            const sqlServerInstances = instances.filter(instance => 
                instance.Engine.startsWith('sqlserver')
            );
            
            setAvailableInstances(sqlServerInstances);
            
            if (sqlServerInstances.length === 0) {
                message.warning(`No SQL Server RDS instances found in ${region}`);
            } else {
                message.success(`Found ${sqlServerInstances.length} SQL Server instances in ${region}`);
            }
        } catch (error) {
            console.error('Error fetching RDS instances:', error);
            message.error('Failed to fetch RDS instances. Please check your AWS credentials.');
        } finally {
            setLoading(false);
        }
    };

    // Test SQL Server connection
    const testConnection = async () => {
        if (!selectedInstance || !sqlCredentials.username || !sqlCredentials.password) return;

        try {
            setTestingConnection(true);
            
            // Test SQL Server connection with credentials
            const connectionData = {
                endpoint: selectedInstance.Endpoint?.Address,
                port: selectedInstance.Endpoint?.Port,
                username: sqlCredentials.username,
                password: sqlCredentials.password,
                database: 'master' // Default database for connection test
            };
            
            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/aws/rds/test-connection`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(connectionData)
            });
            
            const result = await response.json();
            
            if (result.success) {
                message.success('Successfully connected to SQL Server!');
                setConnectionTested(true);
            } else {
                message.error(`Connection failed: ${result.error || 'Unknown error'}`);
                setConnectionTested(false);
            }
        } catch (error) {
            console.error('Connection test failed:', error);
            message.error('Connection test failed. Please verify your credentials.');
            setConnectionTested(false);
        } finally {
            setTestingConnection(false);
        }
    };

    // Handle region change
    const handleRegionChange = (region: string) => {
        setSelectedRegion(region);
        setAvailableInstances([]);
        setSelectedInstance(null);
        form.setFieldsValue({ instanceId: undefined });
        
        // Auto-fetch instances for new region
        fetchRDSInstances(region);
    };

    // Handle instance selection
    const handleInstanceSelect = (instanceId: string) => {
        const instance = availableInstances.find(inst => 
            inst.DBInstanceIdentifier === instanceId
        );
        setSelectedInstance(instance || null);
        
                    if (instance) {
                // Auto-populate form fields
                form.setFieldsValue({
                    displayName: `${instance.DBInstanceIdentifier} (${selectedRegion})`,
                    endpoint: instance.Endpoint?.Address,
                    port: instance.Endpoint?.Port,
                    engine: instance.Engine,
                    engineVersion: instance.EngineVersion,
                    instanceClass: instance.DBInstanceClass,
                    multiAZ: instance.MultiAZ ? 'Yes' : 'No',
                    storageType: instance.StorageType,
                    allocatedStorage: instance.AllocatedStorage
                });
                setCurrentStep(2);
            }
    };

    // Handle form submission
    const handleSubmit = async () => {
        try {
            setLoading(true);
            const values = await form.validateFields();
            
            if (!selectedInstance || !connectionTested) {
                message.error('Please complete all steps and test the connection');
                return;
            }

            // Prepare data to save to database
            const rdsData = {
                jsondata: {
                    // AWS RDS Instance Information
                    DBInstanceIdentifier: selectedInstance.DBInstanceIdentifier,
                    DBInstanceClass: selectedInstance.DBInstanceClass,
                    Engine: selectedInstance.Engine,
                    EngineVersion: selectedInstance.EngineVersion,
                    DBInstanceStatus: selectedInstance.DBInstanceStatus,
                    MasterUsername: selectedInstance.MasterUsername,
                    AllocatedStorage: selectedInstance.AllocatedStorage,
                    StorageType: selectedInstance.StorageType,
                    MultiAZ: selectedInstance.MultiAZ,
                    AvailabilityZone: selectedInstance.AvailabilityZone,
                    PubliclyAccessible: selectedInstance.PubliclyAccessible,
                    StorageEncrypted: selectedInstance.StorageEncrypted,
                    Endpoint: selectedInstance.Endpoint,
                    
                    // Connection Information
                    sqlCredentials: {
                        username: sqlCredentials.username,
                        password: sqlCredentials.password // In production, this should be encrypted
                    },
                    
                    // AWS Credentials (for CloudWatch access) - will be encrypted by backend
                    awsCredentials: {
                        accessKeyId: awsCredentials.accessKeyId,
                        secretAccessKey: awsCredentials.secretAccessKey,
                        region: awsCredentials.region,
                        sessionToken: awsCredentials.sessionToken
                    },
                    
                    // Display Information
                    displayName: values.displayName,
                    createdAt: new Date().toISOString()
                },
                clustername: selectedInstance.DBInstanceIdentifier,
                region: selectedRegion,
                aws_account_id: null // Will be populated by backend if available
            };

            // Save to database via API
            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/aws/rds/save`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(rdsData)
            });

            const result = await response.json();

            if (result.success) {
                // Create node object for frontend display
                const rdsNode = {
                    nodename: values.displayName,
                    Hostname: selectedInstance.DBInstanceIdentifier,
                    dbType: 'MSSQL',
                    IsAWSRDS: true,
                    AWSRegion: selectedRegion,
                    RDSInstanceId: selectedInstance.DBInstanceIdentifier,
                    RDSEndpoint: selectedInstance.Endpoint?.Address,
                    RDSInstanceClass: selectedInstance.DBInstanceClass,
                    RDSEngine: selectedInstance.Engine,
                    RDSEngineVersion: selectedInstance.EngineVersion,
                    RDSMultiAZ: selectedInstance.MultiAZ,
                    RDSStorageType: selectedInstance.StorageType,
                    RDSAllocatedStorage: selectedInstance.AllocatedStorage,
                    Port: selectedInstance.Endpoint?.Port?.toString(),
                    Status: selectedInstance.DBInstanceStatus,
                    IP: selectedInstance.Endpoint?.Address,
                    Location: selectedRegion,
                    DC: selectedRegion,
                    // Store database ID for future reference
                    databaseId: result.data?.id
                };

                onSuccess(rdsNode, awsCredentials);
                message.success('AWS RDS SQL Server instance saved successfully!');
                onCancel();
            } else {
                throw new Error(result.error || 'Failed to save RDS instance');
            }
        } catch (error) {
            console.error('Error saving RDS instance:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            message.error(`Failed to save RDS instance: ${errorMessage}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title={
                <span>
                    <CloudOutlined style={{ marginRight: 8, color: '#1890ff' }} />
                    Add AWS RDS SQL Server Instance
                </span>
            }
            visible={visible}
            onCancel={onCancel}
            width={800}
            footer={null}
            destroyOnClose
        >
            <Steps current={currentStep} style={{ marginBottom: 24 }}>
                <Step title="AWS Credentials" icon={<CloudOutlined />} />
                <Step title="Select Region & Instance" icon={<DatabaseOutlined />} />
                <Step title="Configure Details" icon={<DatabaseOutlined />} />
                <Step title="SQL Server Connection" icon={<DatabaseOutlined />} />
                <Step title="Test & Save" icon={<CheckCircleOutlined />} />
            </Steps>

            <Form form={form} layout="vertical">
                {/* Step 0: AWS Credentials */}
                {currentStep === 0 && (
                    <Card title="Enter AWS Credentials">
                        <Alert
                            message="AWS Credentials Required"
                            description="Please enter your AWS credentials to access your RDS instances. These credentials are only used for this session and are not stored."
                            type="info"
                            showIcon
                            style={{ marginBottom: 16 }}
                        />
                        
                        <Form.Item
                            label="AWS Access Key ID"
                            rules={[{ required: true, message: 'Please enter AWS Access Key ID' }]}
                        >
                            <Input.Password
                                placeholder="AKIAIOSFODNN7EXAMPLE"
                                value={awsCredentials.accessKeyId}
                                onChange={(e) => setAwsCredentials({
                                    ...awsCredentials,
                                    accessKeyId: e.target.value
                                })}
                                visibilityToggle
                            />
                        </Form.Item>

                        <Form.Item
                            label="AWS Secret Access Key"
                            rules={[{ required: true, message: 'Please enter AWS Secret Access Key' }]}
                        >
                            <Input.Password
                                placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                                value={awsCredentials.secretAccessKey}
                                onChange={(e) => setAwsCredentials({
                                    ...awsCredentials,
                                    secretAccessKey: e.target.value
                                })}
                                visibilityToggle
                            />
                        </Form.Item>

                        <Form.Item
                            label="AWS Region"
                            rules={[{ required: true, message: 'Please select AWS region' }]}
                        >
                            <Select
                                placeholder="Select AWS Region"
                                value={awsCredentials.region}
                                onChange={(value) => setAwsCredentials({
                                    ...awsCredentials,
                                    region: value
                                })}
                            >
                                {AWS_REGIONS.map(region => (
                                    <Option key={region.region} value={region.region}>
                                        {region.displayName} ({region.region})
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>

                        <Form.Item label="Session Token (Optional)">
                            <Input.Password
                                placeholder="For temporary credentials (optional)"
                                value={awsCredentials.sessionToken}
                                onChange={(e) => setAwsCredentials({
                                    ...awsCredentials,
                                    sessionToken: e.target.value
                                })}
                                visibilityToggle
                            />
                        </Form.Item>

                        <div style={{ marginTop: 24, textAlign: 'center' }}>
                            <Button
                                type="primary"
                                onClick={testAWSCredentials}
                                loading={testingCredentials}
                                icon={<CloudOutlined />}
                                size="large"
                                disabled={!awsCredentials.accessKeyId || !awsCredentials.secretAccessKey}
                            >
                                Test AWS Credentials
                            </Button>
                        </div>
                    </Card>
                )}

                {/* Step 1: Region & Instance Selection */}
                {currentStep === 1 && (
                    <Card title="Select AWS Region and RDS Instance">
                        <Form.Item
                            label="AWS Region"
                            name="region"
                            rules={[{ required: true, message: 'Please select AWS region' }]}
                            initialValue={selectedRegion}
                        >
                            <Select
                                placeholder="Select AWS Region"
                                onChange={handleRegionChange}
                                loading={loading}
                            >
                                {AWS_REGIONS.map(region => (
                                    <Option key={region.region} value={region.region}>
                                        {region.displayName} ({region.region})
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>

                        <Form.Item
                            label="RDS SQL Server Instance"
                            name="instanceId"
                            rules={[{ required: true, message: 'Please select RDS instance' }]}
                        >
                            <Select
                                placeholder="Select RDS Instance"
                                onChange={handleInstanceSelect}
                                loading={loading}
                                disabled={availableInstances.length === 0}
                                notFoundContent={
                                    loading ? <Spin size="small" /> : 
                                    availableInstances.length === 0 ? 'No SQL Server instances found' : null
                                }
                            >
                                {availableInstances.map(instance => (
                                    <Option key={instance.DBInstanceIdentifier} value={instance.DBInstanceIdentifier}>
                                        <div>
                                            <strong>{instance.DBInstanceIdentifier}</strong>
                                            <br />
                                            <small style={{ color: '#666' }}>
                                                {instance.Engine} {instance.EngineVersion} | {instance.DBInstanceClass} | {instance.DBInstanceStatus}
                                            </small>
                                        </div>
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>

                        {availableInstances.length === 0 && selectedRegion && (
                            <Alert
                                message="No SQL Server RDS instances found"
                                description={`No SQL Server RDS instances were found in ${selectedRegion}. Make sure you have RDS instances running in this region.`}
                                type="info"
                                showIcon
                                style={{ marginTop: 16 }}
                            />
                        )}
                    </Card>
                )}

                {/* Step 2: Instance Details */}
                {currentStep === 2 && selectedInstance && (
                    <Card title="Instance Configuration">
                        <Form.Item
                            label="Display Name"
                            name="displayName"
                            rules={[{ required: true, message: 'Please enter display name' }]}
                        >
                            <Input placeholder="Enter display name for this instance" />
                        </Form.Item>

                        <div style={{ display: 'flex', gap: 16 }}>
                            <Form.Item label="Endpoint" name="endpoint" style={{ flex: 1 }}>
                                <Input disabled />
                            </Form.Item>
                            <Form.Item label="Port" name="port" style={{ width: 100 }}>
                                <Input disabled />
                            </Form.Item>
                        </div>

                        <div style={{ display: 'flex', gap: 16 }}>
                            <Form.Item label="Engine" name="engine" style={{ flex: 1 }}>
                                <Input disabled />
                            </Form.Item>
                            <Form.Item label="Version" name="engineVersion" style={{ flex: 1 }}>
                                <Input disabled />
                            </Form.Item>
                        </div>

                        <div style={{ display: 'flex', gap: 16 }}>
                            <Form.Item label="Instance Class" name="instanceClass" style={{ flex: 1 }}>
                                <Input disabled />
                            </Form.Item>
                            <Form.Item label="Multi-AZ" name="multiAZ" style={{ flex: 1 }}>
                                <Input disabled />
                            </Form.Item>
                        </div>

                        <div style={{ display: 'flex', gap: 16 }}>
                            <Form.Item label="Storage Type" name="storageType" style={{ flex: 1 }}>
                                <Input disabled />
                            </Form.Item>
                            <Form.Item label="Storage (GB)" name="allocatedStorage" style={{ flex: 1 }}>
                                <Input disabled />
                            </Form.Item>
                        </div>

                        <div style={{ marginTop: 24, textAlign: 'center' }}>
                            <Button
                                type="primary"
                                onClick={() => setCurrentStep(3)}
                                icon={<DatabaseOutlined />}
                            >
                                Next: Configure SQL Connection
                            </Button>
                        </div>
                    </Card>
                )}

                {/* Step 3: SQL Server Connection */}
                {currentStep === 3 && (
                    <Card title="SQL Server Connection Credentials">
                        <Alert
                            message="SQL Server Authentication"
                            description="Enter the username and password to connect to your SQL Server instance for monitoring."
                            type="info"
                            showIcon
                            style={{ marginBottom: 16 }}
                        />
                        
                        <Form.Item
                            label="SQL Server Username"
                            rules={[{ required: true, message: 'Please enter SQL Server username' }]}
                        >
                            <Input
                                placeholder="Enter SQL Server username (e.g., sa, admin)"
                                value={sqlCredentials.username}
                                onChange={(e) => setSqlCredentials({
                                    ...sqlCredentials,
                                    username: e.target.value
                                })}
                            />
                        </Form.Item>
                        
                        <Form.Item
                            label="SQL Server Password"
                            rules={[{ required: true, message: 'Please enter SQL Server password' }]}
                        >
                            <Input.Password
                                placeholder="Enter SQL Server password"
                                value={sqlCredentials.password}
                                onChange={(e) => setSqlCredentials({
                                    ...sqlCredentials,
                                    password: e.target.value
                                })}
                            />
                        </Form.Item>
                        
                        <div style={{ marginTop: 24, textAlign: 'center' }}>
                            <Button
                                type="primary"
                                onClick={testConnection}
                                loading={testingConnection}
                                icon={<DatabaseOutlined />}
                                disabled={!sqlCredentials.username || !sqlCredentials.password}
                            >
                                Test SQL Server Connection
                            </Button>
                        </div>
                        
                        {connectionTested && (
                            <Alert
                                message="Connection Test Successful!"
                                description="SQL Server connection is working properly."
                                type="success"
                                showIcon
                                style={{ marginTop: 16 }}
                                action={
                                    <Button
                                        type="primary"
                                        onClick={() => setCurrentStep(4)}
                                    >
                                        Continue
                                    </Button>
                                }
                            />
                        )}
                    </Card>
                )}

                {/* Step 4: Final Review */}
                {currentStep === 4 && (
                    <Card title="Ready to Save">
                        <Alert
                            message="All Tests Successful!"
                            description="The RDS instance is ready to be saved to your monitoring system."
                            type="success"
                            showIcon
                            style={{ marginBottom: 16 }}
                        />
                        
                        <div style={{ textAlign: 'center' }}>
                            <Button
                                type="primary"
                                size="large"
                                onClick={handleSubmit}
                                loading={loading}
                                icon={<CheckCircleOutlined />}
                            >
                                Save RDS Instance
                            </Button>
                        </div>
                    </Card>
                )}
            </Form>

            {/* Navigation Buttons */}
            <div style={{ marginTop: 24, textAlign: 'right' }}>
                <Button onClick={onCancel} style={{ marginRight: 8 }}>
                    Cancel
                </Button>
                {currentStep > 0 && currentStep < 4 && (
                    <Button onClick={() => setCurrentStep(currentStep - 1)}>
                        Previous
                    </Button>
                )}
            </div>
        </Modal>
    );
};

export default AddAWSRDSModal;