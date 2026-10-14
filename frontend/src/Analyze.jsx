import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Mic,
  Square,
  Upload,
  FileAudio,
  X,
  LoaderCircle,
  Zap,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { decode, MAX_BYTES, toWav } from "./audio";
import { api } from "./lib";
import { hasAnalysisResponse } from "./prediction";
import { PageTitle, Result } from "./components";
import Waveform from "./Waveform";
export default function Analyze({ record = false, onSave }) {
  const [file, setFile] = useState(null),
    [buffer, setBuffer] = useState(null),
    [url, setUrl] = useState("");
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [decoding, setDecoding] = useState(false);
  const [result, setResult] = useState(null),
    [drag, setDrag] = useState(false),
    [recording, setRecording] = useState(false),
    [seconds, setSeconds] = useState(0);
  const [analyser, setAnalyser] = useState(null),
    [requesting, setRequesting] = useState(false);
  const resources = useRef({}),
    mounted = useRef(true),
    input = useRef(null);
  useEffect(() => {
    const r = resources.current;
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (r.recorder?.state === "recording") r.recorder.stop();
      r.stream?.getTracks().forEach((t) => t.stop());
      if (r.context?.state !== "closed") r.context?.close();
    };
  }, []);
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [recording]);
  useEffect(() => {
    if (
      recording &&
      seconds >= 120 &&
      resources.current.recorder?.state === "recording"
    )
      resources.current.recorder.stop();
  }, [recording, seconds]);
  async function select(candidate) {
    setError("");
    setDecoding(false);
    setResult(null);
    setFile(null);
    setBuffer(null);
    if (!candidate) return;
    if (!candidate.name.toLowerCase().endsWith(".wav")) {
      setError("Please select a WAV recording.");
      return;
    }
    if (!candidate.size || candidate.size > MAX_BYTES) {
      setError("Choose a non-empty WAV file up to 20 MiB.");
      return;
    }
    setDecoding(true);
    try {
      const decoded = await decode(candidate);
      if (decoded.duration > 120)
        throw new Error("Recording must be 120 seconds or shorter.");
      if (mounted.current) {
        setBuffer(decoded);
        setFile(candidate);
        setUrl(URL.createObjectURL(candidate));
      }
    } catch (e) {
      if (mounted.current)
        setError(e.message || "Could not decode this recording.");
    } finally {
      if (mounted.current) setDecoding(false);
    }
  }
  async function start() {
    setError("");
    setRequesting(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
        throw new Error(
          "Microphone recording requires a supported browser on localhost or HTTPS.",
        );
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      resources.current.stream = stream;
      if (!mounted.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const context = new AudioContext(),
        node = context.createAnalyser();
      node.fftSize = 1024;
      resources.current.context = context;
      context.createMediaStreamSource(stream).connect(node);
      const recorder = new MediaRecorder(stream),
        chunks = [];
      resources.current.recorder = recorder;
      setAnalyser(node);
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (context.state !== "closed") await context.close();
        if (!mounted.current) return;
        setRecording(false);
        setDecoding(true);
        try {
          const decoded = await decode(
            new Blob(chunks, { type: recorder.mimeType }),
          );
          await select(toWav(decoded));
        } catch {
          setError("Could not convert the microphone recording to WAV.");
          setDecoding(false);
        }
      };
      recorder.onerror = () => {
        setError("The microphone recording failed.");
        if (recorder.state === "recording") recorder.stop();
      };
      setFile(null);
      setResult(null);
      setSeconds(0);
      setRecording(true);
      recorder.start(250);
    } catch (e) {
      resources.current.stream?.getTracks().forEach((t) => t.stop());
      if (resources.current.context?.state !== "closed")
        resources.current.context?.close();
      setRecording(false);
      setError(
        e.name === "NotAllowedError"
          ? "Microphone permission was denied. Allow access in your browser and try again."
          : e.message,
      );
    } finally {
      setRequesting(false);
    }
  }
  async function analyze() {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const { data } = await api.post("/api/analyze", form);
      if (!hasAnalysisResponse(data)) {
        setError(
          "The API returned an unsupported prediction contract. No result was classified or saved. Check the backend version and retry.",
        );
        return;
      }
      const item = {
        ...data,
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        source: record ? "Microphone" : "Upload",
        duration: buffer.duration,
      };
      onSave(item);
      if (mounted.current) setResult(item);
    } catch (e) {
      if (mounted.current)
        setError(
          typeof e.response?.data?.detail === "string"
            ? e.response.data.detail
            : "Analysis failed. Check that the backend is running, then retry.",
        );
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="ACOUSTIC WORKSPACE"
        title={record ? "Record audio" : "Analyze audio"}
        text={
          record
            ? "Capture a recording, then screen it for acoustic spoof signals."
            : "A closer look at the voice behind the recording."
        }
      />
      <div className="analysis-layout">
        <section>
          <div className="panel">
            <div className="section-title">
              <h2>{record ? "Microphone recording" : "Upload a recording"}</h2>
              <span className="muted">
                {record ? "Up to 2 minutes" : "WAV audio"}
              </span>
            </div>
            {record ? (
              <div className="recorder">
                <div className={`mic-circle ${recording ? "recording" : ""}`}>
                  <Mic size={32} />
                </div>
                <strong className="timer">
                  {Math.floor(seconds / 60)}:
                  {String(seconds % 60).padStart(2, "0")}
                </strong>
                <p>
                  {recording ? "Recording in progress" : "Ready when you are"}
                </p>
                <Waveform live={recording} analyser={analyser} />
                <button
                  className="button"
                  disabled={busy || decoding || requesting}
                  onClick={
                    recording ? () => resources.current.recorder.stop() : start
                  }
                >
                  {recording ? <Square size={16} /> : <Mic size={16} />}{" "}
                  {recording
                    ? "Stop recording"
                    : requesting
                      ? "Requesting permission..."
                      : "Start recording"}
                </button>
              </div>
            ) : (
              <div
                className={`dropzone ${drag ? "dragging" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (!busy && !decoding) setDrag(true);
                }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDrag(false);
                  if (!busy && !decoding) select(e.dataTransfer.files[0]);
                }}
              >
                <div className="upload-icon">
                  <Upload size={26} />
                </div>
                <h3>Drop your audio file here</h3>
                <p>or choose a recording from your device</p>
                <button
                  className="button secondary"
                  disabled={busy || decoding}
                  onClick={() => input.current.click()}
                >
                  <FileAudio size={16} /> Browse files
                </button>
                <span className="caption">
                  WAV only · Up to 20 MiB · Maximum 120 seconds
                </span>
                <input
                  ref={input}
                  type="file"
                  accept=".wav,audio/wav"
                  hidden
                  onChange={(e) => {
                    select(e.target.files[0]);
                    e.target.value = "";
                  }}
                />
              </div>
            )}
            {decoding && (
              <div className="skeleton" role="status">
                Decoding audio...
              </div>
            )}
            {file && (
              <div className="audio-preview">
                <div className="file-row">
                  <FileAudio size={22} />
                  <div>
                    <strong>{file.name}</strong>
                    <span>
                      {buffer.duration.toFixed(1)} sec ·{" "}
                      {(file.size / 1024).toFixed(0)} KiB ·{" "}
                      {buffer.sampleRate.toLocaleString()} Hz preview
                    </span>
                  </div>
                  <button
                    className="icon-button"
                    aria-label="Remove recording"
                    disabled={busy}
                    onClick={() => {
                      setFile(null);
                      setBuffer(null);
                      setResult(null);
                    }}
                  >
                    <X size={18} />
                  </button>
                </div>
                <Waveform buffer={buffer} />
                <audio
                  controls
                  src={url}
                  aria-label="Play selected recording"
                />
                <button
                  className="button analyze-button"
                  onClick={analyze}
                  disabled={busy || recording}
                >
                  {busy ? (
                    <LoaderCircle className="spin" size={18} />
                  ) : (
                    <Zap size={18} />
                  )}{" "}
                  {busy ? "Processing audio..." : "Analyze recording"}
                  <ArrowRight size={17} />
                </button>
              </div>
            )}
            {busy && (
              <div className="processing" role="status">
                <div className="indeterminate" />
                <p>
                  Running the existing acoustic pipeline. Results will appear
                  when inference completes.
                </p>
              </div>
            )}
            {error && (
              <div className="error" role="alert">
                {error}
              </div>
            )}
          </div>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="panel"
            >
              <Result result={result} autoReveal />
            </motion.div>
          )}
        </section>
        <aside className="analysis-aside">
          <div className="eyebrow">WHAT GETS ANALYZED</div>
          <h2>
            One second.
            <br />A focused acoustic check.
          </h2>
          <p>
            The model uses the first second of your recording. Shorter clips are
            zero-padded.
          </p>
          <ol className="pipeline">
            {[
              "Decode & mix to mono",
              "Resample to 16 kHz",
              "Extract log-Mel features",
              "Score with MobileNetV2",
            ].map((x, i) => (
              <li key={x}>
                <span>{i + 1}</span>
                {x}
              </li>
            ))}
          </ol>
          <div className="notice">
            <ShieldCheck size={20} />
            <p>
              Audio is processed by your local backend and temporary uploads are
              deleted. Only result metadata is saved in this browser.
            </p>
          </div>
          <p className="caption">
            A below-threshold result does not establish that a recording is
            genuine or a caller is safe.
          </p>
        </aside>
      </div>
    </>
  );
}
