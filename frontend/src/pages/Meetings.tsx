import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMeetings, useCreateMeeting, useScheduleMeeting, useCompleteMeeting, useCancelMeeting, useMeetingCalendarLinks } from '../hooks/useApi';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowPathIcon,
  CalendarDaysIcon,
  ClockIcon,
  MapPinIcon,
  LinkIcon,
  CheckCircleIcon,
  XCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns/format';
import { addDays } from 'date-fns/addDays';
import { startOfWeek } from 'date-fns/startOfWeek';
import { endOfWeek } from 'date-fns/endOfWeek';

const statusColors = {
  'Meeting Scheduled': 'bg-blue-100 text-blue-800',
  'Meeting Completed': 'bg-green-100 text-green-800',
  'Meeting Cancelled': 'bg-red-100 text-red-800',
};

const tabs = ['All', 'Upcoming', 'Past', 'Cancelled'];

export function Meetings() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [activeTab, setActiveTab] = useState('Upcoming');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [selectedMeetingId, setSelectedMeetingId] = useState<number | null>(null);
  const [newMeeting, setNewMeeting] = useState({
    sponsor_id: '',
    team_member_id: 1,
    title: '',
    description: '',
    scheduled_at: '',
    duration_minutes: 30,
    location: '',
    meeting_link: '',
  });

  const { data: meetingsData, isLoading, refetch } = useMeetings();
  const createMutation = useCreateMeeting();
  const scheduleMutation = useScheduleMeeting();
  const completeMutation = useCompleteMeeting();
  const cancelMutation = useCancelMeeting();

  const meetings = (meetingsData as unknown as any[]) || [];

  const filteredMeetings = meetings.filter((meeting: any) => {
    const matchesSearch = meeting.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (meeting.sponsor_name && meeting.sponsor_name.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'All' || meeting.status === statusFilter;
    const matchesTab = activeTab === 'All' || 
      (activeTab === 'Upcoming' && meeting.status === 'Meeting Scheduled' && new Date(meeting.scheduled_at) >= new Date()) ||
      (activeTab === 'Past' && (meeting.status === 'Meeting Completed' || (meeting.status === 'Meeting Scheduled' && new Date(meeting.scheduled_at) < new Date()))) ||
      (activeTab === 'Cancelled' && meeting.status === 'Meeting Cancelled');
    return matchesSearch && matchesStatus && matchesTab;
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createMutation.mutateAsync(newMeeting);
      setShowCreateModal(false);
      setNewMeeting({ sponsor_id: '', team_member_id: 1, title: '', description: '', scheduled_at: '', duration_minutes: 30, location: '', meeting_link: '' });
      refetch();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to create meeting');
    }
  };

  const handleSchedule = async (meetingId: number) => {
    const meeting = meetings.find(m => m.id === meetingId);
    if (!meeting) return;
    const scheduledAt = prompt('Enter date/time (YYYY-MM-DDTHH:MM):', meeting.scheduled_at || new Date().toISOString().slice(0, 16));
    if (scheduledAt) {
      try {
        await scheduleMutation.mutateAsync({ id: meetingId, scheduledAt, durationMinutes: meeting.duration_minutes, location: meeting.location, meetingLink: meeting.meeting_link });
        refetch();
      } catch (err: any) {
        alert(err.response?.data?.detail || 'Failed to schedule');
      }
    }
  };

  const handleComplete = async (meetingId: number) => {
    const outcome = prompt('Meeting outcome (optional):');
    const notes = prompt('Notes (optional):');
    try {
      await completeMutation.mutateAsync({ id: meetingId, outcome: outcome || undefined, notes: notes || undefined });
      refetch();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to complete');
    }
  };

  const handleCancel = async (meetingId: number) => {
    const reason = prompt('Cancellation reason (optional):');
    try {
      await cancelMutation.mutateAsync({ id: meetingId, reason: reason || undefined });
      refetch();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to cancel');
    }
  };

  const handleCalendarLinks = async (meetingId: number) => {
    setSelectedMeetingId(meetingId);
    setShowCalendarModal(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meetings</h1>
          <p className="text-gray-600 mt-1">Schedule and manage sponsor meetings</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn-primary">
          <PlusIcon className="w-5 h-5 mr-2" />
          Schedule Meeting
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-8" aria-label="Meeting tabs">
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
              placeholder="Search meetings..."
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
            {['All', 'Meeting Scheduled', 'Meeting Completed', 'Meeting Cancelled'].map((opt) => (
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

      {/* Meetings Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Title</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Sponsor</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date & Time</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Duration</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Location</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredMeetings.map((meeting: any) => (
                <tr key={meeting.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{meeting.title}</div>
                    {meeting.description && (
                      <div className="text-sm text-gray-500 line-clamp-1">{meeting.description}</div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{meeting.sponsor_name || `Sponsor #${meeting.sponsor_id}`}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-gray-600">
                      <CalendarDaysIcon className="w-4 h-4" />
                      <span>{meeting.scheduled_at ? format(new Date(meeting.scheduled_at), 'MMM d, yyyy HH:mm') : 'Not scheduled'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-gray-600">
                      <ClockIcon className="w-4 h-4" />
                      <span>{meeting.duration_minutes} min</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-gray-600">
                      {meeting.meeting_link ? (
                        <LinkIcon className="w-4 h-4" />
                      ) : (
                        <MapPinIcon className="w-4 h-4" />
                      )}
                      <span>{meeting.meeting_link ? 'Virtual' : (meeting.location || 'TBD')}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[meeting.status as keyof typeof statusColors] || 'bg-gray-100 text-gray-700'}`}>
                      {meeting.status.replace('Meeting ', '')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center gap-2">
                      <Link to={`/meetings/${meeting.id}`} className="text-primary-600 hover:underline text-sm">
                        View
                      </Link>
                      {meeting.status === 'Meeting Scheduled' && (
                        <>
                          <button onClick={() => handleSchedule(meeting.id)} className="text-primary-600 hover:underline text-sm">
                            Reschedule
                          </button>
                          <button onClick={() => handleComplete(meeting.id)} className="text-green-600 hover:underline text-sm">
                            Complete
                          </button>
                          <button onClick={() => handleCancel(meeting.id)} className="text-red-600 hover:underline text-sm">
                            Cancel
                          </button>
                          <button onClick={() => handleCalendarLinks(meeting.id)} className="text-primary-600 hover:underline text-sm">
                            Calendar
                          </button>
                        </>
                      )}
                      {meeting.status === 'Meeting Completed' && (
                        <span className="text-gray-500 text-sm">Completed</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredMeetings.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <CalendarDaysIcon className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p className="text-lg font-medium">No meetings found</p>
            <p className="text-sm mt-1">Try adjusting your filters or schedule a new meeting</p>
          </div>
        )}
      </div>

      {/* Create Meeting Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Schedule New Meeting</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sponsor *</label>
                  <input
                    type="number"
                    value={newMeeting.sponsor_id}
                    onChange={(e) => setNewMeeting({...newMeeting, sponsor_id: e.target.value})}
                    required
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Sponsor ID"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Team Member ID</label>
                  <input
                    type="number"
                    value={newMeeting.team_member_id}
                    onChange={(e) => setNewMeeting({...newMeeting, team_member_id: parseInt(e.target.value) || 1})}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  type="text"
                  value={newMeeting.title}
                  onChange={(e) => setNewMeeting({...newMeeting, title: e.target.value})}
                  required
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Meeting title"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={newMeeting.description}
                  onChange={(e) => setNewMeeting({...newMeeting, description: e.target.value})}
                  rows={3}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Meeting description"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date & Time *</label>
                  <input
                    type="datetime-local"
                    value={newMeeting.scheduled_at}
                    onChange={(e) => setNewMeeting({...newMeeting, scheduled_at: e.target.value})}
                    required
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duration (minutes)</label>
                  <input
                    type="number"
                    value={newMeeting.duration_minutes}
                    onChange={(e) => setNewMeeting({...newMeeting, duration_minutes: parseInt(e.target.value) || 30})}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                  <input
                    type="text"
                    value={newMeeting.location}
                    onChange={(e) => setNewMeeting({...newMeeting, location: e.target.value})}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Physical address or 'Virtual'"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Link (for virtual)</label>
                  <input
                    type="url"
                    value={newMeeting.meeting_link}
                    onChange={(e) => setNewMeeting({...newMeeting, meeting_link: e.target.value})}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="https://zoom.us/... or https://teams.microsoft.com/..."
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Create Meeting
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Calendar Links Modal */}
      {showCalendarModal && selectedMeetingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Calendar Links</h2>
              <button onClick={() => setShowCalendarModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-3">
                <a
                  href={`/api/meetings/${selectedMeetingId}/calendar-links?provider=google`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <svg className="w-6 h-6 text-blue-600" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.331,0-6.033-2.701-6.033-6.032s2.702-6.032,6.033-6.032c1.498,0,2.866,0.539,3.921,1.453l2.814-2.814C17.512,0.797,15.361,0,12.545,0C7.095,0,2.563,4.533,2.563,10.013c0,2.593,1.007,4.942,2.618,6.642L2.564,19.914C5.106,21.279,8.136,22,11.333,22c4.935,0,8.945-3.595,9.756-8.365L12.545,10.239z"/>
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Google Calendar</p>
                      <p className="text-sm text-gray-500">Add to Google Calendar</p>
                    </div>
                  </div>
                </a>
                <a
                  href={`/api/meetings/${selectedMeetingId}/calendar-links?provider=outlook`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <svg className="w-6 h-6 text-green-600" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M12,0C5.373,0,0,5.373,0,12c0,6.627,5.373,12,12,12s12-5.373,12-12C24,5.373,18.627,0,12,0z M13,17h-2v-5h2V17z M13,11h-2V6h2V11z"/>
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Outlook Calendar</p>
                      <p className="text-sm text-gray-500">Add to Outlook Calendar</p>
                    </div>
                  </div>
                </a>
                <a
                  href={`/api/meetings/${selectedMeetingId}/calendar-links?provider=ics`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <CalendarDaysIcon className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Download .ics File</p>
                      <p className="text-sm text-gray-500">Import to any calendar app</p>
                    </div>
                  </div>
                </a>
              </div>
              <div className="pt-4 border-t border-gray-200">
                <button onClick={() => setShowCalendarModal(false)} className="btn-secondary w-full">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Meetings;