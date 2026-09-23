"""LAN discovery and port-scanning engine for NetScan."""
from .model import Device, Interface, PortResult
from .interfaces import list_interfaces, primary_interface, primary_ipv4
from .discovery import discover, ping, arp_table, resolve_hostname
from .ports import scan_ports, scan_port, parse_port_spec
from .services import TOP_PORTS, service_name

__all__ = [
    "Device", "Interface", "PortResult",
    "list_interfaces", "primary_interface", "primary_ipv4",
    "discover", "ping", "arp_table", "resolve_hostname",
    "scan_ports", "scan_port", "parse_port_spec",
    "TOP_PORTS", "service_name",
]
