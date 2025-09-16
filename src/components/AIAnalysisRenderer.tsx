import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Card, Button, message, Tabs, Typography, Tag, Tooltip, Divider } from 'antd';
import { 
  CopyOutlined, 
  InfoCircleOutlined, 
  CheckCircleOutlined, 
  WarningOutlined,
  DatabaseOutlined,
  FileSearchOutlined,
  CodeOutlined
} from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;
const { TabPane } = Tabs;

interface AIAnalysisRendererProps {
  content: string;
  dbType?: 'postgres' | 'mongodb' | 'mssql';
}

const AIAnalysisRenderer: React.FC<AIAnalysisRendererProps> = ({ content, dbType = 'postgres' }) => {
  const [activeTab, setActiveTab] = useState<string>('formatted');

  // Markdown içindeki kod bloklarını işleyen özel bileşen
  const CodeBlock = ({ node, inline, className, children, ...props }: any) => {
    const match = /language-(\w+)/.exec(className || '');
    const language = match && match[1] ? match[1] : '';
    const isSQL = language === 'sql' || 
                 (!language && (String(children).trim().toUpperCase().startsWith('SELECT') || 
                               String(children).trim().toUpperCase().startsWith('CREATE INDEX')));
                               
    const isMongoDB = language === 'js' || language === 'javascript' || 
                     (!language && String(children).trim().includes('createIndex'));
    
    // Hangi dil için syntax highlighting yapılacağını belirle
    const highlightLanguage = isSQL ? 'sql' : (isMongoDB ? 'javascript' : language || 'text');
    
    // Kod bloğu için kopyalama fonksiyonu
    const handleCopy = () => {
      const textToCopy = String(children).replace(/\n$/, '');
      navigator.clipboard.writeText(textToCopy);
      message.success('Copied to clipboard');
    };
    
    return !inline ? (
      <div style={{ position: 'relative', marginBottom: '16px' }}>
        <div style={{ 
          position: 'absolute', 
          top: '5px', 
          right: '5px', 
          zIndex: 10 
        }}>
          <Button 
            type="text"
            icon={<CopyOutlined />} 
            onClick={handleCopy}
            size="small"
          >
            Copy
          </Button>
        </div>
        <SyntaxHighlighter
          style={vscDarkPlus}
          language={highlightLanguage}
          showLineNumbers={isSQL || isMongoDB}
          customStyle={{ 
            borderRadius: '8px', 
            fontSize: '0.9em',
            padding: '2em 1em 1em 1em' // Top padding for copy button
          }}
          {...props}
        >
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      </div>
    ) : (
      <code className={className} style={{ backgroundColor: '#f0f0f0', padding: '2px 4px', borderRadius: '4px' }} {...props}>
        {children}
      </code>
    );
  };

  // Markdown için özel bileşenler
  const MarkdownComponents = {
    // Kod bloğu bileşeni
    code: CodeBlock,
    
    // Başlıklar için özel stil
    h1: ({ node, children, ...props }: any) => (
      <Title level={1} style={{ fontSize: '1.8em', marginTop: '0.8em' }} {...props}>
        {children}
      </Title>
    ),
    h2: ({ node, children, ...props }: any) => (
      <Title level={2} style={{ fontSize: '1.5em', marginTop: '0.8em', color: '#1890ff' }} {...props}>
        {children}
      </Title>
    ),
    h3: ({ node, children, ...props }: any) => (
      <Title level={3} style={{ fontSize: '1.3em', marginTop: '0.8em', color: '#434343' }} {...props}>
        {children}
      </Title>
    ),
    
    // Paragraflar
    p: ({ node, children, ...props }: any) => (
      <Paragraph style={{ marginBottom: '1em', fontSize: '14px', lineHeight: '1.6' }} {...props}>
        {children}
      </Paragraph>
    ),
    
    // Listeler
    ul: ({ node, children, ordered, ...props }: any) => (
      <ul style={{ 
        paddingLeft: '1.5em',
        marginBottom: '1em'
      }} {...props}>
        {children}
      </ul>
    ),
    ol: ({ node, children, ordered, ...props }: any) => (
      <ol style={{ 
        paddingLeft: '1.5em',
        marginBottom: '1em'
      }} {...props}>
        {children}
      </ol>
    ),
    li: ({ node, children, ...props }: any) => (
      <li style={{ 
        margin: '0.5em 0',
        fontSize: '14px',
        lineHeight: '1.6'
      }} {...props}>
        {children}
      </li>
    ),
    
    // Table
    table: ({ node, children, ...props }: any) => (
      <div style={{ overflow: 'auto', marginBottom: '1em' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }} {...props}>
          {children}
        </table>
      </div>
    ),
    thead: ({ node, children, ...props }: any) => (
      <thead style={{ backgroundColor: '#fafafa' }} {...props}>
        {children}
      </thead>
    ),
    th: ({ node, children, ...props }: any) => (
      <th style={{ 
        padding: '12px 8px', 
        borderBottom: '1px solid #f0f0f0', 
        textAlign: 'left',
        fontWeight: 'bold'
      }} {...props}>
        {children}
      </th>
    ),
    td: ({ node, children, ...props }: any) => (
      <td style={{ padding: '12px 8px', borderBottom: '1px solid #f0f0f0' }} {...props}>
        {children}
      </td>
    ),
    
    // Vurgulamalar
    strong: ({ node, children, ...props }: any) => (
      <Text strong style={{ fontSize: 'inherit' }} {...props}>{children}</Text>
    ),
    em: ({ node, children, ...props }: any) => (
      <Text italic style={{ fontSize: 'inherit' }} {...props}>{children}</Text>
    ),
    
    // Bağlantılar
    a: ({ node, children, href, ...props }: any) => (
      <a 
        href={href} 
        target="_blank" 
        rel="noreferrer noopener" 
        style={{ color: '#1890ff' }} 
        {...props}
      >
        {children}
      </a>
    ),

    // Blockquote
    blockquote: ({ node, children, ...props }: any) => (
      <div style={{ 
        borderLeft: '4px solid #1890ff',
        paddingLeft: '1em',
        margin: '1em 0',
        color: '#666',
        backgroundColor: '#f9f9f9',
        borderRadius: '0 4px 4px 0',
        padding: '0.5em 1em'
      }} {...props}>
        {children}
      </div>
    )
  };

  // Analyze the content to extract key sections
  const extractSections = () => {
    const sections: {[key: string]: string | null} = {
      summary: null,
      issues: null,
      recommendations: null,
      indexes: null,
      query: null
    };
    
    // Extract section content
    const summaryMatch = content.match(/(?:^|## Summary\n)([^#]*?)(?=\n##|$)/s);
    const issuesMatch = content.match(/## Issues\n([^#]*?)(?=\n##|$)/s);
    const recommendationsMatch = content.match(/## Recommendations\n([^#]*?)(?=\n##|$)/s);
    const indexesMatch = content.match(/## Indexes\n([^#]*?)(?=\n##|$)/s) || 
                         content.match(/## Suggested Indexes\n([^#]*?)(?=\n##|$)/s);
    const queryMatch = content.match(/## Optimized Query\n([^#]*?)(?=\n##|$)/s) || 
                      content.match(/## Rewritten Query\n([^#]*?)(?=\n##|$)/s);
    
    if (summaryMatch) sections.summary = summaryMatch[1].trim();
    if (issuesMatch) sections.issues = issuesMatch[1].trim();
    if (recommendationsMatch) sections.recommendations = recommendationsMatch[1].trim();
    if (indexesMatch) sections.indexes = indexesMatch[1].trim();
    if (queryMatch) sections.query = queryMatch[1].trim();
    
    // If no summary section but content starts without heading, use that as summary
    if (!sections.summary && !content.startsWith('#')) {
      const firstSectionMatch = content.match(/^([^#]*?)(?=\n##|$)/s);
      if (firstSectionMatch) sections.summary = firstSectionMatch[1].trim();
    }
    
    return sections;
  };

  const sections = extractSections();

  // Şimdi özel rendering için bu bölümleri kullanalım
  const renderFormattedView = () => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Summary Section */}
        {sections.summary && (
          <div style={{ 
            padding: '16px',
            backgroundColor: '#f0f8ff',
            borderRadius: '8px',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
            borderLeft: '4px solid #1890ff'
          }}>
            <div style={{ 
              fontSize: '16px', 
              fontWeight: 'bold',
              marginBottom: '8px',
              color: '#1890ff',
              display: 'flex',
              alignItems: 'center'
            }}>
              <InfoCircleOutlined style={{ marginRight: '8px' }} />
              Query Analysis Summary
            </div>
            <div style={{ fontSize: '14px', lineHeight: '1.5' }}>
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={MarkdownComponents}
              >
                {sections.summary}
              </ReactMarkdown>
            </div>
          </div>
        )}
        
        {/* Issues Section */}
        {sections.issues && (
          <div style={{ 
            padding: '16px',
            backgroundColor: '#fff2f0',
            borderRadius: '8px',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
            borderLeft: '4px solid #ff4d4f'
          }}>
            <div style={{ 
              fontSize: '16px', 
              fontWeight: 'bold',
              marginBottom: '8px',
              color: '#ff4d4f',
              display: 'flex',
              alignItems: 'center'
            }}>
              <WarningOutlined style={{ marginRight: '8px' }} />
              Identified Issues
            </div>
            <div style={{ fontSize: '14px', lineHeight: '1.5' }}>
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={MarkdownComponents}
              >
                {sections.issues}
              </ReactMarkdown>
            </div>
          </div>
        )}
        
        {/* Recommendations Section */}
        {sections.recommendations && (
          <div style={{ 
            padding: '16px',
            backgroundColor: '#f6ffed',
            borderRadius: '8px',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
            borderLeft: '4px solid #52c41a'
          }}>
            <div style={{ 
              fontSize: '16px', 
              fontWeight: 'bold',
              marginBottom: '8px',
              color: '#52c41a',
              display: 'flex',
              alignItems: 'center'
            }}>
              <CheckCircleOutlined style={{ marginRight: '8px' }} />
              Recommendations
            </div>
            <div style={{ fontSize: '14px', lineHeight: '1.5' }}>
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={MarkdownComponents}
              >
                {sections.recommendations}
              </ReactMarkdown>
            </div>
          </div>
        )}
        
        {/* Indexes Section */}
        {sections.indexes && (
          <div style={{ 
            padding: '16px',
            backgroundColor: '#f9f0ff',
            borderRadius: '8px',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
            borderLeft: '4px solid #722ed1'
          }}>
            <div style={{ 
              fontSize: '16px', 
              fontWeight: 'bold',
              marginBottom: '8px',
              color: '#722ed1',
              display: 'flex',
              alignItems: 'center'
            }}>
              <DatabaseOutlined style={{ marginRight: '8px' }} />
              Suggested Indexes
            </div>
            <div style={{ fontSize: '14px', lineHeight: '1.5' }}>
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={MarkdownComponents}
              >
                {sections.indexes}
              </ReactMarkdown>
            </div>
          </div>
        )}
        
        {/* Optimized Query Section */}
        {sections.query && (
          <div style={{ 
            padding: '16px',
            backgroundColor: '#e6f7ff',
            borderRadius: '8px',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
            borderLeft: '4px solid #1890ff'
          }}>
            <div style={{ 
              fontSize: '16px', 
              fontWeight: 'bold',
              marginBottom: '8px',
              color: '#1890ff',
              display: 'flex',
              alignItems: 'center'
            }}>
              <FileSearchOutlined style={{ marginRight: '8px' }} />
              Optimized Query
            </div>
            <div style={{ fontSize: '14px', lineHeight: '1.5' }}>
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={MarkdownComponents}
              >
                {sections.query}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <Card>
      <Tabs 
        activeKey={activeTab} 
        onChange={setActiveTab}
        tabBarExtraContent={
          <Tag color="blue" icon={<CodeOutlined />}>
            {dbType === 'postgres' ? 'PostgreSQL' : dbType === 'mongodb' ? 'MongoDB' : 'SQL Server'}
          </Tag>
        }
      >
        <TabPane tab="Formatted View" key="formatted">
          {renderFormattedView()}
        </TabPane>
        <TabPane tab="Raw Markdown" key="raw">
          <div style={{ position: 'relative' }}>
            <Button 
              icon={<CopyOutlined />} 
              style={{ position: 'absolute', right: 0, top: 0, zIndex: 1 }}
              onClick={() => {
                navigator.clipboard.writeText(content);
                message.success('Raw markdown copied to clipboard');
              }}
            >
              Copy
            </Button>
            <SyntaxHighlighter
              language="markdown"
              style={vscDarkPlus}
              customStyle={{ 
                borderRadius: '8px', 
                padding: '2em 1em 1em 1em'
              }}
            >
              {content}
            </SyntaxHighlighter>
          </div>
        </TabPane>
        <TabPane tab="Full Render" key="full">
          <div style={{ padding: '16px' }}>
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              components={MarkdownComponents}
            >
              {content}
            </ReactMarkdown>
          </div>
        </TabPane>
      </Tabs>
    </Card>
  );
};

export default AIAnalysisRenderer; 