import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSponsor, useSponsorEmails, useSponsorReplies, useSponsorFollowUps, useSponsorFollowUpStatus, useSponsorResearch, useSponsorPrioritize, useSponsorResearchAndPrioritize, useEmailDraft } from '../hooks/useApi';
import { useMeetings } from '../hooks/useApi';
import {
  BuildingOfficeIcon,
  MagnifyingGlassIcon,
  EnvelopeOpenIcon,
  ClockIcon,
  ArrowPathIcon,
  ArrowTrendingUpIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
  PencilIcon,
  TrashIcon,
  PlusIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ChevronLeftIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns/format';

const statusColors = {
  'Not Contacted': 'bg-gray-100 text-gray-700',
  Contacted: 'bg-blue-100 text-blue-800',
  'Follow-up': 'bg-yellow-100 text-yellow-800',
  Interested: 'bg-green-100 text-green-800',
  Declined: 'bg-red-100 text-red-800',
  Closed: 'bg-gray-100 text-gray-700',
};

const priorityColors = {
  High: 'bg-green-100 text-green-800',
  Medium: 'bg-yellow-100 text-yellow-800',
  Low: 'bg-gray-100 text-gray-700',
};

const tabs = [
  { id: 'overview', label: 'Overview', icon: BuildingOfficeIcon },
  { id: 'research', label: 'Research', icon: MagnifyingGlassIcon },
  { id: 'emails', label: 'Emails', icon: EnvelopeOpenIcon },
  { id: 'followups', label: 'Follow-ups', icon: ClockIcon },
  { id: 'meetings', label: 'Meetings', icon: ArrowPathIcon },
  { id: 'notes', label: 'Notes', icon: InformationCircleIcon },
];

export function SponsorDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const sponsorId = parseInt(id || '0', 10);
  const [activeTab, setActiveTab] = useState('overview');
  const [showResearchModal, setShowResearchModal] = useState(false);
  const [researchType, setResearchType] = useState<'research' | 'prioritize' | 'both'>('both');
  const [eventId, setEventId] = useState('');
  const [showCreateEmailModal, setShowCreateEmailModal] = useState(false);
  const [emailType, setEmailType] = useState('initial');

  const { data: sponsor, isLoading, refetch } = useSponsor(sponsorId);
    const { data: emails } = useSponsorEmails(sponsorId);
    const { data: replies } = useSponsorReplies(sponsorId);
    const { data: followUps } = useSponsorFollowUps(sponsorId);
    const { data: followUpStatus } = useSponsorFollowUpStatus(sponsorId);
    const { data: meetings } = useMeetings({ sponsor_id: sponsorId });
  
  const researchMutation = useSponsorResearch(sponsorId);
  const prioritizeMutation = useSponsorPrioritize(sponsorId);
  const researchAndPrioritizeMutation = useSponsorResearchAndPrioritize(sponsorId);
  const createEmailMutation = useEmailDraft();

  const handleResearchAction = async (type: 'research' | 'prioritize' | 'both') => {
    try {
      const eid = eventId ? parseInt(eventId, 10) : undefined;
      if (type === 'research') {
        await researchMutation.mutateAsync();
      } else if (type === 'prioritize') {
        await prioritizeMutation.mutateAsync(eid);
      } else {
        await researchAndPrioritizeMutation.mutateAsync(eid);
      }
      setShowResearchModal(false);
      setEventId('');
      refetch();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Action failed');
    }
  };

  const handleCreateEmail = async () => {
    try {
      await createEmailMutation.mutateAsync({
        sponsorId,
        data: { email_type: emailType, event_id: eventId ? parseInt(eventId, 10) : undefined },
      });
      setShowCreateEmailModal(false);
      setEmailType('initial');
      setEventId('');
      refetch();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to create email draft');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

  if (!sponsor) {
    return <div className="text-center py-12">Sponsor not found</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 lg:hidden">
            <ChevronLeftIcon className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{(sponsor as unknown as any).company_name}</h1>
            <p className="text-gray-600">{(sponsor as unknown as any).industry} &bull; {(sponsor as unknown as any).company_category}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link to={`/sponsors/${sponsorId}/emails/draft`} className="btn-primary">
            <PlusIcon className="w-5 h-5 mr-2" />
            New Email
          </Link>
          <button onClick={() => setShowResearchModal(true)} className="btn-secondary">
            <MagnifyingGlassIcon className="w-5 h-5 mr-2" />
            Research
          </button>
        </div>
      </div>

      {/* Status & Priority Badges */}
      <div className="flex flex-wrap gap-3">
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[(sponsor as unknown as any).status as keyof typeof statusColors] || 'bg-gray-100 text-gray-700'}`}>
          {(sponsor as unknown as any).status}
        </span>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${priorityColors[(sponsor as unknown as any).priority_tier as keyof typeof priorityColors] || 'bg-gray-100 text-gray-700'}`}>
          Priority: {(sponsor as unknown as any).priority_score} ({(sponsor as unknown as any).priority_tier})
        </span>
        <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-700">
          Follow-ups: {(sponsor as unknown as any).follow_up_count}/2
        </span>
        {(sponsor as unknown as any).assigned_to && (
          <span className="px-3 py-1 rounded-full text-sm font-medium bg-primary-100 text-primary-800">
            Assigned: {(sponsor as unknown as any).assigned_to}
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-8" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-xl border border-gray-200">
        {activeTab === 'overview' && (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Contact Person</p>
                <p className="font-medium text-gray-900">{(sponsor as unknown as any).contact_person || 'N/A'}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Contact Email</p>
                <p className="font-medium text-gray-900">{(sponsor as unknown as any).contact_email || 'N/A'}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Contact Role</p>
                <p className="font-medium text-gray-900">{(sponsor as unknown as any).contact_role || 'N/A'}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Website</p>
                <p className="font-medium text-gray-900">
                  {(sponsor as unknown as any).website ? (
                    <a href={(sponsor as unknown as any).website} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
                      {(sponsor as unknown as any).website}
                    </a>
                  ) : 'N/A'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Research Summary</h3>
                <div className="p-4 bg-gray-50 rounded-lg min-h-[100px]">
                  {(sponsor as unknown as any).research_summary ? (
                    <p className="text-gray-700 whitespace-pre-wrap">{(sponsor as unknown as any).research_summary}</p>
                  ) : (
                    <p className="text-gray-500">No research data available</p>
                  )}
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Priority Reasoning</h3>
                <div className="p-4 bg-gray-50 rounded-lg min-h-[100px]">
                  {(sponsor as unknown as any).priority_reasoning ? (
                    <p className="text-gray-700 whitespace-pre-wrap">{(sponsor as unknown as any).priority_reasoning}</p>
                  ) : (
                    <p className="text-gray-500">No priority reasoning available</p>
                  )}
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Company Details</h3>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <dt className="text-gray-500">Company Name</dt>
                <dd className="font-medium text-gray-900">{(sponsor as unknown as any).company_name}</dd>
                <dt className="text-gray-500">Category</dt>
                <dd className="font-medium text-gray-900">{(sponsor as unknown as any).company_category}</dd>
                <dt className="text-gray-500">Industry</dt>
                <dd className="font-medium text-gray-900">{(sponsor as unknown as any).industry || 'N/A'}</dd>
                <dt className="text-gray-500">Status</dt>
                <dd className="font-medium text-gray-900">
                  <span className={`px-2 py-1 rounded-full text-xs ${statusColors[(sponsor as unknown as any).status as keyof typeof statusColors] || 'bg-gray-100 text-gray-700'}`}>
                    {(sponsor as unknown as any).status}
                  </span>
                </dd>
                <dt className="text-gray-500">Priority Score</dt>
                <dd className="font-medium text-gray-900">{(sponsor as unknown as any).priority_score} ({(sponsor as unknown as any).priority_tier})</dd>
                <dt className="text-gray-500">Follow-up Count</dt>
                <dd className="font-medium text-gray-900">{(sponsor as unknown as any).follow_up_count}/2</dd>
                <dt className="text-gray-500">Created</dt>
                <dd className="font-medium text-gray-900">{(sponsor as unknown as any).created_at ? format(new Date((sponsor as unknown as any).created_at), 'MMM d, yyyy') : 'N/A'}</dd>
                <dt className="text-gray-500">Updated</dt>
                <dd className="font-medium text-gray-900">{(sponsor as unknown as any).updated_at ? format(new Date((sponsor as unknown as any).updated_at), 'MMM d, yyyy') : 'N/A'}</dd>
              </dl>
            </div>
          </div>
        )}

        {activeTab === 'research' && (
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Research & Prioritization</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">Research Summary</h3>
                <p className="text-gray-700 whitespace-pre-wrap min-h-[200px]">
                  {(sponsor as unknown as any).research_summary || 'No research data available. Click "Research" to fetch company information.'}
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">Priority Analysis</h3>
                <p className="text-gray-700 whitespace-pre-wrap min-h-[200px]">
                  {(sponsor as unknown as any).priority_reasoning || 'No priority analysis available. Click "Prioritize" to score this (sponsor as unknown as any).'}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setResearchType('research'); setShowResearchModal(true); }}
                disabled={researchMutation.isPending}
                className="btn-secondary"
              >
                <MagnifyingGlassIcon className="w-5 h-5 mr-2" />
                Research Only
              </button>
              <button
                onClick={() => { setResearchType('prioritize'); setShowResearchModal(true); }}
                disabled={prioritizeMutation.isPending}
                className="btn-secondary"
              >
                <ArrowTrendingUpIcon className="w-5 h-5 mr-2" />
                Prioritize Only
              </button>
              <button
                onClick={() => { setResearchType('both'); setShowResearchModal(true); }}
                disabled={researchAndPrioritizeMutation.isPending}
                className="btn-primary"
              >
                <ArrowPathIcon className="w-5 h-5 mr-2" />
                Research & Prioritize
              </button>
            </div>
          </div>
        )}

        {activeTab === 'emails' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Email History</h2>
              <Link to={`/sponsors/${sponsorId}/emails/draft`} className="btn-primary">
                <PlusIcon className="w-5 h-5 mr-2" />
                Create Draft
              </Link>
            </div>

            {(emails as unknown as any[]) && (emails as unknown as any[]).length > 0 ? (
              <div className="space-y-4">
                {(emails as unknown as any[]).map((email: any) => (
                  <Link key={email.id} to={`/emails/${email.id}`} className="block">
                    <div className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            email.status === 'Draft' ? 'bg-gray-100 text-gray-700' :
                            email.status === 'Pending Approval' ? 'bg-yellow-100 text-yellow-800' :
                            email.status === 'Approved' ? 'bg-green-100 text-green-800' :
                            email.status === 'Sent' ? 'bg-blue-100 text-blue-800' :
                            email.status === 'Failed' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {email.status}
                          </span>
                          <span className="font-medium text-gray-900">{email.subject}</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span>{email.email_type}</span>
                          <span>{email.created_at ? format(new Date(email.created_at), 'MMM d, yyyy HH:mm') : ''}</span>
                        </div>
                      </div>
                      <p className="mt-2 text-sm text-gray-600 line-clamp-2">{email.body_preview || email.body?.slice(0, 200)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <EnvelopeOpenIcon className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <p className="text-lg font-medium">No emails yet</p>
                <p className="text-sm mt-1">Create your first email draft for this sponsor</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'followups' && (
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Follow-up Sequence</h2>

            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-2">Follow-up Status</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Emails Sent</p>
                  <p className="font-bold text-2xl text-gray-900">{(followUpStatus as unknown as any)?.emails_sent || 0}</p>
                </div>
                <div>
                  <p className="text-gray-500">Replies Received</p>
                  <p className="font-bold text-2xl text-gray-900">{(followUpStatus as unknown as any)?.replies_received || 0}</p>
                </div>
                <div>
                  <p className="text-gray-500">Follow-ups Sent</p>
                  <p className="font-bold text-2xl text-gray-900">{(followUpStatus as unknown as any)?.follow_ups_sent || 0}/2</p>
                </div>
                <div className="md:col-span-3">
                  <p className="text-gray-500">Next Follow-up Due</p>
                  <p className="font-bold text-lg text-gray-900">
                    {(followUpStatus as unknown as any)?.next_follow_up_due ? format(new Date((followUpStatus as unknown as any)?.next_follow_up_due), 'MMM d, yyyy HH:mm') : 'Not scheduled'}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {(followUps as unknown as any[]) && (followUps as unknown as any[]).length > 0 ? (
                (followUps as unknown as any[]).map((fu: any) => (
                  <div key={fu.id} className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">Follow-up #{fu.sequence_number}</p>
                        <p className="text-sm text-gray-500">{fu.email_type} &bull; {fu.scheduled_at ? format(new Date(fu.scheduled_at), 'MMM d, yyyy HH:mm') : 'Not scheduled'}</p>
                      </div>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        fu.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                        fu.status === 'Sent' ? 'bg-blue-100 text-blue-800' :
                        fu.status === 'Approved' ? 'bg-green-100 text-green-800' :
                        fu.status === 'Cancelled' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {fu.status}
                      </span>
                    </div>
                    {fu.status === 'Pending' && fu.body_preview && (
                      <p className="mt-2 text-sm text-gray-600 line-clamp-2">{fu.body_preview}</p>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-center text-gray-500 py-8">No follow-ups scheduled yet</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'meetings' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Meetings</h2>
              <button className="btn-primary">
                <PlusIcon className="w-5 h-5 mr-2" />
                Schedule Meeting
              </button>
            </div>

            {(meetings as unknown as any[]) && (meetings as unknown as any[]).length > 0 ? (
              <div className="space-y-4">
                {(meetings as unknown as any[])?.map((meeting: any) => (
                  <Link key={meeting.id} to={`/meetings/${meeting.id}`} className="block">
                    <div className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{meeting.title}</p>
                          <p className="text-sm text-gray-500">{meeting.scheduled_at ? format(new Date(meeting.scheduled_at), 'MMM d, yyyy HH:mm') : 'Not scheduled'}</p>
                        </div>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          meeting.status === 'Meeting Scheduled' ? 'bg-blue-100 text-blue-800' :
                          meeting.status === 'Meeting Completed' ? 'bg-green-100 text-green-800' :
                          meeting.status === 'Meeting Cancelled' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {meeting.status}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <CalendarDaysIcon className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <p className="text-lg font-medium">No meetings scheduled</p>
                <p className="text-sm mt-1">Schedule your first meeting with this sponsor</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'notes' && (
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Notes & Institutional Memory</h2>
            <div className="p-4 bg-gray-50 rounded-lg min-h-[200px]">
              <p className="text-gray-500">Notes feature coming soon. This will integrate with institutional memory.</p>
            </div>
          </div>
        )}

        {activeTab === 'replies' && (
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Reply Tracking</h2>
            {(replies as unknown as any[]) && (replies as unknown as any[]).length > 0 ? (
              <div className="space-y-4">
                {(replies as unknown as any[])?.map((reply: any) => (
                  <div key={reply.id} className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium text-gray-900">{reply.subject}</p>
                      <span className="text-sm text-gray-500">{reply.received_at ? format(new Date(reply.received_at), 'MMM d, yyyy HH:mm') : ''}</span>
                    </div>
                    <p className="text-sm text-gray-600">{reply.body?.slice(0, 300)}...</p>
                    <div className="mt-2 flex gap-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        reply.classification === 'Interested' ? 'bg-green-100 text-green-800' :
                        reply.classification === 'Not Interested' ? 'bg-red-100 text-red-800' :
                        reply.classification === 'Question' ? 'bg-blue-100 text-blue-800' :
                        reply.classification === 'Meeting Request' ? 'bg-purple-100 text-purple-800' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {reply.classification}
                      </span>
                      {reply.extracted_meeting_request && (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                          Meeting Requested
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8">No replies received yet</p>
            )}
          </div>
        )}
      </div>

      {/* Research Modal */}
      {showResearchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                {researchType === 'research' ? 'Run Research' : researchType === 'prioritize' ? 'Run Prioritization' : 'Research & Prioritize'}
              </h2>
              <button onClick={() => setShowResearchModal(false)} className="text-gray-400 hover:text-gray-600">
                <ChevronUpIcon className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Event ID (optional)</label>
                <input
                  type="number"
                  value={eventId}
                  onChange={(e) => setEventId(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Enter event ID to associate"
                />
              </div>
              <p className="text-sm text-gray-500">
                {researchType === 'research' ? 'This will fetch company information and generate a research summary.' :
                researchType === 'prioritize' ? 'This will score the sponsor based on research data and event context.' :
                'This will run both research and prioritization in sequence.'}
              </p>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button onClick={() => setShowResearchModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button
                  onClick={() => handleResearchAction(researchType)}
                  disabled={researchMutation.isPending || prioritizeMutation.isPending || researchAndPrioritizeMutation.isPending}
                  className="btn-primary"
                >
                  {researchMutation.isPending || prioritizeMutation.isPending || researchAndPrioritizeMutation.isPending ? 'Processing...' : 'Run'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Email Modal */}
      {showCreateEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Create Email Draft</h2>
              <button onClick={() => setShowCreateEmailModal(false)} className="text-gray-400 hover:text-gray-600">
                <ChevronUpIcon className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Type</label>
                <select
                  value={emailType}
                  onChange={(e) => setEmailType(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="initial">Initial Outreach</option>
                  <option value="follow_up_1">Follow-up 1</option>
                  <option value="follow_up_2">Follow-up 2</option>
                  <option value="meeting_request">Meeting Request</option>
                  <option value="thank_you">Thank You</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Event ID (optional)</label>
                <input
                  type="number"
                  value={eventId}
                  onChange={(e) => setEventId(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Enter event ID to associate"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button onClick={() => setShowCreateEmailModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button
                  onClick={handleCreateEmail}
                  disabled={createEmailMutation.isPending}
                  className="btn-primary"
                >
                  {createEmailMutation.isPending ? 'Creating...' : 'Create Draft'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SponsorDetail;