import React, { useEffect, useState } from 'react';
import { Table, Card, Tag, Space, Typography, Button, Tooltip, Modal, Spin, Row, Col, Statistic, Divider } from 'antd';
import { ClockCircleOutlined, ReloadOutlined, CheckCircleOutlined, CloseCircleOutlined, InfoCircleOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Title, Text } = Typography;

// Format date utility function
const formatDate = (dateValue: any): string => {
  try {
    if (!dateValue) return '-';
    
    // Check if dateValue is a timestamp object with seconds and nanos
    if (dateValue && typeof dateValue === 'object' && 'seconds' in dateValue) {
      // Convert seconds to milliseconds and create a date
      const milliseconds = Number(dateValue.seconds) * 1000;
      const date = new Date(milliseconds);
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    }
    
    // Handle string date
    const date = new Date(dateValue);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch (error) {
    console.error("Error formatting date:", error, dateValue);
    return 'Invalid Date';
  }
};

// Type mapping
const JOB_TYPES: Record<number, string> = {
  1: 'MONGO_PROMOTE_PRIMARY',
  2: 'POSTGRES_PROMOTE_MASTER',
  3: 'MONGO_FREEZE_SECONDARY',
  // Add more mappings as needed
};

// Status mapping
const JOB_STATUSES: Record<number, string> = {
  1: 'PENDING',
  2: 'RUNNING',
  3: 'COMPLETED',
  4: 'FAILED',
  // Add more mappings as needed
};

interface Job {
  job_id: string;
  type: number | string;
  status: number | string;
  agent_id: string;
  created_at: string | { seconds: number; nanos: number };
  updated_at: string | { seconds: number; nanos: number };
  error_message: string | null;
  parameters: any;
  result: string | null;
}

interface JobLog {
  timestamp?: string;
  message: string;
}

const Jobs: React.FC = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [jobLogs, setJobLogs] = useState<string[]>([]);
  const [jobMetadata, setJobMetadata] = useState<any>(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logPollingInterval, setLogPollingInterval] = useState<number | null>(null);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/jobs`, {
        withCredentials: true,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });

      if (response.data?.data?.jobs) {
        setJobs(response.data.data.jobs);
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  // Start or stop log polling when modal visibility changes
  useEffect(() => {
    if (isModalVisible && selectedJob) {
      // Start polling for RUNNING jobs
      const statusName = typeof selectedJob.status === 'number' 
        ? getJobStatusName(selectedJob.status)
        : String(selectedJob.status || '');
      
      const isRunning = statusName.toLowerCase() === 'running' || 
                       statusName.toLowerCase() === 'pending';
      
      if (isRunning) {
        // Initial fetch
        fetchJobLogs(selectedJob.job_id);
        
        // Start polling
        const intervalId = window.setInterval(() => {
          fetchJobLogs(selectedJob.job_id);
        }, 5000); // Poll every 5 seconds
        
        setLogPollingInterval(intervalId);
        
        return () => {
          if (intervalId) {
            clearInterval(intervalId);
            setLogPollingInterval(null);
          }
        };
      }
    } else {
      // Stop polling when modal is closed
      if (logPollingInterval) {
        clearInterval(logPollingInterval);
        setLogPollingInterval(null);
      }
    }
  }, [isModalVisible, selectedJob]);

  // Clean up interval on component unmount
  useEffect(() => {
    return () => {
      if (logPollingInterval) {
        clearInterval(logPollingInterval);
      }
    };
  }, [logPollingInterval]);

  const getJobTypeName = (type: number | string): string => {
    if (typeof type === 'number' && type in JOB_TYPES) {
      return JOB_TYPES[type];
    }
    return String(type || 'UNKNOWN');
  };

  const getJobStatusName = (status: number | string): string => {
    if (typeof status === 'number' && status in JOB_STATUSES) {
      return JOB_STATUSES[status];
    }
    return String(status || 'UNKNOWN');
  };

  const getStatusColor = (status: any): string => {
    // Get the status name if it's a number
    const statusName = typeof status === 'number' ? getJobStatusName(status) : String(status || '');
    
    // Now safely convert to lowercase
    try {
      const statusLower = statusName.toLowerCase();
      
      switch (statusLower) {
        case 'completed':
          return 'success';
        case 'failed':
          return 'error';
        case 'running':
          return 'processing';
        case 'pending':
          return 'warning';
        default:
          return 'default';
      }
    } catch (error) {
      console.error('Error processing status:', error, 'Status was:', status);
      return 'default';
    }
  };

  // Function to fetch job logs
  const fetchJobLogs = async (jobId: string) => {
    try {
      setLogsLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/process-logs?process_id=${jobId}`,
        { 
          withCredentials: true,
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          }
        }
      );

      if (response.data.status === 'success') {
        // Set logs and metadata
        if (response.data.logs && Array.isArray(response.data.logs)) {
          setJobLogs(response.data.logs);
        }
        
        if (response.data.metadata) {
          setJobMetadata(response.data.metadata);
        }
        
        // Update job status in the list if process status is available
        if (response.data.process_status && selectedJob) {
          // Map process_status to job status
          let newJobStatus;
          switch (response.data.process_status) {
            case 'completed':
              newJobStatus = 3; // COMPLETED
              break;
            case 'failed':
              newJobStatus = 4; // FAILED
              break;
            case 'running':
              newJobStatus = 2; // RUNNING
              break;
            case 'pending':
              newJobStatus = 1; // PENDING
              break;
            default:
              newJobStatus = selectedJob.status; // Keep current status
          }
          
          // Only update if the status has changed
          if (newJobStatus !== selectedJob.status) {
            // Update the selected job status
            setSelectedJob({
              ...selectedJob,
              status: newJobStatus
            });
            
            // Update the job in the jobs list
            setJobs(prevJobs => 
              prevJobs.map(job => 
                job.job_id === jobId ? { ...job, status: newJobStatus } : job
              )
            );
            
            console.log(`Updated job ${jobId} status from ${selectedJob.status} to ${newJobStatus} based on process_status: ${response.data.process_status}`);
          }
        }
        
        // Also check for final_status in metadata
        if (response.data.metadata?.final_status && selectedJob) {
          let newJobStatus;
          switch (response.data.metadata.final_status.toLowerCase()) {
            case 'completed':
              newJobStatus = 3; // COMPLETED
              break;
            case 'failed':
              newJobStatus = 4; // FAILED
              break;
            default:
              newJobStatus = selectedJob.status; // Keep current status
          }
          
          // Only update if the status has changed
          if (newJobStatus !== selectedJob.status) {
            // Update the selected job status
            setSelectedJob({
              ...selectedJob,
              status: newJobStatus
            });
            
            // Update the job in the jobs list
            setJobs(prevJobs => 
              prevJobs.map(job => 
                job.job_id === jobId ? { ...job, status: newJobStatus } : job
              )
            );
            
            console.log(`Updated job ${jobId} status from ${selectedJob.status} to ${newJobStatus} based on metadata.final_status: ${response.data.metadata.final_status}`);
          }
        }
      } else {
        console.error('Error fetching logs:', response.data.error);
      }
    } catch (error) {
      console.error('Error fetching job logs:', error);
    } finally {
      setLogsLoading(false);
    }
  };

  // Handle row click to show job details
  const handleRowClick = (record: Job) => {
    // Stop existing polling if any
    if (logPollingInterval) {
      clearInterval(logPollingInterval);
      setLogPollingInterval(null);
    }
    
    setSelectedJob(record);
    setJobLogs([]);
    setJobMetadata(null);
    setIsModalVisible(true);
    fetchJobLogs(record.job_id);
  };

  // Handle modal close
  const handleModalClose = () => {
    // Stop polling when modal is closed
    if (logPollingInterval) {
      clearInterval(logPollingInterval);
      setLogPollingInterval(null);
    }
    
    setIsModalVisible(false);
  };

  const columns = [
    {
      title: 'Job ID',
      dataIndex: 'job_id',
      key: 'job_id',
      render: (text: string) => (
        <Tooltip title={text}>
          <span>{text.substring(0, 8)}...</span>
        </Tooltip>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type: number | string) => getJobTypeName(type),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: number | string) => {
        // Convert status to a displayable string
        const displayStatus = getJobStatusName(status);
        
        return (
          <Tag color={getStatusColor(status)}>
            {displayStatus.toUpperCase()}
          </Tag>
        );
      },
    },
    {
      title: 'Agent ID',
      dataIndex: 'agent_id',
      key: 'agent_id',
    },
    {
      title: 'Created At',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (dateValue: any) => formatDate(dateValue),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ClockCircleOutlined style={{ fontSize: '24px', color: '#722ed1' }} />
            <Title level={4} style={{ margin: 0 }}>Jobs</Title>
          </div>
          <Button 
            icon={<ReloadOutlined />} 
            onClick={fetchJobs}
            loading={loading}
          >
            Refresh
          </Button>
        </div>
        <Table
          columns={columns}
          dataSource={jobs || []}
          loading={loading}
          rowKey="job_id"
          pagination={{ pageSize: 10 }}
          onRow={(record) => ({
            onClick: () => handleRowClick(record),
            style: { cursor: 'pointer' }
          })}
        />
      </Card>

      {/* Job Details Modal */}
      <Modal
        title={
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center' 
          }}>
            <span>Job Details</span>
            {selectedJob && (
              <Tag color={getStatusColor(selectedJob.status)}>
                {getJobStatusName(selectedJob.status).toUpperCase()}
              </Tag>
            )}
          </div>
        }
        open={isModalVisible}
        onCancel={handleModalClose}
        width={900}
        footer={[
          <Button
            key="refresh"
            type="primary"
            onClick={() => selectedJob && fetchJobLogs(selectedJob.job_id)}
            icon={<ReloadOutlined />}
            loading={logsLoading}
          >
            Refresh Logs
          </Button>,
          <Button key="close" onClick={handleModalClose}>
            Close
          </Button>
        ]}
      >
        {selectedJob ? (
          <div>
            <div style={{ 
              background: '#f5f5f5', 
              padding: '16px', 
              borderRadius: '8px',
              marginBottom: '16px' 
            }}>
              <Row gutter={[16, 16]}>
                <Col span={8}>
                  <Statistic
                    title="Job ID"
                    value={selectedJob.job_id}
                    valueStyle={{ fontSize: '14px' }}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="Type"
                    value={getJobTypeName(selectedJob.type)}
                    valueStyle={{ fontSize: '14px' }}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="Agent ID"
                    value={selectedJob.agent_id}
                    valueStyle={{ fontSize: '14px' }}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="Created At"
                    value={formatDate(selectedJob.created_at)}
                    valueStyle={{ fontSize: '14px' }}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="Updated At"
                    value={formatDate(selectedJob.updated_at)}
                    valueStyle={{ fontSize: '14px' }}
                  />
                </Col>
                <Col span={8}>
                  {jobMetadata && jobMetadata.duration_s && (
                    <Statistic
                      title="Duration"
                      value={`${parseFloat(jobMetadata.duration_s).toFixed(2)} seconds`}
                      valueStyle={{ fontSize: '14px' }}
                    />
                  )}
                </Col>
              </Row>
            </div>

            {/* Job Metadata */}
            {jobMetadata && Object.keys(jobMetadata).length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <Divider orientation="left">Job Metadata</Divider>
                <Row gutter={[16, 8]}>
                  {Object.entries(jobMetadata).map(([key, value]) => {
                    // Skip certain keys that are already displayed or too verbose
                    if (['duration_s', 'elapsed_time_s', 'logs'].includes(key)) return null;
                    
                    return (
                      <Col span={8} key={key}>
                        <div style={{ 
                          padding: '8px 12px', 
                          background: '#f9f9f9', 
                          borderRadius: '4px',
                          height: '100%'
                        }}>
                          <div style={{ fontWeight: 'bold', fontSize: '12px', color: '#666' }}>
                            {key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                          </div>
                          <div>{String(value)}</div>
                        </div>
                      </Col>
                    );
                  })}
                </Row>
              </div>
            )}

            {/* Job Logs */}
            <Divider orientation="left">Job Logs</Divider>
            
            <div style={{ position: 'relative', minHeight: '200px' }}>
              {logsLoading ? (
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'center', 
                  alignItems: 'center',
                  height: '200px'
                }}>
                  <Spin size="large" />
                </div>
              ) : (jobLogs || []).length > 0 ? (
                <div style={{ 
                  background: '#f9f9f9', 
                  padding: '16px', 
                  borderRadius: '8px', 
                  maxHeight: '400px',
                  overflowY: 'auto',
                  border: '1px solid #d9d9d9'
                }}>
                  {(jobLogs || []).map((log, index) => {
                    let timestamp = '';
                    let message = log;
                    
                    // Try to extract timestamp from log
                    if (typeof log === 'string' && log.includes('[') && log.includes(']')) {
                      const parts = log.split(']');
                      if (parts.length > 1) {
                        timestamp = parts[0] + ']';
                        message = parts.slice(1).join(']').trim();
                      }
                    }
                    
                    // Check if this is an error or warning message
                    const isError = 
                      message.toLowerCase().includes('error') || 
                      message.toLowerCase().includes('fail') ||
                      message.toLowerCase().includes('başarısız');
                      
                    const isWarning = 
                      message.toLowerCase().includes('warning') || 
                      message.toLowerCase().includes('uyarı');
                      
                    const isSuccess = 
                      message.toLowerCase().includes('success') || 
                      message.toLowerCase().includes('başarılı') ||
                      message.toLowerCase().includes('promoted');
                    
                    let textColor = '';
                    if (isError) textColor = '#ff4d4f';
                    else if (isWarning) textColor = '#faad14';
                    else if (isSuccess) textColor = '#52c41a';
                    
                    return (
                      <div 
                        key={index} 
                        style={{ 
                          padding: '8px 12px', 
                          marginBottom: '4px', 
                          borderRadius: '4px',
                          backgroundColor: index % 2 === 0 ? '#f0f0f0' : '#f9f9f9',
                          color: textColor || 'inherit',
                          fontFamily: 'monospace'
                        }}
                      >
                        {timestamp && (
                          <span style={{ color: '#1890ff', marginRight: '8px', fontWeight: 'bold' }}>
                            {timestamp}
                          </span>
                        )}
                        <span>{message}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'center', 
                  alignItems: 'center',
                  height: '200px',
                  background: '#f9f9f9',
                  borderRadius: '8px',
                  border: '1px solid #d9d9d9'
                }}>
                  <Text type="secondary">No logs available for this job</Text>
                </div>
              )}
            </div>

            {/* Job Error Message */}
            {selectedJob.error_message && (
              <div style={{ 
                marginTop: '16px',
                padding: '12px',
                background: '#fff2f0',
                border: '1px solid #ffccc7',
                borderRadius: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                  <CloseCircleOutlined style={{ color: '#ff4d4f', marginRight: '8px' }} />
                  <Text strong>Error Message:</Text>
                </div>
                <div style={{ paddingLeft: '24px' }}>
                  {selectedJob.error_message}
                </div>
              </div>
            )}

            {/* Job Result */}
            {selectedJob.result && (
              <div style={{ 
                marginTop: '16px',
                padding: '12px',
                background: '#f6ffed',
                border: '1px solid #b7eb8f',
                borderRadius: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                  <CheckCircleOutlined style={{ color: '#52c41a', marginRight: '8px' }} />
                  <Text strong>Result:</Text>
                </div>
                <div style={{ paddingLeft: '24px' }}>
                  {selectedJob.result}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin />
            <div style={{ marginTop: '16px' }}>Loading job details...</div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Jobs; 