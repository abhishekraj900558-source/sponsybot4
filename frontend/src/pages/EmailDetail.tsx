import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  useEmail,
  useUpdateEmail,
  useSubmitEmailForApproval,
  useApproveEmail,
  useApproveAndSendEmail,
  useRejectEmail,
  useSendEmail,
  useRegenerateEmail,
} from '../hooks/useApi';
import {
  PencilIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  PaperAirplaneIcon,
  ChevronLeftIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns/format';

const statusColors: Record<string, string> = {
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
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');

  const { data: email, isLoading, refetch } = useEmail(emailId);
  const updateMutation = useUpdateEmail();
  const submitForApprovalMutation = useSubmitEmailForApproval();
  const approveMutation = useApproveEmail();
  const approveAndSendMutation = useApproveAndSendEmail();
  const rejectMutation = useRejectEmail();
  const sendMutation = useSendEmail();
  const regenerateMutation = useRegenerateEmail();

  useEffect(() => {
    if (email) {
      setEditSubject((email as any).subject || '');
      setEditBody((email as any).body || '');
    }
  }, [email]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateMutation.mutateAsync({
        id: emailId,
        data: { subject: editSubject, body: editBody },
      });
      setIsEditing(false);
      refetch();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to update email');
    }
  };

  const handleSubmitForApproval = async () => {
    try {
      await submitForApprovalMutation.mutateAsync(emailId);
      refetch();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to submit for approval');
    }
  };

  const handleApprove = async () => {
    try {
      await approveMutation.mutateAsync({ id: emailId, approverId: 1 });
      refetch();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to approve');
    }
  };

  const handleApproveAndSend = async () => {
    try {
      const res: any = await approveAndSendMutation.mutateAsync({ id: emailId, approverId: 1 });
      refetch();
      alert(
        `Email Approved & Sent!\nDaily Quota: ${res?.daily_quota?.sent_today ?? '?'}/${res?.daily_quota?.daily_limit ?? 40}`
      );
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to approve and send');
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
      alert('Approved email sent successfully!');
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

  const emailData = email as unknown as any;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"
          >
            <ChevronLeftIcon className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{emailData.subject}</h1>
            <p className="text-gray-600 text-sm">
              <Link
                to={`/sponsors/${emailData.sponsor_id}`}
                className="text-primary-600 hover:underline font-medium"
              >
                {emailData.sponsor?.name || emailData.sponsor_name || `Sponsor #${emailData.sponsor_id}`}
              </Link>{' '}
              &bull; {(emailData.email_type || 'initial').replace(/_/g, ' ')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              statusColors[emailData.status] || 'bg-gray-100 text-gray-700'
            }`}
          >
            {emailData.status}
          </span>
        </div>
      </div>

      {/* Email Content */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Outreach Stage</p>
              <p className="font-medium text-gray-900">
                {(emailData.email_type || 'initial').replace(/_/g, ' ')}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Human-in-the-Loop Gate</p>
              <p className="font-medium text-gray-900">
                {emailData.approved_at ? 'Organizer Approved' : 'Requires Organizer Review'}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Created</p>
              <p className="font-medium text-gray-900">
                {emailData.created_at
                  ? format(new Date(emailData.created_at), 'MMM d, yyyy HH:mm')
                  : ''}
              </p>
            </div>
            {emailData.sent_at && (
              <div className="md:col-span-3">
                <p className="text-gray-500">Sent Timestamp</p>
                <p className="font-medium text-gray-900">
                  {format(new Date(emailData.sent_at), 'MMM d, yyyy HH:mm')}
                </p>
              </div>
            )}
            {emailData.rejected_at && (
              <div className="md:col-span-3">
                <p className="text-red-600 text-sm">
                  Rejected: {emailData.rejection_reason}
                </p>
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
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Body (Personalize before approving) *
                </label>
                <textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  rows={14}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-mono"
                  required
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Edits
                </button>
              </div>
            </form>
          ) : (
            <div className="prose max-w-none">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Subject: {emailData.subject}
              </h3>
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 min-h-[200px] font-mono text-sm whitespace-pre-wrap">
                {emailData.body}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-gray-200 bg-gray-50 flex flex-wrap gap-3">
          {(emailData.status === 'Draft' ||
            emailData.status === 'Pending Approval' ||
            emailData.status === 'Approved') && (
            <>
              <button onClick={() => setIsEditing(true)} className="btn-secondary">
                <PencilIcon className="w-4 h-4 mr-2" />
                Edit Draft
              </button>
              <button
                onClick={handleRegenerate}
                disabled={regenerateMutation.isPending}
                className="btn-secondary"
              >
                <ArrowPathIcon className="w-4 h-4 mr-2" />
                Regenerate with AI
              </button>
            </>
          )}

          {emailData.status === 'Draft' && (
            <button
              onClick={handleSubmitForApproval}
              disabled={submitForApprovalMutation.isPending}
              className="btn-secondary"
            >
              Submit to Approval Queue
            </button>
          )}

          {(emailData.status === 'Draft' || emailData.status === 'Pending Approval') && (
            <>
              <button
                onClick={handleApprove}
                disabled={approveMutation.isPending}
                className="btn-secondary"
              >
                <CheckCircleIcon className="w-4 h-4 mr-2" />
                Approve Only
              </button>
              <button
                onClick={() => setShowRejectModal(true)}
                className="btn-secondary text-red-500"
              >
                <XCircleIcon className="w-4 h-4 mr-2" />
                Reject
              </button>
            </>
          )}

          {emailData.status === 'Approved' && (
            <button
              onClick={handleSend}
              disabled={sendMutation.isPending}
              className="btn-primary"
            >
              <PaperAirplaneIcon className="w-4 h-4 mr-2" />
              Send Approved Email
            </button>
          )}

          {(emailData.status === 'Draft' ||
            emailData.status === 'Pending Approval' ||
            emailData.status === 'Approved') && (
            <button
              onClick={handleApproveAndSend}
              disabled={approveAndSendMutation.isPending}
              className="btn-primary"
            >
              <PaperAirplaneIcon className="w-4 h-4 mr-2" />
              {approveAndSendMutation.isPending
                ? 'Approving & Sending...'
                : '⚡ 1-Click Approve & Send'}
            </button>
          )}

          <Link to={`/sponsors/${emailData.sponsor_id}`} className="btn-secondary ml-auto">
            <EyeIcon className="w-4 h-4 mr-2" />
            View Sponsor Tracker
          </Link>
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Reject Email Draft</h2>
              <button
                onClick={() => setShowRejectModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-gray-600 text-sm">
                Provide feedback so the organizer or AI can revise this draft:
              </p>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm"
                placeholder="Enter rejection reason..."
                required
              />
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowRejectModal(false);
                    setRejectReason('');
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  disabled={rejectMutation.isPending}
                  className="btn-primary"
                >
                  {rejectMutation.isPending ? 'Rejecting...' : 'Reject Draft'}
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