# QR Code Attendance Management System
## Bayero University Kano

A web-based attendance management system that uses QR code technology to streamline student attendance tracking.

---

## 📋 Table of Contents
- [Features](#features)
- [Technology Stack](#technology-stack)
- [System Requirements](#system-requirements)
- [Installation Guide](#installation-guide)
- [Database Setup](#database-setup)
- [Running the Application](#running-the-application)
- [User Guide](#user-guide)
- [API Documentation](#api-documentation)
- [Screenshots](#screenshots)
- [Project Structure](#project-structure)

---

## ✨ Features

### For Students
- ✅ Scan QR codes to mark attendance using smartphone camera
- ✅ View attendance history across all enrolled courses
- ✅ View enrolled courses and lecturer details
- ✅ Real-time attendance confirmation
- ✅ Personal dashboard with attendance statistics

### For Lecturers
- ✅ Create and manage courses
- ✅ Generate time-limited QR codes for attendance sessions
- ✅ View real-time attendance as students scan
- ✅ Generate attendance reports with statistics
- ✅ Export attendance data
- ✅ Track attendance percentages per student

### For Administrators
- ✅ Manage all users (students, lecturers)
- ✅ View all courses and attendance data
- ✅ System-wide statistics dashboard
- ✅ User management capabilities

### Security Features
- ✅ Time-limited QR codes (configurable expiry)
- ✅ Unique session codes prevent reuse
- ✅ JWT-based authentication
- ✅ Password hashing with bcrypt
- ✅ Role-based access control

---

## 🛠 Technology Stack

### Backend
- **Node.js** - JavaScript runtime
- **Express.js** - Web application framework
- **MySQL** - Relational database
- **JWT** - JSON Web Tokens for authentication
- **bcryptjs** - Password hashing
- **qrcode** - QR code generation

### Frontend
- **HTML5** - Markup
- **CSS3** - Styling with Bootstrap 5
- **JavaScript** - Client-side logic
- **html5-qrcode** - QR code scanning library
- **Bootstrap 5** - UI framework
- **Font Awesome 6** - Icons

---

## 💻 System Requirements

- **Node.js** v14 or higher
- **MySQL** v8.0 or higher (or XAMPP/WAMP with MySQL)
- **Modern web browser** (Chrome, Firefox, Edge, Safari)
- **Smartphone with camera** (for scanning QR codes)

---

## 📥 Installation Guide

### Step 1: Install Node.js
1. Download Node.js from https://nodejs.org/
2. Install and verify installation:
   ```bash
   node --version
   npm --version
   ```

### Step 2: Install MySQL
**Option A: Install XAMPP (Recommended for beginners)**
1. Download XAMPP from https://www.apachefriends.org/
2. Install and start Apache and MySQL services

**Option B: Install MySQL directly**
1. Download MySQL from https://dev.mysql.com/downloads/
2. Install and start MySQL service

### Step 3: Clone/Download the Project
```bash
# If using git
git clone [repository-url]

# Or extract the downloaded zip file
```

### Step 4: Install Backend Dependencies
```bash
cd qr_attendance_system/backend
npm install
```

---

## 🗄 Database Setup

### Step 1: Create Database
1. Open phpMyAdmin (http://localhost/phpmyadmin) or MySQL command line
2. Create a new database named `qr_attendance_db`

### Step 2: Import Schema
1. Open the file `database/schema.sql`
2. Copy all contents
3. Paste and execute in phpMyAdmin SQL tab or MySQL command line

**Using MySQL Command Line:**
```bash
mysql -u root -p < database/schema.sql
```

### Step 3: Configure Database Connection
Edit `backend/server.js` and update the database connection settings if needed:
```javascript
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',  // Add your MySQL password if set
    database: 'qr_attendance_db',
    ...
});
```

---

## 🚀 Running the Application

### Step 1: Start the Backend Server
```bash
cd backend
npm start
```
You should see: `QR Attendance Server running on http://localhost:3000`

### Step 2: Open the Frontend
Open `frontend/index.html` in your web browser

**For local development, you can use:**
- Simply double-click `index.html`
- Or use a local server like Live Server (VS Code extension)

### Step 3: Login with Default Credentials
**Admin Account:**
- Email: admin@buk.edu.ng
- Password: admin123

**Note:** Create new lecturer and student accounts through the registration page.

---

## 📖 User Guide

### For Students

#### Registration
1. Click "Register" on the login page
2. Fill in your details:
   - Full Name
   - Email (use your university email)
   - Password
   - Role: Student
   - Registration Number
   - Faculty, Department, Level
3. Click Register and login with your credentials

#### Marking Attendance
1. Login to your account
2. Click "Scan Attendance" in the sidebar
3. Click "Start Scanner" to activate your camera
4. Point your camera at the QR code displayed by your lecturer
5. Wait for confirmation message
6. Your attendance is automatically recorded!

#### Viewing Attendance History
1. Click "My Attendance" in the sidebar
2. View all your attendance records with dates and times

### For Lecturers

#### Creating a Course
1. Login and go to "My Courses"
2. Click "Add Course"
3. Fill in course details (code, title, level, semester)
4. Click Add Course

#### Generating QR Code for Attendance
1. Go to "Generate QR Code"
2. Select your course
3. Enter a session title (e.g., "Week 5 Lecture")
4. Set QR code validity duration (5-120 minutes)
5. Click "Generate QR Code"
6. Display the QR code to students (project on screen or print)

#### Viewing Attendance Records
1. Go to "View Attendance"
2. Select Course and Session
3. View list of students who marked attendance

#### Generating Reports
1. Go to "Reports"
2. Select a course
3. View attendance summary with percentages
4. Click "Print Report" to print

---

## 📡 API Documentation

### Authentication Endpoints

#### POST /api/auth/register
Register a new user
```json
{
  "email": "student@buk.edu.ng",
  "password": "password123",
  "full_name": "John Doe",
  "role": "student",
  "reg_number": "BUK/CS/20/1001",
  "department": "Computer Science",
  "faculty": "Computing",
  "level": "400"
}
```

#### POST /api/auth/login
Login and get JWT token
```json
{
  "email": "student@buk.edu.ng",
  "password": "password123"
}
```

### Course Endpoints

#### GET /api/courses
Get all courses for logged-in user

#### POST /api/courses
Create a new course (Lecturers only)
```json
{
  "course_code": "CSC 401",
  "course_title": "Software Engineering",
  "department": "Computer Science",
  "faculty": "Computing",
  "level": "400",
  "semester": "First"
}
```

### Session Endpoints

#### POST /api/sessions
Create attendance session and generate QR code
```json
{
  "course_id": 1,
  "session_title": "Week 5 Lecture",
  "duration_minutes": 15
}
```

### Attendance Endpoints

#### POST /api/attendance/mark
Mark attendance (Students only)
```json
{
  "session_id": 1,
  "session_code": "uuid-session-code"
}
```

#### GET /api/attendance/history
Get student's attendance history

#### GET /api/sessions/:id/attendance
Get attendance records for a session (Lecturers only)

#### GET /api/courses/:id/attendance-report
Get full attendance report for a course

---

## 📁 Project Structure

```
qr_attendance_system/
├── backend/
│   ├── server.js          # Main server file with all API routes
│   └── package.json       # Node.js dependencies
│
├── frontend/
│   ├── index.html         # Main HTML file with all pages
│   └── app.js             # Frontend JavaScript logic
│
├── database/
│   └── schema.sql         # MySQL database schema
│
├── docs/
│   └── ...                # Documentation files
│
└── README.md              # This file
```

---

## 🔧 Troubleshooting

### "Connection refused" error
- Ensure MySQL server is running
- Check database credentials in server.js

### QR Scanner not working
- Ensure you're using HTTPS or localhost (camera requires secure context)
- Grant camera permissions when prompted
- Try a different browser

### "Token expired" error
- Login again to get a new token
- Tokens expire after 24 hours

---

## 📞 Support

For technical support or questions about this project, please contact:
- Email: [your-email]
- Department: [your-department]
- Supervisor: [supervisor-name]

---

## 📄 License

This project is developed as a final year project for Bayero University, Kano.

---

## 🙏 Acknowledgments

- Bayero University, Kano
- Department of Computer Science
- Project Supervisor
- All contributors and testers

---

**Developed by [Your Name]**
**Registration Number: [Your Reg Number]**
**Bayero University, Kano**
**2024**
