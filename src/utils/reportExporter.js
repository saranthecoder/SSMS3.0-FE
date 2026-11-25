import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export const exportStudentReportPDF = (report) => {
  const snap = report?.dataSnapshot || {};
  const student = snap.student || report.studentId || {};
  const batch = snap.batch || report.batchId || {};
  const period = snap.period || {
    reportType: report.reportType,
    startDate: report.startDate,
    endDate: report.endDate
  };
  const att = snap.attendance || {};
  const wh = snap.workingHours || {};
  const tasks = snap.tasks || {};
  const grades = snap.grades || {};
  const lc = snap.leetcode || {};
  const lb = snap.leaderboard || {};
  const cons = snap.consistency || {};
  const fb = report.mentorFeedback || {};

  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header Banner
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 88, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('SSMS 2.0 — Student Performance Report', 40, 36);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Report Type: ${String(period.reportType || '').toUpperCase()}   |   Period: ${period.startDate} to ${period.endDate}`, 40, 56);
  doc.text(`Generated: ${new Date(report.generatedAt || Date.now()).toLocaleDateString('en-GB')}   |   Version: v${report.version || 1}`, 40, 72);

  // Student Metadata
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Student: ${student.name || 'N/A'} (${student.rollNumber || 'N/A'})`, 40, 114);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Batch: ${batch.batchName || 'N/A'}   |   Joined: ${student.joiningDate || report.joiningDate || 'N/A'}`, 40, 130);
  doc.text(`Overall Consistency Score: ${cons.overallScore ?? 0}%   |   Leaderboard: #${lb.periodRank || lb.currentRank || 'N/A'} (${lb.rankLabel || 'Snapshot'})`, 40, 146);

  // KPI Summary Table
  autoTable(doc, {
    startY: 162,
    head: [['Module', 'Key Metrics', 'Details']],
    body: [
      [
        'Attendance',
        `${att.attendancePercentage ?? 0}% (${att.presentDays ?? 0}/${att.eligibleTrainingDays ?? 0} days)`,
        `Absent: ${att.absentDays ?? 0}, Leave: ${att.leaveDays ?? 0}, Streak: ${att.consecutiveStreak ?? 0}d`
      ],
      [
        'Working Hours',
        `${wh.total?.totalHours ?? 0} hrs (${wh.total?.avgDailyHours ?? 0}h/day avg)`,
        `On-Site: ${wh.onsite?.totalHours ?? 0}h (${wh.onsite?.days ?? 0}d) | WFH: ${wh.wfh?.totalHours ?? 0}h (${wh.wfh?.days ?? 0}d)`
      ],
      [
        'Tasks',
        `${tasks.completionPercentage ?? 0}% (${tasks.completed ?? 0}/${tasks.assigned ?? 0})`,
        `On-Time: ${tasks.onTime ?? 0}, Late: ${tasks.late ?? 0}, Pending: ${tasks.pending ?? 0}, Overdue: ${tasks.overdue ?? 0}`
      ],
      [
        'Grades',
        grades.evaluatedAvailable ? `${grades.averagePercentage}% Avg` : 'Not Evaluated',
        grades.evaluatedAvailable ? `Assessments: ${grades.totalAssessments}, High: ${grades.highestPercentage}%, Trend: ${grades.trendLabel}` : 'No graded assessments in period'
      ],
      [
        'LeetCode',
        `${lc.totalSolved ?? 0} / ${lc.totalAssigned ?? 0} Solved`,
        `Active Days: ${lc.activeProblemSolvingDays ?? 0}, Longest Streak: ${lc.longestStreak ?? 0}d`
      ]
    ],
    theme: 'grid',
    headStyles: { fillColor: [79, 70, 229], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 8.5, cellPadding: 5 }
  });

  // Task Details Table
  if (Array.isArray(tasks.details) && tasks.details.length > 0) {
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 14,
      head: [['Task', 'Category', 'Deadline', 'Status', 'Grade', 'Timeliness']],
      body: tasks.details.slice(0, 20).map(t => [
        t.title,
        t.category,
        t.deadline,
        t.completionStatus,
        t.grade,
        t.onTimeStatus
      ]),
      theme: 'striped',
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 8.5 },
      bodyStyles: { fontSize: 8 }
    });
  }

  // Strengths & Improvement Areas + Mentor Feedback
  let y = (doc.lastAutoTable?.finalY || 300) + 20;
  if (y > 700) {
    doc.addPage();
    y = 40;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Mentor Feedback & Recommendations', 40, y);
  y += 14;

  const fbRows = [
    ['Overall Observation', fb.overallObservation || '—'],
    ['Strengths', fb.strengths || (snap.strengths || []).join('; ') || '—'],
    ['Areas for Improvement', fb.areasForImprovement || (snap.improvementAreas || []).join('; ') || '—'],
    ['Next Steps / Goals', fb.nextMonthGoals || fb.recommendedPractice || '—']
  ];

  autoTable(doc, {
    startY: y,
    body: fbRows,
    theme: 'grid',
    columnStyles: { 0: { cellWidth: 140, fontStyle: 'bold', fillColor: [241, 245, 249] } },
    bodyStyles: { fontSize: 8.5, cellPadding: 6 }
  });

  const safeName = (student.name || 'Student').replace(/[^a-z0-9]/gi, '_');
  doc.save(`SSMS_Report_${safeName}_${period.reportType}_${period.endDate}.pdf`);
};

export const exportBatchSummaryPDF = (batchName, periodLabel, reports, batchAnalytics = {}) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 72, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(`SSMS 2.0 — Batch Performance Report: ${batchName}`, 36, 32);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Period: ${periodLabel}   |   Students: ${reports.length}   |   Avg Consistency: ${batchAnalytics.avgConsistencyScore ?? 0}%   |   Avg Attendance: ${batchAnalytics.avgAttendancePct ?? 0}%`, 36, 52);

  autoTable(doc, {
    startY: 88,
    head: [['Roll No', 'Student Name', 'Attendance %', 'Task Comp %', 'Avg Grade', 'OS Hours', 'WFH Hours', 'LeetCode', 'Score %', 'Status']],
    body: reports.map(r => {
      const s = r.dataSnapshot || {};
      return [
        r.studentId?.rollNumber || s.student?.rollNumber || '—',
        r.studentId?.name || s.student?.name || '—',
        `${s.attendance?.attendancePercentage ?? 0}%`,
        `${s.tasks?.completionPercentage ?? 0}%`,
        s.grades?.evaluatedAvailable ? `${s.grades.averagePercentage}%` : 'Not Evaluated',
        `${s.workingHours?.onsite?.totalHours ?? 0}h`,
        `${s.workingHours?.wfh?.totalHours ?? 0}h`,
        `${s.leetcode?.totalSolved ?? 0}/${s.leetcode?.totalAssigned ?? 0}`,
        `${s.consistency?.overallScore ?? 0}%`,
        String(r.status || '').toUpperCase()
      ];
    }),
    theme: 'grid',
    headStyles: { fillColor: [79, 70, 229], textColor: 255, fontSize: 8.5 },
    bodyStyles: { fontSize: 8 }
  });

  const safeBatch = (batchName || 'Batch').replace(/[^a-z0-9]/gi, '_');
  doc.save(`SSMS_Batch_Report_${safeBatch}_${periodLabel}.pdf`);
};

export const exportBatchReportsExcel = (batchName, periodLabel, reports, format = 'xlsx') => {
  const rows = reports.map(r => {
    const s = r.dataSnapshot || {};
    return {
      'Roll Number': r.studentId?.rollNumber || s.student?.rollNumber || '',
      'Student Name': r.studentId?.name || s.student?.name || '',
      'Report Type': r.reportType,
      'Start Date': r.startDate,
      'End Date': r.endDate,
      'Attendance %': s.attendance?.attendancePercentage ?? 0,
      'Present Days': s.attendance?.presentDays ?? 0,
      'Eligible Days': s.attendance?.eligibleTrainingDays ?? 0,
      'Tasks Assigned': s.tasks?.assigned ?? 0,
      'Tasks Completed': s.tasks?.completed ?? 0,
      'Tasks Overdue': s.tasks?.overdue ?? 0,
      'Task Completion %': s.tasks?.completionPercentage ?? 0,
      'Avg Grade %': s.grades?.evaluatedAvailable ? s.grades.averagePercentage : 'Not Evaluated',
      'On-Site Hours': s.workingHours?.onsite?.totalHours ?? 0,
      'WFH Hours': s.workingHours?.wfh?.totalHours ?? 0,
      'Total Working Hours': s.workingHours?.total?.totalHours ?? 0,
      'LeetCode Solved': s.leetcode?.totalSolved ?? 0,
      'LeetCode Assigned': s.leetcode?.totalAssigned ?? 0,
      'Consistency Score %': s.consistency?.overallScore ?? 0,
      'Rank': s.leaderboard?.periodRank || s.leaderboard?.currentRank || 'N/A',
      'Release Status': r.status
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Performance Reports');

  const safeBatch = (batchName || 'Batch').replace(/[^a-z0-9]/gi, '_');
  if (format === 'csv') {
    XLSX.writeFile(wb, `SSMS_Batch_Reports_${safeBatch}_${periodLabel}.csv`, { bookType: 'csv' });
  } else {
    XLSX.writeFile(wb, `SSMS_Batch_Reports_${safeBatch}_${periodLabel}.xlsx`);
  }
};
