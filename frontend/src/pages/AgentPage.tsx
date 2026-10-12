import React, { useState, useEffect } from 'react';
import { useAgentStatus, useStartAgent, useStopAgent, usePauseSponsor, useResumeSponsor, useApproveSponsorEmail, useRejectSponsorEmail } from '../hooks/useApi';
import { useSponsors, useEvents } from '../hooks/useApi';
import { useToast } from '../components/Layout';
import type { AgentStatusResponse, SponsorWorkflowStatus } from '../hooks/useApi';
import {
  PlayIcon,
  StopIcon,
  PauseIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  ArrowTrendingUpIcon,
  EnvelopeOpenIcon,
  PaperAirplaneIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  CalendarDaysIcon,
  BuildingOfficeIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  EyeIcon,
  DocumentTextIcon,
  BugAntIcon,
  CpuChipIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns/format';
import { SponsorWorkflowCard } from '../components/SponsorWorkflowCard';

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

export function AgentPage() {
  const [selectedSponsorId, setSelectedSponsorId] = useState<number | null>(null);
  const [showRejectModal, setShowRejectModal] = useState<{ sponsorId: number; emailId: number } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const { addToast } = useToast();

  const { data: agentStatus, isLoading: statusLoading, refetch: refetchStatus } = useAgentStatus();
  const { data: sponsorsData } = useSponsors({ page_size: 100 });
  const { data: eventsData } = useEvents(true);
  const startAgent = useStartAgent();
  const stopAgent = useStopAgent();
  const pauseSponsor = usePauseSponsor();
  const resumeSponsor = useResumeSponsor();
  const approveEmail = useApproveSponsorEmail();
  const rejectEmail = useRejectSponsorEmail();

  // Poll for status updates when agent is running
  useEffect(() => {
    if (agentStatus?.running) {
      const interval = setInterval(() => refetchStatus(), 3000);
      return () => clearInterval(interval);
    }
  }, [agentStatus?.running, refetchStatus]);

  const sponsors = (sponsorsData as any)?.sponsors || [];
  const agentSponsors = agentStatus?.sponsors || {};

  const handleStartAgent = async () => {
    try {
      const events = (eventsData as any)?.data || [];
      const activeEvent = events.find((e: any) => e.is_active);
      await startAgent.mutateAsync({
        event_id: activeEvent?.id,
        campaign_name: 'Sponsorship Campaign',
      });
      addToast('Agent started successfully', 'success');
      refetchStatus();
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Failed to start agent', 'error');
    }
  };

  const handleStopAgent = async () => {
    try {
      await stopAgent.mutateAsync();
      addToast('Agent stopped', 'success');
      refetchStatus();
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Failed to stop agent', 'error');
    }
  };

  const handlePauseSponsor = async (sponsorId: number) => {
    try {
      await pauseSponsor.mutateAsync(sponsorId);
      addToast('Sponsor paused', 'success');
      refetchStatus();
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Failed to pause sponsor', 'error');
    }
  };

  const handleResumeSponsor = async (sponsorId: number) => {
    try {
      await resumeSponsor.mutateAsync(sponsorId);
      addToast('Sponsor resumed', 'success');
      refetchStatus();
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Failed to resume sponsor', 'error');
    }
  };

  const handleApproveEmail = async (sponsorId: number) => {
    try {
      await approveEmail.mutateAsync({ sponsorId, approverId: 1 });
      addToast('Email approved', 'success');
      refetchStatus();
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Failed to approve email', 'error');
    }
  };

  const handleOpenRejectModal = (sponsorId: number, emailId: number) => {
    setShowRejectModal({ sponsorId, emailId });
    setRejectReason('');
  };

  const handleRejectEmail = async () => {
    if (!showRejectModal || !rejectReason.trim()) return;
    try {
      await rejectEmail.mutateAsync({
        sponsorId: showRejectModal.sponsorId,
        rejecterId: 1,
        reason: rejectReason,
      });
      addToast('Email rejected', 'success');
      setShowRejectModal(null);
      setRejectReason('');
      refetchStatus();
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Failed to reject email', 'error');
    }
  };

  if (statusLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 animate-fade-in">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent mb-4"></div>
        <p className="text-gray-500">Loading agent status...</p>
      </div>
    );
  }

  const agentRunning = agentStatus?.running ?? false;
  const agentStats = agentStatus?.stats || {};

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-slide-in-left">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">SponsyBot Agent</h1>
          <p className="text-gray-600 mt-1">Autonomous sponsorship outreach workflow</p>
        </div>
        <div className="flex items-center gap-3">
          {agentRunning ? (
            <button
              onClick={handleStopAgent}
              disabled={stopAgent.isPending}
              className="btn-secondary bg-red-600 hover:bg-red-700 text-white border-none group"
            >
              <StopIcon className="w-5 h-5 mr-2" />
              {stopAgent.isPending ? 'Stopping...' : 'Stop Agent'}
            </button>
          ) : (
            <button
              onClick={handleStartAgent}
              disabled={startAgent.isPending}
              className="btn-primary group"
            >
              <PlayIcon className="w-5 h-5 mr-2 group-hover:rotate-12 transition-transform duration-200" />
              {startAgent.isPending ? 'Starting...' : 'Start Agent'}
            </button>
          )}
        </div>
      </div>

      {/* Status Indicator */}
      <div className={`card p-4 animate-fade-in stagger-1 ${agentRunning ? 'border-green-200 bg-green-50' : 'border-gray-200'}`}>
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-xl ${agentRunning ? 'bg-green-100' : 'bg-gray-100'}`}>
            <CpuChipIcon className={`w-6 h-6 ${agentRunning ? 'text-green-600' : 'text-gray-600'}`} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <p className="text-sm font-medium text-gray-900">Agent Status</p>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${agentRunning ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'} animate-pulse-soft`}>
                {agentRunning ? 'Running' : 'Idle'}
              </span>
              {agentStatus?.campaign_name && (
                <span className="text-sm text-gray-500">{agentStatus.campaign_name}</span>
              )}
            </div>
            {agentStatus?.current_activity && (
              <div className="mt-2 flex items-center gap-3 text-sm">
                <span className="text-gray-500">Current:</span>
                <span className="font-mono text-gray-900 flex-1 truncate">{agentStatus.current_activity}</span>
              </div>
            )}
            {agentStatus?.current_stage && (
              <div className="mt-2 flex items-center gap-3 text-sm">
                <span className="text-gray-500">Stage:</span>
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                  {agentStatus.current_stage}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <StatCard
          label="Total Sponsors"
          value={agentStats.total || 0}
          icon={BuildingOfficeIcon}
          color="bg-blue-500"
          index={0}
        />
        <StatCard
          label="Researched"
          value={agentStats.researched || 0}
          icon={MagnifyingGlassIcon}
          color="bg-blue-500"
          index={1}
        />
        <StatCard
          label="Prioritized"
          value={agentStats.prioritized || 0}
          icon={ArrowTrendingUpIcon}
          color="bg-purple-500"
          index={2}
        />
        <StatCard
          label="Emails Generated"
          value={agentStats.emails_generated || 0}
          icon={EnvelopeOpenIcon}
          color="bg-indigo-500"
          index={3}
        />
        <StatCard
          label="Emails Sent"
          value={agentStats.emails_sent || 0}
          icon={PaperAirplaneIcon}
          color="bg-orange-500"
          index={4}
        />
        <StatCard
          label="Meetings"
          value={agentStats.meetings_scheduled || 0}
          icon={CalendarDaysIcon}
          color="bg-green-500"
          index={5}
        />
      </div>

      {/* Activity Log */}
      {(agentStatus?.activity_log && agentStatus.activity_log.length > 0) && (
        <div className="card animate-fade-in stagger-2">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Activity Log</h2>
            <span className="text-sm text-gray-500">{agentStatus.activity_log.length} events</span>
          </div>
          <div className="p-4 font-mono text-sm text-gray-700 bg-gray-50 max-h-64 overflow-y-auto">
            {agentStatus.activity_log.slice().reverse().map((activity: any, index: number) => (
              <div key={index} className="py-1 border-b border-gray-200 last:border-0 flex items-start gap-3 animate-fade-in" style={{ animationDelay: `${index * 0.02}s` }}>
                <span className="text-xs text-gray-500 whitespace-nowrap mr-2">
                  {new Date(activity.timestamp).toLocaleTimeString()}
                </span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${activity.error ? 'bg-red-100 text-red-800' : 'bg-primary-100 text-primary-800'}`}>
                  {activity.stage}
                </span>
                <span className="flex-1 text-gray-900">{activity.message}</span>
                {activity.sponsor && (
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                    {activity.sponsor}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sponsor Workflow Details */}
      {Object.keys(agentSponsors).length > 0 && (
        <div className="space-y-6 animate-fade-in stagger-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Sponsor Workflows</h2>
            <span className="text-sm text-gray-500">{Object.keys(agentSponsors).length} active</span>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {Object.entries(agentSponsors).map(([sid, wf]: [string, any], index: number) => {
              const sponsor = sponsors.find((s: any) => String(s.id) === sid);
              return (
                <SponsorWorkflowCard
                  key={sid}
                  sponsor={sponsor}
                  workflow={wf}
                  sponsorId={sponsor?.id}
                  onApprove={handleApproveEmail}
                  onReject={handleOpenRejectModal}
                  onPause={handlePauseSponsor}
                  onResume={handleResumeSponsor}
                  isPaused={Boolean(agentStatus?.paused_sponsors?.includes(sponsor?.id))}
                  pausePending={pauseSponsor.isPending}
                  resumePending={resumeSponsor.isPending}
                  approvePending={approveEmail.isPending}
                  rejectPending={rejectEmail.isPending}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* No sponsors message */}
      {!agentRunning && Object.keys(agentSponsors).length === 0 && (
        <div className="text-center py-16 animate-fade-in stagger-4">
          <CpuChipIcon className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <p className="text-lg font-medium text-gray-900">Agent is idle</p>
          <p className="text-sm text-gray-500 mt-1">Click "Start Agent" to begin the sponsorship workflow</p>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 animate-fade-in">
          <div className="bg-white rounded-xl w-full max-w-md animate-scale-in">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Reject Email</h2>
              <button onClick={() => { setShowRejectModal(null); setRejectReason(''); }} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-gray-600">Please provide a reason for rejecting this email draft:</p>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
                className="input-base"
                placeholder="Enter rejection reason..."
                required
              />
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button onClick={() => { setShowRejectModal(null); setRejectReason(''); }} className="btn-secondary">
                  Cancel
                </button>
                <button
                  onClick={handleRejectEmail}
                  disabled={rejectEmail.isPending}
                  className="btn-primary"
                >
                  {rejectEmail.isPending ? 'Rejecting...' : 'Reject'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  index: number;
}

function StatCard({ label, value, icon: Icon, color, index }: StatCardProps) {
  return (
    <div className="card-hover animate-fade-in" style={{ animationDelay: `${index * 0.05}s` }}>
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div className={`p-3 rounded-xl ${color}`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
        </div>
        <div className="mt-4">
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-sm text-gray-500 mt-1">{label}</p>
        </div>
      </div>
    </div>
  );
}

export default AgentPage;