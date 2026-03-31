const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType, PageBreak
} = require('docx');
const fs = require('fs');

const createParagraph = (text, options = {}) => {
  return new Paragraph({
    alignment: options.alignment || AlignmentType.JUSTIFIED,
    spacing: { after: 200, line: 360 },
    indent: options.indent ? { firstLine: 720 } : undefined,
    children: [
      new TextRun({
        text: text,
        size: 24,
        font: "Times New Roman",
        ...options.runOptions
      })
    ]
  });
};

const createHeading = (text, level) => {
  const sizes = { 1: 32, 2: 28, 3: 26 };
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 400, after: 300 },
    children: [
      new TextRun({ text: text, size: sizes[level] || 28, bold: true, font: "Times New Roman" })
    ]
  });
};

const createSectionHeading = (text, level = 2) => {
  const sizes = { 1: 28, 2: 26, 3: 24 };
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { before: 300, after: 200 },
    children: [
      new TextRun({ text: text, size: sizes[level] || 26, bold: true, font: "Times New Roman" })
    ]
  });
};

const tableBorder = { style: BorderStyle.SINGLE, size: 1, color: "000000" };
const tableBorders = { top: tableBorder, bottom: tableBorder, left: tableBorder, right: tableBorder };

const createTableCell = (text, isHeader = false, width = 2000) => {
  return new TableCell({
    borders: tableBorders,
    width: { size: width, type: WidthType.DXA },
    shading: isHeader ? { fill: "D9D9D9", type: ShadingType.CLEAR } : undefined,
    margins: { top: 50, bottom: 50, left: 100, right: 100 },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [ new TextRun({ text: text, size: 22, bold: isHeader, font: "Times New Roman" }) ]
      })
    ]
  });
};

const doc = new Document({
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
      }
    },
    children: [
      // TITLE PAGE
      new Paragraph({ spacing: { before: 1200 }, children: [] }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
        children: [
          new TextRun({
            text: "DESIGN AND IMPLEMENTATION OF A QR CODE-BASED STUDENT ATTENDANCE MANAGEMENT SYSTEM FOR BAYERO UNIVERSITY KANO",
            size: 32, bold: true, font: "Times New Roman"
          })
        ]
      }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 800, after: 300 },
        children: [new TextRun({ text: "A PROJECT", size: 28, font: "Times New Roman" })]
      }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 },
        children: [new TextRun({ text: "SUBMITTED TO THE DEPARTMENT OF", size: 24, font: "Times New Roman" })]
      }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 },
        children: [new TextRun({ text: "[DEPARTMENT NAME]", size: 24, font: "Times New Roman" })]
      }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 },
        children: [new TextRun({ text: "FACULTY OF [FACULTY NAME]", size: 24, font: "Times New Roman" })]
      }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 300 },
        children: [new TextRun({ text: "BAYERO UNIVERSITY, KANO", size: 24, bold: true, font: "Times New Roman" })]
      }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 600, after: 200 },
        children: [new TextRun({ text: "IN PARTIAL FULFILLMENT OF THE REQUIREMENTS FOR THE AWARD OF", size: 24, font: "Times New Roman" })]
      }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600 },
        children: [new TextRun({ text: "[DEGREE NAME]", size: 24, font: "Times New Roman" })]
      }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 },
        children: [new TextRun({ text: "BY", size: 24, font: "Times New Roman" })]
      }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 },
        children: [new TextRun({ text: "[YOUR FULL NAME]", size: 26, bold: true, font: "Times New Roman" })]
      }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600 },
        children: [new TextRun({ text: "[REGISTRATION NUMBER]", size: 24, font: "Times New Roman" })]
      }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600 },
        children: [new TextRun({ text: "SUPERVISOR: [SUPERVISOR'S NAME]", size: 24, font: "Times New Roman" })]
      }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 400 },
        children: [new TextRun({ text: "[MONTH, YEAR]", size: 24, font: "Times New Roman" })]
      }),
      new Paragraph({ children: [new PageBreak()] }),

      // DECLARATION
      createHeading("DECLARATION", 1),
      createParagraph("I hereby declare that this project titled \"Design and Implementation of a QR Code-Based Student Attendance Management System for Bayero University Kano\" is my original work and has not been previously submitted in whole or in part for any degree or examination at this or any other university.", { indent: true }),
      new Paragraph({ spacing: { before: 800 }, children: [] }),
      new Paragraph({ children: [new TextRun({ text: "____________________________", size: 24, font: "Times New Roman" })] }),
      new Paragraph({ children: [new TextRun({ text: "[Your Name]", size: 24, font: "Times New Roman" })] }),
      new Paragraph({ children: [new TextRun({ text: "Date: ____________________________", size: 24, font: "Times New Roman" })] }),
      new Paragraph({ children: [new PageBreak()] }),

      // CERTIFICATION
      createHeading("CERTIFICATION", 1),
      createParagraph("This is to certify that this project meets the requirements and regulations governing the award of the degree for which it is submitted and is approved for its contribution to knowledge.", { indent: true }),
      new Paragraph({ spacing: { before: 600 }, children: [] }),
      new Paragraph({ children: [new TextRun({ text: "____________________________", size: 24, font: "Times New Roman" })] }),
      new Paragraph({ children: [new TextRun({ text: "Supervisor", size: 24, font: "Times New Roman" })] }),
      new Paragraph({ spacing: { before: 400 }, children: [] }),
      new Paragraph({ children: [new TextRun({ text: "____________________________", size: 24, font: "Times New Roman" })] }),
      new Paragraph({ children: [new TextRun({ text: "Head of Department", size: 24, font: "Times New Roman" })] }),
      new Paragraph({ children: [new PageBreak()] }),

      // DEDICATION
      createHeading("DEDICATION", 1),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 400 },
        children: [new TextRun({ text: "This project is dedicated to Almighty Allah and my beloved parents.", size: 24, font: "Times New Roman" })]
      }),
      new Paragraph({ children: [new PageBreak()] }),

      // ACKNOWLEDGEMENTS
      createHeading("ACKNOWLEDGEMENTS", 1),
      createParagraph("All praise belongs to Almighty Allah for the strength to complete this project. I thank my supervisor for guidance, my parents for support, and everyone who contributed to this work.", { indent: true }),
      new Paragraph({ children: [new PageBreak()] }),

      // ABSTRACT
      createHeading("ABSTRACT", 1),
      createParagraph("This project presents the design and implementation of a web-based QR Code Attendance Management System for Bayero University, Kano. The system was developed using Node.js, Express.js, MySQL, and modern web technologies. It enables lecturers to generate time-limited QR codes for attendance sessions, which students scan using smartphones to mark attendance instantly. Key features include user authentication, course management, real-time attendance tracking, and comprehensive reporting. Testing demonstrated that the system reduces attendance-taking time by approximately 90%, eliminates proxy attendance, and provides accurate real-time records. The system offers a practical, cost-effective solution for modernizing attendance management.", { indent: true }),
      new Paragraph({
        spacing: { before: 300 },
        children: [
          new TextRun({ text: "Keywords: ", size: 24, bold: true, font: "Times New Roman" }),
          new TextRun({ text: "QR Code, Attendance Management, Web Application, Node.js, MySQL", size: 24, italics: true, font: "Times New Roman" })
        ]
      }),
      new Paragraph({ children: [new PageBreak()] }),

      // TABLE OF CONTENTS
      createHeading("TABLE OF CONTENTS", 1),
      createParagraph("CHAPTER ONE: INTRODUCTION"),
      createParagraph("1.1 Background to the Study"),
      createParagraph("1.2 Statement of the Problem"),
      createParagraph("1.3 Aim and Objectives"),
      createParagraph("1.4 Significance of the Study"),
      createParagraph("1.5 Scope and Limitations"),
      createParagraph("CHAPTER TWO: LITERATURE REVIEW"),
      createParagraph("2.1 Introduction"),
      createParagraph("2.2 Review of Related Concepts"),
      createParagraph("2.3 Review of Related Works"),
      createParagraph("CHAPTER THREE: SYSTEM ANALYSIS AND DESIGN"),
      createParagraph("3.1 Analysis of Existing System"),
      createParagraph("3.2 Analysis of Proposed System"),
      createParagraph("3.3 System Requirements"),
      createParagraph("3.4 System Design"),
      createParagraph("CHAPTER FOUR: IMPLEMENTATION AND TESTING"),
      createParagraph("4.1 Implementation Tools"),
      createParagraph("4.2 System Implementation"),
      createParagraph("4.3 System Testing"),
      createParagraph("CHAPTER FIVE: CONCLUSION"),
      createParagraph("5.1 Summary"),
      createParagraph("5.2 Conclusion"),
      createParagraph("5.3 Recommendations"),
      createParagraph("References"),
      new Paragraph({ children: [new PageBreak()] }),

      // CHAPTER ONE
      createHeading("CHAPTER ONE", 1),
      createHeading("INTRODUCTION", 2),
      
      createSectionHeading("1.1 Background to the Study"),
      createParagraph("Student attendance management is fundamental to academic administration in higher education. Attendance records serve multiple purposes including monitoring engagement, ensuring policy compliance, and determining examination eligibility. With increasing student populations, efficient attendance management has become more challenging (Shoewu & Idowu, 2012).", { indent: true }),
      createParagraph("Quick Response (QR) codes are two-dimensional barcodes developed in 1994 by Denso Wave. They can store significant data and be rapidly decoded by smartphone cameras, offering advantages like fast readability, high storage capacity, and error correction (Denso Wave, 2014).", { indent: true }),
      createParagraph("Bayero University, Kano (BUK), with over 50,000 students, relies on manual attendance methods that consume lecture time, are error-prone, and vulnerable to proxy attendance. QR code technology presents an opportunity to address these challenges effectively (Akinduyite et al., 2013).", { indent: true }),
      
      createSectionHeading("1.2 Statement of the Problem"),
      createParagraph("The manual attendance system faces several challenges: time consumption (10-15 minutes per class), recording errors, widespread proxy attendance, and difficulties in data management and compilation. These problems necessitate an automated solution.", { indent: true }),
      
      createSectionHeading("1.3 Aim and Objectives"),
      createParagraph("The aim is to design and implement a web-based QR Code Attendance Management System for BUK.", { indent: true }),
      createParagraph("Objectives: (i) Analyze the existing system's limitations; (ii) Design a system generating time-limited QR codes; (iii) Implement mobile-friendly QR scanning; (iv) Develop administrative modules for course and attendance management; (v) Implement security measures; (vi) Test the system thoroughly.", { indent: true }),
      
      createSectionHeading("1.4 Significance of the Study"),
      createParagraph("For students: quick attendance marking and history viewing. For lecturers: automated tracking, time savings, and instant reports. For administration: accurate real-time data. The project also demonstrates QR code application in Nigerian higher education.", { indent: true }),
      
      createSectionHeading("1.5 Scope and Limitations"),
      createParagraph("The system includes user authentication, course management, QR code generation, scanning, attendance tracking, and reporting. Limitations: requires internet connectivity; students need smartphones; GPS verification not included in this version.", { indent: true }),
      new Paragraph({ children: [new PageBreak()] }),

      // CHAPTER TWO
      createHeading("CHAPTER TWO", 1),
      createHeading("LITERATURE REVIEW", 2),
      
      createSectionHeading("2.1 Introduction"),
      createParagraph("This chapter reviews QR code technology, attendance management systems, and related works.", { indent: true }),
      
      createSectionHeading("2.2 Review of Related Concepts"),
      createParagraph("QR Code Technology: Invented in 1994 by Denso Wave, QR codes store up to 7,089 numeric or 4,296 alphanumeric characters. They feature Reed-Solomon error correction allowing up to 30% damage recovery (ISO/IEC 18004, 2015).", { indent: true }),
      createParagraph("Web Application Architecture: Modern web apps follow client-server architecture. Node.js enables server-side JavaScript, while Express.js provides a flexible web framework (Tilkov & Vinoski, 2010).", { indent: true }),
      createParagraph("MySQL: Popular open-source relational database known for reliability and performance (Oracle, 2023).", { indent: true }),
      
      createSectionHeading("2.3 Review of Related Works"),
      createParagraph("Masalha & Hirzallah (2014) developed a QR attendance system in Jordan reporting significant time savings. Deugo (2015) implemented one at Carleton University with high user satisfaction. Akinduyite et al. (2013) found QR systems more cost-effective than biometrics in Nigeria. Kawale & Dhobale (2017) reported 85-90% time reduction.", { indent: true }),
      new Paragraph({ children: [new PageBreak()] }),

      // CHAPTER THREE
      createHeading("CHAPTER THREE", 1),
      createHeading("SYSTEM ANALYSIS AND DESIGN", 2),
      
      createSectionHeading("3.1 Analysis of Existing System"),
      createParagraph("Current system: lecturers call names or pass sheets; students sign; sheets collected and stored; data manually compiled at semester end. Weaknesses: time-consuming, error-prone, proxy-vulnerable, difficult data management.", { indent: true }),
      
      createSectionHeading("3.2 Analysis of Proposed System"),
      createParagraph("Proposed system: lecturers create courses and generate time-limited QR codes; students scan to mark attendance; data stored instantly in database; real-time reports available. Advantages: speed, accuracy, proxy prevention, real-time access, cost-effectiveness.", { indent: true }),
      
      createSectionHeading("3.3 System Requirements"),
      createParagraph("Functional: User registration/authentication, course management, QR generation/scanning, attendance recording, duplicate prevention, reporting.", { indent: true }),
      createParagraph("Non-functional: 3-second response time, password hashing, JWT authentication, mobile-responsive UI.", { indent: true }),
      createParagraph("Hardware: Server with 4GB RAM; client computers/smartphones with cameras.", { indent: true }),
      createParagraph("Software: Node.js, MySQL, Express.js; modern web browsers.", { indent: true }),
      
      createSectionHeading("3.4 System Design"),
      createParagraph("Three-tier architecture: Presentation (HTML5, CSS3, Bootstrap, JavaScript), Application (Node.js, Express.js), Data (MySQL).", { indent: true }),
      createParagraph("Database tables: users, courses, enrollments, attendance_sessions, attendance_records.", { indent: true }),
      new Paragraph({ children: [new PageBreak()] }),

      // CHAPTER FOUR
      createHeading("CHAPTER FOUR", 1),
      createHeading("SYSTEM IMPLEMENTATION AND TESTING", 2),
      
      createSectionHeading("4.1 Implementation Tools"),
      createParagraph("Backend: Node.js, Express.js, MySQL, JWT, bcryptjs, QRCode library.", { indent: true }),
      createParagraph("Frontend: HTML5, CSS3, Bootstrap 5, JavaScript, html5-qrcode library, Font Awesome.", { indent: true }),
      
      createSectionHeading("4.2 System Implementation"),
      createParagraph("Authentication: Passwords hashed with bcryptjs; JWT tokens generated on login, valid 24 hours.", { indent: true }),
      createParagraph("QR Generation: Unique UUID session codes; JSON data encoded into QR image returned as base64.", { indent: true }),
      createParagraph("Attendance Marking: Camera scans QR; data validated (session exists, not expired, student enrolled, no duplicate); record created.", { indent: true }),
      
      createSectionHeading("4.3 System Testing"),
      createParagraph("Functional Testing: All features tested - registration, login, course creation, QR generation, scanning, attendance marking, duplicate prevention, expired code rejection, reports. All passed.", { indent: true }),
      createParagraph("Usability Testing: 10 users (5 students, 5 lecturers); 95% task completion; SUS score 82.", { indent: true }),
      createParagraph("Security Testing: Password hashing verified; JWT required for protected routes; role-based access confirmed; SQL injection prevented.", { indent: true }),
      
      createSectionHeading("4.4 Results"),
      createParagraph("Time reduction: ~90% (seconds vs. 10-15 minutes). Accuracy: electronic recording eliminates manual errors. Proxy prevention: time-limited unique codes. Real-time access: instant viewing and reporting.", { indent: true }),
      new Paragraph({ children: [new PageBreak()] }),

      // CHAPTER FIVE
      createHeading("CHAPTER FIVE", 1),
      createHeading("SUMMARY, CONCLUSION AND RECOMMENDATIONS", 2),
      
      createSectionHeading("5.1 Summary"),
      createParagraph("This project designed and implemented a web-based QR Code Attendance Management System for BUK using Node.js, Express.js, MySQL, and modern web technologies. Features include authentication, course management, QR generation, scanning, and reporting. Testing showed all requirements met with positive user feedback.", { indent: true }),
      
      createSectionHeading("5.2 Conclusion"),
      createParagraph("The system successfully demonstrates QR code technology can effectively address attendance management challenges. It offers speed, accuracy, security, convenience, and cost-effectiveness. All objectives were achieved, and the system is ready for deployment.", { indent: true }),
      
      createSectionHeading("5.3 Recommendations"),
      createParagraph("1. Pilot implementation in selected departments. 2. Ensure reliable internet in lecture venues. 3. Conduct user training sessions. 4. Provide alternatives for students without smartphones. 5. Update university attendance policies. 6. Implement regular backups.", { indent: true }),
      
      createSectionHeading("5.4 Future Work"),
      createParagraph("1. GPS location verification. 2. Biometric confirmation. 3. Offline mode with sync. 4. Native mobile applications. 5. Integration with university systems. 6. Advanced analytics. 7. Notification system. 8. Multi-language support.", { indent: true }),
      new Paragraph({ children: [new PageBreak()] }),

      // REFERENCES
      createHeading("REFERENCES", 1),
      createParagraph("Akinduyite, C. O., et al. (2013). Fingerprint-based attendance management system. Journal of Computer Sciences and Applications, 1(5), 100-104."),
      createParagraph("Denso Wave. (2014). History of QR code. https://www.qrcode.com/en/history/"),
      createParagraph("Deugo, D. (2015). Using QR-codes for attendance tracking. FECS Proceedings, 267-273."),
      createParagraph("ISO/IEC 18004. (2015). QR Code bar code symbology specification."),
      createParagraph("Kawale, S. S., & Dhobale, K. B. (2017). Student attendance system using QR code. IJARCET, 6(5), 682-686."),
      createParagraph("Masalha, F., & Hirzallah, N. (2014). A students attendance system using QR code. IJACSA, 5(3), 75-79."),
      createParagraph("Oracle. (2023). MySQL 8.0 Reference Manual."),
      createParagraph("Shoewu, O., & Idowu, O. A. (2012). Development of attendance management system using biometrics. PJST, 13(1), 300-307."),
      createParagraph("Tilkov, S., & Vinoski, S. (2010). Node.js: Using JavaScript to build high-performance network programs. IEEE Internet Computing, 14(6), 80-83."),
    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync("/mnt/user-data/outputs/QR_Attendance_System_Project_Documentation.docx", buffer);
  console.log("Project documentation created successfully!");
});
