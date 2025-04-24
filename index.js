require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const jsonrpc = require('jsonrpc-lite');
const fs = require('fs');
const path = require('path');

// Load .mcp.json config file if it exists
let mcpConfig = { org_id: '', project_id: '' };
const mcpConfigPath = path.join(process.cwd(), '.mcp.json');

if (fs.existsSync(mcpConfigPath)) {
  try {
    mcpConfig = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf8'));
  } catch (err) {
    console.error('Error reading .mcp.json:', err.message);
  }
}

// Get Supabase credentials from environment variables or config
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

// Initialize Supabase client if direct credentials are provided
let supabase = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// Define MCP tools
const tools = [
  {
    name: 'list_tables',
    description: 'Lists all tables in the public schema',
    parameters: {
      properties: {
        project_id: { type: 'string', description: 'Project ID' }
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
        project_id: { type: 'string', description: 'Project ID' },
        table_name: { type: 'string', description: 'Name of the table to fetch data from' },
        limit: { type: 'number', description: 'Number of rows to return (default: 10)' },
        page: { type: 'number', description: 'Page number (default: 0)' }
      },
      required: ['project_id', 'table_name'],
      type: 'object'
    }
  }
];

// Method implementations
const methods = {
  listTools: async () => {
    return {
      tools
    };
  },
  
  list_tables: async (params) => {
    const projectId = params.project_id || mcpConfig.project_id;
    
    if (!supabase) {
      throw new Error('Supabase client not initialized. Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.');
    }
    
    try {
      const { data, error } = await supabase
        .from('information_schema.tables')
        .select('table_schema, table_name')
        .eq('table_schema', 'public')
        .neq('table_name', 'pg_stat_statements')
        .order('table_name');
      
      if (error) throw error;
      
      return {
        tables: data.map(table => ({
          schema: table.table_schema,
          name: table.table_name
        }))
      };
    } catch (error) {
      throw new Error(`Error listing tables: ${error.message}`);
    }
  },
  
  get_table_data: async (params) => {
    const { table_name } = params;
    const projectId = params.project_id || mcpConfig.project_id;
    const limit = parseInt(params.limit) || 10;
    const page = parseInt(params.page) || 0;
    const offset = page * limit;
    
    if (!supabase) {
      throw new Error('Supabase client not initialized. Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.');
    }
    
    try {
      // Check if table exists before querying
      const { data: tableCheck, error: tableError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .eq('table_name', table_name)
        .single();
        
      if (tableError || !tableCheck) {
        throw new Error(`Table '${table_name}' not found`);
      }
      
      // Fetch table data with pagination
      const { data, error, count } = await supabase
        .from(table_name)
        .select('*', { count: 'exact' })
        .range(offset, offset + limit - 1);
      
      if (error) throw error;
      
      return {
        rows: data,
        pagination: {
          total: count,
          page,
          limit,
          pages: Math.ceil(count / limit)
        }
      };
    } catch (error) {
      throw new Error(`Error fetching data from table ${table_name}: ${error.message}`);
    }
  }
};

// Main JSON-RPC handler
async function handleJsonRpc(message) {
  try {
    const parsed = jsonrpc.parse(message);
    
    if (parsed.type === 'invalid') {
      return jsonrpc.error(null, jsonrpc.JsonRpcError.invalidRequest(parsed.payload.message));
    }
    
    if (parsed.type !== 'request') {
      return jsonrpc.error(null, jsonrpc.JsonRpcError.invalidRequest('Expected a JSON-RPC request'));
    }
    
    const { payload } = parsed;
    const { method, params, id } = payload;
    
    if (!methods[method]) {
      return jsonrpc.error(id, jsonrpc.JsonRpcError.methodNotFound(`Method '${method}' not found`));
    }
    
    try {
      const result = await methods[method](params || {});
      return jsonrpc.success(id, result);
    } catch (error) {
      return jsonrpc.error(id, jsonrpc.JsonRpcError.internalError(error.message));
    }
  } catch (error) {
    return jsonrpc.error(null, jsonrpc.JsonRpcError.parseError(error.message));
  }
}

// Set up STDIO handling
process.stdin.setEncoding('utf8');

let inputBuffer = '';
process.stdin.on('data', async (chunk) => {
  inputBuffer += chunk;
  try {
    // Basic line-by-line processing of JSON-RPC requests
    const lines = inputBuffer.split('\n');
    for (let i = 0; i < lines.length - 1; i++) {
      const line = lines[i].trim();
      if (line) {
        const response = await handleJsonRpc(line);
        process.stdout.write(JSON.stringify(response) + '\n');
      }
    }
    inputBuffer = lines[lines.length - 1];
  } catch (error) {
    const errorResponse = jsonrpc.error(null, jsonrpc.JsonRpcError.internalError(error.message));
    process.stdout.write(JSON.stringify(errorResponse) + '\n');
  }
});

process.stdin.on('end', () => {
  process.exit(0);
});

// Log initialization but don't write to stdout (would break JSON-RPC protocol)
process.stderr.write('Supabase MCP STDIO daemon initialized\n');
if (supabase) {
  process.stderr.write(`Connected to Supabase URL: ${SUPABASE_URL}\n`);
} else if (SUPABASE_ACCESS_TOKEN) {
  process.stderr.write('Using SUPABASE_ACCESS_TOKEN for authentication\n');
} else {
  process.stderr.write('WARNING: No Supabase credentials provided\n');
}
