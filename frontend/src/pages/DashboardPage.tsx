import React from 'react';
import { useDashboardStats, useDashboardPipeline, useTeamPerformance } from '../hooks/useApi';
import { Link } from 'react-router-dom';
import {
  BuildingOfficeIcon,
  EnvelopeOpenIcon,
  CalendarDaysIcon,
  CurrencyDollarIcon,
  ArrowTrendingUpIcon,
  UsersIcon,
  ArrowRightOnRectangleIcon,
  ArrowPathIcon,
  EnvelopeIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import { formatNumber } from '../utils/format';

const statCards = [
  {
    name: 'Total Sponsors',
    value: (stats: any) => stats.total_sponsors,
    icon: BuildingOfficeIcon,
    color: 'bg-blue-500',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-600',
    href: '/sponsors',
  },
  {
    name: 'Contacted',
    value: (stats: any) => stats.by_status?.Contacted || 0,
    icon: EnvelopeOpenIcon,
    color: 'bg-blue-500',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-600',
    href: '/sponsors?status=Contacted',
  },
  {
    name: 'Interested',
    value: (stats: any) => stats.by_status?.Interested || 0,
    icon: CheckCircleIcon,
    color: 'bg-green-500',
    bgColor: 'bg-green-50',
    textColor: 'text-green-600',
    href: '/sponsors?status=Interested',
  },
  {
    name: 'Declined',
    value: (stats: any) => stats.by_status?.Declined || 0,
    icon: XCircleIcon,
    color: 'bg-red-500',
    bgColor: 'bg-red-50',
    textColor: 'text-red-600',
    href: '/sponsors?status=Declined',
  },
  {
    name: 'Response Rate',
    value: (stats: any) => `${stats.response_rate?.toFixed(1) || 0}%`,
    icon: ArrowTrendingUpIcon,
    color: 'bg-purple-500',
    bgColor: 'bg-purple-50',
    textColor: 'text-purple-600',
    href: '/sponsors',
  },
  {
    name: 'Meetings',
    value: (stats: any) => stats.meetings_scheduled || 0,
    icon: CalendarDaysIcon,
    color: 'bg-orange-500',
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-600',
    href: '/meetings',
  },
];

const pipelineStages = [
  { key: 'Not Contacted', label: 'Not Contacted', color: 'bg-gray-100 text-gray-700', icon: ClockIcon, iconBg: 'bg-gray-100', iconColor: 'text-gray-600' },
  { key: 'Contacted', label: 'Contacted', color: 'bg-blue-100 text-blue-800', icon: EnvelopeOpenIcon, iconBg: 'bg-blue-100', iconColor: 'text-blue-600' },
  { key: 'Follow-up', label: 'Follow-up', color: 'bg-yellow-100 text-yellow-800', icon: ArrowPathIcon, iconBg: 'bg-yellow-100', iconColor: 'text-yellow-600' },
  { key: 'Interested', label: 'Interested', color: 'bg-green-100 text-green-800', icon: CheckCircleIcon, iconBg: 'bg-green-100', iconColor: 'text-green-600' },
  { key: 'Declined', label: 'Declined', color: 'bg-red-100 text-red-800', icon: XCircleIcon, iconBg: 'bg-red-100', iconColor: 'text-red-600' },
  { key: 'Closed', label: 'Closed', color: 'bg-gray-100 text-gray-800', icon: BuildingOfficeIcon, iconBg: 'bg-gray-100', iconColor: 'text-gray-600' },
];

export function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: pipeline } = useDashboardPipeline();
  const { data: teamPerformance } = useTeamPerformance();

  if (statsLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 animate-fade-in">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent mb-4"></div>
        <p className="text-gray-500">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-slide-in-left">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Overview of your sponsorship pipeline</p>
        </div>
        <div className="flex gap-3">
          <Link to="/sponsors" className="btn-primary group">
            <PlusIcon className="w-5 h-5 mr-2 group-hover:rotate-90 transition-transform duration-200" />
            Add Sponsor
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {statCards.map((stat, index) => (
          <Link key={stat.name} to={stat.href} className="block animate-fade-in stagger-1" style={{ animationDelay: `${index * 0.05}s` }}>
            <div className="card-hover group p-6">
              <div className="flex items-center justify-between">
                <div className={`p-3 rounded-xl ${stat.color}`}>
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
                <div className={`p-2 rounded-lg ${stat.bgColor} opacity-0 group-hover:opacity-100 transition-opacity duration-200`}>
                  <ArrowRightOnRectangleIcon className={`w-5 h-5 ${stat.textColor}`} />
                </div>
              </div>
              <div className="mt-4">
                <p className="text-2xl font-bold text-gray-900">{stat.value?.(stats) || '0'}</p>
                <p className="text-sm text-gray-500 mt-1">{stat.name}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Pipeline & Team Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline */}
        <div className="card p-6 animate-fade-in stagger-2">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Pipeline</h2>
            <Link to="/sponsors" className="text-sm text-primary-600 hover:underline font-medium">View all</Link>
          </div>
          <div className="space-y-3">
            {pipelineStages.map((stage, index) => {
              const count = (pipeline as unknown as Record<string, any[]>)?.[stage.key]?.length || 0;
              const total = Object.values(pipeline as unknown as Record<string, any[]>).reduce((sum: number, arr: any[]) => sum + arr.length, 0) || 1;
              const percentage = (count / total) * 100;
              return (
                <div key={stage.key} className="animate-fade-in" style={{ animationDelay: `${index * 0.05}s` }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${stage.iconBg}`}>
                        <stage.icon className={`w-5 h-5 ${stage.iconColor}`} />
                      </div>
                      <span className="font-medium text-gray-700">{stage.label}</span>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${stage.color}`}>
                      {count}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ease-out ${stage.color.replace('bg-', 'bg-').replace(' text-', '')}`}
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Team Performance */}
        <div className="card p-6 animate-fade-in stagger-3">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Team Performance</h2>
            <Link to="/settings" className="text-sm text-primary-600 hover:underline font-medium">Manage team</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Member</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Assigned</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Emails</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Interested</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Won</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(teamPerformance as unknown as any[])?.map((member: any, index: number) => (
                  <tr key={member.team_member_id} className="hover:bg-gray-50 animate-fade-in" style={{ animationDelay: `${index * 0.05}s` }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={`https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=0ea5e9&color=fff`}
                          alt={member.name}
                          className="w-8 h-8 rounded-full"
                        />
                        <span className="font-medium text-gray-900">{member.name}</span>
                      </div>
                    </td>
                    <td className="text-right px-4 py-3 text-gray-600">{member.assigned_sponsors}</td>
                    <td className="text-right px-4 py-3 text-gray-600">{member.emails_sent}</td>
                    <td className="text-right px-4 py-3 text-green-600 font-medium">{member.interested_sponsors}</td>
                    <td className="text-right px-4 py-3 text-green-600 font-medium">{member.sponsorships_won}</td>
                  </tr>
                )) || (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500 animate-fade-in">
                      <UsersIcon className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                      <p className="text-lg font-medium">No team members</p>
                      <p className="text-sm mt-1">Add team members to track performance</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card p-6 animate-fade-in stagger-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
          <Link to="/sponsors" className="text-sm text-primary-600 hover:underline font-medium">View all</Link>
        </div>
        <div className="space-y-3">
          {(stats as unknown as any)?.recent_activity?.slice(0, 5).map((activity: any, index: number) => (
            <div key={index} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors animate-fade-in" style={{ animationDelay: `${index * 0.05}s` }}>
              <div className="p-2 bg-primary-100 rounded-full">
                <ArrowPathIcon className="w-5 h-5 text-primary-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{activity.action}</p>
                <p className="text-xs text-gray-500 truncate">{activity.target} • {new Date(activity.timestamp).toLocaleString()}</p>
              </div>
            </div>
          )) || (
            <div className="text-center py-8 animate-fade-in">
              <ArrowPathIcon className="w-12 h-12 mx-auto text-gray-300 mb-2" />
              <p className="text-lg font-medium text-gray-500">No recent activity</p>
              <p className="text-sm text-gray-400 mt-1">Activity will appear here as you work with sponsors</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;