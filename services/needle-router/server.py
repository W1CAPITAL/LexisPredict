#!/usr/bin/env python3
"""Self-hosted Cactus Needle 3 action ROUTER for LexisPredict.
pip install cactus-needle
NEEDLE_ROUTER_TOKEN=... python services/needle-router/server.py
All inferred actions are read-only. Never run commands, send messages or mutate cases.
"""
import json
import os
import hmac
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HOST = os.environ.get("NEEDLE_HOST", "127.0.0.1")
PORT = int(os.environ.get("NEEDLE_PORT", "8751"))
TOKEN = os.environ.get("NEEDLE_ROUTER_TOKEN", "")
# Avoid telemetry on sensitive corporate deployments.
os.environ.setdefault("NEEDLE_TELEMETRY","0")
os.environ.setdefault("DO_NOT_TRACK","1")
MODEL = None
STARTUP_ERROR = None

try:
    import needle

    @needle.tool
    def search_internal_knowledge(topic: str):
        """Identify a topic to search in LexisPredict's existing curated legal manual. Only generic legal knowledge. Never send messages, make changes, or open customer data."""
        return {"topic": topic}

    MODEL = needle.Needle(tools=[search_internal_knowledge])
except Exception as error:
    STARTUP_ERROR = type(error).__name__


class Handler(BaseHTTPRequestHandler):
    def _reply(self, status, body):
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _authorized(self):
        if len(TOKEN) < 24:
            return False
        auth = self.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            return hmac.compare_digest(auth[7:], TOKEN)
        return False

    def do_GET(self):
        if not self._authorized():
            return self._reply(401, {"error": "Unauthorized"})
        if self.path == "/health":
            return self._reply(200, {"ready": MODEL is not None, "engine": "Cactus Needle 3",
                                     "reason": STARTUP_ERROR})
        return self._reply(404, {"error": "Not found"})

    def do_POST(self):
        if not self._authorized():
            return self._reply(401, {"error": "Unauthorized"})
        if self.path != "/route":
            return self._reply(404, {"error": "Not found"})
        if MODEL is None:
            return self._reply(503, {"error": "Needle 3 unavailable", "reason": STARTUP_ERROR})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > 4096:
                return self._reply(413, {"error": "Input too large"})
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            query = str(payload.get("query", ""))[:600]
            if not query:
                return self._reply(400, {"error": "Empty query"})
            output = MODEL.run(query)
            calls = output.get("function_calls", []) if isinstance(output, dict) else []
            confidence = output.get("confidence") if isinstance(output, dict) else None
            filtered = []
            for call in calls[:2]:
                if call.get("name") != "search_internal_knowledge":
                    continue
                args = call.get("arguments", {})
                if isinstance(args, dict) and isinstance(args.get("topic"), str):
                    filtered.append({"name": "search_internal_knowledge", "arguments": {"topic": args["topic"][:150]}})
            return self._reply(200, {"function_calls": filtered, "confidence": confidence})
        except Exception as error:
            return self._reply(500, {"error": type(error).__name__})

    def log_message(self, fmt, *args):
        pass  # Do not log queries or identifiers.

if __name__ == "__main__":
    if len(TOKEN) < 24:
        raise SystemExit("Set a secure 24+ char NEEDLE_ROUTER_TOKEN before starting.")
    print("Needle private router listening on %s:%s, ready=%s" % (HOST, PORT, MODEL is not None))
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
