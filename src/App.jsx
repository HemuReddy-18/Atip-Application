// App.js
import { useState } from "react";
import ATIPDashboard        from "./Pages/ATIPDashboard/ATIPDashboard";
import ATIPAnalyticsDashboard from "./Pages/ATIPAnalyticsDashboard/ATIPAnalyticsDashboard";
import ReportDetailPage       from "./Pages/ReportDetailPage/ReportDetailPage";

function App() {
  // page: "upload" | "dashboard" | "detail"
  const [page,     setPage]     = useState("dashboard");
  const [reportId, setReportId] = useState(null);

  const goToDetail = (id) => {
    setReportId(id);
    setPage("detail");
  };

  const goBack = () => {
    setPage("dashboard");
    setReportId(null);
  };

  if (page === "detail") {
    return <ReportDetailPage reportId={reportId} onBack={goBack} />;
  }

  return (
    <>
      <ATIPDashboard />
      <ATIPAnalyticsDashboard onSelectReport={goToDetail} />
    </>
  );
}

export default App;