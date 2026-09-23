"""Common TCP port -> service-name map and default scan sets."""
from __future__ import annotations

COMMON_SERVICES: dict[int, str] = {
    20: "ftp-data", 21: "ftp", 22: "ssh", 23: "telnet", 25: "smtp",
    53: "dns", 67: "dhcp", 68: "dhcp", 69: "tftp", 80: "http",
    110: "pop3", 111: "rpcbind", 123: "ntp", 135: "msrpc",
    137: "netbios-ns", 138: "netbios-dgm", 139: "netbios-ssn",
    143: "imap", 161: "snmp", 162: "snmp-trap", 179: "bgp",
    389: "ldap", 443: "https", 445: "smb", 465: "smtps",
    500: "isakmp", 514: "syslog", 515: "printer", 520: "rip",
    548: "afp", 554: "rtsp", 587: "smtp-sub", 631: "ipp",
    636: "ldaps", 873: "rsync", 902: "vmware", 989: "ftps-data",
    990: "ftps", 993: "imaps", 995: "pop3s", 1080: "socks",
    1194: "openvpn", 1433: "mssql", 1521: "oracle", 1723: "pptp",
    1883: "mqtt", 1900: "ssdp/upnp", 2049: "nfs", 2082: "cpanel",
    2083: "cpanel-ssl", 2222: "ssh-alt", 2375: "docker",
    2376: "docker-tls", 3000: "dev-http", 3128: "http-proxy",
    3306: "mysql", 3389: "rdp", 3478: "stun", 4444: "metasploit",
    5000: "upnp/dev", 5060: "sip", 5222: "xmpp", 5353: "mdns",
    5432: "postgresql", 5555: "adb/hp", 5601: "kibana", 5672: "amqp",
    5900: "vnc", 5985: "winrm", 5986: "winrm-ssl", 6379: "redis",
    6443: "kubernetes", 6667: "irc", 7070: "realserver", 7547: "tr-069",
    8000: "http-alt", 8008: "http-alt", 8009: "ajp", 8080: "http-proxy",
    8081: "http-alt", 8123: "home-assistant", 8443: "https-alt",
    8883: "mqtt-tls", 8888: "http-alt", 9000: "http-alt",
    9090: "prometheus", 9100: "jetdirect", 9200: "elasticsearch",
    9999: "http-alt", 10000: "webmin", 11211: "memcached",
    27017: "mongodb", 32400: "plex", 49152: "upnp", 51820: "wireguard",
}

# Curated "top" ports covering routers, PCs, IoT, NAS, printers, media.
TOP_PORTS: list[int] = sorted({
    20, 21, 22, 23, 25, 53, 67, 80, 110, 111, 135, 137, 139, 143, 161,
    389, 443, 445, 515, 548, 554, 587, 631, 636, 873, 902, 993, 995,
    1080, 1433, 1521, 1723, 1883, 1900, 2049, 2222, 2375, 3000, 3128,
    3306, 3389, 5000, 5060, 5353, 5432, 5555, 5900, 5985, 6379, 6443,
    7547, 8000, 8008, 8080, 8081, 8123, 8443, 8883, 8888, 9000, 9090,
    9100, 9200, 10000, 11211, 27017, 32400, 49152,
})


def service_name(port: int) -> str:
    return COMMON_SERVICES.get(port, "")
