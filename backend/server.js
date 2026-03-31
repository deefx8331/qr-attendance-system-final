const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'buk_qr_attendance_secret_key_2024';

// ==================== UTILITY FUNCTIONS ====================
function getDistance(lat1, lng1, lat2, lng2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// ==================== DATABASE SETUP ====================
const db = new sqlite3.Database(':memory:');

// Initialize database
db.serialize(() => {
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
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
    created_by INTEGER DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Courses table
  db.run(`CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_code VARCHAR(20),
    course_title VARCHAR(200),
    lecturer_id INTEGER,
    department VARCHAR(100),
    faculty VARCHAR(100),
    level VARCHAR(20),
    semester VARCHAR(50),
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Attendance sessions table
  db.run(`CREATE TABLE IF NOT EXISTS attendance_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER,
    session_code VARCHAR(100) UNIQUE,
    session_title VARCHAR(200),
    expires_at DATETIME,
    location VARCHAR(200),
    is_active BOOLEAN DEFAULT 1,
    created_by INTEGER,
    gps_required BOOLEAN DEFAULT 0,
    gps_lat DECIMAL(10, 8),
    gps_lng DECIMAL(11, 8),
    gps_radius_metres INTEGER DEFAULT 100,
    current_token VARCHAR(64),
    token_rotated_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Attendance records table
  db.run(`CREATE TABLE IF NOT EXISTS attendance_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER,
    student_id INTEGER,
    course_id INTEGER,
    marked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(50),
    device_info VARCHAR(255),
    student_lat DECIMAL(10, 8),
    student_lng DECIMAL(11, 8),
    distance_metres INTEGER,
    gps_verified BOOLEAN DEFAULT 0
  )`);

  // Enrollments table
  db.run(`CREATE TABLE IF NOT EXISTS enrollments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER,
    student_id INTEGER,
    enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Insert default admin
  const adminPassword = bcrypt.hashSync('admin123', 10);
  db.run(`INSERT OR IGNORE INTO users (id, email, password, full_name, role, department, faculty)
          VALUES (1, 'admin@buk.edu.ng', ?, 'System Administrator', 'admin', 'ICT Directorate', 'Administration')`, [adminPassword]);

  // Insert sample lecturers
  const userPassword = bcrypt.hashSync('password123', 10);
  db.run(`INSERT OR IGNORE INTO users (id, email, password, full_name, role, department, faculty, created_by)
          VALUES (2, 'lecturer1@buk.edu.ng', ?, 'Dr. Aminu Ibrahim', 'lecturer', 'Computer Science', 'Computing', 1)`, [userPassword]);
  db.run(`INSERT OR IGNORE INTO users (id, email, password, full_name, role, department, faculty, created_by)
          VALUES (3, 'lecturer2@buk.edu.ng', ?, 'Dr. Fatima Sani', 'lecturer', 'Computer Science', 'Computing', 1)`, [userPassword]);

  // Insert sample students
  db.run(`INSERT OR IGNORE INTO users (id, email, password, full_name, reg_number, role, department, faculty, level)
          VALUES (4, 'student1@buk.edu.ng', ?, 'Muhammad Abdullahi', 'BUK/CS/20/1001', 'student', 'Computer Science', 'Computing', '400')`, [userPassword]);
  db.run(`INSERT OR IGNORE INTO users (id, email, password, full_name, reg_number, role, department, faculty, level)
          VALUES (5, 'student2@buk.edu.ng', ?, 'Aisha Bello', 'BUK/CS/20/1002', 'student', 'Computer Science', 'Computing', '400')`, [userPassword]);
  db.run(`INSERT OR IGNORE INTO users (id, email, password, full_name, reg_number, role, department, faculty, level)
          VALUES (6, 'student3@buk.edu.ng', ?, 'Ibrahim Musa', 'BUK/CS/20/1003', 'student', 'Computer Science', 'Computing', '400')`, [userPassword]);

  // Insert sample courses
  db.run(`INSERT OR IGNORE INTO courses (id, course_code, course_title, lecturer_id, department, faculty, level, semester, created_by)
          VALUES (1, 'CSC 401', 'Software Engineering', 2, 'Computer Science', 'Computing', '400', 'First Semester', 1)`);
  db.run(`INSERT OR IGNORE INTO courses (id, course_code, course_title, lecturer_id, department, faculty, level, semester, created_by)
          VALUES (2, 'CSC 403', 'Database Management Systems', 2, 'Computer Science', 'Computing', '400', 'First Semester', 1)`);

  // Insert sample enrollments
  db.run(`INSERT OR IGNORE INTO enrollments (course_id, student_id) VALUES (1, 4)`);
  db.run(`INSERT OR IGNORE INTO enrollments (course_id, student_id) VALUES (1, 5)`);
  db.run(`INSERT OR IGNORE INTO enrollments (course_id, student_id) VALUES (2, 4)`);
});

// ==================== AUTH ROUTES ====================
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
    if (err || !user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ 
      token, 
      user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role, department: user.department, faculty: user.faculty } 
    });
  });
});

app.post('/api/auth/register', (req, res) => {
  const { email, password, full_name, reg_number, role, department, faculty, level } = req.body;
  const hashedPassword = bcrypt.hashSync(password, 10);
  
  db.run(
    `INSERT INTO users (email, password, full_name, reg_number, role, department, faculty, level)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [email, hashedPassword, full_name, reg_number, role || 'student', department, faculty, level],
    function(err) {
      if (err) return res.status(400).json({ error: 'Email already exists' });
      const token = jwt.sign({ id: this.lastID, role: role || 'student' }, JWT_SECRET, { expiresIn: '24h' });
      res.json({ token, user: { id: this.lastID, email, full_name, role: role || 'student' } });
    }
  );
});

// ==================== MIDDLEWARE ====================
const authenticateToken = (req, res, next) => {
  const token = (req.headers['authorization'] || '').split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role))
    return res.status(403).json({ error: 'Insufficient permissions' });
  next();
};

// ==================== USER ROUTES ====================
app.get('/api/users', authenticateToken, (req, res) => {
  db.all('SELECT id, email, full_name, reg_number, role, department, faculty, level, is_active, created_at FROM users ORDER BY role, full_name', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

app.get('/api/lecturers', authenticateToken, (req, res) => {
  db.all('SELECT id, email, full_name, department, faculty FROM users WHERE role = ?', ['lecturer'], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

// ==================== COURSES ROUTES ====================
app.get('/api/courses', authenticateToken, (req, res) => {
  db.all('SELECT c.*, u.full_name as lecturer_name FROM courses c LEFT JOIN users u ON c.lecturer_id = u.id', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

app.post('/api/courses', authenticateToken, (req, res) => {
  const { course_code, course_title, lecturer_id, department, faculty, level, semester } = req.body;
  db.run(
    `INSERT INTO courses (course_code, course_title, lecturer_id, department, faculty, level, semester, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [course_code, course_title, lecturer_id, department, faculty, level, semester, req.user.id],
    function(err) {
      if (err) return res.status(400).json({ error: err.message });
      res.json({ id: this.lastID, course_code, course_title, lecturer_id });
    }
  );
});

// ==================== ATTENDANCE SESSIONS ROUTES ====================
app.post('/api/sessions', authenticateToken, requireRole('lecturer', 'admin'), (req, res) => {
  const { course_id, session_title, expires_in_minutes = 15, gps_required = false, gps_lat, gps_lng, gps_radius_metres = 100 } = req.body;
  const session_code = uuidv4();
  const current_token = require('crypto').randomBytes(8).toString('hex');
  const expires_at = new Date(Date.now() + expires_in_minutes * 60000).toISOString();

  db.run(
    `INSERT INTO attendance_sessions 
     (course_id, session_code, session_title, expires_at, created_by, gps_required, gps_lat, gps_lng, gps_radius_metres, current_token, token_rotated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [course_id, session_code, session_title, expires_at, req.user.id, gps_required ? 1 : 0, gps_lat, gps_lng, gps_radius_metres, current_token, new Date().toISOString()],
    function(err) {
      if (err) return res.status(400).json({ error: err.message });
      
      QRCode.toDataURL(JSON.stringify({ session_id: this.lastID, session_code, token: current_token, course_id }), (err, qrCode) => {
        if (err) return res.status(500).json({ error: 'QR generation failed' });
        res.json({
          id: this.lastID,
          session_code,
          session_title,
          qr_code: qrCode,
          expires_at,
          current_token
        });
      });
    }
  );
});

app.get('/api/sessions/:course_id', authenticateToken, (req, res) => {
  db.all(
    'SELECT * FROM attendance_sessions WHERE course_id = ? ORDER BY created_at DESC',
    [req.params.course_id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows || []);
    }
  );
});

app.get('/api/sessions/:id/token', authenticateToken, requireRole('lecturer', 'admin'), (req, res) => {
  db.get('SELECT * FROM attendance_sessions WHERE id = ?', [req.params.id], (err, session) => {
    if (err || !session) return res.status(404).json({ error: 'Session not found' });
    if (new Date() > new Date(session.expires_at)) return res.status(410).json({ error: 'Session expired' });
    
    QRCode.toDataURL(JSON.stringify({ session_id: session.id, session_code: session.session_code, token: session.current_token, course_id: session.course_id }), (err, qrCode) => {
      if (err) return res.status(500).json({ error: 'QR generation failed' });
      res.json({ token: session.current_token, qr_code: qrCode, expires_at: session.expires_at });
    });
  });
});

// ==================== ATTENDANCE ROUTES ====================
app.post('/api/attendance/mark', authenticateToken, (req, res) => {
  const { session_id, student_id, course_id, token, student_lat, student_lng } = req.body;

  db.get(
    `SELECT * FROM attendance_sessions WHERE id = ? AND current_token = ?`,
    [session_id, token],
    (err, session) => {
      if (err || !session) return res.status(400).json({ error: 'Invalid session or token' });

      if (new Date(session.expires_at) < new Date()) {
        return res.status(400).json({ error: 'Session expired' });
      }

      // Check GPS requirements
      if (session.gps_required) {
        if (!student_lat || !student_lng) {
          return res.status(400).json({ 
            error: 'GPS location required for this session', 
            code: 'GPS_REQUIRED' 
          });
        }

        // Calculate distance from classroom
        const distance = getDistance(
          parseFloat(student_lat), parseFloat(student_lng),
          parseFloat(session.gps_lat), parseFloat(session.gps_lng)
        );

        if (distance > session.gps_radius_metres) {
          return res.status(400).json({ 
            error: 'You are too far from the classroom', 
            code: 'OUT_OF_RANGE',
            distance_metres: Math.round(distance),
            allowed_metres: session.gps_radius_metres
          });
        }
      }

      db.run(
        `INSERT INTO attendance_records (session_id, student_id, course_id, marked_at, student_lat, student_lng, distance_metres, gps_verified)
         VALUES (?, ?, ?, datetime('now'), ?, ?, ?, ?)`,
        [session_id, student_id, course_id, student_lat, student_lng, 
         session.gps_required ? Math.round(getDistance(parseFloat(student_lat), parseFloat(student_lng), parseFloat(session.gps_lat), parseFloat(session.gps_lng))) : null,
         session.gps_required ? 1 : 0],
        function(err) {
          if (err) return res.status(400).json({ error: 'Attendance already marked or invalid data' });
          const distance = session.gps_required ? Math.round(getDistance(parseFloat(student_lat), parseFloat(student_lng), parseFloat(session.gps_lat), parseFloat(session.gps_lng))) : null;
          res.json({ 
            success: true, 
            message: 'Attendance marked successfully', 
            id: this.lastID,
            distance_metres: distance
          });
        }
      );
    }
  );
});

app.get('/api/attendance/:student_id', authenticateToken, (req, res) => {
  db.all(
    `SELECT ar.*, c.course_code, c.course_title FROM attendance_records ar
     JOIN courses c ON ar.course_id = c.id
     WHERE ar.student_id = ? ORDER BY ar.marked_at DESC`,
    [req.params.student_id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows || []);
    }
  );
});

app.get('/api/enrollment/:student_id', authenticateToken, (req, res) => {
  db.all(
    `SELECT c.* FROM courses c
     JOIN enrollments e ON c.id = e.course_id
     WHERE e.student_id = ?`,
    [req.params.student_id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows || []);
    }
  );
});

app.get('/api/admin/users', authenticateToken, requireRole('admin'), (req, res) => {
  db.all('SELECT * FROM users ORDER BY role, full_name', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

app.post('/api/admin/lecturers', authenticateToken, requireRole('admin'), (req, res) => {
  const { email, password, full_name, department, faculty } = req.body;
  const hashedPassword = bcrypt.hashSync(password, 10);
  
  db.run(
    `INSERT INTO users (email, password, full_name, role, department, faculty, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [email, hashedPassword, full_name, 'lecturer', department, faculty, req.user.id],
    function(err) {
      if (err) return res.status(400).json({ error: 'Email already exists' });
      res.json({ id: this.lastID, email, full_name, role: 'lecturer' });
    }
  );
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`QR Attendance Server running on http://localhost:${PORT}`);
});
