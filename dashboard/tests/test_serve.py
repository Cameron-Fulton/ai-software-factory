"""The file server: password required, only files inside its folder."""
from __future__ import annotations

import base64
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from factory_dashboard import serve  # noqa: E402


class Serve(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        base = Path(tempfile.mkdtemp())
        root = base / "www"
        (root / "_next" / "static").mkdir(parents=True)
        (root / "index.html").write_text("<p>hello</p>")
        (root / "data.json").write_text('{"ok":true}')
        (root / "_next" / "static" / "app.js").write_text("1")
        (base / "secret.txt").write_text("outside")
        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), serve.handler(root, b"cam:s3cret"))
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()
        cls.base = f"http://127.0.0.1:{cls.httpd.server_address[1]}"

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()

    def get(self, path, login="cam:s3cret"):
        req = urllib.request.Request(self.base + path)
        if login:
            req.add_header("Authorization", "Basic " + base64.b64encode(login.encode()).decode())
        try:
            with urllib.request.urlopen(req) as r:
                return r.status, r.read(), dict(r.headers)
        except urllib.error.HTTPError as e:
            return e.code, b"", dict(e.headers)

    def test_no_or_wrong_password_is_refused(self):
        self.assertEqual(self.get("/", None)[0], 401)
        self.assertEqual(self.get("/data.json", "cam:nope")[0], 401)
        self.assertEqual(self.get("/", "garbage")[0], 401)

    def test_the_app_and_its_data_are_served(self):
        code, body, headers = self.get("/")
        self.assertEqual((code, body), (200, b"<p>hello</p>"))
        self.assertEqual(headers.get("X-Robots-Tag"), "noindex, nofollow")
        code, body, headers = self.get("/data.json?t=1")
        self.assertEqual((code, body), (200, b'{"ok":true}'))
        self.assertIn("no-store", headers.get("Cache-Control"))
        self.assertIn("immutable", self.get("/_next/static/app.js")[2].get("Cache-Control"))

    def test_nothing_outside_the_folder(self):
        for path in ("/../secret.txt", "/%2e%2e/secret.txt", "/_next/../../secret.txt", "/missing", "/_next/"):
            self.assertEqual(self.get(path)[0], 404, path)


if __name__ == "__main__":
    unittest.main()
