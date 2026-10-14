import { useState } from "react";
import { Link } from "react-router-dom";
import { useReducedMotion } from "framer-motion";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  AudioLines,
  ShieldCheck,
  Activity,
  Clock3,
  Upload,
  ArrowRight,
  Mic,
  CircleHelp,
} from "lucide-react";
import { raised } from "./lib";
import { AnalysesTable, Empty } from "./components";
export default function Dashboard({ items, onSelect }) {
  const reducedMotion = useReducedMotion();
  const [range, setRange] = useState("7"),
    alerts = items.filter(raised).length;
  const chart = Array.from({ length: Number(range) }, (_, i) => {
    const day = new Date();
    day.setDate(day.getDate() - Number(range) + 1 + i);
    const records = items.filter(
      (x) => new Date(x.created_at).toDateString() === day.toDateString(),
    );
    return {
      day: day.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      analyses: records.length,
      alerts: records.filter(raised).length,
    };
  });
  const metrics = [
    [AudioLines, "Total analyses", items.length, "Saved in this browser"],
    [ShieldCheck, "Spoof alerts", alerts, "At the fixed operating threshold"],
    [
      Activity,
      "Below threshold",
      items.length - alerts,
      "Inconclusive acoustic results",
    ],
    [
      Clock3,
      "Avg. processing time",
      items.length
        ? `${Math.round(items.reduce((s, x) => s + x.processing_ms, 0) / items.length)} ms`
        : "—",
      "From completed API requests",
    ],
  ];
  return (
    <>
      <section className="acoustic-hero" aria-labelledby="workspace-heading">
        <div className="hero-copy">
          <span className="hero-kicker"><AudioLines size={14} /> LOCAL ACOUSTIC SCREENING</span>
          <h1 id="workspace-heading">A clearer signal.<br /><span>A closer look.</span></h1>
          <p>Look beyond the voice. Screen a recording for acoustic spoof cues, with the evidence in view.</p>
          <div className="hero-actions">
            <Link to="/analyze" className="button"><Upload size={17} /> Analyze audio <ArrowRight size={17} /></Link>
            <Link to="/demo" className="hero-secondary">Explore the demo <ArrowRight size={15} /></Link>
          </div>
          <span className="hero-footnote"><ShieldCheck size={14} /> Local inference <span aria-hidden="true">·</span> Your audio stays on this device</span>
        </div>
        <div className="acoustic-art" aria-hidden="true">
          <div className="acoustic-orbit orbit-one" /><div className="acoustic-orbit orbit-two" />
          <div className="acoustic-orbit orbit-three" />
          <div className="acoustic-core"><AudioLines size={30} /></div>
          <svg viewBox="0 0 400 180" className="hero-wave" focusable="false">
            <defs><linearGradient id="hero-wave-ink"><stop stopColor="#b9a5ee" /><stop offset=".5" stopColor="#7351d4" /><stop offset="1" stopColor="#b9a5ee" /></linearGradient></defs>
            <g className="waveform-band" fill="url(#hero-wave-ink)">
              {Array.from({ length: 55 }, (_, i) => {
                const height = 8 + Math.pow(Math.sin(i * .49), 2) * (22 + 90 * Math.pow(Math.sin(i / 54 * Math.PI), 2));
                return <rect key={i} x={i * 7.2 + 4} y={90 - height / 2} width="3" height={height} rx="1.5" />;
              })}
            </g>
          </svg>
          <span className="art-caption">THE VOICE. THE EVIDENCE.</span>
        </div>
      </section>
      <div className="activity-heading"><span className="eyebrow">YOUR WORKSPACE AT A GLANCE</span><span>Locally saved activity · Not model performance</span></div>
      <div className="metric-grid">
        {metrics.map(([Icon, label, value, detail]) => (
          <div className="metric" key={label}>
            <div className="metric-heading">
              <span>{label}</span>
              <span className="metric-symbol"><Icon size={19} /></span>
            </div>
            <strong>{value}</strong>
            <p>{detail}</p>
          </div>
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="chart-section">
          <div className="section-title">
            <div>
              <h2>Analysis activity</h2>
              <p className="muted">
                Your locally saved acoustic screening activity
              </p>
            </div>
            <select
              aria-label="Chart date range"
              value={range}
              onChange={(e) => setRange(e.target.value)}
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
            </select>
          </div>
          <div className="legend">
            <span /> Analyses <span className="orange" /> Spoof alerts
          </div>
          {items.length ? (
            <div className="chart">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chart}>
                  <defs>
                    <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8c7aeb" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#8c7aeb" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#eef0f5" />
                  <XAxis
                    dataKey="day"
                    tickLine={false}
                    axisLine={false}
                    minTickGap={25}
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    width={30}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid #e5def1", boxShadow: "0 8px 24px #33234c12", fontSize: 12 }}
                    labelStyle={{ color: "#372d50", fontWeight: 600, marginBottom: 6 }}
                    formatter={(value, name) => [value, name === "analyses" ? "Completed analyses" : "Spoof alerts"]}
                    cursor={{ stroke: "#b7a5de", strokeDasharray: "3 3" }}
                  />
                  <Area
                    dataKey="analyses"
                    stroke="#7b61d8"
                    fill="url(#chartFill)"
                    strokeWidth={2}
                    isAnimationActive={!reducedMotion}
                  />
                  <Area
                    dataKey="alerts"
                    stroke="#db9250"
                    fill="transparent"
                    strokeWidth={2}
                    isAnimationActive={!reducedMotion}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="chart-empty">
              <Activity size={28} />
              <h3>No activity yet</h3>
              <p>Your completed analyses will appear here.</p>
              <Link className="text-link" to="/analyze">Start with a recording <ArrowRight size={15} /></Link>
            </div>
          )}
        </section>
        <aside className="quick-actions">
          <span className="eyebrow">START A NEW ANALYSIS</span>
          <h2>
            Listen beyond
            <br />
            the surface.
          </h2>
          <p>Choose a recording or capture one with your microphone.</p>
          <Link to="/analyze">
            <span className="action-icon">
              <Upload size={20} />
            </span>
            <div>
              <strong>Upload audio</strong>
              <span>Screen a WAV recording</span>
            </div>
            <ArrowRight size={18} />
          </Link>
          <Link to="/record">
            <span className="action-icon mint">
              <Mic size={20} />
            </span>
            <div>
              <strong>Record audio</strong>
              <span>Capture, then analyze</span>
            </div>
            <ArrowRight size={18} />
          </Link>
          <div className="local-note">
            <span className="status-dot" /> Local inference. No paid APIs.
          </div>
        </aside>
      </div>
      <section className="recent">
        <div className="section-title">
          <div>
            <h2>Recent analyses</h2>
            <p className="muted">
              Results from this browser, with no audio retained
            </p>
          </div>
          <Link className="text-link" to="/history">
            View all <ArrowRight size={16} />
          </Link>
        </div>
        {items.length ? (
          <AnalysesTable items={items.slice(0, 5)} onSelect={onSelect} />
        ) : (
          <Empty />
        )}
      </section>
      <div className="scope-banner">
        <CircleHelp size={20} />
        <p>
          <strong>A score is a signal, not a guarantee.</strong> Acoustic
          screening cannot verify identity or determine whether a call is safe.
        </p>
        <Link to="/model">
          Model limitations <ArrowRight size={16} />
        </Link>
      </div>
    </>
  );
}
