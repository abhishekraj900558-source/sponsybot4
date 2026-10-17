import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useSponsors,
  useApproveAndSendEmail,
  useQuotaStatus,
  useCheckAndScheduleFollowUps,
} from '../hooks/useApi';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  EnvelopeOpenIcon,
  SparklesIcon,
  PaperAirplaneIcon,
  DocumentTextIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns/format';

const statusColors: Record<string, string> = {
  Draft: 'bg-gray-100 text-gray-700',
  DRAFT: 'bg-gray-100 text-gray-700',
  'Pending Approval': 'bg-yellow-100 text-yellow-800',
  Approved: 'bg-green-100 text-green-800',
  Sent: 'bg-blue-100 text-blue-800',
  Failed: 'bg-red-100 text-red-800',
  Rejected: 'bg-red-100 text-red-800',
};

const tabs = ['All', 'Drafts', 'Pending Approval', 'Approved', 'Sent', 'Failed'];

export function Emails() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [activeTab, setActiveTab] = useState('All');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [newEmail, setNewEmail] = useState({
    sponsor_id: '',
    email_type: 'initial',
    brochure_tier: 'gold',
    event_id: '',
    sender_id: 1,
    subject: '',
    body: '',
  });

  const { data: sponsorsData } = useSponsors({ page_size: 100 });
  const sponsorsList: any[] = Array.isArray(sponsorsData)
    ? sponsorsData
    : (sponsorsData as any)?.sponsors || [];

  const { data: quotaData } = useQuotaStatus();
  const quota = (quotaData as unknown as any)?.email_daily_quota;

  const { data: realEmails, refetch: refetchEmails } = useQuery({
    queryKey: ['emails'],
    queryFn: () => api.get('/emails'),
  });

  const approveAndSendMutation = useApproveAndSendEmail();
  const checkFollowUpsMutation = useCheckAndScheduleFollowUps();

  const emailsList: any[] = Array.isArray(realEmails) ? realEmails : [];

  const filteredEmails = emailsList.filter((email) => {
    const sponsorName = email.sponsor_name || email.sponsor?.name || '';
    const matchesSearch =
      sponsorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (email.subject || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'All' || email.status === statusFilter;
    const matchesTab =
      activeTab === 'All' ||
      email.status === activeTab ||
      (activeTab === 'Drafts' && (email.status === 'Draft' || email.status === 'DRAFT')) ||
      (activeTab === 'Pending Approval' && email.status === 'Pending Approval') ||
      (activeTab === 'Approved' && email.status === 'Approved') ||
      (activeTab === 'Sent' && email.status === 'Sent') ||
      (activeTab === 'Failed' && (email.status === 'Failed' || email.status === 'Rejected'));
    return matchesSearch && matchesStatus && matchesTab;
  });

  const handleGenerateAi = async () => {
    if (!newEmail.sponsor_id) {
      alert('Please select a sponsor from the dropdown first.');
      return;
    }
    try {
      setIsGeneratingAi(true);
      const res: any = await api.post('/email-draft', {
        companyId: Number(newEmail.sponsor_id),
        eventName: '24-Hour AI/ML Hackathon',
        audience: '500+ college student developers',
        emailType: newEmail.email_type,
        brochureTier: newEmail.brochure_tier,
        saveDraft: false,
      });
      const draft = res?.data || res;
      setNewEmail((prev) => ({
        ...prev,
        subject: draft.subject || '',
        body: draft.body || '',
      }));
    } catch (err: any) {
      alert(err.response?.data?.error || err.message || 'Failed to generate draft with AI');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.sponsor_id) {
      alert('Please select a sponsor.');
      return;
    }
    if (!newEmail.subject.trim() || !newEmail.body.trim()) {
      alert('Please fill in both subject and body, or click Auto-Generate with AI.');
      return;
    }
    try {
      await api.post('/emails', {
        sponsor_id: Number(newEmail.sponsor_id),
        email_type: newEmail.email_type,
        event_id: newEmail.event_id ? Number(newEmail.event_id) : undefined,
        sender_id: newEmail.sender_id,
        subject: newEmail.subject.trim(),
        body: newEmail.body.trim(),
      });
      queryClient.invalidateQueries({ queryKey: ['emails'] });
      setShowCreateModal(false);
      setNewEmail({
        sponsor_id: '',
        email_type: 'initial',
        brochure_tier: 'gold',
        event_id: '',
        sender_id: 1,
        subject: '',
        body: '',
      });
      refetchEmails();
    } catch (err: any) {
      alert(err.response?.data?.detail || err.response?.data?.error || 'Failed to create email draft');
    }
  };

  const handleOneClickApproveAndSend = async (emailId: number) => {
    try {
      const res: any = await approveAndSendMutation.mutateAsync({
        id: emailId,
        approverId: 1,
      });
      queryClient.invalidateQueries({ queryKey: ['emails'] });
      refetchEmails();
      alert(
        `Email Approved & Sent!\nDaily Quota: ${res?.daily_quota?.sent_today ?? '?'}/${res?.daily_quota?.daily_limit ?? 40} outgoing emails today.`
      );
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to approve and send email');
    }
  };

  const handleAutoCheckFollowUps = async () => {
    try {
      const res: any = await checkFollowUpsMutation.mutateAsync();
      queryClient.invalidateQueries({ queryKey: ['emails'] });
      refetchEmails();
      alert(
        `Follow-up Check Complete!\nScheduled ${res?.scheduled_count ?? 0} follow-up drafts (Max 2 per sponsor enforced).`
      );
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to check follow-ups');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Human-in-the-Loop Outreach & Approval Queue
          </h1>
          <p className="text-gray-600 mt-1 text-sm">
            No email is sent without organizer approval • Edit any draft or approve & send in 1 click
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {quota && (
            <div className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-xs font-medium text-gray-700 flex items-center gap-2">
              <span>Daily Outgoing Quota:</span>
              <span className="font-bold text-primary-600">
                {quota.sent_today}/{quota.daily_limit}
              </span>
              <span className="text-gray-400">({quota.target_range})</span>
            </div>
          )}
          <button
            onClick={handleAutoCheckFollowUps}
            disabled={checkFollowUpsMutation.isPending}
            className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5"
          >
            <ClockIcon className="w-4 h-4" />
            {checkFollowUpsMutation.isPending ? 'Checking...' : 'Check Due Follow-ups (Max 2)'}
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary text-xs py-2 px-3.5 flex items-center gap-1.5"
          >
            <PlusIcon className="w-4 h-4" />
            Draft Personalized Email
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6 overflow-x-auto">
        <nav className="flex gap-8 min-w-max" aria-label="Email tabs">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setStatusFilter(tab === 'Drafts' ? 'Draft' : tab);
              }}
              className={`py-3.5 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search emails by company or subject..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-white"
          >
            {['All', 'Draft', 'Pending Approval', 'Approved', 'Sent', 'Failed', 'Rejected'].map(
              (opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              )
            )}
          </select>
          <button
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('All');
              setActiveTab('All');
            }}
            className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-1.5"
          >
            <ArrowPathIcon className="w-4 h-4" /> Reset
          </button>
        </div>
      </div>

      {/* Emails Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Sponsor
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Subject & Attachment
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Stage
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Approval Status
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Timestamp
                </th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Organizer Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredEmails.map((email) => {
                const canApproveAndSend =
                  email.status === 'Draft' ||
                  email.status === 'Pending Approval' ||
                  email.status === 'Approved';

                return (
                  <tr key={email.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <Link
                        to={`/sponsors/${email.sponsor_id}`}
                        className="font-semibold text-gray-900 hover:text-primary-600"
                      >
                        {email.sponsor_name || email.sponsor?.name || `Sponsor #${email.sponsor_id}`}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        to={`/emails/${email.id}`}
                        className="font-medium text-gray-900 hover:text-primary-600 block"
                      >
                        {email.subject}
                      </Link>
                      {email.body?.includes('[Attached:') && (
                        <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded bg-purple-100 text-purple-800 text-[11px] font-medium">
                          <DocumentTextIcon className="w-3 h-3" />
                          Tier Brochure Attached
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                        {(email.email_type || 'initial').replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                          statusColors[email.status] || 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {email.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500">
                      {email.sent_at
                        ? `Sent ${format(new Date(email.sent_at), 'MMM d, HH:mm')}`
                        : email.created_at
                        ? format(new Date(email.created_at), 'MMM d, HH:mm')
                        : ''}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/emails/${email.id}`}
                          className="btn-secondary text-xs py-1.5 px-3"
                        >
                          Review / Edit
                        </Link>
                        {canApproveAndSend && (
                          <button
                            onClick={() => handleOneClickApproveAndSend(email.id)}
                            disabled={approveAndSendMutation.isPending}
                            className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1"
                          >
                            <PaperAirplaneIcon className="w-3.5 h-3.5" />
                            Approve & Send
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredEmails.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <EnvelopeOpenIcon className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p className="text-lg font-medium">No emails in this view</p>
            <p className="text-sm mt-1">
              Click "Draft Personalized Email" to generate a company-specific outreach draft.
            </p>
          </div>
        )}
      </div>

      {/* Create Email Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                Draft Company-Specific Personalized Email
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sponsor *</label>
                  <select
                    value={newEmail.sponsor_id}
                    onChange={(e) => setNewEmail({ ...newEmail, sponsor_id: e.target.value })}
                    required
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-white"
                  >
                    <option value="">Select company</option>
                    {sponsorsList.map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.company_name || s.name} ({s.category || 'Sponsor'})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Outreach Stage *
                  </label>
                  <select
                    value={newEmail.email_type}
                    onChange={(e) => setNewEmail({ ...newEmail, email_type: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-white"
                  >
                    <option value="initial">Initial Outreach</option>
                    <option value="follow_up_1">Follow-up #1</option>
                    <option value="follow_up_2">Follow-up #2 (Final)</option>
                    <option value="meeting_request">Virtual Meeting Request</option>
                    <option value="thank_you">Thank You</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tailored Sponsorship Brochure / Deck Attachment
                </label>
                <select
                  value={newEmail.brochure_tier}
                  onChange={(e) => setNewEmail({ ...newEmail, brochure_tier: e.target.value })}
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

              <div className="bg-primary-50 border border-primary-200 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-primary-900">
                    Generate Company-Specific Draft with Gemini AI
                  </p>
                  <p className="text-xs text-primary-700">
                    Uses company research & recommended ask (Cash, Swag, Cloud Credits)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateAi}
                  disabled={isGeneratingAi || !newEmail.sponsor_id}
                  className="btn-primary text-xs py-1.5 px-3 whitespace-nowrap flex items-center gap-1.5 disabled:opacity-50"
                >
                  <SparklesIcon className="w-4 h-4" />
                  {isGeneratingAi ? 'Generating...' : 'Auto-Generate with AI'}
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject *</label>
                <input
                  type="text"
                  value={newEmail.subject}
                  onChange={(e) => setNewEmail({ ...newEmail, subject: e.target.value })}
                  required
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Body (Organizer Can Edit Before Saving) *
                </label>
                <textarea
                  value={newEmail.body}
                  onChange={(e) => setNewEmail({ ...newEmail, body: e.target.value })}
                  required
                  rows={7}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Draft for Approval
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Emails;