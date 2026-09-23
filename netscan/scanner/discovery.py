"""LAN host discovery: ping sweep, ARP resolution and name lookup.

Portable by design — uses the OS ``ping``/``arp`` tools and standard sockets,
so it needs no Npcap, no raw sockets and no administrator rights.
"""
from __future__ import annotations

import concurrent.futures as cf
import ipaddress
import re
import socket
import subprocess
import sys
import threading
from typing import Callable, Optional

from .model import Device
from .oui import vendor_for

_IS_WIN = sys.platform.startswith("win")
_NO_WINDOW = 0x08000000 if _IS_WIN else 0

_ARP_RE = re.compile(
    r"(\d{1,3}(?:\.\d{1,3}){3})\s+([0-9a-fA-F]{2}(?:[-:][0-9a-fA-F]{2}){5})"
)
_WIN_TIME_RE = re.compile(r"[Tt]ime[=<]\s*(\d+)\s*ms")
_NIX_TIME_RE = re.compile(r"time[=<]\s*([\d.]+)\s*ms")
_NBT_RE = re.compile(r"^\s*([^\s]+)\s+<00>\s+UNIQUE", re.MULTILINE)


def _run(cmd: list[str], timeout: float) -> str:
    try:
        out = subprocess.run(
            cmd, capture_output=True, text=True, timeout=timeout,
            creationflags=_NO_WINDOW,
        )
        return (out.stdout or "") + (out.stderr or "")
    except (OSError, subprocess.SubprocessError):
        return ""


def ping(ip: str, timeout_ms: int = 600) -> Optional[float]:
    """Return round-trip latency in ms, or None if the host did not answer."""
    if _IS_WIN:
        cmd = ["ping", "-n", "1", "-w", str(timeout_ms), ip]
        rx = _WIN_TIME_RE
    else:
        secs = max(1, round(timeout_ms / 1000))
        cmd = ["ping", "-c", "1", "-W", str(secs), ip]
        rx = _NIX_TIME_RE
    text = _run(cmd, timeout=timeout_ms / 1000 + 2)
    low = text.lower()
    if not text or "unreachable" in low or "100% loss" in low or "100% packet loss" in low:
        # Windows prints "Reply from ... : time=" only on success; guard anyway.
        if "ttl=" not in low and "time" not in low:
            return None
    m = rx.search(text)
    if m:
        return float(m.group(1))
    # Some hosts reply without a parsable time but with TTL -> treat as alive.
    return 0.0 if "ttl=" in low else None


def arp_table() -> dict[str, str]:
    """IP -> normalized MAC from the OS ARP cache."""
    text = _run(["arp", "-a"], timeout=6)
    table: dict[str, str] = {}
    for ip, mac in _ARP_RE.findall(text):
        norm = mac.replace("-", ":").upper()
        if norm not in ("FF:FF:FF:FF:FF:FF", "00:00:00:00:00:00"):
            table[ip] = norm
    return table


def reverse_dns(ip: str) -> str:
    try:
        return socket.gethostbyaddr(ip)[0]
    except (socket.herror, socket.gaierror, OSError):
        return ""


def netbios_name(ip: str) -> str:
    if not _IS_WIN:
        return ""
    text = _run(["nbtstat", "-A", ip], timeout=4)
    m = _NBT_RE.search(text)
    return m.group(1).strip() if m else ""


def resolve_hostname(ip: str) -> str:
    return reverse_dns(ip) or netbios_name(ip)


def hosts_for_cidr(cidr: str, anchor_ip: str | None, max_hosts: int = 512) -> list[str]:
    """Host IPs to scan. For networks larger than ``max_hosts`` the range is
    trimmed to the /24 around ``anchor_ip`` so a /16 does not scan 65k hosts."""
    net = ipaddress.ip_network(cidr, strict=False)
    if net.num_addresses - 2 > max_hosts and anchor_ip:
        try:
            net = ipaddress.ip_network(f"{anchor_ip}/24", strict=False)
        except ValueError:
            pass
    return [str(h) for h in net.hosts()]


def discover(
    cidr: str,
    *,
    anchor_ip: str | None = None,
    gateway: str | None = None,
    local_ip: str | None = None,
    timeout_ms: int = 600,
    workers: int = 128,
    resolve_names: bool = True,
    cancel: threading.Event | None = None,
    on_device: Callable[[Device], None] | None = None,
    on_progress: Callable[[int, int], None] | None = None,
) -> list[Device]:
    cancel = cancel or threading.Event()
    targets = hosts_for_cidr(cidr, anchor_ip)
    total = len(targets)
    done = 0
    devices: list[Device] = []
    lock = threading.Lock()

    def probe(ip: str) -> Optional[Device]:
        if cancel.is_set():
            return None
        latency = ping(ip, timeout_ms)
        if latency is None:
            return None
        return Device(ip=ip, alive=True, latency_ms=latency)

    with cf.ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(probe, ip): ip for ip in targets}
        for fut in cf.as_completed(futures):
            done += 1
            if on_progress:
                on_progress(done, total)
            dev = fut.result()
            if dev is None:
                continue
            with lock:
                devices.append(dev)
            if on_device:
                on_device(dev)

    if cancel.is_set():
        return sorted(devices, key=lambda d: d.sort_key)

    # Enrich: ARP (MAC + vendor), flags, then names.
    arp = arp_table()
    for dev in devices:
        dev.mac = arp.get(dev.ip)
        dev.vendor = vendor_for(dev.mac)
        dev.is_gateway = dev.ip == gateway
        dev.is_local = dev.ip == local_ip
        if on_device:
            on_device(dev)

    if resolve_names and not cancel.is_set():
        def name_job(dev: Device) -> None:
            if cancel.is_set():
                return
            dev.hostname = resolve_hostname(dev.ip)
            if on_device:
                on_device(dev)

        with cf.ThreadPoolExecutor(max_workers=min(workers, 48)) as pool:
            list(pool.map(name_job, devices))

    return sorted(devices, key=lambda d: d.sort_key)
