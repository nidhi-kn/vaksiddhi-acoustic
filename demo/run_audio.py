"""Command-line prerecorded audio inference."""

import argparse
import json
import sys

from demo.inference import AcousticAnalyzer


def main():
    parser = argparse.ArgumentParser(description="Run Vak-Siddhi acoustic spoof screening on a recording.")
    parser.add_argument("audio", help="Path to a prerecorded audio file")
    args = parser.parse_args()
    try:
        result = AcousticAnalyzer().analyze(args.audio)
    except Exception as exc:
        print(f"Analysis failed: {exc}", file=sys.stderr)
        return 2
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
