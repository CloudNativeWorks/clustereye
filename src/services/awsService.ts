// AWS CloudWatch API integration service

export interface AWSCredentials {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    sessionToken?: string;
}

export interface CloudWatchMetric {
    timestamp: string;
    value: number;
    unit: string;
}

export interface RDSMetricsResponse {
    status: string;
    data: CloudWatchMetric[];
    message?: string;
}

export interface RDSInstanceInfo {
    DBInstanceIdentifier: string;
    DBInstanceClass: string;
    Engine: string;
    EngineVersion: string;
    DBInstanceStatus: string;
    MasterUsername?: string;
    Endpoint: {
        Address: string;
        Port: number;
    };
    AllocatedStorage: number;
    StorageType: string;
    MultiAZ: boolean;
    AvailabilityZone: string;
    PubliclyAccessible?: boolean;
    StorageEncrypted?: boolean;
    DBSubnetGroup: {
        VpcId: string;
        SubnetGroupStatus: string;
    };
}

class AWSService {
    private baseUrl: string;

    constructor() {
        this.baseUrl = import.meta.env.VITE_REACT_APP_API_URL;
    }

    // Test AWS credentials
    async testAWSCredentials(credentials: AWSCredentials): Promise<{success: boolean, error?: string}> {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${this.baseUrl}/api/v1/aws/test-credentials`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                credentials: 'include',
                body: JSON.stringify(credentials)
            });

            if (!response.ok) {
                const errorData = await response.json();
                return { 
                    success: false, 
                    error: errorData.error || `HTTP ${response.status}: ${response.statusText}` 
                };
            }

            const data = await response.json();
            return { success: data.success || true };
        } catch (error) {
            console.error('Error testing AWS credentials:', error);
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'Unknown error occurred' 
            };
        }
    }

    // Fetch RDS instances from AWS
    async fetchRDSInstances(region: string, credentials?: AWSCredentials): Promise<RDSInstanceInfo[]> {
        try {
            const token = localStorage.getItem('token');
            const requestBody = credentials ? { region, credentials } : { region };
            
            const response = await fetch(`${this.baseUrl}/api/v1/aws/rds/instances`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                credentials: 'include',
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch RDS instances: ${response.statusText}`);
            }

            const data = await response.json();
            return data.instances || [];
        } catch (error) {
            console.error('Error fetching RDS instances:', error);
            throw error;
        }
    }

    // Fetch CloudWatch metrics for RDS instance
    async fetchRDSMetrics(
        instanceId: string, 
        metricName: string, 
        region: string, 
        timeRange: string = '1h',
        credentials?: AWSCredentials
    ): Promise<RDSMetricsResponse> {
        try {
            const token = localStorage.getItem('token');
            const requestBody = {
                instanceId,
                metricName,
                region,
                range: timeRange,
                ...(credentials && { credentials })
            };
            
            const response = await fetch(`${this.baseUrl}/api/v1/aws/cloudwatch/metrics`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                credentials: 'include',
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch CloudWatch metrics: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching CloudWatch metrics:', error);
            throw error;
        }
    }

    // Fetch multiple RDS metrics in parallel
    async fetchMultipleRDSMetrics(
        instanceId: string, 
        region: string, 
        timeRange: string = '1h',
        credentials?: AWSCredentials
    ): Promise<{[key: string]: CloudWatchMetric[]}> {
        const metrics = [
            'CPUUtilization',
            'DatabaseConnections',
            'FreeableMemory',
            'FreeStorageSpace',
            'ReadIOPS',
            'WriteIOPS',
            'ReadLatency',
            'WriteLatency',
            'ReadThroughput',
            'WriteThroughput'
        ];

        try {
            const promises = metrics.map(metric => 
                this.fetchRDSMetrics(instanceId, metric, region, timeRange, credentials)
            );

            const results = await Promise.allSettled(promises);
            const metricsData: {[key: string]: CloudWatchMetric[]} = {};

            results.forEach((result, index) => {
                if (result.status === 'fulfilled' && result.value.status === 'success') {
                    metricsData[metrics[index]] = result.value.data;
                } else {
                    console.warn(`Failed to fetch ${metrics[index]}:`, result);
                    metricsData[metrics[index]] = [];
                }
            });

            return metricsData;
        } catch (error) {
            console.error('Error fetching multiple RDS metrics:', error);
            throw error;
        }
    }

    // Execute SQL query on RDS instance via RDS Data API
    async executeRDSQuery(
        instanceId: string, 
        region: string, 
        query: string, 
        database: string = 'master'
    ): Promise<any> {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${this.baseUrl}/api/v1/aws/rds/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                credentials: 'include',
                body: JSON.stringify({
                    instanceId,
                    region,
                    database,
                    query
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to execute RDS query: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error executing RDS query:', error);
            throw error;
        }
    }

    // Check RDS instance connectivity
    async checkRDSConnectivity(instanceId: string, region: string): Promise<boolean> {
        try {
            const response = await this.executeRDSQuery(
                instanceId, 
                region, 
                'SELECT 1 as test_connection'
            );
            return response.status === 'success';
        } catch (error) {
            console.error('RDS connectivity check failed:', error);
            return false;
        }
    }

    // Get saved RDS instances from database
    async getSavedRDSInstances(): Promise<any[]> {
        try {
            const response = await fetch(`${this.baseUrl}/api/v1/aws/rds/instances`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            const result = await response.json();
            
            if (result.success) {
                return result.data || [];
            } else {
                throw new Error(result.error || 'Failed to fetch saved RDS instances');
            }
        } catch (error) {
            console.error('Error fetching saved RDS instances:', error);
            throw error;
        }
    }

    // Get RDS Performance Insights metrics
    async fetchPerformanceInsights(
        instanceId: string, 
        region: string, 
        timeRange: string = '1h'
    ): Promise<any> {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(
                `${this.baseUrl}/api/v1/aws/performance-insights?` +
                `instanceId=${instanceId}&region=${region}&range=${timeRange}`, 
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    },
                    credentials: 'include'
                }
            );

            if (!response.ok) {
                throw new Error(`Failed to fetch Performance Insights: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching Performance Insights:', error);
            throw error;
        }
    }
}

export const awsService = new AWSService();
export default awsService;