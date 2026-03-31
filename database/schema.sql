-- ============================================================
-- QR CODE ATTENDANCE MANAGEMENT SYSTEM DATABASE
-- Bayero University Kano
-- Updated: Admin creates lecturers + assigns courses,
--          Lecturers upload Excel to enroll students,
--          Students self-register but cannot pick courses.
--          NEW: GPS Location Lock + Rotating QR anti-sharing.
-- ============================================================

CREATE DATABASE IF NOT EXISTS qr_attendance_db;
USE qr_attendance_db;

-- ============================================================
-- USERS TABLE
-- Students: self-register
-- Lecturers: created by admin only
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    reg_number VARCHAR(50) UNIQUE,
    role ENUM('student', 'lecturer', 'admin') NOT NULL DEFAULT 'student',
    department VARCHAR(100),
    faculty VARCHAR(100),
    level VARCHAR(20),
    phone VARCHAR(20),
    profile_image VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_by INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_email (email),
    INDEX idx_role (role),
    INDEX idx_reg_number (reg_number)
);

-- ============================================================
-- COURSES TABLE
-- Created and assigned to lecturers by admin only.
-- ============================================================
CREATE TABLE IF NOT EXISTS courses (
    id INT PRIMARY KEY AUTO_INCREMENT,
    course_code VARCHAR(20) NOT NULL,
    course_title VARCHAR(200) NOT NULL,
    lecturer_id INT NOT NULL,
    department VARCHAR(100),
    faculty VARCHAR(100),
    level VARCHAR(20),
    semester VARCHAR(50),
    academic_year VARCHAR(20),
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (lecturer_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_course_code (course_code),
    INDEX idx_lecturer (lecturer_id)
);

-- ============================================================
-- ENROLLMENTS TABLE
-- Students enrolled by lecturer Excel upload only.
-- No self-enrollment.
-- ============================================================
CREATE TABLE IF NOT EXISTS enrollments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    course_id INT NOT NULL,
    student_id INT NOT NULL,
    enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_enrollment (course_id, student_id),
    INDEX idx_course (course_id),
    INDEX idx_student (student_id)
);

-- ============================================================
-- EXCEL UPLOAD LOGS TABLE
-- Tracks all student Excel uploads by lecturers
-- ============================================================
CREATE TABLE IF NOT EXISTS excel_upload_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    course_id INT NOT NULL,
    uploaded_by INT NOT NULL,
    filename VARCHAR(255),
    total_rows INT DEFAULT 0,
    matched_count INT DEFAULT 0,
    enrolled_count INT DEFAULT 0,
    not_found_count INT DEFAULT 0,
    already_enrolled_count INT DEFAULT 0,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================
-- ATTENDANCE SESSIONS TABLE
-- GPS lock: if gps_required=TRUE, students must be within
--           gps_radius_metres of (gps_lat, gps_lng) to mark.
-- Rotating QR: current_token changes every ~10 seconds.
--              token_rotated_at tracks when it last changed.
-- ============================================================
CREATE TABLE IF NOT EXISTS attendance_sessions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    course_id INT NOT NULL,
    session_code VARCHAR(100) UNIQUE NOT NULL,
    session_title VARCHAR(200),
    session_date DATE,
    start_time TIME,
    end_time TIME,
    expires_at DATETIME NOT NULL,
    location VARCHAR(200),
    is_active BOOLEAN DEFAULT TRUE,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- GPS lock fields
    gps_required      BOOLEAN         DEFAULT FALSE,
    gps_lat           DECIMAL(10, 8)  DEFAULT NULL,
    gps_lng           DECIMAL(11, 8)  DEFAULT NULL,
    gps_radius_metres INT             DEFAULT 100,

    -- Rotating QR fields
    current_token     VARCHAR(64)     DEFAULT NULL,
    token_rotated_at  DATETIME        DEFAULT NULL,

    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_session_code (session_code),
    INDEX idx_course (course_id),
    INDEX idx_expires (expires_at),
    INDEX idx_token (current_token)
);

-- ============================================================
-- ATTENDANCE RECORDS TABLE
-- Stores student GPS at time of scan + distance from classroom.
-- ============================================================
CREATE TABLE IF NOT EXISTS attendance_records (
    id INT PRIMARY KEY AUTO_INCREMENT,
    session_id INT NOT NULL,
    student_id INT NOT NULL,
    course_id INT NOT NULL,
    marked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(50),
    device_info VARCHAR(255),
    -- Student's GPS at scan time
    student_lat     DECIMAL(10, 8) DEFAULT NULL,
    student_lng     DECIMAL(11, 8) DEFAULT NULL,
    distance_metres INT           DEFAULT NULL,   -- calculated distance from classroom
    gps_verified    BOOLEAN       DEFAULT FALSE,  -- TRUE = was within allowed radius

    FOREIGN KEY (session_id) REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    UNIQUE KEY unique_attendance (session_id, student_id),
    INDEX idx_session (session_id),
    INDEX idx_student (student_id),
    INDEX idx_course (course_id),
    INDEX idx_marked_at (marked_at)
);

-- ============================================================
-- ACTIVITY LOGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS activity_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    action VARCHAR(100) NOT NULL,
    description TEXT,
    ip_address VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user (user_id),
    INDEX idx_action (action),
    INDEX idx_created (created_at)
);

-- ============================================================
-- DEFAULT ADMIN USER  (password: admin123)
-- ============================================================
INSERT INTO users (email, password, full_name, role, department, faculty) VALUES
('admin@buk.edu.ng', '$2a$10$ZVKSkyBvBfbRQsKVAZflbeWAKL92C1J2d16Si2.u.1j7pQzwi9pHy', 'System Administrator', 'admin', 'ICT Directorate', 'Administration');

-- ============================================================
-- SAMPLE LECTURERS  (created by admin, password: password123)
-- ============================================================
INSERT INTO users (email, password, full_name, role, department, faculty, created_by) VALUES
('lecturer1@buk.edu.ng', '$2a$10$AUbDCfoqc.WKu8nRNm93PeLTzC7nRwQvCPrVCekbN/WO6DR/L5HaC', 'Dr. Aminu Ibrahim',  'lecturer', 'Computer Science', 'Computing', 1),
('lecturer2@buk.edu.ng', '$2a$10$AUbDCfoqc.WKu8nRNm93PeLTzC7nRwQvCPrVCekbN/WO6DR/L5HaC', 'Dr. Fatima Sani',    'lecturer', 'Computer Science', 'Computing', 1);

-- ============================================================
-- SAMPLE STUDENTS  (self-registered, password: password123)
-- ============================================================
INSERT INTO users (email, password, full_name, reg_number, role, department, faculty, level) VALUES
('student1@buk.edu.ng', '$2a$10$AUbDCfoqc.WKu8nRNm93PeLTzC7nRwQvCPrVCekbN/WO6DR/L5HaC', 'Muhammad Abdullahi', 'BUK/CS/20/1001', 'student', 'Computer Science', 'Computing', '400'),
('student2@buk.edu.ng', '$2a$10$AUbDCfoqc.WKu8nRNm93PeLTzC7nRwQvCPrVCekbN/WO6DR/L5HaC', 'Aisha Bello',        'BUK/CS/20/1002', 'student', 'Computer Science', 'Computing', '400'),
('student3@buk.edu.ng', '$2a$10$AUbDCfoqc.WKu8nRNm93PeLTzC7nRwQvCPrVCekbN/WO6DR/L5HaC', 'Ibrahim Musa',       'BUK/CS/20/1003', 'student', 'Computer Science', 'Computing', '400');

-- ============================================================
-- SAMPLE COURSES  (created and assigned by admin)
-- ============================================================
INSERT INTO courses (course_code, course_title, lecturer_id, department, faculty, level, semester) VALUES
('CSC 401', 'Software Engineering',         2, 'Computer Science', 'Computing', '400', 'First Semester'),
('CSC 403', 'Database Management Systems',  2, 'Computer Science', 'Computing', '400', 'First Semester'),
('CSC 405', 'Computer Networks',            3, 'Computer Science', 'Computing', '400', 'First Semester'),
('CSC 407', 'Artificial Intelligence',      2, 'Computer Science', 'Computing', '400', 'First Semester'),
('CSC 409', 'Project',                      3, 'Computer Science', 'Computing', '400', 'Second Semester');

-- ============================================================
-- SAMPLE ENROLLMENTS (enrolled via lecturer Excel upload)
-- ============================================================
INSERT INTO enrollments (course_id, student_id) VALUES
(1, 4), (1, 5), (1, 6),
(2, 4), (2, 5), (2, 6),
(3, 4), (3, 5);

-- ============================================================
-- VIEWS
-- ============================================================
CREATE OR REPLACE VIEW vw_course_attendance_summary AS
SELECT
    c.id AS course_id,
    c.course_code,
    c.course_title,
    u.full_name AS lecturer_name,
    COUNT(DISTINCT e.student_id)  AS enrolled_students,
    COUNT(DISTINCT s.id)          AS total_sessions,
    COUNT(DISTINCT ar.id)         AS total_attendance_records
FROM courses c
JOIN users u ON c.lecturer_id = u.id
LEFT JOIN enrollments e ON c.id = e.course_id
LEFT JOIN attendance_sessions s ON c.id = s.course_id
LEFT JOIN attendance_records ar ON s.id = ar.session_id
GROUP BY c.id, c.course_code, c.course_title, u.full_name;

CREATE OR REPLACE VIEW vw_student_attendance_summary AS
SELECT
    u.id AS student_id,
    u.full_name,
    u.reg_number,
    c.course_code,
    c.course_title,
    COUNT(DISTINCT s.id)  AS total_sessions,
    COUNT(DISTINCT ar.id) AS sessions_attended,
    ROUND((COUNT(DISTINCT ar.id) / NULLIF(COUNT(DISTINCT s.id), 0)) * 100, 2) AS attendance_percentage
FROM users u
JOIN enrollments e ON u.id = e.student_id
JOIN courses c ON e.course_id = c.id
LEFT JOIN attendance_sessions s ON c.id = s.course_id
LEFT JOIN attendance_records ar ON s.id = ar.session_id AND ar.student_id = u.id
WHERE u.role = 'student'
GROUP BY u.id, u.full_name, u.reg_number, c.course_code, c.course_title;
