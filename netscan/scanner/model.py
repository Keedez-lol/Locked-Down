"""Data structures shared across the scanner package."""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Optional


@dataclass
class Interface:
    name: str
    ipv4: Optional[str] = None
    netmask: Optional[str] = None
    cidr: Optional[str] = None          # e.g. "192.168.1.34/24"
    mac: Optional[str] = None
    is_up: bool = False
    speed_mbps: int = 0
    gateway: Optional[str] = None
    is_primary: bool = False


@dataclass
class PortResult:
    port: int
    state: str                          # "open" | "closed" | "filtered"
    service: str = ""
    banner: str = ""


@dataclass
class Device:
    ip: str
    mac: Optional[str] = None
    vendor: str = ""
    hostname: str = ""
    alive: bool = True
    latency_ms: Optional[float] = None
    is_gateway: bool = False
    is_local: bool = False
    ports: list[PortResult] = field(default_factory=list)

    def as_dict(self) -> dict:
        return asdict(self)

    @property
    def sort_key(self):
        try:
            return tuple(int(o) for o in self.ip.split("."))
        except ValueError:
            return (0, 0, 0, 0)
