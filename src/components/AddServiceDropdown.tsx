import React, { useState } from 'react';
import { Dropdown, Button, message } from 'antd';
import { PlusOutlined, CloudOutlined } from '@ant-design/icons';
import AddAWSRDSModal from './AddAWSRDSModal';

interface AddServiceDropdownProps {
  onAWSRDSSuccess?: (rdsInstance: any, credentials: any) => void;
  iconColor?: string;
  hoverColor?: string;
}

const AddServiceDropdown: React.FC<AddServiceDropdownProps> = ({ 
  onAWSRDSSuccess, 
  iconColor = '#666', 
  hoverColor = '#333' 
}) => {
  const [showAWSRDSModal, setShowAWSRDSModal] = useState(false);

  const handleAWSRDSSuccess = (rdsInstance: any, credentials: any) => {
    setShowAWSRDSModal(false);
    
    // Global event dispatch for AWS RDS success
    window.dispatchEvent(new CustomEvent('awsRDSAdded', { 
      detail: { rdsInstance, credentials } 
    }));
    
    message.success(`AWS RDS instance "${rdsInstance.nodename}" has been added successfully!`);
    
    if (onAWSRDSSuccess) {
      onAWSRDSSuccess(rdsInstance, credentials);
    }
  };

  const menuItems = [
    {
      key: 'aws-rds',
      icon: <CloudOutlined />,
      label: 'Add Amazon RDS',
      onClick: () => setShowAWSRDSModal(true),
    },
    // İleride başka seçenekler eklenebilir:
    // {
    //   key: 'azure-sql',
    //   icon: <CloudOutlined />,
    //   label: 'Add Azure SQL',
    //   onClick: () => {},
    // },
  ];

  return (
    <>
      <Dropdown
        menu={{ items: menuItems }}
        placement="bottomRight"
        trigger={['hover']}
      >
        <Button
          type="text"
          icon={
            <PlusOutlined 
              style={{
                transition: 'transform 0.3s ease',
              }}
            />
          }
          style={{
            color: iconColor,
            fontSize: '18px',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '6px',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
            e.currentTarget.style.color = hoverColor;
            const icon = e.currentTarget.querySelector('.anticon');
            if (icon) {
              (icon as HTMLElement).style.transform = 'rotate(45deg)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = iconColor;
            const icon = e.currentTarget.querySelector('.anticon');
            if (icon) {
              (icon as HTMLElement).style.transform = 'rotate(0deg)';
            }
          }}
        />
      </Dropdown>

      <AddAWSRDSModal
        visible={showAWSRDSModal}
        onCancel={() => setShowAWSRDSModal(false)}
        onSuccess={handleAWSRDSSuccess}
      />


    </>
  );
};

export default AddServiceDropdown;