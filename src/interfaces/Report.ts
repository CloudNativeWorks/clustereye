export interface Report {
    id: string;
    name: string;
    description: string;
    schedule: {
        frequency: 'daily' | 'weekly' | 'monthly' | 'on_demand';
        time: string;  // HH:mm format
        days?: number[];  // For weekly/monthly reports
    };
    delivery: {
        type: 'email' | 'slack' | 'download';
        destination: string;  // email address or slack channel
    };
    content: {
        type: 'comprehensive' | 'system_performance' | 'database_analysis' | 'capacity_planning' | 'alarms_summary';
        timeRange: {
            type: 'relative' | 'absolute';
            relative?: '1h' | '1d' | '7d' | '30d';
            absolute?: {
                startDate: string;
                endDate: string;
            };
        };
        clusters: string[]; // Selected cluster/agent IDs
        sections: {
            systemMetrics: boolean;
            diskAnalysis: boolean;
            mongoAnalysis?: {
                enabled: boolean;
                includeCollections: boolean;
                includeIndexes: boolean;
                includePerformance: boolean;
            };
            postgresAnalysis?: {
                enabled: boolean;
                includeBloat: boolean;
                includeSlowQueries: boolean;
                includeConnections: boolean;
            };
            mssqlAnalysis?: {
                enabled: boolean;
                includeCapacityPlanning: boolean;
                includePerformance: boolean;
            };
            alarmsAnalysis: boolean;
            recommendations: boolean;
        };
        format: 'pdf' | 'excel' | 'both';
    };
    lastGenerated?: string;  // ISO date string
    nextScheduled: string;   // ISO date string
    status: 'active' | 'paused';
    createdAt: string;      // ISO date string
    updatedAt: string;      // ISO date string
}

export interface ReportHistory {
    id: string;
    reportId: string;
    generatedAt: string;    // ISO date string
    status: 'success' | 'failed';
    fileUrl?: string;       // URL to download the PDF
    error?: string;         // Error message if status is 'failed'
} 