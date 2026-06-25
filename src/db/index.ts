import * as dotenv from "dotenv";
dotenv.config();

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.ts";

const { Pool } = pg;

export const createPool = () => {
  const getPostgresUrl = () => {
    const urls = [process.env.DATABASE_URL, process.env.SUPABASE_DB_URL];
    for (const url of urls) {
      if (url && (url.startsWith("postgres://") || url.startsWith("postgresql://"))) {
        return url;
      }
    }
    return undefined;
  };

  const connectionString = getPostgresUrl();
  
  if (connectionString) {
    console.log("Connecting database via direct PostgreSQL URI (Supabase)...");
    return new Pool({
      connectionString,
      connectionTimeoutMillis: 15000,
      ssl: { rejectUnauthorized: false }
    });
  }

  console.log("Connecting database via individual parameters...");
  return new Pool({
    host: process.env.SQL_HOST,
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    database: process.env.SQL_DB_NAME,
    connectionTimeoutMillis: 15000,
  });
};

const pool = createPool();

pool.on("error", (err) => {
  console.error("Unexpected error on idle SQL pool client:", err);
});

export const db = drizzle(pool, { schema });
export { schema };
