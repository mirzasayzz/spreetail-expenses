const { Pool } = require('pg');
require('dotenv').config();

// Create a connection pool to Supabase PostgreSQL
// Pool reuses connections instead of creating new ones for each query
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false  // required for Supabase connections
  },
  max: 10,           // max number of connections in pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Set search_path to spreetail schema on every new connection
// This keeps our tables separate from other apps sharing this Supabase project
pool.on('connect', (client) => {
  client.query('SET search_path TO spreetail, public');
  console.log('Connected to Supabase PostgreSQL (spreetail schema)');
});

pool.on('error', (err) => {
  console.error('Database pool error:', err.message);
});

// Helper function to run queries
// Usage: const { rows } = await query('SELECT * FROM users WHERE id = $1', [userId]);
const query = (text, params) => {
  return pool.query(text, params);
};

module.exports = { pool, query };
