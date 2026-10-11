import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../api/endpoints';

// Query keys
export const queryKeys = {
  sponsors: ['sponsors'] as const,
  sponsor: (id: number) => ['sponsor', id] as const,
  sponsorEmails: (sponsorId: number) => ['sponsorEmails', sponsorId] as const,
  sponsorReplies: (sponsorId: number) => ['sponsorReplies', sponsorId] as const,
  sponsorFollowUps: (sponsorId: number) => ['sponsorFollowUps', sponsorId] as const,
  sponsorFollowUpStatus: (sponsorId: number) => ['sponsorFollowUpStatus', sponsorId] as const,
  emails: (sponsorId?: number) => ['emails', sponsorId] as const,
  email: (id: number) => ['email', id] as const,
  emailTemplates: (emailType?: string) => ['emailTemplates', emailType] as const,
  meetings: (params?: any) => ['meetings', params] as const,
  meeting: (id: number) => ['meeting', id] as const,
  meetingsCalendarLinks: (id: number) => ['meetingsCalendarLinks', id] as const,
  dashboardStats: ['dashboardStats'] as const,
  dashboardPipeline: ['dashboardPipeline'] as const,
  teamPerformance: ['teamPerformance'] as const,
  dashboardFunnel: ['dashboardFunnel'] as const,
  sponsorshipBreakdown: ['sponsorshipBreakdown'] as const,
  weeklyTrends: (weeks?: number) => ['weeklyTrends', weeks] as const,
  topSponsors: (limit?: number) => ['topSponsors', limit] as const,
  teamMembers: (activeOnly?: boolean) => ['teamMembers', activeOnly] as const,
  events: (activeOnly?: boolean) => ['events', activeOnly] as const,
  notifications: (teamMemberId: number, unreadOnly?: boolean) => ['notifications', teamMemberId, unreadOnly] as const,
  unreadNotificationCount: (teamMemberId: number) => ['unreadNotificationCount', teamMemberId] as const,
  institutionalMemory: ['institutionalMemory'] as const,
  duplicateCheck: ['duplicateCheck'] as const,
};

// Sponsor hooks
export function useSponsors(params?: any) {
  return useQuery({
    queryKey: ['sponsors', params],
    queryFn: () => api.sponsorApi.list(params),
  });
}

export function useSponsor(id: number) {
  return useQuery({
    queryKey: ['sponsor', id],
    queryFn: () => api.sponsorApi.get(id),
    enabled: !!id,
  });
}

export function useCreateSponsor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.sponsorApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sponsors'] });
    },
  });
}

export function useUpdateSponsor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.sponsorApi.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['sponsor', id] });
      queryClient.invalidateQueries({ queryKey: ['sponsors'] });
    },
  });
}

export function useSponsorResearch(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.sponsorApi.research(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['sponsor', id] });
    },
  });
}

export function useSponsorPrioritize(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (eventId?: number) => api.sponsorApi.prioritize(id, eventId),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['sponsor', id] });
    },
  });
}

export function useSponsorResearchAndPrioritize(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (eventId?: number) => api.sponsorApi.researchAndPrioritize(id, eventId),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['sponsor', id] });
    },
  });
}

// Email hooks
export function useSponsorEmails(sponsorId: number) {
  return useQuery({
    queryKey: ['sponsorEmails', sponsorId],
    queryFn: () => api.emailApi.list(sponsorId),
    enabled: !!sponsorId,
  });
}

export function useEmailDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sponsorId, data }: { sponsorId: number; data: any }) => 
      api.sponsorApi.createEmailDraft(sponsorId, data),
    onSuccess: (_, { sponsorId }) => {
      queryClient.invalidateQueries({ queryKey: ['sponsorEmails', sponsorId] });
    },
  });
}

export function useEmail(id: number) {
  return useQuery({
    queryKey: ['email', id],
    queryFn: () => api.emailApi.get(id),
    enabled: !!id,
  });
}

export function useUpdateEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.emailApi.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['email', id] });
      queryClient.invalidateQueries({ queryKey: ['sponsorEmails'] });
    },
  });
}

export function useApproveEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, approverId }: { id: number; approverId: number }) => 
      api.emailApi.approve(id, approverId),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['email', id] });
      queryClient.invalidateQueries({ queryKey: ['sponsorEmails'] });
    },
  });
}

export function useRejectEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, rejecterId, reason }: { id: number; rejecterId: number; reason: string }) => 
      api.emailApi.reject(id, rejecterId, reason),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['email', id] });
      queryClient.invalidateQueries({ queryKey: ['sponsorEmails'] });
    },
  });
}

export function useSendEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.emailApi.send(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['email', id] });
      queryClient.invalidateQueries({ queryKey: ['sponsorEmails'] });
    },
  });
}

export function useRegenerateEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.emailApi.regenerate(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['email', id] });
    },
  });
}

export function useEmailTemplates(emailType?: string) {
  return useQuery({
    queryKey: ['emailTemplates', emailType],
    queryFn: () => api.emailApi.getTemplates(emailType),
  });
}

// Reply hooks
export function useSponsorReplies(sponsorId: number) {
  return useQuery({
    queryKey: ['sponsorReplies', sponsorId],
    queryFn: () => api.replyApi.list(sponsorId),
    enabled: !!sponsorId,
  });
}

export function useProcessReply() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sponsorId, data }: { sponsorId: number; data: any }) => 
      api.replyApi.process(sponsorId, data),
    onSuccess: (_, { sponsorId }) => {
      queryClient.invalidateQueries({ queryKey: ['sponsorReplies', sponsorId] });
      queryClient.invalidateQueries({ queryKey: ['sponsorFollowUps', sponsorId] });
    },
  });
}

// Follow-up hooks
export function useSponsorFollowUps(sponsorId: number) {
  return useQuery({
    queryKey: ['sponsorFollowUps', sponsorId],
    queryFn: () => api.followUpApi.list(sponsorId),
    enabled: !!sponsorId,
  });
}

export function useSponsorFollowUpStatus(sponsorId: number) {
  return useQuery({
    queryKey: ['sponsorFollowUpStatus', sponsorId],
    queryFn: () => api.followUpApi.status(sponsorId),
    enabled: !!sponsorId,
  });
}

export function useCheckAndScheduleFollowUps() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.followUpApi.checkAndSchedule(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sponsorFollowUps'] });
    },
  });
}

// Meeting hooks
export function useMeetings(params?: any) {
  return useQuery({
    queryKey: ['meetings', params],
    queryFn: () => api.meetingApi.list(params),
  });
}

export function useMeeting(id: number) {
  return useQuery({
    queryKey: ['meeting', id],
    queryFn: () => api.meetingApi.get(id),
    enabled: !!id,
  });
}

export function useCreateMeeting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.meetingApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
    },
  });
}

export function useUpdateMeeting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.meetingApi.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['meeting', id] });
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
    },
  });
}

export function useScheduleMeeting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, scheduledAt, durationMinutes, location, meetingLink }: 
      { id: number; scheduledAt: string; durationMinutes?: number; location?: string; meetingLink?: string }) => 
      api.meetingApi.schedule(id, scheduledAt, durationMinutes, location, meetingLink),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['meeting', id] });
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
    },
  });
}

export function useCompleteMeeting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, outcome, notes }: { id: number; outcome?: string; notes?: string }) => 
      api.meetingApi.complete(id, outcome, notes),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['meeting', id] });
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
    },
  });
}

export function useCancelMeeting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) => 
      api.meetingApi.cancel(id, reason),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['meeting', id] });
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
    },
  });
}

export function useMeetingCalendarLinks(id: number) {
  return useQuery({
    queryKey: ['meetingsCalendarLinks', id],
    queryFn: () => api.meetingApi.getCalendarLinks(id),
    enabled: !!id,
  });
}

export function useSponsorMeetings(sponsorId: number) {
  return useQuery({
    queryKey: ['sponsorMeetings', sponsorId],
    queryFn: () => api.meetingApi.getSponsorMeetings(sponsorId),
    enabled: !!sponsorId,
  });
}

// Dashboard hooks
export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboardStats'],
    queryFn: () => api.dashboardApi.getStats(),
  });
}

export function useDashboardPipeline() {
  return useQuery({
    queryKey: ['dashboardPipeline'],
    queryFn: () => api.dashboardApi.getPipeline(),
  });
}

export function useTeamPerformance() {
  return useQuery({
    queryKey: ['teamPerformance'],
    queryFn: () => api.dashboardApi.getTeamPerformance(),
  });
}

export function useDashboardFunnel() {
  return useQuery({
    queryKey: ['dashboardFunnel'],
    queryFn: () => api.dashboardApi.getConversionFunnel(),
  });
}

export function useSponsorshipBreakdown() {
  return useQuery({
    queryKey: ['sponsorshipBreakdown'],
    queryFn: () => api.dashboardApi.getSponsorshipBreakdown(),
  });
}

export function useWeeklyTrends(weeks?: number) {
  return useQuery({
    queryKey: ['weeklyTrends', weeks],
    queryFn: () => api.dashboardApi.getWeeklyTrends(weeks),
  });
}

export function useTopSponsors(limit?: number) {
  return useQuery({
    queryKey: ['topSponsors', limit],
    queryFn: () => api.dashboardApi.getTopSponsors(limit),
  });
}

// Team hooks
export function useTeamMembers(activeOnly?: boolean) {
  return useQuery({
    queryKey: ['teamMembers', activeOnly],
    queryFn: () => api.teamMemberApi.list(activeOnly),
  });
}

export function useCreateTeamMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.teamMemberApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teamMembers'] });
    },
  });
}

export function useUpdateTeamMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.teamMemberApi.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['teamMembers'] });
      queryClient.invalidateQueries({ queryKey: ['teamMember', id] });
    },
  });
}

// Event hooks
export function useEvents(activeOnly?: boolean) {
  return useQuery({
    queryKey: ['events', activeOnly],
    queryFn: () => api.eventApi.list(activeOnly),
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.eventApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

// Notification hooks
export function useNotifications(teamMemberId: number, unreadOnly?: boolean) {
  return useQuery({
    queryKey: ['notifications', teamMemberId, unreadOnly],
    queryFn: () => api.notificationApi.list(teamMemberId, { unread_only: unreadOnly }),
    enabled: !!teamMemberId,
  });
}

export function useUnreadNotificationCount(teamMemberId: number) {
  return useQuery({
    queryKey: ['unreadNotificationCount', teamMemberId],
    queryFn: () => api.notificationApi.getUnreadCount(teamMemberId),
    enabled: !!teamMemberId,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ notificationId, teamMemberId }: { notificationId: number; teamMemberId: number }) => 
      api.notificationApi.markAsRead(notificationId, teamMemberId),
    onSuccess: (_, { teamMemberId }) => {
      queryClient.invalidateQueries({ queryKey: ['notifications', teamMemberId] });
      queryClient.invalidateQueries({ queryKey: ['unreadNotificationCount', teamMemberId] });
    },
  });
}

export function useMarkAllNotificationsRead(teamMemberId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.notificationApi.markAllAsRead(teamMemberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', teamMemberId] });
      queryClient.invalidateQueries({ queryKey: ['unreadNotificationCount', teamMemberId] });
    },
  });
}

// Institutional Memory hooks
export function useInstitutionalMemory() {
  return useQuery({
    queryKey: ['institutionalMemory'],
    queryFn: () => api.institutionalMemoryApi.list(),
  });
}

export function useCreateInstitutionalMemory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.institutionalMemoryApi.createOrUpdate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['institutionalMemory'] });
    },
  });
}

// Duplicate check hook
export function useDuplicateCheck() {
  return useMutation({
    mutationFn: (data: any) => api.sponsorApi.checkDuplicates(data),
  });
}

export function useMergeDuplicates() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ primaryId, duplicateId, mergedBy }: { primaryId: number; duplicateId: number; mergedBy: number }) => 
      api.sponsorApi.merge(primaryId, duplicateId, mergedBy),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sponsors'] });
    },
  });
}

// Agent hooks
const agentQueryKeys = {
  status: ['agentStatus'] as const,
};

export function useAgentStatus() {
  return useQuery({
    queryKey: agentQueryKeys.status,
    queryFn: () => api.agentApi.status().then(res => res.data),
    refetchInterval: 5000, // Poll every 5 seconds
  });
}

export function useStartAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { event_id?: number; campaign_name?: string; max_iterations?: number; interval?: number }) => 
      api.agentApi.start(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agentQueryKeys.status });
    },
  });
}

export function useStopAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.agentApi.stop(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agentQueryKeys.status });
    },
  });
}

export function usePauseSponsor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sponsorId: number) => api.agentApi.pause(sponsorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agentQueryKeys.status });
    },
  });
}

export function useResumeSponsor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sponsorId: number) => api.agentApi.resume(sponsorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agentQueryKeys.status });
    },
  });
}

export function useApproveSponsorEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sponsorId, approverId }: { sponsorId: number; approverId: number }) => 
      api.agentApi.approve(sponsorId, approverId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agentQueryKeys.status });
      queryClient.invalidateQueries({ queryKey: ['sponsorEmails'] });
    },
  });
}

export function useRejectSponsorEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sponsorId, rejecterId, reason }: { sponsorId: number; rejecterId: number; reason: string }) => 
      api.agentApi.reject(sponsorId, rejecterId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agentQueryKeys.status });
      queryClient.invalidateQueries({ queryKey: ['sponsorEmails'] });
    },
  });
}
