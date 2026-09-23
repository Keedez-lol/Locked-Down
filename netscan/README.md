# NetScan

Escáner de red LAN portable para **Windows 11**, con interfaz mate minimalista.
Descubre la red local, lista los dispositivos con sus datos extraíbles y escanea
los puertos TCP **abiertos / cerrados / filtrados** de cada uno.

Sin instalación, sin Npcap, sin drivers y **sin permisos de administrador**: usa
las herramientas del propio sistema (`ping`, `arp`, `nbtstat`) y sockets TCP
estándar.

## Qué muestra

**De tu red**
- Interfaz activa, IP local, subred (CIDR), gateway, MAC y estado del enlace.

**De cada dispositivo**
- IP, dirección MAC y **fabricante** (base OUI de IEEE, offline).
- Hostname (DNS inverso + NetBIOS).
- Latencia y rol (gateway / este equipo / host).
- **Puertos**: abiertos, cerrados y filtrados, con nombre de servicio y banner.

Resultados exportables a **JSON** o **CSV**.

## Cómo obtener el .exe

### Opción A — descargar el build automático (recomendado)
Cada push a este repo dispara el workflow **Build NetScan** (GitHub Actions,
runner Windows). Al terminar:

1. Abre la pestaña **Actions** del repositorio.
2. Entra en la ejecución más reciente de *Build NetScan*.
3. Descarga el artefacto **`NetScan-portable-windows`** → contiene `NetScan.exe`.

Etiquetar un commit como `v1.0.0` además publica el `.exe` en una *Release*.

### Opción B — compilar en tu Windows
```powershell
cd netscan
.\build.ps1
```
El ejecutable queda en `netscan\dist\NetScan.exe`.

## Ejecutar desde el código (sin compilar)
```bash
cd netscan
pip install -r requirements.txt
python app.py
```

## Uso

1. Abre `NetScan.exe`.
2. Confirma la interfaz en el desplegable (se autoselecciona la principal).
3. Pulsa **Escanear red** — los dispositivos aparecen en tiempo real.
4. Selecciona un dispositivo y pulsa **Puertos** (juego *Top* o rango
   personalizado, p. ej. `22,80,443,8000-8100`).
5. **Exportar** guarda todo en JSON o CSV.

## Notas técnicas

- **Descubrimiento**: barrido de *ping* concurrente + lectura de la tabla ARP
  (el ping puebla la caché ARP, de ahí las MAC). Redes mayores que `/24` se
  acotan al `/24` de tu equipo para no barrer decenas de miles de hosts.
- **Puertos**: escaneo *TCP connect* (no requiere privilegios). `open` =
  conexión establecida, `closed` = *connection refused*, `filtered` = *timeout*.
- **Alcance**: pensado para inventariar **tu propia red**. Escanea únicamente
  redes en las que tengas autorización.

## Estructura

```
netscan/
  app.py              GUI (customtkinter, tema mate)
  scanner/
    interfaces.py     info de red local
    discovery.py      ping sweep + ARP + hostnames
    ports.py          escaneo TCP connect
    oui.py            fabricante por MAC (offline)
    services.py       mapa puerto -> servicio
  tools/fetch_oui.py  descarga la base OUI (build)
  netscan.spec        empaquetado PyInstaller
  build.ps1           build local en Windows
```
