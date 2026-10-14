export const MAX_BYTES = 20 * 1024 * 1024;

export async function decode(file) {
  const context = new AudioContext();
  try {
    return await context.decodeAudioData(await file.arrayBuffer());
  } finally {
    await context.close();
  }
}

export function toWav(buffer) {
  const samples = buffer.length;
  const view = new DataView(new ArrayBuffer(44 + samples * 2));
  const text = (offset, value) =>
    [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, 36 + samples * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, samples * 2, true);
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) =>
    buffer.getChannelData(i),
  );
  for (let i = 0; i < samples; i++) {
    const value = Math.max(
      -1,
      Math.min(1, channels.reduce((sum, c) => sum + c[i], 0) / channels.length),
    );
    view.setInt16(44 + i * 2, value * (value < 0 ? 32768 : 32767), true);
  }
  return new File([view], `recording-${Date.now()}.wav`, { type: "audio/wav" });
}
