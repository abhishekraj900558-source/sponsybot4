import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSponsors, useCreateSponsor, useDuplicateCheck } from '../hooks/useApi';
import { Link } from 'react-router-dom';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowPathIcon,
  BuildingOfficeIcon,
  EnvelopeOpenIcon,
  CalendarDaysIcon,
  ArrowRightOnRectangleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { formatNumber, formatDate } from '../utils/format';

const statusColors = {
  'Not Contacted': 'bg-gray-100 text-gray-700',
  Contacted: 'bg-blue-100 text-blue-800',
  'Follow-up': 'bg-yellow-100 text-yellow-800',
  Interested: 'bg-green-100 text-green-800',
  Declined: 'bg-red-100 text-red-800',
  Closed: 'bg-gray-100 text-gray-700',
};

const statusOptions = ['All', 'Not Contacted', 'Contacted', 'Follow-up', 'Interested', 'Declined', 'Closed'];

export function Sponsors() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'All');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSponsor, setNewSponsor] = useState({
    company_name: '',
    company_category: '',
    industry: '',
    website: '',
    contact_person: '',
    contact_email: '',
    contact_role: '',
    assignee_id: 1,
  });
  const [isSearching, setIsSearching] = useState(false);

  // Sync search params with URL
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
  const createSponsor = useCreateSponsor();
  const duplicateCheck = useDuplicateCheck();

  // Show loading state when search params change
  useEffect(() => {
    if (searchQuery || statusFilter !== 'All') {
      setIsSearching(true);
      const timer = setTimeout(() => setIsSearching(false), 300);
      return () => clearTimeout(timer);
    }
  }, [searchQuery, statusFilter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const dup = (await duplicateCheck.mutateAsync(newSponsor)) as unknown as any;
      if (dup.is_duplicate) {
        if (!window.confirm(`${dup.conflict_type}: ${dup.details}\n\n${dup.suggested_action}\n\nContinue anyway?`)) {
          return;
        }
      }
      await createSponsor.mutateAsync(newSponsor);
      setShowCreateModal(false);
      setNewSponsor({ company_name: '', company_category: '', industry: '', website: '', contact_person: '', contact_email: '', contact_role: '', assignee_id: 1 });
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to create sponsor');
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Trigger refetch by updating state
    setSearchQuery(searchQuery);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('All');
  };

  const sponsors = (sponsorsData as unknown as any)?.sponsors || [];
  const total = (sponsorsData as unknown as any)?.total || 0;

  return (
    <div className='space-y-6 animate-fade-in'>
      {/* Header */}
      <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 animate-slide-in-left'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>Sponsors</h1>
          <p className='text-gray-600 mt-1'>{total} sponsors total</p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)} 
          className='btn-primary group'
        >
          <PlusIcon className='w-5 h-5 mr-2 group-hover:rotate-90 transition-transform duration-200' />
          Add Sponsor
        </button>
      </div>

      {/* Filters */}
      <div className='bg-white rounded-xl border border-gray-200 p-4 mb-6 animate-fade-in stagger-1'>
        <form onSubmit={handleSearchSubmit} className='flex flex-col sm:flex-row gap-4'>
          <div className='relative flex-1'>
            <MagnifyingGlassIcon className='absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 transition-colors duration-200' />
            <input
              type='text'
              placeholder='Search sponsors by name, email, contact...'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className='w-full pl-10 pr-12 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 bg-white'
              autoComplete="off"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                aria-label="Clear search"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            )}
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className='px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white'
          >
            {statusOptions.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={clearFilters}
            className='px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors flex items-center gap-2'
            disabled={!searchQuery && statusFilter === 'All'}
          >
            <ArrowPathIcon className='w-5 h-5' /> Reset
          </button>
        </form>
      </div>

      {/* Sponsors Table */}
      <div className='bg-white rounded-xl border border-gray-200 overflow-hidden animate-fade-in stagger-2'>
        <div className='overflow-x-auto'>
          <table className='w-full'>
            <thead className='bg-gray-50 border-b border-gray-200'>
              <tr>
                <th className='text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider'>Company</th>
                <th className='text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider'>Category</th>
                <th className='text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider'>Contact</th>
                <th className='text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider'>Status</th>
                <th className='text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider'>Priority</th>
                <th className='text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider'>Follow-ups</th>
                <th className='text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider'>Actions</th>
              </tr>
            </thead>
            <tbody className='divide-y divide-gray-100'>
              {isLoading && !sponsors.length ? (
                <tr>
                  <td colSpan={7} className='px-6 py-12 text-center'>
                    <div className='flex flex-col items-center gap-3'>
                      <div className='animate-spin rounded-full h-10 w-10 border-4 border-primary-600 border-t-transparent'></div>
                      <p className='text-gray-500'>Loading sponsors...</p>
                    </div>
                  </td>
                </tr>
              ) : sponsors.map((sponsor: any, index: number) => (
                <tr 
                  key={sponsor.id} 
                  className='hover:bg-gray-50 cursor-pointer transition-colors animate-fade-in'
                  style={{ animationDelay: `${index * 0.03}s` }}
                  onClick={() => window.location.href = '/sponsors/' + sponsor.id}
                >
                  <td className='px-6 py-4'>
                    <div className='font-medium text-gray-900'>{sponsor.company_name}</div>
                    <div className='text-sm text-gray-500'>{sponsor.industry || 'N/A'}</div>
                  </td>
                  <td className='px-6 py-4'>
                    <span className='px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700'>
                      {sponsor.company_category || 'N/A'}
                    </span>
                  </td>
                  <td className='px-6 py-4'>
                    <div>
                      <div className='font-medium text-gray-900'>{sponsor.contact_person || 'N/A'}</div>
                      <div className='text-sm text-gray-500'>{sponsor.contact_email || 'N/A'}</div>
                    </div>
                  </td>
                  <td className='px-6 py-4'>
                    <span className={'px-2 py-1 text-xs font-medium rounded-full ' + (statusColors[sponsor.status as keyof typeof statusColors] || 'bg-gray-100 text-gray-700')}> 
                      {sponsor.status}
                    </span>
                  </td>
                  <td className='px-6 py-4'>
                    <div className='flex items-center gap-2'>
                      <span className='text-lg font-bold text-gray-900'>{sponsor.priority_score}</span>
                      <span className={'px-2 py-0.5 text-xs font-medium rounded-full ' + (sponsor.priority_tier === 'High' ? 'bg-green-100 text-green-800' : sponsor.priority_tier === 'Medium' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-700')}> 
                        {sponsor.priority_tier || 'N/A'}
                      </span>
                    </div>
                  </td>
                  <td className='px-6 py-4'>
                    <span className='text-gray-600'>{sponsor.follow_up_count}/2</span>
                  </td>
                  <td className='px-6 py-4 text-right'>
                    <div className='flex items-center justify-end gap-2'>
                      <Link to={'/sponsors/' + sponsor.id} className='text-primary-600 hover:underline text-sm font-medium'>
                        View
                      </Link>
                      <button
                        onClick={(e) => { e.stopPropagation(); window.location.href = '/sponsors/' + sponsor.id + '/emails/draft'; }}
                        className='text-primary-600 hover:underline text-sm font-medium'
                      >
                        Email
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {sponsors.length === 0 && !isLoading && (
          <div className='text-center py-16 text-gray-500 animate-fade-in'>
            <BuildingOfficeIcon className='w-16 h-16 mx-auto text-gray-300 mb-4' />
            <p className='text-lg font-medium'>No sponsors found</p>
            <p className='text-sm mt-1'>{searchQuery ? `No results for "${searchQuery}"` : 'Try adjusting your filters or add a new sponsor'}</p>
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className='mt-4 text-primary-600 hover:underline text-sm'>
                Clear search
              </button>
            )}
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className='flex items-center justify-between px-6 py-4 border-t border-gray-200 animate-fade-in stagger-3'>
        <p className='text-sm text-gray-600'>Showing {sponsors.length} of {total} sponsors</p>
        <div className='flex gap-2'>
          <button className='px-3 py-1 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors' disabled>
            Previous
          </button>
          <button className='px-3 py-1 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors' disabled>
            Next
          </button>
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 animate-fade-in'>
          <div className='bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-scale-in'>
            <div className='p-6 border-b border-gray-200 flex items-center justify-between'>
              <h2 className='text-xl font-bold text-gray-900'>Add New Sponsor</h2>
              <button onClick={() => setShowCreateModal(false)} className='text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors'>
                <svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className='p-6 space-y-4 overflow-y-auto max-h-[70vh]'>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <div className='md:col-span-2'>
                  <label className='block text-sm font-medium text-gray-700 mb-1'>Company Name *</label>
                  <input
                    type='text'
                    value={newSponsor.company_name}
                    onChange={(e) => setNewSponsor({...newSponsor, company_name: e.target.value})}
                    required
                    className='w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors'
                  />
                </div>
                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-1'>Category</label>
                  <select
                    value={newSponsor.company_category}
                    onChange={(e) => setNewSponsor({...newSponsor, company_category: e.target.value})}
                    className='w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors bg-white'
                  >
                    <option value=''>Select category</option>
                    <option value='Platinum'>Platinum</option>
                    <option value='Gold'>Gold</option>
                    <option value='Silver'>Silver</option>
                    <option value='Bronze'>Bronze</option>
                  </select>
                </div>
                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-1'>Industry</label>
                  <input
                    type='text'
                    value={newSponsor.industry}
                    onChange={(e) => setNewSponsor({...newSponsor, industry: e.target.value})}
                    className='w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors'
                  />
                </div>
                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-1'>Website</label>
                  <input
                    type='url'
                    value={newSponsor.website}
                    onChange={(e) => setNewSponsor({...newSponsor, website: e.target.value})}
                    className='w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors'
                    placeholder='https://example.com'
                  />
                </div>
              </div>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-1'>Contact Person</label>
                  <input
                    type='text'
                    value={newSponsor.contact_person}
                    onChange={(e) => setNewSponsor({...newSponsor, contact_person: e.target.value})}
                    className='w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors'
                  />
                </div>
                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-1'>Contact Email</label>
                  <input
                    type='email'
                    value={newSponsor.contact_email}
                    onChange={(e) => setNewSponsor({...newSponsor, contact_email: e.target.value})}
                    className='w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors'
                  />
                </div>
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>Contact Role</label>
                <input
                  type='text'
                  value={newSponsor.contact_role}
                  onChange={(e) => setNewSponsor({...newSponsor, contact_role: e.target.value})}
                  className='w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors'
                />
              </div>
              <div className='flex justify-end gap-3 pt-4 border-t border-gray-200'>
                <button type='button' onClick={() => setShowCreateModal(false)} className='btn-secondary'>
                  Cancel
                </button>
                <button type='submit' className='btn-primary' disabled={createSponsor.isPending}>
                  {createSponsor.isPending ? 'Creating...' : 'Create Sponsor'}
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