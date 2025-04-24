require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Validate Supabase credentials
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing Supabase credentials. Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Supabase Read-Only MCP Server' });
});

// API endpoints
app.get('/api/list-organizations', async (req, res) => {
  try {
    // This is a mock endpoint since we're read-only
    // In a real implementation, we would call the Supabase Management API
    res.json({ 
      organizations: [
        { id: 'org_readonly', name: 'Read-Only Organization', tier: 'free' }
      ] 
    });
  } catch (error) {
    console.error('Error listing organizations:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/list-projects', async (req, res) => {
  try {
    // This is a mock endpoint since we're read-only
    res.json({ 
      projects: [
        { 
          id: 'proj_readonly', 
          name: 'Read-Only Project', 
          organization_id: 'org_readonly',
          region: 'us-east-1',
          status: 'active' 
        }
      ] 
    });
  } catch (error) {
    console.error('Error listing projects:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/tables/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    // For a read-only server, we'll use the local Supabase client
    // In this example, we're getting tables from the public schema
    const { data, error } = await supabase
      .from('pg_tables')
      .select('schemaname, tablename')
      .eq('schemaname', 'public');
    
    if (error) throw error;
    
    const tables = data.map(table => ({
      schema: table.schemaname,
      name: table.tablename
    }));
    
    res.json({ tables });
  } catch (error) {
    console.error('Error listing tables:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/data/:projectId/:tableName', async (req, res) => {
  try {
    const { projectId, tableName } = req.params;
    const limit = req.query.limit || 10;
    
    // Simple read-only query to fetch table data
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(limit);
    
    if (error) throw error;
    
    res.json({ data });
  } catch (error) {
    console.error(`Error fetching data from table ${req.params.tableName}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Supabase URL: ${SUPABASE_URL}`);
});
