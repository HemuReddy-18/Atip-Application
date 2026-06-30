// Pages/ReportDetailPage/ReportDetailPage.jsx
import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import "./ReportDetailPage.scss";

const API_BASE_URL = "http://localhost:5000/api/reports";

// ── Icons (inline SVG — no extra deps) ───────────────────────────────────────
const PassIcon   = () => <span className="icon icon--pass">✓</span>;
const FailIcon   = () => <span className="icon icon--fail">✕</span>;
const ChevronDown = () => <span className="chevron">▾</span>;
const ChevronRight = () => <span className="chevron">▸</span>;

export default function ReportDetailPage({ reportId, onBack }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  // Assertions filters
  const [verdictFilter, setVerdictFilter] = useState("All");
  const [signalFilter,  setSignalFilter]  = useState("All");
  const [stepFilter,    setStepFilter]    = useState("All");
  const [search,        setSearch]        = useState("");
  const [pageSize,      setPageSize]      = useState(10);
  const [page,          setPage]          = useState(1);

  useEffect(() => {
    if (!reportId) return;
    setLoading(true);
    setError(null);
    axios.get(`${API_BASE_URL}/detail/${reportId}`)
      .then(res => setData(res.data.data))
      .catch(err => setError(err.response?.data?.message || "Failed to load report."))
      .finally(() => setLoading(false));
  }, [reportId]);

  const isFailed = /^failed$/i.test(data?.report?.result_state);

  // ── Filtered assertions ────────────────────────────────────────────────────
  const filteredAssertions = useCallback(() => {
    if (!data) return [];
    return data.assertions.filter(a => {
      if (verdictFilter !== "All" && !new RegExp(`^${verdictFilter}$`, "i").test(a.verdict || "")) return false;
      if (signalFilter  !== "All" && a.signal !== signalFilter) return false;
      if (stepFilter    !== "All" && String(a.step) !== stepFilter) return false;
      if (search && !a.signal?.toLowerCase().includes(search.toLowerCase()) &&
          !String(a.step).includes(search)) return false;
      return true;
    });
  }, [data, verdictFilter, signalFilter, stepFilter, search]);

  const allFiltered  = filteredAssertions();
  const totalPages   = Math.ceil(allFiltered.length / pageSize);
  const pagedRows    = allFiltered.slice((page - 1) * pageSize, page * pageSize);
  const uniqueSignals = [...new Set((data?.assertions || []).map(a => a.signal))];
  const uniqueSteps   = [...new Set((data?.assertions || []).map(a => String(a.step)))];

  if (loading) return <div className="rdp__loading">Loading report…</div>;
  if (error)   return <div className="rdp__error">{error} <button onClick={onBack}>← Back</button></div>;
  if (!data)   return null;

  const { report, summary, sequence_tree, failures } = data;

  return (
    <div className="rdp">

      {/* ── Top Nav ─────────────────────────────────────────────────────────── */}
      <div className="rdp__topbar">
        <button className="rdp__back" onClick={onBack}>← Back</button>
        <span className="rdp__breadcrumb">Dashboard / {report.test_id}</span>
        <div className="rdp__topbar-actions">
          <button className="rdp__btn rdp__btn--outline">📄 Export PDF</button>
          <button className="rdp__btn rdp__btn--primary">⬇ Download Artifacts</button>
        </div>
      </div>

      {/* ── Header Cards ────────────────────────────────────────────────────── */}
      <div className="rdp__header-cards">
        <div className="rdp__header-card">
          <span className="rdp__header-card__label">Test ID</span>
          <span className="rdp__header-card__value">{report.test_id}</span>
        </div>
        <div className="rdp__header-card">
          <span className="rdp__header-card__label">Tool</span>
          <span className="rdp__header-card__value">dSPACE</span>
        </div>
        <div className="rdp__header-card">
          <span className="rdp__header-card__label">Result</span>
          <span className="rdp__header-card__value">{report.scenario_title}</span>
        </div>
        <div className="rdp__header-card">
          <span className="rdp__header-card__label">Start Time</span>
          <span className="rdp__header-card__value">{report.start_time}</span>
        </div>
        <div className="rdp__header-card">
          <span className="rdp__header-card__label">Duration</span>
          <span className="rdp__header-card__value">{report.duration}</span>
        </div>
        <div className="rdp__header-card">
          <span className="rdp__header-card__label">Status</span>
          <span className={`rdp__status-badge rdp__status-badge--${isFailed ? "failed" : "passed"}`}>
            {isFailed ? "FAILED" : "PASSED"}
          </span>
        </div>
      </div>

      {/* ── Scenario Banner ─────────────────────────────────────────────────── */}
      <div className="rdp__scenario">
        <div className="rdp__scenario__icon">📋</div>
        <div className="rdp__scenario__body">
          <h3>Test Scenario</h3>
          <p>{report.test_id} — {report.termination_state || "Completed"}</p>
        </div>
        <div className="rdp__scenario__tags">
          <span className="rdp__tag">CDC</span>
          <span className="rdp__tag">Body Control</span>
          <span className="rdp__tag">Sleep Validation</span>
          <span className="rdp__tag">HiL</span>
        </div>
      </div>

      {/* ── Main Grid: Sequence Tree + Failure Summary ──────────────────────── */}
      <div className="rdp__main-grid">

        {/* Sequence Tree */}
        <div className="rdp__panel rdp__panel--tree">
          <h3>Sequence Tree</h3>
          <div className="rdp__tree">
            <TreeNode
              node={{ name: report.test_id, verdict: isFailed ? "Failed" : "Passed", children: sequence_tree }}
              depth={0}
              defaultOpen
            />
          </div>
        </div>

        {/* Failure Summary */}
        <div className="rdp__panel rdp__panel--failures">
          <h3>Failure Summary</h3>

          <div className="rdp__summary-cards">
            <div className="rdp__summary-card">
              <span className="rdp__summary-card__label">Total Assertions</span>
              <span className="rdp__summary-card__value rdp__summary-card__value--blue">
                {summary.total_assertions}
              </span>
            </div>
            <div className="rdp__summary-card">
              <span className="rdp__summary-card__label">Passed</span>
              <span className="rdp__summary-card__value rdp__summary-card__value--green">
                {summary.passed_assertions}
              </span>
            </div>
            <div className="rdp__summary-card">
              <span className="rdp__summary-card__label">Failed</span>
              <span className="rdp__summary-card__value rdp__summary-card__value--red">
                {summary.failed_assertions}
              </span>
            </div>
          </div>

          {failures.length > 0 ? (
            <>
              <table className="rdp__table rdp__table--failures">
                <thead>
                  <tr>
                    <th>Step</th>
                    <th>Signal</th>
                    <th>Expected</th>
                    <th>Actual</th>
                    <th>Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {failures.map((f, idx) => (
                    <tr key={idx} className="rdp__row--failed">
                      <td>{f.step}</td>
                      <td>{f.signal}</td>
                      <td>{f.expected}</td>
                      <td className="rdp__cell--fail-value">{f.actual}</td>
                      <td><span className="rdp__verdict-badge rdp__verdict-badge--fail">FAIL</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="rdp__footnote">Showing 1 to {failures.length} of {failures.length} failures</p>
            </>
          ) : (
            <p className="rdp__empty">No failures recorded.</p>
          )}
        </div>
      </div>

      {/* ── Assertions Table ─────────────────────────────────────────────────── */}
      <div className="rdp__panel rdp__panel--assertions">
        <div className="rdp__assertions-header">
          <h3>Assertions</h3>
          <div className="rdp__assertions-filters">
            {/* Verdict toggle */}
            <div className="rdp__toggle-group">
              {["All", "Passed", "Failed"].map(v => (
                <button
                  key={v}
                  className={`rdp__toggle ${verdictFilter === v ? "rdp__toggle--active" : ""}`}
                  onClick={() => { setVerdictFilter(v); setPage(1); }}
                >
                  {v}
                </button>
              ))}
            </div>

            {/* Signal filter */}
            <select className="rdp__select" value={signalFilter}
              onChange={e => { setSignalFilter(e.target.value); setPage(1); }}>
              <option value="All">Signal: All</option>
              {uniqueSignals.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            {/* Step filter */}
            <select className="rdp__select" value={stepFilter}
              onChange={e => { setStepFilter(e.target.value); setPage(1); }}>
              <option value="All">Step: All</option>
              {uniqueSteps.map(s => <option key={s} value={s}>Step {s}</option>)}
            </select>

            {/* Search */}
            <div className="rdp__search-box">
              <input
                type="text"
                placeholder="Search in table…"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
              />
              <span className="rdp__search-icon">🔍</span>
            </div>

            <button className="rdp__btn rdp__btn--ghost"
              onClick={() => { setVerdictFilter("All"); setSignalFilter("All"); setStepFilter("All"); setSearch(""); setPage(1); }}>
              ✕ Clear Filters
            </button>
          </div>
        </div>

        <table className="rdp__table">
          <thead>
            <tr>
              <th>Step</th>
              <th>Signal</th>
              <th>Expected</th>
              <th>Comparator</th>
              <th>Actual</th>
              <th>Verdict</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {pagedRows.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: "center", padding: "16px", color: "#6b7280" }}>No results found.</td></tr>
            ) : pagedRows.map((a, idx) => {
              const isFail = /^fail/i.test(a.verdict);
              return (
                <tr key={idx} className={isFail ? "rdp__row--failed" : ""}>
                  <td>{a.step}</td>
                  <td>{a.signal}</td>
                  <td>{a.expected}</td>
                  <td>{a.comparator}</td>
                  <td className={isFail ? "rdp__cell--fail-value" : ""}>{a.actual}</td>
                  <td>
                    <span className={`rdp__verdict-badge rdp__verdict-badge--${isFail ? "fail" : "pass"}`}>
                      {isFail ? "FAIL" : "PASS"}
                    </span>
                  </td>
                  <td>{a.timestamp}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="rdp__pagination">
          <span className="rdp__footnote">
            Showing {allFiltered.length === 0 ? 0 : (page - 1) * pageSize + 1} to {Math.min(page * pageSize, allFiltered.length)} of {allFiltered.length} assertions
          </span>
          <div className="rdp__pagination-controls">
            <button className="rdp__page-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                className={`rdp__page-btn ${page === p ? "rdp__page-btn--active" : ""}`}
                onClick={() => setPage(p)}
              >
                {p}
              </button>
            ))}
            <button className="rdp__page-btn" disabled={page === totalPages || totalPages === 0} onClick={() => setPage(p => p + 1)}>›</button>
            <select className="rdp__select rdp__select--sm" value={pageSize}
              onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}>
              {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n} / page</option>)}
            </select>
          </div>
        </div>
      </div>

    </div>
  );
}

// ── Recursive Tree Node ───────────────────────────────────────────────────────
function TreeNode({ node, depth, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen || depth < 2);
  const hasChildren = node.children && node.children.length > 0;
  const isFailed    = /^failed$/i.test(node.verdict);

  return (
    <div className={`rdp__tree-node rdp__tree-node--depth-${Math.min(depth, 4)}`}>
      <div
        className={`rdp__tree-row ${isFailed ? "rdp__tree-row--failed" : ""}`}
        onClick={() => hasChildren && setOpen(o => !o)}
        style={{ cursor: hasChildren ? "pointer" : "default" }}
      >
        <span className="rdp__tree-toggle">
          {hasChildren ? (open ? <ChevronDown /> : <ChevronRight />) : <span style={{ width: 12, display: "inline-block" }} />}
        </span>
        <span className="rdp__tree-icon">
          {isFailed ? <FailIcon /> : <PassIcon />}
        </span>
        <span className="rdp__tree-label">{node.name}</span>
      </div>
      {open && hasChildren && (
        <div className="rdp__tree-children">
          {node.children.map((child, idx) => (
            <TreeNode key={child.key || idx} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
