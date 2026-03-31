const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Database setup
const db = new sqlite3.Database(':memory:'); // In-memory for demo, use file for persistence

// Create tables
db.serialize(() => {
  // Users table
  db.run(`CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    full_name TEXT NOT NULL,
    reg_number TEXT UNIQUE,
    role TEXT NOT NULL DEFAULT 'student',
    department TEXT,
    faculty TEXT,
    level TEXT,
    phone TEXT,
    profile_image TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Insert default admin
  const adminPassword = bcrypt.hashSync('admin123', 10);
  db.run(`INSERT INTO users (email, password, full_name, role, department, faculty)
          VALUES ('admin@buk.edu.ng', ?, 'System Administrator', 'admin', 'ICT Directorate', 'Administration')`, [adminPassword]);

  // Insert sample users
  const userPassword = bcrypt.hashSync('password123', 10);
  db.run(`INSERT INTO users (email, password, full_name, reg_number, role, department, faculty, level)
          VALUES ('student1@buk.edu.ng', ?, 'Muhammad Abdullahi', 'BUK/CS/20/1001', 'student', 'Computer Science', 'Computing', '400')`, [userPassword]);

  db.run(`INSERT INTO users (email, password, full_name, role, department, faculty)
          VALUES ('lecturer1@buk.edu.ng', ?, 'Dr. Aminu Ibrahim', 'lecturer', 'Computer Science', 'Computing')`, [userPassword]);
});

// Auth routes
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
    if (err || !user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || 'secret');
    res.json({ token, user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role } });
  });
});

// Get users
app.get('/api/users', (req, res) => {
  db.all('SELECT id, email, full_name, reg_number, role, department, faculty, level, is_active, created_at FROM users ORDER BY role, full_name', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Root route serves frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;