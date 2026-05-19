const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'silat_monitor.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('Error opening database:', err);
  else console.log('Database initialized at', dbPath);
});

db.serialize(() => {
  db.run(`
        CREATE TABLE IF NOT EXISTS athletes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            age INTEGER,
            height REAL,
            weight REAL,
            category TEXT,
            rfid_tag TEXT UNIQUE
        )
    `);

  db.run(`
        CREATE TABLE IF NOT EXISTS attempts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            athlete_id INTEGER,
            force REAL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(athlete_id) REFERENCES athletes(id)
        )
    `);
  db.run(`
        CREATE TABLE IF NOT EXISTS admins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )
    `);

  // Inisialisasi admin default jika belum ada
  db.run(`INSERT OR IGNORE INTO admins (username, password) VALUES ('admin', 'admin123')`);
});

module.exports = db;
