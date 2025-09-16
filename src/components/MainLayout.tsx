import React, { useEffect, useState } from 'react';
import { Layout, Space, Menu, Badge } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import { SettingOutlined, DatabaseOutlined, ClusterOutlined, AlertOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../redux/store';
import { setSelectedMenuItem } from '../redux/menuSlice';
// import ErrorModal from '../errorModal';
import UserProfile from './UserProfile';
import GlobalAlarmNotification from './GlobalAlarmNotification';
import AlarmBadge from './AlarmBadge';
import axios from 'axios';
import '../styles/layout.css';

const { Header, Content, Sider } = Layout;

interface MainLayoutProps {
  children: React.ReactNode;
}

const getMenuItems = () => {
  return [
    {
      key: 'clusters',
      icon: <ClusterOutlined />,
      label: <Link to="/dashboard">Clusters</Link>,
    },
    {
      key: 'alarms',
      icon: <AlertOutlined />,
      label: <Link to="/alarms">Alarms</Link>,
    },
    {
      key: 'jobs',
      icon: <ClockCircleOutlined />,
      label: <Link to="/jobs">Jobs</Link>,
    },
    {
      key: 'logs',
      icon: <DatabaseOutlined />,
      label: <Link to="/logs">Real-Time Log Analyzer</Link>,
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: <Link to="/settings">Settings</Link>,
    },
  ];
};

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const selectedMenuItem = useSelector((state: RootState) => state.menu?.selectedMenuItem || 'clusters');
  const { isLoggedIn } = useSelector((state: RootState) => state.auth);
  const [jobCount, setJobCount] = useState(0);

  const handleMenuClick = (key: string) => {
    dispatch(setSelectedMenuItem(key));
  };

  const handleJobClick = () => {
    dispatch(setSelectedMenuItem('jobs'));
    navigate('/jobs');
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header 
        className="site-header"
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          padding: '0 24px',
          height: '64px',
          position: 'fixed',
          width: '100%',
          top: 0,
          zIndex: 1000,
          boxShadow: '0 14px 20px rgba(0, 0, 0, 0.6)',
          background: 'linear-gradient(90deg, rgb(26, 54, 93) 0%, rgb(37, 99, 235) 100%)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Link to="/">
            <img 
              src="clustereye_logo.png" 
              width={200} 
              height={115} 
              alt="" 
              style={{ 
                objectFit: 'contain',
                marginTop: 15              
              }} 
            />
          </Link>
        </div>
        
        <Space size="middle" style={{ color: '#fff' }}>
          <AlarmBadge />
          <Badge count={jobCount} overflowCount={99}>
            <ClockCircleOutlined 
              style={{ fontSize: '20px', color: '#fff', cursor: 'pointer' }} 
              onClick={handleJobClick}
            />
          </Badge>
          <UserProfile />
        </Space>
      </Header>

      <Layout style={{ marginTop: 64 }}>
        <Sider
          width={200}
          style={{
            background: '#fff',
            position: 'fixed',
            left: 0,
            top: 64,
            bottom: 0,
            overflowY: 'auto',
            boxShadow: '2px 0 8px rgba(0, 0, 0, 0.06)'
          }}
        >
          <div className="logo" />
          <Menu
            mode="inline"
            selectedKeys={[selectedMenuItem]}
            style={{ height: '100%', borderRight: 0 }}
            items={getMenuItems()}
            onClick={({ key }: { key: string }) => handleMenuClick(key)}
          />
        </Sider>

        <Layout style={{ padding: '24px 24px 24px 224px' }}>
          <Content
            style={{
              padding: 24,
              margin: 0,
              background: '#fff',
              borderRadius: 8,
              minHeight: 280,
              boxShadow: '0 1px 4px rgba(0, 0, 0, 0.05)'
            }}
          >
            {children}
            <GlobalAlarmNotification />
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
};

export default MainLayout; 