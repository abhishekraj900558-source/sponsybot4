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
} from '@heroicons/react/24/outline';
import { formatNumber } from '../utils/format';

const statCards = [
  {
    name: 'Total Sponsors',
    value: (stats: any) => stats.total_sponsors,
    icon: BuildingOfficeIcon,
    color: 'bg-blue-500',
    href: '/sponsors',
  },
  {
    name: 'Contacted',
    value: (stats: any) => stats.by_status?.Contacted || 0,
    icon: EnvelopeOpenIcon,
    color: 'bg-blue-500',
    href: '/sponsors?status=Contacted',
  },
  {
    name: 'Interested',
    value: (stats: any) => stats.by_status?.Interested || 0,
    icon: BuildingOfficeIcon,
    color: 'bg-green-500',
    href: '/sponsors?status=Interested',
  },
  {
    name: 'Declined',
    value: (stats: any) => stats.by_status?.Declined || 0,
    icon: ArrowRightOnRectangleIcon,
    color: 'bg-red-500',
    href: '/sponsors?status=Declined',
  },
  {
    name: 'Response Rate',
    value: (stats: any) => `${stats.response_rate?.toFixed(1) || 0}%`,
    icon: EnvelopeOpenIcon,
    color: 'bg-purple-500',
    href: '/sponsors',
  },
  {
    name: 'Meetings',
    value: (stats: any) => stats.meetings_scheduled || 0,
    icon: CalendarDaysIcon,
    color: 'bg-orange-500',
    href: '/meetings',
  },
];

const pipelineStages = [
  { key: 'Not Contacted', label: 'Not Contacted', color: 'bg-gray-100 text-gray-700' },
  { key: 'Contacted', label: 'Contacted', color: 'bg-blue-100 text-blue-800' },
  { key: 'Follow-up', label: 'Follow-up', color: 'bg-yellow-100 text-yellow-800' },
  { key: 'Interested', label: 'Interested', color: 'bg-green-100 text-green-800' },
  { key: 'Declined', label: 'Declined', color: 'bg-red-100 text-red-800' },
  { key: 'Closed', label: 'Closed', color: 'bg-gray-100 text-gray-800' },
];

export function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: pipeline } = useDashboardPipeline();
  const { data: teamPerformance } = useTeamPerformance();

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Overview of your sponsorship pipeline</p>
        </div>
        <div className="flex gap-3">
          <a href="/sponsors" className="btn-primary">Add Sponsor</a>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {statCards.map((stat) => (
          <Link key={stat.name} to={stat.href} className="block">
            <div className="bg-white p-6 rounded-xl border border-gray-200 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className={`p-3 rounded-xl ${stat.color}`}>
                  <stat.icon className="w-6 h-6 text-white" />
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
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Pipeline</h2>
            <Link to="/sponsors" className="text-sm text-primary-600 hover:underline">View all</Link>
          </div>
          <div className="space-y-4">
            {pipelineStages.map((stage) => {
              const count = (pipeline as unknown as Record<string, any[]>)?.[stage.key]?.length || 0;
              return (
                <div key={stage.key} className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-lg">
                  <span className="font-medium text-gray-700">{stage.label}</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${stage.color}`}>
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Team Performance */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Team Performance</h2>
            <Link to="/settings" className="text-sm text-primary-600 hover:underline">Manage team</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Member</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Assigned</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Emails</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-winter">Interested</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Won</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(teamPerformance as unknown as any[])?.map((member: any) => (
                  <tr key={member.team_member_id} className="hover:bg-gray-50">
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
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">No team members</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
          <Link to="/sponsors" className="text-sm text-primary-600 hover:underline">View all</Link>
        </div>
        <div className="space-y-4">
          {(stats as unknown as any)?.recent_activity?.slice(0, 5).map((activity: any, index: number) => (
            <div key={index} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
              <div className="p-2 bg-primary-100 rounded-full">
                <ArrowPathIcon className="w-5 h-5 text-primary-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{activity.action}</p>
                <p className="text-xs text-gray-500">{activity.target} &bull; {new Date(activity.timestamp).toLocaleString()}</p>
              </div>
            </div>
          )) || (
            <p className="text-center text-gray-500 py-8">No recent activity</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;