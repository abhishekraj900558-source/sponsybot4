import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useEmail, useUpdateEmail, useApproveEmail, useRejectEmail, useSendEmail, useRegenerateEmail } from '../hooks/useApi';
import {
  PencilIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  PaperAirplaneIcon,
  TrashIcon,
  ChevronLeftIcon,
  EyeIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns/format';

const statusColors = {
  Draft: 'bg-gray-100 text-gray-700',
  'Pending Approval': 'bg-yellow-100 text-yellow-800',
  Approved: 'bg-green-100 text-green-800',
  Sent: 'bg-blue-100 text-blue-800',
  Failed: 'bg-red-100 text-red-800',
  Rejected: 'bg-red-100 text-red-800',
};

export function EmailDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const emailId = parseInt(id || '0', 10);
  const [isEditing, setIsEditing] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const { data: email, isLoading, refetch } = useEmail(emailId);
    const updateMutation = useUpdateEmail();
  const approveMutation = useApproveEmail();
  const rejectMutation = useRejectEmail();
  const sendMutation = useSendEmail();
  const regenerateMutation = useRegenerateEmail();

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    // For demo, we'll just update locally
    setIsEditing(false);
    refetch();
  };

  const handleApprove = async () => {
    try {
      await approveMutation.mutateAsync({ id: emailId, approverId: 1 });
      refetch();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to approve');
    }
  };

  const handleReject = async () => {
    try {
      await rejectMutation.mutateAsync({ id: emailId, rejecterId: 1, reason: rejectReason });
      setShowRejectModal(false);
      setRejectReason('');
      refetch();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to reject');
    }
  };

  const handleSend = async () => {
    try {
      await sendMutation.mutateAsync(emailId);
      refetch();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to send');
    }
  };

  const handleRegenerate = async () => {
    try {
      await regenerateMutation.mutateAsync(emailId);
      refetch();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to regenerate');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

  if (!email) {
    return <div className="text-center py-12">Email not found</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 lg:hidden">
            <ChevronLeftIcon className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{(email as unknown as any).subject}</h1>
            <p className="text-gray-600">
              {(email as unknown as any).sponsor?.company_name || `Sponsor #${(email as unknown as any).sponsor_id}`} &bull; {(email as unknown as any).email_type.replace('_', ' ')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[(email as unknown as any).status as keyof typeof statusColors] || 'bg-gray-100 text-gray-700'}`}>
            {(email as unknown as any).status}
          </span>
        </div>
      </div>

      {/* Email Content */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Type</p>
              <p className="font-medium text-gray-900">{(email as unknown as any).email_type.replace('_', ' ')}</p>
            </div>
            <div>
              <p className="text-gray-500">Sender</p>
              <p className="font-medium text-gray-900">User #{(email as unknown as any).sender_id}</p>
            </div>
            <div>
              <p className="text-gray-500">Created</p>
              <p className="font-medium text-gray-900">{(email as unknown as any).created_at ? format(new Date((email as unknown as any).created_at), 'MMM d, yyyy HH:mm') : ''}</p>
            </div>
            {(email as unknown as any).approved_at && (
              <div className="md:col-span-3">
                <p className="text-gray-500">Approved</p>
                <p className="font-medium text-gray-900">{format(new Date((email as unknown as any).approved_at), 'MMM d, yyyy HH:mm')} by User #{(email as unknown as any).approved_by}</p>
              </div>
            )}
            {(email as unknown as any).sent_at && (
              <div className="md:col-span-3">
                <p className="text-gray-500">Sent</p>
                <p className="font-medium text-gray-900">{format(new Date((email as unknown as any).sent_at), 'MMM d, yyyy HH:mm')}</p>
              </div>
            )}
            {(email as unknown as any).rejected_at && (
              <div className="md:col-span-3">
                <p className="text-gray-500">Rejected</p>
                <p className="font-medium text-gray-900">{format(new Date((email as unknown as any).rejected_at), 'MMM d, yyyy HH:mm')} by User #{(email as unknown as any).rejected_by}</p>
                <p className="text-red-600 text-sm mt-1">Reason: {(email as unknown as any).rejection_reason}</p>
              </div>
            )}
          </div>
        </div>

        {/* Email Body */}
        <div className="p-6">
          {isEditing ? (
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject *</label>
                <input
                  defaultValue={(email as unknown as any).subject}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Body *</label>
                <textarea
                  defaultValue={(email as unknown as any).body}
                  rows={15}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button type="button" onClick={() => setIsEditing(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          ) : (
            <div className="prose max-w-none">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Subject: {(email as unknown as any).subject}</h3>
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 min-h-[200px] font-mono text-sm whitespace-pre-wrap">
                {(email as unknown as any).body}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-gray-200 bg-gray-50 flex flex-wrap gap-3">
          {(email as unknown as any).status === 'Draft' && (
            <>
              <button onClick={() => setIsEditing(true)} className="btn-secondary">
                <PencilIcon className="w-5 h-5 mr-2" />
                Edit
              </button>
              <button onClick={handleRegenerate} disabled={regenerateMutation.isPending} className="btn-secondary">
                <ArrowPathIcon className="w-5 h-5 mr-2" />
                Regenerate
              </button>
              <button onClick={handleApprove} disabled={approveMutation.isPending} className="btn-primary">
                <CheckCircleIcon className="w-5 h-5 mr-2" />
                Submit for Approval
              </button>
            </>
          )}

          {(email as unknown as any).status === 'Pending Approval' && (
            <>
              <button onClick={handleApprove} disabled={approveMutation.isPending} className="btn-primary">
                <CheckCircleIcon className="w-5 h-5 mr-2" />
                Approve
              </button>
              <button onClick={() => setShowRejectModal(true)} className="btn-secondary">
                <XCircleIcon className="w-5 h-5 mr-2" />
                Reject
              </button>
            </>
          )}

          {(email as unknown as any).status === 'Approved' && (
            <>
              <button onClick={handleSend} disabled={sendMutation.isPending} className="btn-primary">
                <PaperAirplaneIcon className="w-5 h-5 mr-2" />
                Send Email
              </button>
              <button onClick={() => setIsEditing(true)} className="btn-secondary">
                <PencilIcon className="w-5 h-5 mr-2" />
                Edit
              </button>
              <button onClick={handleRegenerate} disabled={regenerateMutation.isPending} className="btn-secondary">
                <ArrowPathIcon className="w-5 h-5 mr-2" />
                Regenerate
              </button>
            </>
          )}

          {(email as unknown as any).status === 'Sent' && (
            <>
              <button onClick={() => setIsEditing(true)} className="btn-secondary">
                <PencilIcon className="w-5 h-5 mr-2" />
                Create Follow-up
              </button>
              <Link to={`/sponsors/${(email as unknown as any).sponsor_id}`} className="btn-secondary">
                <EyeIcon className="w-5 h-5 mr-2" />
                View Sponsor
              </Link>
            </>
          )}

          {(email as unknown as any).status === 'Failed' && (
            <>
              <button onClick={handleRegenerate} disabled={regenerateMutation.isPending} className="btn-primary">
                <ArrowPathIcon className="w-5 h-5 mr-2" />
                Regenerate & Retry
              </button>
              <button onClick={() => setIsEditing(true)} className="btn-secondary">
                <PencilIcon className="w-5 h-5 mr-2" />
                Edit & Retry
              </button>
            </>
          )}

          {(email as unknown as any).status === 'Rejected' && (
            <>
              <button onClick={() => setIsEditing(true)} className="btn-primary">
                <PencilIcon className="w-5 h-5 mr-2" />
                Edit & Resubmit
              </button>
            </>
          )}
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Reject Email</h2>
              <button onClick={() => setShowRejectModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-gray-600">Please provide a reason for rejecting this email draft:</p>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Enter rejection reason..."
                required
              />
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button onClick={() => { setShowRejectModal(false); setRejectReason(''); }} className="btn-secondary">
                  Cancel
                </button>
                <button onClick={handleReject} disabled={rejectMutation.isPending} className="btn-primary">
                  {rejectMutation.isPending ? 'Rejecting...' : 'Reject'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EmailDetail;