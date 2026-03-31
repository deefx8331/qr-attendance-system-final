const express    = require('express');
const path       = require('path');
const mysql      = require('mysql2/promise');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const QRCode     = require('qrcode');
const cors       = require('cors');
const { v4: uuidv4 } = require('uuid');
const multer     = require('multer');
const XLSX       = require('xlsx');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'buk_qr_attendance_secret_key_2024';

// Multer – memory storage for Excel uploads (no disk write needed)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// ==================== DATABASE ====================
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'qr_attendance_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// ==================== AUTH MIDDLEWARE ====================
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

// ==================== AUTH ROUTES ====================

// Student self-registration ONLY (role forced to 'student')
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, full_name, reg_number, department, faculty, level } = req.body;

        if (!email || !password || !full_name)
            return res.status(400).json({ error: 'Missing required fields' });

        const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0)
            return res.status(409).json({ error: 'Email already registered' });

        if (reg_number) {
            const [regExists] = await pool.query('SELECT id FROM users WHERE reg_number = ?', [reg_number]);
            if (regExists.length > 0)
                return res.status(409).json({ error: 'Registration number already in use' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const [result] = await pool.query(
            `INSERT INTO users (email, password, full_name, reg_number, role, department, faculty, level)
             VALUES (?, ?, ?, ?, 'student', ?, ?, ?)`,
            [email, hashedPassword, full_name, reg_number || null, department || null, faculty || null, level || null]
        );

        res.status(201).json({ message: 'Registration successful', userId: result.insertId });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login (all roles)
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const [users] = await pool.query('SELECT * FROM users WHERE email = ? AND is_active = TRUE', [email]);
        if (users.length === 0)
            return res.status(401).json({ error: 'Invalid credentials' });

        const user = users[0];
        const valid = await bcrypt.compare(password, user.password);
        if (!valid)
            return res.status(401).json({ error: 'Invalid credentials' });

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role, full_name: user.full_name },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Login successful',
            token,
            user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role, department: user.department, faculty: user.faculty }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Current user profile
app.get('/api/auth/profile', authenticateToken, async (req, res) => {
    try {
        const [users] = await pool.query(
            'SELECT id, email, full_name, reg_number, role, department, faculty, level, created_at FROM users WHERE id = ?',
            [req.user.id]
        );
        if (users.length === 0) return res.status(404).json({ error: 'User not found' });
        res.json(users[0]);
    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// ==================== COURSE ROUTES ====================

// GET all courses for the logged-in user
app.get('/api/courses', authenticateToken, async (req, res) => {
    try {
        let query, params;

        if (req.user.role === 'student') {
            query = `
                SELECT c.*, u.full_name AS lecturer_name
                FROM courses c
                JOIN users u ON c.lecturer_id = u.id
                JOIN enrollments e ON c.id = e.course_id
                WHERE e.student_id = ?
                ORDER BY c.course_code`;
            params = [req.user.id];
        } else if (req.user.role === 'lecturer') {
            query = `
                SELECT c.*, u.full_name AS lecturer_name,
                       (SELECT COUNT(*) FROM enrollments WHERE course_id = c.id) AS student_count
                FROM courses c
                JOIN users u ON c.lecturer_id = u.id
                WHERE c.lecturer_id = ?
                ORDER BY c.course_code`;
            params = [req.user.id];
        } else {
            // admin sees all
            query = `
                SELECT c.*, u.full_name AS lecturer_name,
                       (SELECT COUNT(*) FROM enrollments WHERE course_id = c.id) AS student_count
                FROM courses c
                JOIN users u ON c.lecturer_id = u.id
                ORDER BY c.created_at DESC`;
            params = [];
        }

        const [courses] = await pool.query(query, params);
        res.json(courses);
    } catch (error) {
        console.error('Get courses error:', error);
        res.status(500).json({ error: 'Failed to fetch courses' });
    }
});

// GET single course
app.get('/api/courses/:id', authenticateToken, async (req, res) => {
    try {
        const [courses] = await pool.query(
            `SELECT c.*, u.full_name AS lecturer_name FROM courses c
             JOIN users u ON c.lecturer_id = u.id WHERE c.id = ?`,
            [req.params.id]
        );
        if (courses.length === 0) return res.status(404).json({ error: 'Course not found' });
        res.json(courses[0]);
    } catch (error) {
        console.error('Get course error:', error);
        res.status(500).json({ error: 'Failed to fetch course' });
    }
});

// GET enrolled students for a course
app.get('/api/courses/:id/students', authenticateToken, requireRole('lecturer', 'admin'), async (req, res) => {
    try {
        const [students] = await pool.query(
            `SELECT u.id, u.full_name, u.reg_number, u.email, u.level, e.enrolled_at
             FROM users u
             JOIN enrollments e ON u.id = e.student_id
             WHERE e.course_id = ?
             ORDER BY u.full_name`,
            [req.params.id]
        );
        res.json(students);
    } catch (error) {
        console.error('Get students error:', error);
        res.status(500).json({ error: 'Failed to fetch students' });
    }
});

// ==================== EXCEL UPLOAD – ENROLL STUDENTS ====================
/**
 * POST /api/courses/:id/upload-students
 * Lecturer uploads an Excel file (.xlsx / .xls).
 * Expected columns (any order, case-insensitive):
 *   reg_number | registration_number | reg number  →  matched against users.reg_number
 *   email                                          →  fallback match if no reg_number
 *
 * Students MUST have already self-registered.
 * The endpoint matches rows to existing student accounts and enrolls them.
 */
app.post('/api/courses/:id/upload-students',
    authenticateToken,
    requireRole('lecturer', 'admin'),
    upload.single('file'),
    async (req, res) => {
        try {
            const courseId = req.params.id;

            // Verify lecturer owns the course (admin can do any)
            if (req.user.role === 'lecturer') {
                const [own] = await pool.query(
                    'SELECT id FROM courses WHERE id = ? AND lecturer_id = ?',
                    [courseId, req.user.id]
                );
                if (own.length === 0)
                    return res.status(403).json({ error: 'You do not own this course' });
            }

            if (!req.file)
                return res.status(400).json({ error: 'No file uploaded' });

            // Parse Excel
            const workbook  = XLSX.read(req.file.buffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const sheet     = workbook.Sheets[sheetName];
            const rows      = XLSX.utils.sheet_to_json(sheet, { defval: '' });

            if (rows.length === 0)
                return res.status(400).json({ error: 'Excel file is empty or has no data rows' });

            // Normalise header names
            const normalise = (obj) => {
                const out = {};
                for (const k of Object.keys(obj)) {
                    const key = k.toLowerCase().replace(/[\s_-]/g, '');
                    out[key] = String(obj[k]).trim();
                }
                return out;
            };

            const stats = {
                total: rows.length,
                enrolled: 0,
                already_enrolled: 0,
                not_found: 0,
                errors: []
            };

            for (const raw of rows) {
                const row = normalise(raw);
                // Try different common column names
                const regNum = row['regnumber'] || row['registrationnumber'] || row['regno'] || '';
                const email  = row['email'] || '';

                if (!regNum && !email) {
                    stats.not_found++;
                    stats.errors.push(`Row skipped – no reg_number or email found`);
                    continue;
                }

                // Find the student account
                let student = null;
                if (regNum) {
                    const [r] = await pool.query(
                        "SELECT id FROM users WHERE reg_number = ? AND role = 'student'",
                        [regNum]
                    );
                    if (r.length > 0) student = r[0];
                }
                if (!student && email) {
                    const [r] = await pool.query(
                        "SELECT id FROM users WHERE email = ? AND role = 'student'",
                        [email]
                    );
                    if (r.length > 0) student = r[0];
                }

                if (!student) {
                    stats.not_found++;
                    stats.errors.push(`Student not found: ${regNum || email} (they must register first)`);
                    continue;
                }

                // Check existing enrollment
                const [existing] = await pool.query(
                    'SELECT id FROM enrollments WHERE course_id = ? AND student_id = ?',
                    [courseId, student.id]
                );
                if (existing.length > 0) {
                    stats.already_enrolled++;
                    continue;
                }

                // Enroll
                await pool.query(
                    'INSERT INTO enrollments (course_id, student_id) VALUES (?, ?)',
                    [courseId, student.id]
                );
                stats.enrolled++;
            }

            // Log the upload
            await pool.query(
                `INSERT INTO excel_upload_logs
                    (course_id, uploaded_by, filename, total_rows, enrolled_count, not_found_count, already_enrolled_count)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [courseId, req.user.id, req.file.originalname, stats.total, stats.enrolled, stats.not_found, stats.already_enrolled]
            );

            res.json({
                message: 'Upload processed successfully',
                stats,
                sample_errors: stats.errors.slice(0, 10)
            });
        } catch (error) {
            console.error('Excel upload error:', error);
            res.status(500).json({ error: 'Failed to process Excel file' });
        }
    }
);

// ==================== HELPERS ====================

/**
 * Haversine formula – returns distance in metres between two GPS coordinates.
 */
function haversineMetres(lat1, lng1, lat2, lng2) {
    const R    = 6371000; // Earth radius in metres
    const toRad = d => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Generate a short secure token for rotating QR (16 hex chars).
 */
function newRotatingToken() {
    return require('crypto').randomBytes(8).toString('hex');
}

// ==================== SESSION & QR CODE ROUTES ====================

/**
 * POST /api/sessions
 * Create an attendance session.
 * Supports GPS lock: { gps_required, gps_lat, gps_lng, gps_radius_metres }
 * Rotating QR is always enabled – first token is generated here.
 */
app.post('/api/sessions', authenticateToken, requireRole('lecturer', 'admin'), async (req, res) => {
    try {
        const {
            course_id, session_title, duration_minutes = 15,
            gps_required = false, gps_lat, gps_lng, gps_radius_metres = 100
        } = req.body;

        if (!course_id) return res.status(400).json({ error: 'Course ID is required' });

        if (req.user.role === 'lecturer') {
            const [own] = await pool.query(
                'SELECT id FROM courses WHERE id = ? AND lecturer_id = ?',
                [course_id, req.user.id]
            );
            if (own.length === 0)
                return res.status(403).json({ error: 'You do not own this course' });
        }

        // Validate GPS fields if GPS lock is on
        if (gps_required && (gps_lat == null || gps_lng == null))
            return res.status(400).json({ error: 'GPS coordinates are required when GPS lock is enabled' });

        const sessionCode   = uuidv4();
        const expiresAt     = new Date(Date.now() + duration_minutes * 60 * 1000);
        const firstToken    = newRotatingToken();
        const tokenRotatedAt = new Date();

        const [result] = await pool.query(
            `INSERT INTO attendance_sessions
               (course_id, session_code, session_title, expires_at, created_by,
                gps_required, gps_lat, gps_lng, gps_radius_metres,
                current_token, token_rotated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                course_id,
                sessionCode,
                session_title || `Session ${new Date().toLocaleDateString()}`,
                expiresAt,
                req.user.id,
                gps_required ? 1 : 0,
                gps_required ? gps_lat  : null,
                gps_required ? gps_lng  : null,
                gps_required ? gps_radius_metres : 100,
                firstToken,
                tokenRotatedAt
            ]
        );

        // Build the first QR payload
        const qrPayload = JSON.stringify({
            session_id:   result.insertId,
            session_code: sessionCode,
            token:        firstToken,
            course_id
        });
        const qrCodeImage = await QRCode.toDataURL(qrPayload, { width: 300, margin: 2 });

        res.status(201).json({
            message: 'Session created successfully',
            session: {
                id:            result.insertId,
                session_code:  sessionCode,
                expires_at:    expiresAt,
                gps_required:  gps_required,
                gps_lat:       gps_required ? gps_lat  : null,
                gps_lng:       gps_required ? gps_lng  : null,
                gps_radius_metres: gps_required ? gps_radius_metres : 100,
                current_token: firstToken,
                token_rotated_at: tokenRotatedAt,
                qr_code:       qrCodeImage
            }
        });
    } catch (error) {
        console.error('Create session error:', error);
        res.status(500).json({ error: 'Failed to create session' });
    }
});

/**
 * GET /api/sessions/:id/token
 * Called by the lecturer's display every 10 seconds.
 * Rotates the token if it's older than 10 seconds, then returns
 * the current token as a freshly-generated QR image.
 *
 * This is what makes screenshot-sharing useless:
 * the QR changes before a forwarded image can be used.
 */
const TOKEN_ROTATE_MS = 10000; // 10 seconds

app.get('/api/sessions/:id/token', authenticateToken, requireRole('lecturer', 'admin'), async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM attendance_sessions WHERE id = ?',
            [req.params.id]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'Session not found' });

        const session = rows[0];

        if (new Date() > new Date(session.expires_at))
            return res.status(410).json({ error: 'Session has expired' });

        // Rotate token if older than TOKEN_ROTATE_MS
        const age = Date.now() - new Date(session.token_rotated_at).getTime();
        let token = session.current_token;

        if (age >= TOKEN_ROTATE_MS) {
            token = newRotatingToken();
            await pool.query(
                'UPDATE attendance_sessions SET current_token = ?, token_rotated_at = NOW() WHERE id = ?',
                [token, session.id]
            );
        }

        const qrPayload = JSON.stringify({
            session_id:   session.id,
            session_code: session.session_code,
            token,
            course_id:    session.course_id
        });
        const qrCodeImage = await QRCode.toDataURL(qrPayload, {
            width: 350, margin: 2,
            color: { dark: '#000000', light: '#ffffff' }
        });

        res.json({
            token,
            qr_code:           qrCodeImage,
            token_rotated_at:  new Date(),
            next_rotation_ms:  TOKEN_ROTATE_MS,
            expires_at:        session.expires_at,
            gps_required:      !!session.gps_required,
            gps_lat:           session.gps_lat,
            gps_lng:           session.gps_lng,
            gps_radius_metres: session.gps_radius_metres
        });
    } catch (error) {
        console.error('Get token error:', error);
        res.status(500).json({ error: 'Failed to fetch token' });
    }
});

// Get sessions for a course
app.get('/api/courses/:id/sessions', authenticateToken, async (req, res) => {
    try {
        const [sessions] = await pool.query(
            `SELECT s.*,
                    (SELECT COUNT(*) FROM attendance_records WHERE session_id = s.id) AS attendance_count
             FROM attendance_sessions s
             WHERE s.course_id = ?
             ORDER BY s.created_at DESC`,
            [req.params.id]
        );
        res.json(sessions);
    } catch (error) {
        console.error('Get sessions error:', error);
        res.status(500).json({ error: 'Failed to fetch sessions' });
    }
});

// Get QR code for a session
app.get('/api/sessions/:id/qrcode', authenticateToken, requireRole('lecturer', 'admin'), async (req, res) => {
    try {
        const [sessions] = await pool.query('SELECT * FROM attendance_sessions WHERE id = ?', [req.params.id]);
        if (sessions.length === 0) return res.status(404).json({ error: 'Session not found' });

        const session = sessions[0];
        const qrData  = JSON.stringify({
            session_id: session.id,
            session_code: session.session_code,
            course_id: session.course_id,
            expires_at: session.expires_at
        });

        const qrCodeImage = await QRCode.toDataURL(qrData, { width: 400, margin: 2 });

        res.json({ session, qr_code: qrCodeImage, is_expired: new Date() > new Date(session.expires_at) });
    } catch (error) {
        console.error('Get QR code error:', error);
        res.status(500).json({ error: 'Failed to generate QR code' });
    }
});

// ==================== ATTENDANCE ROUTES ====================

/**
 * POST /api/attendance/mark
 * Student marks attendance after scanning the rotating QR.
 *
 * Body: { session_id, session_code, token, student_lat?, student_lng? }
 *
 * Checks (in order):
 *  1. Session exists and is not expired
 *  2. Rotating token matches the current token in DB (anti-sharing)
 *  3. Student is enrolled
 *  4. Not already marked
 *  5. GPS check – if gps_required, student must be within radius (GPS sent by browser)
 */
app.post('/api/attendance/mark', authenticateToken, requireRole('student'), async (req, res) => {
    try {
        const { session_id, session_code, token, student_lat, student_lng } = req.body;

        if (!session_id || !session_code || !token)
            return res.status(400).json({ error: 'session_id, session_code and token are required' });

        // 1. Fetch session
        const [sessions] = await pool.query(
            'SELECT * FROM attendance_sessions WHERE id = ? AND session_code = ?',
            [session_id, session_code]
        );
        if (sessions.length === 0)
            return res.status(404).json({ error: 'Invalid QR code – session not found' });

        const session = sessions[0];

        // 2. Check expiry
        if (new Date() > new Date(session.expires_at))
            return res.status(410).json({ error: 'This attendance session has expired' });

        // 3. Validate rotating token  ← anti-screenshot / anti-sharing
        if (token !== session.current_token)
            return res.status(403).json({
                error: 'QR code has expired – please scan the live QR code on the screen',
                code: 'TOKEN_MISMATCH'
            });

        // 4. Enrolment check
        const [enrolled] = await pool.query(
            'SELECT id FROM enrollments WHERE course_id = ? AND student_id = ?',
            [session.course_id, req.user.id]
        );
        if (enrolled.length === 0)
            return res.status(403).json({ error: 'You are not enrolled in this course' });

        // 5. Duplicate check
        const [existing] = await pool.query(
            'SELECT id FROM attendance_records WHERE session_id = ? AND student_id = ?',
            [session_id, req.user.id]
        );
        if (existing.length > 0)
            return res.status(409).json({ error: 'Attendance already marked for this session' });

        // 6. GPS location check
        let distanceMetres = null;
        let gpsVerified    = false;

        if (session.gps_required) {
            if (student_lat == null || student_lng == null)
                return res.status(400).json({
                    error: 'Your location is required for this class. Please enable GPS and try again.',
                    code: 'GPS_REQUIRED'
                });

            distanceMetres = Math.round(haversineMetres(
                parseFloat(session.gps_lat),
                parseFloat(session.gps_lng),
                parseFloat(student_lat),
                parseFloat(student_lng)
            ));

            gpsVerified = distanceMetres <= session.gps_radius_metres;

            if (!gpsVerified)
                return res.status(403).json({
                    error: `You are too far from the classroom (${distanceMetres}m away, limit is ${session.gps_radius_metres}m). Move closer and try again.`,
                    code:  'OUT_OF_RANGE',
                    distance_metres: distanceMetres,
                    allowed_metres:  session.gps_radius_metres
                });
        }

        // 7. All checks passed – record attendance
        await pool.query(
            `INSERT INTO attendance_records
               (session_id, student_id, course_id, student_lat, student_lng, distance_metres, gps_verified)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                session_id,
                req.user.id,
                session.course_id,
                student_lat  ?? null,
                student_lng  ?? null,
                distanceMetres,
                gpsVerified ? 1 : 0
            ]
        );

        res.status(201).json({
            message: 'Attendance marked successfully ✓',
            marked_at:       new Date(),
            distance_metres: distanceMetres,
            gps_verified:    gpsVerified
        });
    } catch (error) {
        console.error('Mark attendance error:', error);
        res.status(500).json({ error: 'Failed to mark attendance' });
    }
});

// Get attendance for a session (includes GPS audit data for lecturer)
app.get('/api/sessions/:id/attendance', authenticateToken, requireRole('lecturer', 'admin'), async (req, res) => {
    try {
        const [records] = await pool.query(
            `SELECT ar.*, u.full_name, u.reg_number, u.email
             FROM attendance_records ar
             JOIN users u ON ar.student_id = u.id
             WHERE ar.session_id = ?
             ORDER BY ar.marked_at`,
            [req.params.id]
        );
        res.json(records);
    } catch (error) {
        console.error('Get attendance error:', error);
        res.status(500).json({ error: 'Failed to fetch attendance records' });
    }
});

// Student attendance history
app.get('/api/attendance/history', authenticateToken, requireRole('student'), async (req, res) => {
    try {
        const [records] = await pool.query(
            `SELECT ar.*, c.course_code, c.course_title, s.session_title
             FROM attendance_records ar
             JOIN courses c ON ar.course_id = c.id
             JOIN attendance_sessions s ON ar.session_id = s.id
             WHERE ar.student_id = ?
             ORDER BY ar.marked_at DESC`,
            [req.user.id]
        );
        res.json(records);
    } catch (error) {
        console.error('Get history error:', error);
        res.status(500).json({ error: 'Failed to fetch attendance history' });
    }
});

// Attendance report for a course
app.get('/api/courses/:id/attendance-report', authenticateToken, requireRole('lecturer', 'admin'), async (req, res) => {
    try {
        const courseId = req.params.id;

        const [sessions] = await pool.query(
            'SELECT id, session_title, created_at FROM attendance_sessions WHERE course_id = ? ORDER BY created_at',
            [courseId]
        );
        const [students] = await pool.query(
            `SELECT u.id, u.full_name, u.reg_number
             FROM users u JOIN enrollments e ON u.id = e.student_id
             WHERE e.course_id = ? ORDER BY u.full_name`,
            [courseId]
        );
        const [records] = await pool.query(
            'SELECT student_id, session_id FROM attendance_records WHERE course_id = ?',
            [courseId]
        );

        const attendanceMap = {};
        records.forEach(r => { attendanceMap[`${r.student_id}-${r.session_id}`] = true; });

        const report = students.map(student => {
            const attendance   = sessions.map(s => ({ session_id: s.id, session_title: s.session_title, present: !!attendanceMap[`${student.id}-${s.id}`] }));
            const totalPresent = attendance.filter(a => a.present).length;
            const percentage   = sessions.length > 0 ? Math.round((totalPresent / sessions.length) * 100) : 0;
            return { ...student, attendance, total_present: totalPresent, total_sessions: sessions.length, percentage };
        });

        res.json({ course_id: courseId, sessions, students: report });
    } catch (error) {
        console.error('Get report error:', error);
        res.status(500).json({ error: 'Failed to generate report' });
    }
});

// ==================== ADMIN ROUTES ====================

// Get all users
app.get('/api/admin/users', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const [users] = await pool.query(
            `SELECT u.id, u.email, u.full_name, u.reg_number, u.role, u.department, u.faculty, u.level, u.is_active, u.created_at,
                    a.full_name AS created_by_name
             FROM users u
             LEFT JOIN users a ON u.created_by = a.id
             ORDER BY u.role, u.full_name`
        );
        res.json(users);
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Admin: Create lecturer account
app.post('/api/admin/lecturers', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const { email, password, full_name, department, faculty, phone } = req.body;

        if (!email || !password || !full_name)
            return res.status(400).json({ error: 'Email, password and full name are required' });

        const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0)
            return res.status(409).json({ error: 'Email already registered' });

        const hashedPassword = await bcrypt.hash(password, 10);

        const [result] = await pool.query(
            `INSERT INTO users (email, password, full_name, role, department, faculty, phone, created_by)
             VALUES (?, ?, ?, 'lecturer', ?, ?, ?, ?)`,
            [email, hashedPassword, full_name, department || null, faculty || null, phone || null, req.user.id]
        );

        res.status(201).json({
            message: 'Lecturer account created successfully',
            lecturer: { id: result.insertId, email, full_name, role: 'lecturer' }
        });
    } catch (error) {
        console.error('Create lecturer error:', error);
        res.status(500).json({ error: 'Failed to create lecturer account' });
    }
});

// Admin: Toggle user active status
app.patch('/api/admin/users/:id/toggle-status', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const [users] = await pool.query('SELECT id, is_active FROM users WHERE id = ?', [req.params.id]);
        if (users.length === 0) return res.status(404).json({ error: 'User not found' });

        const newStatus = !users[0].is_active;
        await pool.query('UPDATE users SET is_active = ? WHERE id = ?', [newStatus, req.params.id]);

        res.json({ message: `User ${newStatus ? 'activated' : 'deactivated'} successfully`, is_active: newStatus });
    } catch (error) {
        console.error('Toggle status error:', error);
        res.status(500).json({ error: 'Failed to update user status' });
    }
});

// Admin: Delete user
app.delete('/api/admin/users/:id', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        if (Number(req.params.id) === req.user.id)
            return res.status(400).json({ error: 'Cannot delete your own account' });

        await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]);
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// Admin dashboard stats
app.get('/api/admin/stats', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const [[{ total_students  }]] = await pool.query("SELECT COUNT(*) AS total_students  FROM users WHERE role = 'student'");
        const [[{ total_lecturers }]] = await pool.query("SELECT COUNT(*) AS total_lecturers FROM users WHERE role = 'lecturer'");
        const [[{ total_courses   }]] = await pool.query('SELECT COUNT(*) AS total_courses   FROM courses');
        const [[{ total_sessions  }]] = await pool.query('SELECT COUNT(*) AS total_sessions  FROM attendance_sessions');
        const [[{ total_attendance}]] = await pool.query('SELECT COUNT(*) AS total_attendance FROM attendance_records');

        res.json({ total_students, total_lecturers, total_courses, total_sessions, total_attendance });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

// Admin: Get all lecturers (for course-assignment dropdown)
app.get('/api/admin/lecturers', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const [lecturers] = await pool.query(
            "SELECT id, full_name, email, department, faculty FROM users WHERE role = 'lecturer' AND is_active = TRUE ORDER BY full_name"
        );
        res.json(lecturers);
    } catch (error) {
        console.error('Get lecturers error:', error);
        res.status(500).json({ error: 'Failed to fetch lecturers' });
    }
});

// Admin: Create and assign a course to a lecturer
app.post('/api/admin/courses', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const { course_code, course_title, lecturer_id, department, faculty, level, semester, academic_year } = req.body;

        if (!course_code || !course_title || !lecturer_id)
            return res.status(400).json({ error: 'Course code, title and lecturer are required' });

        // Verify lecturer exists
        const [lec] = await pool.query("SELECT id FROM users WHERE id = ? AND role = 'lecturer'", [lecturer_id]);
        if (lec.length === 0)
            return res.status(404).json({ error: 'Lecturer not found' });

        const [result] = await pool.query(
            `INSERT INTO courses (course_code, course_title, lecturer_id, department, faculty, level, semester, academic_year)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [course_code, course_title, lecturer_id, department || null, faculty || null, level || null, semester || null, academic_year || null]
        );

        res.status(201).json({ message: 'Course created and assigned successfully', courseId: result.insertId });
    } catch (error) {
        console.error('Create course error:', error);
        res.status(500).json({ error: 'Failed to create course' });
    }
});

// Admin: Get all courses
app.get('/api/admin/courses', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const [courses] = await pool.query(
            `SELECT c.*, u.full_name AS lecturer_name,
                    (SELECT COUNT(*) FROM enrollments WHERE course_id = c.id) AS student_count
             FROM courses c
             JOIN users u ON c.lecturer_id = u.id
             ORDER BY c.created_at DESC`
        );
        res.json(courses);
    } catch (error) {
        console.error('Get all courses error:', error);
        res.status(500).json({ error: 'Failed to fetch courses' });
    }
});

// Admin: Delete a course
app.delete('/api/admin/courses/:id', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        await pool.query('DELETE FROM courses WHERE id = ?', [req.params.id]);
        res.json({ message: 'Course deleted successfully' });
    } catch (error) {
        console.error('Delete course error:', error);
        res.status(500).json({ error: 'Failed to delete course' });
    }
});

// ==================== ERROR HANDLER ====================
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
    console.log(`QR Attendance Server running on http://localhost:${PORT}`);
});

module.exports = app;
