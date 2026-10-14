
from pathlib import Path
from datasets import load_dataset, Audio
import soundfile as sf
import numpy as np
import io

output = Path("test_audio")
output.mkdir(exist_ok=True)

print("Connecting to ASVspoof dataset...")

ds = load_dataset(
    "SpeechAntiSpoofingBenchmarks/ASVspoof2019_LA",
    split="test",
    streaming=True,
)

# Disable automatic audio decoding to avoid torchcodec
ds = ds.cast_column("audio", Audio(decode=False))

counts = {"bonafide": 0, "spoof": 0}

for sample in ds:
    label = "bonafide" if sample["label"] == 0 else "spoof"

    if counts[label] >= 3:
        continue

    audio = sample["audio"]

    if audio["bytes"] is not None:
        waveform, sample_rate = sf.read(
            io.BytesIO(audio["bytes"]),
            dtype="float32"
        )
    elif audio["path"] is not None:
        waveform, sample_rate = sf.read(
            audio["path"],
            dtype="float32"
        )
    else:
        raise ValueError("No audio data found")

    counts[label] += 1
    filename = f"{label}_{counts[label]}.wav"

    sf.write(
        output / filename,
        np.asarray(waveform),
        sample_rate
    )

    print(f"Saved: {filename} ({sample_rate} Hz)")

    if all(count == 3 for count in counts.values()):
        break

print(f"\nDownloaded: {counts}")
print("Audio files saved in test_audio/")
