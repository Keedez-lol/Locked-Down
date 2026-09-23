"""NetScan — a minimalist, matte LAN scanner for Windows 11.

Portable, no external tooling required (no Npcap, no admin). Discovers the
local network, lists devices with their extractable data, and scans open /
closed TCP ports per device. Runs from source with ``python app.py`` and is
packaged into a single portable ``.exe`` by the bundled build workflow.
"""
from __future__ import annotations

import json
import os
import queue
import threading
import time
from datetime import datetime
from tkinter import filedialog, ttk

import customtkinter as ctk

from scanner import (
    Device, PortResult, list_interfaces, primary_interface,
    discover, scan_ports, parse_port_spec, TOP_PORTS,
)

APP_NAME = "NetScan"
APP_VERSION = "1.0.0"

# ── Matte palette (low saturation, flat, no gloss) ─────────────────────────
BG        = "#15171c"   # window
PANEL     = "#1b1e24"   # cards
PANEL_2   = "#22262e"   # nested / rows
BORDER    = "#2b2f38"
TEXT      = "#e6e8ec"
TEXT_DIM  = "#8b929e"
ACCENT    = "#4a9d8e"   # muted teal
ACCENT_HI = "#57b3a2"
OK        = "#5ca66b"   # open / up
WARN      = "#c9a24b"   # filtered
BAD       = "#b5635f"   # closed / down
SELECT    = "#2c3d48"

FONT      = "Segoe UI"
MONO      = "Consolas"


class NetScanApp(ctk.CTk):
    def __init__(self) -> None:
        super().__init__()
        ctk.set_appearance_mode("dark")

        self.title(f"{APP_NAME}  ·  LAN scanner")
        self.geometry("1120x680")
        self.minsize(940, 560)
        self.configure(fg_color=BG)

        self.devices: dict[str, Device] = {}
        self.interfaces = list_interfaces()
        self.active_iface = primary_interface(self.interfaces)
        self.ui_queue: "queue.Queue" = queue.Queue()

        self._discover_thread: threading.Thread | None = None
        self._discover_cancel = threading.Event()
        self._ports_thread: threading.Thread | None = None
        self._ports_cancel = threading.Event()
        self._selected_ip: str | None = None

        self._build_style()
        self._build_layout()
        self._refresh_network_panel()
        self.after(60, self._pump)
        self.protocol("WM_DELETE_WINDOW", self._on_close)

    # ── styling ────────────────────────────────────────────────────────────
    def _build_style(self) -> None:
        style = ttk.Style()
        try:
            style.theme_use("clam")
        except Exception:
            pass
        style.configure(
            "Net.Treeview",
            background=PANEL, fieldbackground=PANEL, foreground=TEXT,
            rowheight=28, borderwidth=0, font=(FONT, 10),
        )
        style.configure(
            "Net.Treeview.Heading",
            background=PANEL_2, foreground=TEXT_DIM, borderwidth=0,
            font=(FONT, 10, "bold"), padding=(8, 6),
        )
        style.map(
            "Net.Treeview",
            background=[("selected", SELECT)],
            foreground=[("selected", TEXT)],
        )
        style.map("Net.Treeview.Heading", background=[("active", PANEL_2)])
        style.layout("Net.Treeview", [
            ("Net.Treeview.treearea", {"sticky": "nswe"})
        ])

    def _card(self, master, **kw) -> ctk.CTkFrame:
        opts = dict(fg_color=PANEL, corner_radius=10, border_width=1,
                    border_color=BORDER)
        opts.update(kw)
        return ctk.CTkFrame(master, **opts)

    # ── layout ───────────────────────────────────────────────────────────--
    def _build_layout(self) -> None:
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(2, weight=1)

        self._build_header()
        self._build_network_bar()
        self._build_body()
        self._build_statusbar()

    def _build_header(self) -> None:
        bar = ctk.CTkFrame(self, fg_color=BG, height=56)
        bar.grid(row=0, column=0, sticky="ew", padx=16, pady=(14, 6))
        bar.grid_columnconfigure(1, weight=1)

        ctk.CTkLabel(
            bar, text=APP_NAME, font=(FONT, 22, "bold"), text_color=TEXT,
        ).grid(row=0, column=0, sticky="w")
        ctk.CTkLabel(
            bar, text=f"  v{APP_VERSION} · escáner LAN",
            font=(FONT, 12), text_color=TEXT_DIM,
        ).grid(row=0, column=1, sticky="w", padx=(6, 0))

        self.scan_btn = ctk.CTkButton(
            bar, text="Escanear red", width=140, height=36,
            corner_radius=8, fg_color=ACCENT, hover_color=ACCENT_HI,
            text_color="#0c1210", font=(FONT, 13, "bold"),
            command=self._toggle_discovery,
        )
        self.scan_btn.grid(row=0, column=2, padx=(0, 8))

        self.export_btn = ctk.CTkButton(
            bar, text="Exportar", width=100, height=36, corner_radius=8,
            fg_color=PANEL_2, hover_color=BORDER, text_color=TEXT,
            font=(FONT, 12), command=self._export,
        )
        self.export_btn.grid(row=0, column=3)

    def _build_network_bar(self) -> None:
        card = self._card(self)
        card.grid(row=1, column=0, sticky="ew", padx=16, pady=6)
        for c in range(6):
            card.grid_columnconfigure(c, weight=1)

        # interface selector
        left = ctk.CTkFrame(card, fg_color="transparent")
        left.grid(row=0, column=0, columnspan=6, sticky="ew", padx=14, pady=(10, 2))
        left.grid_columnconfigure(1, weight=1)
        ctk.CTkLabel(left, text="Interfaz", font=(FONT, 11), text_color=TEXT_DIM
                     ).grid(row=0, column=0, sticky="w", padx=(0, 8))
        names = [self._iface_label(i) for i in self.interfaces if i.cidr] or ["(sin interfaz)"]
        self.iface_var = ctk.StringVar(
            value=self._iface_label(self.active_iface) if self.active_iface else names[0]
        )
        self.iface_menu = ctk.CTkOptionMenu(
            left, values=names, variable=self.iface_var, width=380,
            fg_color=PANEL_2, button_color=PANEL_2, button_hover_color=BORDER,
            dropdown_fg_color=PANEL_2, text_color=TEXT, font=(FONT, 11),
            command=self._on_iface_change,
        )
        self.iface_menu.grid(row=0, column=1, sticky="w")

        # metric cells
        self.net_cells: dict[str, ctk.CTkLabel] = {}
        specs = [("IP local", "ip"), ("Subred", "cidr"), ("Gateway", "gw"),
                 ("MAC", "mac"), ("Enlace", "link"), ("Rango", "range")]
        row = ctk.CTkFrame(card, fg_color="transparent")
        row.grid(row=1, column=0, columnspan=6, sticky="ew", padx=14, pady=(4, 12))
        for i, (label, key) in enumerate(specs):
            row.grid_columnconfigure(i, weight=1)
            cell = ctk.CTkFrame(row, fg_color=PANEL_2, corner_radius=8)
            cell.grid(row=0, column=i, sticky="ew", padx=4)
            ctk.CTkLabel(cell, text=label.upper(), font=(FONT, 9, "bold"),
                         text_color=TEXT_DIM).pack(anchor="w", padx=10, pady=(8, 0))
            val = ctk.CTkLabel(cell, text="—", font=(MONO, 12), text_color=TEXT)
            val.pack(anchor="w", padx=10, pady=(0, 8))
            self.net_cells[key] = val

    def _build_body(self) -> None:
        body = ctk.CTkFrame(self, fg_color="transparent")
        body.grid(row=2, column=0, sticky="nsew", padx=16, pady=6)
        body.grid_columnconfigure(0, weight=3, uniform="b")
        body.grid_columnconfigure(1, weight=2, uniform="b")
        body.grid_rowconfigure(0, weight=1)

        self._build_device_table(body)
        self._build_detail_panel(body)

    def _build_device_table(self, master) -> None:
        card = self._card(master)
        card.grid(row=0, column=0, sticky="nsew", padx=(0, 8))
        card.grid_rowconfigure(1, weight=1)
        card.grid_columnconfigure(0, weight=1)

        head = ctk.CTkFrame(card, fg_color="transparent")
        head.grid(row=0, column=0, sticky="ew", padx=12, pady=(10, 4))
        head.grid_columnconfigure(0, weight=1)
        ctk.CTkLabel(head, text="Dispositivos", font=(FONT, 14, "bold"),
                     text_color=TEXT).grid(row=0, column=0, sticky="w")
        self.count_lbl = ctk.CTkLabel(head, text="0", font=(FONT, 12),
                                      text_color=TEXT_DIM)
        self.count_lbl.grid(row=0, column=1, sticky="e")

        wrap = ctk.CTkFrame(card, fg_color=PANEL, corner_radius=8)
        wrap.grid(row=1, column=0, sticky="nsew", padx=8, pady=(0, 10))
        wrap.grid_rowconfigure(0, weight=1)
        wrap.grid_columnconfigure(0, weight=1)

        cols = ("ip", "host", "mac", "vendor", "lat")
        self.tree = ttk.Treeview(
            wrap, columns=cols, show="headings", style="Net.Treeview",
            selectmode="browse",
        )
        headers = {"ip": ("IP", 120), "host": ("Hostname", 150),
                   "mac": ("MAC", 140), "vendor": ("Fabricante", 130),
                   "lat": ("ms", 55)}
        for c, (title, w) in headers.items():
            self.tree.heading(c, text=title,
                              command=lambda cc=c: self._sort_tree(cc))
            anchor = "e" if c == "lat" else "w"
            self.tree.column(c, width=w, anchor=anchor, stretch=(c in ("host", "vendor")))
        self.tree.tag_configure("gateway", foreground=ACCENT_HI)
        self.tree.tag_configure("local", foreground=OK)
        self.tree.grid(row=0, column=0, sticky="nsew")

        sb = ctk.CTkScrollbar(wrap, command=self.tree.yview,
                              button_color=BORDER, fg_color=PANEL)
        sb.grid(row=0, column=1, sticky="ns")
        self.tree.configure(yscrollcommand=sb.set)
        self.tree.bind("<<TreeviewSelect>>", self._on_select_device)

    def _build_detail_panel(self, master) -> None:
        card = self._card(master)
        card.grid(row=0, column=1, sticky="nsew", padx=(8, 0))
        card.grid_rowconfigure(3, weight=1)
        card.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(card, text="Detalle del dispositivo", font=(FONT, 14, "bold"),
                     text_color=TEXT).grid(row=0, column=0, sticky="w",
                                           padx=14, pady=(12, 2))
        self.detail_ip = ctk.CTkLabel(card, text="Selecciona un dispositivo",
                                      font=(MONO, 16), text_color=ACCENT_HI)
        self.detail_ip.grid(row=1, column=0, sticky="w", padx=14, pady=(0, 6))

        self.detail_meta = ctk.CTkFrame(card, fg_color=PANEL_2, corner_radius=8)
        self.detail_meta.grid(row=2, column=0, sticky="ew", padx=12, pady=6)
        self.detail_meta.grid_columnconfigure(1, weight=1)
        self.meta_rows: dict[str, ctk.CTkLabel] = {}
        for i, (label, key) in enumerate(
            [("Hostname", "host"), ("MAC", "mac"), ("Fabricante", "vendor"),
             ("Latencia", "lat"), ("Rol", "role")]
        ):
            ctk.CTkLabel(self.detail_meta, text=label, font=(FONT, 11),
                         text_color=TEXT_DIM).grid(row=i, column=0, sticky="w",
                                                   padx=12, pady=3)
            v = ctk.CTkLabel(self.detail_meta, text="—", font=(MONO, 11),
                             text_color=TEXT)
            v.grid(row=i, column=1, sticky="w", padx=8, pady=3)
            self.meta_rows[key] = v

        # ports section
        ports = ctk.CTkFrame(card, fg_color="transparent")
        ports.grid(row=3, column=0, sticky="nsew", padx=12, pady=(6, 10))
        ports.grid_rowconfigure(2, weight=1)
        ports.grid_columnconfigure(0, weight=1)

        ctrl = ctk.CTkFrame(ports, fg_color="transparent")
        ctrl.grid(row=0, column=0, sticky="ew", pady=(0, 6))
        ctrl.grid_columnconfigure(1, weight=1)
        ctk.CTkSegmentedButton(
            ctrl, values=["Top", "Personalizado"],
            command=self._on_port_mode,
            fg_color=PANEL_2, selected_color=ACCENT, selected_hover_color=ACCENT_HI,
            unselected_color=PANEL_2, unselected_hover_color=BORDER,
            text_color=TEXT, font=(FONT, 11),
            variable=ctk.StringVar(value="Top"),
        ).grid(row=0, column=0, sticky="w")
        self.port_spec = ctk.CTkEntry(
            ctrl, placeholder_text="22,80,443,8000-8100", font=(MONO, 11),
            fg_color=PANEL_2, border_color=BORDER, text_color=TEXT, height=30,
        )
        self.port_spec.grid(row=0, column=1, sticky="ew", padx=8)
        self.port_spec.configure(state="disabled")
        self.port_btn = ctk.CTkButton(
            ctrl, text="Puertos", width=90, height=30, corner_radius=8,
            fg_color=ACCENT, hover_color=ACCENT_HI, text_color="#0c1210",
            font=(FONT, 12, "bold"), command=self._toggle_port_scan, state="disabled",
        )
        self.port_btn.grid(row=0, column=2)

        self.port_status = ctk.CTkLabel(ports, text="", font=(FONT, 10),
                                        text_color=TEXT_DIM)
        self.port_status.grid(row=1, column=0, sticky="w", pady=(0, 4))

        pw = ctk.CTkFrame(ports, fg_color=PANEL, corner_radius=8)
        pw.grid(row=2, column=0, sticky="nsew")
        pw.grid_rowconfigure(0, weight=1)
        pw.grid_columnconfigure(0, weight=1)
        pcols = ("port", "state", "svc", "banner")
        self.ptree = ttk.Treeview(pw, columns=pcols, show="headings",
                                  style="Net.Treeview", selectmode="none")
        for c, (title, w) in {"port": ("Puerto", 70), "state": ("Estado", 80),
                              "svc": ("Servicio", 110), "banner": ("Banner", 160)}.items():
            self.ptree.heading(c, text=title)
            self.ptree.column(c, width=w, anchor="w",
                              stretch=(c == "banner"))
        self.ptree.tag_configure("open", foreground=OK)
        self.ptree.tag_configure("closed", foreground=BAD)
        self.ptree.tag_configure("filtered", foreground=WARN)
        self.ptree.grid(row=0, column=0, sticky="nsew")
        psb = ctk.CTkScrollbar(pw, command=self.ptree.yview,
                               button_color=BORDER, fg_color=PANEL)
        psb.grid(row=0, column=1, sticky="ns")
        self.ptree.configure(yscrollcommand=psb.set)

    def _build_statusbar(self) -> None:
        bar = ctk.CTkFrame(self, fg_color=PANEL, height=34, corner_radius=0)
        bar.grid(row=3, column=0, sticky="ew")
        bar.grid_columnconfigure(0, weight=1)
        self.status = ctk.CTkLabel(bar, text="Listo.", font=(FONT, 11),
                                   text_color=TEXT_DIM)
        self.status.grid(row=0, column=0, sticky="w", padx=14, pady=6)
        self.progress = ctk.CTkProgressBar(bar, width=220, height=8,
                                           progress_color=ACCENT, fg_color=PANEL_2)
        self.progress.grid(row=0, column=1, sticky="e", padx=14)
        self.progress.set(0)

    # ── helpers ──────────────────────────────────────────────────────────--
    @staticmethod
    def _iface_label(iface) -> str:
        if not iface:
            return "(sin interfaz)"
        tag = " ★" if iface.is_primary else ""
        return f"{iface.name} · {iface.cidr or iface.ipv4 or '?'}{tag}"

    def _iface_by_label(self, label: str):
        for i in self.interfaces:
            if self._iface_label(i) == label:
                return i
        return None

    def _refresh_network_panel(self) -> None:
        i = self.active_iface
        if not i:
            for cell in self.net_cells.values():
                cell.configure(text="—")
            return
        link = f"{'up' if i.is_up else 'down'} · {i.speed_mbps or '?'} Mbps"
        rng = "—"
        try:
            import ipaddress
            if i.cidr:
                net = ipaddress.ip_network(i.cidr, strict=False)
                rng = f"{net.num_addresses - 2} hosts"
        except Exception:
            pass
        vals = {"ip": i.ipv4 or "—", "cidr": i.cidr or "—", "gw": i.gateway or "—",
                "mac": i.mac or "—", "link": link, "range": rng}
        for k, v in vals.items():
            self.net_cells[k].configure(text=v)

    def _set_status(self, text: str) -> None:
        self.status.configure(text=text)

    # ── discovery ────────────────────────────────────────────────────────--
    def _on_iface_change(self, label: str) -> None:
        self.active_iface = self._iface_by_label(label)
        self._refresh_network_panel()

    def _toggle_discovery(self) -> None:
        if self._discover_thread and self._discover_thread.is_alive():
            self._discover_cancel.set()
            self._set_status("Cancelando…")
            return
        if not self.active_iface or not self.active_iface.cidr:
            self._set_status("No hay una interfaz con subred válida.")
            return
        self._start_discovery()

    def _start_discovery(self) -> None:
        self.devices.clear()
        self.tree.delete(*self.tree.get_children())
        self.count_lbl.configure(text="0")
        self.progress.set(0)
        self._discover_cancel = threading.Event()
        self.scan_btn.configure(text="Detener", fg_color=BAD, hover_color="#c9736f")

        iface = self.active_iface
        started = time.time()

        def run() -> None:
            def on_device(dev: Device) -> None:
                self.ui_queue.put(("device", dev))

            def on_progress(done: int, total: int) -> None:
                self.ui_queue.put(("progress", (done, total)))

            discover(
                iface.cidr, anchor_ip=iface.ipv4, gateway=iface.gateway,
                local_ip=iface.ipv4, cancel=self._discover_cancel,
                on_device=on_device, on_progress=on_progress,
            )
            self.ui_queue.put(("discovery_done", time.time() - started))

        self._discover_thread = threading.Thread(target=run, daemon=True)
        self._discover_thread.start()
        self._set_status(f"Escaneando {iface.cidr}…")

    def _apply_device(self, dev: Device) -> None:
        self.devices[dev.ip] = dev
        host = dev.hostname or ""
        lat = "" if dev.latency_ms is None else f"{dev.latency_ms:.0f}"
        values = (dev.ip, host, dev.mac or "", dev.vendor or "", lat)
        tags = ()
        if dev.is_gateway:
            tags = ("gateway",)
        elif dev.is_local:
            tags = ("local",)
        if self.tree.exists(dev.ip):
            self.tree.item(dev.ip, values=values, tags=tags)
        else:
            self.tree.insert("", "end", iid=dev.ip, values=values, tags=tags)
        self.count_lbl.configure(text=str(len(self.devices)))
        if self._selected_ip == dev.ip:
            self._render_detail(dev)

    # ── device detail ────────────────────────────────────────────────────--
    def _on_select_device(self, _evt=None) -> None:
        sel = self.tree.selection()
        if not sel:
            return
        self._selected_ip = sel[0]
        dev = self.devices.get(sel[0])
        if dev:
            self._render_detail(dev)
            self.port_btn.configure(state="normal")

    def _render_detail(self, dev: Device) -> None:
        self.detail_ip.configure(text=dev.ip)
        role = "Gateway" if dev.is_gateway else ("Este equipo" if dev.is_local else "Host")
        lat = "—" if dev.latency_ms is None else f"{dev.latency_ms:.0f} ms"
        self.meta_rows["host"].configure(text=dev.hostname or "—")
        self.meta_rows["mac"].configure(text=dev.mac or "—")
        self.meta_rows["vendor"].configure(text=dev.vendor or "—")
        self.meta_rows["lat"].configure(text=lat)
        self.meta_rows["role"].configure(text=role)
        # show any already-scanned ports for this device
        self.ptree.delete(*self.ptree.get_children())
        for pr in dev.ports:
            self._insert_port_row(pr)
        if dev.ports:
            n_open = sum(1 for p in dev.ports if p.state == "open")
            self.port_status.configure(text=f"{n_open} abiertos / {len(dev.ports)} escaneados")
        else:
            self.port_status.configure(text="")

    def _on_port_mode(self, value: str) -> None:
        if value == "Personalizado":
            self.port_spec.configure(state="normal")
        else:
            self.port_spec.configure(state="disabled")

    def _insert_port_row(self, pr: PortResult) -> None:
        self.ptree.insert("", "end", values=(pr.port, pr.state, pr.service, pr.banner),
                          tags=(pr.state,))

    # ── port scan ────────────────────────────────────────────────────────--
    def _toggle_port_scan(self) -> None:
        if self._ports_thread and self._ports_thread.is_alive():
            self._ports_cancel.set()
            return
        dev = self.devices.get(self._selected_ip or "")
        if not dev:
            return
        if self.port_spec.cget("state") == "normal" and self.port_spec.get().strip():
            ports = parse_port_spec(self.port_spec.get())
        else:
            ports = TOP_PORTS
        if not ports:
            self.port_status.configure(text="Especificación de puertos inválida.")
            return
        dev.ports = []
        self.ptree.delete(*self.ptree.get_children())
        self._ports_cancel = threading.Event()
        self.port_btn.configure(text="Detener", fg_color=BAD)
        target_ip = dev.ip
        total = len(ports)

        def run() -> None:
            def on_result(pr: PortResult) -> None:
                self.ui_queue.put(("port", (target_ip, pr)))

            def on_progress(done: int, _total: int) -> None:
                self.ui_queue.put(("port_progress", (done, total)))

            scan_ports(target_ip, ports, include_closed=True,
                       cancel=self._ports_cancel, on_result=on_result,
                       on_progress=on_progress)
            self.ui_queue.put(("port_done", target_ip))

        self._ports_thread = threading.Thread(target=run, daemon=True)
        self._ports_thread.start()
        self.port_status.configure(text=f"Escaneando {total} puertos en {target_ip}…")

    # ── UI event pump ────────────────────────────────────────────────────--
    def _pump(self) -> None:
        try:
            while True:
                kind, payload = self.ui_queue.get_nowait()
                if kind == "device":
                    self._apply_device(payload)
                elif kind == "progress":
                    done, total = payload
                    self.progress.set(done / total if total else 0)
                    self._set_status(f"Sondeando hosts… {done}/{total}")
                elif kind == "discovery_done":
                    self._on_discovery_done(payload)
                elif kind == "port":
                    ip, pr = payload
                    dev = self.devices.get(ip)
                    if dev is not None:
                        dev.ports.append(pr)
                    if ip == self._selected_ip and pr.state == "open":
                        self._insert_port_row(pr)
                elif kind == "port_progress":
                    done, total = payload
                    self.progress.set(done / total if total else 0)
                elif kind == "port_done":
                    self._on_port_done(payload)
        except queue.Empty:
            pass
        self.after(60, self._pump)

    def _on_discovery_done(self, elapsed: float) -> None:
        self.scan_btn.configure(text="Escanear red", fg_color=ACCENT,
                                hover_color=ACCENT_HI)
        self.progress.set(1)
        n = len(self.devices)
        if self._discover_cancel.is_set():
            self._set_status(f"Escaneo cancelado · {n} dispositivos.")
        else:
            self._set_status(f"{n} dispositivos en {elapsed:.1f}s. "
                             "Selecciona uno para escanear sus puertos.")

    def _on_port_done(self, ip: str) -> None:
        self.port_btn.configure(text="Puertos", fg_color=ACCENT)
        self.progress.set(1)
        dev = self.devices.get(ip)
        if not dev:
            return
        # re-render open ports for the selected device
        if ip == self._selected_ip:
            self.ptree.delete(*self.ptree.get_children())
            for pr in sorted(dev.ports, key=lambda p: p.port):
                if pr.state == "open":
                    self._insert_port_row(pr)
        n_open = sum(1 for p in dev.ports if p.state == "open")
        n_closed = sum(1 for p in dev.ports if p.state == "closed")
        n_filt = sum(1 for p in dev.ports if p.state == "filtered")
        state = "cancelado" if self._ports_cancel.is_set() else "completado"
        self.port_status.configure(
            text=f"{n_open} abiertos · {n_closed} cerrados · {n_filt} filtrados ({state})"
        )

    # ── sorting / export ─────────────────────────────────────────────────--
    def _sort_tree(self, col: str) -> None:
        items = [(self.tree.set(i, col), i) for i in self.tree.get_children()]
        if col == "ip":
            def key(v):
                try:
                    return tuple(int(o) for o in v[0].split("."))
                except ValueError:
                    return (0,)
            items.sort(key=key)
        elif col == "lat":
            items.sort(key=lambda v: float(v[0]) if v[0] else 1e9)
        else:
            items.sort(key=lambda v: v[0].lower())
        for idx, (_, iid) in enumerate(items):
            self.tree.move(iid, "", idx)

    def _export(self) -> None:
        if not self.devices:
            self._set_status("Nada que exportar todavía.")
            return
        path = filedialog.asksaveasfilename(
            defaultextension=".json",
            filetypes=[("JSON", "*.json"), ("CSV", "*.csv")],
            initialfile=f"netscan_{datetime.now():%Y%m%d_%H%M}",
        )
        if not path:
            return
        devices = sorted(self.devices.values(), key=lambda d: d.sort_key)
        try:
            if path.lower().endswith(".csv"):
                self._export_csv(path, devices)
            else:
                self._export_json(path, devices)
            self._set_status(f"Exportado a {os.path.basename(path)}")
        except OSError as exc:
            self._set_status(f"Error al exportar: {exc}")

    def _export_json(self, path: str, devices: list[Device]) -> None:
        data = {
            "app": APP_NAME, "version": APP_VERSION,
            "generated": datetime.now().isoformat(timespec="seconds"),
            "interface": self.active_iface.__dict__ if self.active_iface else None,
            "devices": [d.as_dict() for d in devices],
        }
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(data, fh, indent=2, ensure_ascii=False)

    def _export_csv(self, path: str, devices: list[Device]) -> None:
        import csv
        with open(path, "w", newline="", encoding="utf-8") as fh:
            w = csv.writer(fh)
            w.writerow(["ip", "hostname", "mac", "vendor", "latency_ms",
                        "role", "open_ports"])
            for d in devices:
                role = "gateway" if d.is_gateway else ("local" if d.is_local else "host")
                open_ports = " ".join(
                    f"{p.port}/{p.service or '?'}" for p in d.ports if p.state == "open"
                )
                w.writerow([d.ip, d.hostname, d.mac or "", d.vendor,
                            "" if d.latency_ms is None else f"{d.latency_ms:.0f}",
                            role, open_ports])

    def _on_close(self) -> None:
        self._discover_cancel.set()
        self._ports_cancel.set()
        self.destroy()


def main() -> None:
    app = NetScanApp()
    app.mainloop()


if __name__ == "__main__":
    main()
