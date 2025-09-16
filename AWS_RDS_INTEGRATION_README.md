# AWS RDS SQL Server Monitoring Integration - Backend Implementation

## Overview
This document describes the backend implementation required to integrate AWS RDS SQL Server monitoring into your existing ClusterEye monitoring system. The integration allows customers to add their AWS RDS SQL Server instances using their own AWS credentials.

## Required Dependencies

### Go
```bash
# AWS SDK
go get github.com/aws/aws-sdk-go-v2/config
go get github.com/aws/aws-sdk-go-v2/service/rds
go get github.com/aws/aws-sdk-go-v2/service/cloudwatch  
go get github.com/aws/aws-sdk-go-v2/service/sts
go get github.com/aws/aws-sdk-go-v2/service/pi
go get github.com/aws/aws-sdk-go-v2/credentials

# Web Framework & Database
go get github.com/gin-gonic/gin
go get github.com/lib/pq  # PostgreSQL driver
go get github.com/denisenkom/go-mssqldb  # SQL Server driver
```

## API Endpoints to Implement

### 1. Test AWS Credentials
**Endpoint:** `POST /api/v1/aws/test-credentials`

**Description:** Validates customer's AWS credentials by making a simple AWS API call.

**Request Body:**
```json
{
    "accessKeyId": "AKIAIOSFODNN7EXAMPLE",
    "secretAccessKey": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    "region": "us-east-1",
    "sessionToken": "optional-session-token"
}
```

**Response:**
```json
{
    "success": true,
    "message": "AWS credentials are valid"
}
```

**Go Implementation:**
```go
package main

import (
    "context"
    "encoding/json"
    "net/http"
    
    "github.com/aws/aws-sdk-go-v2/aws"
    "github.com/aws/aws-sdk-go-v2/config"
    "github.com/aws/aws-sdk-go-v2/credentials"
    "github.com/aws/aws-sdk-go-v2/service/sts"
    "github.com/gin-gonic/gin"
)

type AWSCredentials struct {
    AccessKeyID     string `json:"accessKeyId" binding:"required"`
    SecretAccessKey string `json:"secretAccessKey" binding:"required"`
    Region          string `json:"region" binding:"required"`
    SessionToken    string `json:"sessionToken,omitempty"`
}

type TestCredentialsResponse struct {
    Success bool   `json:"success"`
    Message string `json:"message,omitempty"`
    Error   string `json:"error,omitempty"`
}

// TestAWSCredentials validates AWS credentials
func TestAWSCredentials(c *gin.Context) {
    var creds AWSCredentials
    if err := c.ShouldBindJSON(&creds); err != nil {
        c.JSON(http.StatusBadRequest, TestCredentialsResponse{
            Success: false,
            Error:   "Invalid request format: " + err.Error(),
        })
        return
    }

    // Create AWS config with provided credentials
    cfg, err := config.LoadDefaultConfig(context.TODO(),
        config.WithRegion(creds.Region),
        config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(
            creds.AccessKeyID,
            creds.SecretAccessKey,
            creds.SessionToken,
        )),
    )
    if err != nil {
        c.JSON(http.StatusInternalServerError, TestCredentialsResponse{
            Success: false,
            Error:   "Failed to create AWS config: " + err.Error(),
        })
        return
    }

    // Test credentials with STS GetCallerIdentity
    stsClient := sts.NewFromConfig(cfg)
    _, err = stsClient.GetCallerIdentity(context.TODO(), &sts.GetCallerIdentityInput{})
    if err != nil {
        c.JSON(http.StatusBadRequest, TestCredentialsResponse{
            Success: false,
            Error:   "Invalid AWS credentials: " + err.Error(),
        })
        return
    }

    c.JSON(http.StatusOK, TestCredentialsResponse{
        Success: true,
        Message: "AWS credentials are valid",
    })
}
```

### 2. Fetch RDS Instances
**Endpoint:** `POST /api/v1/aws/rds/instances`

**Description:** Retrieves SQL Server RDS instances from specified AWS region.

**Request Body:**
```json
{
    "region": "us-east-1",
    "credentials": {
        "accessKeyId": "AKIA...",
        "secretAccessKey": "...",
        "sessionToken": "optional"
    }
}
```

**Response:**
```json
{
    "status": "success",
    "instances": [
        {
            "DBInstanceIdentifier": "my-sql-server",
            "DBInstanceClass": "db.t3.large",
            "Engine": "sqlserver-se",
            "EngineVersion": "15.00.4073.23.v1",
            "DBInstanceStatus": "available",
            "Endpoint": {
                "Address": "my-sql-server.xxxxx.us-east-1.rds.amazonaws.com",
                "Port": 1433
            },
            "AllocatedStorage": 100,
            "StorageType": "gp2",
            "MultiAZ": false,
            "AvailabilityZone": "us-east-1a"
        }
    ]
}
```

**Go Implementation:**
```go
import (
    "context"
    "net/http"
    "strings"
    
    "github.com/aws/aws-sdk-go-v2/config"
    "github.com/aws/aws-sdk-go-v2/credentials"
    "github.com/aws/aws-sdk-go-v2/service/rds"
    "github.com/aws/aws-sdk-go-v2/service/rds/types"
    "github.com/gin-gonic/gin"
)

type RDSInstancesRequest struct {
    Region      string         `json:"region" binding:"required"`
    Credentials AWSCredentials `json:"credentials" binding:"required"`
}

type RDSInstancesResponse struct {
    Status    string              `json:"status"`
    Instances []types.DBInstance  `json:"instances,omitempty"`
    Error     string              `json:"error,omitempty"`
}

// GetRDSInstances retrieves SQL Server RDS instances
func GetRDSInstances(c *gin.Context) {
    var req RDSInstancesRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, RDSInstancesResponse{
            Status: "error",
            Error:  "Invalid request format: " + err.Error(),
        })
        return
    }

    // Create AWS config with provided credentials
    cfg, err := config.LoadDefaultConfig(context.TODO(),
        config.WithRegion(req.Region),
        config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(
            req.Credentials.AccessKeyID,
            req.Credentials.SecretAccessKey,
            req.Credentials.SessionToken,
        )),
    )
    if err != nil {
        c.JSON(http.StatusInternalServerError, RDSInstancesResponse{
            Status: "error",
            Error:  "Failed to create AWS config: " + err.Error(),
        })
        return
    }

    // Create RDS client
    rdsClient := rds.NewFromConfig(cfg)

    // Get all DB instances
    result, err := rdsClient.DescribeDBInstances(context.TODO(), &rds.DescribeDBInstancesInput{})
    if err != nil {
        c.JSON(http.StatusInternalServerError, RDSInstancesResponse{
            Status: "error",
            Error:  "Failed to describe DB instances: " + err.Error(),
        })
        return
    }

    // Filter SQL Server instances
    var sqlServerInstances []types.DBInstance
    for _, instance := range result.DBInstances {
        if strings.HasPrefix(*instance.Engine, "sqlserver") {
            sqlServerInstances = append(sqlServerInstances, instance)
        }
    }

    c.JSON(http.StatusOK, RDSInstancesResponse{
        Status:    "success",
        Instances: sqlServerInstances,
    })
}
```

### 3. Fetch CloudWatch Metrics
**Endpoint:** `POST /api/v1/aws/cloudwatch/metrics`

**Description:** Retrieves CloudWatch metrics for RDS instance.

**Request Body:**
```json
{
    "instanceId": "my-sql-server",
    "metricName": "CPUUtilization",
    "region": "us-east-1",
    "range": "1h",
    "credentials": {
        "accessKeyId": "AKIA...",
        "secretAccessKey": "...",
        "sessionToken": "optional"
    }
}
```

**Response:**
```json
{
    "status": "success",
    "data": [
        {
            "timestamp": "2024-01-15T10:00:00Z",
            "value": 45.5,
            "unit": "Percent"
        },
        {
            "timestamp": "2024-01-15T10:05:00Z",
            "value": 42.1,
            "unit": "Percent"
        }
    ]
}
```

**Go Implementation:**
```go
import (
    "context"
    "net/http"
    "sort"
    "time"
    
    "github.com/aws/aws-sdk-go-v2/aws"
    "github.com/aws/aws-sdk-go-v2/config"
    "github.com/aws/aws-sdk-go-v2/credentials"
    "github.com/aws/aws-sdk-go-v2/service/cloudwatch"
    "github.com/aws/aws-sdk-go-v2/service/cloudwatch/types"
    "github.com/gin-gonic/gin"
)

type CloudWatchMetricsRequest struct {
    InstanceID  string         `json:"instanceId" binding:"required"`
    MetricName  string         `json:"metricName" binding:"required"`
    Region      string         `json:"region" binding:"required"`
    Range       string         `json:"range"`
    Credentials AWSCredentials `json:"credentials" binding:"required"`
}

type MetricDataPoint struct {
    Timestamp string  `json:"timestamp"`
    Value     float64 `json:"value"`
    Unit      string  `json:"unit"`
}

type CloudWatchMetricsResponse struct {
    Status string            `json:"status"`
    Data   []MetricDataPoint `json:"data,omitempty"`
    Error  string            `json:"error,omitempty"`
}

// GetCloudWatchMetrics retrieves CloudWatch metrics for RDS instance
func GetCloudWatchMetrics(c *gin.Context) {
    var req CloudWatchMetricsRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, CloudWatchMetricsResponse{
            Status: "error",
            Error:  "Invalid request format: " + err.Error(),
        })
        return
    }

    // Parse time range
    rangeMapping := map[string]time.Duration{
        "10m": 10 * time.Minute,
        "30m": 30 * time.Minute,
        "1h":  1 * time.Hour,
        "6h":  6 * time.Hour,
        "24h": 24 * time.Hour,
        "7d":  7 * 24 * time.Hour,
    }
    
    duration, exists := rangeMapping[req.Range]
    if !exists {
        duration = 1 * time.Hour // default
    }

    // Create AWS config
    cfg, err := config.LoadDefaultConfig(context.TODO(),
        config.WithRegion(req.Region),
        config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(
            req.Credentials.AccessKeyID,
            req.Credentials.SecretAccessKey,
            req.Credentials.SessionToken,
        )),
    )
    if err != nil {
        c.JSON(http.StatusInternalServerError, CloudWatchMetricsResponse{
            Status: "error",
            Error:  "Failed to create AWS config: " + err.Error(),
        })
        return
    }

    // Create CloudWatch client
    cwClient := cloudwatch.NewFromConfig(cfg)

    // Calculate time range
    endTime := time.Now()
    startTime := endTime.Add(-duration)

    // Get metric statistics
    input := &cloudwatch.GetMetricStatisticsInput{
        Namespace:  aws.String("AWS/RDS"),
        MetricName: aws.String(req.MetricName),
        Dimensions: []types.Dimension{
            {
                Name:  aws.String("DBInstanceIdentifier"),
                Value: aws.String(req.InstanceID),
            },
        },
        StartTime:  aws.Time(startTime),
        EndTime:    aws.Time(endTime),
        Period:     aws.Int32(300), // 5 minutes
        Statistics: []types.Statistic{types.StatisticAverage},
    }

    result, err := cwClient.GetMetricStatistics(context.TODO(), input)
    if err != nil {
        c.JSON(http.StatusInternalServerError, CloudWatchMetricsResponse{
            Status: "error",
            Error:  "Failed to get metric statistics: " + err.Error(),
        })
        return
    }

    // Sort datapoints by timestamp
    sort.Slice(result.Datapoints, func(i, j int) bool {
        return result.Datapoints[i].Timestamp.Before(*result.Datapoints[j].Timestamp)
    })

    // Format response
    var dataPoints []MetricDataPoint
    for _, point := range result.Datapoints {
        dataPoints = append(dataPoints, MetricDataPoint{
            Timestamp: point.Timestamp.Format(time.RFC3339),
            Value:     *point.Average,
            Unit:      string(point.Unit),
        })
    }

    c.JSON(http.StatusOK, CloudWatchMetricsResponse{
        Status: "success",
        Data:   dataPoints,
    })
}
```

### 4. Execute RDS Query (Optional)
**Endpoint:** `POST /api/v1/aws/rds/query`

**Description:** Executes SQL queries on RDS instance using RDS Data API.

**Note:** This requires RDS Data API to be enabled on the RDS instance.

**Request Body:**
```json
{
    "instanceId": "my-sql-server",
    "region": "us-east-1",
    "database": "master",
    "query": "SELECT @@VERSION",
    "credentials": {
        "accessKeyId": "AKIA...",
        "secretAccessKey": "...",
        "sessionToken": "optional"
    }
}
```

**Python Implementation:**
```python
@app.route('/api/v1/aws/rds/query', methods=['POST'])
@auth_required
def execute_rds_query():
    try:
        data = request.json
        instance_id = data['instanceId']
        region = data['region']
        database = data.get('database', 'master')
        query = data['query']
        credentials = data['credentials']
        
        # Note: This requires RDS Data API to be enabled
        # and proper resource ARN configuration
        
        session = boto3.Session(
            aws_access_key_id=credentials['accessKeyId'],
            aws_secret_access_key=credentials['secretAccessKey'],
            aws_session_token=credentials.get('sessionToken'),
            region_name=region
        )
        
        rds_data = session.client('rds-data')
        
        # You'll need to construct the resource ARN and secret ARN
        # This is a simplified example
        resource_arn = f"arn:aws:rds:{region}:ACCOUNT_ID:db:{instance_id}"
        secret_arn = f"arn:aws:secretsmanager:{region}:ACCOUNT_ID:secret:rds-db-credentials/{instance_id}"
        
        response = rds_data.execute_statement(
            resourceArn=resource_arn,
            secretArn=secret_arn,
            database=database,
            sql=query
        )
        
        return jsonify({
            'status': 'success',
            'result': response.get('records', [])
        })
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'error': str(e)
        }), 500
```

### 5. Test SQL Server Connection
**Endpoint:** `POST /api/v1/aws/rds/test-connection`

**Description:** Tests SQL Server connection using provided credentials.

**Request Body:**
```json
{
  "endpoint": "test-sql-server.abc123.us-east-1.rds.amazonaws.com",
  "port": 1433,
  "username": "admin",
  "password": "your-password",
  "database": "master"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Connection successful"
}
```

**Go Implementation:**
```go
import (
    "database/sql"
    "fmt"
    
    _ "github.com/denisenkom/go-mssqldb" // SQL Server driver
)

type SQLConnectionRequest struct {
    Endpoint string `json:"endpoint" binding:"required"`
    Port     int    `json:"port" binding:"required"`
    Username string `json:"username" binding:"required"`
    Password string `json:"password" binding:"required"`
    Database string `json:"database" binding:"required"`
}

type SQLConnectionResponse struct {
    Success bool   `json:"success"`
    Message string `json:"message,omitempty"`
    Error   string `json:"error,omitempty"`
}

func TestSQLConnection(c *gin.Context) {
    var req SQLConnectionRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, SQLConnectionResponse{
            Success: false,
            Error:   "Invalid request format: " + err.Error(),
        })
        return
    }

    // Create connection string for SQL Server
    connString := fmt.Sprintf("server=%s;port=%d;database=%s;user id=%s;password=%s;encrypt=true;trustservercertificate=true",
        req.Endpoint, req.Port, req.Database, req.Username, req.Password)

    // Test connection
    db, err := sql.Open("sqlserver", connString)
    if err != nil {
        c.JSON(http.StatusBadRequest, SQLConnectionResponse{
            Success: false,
            Error:   "Failed to create connection: " + err.Error(),
        })
        return
    }
    defer db.Close()

    // Test with a simple query
    err = db.Ping()
    if err != nil {
        c.JSON(http.StatusBadRequest, SQLConnectionResponse{
            Success: false,
            Error:   "Connection test failed: " + err.Error(),
        })
        return
    }

    c.JSON(http.StatusOK, SQLConnectionResponse{
        Success: true,
        Message: "Connection successful",
    })
}
```

### 6. Save RDS Instance
**Endpoint:** `POST /api/v1/aws/rds/save`

**Description:** Saves RDS instance information to PostgreSQL database.

**Database Schema:**
```sql
CREATE TABLE IF NOT EXISTS rds_mssql_data (
    id SERIAL PRIMARY KEY,
    jsondata JSONB NOT NULL,
    clustername VARCHAR(255) NOT NULL,
    region VARCHAR(50) NOT NULL,
    aws_account_id VARCHAR(50),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

**Request Body:**
```json
{
  "jsondata": {
    "DBInstanceIdentifier": "test-sql-server",
    "DBInstanceClass": "db.t3.medium",
    "Engine": "sqlserver-se",
    "EngineVersion": "15.00.4073.23.v1",
    "DBInstanceStatus": "available",
    "MasterUsername": "admin",
    "AllocatedStorage": 100,
    "StorageType": "gp2",
    "MultiAZ": false,
    "AvailabilityZone": "us-east-1a",
    "PubliclyAccessible": false,
    "StorageEncrypted": true,
    "Endpoint": {
      "Address": "test-sql-server.abc123.us-east-1.rds.amazonaws.com",
      "Port": 1433
    },
    "sqlCredentials": {
      "username": "admin",
      "password": "encrypted-password"
    },
    "awsCredentials": {
      "accessKeyId": "AKIA...",
      "secretAccessKey": "...",
      "region": "us-east-1"
    },
    "displayName": "Test SQL Server",
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "clustername": "test-sql-server",
  "region": "us-east-1",
  "aws_account_id": null
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "clustername": "test-sql-server",
    "region": "us-east-1",
    "created_at": "2024-01-01T00:00:00.000Z"
  }
}
```

**Go Implementation:**
```go
import (
    "database/sql"
    "encoding/json"
    "time"
    
    _ "github.com/lib/pq" // PostgreSQL driver
)

type RDSSaveRequest struct {
    JSONData      map[string]interface{} `json:"jsondata" binding:"required"`
    ClusterName   string                 `json:"clustername" binding:"required"`
    Region        string                 `json:"region" binding:"required"`
    AWSAccountID  *string                `json:"aws_account_id"`
}

type RDSSaveResponse struct {
    Success bool        `json:"success"`
    Data    interface{} `json:"data,omitempty"`
    Error   string      `json:"error,omitempty"`
}

func SaveRDSInstance(c *gin.Context) {
    var req RDSSaveRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, RDSSaveResponse{
            Success: false,
            Error:   "Invalid request format: " + err.Error(),
        })
        return
    }

    // Convert jsondata to JSONB
    jsonData, err := json.Marshal(req.JSONData)
    if err != nil {
        c.JSON(http.StatusInternalServerError, RDSSaveResponse{
            Success: false,
            Error:   "Failed to serialize JSON data: " + err.Error(),
        })
        return
    }

    // Insert into database
    query := `
        INSERT INTO rds_mssql_data (jsondata, clustername, region, aws_account_id, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, created_at
    `
    
    now := time.Now()
    var id int
    var createdAt time.Time
    
    err = db.QueryRow(query, string(jsonData), req.ClusterName, req.Region, req.AWSAccountID, now, now).Scan(&id, &createdAt)
    if err != nil {
        c.JSON(http.StatusInternalServerError, RDSSaveResponse{
            Success: false,
            Error:   "Failed to save RDS instance: " + err.Error(),
        })
        return
    }

    c.JSON(http.StatusOK, RDSSaveResponse{
        Success: true,
        Data: map[string]interface{}{
            "id":           id,
            "clustername":  req.ClusterName,
            "region":       req.Region,
            "created_at":   createdAt,
        },
    })
}
```

### 7. Get Saved RDS Instances
**Endpoint:** `GET /api/v1/aws/rds/instances`

**Description:** Retrieves saved RDS instances from database with decrypted credentials.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "clustername": "test-sql-server",
      "region": "us-east-1",
      "jsondata": {
        "DBInstanceIdentifier": "test-sql-server",
        "displayName": "Test SQL Server",
        "awsCredentials": {
          "accessKeyId": "AKIA...",
          "secretAccessKey": "decrypted-secret",
          "region": "us-east-1"
        },
        "sqlCredentials": {
          "username": "admin",
          "password": "decrypted-password"
        }
      },
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

**Go Implementation:**
```go
func GetSavedRDSInstances(c *gin.Context) {
    query := `
        SELECT id, clustername, region, jsondata, created_at, updated_at
        FROM rds_mssql_data
        ORDER BY created_at DESC
    `
    
    rows, err := db.Query(query)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{
            "success": false,
            "error":   "Failed to fetch RDS instances: " + err.Error(),
        })
        return
    }
    defer rows.Close()

    var instances []map[string]interface{}
    
    for rows.Next() {
        var id int
        var clustername, region string
        var jsonData string
        var createdAt, updatedAt time.Time
        
        err := rows.Scan(&id, &clustername, &region, &jsonData, &createdAt, &updatedAt)
        if err != nil {
            continue
        }
        
        // Parse JSON data
        var data map[string]interface{}
        if err := json.Unmarshal([]byte(jsonData), &data); err != nil {
            continue
        }
        
        // Decrypt credentials here (implement your decryption logic)
        if awsCreds, ok := data["awsCredentials"].(map[string]interface{}); ok {
            if secretKey, exists := awsCreds["secretAccessKey"].(string); exists {
                awsCreds["secretAccessKey"] = decryptString(secretKey) // Implement this
            }
        }
        
        if sqlCreds, ok := data["sqlCredentials"].(map[string]interface{}); ok {
            if password, exists := sqlCreds["password"].(string); exists {
                sqlCreds["password"] = decryptString(password) // Implement this
            }
        }
        
        instances = append(instances, map[string]interface{}{
            "id":          id,
            "clustername": clustername,
            "region":      region,
            "jsondata":    data,
            "created_at":  createdAt,
            "updated_at":  updatedAt,
        })
    }
    
    c.JSON(http.StatusOK, gin.H{
        "success": true,
        "data":    instances,
    })
}
```

### 8. Performance Insights (Optional)
**Endpoint:** `GET /api/v1/aws/performance-insights`

**Description:** Retrieves Performance Insights data for RDS instance.

**Python Implementation:**
```python
@app.route('/api/v1/aws/performance-insights', methods=['GET'])
@auth_required
def get_performance_insights():
    try:
        instance_id = request.args.get('instanceId')
        region = request.args.get('region')
        time_range = request.args.get('range', '1h')
        
        # Get credentials from request or session
        credentials = get_stored_credentials()  # Implement this based on your session management
        
        session = boto3.Session(
            aws_access_key_id=credentials['accessKeyId'],
            aws_secret_access_key=credentials['secretAccessKey'],
            aws_session_token=credentials.get('sessionToken'),
            region_name=region
        )
        
        pi = session.client('pi')
        
        # Get resource identifier for Performance Insights
        resource_id = f"db-{instance_id}"  # This might need adjustment
        
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(hours=1)
        
        response = pi.get_resource_metrics(
            ServiceType='RDS',
            Identifier=resource_id,
            MetricQueries=[
                {
                    'Metric': 'db.SQL.Innodb_rows_read.avg',
                    'GroupBy': {
                        'Group': 'db.sql_tokenized.statement'
                    }
                }
            ],
            StartTime=start_time,
            EndTime=end_time,
            PeriodInSeconds=300
        )
        
        return jsonify({
            'status': 'success',
            'data': response.get('MetricList', [])
        })
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'error': str(e)
        }), 500
```

## Security Considerations

### 1. Credential Encryption (CRITICAL)
AWS credentials and SQL passwords MUST be encrypted before storing in database.

**Go Implementation Example:**
```go
import (
    "crypto/aes"
    "crypto/cipher"
    "crypto/rand"
    "encoding/base64"
    "io"
)

var encryptionKey = []byte("your-32-byte-encryption-key-here") // Use env variable

func encryptString(plaintext string) (string, error) {
    block, err := aes.NewCipher(encryptionKey)
    if err != nil {
        return "", err
    }

    gcm, err := cipher.NewGCM(block)
    if err != nil {
        return "", err
    }

    nonce := make([]byte, gcm.NonceSize())
    if _, err = io.ReadFull(rand.Reader, nonce); err != nil {
        return "", err
    }

    ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
    return base64.StdEncoding.EncodeToString(ciphertext), nil
}

func decryptString(ciphertext string) (string, error) {
    data, err := base64.StdEncoding.DecodeString(ciphertext)
    if err != nil {
        return "", err
    }

    block, err := aes.NewCipher(encryptionKey)
    if err != nil {
        return "", err
    }

    gcm, err := cipher.NewGCM(block)
    if err != nil {
        return "", err
    }

    nonceSize := gcm.NonceSize()
    nonce, ciphertext := data[:nonceSize], data[nonceSize:]
    
    plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
    if err != nil {
        return "", err
    }

    return string(plaintext), nil
}

// Update SaveRDSInstance to encrypt credentials
func SaveRDSInstance(c *gin.Context) {
    // ... existing code ...
    
    // Encrypt AWS credentials
    if awsCreds, ok := req.JSONData["awsCredentials"].(map[string]interface{}); ok {
        if secretKey, exists := awsCreds["secretAccessKey"].(string); exists {
            encrypted, err := encryptString(secretKey)
            if err != nil {
                c.JSON(http.StatusInternalServerError, RDSSaveResponse{
                    Success: false,
                    Error:   "Failed to encrypt AWS credentials",
                })
                return
            }
            awsCreds["secretAccessKey"] = encrypted
        }
    }
    
    // Encrypt SQL credentials
    if sqlCreds, ok := req.JSONData["sqlCredentials"].(map[string]interface{}); ok {
        if password, exists := sqlCreds["password"].(string); exists {
            encrypted, err := encryptString(password)
            if err != nil {
                c.JSON(http.StatusInternalServerError, RDSSaveResponse{
                    Success: false,
                    Error:   "Failed to encrypt SQL credentials",
                })
                return
            }
            sqlCreds["password"] = encrypted
        }
    }
    
    // ... continue with database save ...
}
```

### 2. Environment Variables
```bash
# .env file
ENCRYPTION_KEY=your-32-byte-key-here-must-be-32-chars
DATABASE_URL=postgresql://user:pass@localhost/dbname
```

### 3. Credential Handling Best Practices
- **Encrypt credentials** before storing in database
- **Use environment variables** for encryption keys
- **Implement key rotation** periodically
- **Clear credentials** from memory after use
- **Use HTTPS** for all API communications

### 2. Input Validation (Go)
```go
import (
    "errors"
    "strings"
)

func validateAWSCredentials(creds AWSCredentials) error {
    if creds.AccessKeyID == "" {
        return errors.New("missing required field: accessKeyId")
    }
    if creds.SecretAccessKey == "" {
        return errors.New("missing required field: secretAccessKey")
    }
    if creds.Region == "" {
        return errors.New("missing required field: region")
    }
    
    // Validate format
    if !strings.HasPrefix(creds.AccessKeyID, "AKIA") {
        return errors.New("invalid Access Key ID format")
    }
    
    if len(creds.SecretAccessKey) < 40 {
        return errors.New("invalid Secret Access Key format")
    }
    
    return nil
}
```

### 3. Rate Limiting (Go with gin-limiter)
```go
import (
    "github.com/gin-gonic/gin"
    "github.com/ulule/limiter/v3"
    "github.com/ulule/limiter/v3/drivers/store/memory"
    mgin "github.com/ulule/limiter/v3/drivers/middleware/gin"
)

func setupRateLimiting() gin.HandlerFunc {
    // Define rate limit: 5 requests per minute
    rate := limiter.Rate{
        Period: 1 * time.Minute,
        Limit:  5,
    }
    
    store := memory.NewStore()
    rateLimiter := limiter.New(store, rate)
    
    return mgin.NewMiddleware(rateLimiter)
}

// Usage in routes
func setupRoutes(r *gin.Engine) {
    api := r.Group("/api/v1")
    
    // Apply rate limiting to AWS endpoints
    awsGroup := api.Group("/aws")
    awsGroup.Use(setupRateLimiting())
    
    awsGroup.POST("/test-credentials", TestAWSCredentials)
    awsGroup.POST("/rds/instances", GetRDSInstances)
    awsGroup.POST("/cloudwatch/metrics", GetCloudWatchMetrics)
}
```

## Error Handling

### Standard Error Response Format
```json
{
    "status": "error",
    "error": "Detailed error message",
    "code": "AWS_CREDENTIALS_INVALID"
}
```

### Common Error Codes
- `AWS_CREDENTIALS_INVALID`: Invalid AWS credentials
- `AWS_REGION_NOT_FOUND`: Invalid AWS region
- `RDS_INSTANCE_NOT_FOUND`: RDS instance not found
- `CLOUDWATCH_ACCESS_DENIED`: No CloudWatch permissions
- `RATE_LIMIT_EXCEEDED`: Too many requests

## Testing

### Test with AWS CLI Credentials
```bash
# Test credentials endpoint
curl -X POST http://localhost:5000/api/v1/aws/test-credentials \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "accessKeyId": "AKIA...",
    "secretAccessKey": "...",
    "region": "us-east-1"
  }'
```

### Mock Responses for Development
```python
# For development/testing without real AWS credentials
MOCK_RDS_INSTANCES = [
    {
        "DBInstanceIdentifier": "test-sql-server",
        "DBInstanceClass": "db.t3.medium",
        "Engine": "sqlserver-se",
        "EngineVersion": "15.00.4073.23.v1",
        "DBInstanceStatus": "available",
        "Endpoint": {
            "Address": "test-sql-server.xxxxx.us-east-1.rds.amazonaws.com",
            "Port": 1433
        },
        "AllocatedStorage": 100,
        "StorageType": "gp2",
        "MultiAZ": False
    }
]
```

## Environment Variables

```bash
# Optional: Default AWS region
AWS_DEFAULT_REGION=us-east-1

# Optional: Enable mock mode for testing
AWS_MOCK_MODE=false

# Your existing app configuration
FLASK_ENV=development
DATABASE_URL=postgresql://...
```

## Deployment Notes

1. **IAM Permissions**: Ensure your application has minimal IAM permissions
2. **VPC Configuration**: If RDS instances are in private subnets, ensure connectivity
3. **Logging**: Log AWS API calls for debugging (without credentials)
4. **Monitoring**: Monitor AWS API usage to avoid rate limits

## Complete Go Example

```go
package main

import (
    "context"
    "log"
    "net/http"
    "sort"
    "strings"
    "time"

    "github.com/aws/aws-sdk-go-v2/aws"
    "github.com/aws/aws-sdk-go-v2/config"
    "github.com/aws/aws-sdk-go-v2/credentials"
    "github.com/aws/aws-sdk-go-v2/service/cloudwatch"
    "github.com/aws/aws-sdk-go-v2/service/cloudwatch/types"
    "github.com/aws/aws-sdk-go-v2/service/rds"
    rdstypes "github.com/aws/aws-sdk-go-v2/service/rds/types"
    "github.com/aws/aws-sdk-go-v2/service/sts"
    "github.com/gin-gonic/gin"
)

// Types (include all the types defined above)
type AWSCredentials struct {
    AccessKeyID     string `json:"accessKeyId" binding:"required"`
    SecretAccessKey string `json:"secretAccessKey" binding:"required"`
    Region          string `json:"region" binding:"required"`
    SessionToken    string `json:"sessionToken,omitempty"`
}

// Middleware for authentication (replace with your existing auth)
func AuthRequired() gin.HandlerFunc {
    return func(c *gin.Context) {
        // Your existing authentication logic here
        // For example:
        token := c.GetHeader("Authorization")
        if token == "" {
            c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization required"})
            c.Abort()
            return
        }
        
        // Validate token...
        c.Next()
    }
}

// Helper function to create AWS config
func createAWSConfig(creds AWSCredentials) (aws.Config, error) {
    return config.LoadDefaultConfig(context.TODO(),
        config.WithRegion(creds.Region),
        config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(
            creds.AccessKeyID,
            creds.SecretAccessKey,
            creds.SessionToken,
        )),
    )
}

func main() {
    r := gin.Default()
    
    // Apply auth middleware to all API routes
    api := r.Group("/api/v1")
    api.Use(AuthRequired())
    
    // AWS endpoints
    aws := api.Group("/aws")
    {
        aws.POST("/test-credentials", TestAWSCredentials)
        aws.POST("/rds/instances", GetRDSInstances)
        aws.POST("/cloudwatch/metrics", GetCloudWatchMetrics)
    }
    
    log.Println("Server starting on :8080")
    r.Run(":8080")
}

// All the handler functions (TestAWSCredentials, GetRDSInstances, GetCloudWatchMetrics)
// would be included here from the implementations above
```

### Additional Go Dependencies
```bash
go get github.com/gin-gonic/gin
go get github.com/ulule/limiter/v3
go get github.com/ulule/limiter/v3/drivers/store/memory
go get github.com/ulule/limiter/v3/drivers/middleware/gin
```

### Project Structure
```
your-project/
├── main.go
├── handlers/
│   ├── aws_handlers.go
│   └── auth.go
├── models/
│   └── aws_types.go
├── middleware/
│   ├── auth.go
│   └── rate_limit.go
└── go.mod
```

This implementation provides a secure, scalable way to integrate AWS RDS monitoring into your existing ClusterEye system while allowing customers to use their own AWS credentials.