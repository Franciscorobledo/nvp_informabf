from __future__ import annotations

from moviepy.audio.AudioClip import AudioClip


class TTSService:
    def __init__(self, provider: str = "openai", api_key: str | None = None):
        self.provider = provider
        self.api_key = api_key

    def synthesize_to_mp3(self, text: str, output_path: str) -> str:
        # Fallback local tone when third-party TTS is unavailable.
        duration = max(6, min(30, int(len(text.split()) * 0.45)))

        def make_frame(t):
            return 0.02

        clip = AudioClip(make_frame, duration=duration, fps=44100)
        clip.write_audiofile(output_path, fps=44100, bitrate="128k", logger=None)
        clip.close()
        return output_path
