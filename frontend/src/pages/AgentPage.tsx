import React, { useState, useEffect } from 'react';
import { useAgentStatus, useStartAgent, useStopAgent, usePauseSponsor, useResumeSponsor, useApproveSponsorEmail, useRejectSponsorEmail } from '../hooks/useApi';
import { useSponsors } from '../hooks/useApi';
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

  const { data: agentStatus, isLoading: statusLoading, refetch: refetchStatus } = useAgentStatus();
  const { data: sponsorsData } = useSponsors({ page_size: 100 });
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
      await startAgent.mutateAsync({ campaign_name: 'Sponsorship Campaign' });
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to start agent');
    }
  };

  const handleStopAgent = async () => {
    try {
      await stopAgent.mutateAsync();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to stop agent');
    }
  };

  const handlePauseSponsor = async (sponsorId: number) => {
    try {
      await pauseSponsor.mutateAsync(sponsorId);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to pause sponsor');
    }
  };

  const handleResumeSponsor = async (sponsorId: number) => {
    try {
      await resumeSponsor.mutateAsync(sponsorId);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to resume sponsor');
    }
  };

  const handleApproveEmail = async (sponsorId: number) => {
    try {
      await approveEmail.mutateAsync({ sponsorId, approverId: 1 });
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to approve email');
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
      setShowRejectModal(null);
      setRejectReason('');
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to reject email');
    }
  };

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

  const agentRunning = agentStatus?.running ?? false;
  const agentStats = agentStatus?.stats || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">SponsyBot Agent</h1>
          <p className="text-gray-600 mt-1">Autonomous sponsorship outreach workflow</p>
        </div>
        <div className="flex items-center gap-3">
          {!agentRunning && !Object.keys(agentSponsors).length ? (
            <button
              onClick={handleStartAgent}
              disabled={startAgent.isPending}
              className="btn-primary"
            >
              <PlayIcon className="w-5 h-5 mr-2" />
              {startAgent.isPending ? 'Starting...' : 'Start Agent'}
            </button>
          ) : agentRunning ? (
            <button
              onClick={handleStopAgent}
              disabled={stopAgent.isPending}
              className="btn-secondary bg-red-600 hover:bg-red-700 text-white border-none"
            >
              <StopIcon className="w-5 h-5 mr-2" />
              {stopAgent.isPending ? 'Stopping...' : 'Stop Agent'}
            </button>
          ) : (
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
              Agent Idle
            </span>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          label="Total Sponsors"
          value={agentStats.total || 0}
          icon={BuildingOfficeIcon}
          color="bg-blue-500"
        />
        <StatCard
          label="Researched"
          value={agentStats.researched || 0}
          icon={MagnifyingGlassIcon}
          color="bg-blue-500"
        />
        <StatCard
          label="Prioritized"
          value={agentStats.prioritized || 0}
          icon={ArrowTrendingUpIcon}
          color="bg-purple-500"
        />
        <StatCard
          label="Emails Sent"
          value={agentStats.emails_sent || 0}
          icon={PaperAirplaneIcon}
          color="bg-orange-500"
        />
        <StatCard
          label="Meetings"
          value={agentStats.meetings_scheduled || 0}
          icon={CalendarDaysIcon}
          color="bg-green-500"
        />
      </div>

      {/* Agent Logs / Activity */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Agent Activity</h2>
          <div className="flex items-center gap-3">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              agentRunning ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
            }`}>
              {agentRunning ? 'Running' : 'Idle'}
            </span>
            {agentStatus?.campaign_name && (
              <span className="text-sm text-gray-500">{agentStatus.campaign_name}</span>
            )}
          </div>
        </div>
        <div className="p-4 font-mono text-sm text-gray-700 bg-gray-50 max-h-48 overflow-y-auto">
          {Object.entries(agentSponsors).length === 0 ? (
            <p className="text-gray-500">No sponsors in workflow yet. Start the agent to begin.</p>
          ) : (
            Object.entries(agentSponsors).map(([sid, wf]: [string, any]) => (
              <div key={sid} className="py-1 border-b border-gray-200 last:border-0">
                <div className="flex items-center gap-3">
                  <span className="font-medium text-gray-900">{wf.company_name}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${stageColors[wf.stage] || 'bg-gray-100 text-gray-700'}`}>
                    {stageLabels[wf.stage] || wf.stage}
                  </span>
                  {wf.email_type && (
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                      {wf.email_type}
                    </span>
                  )}
                  {wf.follow_up_number > 0 && (
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                      Follow-up {wf.follow_up_number}/2
                    </span>
                  )}
                  {wf.meeting_id && (
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                      Meeting: {wf.meeting_id}
                    </span>
                  )}
                  {wf.error && (
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                      Error
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Sponsor Workflow Details */}
      {Object.keys(agentSponsors).length > 0 && (
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-gray-900">Sponsor Workflows</h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {Object.entries(agentSponsors).map(([sid, wf]: [string, any]) => {
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
                  isPaused={agentStatus?.paused_sponsors?.includes(sponsor?.id)}
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
        <div className="text-center py-12 text-gray-500">
          <CpuChipIcon className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <p className="text-lg font-medium">Agent is idle</p>
          <p className="text-sm mt-1">Click "Start Agent" to begin the sponsorship workflow</p>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Reject Email</h2>
              <button onClick={() => { setShowRejectModal(null); setRejectReason(''); }} className="text-gray-400 hover:text-gray-600">
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
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
}

function StatCard({ label, value, icon: Icon, color }: StatCardProps) {
  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200">
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
  );
}

export default AgentPage;