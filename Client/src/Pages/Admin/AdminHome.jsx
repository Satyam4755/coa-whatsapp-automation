import { useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { logout } from "../../utils/auth";
import FinalPreview from "../../Components/Admin/AdminAllTabs/FinalPreview";
import ListOfArchitects from "../../Components/Admin/AdminAllTabs/ListOfArchitects";
import MessageTemplates from "../../Components/Admin/AdminAllTabs/MessageTemplates";
import JobMonitoringDashboard from "../../Components/Admin/JobMonitoringDashboard";

const TAB_IDS = {
  architects: "List of architects",
  templates: "Message Templates",
  schedule: "Schedule",
  jobs: "Job Monitoring",
};

const TAB_PARAM_TO_ID = {
  architects: TAB_IDS.architects,
  templates: TAB_IDS.templates,
  schedule: TAB_IDS.schedule,
  jobs: TAB_IDS.jobs,
};

const TAB_ID_TO_PARAM = {
  [TAB_IDS.architects]: "architects",
  [TAB_IDS.templates]: "templates",
  [TAB_IDS.schedule]: "schedule",
  [TAB_IDS.jobs]: "jobs",
};

const AdminHome = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = useMemo(() => {
    const tabParam = searchParams.get("tab");
    return TAB_PARAM_TO_ID[tabParam] || TAB_IDS.architects;
  }, [searchParams]);

  const scheduleTemplateId = searchParams.get("templateId") || "";
  const selectedJobId = searchParams.get("jobId") || "";

  useEffect(() => {
    const normalizedParams = new URLSearchParams();
    const currentTabParam = searchParams.get("tab");
    const normalizedTab = TAB_PARAM_TO_ID[currentTabParam] ? currentTabParam : "architects";

    normalizedParams.set("tab", normalizedTab);

    if (normalizedTab === "schedule" && scheduleTemplateId) {
      normalizedParams.set("templateId", scheduleTemplateId);
    }

    if (normalizedTab === "jobs" && selectedJobId) {
      normalizedParams.set("jobId", selectedJobId);
    }

    if (normalizedParams.toString() !== searchParams.toString()) {
      setSearchParams(normalizedParams, { replace: true });
    }
  }, [scheduleTemplateId, searchParams, selectedJobId, setSearchParams]);

  const updateAdminUrl = (nextTab, options = {}) => {
    const params = new URLSearchParams();
    params.set("tab", TAB_ID_TO_PARAM[nextTab] || "architects");

    if (nextTab === TAB_IDS.schedule && options.templateId) {
      params.set("templateId", options.templateId);
    }

    if (nextTab === TAB_IDS.jobs && options.jobId) {
      params.set("jobId", options.jobId);
    }

    setSearchParams(params);
  };

  const goToNextTab = () => {
    updateAdminUrl(TAB_IDS.templates);
  };

  const goToScheduleTab = (templateId) => {
    updateAdminUrl(TAB_IDS.schedule, { templateId });
  };

  const goToJobsTab = (jobId) => {
    updateAdminUrl(TAB_IDS.jobs, { jobId });
  };

  const tabs = [
    { id: TAB_IDS.architects, label: "Architects" },
    { id: TAB_IDS.templates, label: "Templates" },
    { id: TAB_IDS.schedule, label: "Schedule" },
    { id: TAB_IDS.jobs, label: "Jobs" },
  ];

  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <div className="admin-brand">
          <span className="admin-brand-mark">COA</span>
          <span>WhatsApp Automation</span>
        </div>
        <button
          onClick={() => logout(navigate)}
          className="admin-secondary-button"
        >
          Logout
        </button>
      </header>

      <main className="admin-main">
        <nav className="admin-tabs" aria-label="Admin sections">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => updateAdminUrl(tab.id)}
              aria-current={activeTab === tab.id ? "page" : undefined}
              className={`admin-tab ${activeTab === tab.id ? "is-active" : ""}`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <section
          className={
            activeTab === TAB_IDS.architects ||
            activeTab === TAB_IDS.templates ||
            activeTab === TAB_IDS.jobs
              ? ""
              : "admin-panel"
          }
        >
          {activeTab === TAB_IDS.architects && (
            <ListOfArchitects goToNextTab={goToNextTab} />
          )}
          {activeTab === TAB_IDS.templates && (
            <MessageTemplates
              onSelectScheduleTemplate={goToScheduleTab}
              onNavigateToArchitects={() => updateAdminUrl(TAB_IDS.architects)}
            />
          )}
          {activeTab === TAB_IDS.schedule && (
            <FinalPreview
              templateId={scheduleTemplateId}
              onNavigateToArchitects={() => updateAdminUrl(TAB_IDS.architects)}
              onNavigateToTemplates={() => updateAdminUrl(TAB_IDS.templates)}
              onNavigateToJob={goToJobsTab}
              onInvalidTemplate={() => updateAdminUrl(TAB_IDS.templates)}
            />
          )}
          {activeTab === TAB_IDS.jobs && (
            <JobMonitoringDashboard
              initialSelectedJobId={selectedJobId}
              onSelectedJobChange={(jobId) => updateAdminUrl(TAB_IDS.jobs, { jobId })}
            />
          )}
        </section>
      </main>
    </div>
  );
};

export default AdminHome;
