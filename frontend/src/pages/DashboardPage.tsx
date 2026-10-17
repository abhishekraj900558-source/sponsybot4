import React from 'react';
import {
  useDashboardStats,
  useDashboardPipeline,
  useTeamPerformance,
  useDashboardFunnel,
  useSponsorshipBreakdown,
  useQuotaStatus,
} from '../hooks/useApi';
import { Link } from 'react-router-dom';
import {
  BuildingOfficeIcon,
  EnvelopeOpenIcon,
  CalendarDaysIcon,
  ArrowTrendingUpIcon,
  UsersIcon,
  ArrowRightOnRectangleIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  PlusIcon,
  CurrencyDollarIcon,
  SparklesIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';

const statCards = [
  {
    name: 'Total Sponsors',
    value: (stats: any) => stats?.total_sponsors ?? 0,
    icon: BuildingOfficeIcon,
    color: 'bg-blue-500',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-600',
    href: '/sponsors',
  },
  {
    name: 'Contacted & Follow-up',
    value: (stats: any) =>
      (stats?.by_status?.Contacted ?? 0) +
      (stats?.by_status?.['Follow-up'] ?? 0) +
      (stats?.by_status?.['Follow-up 1'] ?? 0) +
      (stats?.by_status?.['Follow-up 2'] ?? 0),
    icon: EnvelopeOpenIcon,
    color: 'bg-indigo-500',
    bgColor: 'bg-indigo-50',
    textColor: 'text-indigo-600',
    href: '/sponsors?status=Contacted',
  },
  {
    name: 'Interested Sponsors',
    value: (stats: any) =>
      (stats?.by_status?.Interested ?? 0) +
      (stats?.by_status?.['Meeting Requested'] ?? 0) +
      (stats?.by_status?.['Meeting Scheduled'] ?? 0),
    icon: CheckCircleIcon,
    color: 'bg-green-500',
    bgColor: 'bg-green-50',
    textColor: 'text-green-600',
    href: '/sponsors?status=Interested',
  },
  {
    name: 'Response Rate',
    value: (stats: any) => `${stats?.response_rate?.toFixed(1) ?? 0}%`,
    icon: ArrowTrendingUpIcon,
    color: 'bg-purple-500',
    bgColor: 'bg-purple-50',
    textColor: 'text-purple-600',
    href: '/emails',
  },
  {
    name: 'Funds Secured',
    value: (stats: any) =>
      `₹${Number(stats?.total_sponsorship_amount ?? 0).toLocaleString()}`,
    icon: CurrencyDollarIcon,
    color: 'bg-emerald-500',
    bgColor: 'bg-emerald-50',
    textColor: 'text-emerald-600',
    href: '/sponsors?status=Sponsorship%20Won',
  },
  {
    name: 'Virtual Meetings',
    value: (stats: any) => stats?.meetings_scheduled ?? 0,
    icon: CalendarDaysIcon,
    color: 'bg-orange-500',
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-600',
    href: '/meetings',
  },
];

const pipelineStages = [
  {
    key: 'Not Contacted',
    label: 'Not Contacted',
    color: 'bg-gray-100 text-gray-700',
    icon: ClockIcon,
    iconBg: 'bg-gray-100',
    iconColor: 'text-gray-600',
  },
  {
    key: 'Contacted',
    label: 'Contacted',
    color: 'bg-blue-100 text-blue-800',
    icon: EnvelopeOpenIcon,
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
  },
  {
    key: 'Follow-up',
    label: 'Follow-up (Max 2)',
    color: 'bg-yellow-100 text-yellow-800',
    icon: ArrowPathIcon,
    iconBg: 'bg-yellow-100',
    iconColor: 'text-yellow-600',
  },
  {
    key: 'Interested',
    label: 'Interested',
    color: 'bg-green-100 text-green-800',
    icon: CheckCircleIcon,
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600',
  },
  {
    key: 'Sponsorship Won',
    label: 'Sponsorship Won',
    color: 'bg-emerald-100 text-emerald-800',
    icon: CurrencyDollarIcon,
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
  },
  {
    key: 'Declined',
    label: 'Declined / Closed',
    color: 'bg-red-100 text-red-800',
    icon: XCircleIcon,
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
  },
];

export function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: pipeline } = useDashboardPipeline();
  const { data: teamPerformance } = useTeamPerformance();
  const { data: funnel } = useDashboardFunnel();
  const { data: breakdown } = useSponsorshipBreakdown();
  const { data: quotaData } = useQuotaStatus();

  if (statsLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 animate-fade-in">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent mb-4"></div>
        <p className="text-gray-500">Loading sponsorship outreach dashboard...</p>
      </div>
    );
  }

  const quota = quotaData as unknown as any;
  const emailQuota = quota?.email_daily_quota || {
    sent_today: (stats as any)?.emails_sent ?? 0,
    daily_limit: 40,
    remaining_today: 40,
    target_range: '20-40 emails/day',
  };
  const funnelData = (funnel as unknown as any)?.stages || [];
  const breakdownData = breakdown as unknown as any;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Sponsorship Outreach Command Center
          </h1>
          <p className="text-gray-600 mt-1 text-sm">
            Human-in-the-loop outreach tracker • Pipeline stages, response rates, secured benefits & free-tier quota
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link to="/emails" className="btn-secondary text-xs py-2 px-3.5">
            Review Approval Queue ({quota?.pending_human_approvals ?? (stats as any)?.emails_pending_approval ?? 0})
          </Link>
          <Link to="/sponsors" className="btn-primary text-xs py-2 px-3.5 group">
            <PlusIcon className="w-4 h-4 mr-1.5" />
            Manage Sponsors
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {statCards.map((stat, index) => (
          <Link
            key={stat.name}
            to={stat.href}
            className="block animate-fade-in"
            style={{ animationDelay: `${index * 0.04}s` }}
          >
            <div className="card-hover group p-5">
              <div className="flex items-center justify-between">
                <div className={`p-2.5 rounded-xl ${stat.color}`}>
                  <stat.icon className="w-5 h-5 text-white" />
                </div>
                <div
                  className={`p-1.5 rounded-lg ${stat.bgColor} opacity-0 group-hover:opacity-100 transition-opacity`}
                >
                  <ArrowRightOnRectangleIcon className={`w-4 h-4 ${stat.textColor}`} />
                </div>
              </div>
              <div className="mt-3">
                <p className="text-2xl font-bold text-gray-900">
                  {stat?.value?.(stats) ?? '0'}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{stat.name}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Daily Outgoing Email Quota & Smart Free-Tier API Meter */}
      <div className="card p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary-100 text-primary-600">
              <ShieldCheckIcon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">
                Smart Free-Tier Quota & Daily Outgoing Email Governor ({emailQuota.target_range})
              </h2>
              <p className="text-xs text-gray-500">
                Uses 100% free APIs (Gemini, Tavily, Hunter/Apollo) and enforces a 40 emails/day cap + max 2 follow-ups per sponsor.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs">
            <div className="px-3 py-2 rounded-lg bg-gray-50 border border-gray-200">
              <span className="text-gray-500 block">Outgoing Today</span>
              <span className="font-bold text-sm text-gray-900">
                {emailQuota.sent_today} / {emailQuota.daily_limit} emails
              </span>
            </div>
            <div className="px-3 py-2 rounded-lg bg-gray-50 border border-gray-200">
              <span className="text-gray-500 block">Pending Organizer Approval</span>
              <span className="font-bold text-sm text-amber-500">
                {quota?.pending_human_approvals ?? (stats as any)?.emails_pending_approval ?? 0} drafts
              </span>
            </div>
            <div className="px-3 py-2 rounded-lg bg-gray-50 border border-gray-200">
              <span className="text-gray-500 block">Follow-Up Cap</span>
              <span className="font-bold text-sm text-green-500">Max 2 / Sponsor</span>
            </div>
          </div>
        </div>
      </div>

      {/* Pipeline & Team Ownership */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline Stages */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Sponsorship Pipeline Stages</h2>
              <p className="text-xs text-gray-500">Real-time status breakdown across all tracked companies</p>
            </div>
            <Link to="/sponsors" className="text-xs text-primary-600 hover:underline font-medium">
              Open Tracker →
            </Link>
          </div>
          <div className="space-y-3.5">
            {pipelineStages.map((stage) => {
              const pipeObj = (pipeline ?? {}) as Record<string, any[]>;
              let count = pipeObj[stage.key]?.length || 0;
              if (stage.key === 'Follow-up') {
                count +=
                  (pipeObj['Follow-up 1']?.length || 0) + (pipeObj['Follow-up 2']?.length || 0);
              }
              if (stage.key === 'Declined') {
                count += pipeObj['Closed']?.length || 0;
              }
              const total =
                Object.values(pipeObj).reduce(
                  (sum: number, arr: any) => sum + (Array.isArray(arr) ? arr.length : 0),
                  0
                ) || 1;
              const percentage = Math.min(100, (count / total) * 100);
              return (
                <div key={stage.key}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2.5">
                      <div className={`p-1.5 rounded-lg ${stage.iconBg}`}>
                        <stage.icon className={`w-4 h-4 ${stage.iconColor}`} />
                      </div>
                      <span className="text-sm font-medium text-gray-700">{stage.label}</span>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${stage.color}`}>
                      {count}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary-600 transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Team Performance & Duplicate Prevention Ownership */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Organizer Ownership & Team Performance
              </h2>
              <p className="text-xs text-gray-500">
                Tracks who contacted which company so two members never contact the same sponsor
              </p>
            </div>
            <Link to="/settings" className="text-xs text-primary-600 hover:underline font-medium">
              Manage Team →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase">
                    Organizer
                  </th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase">
                    Owned
                  </th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase">
                    Emails Sent
                  </th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase">
                    Interested
                  </th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase">
                    Deals Won
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {Array.isArray(teamPerformance) && teamPerformance.length > 0 ? (
                  teamPerformance.map((member: any) => (
                    <tr key={member.team_member_id} className="hover:bg-gray-50 text-sm">
                      <td className="px-3 py-3 font-medium text-gray-900">{member.name}</td>
                      <td className="text-right px-3 py-3 text-gray-600">
                        {member.assigned_sponsors}
                      </td>
                      <td className="text-right px-3 py-3 text-gray-600">{member.emails_sent}</td>
                      <td className="text-right px-3 py-3 text-green-600 font-semibold">
                        {member.interested_sponsors}
                      </td>
                      <td className="text-right px-3 py-3 text-emerald-600 font-semibold">
                        {member.sponsorships_won}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      <UsersIcon className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                      <p className="text-sm font-medium">No organizers added yet</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Conversion Funnel & Recommended Ask Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Outreach Conversion Funnel</h2>
          {funnelData.length > 0 ? (
            <div className="space-y-3">
              {funnelData.map((stage: any, idx: number) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-200"
                >
                  <span className="text-sm font-medium text-gray-900">{stage.stage}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-gray-900">{stage.count}</span>
                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-primary-100 text-primary-700">
                      {stage.conversion_rate ?? stage.percentage ?? 0}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Funnel metrics populate as outreach progresses.</p>
          )}
        </div>

        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <SparklesIcon className="w-5 h-5 text-primary-600" />
            Recommended Sponsorship Ask Breakdown
          </h2>
          {breakdownData?.by_recommended_type &&
          Object.keys(breakdownData.by_recommended_type).length > 0 ? (
            <div className="space-y-2.5">
              {Object.entries(breakdownData.by_recommended_type).map(
                ([type, count]: [string, any]) => (
                  <div
                    key={type}
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-200"
                  >
                    <span className="text-sm font-medium text-gray-900">{type}</span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary-100 text-primary-700">
                      {count} companies
                    </span>
                  </div>
                )
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              Click "Research & Prioritize All" on the Sponsors page to categorize companies into Cash, Goodies/Swag, and Cloud/Infrastructure tiers.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;