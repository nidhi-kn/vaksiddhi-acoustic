import { useEffect, useRef } from "react";
export default function Waveform({ buffer, live = false, analyser }) {
  const canvas = useRef(null);
  useEffect(() => {
    const element = canvas.current;
    let frame;
    function draw() {
      const width = element.clientWidth;
      element.width = width * 2;
      element.height = 180;
      const ctx = element.getContext("2d");
      ctx.scale(2, 2);
      ctx.clearRect(0, 0, width, 90);
      ctx.fillStyle = "#7864e8";
      let values;
      if (live && analyser) {
        values = new Uint8Array(analyser.fftSize);
        analyser.getByteTimeDomainData(values);
      } else if (buffer) values = buffer.getChannelData(0);
      const bars = Math.floor(width / 5);
      for (let i = 0; i < bars; i++) {
        let peak = 0.015;
        if (values) {
          const start = Math.floor((i * values.length) / bars),
            end = Math.max(
              start + 1,
              Math.floor(((i + 1) * values.length) / bars),
            );
          for (let j = start; j < end; j++)
            peak = Math.max(
              peak,
              live ? Math.abs((values[j] - 128) / 128) : Math.abs(values[j]),
            );
        }
        const height = Math.max(2, peak * 78);
        ctx.fillRect(i * 5, 45 - height / 2, 2, height);
      }
      if (live) frame = requestAnimationFrame(draw);
    }
    draw();
    const resize = () => {
      cancelAnimationFrame(frame);
      draw();
    };
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, [buffer, live, analyser]);
  return (
    <canvas
      ref={canvas}
      className="waveform"
      aria-label={live ? "Live microphone waveform" : "Audio waveform preview"}
    />
  );
}
