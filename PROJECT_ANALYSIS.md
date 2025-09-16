# ClusterEye Project Analysis

## Project Overview

**ClusterEye** is a comprehensive database monitoring solution consisting of three main components:

- **Frontend**: React TypeScript application (this repository)
- **Backend/Agent**: `/Users/bariss/Documents/github/clustereye-agent`
- **API**: `/Users/bariss/Documents/github/clustereye_api`

## Frontend - Database Monitoring Application

### Technology Stack

#### Core Technologies
- **React 18** + **TypeScript** 
- **Vite** (build tool)
- **React Router DOM** (routing)
- **Redux Toolkit** (state management)
- **Ant Design** (UI framework)
- **Material-UI** (@mui/material)

#### Key Libraries
- **axios** - HTTP requests
- **cytoscape** - Network/topology visualization
- **echarts** - Charts and graphs
- **monaco-editor** - Code editor (SQL query editor)
- **react-query** (@tanstack/react-query) - Server state management
- **dayjs** - Date/time operations
- **lodash** - Utility functions

### Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── MainLayout.tsx
│   ├── NodeStatusGrid.tsx
│   ├── AIAnalysisRenderer.tsx
│   ├── ClusterTopology.tsx
│   ├── MongoTopology.tsx
│   ├── MssqlTopology.tsx
│   └── ...
├── pages/              # Main page components
│   ├── Dashboard.tsx
│   ├── AIAdvisory.tsx
│   ├── AlarmDashboard.tsx
│   ├── LogAnalyzer.tsx
│   ├── PerformanceAnalyzer.tsx
│   ├── Jobs.tsx
│   └── Reports.tsx
├── layout/             # Layout components
│   └── Sidebar.tsx
├── redux/              # Redux store and slices
│   ├── store.ts
│   ├── authSlice.ts
│   ├── menuSlice.ts
│   ├── sidebarSlice.ts
│   ├── nodesSlice.ts
│   └── aiLimitSlice.ts
├── services/           # API service layer
│   ├── authService.ts
│   └── awsService.ts
├── hooks/              # Custom React hooks
│   └── useBrowserNotification.ts
├── utils/              # Utility functions
│   ├── compression.ts
│   └── tokenUtils.ts
├── types/              # TypeScript type definitions
│   ├── user.ts
│   └── react-hexagon.d.ts
├── icons/              # Custom icon components
│   ├── mongo.tsx
│   ├── postgresql.tsx
│   └── mssql.tsx
└── styles/             # CSS files
    └── layout.css
```

### Core Components

#### 1. Main Dashboard Components
- **`generalDashboard.tsx`** - Main dashboard page showing all database types
- **`NodeStatusGrid.tsx`** - Grid view of database nodes
- **`MainLayout.tsx`** - Main layout wrapper

#### 2. Database-Specific Analysis Pages
- **`postgrepa.tsx`** - PostgreSQL Performance Analyzer
- **`mssqlpa.tsx`** - MSSQL Performance Analyzer  
- **`mongopa.tsx`** - MongoDB Performance Analyzer
- **`PostgresQueryAnalyzer.tsx`** - PostgreSQL query analysis

#### 3. Specialized Pages
- **`pages/AIAdvisory.tsx`** - AI-powered recommendations
- **`pages/AlarmDashboard.tsx`** - Alarm management
- **`pages/LogAnalyzer.tsx`** - Log analysis
- **`pages/PerformanceAnalyzer.tsx`** - Performance metrics analysis
- **`pages/Jobs.tsx`** - Job/task monitoring

#### 4. Layout and Navigation
- **`layout/Sidebar.tsx`** - Left navigation menu
- **`components/MainLayout.tsx`** - Main layout container

### Redux State Management

#### Store Slices
- **`authSlice.ts`** - User authentication state
- **`menuSlice.ts`** - Menu selection state
- **`sidebarSlice.ts`** - Sidebar collapse state
- **`nodesSlice.ts`** - Database node states
- **`aiLimitSlice.ts`** - AI usage limits

### Routing Structure

Main routes:
- `/` - Main dashboard
- `/dashboard` - Cluster overview
- `/postgrepa` - PostgreSQL analysis
- `/mssqlpa` - MSSQL analysis  
- `/mongopa` - MongoDB analysis
- `/alarms` - Alarm dashboard
- `/logs` - Log analyzer
- `/jobs` - Job monitoring
- `/aiadvisory` - AI recommendations
- `/settings` - Settings

## Key Features

### 1. Real-time Monitoring
- Data fetching every 5 seconds from API
- Ready infrastructure for WebSocket connections
- Live dashboard updates

### 2. Multi-Database Support
- PostgreSQL, MongoDB, MSSQL support
- Specialized analysis tools for each database type
- Unified dashboard view

### 3. Performance Analytics
- Query performance analysis
- Resource utilization metrics
- Historical data trending

### 4. AI Integration
- AI-powered query optimization recommendations
- Automated performance insights
- Predictive analysis features

### 5. Alarm System
- Real-time alarm notifications
- Customizable alert thresholds
- Browser notification support

## Authentication and Security

- JWT token-based authentication
- Protected routes (ProtectedRoute component)
- Token expiration handling
- Session management

## Build and Deployment

### Scripts
```json
{
  "dev": "vite",           // Development server
  "build": "vite build",   // Production build
  "lint": "eslint",        // Code linting
  "deploy": "gh-pages -d dist"  // GitHub Pages deployment
}
```

### Deployment
- Deployed via GitHub Pages
- `dist/` folder contains build output
- Production environment variables (`.env.production`)

## API Integration

- Connects to backend API via `VITE_REACT_APP_API_URL` environment variable
- Authentication header management with Axios interceptors
- Error handling and retry logic

## Related Projects

- **Backend/Agent**: `/Users/bariss/Documents/github/clustereye-agent`
- **API**: `/Users/bariss/Documents/github/clustereye_api`

## File Locations

- **Frontend**: `/Users/bariss/Documents/github/clustereye_frontend` (current repository)
- **Backend**: `/Users/bariss/Documents/github/clustereye-agent`
- **API**: `/Users/bariss/Documents/github/clustereye_api`

---

*This document provides a comprehensive analysis of the ClusterEye frontend architecture and its role in the overall database monitoring solution.*