import { useState } from "react";
import { Link } from "react-router-dom";
import { Database, Info, AudioLines, ArrowRight } from "lucide-react";
import { percent } from "./lib";
import { PageTitle } from "./components";
import testMetrics from "../../results/presentation/student_mobilenetv2_test_metrics.json";
import validationMetrics from "../../results/presentation/student_mobilenetv2_validation_metrics.json";
import testRoc from "../../results/student_mobilenetv2_corrected_teacher_test_roc.png";
export function ModelPage() {
  const [split, setSplit] = useState("test"),
    metrics = split === "test" ? testMetrics : validationMetrics;
  return (
    <>
      <PageTitle
        eyebrow="TRANSPARENT BY DESIGN"
        title="Model information"
        text="The architecture, evidence and limits behind every result."
      />
      <section className="model-intro">
        <div className="model-symbol">
          <Database size={42} />
        </div>
        <div>
          <span className="badge neutral">ACOUSTIC CLASSIFIER</span>
          <h2>MobileNetV2Student</h2>
          <p>
            Single-channel MobileNetV2 with a two-class output head. Loaded from
            the existing corrected-teacher knowledge-distillation checkpoint.
          </p>
          <code>student_mobilenetv2_kd_corrected_teacher.pt</code>
        </div>
      </section>
      <div className="info-grid">
        <section>
          <h2>Preprocessing contract</h2>
          <dl className="facts vertical">
            {[
              ["Audio", "Mono, resampled to 16,000 Hz"],
              ["Window", "First 1 second; zero-pad shorter inputs"],
              ["Features", "80-bin log-Mel; FFT 400; hop 160"],
              ["Input tensor", "[B, 1, 80, 101]"],
              ["Output", "Softmax: 0 bonafide, 1 spoof"],
              ["Alert threshold", "Spoof score ≥ 0.05530281"],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section>
          <div className="section-title">
            <h2>Recorded evaluation</h2>
            <select
              aria-label="Evaluation split"
              value={split}
              onChange={(e) => setSplit(e.target.value)}
            >
              <option value="test">Test sample</option>
              <option value="validation">Validation sample</option>
            </select>
          </div>
          <p className="muted">
            ASVspoof 2019 LA · {metrics.examples_evaluated.toLocaleString()}{" "}
            examples · 1,000 per class
          </p>
          <div className="evaluation-grid">
            {[
              ["Recorded accuracy", percent(metrics.accuracy)],
              ["ROC-AUC", metrics.roc_auc.toFixed(6)],
              ["Spoof recall", percent(metrics.recall_spoof_class)],
              ["Approximate EER", percent(metrics.eer_approx)],
            ].map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <div className="notice">
            <Info size={18} />
            <p>{metrics.notes}</p>
          </div>
          <p className="caption">
            Source: results/presentation/student_mobilenetv2_{split}
            _metrics.json. Saved historical results; not a new evaluation or
            full-split benchmark. Selection: {metrics.selection_method}.
          </p>
        </section>
      </div>
      <section className="limitations">
        <figure className="evaluation-figure">
          <img
            src={testRoc}
            alt="Saved ROC curve from the sampled test evaluation"
          />
          <figcaption>
            Saved test ROC plot. Historical sampled evaluation, not a new
            benchmark.
          </figcaption>
        </figure>
        <h2>Know the boundaries</h2>
        <div className="info-grid">
          <div>
            <h3>Acoustics only</h3>
            <p>
              No semantic scam analysis, speaker identity verification, fusion
              or live-call monitoring. Microphone clips are processed only after
              recording stops.
            </p>
          </div>
          <div>
            <h3>Limited generalization</h3>
            <p>
              The saved test sample missed 247 of 1,000 spoof examples.
              Diagnostics identify spoof systems A17–A19 as particularly
              difficult. Model scores are not calibrated probabilities of
              real-world authenticity.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
export function About() {
  return (
    <>
      <PageTitle
        eyebrow="ABOUT THE PROJECT"
        title="Vak-Siddhi"
        text="An acoustic voice-spoof screening research prototype."
      />
      <section className="about-body">
        <div className="about-mark">
          <AudioLines size={54} />
        </div>
        <h2>A thoughtful layer of acoustic evidence.</h2>
        <p>
          Vak-Siddhi explores whether a lightweight student model can identify
          synthetic or spoofed speech signals in prerecorded audio. This
          workspace makes the existing Python inference pipeline accessible
          through a local web interface.
        </p>
        <p>
          Upload or record audio, inspect model scores and review locally saved
          analysis metadata. The original command-line and Python GUI workflows
          remain available.
        </p>
        <div className="notice">
          <Info size={22} />
          <p>
            This is an academic screening prototype. It does not prove
            authenticity, establish identity or determine whether a caller is
            safe. The ML system requires broader evaluation before deployment in
            consequential settings.
          </p>
        </div>
        <Link className="button secondary" to="/model">
          Explore the model <ArrowRight size={17} />
        </Link>
      </section>
    </>
  );
}
