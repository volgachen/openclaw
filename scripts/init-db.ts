// DB_NAME=shareTex DB_USER=postgres DB_PASSWORD=mysecretpassword \      
//     DB_HOST=10.18.155.32 DB_PORT=5432 DB_SCHEMA=shareTex \
//     npx tsx scripts/init-db.ts

// set DB_NAME=shareTex && set DB_USER=postgres && set DB_PASSWORD=mysecretpassword && set DB_HOST=10.18.155.32 && set DB_PORT=5432 && set DB_SCHEMA=shareTex && npx tsx scripts/init-db.ts

// Powershell: $env:DB_NAME="postgres"; $env:DB_USER="postgres"; $env:DB_PASSWORD="mysecretpassword"; $env:DB_HOST="10.18.155.32"; $env:DB_PORT="5432"; $env:DB_SCHEMA="sharetex"; npx tsx scripts/init-db.ts

import { Pool } from "pg";

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT ?? 5432),
});

const schema = process.env.DB_SCHEMA ?? "public";

async function createTable(client: import("pg").PoolClient, sql: string, label: string) {
  await client.query(sql);
  console.log(`Table ${label} is ready.`);
}

async function run() {
  const client = await pool.connect();
  try {
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
    await client.query(`SET search_path TO ${schema}`);

    await createTable(
      client,
      `
      CREATE TABLE IF NOT EXISTS ${schema}.sources (
        id         BIGSERIAL PRIMARY KEY,
        name       TEXT NOT NULL,
        url_format TEXT,
        comment    TEXT
      )
      `,
      `${schema}.sources`
    );

    await createTable(
      client,
      `
      CREATE TABLE IF NOT EXISTS ${schema}.articles (
        id                  BIGSERIAL PRIMARY KEY,
        source_id           BIGINT REFERENCES ${schema}.sources (id) ON DELETE SET NULL,
        article_name        TEXT,
        url                 TEXT,
        memory_file         TEXT,
        article_type        TEXT,
        referred_article_id BIGINT REFERENCES ${schema}.articles (id) ON DELETE SET NULL,
        "sessionKey"        TEXT NOT NULL,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
      `,
      `${schema}.articles`
    );
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error("init-db failed:", err);
  process.exit(1);
});
