import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  useSponsor,
  useSponsorEmails,
  useSponsorReplies,
  useSponsorConversation,
  useSponsorFollowUps,
  useSponsorFollowUpStatus,
  useSponsorResearch,
  useSponsorPrioritize,
  useSponsorResearchAndPrioritize,
  useGeminiEmailDraft,
  useDiscoverContact,
  useUpdateSponsor,
  useProcessReply,
  useApproveAndSendEmail,
  useScheduleSponsorFollowUp,
  useMeetings,
  useCreateMeeting,
  useTeamMembers,
  useEvents,
  useInstitutionalMemory,
} from '../hooks/useApi';
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
  CheckBadgeIcon,
  ExclamationTriangleIcon,
  ChatBubbleLeftRightIcon,
  UserPlusIcon,
  PaperAirplaneIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns/format';

const statusColors: Record<string, string> = {
  'Not Contacted': 'bg-gray-100 text-gray-700',
  Contacted: 'bg-blue-100 text-blue-800',
  'Follow-up': 'bg-yellow-100 text-yellow-800',
  'Follow-up 1': 'bg-yellow-100 text-yellow-800',
  'Follow-up 2': 'bg-orange-100 text-orange-800',
  Interested: 'bg-green-100 text-green-800',
  'Meeting Requested': 'bg-purple-100 text-purple-800',
  'Meeting Scheduled': 'bg-indigo-100 text-indigo-800',
  'Sponsorship Won': 'bg-emerald-100 text-emerald-800',
  Declined: 'bg-red-100 text-red-800',
  Closed: 'bg-gray-100 text-gray-700',
  'No Reply': 'bg-amber-100 text-amber-800',
};

const priorityColors: Record<string, string> = {
  High: 'bg-green-100 text-green-800',
  Medium: 'bg-yellow-100 text-yellow-800',
  Low: 'bg-gray-100 text-gray-700',
};

const tabs = [
  { id: 'overview', label: 'Overview', icon: BuildingOfficeIcon },
  { id: 'research', label: 'Research & Ask', icon: MagnifyingGlassIcon },
  { id: 'emails', label: 'Emails & Drafts', icon: EnvelopeOpenIcon },
  { id: 'replies', label: 'Replies & Thread', icon: ChatBubbleLeftRightIcon },
  { id: 'followups', label: 'Follow-ups (Max 2)', icon: ClockIcon },
  { id: 'meetings', label: 'Virtual Meetings', icon: CalendarDaysIcon },
  { id: 'notes', label: 'Notes & Memory', icon: InformationCircleIcon },
];

export function SponsorDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const sponsorId = parseInt(id || '0', 10);
  const [activeTab, setActiveTab] = useState('overview');

  // Modals
  const [showResearchModal, setShowResearchModal] = useState(false);
  const [researchType, setResearchType] = useState<'research' | 'prioritize' | 'both'>('both');
  const [eventId, setEventId] = useState('');

  const [showCreateEmailModal, setShowCreateEmailModal] = useState(false);
  const [emailType, setEmailType] = useState('initial');
  const [brochureTier, setBrochureTier] = useState('gold');
  const [customEventName, setCustomEventName] = useState('24-Hour AI/ML Hackathon');
  const [customAudience, setCustomAudience] = useState('500+ student developers and builders');

  const [showReplyModal, setShowReplyModal] = useState(false);
  const [replySubject, setReplySubject] = useState('');
  const [replyBody, setReplyBody] = useState('');
  const [lastReplyResult, setLastReplyResult] = useState<any>(null);

  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingLink, setMeetingLink] = useState('https://meet.google.com/new');
  const [meetingNotes, setMeetingNotes] = useState('');

  const [showWonModal, setShowWonModal] = useState(false);
  const [wonAmount, setWonAmount] = useState('');
  const [wonBenefits, setWonBenefits] = useState('');

  const [notesText, setNotesText] = useState('');

  const { data: sponsor, isLoading, refetch } = useSponsor(sponsorId);
  const { data: emails, refetch: refetchEmails } = useSponsorEmails(sponsorId);
  const { data: replies, refetch: refetchReplies } = useSponsorReplies(sponsorId);
  const { data: conversation, refetch: refetchConversation } = useSponsorConversation(sponsorId);
  const { data: followUps, refetch: refetchFollowUps } = useSponsorFollowUps(sponsorId);
  const { data: followUpStatus, refetch: refetchFollowUpStatus } = useSponsorFollowUpStatus(sponsorId);
  const { data: meetings, refetch: refetchMeetings } = useMeetings({ sponsor_id: sponsorId });
  const { data: teamMembers } = useTeamMembers(true);
  const { data: events } = useEvents(true);
  const { data: institutionalMemory } = useInstitutionalMemory();

  const researchMutation = useSponsorResearch(sponsorId);
  const prioritizeMutation = useSponsorPrioritize(sponsorId);
  const researchAndPrioritizeMutation = useSponsorResearchAndPrioritize(sponsorId);
  const geminiEmailMutation = useGeminiEmailDraft();
  const discoverContactMutation = useDiscoverContact(sponsorId);
  const updateSponsorMutation = useUpdateSponsor();
  const processReplyMutation = useProcessReply();
  const approveAndSendMutation = useApproveAndSendEmail();
  const scheduleFollowUpMutation = useScheduleSponsorFollowUp(sponsorId);
  const createMeetingMutation = useCreateMeeting();

  const sponsorData = sponsor as unknown as any;

  useEffect(() => {
    if (sponsorData) {
      setNotesText(sponsorData.notes || '');
      if (sponsorData.sponsorship_amount) setWonAmount(String(sponsorData.sponsorship_amount));
      if (sponsorData.sponsorship_details) setWonBenefits(sponsorData.sponsorship_details);
    }
  }, [sponsorData]);

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
      refetch();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Research action failed');
    }
  };

  const handleDiscoverContact = async () => {
    try {
      const res: any = await discoverContactMutation.mutateAsync();
      refetch();
      alert(
        `Contact Discovery Complete!\nEmail: ${res?.discovered?.contact_email || 'None'}\nPerson: ${res?.discovered?.contact_person || 'None'}\nRole: ${res?.discovered?.contact_role || 'None'}\nSource: ${res?.discovered?.source || 'Inferred [UNVERIFIED]'}`
      );
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Contact discovery failed');
    }
  };

  const handleCreateEmail = async () => {
    try {
      const recommendedAsks =
        sponsorData?.recommended_sponsorship_types?.length > 0
          ? sponsorData.recommended_sponsorship_types
          : ['Cash Sponsorship', 'Swag / Goodies', 'Cloud Credits'];

      const result = await geminiEmailMutation.mutateAsync({
        companyId: Number(sponsorId),
        eventName: customEventName || '24-Hour Hackathon',
        audience: customAudience || '500+ college students',
        sponsorshipNeeded: recommendedAsks,
        organizerName: sponsorData?.assignee?.name || 'Sponsorship Team',
        emailType,
        eventId: eventId ? parseInt(eventId, 10) : undefined,
        brochureTier,
        saveDraft: true,
      });

      const draft = (result as any)?.data || result;
      setShowCreateEmailModal(false);
      refetchEmails();
      refetch();
      setActiveTab('emails');
      if (draft?.id) {
        // Stay on emails tab or let user review
      }
    } catch (err: any) {
      alert(
        err.response?.data?.error ||
          err.response?.data?.detail ||
          'Failed to generate personalized email draft'
      );
    }
  };

  const handleOneClickApproveAndSend = async (emailId: number) => {
    try {
      const res: any = await approveAndSendMutation.mutateAsync({
        id: emailId,
        approverId: sponsorData?.assignee_id || 1,
      });
      refetchEmails();
      refetchFollowUps();
      refetchFollowUpStatus();
      refetchConversation();
      refetch();
      alert(
        `Email Approved & Sent!\nDaily Quota Used: ${res?.daily_quota?.sent_today ?? '?'}/${res?.daily_quota?.daily_limit ?? 40}`
      );
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to approve and send email');
    }
  };

  const handleProcessReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyBody.trim()) return;
    try {
      const res: any = await processReplyMutation.mutateAsync({
        sponsorId,
        data: {
          from_email: sponsorData?.contact_email || 'sponsor@company.com',
          subject: replySubject || `Re: Sponsorship Inquiry - ${sponsorData?.name || ''}`,
          body: replyBody,
        },
      });
      setLastReplyResult(res);
      setReplyBody('');
      refetchReplies();
      refetchConversation();
      refetchFollowUps();
      refetchFollowUpStatus();
      refetch();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to classify and process reply');
    }
  };

  const handleScheduleFollowUp = async () => {
    try {
      await scheduleFollowUpMutation.mutateAsync();
      refetchFollowUps();
      refetchFollowUpStatus();
      refetchEmails();
      refetch();
      alert('Follow-up draft scheduled! Remember: organizer approval is required before sending.');
    } catch (err: any) {
      alert(err.response?.data?.detail || err.response?.data?.error || 'Failed to schedule follow-up');
    }
  };

  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createMeetingMutation.mutateAsync({
        sponsor_id: sponsorId,
        team_member_id: sponsorData?.assignee_id || 1,
        title: meetingTitle || `Sponsorship Call with ${sponsorData?.name}`,
        description: meetingNotes || 'Virtual meeting to discuss hackathon sponsorship tiers and deliverables.',
        scheduled_at: meetingDate ? new Date(meetingDate).toISOString() : new Date(Date.now() + 86400000).toISOString(),
        duration_minutes: 30,
        location: 'Virtual (Google Meet)',
        meeting_link: meetingLink,
      });
      await updateSponsorMutation.mutateAsync({
        id: sponsorId,
        data: { status: 'Meeting Scheduled' },
      });
      setShowMeetingModal(false);
      refetchMeetings();
      refetch();
      setActiveTab('meetings');
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to schedule virtual meeting');
    }
  };

  const handleSaveWon = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateSponsorMutation.mutateAsync({
        id: sponsorId,
        data: {
          status: 'Sponsorship Won',
          sponsorship_amount: wonAmount ? parseFloat(wonAmount) : 0,
          sponsorship_details: wonBenefits,
        },
      });
      setShowWonModal(false);
      refetch();
      alert('Sponsorship Won recorded and automatically saved to Institutional Memory!');
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to update sponsorship outcome');
    }
  };

  const handleQuickStatusChange = async (newStatus: string) => {
    try {
      await updateSponsorMutation.mutateAsync({
        id: sponsorId,
        data: { status: newStatus },
      });
      refetch();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to update status');
    }
  };

  const handleQuickAssigneeChange = async (newAssigneeId: string) => {
    try {
      await updateSponsorMutation.mutateAsync({
        id: sponsorId,
        data: { assignee_id: newAssigneeId ? parseInt(newAssigneeId, 10) : null },
      });
      refetch();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to update assignee');
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 animate-fade-in">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent mb-4"></div>
        <p className="text-gray-500">Loading sponsor details...</p>
      </div>
    );
  }

  if (!sponsorData) {
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

  const companyName = sponsorData.company_name || sponsorData.name || 'Unnamed Company';
  const verifiedData = sponsorData.research_data || {};
  const unverifiedData = sponsorData.research_unverified || {};
  const recommendedAsks: string[] = sponsorData.recommended_sponsorship_types || [];
  const reasoningText: string =
    sponsorData.recommendation_reasoning || sponsorData.priority_reasoning || '';
  const membersList = (teamMembers as unknown as any[]) || [];
  const eventsList = (events as unknown as any[]) || [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/sponsors')}
            className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
            title="Back to Sponsors"
          >
            <ChevronLeftIcon className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">{companyName}</h1>
              <span className="px-2.5 py-0.5 bg-primary-100 text-primary-700 rounded-full text-xs font-semibold">
                {sponsorData.category || sponsorData.company_category || 'Uncategorized'}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 flex-wrap">
              <span>{sponsorData.industry || 'Industry not set'}</span>
              {sponsorData.website && (
                <>
                  <span>•</span>
                  <a
                    href={sponsorData.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 hover:underline"
                  >
                    {sponsorData.website}
                  </a>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleDiscoverContact}
            disabled={discoverContactMutation.isPending}
            className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5"
            title="Find contact person & email using free Hunter/Apollo or domain inference"
          >
            <UserPlusIcon className="w-4 h-4" />
            {discoverContactMutation.isPending ? 'Searching...' : 'Discover Contact'}
          </button>

          <button
            onClick={() => {
              setResearchType('both');
              setShowResearchModal(true);
            }}
            className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5"
          >
            <MagnifyingGlassIcon className="w-4 h-4" />
            Research & Prioritize
          </button>

          <button
            onClick={() => setShowReplyModal(true)}
            className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5"
          >
            <ChatBubbleLeftRightIcon className="w-4 h-4" />
            Log Sponsor Reply
          </button>

          <button
            onClick={() => setShowWonModal(true)}
            className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5 border-emerald-500/40 text-emerald-400"
          >
            <CurrencyDollarIcon className="w-4 h-4" />
            Record Deal / Benefits
          </button>

          <button
            onClick={() => setShowCreateEmailModal(true)}
            className="btn-primary text-xs py-2 px-3.5 flex items-center gap-1.5"
          >
            <PlusIcon className="w-4 h-4" />
            Draft Personalized Email
          </button>
        </div>
      </div>

      {/* Status, Priority, Follow-up Cap & Ownership Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white rounded-xl border border-gray-200">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold ${
              statusColors[sponsorData.status] || 'bg-gray-100 text-gray-700'
            }`}
          >
            Status: {sponsorData.status || 'Not Contacted'}
          </span>

          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold ${
              priorityColors[sponsorData.priority_tier] || 'bg-gray-100 text-gray-700'
            }`}
          >
            <SparklesIcon className="w-3.5 h-3.5 inline mr-1" />
            Priority: {sponsorData.priority_score ?? 0}/100{' '}
            {sponsorData.priority_tier ? `(${sponsorData.priority_tier})` : ''}
          </span>

          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold ${
              (sponsorData.follow_up_count ?? 0) >= 2
                ? 'bg-red-100 text-red-800'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            Follow-ups: {sponsorData.follow_up_count ?? 0}/2 (Hard Cap)
          </span>

          {sponsorData.sponsorship_amount > 0 && (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
              Secured: ₹{Number(sponsorData.sponsorship_amount).toLocaleString()}
            </span>
          )}
        </div>

        {/* Quick Status & Assignee Pickers (Duplicate Outreach Prevention / Ownership) */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500 font-medium">Stage:</span>
            <select
              value={sponsorData.status || 'Not Contacted'}
              onChange={(e) => handleQuickStatusChange(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="Not Contacted">Not Contacted</option>
              <option value="Contacted">Contacted</option>
              <option value="Follow-up">Follow-up</option>
              <option value="Interested">Interested</option>
              <option value="Meeting Requested">Meeting Requested</option>
              <option value="Meeting Scheduled">Meeting Scheduled</option>
              <option value="Sponsorship Won">Sponsorship Won</option>
              <option value="No Reply">No Reply</option>
              <option value="Declined">Declined</option>
              <option value="Closed">Closed</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-gray-500 font-medium">Owner:</span>
            <select
              value={sponsorData.assignee_id || ''}
              onChange={(e) => handleQuickAssigneeChange(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Unassigned</option>
              {membersList.map((m: any) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.role || 'Organizer'})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 overflow-x-auto">
        <nav className="flex gap-6 min-w-max" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 py-3.5 px-1 border-b-2 font-medium text-sm transition-all duration-200 ${
                activeTab === tab.id
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-xl border border-gray-200">
        {activeTab === 'overview' && (
          <div className="p-6 space-y-6">
            {/* Contact Info Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <InfoCard
                icon={BuildingOfficeIcon}
                label="Contact Person"
                value={sponsorData.contact_person || 'Not set (Click Discover Contact)'}
                iconColor="blue"
              />
              <InfoCard
                icon={EnvelopeOpenIcon}
                label="Contact Email"
                value={sponsorData.contact_email || 'Not set'}
                iconColor="green"
              />
              <InfoCard
                icon={InformationCircleIcon}
                label="Contact Role"
                value={sponsorData.contact_role || 'Developer Relations / Marketing'}
                iconColor="purple"
              />
              <InfoCard
                icon={UserPlusIcon}
                label="Assigned Organizer"
                value={
                  sponsorData.assignee
                    ? `${sponsorData.assignee.name} (${sponsorData.assignee.email})`
                    : 'Unassigned'
                }
                iconColor="orange"
              />
            </div>

            {/* Recommended Ask & Reasoning */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <DetailCard
                title="What to Ask For (AI Recommendation)"
                icon={SparklesIcon}
                iconColor="purple"
              >
                {recommendedAsks.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {recommendedAsks.map((ask: string, i: number) => (
                        <span
                          key={i}
                          className="px-3 py-1 rounded-full text-xs font-semibold bg-primary-100 text-primary-700"
                        >
                          ✦ {ask}
                        </span>
                      ))}
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {reasoningText ||
                        'Recommended based on company category, developer ecosystem focus, and past sponsorship profile.'}
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-500">
                    <p className="text-sm">No sponsorship recommendation generated yet.</p>
                    <button
                      onClick={() => {
                        setResearchType('both');
                        setShowResearchModal(true);
                      }}
                      className="mt-2 text-primary-600 hover:underline text-sm font-medium"
                    >
                      Run Research & Prioritization →
                    </button>
                  </div>
                )}
              </DetailCard>

              <DetailCard
                title="Verified Company Profile [VERIFIED]"
                icon={CheckBadgeIcon}
                iconColor="green"
              >
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <DetailRow label="Company" value={companyName} />
                  <DetailRow label="Category / Tier" value={sponsorData.category || 'N/A'} />
                  <DetailRow label="Industry" value={sponsorData.industry || 'N/A'} />
                  <DetailRow
                    label="Past Club History"
                    value={
                      verifiedData.past_sponsorships
                        ? `${verifiedData.past_sponsorships.past_events_sponsored} past event(s) — ₹${verifiedData.past_sponsorships.total_contributed || 0}`
                        : sponsorData.past_sponsorship_history || 'No verified past club record'
                    }
                  />
                  {sponsorData.sponsorship_details && (
                    <DetailRow label="Secured Benefits" value={sponsorData.sponsorship_details} />
                  )}
                </dl>
              </DetailCard>
            </div>

            {/* Unverified Web Research Preview */}
            {Object.keys(unverifiedData).length > 0 && (
              <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <ExclamationTriangleIcon className="w-5 h-5 text-amber-500" />
                    <h3 className="text-sm font-bold text-gray-900">
                      External Web Research & Inferred Insights [UNVERIFIED]
                    </h3>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                    [UNVERIFIED — Flagged, Not Presented as Fact]
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {Object.entries(unverifiedData).map(([key, item]: [string, any]) => {
                    const val = item && typeof item === 'object' && 'value' in item ? item.value : item;
                    const note = item && typeof item === 'object' && 'note' in item ? item.note : '[UNVERIFIED]';
                    if (!val || (Array.isArray(val) && val.length === 0)) return null;
                    return (
                      <div key={key} className="p-3 rounded-lg bg-white border border-gray-200">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold uppercase tracking-wider text-gray-500">
                            {key.replace(/_/g, ' ')}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-medium">
                            {note}
                          </span>
                        </div>
                        <p className="text-gray-700 break-words">
                          {Array.isArray(val) ? val.join(', ') : typeof val === 'object' ? JSON.stringify(val) : String(val)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'research' && (
          <ResearchTab
            sponsor={sponsorData}
            verifiedData={verifiedData}
            unverifiedData={unverifiedData}
            recommendedAsks={recommendedAsks}
            reasoningText={reasoningText}
            showModal={setShowResearchModal}
            setResearchType={setResearchType}
            researchMutation={researchMutation}
            prioritizeMutation={prioritizeMutation}
            researchAndPrioritizeMutation={researchAndPrioritizeMutation}
          />
        )}

        {activeTab === 'emails' && (
          <EmailsTab
            sponsorId={sponsorId}
            emails={emails}
            format={format}
            onCreateDraft={() => setShowCreateEmailModal(true)}
            onOneClickApproveAndSend={handleOneClickApproveAndSend}
            isSending={approveAndSendMutation.isPending}
          />
        )}

        {activeTab === 'replies' && (
          <RepliesAndThreadTab
            replies={replies}
            conversation={conversation}
            format={format}
            onOpenReplyModal={() => setShowReplyModal(true)}
            onOpenMeetingModal={() => {
              setMeetingTitle(`Sponsorship Call with ${companyName}`);
              setShowMeetingModal(true);
            }}
            onDraftResponse={() => {
              setEmailType('interested_response');
              setShowCreateEmailModal(true);
            }}
          />
        )}

        {activeTab === 'followups' && (
          <FollowUpsTab
            sponsorId={sponsorId}
            followUpStatus={followUpStatus}
            followUps={followUps}
            format={format}
            onScheduleFollowUp={handleScheduleFollowUp}
            isSchedulingFollowUp={scheduleFollowUpMutation.isPending}
            onOneClickApproveAndSend={handleOneClickApproveAndSend}
            isSending={approveAndSendMutation.isPending}
          />
        )}

        {activeTab === 'meetings' && (
          <MeetingsTab
            sponsorId={sponsorId}
            meetings={meetings}
            format={format}
            onScheduleMeeting={() => {
              setMeetingTitle(`Sponsorship Call with ${companyName}`);
              setShowMeetingModal(true);
            }}
          />
        )}

        {activeTab === 'notes' && (
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Organizer Notes & Institutional Memory
                </h2>
                <p className="text-sm text-gray-500">
                  Saved for future sponsorship drives so institutional knowledge is never lost.
                </p>
              </div>
              <button
                onClick={async () => {
                  await updateSponsorMutation.mutateAsync({
                    id: sponsorId,
                    data: { notes: notesText },
                  });
                  refetch();
                  alert('Notes saved!');
                }}
                disabled={updateSponsorMutation.isPending}
                className="btn-primary text-xs"
              >
                {updateSponsorMutation.isPending ? 'Saving...' : 'Save Notes'}
              </button>
            </div>

            <textarea
              rows={5}
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
              placeholder="Record key takeaways, preferences, best time to reach out, or internal organizer notes..."
              className="w-full p-4 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />

            <div className="border-t border-gray-200 pt-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold text-gray-900">
                  Institutional Memory Records
                </h3>
                <button
                  onClick={() => setShowWonModal(true)}
                  className="text-xs text-primary-600 hover:underline font-medium"
                >
                  + Record Sponsorship Outcome to Memory
                </button>
              </div>
              {((institutionalMemory as unknown as any[]) || []).filter(
                (m: any) =>
                  m.company_name?.toLowerCase() === companyName.toLowerCase()
              ).length > 0 ? (
                <div className="space-y-3">
                  {((institutionalMemory as unknown as any[]) || [])
                    .filter((m: any) => m.company_name?.toLowerCase() === companyName.toLowerCase())
                    .map((mem: any) => (
                      <div key={mem.id} className="p-4 rounded-lg bg-gray-50 border border-gray-200 text-sm">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-gray-900">{mem.company_name}</span>
                          <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-800">
                            {mem.verified ? '[VERIFIED]' : '[UNVERIFIED]'}
                          </span>
                        </div>
                        <p className="text-gray-600">
                          Past Events Sponsored: <strong>{mem.past_events_sponsored}</strong> • Total Contributed:{' '}
                          <strong>₹{Number(mem.total_contributed || 0).toLocaleString()}</strong>
                        </p>
                        {mem.outcome_notes && (
                          <p className="text-gray-500 mt-1">Outcome: {mem.outcome_notes}</p>
                        )}
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  No institutional memory entry for {companyName} yet. Mark a deal as "Sponsorship Won" to automatically archive it for future teams.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Research Modal */}
      {showResearchModal && (
        <Modal
          onClose={() => setShowResearchModal(false)}
          title={
            researchType === 'research'
              ? 'Run Company Research'
              : researchType === 'prioritize'
              ? 'Run Sponsor Prioritization'
              : 'Research & Prioritize Sponsor'
          }
        >
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Target Club Event (optional)
              </label>
              <select
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-white"
              >
                <option value="">Default Event (24-Hour Hackathon)</option>
                {eventsList.map((ev: any) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-sm text-gray-500">
              Uses Tavily / Gemini free-tier research to analyze company profile, separate{' '}
              <strong>[VERIFIED]</strong> facts from <strong>[UNVERIFIED]</strong> web findings, score priority, and recommend what to ask for (Cash, Goodies/Swag, Cloud Credits, Infrastructure).
            </p>
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <button onClick={() => setShowResearchModal(false)} className="btn-secondary">
                Cancel
              </button>
              <button
                onClick={() => handleResearchAction(researchType)}
                disabled={
                  researchMutation.isPending ||
                  prioritizeMutation.isPending ||
                  researchAndPrioritizeMutation.isPending
                }
                className="btn-primary"
              >
                {researchMutation.isPending ||
                prioritizeMutation.isPending ||
                researchAndPrioritizeMutation.isPending
                  ? 'Running AI Research...'
                  : 'Run Research & Prioritize'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Create Personalized Email Draft Modal */}
      {showCreateEmailModal && (
        <Modal onClose={() => setShowCreateEmailModal(false)} title="Generate Personalized Email Draft">
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Stage / Type</label>
              <select
                value={emailType}
                onChange={(e) => setEmailType(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-white"
              >
                <option value="initial">Initial Outreach (Personalized)</option>
                <option value="follow_up_1">Follow-up #1 (Gentle Reminder)</option>
                <option value="follow_up_2">Follow-up #2 (Final Follow-up)</option>
                <option value="interested_response">Interested Sponsor Response</option>
                <option value="meeting_request">Virtual Meeting Request</option>
                <option value="thank_you">Thank You / Confirmation</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Event Name</label>
              <input
                type="text"
                value={customEventName}
                onChange={(e) => setCustomEventName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm"
                placeholder="e.g. 24-Hour AI Hackathon"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Audience Profile</label>
              <input
                type="text"
                value={customAudience}
                onChange={(e) => setCustomAudience(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm"
                placeholder="e.g. 500+ student developers"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tailored Sponsorship Brochure / Deck Attachment
              </label>
              <select
                value={brochureTier}
                onChange={(e) => setBrochureTier(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-white"
              >
                <option value="platinum">Platinum / Title Tier Deck (₹1,50,000+ Cash)</option>
                <option value="gold">Gold Tier Brochure (Cash + API/Cloud Showcase)</option>
                <option value="silver">Silver Tier Brochure (₹25,000 + Recruiting Booth)</option>
                <option value="cloud">Infrastructure & Cloud Credits Deck</option>
                <option value="community">Swag, Goodies & Community Partner Deck</option>
                <option value="none">No Brochure Attached</option>
              </select>
            </div>

            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-gray-600">
              <strong>Human-in-the-Loop Guarantee:</strong> This generates an editable draft only. No email is ever sent without an organizer's explicit review and approval.
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
                {geminiEmailMutation.isPending ? 'Generating Personalized Draft...' : 'Generate Draft'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Log / Classify Sponsor Reply Modal */}
      {showReplyModal && (
        <Modal
          onClose={() => {
            setShowReplyModal(false);
            setLastReplyResult(null);
          }}
          title="Log & Classify Sponsor Reply"
        >
          <form onSubmit={handleProcessReply} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
              <input
                type="text"
                value={replySubject}
                onChange={(e) => setReplySubject(e.target.value)}
                placeholder={`Re: Sponsorship Opportunity - ${companyName}`}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sponsor Reply Content *
              </label>
              <textarea
                rows={4}
                required
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                placeholder="Paste the sponsor's email reply here (e.g., 'We would love to sponsor with $1,000 in cloud credits and swag. Let's schedule a call next Tuesday!')"
                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>

            {lastReplyResult && (
              <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-900">
                    Classification: {lastReplyResult.classification?.category}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-800 font-semibold">
                    Follow-ups Stopped Automatically
                  </span>
                </div>
                <p className="text-gray-700">
                  <strong>Summary:</strong> {lastReplyResult.summary}
                </p>
                {lastReplyResult.suggested_response && (
                  <p className="text-gray-600">
                    <strong>Suggested Response:</strong> {lastReplyResult.suggested_response}
                  </p>
                )}
                {lastReplyResult.classification?.category === 'Interested' && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowReplyModal(false);
                      setMeetingTitle(`Sponsorship Call with ${companyName}`);
                      setShowMeetingModal(true);
                    }}
                    className="btn-primary w-full mt-2 text-xs py-2"
                  >
                    📅 Next Step: Book Virtual Meeting Now →
                  </button>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => {
                  setShowReplyModal(false);
                  setLastReplyResult(null);
                }}
                className="btn-secondary"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={processReplyMutation.isPending}
                className="btn-primary"
              >
                {processReplyMutation.isPending ? 'Classifying Reply...' : 'Classify & Update Tracker'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Schedule Virtual Meeting Modal */}
      {showMeetingModal && (
        <Modal onClose={() => setShowMeetingModal(false)} title="Schedule Virtual Meeting">
          <form onSubmit={handleCreateMeeting} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Title</label>
              <input
                type="text"
                required
                value={meetingTitle}
                onChange={(e) => setMeetingTitle(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date & Time</label>
              <input
                type="datetime-local"
                required
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Virtual Meeting / Calendar Link
              </label>
              <input
                type="url"
                value={meetingLink}
                onChange={(e) => setMeetingLink(e.target.value)}
                placeholder="https://meet.google.com/..."
                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Agenda / Notes</label>
              <textarea
                rows={3}
                value={meetingNotes}
                onChange={(e) => setMeetingNotes(e.target.value)}
                placeholder="Discuss sponsorship deliverables, logo placement, and API workshop slot."
                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <button type="button" onClick={() => setShowMeetingModal(false)} className="btn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={createMeetingMutation.isPending} className="btn-primary">
                {createMeetingMutation.isPending ? 'Booking...' : 'Confirm Virtual Meeting'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Record Sponsorship Won / Benefits Modal */}
      {showWonModal && (
        <Modal onClose={() => setShowWonModal(false)} title="Record Sponsorship Deal & Benefits">
          <form onSubmit={handleSaveWon} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cash Sponsorship Secured (₹ INR)
              </label>
              <input
                type="number"
                value={wonAmount}
                onChange={(e) => setWonAmount(e.target.value)}
                placeholder="e.g. 50000"
                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Benefits / In-Kind Support Secured (Swag, Cloud Credits, Prizes)
              </label>
              <textarea
                rows={3}
                value={wonBenefits}
                onChange={(e) => setWonBenefits(e.target.value)}
                placeholder="e.g. ₹50,000 cash + 200 T-shirts & stickers + $5,000 AWS/Cloud credits for participants"
                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <p className="text-xs text-gray-500">
              Saving this marks the sponsor as <strong>Sponsorship Won</strong>, updates the dashboard money/benefits counter, and saves the outcome to <strong>Institutional Memory</strong> for future teams.
            </p>
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <button type="button" onClick={() => setShowWonModal(false)} className="btn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={updateSponsorMutation.isPending} className="btn-primary">
                {updateSponsorMutation.isPending ? 'Saving...' : 'Save Deal & Archive to Memory'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// Helper Components
function InfoCard({
  icon: Icon,
  label,
  value,
  iconColor,
}: {
  icon: React.ComponentType<any>;
  label: string;
  value: React.ReactNode;
  iconColor: string;
}) {
  const iconColors: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    purple: 'bg-purple-100 text-purple-600',
    orange: 'bg-orange-100 text-orange-600',
    gray: 'bg-gray-100 text-gray-600',
  };

  return (
    <div className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
      <div className={`p-2 rounded-lg ${iconColors[iconColor] || iconColors.gray} mb-2 inline-block`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-xs text-gray-500 font-medium">{label}</p>
      <div className="font-medium text-gray-900 truncate mt-0.5">{value}</div>
    </div>
  );
}

function DetailCard({
  title,
  icon: Icon,
  iconColor,
  children,
}: {
  title: string;
  icon: React.ComponentType<any>;
  iconColor: string;
  children: React.ReactNode;
}) {
  const iconColors: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    purple: 'bg-purple-100 text-purple-600',
    orange: 'bg-orange-100 text-orange-600',
    yellow: 'bg-yellow-100 text-yellow-600',
    gray: 'bg-gray-100 text-gray-600',
  };

  return (
    <div className="p-4 bg-gray-50 rounded-lg">
      <div className="flex items-center gap-2 mb-3">
        <div className={`p-2 rounded-lg ${iconColors[iconColor] || iconColors.gray}`}>
          <Icon className="w-5 h-5" />
        </div>
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      </div>
      <div>{children}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-900 mt-0.5">{value}</dd>
    </div>
  );
}

function Modal({
  onClose,
  title,
  children,
}: {
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 animate-fade-in">
      <div className="bg-white rounded-xl w-full max-w-lg animate-scale-in max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ResearchTab({
  sponsor,
  verifiedData,
  unverifiedData,
  recommendedAsks,
  reasoningText,
  showModal,
  setResearchType,
  researchMutation,
  prioritizeMutation,
  researchAndPrioritizeMutation,
}: any) {
  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Company Research, Prioritization & Recommended Ask
          </h2>
          <p className="text-xs text-gray-500">
            Strictly separates verified club records from unverified web research so nothing is fabricated.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              setResearchType('research');
              showModal(true);
            }}
            disabled={researchMutation.isPending}
            className="btn-secondary text-xs"
          >
            <MagnifyingGlassIcon className="w-4 h-4 mr-1.5" />
            Research Only
          </button>
          <button
            onClick={() => {
              setResearchType('prioritize');
              showModal(true);
            }}
            disabled={prioritizeMutation.isPending}
            className="btn-secondary text-xs"
          >
            <ArrowTrendingUpIcon className="w-4 h-4 mr-1.5" />
            Prioritize Only
          </button>
          <button
            onClick={() => {
              setResearchType('both');
              showModal(true);
            }}
            disabled={researchAndPrioritizeMutation.isPending}
            className="btn-primary text-xs"
          >
            <ArrowPathIcon className="w-4 h-4 mr-1.5" />
            Research & Prioritize
          </button>
        </div>
      </div>

      {/* Priority & Ask Reasoning */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <DetailCard title="Recommended Sponsorship Ask" icon={SparklesIcon} iconColor="purple">
          {recommendedAsks.length > 0 ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {recommendedAsks.map((type: string, idx: number) => (
                  <span
                    key={idx}
                    className="px-3 py-1 rounded-full text-xs font-semibold bg-primary-100 text-primary-700"
                  >
                    {type}
                  </span>
                ))}
              </div>
              <p className="text-xs text-gray-500">
                Tailored ask based on company tier ({sponsor.category || 'General'}) and past developer event support.
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              Click "Research & Prioritize" to get recommended sponsorship asks (Cash, Goodies/Swag, Cloud Credits, Infrastructure).
            </p>
          )}
        </DetailCard>

        <DetailCard title="Prioritization & Ask Reasoning" icon={ArrowTrendingUpIcon} iconColor="yellow">
          {reasoningText ? (
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{reasoningText}</p>
          ) : (
            <p className="text-sm text-gray-500">
              No priority reasoning generated yet. Run prioritization to see transparent scoring breakdown.
            </p>
          )}
        </DetailCard>
      </div>

      {/* Verified vs Unverified Data */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-4 rounded-xl border border-green-500/30 bg-green-500/5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
              <CheckBadgeIcon className="w-5 h-5 text-green-500" />
              Verified Facts [VERIFIED]
            </h3>
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-800">
              Club Database & Institutional Memory
            </span>
          </div>
          {Object.keys(verifiedData).length > 0 ? (
            <dl className="space-y-2 text-xs">
              {Object.entries(verifiedData).map(([k, v]: [string, any]) => (
                <div key={k} className="flex justify-between py-1.5 border-b border-gray-200/50">
                  <dt className="text-gray-500 font-medium capitalize">{k.replace(/_/g, ' ')}</dt>
                  <dd className="text-gray-900 font-semibold text-right max-w-xs truncate">
                    {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-xs text-gray-500">
              Basic company record verified. Run research to cross-check Institutional Memory.
            </p>
          )}
        </div>

        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
              <ExclamationTriangleIcon className="w-5 h-5 text-amber-500" />
              Web Research & Inferred Data [UNVERIFIED]
            </h3>
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800">
              Flagged — Requires Organizer Verification
            </span>
          </div>
          {Object.keys(unverifiedData).length > 0 ? (
            <div className="space-y-2.5 text-xs">
              {Object.entries(unverifiedData).map(([k, item]: [string, any]) => {
                const val = item && typeof item === 'object' && 'value' in item ? item.value : item;
                const note = item && typeof item === 'object' && 'note' in item ? item.note : '[UNVERIFIED]';
                if (!val || (Array.isArray(val) && val.length === 0)) return null;
                return (
                  <div key={k} className="p-2.5 rounded bg-white border border-gray-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold capitalize text-gray-700">{k.replace(/_/g, ' ')}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">
                        {note}
                      </span>
                    </div>
                    <p className="text-gray-600">
                      {Array.isArray(val) ? val.join(', ') : typeof val === 'object' ? JSON.stringify(val) : String(val)}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-gray-500">
              No unverified web findings yet. Click "Research & Prioritize" to gather external intelligence.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function EmailsTab({
  emails,
  format,
  onCreateDraft,
  onOneClickApproveAndSend,
  isSending,
}: any) {
  const emailList = (emails as unknown as any[]) || [];

  return (
    <div className="p-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Personalized Outreach Emails (Human-in-the-Loop)
          </h2>
          <p className="text-xs text-gray-500">
            Every outgoing email requires organizer review. Edit any draft or click "Approve & Send" for 1-click automation.
          </p>
        </div>
        <button onClick={onCreateDraft} className="btn-primary text-xs">
          <PlusIcon className="w-4 h-4 mr-1.5" />
          Generate Personalized Draft
        </button>
      </div>

      {emailList.length > 0 ? (
        <div className="space-y-3">
          {emailList.map((email: any) => {
            const canApproveAndSend =
              email.status === 'Draft' ||
              email.status === 'Pending Approval' ||
              email.status === 'Approved';

            return (
              <div
                key={email.id}
                className="p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span
                      className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                        email.status === 'Draft'
                          ? 'bg-gray-100 text-gray-700'
                          : email.status === 'Pending Approval'
                          ? 'bg-yellow-100 text-yellow-800'
                          : email.status === 'Approved'
                          ? 'bg-green-100 text-green-800'
                          : email.status === 'Sent'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {email.status}
                    </span>
                    <Link
                      to={`/emails/${email.id}`}
                      className="font-semibold text-gray-900 hover:text-primary-600"
                    >
                      {email.subject}
                    </Link>
                    <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 text-xs">
                      {email.email_type}
                    </span>
                    {email.body?.includes('[Attached:') && (
                      <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 text-xs flex items-center gap-1">
                        <DocumentTextIcon className="w-3.5 h-3.5" />
                        Brochure Attached
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Link to={`/emails/${email.id}`} className="btn-secondary text-xs py-1.5 px-3">
                      Review / Edit
                    </Link>
                    {canApproveAndSend && (
                      <button
                        onClick={() => onOneClickApproveAndSend(email.id)}
                        disabled={isSending}
                        className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1"
                      >
                        <PaperAirplaneIcon className="w-3.5 h-3.5" />
                        1-Click Approve & Send
                      </button>
                    )}
                  </div>
                </div>
                <p className="mt-2 text-sm text-gray-600 line-clamp-2">
                  {email.body_preview || email.body?.slice(0, 220)}
                </p>
                <div className="mt-2 text-xs text-gray-400">
                  {email.sent_at
                    ? `Sent on ${format(new Date(email.sent_at), 'MMM d, yyyy HH:mm')}`
                    : email.created_at
                    ? `Drafted on ${format(new Date(email.created_at), 'MMM d, yyyy HH:mm')}`
                    : ''}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          <EnvelopeOpenIcon className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-base font-medium">No outreach emails drafted yet</p>
          <p className="text-xs mt-1 mb-4">
            Generate a personalized email tailored to this company's profile and recommended tier.
          </p>
          <button onClick={onCreateDraft} className="btn-primary text-xs">
            Draft Personalized Email
          </button>
        </div>
      )}
    </div>
  );
}

function RepliesAndThreadTab({
  replies,
  conversation,
  format,
  onOpenReplyModal,
  onOpenMeetingModal,
  onDraftResponse,
}: any) {
  const replyList = (replies as unknown as any[]) || [];
  const threadList = (conversation as unknown as any)?.conversation || [];

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Reply Classification & Full Conversation History
          </h2>
          <p className="text-xs text-gray-500">
            Classifies replies as Interested, No Reply, or Declined. Interested sponsors automatically advance to virtual meeting booking.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onOpenReplyModal} className="btn-primary text-xs">
            <ChatBubbleLeftRightIcon className="w-4 h-4 mr-1.5" />
            Log / Classify Sponsor Reply
          </button>
        </div>
      </div>

      {/* Classified Replies */}
      {replyList.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">Classified Sponsor Replies</h3>
          {replyList.map((reply: any) => (
            <div key={reply.id} className="p-4 border border-gray-200 rounded-xl bg-gray-50 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                      reply.classification === 'Interested'
                        ? 'bg-green-100 text-green-800'
                        : reply.classification === 'Declined'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {reply.classification}
                  </span>
                  <span className="font-semibold text-sm text-gray-900">{reply.subject}</span>
                </div>
                <span className="text-xs text-gray-500">
                  {reply.received_at ? format(new Date(reply.received_at), 'MMM d, yyyy HH:mm') : ''}
                </span>
              </div>

              <p className="text-sm text-gray-700 whitespace-pre-wrap">{reply.body}</p>

              {reply.summary && (
                <div className="p-2.5 rounded-lg bg-white border border-gray-200 text-xs text-gray-600">
                  <strong>AI Summary:</strong> {reply.summary}
                </div>
              )}

              {reply.suggested_response && (
                <div className="p-2.5 rounded-lg bg-white border border-gray-200 text-xs text-gray-600">
                  <strong>Suggested Response:</strong> {reply.suggested_response}
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                {reply.classification === 'Interested' && (
                  <button onClick={onOpenMeetingModal} className="btn-primary text-xs py-1.5 px-3">
                    📅 Book Virtual Meeting
                  </button>
                )}
                <button onClick={onDraftResponse} className="btn-secondary text-xs py-1.5 px-3">
                  ✉️ Draft Response Email
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Chronological Conversation Thread */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Complete Email & Reply Timeline ({threadList.length} messages)
        </h3>
        {threadList.length > 0 ? (
          <div className="space-y-3">
            {threadList.map((item: any, idx: number) => (
              <div
                key={idx}
                className={`p-4 rounded-xl border ${
                  item.direction === 'inbound'
                    ? 'border-green-500/30 bg-green-500/5 ml-4'
                    : 'border-gray-200 bg-white mr-4'
                }`}
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-bold uppercase tracking-wider text-gray-500">
                    {item.direction === 'inbound'
                      ? `⬅️ Sponsor Reply (${item.classification || 'Classified'})`
                      : `➡️ Outgoing (${item.email_type || 'Email'} — ${item.status})`}
                  </span>
                  <span className="text-gray-400">
                    {item.timestamp ? format(new Date(item.timestamp), 'MMM d, yyyy HH:mm') : ''}
                  </span>
                </div>
                <p className="font-semibold text-sm text-gray-900">{item.subject}</p>
                <p className="text-xs text-gray-600 mt-1 whitespace-pre-wrap">{item.body}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <ChatBubbleLeftRightIcon className="w-10 h-10 mx-auto text-gray-300 mb-2" />
            <p className="text-sm">No conversation messages yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function FollowUpsTab({
  followUpStatus,
  followUps,
  format,
  onScheduleFollowUp,
  isSchedulingFollowUp,
  onOneClickApproveAndSend,
  isSending,
}: any) {
  const followUpsSent = followUpStatus?.follow_ups_sent ?? followUpStatus?.follow_up_count ?? 0;
  const isMaxReached = followUpsSent >= 2 || followUpStatus?.can_follow_up === false;
  const followUpList = (followUps as unknown as any[]) || [];

  return (
    <div className="p-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Automated Follow-up Sequence (Fixed Limit: Max 2 Follow-ups, Then Stop)
          </h2>
          <p className="text-xs text-gray-500">
            Prevents spamming sponsors. Follow-ups automatically stop after 2 attempts or as soon as a sponsor replies.
          </p>
        </div>
        <button
          onClick={onScheduleFollowUp}
          disabled={isSchedulingFollowUp || followUpsSent >= 2}
          className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-50"
        >
          <SparklesIcon className="w-4 h-4" />
          {isSchedulingFollowUp
            ? 'Scheduling...'
            : followUpsSent >= 2
            ? 'Max Follow-ups (2/2) Reached — Stopped'
            : '✨ Schedule Next Follow-up Draft'}
        </button>
      </div>

      <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <StatCard
            label="Emails Sent"
            value={followUpStatus?.emails_sent || 0}
            icon={EnvelopeOpenIcon}
            color="blue"
          />
          <StatCard
            label="Replies Received"
            value={followUpStatus?.replies_received || 0}
            icon={ArrowPathIcon}
            color="green"
          />
          <StatCard
            label="Follow-ups Used (Max 2)"
            value={`${followUpsSent}/2`}
            icon={ClockIcon}
            color="purple"
          />
        </div>
        {followUpStatus?.stop_reason && (
          <p className="mt-3 text-xs text-amber-500 font-medium">
            ℹ️ Sequence Status: {followUpStatus.stop_reason}
          </p>
        )}
      </div>

      <div className="space-y-3">
        {followUpList.length > 0 ? (
          followUpList.map((fu: any) => {
            const targetEmailId = fu.email_id || fu.id;
            const canSend =
              fu.status === 'Draft' ||
              fu.status === 'Pending' ||
              fu.status === 'Pending Approval' ||
              fu.status === 'Scheduled';

            return (
              <div
                key={fu.id}
                className="p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900">
                        Follow-up #{fu.sequence_number || 1}
                      </p>
                      <span
                        className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                          fu.status === 'Sent'
                            ? 'bg-blue-100 text-blue-800'
                            : fu.status === 'Cancelled'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {fu.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Scheduled Due:{' '}
                      {fu.scheduled_date || fu.scheduled_at
                        ? format(new Date(fu.scheduled_date || fu.scheduled_at), 'MMM d, yyyy HH:mm')
                        : 'Pending'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {targetEmailId && (
                      <Link
                        to={`/emails/${targetEmailId}`}
                        className="btn-secondary text-xs py-1.5 px-3"
                      >
                        Review / Edit Draft
                      </Link>
                    )}
                    {canSend && targetEmailId && (
                      <button
                        onClick={() => onOneClickApproveAndSend(targetEmailId)}
                        disabled={isSending}
                        className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1"
                      >
                        <PaperAirplaneIcon className="w-3.5 h-3.5" />
                        Approve & Send Follow-up
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-8 text-gray-500">
            <ClockIcon className="w-10 h-10 mx-auto text-gray-300 mb-2" />
            <p className="font-medium">No follow-ups scheduled yet</p>
            <p className="text-xs mt-1">
              When an initial email is sent, the system schedules up to 2 follow-ups automatically.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<any>;
  color: string;
}) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    purple: 'bg-purple-100 text-purple-600',
  };

  return (
    <div className="p-3 bg-white rounded-lg border border-gray-200">
      <div className="flex items-center gap-2 mb-1">
        <div className={`p-1.5 rounded ${colors[color] || colors.blue}`}>
          <Icon className="w-4 h-4" />
        </div>
        <p className="text-xs text-gray-500 font-medium">{label}</p>
      </div>
      <p className="font-bold text-xl text-gray-900">{value}</p>
    </div>
  );
}

function MeetingsTab({ meetings, format, onScheduleMeeting }: any) {
  const meetingList = (meetings as unknown as any[]) || [];

  return (
    <div className="p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Virtual Meetings & Calls</h2>
          <p className="text-xs text-gray-500">
            Move interested sponsors to a virtual meeting with calendar links and call notes.
          </p>
        </div>
        <button onClick={onScheduleMeeting} className="btn-primary text-xs">
          <PlusIcon className="w-4 h-4 mr-1.5" />
          Schedule Virtual Meeting
        </button>
      </div>

      {meetingList.length > 0 ? (
        <div className="space-y-3">
          {meetingList.map((meeting: any) => (
            <Link key={meeting.id} to={`/meetings/${meeting.id}`} className="block">
              <div className="p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{meeting.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {meeting.scheduled_at
                        ? format(new Date(meeting.scheduled_at), 'MMM d, yyyy HH:mm')
                        : 'Not scheduled'}{' '}
                      • {meeting.location || 'Virtual'}
                    </p>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                      meeting.status === 'Meeting Scheduled'
                        ? 'bg-blue-100 text-blue-800'
                        : meeting.status === 'Meeting Completed'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {meeting.status}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          <CalendarDaysIcon className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-base font-medium">No virtual meetings booked yet</p>
          <p className="text-xs mt-1 mb-4">
            Book a virtual call once the sponsor replies with interest.
          </p>
          <button onClick={onScheduleMeeting} className="btn-primary text-xs">
            Schedule Virtual Meeting
          </button>
        </div>
      )}
    </div>
  );
}