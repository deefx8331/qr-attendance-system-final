// ============================================================
// QR ATTENDANCE SYSTEM – FRONTEND
// Bayero University Kano
// Features: GPS Location Lock + Rotating QR Anti-Sharing
// ============================================================

// Dynamic API URL - works locally and on Vercel
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:3000/api' 
    : 'https://qr-attendance-system-final.vercel.app/api';
let currentUser        = null;
let authToken          = null;
let html5QrCode        = null;
let selectedUploadFile = null;

// Rotating QR state
let rotatingSessionId   = null;
let rotatingIntervalId  = null;
let rotatingExpiryId    = null;

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
    const savedToken = localStorage.getItem('authToken');
    const savedUser  = localStorage.getItem('currentUser');
    if (savedToken && savedUser) {
        authToken   = savedToken;
        currentUser = JSON.parse(savedUser);
        showMainApp();
    }
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
    document.getElementById('generateQRForm').addEventListener('submit', handleGenerateQR);
});

// ==================== AUTH ====================
async function handleLogin(e) {
    e.preventDefault();
    try {
        const res  = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email:    document.getElementById('loginEmail').value,
                password: document.getElementById('loginPassword').value
            })
        });
        const data = await res.json();
        if (res.ok) {
            authToken = data.token; currentUser = data.user;
            localStorage.setItem('authToken',   authToken);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            showAlert('Login successful!', 'success');
            showMainApp();
        } else { showAlert(data.error || 'Login failed', 'danger'); }
    } catch { showAlert('Connection error. Please try again.', 'danger'); }
}

async function handleRegister(e) {
    e.preventDefault();
    try {
        const res  = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email:      document.getElementById('regEmail').value,
                password:   document.getElementById('regPassword').value,
                full_name:  document.getElementById('regFullName').value,
                reg_number: document.getElementById('regNumber').value,
                level:      document.getElementById('regLevel').value,
                faculty:    document.getElementById('regFaculty').value,
                department: document.getElementById('regDepartment').value
            })
        });
        const data = await res.json();
        if (res.ok) { showAlert('Registration successful! Please login.', 'success'); showLogin(); }
        else { showAlert(data.error || 'Registration failed', 'danger'); }
    } catch { showAlert('Connection error. Please try again.', 'danger'); }
}

function logout() {
    localStorage.removeItem('authToken'); localStorage.removeItem('currentUser');
    authToken = null; currentUser = null;
    stopRotatingQR();
    if (html5QrCode) html5QrCode.stop().catch(() => {});
    document.getElementById('mainApp').style.display   = 'none';
    document.getElementById('loginPage').style.display = 'flex';
}

// ==================== NAVIGATION ====================
function showLogin()    { document.getElementById('registerPage').style.display = 'none'; document.getElementById('loginPage').style.display = 'flex'; }
function showRegister() { document.getElementById('loginPage').style.display = 'none'; document.getElementById('registerPage').style.display = 'flex'; }

function showMainApp() {
    document.getElementById('loginPage').style.display    = 'none';
    document.getElementById('registerPage').style.display = 'none';
    document.getElementById('mainApp').style.display      = 'block';
    document.getElementById('navUserName').textContent    = currentUser.full_name;
    document.getElementById('navUserRole').textContent    = currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1);
    document.getElementById('studentMenu').style.display  = currentUser.role === 'student'  ? 'block' : 'none';
    document.getElementById('lecturerMenu').style.display = currentUser.role === 'lecturer' ? 'block' : 'none';
    document.getElementById('adminMenu').style.display    = currentUser.role === 'admin'    ? 'block' : 'none';
    showPage('dashboard');
}

function showPage(pageId) {
    stopRotatingQR(); // stop any running QR rotation when leaving the page
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId + 'Page').classList.add('active');
    document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
    if (event && event.target) event.target.closest('.sidebar-link')?.classList.add('active');
    switch (pageId) {
        case 'dashboard':       loadDashboard();           break;
        case 'myAttendance':    loadAttendanceHistory();   break;
        case 'myCourses':       loadEnrolledCourses();     break;
        case 'manageCourses':   loadLecturerCourses();     break;
        case 'generateQR':      loadCourseSelectOptions(); break;
        case 'viewAttendance':  loadAttendanceFilters();   break;
        case 'reports':         loadReportCourses();       break;
        case 'profile':         loadProfile();             break;
        case 'manageUsers':     loadAllUsers();            break;
        case 'manageLecturers': loadLecturersTable();      break;
        case 'allCourses':      loadAllCourses();          break;
    }
    if (window.innerWidth < 992) document.getElementById('sidebar').classList.remove('show');
}

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('show'); }

// ==================== DASHBOARD ====================
async function loadDashboard() {
    const statsEl = document.getElementById('statsCards');
    const activityEl = document.getElementById('recentActivity');

    if (currentUser.role === 'student') {
        try {
            const [cRes, aRes] = await Promise.all([apiFetch('/courses'), apiFetch('/attendance/history')]);
            const courses = await cRes.json(); const attendance = await aRes.json();
            statsEl.innerHTML = `
                <div class="col-md-4 mb-4"><div class="stat-card"><div class="icon bg-primary"><i class="fas fa-book"></i></div>
                    <h3>${Array.isArray(courses) ? courses.length : 0}</h3><p>Enrolled Courses</p></div></div>
                <div class="col-md-4 mb-4"><div class="stat-card"><div class="icon bg-success"><i class="fas fa-check-circle"></i></div>
                    <h3>${Array.isArray(attendance) ? attendance.length : 0}</h3><p>Classes Attended</p></div></div>
                <div class="col-md-4 mb-4"><div class="stat-card"><div class="icon bg-info"><i class="fas fa-calendar-check"></i></div>
                    <h3>${new Date().toLocaleDateString()}</h3><p>Today's Date</p></div></div>`;
            activityEl.innerHTML = Array.isArray(attendance) && attendance.length > 0
                ? attendance.slice(0,5).map(a => `
                    <div class="d-flex justify-content-between align-items-center border-bottom py-2">
                        <div><strong>${a.course_code}</strong> – ${a.session_title}</div>
                        <small class="text-muted">${new Date(a.marked_at).toLocaleString()}</small>
                    </div>`).join('')
                : '<p class="text-muted">No recent attendance records.</p>';
        } catch { statsEl.innerHTML = '<div class="col-12"><p class="text-danger">Error loading dashboard</p></div>'; }

    } else if (currentUser.role === 'lecturer') {
        try {
            const cRes = await apiFetch('/courses'); const courses = await cRes.json();
            statsEl.innerHTML = `
                <div class="col-md-4 mb-4"><div class="stat-card"><div class="icon bg-primary"><i class="fas fa-book"></i></div>
                    <h3>${Array.isArray(courses) ? courses.length : 0}</h3><p>My Courses</p></div></div>
                <div class="col-md-4 mb-4"><div class="stat-card"><div class="icon bg-success"><i class="fas fa-users"></i></div>
                    <h3>${Array.isArray(courses) ? courses.reduce((s,c)=>s+(c.student_count||0),0) : 0}</h3><p>Total Students</p></div></div>
                <div class="col-md-4 mb-4"><div class="stat-card"><div class="icon bg-info"><i class="fas fa-calendar"></i></div>
                    <h3>${new Date().toLocaleDateString()}</h3><p>Today</p></div></div>`;
            activityEl.innerHTML = '<p class="text-muted">Welcome! Use the sidebar to generate QR codes and manage attendance.</p>';
        } catch {}

    } else if (currentUser.role === 'admin') {
        try {
            const sRes = await apiFetch('/admin/stats'); const stats = await sRes.json();
            statsEl.innerHTML = `
                <div class="col mb-4"><div class="stat-card"><div class="icon bg-success"><i class="fas fa-user-graduate"></i></div>
                    <h3>${stats.total_students}</h3><p>Students</p></div></div>
                <div class="col mb-4"><div class="stat-card"><div class="icon bg-primary"><i class="fas fa-chalkboard-teacher"></i></div>
                    <h3>${stats.total_lecturers}</h3><p>Lecturers</p></div></div>
                <div class="col mb-4"><div class="stat-card"><div class="icon bg-warning"><i class="fas fa-book"></i></div>
                    <h3>${stats.total_courses}</h3><p>Courses</p></div></div>
                <div class="col mb-4"><div class="stat-card"><div class="icon bg-info"><i class="fas fa-qrcode"></i></div>
                    <h3>${stats.total_sessions}</h3><p>Sessions</p></div></div>
                <div class="col mb-4"><div class="stat-card"><div class="icon bg-danger"><i class="fas fa-clipboard-check"></i></div>
                    <h3>${stats.total_attendance}</h3><p>Attendance Records</p></div></div>`;
            activityEl.innerHTML = '<p class="text-muted">Welcome, Admin! Manage lecturers, courses and users using the sidebar.</p>';
        } catch {}
    }
}

// ==================== STUDENT: ATTENDANCE HISTORY ====================
async function loadAttendanceHistory() {
    const tbody = document.getElementById('attendanceHistoryTable');
    try {
        const records = await (await apiFetch('/attendance/history')).json();
        tbody.innerHTML = Array.isArray(records) && records.length > 0
            ? records.map(r => `<tr>
                <td><strong>${r.course_code}</strong> – ${r.course_title}</td>
                <td>${r.session_title}</td>
                <td>${new Date(r.marked_at).toLocaleString()}</td>
                <td><span class="badge-status badge-present">Present</span></td>
              </tr>`).join('')
            : '<tr><td colspan="4" class="text-center text-muted">No attendance records found</td></tr>';
    } catch { tbody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">Error loading records</td></tr>'; }
}

// ==================== STUDENT: MY COURSES ====================
async function loadEnrolledCourses() {
    const container = document.getElementById('enrolledCoursesList');
    try {
        const courses = await (await apiFetch('/courses')).json();
        container.innerHTML = Array.isArray(courses) && courses.length > 0
            ? courses.map(c => `
                <div class="col-md-4 mb-4"><div class="page-card h-100"><div class="page-card-body">
                    <h5 class="text-primary">${c.course_code}</h5>
                    <p class="mb-2">${c.course_title}</p>
                    <small class="text-muted"><i class="fas fa-user me-1"></i>${c.lecturer_name}<br>
                    <i class="fas fa-building me-1"></i>${c.department || 'N/A'}</small>
                </div></div></div>`).join('')
            : '<div class="col-12"><div class="alert alert-warning">You are not enrolled in any courses yet. Your lecturer will enrol you via Excel upload.</div></div>';
    } catch { container.innerHTML = '<div class="col-12"><p class="text-danger text-center">Error loading courses</p></div>'; }
}

// ==================== QR SCANNER (STUDENT) ====================
// Gets GPS location first, then passes it + token to the mark endpoint
function startScanner() {
    document.getElementById('scanResult').style.display = 'none';
    document.getElementById('stopScanBtn').style.display = 'inline-block';
    html5QrCode = new Html5Qrcode('qr-reader');
    html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        onScanSuccess, () => {}
    ).catch(() => showAlert('Could not start camera. Check permissions.', 'danger'));
}

function stopScanner() {
    if (html5QrCode) html5QrCode.stop().then(() => { document.getElementById('stopScanBtn').style.display = 'none'; }).catch(() => {});
}

async function onScanSuccess(decodedText) {
    stopScanner();
    const scanResult = document.getElementById('scanResult');
    const scanAlert  = document.getElementById('scanAlert');
    scanResult.style.display = 'block';
    scanAlert.className      = 'alert alert-info';
    scanAlert.innerHTML      = '<i class="fas fa-spinner fa-spin me-2"></i>QR code detected. Getting your location…';

    let qrData;
    try { qrData = JSON.parse(decodedText); } catch {
        scanAlert.className = 'alert alert-danger';
        scanAlert.innerHTML = '<i class="fas fa-times-circle me-2"></i>Invalid QR code format';
        return;
    }

    // Try to get GPS (required if session has GPS lock)
    let student_lat = null, student_lng = null;
    try {
        const pos = await new Promise((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000, enableHighAccuracy: true })
        );
        student_lat = pos.coords.latitude;
        student_lng = pos.coords.longitude;
    } catch (gpsErr) {
        // GPS unavailable – server will reject if session requires GPS
        console.warn('GPS unavailable:', gpsErr.message);
    }

    scanAlert.className = 'alert alert-info';
    scanAlert.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Marking attendance…';

    try {
        const res  = await apiFetch('/attendance/mark', 'POST', {
            session_id:   qrData.session_id,
            course_id:    qrData.course_id,
            student_id:   currentUser.id,
            token:        qrData.token,
            student_lat,
            student_lng
        });
        const data = await res.json();

        if (res.ok) {
            scanAlert.className = 'alert alert-success';
            let msg = `<i class="fas fa-check-circle me-2"></i><strong>${data.message}</strong>`;
            if (data.distance_metres !== null && data.distance_metres !== undefined)
                msg += `<br><small class="mt-1 d-block"><i class="fas fa-map-marker-alt me-1"></i>Distance from class: <strong>${data.distance_metres}m</strong> ✓</small>`;
            scanAlert.innerHTML = msg;
        } else {
            scanAlert.className = 'alert alert-danger';
            let msg = `<i class="fas fa-times-circle me-2"></i>${data.error}`;
            if (data.code === 'TOKEN_MISMATCH')
                msg += '<br><small>The QR code you scanned has already rotated. Please scan the live screen again.</small>';
            else if (data.code === 'OUT_OF_RANGE')
                msg += `<br><small>You are <strong>${data.distance_metres}m</strong> away. Maximum allowed: <strong>${data.allowed_metres}m</strong>. Move closer to the classroom.</small>`;
            else if (data.code === 'GPS_REQUIRED')
                msg += '<br><small>Please enable location/GPS on your device and try again.</small>';
            scanAlert.innerHTML = msg;
        }
    } catch {
        scanAlert.className = 'alert alert-danger';
        scanAlert.innerHTML = '<i class="fas fa-times-circle me-2"></i>Network error. Please try again.';
    }
}

// ==================== LECTURER: MY COURSES ====================
async function loadLecturerCourses() {
    const container = document.getElementById('lecturerCoursesList');
    try {
        const courses = await (await apiFetch('/courses')).json();
        if (Array.isArray(courses) && courses.length > 0) {
            container.innerHTML = courses.map(c => `
                <div class="col-md-4 mb-4"><div class="page-card h-100"><div class="page-card-body">
                    <h5 class="text-primary">${c.course_code}</h5>
                    <p class="mb-2">${c.course_title}</p>
                    <small class="text-muted">
                        <i class="fas fa-layer-group me-1"></i>${c.level||'N/A'} Level &nbsp;|&nbsp;
                        <i class="fas fa-users me-1"></i>${c.student_count||0} students
                    </small>
                    <div class="mt-3">
                        <button class="btn btn-success btn-sm w-100" onclick="openUploadModal(${c.id},'${c.course_code}')">
                            <i class="fas fa-file-excel me-1"></i>Upload Students
                        </button>
                    </div>
                </div></div></div>`).join('');
        } else {
            container.innerHTML = '<div class="col-12"><div class="alert alert-info">No courses assigned yet. Contact the Admin.</div></div>';
        }
    } catch { container.innerHTML = '<div class="col-12"><p class="text-danger text-center">Error loading courses</p></div>'; }
}

// ==================== EXCEL UPLOAD ====================
function openUploadModal(courseId, courseCode) {
    document.getElementById('uploadCourseId').value = courseId;
    document.getElementById('uploadResults').style.display = 'none';
    document.getElementById('selectedFileInfo').style.display = 'none';
    document.getElementById('excelFileInput').value = '';
    document.getElementById('uploadBtn').disabled = true;
    selectedUploadFile = null;
    document.querySelector('#uploadStudentsModal .modal-title').innerHTML =
        `<i class="fas fa-file-excel me-2 text-success"></i>Upload Students – ${courseCode}`;
    new bootstrap.Modal(document.getElementById('uploadStudentsModal')).show();
}

function handleFileSelected(input) {
    const file = input.files[0]; if (!file) return;
    selectedUploadFile = file;
    document.getElementById('selectedFileName').textContent = file.name;
    document.getElementById('selectedFileInfo').style.display = 'block';
    document.getElementById('uploadBtn').disabled = false;
    document.getElementById('uploadResults').style.display = 'none';
}

async function uploadStudents() {
    if (!selectedUploadFile) { showAlert('Please select an Excel file first.', 'warning'); return; }
    const courseId = document.getElementById('uploadCourseId').value;
    const btn = document.getElementById('uploadBtn');
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Uploading…';
    try {
        const formData = new FormData(); formData.append('file', selectedUploadFile);
        const res  = await fetch(`${API_URL}/courses/${courseId}/upload-students`, {
            method: 'POST', headers: { 'Authorization': `Bearer ${authToken}` }, body: formData
        });
        const data = await res.json();
        if (res.ok) {
            const s = data.stats;
            document.getElementById('resTotal').textContent   = s.total;
            document.getElementById('resEnrolled').textContent = s.enrolled;
            document.getElementById('resAlready').textContent  = s.already_enrolled;
            document.getElementById('resNotFound').textContent = s.not_found;
            document.getElementById('uploadResults').style.display = 'block';
            if (data.sample_errors?.length > 0) {
                document.getElementById('uploadErrors').style.display = 'block';
                document.getElementById('uploadErrorList').innerHTML = data.sample_errors.map(e=>`<li>${e}</li>`).join('');
            } else { document.getElementById('uploadErrors').style.display = 'none'; }
            showAlert(`Upload complete: ${s.enrolled} students enrolled!`, 'success');
            loadLecturerCourses();
        } else { showAlert(data.error || 'Upload failed', 'danger'); }
    } catch { showAlert('Error uploading file.', 'danger'); }
    finally { btn.disabled = false; btn.innerHTML = '<i class="fas fa-upload me-2"></i>Upload & Enrol Students'; }
}

function downloadTemplate() {
    const csv = 'Reg_Number,Email,Full_Name\nBUK/CS/20/1001,student1@buk.edu.ng,Muhammad Abdullahi\nBUK/CS/20/1002,student2@buk.edu.ng,Aisha Bello\n';
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], {type:'text/csv'})), download: 'student_upload_template.csv' });
    a.click();
    showAlert('Template downloaded. Open in Excel and save as .xlsx before uploading.', 'info');
}

// ==================== GPS LOCK TOGGLE (in QR generator) ====================
function toggleGpsFields() {
    const gpsOn = document.getElementById('gpsRequiredToggle').checked;
    document.getElementById('gpsFields').style.display = gpsOn ? 'block' : 'none';
}

function captureMyLocation() {
    const btn = document.getElementById('captureLocationBtn');
    const statusEl = document.getElementById('gpsStatus');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Getting location…';
    statusEl.innerHTML = '';

    if (!navigator.geolocation) {
        showAlert('Geolocation is not supported by this browser.', 'danger');
        btn.disabled = false; btn.innerHTML = '<i class="fas fa-crosshairs me-1"></i>Use My Current Location';
        return;
    }

    navigator.geolocation.getCurrentPosition(
        pos => {
            document.getElementById('gpsLat').value = pos.coords.latitude.toFixed(7);
            document.getElementById('gpsLng').value = pos.coords.longitude.toFixed(7);
            const acc = Math.round(pos.coords.accuracy);
            statusEl.innerHTML = `<span class="text-success"><i class="fas fa-check-circle me-1"></i>Location captured (±${acc}m accuracy)</span>`;
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-crosshairs me-1"></i>Re-capture Location';
        },
        err => {
            let errorMsg = 'Location unavailable';
            switch(err.code) {
                case err.PERMISSION_DENIED:
                    errorMsg = 'Location access denied. Please allow location access in your browser.';
                    break;
                case err.POSITION_UNAVAILABLE:
                    errorMsg = 'Location unavailable. Try moving to an open area.';
                    break;
                case err.TIMEOUT:
                    errorMsg = 'Location request timed out. Please try again.';
                    break;
            }
            statusEl.innerHTML = `<span class="text-danger"><i class="fas fa-exclamation-circle me-1"></i>${errorMsg}</span>`;
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-crosshairs me-1"></i>Use My Current Location';
        },
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
    );
}

// ==================== GENERATE QR + ROTATING DISPLAY ====================
async function loadCourseSelectOptions() {
    const select = document.getElementById('qrCourseSelect');
    console.log('Loading courses for user:', currentUser);
    try {
        const courses = await (await apiFetch('/courses')).json();
        console.log('All courses from API:', courses);
        select.innerHTML = '<option value="">-- Select Course --</option>';
        if (Array.isArray(courses)) {
            // Filter courses by current lecturer if user is a lecturer
            const filteredCourses = currentUser.role === 'lecturer' 
                ? courses.filter(c => c.lecturer_id === currentUser.id)
                : courses;
            console.log('Filtered courses:', filteredCourses);
            filteredCourses.forEach(c => { 
                select.innerHTML += `<option value="${c.id}">${c.course_code} – ${c.course_title}</option>`; 
            });
            console.log('Courses added to select, final HTML:', select.innerHTML);
        }
    } catch (error) {
        console.error('Error loading courses:', error);
        select.innerHTML = '<option value="">Error loading courses</option>';
    }
}

async function handleGenerateQR(e) {
    e.preventDefault();
    const courseId     = document.getElementById('qrCourseSelect').value;
    const sessionTitle = document.getElementById('sessionTitle').value;
    const duration     = document.getElementById('qrDuration').value;
    const gpsRequired  = document.getElementById('gpsRequiredToggle').checked;
    const gpsLat       = document.getElementById('gpsLat').value;
    const gpsLng       = document.getElementById('gpsLng').value;
    const gpsRadius    = document.getElementById('gpsRadius').value;

    if (!courseId) { showAlert('Please select a course', 'warning'); return; }
    if (gpsRequired && (!gpsLat || !gpsLng)) {
        showAlert('Please capture your classroom location first.', 'warning'); return;
    }

    const display = document.getElementById('qrCodeDisplay');
    display.innerHTML = '<div class="text-center py-4"><i class="fas fa-spinner fa-spin fa-3x text-primary"></i><p class="mt-3 text-muted">Creating session…</p></div>';

    try {
        const payload = {
            course_id:         courseId,
            session_title:     sessionTitle || `Session ${new Date().toLocaleDateString()}`,
            expires_in_minutes: parseInt(duration),
            gps_required:      gpsRequired,
            gps_lat:           gpsRequired ? parseFloat(gpsLat) : null,
            gps_lng:           gpsRequired ? parseFloat(gpsLng) : null,
            gps_radius_metres: gpsRequired ? parseInt(gpsRadius) : null
        };
        const res  = await apiFetch('/sessions', 'POST', payload);
        const data = await res.json();

        if (res.ok) {
            startRotatingQRDisplay(data);
        } else {
            display.innerHTML = `<div class="text-center text-danger py-4"><i class="fas fa-times-circle fa-3x mb-2"></i><p>${data.error}</p></div>`;
        }
    } catch {
        display.innerHTML = '<div class="text-center text-danger py-4"><i class="fas fa-times-circle fa-3x mb-2"></i><p>Error creating session</p></div>';
    }
}

// ── Rotating QR display ────────────────────────────────────────────────────
function stopRotatingQR() {
    if (rotatingIntervalId) { clearInterval(rotatingIntervalId); rotatingIntervalId = null; }
    if (rotatingExpiryId)   { clearTimeout(rotatingExpiryId);    rotatingExpiryId   = null; }
    rotatingSessionId = null;
}

function startRotatingQRDisplay(session) {
    stopRotatingQR();
    rotatingSessionId = session.id;

    const expiresAt = new Date(session.expires_at);
    const msLeft    = expiresAt - Date.now();

    // Render initial QR immediately
    renderRotatingQR(session.qr_code, session.expires_at, session.gps_required, session.gps_radius_metres);

    // Poll /token every 10 seconds to get the freshly-rotated QR
    rotatingIntervalId = setInterval(() => fetchAndRenderNewToken(session.id), 10000);

    // Stop everything when session expires
    rotatingExpiryId = setTimeout(() => {
        stopRotatingQR();
        document.getElementById('qrCodeDisplay').innerHTML = `
            <div class="text-center py-4">
                <i class="fas fa-clock fa-3x text-danger mb-3"></i>
                <h5 class="text-danger">Session Expired</h5>
                <p class="text-muted">Generate a new QR code to start another session.</p>
            </div>`;
    }, msLeft);

    showAlert('QR Code generated! It rotates every 10 seconds automatically.', 'success');
}

async function fetchAndRenderNewToken(sessionId) {
    if (rotatingSessionId !== sessionId) return; // stale interval
    try {
        const res  = await apiFetch(`/sessions/${sessionId}/token`);
        if (!res.ok) { stopRotatingQR(); return; }
        const data = await res.json();
        renderRotatingQR(data.qr_code, data.expires_at, data.gps_required, data.gps_radius_metres);
    } catch { /* silently ignore network hiccups */ }
}

function renderRotatingQR(qrImageDataUrl, expiresAt, gpsRequired, gpsRadius) {
    const display = document.getElementById('qrCodeDisplay');

    // Build GPS badge if GPS lock is on
    const gpsBadge = gpsRequired
        ? `<div class="alert alert-warning py-2 mb-2 d-inline-flex align-items-center gap-2">
               <i class="fas fa-map-marker-alt"></i>
               <span><strong>GPS Lock Active</strong> — Students must be within <strong>${gpsRadius}m</strong> of this room</span>
           </div><br>`
        : '';

    // Rotation indicator – flashes briefly when QR changes
    display.innerHTML = `
        ${gpsBadge}
        <div id="qrWrapper" class="qr-wrapper">
            <img src="${qrImageDataUrl}" alt="QR Code" class="qr-img mb-2" id="qrImage">
            <div class="rotating-badge"><i class="fas fa-sync-alt me-1"></i>Rotates every 10s — Screenshots won't work</div>
        </div>
        <div class="qr-timer" id="qrTimer">--:--</div>
        <p class="text-muted small">Session expires at ${new Date(expiresAt).toLocaleTimeString()}</p>
        <button class="btn btn-outline-primary btn-sm mt-1 no-print" onclick="window.print()">
            <i class="fas fa-print me-2"></i>Print / Project QR
        </button>`;

    // Flash animation to signal rotation
    const img = document.getElementById('qrImage');
    if (img) { img.style.opacity = '0.3'; setTimeout(() => { img.style.opacity = '1'; }, 200); }

    // Update countdown timer
    startQRTimer(new Date(expiresAt));
}

function startQRTimer(expiresAt) {
    const update = () => {
        const el = document.getElementById('qrTimer');
        if (!el) return;
        const diff = expiresAt - Date.now();
        if (diff <= 0) { el.textContent = 'EXPIRED'; el.classList.add('expired'); return; }
        const m = Math.floor(diff / 60000), s = Math.floor((diff % 60000) / 1000);
        el.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
        setTimeout(update, 1000);
    };
    update();
}

// ==================== VIEW ATTENDANCE ====================
async function loadAttendanceFilters() {
    const select = document.getElementById('attendanceCourseFilter');
    try {
        const courses = await (await apiFetch('/courses')).json();
        select.innerHTML = '<option value="">-- Select Course --</option>';
        if (Array.isArray(courses)) courses.forEach(c => { select.innerHTML += `<option value="${c.id}">${c.course_code} – ${c.course_title}</option>`; });
    } catch {}
}

async function loadCourseSessions() {
    const courseId = document.getElementById('attendanceCourseFilter').value;
    const select   = document.getElementById('attendanceSessionFilter');
    select.innerHTML = '<option value="">-- Select Session --</option>';
    if (!courseId) return;
    try {
        const sessions = await (await apiFetch(`/courses/${courseId}/sessions`)).json();
        if (Array.isArray(sessions)) sessions.forEach(s => {
            const gpsIcon = s.gps_required ? ' 📍' : '';
            select.innerHTML += `<option value="${s.id}">${s.session_title}${gpsIcon} (${new Date(s.created_at).toLocaleDateString()})</option>`;
        });
    } catch {}
}

async function loadSessionAttendance() {
    const sessionId  = document.getElementById('attendanceSessionFilter').value;
    const tbody      = document.getElementById('sessionAttendanceTable');
    const countBadge = document.getElementById('attendanceCount');
    if (!sessionId) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Select a session to view attendance</td></tr>';
        countBadge.textContent = '0 students'; return;
    }
    try {
        const records = await (await apiFetch(`/sessions/${sessionId}/attendance`)).json();
        if (Array.isArray(records) && records.length > 0) {
            countBadge.textContent = `${records.length} students`;
            tbody.innerHTML = records.map((r, i) => {
                const dist = r.distance_metres !== null && r.distance_metres !== undefined
                    ? `<span class="badge bg-${r.gps_verified ? 'success' : 'warning'}">${r.distance_metres}m</span>`
                    : '<span class="text-muted">—</span>';
                return `<tr>
                    <td>${i+1}</td>
                    <td>${r.reg_number||'N/A'}</td>
                    <td>${r.full_name}</td>
                    <td>${new Date(r.marked_at).toLocaleTimeString()}</td>
                    <td>${dist}</td>
                    <td><span class="badge-status badge-present">Present</span></td>
                </tr>`;
            }).join('');
        } else {
            countBadge.textContent = '0 students';
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No attendance records for this session</td></tr>';
        }
    } catch { tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error loading attendance</td></tr>'; }
}

function exportAttendance() { showAlert('Export feature coming soon!', 'info'); }

// ==================== REPORTS ====================
async function loadReportCourses() {
    const select = document.getElementById('reportCourseSelect');
    try {
        const courses = await (await apiFetch('/courses')).json();
        select.innerHTML = '<option value="">-- Select Course --</option>';
        if (Array.isArray(courses)) courses.forEach(c => { select.innerHTML += `<option value="${c.id}">${c.course_code} – ${c.course_title}</option>`; });
    } catch {}
}

async function loadCourseReport() {
    const courseId   = document.getElementById('reportCourseSelect').value;
    const reportCard = document.getElementById('reportCard');
    const tbody      = document.getElementById('reportTableBody');
    if (!courseId) { reportCard.style.display = 'none'; return; }
    try {
        const report = await (await apiFetch(`/courses/${courseId}/attendance-report`)).json();
        reportCard.style.display = 'block';
        tbody.innerHTML = report.students?.length > 0
            ? report.students.map((s,i) => {
                const absent = s.total_sessions - s.total_present;
                const remark = s.percentage >= 75 ? 'Good' : s.percentage >= 50 ? 'Warning' : 'Poor';
                const cls    = s.percentage >= 75 ? 'text-success' : s.percentage >= 50 ? 'text-warning' : 'text-danger';
                return `<tr><td>${i+1}</td><td>${s.reg_number||'N/A'}</td><td>${s.full_name}</td>
                    <td>${s.total_present}</td><td>${absent}</td>
                    <td><strong>${s.percentage}%</strong></td>
                    <td class="${cls}"><strong>${remark}</strong></td></tr>`;
              }).join('')
            : '<tr><td colspan="7" class="text-center text-muted">No data available</td></tr>';
    } catch { tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Error loading report</td></tr>'; }
}

function printReport() { window.print(); }

// ==================== PROFILE ====================
async function loadProfile() {
    try {
        const profile = await (await apiFetch('/auth/profile')).json();
        document.getElementById('profileName').textContent       = profile.full_name;
        document.getElementById('profileRole').textContent       = profile.role.charAt(0).toUpperCase() + profile.role.slice(1);
        document.getElementById('profileEmail').textContent      = profile.email;
        document.getElementById('profileRegNumber').textContent  = profile.reg_number || 'N/A';
        document.getElementById('profileFaculty').textContent    = profile.faculty    || 'N/A';
        document.getElementById('profileDepartment').textContent = profile.department || 'N/A';
        document.getElementById('profileLevel').textContent      = profile.level ? profile.level + ' Level' : 'N/A';
        document.getElementById('profileJoined').textContent     = new Date(profile.created_at).toLocaleDateString();
    } catch {}
}

// ==================== ADMIN: USERS ====================
async function loadAllUsers() {
    const tbody  = document.getElementById('usersTable');
    const filter = document.getElementById('userRoleFilter').value;
    try {
        let users = await (await apiFetch('/admin/users')).json();
        if (filter) users = users.filter(u => u.role === filter);
        tbody.innerHTML = Array.isArray(users) && users.length > 0
            ? users.map(u => `<tr>
                <td>${u.full_name}</td><td>${u.email}</td>
                <td>${u.reg_number||'—'}</td>
                <td><span class="badge bg-${u.role==='admin'?'danger':u.role==='lecturer'?'primary':'success'}">${u.role}</span></td>
                <td>${u.department||'—'}</td>
                <td><span class="badge bg-${u.is_active?'success':'secondary'}">${u.is_active?'Active':'Inactive'}</span></td>
                <td>${u.role!=='admin'?`
                    <button class="btn btn-sm btn-outline-${u.is_active?'warning':'success'} me-1" onclick="toggleUserStatus(${u.id},this)">
                        <i class="fas fa-${u.is_active?'ban':'check'}"></i></button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteUser(${u.id},this)">
                        <i class="fas fa-trash"></i></button>`:'—'}
                </td></tr>`).join('')
            : '<tr><td colspan="7" class="text-center text-muted">No users found</td></tr>';
    } catch { tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Error loading users</td></tr>'; }
}

async function toggleUserStatus(userId, btn) {
    btn.disabled = true;
    try {
        const data = await (await apiFetch(`/admin/users/${userId}/toggle-status`, 'PATCH')).json();
        showAlert(data.message, 'success'); loadAllUsers();
    } catch { showAlert('Error updating status', 'danger'); }
    btn.disabled = false;
}

async function deleteUser(userId, btn) {
    if (!confirm('Delete this user? This cannot be undone.')) return;
    btn.disabled = true;
    try {
        const res = await apiFetch(`/admin/users/${userId}`, 'DELETE');
        const data = await res.json();
        if (res.ok) { showAlert('User deleted successfully', 'success'); loadAllUsers(); }
        else showAlert(data.error, 'danger');
    } catch { showAlert('Error deleting user', 'danger'); }
}

// ==================== ADMIN: LECTURERS ====================
async function loadLecturersTable() {
    const tbody = document.getElementById('lecturersTable');
    try {
        const allUsers  = await (await apiFetch('/admin/users')).json();
        const lecturers = allUsers.filter(u => u.role === 'lecturer');
        tbody.innerHTML = lecturers.length > 0
            ? lecturers.map(l => `<tr>
                <td>${l.full_name}</td><td>${l.email}</td>
                <td>${l.department||'—'}</td><td>${l.faculty||'—'}</td><td>—</td>
                <td><span class="badge bg-${l.is_active?'success':'secondary'}">${l.is_active?'Active':'Inactive'}</span></td>
              </tr>`).join('')
            : '<tr><td colspan="6" class="text-center text-muted">No lecturers found. Use "Add Lecturer" to create one.</td></tr>';
    } catch { tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error loading lecturers</td></tr>'; }
}

function generatePassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#!';
    document.getElementById('lecPassword').value = Array.from({length:10}, () => chars[Math.floor(Math.random()*chars.length)]).join('');
}

async function addLecturer() {
    const lecData = {
        full_name:  document.getElementById('lecFullName').value.trim(),
        email:      document.getElementById('lecEmail').value.trim(),
        password:   document.getElementById('lecPassword').value.trim(),
        department: document.getElementById('lecDept').value.trim(),
        faculty:    document.getElementById('lecFaculty').value.trim(),
        phone:      document.getElementById('lecPhone').value.trim()
    };
    if (!lecData.full_name || !lecData.email || !lecData.password) { showAlert('Full name, email and password are required.', 'warning'); return; }
    try {
        const res = await apiFetch('/admin/lecturers', 'POST', lecData);
        const data = await res.json();
        if (res.ok) {
            const alertEl = document.getElementById('lecturerCreatedAlert');
            alertEl.style.display = 'block';
            alertEl.innerHTML = `<div class="alert alert-success">
                <strong><i class="fas fa-check-circle me-1"></i>Account created!</strong> Share with lecturer:
                <div class="credential-box mt-2">Email: <strong>${lecData.email}</strong><br>Password: <strong>${lecData.password}</strong></div>
            </div>`;
            document.getElementById('addLecturerForm').reset();
            showAlert('Lecturer account created!', 'success');
            loadLecturersTable();
        } else { showAlert(data.error || 'Failed to create lecturer', 'danger'); }
    } catch { showAlert('Error creating lecturer', 'danger'); }
}

// ==================== ADMIN: COURSES ====================
async function loadAllCourses() {
    const tbody = document.getElementById('allCoursesTable');
    try {
        const courses = await (await apiFetch('/admin/courses')).json();
        tbody.innerHTML = Array.isArray(courses) && courses.length > 0
            ? courses.map(c => `<tr>
                <td><strong>${c.course_code}</strong></td><td>${c.course_title}</td>
                <td>${c.lecturer_name}</td><td>${c.level||'—'}</td><td>${c.semester||'—'}</td>
                <td><span class="badge bg-primary">${c.student_count||0}</span></td>
                <td><button class="btn btn-sm btn-outline-danger" onclick="deleteCourse(${c.id},this)"><i class="fas fa-trash"></i></button></td>
              </tr>`).join('')
            : '<tr><td colspan="7" class="text-center text-muted">No courses found.</td></tr>';
    } catch { tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Error loading courses</td></tr>'; }
}

async function addCourse() {
    const courseData = {
        course_code:   document.getElementById('newCourseCode').value.trim(),
        course_title:  document.getElementById('newCourseTitle').value.trim(),
        lecturer_id:   document.getElementById('courseAssignLecturer').value,
        department:    document.getElementById('newCourseDept').value.trim(),
        faculty:       document.getElementById('newCourseFaculty').value.trim(),
        level:         document.getElementById('newCourseLevel').value,
        semester:      document.getElementById('newCourseSemester').value,
        academic_year: document.getElementById('newCourseYear').value.trim()
    };
    if (!courseData.course_code || !courseData.course_title || !courseData.lecturer_id) { showAlert('Code, title and lecturer are required.', 'warning'); return; }
    try {
        const res = await apiFetch('/admin/courses', 'POST', courseData);
        const data = await res.json();
        if (res.ok) {
            showAlert('Course created and assigned!', 'success');
            bootstrap.Modal.getInstance(document.getElementById('addCourseModal')).hide();
            document.getElementById('addCourseForm').reset();
            loadAllCourses();
        } else { showAlert(data.error || 'Failed to create course', 'danger'); }
    } catch { showAlert('Error creating course', 'danger'); }
}

async function deleteCourse(courseId, btn) {
    if (!confirm('Delete this course? All sessions and records will also be deleted.')) return;
    btn.disabled = true;
    try {
        const res = await apiFetch(`/admin/courses/${courseId}`, 'DELETE');
        const data = await res.json();
        if (res.ok) { showAlert('Course deleted.', 'success'); loadAllCourses(); }
        else showAlert(data.error, 'danger');
    } catch { showAlert('Error deleting course', 'danger'); }
    btn.disabled = false;
}

document.addEventListener('DOMContentLoaded', () => {
    const addCourseModal = document.getElementById('addCourseModal');
    if (addCourseModal) {
        addCourseModal.addEventListener('show.bs.modal', async () => {
            const select = document.getElementById('courseAssignLecturer');
            select.innerHTML = '<option value="">Loading lecturers…</option>';
            try {
                const lecturers = await (await apiFetch('/admin/lecturers')).json();
                select.innerHTML = '<option value="">-- Select Lecturer --</option>';
                if (Array.isArray(lecturers)) lecturers.forEach(l => { select.innerHTML += `<option value="${l.id}">${l.full_name} (${l.email})</option>`; });
            } catch { select.innerHTML = '<option value="">Error loading lecturers</option>'; }
        });
    }
});

// ==================== UTILITY ====================
function apiFetch(endpoint, method = 'GET', body = null) {
    const opts = { method, headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    return fetch(`${API_URL}${endpoint}`, opts);
}

function showAlert(message, type = 'info') {
    const div = document.createElement('div');
    div.className = `alert alert-${type} alert-dismissible fade show custom-alert`;
    div.innerHTML = `${message}<button type="button" class="btn-close" data-bs-dismiss="alert"></button>`;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 6000);
}
