from __future__ import annotations

from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload


class YouTubeUploadClient:
    def __init__(self, access_token: str | None):
        self.access_token = access_token

    def upload_short(
        self,
        video_path: str,
        title: str,
        description: str,
        tags: list[str],
        privacy_status: str = "private",
    ) -> dict:
        if not self.access_token:
            raise ValueError("YouTube refresh/access token is not configured")

        youtube = build("youtube", "v3", developerKey=self.access_token)
        media = MediaFileUpload(video_path, chunksize=-1, resumable=True, mimetype="video/mp4")
        request = youtube.videos().insert(
            part="snippet,status",
            body={
                "snippet": {
                    "title": title,
                    "description": description,
                    "tags": tags,
                    "categoryId": "27",
                },
                "status": {"privacyStatus": privacy_status},
            },
            media_body=media,
        )
        response = request.execute()
        return {"video_id": response.get("id")}
