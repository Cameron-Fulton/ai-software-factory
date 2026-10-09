"""Serve the dashboard app and its data, checking the same password the proxy checks.

The proxy already demands the password, but this server listens on the Docker bridge, where any
container on the host could reach it directly. So it checks the forwarded Basic credential too.
It serves regular files inside one folder only: no directory listings, nothing outside it.

    python -m factory_dashboard.serve --bind 172.17.0.1 --port 8090 --root /var/lib/factory-dashboard/www
The expected "user:password" is read from the file named by $CREDENTIALS_DIRECTORY/login
(systemd LoadCredential), never from the command line.
"""
from __future__ import annotations

import argparse
import base64
import hmac
import mimetypes
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

SECURITY = {
    "X-Robots-Tag": "noindex, nofollow",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
}
TYPES = {".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".html": "text/html",
         ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".woff2": "font/woff2",
         ".txt": "text/plain"}


def allowed(header: str | None, expected: bytes) -> bool:
    if not header or not header.startswith("Basic "):
        return False
    try:
        given = base64.b64decode(header[6:].strip(), validate=True)
    except ValueError:
        return False
    return hmac.compare_digest(given, expected)


def resolve(root: Path, raw_path: str) -> Path | None:
    """The file a request names, or None when it is missing or would leave the root."""
    path = unquote(urlsplit(raw_path).path)
    if "\x00" in path:
        return None
    rel = path.lstrip("/") or "index.html"
    target = (root / rel).resolve()
    if target.is_dir():
        target = target / "index.html"
    try:
        target.relative_to(root)
    except ValueError:
        return None
    return target if target.is_file() else None


def handler(root: Path, expected: bytes):
    root = root.resolve()

    class Files(BaseHTTPRequestHandler):
        server_version = "factory-dashboard"
        sys_version = ""

        def empty(self, code: int, extra: dict | None = None):
            self.send_response(code)
            for k, v in {**SECURITY, **(extra or {})}.items():
                self.send_header(k, v)
            self.send_header("Content-Length", "0")
            self.end_headers()

        def do_GET(self):
            if not allowed(self.headers.get("Authorization"), expected):
                return self.empty(401, {"WWW-Authenticate": 'Basic realm="Factory dashboard"'})
            target = resolve(root, self.path)
            if target is None:
                return self.empty(404)
            try:
                body = target.read_bytes()
            except OSError:
                return self.empty(503)
            kind = TYPES.get(target.suffix) or mimetypes.guess_type(target.name)[0] or "application/octet-stream"
            immutable = "/_next/static/" in target.as_posix()
            self.send_response(200)
            for k, v in SECURITY.items():
                self.send_header(k, v)
            self.send_header("Content-Type", kind + ("; charset=utf-8" if kind.startswith("text/") or kind.endswith("json") else ""))
            self.send_header("Cache-Control", "private, max-age=31536000, immutable" if immutable else "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, fmt, *args):  # nothing logged: no paths, never the Authorization header
            pass

    return Files


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--bind", required=True)
    ap.add_argument("--port", type=int, required=True)
    ap.add_argument("--root", required=True)
    args = ap.parse_args(argv)
    creds = os.environ.get("CREDENTIALS_DIRECTORY")
    if not creds:
        raise SystemExit("no CREDENTIALS_DIRECTORY: start this through its systemd unit")
    expected = (Path(creds) / "login").read_bytes().strip()
    if b":" not in expected:
        raise SystemExit("the login credential must be user:password")
    ThreadingHTTPServer((args.bind, args.port), handler(Path(args.root), expected)).serve_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
