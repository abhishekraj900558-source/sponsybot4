import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSponsors } from '../hooks/useApi';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { PlusIcon, MagnifyingGlassIcon, ArrowPathIcon, EnvelopeOpenIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns/format';

const statusColors = {
  Draft: 'bg-gray-100 text-gray-700',
  DRAFT: 'bg-gray-100 text-gray-700',
  'Pending Approval': 'bg-yellow-100 text-yellow-800',
  Approved: 'bg-green-100 text-green-800',
  Sent: 'bg-blue-100 text-blue-800',
  Failed: 'bg-red-100 text-red-800',
  Rejected: 'bg-red-100 text-red-800',
};

const tabs = ['All', 'Drafts', 'Pending Approval', 'Sent', 'Failed'];

export function Emails() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [activeTab, setActiveTab] = useState('Drafts');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [newEmail, setNewEmail] = useState({
    sponsor_id: '',
    email_type: 'initial',
    event_id: '',
    sender_id: 1,
    subject: '',
    body: '',
  });

  const { data: sponsorsData } = useSponsors({ page_size: 100 });
  const sponsorsList: any[] = Array.isArray(sponsorsData)
    ? sponsorsData
    : ((sponsorsData as any)?.sponsors || []);

  const { data: realEmails, isLoading: emailsLoading, refetch: refetchEmails } = useQuery({
    queryKey: ['emails'],
    queryFn: () => api.get('/emails'),
  });

  const emailsList: any[] = Array.isArray(realEmails) ? realEmails : [];

  const filteredEmails = emailsList.filter((email) => {
    const matchesSearch = (email.sponsor_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (email.subject || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'All' || email.status === statusFilter;
    const matchesTab = activeTab === 'All' || email.status === activeTab || 
      (activeTab === 'Drafts' && (email.status === 'Draft' || email.status === 'DRAFT')) ||
      (activeTab === 'Pending Approval' && email.status === 'Pending Approval') ||
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
        eventName: 'AI/ML Hackathon',
        audience: 'College students',
        emailType: newEmail.email_type,
      });
      const draft = res?.data || res;
      setNewEmail(prev => ({
        ...prev,
        subject: draft.subject || '',
        body: draft.body || '',
      }));
      queryClient.invalidateQueries({ queryKey: ['emails'] });
      alert('AI draft generated! Review or modify the content, then click Create Draft.');
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
      setNewEmail({ sponsor_id: '', email_type: 'initial', event_id: '', sender_id: 1, subject: '', body: '' });
      refetchEmails();
      alert('Email draft created successfully!');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create email draft');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Emails</h1>
          <p className="text-gray-600 mt-1">Manage email drafts, approvals, and sent emails</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn-primary">
          <PlusIcon className="w-5 h-5 mr-2" />
          Create Draft
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-8" aria-label="Email tabs">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setStatusFilter(tab); }}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
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
              placeholder="Search emails..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            {['All', 'Draft', 'Pending Approval', 'Approved', 'Sent', 'Failed', 'Rejected'].map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          <button
            onClick={() => { setSearchQuery(''); setStatusFilter('All'); }}
            className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
          >
            <ArrowPathIcon className="w-5 h-5" /> Reset
          </button>
        </div>
      </div>

      {/* Emails Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Sponsor</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Subject</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Created</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredEmails.map((email) => (
                <tr key={email.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{email.sponsor_name}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{email.subject}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                      {email.email_type.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[email.status as keyof typeof statusColors] || 'bg-gray-100 text-gray-700'}`}>
                      {email.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-gray-600">{email.created_at ? format(new Date(email.created_at), 'MMM d, yyyy HH:mm') : ''}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center gap-2">
                      <Link to={`/emails/${email.id}`} className="text-primary-600 hover:underline text-sm">
                        View
                      </Link>
                      {email.status === 'Draft' && (
                        <Link to={`/emails/${email.id}/edit`} className="text-primary-600 hover:underline text-sm">
                          Edit
                        </Link>
                      )}
                      {email.status === 'Pending Approval' && (
                        <span className="text-primary-600 text-sm">Pending</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredEmails.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <EnvelopeOpenIcon className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p className="text-lg font-medium">No emails found</p>
            <p className="text-sm mt-1">Try adjusting your filters or create a new draft</p>
          </div>
        )}
      </div>

      {/* Create Email Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Create Email Draft</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sponsor *</label>
                  <select
                    value={newEmail.sponsor_id}
                    onChange={(e) => setNewEmail({...newEmail, sponsor_id: e.target.value})}
                    required
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="">Select sponsor</option>
                    {sponsorsList.map((s: any) => (
                      <option key={s.id} value={s.id}>{s.company_name || s.name || `Sponsor ${s.id}`}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Type *</label>
                  <select
                    value={newEmail.email_type}
                    onChange={(e) => setNewEmail({...newEmail, email_type: e.target.value})}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="initial">Initial Outreach</option>
                    <option value="follow_up_1">Follow-up 1</option>
                    <option value="follow_up_2">Follow-up 2</option>
                    <option value="meeting_request">Meeting Request</option>
                    <option value="thank_you">Thank You</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Event ID</label>
                  <input
                    type="number"
                    value={newEmail.event_id}
                    onChange={(e) => setNewEmail({...newEmail, event_id: e.target.value})}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sender ID</label>
                  <input
                    type="number"
                    value={newEmail.sender_id}
                    onChange={(e) => setNewEmail({...newEmail, sender_id: parseInt(e.target.value) || 1})}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="bg-primary-50 border border-primary-200 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-primary-900">Want Gemini AI to write the draft?</p>
                  <p className="text-xs text-primary-700">Select a sponsor above and click to generate personalized outreach</p>
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
                  onChange={(e) => setNewEmail({...newEmail, subject: e.target.value})}
                  required
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Body *</label>
                <textarea
                  value={newEmail.body}
                  onChange={(e) => setNewEmail({...newEmail, body: e.target.value})}
                  required
                  rows={6}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Create Draft
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