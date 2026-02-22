import json
import sys
import traceback as _tb
from datetime import datetime, timezone


def _ts() -> str:
    """Return the current UTC time as an ISO 8601 string (observability)."""
    return datetime.now(timezone.utc).isoformat()


class Logger:
    SKIP_GEOJSON = False

    @staticmethod
    def debug(message):
        print(json.dumps({"status": "debug", "message": message, "timestamp": _ts()}))
        sys.stdout.flush()

    @staticmethod
    def info(message, status="progress", progress=None):
        payload = {"status": status, "message": message, "timestamp": _ts()}
        if progress is not None:
            payload["progress"] = progress
        print(json.dumps(payload))
        sys.stdout.flush()

    @staticmethod
    def warn(message):
        print(json.dumps({"status": "warn", "message": message, "timestamp": _ts()}))
        sys.stdout.flush()

    @staticmethod
    def error(message):
        print(json.dumps({"status": "error", "message": message, "timestamp": _ts()}))
        sys.stdout.flush()

    @staticmethod
    def success(message):
        print(json.dumps({"status": "success", "message": message, "timestamp": _ts()}))
        sys.stdout.flush()

    @staticmethod
    def exception(message, exc=None):
        """Log an error with full traceback context for production debugging.

        Security note: these logs go to Python stdout, which is captured by
        the Node.js Winston logger and stored in Cloud Logging — they are never
        sent to API responses or exposed to end users.
        """
        payload: dict = {"status": "error", "message": message, "timestamp": _ts()}
        if exc is not None:
            payload["exc_type"] = type(exc).__name__
            payload["exc_msg"] = str(exc)
            payload["traceback"] = _tb.format_exc()
        print(json.dumps(payload))
        sys.stdout.flush()

    @staticmethod
    def timed(label, elapsed_s):
        """Log a timing metric for a named step (observability)."""
        print(json.dumps({
            "status": "timing",
            "label": label,
            "duration_s": round(float(elapsed_s), 3),
            "timestamp": _ts(),
        }))
        sys.stdout.flush()

    @staticmethod
    def geojson(data, message="Updating map preview..."):
        if Logger.SKIP_GEOJSON:
            return
        print(json.dumps({"type": "geojson", "data": data, "message": message}))
        sys.stdout.flush()
