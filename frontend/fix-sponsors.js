const fs = require('fs');
const path = require('path');

const content = `import React, { useState } from 'react';
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
  ArrowPathIcon,
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
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
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

  const { data: sponsorsData, isLoading, refetch } = useSponsors({
    search: searchQuery,
    status: statusFilter === 'All' ? undefined : statusFilter,
  });
  const createSponsor = useCreateSponsor();
  const duplicateCheck = useDuplicateCheck();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const dup = await duplicateCheck.mutateAsync(newSponsor);
      if (dup.is_duplicate) {
        if (!window.confirm(\`\${dup.conflict_type}: \${dup.details}\\n\\n\${dup.suggested_action}\\n\\nContinue anyway?\`)) {
          return;
        }
      }
      await createSponsor.mutateAsync(newSponsor);
      setShowCreateModal(false);
      setNewSponsor({ company_name: '', company_category: '', industry: '', website: '', contact_person: '', contact_email: '', contact_role: '', assignee_id: 1 });
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to create sponsor');
    }
  };

  const sponsors = sponsorsData?.sponsors || [];
  const total = sponsorsData?.total || 0;

  return (
    <div className='space-y-6'>
      <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>Sponsors</h1>
          <p className='text-gray-600 mt-1'>{total} sponsors total</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className='btn-primary'>
          <PlusIcon className='w-5 h-5 mr-2' />
          Add Sponsor
        </button>
      </div>

      {/* Filters */}
      <div className='bg-white rounded-xl border border-gray-200 p-4 mb-6'>
        <div className='flex flex-col sm:flex-row gap-4'>
          <div className='relative flex-1'>
            <MagnifyingGlassIcon className='absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400' />
            <input
              type='text'
              placeholder='Search sponsors...'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className='w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent'
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className='px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent'
          >
            {statusOptions.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          <button
            onClick={() => { setSearchQuery(''); setStatusFilter('All'); }}
            className='px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50'
          >
            <ArrowPathIcon className='w-5 h-5' /> Reset
          </button>
        </div>
      </div>

      {/* Sponsors Table */}
      <div className='bg-white rounded-xl border border-gray-200 overflow-hidden'>
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
              {sponsors.map((sponsor) => (
                <tr key={sponsor.id} className='hover:bg-gray-50 cursor-pointer' onClick={() => window.location.href = '/sponsors/' + sponsor.id}>
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
                    <span className='px-2 py-1 text-xs font-medium rounded-full ' + (statusColors[sponsor.status] || 'bg-gray-100 text-gray-700') + '}'>
                      {sponsor.status}
                    </span>
                  </td>
                  <td className='px-6 py-4'>
                    <div className='flex items-center gap-2'>
                      <span className='text-lg font-bold text-gray-900'>{sponsor.priority_score}</span>
                      <span className='px-2 py-0.5 text-xs font-medium rounded-full ' + (sponsor.priority_tier === 'High' ? 'bg-green-100 text-green-800' : sponsor.priority_tier === 'Medium' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-700') + '}'>
                        {sponsor.priority_tier || 'N/A'}
                      </span>
                    </div>
                  </td>
                  <td className='px-6 py-4'>
                    <span className='text-gray-600'>{sponsor.follow_up_count}/2</span>
                  </td>
                  <td className='px-6 py-4 text-right'>
                    <div className='flex items-center gap-2'>
                      <Link to={'/sponsors/' + sponsor.id} className='text-primary-600 hover:underline text-sm'>
                        View
                      </Link>
                      <button
                        onClick={(e) => { e.stopPropagation(); window.location.href = '/sponsors/' + sponsor.id + '/emails/draft'; }}
                        className='text-primary-600 hover:underline text-sm'
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

        {sponsors.length === 0 && (
          <div className='text-center py-12 text-gray-500'>
            <p className='text-lg font-medium'>No sponsors found</p>
            <p className='text-sm mt-1'>Try adjusting your filters or add a new sponsor</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className='flex items-center justify-between px-6 py-4 border-t border-gray-200'>
        <p className='text-sm text-gray-600'>Showing {sponsors.length} of {total} sponsors</p>
        <div className='flex gap-2'>
          <button className='px-3 py-1 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50' disabled>
            Previous
          </button>
          <button className='px-3 py-1 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50' disabled>
            Next
          </button>
        </div>
      </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50'>
          <div className='bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto'>
            <div className='p-6 border-b border-gray-200 flex items-center justify-between'>
              <h2 className='text-xl font-bold text-gray-900'>Add New Sponsor</h2>
              <button onClick={() => setShowCreateModal(false)} className='text-gray-400 hover:text-gray-600'>
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
                    className='w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent'
                  />
                </div>
                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-1'>Category</label>
                  <select
                    value={newSponsor.company_category}
                    onChange={(e) => setNewSponsor({...newSponsor, company_category: e.target.value})}
                    className='w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent'
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
                    className='w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent'
                  />
                </div>
                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-1'>Website</label>
                  <input
                    type='url'
                    value={newSponsor.website}
                    onChange={(e) => setNewSponsor({...newSponsor, website: e.target.value})}
                    className='w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent'
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
                    className='w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent'
                  />
                </div>
                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-1'>Contact Email</label>
                  <input
                    type='email'
                    value={newSponsor.contact_email}
                    onChange={(e) => setNewSponsor({...newSponsor, contact_email: e.target.value})}
                    className='w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent'
                  />
                </div>
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>Contact Role</label>
                <input
                  type='text'
                  value={newSponsor.contact_role}
                  onChange={(e) => setNewSponsor({...newSponsor, contact_role: e.target.value})}
                  className='w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent'
                />
              </div>
              <div className='flex justify-end gap-3 pt-4 border-t border-gray-200'>
                <button type='button' onClick={() => setShowCreateModal(false)} className='btn-secondary'>
                  Cancel
                </button>
                <button type='submit' className='btn-primary'>
                  Create Sponsor
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
`;

fs.writeFileSync('src/pages/Sponsors.tsx', content);
console.log('File written successfully, length:', content.length);