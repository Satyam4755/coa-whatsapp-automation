import { useEffect, useMemo, useRef, useState } from 'react';
import api, { clearAuthState } from '../../services/api';
import {
  MdAccessTime,
  MdArrowBack,
  MdCheck,
  MdDelete,
  MdDownload,
  MdError,
  MdPause,
  MdPlayArrow,
  MdRefresh,
  MdSchedule,
  MdSearch,
  MdStop,
  MdTrendingUp,
  MdVisibility
} from 'react-icons/md';
import { FiX } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Pagination } from '../ui/pagination';

const jobStatusLabels = {
  all: 'All',
  processing: 'Processing',
  completed: 'Completed',
  pending: 'Pending',
  failed: 'Failed',
  paused: 'Paused',
};

const recipientStatusLabels = {
  all: 'All',
  success: 'Successful',
  failed: 'Failed',
  pending: 'Pending',
  processing: 'Processing',
};

const JobMonitoringDashboard = ({ initialSelectedJobId = '', onSelectedJobChange }) => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [jobRecipients, setJobRecipients] = useState({});
  const [isConnected, setIsConnected] = useState(false);
  const [filters, setFilters] = useState({
    status: 'all',
    dateRange: 'all',
  });
  const [pagination, setPagination] = useState({
    currentPage: 0,
    itemsPerPage: 10,
    totalItems: 0
  });
  const [jobSearchTerm, setJobSearchTerm] = useState('');
  const [debouncedJobSearchTerm, setDebouncedJobSearchTerm] = useState('');
  const [recipientFilter, setRecipientFilter] = useState('all');
  const [recipientSearch, setRecipientSearch] = useState('');
  const [loadingRecipients, setLoadingRecipients] = useState({});
  const socketRef = useRef(null);

  const navigate = useNavigate();

  useEffect(() => {
    setSelectedJobId(initialSelectedJobId || null);
  }, [initialSelectedJobId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedJobSearchTerm(jobSearchTerm.trim());
    }, 350);

    return () => window.clearTimeout(timer);
  }, [jobSearchTerm]);

  useEffect(() => {
    const newSocket = io(import.meta.env.VITE_SERVER_URL || 'https://coa-whatsapp-mll6y.ondigitalocean.app', {
      transports: ['websocket']
    });
    socketRef.current = newSocket;

    newSocket.on('connect', () => {
      setIsConnected(true);
      if (selectedJobId) {
        newSocket.emit('subscribe-to-job', selectedJobId);
      }
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    newSocket.on('job-update', (update) => {
      setJobs((prevJobs) =>
        prevJobs.map((job) => (job.jobId === update.jobId ? { ...job, ...update } : job))
      );

      if (selectedJobId === update.jobId) {
        fetchJobRecipients(update.jobId, recipientFilter, recipientSearch);
      }
    });

    newSocket.on('job-status-change', (update) => {
      if (selectedJobId === update.jobId) {
        fetchJobRecipients(update.jobId, recipientFilter, recipientSearch);
      }

      if (update.status === 'completed') {
        toast.success(`Job completed. ${update.successCount}/${update.totalRecipients} messages sent successfully.`);
      } else if (update.status === 'failed') {
        toast.error(`Job ${update.jobId} failed.`);
      }
    });

    return () => {
      newSocket.close();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (socketRef.current && selectedJobId) {
      socketRef.current.emit('subscribe-to-job', selectedJobId);
    }
  }, [selectedJobId]);

  useEffect(() => {
    fetchJobs();
    fetchSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.status, filters.dateRange, pagination.currentPage, debouncedJobSearchTerm]);

  useEffect(() => {
    if (!selectedJobId) return;

    const timeoutId = window.setTimeout(() => {
      fetchJobRecipients(selectedJobId, recipientFilter, recipientSearch);
    }, 300);

    return () => window.clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedJobId, recipientFilter, recipientSearch]);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        status: filters.status,
        limit: pagination.itemsPerPage.toString(),
        skip: (pagination.currentPage * pagination.itemsPerPage).toString(),
        ...(debouncedJobSearchTerm && { templateName: debouncedJobSearchTerm }),
        ...(filters.dateRange !== 'all' && { dateRange: filters.dateRange })
      });

      const response = await api.get(`/admin/background-jobs?${queryParams}`);
      setJobs(response.data.jobs);
      setPagination((prev) => ({
        ...prev,
        totalItems: response.data.totalJobs
      }));
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        clearAuthState();
        navigate('/');
        return;
      }
      toast.error('Failed to fetch jobs');
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const response = await api.get('/admin/dashboard-summary');
      setSummary(response.data);
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        clearAuthState();
        navigate('/');
      }
    }
  };

  const fetchJobRecipients = async (jobId, status = 'all', search = '', limit = 100, skip = 0) => {
    try {
      setLoadingRecipients((prev) => ({ ...prev, [jobId]: true }));

      const queryParams = new URLSearchParams({
        status,
        limit: limit.toString(),
        skip: skip.toString(),
        ...(search && { search })
      });

      const response = await api.get(`/admin/job-details/${jobId}?${queryParams}`);
      setJobRecipients((prev) => ({
        ...prev,
        [jobId]: response.data
      }));

      if (socketRef.current) {
        socketRef.current.emit('subscribe-to-job', jobId);
      }
    } catch (error) {
      if (error.response?.status === 404 && selectedJobId === jobId) {
        setSelectedJobId(null);
        onSelectedJobChange?.('');
        toast.error('Job not found');
        return;
      }
      toast.error('Failed to fetch job recipients');
    } finally {
      setLoadingRecipients((prev) => ({ ...prev, [jobId]: false }));
    }
  };

  const handleJobAction = async (action, jobId) => {
    try {
      const response = await api.post(`/admin/${action}-job/${jobId}`, {});
      if (response.data.success) {
        toast.success(response.data.message);
        fetchJobs();
      }
    } catch {
      toast.error(`Failed to ${action} job`);
    }
  };

  const handleDeleteJob = async (jobId) => {
    if (!window.confirm('Are you sure you want to delete this job? This action cannot be undone.')) return;

    try {
      const response = await api.delete(`/admin/delete-job/${jobId}`);
      if (response.data.success) {
        toast.success('Job deleted successfully');
        fetchJobs();
        if (selectedJobId === jobId) {
          setSelectedJobId(null);
          onSelectedJobChange?.('');
        }
      }
    } catch {
      toast.error('Failed to delete job');
    }
  };

  const handleOpenJobDetails = (jobId) => {
    setRecipientFilter('all');
    setRecipientSearch('');
    setSelectedJobId(jobId);
    onSelectedJobChange?.(jobId);
  };

  const handleBackToJobs = () => {
    setSelectedJobId(null);
    setRecipientFilter('all');
    setRecipientSearch('');
    onSelectedJobChange?.('');
  };

  const exportJobRecipients = async (jobId, status = 'all') => {
    try {
      const response = await api.get(`/admin/job-details/${jobId}?status=${status}&limit=10000`);
      const recipients = response.data.recipients;
      const csvContent = [
        ['Name', 'Registration Number', 'Mobile', 'Status', 'Error', 'Sent At'],
        ...recipients.map((r) => [
          r.name,
          r.regNum,
          r.mobile,
          r.status,
          r.error || '',
          r.sentAt ? new Date(r.sentAt).toLocaleString() : ''
        ])
      ].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `job_${jobId}_${status}_recipients.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Recipients exported successfully');
    } catch {
      toast.error('Failed to export recipients');
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <MdCheck className="text-emerald-600" />;
      case 'processing': return <MdAccessTime className="animate-pulse text-blue-600" />;
      case 'pending': return <MdSchedule className="text-amber-600" />;
      case 'failed': return <MdError className="text-rose-600" />;
      case 'paused': return <MdPause className="text-slate-600" />;
      default: return <MdSchedule className="text-slate-400" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'border-emerald-200 bg-emerald-100 text-emerald-800';
      case 'processing': return 'border-blue-200 bg-blue-100 text-blue-800';
      case 'pending': return 'border-amber-200 bg-amber-100 text-amber-800';
      case 'failed': return 'border-rose-200 bg-rose-100 text-rose-800';
      case 'paused': return 'border-slate-200 bg-slate-100 text-slate-800';
      default: return 'border-slate-200 bg-slate-100 text-slate-600';
    }
  };

  const formatDate = (dateString) => new Date(dateString).toLocaleString();

  const formatDuration = (startDate, endDate) => {
    if (!endDate) return 'In progress...';
    const duration = (new Date(endDate) - new Date(startDate)) / 1000;
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    const seconds = Math.floor(duration % 60);

    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  };

  const totalPages = Math.max(1, Math.ceil(pagination.totalItems / pagination.itemsPerPage));
  const selectedJobDetails = selectedJobId ? jobRecipients[selectedJobId] : null;
  const selectedJob = useMemo(() => {
    if (!selectedJobId) return null;

    const listJob = jobs.find((job) => job.jobId === selectedJobId);
    if (listJob) return listJob;

    if (!selectedJobDetails) return null;

    const totalSuccess = selectedJobDetails.recipientCounts?.success || 0;
    const totalFailed = selectedJobDetails.recipientCounts?.failed || 0;
    const totalPending = selectedJobDetails.recipientCounts?.pending || 0;
    const totalProcessing = selectedJobDetails.recipientCounts?.processing || 0;
    const processedRecipients = totalSuccess + totalFailed + totalProcessing;

    return {
      jobId: selectedJobDetails.jobId,
      templateName: selectedJobDetails.templateName,
      status: selectedJobDetails.status,
      totalRecipients: selectedJobDetails.totalRecipients,
      processedRecipients,
      successCount: totalSuccess,
      failureCount: totalFailed,
      progress:
        selectedJobDetails.totalRecipients > 0
          ? Math.round((processedRecipients / selectedJobDetails.totalRecipients) * 100)
          : 0,
      createdAt: selectedJobDetails.createdAt,
      updatedAt: selectedJobDetails.updatedAt,
      completedAt: selectedJobDetails.completedAt,
    };
  }, [jobs, selectedJobDetails, selectedJobId]);
  const hasJobFilters = Boolean(
    filters.status !== 'all' ||
    filters.dateRange !== 'all' ||
    debouncedJobSearchTerm
  );
  const hasRecipientFilters = Boolean(
    recipientFilter !== 'all' || recipientSearch.trim()
  );

  const jobStatusCounts = useMemo(() => {
    const summaryCounts = Object.fromEntries(
      (summary?.statusBreakdown || []).map((item) => [item._id, item.count])
    );

    const counts = {
      all: summary?.totalJobs ?? pagination.totalItems ?? jobs.length,
      processing: summaryCounts.processing || 0,
      completed: summaryCounts.completed || 0,
      pending: summaryCounts.pending || 0,
      failed: summaryCounts.failed || 0,
      paused: summaryCounts.paused || 0,
    };

    return counts;
  }, [jobs.length, pagination.totalItems, summary]);

  const recipientStatusCounts = {
    all: selectedJobDetails?.recipients?.length || 0,
    success: selectedJobDetails?.recipientCounts?.success || 0,
    failed: selectedJobDetails?.recipientCounts?.failed || 0,
    pending: selectedJobDetails?.recipientCounts?.pending || 0,
    processing: selectedJobDetails?.recipientCounts?.processing || 0,
  };

  const clearJobFilters = () => {
    setFilters({
      status: 'all',
      dateRange: 'all',
    });
    setJobSearchTerm('');
    setDebouncedJobSearchTerm('');
    setPagination((prev) => ({ ...prev, currentPage: 0 }));
  };

  const clearRecipientFilters = () => {
    setRecipientFilter('all');
    setRecipientSearch('');
  };

  const renderFilterChip = (label, onClick) => (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700"
    >
      {label}
      <FiX className="h-3 w-3" />
    </button>
  );

  return (
    <div>
      <div>
        {selectedJobId ? (
          <>
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50">
                <MdVisibility className="h-4 w-4 text-blue-600" />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={handleBackToJobs}
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <MdArrowBack className="text-base" />
                  Back to Jobs
                </button>
                <div>
                  <h1 className="text-lg font-semibold leading-tight tracking-tight text-slate-950">{selectedJob?.templateName || 'Loading job...'}</h1>
                  <p className="mt-0.5 font-mono text-xs text-slate-500">{selectedJobId}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => exportJobRecipients(selectedJobId, 'all')}
                disabled={!selectedJobId}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
              >
                <MdDownload className="text-base" />
                Export All
              </button>
              <button
                onClick={() => exportJobRecipients(selectedJobId, 'failed')}
                disabled={!selectedJobId}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 text-sm font-medium text-rose-700 hover:bg-rose-100"
              >
                <MdDownload className="text-base" />
                Export Failed
              </button>
            </div>
          </div>

          <div className="mb-5 grid gap-4 md:grid-cols-3">
            <div className="relative overflow-hidden rounded-lg bg-blue-600 p-5 text-white shadow-[0_18px_40px_-20px_rgba(37,99,235,0.55)]">
              <div className="absolute inset-x-0 top-0 h-px bg-white/25" />
              <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/10 blur-3xl" />
              <div className="relative flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/14 text-white">
                      {getStatusIcon(selectedJob?.status)}
                    </div>
                    <div className="text-xs uppercase tracking-wide text-blue-100">Status</div>
                  </div>
                  <div className="mt-4 inline-flex items-center rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-blue-50 backdrop-blur-sm">
                    Job state
                  </div>
                </div>
                <div className="text-right">
                  <div className="rounded-lg bg-white/10 px-4 py-3 text-white backdrop-blur-sm">
                    <div className="text-lg font-semibold leading-none">
                      {selectedJob ? selectedJob.status.charAt(0).toUpperCase() + selectedJob.status.slice(1) : 'Loading'}
                    </div>
                    <div className="mt-2 text-xs font-medium text-blue-100">current status</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="relative overflow-hidden rounded-lg bg-blue-600 p-5 text-white shadow-[0_18px_40px_-20px_rgba(37,99,235,0.55)]">
              <div className="absolute inset-x-0 top-0 h-px bg-white/25" />
              <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/10 blur-3xl" />
              <div className="relative flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/14 text-white">
                      <MdVisibility className="h-5 w-5" />
                    </div>
                    <div className="text-xs uppercase tracking-wide text-blue-100">Recipients</div>
                  </div>
                  <div className="mt-4 inline-flex items-center rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-blue-50 backdrop-blur-sm">
                    Total audience
                  </div>
                </div>
                <div className="text-right">
                  <div className="rounded-lg bg-white/10 px-4 py-3 text-white backdrop-blur-sm">
                    <div className="text-3xl font-semibold leading-none">{selectedJob ? selectedJob.totalRecipients.toLocaleString() : '--'}</div>
                    <div className="mt-2 text-xs font-medium text-blue-100">targeted recipients</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="relative overflow-hidden rounded-lg bg-blue-600 p-5 text-white shadow-[0_18px_40px_-20px_rgba(37,99,235,0.55)]">
              <div className="absolute inset-x-0 top-0 h-px bg-white/25" />
              <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/10 blur-3xl" />
              <div className="relative flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/14 text-white">
                      <MdAccessTime className="h-5 w-5" />
                    </div>
                    <div className="text-xs uppercase tracking-wide text-blue-100">View Mode</div>
                  </div>
                  <div className="mt-4 inline-flex items-center rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-blue-50 backdrop-blur-sm">
                    Job detail
                  </div>
                </div>
                <div className="text-right">
                  <div className="rounded-lg bg-white/10 px-4 py-3 text-white backdrop-blur-sm">
                    <div className="text-lg font-semibold leading-none">Detail View</div>
                    <div className="mt-2 text-xs font-medium text-blue-100">
                      {selectedJob?.createdAt ? `Created ${formatDate(selectedJob.createdAt)}` : 'Loading details'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg">
            <div className="rounded-lg border border-slate-200 bg-white">
              <div className="flex flex-wrap items-center gap-4 border-b border-slate-200/80 p-3">
              <div className="flex min-w-[280px] flex-col gap-1.5">
                <div className="flex h-auto flex-wrap justify-start gap-1 rounded-md bg-slate-100 p-1">
                  {['all', 'success', 'failed', 'pending', 'processing'].map((status) => (
                    <button
                      key={status}
                      type="button"
                      className={`rounded px-3 py-1.5 text-sm font-medium ${
                        recipientFilter === status
                          ? 'bg-white text-slate-950 shadow-sm'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                      onClick={() => setRecipientFilter(status)}
                    >
                      {recipientStatusLabels[status]} ({recipientStatusCounts[status]})
                    </button>
                  ))}
                </div>
              </div>

              <div className="w-full max-w-[520px] sm:min-w-[360px]">
                <div className="relative">
                  <MdSearch className="absolute left-2 top-1/2 h-[14px] w-[14px] -translate-y-1/2 text-slate-400" />
                  <input
                    value={recipientSearch}
                    onChange={(event) => setRecipientSearch(event.target.value)}
                    placeholder="Search recipients..."
                    className="!h-9 !min-h-9 w-full !pl-8 !pr-8"
                  />
                  {recipientSearch && (
                    <button
                      type="button"
                      onClick={() => setRecipientSearch('')}
                      className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      aria-label="Clear search"
                    >
                      <FiX className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={clearRecipientFilters}
                className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 hover:bg-slate-50"
              >
                Clear
              </button>
              </div>

              {hasRecipientFilters && (
                <div className="px-2 pb-2 pt-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {recipientFilter !== 'all' &&
                      renderFilterChip(`Status: ${recipientStatusLabels[recipientFilter]}`, () => setRecipientFilter('all'))}
                    {recipientSearch.trim() &&
                      renderFilterChip(`Search: ${recipientSearch.trim()}`, () => setRecipientSearch(''))}
                  </div>
                </div>
              )}

              {loadingRecipients[selectedJobId] ? (
                <div className="py-10 text-center">
                  <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
                  <p className="mt-3 text-sm text-slate-600">Loading recipients...</p>
                </div>
              ) : selectedJobDetails ? (
                <>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Name</th>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Registration</th>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Mobile</th>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Status</th>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Error</th>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Sent At</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {selectedJobDetails.recipients.map((recipient, index) => (
                          <tr key={index} className="hover:bg-slate-50">
                            <td className="px-6 py-4 text-sm text-slate-900">{recipient.name}</td>
                            <td className="px-6 py-4 font-mono text-sm text-slate-500">{recipient.regNum}</td>
                            <td className="px-6 py-4 text-sm text-slate-500">{recipient.mobile}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                {getStatusIcon(recipient.status)}
                                <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusColor(recipient.status)}`}>
                                  {recipient.status}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-rose-600">{recipient.error || '-'}</td>
                            <td className="px-6 py-4 text-sm text-slate-500">
                              {recipient.sentAt ? formatDate(recipient.sentAt) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 bg-slate-50 px-6 py-4 text-sm text-slate-600">
                    <span>Showing {selectedJobDetails.recipients.length} recipients</span>
                    <div className="flex flex-wrap gap-4">
                      <span className="text-emerald-600">Success: {selectedJobDetails.recipientCounts.success}</span>
                      <span className="text-rose-600">Failed: {selectedJobDetails.recipientCounts.failed}</span>
                      <span className="text-amber-600">Pending: {selectedJobDetails.recipientCounts.pending}</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-8 text-center text-slate-500">No recipient data available</div>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50">
                <MdSchedule className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <h1 className="text-lg font-semibold leading-tight tracking-tight text-slate-950">Jobs</h1>
                <p className="mt-0.5 text-xs text-slate-500">
                  {hasJobFilters ? `${jobs.length} filtered jobs in workspace` : `${pagination.totalItems || jobs.length} jobs in workspace`}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isConnected && (
                <span className="inline-flex h-9 items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 text-sm font-medium text-emerald-700">
                  Live Updates
                </span>
              )}
              <button
                onClick={() => {
                  fetchJobs();
                  fetchSummary();
                }}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <MdRefresh className="text-lg" />
                Refresh
              </button>
            </div>
          </div>

          {summary && (
            <div className="mb-5 grid gap-4 md:grid-cols-3">
              <div className="relative overflow-hidden rounded-lg bg-blue-600 p-5 text-white shadow-[0_18px_40px_-20px_rgba(37,99,235,0.55)]">
                <div className="absolute inset-x-0 top-0 h-px bg-white/25" />
                <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/10 blur-3xl" />
                <div className="relative flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/14 text-white">
                        <MdSchedule className="h-5 w-5" />
                      </div>
                      <div className="text-xs uppercase tracking-wide text-blue-100">Total Jobs</div>
                    </div>
                    <div className="mt-4 inline-flex items-center rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-blue-50 backdrop-blur-sm">
                      Workspace total
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="rounded-lg bg-white/10 px-4 py-3 text-white backdrop-blur-sm">
                      <div className="text-3xl font-semibold leading-none">{summary.totalJobs}</div>
                      <div className="mt-2 text-xs font-medium text-blue-100">all jobs</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="relative overflow-hidden rounded-lg bg-blue-600 p-5 text-white shadow-[0_18px_40px_-20px_rgba(37,99,235,0.55)]">
                <div className="absolute inset-x-0 top-0 h-px bg-white/25" />
                <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/10 blur-3xl" />
                <div className="relative flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/14 text-white">
                        <MdVisibility className="h-5 w-5" />
                      </div>
                      <div className="text-xs uppercase tracking-wide text-blue-100">Rows Visible</div>
                    </div>
                    <div className="mt-4 inline-flex items-center rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-blue-50 backdrop-blur-sm">
                      {hasJobFilters ? 'Filtered current page' : 'Current page'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="rounded-lg bg-white/10 px-4 py-3 text-white backdrop-blur-sm">
                      <div className="text-3xl font-semibold leading-none">
                        {jobs.length}
                      </div>
                      <div className="mt-2 text-xs font-medium text-blue-100">
                        {hasJobFilters ? 'matching rows' : 'page rows'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="relative overflow-hidden rounded-lg bg-blue-600 p-5 text-white shadow-[0_18px_40px_-20px_rgba(37,99,235,0.55)]">
                <div className="absolute inset-x-0 top-0 h-px bg-white/25" />
                <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/10 blur-3xl" />
                <div className="relative flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/14 text-white">
                        <MdTrendingUp className="h-5 w-5" />
                      </div>
                      <div className="text-xs uppercase tracking-wide text-blue-100">Delivery Summary</div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-blue-100">
                      <span className="inline-flex items-center rounded-full bg-white/10 px-2.5 py-1 font-medium text-blue-50 backdrop-blur-sm">
                        {summary.totalMessagesSuccess || 0} successful
                      </span>
                      <span className="inline-flex items-center rounded-full bg-white/10 px-2.5 py-1 font-medium text-blue-50 backdrop-blur-sm">
                        {summary.totalMessagesFailed || 0} failed
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="rounded-lg bg-white/10 px-4 py-3 text-white backdrop-blur-sm">
                      <div className="text-3xl font-semibold leading-none">
                        {summary.totalMessagesAttempted > 0
                          ? `${Math.round((summary.totalMessagesSuccess / summary.totalMessagesAttempted) * 100)}%`
                          : '--'}
                      </div>
                      <div className="mt-2 text-xs font-medium text-blue-100">
                        {summary.totalMessagesAttempted || 0} total attempts
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-lg">
            <div className="rounded-lg border border-slate-200 bg-white">
              <div className="flex flex-wrap items-center gap-4 border-b border-slate-200/80 p-3">
              <div className="flex min-w-[280px] flex-col gap-1.5">
                <div className="flex h-auto flex-wrap justify-start gap-1 rounded-md bg-slate-100 p-1">
                  {['all', 'processing', 'completed', 'pending', 'failed', 'paused'].map((status) => (
                    <button
                      key={status}
                      type="button"
                      className={`rounded px-3 py-1.5 text-sm font-medium ${
                        filters.status === status
                          ? 'bg-white text-slate-950 shadow-sm'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                      onClick={() => setFilters((prev) => ({ ...prev, status }))}
                    >
                      {jobStatusLabels[status]} ({jobStatusCounts[status]})
                    </button>
                  ))}
                </div>
              </div>

              <div className="w-full max-w-[520px] sm:min-w-[360px]">
                <div className="relative">
                  <MdSearch className="absolute left-2 top-1/2 h-[14px] w-[14px] -translate-y-1/2 text-slate-400" />
                  <input
                    value={jobSearchTerm}
                    onChange={(event) => setJobSearchTerm(event.target.value)}
                    placeholder="Search template name, job id..."
                    className="!h-9 !min-h-9 w-full !pl-8 !pr-8"
                  />
                  {jobSearchTerm && (
                    <button
                      type="button"
                      onClick={() => {
                        setJobSearchTerm('');
                        setDebouncedJobSearchTerm('');
                      }}
                      className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      aria-label="Clear search"
                    >
                      <FiX className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="w-40">
                <Select
                  value={filters.dateRange}
                  onValueChange={(value) => setFilters((prev) => ({ ...prev, dateRange: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Time" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="week">This Week</SelectItem>
                    <SelectItem value="month">This Month</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <button
                type="button"
                onClick={clearJobFilters}
                className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 hover:bg-slate-50"
              >
                Clear
              </button>
              </div>

              {hasJobFilters && (
                <div className="px-2 pb-2 pt-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {filters.status !== 'all' &&
                      renderFilterChip(`Status: ${jobStatusLabels[filters.status]}`, () => setFilters((prev) => ({ ...prev, status: 'all' })))}
                    {filters.dateRange !== 'all' &&
                      renderFilterChip(`Date: ${filters.dateRange === 'today' ? 'Today' : filters.dateRange === 'week' ? 'This Week' : 'This Month'}`, () => setFilters((prev) => ({ ...prev, dateRange: 'all' })))}
                    {debouncedJobSearchTerm &&
                      renderFilterChip(`Search: ${debouncedJobSearchTerm}`, () => {
                        setJobSearchTerm('');
                        setDebouncedJobSearchTerm('');
                      })}
                  </div>
                </div>
              )}

              {jobs.length === 0 && !loading ? (
                <div className="px-6 py-10 text-center">
                  <p className="text-sm text-slate-500">
                    {hasJobFilters ? 'No jobs match the current filters.' : 'No jobs found.'}
                  </p>
                  {hasJobFilters && (
                    <button
                      type="button"
                      onClick={clearJobFilters}
                      className="mt-4 inline-flex h-9 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  {loading ? (
                    <div className="p-8 text-center">
                      <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
                      <p className="mt-4 text-slate-600">Loading jobs...</p>
                    </div>
                  ) : (
                    <>
                      <table className="min-w-full divide-y divide-slate-200">
                          <thead className="bg-slate-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Template & Job ID</th>
                              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Status</th>
                              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Recipients</th>
                              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Progress</th>
                              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Created</th>
                              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Duration</th>
                              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 bg-white">
                            {jobs.map((job) => (
                              <tr key={job.jobId} className="hover:bg-slate-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div>
                                    <div className="text-sm font-medium text-slate-900">{job.templateName || 'Unknown Template'}</div>
                                    <div className="font-mono text-sm text-slate-500">{job.jobId}</div>
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex items-center gap-2">
                                    {getStatusIcon(job.status)}
                                    <span className={`rounded-full border px-3 py-1 text-xs font-medium ${getStatusColor(job.status)}`}>
                                      {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                                  <div className="font-medium">{job.totalRecipients.toLocaleString()}</div>
                                  <div className="text-xs text-slate-500">
                                    <span className="text-emerald-600">Success {job.successCount}</span>
                                    <span className="mx-1">•</span>
                                    <span className="text-rose-600">Failed {job.failureCount}</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex items-center">
                                    <div className="mr-3 h-2 w-full rounded-full bg-slate-200">
                                      <div
                                        className="h-2 rounded-full bg-blue-600 transition-all duration-300"
                                        style={{ width: `${job.progress || 0}%` }}
                                      />
                                    </div>
                                    <span className="min-w-[3rem] text-sm font-medium text-slate-700">{job.progress || 0}%</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{formatDate(job.createdAt)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{formatDuration(job.createdAt, job.completedAt)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                  <div className="flex items-center gap-2">
                                    {job.status === 'processing' && (
                                      <button
                                        onClick={() => handleJobAction('pause', job.jobId)}
                                        className="text-amber-600 hover:text-amber-800"
                                        title="Pause Job"
                                      >
                                        <MdPause className="text-lg" />
                                      </button>
                                    )}
                                    {(job.status === 'paused' || job.status === 'failed') && (
                                      <button
                                        onClick={() => handleJobAction('resume', job.jobId)}
                                        className="text-emerald-600 hover:text-emerald-800"
                                        title="Resume Job"
                                      >
                                        <MdPlayArrow className="text-lg" />
                                      </button>
                                    )}
                                    {job.status !== 'completed' && (
                                      <button
                                        onClick={() => handleJobAction('cancel', job.jobId)}
                                        className="text-rose-600 hover:text-rose-800"
                                        title="Cancel Job"
                                      >
                                        <MdStop className="text-lg" />
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleOpenJobDetails(job.jobId)}
                                      className="text-slate-700 hover:text-slate-950"
                                      title="View Details"
                                    >
                                      <MdVisibility className="text-lg" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteJob(job.jobId)}
                                      className="text-slate-400 hover:text-rose-600"
                                      title="Delete Job"
                                    >
                                      <MdDelete className="text-lg" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                      {pagination.totalItems > 0 && (
                        <div className="border-t border-slate-200 bg-white px-6 py-3">
                          <div className="flex flex-col items-center justify-between gap-4 lg:flex-row">
                            <div className="text-sm text-slate-500">
                              Showing {pagination.currentPage * pagination.itemsPerPage + 1} to{' '}
                              {Math.min((pagination.currentPage + 1) * pagination.itemsPerPage, pagination.totalItems)} of{' '}
                              {pagination.totalItems} results
                            </div>

                            {totalPages > 1 && (
                              <div className="flex flex-wrap items-center justify-center gap-3">
                                <Pagination
                                  currentPage={pagination.currentPage + 1}
                                  totalPages={totalPages}
                                  onPageChange={(page) =>
                                    setPagination((prev) => ({ ...prev, currentPage: page - 1 }))
                                  }
                                  pageSize={pagination.itemsPerPage}
                                  onPageSizeChange={(nextPageSize) =>
                                    setPagination((prev) => ({
                                      ...prev,
                                      currentPage: 0,
                                      itemsPerPage: nextPageSize,
                                    }))
                                  }
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
      </div>
    </div>
  );
};

export default JobMonitoringDashboard;
