import React, { useEffect } from 'react';
import { Layout, Menu, Tooltip } from 'antd';
import { Link, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../redux/store';
import { setSelectedMenuItem } from '../redux/menuSlice';
import { setSidebarCollapsed } from '../redux/sidebarSlice';
import { 
    SettingOutlined, 
    FileSearchOutlined, 
    ClusterOutlined, 
    AlertOutlined, 
    HomeOutlined, 
    RobotOutlined,
    FileTextOutlined,
    ClockCircleOutlined,
    MenuFoldOutlined,
    MenuUnfoldOutlined,
    BarChartOutlined
} from '@ant-design/icons';

const { Sider } = Layout;

// URL yollarını menü anahtarlarıyla eşleştiren nesne
const pathToMenuKey: { [key: string]: string } = {
    '/': 'home',
    '/home': 'home',
    '/dashboard': 'clusters',
    '/alarms': 'alarms',
    '/logs': 'logs',
    '/reports': 'reports',
    '/settings': 'settings',
    '/aiadvisory': 'aiadvisory',
    '/jobs': 'jobs',
    '/performance-analyzer': 'performance-analyzer'
};

interface SidebarProps {
    onCollapse?: (collapsed: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onCollapse }) => {
    const dispatch = useDispatch();
    const location = useLocation();
    const selectedMenuItem = useSelector((state: RootState) => state.menu.selectedMenuItem);
    const collapsed = useSelector((state: RootState) => state.sidebar.collapsed);

    // URL değiştiğinde seçili menü öğesini güncelle
    useEffect(() => {
        const currentPath = location.pathname;
        const menuKey = pathToMenuKey[currentPath];
        if (menuKey) {
            dispatch(setSelectedMenuItem(menuKey));
        }
    }, [location.pathname, dispatch]);

    // Inject custom CSS for menu styling
    useEffect(() => {
        const styleId = 'sidebar-menu-styles';
        
        // Remove any existing style element with the same ID
        const existingStyle = document.getElementById(styleId);
        if (existingStyle) {
            document.head.removeChild(existingStyle);
        }
        
        // Create and append new style element
        const styleElement = document.createElement('style');
        styleElement.id = styleId;
        styleElement.innerHTML = `
            .sidebar-menu.ant-menu.ant-menu-dark .ant-menu-item {
                color: white;
                transition: all 0.3s ease;
            }
            
            .sidebar-menu.ant-menu.ant-menu-dark .ant-menu-item:hover {
                color: rgba(255, 255, 255, 0.85);
                background-color: rgba(255, 255, 255, 0.1);
            }
            
            .sidebar-menu.ant-menu.ant-menu-dark .ant-menu-item-selected {
                background-color: white;
                color: black;
                transition: all 0.3s ease;
            }
            
            .sidebar-menu.ant-menu.ant-menu-dark .ant-menu-item-selected:hover {
                background-color: rgba(255, 255, 255, 0.9);
            }
            
            .sidebar-menu.ant-menu.ant-menu-dark .ant-menu-item-selected a {
                color: black;
            }

            .sidebar-menu.ant-menu.ant-menu-dark .ant-menu-item a {
                transition: color 0.3s ease;
            }

            .sidebar-menu.ant-menu.ant-menu-dark .ant-menu-item:hover a {
                color: rgba(255, 255, 255, 0.85);
            }

            .sidebar-collapse-button {
                position: fixed;
                right: -32px;
                top: 60px;
                padding: 8px 8px;
                background: #722ed1;
                color: white;
                border-radius: 0 8px 8px 0;
                cursor: pointer;
                transition: all 0.3s ease;
                z-index: 1000;
                display: flex;
                align-items: center;
                justify-content: center;
                width: 32px;
                height: 32px;
                box-shadow: 3px 0 8px rgba(0, 0, 0, 0.15);
                border: none;
                outline: none;
            }

            .sidebar-collapse-button:hover {
                background: #531dab;
                width: 36px;
                right: -36px;
            }

            .sidebar-collapse-button .anticon {
                font-size: 16px;
                transition: transform 0.3s ease;
            }

            .sidebar-collapse-button:hover .anticon {
                transform: scale(1.1);
            }
        `;
        document.head.appendChild(styleElement);
        
        // Cleanup function to remove style when component unmounts
        return () => {
            const styleToRemove = document.getElementById(styleId);
            if (styleToRemove) {
                document.head.removeChild(styleToRemove);
            }
        };
    }, []);

    const handleMenuClick = (key: string) => {
        dispatch(setSelectedMenuItem(key));
    };

    const handleCollapse = (value: boolean) => {
        dispatch(setSidebarCollapsed(value));
        onCollapse?.(value);
    };

    const MenuItem = ({ icon, title, to }: { icon: React.ReactNode, title: string, to: string }) => {
        if (collapsed) {
            return (
                <Tooltip title={title} placement="right">
                    <Link to={to} style={{ display: 'flex', alignItems: 'center' }}>
                        {icon}
                    </Link>
                </Tooltip>
            );
        }
        return (
            <Link to={to} style={{ display: 'flex', alignItems: 'center' }}>
                {icon}
                <span style={{ marginLeft: '10px' }}>{title}</span>
            </Link>
        );
    };

    const menuItems = [
        {
            key: 'home',
            label: <MenuItem icon={<HomeOutlined style={{ fontSize: '16px' }} />} title="Home" to="/home" />
        },
        {
            key: 'aiadvisory',
            label: <MenuItem icon={<RobotOutlined style={{ fontSize: '16px' }} />} title="AI Advisory" to="/aiadvisory" />
        },
        {
            key: 'clusters',
            label: <MenuItem icon={<ClusterOutlined style={{ fontSize: '16px' }} />} title="Clusters" to="/dashboard" />
        },
        {
            key: 'alarms',
            label: <MenuItem icon={<AlertOutlined style={{ fontSize: '16px' }} />} title="Alarms" to="/alarms" />
        },
        {
            key: 'jobs',
            label: <MenuItem icon={<ClockCircleOutlined style={{ fontSize: '16px' }} />} title="Jobs" to="/jobs" />
        },
        {
            key: 'logs',
            label: <MenuItem icon={<FileSearchOutlined style={{ fontSize: '16px' }} />} title="Log Analyzer" to="/logs" />
        },
        {
            key: 'performance-analyzer',
            label: <MenuItem icon={<BarChartOutlined style={{ fontSize: '16px' }} />} title="Performance Analyzer" to="/performance-analyzer" />
        },
        {
            key: 'reports',
            label: <MenuItem icon={<FileTextOutlined style={{ fontSize: '16px' }} />} title="Reports" to="/reports" />
        },
        {
            key: 'settings',
            label: <MenuItem icon={<SettingOutlined style={{ fontSize: '16px' }} />} title="Settings" to="/settings" />
        }
    ];

    return (
        <Sider
            width={230}
            collapsible
            collapsed={collapsed}
            onCollapse={handleCollapse}
            style={{
                background: 'linear-gradient(135deg,rgb(71, 6, 118) 0%, #722ed1 100%)',
                position: 'fixed',
                left: 0,
                top: 0,
                bottom: 0,
                overflowY: 'auto',
                boxShadow: '2px 0 8px rgba(0, 0, 0, 0.15)',
                zIndex: 1000
            }}
            trigger={
                <div style={{
                    color: 'white',
                    background: '#722ed1',
                    borderRadius: '0 4px 4px 0',
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                </div>
            }
            collapsedWidth={80}
        >
            <div style={{ 
                padding: collapsed ? '16px 4px' : '16px 12px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '80px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                transition: 'all 0.3s ease'
            }}>
                <Link to="/">
                    <img
                        src="/clustereye_logo.png"
                        width={collapsed ? 70 : 210} 
                        height={90} 
                        alt="ClusterEye" 
                        style={{
                            objectFit: 'contain',
                            marginLeft: collapsed ? 0 : '-5px',
                            transition: 'all 0.3s ease'
                        }}
                    />
                </Link>
            </div>
            <Menu
                mode="inline"
                selectedKeys={[selectedMenuItem]}
                items={menuItems}
                onClick={({ key }) => handleMenuClick(key)}
                style={{
                    background: 'transparent',
                    borderRight: 'none',
                    marginTop: '8px',
                    fontSize: '15px'
                }}
                theme="dark"
                className="sidebar-menu"
            />
        </Sider>
    );
};

export default Sidebar; 