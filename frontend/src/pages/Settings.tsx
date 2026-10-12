import React, { useState } from 'react';
import { useTeamMembers, useCreateTeamMember, useUpdateTeamMember, useEvents, useCreateEvent, useInstitutionalMemory, useCreateInstitutionalMemory, useEmailTemplates } from '../hooks/useApi';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowPathIcon,
  UserPlusIcon,
  UserMinusIcon,
  PencilIcon,
  TrashIcon,
  BuildingOfficeIcon,
  CalendarDaysIcon,
  DocumentTextIcon,
  Cog6ToothIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns/format';

const tabs = [
  { id: 'team', label: 'Team Members', icon: UserPlusIcon },
  { id: 'events', label: 'Events', icon: CalendarDaysIcon },
  { id: 'templates', label: 'Email Templates', icon: DocumentTextIcon },
  { id: 'memory', label: 'Institutional Memory', icon: BuildingOfficeIcon },
];

export function Settings() {
  const [activeTab, setActiveTab] = useState('team');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState<Record<string, any>>({
    name: '',
    email: '',
    role: '',
    is_active: true,
  });

  const { data: teamMembers } = useTeamMembers();
  const { data: events } = useEvents();
  const { data: templates } = useEmailTemplates();
  const { data: memory } = useInstitutionalMemory();
  const createMemberMutation = useCreateTeamMember();
  const updateMemberMutation = useUpdateTeamMember();
  const createEventMutation = useCreateEvent();
  const createMemoryMutation = useCreateInstitutionalMemory();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (activeTab === 'team') {
        if (editingItem) {
          await updateMemberMutation.mutateAsync({ id: editingItem.id, data: formData });
        } else {
          await createMemberMutation.mutateAsync(formData);
        }
      } else if (activeTab === 'events') {
        await createEventMutation.mutateAsync(formData);
      } else if (activeTab === 'memory') {
        await createMemoryMutation.mutateAsync(formData);
      }
      setShowCreateModal(false);
      setEditingItem(null);
      setFormData({ name: '', email: '', role: '', is_active: true, title: '', description: '', date: '', category: '', key: '', value: '', context: '' });
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to save');
    }
  };

  const handleEdit = (item: any) => {
    setEditingItem(item);
    if (activeTab === 'team') {
      setFormData({ name: item.name, email: item.email, role: item.role, is_active: item.is_active });
    } else if (activeTab === 'events') {
      setFormData({ title: item.title, description: item.description, date: item.date ? item.date.slice(0, 16) : '', category: item.category });
    } else if (activeTab === 'memory') {
      setFormData({ key: item.key, value: item.value, context: item.context });
    }
    setShowCreateModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;
    // TODO: Implement delete API calls
    alert('Delete not yet implemented');
  };

  const clearForm = () => {
    setEditingItem(null);
    setFormData({ name: '', email: '', role: '', is_active: true, title: '', description: '', date: '', category: '', key: '', value: '', context: '' });
  };

  const renderTeamContent = () => (
    <>
      <div className="flex items-center justify-between mb-6 animate-fade-in">
        <h2 className="text-lg font-semibold text-gray-900">Team Members</h2>
        <button onClick={() => { clearForm(); setShowCreateModal(true); }} className="btn-primary group">
          <PlusIcon className="w-5 h-5 mr-2 group-hover:rotate-90 transition-transform duration-200" />
          Add Member
        </button>
      </div>
      <div className="card overflow-hidden animate-fade-in stagger-1">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(teamMembers as unknown as any[])?.map((member: any, index: number) => (
                <tr key={member.id} className="hover:bg-gray-50 animate-fade-in" style={{ animationDelay: `${index * 0.03}s` }}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=0ea5e9&color=fff`}
                        alt={member.name}
                        className="w-8 h-8 rounded-full"
                      />
                      <span className="font-medium text-gray-900">{member.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{member.email}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                      {member.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${member.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>
                      {member.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => handleEdit(member)} className="text-primary-600 hover:underline text-sm font-medium">Edit</button>
                      <button onClick={() => handleDelete(member.id)} className="text-red-600 hover:underline text-sm font-medium">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(!(teamMembers as unknown as any[]) || (teamMembers as unknown as any[]).length === 0) && (
          <div className="text-center py-12 text-gray-500 animate-fade-in">
            <UserPlusIcon className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p className="text-lg font-medium">No team members yet</p>
            <p className="text-sm mt-1">Add your first team member</p>
          </div>
        )}
      </div>
    </>
  );

  const renderEventsContent = () => (
    <>
      <div className="flex items-center justify-between mb-6 animate-fade-in">
        <h2 className="text-lg font-semibold text-gray-900">Events</h2>
        <button onClick={() => { clearForm(); setShowCreateModal(true); }} className="btn-primary group">
          <PlusIcon className="w-5 h-5 mr-2 group-hover:rotate-90 transition-transform duration-200" />
          Add Event
        </button>
      </div>
      <div className="card overflow-hidden animate-fade-in stagger-1">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Title</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(events as unknown as any[])?.map((event: any, index: number) => (
                <tr key={event.id} className="hover:bg-gray-50 animate-fade-in" style={{ animationDelay: `${index * 0.03}s` }}>
                  <td className="px-6 py-4 font-medium text-gray-900">{event.title}</td>
                  <td className="px-6 py-4 text-gray-600">{event.date ? format(new Date(event.date), 'MMM d, yyyy HH:mm') : 'TBD'}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                      {event.category || 'General'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600 line-clamp-1">{event.description || 'No description'}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => handleEdit(event)} className="text-primary-600 hover:underline text-sm font-medium">Edit</button>
                      <button onClick={() => handleDelete(event.id)} className="text-red-600 hover:underline text-sm font-medium">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(!(events as unknown as any[]) || (events as unknown as any[]).length === 0) && (
          <div className="text-center py-12 text-gray-500 animate-fade-in">
            <CalendarDaysIcon className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p className="text-lg font-medium">No events yet</p>
            <p className="text-sm mt-1">Add your first event</p>
          </div>
        )}
      </div>
    </>
  );

  const renderTemplatesContent = () => (
    <>
      <div className="flex items-center justify-between mb-6 animate-fade-in">
        <h2 className="text-lg font-semibold text-gray-900">Email Templates</h2>
        <button className="btn-primary" disabled>
          <PlusIcon className="w-5 h-5 mr-2" />
          Add Template
        </button>
      </div>
      <div className="card overflow-hidden animate-fade-in stagger-1">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Subject</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Variables</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(templates as unknown as any[])?.map((template: any, index: number) => (
                <tr key={template.id} className="hover:bg-gray-50 animate-fade-in" style={{ animationDelay: `${index * 0.03}s` }}>
                  <td className="px-6 py-4 font-medium text-gray-900">{template.name}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                      {template.email_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{template.subject_template}</td>
                  <td className="px-6 py-4 text-gray-600 text-sm">{template.variables ? (Array.isArray(template.variables) ? template.variables.join(', ') : Object.keys(template.variables).join(', ')) : 'None'}</td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-primary-600 hover:underline text-sm font-medium">View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(!(templates as unknown as any[]) || (templates as unknown as any[]).length === 0) && (
          <div className="text-center py-12 text-gray-500 animate-fade-in">
            <DocumentTextIcon className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p className="text-lg font-medium">No templates yet</p>
            <p className="text-sm mt-1">Templates are managed via API</p>
          </div>
        )}
      </div>
    </>
  );

  const renderMemoryContent = () => (
    <>
      <div className="flex items-center justify-between mb-6 animate-fade-in">
        <h2 className="text-lg font-semibold text-gray-900">Institutional Memory</h2>
        <button onClick={() => { clearForm(); setShowCreateModal(true); }} className="btn-primary group">
          <PlusIcon className="w-5 h-5 mr-2 group-hover:rotate-90 transition-transform duration-200" />
          Add Entry
        </button>
      </div>
      <div className="card overflow-hidden animate-fade-in stagger-1">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Key</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Context</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Value</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Updated</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(memory as unknown as any[])?.map((item: any, index: number) => (
                <tr key={item.id} className="hover:bg-gray-50 animate-fade-in" style={{ animationDelay: `${index * 0.03}s` }}>
                  <td className="px-6 py-4 font-medium text-gray-900 font-mono text-sm">{item.key}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                      {item.context || 'general'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600 line-clamp-1 max-w-md">{item.value}</td>
                  <td className="px-6 py-4 text-gray-600 text-sm">{item.updated_at ? format(new Date(item.updated_at), 'MMM d, yyyy') : ''}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => handleEdit(item)} className="text-primary-600 hover:underline text-sm font-medium">Edit</button>
                      <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:underline text-sm font-medium">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(!(memory as unknown as any[]) || (memory as unknown as any[]).length === 0) && (
          <div className="text-center py-12 text-gray-500 animate-fade-in">
            <BuildingOfficeIcon className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p className="text-lg font-medium">No institutional memory entries</p>
            <p className="text-sm mt-1">Add your first entry to build organizational knowledge</p>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="animate-slide-in-left">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">Manage team, events, templates, and institutional memory</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6 animate-fade-in stagger-1">
        <nav className="flex gap-8" aria-label="Settings tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); clearForm(); }}
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
      <div className="animate-fade-in stagger-2">
        {activeTab === 'team' && renderTeamContent()}
        {activeTab === 'events' && renderEventsContent()}
        {activeTab === 'templates' && renderTemplatesContent()}
        {activeTab === 'memory' && renderMemoryContent()}
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 animate-fade-in">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                {editingItem ? `Edit ${activeTab === 'team' ? 'Team Member' : activeTab === 'events' ? 'Event' : 'Memory Entry'}` : `Add ${activeTab === 'team' ? 'Team Member' : activeTab === 'events' ? 'Event' : 'Memory Entry'}`}
              </h2>
              <button onClick={() => { setShowCreateModal(false); clearForm(); }} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors">
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
              {activeTab === 'team' && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        required
                        className="input-base"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        required
                        className="input-base"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                      <input
                        type="text"
                        value={formData.role}
                        onChange={(e) => setFormData({...formData, role: e.target.value})}
                        required
                        className="input-base"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      <select
                        value={formData.is_active.toString()}
                        onChange={(e) => setFormData({...formData, is_active: e.target.value === 'true'})}
                        className="input-base bg-white"
                      >
                        <option value="true">Active</option>
                        <option value="false">Inactive</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'events' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({...formData, title: e.target.value})}
                      required
                      className="input-base"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      rows={3}
                      className="input-base"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date & Time</label>
                      <input
                        type="datetime-local"
                        value={formData.date}
                        onChange={(e) => setFormData({...formData, date: e.target.value})}
                        className="input-base"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                      <input
                        type="text"
                        value={formData.category}
                        onChange={(e) => setFormData({...formData, category: e.target.value})}
                        className="input-base"
                        placeholder="e.g., Conference, Meetup, Webinar"
                      />
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'memory' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Key *</label>
                    <input
                      type="text"
                      value={formData.key}
                      onChange={(e) => setFormData({...formData, key: e.target.value})}
                      required
                      className="input-base"
                      placeholder="e.g., sponsor_preferences, email_best_practices"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Context</label>
                    <input
                      type="text"
                      value={formData.context}
                      onChange={(e) => setFormData({...formData, context: e.target.value})}
                      className="input-base"
                      placeholder="e.g., general, outreach, negotiation"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Value *</label>
                    <textarea
                      value={formData.value}
                      onChange={(e) => setFormData({...formData, value: e.target.value})}
                      required
                      rows={6}
                      className="input-base"
                      placeholder="Enter the knowledge/preference/guideline..."
                    />
                  </div>
                </>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button type="button" onClick={() => { setShowCreateModal(false); clearForm(); }} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={createMemberMutation.isPending || updateMemberMutation.isPending || createEventMutation.isPending || createMemoryMutation.isPending}>
                  {editingItem ? 'Update' : 'Create'}
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