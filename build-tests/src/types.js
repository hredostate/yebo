export var EmploymentStatus;
(function (EmploymentStatus) {
    EmploymentStatus["Active"] = "Active";
    EmploymentStatus["Resigned"] = "Resigned";
    EmploymentStatus["Fired"] = "Fired";
    EmploymentStatus["Suspended"] = "Suspended";
    EmploymentStatus["LongLeave"] = "Long Leave";
})(EmploymentStatus || (EmploymentStatus = {}));
export var StudentStatus;
(function (StudentStatus) {
    StudentStatus["Active"] = "Active";
    StudentStatus["DisciplinarySuspension"] = "Disciplinary Suspension";
    StudentStatus["Expelled"] = "Expelled";
    StudentStatus["FinancialSuspension"] = "Financial Suspension";
    StudentStatus["OnLeave"] = "On Leave";
    StudentStatus["Transferred"] = "Transferred";
    StudentStatus["Graduated"] = "Graduated";
    StudentStatus["Withdrawn"] = "Withdrawn";
    StudentStatus["DistanceLearner"] = "Distance Learner";
})(StudentStatus || (StudentStatus = {}));
export var TaskPriority;
(function (TaskPriority) {
    TaskPriority["Critical"] = "Critical";
    TaskPriority["High"] = "High";
    TaskPriority["Medium"] = "Medium";
    TaskPriority["Low"] = "Low";
})(TaskPriority || (TaskPriority = {}));
export var TaskStatus;
(function (TaskStatus) {
    TaskStatus["ToDo"] = "ToDo";
    TaskStatus["InProgress"] = "InProgress";
    TaskStatus["Completed"] = "Completed";
    TaskStatus["Archived"] = "Archived";
})(TaskStatus || (TaskStatus = {}));
export var ReportType;
(function (ReportType) {
    ReportType["Incident"] = "Incident";
    ReportType["Infraction"] = "Teacher Infraction";
    ReportType["Observation"] = "Observation";
    ReportType["DailyCheckIn"] = "Daily Check-in";
    ReportType["NextDayAgenda"] = "Next Day Agenda";
    ReportType["MaintenanceRequest"] = "Maintenance Request";
    ReportType["SupplyRequisition"] = "Supply Requisition";
    ReportType["Accident"] = "Accident";
    ReportType["Health"] = "Health";
    ReportType["Discipline"] = "Strike";
})(ReportType || (ReportType = {}));
export var SubmissionStatus;
(function (SubmissionStatus) {
    SubmissionStatus["Pending"] = "Pending";
    SubmissionStatus["OnTime"] = "On Time";
    SubmissionStatus["Late"] = "Late";
    SubmissionStatus["Missed"] = "Missed";
})(SubmissionStatus || (SubmissionStatus = {}));
export var CoverageStatus;
(function (CoverageStatus) {
    CoverageStatus["Pending"] = "Pending";
    CoverageStatus["FullyCovered"] = "Fully Covered";
    CoverageStatus["PartiallyCovered"] = "Partially Covered";
    CoverageStatus["NotCovered"] = "Not Covered";
})(CoverageStatus || (CoverageStatus = {}));
export var ClassGroupType;
(function (ClassGroupType) {
    ClassGroupType["ClassTeacher"] = "class_teacher";
    ClassGroupType["SubjectTeacher"] = "subject_teacher";
})(ClassGroupType || (ClassGroupType = {}));
export var AttendanceStatus;
(function (AttendanceStatus) {
    AttendanceStatus["Present"] = "Present";
    AttendanceStatus["Absent"] = "Absent";
    AttendanceStatus["Late"] = "Late";
    AttendanceStatus["Excused"] = "Excused";
    AttendanceStatus["Remote"] = "Remote";
})(AttendanceStatus || (AttendanceStatus = {}));
export var LeaveRequestStatus;
(function (LeaveRequestStatus) {
    LeaveRequestStatus["Pending"] = "pending";
    LeaveRequestStatus["Approved"] = "approved";
    LeaveRequestStatus["Rejected"] = "rejected";
    LeaveRequestStatus["Cancelled"] = "cancelled";
})(LeaveRequestStatus || (LeaveRequestStatus = {}));
export var LedgerInvoiceStatus;
(function (LedgerInvoiceStatus) {
    LedgerInvoiceStatus["Draft"] = "DRAFT";
    LedgerInvoiceStatus["Issued"] = "ISSUED";
    LedgerInvoiceStatus["PartiallyPaid"] = "PARTIALLY_PAID";
    LedgerInvoiceStatus["Paid"] = "PAID";
    LedgerInvoiceStatus["Void"] = "VOID";
})(LedgerInvoiceStatus || (LedgerInvoiceStatus = {}));
export var LedgerPaymentMethod;
(function (LedgerPaymentMethod) {
    LedgerPaymentMethod["Offline"] = "OFFLINE";
    LedgerPaymentMethod["Paystack"] = "PAYSTACK";
    LedgerPaymentMethod["Transfer"] = "TRANSFER";
    LedgerPaymentMethod["Cash"] = "CASH";
    LedgerPaymentMethod["POS"] = "POS";
})(LedgerPaymentMethod || (LedgerPaymentMethod = {}));
export var LedgerPaymentStatus;
(function (LedgerPaymentStatus) {
    LedgerPaymentStatus["Pending"] = "PENDING";
    LedgerPaymentStatus["Success"] = "SUCCESS";
    LedgerPaymentStatus["Failed"] = "FAILED";
    LedgerPaymentStatus["Reversed"] = "REVERSED";
})(LedgerPaymentStatus || (LedgerPaymentStatus = {}));
export var LedgerAdjustmentType;
(function (LedgerAdjustmentType) {
    LedgerAdjustmentType["Discount"] = "DISCOUNT";
    LedgerAdjustmentType["Waiver"] = "WAIVER";
    LedgerAdjustmentType["Scholarship"] = "SCHOLARSHIP";
    LedgerAdjustmentType["Surcharge"] = "SURCHARGE";
    LedgerAdjustmentType["Correction"] = "CORRECTION";
})(LedgerAdjustmentType || (LedgerAdjustmentType = {}));
export var InvoiceStatus;
(function (InvoiceStatus) {
    InvoiceStatus["Unpaid"] = "Unpaid";
    InvoiceStatus["PartiallyPaid"] = "Partially Paid";
    InvoiceStatus["Paid"] = "Paid";
    InvoiceStatus["Overdue"] = "Overdue";
    InvoiceStatus["Void"] = "Void";
})(InvoiceStatus || (InvoiceStatus = {}));
