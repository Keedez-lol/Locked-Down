"""TCP connect port scanner.

Uses ordinary non-blocking sockets, so no elevated privileges are required.
A refused connection is reported as ``closed``; a timeout as ``filtered``;
a completed handshake as ``open`` (with a best-effort banner grab)."""
from __future__ import annotations

import concurrent.futures as cf
import socket
import threading
from typing import Callable, Iterable, Optional

from .model import PortResult
from .services import service_name


def scan_port(ip: str, port: int, timeout: float = 0.6, grab_banner: bool = True) -> PortResult:
    res = PortResult(port=port, state="filtered", service=service_name(port))
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(timeout)
    try:
        rc = sock.connect_ex((ip, port))
        if rc == 0:
            res.state = "open"
            if grab_banner:
                res.banner = _banner(sock)
        elif rc in (111, 10061):        # ECONNREFUSED (Linux / Windows)
            res.state = "closed"
        else:
            res.state = "filtered"
    except (socket.timeout, TimeoutError):
        res.state = "filtered"
    except OSError:
        res.state = "closed"
    finally:
        sock.close()
    return res


def _banner(sock: socket.socket) -> str:
    try:
        sock.settimeout(0.5)
        data = sock.recv(96)
        text = data.decode("latin-1", "ignore").strip()
        return " ".join(text.split())[:80]
    except OSError:
        return ""


def scan_ports(
    ip: str,
    ports: Iterable[int],
    *,
    timeout: float = 0.6,
    workers: int = 200,
    include_closed: bool = False,
    cancel: threading.Event | None = None,
    on_result: Callable[[PortResult], None] | None = None,
    on_progress: Callable[[int, int], None] | None = None,
) -> list[PortResult]:
    cancel = cancel or threading.Event()
    ports = list(dict.fromkeys(int(p) for p in ports))
    total = len(ports)
    done = 0
    results: list[PortResult] = []
    lock = threading.Lock()

    def job(port: int) -> Optional[PortResult]:
        if cancel.is_set():
            return None
        return scan_port(ip, port, timeout=timeout)

    with cf.ThreadPoolExecutor(max_workers=min(workers, max(total, 1))) as pool:
        futures = [pool.submit(job, p) for p in ports]
        for fut in cf.as_completed(futures):
            done += 1
            if on_progress:
                on_progress(done, total)
            res = fut.result()
            if res is None:
                continue
            if res.state == "open" or include_closed:
                with lock:
                    results.append(res)
                if on_result:
                    on_result(res)

    results.sort(key=lambda r: r.port)
    return results


def parse_port_spec(spec: str) -> list[int]:
    """Parse ``"22,80,443,8000-8100"`` into a sorted, de-duplicated port list."""
    ports: set[int] = set()
    for chunk in spec.replace(" ", "").split(","):
        if not chunk:
            continue
        if "-" in chunk:
            lo, _, hi = chunk.partition("-")
            try:
                a, b = int(lo), int(hi)
            except ValueError:
                continue
            if a > b:
                a, b = b, a
            ports.update(range(max(1, a), min(65535, b) + 1))
        else:
            try:
                p = int(chunk)
            except ValueError:
                continue
            if 1 <= p <= 65535:
                ports.add(p)
    return sorted(ports)
