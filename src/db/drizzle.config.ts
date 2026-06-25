import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

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
const sqlHost = process.env.SQL_HOST;
const sqlDbName = process.env.SQL_DB_NAME;
const user = process.env.SQL_ADMIN_USER;
const password = process.env.SQL_ADMIN_PASSWORD;

if (!connectionString && (!sqlHost || !sqlDbName || !user || !password)) {
  console.warn("WARNING: Neither connection string nor full Cloud SQL parameters are configured yet.");
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  schemaFilter: ["public"],
  dbCredentials: connectionString 
    ? {
        url: connectionString,
        ssl: connectionString.includes("supabase") || connectionString.includes("neon") ? { rejectUnauthorized: false } : undefined,
      }
    : {
        host: sqlHost || "",
        user: user || "",
        password: password || "",
        database: sqlDbName || "",
        ssl: false,
      },
  verbose: true,
});
