import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { FileAudio, ArrowRight, Info, X, ChevronRight, ShieldAlert, ShieldQuestion } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import { date } from "./lib";
import { predictionLabel, modelScore, hasAnalysisResponse } from "./prediction";
export function Badge({ prediction }) {
  return (
    <span className={`badge ${prediction === "spoof" ? "warning" : "neutral"}`}>
      {predictionLabel(prediction)}
    </span>
  );
}
export function Empty({
  title = "Your first analysis starts here",
  text = "Upload a recording to see real model scores in your workspace.",
}) {
  return (
    <div className="empty">
      <FileAudio size={32} />
      <h3>{title}</h3>
      <p>{text}</p>
      <Link className="button secondary" to="/analyze">
        Analyze audio <ArrowRight size={16} />
      </Link>
    </div>
  );
}
export function Result({ result, autoReveal = false }) {
  const ref = useRef(null);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    if (!autoReveal || !ref.current) return;
    const bounds = ref.current.getBoundingClientRect();
    if (bounds.top < 0 || bounds.top > window.innerHeight - 180)
      ref.current.scrollIntoView({ behavior: reducedMotion ? "instant" : "smooth", block: "start" });
  }, [result, autoReveal, reducedMotion]);
  if (!hasAnalysisResponse(result)) return <div role="alert" className="error">Prediction unavailable. No acoustic verdict can be displayed.</div>;
  const spoof = result.acoustic.prediction === "spoof";
  const VerdictIcon = spoof ? ShieldAlert : ShieldQuestion;
  return (
    <div className="result" ref={ref}>
      <section className={`detection-verdict ${spoof ? "verdict-warning" : "verdict-inconclusive"}`} aria-label="Acoustic detection verdict">
        <span className="verdict-icon"><VerdictIcon size={32} aria-hidden="true" /></span>
        <span className="eyebrow">Analysis result</span>
        <h2 className="verdict-title">{spoof ? "POTENTIAL SPOOF DETECTED" : "NO SPOOF ALERT — INCONCLUSIVE"}</h2>
        <p>{spoof ? "Potential synthetic or manipulated speech signals detected. Verify independently." : "No acoustic spoof alert was raised. This does not verify that the recording is genuine or safe."}</p>
      <div className="score-grid">
        <div><span>Spoof model score</span><strong>{modelScore(result.acoustic.spoof_score)}</strong></div>
        <div><span>Fixed operating threshold</span><strong>{result.acoustic.threshold}</strong></div>
      </div>
      <div className="verdict-comparison">{spoof ? "Spoof score meets or exceeds the fixed threshold" : "Spoof score is below the fixed threshold"}</div>
      <p className="caption">
        Model scores are not confidence percentages or calibrated probabilities of authenticity.
      </p>
      </section>
      <details className="result-technical"><summary>Technical details & limitations</summary>
      <dl className="facts">
        <div>
          <dt>Source sample rate</dt>
          <dd>{result.sample_rate_hz.toLocaleString()} Hz</dd>
        </div>
        <div>
          <dt>Processing time</dt>
          <dd>{result.processing_ms} ms</dd>
        </div>
        <div>
          <dt>Model input</dt>
          <dd>First second · 16 kHz mono</dd>
        </div>
      </dl>
      <div className="notice">
        <Info size={18} />
        <div>
          {result.limitations.map((x) => (
            <p key={x}>{x}</p>
          ))}
        </div>
      </div>
      </details>
    </div>
  );
}
export function PageTitle({ eyebrow, title, text, children }) {
  return (
    <div className="page-title">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
      {children}
    </div>
  );
}
export function AnalysesTable({ items, onSelect }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Recording</th>
            <th>Result</th>
            <th>Spoof score</th>
            <th>Analyzed</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <div className="table-file">
                  <FileAudio size={19} />
                  <div>
                    <strong>{item.audio_file}</strong>
                    <span>
                      {item.source} · {item.duration?.toFixed(1)} sec
                    </span>
                  </div>
                </div>
              </td>
              <td>
                <Badge prediction={item.acoustic.prediction} />
              </td>
              <td className="numeric">
                {modelScore(item.acoustic.spoof_score)}
              </td>
              <td className="muted">{date(item.created_at)}</td>
              <td>
                <button
                  className="icon-button"
                  aria-label={`View ${item.audio_file}`}
                  onClick={() => onSelect(item)}
                >
                  <ChevronRight size={18} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function Modal({ title, children, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    ref.current.showModal();
    return () => previous?.focus();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="section-title">
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
          autoFocus
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
