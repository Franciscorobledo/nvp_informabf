from __future__ import annotations

import requests


class StockMediaClient:
    def __init__(self, pexels_api_key: str | None = None, pixabay_api_key: str | None = None):
        self.pexels_api_key = pexels_api_key
        self.pixabay_api_key = pixabay_api_key

    def search_video_urls(self, keyword: str, per_page: int = 3) -> list[str]:
        if self.pexels_api_key:
            response = requests.get(
                "https://api.pexels.com/videos/search",
                params={"query": keyword, "per_page": per_page},
                headers={"Authorization": self.pexels_api_key},
                timeout=15,
            )
            if response.ok:
                items = response.json().get("videos", [])
                urls = []
                for item in items:
                    files = item.get("video_files", [])
                    if files:
                        urls.append(files[0].get("link"))
                return [u for u in urls if u]
        return []
