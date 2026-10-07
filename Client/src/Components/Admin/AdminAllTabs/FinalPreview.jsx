import { useCallback, useEffect, useState } from "react";
import { FaCheck, FaClock, FaExclamationTriangle, FaTimes } from "react-icons/fa";
import { MdCode, MdGroups, MdVisibility } from "react-icons/md";
import { BeatLoader } from "react-spinners";
import { toast } from "sonner";
import api from "../../../services/api";
import { getSelectedUsers } from "../../../utils/selectedUsers";
import TemplateMobilePreview from "./TemplateMobilePreview";

const statusPillClassNames = {
  APPROVED: "bg-emerald-100 text-emerald-700",
  PENDING: "bg-amber-100 text-amber-700",
  REJECTED: "bg-rose-100 text-rose-700",
  MISSING_ON_META: "bg-orange-100 text-orange-700",
  PAUSED: "bg-slate-100 text-slate-700",
};

const FinalPreview = ({
  templateId,
  compact = false,
  onNavigateToArchitects,
  onNavigateToTemplates,
  onNavigateToJob,
  onInvalidTemplate,
}) => {
  const users = getSelectedUsers();

  const [finalMessage, setFinalMessage] = useState("");
  const [userMessages, setUserMessages] = useState([]);
  const [template, setTemplate] = useState();
  const [loaderActive, setLoaderActive] = useState(false);
  const [sendingResults, setSendingResults] = useState(null);
  const [messagesSent, setMessagesSent] = useState(false);
  const [templateStatusMeta, setTemplateStatusMeta] = useState({
    label: "Draft",
    className: "text-slate-500",
  });

  const fetchTemplate = useCallback(async () => {
    if (!templateId) {
      setTemplate(undefined);
      return;
    }

    try {
      const res = await api.get(`/template/${templateId}`);
      setTemplate(res?.data?.template);
    } catch (error) {
      setTemplate(undefined);

      if (error.response?.status === 404) {
        toast.error("Template not found");
        onInvalidTemplate?.();
        return;
      }

      toast.error("Failed to load template");
    }
  }, [onInvalidTemplate, templateId]);

  useEffect(() => {
    fetchTemplate();
  }, [fetchTemplate]);

  useEffect(() => {
    const status = (template?.status || "Draft").toUpperCase();
    const nextMeta = {
      APPROVED: {
        label: "Approved",
        className: "text-emerald-700",
      },
      PENDING: {
        label: "Pending",
        className: "text-amber-700",
      },
      REJECTED: {
        label: "Rejected",
        className: "text-rose-700",
      },
      MISSING_ON_META: {
        label: "Missing on Meta",
        className: "text-orange-700",
      },
      PAUSED: {
        label: "Paused",
        className: "text-slate-700",
      },
    }[status] || {
      label: template?.status || "Draft",
      className: "text-slate-500",
    };

    setTemplateStatusMeta(nextMeta);
  }, [template?.status]);

  useEffect(() => {
    const templateContent = template?.message;

    if (users.length > 0) {
      const previewUser = users[0];
      const message = templateContent?.replace(/{{(.*?)}}/g, (match, p1) => {
        return previewUser[p1.trim()] || `{{${p1.trim()}}}`;
      });

      const messages = users.map((user) => {
        const compiledMessage = templateContent?.replace(/{{(.*?)}}/g, (match, p1) => {
          return user[p1.trim()] || `{{${p1.trim()}}}`;
        });

        return { ...user, message: compiledMessage };
      });

      setUserMessages(messages);
      setFinalMessage(message);
    }
  }, [template, users]);

  const handleSend = async () => {
    setLoaderActive(true);
    setSendingResults(null);
    setMessagesSent(false);

    if (!templateId || users.length === 0) {
      setLoaderActive(false);
      toast.error("Template ID or architects data missing");
      return;
    }

    if (template?.status !== "APPROVED") {
      setLoaderActive(false);
      toast.error(`Template status is "${template?.status}". Only APPROVED templates can be sent.`);
      return;
    }

    const data = { templateId, allArchitects: users };

    try {
      const res = await api.post("/admin/create-background-job", data);

      if (res.data.success) {
        const {
          jobId,
          totalRecipients,
          validRecipients,
          invalidRecipients,
          estimatedDuration,
        } = res.data;

        toast.success(
          `Background job created. Job ID: ${jobId}. Processing ${validRecipients} valid recipients (${invalidRecipients} invalid).`,
          { duration: 8000 }
        );

        setSendingResults({
          jobId,
          totalRecipients,
          validRecipients,
          invalidRecipients,
          estimatedDuration,
          isBackgroundJob: true,
        });
        setMessagesSent(true);
        onNavigateToJob?.(jobId);
      } else {
        toast.error(`Failed to create background job: ${res.data.message || "Unknown error"}`);
      }

      setLoaderActive(false);
    } catch (error) {
      setLoaderActive(false);
      const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message;
      console.error("Error sending messages:", error.response?.data || error.message);
      toast.error(`Error sending messages: ${errorMessage}`);
    }
  };

  if (!templateId) {
    return (
      <div
        className={
          compact
            ? "rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-8"
            : "mt-10 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-10"
        }
      >
        <div className="space-y-4 text-center">
          <div>
            <p className="text-sm font-medium text-slate-900">
              {!users.length
                ? "Select architects before scheduling a job."
                : "Select a template before scheduling a job."}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {!users.length
                ? "Go back to architects, choose recipients, then continue to schedule."
                : "Go back to templates, choose one template, then continue to schedule."}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            {!users.length ? (
              <button
                type="button"
                onClick={() => onNavigateToArchitects?.()}
                className="inline-flex h-10 items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
              >
                Select Architects
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onNavigateToTemplates?.()}
                className="inline-flex h-10 items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
              >
                Select Template
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const templateStatus = template?.status || "Unknown";
  const headerComponent = (template?.components || []).find((component) => component.type === "HEADER");
  const footerComponent = (template?.components || []).find((component) => component.type === "FOOTER");
  const buttonComponent = (template?.components || []).find((component) => component.type === "BUTTONS");

  const previewCard = (
    <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Template Preview</h3>
          <p className="text-xs text-slate-500">WhatsApp rendering for the selected template.</p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            statusPillClassNames[templateStatus] || "bg-slate-100 text-slate-700"
          }`}
        >
          {templateStatus}
        </span>
      </div>

      <div className="mb-4 flex justify-end">
        <button
          onClick={handleSend}
          className={`flex h-10 min-w-36 items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-white ${
            templateStatus !== "APPROVED" || loaderActive
              ? "cursor-not-allowed bg-slate-400"
              : messagesSent
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-slate-950 hover:bg-slate-800"
          }`}
          disabled={loaderActive || templateStatus !== "APPROVED"}
          title={templateStatus !== "APPROVED" ? `Cannot send: Template status is ${templateStatus}` : ""}
        >
          {loaderActive ? <BeatLoader color="#ffffff" size={8} /> : messagesSent ? "Send Again" : "Send Messages"}
        </button>
      </div>

      <TemplateMobilePreview
        statusLabel={templateStatusMeta.label}
        statusClassName={templateStatusMeta.className}
        className="ml-auto"
        headerType={headerComponent ? headerComponent.format || "NONE" : "NONE"}
        headerText={headerComponent?.text || ""}
        headerImageUrl={
          template?.attachment?.secure_url ||
          headerComponent?.example?.preview_url ||
          ""
        }
        bodyText={finalMessage}
        footerText={footerComponent?.text || ""}
        buttons={buttonComponent?.buttons || []}
        variableCount={Object.keys(template?.variableMap || {}).length}
        previewText={finalMessage}
        previewSubtitle="Template preview"
      />

      {templateStatus !== "APPROVED" && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm text-slate-600">
            {templateStatus === "PENDING" && "Template is awaiting Meta approval."}
            {templateStatus === "REJECTED" && "Template was rejected by Meta."}
            {templateStatus === "MISSING_ON_META" && "Template is missing on Meta. Sync templates before sending."}
            {!["PENDING", "REJECTED", "MISSING_ON_META"].includes(templateStatus) &&
              "Only approved templates can be scheduled."}
          </p>
          {template?.rejection_reason && (
            <p className="mt-2 text-sm text-rose-600">Reason: {template.rejection_reason}</p>
          )}
        </div>
      )}
    </div>
  );

  const recipientsTable = (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Selected Architects</h3>
          <p className="text-xs text-slate-500">Recipients that will receive this template.</p>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
          {userMessages.length} selected
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Name</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Registration Number</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Date of Birth</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Validity Up To</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Mobile</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Email</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {userMessages.map((user, index) => (
              <tr key={index} className="align-top">
                <td className="px-4 py-3 text-slate-800">{user.archName}</td>
                <td className="px-4 py-3 text-slate-600">{user.archRegNum}</td>
                <td className="px-4 py-3 text-slate-600">{user.archdob}</td>
                <td className="px-4 py-3 text-slate-600">{user.archValidityUpTo}</td>
                <td className="px-4 py-3 text-slate-600">{user.Mobile || "N/A"}</td>
                <td className="px-4 py-3 text-slate-600">{user.Email || "N/A"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const sendingResultsCard = sendingResults ? (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      {sendingResults.isBackgroundJob ? (
        <>
          <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <FaClock className="text-blue-500" />
            Background Job Created
          </h3>

          <div className="mb-4 border-l-4 border-blue-500 bg-blue-50 p-4">
            <div className="flex items-start gap-3">
              <FaExclamationTriangle className="mt-1 flex-shrink-0 text-blue-500" />
              <div>
                <p className="mb-1 font-medium text-blue-900">Messages are being processed in the background.</p>
                <p className="text-sm text-blue-700">
                  Your messages will be sent automatically. Visit the <strong>Job Monitoring</strong> dashboard to
                  track real-time progress and see failed and successful messages.
                </p>
              </div>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-lg border bg-white p-3">
              <div className="text-2xl font-bold text-blue-600">{sendingResults.jobId}</div>
              <div className="text-sm text-gray-600">Job ID</div>
            </div>
            <div className="rounded-lg border bg-white p-3">
              <div className="text-2xl font-bold text-gray-900">{sendingResults.totalRecipients}</div>
              <div className="text-sm text-gray-600">Total Recipients</div>
            </div>
            <div className="rounded-lg border bg-white p-3">
              <div className="text-2xl font-bold text-green-600">{sendingResults.validRecipients}</div>
              <div className="text-sm text-gray-600">Valid Recipients</div>
            </div>
            <div className="rounded-lg border bg-white p-3">
              <div className="text-2xl font-bold text-red-600">{sendingResults.invalidRecipients}</div>
              <div className="text-sm text-gray-600">Invalid Recipients</div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-600">
            <FaClock className="text-gray-500" />
            <span>Estimated processing time: ~{sendingResults.estimatedDuration} seconds</span>
          </div>

          <div className="mt-4 rounded border border-yellow-200 bg-yellow-50 p-3">
            <p className="text-sm font-medium text-yellow-800">What happens next?</p>
            <ul className="mt-1 space-y-1 text-sm text-yellow-700">
              <li>Messages are sent automatically in the background</li>
              <li>Failed messages will be tracked and visible in Job Monitoring</li>
              <li>You&apos;ll receive real-time updates via WebSocket</li>
              <li>Check the Job Monitoring dashboard for detailed progress</li>
            </ul>
          </div>
        </>
      ) : (
        <>
          <h3 className="mb-3 text-lg font-semibold">Message Sending Results</h3>

          <div className="mb-4 flex gap-6">
            <div className="flex items-center gap-2">
              <FaCheck className="text-green-500" />
              <span>Successful: <strong>{sendingResults.successCount || 0}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <FaTimes className="text-red-500" />
              <span>Failed: <strong>{sendingResults.failureCount || 0}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <FaClock className="text-blue-500" />
              <span>Total: <strong>{(sendingResults.successCount || 0) + (sendingResults.failureCount || 0)}</strong></span>
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto">
            <table className="w-full border-collapse border border-gray-300 text-sm">
              <thead className="sticky top-0 bg-gray-200">
                <tr>
                  <th className="border border-gray-300 px-2 py-1">Name</th>
                  <th className="border border-gray-300 px-2 py-1">Mobile</th>
                  <th className="border border-gray-300 px-2 py-1">Status</th>
                  <th className="border border-gray-300 px-2 py-1">Details</th>
                </tr>
              </thead>
              <tbody>
                {sendingResults.results?.map((result, index) => (
                  <tr key={index} className={result.status === "success" ? "bg-green-50" : "bg-red-50"}>
                    <td className="border border-gray-300 px-2 py-1">{result.architect.archName}</td>
                    <td className="border border-gray-300 px-2 py-1">{result.architect.Mobile}</td>
                    <td className="border border-gray-300 px-2 py-1">
                      <div className="flex items-center gap-1">
                        {result.status === "success" ? (
                          <>
                            <FaCheck className="text-xs text-green-500" /> Success
                          </>
                        ) : (
                          <>
                            <FaTimes className="text-xs text-red-500" /> Failed
                          </>
                        )}
                      </div>
                    </td>
                    <td className="border border-gray-300 px-2 py-1">
                      {result.status === "success" ? (
                        <span className="text-green-600">Message sent successfully</span>
                      ) : (
                        <span className="text-xs text-red-600">
                          {typeof result.error === "string" ? result.error : result.error?.message || "Unknown error"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  ) : null;

  const hasSelectedArchitects = users.length > 0;
  const hasSelectedTemplate = Boolean(templateId);
  const summaryCards = !compact ? (
    <div className="mb-6 grid gap-4 md:grid-cols-3">
      <div className="relative overflow-hidden rounded-lg bg-blue-600 p-5 text-white shadow-[0_18px_40px_-20px_rgba(37,99,235,0.55)]">
        <div className="absolute inset-x-0 top-0 h-px bg-white/25" />
        <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/14 text-white">
                <MdGroups className="h-5 w-5" />
              </div>
              <div className="text-xs uppercase tracking-wide text-blue-100">Selected architects</div>
            </div>
            <div className="mt-4 inline-flex items-center rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-blue-50 backdrop-blur-sm">
              Schedule audience
            </div>
          </div>
          <div className="text-right">
            <div className="rounded-lg bg-white/10 px-4 py-3 text-white backdrop-blur-sm">
              <div className="text-3xl font-semibold leading-none">{users.length}</div>
              <div className="mt-2 text-xs font-medium text-blue-100">selected rows</div>
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
                <MdCode className="h-5 w-5" />
              </div>
              <div className="text-xs uppercase tracking-wide text-blue-100">Template</div>
            </div>
            <div className="mt-4 inline-flex items-center rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-blue-50 backdrop-blur-sm">
              {hasSelectedTemplate ? "Template selected" : "Selection required"}
            </div>
          </div>
          <div className="text-right">
            <div className="rounded-lg bg-white/10 px-4 py-3 text-white backdrop-blur-sm">
              <div className="text-lg font-semibold leading-none">
                {template?.name || "Not selected"}
              </div>
              <div className="mt-2 text-xs font-medium text-blue-100">
                {hasSelectedTemplate ? (template?.category || "ready") : "pick template"}
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
                <MdVisibility className="h-5 w-5" />
              </div>
              <div className="text-xs uppercase tracking-wide text-blue-100">Next Step</div>
            </div>
            <div className="mt-4 inline-flex items-center rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-blue-50 backdrop-blur-sm">
              {!hasSelectedArchitects
                ? "Architects required"
                : !hasSelectedTemplate
                  ? "Template required"
                  : "Ready to schedule"}
            </div>
          </div>
          <div className="text-right">
            {!hasSelectedArchitects ? (
              <button
                type="button"
                onClick={() => onNavigateToArchitects?.()}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-white px-4 text-sm font-medium text-blue-700 hover:bg-blue-50"
              >
                Select Architects
              </button>
            ) : !hasSelectedTemplate ? (
              <button
                type="button"
                onClick={() => onNavigateToTemplates?.()}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-white px-4 text-sm font-medium text-blue-700 hover:bg-blue-50"
              >
                Select Template
              </button>
            ) : (
              <div className="rounded-lg bg-white/10 px-4 py-3 text-white backdrop-blur-sm">
                <div className="text-lg font-semibold leading-none">Ready</div>
                <div className="mt-2 text-xs font-medium text-blue-100">send messages</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className={compact ? "space-y-6" : "mt-10 space-y-6"}>
      {summaryCards}
      {compact ? (
        <>
          {previewCard}
          {recipientsTable}
          {sendingResultsCard}
        </>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_420px]">
          <div className="space-y-6">
            {recipientsTable}
            {sendingResultsCard}
          </div>
          <div className="xl:sticky xl:top-6 xl:self-start">{previewCard}</div>
        </div>
      )}
    </div>
  );
};

export default FinalPreview;
