export interface NodeType {
    nodename?: string;
    Hostname?: string;
    ClusterName?: string;
    replsetname?: string;
    status?: "PRIMARY" | "MASTER" | "SECONDARY" | "SLAVE" | "FAILED";
    NodeStatus?: "PRIMARY" | "MASTER" | "SECONDARY" | "SLAVE" | "FAILED";
    dc?: string;
    DC?: string;
    Location?: string;
    freediskpercent?: number;
    FDPercent?: number;
    freediskdata?: string; // MongoDB disk alanı
    FreeDisk?: string; // PostgreSQL disk alanı
    dbType?: "MongoDB" | "PostgreSQL" | "MSSQL"; // Hangi veri tabanı tipi
    MongoStatus?: string; // MongoDB service status
    PGServiceStatus?: string; // PostgreSQL service status
    Status?: string; // MSSQL service status
    ReplicationLagSec?: number; // Replication lag in seconds
    IP?: string; // IP address
    port?: string | number; // Port number
    Port?: string; // Port number for MSSQL
    AgentID?: string; // Agent ID for node identification
    DataDirectory?: string; // PostgreSQL data directory
    DataPath?: string; // Data path for database files
    HARole?: string; // MSSQL HA role
    Edition?: string; // MSSQL edition
    Version?: string; // MSSQL version
    MongoVersion?: string; // MongoDB version
    PGVersion?: string; // PostgreSQL version
    Instance?: string; // MSSQL instance name
    // Patroni related properties for PostgreSQL
    PatroniRole?: string; // Patroni role
    PatroniState?: string; // Patroni state
    PatroniCluster?: string; // Patroni cluster name
    PatroniEnabled?: boolean; // Patroni enabled flag
    PatroniRestAPI?: number; // Patroni REST API port
    PatroniDetection?: string; // Patroni detection information
    IsHAEnabled?: boolean; // MSSQL HA enabled flag
    Database?: string; // MSSQL database name
    // AWS RDS related properties
    IsAWSRDS?: boolean; // AWS RDS instance flag
    AWSRegion?: string; // AWS region
    RDSInstanceId?: string; // RDS instance identifier
    RDSEndpoint?: string; // RDS endpoint
    RDSInstanceClass?: string; // RDS instance class (db.t3.large, etc.)
    RDSEngine?: string; // RDS engine (sqlserver-se, sqlserver-ex, etc.)
    RDSEngineVersion?: string; // RDS engine version
    RDSMultiAZ?: boolean; // Multi-AZ deployment
    RDSStorageType?: string; // Storage type (gp2, io1, etc.)
    RDSAllocatedStorage?: number; // Allocated storage in GB
    AlwaysOnMetrics?: {
        Replicas: Array<{
            Role: string;
            JoinState: string;
            ReplicaName: string;
            FailoverMode: string;
            SuspendReason: string;
            ConnectedState: boolean;
            ConnectionState: string;
            AvailabilityMode: string;
            SynchronizationMode: string;
        }>;
        Databases: Array<{
            EndOfLogLsn: string;
            RecoveryLsn: string;
            RedoQueueKb: number;
            ReplicaName: string;
            DatabaseName: string;
            LastSentTime: string;
            LastCommitLsn: string;
            SuspendReason: string;
            TruncationLsn: string;
            LastCommitTime: string;
            LastRedoneTime: string;
            LogSendQueueKb: number;
            LastHardenedTime: string;
            LastReceivedTime: string;
            RedoRateKbPerSec: number;
            LogSendRateKbPerSec: number;
            SynchronizationState: string;
        }>;
        LocalRole: string;
        ClusterName: string;
        HealthState: string;
        RedoQueueKb: number;
        FailoverMode: string;
        LogSendQueueKb: number;
        PrimaryReplica: string;
        LastFailoverTime: string;
        OperationalState: string;
        ReplicationLagMs: number;
        SynchronizationMode: string;
        Listeners?: Array<{
            Port: number;
            DnsName: string;
            SubnetMask: string;
            IpAddresses: string[] | null;
            ListenerName: string;
            ListenerState: string;
        }>;
    }; // MSSQL Always On Availability Groups metrics
}

  
  
export type DashboardData = {
    mongodb: NodeType[];
    postgresql: NodeType[];
    mssql: NodeType[];
};
  
  