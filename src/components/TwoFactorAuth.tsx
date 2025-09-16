import React, { useState, useEffect } from 'react';
import { Modal, Input, Button, Typography, Space, Alert, Spin, message } from 'antd';
import { QrcodeOutlined, SafetyOutlined, CopyOutlined } from '@ant-design/icons';
import QRCode from 'qrcode';
import axios from 'axios';

const { Title, Text, Paragraph } = Typography;

interface TwoFactorAuthProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: (code?: string) => void;
  mode: 'setup' | 'verify';
  username?: string;
}

interface SetupResponse {
  success: boolean;
  secret: string;
  qr_code: string;
  manual_key: string;
}

interface EnableResponse {
  success: boolean;
  message: string;
  backup_codes: string[];
}

const TwoFactorAuth: React.FC<TwoFactorAuthProps> = ({
  visible,
  onCancel,
  onSuccess,
  mode,
  username
}) => {
  const [loading, setLoading] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [step, setStep] = useState<'qr' | 'verify' | 'backup'>('qr');

  useEffect(() => {
    if (visible && mode === 'setup') {
      setupTwoFactor();
    }
  }, [visible, mode]);

  const setupTwoFactor = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post<SetupResponse>(
        `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/2fa/generate`,
        {},
        { 
          headers: {
            'Authorization': `Bearer ${token}`
          },
          withCredentials: true 
        }
      );

      const { secret, qr_code, manual_key } = response.data;
      
      // Generate QR code from the qr_code URL
      const qrDataUrl = await QRCode.toDataURL(qr_code);
      
      setSecret(manual_key || secret);
      setQrCodeDataUrl(qrDataUrl);
      setStep('qr');
    } catch (error) {
      console.error('Error setting up 2FA:', error);
      message.error('Failed to setup 2FA. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      message.error('Please enter a valid 6-digit code');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      if (mode === 'setup') {
        // Enable 2FA with the verification code
        const response = await axios.post<EnableResponse>(
          `${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/2fa/enable`,
          { code: verificationCode },
          { 
            headers: {
              'Authorization': `Bearer ${token}`
            },
            withCredentials: true 
          }
        );
        
        if (response.data.success) {
          setBackupCodes(response.data.backup_codes);
          setStep('backup');
        }
              } else {
          // This is for login verification - pass the code to parent
          onSuccess(verificationCode);
        }
    } catch (error) {
      console.error('Error verifying 2FA:', error);
      message.error('Invalid verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    message.success('Copied to clipboard!');
  };

  const finishSetup = () => {
    message.success('2FA has been successfully enabled!');
    onSuccess();
  };

  const renderSetupStep = () => {
    switch (step) {
      case 'qr':
        return (
          <div style={{ textAlign: 'center' }}>
            <Title level={4}>
              <QrcodeOutlined /> Scan QR Code
            </Title>
            <Paragraph>
              Scan this QR code with your Google Authenticator app or any compatible TOTP app.
            </Paragraph>
            
            {loading ? (
              <Spin size="large" />
            ) : (
              <div>
                <img 
                  src={qrCodeDataUrl} 
                  alt="2FA QR Code" 
                  style={{ marginBottom: 16, border: '1px solid #d9d9d9', borderRadius: 8 }}
                />
                
                <Alert
                  message="Manual Entry"
                  description={
                    <div>
                      <Text>If you can't scan the QR code, enter this secret manually:</Text>
                      <div style={{ 
                        background: '#f5f5f5', 
                        padding: '8px 12px', 
                        borderRadius: 4, 
                        margin: '8px 0',
                        fontFamily: 'monospace',
                        wordBreak: 'break-all'
                      }}>
                        {secret}
                        <Button 
                          type="link" 
                          size="small" 
                          icon={<CopyOutlined />}
                          onClick={() => copyToClipboard(secret)}
                        >
                          Copy
                        </Button>
                      </div>
                    </div>
                  }
                  type="info"
                  style={{ textAlign: 'left', marginBottom: 16 }}
                />
                
                <Button 
                  type="primary" 
                  onClick={() => setStep('verify')}
                  disabled={!qrCodeDataUrl}
                >
                  I've Added the Account
                </Button>
              </div>
            )}
          </div>
        );

      case 'verify':
        return (
          <div style={{ textAlign: 'center' }}>
            <Title level={4}>
              <SafetyOutlined /> Verify Setup
            </Title>
            <Paragraph>
              Enter the 6-digit code from your authenticator app to verify the setup.
            </Paragraph>
            
            <Input
              placeholder="Enter 6-digit code"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              style={{ 
                width: 200, 
                textAlign: 'center', 
                fontSize: 18, 
                letterSpacing: 4,
                marginBottom: 16
              }}
              maxLength={6}
              onPressEnter={verifyCode}
            />
            
            <div>
              <Button 
                type="default" 
                onClick={() => setStep('qr')}
                style={{ marginRight: 8 }}
              >
                Back
              </Button>
              <Button 
                type="primary" 
                onClick={verifyCode}
                loading={loading}
                disabled={verificationCode.length !== 6}
              >
                Verify
              </Button>
            </div>
          </div>
        );

      case 'backup':
        return (
          <div style={{ textAlign: 'center' }}>
            <Title level={4}>
              <SafetyOutlined /> Backup Codes
            </Title>
            <Alert
              message="Important: Save These Backup Codes"
              description="These backup codes can be used to access your account if you lose your authenticator device. Each code can only be used once."
              type="warning"
              style={{ marginBottom: 16, textAlign: 'left' }}
            />
            
            <div style={{ 
              background: '#f5f5f5', 
              padding: 16, 
              borderRadius: 8, 
              marginBottom: 16,
              textAlign: 'left'
            }}>
              {backupCodes.map((code, index) => (
                <div key={index} style={{ 
                  fontFamily: 'monospace', 
                  fontSize: 14, 
                  marginBottom: 4,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span>{code}</span>
                  <Button 
                    type="link" 
                    size="small" 
                    icon={<CopyOutlined />}
                    onClick={() => copyToClipboard(code)}
                  />
                </div>
              ))}
            </div>
            
            <Button 
              type="primary" 
              onClick={finishSetup}
              size="large"
            >
              I've Saved My Backup Codes
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  const renderVerifyMode = () => (
    <div style={{ textAlign: 'center' }}>
      <Title level={4}>
        <SafetyOutlined /> Two-Factor Authentication
      </Title>
      <Paragraph>
        Enter the 6-digit code from your authenticator app.
      </Paragraph>
      
      <Input
        placeholder="Enter 6-digit code"
        value={verificationCode}
        onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        style={{ 
          width: 200, 
          textAlign: 'center', 
          fontSize: 18, 
          letterSpacing: 4,
          marginBottom: 16
        }}
        maxLength={6}
        onPressEnter={verifyCode}
        autoFocus
      />
      
      <div>
        <Button 
          type="primary" 
          onClick={verifyCode}
          loading={loading}
          disabled={verificationCode.length !== 6}
          block
        >
          Verify
        </Button>
      </div>
    </div>
  );

  return (
    <Modal
      title={mode === 'setup' ? 'Setup Two-Factor Authentication' : 'Two-Factor Authentication'}
      open={visible}
      onCancel={onCancel}
      footer={null}
      width={500}
      maskClosable={false}
      destroyOnClose
    >
      {mode === 'setup' ? renderSetupStep() : renderVerifyMode()}
    </Modal>
  );
};

export default TwoFactorAuth; 