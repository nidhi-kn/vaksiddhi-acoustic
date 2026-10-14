import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  AudioLines,
  Check,
  FileAudio,
  LoaderCircle,
  Mic,
  Play,
  ShieldCheck,
  Upload,
} from "lucide-react";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { api } from "./lib";
import { hasPredictionContract } from "./prediction";
import { decode } from "./audio";
import { demoSamples } from "./demoSamples";
import { PageTitle, Result } from "./components";
import Waveform from "./Waveform";
import audit from "../../docs/competition_baseline.json";

function SamplePanel({ label, sample, onChange, result, busy }) {
  const [buffer, setBuffer] = useState(null);
  const [previewError, setPreviewError] = useState("");
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    fetch(sample.url, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Sample unavailable");
        return response.blob();
      })
      .then(decode)
      .then((value) => {
        if (active) setBuffer(value);
      })
      .catch(() => {
        if (active)
          setPreviewError(
            "Audio preview is unavailable. Check that the local sample can be loaded.",
          );
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [sample.url]);
  return (
    <section
      className={`demo-sample ${label}`}
      aria-label={`${label} comparison sample`}
    >
      <div className="sample-topline">
        <span className="sample-category">
          <FileAudio size={16} />
          {label === "bonafide"
            ? "Genuine speech sample"
            : "Spoof speech sample"}
        </span>
        <span className="truth-label">Dataset label: {label}</span>
      </div>
      <label className="sample-select">
        Recording
        <select
          aria-label={`${label} sample`}
          value={sample.name}
          disabled={busy}
          onChange={(event) => onChange(event.target.value)}
        >
          {demoSamples
            .filter((item) => item.label === label)
            .map((item) => (
              <option key={item.name}>{item.name}</option>
            ))}
        </select>
      </label>
      <Waveform buffer={buffer} />
      {previewError && (
        <p className="error" role="alert">
          {previewError}
        </p>
      )}
      <audio
        controls
        preload="metadata"
        src={sample.url}
        aria-label={`Play ${sample.name}`}
      />
      <div className="sample-result">
        {result ? (
          <Result result={result} />
        ) : (
          <div className="awaiting-result">
            <AudioLines size={24} />
            <h3>
              {busy
                ? "Acoustic analysis in progress"
                : "Awaiting model analysis"}
            </h3>
            <p>No prediction has been computed for this comparison.</p>
          </div>
        )}
      </div>
    </section>
  );
}

export default function DemoPage({ onSave }) {
  const [selection, setSelection] = useState({
    bonafide: demoSamples[0],
    spoof: demoSamples[3],
  });
  const [results, setResults] = useState({}),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const request = useRef(null),
    reduceMotion = useReducedMotion();
  useEffect(() => () => request.current?.abort(), []);
  function choose(label, name) {
    setSelection((current) => ({
      ...current,
      [label]: demoSamples.find((item) => item.name === name),
    }));
    setResults({});
    setError("");
  }
  async function compare() {
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    setResults({});
    const completed = [];
    try {
      for (const label of ["bonafide", "spoof"]) {
        const sample = selection[label];
        const response = await fetch(sample.url, { signal: controller.signal });
        if (!response.ok)
          throw new Error(`Local sample ${sample.name} is unavailable.`);
        const file = new File([await response.blob()], sample.name, {
          type: "audio/wav",
        });
        const buffer = await decode(file);
        const form = new FormData();
        form.append("file", file);
        const { data } = await api.post("/api/analyze", form, {
          signal: controller.signal,
        });
        if (!hasPredictionContract(data))
          throw new Error(
            "Unsupported API prediction contract. No comparison was saved.",
          );
        const item = {
          ...data,
          id: crypto.randomUUID(),
          created_at: new Date().toISOString(),
          source: "Demo",
          duration: buffer.duration,
          declared_dataset_label: label,
        };
        completed.push(item);
        setResults((current) => ({ ...current, [label]: item }));
      }
      onSave(completed);
    } catch (failure) {
      if (!controller.signal.aborted)
        setError(
          typeof failure.response?.data?.detail === "string"
            ? failure.response.data.detail
            : `${failure.message || "Analysis failed"}. Check the local backend and retry.`,
        );
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  const ready = results.bonafide && results.spoof;
  const chart = ready
    ? ["bonafide", "spoof"].map((label) => ({
        name: selection[label].name,
        score: results[label].acoustic.spoof_score,
        label,
      }))
    : [];
  return (
    <>
      <PageTitle
        eyebrow="COMPETITION DEMONSTRATION"
        title="The voice. The evidence."
        text="Two labeled recordings. One unchanged acoustic model."
      >
        <span className="demo-local">
          <ShieldCheck size={16} /> Local audio · Local inference
        </span>
      </PageTitle>
      <div className="demo-flow" aria-label="Three-step acoustic analysis flow">
        <Link to="/analyze">
          <span>01</span>
          <Upload size={18} />
          <strong>Upload or record</strong>
          <ArrowRight size={16} />
        </Link>
        <div>
          <span>02</span>
          <AudioLines size={18} />
          <strong>Acoustic analysis</strong>
        </div>
        <div>
          <span>03</span>
          <ShieldCheck size={18} />
          <strong>Interpretable result</strong>
        </div>
      </div>
      <div className="demo-toolbar">
        <div>
          <h2>Genuine / spoof comparison</h2>
          <p>
            Ground truth is the declared dataset label; the model prediction is
            shown separately.
          </p>
        </div>
        <button className="button" disabled={busy} onClick={compare}>
          {busy ? (
            <LoaderCircle className="spin" size={17} />
          ) : (
            <Play size={17} />
          )}{" "}
          {busy ? "Analyzing recordings..." : "Run comparison"}
        </button>
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {busy && (
        <div className="processing" role="status">
          <div className="indeterminate" />
          <p>
            Running the existing first-second pipeline on both local WAV files.
          </p>
        </div>
      )}
      <div className="demo-comparison">
        {["bonafide", "spoof"].map((label) => (
          <SamplePanel
            key={selection[label].name}
            label={label}
            sample={selection[label]}
            onChange={(name) => choose(label, name)}
            result={results[label]}
            busy={busy}
          />
        ))}
      </div>
      {ready && (
        <motion.section
          className="comparison-evidence"
          initial={{ opacity: reduceMotion ? 1 : 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="section-title">
            <div>
              <h2>Spoof scores, at the operating point</h2>
              <p>
                Actual API outputs from this comparison. Dashed line: fixed
                spoof threshold.
              </p>
            </div>
            <Check size={20} />
          </div>
          <div className="comparison-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chart}
                layout="vertical"
                margin={{ left: 5, right: 20, top: 10, bottom: 10 }}
              >
                <XAxis type="number" domain={[0, 1]} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={110}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip formatter={(value) => Number(value).toFixed(8)} />
                <ReferenceLine
                  x={results.spoof.acoustic.threshold}
                  stroke="#a97734"
                  strokeDasharray="4 3"
                />
                <Bar
                  dataKey="score"
                  name="Spoof model score"
                  barSize={22}
                  isAnimationActive={!reduceMotion}
                >
                  {chart.map((row) => (
                    <Cell
                      key={row.label}
                      fill={row.label === "spoof" ? "#7962d7" : "#418576"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.section>
      )}
      <section className="demo-benchmark">
        <div>
          <span className="eyebrow">MEASURED LOCALLY · SIX DEMO FILES</span>
          <h2>A demonstration, not a generalization claim.</h2>
          <p>
            3 declared bonafide + 3 declared spoof samples. Fixed first-second
            inference; no threshold tuning.{" "}
            {
              audit
                .confusion_matrix_true_rows_predicted_columns_bonafide_spoof[1][1]
            }{" "}
            of 3 spoofs alerted;{" "}
            {
              audit
                .confusion_matrix_true_rows_predicted_columns_bonafide_spoof[0][1]
            }{" "}
            of 3 bonafide clips alerted in the saved local audit.
          </p>
          <p className="caption">
            Source: docs/competition_baseline.json. First three files per class
            from the ASVspoof2019 LA test stream, not a random or independently
            validated sample. Original utterance IDs were not retained.
          </p>
        </div>
        <Link className="button secondary" to="/model">
          Architecture & limitations <ArrowRight size={16} />
        </Link>
      </section>
      <div className="scope-banner">
        <ShieldCheck size={20} />
        <p>
          Only the first second is analyzed. A below-threshold result is
          inconclusive. Unseen spoof systems can evade detection.
        </p>
        <Link to="/record">
          <Mic size={15} /> Record audio
        </Link>
      </div>
    </>
  );
}
