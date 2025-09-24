import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

export class Database {
  private db: sqlite3.Database;

  constructor(dbPath: string = './checkout_plus.db') {
    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening database:', err);
      } else {
        console.log('Connected to SQLite database');
      }
    });
  }

  async initialize(): Promise<void> {
    try {
      const schemaPath = path.join(__dirname, '../../../database/schema.sql');
      const schema = fs.readFileSync(schemaPath, 'utf8');

      // Split schema by semicolons and execute each statement
      const statements = schema.split(';').filter(stmt => stmt.trim().length > 0);

      for (const statement of statements) {
        await this.run(statement);
      }

      console.log('Database schema initialized successfully');
    } catch (error) {
      console.error('Error initializing database:', error);
      throw error;
    }
  }

  run(sql: string, params: any[] = []): Promise<sqlite3.RunResult> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(this: sqlite3.RunResult, err) {
        if (err) {
          reject(err);
        } else {
          resolve(this);
        }
      });
    });
  }

  get(sql: string, params: any[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  all(sql: string, params: any[] = []): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) {
          reject(err);
        } else {
          console.log('Database connection closed');
          resolve();
        }
      });
    });
  }
}

// Singleton instance
export const database = new Database();