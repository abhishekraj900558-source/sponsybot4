import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  useSponsors,
  useCreateSponsor,
  useDuplicateCheck,
  useBatchResearch,
  useImportSponsorsCsv,
  useTeamMembers,
} from '../hooks/useApi';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  BuildingOfficeIcon,
  XMarkIcon,
  SparklesIcon,
  ArrowUpTrayIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';

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
};

const statusOptions = [
  'All',
  'Not Contacted',
  'Contacted',
  'Follow-up',
  'Interested',
  'Meeting Scheduled',
  'Sponsorship Won',
  'Declined',
  'Closed',
];

const SAMPLE_CSV = `Company Name,Category,Industry,Website,Contact Person,Contact Email,Contact Role
Vercel,Developer Tools,Cloud & Frontend,https://vercel.com,Lee Robinson,devrel@vercel.com,VP of Developer Experience
Supabase,Cloud & Infrastructure,Database & Backend,https://supabase.com,Paul Copplestone,partnerships@supabase.com,CEO & Co-Founder
Postman,Developer Tools,API Platform,https://postman.com,Abhinav Asthana,community@postman.com,Student Community Lead
Razorpay,Fintech,Payments & Banking,https://razorpay.com,Harshil Mathur,sponsorships@razorpay.com,Developer Relations
Cloudflare,Cloud & Infrastructure,Edge & Security,https://cloudflare.com,Craig Dennis,developers@cloudflare.com,Developer Educator
Polygon Labs,Web3 & Blockchain,Blockchain Infrastructure,https://polygon.technology,Sandeep Nailwal,hackathons@polygon.technology,Ecosystem Growth`;

export function Sponsors() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'All');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [csvText, setCsvText] = useState('');

  const [newSponsor, setNewSponsor] = useState({
    company_name: '',
    company_category: 'Technology',
    industry: '',
    website: '',
    contact_person: '',
    contact_email: '',
    contact_role: '',
    status: 'Not Contacted',
    priority: 0,
    assignee_id: 1,
  });

  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set('search', searchQuery.trim());
    if (statusFilter !== 'All') params.set('status', statusFilter);
    setSearchParams(params, { replace: true });
  }, [searchQuery, statusFilter, setSearchParams]);

  const { data: sponsorsData, isLoading, refetch } = useSponsors({
    search: searchQuery.trim() || undefined,
    status: statusFilter === 'All' ? undefined : statusFilter,
  });
  const { data: teamMembers } = useTeamMembers(true);
  const createSponsor = useCreateSponsor();
  const duplicateCheck = useDuplicateCheck();
  const batchResearchMutation = useBatchResearch();
  const importCsvMutation = useImportSponsorsCsv();

  const membersList = (teamMembers as unknown as any[]) || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...newSponsor,
        name: newSponsor.company_name,
        category: newSponsor.company_category,
      };

      const dup = (await duplicateCheck.mutateAsync(payload)) as unknown as any;
      if (dup?.is_duplicate || dup?.duplicate) {
        const ownerInfo = dup.assigned_to?.name
          ? `Assigned Organizer: ${dup.assigned_to.name} (${dup.assigned_to.email})`
          : 'Already tracked in pipeline';
        const details =
          dup.details ||
          `Company "${dup.company?.name || newSponsor.company_name}" already exists (${ownerInfo}).`;
        const action =
          dup.suggested_action ||
          'Duplicate outreach prevention: Avoid two team members contacting the same sponsor.';
        if (
          !window.confirm(
            `⚠️ ${dup.conflict_type || 'Duplicate Outreach Warning'}:\n${details}\n\n${action}\n\nDo you still want to force-create this record?`
          )
        ) {
          return;
        }
      }
      await createSponsor.mutateAsync(payload);
      setShowCreateModal(false);
      const addedName = newSponsor.company_name;
      setNewSponsor({
        company_name: '',
        company_category: 'Technology',
        industry: '',
        website: '',
        contact_person: '',
        contact_email: '',
        contact_role: '',
        status: 'Not Contacted',
        priority: 0,
        assignee_id: 1,
      });
      alert(`Sponsor "${addedName}" added to tracker!`);
    } catch (err: any) {
      alert(err.response?.data?.detail || err.response?.data?.error || 'Failed to create sponsor');
    }
  };

  const handleBatchResearch = async () => {
    try {
      const res: any = await batchResearchMutation.mutateAsync(undefined);
      refetch();
      alert(
        `Batch Research & Prioritization Complete!\nProcessed ${res?.processed_count ?? 0} companies and categorized recommended asks (Cash, Goodies, Cloud Credits).`
      );
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Batch research failed');
    }
  };

  const handleImportCsv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvText.trim()) return;
    const lines = csvText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;

    const hasHeader =
      lines[0].toLowerCase().includes('company') || lines[0].toLowerCase().includes('name');
    const dataLines = hasHeader ? lines.slice(1) : lines;

    const parsedSponsors = dataLines.map((line) => {
      const cols = line.split(',').map((c) => c.trim());
      return {
        name: cols[0] || '',
        category: cols[1] || 'Technology',
        industry: cols[2] || 'Technology',
        website: cols[3] || '',
        contact_person: cols[4] || '',
        contact_email: cols[5] || '',
        contact_role: cols[6] || 'Sponsorships / DevRel',
      };
    });

    try {
      const res: any = await importCsvMutation.mutateAsync({
        sponsors: parsedSponsors,
        defaultAssigneeId: 1,
      });
      setShowImportModal(false);
      setCsvText('');
      refetch();
      alert(
        `Import Complete!\nCreated: ${res?.created_count ?? 0} sponsors\nSkipped Duplicates: ${res?.skipped_count ?? 0}`
      );
    } catch (err: any) {
      alert(err.response?.data?.detail || 'CSV Import failed');
    }
  };

  const sponsors: any[] = Array.isArray(sponsorsData)
    ? sponsorsData
    : (sponsorsData as unknown as any)?.sponsors || [];
  const total = Array.isArray(sponsorsData)
    ? sponsorsData.length
    : (sponsorsData as unknown as any)?.total ?? sponsors.length;

  const handleExportCsv = () => {
    const headers = [
      'Company Name',
      'Category/Tier',
      'Industry',
      'Status',
      'Priority Score',
      'Priority Tier',
      'Recommended Ask',
      'Follow-ups Sent',
      'Assigned Organizer',
      'Contact Person',
      'Contact Email',
      'Website',
      'Cash Secured',
      'Benefits Secured',
    ];
    const rows = sponsors.map((s: any) => [
      `"${(s.company_name || s.name || '').replace(/"/g, '""')}"`,
      `"${(s.company_category || s.category || '').replace(/"/g, '""')}"`,
      `"${(s.industry || '').replace(/"/g, '""')}"`,
      `"${s.status || 'Not Contacted'}"`,
      s.priority_score ?? s.priority ?? 0,
      `"${s.priority_tier || 'Medium'}"`,
      `"${(s.recommended_sponsorship_types || []).join('; ')}"`,
      `"${s.follow_up_count ?? 0}/2"`,
      `"${s.assignee?.name || 'Unassigned'}"`,
      `"${(s.contact_person || '').replace(/"/g, '""')}"`,
      `"${(s.contact_email || '').replace(/"/g, '""')}"`,
      `"${(s.website || '').replace(/"/g, '""')}"`,
      s.sponsorship_amount || 0,
      `"${(s.sponsorship_details || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sponsor_tracker_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('All');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sponsor Tracker & Pipeline</h1>
          <p className="text-gray-600 mt-1 text-sm">
            {total} companies tracked • Prevents duplicate outreach & enforces max 2 follow-ups
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleBatchResearch}
            disabled={batchResearchMutation.isPending}
            className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5"
            title="Research & prioritize unresearched sponsors using free-tier AI"
          >
            <SparklesIcon className="w-4 h-4" />
            {batchResearchMutation.isPending ? 'Researching All...' : 'Research & Prioritize All'}
          </button>

          <button
            onClick={() => setShowImportModal(true)}
            className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5"
          >
            <ArrowUpTrayIcon className="w-4 h-4" />
            Import CSV / Sheets
          </button>

          <button
            onClick={handleExportCsv}
            className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5"
          >
            <ArrowDownTrayIcon className="w-4 h-4" />
            Export Google Sheets CSV
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary text-xs py-2 px-3.5 flex items-center gap-1.5"
          >
            <PlusIcon className="w-4 h-4" />
            Add Sponsor
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <form
          onSubmit={(e) => e.preventDefault()}
          className="flex flex-col sm:flex-row gap-4"
        >
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search companies by name, email, contact, or industry..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-12 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
              autoComplete="off"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            )}
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-white"
          >
            {statusOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={clearFilters}
            className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2"
            disabled={!searchQuery && statusFilter === 'All'}
          >
            <ArrowPathIcon className="w-4 h-4" /> Reset
          </button>
        </form>
      </div>

      {/* Sponsors Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Company & Category
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Contact & Owner
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Recommended Ask
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Priority
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Follow-ups
                </th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading && !sponsors.length ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-600 border-t-transparent"></div>
                      <p className="text-gray-500">Loading sponsor tracker...</p>
                    </div>
                  </td>
                </tr>
              ) : (
                sponsors.map((sponsor: any) => {
                  const asks: string[] = sponsor.recommended_sponsorship_types || [];
                  return (
                    <tr
                      key={sponsor.id}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => navigate('/sponsors/' + sponsor.id)}
                    >
                      <td className="px-5 py-4">
                        <div className="font-semibold text-gray-900">
                          {sponsor.company_name || sponsor.name || 'N/A'}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-gray-100 text-gray-700">
                            {sponsor.company_category || sponsor.category || 'General'}
                          </span>
                          <span className="text-xs text-gray-500">{sponsor.industry || ''}</span>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          {sponsor.contact_person || 'No contact yet'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {sponsor.contact_email || 'Click to discover'}
                        </div>
                        <div className="text-[11px] text-primary-600 mt-0.5 font-medium">
                          👤 Owner: {sponsor.assignee?.name || 'Organizer #1'}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        {asks.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {asks.slice(0, 2).map((ask: string, i: number) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 text-[11px] font-medium rounded bg-primary-100 text-primary-700"
                              >
                                {ask}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">Run Research</span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={
                            'px-2.5 py-1 text-xs font-semibold rounded-full ' +
                            (statusColors[sponsor.status] || 'bg-gray-100 text-gray-700')
                          }
                        >
                          {sponsor.status || 'Not Contacted'}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <span className="text-base font-bold text-gray-900">
                            {sponsor.priority_score ?? sponsor.priority ?? 0}
                          </span>
                          <span
                            className={
                              'px-2 py-0.5 text-[11px] font-semibold rounded-full ' +
                              (sponsor.priority_tier === 'High'
                                ? 'bg-green-100 text-green-800'
                                : sponsor.priority_tier === 'Medium'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-gray-100 text-gray-700')
                            }
                          >
                            {sponsor.priority_tier || 'Unscored'}
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`text-xs font-semibold px-2 py-1 rounded ${
                            (sponsor.follow_up_count ?? 0) >= 2
                              ? 'bg-red-100 text-red-800'
                              : 'text-gray-600'
                          }`}
                        >
                          {sponsor.follow_up_count ?? 0}/2
                        </span>
                      </td>

                      <td className="px-5 py-4 text-right">
                        <Link
                          to={'/sponsors/' + sponsor.id}
                          onClick={(e: React.MouseEvent) => e.stopPropagation()}
                          className="text-primary-600 hover:underline text-xs font-semibold"
                        >
                          Open Tracker →
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {sponsors.length === 0 && !isLoading && (
          <div className="text-center py-16 text-gray-500">
            <BuildingOfficeIcon className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <p className="text-lg font-medium">No sponsors in tracker yet</p>
            <p className="text-sm mt-1 mb-4">
              Add a company manually or import a CSV / Google Sheets list of potential sponsors.
            </p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setShowImportModal(true)} className="btn-secondary text-xs">
                Import CSV / Sample Hackathon List
              </button>
              <button onClick={() => setShowCreateModal(true)} className="btn-primary text-xs">
                Add Sponsor
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Sponsor Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 animate-fade-in">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Add New Sponsor (With Duplicate Check)</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Company Name *
                  </label>
                  <input
                    type="text"
                    value={newSponsor.company_name}
                    onChange={(e) =>
                      setNewSponsor({ ...newSponsor, company_name: e.target.value })
                    }
                    required
                    placeholder="e.g. Stripe, GitHub, Vercel"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category / Tier
                  </label>
                  <select
                    value={newSponsor.company_category}
                    onChange={(e) =>
                      setNewSponsor({ ...newSponsor, company_category: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-white"
                  >
                    <option value="Tier 1 - Tech Giant">Tier 1 - Tech Giant (Cash + Cloud)</option>
                    <option value="Cloud & Infrastructure">Cloud & Infrastructure (Credits)</option>
                    <option value="Developer Tools">Developer Tools (Cash + Swag)</option>
                    <option value="Fintech">Fintech (Cash Prize Track)</option>
                    <option value="Fast-Growing Startup">Fast-Growing Startup (Swag / Goodies)</option>
                    <option value="Food & Beverage">Food & Beverage (In-Kind / Refreshments)</option>
                    <option value="Technology">Technology (General)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Assigned Team Member (Prevents Duplicate Outreach)
                  </label>
                  <select
                    value={newSponsor.assignee_id}
                    onChange={(e) =>
                      setNewSponsor({ ...newSponsor, assignee_id: Number(e.target.value) })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-white"
                  >
                    {membersList.length > 0 ? (
                      membersList.map((m: any) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.role || 'Organizer'})
                        </option>
                      ))
                    ) : (
                      <option value={1}>Primary Organizer (#1)</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
                  <input
                    type="text"
                    value={newSponsor.industry}
                    onChange={(e) => setNewSponsor({ ...newSponsor, industry: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm"
                    placeholder="e.g. Developer Tools, Cloud, AI"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                  <input
                    type="url"
                    value={newSponsor.website}
                    onChange={(e) => setNewSponsor({ ...newSponsor, website: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm"
                    placeholder="https://company.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    value={newSponsor.contact_person}
                    onChange={(e) =>
                      setNewSponsor({ ...newSponsor, contact_person: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm"
                    placeholder="Leave blank to auto-discover later"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contact Email
                  </label>
                  <input
                    type="email"
                    value={newSponsor.contact_email}
                    onChange={(e) =>
                      setNewSponsor({ ...newSponsor, contact_email: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm"
                    placeholder="partnerships@company.com"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={createSponsor.isPending}
                >
                  {createSponsor.isPending ? 'Checking & Saving...' : 'Add to Tracker'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk CSV / Google Sheets Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 animate-fade-in">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  Import Sponsors from CSV / Google Sheets
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Automatically checks for duplicate companies/domains so no company is contacted twice.
                </p>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleImportCsv} className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-gray-600">
                  Format: Company Name, Category, Industry, Website, Contact Person, Contact Email, Role
                </label>
                <button
                  type="button"
                  onClick={() => setCsvText(SAMPLE_CSV)}
                  className="text-xs text-primary-600 hover:underline font-semibold"
                >
                  ✨ Load Sample Hackathon Sponsor List
                </button>
              </div>
              <textarea
                rows={8}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder={SAMPLE_CSV}
                className="w-full p-3 border border-gray-200 rounded-lg text-xs font-mono"
                required
              />
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={importCsvMutation.isPending}
                  className="btn-primary"
                >
                  {importCsvMutation.isPending ? 'Importing...' : 'Import & Deduplicate Sponsors'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Sponsors;