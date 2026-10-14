import io
import numpy as np
import torch
import torchaudio
import soundfile as sf


TARGET_SAMPLE_RATE = 16000
N_MELS = 80
N_FFT = 400
HOP_LENGTH = 160


def load_audio(path):
    audio, sample_rate = sf.read(path, dtype="float32")

    if audio.ndim > 1:
        audio = np.mean(audio, axis=1)

    waveform = torch.tensor(audio, dtype=torch.float32)

    if sample_rate != TARGET_SAMPLE_RATE:
        waveform = torchaudio.functional.resample(
            waveform,
            sample_rate,
            TARGET_SAMPLE_RATE
        )

    return waveform


def audio_to_logmel(audio, sample_rate=None):
    """
    Convert waveform or raw audio bytes to an 80-bin log-Mel spectrogram.
    """

    # Raw bytes from Hugging Face
    if isinstance(audio, (bytes, bytearray)):
        audio, sr = sf.read(
            io.BytesIO(audio),
            dtype="float32"
        )

        if audio.ndim > 1:
            audio = np.mean(audio, axis=1)

        waveform = torch.tensor(audio, dtype=torch.float32)

        if sample_rate is None:
            sample_rate = sr

    # NumPy audio
    elif isinstance(audio, np.ndarray):
        if audio.ndim > 1:
            audio = np.mean(audio, axis=1)

        waveform = torch.tensor(audio, dtype=torch.float32)

    # Torch audio
    elif isinstance(audio, torch.Tensor):
        waveform = audio.float()

        if waveform.ndim > 1:
            waveform = waveform.mean(dim=0)

    else:
        raise TypeError(
            f"Unsupported audio type: {type(audio)}"
        )

    if sample_rate is None:
        sample_rate = TARGET_SAMPLE_RATE

    if sample_rate != TARGET_SAMPLE_RATE:
        waveform = torchaudio.functional.resample(
            waveform,
            sample_rate,
            TARGET_SAMPLE_RATE
        )

    # Keep fixed length expected by the model
    target_length = TARGET_SAMPLE_RATE

    if waveform.numel() < target_length:
        waveform = torch.nn.functional.pad(
            waveform,
            (0, target_length - waveform.numel())
        )
    else:
        waveform = waveform[:target_length]

    mel_transform = torchaudio.transforms.MelSpectrogram(
        sample_rate=TARGET_SAMPLE_RATE,
        n_fft=N_FFT,
        hop_length=HOP_LENGTH,
        n_mels=N_MELS
    )

    mel = mel_transform(waveform)

    log_mel = torch.log(mel + 1e-6)

    return log_mel


# Compatibility alias
audio_to_log_mel = audio_to_logmel