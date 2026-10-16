import React from 'react';
import { useSponsorEmails } from '../hooks/useApi';
import { useSponsorReplies } from '../hooks/useApi';
import { useSponsorFollowUps } from '../hooks/useApi';
import { useSponsorFollowUpStatus } from '../hooks/useApi';
import { useSponsorMeetings } from '../hooks/useApi';
import {
  CheckCircleIcon,
  XCircleIcon,
  PaperAirplaneIcon,
  MagnifyingGlassIcon,
  ArrowTrendingUpIcon,
  EnvelopeOpenIcon,
  ClockIcon,
  CalendarDaysIcon,
  BuildingOfficeIcon,
  ExclamationCircleIcon,
  PauseIcon,
  ArrowPathIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns/format';

interface SponsorWorkflowCardProps {
  sponsor: any;
  workflow: any;
  sponsorId: number | undefined;
  onApprove: (sponsorId: number) => void;
  onReject: (sponsorId: number, emailId: number) => void;
  onPause: (sponsorId: number) => void;
  onResume: (sponsorId: number) => void;
  isPaused: boolean;
  pausePending: boolean;
  resumePending: boolean;
  approvePending: boolean;
  rejectPending: boolean;
}

const stageColors: Record<string, string> = {
  init: 'bg-gray-100 text-gray-700',
  research: 'bg-blue-100 text-blue-800',
  prioritize: 'bg-purple-100 text-purple-800',
  generate_emails: 'bg-indigo-100 text-indigo-800',
  pending_approval: 'bg-yellow-100 text-yellow-800',
  sending: 'bg-orange-100 text-orange-800',
  waiting_for_reply: 'bg-cyan-100 text-cyan-800',
  follow_up: 'bg-amber-100 text-amber-800',
  meeting: 'bg-green-100 text-green-800',
  completed: 'bg-gray-100 text-gray-700',
  error: 'bg-red-100 text-red-800',
};

const stageLabels: Record<string, string> = {
  init: 'Initializing',
  research: 'Researching',
  prioritize: 'Prioritizing',
  generate_emails: 'Generating Emails',
  pending_approval: 'Waiting for Approval',
  sending: 'Sending',
  waiting_for_reply: 'Waiting for Reply',
  follow_up: 'Follow-up',
  meeting: 'Meeting',
  completed: 'Completed',
  error: 'Error',
};

const emailStatusColors: Record<string, string> = {
  Draft: 'bg-gray-100 text-gray-700',
  'Pending Approval': 'bg-yellow-100 text-yellow-800',
  Approved: 'bg-green-100 text-green-800',
  Sent: 'bg-blue-100 text-blue-800',
  Failed: 'bg-red-100 text-red-800',
  Rejected: 'bg-red-100 text-red-800',
};

const replyClassificationColors: Record<string, string> = {
  Interested: 'bg-green-100 text-green-800',
  Declined: 'bg-red-100 text-red-800',
  'No Reply': 'bg-gray-100 text-gray-700',
};

const followUpStatusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  created: 'bg-blue-100 text-blue-800',
  approved: 'bg-green-100 text-green-800',
  sent: 'bg-purple-100 text-purple-800',
  cancelled: 'bg-red-100 text-red-800',
};

const meetingStatusColors: Record<string, string> = {
  'Meeting Requested': 'bg-yellow-100 text-yellow-800',
  'Meeting Scheduled': 'bg-blue-100 text-blue-800',
  'Meeting Completed': 'bg-green-100 text-green-800',
  'Meeting Cancelled': 'bg-red-100 text-red-800',
};

export function SponsorWorkflowCard({
  sponsor,
  workflow,
  sponsorId,
  onApprove,
  onReject,
  onPause,
  onResume,
  isPaused,
  pausePending,
  resumePending,
  approvePending,
  rejectPending,
}: SponsorWorkflowCardProps) {
  const emails = useSponsorEmails(sponsorId || 0);
  const replies = useSponsorReplies(sponsorId || 0);
  const followUps = useSponsorFollowUps(sponsorId || 0);
  const followUpStatus = useSponsorFollowUpStatus(sponsorId || 0);
  const meetings = useSponsorMeetings(sponsorId || 0);

  if (!sponsor) return null;

  const getData = (res: any): any => {
    if (!res?.data) return [];
    return res.data.data || res.data || [];
  };

  const emailsData = getData(emails);
  const repliesData = getData(replies);
  const followUpsData = getData(followUps);
  const followUpStatusData = followUpStatus.data?.data || followUpStatus.data || null;
  const meetingsData = getData(meetings);

  const stageColor = stageColors[workflow.stage] || 'bg-gray-100 text-gray-700';
  const stageLabel = stageLabels[workflow.stage] || workflow.stage;

  const workflowSteps = [
    { key: 'research', icon: MagnifyingGlassIcon, label: 'Research', color: 'blue' },
    { key: 'prioritize', icon: ArrowTrendingUpIcon, label: 'Prioritize', color: 'purple' },
    { key: 'generate_emails', icon: EnvelopeOpenIcon, label: 'Generate', color: 'indigo' },
    { key: 'pending_approval', icon: ClockIcon, label: 'Approve', color: 'yellow' },
    { key: 'sending', icon: PaperAirplaneIcon, label: 'Send', color: 'orange' },
    { key: 'waiting_for_reply', icon: ArrowPathIcon, label: 'Wait Reply', color: 'cyan' },
    { key: 'follow_up', icon: SparklesIcon, label: 'Follow-up', color: 'amber' },
    { key: 'meeting', icon: CalendarDaysIcon, label: 'Meeting', color: 'green' },
  ];

  const currentStepIndex = workflowSteps.findIndex(s => s.key === workflow.stage);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden card-hover animate-fade-in">
      {/* Progress Indicator */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center">
              <BuildingOfficeIcon className="w-5 h-5 text-primary-600" />
            </div>
            <h3 className="font-semibold text-gray-900">{sponsor.company_name || sponsor.name || 'Unnamed Company'}</h3>
          </div>
          <div className="flex items-center gap-2">
            {isPaused ? (
              <button
                onClick={() => onResume(sponsorId || 0)}
                disabled={resumePending}
                className="btn-secondary text-sm group"
              >
                <ArrowPathIcon className="w-4 h-4 mr-1 group-hover:rotate-12 transition-transform" /> Resume
              </button>
            ) : (
              <button
                onClick={() => onPause(sponsorId || 0)}
                disabled={pausePending}
                className="btn-secondary text-sm group"
              >
                <PauseIcon className="w-4 h-4 mr-1 group-hover:scale-110 transition-transform" /> Pause
              </button>
            )}
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${stageColor} animate-pulse-soft`}>
              {stageLabel}
            </span>
          </div>
        </div>
        
        {/* Workflow Progress Bar */}
        <div className="flex items-center gap-1">
          {workflowSteps.map((step, index) => {
            const isCompleted = index < currentStepIndex;
            const isCurrent = index === currentStepIndex;
            const stepColors = {
              blue: 'bg-blue-500',
              purple: 'bg-purple-500',
              indigo: 'bg-indigo-500',
              yellow: 'bg-yellow-500',
              orange: 'bg-orange-500',
              cyan: 'bg-cyan-500',
              amber: 'bg-amber-500',
              green: 'bg-green-500',
            };
            return (
              <div key={step.key} className="flex flex-col items-center flex-1 relative">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                  isCompleted ? stepColors[step.key as keyof typeof stepColors] : 
                  isCurrent ? `${stepColors[step.key as keyof typeof stepColors]} animate-pulse-soft` : 
                  'bg-gray-200'
                }`}>
                  {isCompleted ? (
                    <CheckCircleIcon className="w-5 h-5 text-white" />
                  ) : isCurrent ? (
                    <step.icon className="w-5 h-5 text-white" />
                  ) : (
                    <step.icon className="w-5 h-5 text-gray-400" />
                  )}
                </div>
                <span className={`text-[10px] font-medium mt-1 text-center ${isCompleted || isCurrent ? 'text-gray-700' : 'text-gray-400'}`}>
                  {step.label}
                </span>
                {!isCompleted && !isCurrent && index < workflowSteps.length - 1 && (
                  <div className="absolute top-4 left-1/2 w-full h-0.5 bg-gray-200 -translate-x-1/2" />
                )}
                {isCompleted && index < workflowSteps.length - 1 && (
                  <div className="absolute top-4 left-1/2 w-full h-0.5 bg-green-500 -translate-x-1/2" style={{ width: '100%' }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Research & Priority */}
        <div className="bg-gray-50 rounded-lg p-4 animate-fade-in stagger-1">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded bg-blue-100 text-blue-600">
              <MagnifyingGlassIcon className="w-4 h-4" />
            </div>
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Research & Priority</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500">Research</p>
              <p className="text-sm font-medium text-gray-900 mt-0.5">
                {sponsor.research_data ? (
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircleIcon className="w-3.5 h-3.5" /> Completed
                  </span>
                ) : (
                  <span className="text-amber-600">Pending</span>
                )}
              </p>
              {sponsor.research_data && (
                <p className="text-xs text-gray-500 mt-1">Source: {sponsor.research_source}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-gray-500">Priority</p>
              <p className="text-sm font-medium text-gray-900 mt-0.5">
                {sponsor.priority_score} ({sponsor.priority_tier})
              </p>
            </div>
          </div>
          {sponsor.recommended_sponsorship_types && sponsor.recommended_sponsorship_types.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {sponsor.recommended_sponsorship_types.map((type: string) => (
                <span key={type} className="px-2 py-1 text-xs font-medium rounded-full bg-primary-100 text-primary-800">
                  {type}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Email Drafts */}
        <div className="animate-fade-in stagger-2">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded bg-indigo-100 text-indigo-600">
              <EnvelopeOpenIcon className="w-4 h-4" />
            </div>
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Email Drafts</span>
          </div>
          {emailsData.length === 0 ? (
            <div className="p-4 text-center bg-gray-50 rounded-lg border border-dashed border-gray-200">
              <PaperAirplaneIcon className="w-8 h-8 mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">No drafts yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {emailsData.map((email: any, index: number) => (
                <div key={email.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200 animate-fade-in" style={{ animationDelay: `${index * 0.03}s` }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${emailStatusColors[email.status] || 'bg-gray-100 text-gray-700'}`}>
                        {email.status}
                      </span>
                      <span className="text-sm font-medium text-gray-900 truncate max-w-[200px]">{email.subject}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {email.status === 'Draft' || email.status === 'Pending Approval' ? (
                        <>
                          <button
                            onClick={() => onApprove(sponsorId || 0)}
                            disabled={approvePending}
                            className="btn-primary text-xs px-2 py-1 group"
                          >
                            <CheckCircleIcon className="w-4 h-4 mr-1" /> Approve
                          </button>
                          <button
                            onClick={() => onReject(sponsorId || 0, email.id)}
                            disabled={rejectPending}
                            className="btn-secondary text-xs px-2 py-1 group"
                          >
                            <XCircleIcon className="w-4 h-4 mr-1" /> Reject
                          </button>
                        </>
                      ) : email.status === 'Approved' ? (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 flex items-center gap-1">
                          <PaperAirplaneIcon className="w-3 h-3" /> Ready to Send
                        </span>
                      ) : email.status === 'Sent' ? (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 flex items-center gap-1">
                          <CheckCircleIcon className="w-3 h-3" /> Sent
                        </span>
                      ) : email.status === 'Failed' ? (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 flex items-center gap-1">
                          <ExclamationCircleIcon className="w-3 h-3" /> Failed
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                          {email.status}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 truncate">{email.body?.slice(0, 100)}...</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Replies */}
        <div className="animate-fade-in stagger-3">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded bg-green-100 text-green-600">
              <ArrowPathIcon className="w-4 h-4" />
            </div>
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Replies</span>
          </div>
          {repliesData.length === 0 ? (
            <div className="p-4 text-center bg-gray-50 rounded-lg border border-dashed border-gray-200">
              <ArrowPathIcon className="w-8 h-8 mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">No replies received</p>
            </div>
          ) : (
            <div className="space-y-2">
              {repliesData.map((reply: any, index: number) => (
                <div key={reply.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200 animate-fade-in" style={{ animationDelay: `${index * 0.03}s` }}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900 truncate">{reply.subject || '(no subject)'}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${replyClassificationColors[reply.classification] || 'bg-gray-100 text-gray-700'}`}>
                      {reply.classification}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 truncate">{reply.body?.slice(0, 100)}...</p>
                  <p className="text-xs text-gray-400 mt-1">{reply.summary}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Follow-ups */}
        <div className="animate-fade-in stagger-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded bg-amber-100 text-amber-600">
              <ClockIcon className="w-4 h-4" />
            </div>
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Follow-ups</span>
          </div>
          <div className="flex items-center gap-4 mb-3">
            <span className="text-sm text-gray-600">
              Sent: {followUpStatusData?.follow_ups_sent || 0} / {followUpStatusData?.max_follow_ups || 2}
            </span>
            {followUpStatusData?.next_follow_up_due && (
              <span className="text-sm text-gray-600 flex items-center gap-1">
                <ClockIcon className="w-3.5 h-3.5" />
                Next due: {format(new Date(followUpStatusData.next_follow_up_due), 'MMM d, HH:mm')}
              </span>
            )}
          </div>
          {followUpsData.length === 0 ? (
            <div className="p-4 text-center bg-gray-50 rounded-lg border border-dashed border-gray-200">
              <ClockIcon className="w-8 h-8 mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">No follow-ups scheduled</p>
            </div>
          ) : (
            <div className="space-y-2">
              {followUpsData.map((fu: any, index: number) => (
                <div key={fu.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200 animate-fade-in" style={{ animationDelay: `${index * 0.03}s` }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">Follow-up #{fu.sequence_number}</p>
                      <p className="text-sm text-gray-500">{fu.email_type} • {fu.scheduled_at ? format(new Date(fu.scheduled_at), 'MMM d, HH:mm') : 'Not scheduled'}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${followUpStatusColors[fu.status] || 'bg-gray-100 text-gray-700'}`}>
                      {fu.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Meetings */}
        <div className="animate-fade-in stagger-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded bg-purple-100 text-purple-600">
              <CalendarDaysIcon className="w-4 h-4" />
            </div>
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Meetings</span>
          </div>
          {meetingsData.length === 0 ? (
            <div className="p-4 text-center bg-gray-50 rounded-lg border border-dashed border-gray-200">
              <CalendarDaysIcon className="w-8 h-8 mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">No meetings scheduled</p>
            </div>
          ) : (
            <div className="space-y-2">
              {meetingsData.map((meeting: any, index: number) => (
                <div key={meeting.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200 animate-fade-in" style={{ animationDelay: `${index * 0.03}s` }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{meeting.title}</p>
                      <p className="text-sm text-gray-500">
                        {meeting.scheduled_at ? format(new Date(meeting.scheduled_at), 'MMM d, HH:mm') : 'Not scheduled'}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${meetingStatusColors[meeting.status] || 'bg-gray-100 text-gray-700'}`}>
                      {meeting.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SponsorWorkflowCard;