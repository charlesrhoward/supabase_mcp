# Supabase Read-Only MCP Server

A read-only MCP (Microservice Control Plane) server for Supabase, prepared for deployment to Railway.

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
- `GET /api/list-organizations` - List organizations (mock data in read-only mode)
- `GET /api/list-projects` - List projects (mock data in read-only mode)
- `GET /api/tables/:projectId` - List tables in the public schema
- `GET /api/data/:projectId/:tableName` - Fetch data from a specific table (limited to 10 rows by default)

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

## Notes

This server is set up as read-only and uses mock data for organization and project information. The data endpoints connect to your actual Supabase instance for read operations only.
