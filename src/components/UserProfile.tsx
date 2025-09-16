import React from 'react';
import { Dropdown, Avatar, Space } from 'antd';
import { UserOutlined, LogoutOutlined } from '@ant-design/icons';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { logout } from '../redux/authSlice';
import type { MenuProps } from 'antd';
import { RootState } from '../redux/store';

const UserProfile: React.FC = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { user } = useSelector((state: RootState) => state.auth);

    const handleLogout = () => {
        dispatch(logout());
        navigate('/login');
    };

    const items: MenuProps['items'] = [
        {
            key: '1',
            label: (
                <div style={{ padding: '8px 0' }}>
                    <div style={{ fontWeight: 500 }}>{user?.username}</div>
                    <div style={{ color: '#666666', fontSize: '13px' }}>{user?.email}</div>
                    <div style={{ 
                        color: '#1890ff', 
                        fontSize: '12px',
                        marginTop: '4px',
                        fontWeight: 500 
                    }}>
                        {user?.role?.toUpperCase()}
                    </div>
                </div>
            ),
        },
        {
            type: 'divider',
        },
        {
            key: '2',
            label: 'Logout',
            icon: <LogoutOutlined />,
            onClick: handleLogout,
            danger: true
        },
    ];

    return (
        <Dropdown menu={{ items }} placement="bottomRight" trigger={['click']}>
            <Space style={{ cursor: 'pointer' }}>
                <Avatar 
                    icon={<UserOutlined />} 
                    style={{ 
                        backgroundColor: user?.role === 'admin' ? '#1890ff' : '#52c41a'
                    }} 
                />
                <span style={{ color: '#262626' }}>{user?.username}</span>
            </Space>
        </Dropdown>
    );
};

export default UserProfile; 