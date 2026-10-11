import api from './client';

export const sponsorApi = {
  list: (params?: { page?: number; page_size?: number; status?: string; search?: string }) =>
    api.get('/sponsors', { params }),

  get: (id: number) => api.get(`/sponsors/${id}`),

  create: (data: any) => api.post('/sponsors', data),

  update: (id: number, data: any) => api.patch(`/sponsors/${id}`, data),

  delete: (id: number) => api.delete(`/sponsors/${id}`),

  research: (id: number) => api.post(`/sponsors/${id}/research`),

  prioritize: (id: number, event_id?: number) => api.post(`/sponsors/${id}/prioritize`, { event_id }),

  researchAndPrioritize: (id: number, event_id?: number) =>
    api.post(`/sponsors/${id}/research-and-prioritize`, { event_id }),

  getEmails: (id: number) => api.get(`/sponsors/${id}/emails`),

  createEmailDraft: (sponsorId: number, data: {
    email_type: string;
    event_id?: number;
    sender_id?: number;
  }) => api.post(`/sponsors/${sponsorId}/emails/draft`, data),

  checkDuplicates: (data: {
    company_name: string;
    contact_email?: string;
    contact_person?: string;
    website?: string;
    current_user_id?: number;
  }) => api.post('/duplicates/check', data),

  merge: (primaryId: number, duplicateId: number, mergedBy: number) =>
    api.post('/duplicates/merge', { primary_sponsor_id: primaryId, duplicate_sponsor_id: duplicateId, merged_by: mergedBy }),
};

export const emailApi = {
  list: (sponsorId: number) => api.get(`/sponsors/${sponsorId}/emails`),

  get: (id: number) => api.get(`/emails/${id}`),

  create: (data: any) => api.post('/emails', data),

  update: (id: number, data: any) => api.patch(`/emails/${id}`, data),

  submitForApproval: (id: number) => api.post(`/emails/${id}/submit-for-approval`),

  approve: (id: number, approverId: number) => api.post(`/emails/${id}/approve?approver_id=${approverId}`),

  reject: (id: number, rejecterId: number, reason: string) =>
    api.post(`/emails/${id}/reject?rejecter_id=${rejecterId}&reason=${encodeURIComponent(reason)}`),

  send: (id: number) => api.post(`/emails/${id}/send`),

  regenerate: (id: number) => api.post(`/emails/${id}/regenerate`),

  getTemplates: (emailType?: string) => api.get('/email-templates', { params: { email_type: emailType } }),

  createTemplate: (data: any) => api.post('/email-templates', data),
};

export const replyApi = {
  list: (sponsorId: number) => api.get(`/sponsors/${sponsorId}/replies`),

  process: (sponsorId: number, data: {
    from_email: string;
    subject: string;
    body: string;
    body_html?: string;
    message_id?: string;
    in_reply_to?: string;
  }) => api.post(`/sponsors/${sponsorId}/replies/process`, data),
};

export const followUpApi = {
  list: (sponsorId: number) => api.get(`/sponsors/${sponsorId}/follow-ups`),

  status: (sponsorId: number) => api.get(`/sponsors/${sponsorId}/follow-up-status`),

  checkAndSchedule: () => api.post('/follow-ups/check-and-schedule'),

  approve: (emailId: number, approverId: number) =>
    api.post(`/emails/${emailId}/approve?approver_id=${approverId}`),

  reject: (emailId: number, rejecterId: number, reason: string) =>
    api.post(`/emails/${emailId}/reject?rejecter_id=${rejecterId}&reason=${encodeURIComponent(reason)}`),

  send: (emailId: number) => api.post(`/emails/${emailId}/send`),
};

export const meetingApi = {
  list: (params?: { status?: string; team_member_id?: number; sponsor_id?: number }) =>
    api.get('/meetings', { params }),

  get: (id: number) => api.get(`/meetings/${id}`),

  create: (data: {
    sponsor_id: number;
    team_member_id: number;
    title: string;
    description?: string;
    scheduled_at: string;
    duration_minutes?: number;
    location?: string;
    meeting_link?: string;
  }) => api.post('/meetings', data),

  update: (id: number, data: any) => api.patch(`/meetings/${id}`, data),

  schedule: (id: number, scheduledAt: string, durationMinutes?: number, location?: string, meetingLink?: string) =>
    api.patch(`/meetings/${id}?status=Meeting%20Scheduled&scheduled_at=${scheduledAt}&duration_minutes=${durationMinutes || 30}&location=${location || ''}&meeting_link=${meetingLink || ''}`),

  complete: (id: number, outcome?: string, notes?: string) =>
    api.patch(`/meetings/${id}?status=Meeting%20Completed&outcome=${encodeURIComponent(outcome || '')}&notes=${encodeURIComponent(notes || '')}`),

  cancel: (id: number, reason?: string) =>
    api.patch(`/meetings/${id}?status=Meeting%20Cancelled&notes=${encodeURIComponent(reason || '')}`),

  getCalendarLinks: (id: number) => api.get(`/meetings/${id}/calendar-links`),

  getSponsorMeetings: (sponsorId: number) => api.get('/meetings', { params: { sponsor_id: sponsorId } }),
};

export const dashboardApi = {
  getStats: () => api.get('/dashboard/stats'),
  getPipeline: () => api.get('/dashboard/pipeline'),
  getTeamPerformance: () => api.get('/dashboard/team-performance'),
  getConversionFunnel: () => api.get('/dashboard/conversion-funnel'),
  getSponsorshipBreakdown: () => api.get('/dashboard/sponsorship-breakdown'),
  getWeeklyTrends: (weeks?: number) => api.get('/dashboard/weekly-trends', { params: { weeks } }),
  getTopSponsors: (limit?: number) => api.get('/dashboard/top-sponsors', { params: { limit } }),
};

export const notificationApi = {
  list: (teamMemberId: number, params?: { unread_only?: boolean; limit?: number; offset?: number }) =>
    api.get('/notifications', { params: { team_member_id: teamMemberId, ...params } }),

  getUnreadCount: (teamMemberId: number) => api.get('/notifications/unread-count', { params: { team_member_id: teamMemberId } }),

  markAsRead: (notificationId: number, teamMemberId: number) =>
    api.post(`/notifications/${notificationId}/read`, { team_member_id: teamMemberId }),

  markAllAsRead: (teamMemberId: number) => api.post('/notifications/read-all', { team_member_id: teamMemberId }),

  delete: (notificationId: number, teamMemberId: number) =>
    api.delete(`/notifications/${notificationId}`, { params: { team_member_id: teamMemberId } }),
};

export const teamMemberApi = {
  list: (activeOnly?: boolean) => api.get('/team-members', { params: { active_only: activeOnly } }),
  get: (id: number) => api.get(`/team-members/${id}`),
  create: (data: any) => api.post('/team-members', data),
  update: (id: number, data: any) => api.patch(`/team-members/${id}`, data),
};

export const eventApi = {
  list: (activeOnly?: boolean) => api.get('/events', { params: { active_only: activeOnly } }),
  create: (data: any) => api.post('/events', data),
};

export const institutionalMemoryApi = {
  list: () => api.get('/institutional-memory'),
  createOrUpdate: (data: any) => api.post('/institutional-memory', data),
};

export const agentApi = {
  start: (data: { event_id?: number; campaign_name?: string; max_iterations?: number; interval?: number }) =>
    api.post('/agent/start', data),
  stop: () => api.post('/agent/stop'),
  status: () => api.get('/agent/status'),
  pause: (sponsorId: number) => api.post(`/agent/pause/${sponsorId}`),
  resume: (sponsorId: number) => api.post(`/agent/resume/${sponsorId}`),
  approve: (sponsorId: number, approverId: number) => api.post(`/agent/approve/${sponsorId}?approver_id=${approverId}`),
  reject: (sponsorId: number, rejecterId: number, reason: string) =>
    api.post(`/agent/reject/${sponsorId}?rejecter_id=${rejecterId}&reason=${encodeURIComponent(reason)}`),
};
