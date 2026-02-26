import json
import sys

class Logger:
    SKIP_GEOJSON = False
    
    @staticmethod
    def debug(message):
        # Debug messages are less critical, just print to stdout without JSON formatting
        print(json.dumps({"status": "debug", "message": message}))
        sys.stdout.flush()
    
    @staticmethod
    def info(message, status="progress", progress=None):
        payload = {"status": status, "message": message}
        if progress is not None:
            payload["progress"] = progress
        print(json.dumps(payload))
        sys.stdout.flush()

    @staticmethod
    def error(message):
        print(json.dumps({"status": "error", "message": message}))
        sys.stdout.flush()

    @staticmethod
    def success(message):
        print(json.dumps({"status": "success", "message": message}))
        sys.stdout.flush()

    @staticmethod
    def geojson(data, message="Updating map preview..."):
        if Logger.SKIP_GEOJSON:
            return
        print(json.dumps({"type": "geojson", "data": data, "message": message}))
        sys.stdout.flush()
