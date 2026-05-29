import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function migrate() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    // Create migrations tracking table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(200) NOT NULL UNIQUE,
        executed_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Read migration files
    const migDir = path.join(__dirname, "migrations");
    if (!fs.existsSync(migDir)) { console.log("No migrations directory"); return; }
    
    const files = fs.readdirSync(migDir).filter(f => f.endsWith(".sql")).sort();
    
    for (const file of files) {
      const { rows } = await pool.query("SELECT 1 FROM _migrations WHERE name = $1", [file]);
      if (rows.length > 0) { console.log(`  skip: ${file}`); continue; }
      
      const sql = fs.readFileSync(path.join(migDir, file), "utf8");
      await pool.query(sql);
      await pool.query("INSERT INTO _migrations (name) VALUES ($1)", [file]);
      console.log(`  done: ${file}`);
    }
    
    console.log("Migrations complete");
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
