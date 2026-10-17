import React, { useState } from 'react';
import {
  useTeamMembers,
  useCreateTeamMember,
  useUpdateTeamMember,
  useEvents,
  useCreateEvent,
  useInstitutionalMemory,
  useCreateInstitutionalMemory,
  useEmailTemplates,
  useCreateEmailTemplate,
} from '../hooks/useApi';
import {
  PlusIcon,
  UserPlusIcon,
  BuildingOfficeIcon,
  CalendarDaysIcon,
  DocumentTextIcon,
  XMarkIcon,
  CheckBadgeIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns/format';

const tabs = [
  { id: 'team', label: 'Team Organizers', icon: UserPlusIcon },
  { id: 'events', label: 'Club Events', icon: CalendarDaysIcon },
  { id: 'templates', label: 'Reusable Email Templates', icon: DocumentTextIcon },
  { id: 'memory', label: 'Institutional Memory', icon: BuildingOfficeIcon },
];

export function Settings() {
  const [activeTab, setActiveTab] = useState('team');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  const [formData, setFormData] = useState<Record<string, any>>({
    // Team
    name: '',
    email: '',
    role: 'Sponsorship Coordinator',
    is_active: true,
    // Event
    event_name: '',
    description: '',
    start_date: '',
    location: 'Campus Auditorium / Hybrid',
    expected_attendees: 500,
    budget_target: 150000,
    // Template
    template_name: '',
    email_type: 'initial',
    subject_template: 'Sponsorship Partnership: {{event_name}} x {{company_name}}',
    body_template:
      'Hi {{contact_person}},\n\nWe are organizing {{event_name}} and would love to partner with {{company_name}} for {{recommended_ask}}.\n\nBest regards,\n{{organizer_name}}',
    // Memory
    company_name: '',
    industry: 'Technology',
    past_events_sponsored: 1,
    total_contributed: 50000,
    preferred_ask: 'Cash Sponsorship, Swag / Goodies',
    outcome_notes: '',
    verified: true,
  });

  const { data: teamMembers } = useTeamMembers();
  const { data: events } = useEvents();
  const { data: templates } = useEmailTemplates();
  const { data: memory } = useInstitutionalMemory();

  const createMemberMutation = useCreateTeamMember();
  const updateMemberMutation = useUpdateTeamMember();
  const createEventMutation = useCreateEvent();
  const createTemplateMutation = useCreateEmailTemplate();
  const createMemoryMutation = useCreateInstitutionalMemory();

  const clearForm = () => {
    setEditingItem(null);
    setFormData({
      name: '',
      email: '',
      role: 'Sponsorship Coordinator',
      is_active: true,
      event_name: '',
      description: '',
      start_date: '',
      location: 'Campus Auditorium / Hybrid',
      expected_attendees: 500,
      budget_target: 150000,
      template_name: '',
      email_type: 'initial',
      subject_template: 'Sponsorship Partnership: {{event_name}} x {{company_name}}',
      body_template:
        'Hi {{contact_person}},\n\nWe are organizing {{event_name}} and would love to partner with {{company_name}}.\n\nBest regards,\n{{organizer_name}}',
      company_name: '',
      industry: 'Technology',
      past_events_sponsored: 1,
      total_contributed: 50000,
      preferred_ask: 'Cash Sponsorship, Swag / Goodies',
      outcome_notes: '',
      verified: true,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (activeTab === 'team') {
        const payload = {
          name: formData.name,
          email: formData.email,
          role: formData.role,
          is_active: formData.is_active,
        };
        if (editingItem) {
          await updateMemberMutation.mutateAsync({ id: editingItem.id, data: payload });
        } else {
          await createMemberMutation.mutateAsync(payload);
        }
      } else if (activeTab === 'events') {
        await createEventMutation.mutateAsync({
          name: formData.event_name,
          description: formData.description,
          start_date: formData.start_date
            ? new Date(formData.start_date).toISOString()
            : new Date().toISOString(),
          location: formData.location,
          expected_attendees: Number(formData.expected_attendees) || 500,
          budget_target: Number(formData.budget_target) || 150000,
        });
      } else if (activeTab === 'templates') {
        await createTemplateMutation.mutateAsync({
          name: formData.template_name,
          email_type: formData.email_type,
          subject_template: formData.subject_template,
          body_template: formData.body_template,
          variables: ['company_name', 'contact_person', 'event_name', 'organizer_name'],
        });
      } else if (activeTab === 'memory') {
        await createMemoryMutation.mutateAsync({
          company_name: formData.company_name,
          industry: formData.industry,
          past_events_sponsored: Number(formData.past_events_sponsored) || 1,
          total_contributed: Number(formData.total_contributed) || 0,
          preferred_sponsorship_types: (formData.preferred_ask || '')
            .split(',')
            .map((s: string) => s.trim())
            .filter(Boolean),
          outcome_notes: formData.outcome_notes,
          verified: Boolean(formData.verified),
        });
      }
      setShowCreateModal(false);
      clearForm();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to save entry');
    }
  };

  const handleEdit = (item: any) => {
    setEditingItem(item);
    if (activeTab === 'team') {
      setFormData({
        ...formData,
        name: item.name,
        email: item.email,
        role: item.role || 'Organizer',
        is_active: item.is_active ?? true,
      });
    } else if (activeTab === 'memory') {
      setFormData({
        ...formData,
        company_name: item.company_name || '',
        industry: item.industry || 'Technology',
        past_events_sponsored: item.past_events_sponsored ?? 1,
        total_contributed: item.total_contributed ?? 0,
        preferred_ask: (item.preferred_sponsorship_types || []).join(', '),
        outcome_notes: item.outcome_notes || item.notes || '',
        verified: item.verified ?? true,
      });
    }
    setShowCreateModal(true);
  };

  const renderTeamContent = () => (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Sponsorship Team Members</h2>
          <p className="text-xs text-gray-500">
            Assign sponsors to specific organizers so two members never contact the same company.
          </p>
        </div>
        <button
          onClick={() => {
            clearForm();
            setShowCreateModal(true);
          }}
          className="btn-primary text-xs"
        >
          <PlusIcon className="w-4 h-4 mr-1.5" />
          Add Organizer
        </button>
      </div>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">
                  Name
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">
                  Email
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">
                  Role
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">
                  Status
                </th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {((teamMembers as unknown as any[]) || []).map((member: any) => (
                <tr key={member.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">{member.name}</td>
                  <td className="px-6 py-4 text-gray-600 text-sm">{member.email}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                      {member.role || 'Organizer'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        member.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {member.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleEdit(member)}
                      className="text-primary-600 hover:underline text-xs font-semibold"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );

  const renderEventsContent = () => (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Club Events & Hackathons</h2>
          <p className="text-xs text-gray-500">
            Configure target sponsorship goals (e.g. ₹1,50,000 + swag for a 24-hour hackathon).
          </p>
        </div>
        <button
          onClick={() => {
            clearForm();
            setShowCreateModal(true);
          }}
          className="btn-primary text-xs"
        >
          <PlusIcon className="w-4 h-4 mr-1.5" />
          Add Club Event
        </button>
      </div>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">
                  Event Name
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">
                  Date
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">
                  Expected Attendees
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">
                  Sponsorship Goal
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">
                  Description
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {((events as unknown as any[]) || []).map((event: any) => (
                <tr key={event.id} className="hover:bg-gray-50 text-sm">
                  <td className="px-6 py-4 font-semibold text-gray-900">
                    {event.name || event.title}
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {event.start_date
                      ? format(new Date(event.start_date), 'MMM d, yyyy')
                      : 'TBD'}
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {event.expected_attendees || 500}+ students
                  </td>
                  <td className="px-6 py-4 font-semibold text-emerald-600">
                    ₹{Number(event.budget_target || 150000).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-gray-600 max-w-xs truncate">
                    {event.description || '24-Hour College Hackathon'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );

  const renderTemplatesContent = () => (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Reusable Email Templates (Initial & Follow-Ups)
          </h2>
          <p className="text-xs text-gray-500">
            Personalized with company-specific variables before organizer approval.
          </p>
        </div>
        <button
          onClick={() => {
            clearForm();
            setShowCreateModal(true);
          }}
          className="btn-primary text-xs"
        >
          <PlusIcon className="w-4 h-4 mr-1.5" />
          Add Email Template
        </button>
      </div>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">
                  Template Name
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">
                  Stage
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">
                  Subject Pattern
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">
                  Preview
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {((templates as unknown as any[]) || []).map((template: any) => (
                <tr key={template.id} className="hover:bg-gray-50 text-sm">
                  <td className="px-6 py-4 font-semibold text-gray-900">{template.name}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                      {template.email_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{template.subject_template}</td>
                  <td className="px-6 py-4 text-gray-500 text-xs max-w-md truncate">
                    {template.body_template}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );

  const renderMemoryContent = () => (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Institutional Memory (Past Sponsors & Historical Outcomes)
          </h2>
          <p className="text-xs text-gray-500">
            Preserves past sponsors, what they contributed, and key contacts for future organizing teams.
          </p>
        </div>
        <button
          onClick={() => {
            clearForm();
            setShowCreateModal(true);
          }}
          className="btn-primary text-xs"
        >
          <PlusIcon className="w-4 h-4 mr-1.5" />
          Add Past Sponsor Record
        </button>
      </div>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">
                  Company
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">
                  Past Events
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">
                  Total Contributed
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">
                  What They Provided
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">
                  Verification
                </th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {((memory as unknown as any[]) || []).map((item: any) => (
                <tr key={item.id} className="hover:bg-gray-50 text-sm">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-gray-900">{item.company_name}</div>
                    <div className="text-xs text-gray-500">{item.industry || 'Technology'}</div>
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {item.past_events_sponsored ?? 1} event(s)
                  </td>
                  <td className="px-6 py-4 font-semibold text-emerald-600">
                    ₹{Number(item.total_contributed || 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-600 max-w-xs">
                    {(item.preferred_sponsorship_types || []).join(', ') ||
                      item.outcome_notes ||
                      'General Sponsorship'}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-0.5 text-xs font-semibold rounded-full inline-flex items-center gap-1 ${
                        item.verified
                          ? 'bg-green-100 text-green-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      <CheckBadgeIcon className="w-3.5 h-3.5" />
                      {item.verified ? '[VERIFIED]' : '[UNVERIFIED]'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleEdit(item)}
                      className="text-primary-600 hover:underline text-xs font-semibold"
                    >
                      Update
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Club Settings, Templates & Institutional Memory
        </h1>
        <p className="text-gray-600 mt-1 text-sm">
          Manage organizers, hackathon targets, reusable templates, and historical sponsor records
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6 overflow-x-auto">
        <nav className="flex gap-8 min-w-max" aria-label="Settings tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                clearForm();
              }}
              className={`flex items-center gap-2 py-3.5 px-1 border-b-2 font-medium text-sm transition-all ${
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
      <div>
        {activeTab === 'team' && renderTeamContent()}
        {activeTab === 'events' && renderEventsContent()}
        {activeTab === 'templates' && renderTemplatesContent()}
        {activeTab === 'memory' && renderMemoryContent()}
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60">
          <div className="bg-white rounded-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">
                {editingItem ? 'Update Record' : 'Create New Entry'}
              </h2>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  clearForm();
                }}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {activeTab === 'team' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      className="input-base"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                      className="input-base"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                    <input
                      type="text"
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      required
                      className="input-base"
                    />
                  </div>
                </>
              )}

              {activeTab === 'events' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Event Name *
                    </label>
                    <input
                      type="text"
                      value={formData.event_name}
                      onChange={(e) => setFormData({ ...formData, event_name: e.target.value })}
                      required
                      placeholder="e.g. HackSphere 24-Hour Hackathon"
                      className="input-base"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Target Sponsorship Goal (₹)
                      </label>
                      <input
                        type="number"
                        value={formData.budget_target}
                        onChange={(e) =>
                          setFormData({ ...formData, budget_target: e.target.value })
                        }
                        className="input-base"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Expected Attendees
                      </label>
                      <input
                        type="number"
                        value={formData.expected_attendees}
                        onChange={(e) =>
                          setFormData({ ...formData, expected_attendees: e.target.value })
                        }
                        className="input-base"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Start Date
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      className="input-base"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description & Needs (e.g. ₹1,50,000 + Swag + Cloud Credits)
                    </label>
                    <textarea
                      rows={3}
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="input-base"
                    />
                  </div>
                </>
              )}

              {activeTab === 'templates' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Template Name *
                    </label>
                    <input
                      type="text"
                      value={formData.template_name}
                      onChange={(e) =>
                        setFormData({ ...formData, template_name: e.target.value })
                      }
                      required
                      placeholder="e.g. Hackathon First Contact - Cloud Credits"
                      className="input-base"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Stage</label>
                    <select
                      value={formData.email_type}
                      onChange={(e) => setFormData({ ...formData, email_type: e.target.value })}
                      className="input-base bg-white"
                    >
                      <option value="initial">Initial Outreach</option>
                      <option value="follow_up_1">Follow-up #1</option>
                      <option value="follow_up_2">Follow-up #2</option>
                      <option value="meeting_request">Virtual Meeting Request</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Subject Template *
                    </label>
                    <input
                      type="text"
                      value={formData.subject_template}
                      onChange={(e) =>
                        setFormData({ ...formData, subject_template: e.target.value })
                      }
                      required
                      className="input-base"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Body Template *
                    </label>
                    <textarea
                      rows={5}
                      value={formData.body_template}
                      onChange={(e) =>
                        setFormData({ ...formData, body_template: e.target.value })
                      }
                      required
                      className="input-base font-mono text-xs"
                    />
                  </div>
                </>
              )}

              {activeTab === 'memory' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Company Name *
                    </label>
                    <input
                      type="text"
                      value={formData.company_name}
                      onChange={(e) =>
                        setFormData({ ...formData, company_name: e.target.value })
                      }
                      required
                      placeholder="e.g. GitHub, Devfolio, Postman"
                      className="input-base"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Past Events Sponsored
                      </label>
                      <input
                        type="number"
                        value={formData.past_events_sponsored}
                        onChange={(e) =>
                          setFormData({ ...formData, past_events_sponsored: e.target.value })
                        }
                        className="input-base"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Total Contributed (₹)
                      </label>
                      <input
                        type="number"
                        value={formData.total_contributed}
                        onChange={(e) =>
                          setFormData({ ...formData, total_contributed: e.target.value })
                        }
                        className="input-base"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      What They Provided (Cash, Swag, Credits)
                    </label>
                    <input
                      type="text"
                      value={formData.preferred_ask}
                      onChange={(e) =>
                        setFormData({ ...formData, preferred_ask: e.target.value })
                      }
                      className="input-base"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Historical Outcome Notes (For Future Club Teams)
                    </label>
                    <textarea
                      rows={3}
                      value={formData.outcome_notes}
                      onChange={(e) =>
                        setFormData({ ...formData, outcome_notes: e.target.value })
                      }
                      placeholder="e.g. Sponsored 2025 Hackathon with ₹50,000 + stickers. Reach out 6 weeks before event."
                      className="input-base"
                    />
                  </div>
                </>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    clearForm();
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Settings;