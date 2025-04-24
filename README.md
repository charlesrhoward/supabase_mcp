# Supabase Read-Only MCP Server

A read-only MCP (Microservice Control Plane) server for Supabase, prepared for deployment to Railway. This server focuses exclusively on providing table listing and data retrieval functionality.

## Setup

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Configure your environment variables by copying `.env.example` to `.env` and adding your Supabase credentials:
   ```
   cp .env.example .env
   ```
   Then edit the `.env` file with your actual Supabase URL and anon key.

## Running Locally

```
npm run dev
```

The server will start on port 3000 (or the port specified in your `.env` file).

## API Endpoints

- `GET /` - Health check
- `GET /api/tables/:projectId` - List all tables in the public schema
- `GET /api/data/:projectId/:tableName` - Fetch data from a specific table with pagination

### Pagination Parameters for Data Endpoint

- `limit` (optional) - Number of rows to return per page (default: 10)
- `page` (optional) - Page number starting from 0 (default: 0)

## Deploying to Railway

### Option 1: Deploy via Railway CLI

1. Install the Railway CLI:
   ```
   npm i -g @railway/cli
   ```

2. Login to Railway:
   ```
   railway login
   ```

3. Link to your Railway project:
   ```
   railway link
   ```

4. Deploy the application:
   ```
   railway up
   ```

### Option 2: Deploy via GitHub Integration

1. Push your code to a GitHub repository
2. In the Railway dashboard, create a new project
3. Select "Deploy from GitHub repo"
4. Select your repository
5. Configure the environment variables (SUPABASE_URL and SUPABASE_ANON_KEY)
6. Your app will be deployed automatically

## Environment Variables

- `PORT` - The port the server will run on (defaults to 3000)
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Your Supabase anonymous/public key

## NextJS Integration with MCP

This server is designed to be used as an MCP (Multi-Cloud Provider) server with a NextJS application, particularly for chatbot agents. Follow these steps to integrate it with your NextJS application:

### 1. Create MCP Configuration in NextJS

Create a file at `app/api/mcp/config.ts` (for App Router) or `pages/api/mcp/config.ts` (for Pages Router) with the following content:

```typescript
// app/api/mcp/config.ts or pages/api/mcp/config.ts

export const mcpConfig = {
  supabase: {
    name: 'supabase',
    displayName: 'Supabase',
    description: 'Supabase data access tools',
    functions: [
      {
        name: 'list_tables',
        description: 'Lists all tables in the public schema',
        parameters: {
          properties: {
            project_id: { type: 'string', description: 'Project ID (can be any non-empty string)' }
          },
          required: ['project_id'],
          type: 'object'
        }
      },
      {
        name: 'get_table_data',
        description: 'Fetches data from a specific table with pagination',
        parameters: {
          properties: {
            project_id: { type: 'string', description: 'Project ID (can be any non-empty string)' },
            table_name: { type: 'string', description: 'Name of the table to fetch data from' },
            limit: { type: 'number', description: 'Number of rows to return (default: 10)' },
            page: { type: 'number', description: 'Page number (default: 0)' }
          },
          required: ['project_id', 'table_name'],
          type: 'object'
        }
      }
    ]
  }
};

export default mcpConfig;
```

### 2. Create MCP Handler in NextJS

Create a file at `app/api/mcp/route.ts` (for App Router) or `pages/api/mcp/index.ts` (for Pages Router):

**For App Router:**

```typescript
// app/api/mcp/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { mcpConfig } from './config';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { provider, functionName, parameters } = body;
    
    // Basic validation
    if (!provider || !functionName || !parameters) {
      return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
    }
    
    if (provider !== 'supabase') {
      return NextResponse.json({ success: false, message: 'Provider not supported' }, { status: 400 });
    }
    
    // Get MCP server URL from environment
    const MCP_SERVER_URL = process.env.MCP_SERVER_URL;
    if (!MCP_SERVER_URL) {
      return NextResponse.json({ success: false, message: 'MCP server URL not configured' }, { status: 500 });
    }
    
    // Handle specific function calls
    if (functionName === 'list_tables') {
      const { project_id } = parameters;
      const response = await fetch(`${MCP_SERVER_URL}/api/tables/${project_id}`);
      const data = await response.json();
      return NextResponse.json(data);
    }
    
    if (functionName === 'get_table_data') {
      const { project_id, table_name, limit = 10, page = 0 } = parameters;
      const url = new URL(`${MCP_SERVER_URL}/api/data/${project_id}/${table_name}`);
      url.searchParams.append('limit', limit.toString());
      url.searchParams.append('page', page.toString());
      
      const response = await fetch(url.toString());
      const data = await response.json();
      return NextResponse.json(data);
    }
    
    return NextResponse.json({ success: false, message: 'Function not supported' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
```

**For Pages Router:**

```typescript
// pages/api/mcp/index.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { mcpConfig } from './config';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }
  
  try {
    const { provider, functionName, parameters } = req.body;
    
    // Basic validation
    if (!provider || !functionName || !parameters) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    
    if (provider !== 'supabase') {
      return res.status(400).json({ success: false, message: 'Provider not supported' });
    }
    
    // Get MCP server URL from environment
    const MCP_SERVER_URL = process.env.MCP_SERVER_URL;
    if (!MCP_SERVER_URL) {
      return res.status(500).json({ success: false, message: 'MCP server URL not configured' });
    }
    
    // Handle specific function calls
    if (functionName === 'list_tables') {
      const { project_id } = parameters;
      const response = await fetch(`${MCP_SERVER_URL}/api/tables/${project_id}`);
      const data = await response.json();
      return res.status(response.status).json(data);
    }
    
    if (functionName === 'get_table_data') {
      const { project_id, table_name, limit = 10, page = 0 } = parameters;
      const url = new URL(`${MCP_SERVER_URL}/api/data/${project_id}/${table_name}`);
      url.searchParams.append('limit', limit.toString());
      url.searchParams.append('page', page.toString());
      
      const response = await fetch(url.toString());
      const data = await response.json();
      return res.status(response.status).json(data);
    }
    
    return res.status(400).json({ success: false, message: 'Function not supported' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
```

### 3. Configure Environment Variables

Add the following to your NextJS `.env.local` file:

```
MCP_SERVER_URL=https://your-railway-deployment-url.railway.app
# or for local development
# MCP_SERVER_URL=http://localhost:3000
```

### 4. Using MCP in Your NextJS Application

Instead of directly calling the MCP server from client components, create a helper function:

```typescript
// utils/mcp.ts

type McpFunctionName = 'list_tables' | 'get_table_data';

export async function callMcp(functionName: McpFunctionName, parameters: any) {
  try {
    const response = await fetch('/api/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        provider: 'supabase',
        functionName,
        parameters,
      }),
    });
    
    return await response.json();
  } catch (error) {
    console.error('MCP call error:', error);
    throw error;
  }
}
```

### 5. Example: Using in a Chatbot Component

```tsx
// components/ChatbotDataProvider.tsx

import { useEffect, useState } from 'react';
import { callMcp } from '../utils/mcp';

export function ChatbotDataProvider({ tableName, children }) {
  const [tableData, setTableData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const data = await callMcp('get_table_data', {
          project_id: 'proj_readonly',
          table_name: tableName,
          limit: 5
        });
        
        if (data.success) {
          setTableData(data.data);
        } else {
          setError(data.message);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
  }, [tableName]);
  
  return children({ tableData, loading, error });
}
```

## Notes

This server is set up as read-only and uses the Supabase JS client to connect to your Supabase instance for read operations only. The MCP integration ensures all database calls happen server-side, keeping your database credentials secure.
