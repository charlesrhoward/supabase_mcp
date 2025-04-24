require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Enhanced CORS configuration for NextJS client
app.use(cors({
  origin: '*', // In production, restrict this to your NextJS app's domain
  methods: ['GET'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400 // 24 hours cache for preflight requests
}));

// Middleware
app.use(express.json());

// Basic request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    status: 'error',
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

// Validate Supabase credentials
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing Supabase credentials. Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Consistent response formatter
const formatResponse = (success, data = null, message = null, statusCode = 200) => {
  return {
    success, 
    data,
    message,
    timestamp: new Date().toISOString()
  };
};

// Health check endpoint
app.get('/', (req, res) => {
  res.json(formatResponse(true, null, 'Supabase Read-Only MCP Server'));
});

// List tables endpoint
app.get('/api/tables/:projectId', async (req, res) => {
  try {
    // For a read-only server, we use the Supabase client directly
    // This gets tables from the public schema by default
    const { data, error } = await supabase
      .from('information_schema.tables')
      .select('table_schema, table_name')
      .eq('table_schema', 'public')
      .neq('table_name', 'pg_stat_statements')
      .order('table_name');
    
    if (error) throw error;
    
    const tables = data.map(table => ({
      schema: table.table_schema,
      name: table.table_name
    }));
    
    res.json(formatResponse(true, { tables }));
  } catch (error) {
    console.error('Error listing tables:', error);
    res.status(500).json(formatResponse(false, null, error.message, 500));
  }
});

// Get table data endpoint
app.get('/api/data/:projectId/:tableName', async (req, res) => {
  try {
    const { tableName } = req.params;
    const limit = parseInt(req.query.limit) || 10;
    const page = parseInt(req.query.page) || 0;
    const offset = page * limit;
    
    // Check if table exists before querying
    const { data: tableCheck, error: tableError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', tableName)
      .single();
      
    if (tableError || !tableCheck) {
      return res.status(404).json(formatResponse(false, null, `Table '${tableName}' not found`, 404));
    }
    
    // Simple read-only query to fetch table data with pagination
    const { data, error, count } = await supabase
      .from(tableName)
      .select('*', { count: 'exact' })
      .range(offset, offset + limit - 1);
    
    if (error) throw error;
    
    res.json(formatResponse(true, { 
      rows: data,
      pagination: {
        total: count,
        page,
        limit,
        pages: Math.ceil(count / limit)
      }
    }));
  } catch (error) {
    console.error(`Error fetching data from table ${req.params.tableName}:`, error);
    res.status(500).json(formatResponse(false, null, error.message, 500));
  }
});

// Handle 404 routes
app.use((req, res) => {
  res.status(404).json(formatResponse(false, null, 'Endpoint not found', 404));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Supabase URL: ${SUPABASE_URL}`);
});
