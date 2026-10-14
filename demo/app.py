"""Small Tkinter interface for prerecorded WAV spoof analysis."""

from __future__ import annotations

import json
import tkinter as tk
from tkinter import filedialog, messagebox, ttk

from demo.inference import AcousticAnalyzer


class VakSiddhiApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Vak-Siddhi | Prerecorded Audio Demo")
        self.geometry("760x560")
        self.minsize(620, 430)
        self.analyzer = None
        self.audio_path = None

        ttk.Label(self, text="Vak-Siddhi", font=("Segoe UI", 22, "bold")).pack(pady=(20, 4))
        ttk.Label(self, text="Acoustic screening prototype | prerecorded audio only").pack(pady=(0, 6))
        ttk.Label(self, text="Semantic analysis and fusion are outside this demo's scope").pack(pady=(0, 18))
        row = ttk.Frame(self)
        row.pack(fill="x", padx=24)
        ttk.Button(row, text="Choose WAV file", command=self.choose_file).pack(side="left")
        self.file_label = ttk.Label(row, text="No audio selected", wraplength=520)
        self.file_label.pack(side="left", padx=12)
        self.analyze_button = ttk.Button(self, text="Analyze recording", command=self.analyze, state="disabled")
        self.analyze_button.pack(pady=16)
        self.status = ttk.Label(self, text="Select a recording to begin.")
        self.status.pack()
        self.output = tk.Text(self, wrap="word", height=18, state="disabled", font=("Consolas", 10))
        self.output.pack(fill="both", expand=True, padx=24, pady=16)

    def choose_file(self):
        path = filedialog.askopenfilename(
            title="Choose prerecorded audio",
            filetypes=[("WAV audio", "*.wav"), ("Audio files", "*.wav *.flac *.ogg *.aiff"), ("All files", "*.*")],
        )
        if path:
            self.audio_path = path
            self.file_label.configure(text=path)
            self.analyze_button.configure(state="normal")
            self.status.configure(text="Ready")

    def analyze(self):
        if not self.audio_path:
            return
        self.analyze_button.configure(state="disabled")
        self.status.configure(text="Loading checkpoint and analyzing audio…")
        self.update_idletasks()
        try:
            if self.analyzer is None:
                self.analyzer = AcousticAnalyzer()
            result = self.analyzer.analyze(self.audio_path)
            rendered = json.dumps(result, indent=2, ensure_ascii=False)
            self.output.configure(state="normal")
            self.output.delete("1.0", "end")
            self.output.insert("1.0", rendered)
            self.output.configure(state="disabled")
            self.status.configure(text=result["message"])
        except Exception as exc:
            self.status.configure(text="Analysis failed")
            messagebox.showerror("Vak-Siddhi analysis error", str(exc))
        finally:
            self.analyze_button.configure(state="normal")


def main():
    VakSiddhiApp().mainloop()


if __name__ == "__main__":
    main()
