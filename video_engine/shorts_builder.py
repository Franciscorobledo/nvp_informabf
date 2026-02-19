from __future__ import annotations

import os
import re
from pathlib import Path

from moviepy.editor import AudioFileClip, ColorClip, CompositeVideoClip, TextClip


def extract_keywords(script: str, limit: int = 5) -> list[str]:
    words = re.findall(r"[a-zA-Z]{4,}", script.lower())
    seen: list[str] = []
    for word in words:
        if word not in seen:
            seen.append(word)
        if len(seen) >= limit:
            break
    return seen


def build_vertical_video(script: str, audio_path: str, output_path: str) -> str:
    Path(os.path.dirname(output_path)).mkdir(parents=True, exist_ok=True)
    audio = AudioFileClip(audio_path)
    duration = min(30, audio.duration)

    bg = ColorClip(size=(1080, 1920), color=(15, 23, 42), duration=duration)
    lines = script.split(".")
    subtitle = "\n".join([line.strip() for line in lines if line.strip()][:3])

    text = TextClip(
        subtitle,
        fontsize=62,
        color="white",
        method="caption",
        size=(930, None),
        align="center",
    ).set_position(("center", "center")).set_duration(duration)

    final = CompositeVideoClip([bg, text]).set_audio(audio)
    final.write_videofile(output_path, fps=24, codec="libx264", audio_codec="aac", logger=None)
    final.close()
    bg.close()
    text.close()
    audio.close()
    return output_path
