import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../services/api';
import {
  MdCheck,
  MdDelete,
  MdError,
  MdHourglass,
  MdPause,
  MdPlayArrow,
  MdRefresh,
  MdSchedule,
  MdStop,
  MdVisibility
} from 'react-icons/md';
import { io } from 'socket.io-client';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

const BulkJobDashboard = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  const [jobDetails, setJobDetails] = useState(null);
  const [filter, setFilter] = useState('all');
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);

  const fetchJobDetails = useCallback(async (jobId) => {
    try {
      const response = await api.get(`/admin/job-details/${jobId}`);
      setJobDetails(response.data);

      // Subscribe to real-time updates for this job
      if (socketRef.current) {
        socketRef.current.emit('subscribe-to-job', jobId);
      }
    } catch {
      toast.error('Failed to fetch job details');
    }
  }, []);

  const fetchJobs = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get(`/admin/background-jobs?status=${filter}`);
      setJobs(response.data.jobs);
    } catch {
      toast.error('Failed to fetch jobs');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  const fetchSummary = useCallback(async () => {
    try {
      const response = await api.get('/admin/dashboard-summary');
      setSummary(response.data);
    } catch (error) {
      console.error('Failed to fetch summary:', error);
    }
  }, []);

  // Initialize WebSocket connection
  useEffect(() => {
    const newSocket = io(import.meta.env.VITE_SERVER_URL || 'http://localhost:8080', {
      transports: ['websocket']
    });

    newSocket.on('connect', () => {
      console.log('📡 Connected to real-time updates');
      setIsConnected(true);
      socketRef.current = newSocket;
    });

    newSocket.on('disconnect', () => {
      console.log('📡 Disconnected from real-time updates');
      setIsConnected(false);
    });

    // Listen for job updates
    newSocket.on('job-update', (update) => {
      console.log('📊 Real-time update:', update);

      // Update jobs list
      setJobs(prevJobs =>
        prevJobs.map(job =>
          job.jobId === update.jobId
            ? { ...job, ...update }
            : job
        )
      );

      // Update selected job details if viewing
      if (selectedJob === update.jobId) {
        setSelectedJob(update.jobId);
        fetchJobDetails(update.jobId);
      }
    });

    newSocket.on('job-status-change', (update) => {
      // Show toast notification for status changes
      if (update.status === 'completed') {
        toast.success(`✅ Job ${update.jobId} completed! ${update.successCount}/${update.totalRecipients} messages sent successfully.`);
      } else if (update.status === 'failed') {
        toast.error(`❌ Job ${update.jobId} failed.`);
      }
    });

    return () => {
      socketRef.current = null;
      newSocket.close();
    };
  }, [fetchJobDetails, selectedJob]);

  // Fetch initial data
  useEffect(() => {
    fetchJobs();
    fetchSummary();
  }, [fetchJobs, fetchSummary]);

  const handleJobAction = async (action, jobId) => {
    try {
      const response = await api.post(`/admin/${action}-job/${jobId}`, {});

      if (response.data.success) {
        toast.success(response.data.message);
        fetchJobs();
        if (selectedJob === jobId) {
          fetchJobDetails(jobId);
        }
      }
    } catch {
      toast.error(`Failed to ${action} job`);
    }
  };

  const handleDeleteJob = async (jobId) => {
    if (!confirm('Are you sure you want to delete this job?')) return;

    try {
      const response = await api.delete(`/admin/delete-job/${jobId}`);

      if (response.data.success) {
        toast.success('Job deleted successfully');
        fetchJobs();
        if (selectedJob === jobId) {
          setSelectedJob(null);
          setJobDetails(null);
        }
      }
    } catch {
      toast.error('Failed to delete job');
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <MdCheck className="text-green-600" />;
      case 'processing': return <MdHourglass className="text-blue-600 animate-pulse" />;
      case 'pending': return <MdSchedule className="text-yellow-600" />;
      case 'failed': return <MdError className="text-red-600" />;
      case 'paused': return <MdPause className="text-gray-600" />;
      default: return <MdSchedule className="text-gray-400" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'paused': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Bulk Message Dashboard
            </h1>
            <p className="text-gray-600">
              Monitor and manage your bulk WhatsApp messaging jobs
              {isConnected && (
                <span className="inline-flex items-center px-2 py-1 ml-2 text-xs text-green-800 bg-green-100 rounded-full">
                  🟢 Live Updates
                </span>
              )}
            </p>
          </div>
          <button
            onClick={() => {
              fetchJobs();
              fetchSummary();
            }}
            className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <MdRefresh /> Refresh
          </button>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 gap-4 mb-6 md:grid-cols-4">
            <div className="p-6 bg-white rounded-lg shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900">Total Jobs</h3>
              <p className="text-3xl font-bold text-blue-600">{summary.totalJobs}</p>
            </div>
            <div className="p-6 bg-white rounded-lg shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900">Messages Sent</h3>
              <p className="text-3xl font-bold text-green-600">{summary.totalMessagesSuccess}</p>
            </div>
            <div className="p-6 bg-white rounded-lg shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900">Messages Failed</h3>
              <p className="text-3xl font-bold text-red-600">{summary.totalMessagesFailed}</p>
            </div>
            <div className="p-6 bg-white rounded-lg shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900">Success Rate</h3>
              <p className="text-3xl font-bold text-purple-600">
                {summary.totalMessagesAttempted > 0
                  ? Math.round((summary.totalMessagesSuccess / summary.totalMessagesAttempted) * 100)
                  : 0}%
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Jobs List */}
          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Jobs</h2>
                <Select
                  value={filter}
                  onValueChange={setFilter}
                >
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="overflow-y-auto max-h-96">
              {loading ? (
                <div className="p-4 text-center">
                  <div className="w-8 h-8 mx-auto border-b-2 border-blue-600 rounded-full animate-spin"></div>
                </div>
              ) : jobs.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  No jobs found
                </div>
              ) : (
                jobs.map((job) => (
                  <div
                    key={job.jobId}
                    className={`p-4 border-b cursor-pointer hover:bg-gray-50 ${
                      selectedJob === job.jobId ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                    }`}
                    onClick={() => {
                      setSelectedJob(job.jobId);
                      fetchJobDetails(job.jobId);
                    }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {job.templateName || 'Unknown Template'}
                        </h3>
                        <p className="text-sm text-gray-600">
                          Job ID: {job.jobId}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(job.status)}
                        <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(job.status)}`}>
                          {job.status}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-between mb-2 text-sm text-gray-600">
                      <span>{job.totalRecipients} recipients</span>
                      <span>Created: {new Date(job.createdAt).toLocaleString()}</span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-2 mb-2 bg-gray-200 rounded-full">
                      <div
                        className="h-2 bg-blue-600 rounded-full"
                        style={{ width: `${job.progress || 0}%` }}
                      ></div>
                    </div>

                    <div className="flex justify-between text-sm">
                      <span className="text-green-600">✓ {job.successCount}</span>
                      <span className="text-red-600">✗ {job.failureCount}</span>
                      <span className="text-blue-600">{job.progress || 0}%</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Job Details */}
          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-4 border-b">
              <h2 className="text-xl font-semibold">Job Details</h2>
            </div>

            {!selectedJob ? (
              <div className="p-8 text-center text-gray-500">
                <MdVisibility className="mx-auto mb-4 text-4xl" />
                <p>Select a job to view details</p>
              </div>
            ) : !jobDetails ? (
              <div className="p-4 text-center">
                <div className="w-8 h-8 mx-auto border-b-2 border-blue-600 rounded-full animate-spin"></div>
              </div>
            ) : (
              <div className="p-4">
                <div className="mb-4">
                  <h3 className="mb-2 text-lg font-semibold">
                    {jobDetails.templateName}
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Status:</span>
                      <span className={`ml-2 px-2 py-1 rounded-full text-xs ${getStatusColor(jobDetails.status)}`}>
                        {jobDetails.status}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Progress:</span>
                      <span className="ml-2 font-semibold">{Math.round((jobDetails.recipientCounts.success + jobDetails.recipientCounts.failed) / jobDetails.totalRecipients * 100)}%</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Total Recipients:</span>
                      <span className="ml-2 font-semibold">{jobDetails.totalRecipients}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Success Rate:</span>
                      <span className="ml-2 font-semibold text-green-600">
                        {jobDetails.recipientCounts.success > 0
                          ? Math.round((jobDetails.recipientCounts.success / (jobDetails.recipientCounts.success + jobDetails.recipientCounts.failed)) * 100)
                          : 0}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 mb-4">
                  {jobDetails.status === 'processing' && (
                    <button
                      onClick={() => handleJobAction('pause', selectedJob)}
                      className="flex items-center gap-1 px-3 py-1 text-sm text-white bg-yellow-600 rounded hover:bg-yellow-700"
                    >
                      <MdPause /> Pause
                    </button>
                  )}
                  {(jobDetails.status === 'paused' || jobDetails.status === 'failed') && (
                    <button
                      onClick={() => handleJobAction('resume', selectedJob)}
                      className="flex items-center gap-1 px-3 py-1 text-sm text-white bg-green-600 rounded hover:bg-green-700"
                    >
                      <MdPlayArrow /> Resume
                    </button>
                  )}
                  {jobDetails.status !== 'completed' && (
                    <button
                      onClick={() => handleJobAction('cancel', selectedJob)}
                      className="flex items-center gap-1 px-3 py-1 text-sm text-white bg-red-600 rounded hover:bg-red-700"
                    >
                      <MdStop /> Cancel
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteJob(selectedJob)}
                    className="flex items-center gap-1 px-3 py-1 text-sm text-white bg-gray-600 rounded hover:bg-gray-700"
                  >
                    <MdDelete /> Delete
                  </button>
                </div>

                {/* Recipient Status Breakdown */}
                <div className="space-y-2">
                  <h4 className="font-semibold">Recipient Status:</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-green-600">✓ Success:</span>
                      <span className="font-semibold">{jobDetails.recipientCounts.success}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-red-600">✗ Failed:</span>
                      <span className="font-semibold">{jobDetails.recipientCounts.failed}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-600">⏳ Processing:</span>
                      <span className="font-semibold">{jobDetails.recipientCounts.processing}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-yellow-600">⏰ Pending:</span>
                      <span className="font-semibold">{jobDetails.recipientCounts.pending}</span>
                    </div>
                  </div>
                </div>

                {/* Recent Recipients */}
                {jobDetails.recipients && jobDetails.recipients.length > 0 && (
                  <div className="mt-4">
                    <h4 className="mb-2 font-semibold">Recent Recipients:</h4>
                    <div className="overflow-y-auto max-h-40">
                      {jobDetails.recipients.map((recipient, index) => (
                        <div key={index} className="flex items-center justify-between py-1 text-sm border-b">
                          <div>
                            <span className="font-medium">{recipient.name}</span>
                            <span className="ml-2 text-gray-600">({recipient.mobile})</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {getStatusIcon(recipient.status)}
                            <span className={`px-2 py-1 rounded text-xs ${getStatusColor(recipient.status)}`}>
                              {recipient.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulkJobDashboard;
