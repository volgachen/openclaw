import { ErrorCodes, errorShape } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

// Environment variables: DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_SCHEMA

let _pool: import("pg").Pool | undefined;

async function getPool() {
  if (!_pool) {
    const { Pool } = await import("pg");
    _pool = new Pool({
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      port: Number(process.env.DB_PORT ?? 5432),
      options: process.env.DB_SCHEMA ? `-c search_path=${process.env.DB_SCHEMA}` : undefined,
    });
  }
  return _pool;
}

export const databaseHandlers: GatewayRequestHandlers = {
  "source.check": async ({ params, respond }) => {
    const { id, name } = params as Record<string, unknown>;

    try {
      const db = await getPool();
      let result;
      if (id !== undefined && id !== null) {
        result = await db.query(`SELECT * FROM sources WHERE id = $1`, [id]);
      } else if (name !== undefined && name !== null) {
        result = await db.query(`SELECT * FROM sources WHERE name = $1`, [name]);
      } else {
        result = await db.query(`SELECT * FROM sources`);
      }
      respond(true, { sources: result.rows }, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, `Failed to check sources: ${String(err)}`));
    }
  },

  "article.search": async ({ params, respond }) => {
    const { id, url, article_name, sessionKey } = params as Record<string, unknown>;

    if (!id && !url && !article_name && !sessionKey) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "At least one search parameter required: id, url, article_name, or sessionKey"));
      return;
    }

    const conditions: string[] = [];
    const values: unknown[] = [];

    if (id !== undefined && id !== null) {
      values.push(id);
      conditions.push(`id = $${values.length}`);
    }
    if (url !== undefined && url !== null) {
      values.push(url);
      conditions.push(`url = $${values.length}`);
    }
    if (article_name !== undefined && article_name !== null) {
      values.push(article_name);
      conditions.push(`article_name = $${values.length}`);
    }
    if (sessionKey !== undefined && sessionKey !== null) {
      values.push(sessionKey);
      conditions.push(`"sessionKey" = $${values.length}`);
    }

    try {
      const db = await getPool();
      const result = await db.query(
        `SELECT * FROM articles WHERE ${conditions.join(" OR ")} ORDER BY created_at DESC`,
        values,
      );
      respond(true, { articles: result.rows }, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, `Failed to search articles: ${String(err)}`));
    }
  },

  "article.save": async ({ params, respond }) => {
    const { sessionKey } = params;
    if (!sessionKey) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Missing required parameter: sessionKey"));
      return;
    }

    const {
      source_id = null,
      article_name = null,
      url = null,
      memory_file = null,
      article_type = null,
      referred_article_id = null,
    } = params;

    try {
      const db = await getPool();
      const result = await db.query(
        `INSERT INTO articles (
          source_id, article_name, url, memory_file, article_type, referred_article_id, "sessionKey", created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, NOW(), NOW()
        ) RETURNING *`,
        [source_id, article_name, url, memory_file, article_type, referred_article_id, sessionKey],
      );
      respond(true, { article: result.rows[0] }, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, `Failed to save article: ${String(err)}`));
    }
  },
};
