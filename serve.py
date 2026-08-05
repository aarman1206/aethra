#!/usr/bin/env python3
"""
Serve the Vite build (`dist/`) with a single‑file Python HTTP server.
"""

import http.server
import socketserver
import socket
from pathlib import Path
import os

# Determine LAN IP address for convenient access on the same network
def get_lan_ip() -> str:
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        try:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
        except Exception:
            return "127.0.0.1"

PORT = 8000
BASE_DIR = Path(__file__).parent / "dist"

if not BASE_DIR.is_dir():
    raise SystemExit(f"⚠️  No 'dist' folder found at {BASE_DIR}. Run `npm run build` first.")

os.chdir(BASE_DIR)

handler = http.server.SimpleHTTPRequestHandler

# Attempt to create the server, handling address-in-use errors gracefully.
try:
    httpd = socketserver.TCPServer(("", PORT), handler)
except OSError as e:
    raise SystemExit(f"⚠️  Port {PORT} already in use. Stop the existing server before rerunning.") from e

print(f"🚀  Serving {BASE_DIR} at http://{get_lan_ip()}:{PORT}")
print("Press Ctrl+C to stop.")
try:
    httpd.serve_forever()
except KeyboardInterrupt:
    print("\n🛑  Server stopped.")
finally:
    httpd.server_close()
