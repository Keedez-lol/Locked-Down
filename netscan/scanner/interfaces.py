"""Discovery of the local machine's network interfaces and primary LAN.

Works on Windows 11 (the target) and degrades gracefully on Linux so the
logic can be smoke-tested from source.
"""
from __future__ import annotations

import ipaddress
import socket
import subprocess
import sys

import psutil

from .model import Interface

_IS_WIN = sys.platform.startswith("win")
_NO_WINDOW = 0x08000000 if _IS_WIN else 0  # CREATE_NO_WINDOW: hide console pop-ups


def _run(cmd: list[str]) -> str:
    try:
        out = subprocess.run(
            cmd, capture_output=True, text=True, timeout=6,
            creationflags=_NO_WINDOW,
        )
        return out.stdout or ""
    except (OSError, subprocess.SubprocessError):
        return ""


def primary_ipv4() -> str | None:
    """The source IPv4 the OS would use for outbound traffic (no packets sent)."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except OSError:
        return None
    finally:
        s.close()


def _gateways_by_iface() -> dict[str, str]:
    """Map interface-ish key -> default gateway IPv4."""
    result: dict[str, str] = {}
    if _IS_WIN:
        # `ipconfig` groups gateway under each adapter; we track the last IPv4
        # seen and attach the gateway to that address as a fallback key.
        text = _run(["ipconfig"])
        last_ip = None
        for raw in text.splitlines():
            line = raw.strip()
            if line.lower().startswith("ipv4 address"):
                last_ip = line.split(":")[-1].strip().rstrip("(Preferred)").strip()
            elif line.lower().startswith("default gateway"):
                gw = line.split(":")[-1].strip()
                if gw and last_ip and _is_ipv4(gw):
                    result[last_ip] = gw
    else:
        # Linux: /proc/net/route, gateway in little-endian hex.
        try:
            with open("/proc/net/route") as fh:
                next(fh)
                for line in fh:
                    parts = line.split()
                    if len(parts) > 2 and parts[1] == "00000000":
                        gw = ".".join(
                            str(int(parts[2][i:i + 2], 16))
                            for i in (6, 4, 2, 0)
                        )
                        result[parts[0]] = gw
        except OSError:
            pass
    return result


def _is_ipv4(value: str) -> bool:
    try:
        ipaddress.IPv4Address(value)
        return True
    except ValueError:
        return False


def _fmt_mac(raw: str) -> str | None:
    mac = raw.replace("-", ":").upper().strip()
    parts = mac.split(":")
    if len(parts) == 6 and all(len(p) == 2 for p in parts):
        return mac
    return None


def list_interfaces() -> list[Interface]:
    prim = primary_ipv4()
    gws = _gateways_by_iface()
    addrs = psutil.net_if_addrs()
    stats = psutil.net_if_stats()

    interfaces: list[Interface] = []
    for name, snics in addrs.items():
        iface = Interface(name=name)
        st = stats.get(name)
        if st:
            iface.is_up = st.isup
            iface.speed_mbps = st.speed
        for snic in snics:
            fam = snic.family
            if fam == socket.AF_INET:
                iface.ipv4 = snic.address
                iface.netmask = snic.netmask
            elif getattr(socket, "AF_PACKET", None) and fam == socket.AF_PACKET:
                iface.mac = _fmt_mac(snic.address) or iface.mac
            elif hasattr(psutil, "AF_LINK") and fam == psutil.AF_LINK:
                iface.mac = _fmt_mac(snic.address) or iface.mac

        if iface.ipv4 and iface.netmask:
            try:
                net = ipaddress.IPv4Interface(f"{iface.ipv4}/{iface.netmask}")
                iface.cidr = str(net.with_prefixlen)
            except ValueError:
                pass

        # Gateway: match by iface name (Linux) or by IPv4 (Windows ipconfig).
        iface.gateway = gws.get(name) or (gws.get(iface.ipv4) if iface.ipv4 else None)
        iface.is_primary = bool(prim and iface.ipv4 == prim)
        interfaces.append(iface)

    # Usable interfaces first (up, has IPv4, not loopback), primary at the top.
    def rank(i: Interface) -> tuple:
        loop = i.ipv4 is not None and i.ipv4.startswith("127.")
        return (not i.is_primary, not (i.is_up and i.ipv4 and not loop))

    interfaces.sort(key=rank)
    return interfaces


def primary_interface(interfaces: list[Interface] | None = None) -> Interface | None:
    interfaces = interfaces or list_interfaces()
    for i in interfaces:
        if i.is_primary and i.cidr:
            return i
    for i in interfaces:
        if i.is_up and i.cidr and i.ipv4 and not i.ipv4.startswith("127."):
            return i
    return None
