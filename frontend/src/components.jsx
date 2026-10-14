import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { FileAudio, ArrowRight, Info, X, ChevronRight } from "lucide-react";
import { percent, date } from "./lib";
import { predictionLabel, modelScore } from "./prediction";
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
export function Result({ result }) {
  return (
    <div className="result">
      <div className="section-title">
        <h2>Analysis result</h2>
        <Badge prediction={result.acoustic.prediction} />
      </div>
      <p>{result.message}</p>
      <div className="score-grid">
        {[
          ["Spoof model score", result.acoustic.spoof_score],
          ["Bonafide model score", result.acoustic.bonafide_score],
        ].map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{modelScore(value)}</strong>
            <div className="score-track">
              <div style={{ width: percent(value) }} />
            </div>
          </div>
        ))}
      </div>
      <p className="caption">
        Fixed alert threshold: {result.acoustic.threshold}. Model scores are not
        calibrated probabilities of authenticity. The decision uses the spoof
        operating threshold, not whichever class has the larger score.
      </p>
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
