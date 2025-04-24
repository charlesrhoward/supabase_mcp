/**
 * Example of how a NextJS client-side chatbot agent would call this MCP server
 * This simulates client-side API calls using fetch
 */

// Simulated NextJS client environment
async function simulateNextJSClient() {
  const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:3000';
  
  console.log('--- NextJS Chatbot Agent MCP Integration Test ---');
  
  try {
    // 1. First, check MCP server is available
    console.log('\n1. Checking MCP server health:');
    const healthCheck = await fetch(`${MCP_SERVER_URL}/`);
    const healthData = await healthCheck.json();
    console.log(JSON.stringify(healthData, null, 2));
    
    if (!healthData.success) {
      throw new Error('MCP server is not available');
    }
    
    // 2. Get list of available tables
    console.log('\n2. Getting list of tables:');
    const tablesRes = await fetch(`${MCP_SERVER_URL}/api/tables/proj_readonly`);
    const tablesData = await tablesRes.json();
    console.log(JSON.stringify(tablesData, null, 2));
    
    if (!tablesData.success || !tablesData.data.tables.length) {
      console.log('No tables found or error occurred');
      return;
    }
    
    // 3. Get data from the first table
    const firstTable = tablesData.data.tables[0].name;
    console.log(`\n3. Getting data from table "${firstTable}":`);
    const dataRes = await fetch(`${MCP_SERVER_URL}/api/data/proj_readonly/${firstTable}?limit=3&page=0`);
    const tableData = await dataRes.json();
    console.log(JSON.stringify(tableData, null, 2));
    
    // 4. Example of how a chatbot agent might use this data
    console.log('\n4. How a chatbot agent might use this data:');
    console.log(`
    async function getDataForChatbot(tableName, query) {
      // Fetch data from MCP server
      const res = await fetch(\`\${MCP_SERVER_URL}/api/data/proj_readonly/\${tableName}?limit=5\`);
      const data = await res.json();
      
      if (!data.success) {
        return \`Sorry, I couldn't find information about \${query}.\`;
      }
      
      // Process the data for a chatbot response
      return \`I found \${data.data.pagination.total} records about \${query}. 
      Here's some information: \${JSON.stringify(data.data.rows[0])}\`;
    }
    `);
    
    console.log('\nTest completed successfully');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Run the simulation
simulateNextJSClient();
