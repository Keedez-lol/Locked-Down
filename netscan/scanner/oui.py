"""Offline MAC-address vendor lookup.

The full IEEE OUI database is bundled at build time into ``data/oui.csv``
(format: ``AABBCC,Vendor Name`` per line). A small curated seed list is kept
here so vendor resolution still works when the full database is absent, which
keeps the app functional even from source without the build step.
"""
from __future__ import annotations

import os
import sys
import threading

_SEED = {
    "F81A67": "TP-Link", "50C7BF": "TP-Link", "AC84C6": "TP-Link",
    "001A2B": "Cisco", "00000C": "Cisco", "F09FC2": "Ubiquiti",
    "245A4C": "Ubiquiti", "B4FBE4": "Ubiquiti", "DCA632": "Raspberry Pi",
    "B827EB": "Raspberry Pi", "E45F01": "Raspberry Pi", "2CCF67": "Raspberry Pi",
    "F0272D": "ASUSTek", "AC220B": "ASUSTek", "001E8C": "ASUSTek",
    "3C5A37": "Samsung", "8C7712": "Samsung", "F8042E": "Samsung",
    "A4C138": "Google", "F4F5D8": "Google", "DA A1 19": "Google",
    "ACDE48": "Apple", "F0189E": "Apple", "3C0754": "Apple",
    "A85C2C": "Apple", "DC2B2A": "Apple", "68967B": "Apple",
    "001132": "Synology", "0011D8": "ASUSTek", "D8EB97": "TRENDnet",
    "005056": "VMware", "000C29": "VMware", "080027": "VirtualBox",
    "525400": "QEMU/KVM", "00155D": "Microsoft (Hyper-V)",
    "18E829": "Ubiquiti", "744401": "Netgear", "A040A0": "Netgear",
    "20E52A": "Netgear", "C03F0E": "Netgear", "9C3DCF": "Netgear",
    "EC086B": "TP-Link", "60A4B7": "Amazon", "68DBF5": "Amazon",
    "FCA183": "Amazon", "44650D": "Amazon", "34D270": "Intel",
    "94E979": "Xiaomi", "640980": "Xiaomi", "286C07": "Xiaomi",
    "D461DA": "Espressif (ESP)", "246F28": "Espressif (ESP)",
    "8CAAB5": "Espressif (ESP)", "A020A6": "Espressif (ESP)",
}


def _bundle_root() -> str:
    # PyInstaller unpacks bundled data to sys._MEIPASS at runtime.
    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        return sys._MEIPASS
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class OUILookup:
    def __init__(self) -> None:
        self._db: dict[str, str] = dict(_SEED)
        self._loaded = False
        self._lock = threading.Lock()

    def _load(self) -> None:
        with self._lock:
            if self._loaded:
                return
            path = os.path.join(_bundle_root(), "data", "oui.csv")
            try:
                with open(path, "r", encoding="utf-8", errors="ignore") as fh:
                    for line in fh:
                        prefix, _, vendor = line.partition(",")
                        prefix = prefix.strip().upper().replace(":", "").replace("-", "")
                        vendor = vendor.strip()
                        if len(prefix) == 6 and vendor:
                            self._db.setdefault(prefix, vendor)
            except OSError:
                pass
            self._loaded = True

    @staticmethod
    def _normalize(mac: str) -> str:
        return "".join(c for c in mac.upper() if c in "0123456789ABCDEF")[:6]

    def lookup(self, mac: str | None) -> str:
        if not mac:
            return ""
        if not self._loaded:
            self._load()
        return self._db.get(self._normalize(mac), "")


_default = OUILookup()


def vendor_for(mac: str | None) -> str:
    return _default.lookup(mac)
