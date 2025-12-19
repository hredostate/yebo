/**
 * Type definitions for the Manuals System
 */

// Manual Category enum
export type ManualCategory = 
  | 'Academic'
  | 'Administrative'
  | 'Safety & Security'
  | 'IT & Technology'
  | 'Student Handbook'
  | 'Teacher Guide'
  | 'General';

// Target Audience enum
export type TargetAudience = 'teachers' | 'students' | 'both';

// Manual status enum
export type ManualStatus = 'draft' | 'published' | 'archived';

// Assignment status enum
export type AssignmentStatus = 'pending' | 'in_progress' | 'completed' | 'overdue';

// Compliance action enum
export type ComplianceAction = 'assigned' | 'started' | 'completed' | 'acknowledged' | 'reminder_sent';

/**
 * Manual interface representing a PDF instruction manual
 */
export interface Manual {
  id: number;
  school_id: number;
  title: string;
  description: string | null;
  category: ManualCategory;
  file_url: string;
  file_path: string;
  file_size_bytes: number;
  version: number;
  status: ManualStatus;
  target_audience: TargetAudience[];
  restricted_to_classes: number[] | null;
  restricted_to_roles: string[] | null;
  
  // Compliance fields
  is_compulsory: boolean;
  compulsory_for_roles: string[] | null;
  compulsory_for_new_staff: boolean;
  days_to_complete: number;
  requires_acknowledgment: boolean;
  acknowledgment_text: string | null;
  
  // Metadata
  uploaded_by: string;
  published_at: string | null;
  published_by: string | null;
  created_at: string;
  updated_at: string;
  
  // Optional relations
  uploader?: { id: string; name: string };
  publisher?: { id: string; name: string };
}

/**
 * Manual Assignment interface tracking user's assigned manuals
 */
export interface ManualAssignment {
  id: number;
  manual_id: number;
  user_id: string;
  school_id: number;
  
  // Assignment metadata
  assigned_at: string;
  assigned_by: string | null;
  due_date: string | null;
  reason: string | null;
  
  // Status tracking
  status: AssignmentStatus;
  started_at: string | null;
  completed_at: string | null;
  time_spent_seconds: number;
  
  // Acknowledgment
  acknowledged: boolean;
  acknowledged_at: string | null;
  acknowledgment_signature: string | null;
  ip_address: string | null;
  
  // Reminders
  reminder_sent_at: string | null;
  reminder_count: number;
  
  // Optional relations
  manual?: Manual;
  user?: { id: string; name: string; role: string };
  assigner?: { id: string; name: string };
}

/**
 * Manual Read Session for tracking reading progress
 */
export interface ManualReadSession {
  id: number;
  assignment_id: number;
  user_id: string;
  manual_id: number;
  session_start: string;
  session_end: string | null;
  pages_viewed: number[] | null;
  last_page_viewed: number | null;
  total_pages: number | null;
}

/**
 * Compliance Log Entry for audit trail
 */
export interface ManualComplianceLog {
  id: number;
  manual_id: number;
  user_id: string;
  action: ComplianceAction;
  details: Record<string, any> | null;
  performed_by: string | null;
  created_at: string;
}

/**
 * Form data for creating/editing a manual
 */
export interface ManualFormData {
  title: string;
  description: string;
  category: ManualCategory;
  target_audience: TargetAudience[];
  restricted_to_classes: number[];
  restricted_to_roles: string[];
  is_compulsory: boolean;
  compulsory_for_roles: string[];
  compulsory_for_new_staff: boolean;
  days_to_complete: number;
  requires_acknowledgment: boolean;
  acknowledgment_text: string;
}

/**
 * Completion statistics for a manual
 */
export interface CompletionStats {
  manual_id: number;
  manual_title: string;
  total_assigned: number;
  completed: number;
  in_progress: number;
  pending: number;
  overdue: number;
  completion_rate: number;
  average_time_to_complete: number;
}

/**
 * Compliance dashboard data aggregating all stats
 */
export interface ComplianceDashboardData {
  overall_stats: {
    total_manuals: number;
    total_assignments: number;
    total_completed: number;
    total_overdue: number;
    overall_completion_rate: number;
  };
  by_manual: CompletionStats[];
  overdue_users: {
    user_id: string;
    user_name: string;
    user_role: string;
    manual_id: number;
    manual_title: string;
    due_date: string;
    days_overdue: number;
  }[];
  recent_completions: {
    user_id: string;
    user_name: string;
    manual_id: number;
    manual_title: string;
    completed_at: string;
  }[];
}

/**
 * User compliance view showing a specific user's status
 */
export interface UserComplianceData {
  user_id: string;
  user_name: string;
  user_role: string;
  assignments: ManualAssignment[];
  completion_rate: number;
  total_time_spent: number;
  overdue_count: number;
}
