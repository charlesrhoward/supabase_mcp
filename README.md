# Supabase Read-Only MCP Server

A read-only MCP (Microservice Control Plane) server for Supabase, prepared for deployment to Railway. This implementation follows the standard MCP architecture as a STDIO daemon.

## About MCP Servers

The Supabase MCP server (like most MCP servers) is a **STDIO daemon**. That's why we run it as a *Worker* on Railway or as a child process locally—no health-check port is required.

## Setup

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Configure your environment variables:
   - `SUPABASE_URL` - Your Supabase project URL
   - `SUPABASE_ANON_KEY` - Your Supabase anonymous/public key
   - `SUPABASE_ACCESS_TOKEN` - Your Supabase access token (for Railway deployment)

4. Configure your .mcp.json file with your Supabase organization and project IDs:
   ```json
   {
     "org_id": "your_organization_id",
     "project_id": "your_project_id"
   }
   ```

## Running Locally

Test the server by running a JSON-RPC request:

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"listTools"}' | node index.js
```

You can also use the official Supabase MCP server package for testing:

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"listTools"}' \
  | npx -y @supabase/mcp-server-supabase
```

## Available Methods

- `listTools` - Lists all available tools
- `list_tables` - Lists all tables in the public schema
- `get_table_data` - Fetches data from a specific table with pagination

### Parameters for get_table_data

- `project_id` (required) - The project ID to use (defaults to the one in .mcp.json)
- `table_name` (required) - Name of the table to fetch data from
- `limit` (optional) - Number of rows to return per page (default: 10)
- `page` (optional) - Page number starting from 0 (default: 0)

## Deploying to Railway

### Deployment Tips

| Platform | What to set |
|----------|--------------|
| **Railway** | • Keep the `.mcp.json` in the repo.<br>• Add `SUPABASE_ACCESS_TOKEN` in *Variables*.<br>• **Service type → Worker** (otherwise Railway waits for a port and marks the service unhealthy). |
| **Docker Compose** | ```yaml
supabase-mcp:
  image: node:18-alpine
  working_dir: /app
  volumes: [".:/app"]
  command: npx -y @supabase/mcp-server-supabase@latest
  environment:
    - SUPABASE_ACCESS_TOKEN=${SUPABASE_ACCESS_TOKEN}
``` |
| **AnythingLLM self-hosted** | Mount `.mcp.json` into `/app/storage/plugins/anythingllm_mcp_servers.json`; the UI lets you reload without a container restart. |

### Railway Deployment Steps

1. Push your code to a GitHub repository
2. In the Railway dashboard, create a new project
3. Select "Deploy from GitHub repo"
4. Select your repository
5. Configure the environment variables (`SUPABASE_ACCESS_TOKEN`)
6. **Important**: Set the service type to **Worker**
7. Deploy the application

## Environment Variables

- `PORT` - The port the server will run on (defaults to 3000)
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Your Supabase anonymous/public key

## NextJS Integration with MCP

For integrating with a NextJS application, especially for chatbot agents, follow these guidelines:

### Setting Up NodeJS Child Process in NextJS

Since MCP servers are STDIO daemons, you need to spawn them as child processes in your NextJS application:

```typescript
// utils/mcpProcess.ts
import { spawn } from 'child_process';
import { jsonrpc } from './jsonrpc'; // You'll need to implement this

let mcpProcess: any = null;

export function initMcpProcess() {
  // Option 1: Use your custom MCP server
  mcpProcess = spawn('node', ['./mcp-server/index.js'], { stdio: 'pipe' });
  
  // Option 2: Or use the official package
  // mcpProcess = spawn('npx', ['-y', '@supabase/mcp-server-supabase@latest'], { stdio: 'pipe' });
  
  mcpProcess.stderr.on('data', (data: Buffer) => {
    console.error(`MCP stderr: ${data.toString()}`);
  });
  
  let buffer = '';
  
  mcpProcess.stdout.on('data', (data: Buffer) => {
    buffer += data.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    
    for (const line of lines) {
      if (line.trim()) {
        try {
          const response = JSON.parse(line);
          // Process response here
        } catch (error) {
          console.error('Failed to parse MCP response:', error);
        }
      }
    }
  });
  
  mcpProcess.on('close', (code: number) => {
    console.log(`MCP process exited with code ${code}`);
    mcpProcess = null;
  });
  
  return mcpProcess;
}

export async function callMcp(method: string, params: any): Promise<any> {
  if (!mcpProcess) {
    initMcpProcess();
  }
  
  return new Promise((resolve, reject) => {
    const id = Date.now();
    const request = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };
    
    // Set up one-time response handler
    const responseHandler = (data: Buffer) => {
      const response = JSON.parse(data.toString());
      if (response.id === id) {
        mcpProcess.stdout.removeListener('data', responseHandler);
        if (response.error) {
          reject(new Error(response.error.message));
        } else {
          resolve(response.result);
        }
      }
    };
    
    mcpProcess.stdout.on('data', responseHandler);
    mcpProcess.stdin.write(JSON.stringify(request) + '\n');
  });
}
```

### API Route for NextJS App

Create an API route to expose MCP functionality to client components:

```typescript
// app/api/mcp/route.ts (App Router)
import { NextRequest, NextResponse } from 'next/server';
import { callMcp } from '../../../utils/mcpProcess';

export async function POST(req: NextRequest) {
  try {
    const { method, params } = await req.json();
    
    if (!method) {
      return NextResponse.json({ success: false, message: 'Method is required' }, { status: 400 });
    }
    
    const result = await callMcp(method, params || {});
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
```

### Client-Side Helper

Create a helper for client components:

```typescript
// utils/mcp.ts

type McpMethod = 'listTools' | 'list_tables' | 'get_table_data';

export async function callMcp(method: McpMethod, params?: any) {
  try {
    const response = await fetch('/api/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        method,
        params,
      }),
    });
    
    return await response.json();
  } catch (error) {
    console.error('MCP call error:', error);
    throw error;
  }
}
```

### Using in a Chatbot Component

```tsx
// components/SupabaseDataProvider.tsx
import { useEffect, useState } from 'react';
import { callMcp } from '../utils/mcp';

export function SupabaseDataProvider({ tableName, children }) {
  const [tableData, setTableData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const { success, data } = await callMcp('get_table_data', {
          project_id: 'proj_readonly',
          table_name: tableName,
          limit: 5
        });
        
        if (success) {
          setTableData(data);
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

This server is set up as a read-only STDIO daemon that follows the MCP server architecture pattern. It uses the Supabase JS client to connect to your Supabase instance for read operations only.

### Why no HTTP port?

The Supabase MCP server (like most MCP servers) is a **STDIO daemon**. That's why we run it as a *Worker* on Railway or as a child process locally—no health-check port is required.

### Quick smoke-test from your laptop

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"listTools"}' \
  | npx -y @supabase/mcp-server-supabase
```

You can also test this custom implementation by running:

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"listTools"}' \
  | node index.js
```
