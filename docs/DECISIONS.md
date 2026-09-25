# DECISIONS — answers from the design questionnaire (LD-Q50), binding

| # | Decision |
|---|----------|
| 1 | Game name: **KDZDUSTRY** (title lockup drawn with the KDZ monoline pen: hero K D Z + "DUSTRY" in the same technical lettering; mono subtitle "SIMULADOR INDUSTRIAL DE ESTRATOS"). |
| 2 | Spanish only. |
| 3 | In-game UI entirely ink-dark (panels `--ink`/`--ink2`, bone text, vermilion accent). Encyclopedia and pause/settings also dark. Only the main menu sits on the KDZ paper. |
| 4 | Main menu: ink slab on the left (like the animation's K slab) holding the drawn title and the options. |
| 5 | Title: drawn monoline logo + mono subtitle. |
| 6 | Menu music: minimal electronic pulse synced to 133 BPM (the animation's tempo), Web Audio synthesis. |
| 7 | In game: a very subtle musical layer per stratum (changes when switching layer), under machine SFX and ambience. |
| 8 | Outside the 16:9 stage: bands textured to match the current screen (paper grain on menu, ink grain in game). |
| 9 | Surface 256×192 tiles. Lower layers: L1 128×96, L2 128×96, L3 112×80, L4 96×64. Chunk 16×16. |
| 10 | Surface: whole map buildable for free (no claiming). Lower layers: chunks start as solid rock and must be **excavated** with tunnel borers of the layer's tier; rock hardness grows with distance from the elevator. |
| 11 | Deposits: finite in central chunks, **infinite** in the outer ring (surface border/corners; lower layers: the farthest, hardest chunks) so the endgame is always reachable. |
| 12 | Day/night: 600 s day; night waves ×1.5. |
| 13 | Weather on surface (clear / fog / rain / storm): rain +50 % wells & pumps, storm +60 % wind, −70 % solar in rain/storm; announced. |
| 14 | Independent map per stratum; elevator at each lower layer's centre. |
| 15 | Real darkness in caves + light map (machines, lamps, crystals, magma). |
| 16 | Strata section widget in the HUD is the layer control (keys 1–5 also work). |
| 17 | **Inventory per stratum.** Elevators move items between a layer and the surface with limited throughput; more/better elevators can be built (expensive). Construction pays from the layer's own inventory. Research pays from the surface inventory. |
| 18 | Abstract conveyors: adjacency link + tier caps throughput. |
| 19 | **Separate power cables** (tile overlay, can run over conveyors and empty tiles; structures conduct). Adjacent cable tier caps a structure's power I/O. Shafts carry power (and pipes) between layers. |
| 20 | Manual recipe per machine + "apply to all machines of this type (this layer)". |
| 21 | Ore processing intermediate: crusher doubles (ore → 2 crushed), washing at depth adds byproducts (crushed + water → washed + trace ores). |
| 22 | **Real fluids: pipes and tanks.** Fluid/gas items never enter the item inventory; they live in tanks on pipe networks (per layer). Adjacent pipe tier caps a machine's fluid throughput. Tanks are single-fluid. |
| 23 | Per-item storage caps expanded by warehouses (items only). |
| 24 | **No offline progress.** On load show time away only. |
| 25 | Overclock: per level +1 tier, ×2 power, ×1.5 speed, ×3 wear; max per machine `ocMax`. |
| 26 | Manual gathering with cooldown (hand tool). |
| 27 | 4 orientations (aesthetic only), rotate with R while placing. |
| 28 | Blueprints (copy/paste rectangular selections incl. conveyors, cables, pipes) from the start. |
| 29 | Wear by use (≈7 h to 0 % at full load, oc0). |
| 30 | Repair manual + maintenance bay. **Lubricant** (fluid from crude oil) on the machine's pipe network → wear ×(1/1.5), consumed 0.005/s. |
| 31 | Build times 1 s (conveyor) → 60 s (fusion). |
| 32 | Hub indestructible (floor 10 %); at ≤10 % its throughput (links, elevator intake) ×0.1. |
| 33 | Core heat: unshielded structures lose integrity continuously (0.05 %/s). |
| 34 | Waves every 10–15 min on normal (per layer). |
| 35 | Enemies path-find (A*) to the hub/elevator around walls; when fully walled they breach the weakest wall on the path. |
| 36 | Primitive turrets use ammo; laser/tesla/plasma only power. |
| 37 | Threat grows mostly with **energy handled** in the layer (+ time, + structures). |
| 38 | Special events (announced 60 s before): earthquakes (L1–L4), plasma storms (L4), migrations (L0 big wave), new vein discovered. |
| 39 | Ranges shown when placing and selecting; setting "always". |
| 40 | Research: pay science items (surface) and a lab of sufficient tier works `time` seconds; more labs = faster (linear). Queue of techs. |
| 41 | ~100 techs, 8 eras. |
| 42 | Encyclopedia by discovery ("???" + hint). |
| 43 | Guided tutorial (first minutes) + objectives list. |
| 44 | Production/power statistics with charts. |
| 45 | Particles high by default. |
| 46 | Machine sound mixed per visible type with limiter. |
| 47 | Free zoom 0.5×–3×. |
| 48 | **Tile 48 px.** |
| 49 | ~30 h active play to fusion. |
| 50 | Priority: aesthetics and feel. |
