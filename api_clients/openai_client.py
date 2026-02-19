from __future__ import annotations

import json
from typing import Any

from openai import OpenAI


class OpenAIShortsClient:
    def __init__(self, api_key: str | None):
        self.api_key = api_key
        self.client = OpenAI(api_key=api_key) if api_key else None

    def _chat(self, prompt: str) -> str:
        if not self.client:
            return ""
        response = self.client.responses.create(
            model="gpt-4o-mini",
            input=prompt,
            max_output_tokens=220,
        )
        return response.output_text.strip()

    def random_topic(self) -> str:
        text = self._chat(
            "Generate one short viral educational topic suitable for a 30-second YouTube Short. Return plain text only."
        )
        return text or "Why your brain loves short-form learning"

    def generate_script(self, topic: str) -> str:
        prompt = (
            f"Create a YouTube Shorts narration script about: {topic}. "
            "Rules: maximum 80 words, short punchy sentences, curiosity hook in first sentence, impactful ending."
        )
        text = self._chat(prompt)
        return text or f"Did you know {topic} can change how you think? In seconds, here is the key idea. Learn one actionable fact and test it today. Small knowledge, big advantage."

    def generate_metadata(self, script: str) -> dict[str, Any]:
        prompt = (
            "Return valid JSON with keys title, description, hashtags (array), tags (array) for this script: "
            f"{script}"
        )
        text = self._chat(prompt)
        if text:
            try:
                parsed = json.loads(text)
                if isinstance(parsed, dict):
                    return parsed
            except json.JSONDecodeError:
                pass
        return {
            "title": "30-Second Learning Hack #Shorts",
            "description": script[:140],
            "hashtags": ["#Shorts", "#Education", "#LearnFast"],
            "tags": ["shorts", "education", "viral"],
        }
