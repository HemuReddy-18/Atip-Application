import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  PieChart, Pie, Cell, Tooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  BarChart, Bar, ResponsiveContainer,
} from "recharts";
import "./ATIPAnalyticsDashboard.scss";

const API_BASE_URL = "http://localhost:5000/api/reports";

const CATEGORY_COLORS = {
  "High Q Current":   "#DC2626",
  "Signal Mismatch":  "#F59E0B",
  "Wake-up Anomaly":  "#2563EB",
  "Signal Validation":"#2563EB",
  "Sleep Timing":     "#161316",
  "Other":            "#9CA3AF",
};

// ── Main Component ─────────────────────────────────────────────────────────────
function ATIPAnalyticsDashboard({ onSelectReport }) {
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => { fetchDashboardStats(); }, []);

  const fetchDashboardStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API_BASE_URL}/dashboard-stats`);
      setStats(response.data.data);
    } catch (err) {
      console.error(err);
      setError("Could not load dashboard data. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="atip-analytics__loading">Loading dashboard…</div>;
  if (error)   return <div className="atip-analytics__error">{error}<button onClick={fetchDashboardStats}>Retry</button></div>;
  if (!stats || stats.stat_cards.total_test_cases === 0) {
    return <div className="atip-analytics__empty">No test reports yet. Upload a file to see results here.</div>;
  }

  return (
    <div className="atip-analytics">
      <header className="atip-analytics__header">
        <h1>Sleep Validation Suite</h1>
        <p>End-to-end sleep and wake behavior validation scenarios including current consumption and network sleep time checks.</p>
      </header>

      <StatCardsRow stats={stats.stat_cards} />

      <div className="atip-analytics__main-grid">
        {/* ✅ Pass onSelectReport down */}
        <TestCaseSummary cases={stats.test_case_summary} onSelectReport={onSelectReport} />
        <FailureDistributionChart distribution={stats.failure_distribution} />
        <FailureTrendChart trend={stats.failure_trend} />
      </div>

      <div className="atip-analytics__bottom-grid">
        {/* ✅ Pass onSelectReport down */}
        <TestCaseComparisonTable cases={stats.test_case_summary} onSelectReport={onSelectReport} />
        <MetricComparisonChart comparison={stats.metric_comparison} />
      </div>
    </div>
  );
}

// ── Stat Cards ─────────────────────────────────────────────────────────────────
function StatCardsRow({ stats }) {
  const cards = [
    { label: "Total Test Cases",  value: stats.total_test_cases, type: "neutral" },
    { label: "Passed",            value: stats.passed,           type: "passed"  },
    { label: "Failed",            value: stats.failed,           type: "failed"  },
    { label: "Avg Duration",      value: stats.avg_duration,     type: "neutral" },
    { label: "Total Assertions",  value: stats.total_assertions, type: "neutral" },
    { label: "Critical Failures", value: stats.critical_failures,type: "warning" },
    { label: "Pass Rate",         value: `${stats.pass_rate}%`,  type: stats.pass_rate >= 50 ? "passed" : "failed" },
  ];
  return (
    <div className="atip-analytics__stat-row">
      {cards.map((card) => (
        <div key={card.label} className={`stat-card stat-card--${card.type}`}>
          <span className="stat-card__label">{card.label}</span>
          <span className="stat-card__value">{card.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Test Case Summary ──────────────────────────────────────────────────────────
function TestCaseSummary({ cases, onSelectReport }) {
  return (
    <div className="panel panel--summary">
      <h3 className="panel__title">Test Case Summary</h3>
      <div className="summary-list">
        {cases.map((c, idx) => (
          <div
            key={c.id || idx}
            className={`summary-card summary-card--${c.result_state.toLowerCase()}`}
            onClick={() => onSelectReport && onSelectReport(c.id)}
            style={{ cursor: "pointer" }}
          >
            <div className="summary-card__top">
              <span className="summary-card__id">{c.test_id}</span>
              <span className={`badge badge--${c.result_state.toLowerCase()}`}>
                {c.result_state.toUpperCase()}
              </span>
            </div>
            <div className="summary-card__meta">
              <span>{c.duration}</span>
              <span>{c.start_time}</span>
              <span>{c.failed_checks_count} Failure{c.failed_checks_count !== 1 ? "s" : ""}</span>
            </div>
          </div>
        ))}
      </div>
      <p className="panel__footnote">Showing 1 to {cases.length} of {cases.length} test cases</p>
    </div>
  );
}

// ── Failure Distribution ───────────────────────────────────────────────────────
function FailureDistributionChart({ distribution }) {
  const total = distribution.reduce((sum, d) => sum + d.count, 0);
  return (
    <div className="panel panel--donut">
      <h3 className="panel__title">Failure Distribution (Across All Test Cases)</h3>
      <div className="donut-wrapper">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={distribution} dataKey="count" nameKey="category"
              innerRadius={60} outerRadius={90} paddingAngle={3}>
              {distribution.map((entry) => (
                <Cell key={entry.category} fill={CATEGORY_COLORS[entry.category] || CATEGORY_COLORS.Other} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
        <div className="donut-wrapper__center">
          <span className="donut-wrapper__number">{total}</span>
          <span className="donut-wrapper__label">Total Failures</span>
        </div>
      </div>
      <ul className="legend-list">
        {distribution.map((d) => (
          <li key={d.category}>
            <span className="legend-dot"
              style={{ backgroundColor: CATEGORY_COLORS[d.category] || CATEGORY_COLORS.Other }} />
            {d.category} — {d.count} ({d.percentage}%)
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Failure Trend ──────────────────────────────────────────────────────────────
function FailureTrendChart({ trend }) {
  return (
    <div className="panel panel--trend">
      <h3 className="panel__title">Failure Trend</h3>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={trend}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
          <Tooltip />
          <Line type="monotone" dataKey="failed_count" stroke="#DC2626" strokeWidth={2} dot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Test Case Comparison Table ─────────────────────────────────────────────────
function TestCaseComparisonTable({ cases, onSelectReport }) {
  return (
    <div className="panel panel--table">
      <h3 className="panel__title">Test Case Comparison</h3>
      <table className="comparison-table">
        <thead>
          <tr>
            <th>Test Case ID</th>
            <th>Duration</th>
            <th>Execution Time</th>
            <th>Status</th>
            <th>Failures</th>
          </tr>
        </thead>
        <tbody>
          {cases.map((c, idx) => (
            <tr
              key={c.id || idx}
              onClick={() => onSelectReport && onSelectReport(c.id)}
              style={{ cursor: "pointer" }}
              className="comparison-table__row--clickable"
            >
              <td style={{ color: "#2563eb", fontWeight: 600 }}>{c.test_id}</td>
              <td>{c.duration}</td>
              <td>{c.start_time}</td>
              <td>
                <span className={`badge badge--${c.result_state.toLowerCase()}`}>
                  {c.result_state.toUpperCase()}
                </span>
              </td>
              <td>{c.failed_checks_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="panel__footnote">Showing 1 to {cases.length} of {cases.length} test cases</p>
    </div>
  );
}

// ── Metric Comparison ──────────────────────────────────────────────────────────
function MetricComparisonChart({ comparison }) {
  const THRESHOLD = 50;
  const chartData = comparison.map((c) => ({
    test_id: c.test_id,
    value:   parseFloat(c.observed_value) || 0,
  }));
  return (
    <div className="panel panel--metric">
      <h3 className="panel__title">Metric Comparison — Vehicle Q-Current (mA)</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis type="number" tick={{ fontSize: 12 }} />
          <YAxis type="category" dataKey="test_id" tick={{ fontSize: 12 }} width={120} />
          <Tooltip />
          <Bar dataKey="value">
            {chartData.map((entry) => (
              <Cell key={entry.test_id} fill={entry.value > THRESHOLD ? "#DC2626" : "#16A34A"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="panel__footnote">Threshold: ≤ {THRESHOLD} mA</p>
    </div>
  );
}

export default ATIPAnalyticsDashboard;
