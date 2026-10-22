"""Outbound-network compatibility helpers for HF Spaces.

WHY THIS EXISTS
HF Spaces containers can expose an IPv6 default route that blackholes
traffic. When a hostname (e.g. ``api.cloudflare.com``) resolves to IPv6 first,
TCP/TLS connects hang until timeout — which showed up as::

    <urlopen error _ssl.c:975: The handshake operation timed out>
    curl: (28) SSL connection timeout

even though the same host is reachable over IPv4. Forcing IPv4 for outbound
DNS resolution makes those calls complete normally.

Set ``AI_FORCE_IPV4=false`` to disable (e.g. on an IPv6-only network).
"""

import os
import socket

_ORIGINAL_GETADDRINFO = socket.getaddrinfo
_APPLIED = False


def force_ipv4() -> None:
    global _APPLIED
    if _APPLIED:
        return

    if os.getenv("AI_FORCE_IPV4", "true").lower() in ("0", "false", "no", "off"):
        print("AI_FORCE_IPV4=false -> keeping system DNS resolution behaviour")
        return

    def _ipv4_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
        if family == 0:  # socket.AF_UNSPEC
            family = socket.AF_INET
        return _ORIGINAL_GETADDRINFO(host, port, family, type, proto, flags)

    socket.getaddrinfo = _ipv4_getaddrinfo
    _APPLIED = True
    print("IPv4-only DNS resolution enabled for outbound AI calls")


def probe_tcp(host: str, port: int = 443, timeout: float = 2.5):
    """Return (reachable, elapsed_ms, error) for a quick TCP connectivity check.

    Used at startup so the Space logs show immediately whether Cloudflare/HF
    egress works, instead of only failing later inside a chat request.
    """
    import time

    started = time.monotonic()
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True, int((time.monotonic() - started) * 1000), ""
    except Exception as e:
        return False, int((time.monotonic() - started) * 1000), f"{type(e).__name__}: {e}"


def probe_tls(host: str, port: int = 443, timeout: float = 4.0):
    """Like probe_tcp, but also completes a TLS handshake.

    This distinguishes "TCP connects but TLS is blackholed" (the exact HF
    Spaces -> Cloudflare failure: TCP succeeds, handshake times out) from a
    genuinely reachable HTTPS endpoint.
    """
    import ssl
    import time

    started = time.monotonic()
    try:
        ctx = ssl.create_default_context()
        with socket.create_connection((host, port), timeout=timeout) as raw:
            with ctx.wrap_socket(raw, server_hostname=host):
                return True, int((time.monotonic() - started) * 1000), ""
    except Exception as e:
        return False, int((time.monotonic() - started) * 1000), f"{type(e).__name__}: {e}"

