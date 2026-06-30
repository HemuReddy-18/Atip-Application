import React, { useState } from "react";
import axios from "axios";
import "./ATIPDashboard.scss";

const API_BASE_URL = "http://localhost:5000/api/reports";

// ─── Normalize nested JSON → flat fields for UI ───────────────────────────────
// Handles TWO formats:
//   1. buildRichJSON output  → has data.execution, data.raw.checks, data.assertions
//   2. Flat parser output    → has data.test_id, data.checks, data.total_checks, etc.
function normalizeData(data) {
  if (!data) return null;

  const exec = data.execution || {};
  const raw  = data.raw       || {};

  // ── Determine checks source ──────────────────────────────────────────────────
  // Priority: raw.checks (buildRichJSON) → data.checks (flat parser) → assertions
  const rawChecks   = raw.checks?.length  ? raw.checks
                    : data.checks?.length ? data.checks
                    : [];
  const assertions  = data.assertions || [];
  const checksSource = rawChecks.length > 0 ? rawChecks : assertions;

  // ── Counts ──────────────────────────────────────────────────────────────────
  // Total: raw length → exec field → flat parser field
  const totalChecks = rawChecks.length || exec.totalAssertions || data.total_checks || 0;

  // Passed/Failed: compute from checksSource when available, else use exec/flat fields
  let passedChecks, failedChecks;
  if (checksSource.length > 0) {
    passedChecks = checksSource.filter(c =>
      /^passed$/i.test(c.verdict || c.status || "")
    ).length;
    failedChecks = checksSource.filter(c =>
      /^failed$/i.test(c.verdict || c.status || "")
    ).length;
  } else {
    // No checks array at all — fall back to pre-computed fields
    passedChecks = exec.passedAssertions ?? data.passed_checks_count ?? 0;
    failedChecks = exec.failedAssertions ?? data.failed_checks_count ?? 0;
  }

  // ── Identity fields ──────────────────────────────────────────────────────────
  // test_id: execution (buildRichJSON) → report.reportId → flat parser test_id
  const testId = exec.testId
    || data.report?.reportId
    || data.test_id
    || "N/A";

  // testName: execution.testName → flat parser test_name → fall back to testId
  const testName = exec.testName
    || data.test_name
    || testId;

  const resultState = exec.resultState
    || exec.overallVerdict
    || data.result_state
    || "Unknown";

  return {
    // ── Summary ──
    test_id:             testId,
    test_name:           testName,
    start_time:          exec.startTime  || data.start_time || "",
    duration:            exec.duration   || data.duration   || "",
    result_state:        resultState,
    total_checks:        totalChecks,
    passed_checks_count: passedChecks,
    failed_checks_count: failedChecks,
    pass_rate:           totalChecks > 0
                           ? ((passedChecks / totalChecks) * 100).toFixed(1) + "%"
                           : "0%",
    domain:   data.classification?.domain   || "",
    ecu:      data.classification?.ecu      || "",
    function: data.classification?.function || "",

    // ── Checks table ──
    // Handles both flat parser shape (description, step_title) and
    // buildRichJSON shape (stepId, stepName, signalName)
    checks: checksSource.map((c) => ({
      step_id:     c.step_id     || c.stepId    || "",
      description: c.description || c.step_title || c.stepName  || c.signalName || "",
      verdict:     c.verdict     || c.status     || "",
      expected:    c.expected    || c.check_value || "",
      actual:      c.actual      || c.read_value  || "",
      signal_name: c.signalName  || c.signal_name || c.step_title || c.description || "",
    })),

    // ── Verdict table ──
    // raw.sourceAssertions (buildRichJSON) → raw.verdictTable → data.verdict_table (flat)
    verdict_table: (
      raw.sourceAssertions ||
      raw.verdictTable     ||
      data.verdict_table   ||
      []
    ).map((v) => ({
      raw_signal_and_expected: v.signal || v.raw_signal_and_expected || "",
      comparator:              v.comparator || "EQUAL TO",
      read:                    v.observed || v.actual || v.read || "",
      verdict:                 v.verdict === "PASS" ? "Passed"
                             : v.verdict === "FAIL" ? "Failed"
                             : v.verdict || "",
    })),

    // ── Failures ──
    failures: (data.failures || []).map((f) => ({
      failureId:   f.failureId   || "",
      signalName:  f.signalName  || f.signal_name || "",
      expected:    f.expected    || "",
      actual:      f.actual      || "",
      category:    f.category    || "",
      severity:    f.severity    || "",
      domain:      f.domain      || "",
      ecu:         f.ecu         || "",
      description: f.description || "",
    })),

    // ── Measurements ──
    measurements: (data.measurements || []).map((m) => ({
      name:     m.name     || m.signalName || "",
      expected: m.expected || "",
      actual:   m.actual   || "",
      unit:     m.unit     || "",
      category: m.category || "",
      verdict:  m.verdict  || "",
    })),

    // Keep original for export
    _raw: data,
  };
}

// ─── Export JSON ───────────────────────────────────────────────────────────────
function exportJSON(parsedData) {
  const blob = new Blob([JSON.stringify(parsedData._raw || parsedData, null, 2)], {
    type: "application/json",
  });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href     = url;
  link.download = `${parsedData.test_id || "report"}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

// ─── Export CSV ────────────────────────────────────────────────────────────────
function toCSVString(headers, rows) {
  const escape    = (val) => `"${String(val ?? "").replace(/"/g, '""')}"`;
  const headerRow = headers.map(escape).join(",");
  const dataRows  = rows.map((row) => headers.map((h) => escape(row[h])).join(","));
  return [headerRow, ...dataRows].join("\n");
}

function exportCSV(parsedData) {
  const summaryCSV = toCSVString(
    ["test_id", "test_name", "start_time", "duration", "result_state", "total_checks", "passed_checks_count", "failed_checks_count", "pass_rate"],
    [{
      test_id:             parsedData.test_id,
      test_name:           parsedData.test_name,
      start_time:          parsedData.start_time,
      duration:            parsedData.duration,
      result_state:        parsedData.result_state,
      total_checks:        parsedData.total_checks,
      passed_checks_count: parsedData.passed_checks_count,
      failed_checks_count: parsedData.failed_checks_count,
      pass_rate:           parsedData.pass_rate,
    }]
  );

  const checksCSV = toCSVString(
    ["step_id", "signal_name", "description", "expected", "actual", "verdict"],
    parsedData.checks
  );

  const verdictCSV = toCSVString(
    ["raw_signal_and_expected", "comparator", "read", "verdict"],
    parsedData.verdict_table
  );

  const failuresCSV = toCSVString(
    ["failureId", "signalName", "expected", "actual", "category", "severity", "domain", "ecu"],
    parsedData.failures
  );

  const combined = [
    "=== SUMMARY ===",       summaryCSV,  "",
    "=== CHECKS ===",        checksCSV,   "",
    "=== VERDICT TABLE ===", verdictCSV,  "",
    "=== FAILURES ===",      failuresCSV,
  ].join("\n");

  const blob = new Blob([combined], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href     = url;
  link.download = `${parsedData.test_id || "report"}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ─── Main Component ────────────────────────────────────────────────────────────
function ReportDashboard() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [parsedData,   setParsedData]   = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setSelectedFile(file || null);
    setError(null);
    setParsedData(null);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError("Please select a file first.");
      return;
    }

    const formData = new FormData();
    formData.append("pdfFile", selectedFile);

    setLoading(true);
    setError(null);
    setParsedData(null);

    try {
      const response = await axios.post(`${API_BASE_URL}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const responseData = response.data.data;

      // Debug — remove after confirming
      console.log("=== FULL RESPONSE ===", JSON.stringify(responseData, null, 2));
      console.log("execution:",           responseData?.execution);
      console.log("report:",              responseData?.report);
      console.log("data.test_id:",        responseData?.test_id);
      console.log("data.checks length:",  responseData?.checks?.length);
      console.log("raw.checks length:",   responseData?.raw?.checks?.length);
      console.log("assertions length:",   responseData?.assertions?.length);

      if (!responseData) {
        setError("No data returned from server.");
        return;
      }

      setParsedData(normalizeData(responseData));
    } catch (err) {
      console.error("Upload error:", err);
      setError(
        err.response?.data?.error   ||
        err.response?.data?.message ||
        "Failed to parse the file. Please check the file and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="atip-dashboard">
      <h2 className="atip-dashboard__title">DSPACE Test Report Dashboard</h2>

      <div className="atip-dashboard__upload-box">
        <input
          type="file"
          accept=".pdf,.html,.htm,.xml,.json,.csv,.xlsx,.xls"
          onChange={handleFileChange}
        />
        <button
          className="atip-dashboard__upload-button"
          onClick={handleUpload}
          disabled={loading}
        >
          {loading ? "Parsing..." : "Upload & Parse"}
        </button>
      </div>

      {error && <p className="atip-dashboard__error">{error}</p>}

      {parsedData && (
        <div className="atip-dashboard__results">
          <div className="atip-dashboard__export-bar">
            <button className="atip-dashboard__export-button" onClick={() => exportJSON(parsedData)}>
              ⬇ Export JSON
            </button>
            <button className="atip-dashboard__export-button" onClick={() => exportCSV(parsedData)}>
              ⬇ Export CSV
            </button>
          </div>

          <SummaryCard data={parsedData} />
          <ChecksTable checks={parsedData.checks} />
          <VerdictTable verdicts={parsedData.verdict_table} />

          {parsedData.failures?.length > 0 && (
            <FailuresTable failures={parsedData.failures} />
          )}

          {parsedData.measurements?.length > 0 && (
            <MeasurementsTable measurements={parsedData.measurements} />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Summary Card ──────────────────────────────────────────────────────────────
function SummaryCard({ data }) {
  const isFailed = /fail/i.test(data.result_state);
  return (
    <div className="atip-dashboard__summary-card">
      <h3>{data.test_id}</h3>
      {data.test_name && data.test_name !== data.test_id && (
        <p><b>Test Name:</b> {data.test_name}</p>
      )}
      <p><b>Start Time:</b> {data.start_time || "N/A"}</p>
      <p><b>Duration:</b>   {data.duration   || "N/A"}</p>
      <p>
        <b>Result:</b>{" "}
        <span className={isFailed
          ? "atip-dashboard__status--failed"
          : "atip-dashboard__status--passed"
        }>
          {data.result_state}
        </span>
      </p>
      <p>
        <b>Total:</b>     {data.total_checks}        &nbsp;|&nbsp;
        <b>Passed:</b>    {data.passed_checks_count} &nbsp;|&nbsp;
        <b>Failed:</b>    {data.failed_checks_count} &nbsp;|&nbsp;
        <b>Pass Rate:</b> {data.pass_rate}
      </p>
      {data.domain && (
        <p>
          <b>Domain:</b>   {data.domain}   &nbsp;|&nbsp;
          <b>ECU:</b>      {data.ecu}      &nbsp;|&nbsp;
          <b>Function:</b> {data.function}
        </p>
      )}
    </div>
  );
}

// ─── Checks Table ──────────────────────────────────────────────────────────────
function ChecksTable({ checks }) {
  if (!checks || checks.length === 0) return (
    <div className="atip-dashboard__table-wrapper">
      <h4>All Checks</h4>
      <p style={{ color: "#6b7280", padding: "8px" }}>No checks found.</p>
    </div>
  );

  return (
    <div className="atip-dashboard__table-wrapper">
      <h4>All Checks ({checks.length})</h4>
      <table className="atip-dashboard__table">
        <thead>
          <tr>
            <th>Step ID</th>
            <th>Signal / Description</th>
            <th>Expected</th>
            <th>Actual</th>
            <th>Verdict</th>
          </tr>
        </thead>
        <tbody>
          {checks.map((check, idx) => (
            <tr
              key={idx}
              className={/fail/i.test(check.verdict) ? "atip-dashboard__row--failed" : ""}
            >
              <td>{check.step_id     || "-"}</td>
              <td>{check.signal_name || check.description || "-"}</td>
              <td>{check.expected    || "-"}</td>
              <td>{check.actual      || "-"}</td>
              <td>{check.verdict     || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Verdict Table ─────────────────────────────────────────────────────────────
function VerdictTable({ verdicts }) {
  if (!verdicts || verdicts.length === 0) return (
    <div className="atip-dashboard__table-wrapper">
      <h4>Verdict Table</h4>
      <p style={{ color: "#6b7280", padding: "8px" }}>No verdict data found.</p>
    </div>
  );

  return (
    <div className="atip-dashboard__table-wrapper">
      <h4>Verdict Table ({verdicts.length})</h4>
      <table className="atip-dashboard__table">
        <thead>
          <tr>
            <th>Signal / Expected</th>
            <th>Comparator</th>
            <th>Read</th>
            <th>Verdict</th>
          </tr>
        </thead>
        <tbody>
          {verdicts.map((v, idx) => (
            <tr
              key={idx}
              className={/fail/i.test(v.verdict) ? "atip-dashboard__row--failed" : ""}
            >
              <td>{v.raw_signal_and_expected || "-"}</td>
              <td>{v.comparator             || "-"}</td>
              <td>{v.read                   || "-"}</td>
              <td>{v.verdict                || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Failures Table ────────────────────────────────────────────────────────────
function FailuresTable({ failures }) {
  if (!failures || failures.length === 0) return null;
  return (
    <div className="atip-dashboard__table-wrapper">
      <h4>Failure Details ({failures.length})</h4>
      <table className="atip-dashboard__table">
        <thead>
          <tr>
            <th>Failure ID</th>
            <th>Signal</th>
            <th>Expected</th>
            <th>Actual</th>
            <th>Category</th>
            <th>Severity</th>
            <th>Domain</th>
            <th>ECU</th>
          </tr>
        </thead>
        <tbody>
          {failures.map((f, idx) => (
            <tr key={idx} className="atip-dashboard__row--failed">
              <td>{f.failureId  || "-"}</td>
              <td>{f.signalName || "-"}</td>
              <td>{f.expected   || "-"}</td>
              <td>{f.actual     || "-"}</td>
              <td>{f.category   || "-"}</td>
              <td>{f.severity   || "-"}</td>
              <td>{f.domain     || "-"}</td>
              <td>{f.ecu        || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Measurements Table ────────────────────────────────────────────────────────
function MeasurementsTable({ measurements }) {
  if (!measurements || measurements.length === 0) return null;
  return (
    <div className="atip-dashboard__table-wrapper">
      <h4>Measurements ({measurements.length})</h4>
      <table className="atip-dashboard__table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Expected</th>
            <th>Actual</th>
            <th>Unit</th>
            <th>Category</th>
            <th>Verdict</th>
          </tr>
        </thead>
        <tbody>
          {measurements.map((m, idx) => (
            <tr
              key={idx}
              className={/fail/i.test(m.verdict) ? "atip-dashboard__row--failed" : ""}
            >
              <td>{m.name     || "-"}</td>
              <td>{m.expected || "-"}</td>
              <td>{m.actual   || "-"}</td>
              <td>{m.unit     || "-"}</td>
              <td>{m.category || "-"}</td>
              <td>{m.verdict  || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ReportDashboard;
