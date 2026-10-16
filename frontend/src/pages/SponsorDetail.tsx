import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/client';
import { useSponsor, useSponsorEmails, useSponsorReplies, useSponsorFollowUps, useSponsorFollowUpStatus, useSponsorResearch, useSponsorPrioritize, useSponsorResearchAndPrioritize, useGeminiEmailDraft } from '../hooks/useApi';
import { useMeetings } from '../hooks/useApi';
import {
  BuildingOfficeIcon,
  MagnifyingGlassIcon,
  EnvelopeOpenIcon,
  ClockIcon,
  ArrowPathIcon,
  ArrowTrendingUpIcon,
  InformationCircleIcon,
  PlusIcon,
  ChevronLeftIcon,
  CalendarDaysIcon,
  XMarkIcon,
  ArrowRightIcon,
  SparklesIcon,
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
  const [isLoadingData, setIsLoadingData] = useState(true);

  const { data: sponsor, isLoading, refetch } = useSponsor(sponsorId);
  const { data: emails } = useSponsorEmails(sponsorId);
  const { data: replies } = useSponsorReplies(sponsorId);
  const { data: followUps } = useSponsorFollowUps(sponsorId);
  const { data: followUpStatus } = useSponsorFollowUpStatus(sponsorId);
  const { data: meetings } = useMeetings({ sponsor_id: sponsorId });
  
  const researchMutation = useSponsorResearch(sponsorId);
  const prioritizeMutation = useSponsorPrioritize(sponsorId);
  const researchAndPrioritizeMutation = useSponsorResearchAndPrioritize(sponsorId);
  const geminiEmailMutation = useGeminiEmailDraft();
  
  // Track loading state
  useEffect(() => {
    if (!isLoading) {
      setIsLoadingData(false);
    }
  }, [isLoading]);

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
      const result = await geminiEmailMutation.mutateAsync({
        companyId: Number(sponsorId),
        eventName: 'AI/ML Hackathon',
        audience: 'College students',
        sponsorshipNeeded: [
          'Financial support',
          'Technical resources',
        ],
        organizerName: 'Organizing Team',
      });

      const draft = (result as any)?.data || result;

      setShowCreateEmailModal(false);
      setEmailType('initial');
      setEventId('');

      alert(`Email draft saved! ID: ${draft?.id || 'Created'}`);
      refetch();
    } catch (err: any) {
      alert(
        err.response?.data?.error ||
        err.response?.data?.detail ||
        'Failed to generate and save email draft'
      );
    }
  };

  const [isSchedulingFollowUp, setIsSchedulingFollowUp] = useState(false);

  const handleScheduleFollowUp = async () => {
    try {
      setIsSchedulingFollowUp(true);
      await api.post(`/sponsors/${sponsorId}/follow-ups/schedule`);
      refetch();
      alert('Follow-up scheduled successfully! You can review and approve it.');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to schedule follow-up');
    } finally {
      setIsSchedulingFollowUp(false);
    }
  };
  if (isLoadingData) {
    return (
      <div className="flex flex-col items-center justify-center h-64 animate-fade-in">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent mb-4"></div>
        <p className="text-gray-500">Loading sponsor details...</p>
      </div>
    );
  }

  if (!sponsor) {
    return (
      <div className="text-center py-12 animate-fade-in">
        <BuildingOfficeIcon className="w-16 h-16 mx-auto text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Sponsor not found</h2>
        <p className="text-gray-500 mb-6">The sponsor you're looking for doesn't exist or has been removed.</p>
        <button onClick={() => navigate('/sponsors')} className="btn-primary">
          <ArrowRightIcon className="w-5 h-5 mr-2" />
          Back to Sponsors
        </button>
      </div>
    );
  }

  const sponsorData = sponsor as unknown as any;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-slide-in-left">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 lg:hidden transition-colors">
            <ChevronLeftIcon className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{sponsorData.company_name || sponsorData.name || 'Unnamed Company'}</h1>
            <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
              <span>{sponsorData.industry || 'No industry'}</span>
              <span className="text-gray-300">•</span>
              <span className="px-2 py-0.5 bg-primary-100 text-primary-700 rounded-full text-xs font-medium">
                {sponsorData.company_category || sponsorData.category || 'Uncategorized'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowCreateEmailModal(true)} className="btn-primary group">
            <PlusIcon className="w-5 h-5 mr-2 group-hover:rotate-90 transition-transform duration-200" />
            New Email
          </button>
          <button onClick={() => setShowResearchModal(true)} className="btn-secondary group">
            <MagnifyingGlassIcon className="w-5 h-5 mr-2 group-hover:rotate-12 transition-transform duration-200" />
            Research
          </button>
        </div>
      </div>

      {/* Status & Priority Badges */}
      <div className="flex flex-wrap gap-3 animate-fade-in stagger-1">
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[sponsorData.status as keyof typeof statusColors] || 'bg-gray-100 text-gray-700'} animate-pulse-soft`}>
          {sponsorData.status || 'Not Contacted'}
        </span>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${priorityColors[sponsorData.priority_tier as keyof typeof priorityColors] || 'bg-gray-100 text-gray-700'}`}>
          <SparklesIcon className="w-4 h-4 inline mr-1" />
          Priority: {sponsorData.priority_score ?? sponsorData.priority ?? 0} {sponsorData.priority_tier ? `(${sponsorData.priority_tier})` : ''}
        </span>
        <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-700">
          Follow-ups: {sponsorData.follow_up_count ?? 0}/2
        </span>
        {sponsorData.assigned_to && (
          <span className="px-3 py-1 rounded-full text-sm font-medium bg-primary-100 text-primary-800">
            Assigned: {sponsorData.assigned_to}
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 animate-fade-in stagger-2">
        <nav className="flex gap-8" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-all duration-200 ${
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
      <div className="bg-white rounded-xl border border-gray-200 animate-fade-in stagger-3">
        {activeTab === 'overview' && (
          <div className="p-6 space-y-6">
            {/* Quick Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <InfoCard icon={BuildingOfficeIcon} label="Contact Person" value={sponsorData.contact_person || 'N/A'} iconColor="blue" />
              <InfoCard icon={EnvelopeOpenIcon} label="Contact Email" value={sponsorData.contact_email || 'N/A'} iconColor="green" />
              <InfoCard icon={InformationCircleIcon} label="Contact Role" value={sponsorData.contact_role || 'N/A'} iconColor="purple" />
              <InfoCard 
                icon={ArrowRightIcon} 
                label="Website" 
                value={
                  sponsorData.website ? (
                    <a href={sponsorData.website} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline truncate block">
                      {sponsorData.website}
                    </a>
                  ) : 'N/A'
                } 
                iconColor="orange" 
              />
            </div>

            {/* Research & Priority */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <DetailCard title="Research Summary" icon={MagnifyingGlassIcon} iconColor="blue">
                {sponsorData.research_summary ? (
                  <p className="text-gray-700 whitespace-pre-wrap">{sponsorData.research_summary}</p>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <MagnifyingGlassIcon className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                    <p>No research data available</p>
                    <button 
                      onClick={() => { setResearchType('research'); setShowResearchModal(true); }}
                      className="mt-3 text-primary-600 hover:underline text-sm font-medium"
                    >
                      Run research →
                    </button>
                  </div>
                )}
              </DetailCard>
              <DetailCard title="Priority Reasoning" icon={ArrowTrendingUpIcon} iconColor="yellow">
                {sponsorData.priority_reasoning ? (
                  <p className="text-gray-700 whitespace-pre-wrap">{sponsorData.priority_reasoning}</p>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <ArrowTrendingUpIcon className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                    <p>No priority analysis available</p>
                    <button 
                      onClick={() => { setResearchType('prioritize'); setShowResearchModal(true); }}
                      className="mt-3 text-primary-600 hover:underline text-sm font-medium"
                    >
                      Run prioritization →
                    </button>
                  </div>
                )}
              </DetailCard>
            </div>

            {/* Company Details */}
            <DetailCard title="Company Details" icon={InformationCircleIcon} iconColor="gray">
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <DetailRow label="Company Name" value={sponsorData.company_name || sponsorData.name || 'N/A'} />
                <DetailRow label="Category" value={sponsorData.company_category || sponsorData.category || 'N/A'} />
                <DetailRow label="Industry" value={sponsorData.industry || 'N/A'} />
                <DetailRow 
                  label="Status" 
                  value={
                    <span className={`px-2 py-1 rounded-full text-xs ${statusColors[sponsorData.status as keyof typeof statusColors] || 'bg-gray-100 text-gray-700'}`}>
                      {sponsorData.status || 'Not Contacted'}
                    </span>
                  } 
                />
                <DetailRow label="Priority Score" value={`${sponsorData.priority_score ?? sponsorData.priority ?? 0} ${sponsorData.priority_tier ? `(${sponsorData.priority_tier})` : ''}`} />
                <DetailRow label="Follow-up Count" value={`${sponsorData.follow_up_count ?? 0}/2`} />
                <DetailRow label="Created" value={sponsorData.created_at ? format(new Date(sponsorData.created_at), 'MMM d, yyyy') : 'N/A'} />
                <DetailRow label="Last Updated" value={sponsorData.updated_at ? format(new Date(sponsorData.updated_at), 'MMM d, yyyy') : 'N/A'} />
              </dl>
            </DetailCard>
          </div>
        )}

        {activeTab === 'research' && (
          <ResearchTab 
            sponsor={sponsorData}
            showModal={setShowResearchModal}
            setResearchType={setResearchType}
            researchMutation={researchMutation}
            prioritizeMutation={prioritizeMutation}
            researchAndPrioritizeMutation={researchAndPrioritizeMutation}
            eventId={eventId}
            setEventId={setEventId}
            handleResearchAction={handleResearchAction}
          />
        )}

        {activeTab === 'emails' && (
          <EmailsTab sponsorId={sponsorId} emails={emails} format={format} onCreateDraft={() => setShowCreateEmailModal(true)} />
        )}

        {activeTab === 'followups' && (
          <FollowUpsTab
            sponsorId={sponsorId}
            followUpStatus={followUpStatus}
            followUps={followUps}
            format={format}
            onScheduleFollowUp={handleScheduleFollowUp}
            isSchedulingFollowUp={isSchedulingFollowUp}
          />
        )}

        {activeTab === 'meetings' && (
          <MeetingsTab sponsorId={sponsorId} meetings={meetings} format={format} />
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
          <RepliesTab replies={replies} format={format} />
        )}
      </div>

      {/* Research Modal */}
      {showResearchModal && (
        <Modal onClose={() => setShowResearchModal(false)} title={
          researchType === 'research' ? 'Run Research' : researchType === 'prioritize' ? 'Run Prioritization' : 'Research & Prioritize'
        }>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Event ID (optional)</label>
              <input
                type="number"
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
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
                {researchMutation.isPending || prioritizeMutation.isPending || researchAndPrioritizeMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                    Processing...
                  </span>
                ) : 'Run'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Create Email Modal */}
      {showCreateEmailModal && (
        <Modal onClose={() => setShowCreateEmailModal(false)} title="Create Email Draft">
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Type</label>
              <select
                value={emailType}
                onChange={(e) => setEmailType(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors bg-white"
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
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
                placeholder="Enter event ID to associate"
              />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <button onClick={() => setShowCreateEmailModal(false)} className="btn-secondary">
                Cancel
              </button>
              <button
                onClick={handleCreateEmail}
                disabled={geminiEmailMutation.isPending}
                className="btn-primary"
              >
                {geminiEmailMutation.isPending ? 'Creating...' : 'Create Draft'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// Helper Components
function InfoCard({ icon: Icon, label, value, iconColor }: { icon: React.ComponentType<any>; label: string; value: React.ReactNode; iconColor: string }) {
  const iconColors = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    purple: 'bg-purple-100 text-purple-600',
    orange: 'bg-orange-100 text-orange-600',
    gray: 'bg-gray-100 text-gray-600',
  };
  
  return (
    <div className="p-4 bg-gray-50 rounded-lg animate-fade-in hover:bg-gray-100 transition-colors">
      <div className={`p-2 rounded-lg ${iconColors[iconColor as keyof typeof iconColors] || iconColors.gray} mb-2 inline-block`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-xs text-gray-500 font-medium">{label}</p>
      <p className="font-medium text-gray-900 truncate">{typeof value === 'string' ? value : value}</p>
    </div>
  );
}

function DetailCard({ title, icon: Icon, iconColor, children }: { title: string; icon: React.ComponentType<any>; iconColor: string; children: React.ReactNode }) {
  const iconColors = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    purple: 'bg-purple-100 text-purple-600',
    orange: 'bg-orange-100 text-orange-600',
    yellow: 'bg-yellow-100 text-yellow-600',
    gray: 'bg-gray-100 text-gray-600',
  };
  
  return (
    <div className="p-4 bg-gray-50 rounded-lg animate-fade-in">
      <div className="flex items-center gap-2 mb-3">
        <div className={`p-2 rounded-lg ${iconColors[iconColor as keyof typeof iconColors] || iconColors.gray}`}>
          <Icon className="w-5 h-5" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="min-h-[120px]">{children}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-900">{value}</dd>
    </>
  );
}

function Modal({ onClose, title, children }: { onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 animate-fade-in">
      <div className="bg-white rounded-xl w-full max-w-md animate-scale-in">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ResearchTab({ sponsor, showModal, setResearchType, researchMutation, prioritizeMutation, researchAndPrioritizeMutation, eventId, setEventId, handleResearchAction }: any) {
  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Research & Prioritization</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <DetailCard title="Research Summary" icon={MagnifyingGlassIcon} iconColor="blue">
          {sponsor.research_summary ? (
            <p className="text-gray-700 whitespace-pre-wrap">{sponsor.research_summary}</p>
          ) : (
            <p className="text-gray-500">No research data available. Click "Research" to fetch company information.</p>
          )}
        </DetailCard>
        <DetailCard title="Priority Analysis" icon={ArrowTrendingUpIcon} iconColor="yellow">
          {sponsor.priority_reasoning ? (
            <p className="text-gray-700 whitespace-pre-wrap">{sponsor.priority_reasoning}</p>
          ) : (
            <p className="text-gray-500">No priority analysis available. Click "Prioritize" to score this sponsor.</p>
          )}
        </DetailCard>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => { setResearchType('research'); showModal(true); }}
          disabled={researchMutation.isPending}
          className="btn-secondary"
        >
          <MagnifyingGlassIcon className="w-5 h-5 mr-2" />
          Research Only
        </button>
        <button
          onClick={() => { setResearchType('prioritize'); showModal(true); }}
          disabled={prioritizeMutation.isPending}
          className="btn-secondary"
        >
          <ArrowTrendingUpIcon className="w-5 h-5 mr-2" />
          Prioritize Only
        </button>
        <button
          onClick={() => { setResearchType('both'); showModal(true); }}
          disabled={researchAndPrioritizeMutation.isPending}
          className="btn-primary"
        >
          <ArrowPathIcon className="w-5 h-5 mr-2" />
          Research & Prioritize
        </button>
      </div>
    </div>
  );
}

function EmailsTab({ emails, format, onCreateDraft }: any) {
  return (
    <div className="p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Email History</h2>
        <button onClick={onCreateDraft} className="btn-primary group">
          <PlusIcon className="w-5 h-5 mr-2 group-hover:rotate-90 transition-transform duration-200" />
          Create Draft
        </button>
      </div>

      {(emails as unknown as any[]) && (emails as unknown as any[]).length > 0 ? (
        <div className="space-y-3">
          {(emails as unknown as any[]).map((email: any, index: number) => (
            <Link key={email.id} to={`/emails/${email.id}`} className="block animate-fade-in" style={{ animationDelay: `${index * 0.03}s` }}>
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
  );
}

function FollowUpsTab({ sponsorId, followUpStatus, followUps, format, onScheduleFollowUp, isSchedulingFollowUp }: any) {
  const followUpsSent = followUpStatus?.follow_ups_sent || 0;
  const isMaxReached = followUpsSent >= 2;

  return (
    <div className="p-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Follow-up Sequence</h2>
          <p className="text-sm text-gray-500">Automated sequence: max 2 follow-ups per sponsor</p>
        </div>
        <button
          onClick={onScheduleFollowUp}
          disabled={isSchedulingFollowUp || isMaxReached}
          className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50"
        >
          <SparklesIcon className="w-4 h-4" />
          {isSchedulingFollowUp ? 'Scheduling...' : isMaxReached ? 'Max Follow-ups (2/2) Reached' : '✨ Schedule Next Follow-up'}
        </button>
      </div>

      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold text-gray-900 mb-2">Follow-up Status</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <StatCard label="Emails Sent" value={followUpStatus?.emails_sent || 0} icon={EnvelopeOpenIcon} color="blue" />
          <StatCard label="Replies Received" value={followUpStatus?.replies_received || 0} icon={ArrowPathIcon} color="green" />
          <StatCard label="Follow-ups Sent" value={`${followUpsSent}/2`} icon={ClockIcon} color="purple" />
        </div>
        <div className="mt-4">
          <p className="text-gray-500 text-sm">Next Follow-up Due</p>
          <p className="font-bold text-lg text-gray-900">
            {followUpStatus?.next_follow_up_due ? format(new Date(followUpStatus.next_follow_up_due), 'MMM d, yyyy HH:mm') : (isMaxReached ? 'Completed (2/2 sent)' : 'Not scheduled')}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {(followUps as unknown as any[]) && (followUps as unknown as any[]).length > 0 ? (
          (followUps as unknown as any[]).map((fu: any, index: number) => (
            <Link key={fu.id} to={`/emails/${fu.id}`} className="block hover:shadow-sm transition-shadow">
              <div className="p-4 border border-gray-200 rounded-lg animate-fade-in hover:bg-gray-50 transition-colors" style={{ animationDelay: `${index * 0.03}s` }}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">Follow-up #{fu.sequence_number}</p>
                      <span className="text-xs text-gray-500 font-normal">({fu.subject || 'Follow-up Draft'})</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{fu.email_type} • {fu.scheduled_at ? format(new Date(fu.scheduled_at), 'MMM d, yyyy HH:mm') : 'Draft'}</p>
                  </div>
                  <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                    fu.status === 'Draft' ? 'bg-gray-100 text-gray-700' :
                    fu.status === 'Pending' || fu.status === 'Pending Approval' ? 'bg-yellow-100 text-yellow-800' :
                    fu.status === 'Approved' ? 'bg-green-100 text-green-800' :
                    fu.status === 'Sent' ? 'bg-blue-100 text-blue-800' :
                    fu.status === 'Cancelled' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {fu.status}
                  </span>
                </div>
                {fu.body_preview && (
                  <p className="mt-2 text-sm text-gray-600 line-clamp-2">{fu.body_preview}...</p>
                )}
              </div>
            </Link>
          ))
        ) : (
          <div className="text-center py-8 text-gray-500">
            <ClockIcon className="w-10 h-10 mx-auto text-gray-300 mb-2" />
            <p className="font-medium">No follow-ups scheduled yet</p>
            <p className="text-sm mt-1">Click "Schedule Next Follow-up" to let Gemini create the next follow-up draft.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: React.ComponentType<any>; color: string }) {
  const colors = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    purple: 'bg-purple-100 text-purple-600',
  };
  
  return (
    <div className="p-3 bg-white rounded-lg border border-gray-200">
      <div className="flex items-center gap-2 mb-1">
        <div className={`p-1.5 rounded ${colors[color as keyof typeof colors] || colors.blue}`}>
          <Icon className="w-4 h-4" />
        </div>
        <p className="text-xs text-gray-500 font-medium">{label}</p>
      </div>
      <p className="font-bold text-xl text-gray-900">{value}</p>
    </div>
  );
}

function MeetingsTab({ sponsorId, meetings, format }: any) {
  return (
    <div className="p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Meetings</h2>
        <button className="btn-primary group">
          <PlusIcon className="w-5 h-5 mr-2 group-hover:rotate-90 transition-transform duration-200" />
          Schedule Meeting
        </button>
      </div>

      {(meetings as unknown as any[]) && (meetings as unknown as any[]).length > 0 ? (
        <div className="space-y-3">
          {(meetings as unknown as any[])?.map((meeting: any, index: number) => (
            <Link key={meeting.id} to={`/meetings/${meeting.id}`} className="block animate-fade-in" style={{ animationDelay: `${index * 0.03}s` }}>
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
  );
}

function RepliesTab({ replies, format }: any) {
  return (
    <div className="p-6 animate-fade-in">
      <h2 className="text-lg font-semibold text-gray-900 mb-6">Reply Tracking</h2>
      {(replies as unknown as any[]) && (replies as unknown as any[]).length > 0 ? (
        <div className="space-y-3">
          {(replies as unknown as any[])?.map((reply: any, index: number) => (
            <div key={reply.id} className="p-4 border border-gray-200 rounded-lg animate-fade-in" style={{ animationDelay: `${index * 0.03}s` }}>
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
  );
}

export default SponsorDetail;