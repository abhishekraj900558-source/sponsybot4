export type SponsorStatus = 
  | 'Not Contacted'
  | 'Contacted'
  | 'Follow-up'
  | 'Interested'
  | 'Declined'
  | 'Closed';

export type EmailStatus = 
  | 'Draft'
  | 'Pending Approval'
  | 'Approved'
  | 'Rejected'
  | 'Sent'
  | 'Failed';

export type ReplyClassification = 
  | 'Interested'
  | 'No Reply'
  | 'Declined';

export type SponsorshipType = 
  | 'Cash Sponsorship'
  | 'Swag / Goodies'
  | 'Infrastructure'
  | 'Cloud Credits'
  | 'Software Credits'
  | 'Hardware'
  | 'Food / Refreshments'
  | 'Marketing Support'
  | 'Other';

export type MeetingStatus = 
  | 'Meeting Requested'
  | 'Meeting Scheduled'
  | 'Meeting Completed'
  | 'Meeting Cancelled';

export type EmailStatusType = 
  | 'Draft'
  | 'Pending Approval'
  | 'Approved'
  | 'Rejected'
  | 'Sent'
  | 'Failed';

export interface Sponsor {
  id: number;
  company_name: string;
  company_category?: string;
  industry?: string;
  website?: string;
  size?: string;
  contact_person?: string;
  contact_email?: string;
  contact_role?: string;
  contact_linkedin?: string;
  contact_phone?: string;
  assignee_id?: number;
  notes?: string;
  status: SponsorStatus;
  priority_score: number;
  priority_tier?: string;
  recommended_sponsorship_types?: string[];
  recommendation_reasoning?: string;
  follow_up_count: number;
  last_contacted_at?: string;
  next_follow_up_at?: string;
  meeting_status?: MeetingStatus;
  meeting_scheduled_at?: string;
  meeting_notes?: string;
  sponsorship_won: boolean;
  sponsorship_amount?: number;
  sponsorship_benefits?: any[];
  research_data?: Record<string, any>;
  research_unverified?: Record<string, any>;
  research_last_updated?: string;
  research_source?: string;
  created_at: string;
  updated_at: string;
  assignee?: TeamMember;
}

export interface TeamMember {
  id: number;
  name: string;
  email: string;
  role?: string;
  is_active: boolean;
  created_at: string;
}

export interface EmailLog {
  id: number;
  sponsor_id: number;
  sender_id: number;
  subject: string;
  body: string;
  body_html?: string;
  status: EmailStatus;
  email_type: string;
  follow_up_number: number;
  approved_by?: number;
  approved_at?: string;
  rejected_by?: number;
  rejected_at?: string;
  rejection_reason?: string;
  sent_at?: string;
  message_id?: string;
  error_message?: string;
  attachments?: any[];
  created_at: string;
  updated_at: string;
  sponsor?: Sponsor;
  sender?: TeamMember;
}

export interface ReplyLog {
  id: number;
  sponsor_id: number;
  email_id: number;
  from_email: string;
  subject?: string;
  body?: string;
  body_html?: string;
  received_at: string;
  message_id?: string;
  classification?: ReplyClassification;
  classification_confidence?: number;
  summary?: string;
  suggested_action?: string;
  suggested_response?: string;
  processed_at?: string;
  processed_by?: number;
  created_at: string;
  sponsor?: Sponsor;
  email?: EmailLog;
}

export interface FollowUpSchedule {
  id: number;
  sponsor_id: number;
  email_id?: number;
  follow_up_number: number;
  scheduled_at: string;
  status: string;
  draft_subject?: string;
  draft_body?: string;
  created_at: string;
  updated_at: string;
}

export interface Meeting {
  id: number;
  sponsor_id: number;
  team_member_id: number;
  title: string;
  description?: string;
  scheduled_at: string;
  duration_minutes: number;
  location?: string;
  meeting_link?: string;
  status: MeetingStatus;
  calendar_event_id?: string;
  calendar_link?: string;
  notes?: string;
  outcome?: string;
  created_at: string;
  updated_at: string;
  sponsor?: Sponsor;
  team_member?: TeamMember;
}

export interface EmailTemplate {
  id: number;
  name: string;
  description?: string;
  email_type: string;
  subject_template: string;
  body_template: string;
  body_html_template?: string;
  variables?: Record<string, string>;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface Event {
  id: number;
  name: string;
  description?: string;
  start_date: string;
  end_date: string;
  location?: string;
  expected_attendees?: number;
  budget_target?: number;
  sponsorship_tiers?: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InstitutionalMemory {
  id: number;
  company_name: string;
  previous_sponsorships?: any[];
  total_contributed: number;
  preferred_sponsorship_types?: string[];
  contact_history?: any[];
  preferences?: string;
  last_event?: string;
  last_contact_year?: number;
  outcome_notes?: string;
  source?: string;
  verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: number;
  team_member_id: number;
  sponsor_id?: number;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  read_at?: string;
  action_url?: string;
  action_label?: string;
  created_at: string;
}

export interface DashboardStats {
  total_sponsors: number;
  by_status: Record<string, number>;
  response_rate: number;
  follow_up_rate: number;
  money_secured: number;
  benefits_secured: number;
  meetings_scheduled: number;
  sponsorships_won: number;
  recent_activity: any[];
}

export interface PipelineData {
  [key: string]: Sponsor[];
}

export interface TeamPerformance {
  team_member_id: number;
  name: string;
  email: string;
  role?: string;
  assigned_sponsors: number;
  emails_sent: number;
  replies_received: number;
  response_rate: number;
  interested_sponsors: number;
  sponsorships_won: number;
  money_secured: number;
}

export interface FollowUpAction {
  sponsor_id: number;
  follow_up_number: number;
  scheduled_at: string;
  draft_subject: string;
  draft_body: string;
  draft_body_html?: string;
  reason: string;
}

export interface EmailDraft {
  subject: string;
  body: string;
  body_html?: string;
  variables_used: Record<string, string>;
}

export interface ResearchResult {
  verified: Record<string, any>;
  unverified: Record<string, { value: any; note: string }>;
  sources: string[];
  researched_at: string;
  source: string;
}

export interface PrioritizationResult {
  priority_score: number;
  priority_tier: string;
  recommended_types: string[];
  reasoning: string;
  confidence: number;
}

export interface ReplyAnalysis {
  classification: ReplyClassification;
  confidence: number;
  summary: string;
  key_points: string[];
  suggested_action: string;
  suggested_response: string;
  requires_human_review: boolean;
}

export interface ConversionFunnel {
  total_prospects: number;
  contacted: number;
  replied: number;
  interested: number;
  meetings: number;
  won: number;
}

export interface SponsorshipBreakdown {
  by_type: Record<string, number>;
  total_cash: number;
  benefits_breakdown: Record<string, number>;
  total_sponsors_won: number;
}

export interface WeeklyTrend {
  week_start: string;
  week_end: string;
  emails_sent: number;
  replies_received: number;
  interested: number;
  won: number;
  response_rate: number;
}

export interface TopSponsor {
  id: number;
  company_name: string;
  priority_score: number;
  priority_tier: string;
  status: SponsorStatus;
  recommended_types: string[];
  assignee?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export type ApiResponse<T> = {
  data: T;
} | {
  error: string;
};

export type PaginationParams = {
  page?: number;
  page_size?: number;
};

export type SponsorFilterParams = PaginationParams & {
  status?: SponsorStatus;
  search?: string;
  assignee_id?: number;
};

export type EmailFilterParams = PaginationParams & {
  sponsor_id?: number;
  status?: EmailStatus;
  email_type?: string;
};

export type MeetingFilterParams = PaginationParams & {
  sponsor_id?: number;
  team_member_id?: number;
  status?: MeetingStatus;
};

export interface DuplicateCheckResult {
  is_duplicate: boolean;
  conflict_type?: string;
  details?: string;
  suggested_action?: string;
  existing_sponsor?: Sponsor;
}