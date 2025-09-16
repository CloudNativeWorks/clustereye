// AWS Configuration for RDS Monitoring Integration

export interface AWSRegionConfig {
    region: string;
    displayName: string;
    default?: boolean;
}

export interface RDSEngineConfig {
    engine: string;
    displayName: string;
    supportedVersions: string[];
}

// AWS Regions commonly used for RDS
export const AWS_REGIONS: AWSRegionConfig[] = [
    { region: 'us-east-1', displayName: 'US East (N. Virginia)', default: true },
    { region: 'us-east-2', displayName: 'US East (Ohio)' },
    { region: 'us-west-1', displayName: 'US West (N. California)' },
    { region: 'us-west-2', displayName: 'US West (Oregon)' },
    { region: 'eu-west-1', displayName: 'Europe (Ireland)' },
    { region: 'eu-west-2', displayName: 'Europe (London)' },
    { region: 'eu-central-1', displayName: 'Europe (Frankfurt)' },
    { region: 'ap-southeast-1', displayName: 'Asia Pacific (Singapore)' },
    { region: 'ap-southeast-2', displayName: 'Asia Pacific (Sydney)' },
    { region: 'ap-northeast-1', displayName: 'Asia Pacific (Tokyo)' },
];

// Supported SQL Server engines on RDS
export const RDS_SQL_SERVER_ENGINES: RDSEngineConfig[] = [
    {
        engine: 'sqlserver-se',
        displayName: 'SQL Server Standard Edition',
        supportedVersions: ['2019', '2022']
    },
    {
        engine: 'sqlserver-ee',
        displayName: 'SQL Server Enterprise Edition',
        supportedVersions: ['2019', '2022']
    },
    {
        engine: 'sqlserver-ex',
        displayName: 'SQL Server Express Edition',
        supportedVersions: ['2019', '2022']
    },
    {
        engine: 'sqlserver-web',
        displayName: 'SQL Server Web Edition',
        supportedVersions: ['2019', '2022']
    }
];

// CloudWatch metrics refresh intervals (in seconds)
export const CLOUDWATCH_REFRESH_INTERVALS = [
    { value: 60, label: '1 minute' },
    { value: 300, label: '5 minutes' },
    { value: 900, label: '15 minutes' },
    { value: 1800, label: '30 minutes' },
    { value: 3600, label: '1 hour' }
];

// Default CloudWatch metrics to collect
export const DEFAULT_CLOUDWATCH_METRICS = [
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

// Performance thresholds for alerting
export const PERFORMANCE_THRESHOLDS = {
    cpuUtilization: {
        warning: 70,
        critical: 85
    },
    freeableMemory: {
        warningPercent: 20,
        criticalPercent: 10
    },
    connections: {
        warningPercent: 80,
        criticalPercent: 95
    },
    readLatency: {
        warning: 0.01, // 10ms
        critical: 0.05  // 50ms
    },
    writeLatency: {
        warning: 0.01, // 10ms
        critical: 0.05  // 50ms
    }
};

export default {
    AWS_REGIONS,
    RDS_SQL_SERVER_ENGINES,
    CLOUDWATCH_REFRESH_INTERVALS,
    DEFAULT_CLOUDWATCH_METRICS,
    PERFORMANCE_THRESHOLDS
};