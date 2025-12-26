import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres, { Sql } from "postgres";
import * as schema from "./schema";

dotenv.config();

if (!process.env.POSTGRES_URL) {
  throw new Error("POSTGRES_URL environment variable is not set");
}

// Singleton pattern to prevent connection pool exhaustion in development
// Next.js hot reloading can cause multiple module evaluations
declare global {
  // eslint-disable-next-line no-var
  var _postgresClient: Sql | undefined;
}

const connectionString = process.env.POSTGRES_URL;

// Connection pool configuration
const poolConfig = {
  max: 10, // Maximum connections in pool
  idle_timeout: 20, // Close idle connections after 20 seconds
  connect_timeout: 10, // Connection timeout
};

// In development, use global to preserve connection across hot reloads
// In production, create a new connection (process only runs once)
function getClient(): Sql {
  if (process.env.NODE_ENV === "production") {
    return postgres(connectionString, poolConfig);
  }

  if (!global._postgresClient) {
    global._postgresClient = postgres(connectionString, poolConfig);
  }
  return global._postgresClient;
}

export const client = getClient();
export const db = drizzle(client, { schema });
