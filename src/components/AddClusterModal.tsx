import React, { useState, useEffect } from 'react';
import { Modal, Tabs, Form, Input, Button, Select, message, InputNumber } from 'antd';
import { DatabaseOutlined, PlusOutlined } from '@ant-design/icons';
import axios from 'axios';
import IconMongo from '../icons/mongo';
import IconPostgres from '../icons/postgresql';
import IconCassandra from '../icons/cassandra';
import IconMssql from '../icons/sql_server';

const { TabPane } = Tabs;
const { Option } = Select;

interface AddClusterModalProps {
  visible: boolean;
  onClose: () => void;
  initialTab?: 'mongodb' | 'postgresql' | 'mssql' | 'cassandra';
}

const AddClusterModal: React.FC<AddClusterModalProps> = ({ 
  visible, 
  onClose, 
  initialTab = 'mongodb' 
}) => {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [loading, setLoading] = useState(false);
  
  const [mongoForm] = Form.useForm();
  const [postgresForm] = Form.useForm();
  const [mssqlForm] = Form.useForm();
  const [cassandraForm] = Form.useForm();

  const handleTabChange = (key: string) => {
    setActiveTab(key as 'mongodb' | 'postgresql' | 'mssql' | 'cassandra');
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      let formData;
      let endpoint;

      switch (activeTab) {
        case 'mongodb':
          formData = await mongoForm.validateFields();
          endpoint = '/add_mongodb_cluster';
          break;
        case 'postgresql':
          formData = await postgresForm.validateFields();
          endpoint = '/add_postgresql_cluster';
          
          // PostgreSQL için özel veri dönüşümü
          formData = {
            nodename: formData.nodename,
            clustername: formData.clustername,
            username: formData.username,
            password: formData.password
          };
          break;
        case 'mssql':
          formData = await mssqlForm.validateFields();
          endpoint = '/add_mssql_cluster';
          break;
        case 'cassandra':
          formData = await cassandraForm.validateFields();
          endpoint = '/add_cassandra_cluster';
          break;
        default:
          throw new Error('Unknown database type');
      }

      const response = await axios.post(
        `${import.meta.env.VITE_REACT_APP_API_URL}${endpoint}`, 
        formData
      );

      if (response.status === 200) {
        message.success(`${activeTab.toUpperCase()} cluster added successfully!`);
        resetForms();
        onClose();
        
        // Opsiyonel: Başarılı ekleme sonrası ilgili sayfayı yeniden yükle
        if (typeof window !== 'undefined') {
          // Eğer şu anda ilgili veritabanı sayfasındaysak, sayfayı yenile
          const currentPath = window.location.pathname;
          if (
            (activeTab === 'mongodb' && currentPath === '/') ||
            (activeTab === 'postgresql' && currentPath === '/postgresql') ||
            (activeTab === 'mssql' && currentPath === '/mssql') ||
            (activeTab === 'cassandra' && currentPath === '/cassandra')
          ) {
            window.location.reload();
          }
        }
      } else {
        throw new Error('Failed to add cluster');
      }
    } catch (error) {
      console.error('Error adding cluster:', error);
      
      // Daha detaylı hata mesajı göster
      if (axios.isAxiosError(error) && error.response) {
        message.error(`Failed to add cluster: ${error.response.data.error || 'Unknown error'}`);
      } else {
        message.error('Failed to add cluster. Please check your inputs and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const resetForms = () => {
    mongoForm.resetFields();
    postgresForm.resetFields();
    mssqlForm.resetFields();
    cassandraForm.resetFields();
  };

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <DatabaseOutlined style={{ marginRight: 8 }} />
          Add Database Cluster
        </div>
      }
      open={visible}
      onCancel={onClose}
      width={700}
      footer={[
        <Button key="cancel" onClick={onClose}>
          Cancel
        </Button>,
        <Button 
          key="submit" 
          type="primary" 
          loading={loading} 
          onClick={handleSubmit}
          icon={<PlusOutlined />}
        >
          Add Cluster
        </Button>
      ]}
    >
      <Tabs activeKey={activeTab} onChange={handleTabChange}>
        <TabPane 
          tab={
            <span>
              <IconMongo size="16" color="#47A248" />
              <span style={{ marginLeft: 8 }}>MongoDB</span>
            </span>
          } 
          key="mongodb"
        >
          <Form
            form={mongoForm}
            layout="vertical"
            initialValues={{ port: 27017, dc: 'Esenyurt' }}
          >
            <Form.Item
              name="clusterName"
              label="Cluster Name"
              rules={[{ required: true, message: 'Please enter cluster name' }]}
            >
              <Input placeholder="e.g., production-cluster" />
            </Form.Item>
            
            <Form.Item
              name="replicaSetName"
              label="Replica Set Name"
              rules={[{ required: true, message: 'Please enter replica set name' }]}
            >
              <Input placeholder="e.g., rs0" />
            </Form.Item>
            
            <Form.Item
              name="hostname"
              label="Hostname"
              rules={[{ required: true, message: 'Please enter hostname' }]}
            >
              <Input placeholder="e.g., mongodb.example.com" />
            </Form.Item>
            
            <Form.Item
              name="port"
              label="Port"
              rules={[{ required: true, message: 'Please enter port' }]}
            >
              <InputNumber min={1} max={65535} style={{ width: '100%' }} />
            </Form.Item>
            
            <Form.Item
              name="username"
              label="Username"
              rules={[{ required: true, message: 'Please enter username' }]}
            >
              <Input placeholder="e.g., admin" />
            </Form.Item>
            
            <Form.Item
              name="password"
              label="Password"
              rules={[{ required: true, message: 'Please enter password' }]}
            >
              <Input.Password placeholder="Enter password" />
            </Form.Item>
            
            <Form.Item
              name="dc"
              label="Data Center"
              rules={[{ required: true, message: 'Please select data center' }]}
            >
              <Select>
                <Option value="Esenyurt">Esenyurt</Option>
                <Option value="Gebze">Gebze</Option>
              </Select>
            </Form.Item>
          </Form>
        </TabPane>
        
        <TabPane 
          tab={
            <span>
              <IconPostgres size="16" color="#336791" />
              <span style={{ marginLeft: 8 }}>PostgreSQL</span>
            </span>
          } 
          key="postgresql"
        >
          <Form
            form={postgresForm}
            layout="vertical"
            initialValues={{ port: 5432, dc: 'Esenyurt' }}
          >
            <Form.Item
              name="clustername"
              label="Cluster Name"
              rules={[{ required: true, message: 'Please enter cluster name' }]}
            >
              <Input placeholder="e.g., pg-production" />
            </Form.Item>
            
            <Form.Item
              name="nodename"
              label="Node Name"
              rules={[{ required: true, message: 'Please enter node name' }]}
            >
              <Input placeholder="e.g., postgres01.example.com" />
            </Form.Item>
            
            <Form.Item
              name="username"
              label="Username"
              rules={[{ required: true, message: 'Please enter username' }]}
            >
              <Input placeholder="e.g., postgres" />
            </Form.Item>
            
            <Form.Item
              name="password"
              label="Password"
              rules={[{ required: true, message: 'Please enter password' }]}
            >
              <Input.Password placeholder="Enter password" />
            </Form.Item>
          </Form>
        </TabPane>
        
        <TabPane 
          tab={
            <span>
              <IconMssql size="16" color="#CC2927" />
              <span style={{ marginLeft: 8 }}>SQL Server</span>
            </span>
          } 
          key="mssql"
        >
          <Form
            form={mssqlForm}
            layout="vertical"
            initialValues={{ port: 1433, dc: 'Esenyurt' }}
          >
            <Form.Item
              name="clusterName"
              label="Cluster Name"
              rules={[{ required: true, message: 'Please enter cluster name' }]}
            >
              <Input placeholder="e.g., sql-production" />
            </Form.Item>
            
            <Form.Item
              name="listenerName"
              label="Listener Name"
              rules={[{ required: true, message: 'Please enter listener name' }]}
            >
              <Input placeholder="e.g., sql-listener" />
            </Form.Item>
            
            <Form.Item
              name="hostname"
              label="Hostname"
              rules={[{ required: true, message: 'Please enter hostname' }]}
            >
              <Input placeholder="e.g., sqlserver.example.com" />
            </Form.Item>
            
            <Form.Item
              name="port"
              label="Port"
              rules={[{ required: true, message: 'Please enter port' }]}
            >
              <InputNumber min={1} max={65535} style={{ width: '100%' }} />
            </Form.Item>
            
            <Form.Item
              name="username"
              label="Username"
              rules={[{ required: true, message: 'Please enter username' }]}
            >
              <Input placeholder="e.g., sa" />
            </Form.Item>
            
            <Form.Item
              name="password"
              label="Password"
              rules={[{ required: true, message: 'Please enter password' }]}
            >
              <Input.Password placeholder="Enter password" />
            </Form.Item>
            
            <Form.Item
              name="dc"
              label="Data Center"
              rules={[{ required: true, message: 'Please select data center' }]}
            >
              <Select>
                <Option value="Esenyurt">Esenyurt</Option>
                <Option value="Gebze">Gebze</Option>
              </Select>
            </Form.Item>
          </Form>
        </TabPane>
        
        <TabPane 
          tab={
            <span>
              <IconCassandra width="16" height="16" />
              <span style={{ marginLeft: 8 }}>Cassandra</span>
            </span>
          } 
          key="cassandra"
        >
          <Form
            form={cassandraForm}
            layout="vertical"
            initialValues={{ port: 9042, dc: 'Esenyurt' }}
          >
            <Form.Item
              name="clusterName"
              label="Cluster Name"
              rules={[{ required: true, message: 'Please enter cluster name' }]}
            >
              <Input placeholder="e.g., cass-production" />
            </Form.Item>
            
            <Form.Item
              name="hostname"
              label="Hostname"
              rules={[{ required: true, message: 'Please enter hostname' }]}
            >
              <Input placeholder="e.g., cassandra.example.com" />
            </Form.Item>
            
            <Form.Item
              name="port"
              label="Port"
              rules={[{ required: true, message: 'Please enter port' }]}
            >
              <InputNumber min={1} max={65535} style={{ width: '100%' }} />
            </Form.Item>
            
            <Form.Item
              name="username"
              label="Username"
              rules={[{ required: true, message: 'Please enter username' }]}
            >
              <Input placeholder="e.g., cassandra" />
            </Form.Item>
            
            <Form.Item
              name="password"
              label="Password"
              rules={[{ required: true, message: 'Please enter password' }]}
            >
              <Input.Password placeholder="Enter password" />
            </Form.Item>
            
            <Form.Item
              name="dc"
              label="Data Center"
              rules={[{ required: true, message: 'Please select data center' }]}
            >
              <Select>
                <Option value="Esenyurt">Esenyurt</Option>
                <Option value="Gebze">Gebze</Option>
              </Select>
            </Form.Item>
          </Form>
        </TabPane>
      </Tabs>
    </Modal>
  );
};

export default AddClusterModal; 