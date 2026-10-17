"""Trusted HTTP/auth fixture. Only billing.py is supplied by the repair agent.

Stdlib only; runs in CreateOS, never in the trusted controller.
"""
import hashlib
import hmac
import importlib.util
import json
import os
import re
import sqlite3
import time
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CONFIG = ROOT / "private-config.json"
DB = ROOT / "sample.sqlite"


def settings():
    return json.loads(CONFIG.read_text())


def connect():
    db = sqlite3.connect(DB)
    db.row_factory = sqlite3.Row
    db.executescript("""
        CREATE TABLE IF NOT EXISTS access(customer_id TEXT PRIMARY KEY, subscription_id TEXT, allowed INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY, type TEXT, object_id TEXT, customer_id TEXT, received_at INTEGER, stripe_status TEXT);
        CREATE TABLE IF NOT EXISTS errors(event_id TEXT, type TEXT, object_id TEXT, run_id TEXT, error_type TEXT, message TEXT);
        CREATE TABLE IF NOT EXISTS people(customer_id TEXT PRIMARY KEY, token TEXT UNIQUE, report TEXT NOT NULL);
    """)
    return db


def stripe_get(path):
    if not path.startswith("/v1/subscriptions/") or "?" in path or ".." in path:
        raise ValueError("Only subscription reads are supported")
    request = urllib.request.Request("https://api.stripe.com" + path, headers={
        "Authorization": "Bearer " + os.environ["STRIPE_READONLY_KEY"]
    })
    with urllib.request.urlopen(request, timeout=15) as response:
        value = json.load(response)
    if value.get("livemode") is not False:
        raise ValueError("A live or unverified subscription was rejected")
    return value


def handler_module():
    spec = importlib.util.spec_from_file_location("generated_billing", ROOT / "billing.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class AccessDatabase:
    """Narrow capability; never expose the complete controller-owned fixture DB."""
    def __init__(self, connection):
        self._connection = connection

    def execute(self, sql, parameters=()):
        if not isinstance(sql, str) or len(sql) > 6000 or not re.match(
            r"^\s*(?:INSERT(?:\s+OR\s+(?:REPLACE|IGNORE))?\s+INTO|UPDATE)\s+access\b", sql, re.I
        ) or re.search(r";|--|/\*|\b(?:DROP|ALTER|DELETE|CREATE|ATTACH|PRAGMA|SELECT|FROM|UNION|JOIN)\b", sql, re.I):
            raise ValueError("Only a parameterised access-table write is supported")
        self._connection.execute(sql, parameters)
        # No cursor or underlying connection capability escapes to generated code.
        return None


def access_authorizer(action, table, column, database, trigger):
    if action in (sqlite3.SQLITE_INSERT, sqlite3.SQLITE_UPDATE, sqlite3.SQLITE_READ):
        return sqlite3.SQLITE_OK if table == "access" else sqlite3.SQLITE_DENY
    if action in (sqlite3.SQLITE_TRANSACTION, sqlite3.SQLITE_SELECT):
        return sqlite3.SQLITE_OK
    return sqlite3.SQLITE_DENY


class App(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass  # Requests contain private fixture identities; no raw request logging.

    def send(self, code, value):
        payload = json.dumps(value).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def control(self):
        return hmac.compare_digest(self.headers.get("X-Control-Token", ""), settings()["controlToken"])

    def do_GET(self):
        route = urllib.parse.urlparse(self.path)
        if route.path == "/health":
            return self.send(200, {"ready": True, "testMode": True})
        if route.path == "/evidence":
            if not self.control():
                return self.send(401, {"error": "Authentication required"})
            with connect() as db:
                records = [dict(row) for row in db.execute("SELECT id,type,object_id,customer_id,received_at,stripe_status FROM events ORDER BY received_at,id")]
                errors = [dict(row) for row in db.execute("SELECT event_id,type,object_id,run_id,error_type,message FROM errors LIMIT 100")]
            return self.send(200, {"events": records, "errors": errors})
        if route.path != "/report":
            return self.send(404, {"error": "Not found"})
        token = self.headers.get("Authorization", "").removeprefix("Bearer ")
        with connect() as db:
            person = db.execute("SELECT * FROM people WHERE token=?", (token,)).fetchone()
            if not person:
                return self.send(401, {"error": "Authentication required"})
            requested = urllib.parse.parse_qs(route.query).get("customer", [person["customer_id"]])[0]
            if requested != person["customer_id"]:
                return self.send(403, {"error": "Report belongs to another customer"})
            access = db.execute("SELECT allowed FROM access WHERE customer_id=?", (person["customer_id"],)).fetchone()
            if not access or not access["allowed"]:
                return self.send(403, {"error": "Subscription does not grant report access"})
            return self.send(200, {"customerId": person["customer_id"], "report": person["report"]})

    def do_POST(self):
        length = int(self.headers.get("Content-Length", "0"))
        if length < 1 or length > 262144:
            return self.send(413, {"error": "Bounded JSON body required"})
        raw = self.rfile.read(length)
        if self.path in ("/_fixtures", "/_reset"):
            if not self.control():
                return self.send(401, {"error": "Authentication required"})
            try:
                data = json.loads(raw)
                with connect() as db:
                    if self.path == "/_reset":
                        db.executescript("DELETE FROM access; DELETE FROM events; DELETE FROM people; DELETE FROM errors;")
                    else:
                        for person in data["people"]:
                            db.execute("INSERT INTO people(customer_id,token,report) VALUES(?,?,?)", (person["customerId"], person["token"], person["report"]))
                return self.send(200, {"configured": True})
            except Exception:
                return self.send(400, {"error": "Invalid fixture configuration"})
        if self.path != "/webhook":
            return self.send(404, {"error": "Not found"})
        try:
            parts = {}
            for entry in self.headers.get("Stripe-Signature", "").split(","):
                key, value = entry.split("=", 1)
                parts.setdefault(key, []).append(value)
            timestamp = parts["t"][0]
            expected = hmac.new(settings()["webhookSecret"].encode(), timestamp.encode() + b"." + raw, hashlib.sha256).hexdigest()
            if abs(time.time() - int(timestamp)) > 300 or not any(hmac.compare_digest(expected, value) for value in parts["v1"]):
                raise ValueError("Invalid signature")
            event = json.loads(raw)
            if event.get("livemode") is not False:
                raise ValueError("Test event required")
        except Exception:
            return self.send(400, {"error": "Signed test event required"})
        try:
            with connect() as db:
                if db.execute("SELECT 1 FROM events WHERE id=?", (event["id"],)).fetchone():
                    return self.send(200, {"received": True, "duplicate": True})
                obj = event["data"]["object"]
                # Ignore unrelated account activity. This is a dedicated, run-marked fixture.
                if obj.get("metadata", {}).get("run_id") != settings()["fixtureRunId"]:
                    return self.send(200, {"received": True, "ignored": True})
                db.set_authorizer(access_authorizer)
                try:
                    handler_module().handle_event(event, AccessDatabase(db), stripe_get)
                finally:
                    db.set_authorizer(None)
                customer = obj.get("customer")
                if isinstance(customer, dict):
                    customer = customer["id"]
                db.execute("INSERT INTO events VALUES(?,?,?,?,?,?)", (event["id"], event["type"], obj.get("id"), customer, int(time.time()), obj.get("status")))
            return self.send(200, {"received": True})
        except Exception as exc:
            # Do not disclose source/config/keys in a public response.
            with connect() as db:
                db.execute("INSERT INTO errors VALUES(?,?,?,?,?,?)", (event.get("id"), event.get("type"), event.get("data", {}).get("object", {}).get("id"), settings()["fixtureRunId"], type(exc).__name__, str(exc)[:320]))
            return self.send(500, {"error": "Billing handler failed"})


if __name__ == "__main__":
    connect().close()
    HTTPServer(("0.0.0.0", 8000), App).serve_forever()
