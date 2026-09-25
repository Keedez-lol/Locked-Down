# CANON — fixed id lists (binding for every module)

## A. Structures (131). Columns: id | name (es) | cat | tier | size | sprite | sfx | power/notes
Content agent fills cost/desc/details; sprite agent implements every sprite key; audio agent every sfx key.

### core / logistics / storage
hub | Almacén central | core | 0 | 3 | hub | - | placed at start, storage.cap 500, indestructible (hp floor 10%)
elevator | Elevador de recursos | core | 2 | 2 | elevator | pump | auto-placed at lower-layer centre when shaft completes; elevator.rate 5; also buildable
elevator_steel | Elevador de acero | logistics | 3 | 2 | elevator | pump | elevator.rate 20, expensive
elevator_industrial | Elevador industrial | logistics | 5 | 2 | elevator | electric_hum | elevator.rate 80, expensive
elevator_quantum | Elevador cuántico | logistics | 7 | 2 | elevator | quantum | elevator.rate 400, expensive, heatproof
drive_shaft | Eje de transmisión | logistics | 1 | 1 | cable | - | overlay cable, cap 10 kW (mechanical)
cable_copper | Cable de cobre | logistics | 2 | 1 | cable | - | overlay cable, cap 300 kW
cable_hv | Cable de alta tensión | logistics | 4 | 1 | cable | - | overlay cable, cap 20 MW
cable_super | Cable superconductor | logistics | 7 | 1 | cable | - | overlay cable, cap unlimited, heatproof
pipe_wood | Canalización de madera | logistics | 0 | 1 | pipe | - | overlay pipe, rate 2
pipe_bronze | Tubería de bronce | logistics | 1 | 1 | pipe | - | overlay pipe, rate 8
pipe_steel | Tubería de acero | logistics | 3 | 1 | pipe | - | overlay pipe, rate 40
pipe_titanium | Tubería de titanio | logistics | 5 | 1 | pipe | - | overlay pipe, rate 200
pipe_quantum | Tubería cuántica | logistics | 7 | 1 | pipe | - | overlay pipe, rate unlimited, heatproof
tank_wood | Tonel | storage | 0 | 1 | tank | - | tank.cap 300
tank_iron | Depósito de hierro | storage | 2 | 1 | tank | - | tank.cap 2000
tank_steel | Tanque de acero | storage | 3 | 2 | tank | - | tank.cap 10000
tank_titanium | Tanque de titanio | storage | 5 | 2 | tank | - | tank.cap 60000
tank_cryo | Tanque criogénico | storage | 6 | 2 | tank | cryo | tank.cap 30000, cryo:true, use 50 kW
tank_quantum | Tanque cuántico | storage | 7 | 3 | tank | quantum | tank.cap 2000000, cryo:true, use 1 MW, heatproof
conveyor_wood | Rodillos de madera | logistics | 0 | 1 | conveyor | - | rate 2
conveyor_iron | Cinta de hierro | logistics | 2 | 1 | conveyor | - | rate 8
conveyor_steel | Cinta de acero | logistics | 3 | 1 | conveyor | - | rate 24
conveyor_titanium | Cinta de titanio | logistics | 5 | 1 | conveyor | - | rate 80
conveyor_quantum | Cinta cuántica | logistics | 7 | 1 | conveyor | - | rate 400
shaft_coal | Pozo minero | logistics | 2 | 2 | shaft | drill_steam | shaft.layer 1, buildTime 20
shaft_deep | Pozo profundo | logistics | 3 | 2 | shaft | drill_electric | shaft.layer 2, buildTime 30
shaft_abyss | Pozo abisal | logistics | 5 | 2 | shaft | drill_laser | shaft.layer 3, buildTime 45
shaft_core | Pozo del núcleo | logistics | 7 | 2 | shaft | drill_plasma | shaft.layer 4, buildTime 60, heatproof
warehouse_wood | Granero | storage | 0 | 2 | warehouse | - | cap 200
warehouse_stone | Almacén de piedra | storage | 1 | 2 | warehouse | - | cap 600
warehouse_steel | Almacén de acero | storage | 3 | 2 | warehouse | - | cap 2500
warehouse_auto | Almacén automatizado | storage | 5 | 2 | warehouse | electric_hum | cap 12000, use 20 kW
silo_quantum | Silo cuántico | storage | 7 | 3 | warehouse | quantum | cap 100000, use 2 MW
torch | Antorcha | special | 0 | 1 | torch | - | light r3
lamp | Farol eléctrico | special | 2 | 1 | lamp | - | light r5, use 50 W
maintenance_bay | Taller de mantenimiento | special | 4 | 2 | maintenance_bay | assembler | auto-repair r8, use 40 kW

### nature (natural resources, farming)
gather_hut | Refugio del recolector | nature | 0 | 2 | gather_hut | farm | gathers stick/plant_fiber/stone/flint from natural tiles r4
woodcutter | Cabaña del leñador | nature | 0 | 2 | woodcutter | saw | cuts forest tiles r5 → wood_log (+resin 5%)
hunting_lodge | Cabaña de caza | nature | 0 | 2 | hunting_lodge | farm | hide/bone/sinew slowly (surface)
well | Pozo de agua | nature | 0 | 1 | well | pump | water 0.3/s
pump_hand | Bomba manual | nature | 1 | 1 | pump_hand | pump | adjacent to water: water 1.2/s
pump_electric | Bomba eléctrica | nature | 3 | 1 | pump_electric | pump | adjacent to water: 8/s, use 6 kW
quarry | Cantera | extract | 0 | 2 | quarry | drill_hand | on rock: stone 0.6/s, flint 10%
clay_pit | Barrera de arcilla | extract | 0 | 2 | clay_pit | drill_hand | on clay: clay 0.4/s
sand_pit | Arenero | extract | 1 | 2 | sand_pit | drill_hand | on sand: sand 0.5/s
peat_cutter | Turbera | extract | 1 | 2 | peat_cutter | drill_hand | on bog: peat 0.3/s
salt_works | Salinas | extract | 1 | 2 | salt_works | farm | on saltflat: salt 0.3/s, needs water
planter | Vivero | nature | 1 | 2 | planter | farm | replants forest on grass r5, uses water
tree_farm | Plantación forestal | nature | 2 | 3 | tree_farm | saw | wood_log 0.5/s, water 0.1/s
fiber_farm | Campo de fibra | nature | 1 | 3 | fiber_farm | farm | plant_fiber 0.4/s, water 0.08/s
bonsai | Bonsái industrial | nature | 3 | 1 | bonsai | bonsai | wood_log 0.15/s from water 0.05/s, use 200 W (light)
bonsai_hydro | Bonsái hidropónico | nature | 5 | 1 | bonsai_hydro | bonsai | wood_log 0.6/s, resin, water 0.15/s, use 2 kW
algae_farm | Estanque de algas | nature | 4 | 3 | algae_farm | farm | algae 0.8/s, water 0.3/s, use 5 kW
greenhouse | Invernadero | nature | 4 | 3 | greenhouse | farm | plant_fiber, rubber_sap, sapling; water; use 15 kW

### excavation (lower layers; borer.rate tiles/s, tier ≥ layer borerTier)
borer_steam | Tuneladora de vapor | extract | 2 | 2 | borer | drill_steam | borer.rate 2, burn 0.05 MJ/s + water (pipe)
borer_electric | Tuneladora eléctrica | extract | 3 | 2 | borer | drill_electric | borer.rate 4, use 80 kW
borer_laser | Tuneladora láser | extract | 5 | 2 | borer | drill_laser | borer.rate 10, use 2 MW
borer_plasma | Tuneladora de plasma | extract | 7 | 3 | borer | drill_plasma | borer.rate 30, use 60 MW, heatproof

### extract (deposits)
mine_hand | Mina a cielo abierto | extract | 0 | 2 | drill | drill_hand | hardnessMax 0, rate 0.25
mine_gallery | Mina de galería | extract | 1 | 2 | drill | drill_hand | hardnessMax 1, rate 0.4, burn (wood) for lamps? no: no power
drill_steam | Perforadora de vapor | extract | 2 | 2 | drill | drill_steam | hardnessMax 2, rate 0.8, burn 0.03 MJ/s + water
drill_electric | Perforadora eléctrica | extract | 3 | 2 | drill | drill_electric | hardnessMax 3, rate 1.5, use 40 kW
excavator | Excavadora industrial | extract | 4 | 3 | drill | drill_electric | hardnessMax 4, rate 2.5, use 250 kW
drill_laser | Taladro láser | extract | 5 | 2 | drill | drill_laser | hardnessMax 5, rate 5, use 1.2 MW
drill_cryo | Perforadora criogénica | extract | 6 | 2 | drill | drill_laser | hardnessMax 6, rate 9, use 3 MW, liquid_nitrogen
extractor_plasma | Extractor de plasma | extract | 7 | 3 | drill | drill_plasma | hardnessMax 7, rate 20, use 40 MW, heatproof
pumpjack | Balancín petrolífero | extract | 3 | 2 | pumpjack | pump | crude_oil deposits, rate 1.2, use 30 kW
gas_well | Pozo de gas | extract | 4 | 2 | gas_well | pump | natural_gas deposits, rate 2, use 60 kW
brine_pump | Bomba salina | extract | 6 | 2 | brine_pump | pump | deuterium_brine (infinite), rate 3, use 800 kW, heatproof
he3_collector | Colector de helio-3 | extract | 7 | 2 | he3_collector | cryo | helium3 vents (infinite), rate 1, use 20 MW, heatproof

### process
workbench | Mesa de trabajo | process | 0 | 1 | workbench | hammer | types workbench
charcoal_pit | Carbonera | process | 0 | 2 | charcoal_pit | furnace | kiln (charcoal), burn none (self)
stone_furnace | Horno de piedra | process | 0 | 1 | stone_furnace | furnace | smelting T0, burn 0.02 MJ/s
kiln | Horno de alfarero | process | 0 | 1 | kiln | kiln | kiln, burn 0.015 MJ/s
tannery | Curtiduría | process | 0 | 2 | tannery | farm | tanning
bronze_forge | Forja de bronce | process | 1 | 2 | bronze_forge | forge | smelting T1 (alloys), burn 0.04
trip_hammer | Martinete | process | 1 | 2 | trip_hammer | hammer | forging T1, use 2 kW
sawmill | Aserradero | process | 1 | 2 | sawmill | saw | sawing, use 1.5 kW
millstone | Molino de piedra | process | 1 | 2 | millstone | mill | crushing T1, use 2 kW
steam_hammer | Martillo de vapor | process | 2 | 2 | steam_hammer | hammer | forging T2, use 12 kW
blast_furnace | Alto horno | process | 2 | 3 | blast_furnace | furnace | blast, burn 0.1 (coke) + use 20 kW
coke_oven | Horno de coque | process | 2 | 2 | coke_oven | furnace | kiln T2 (coke, tar)
crusher | Trituradora | process | 2 | 2 | crusher | crusher | crushing T2, use 15 kW
press | Prensa hidráulica | process | 3 | 2 | press | press | pressing, use 25 kW
lathe | Torno | process | 3 | 1 | lathe | lathe | lathe, use 20 kW
wiremill | Trefiladora | process | 3 | 1 | wiremill | wiremill | wiremill, use 18 kW
assembler | Ensambladora | process | 3 | 2 | assembler | assembler | assembling, use 40 kW
electric_furnace | Horno eléctrico | process | 3 | 1 | electric_furnace | electric_hum | smelting T3, use 30 kW
mixer | Mezcladora | process | 3 | 2 | mixer | mill | mixing, use 20 kW
distillery | Destilería | process | 3 | 2 | distillery | boiler | distilling, use 30 kW
chemical_plant | Planta química | process | 4 | 3 | chemical_plant | chemical | chemical, use 120 kW
refinery | Refinería | process | 4 | 3 | refinery | refinery | refining, use 150 kW
electrolyzer | Electrolizador | process | 4 | 2 | electrolyzer | electrolyzer | electrolysis, use 200 kW
centrifuge | Centrifugadora | process | 4 | 2 | centrifuge | centrifuge | centrifuge, use 100 kW
compressor | Compresor | process | 4 | 1 | compressor | compressor | compressing, use 60 kW
arc_furnace | Horno de arco | process | 5 | 3 | arc_furnace | arc | arc, use 1.2 MW
vacuum_furnace | Horno de vacío | process | 5 | 2 | vacuum_furnace | vacuum | vacuum, use 800 kW
fabricator | Fabricador de precisión | process | 5 | 2 | fabricator | fabricator | fabrication, use 500 kW
enrichment_centrifuge | Cascada de enriquecimiento | process | 6 | 3 | enrichment_centrifuge | enrichment | enrichment, use 2 MW
fuel_fabricator | Fabricador de combustible nuclear | process | 6 | 2 | fuel_fabricator | fabricator | nuclear_fab, use 300 kW
cryo_plant | Planta criogénica | process | 6 | 2 | cryo_plant | cryo | cryo, use 1.5 MW
nano_forge | Nanoforja | process | 7 | 3 | nano_forge | nano | quantum (materials), use 25 MW, heatproof
matter_assembler | Ensamblador cuántico | process | 7 | 3 | matter_assembler | quantum | quantum (assembly), use 40 MW, heatproof

### power
water_wheel | Rueda hidráulica | power | 1 | 2 | water_wheel | waterwheel | gen 4 kW, must touch water
windmill | Molino de viento | power | 1 | 2 | windmill | windmill | gen 2.5 kW (surface only)
steam_engine | Máquina de vapor | power | 2 | 2 | steam_engine | steam | gen 60 kW, fuel + water 0.2/s, buildTime 6
coal_plant | Central térmica | power | 3 | 3 | coal_plant | boiler | gen 400 kW, fuel coal/coke + water 0.8/s
diesel_generator | Generador diésel | power | 4 | 2 | diesel_generator | generator_diesel | gen 1.5 MW, diesel/kerosene/biofuel/ethanol
gas_turbine | Turbina de gas | power | 4 | 3 | gas_turbine | turbine | gen 3 MW, natural_gas/hydrogen
solar_panel | Panel solar | power | 4 | 1 | solar_panel | - | gen 80 kW × daylight (surface)
geothermal_plant | Central geotérmica | power | 4 | 3 | geothermal_plant | turbine | gen 5 MW on vent (L3)
battery | Acumulador | power | 3 | 1 | battery | - | store 50 MJ
capacitor_bank | Banco de condensadores | power | 5 | 2 | capacitor_bank | electric_hum | store 5 GJ
fission_reactor | Reactor de fisión | power | 6 | 3 | fission_reactor | reactor | gen 150 MW, fuel_rod/mox_rod/thorium_fuel, water 5/s, needs cooling_tower adjacent (else 50% + wear ×5), buildTime 45
cooling_tower | Torre de refrigeración | power | 6 | 2 | cooling_tower | steam | water 2/s
fusion_reactor | Reactor de fusión | power | 7 | 3 | fusion_reactor | fusion | gen 2 GW, fusion_pellet/he3_pellet, buildTime 60, heatproof

### research
study_table | Mesa de estudio | research | 0 | 1 | study_table | lab | research rp0
lab_basic | Laboratorio | research | 2 | 2 | lab_basic | lab | research rp1/rp2, use 10 kW
lab_industrial | Laboratorio industrial | research | 4 | 3 | lab_industrial | lab | rp3/rp4, use 200 kW
lab_quantum | Laboratorio cuántico | research | 6 | 3 | lab_quantum | quantum | rp5, use 5 MW

### defense
palisade | Empalizada | defense | 0 | 1 | wall | - | wall hp 150
stone_wall | Muro de piedra | defense | 1 | 1 | wall | - | hp 500
steel_wall | Muro de acero | defense | 3 | 1 | wall | - | hp 2000
titanium_wall | Muro de titanio | defense | 5 | 1 | wall | - | hp 6000
thermal_wall | Muro blindado térmico | defense | 7 | 1 | wall | - | hp 20000, heatproof
watchtower | Torre de vigía | defense | 0 | 1 | watchtower | turret_charge | kinetic r5 dmg 6 rate 1 ammo arrow
ballista | Balista | defense | 1 | 2 | ballista | turret_charge | kinetic r7 dmg 30 rate 0.4 ammo ballista_bolt
cannon_turret | Torreta de cañón | defense | 3 | 2 | cannon_turret | turret_charge | kinetic r8 dmg 60 rate 0.8 ammo cannon_shell, use 10 kW
gatling_turret | Torreta automática | defense | 4 | 1 | gatling_turret | turret_charge | kinetic r7 dmg 12 rate 6 ammo bullet, use 30 kW
tesla_coil | Bobina Tesla | defense | 4 | 1 | tesla_coil | electric_hum | electric r4 dmg 25 rate 2 (hits all in range), use 200 kW
laser_turret | Torreta láser | defense | 5 | 1 | laser_turret | turret_charge | thermal r9 dmg 45 rate 2, use 400 kW
plasma_turret | Torreta de plasma | defense | 7 | 2 | plasma_turret | turret_charge | plasma ap r10 dmg 400 rate 1, use 8 MW, heatproof, cost includes carbide_tip + thermal_plate

## A2. Fluids (cat fluid|gas; live in tanks/pipes, never in item inventories)
water, crude_oil, naphtha, diesel, kerosene, lubricant, tar, sulfuric_acid, hydrochloric_acid, nitric_acid, ammonia,
chlorine, hydrogen, oxygen, nitrogen, liquid_nitrogen, natural_gas, ethanol, biofuel, latex (rubber_sap is the
raw fluid from greenhouse → rename: rubber_sap IS the fluid), deuterium_brine, deuterium, tritium, helium3,
coolant, cryo_coolant, uf6, enriched_uf6, magma, steam (optional). Cryogenic (need tank.cryo): liquid_nitrogen,
deuterium, tritium, helium3, cryo_coolant, liquid_hydrogen.

## B. Enemies (15)
wolf | Lobo | L0 | fast pack hunter, night | none
boar | Jabalí | L0 | tanky charger | none
bear | Oso | L0 | boss | none
cave_bat | Murciélago gigante | L1 | fast, weak | none
cave_spider | Araña de cueva | L1 | medium | chitin
armored_mole | Topo acorazado | L1 | boss | chitin
crystal_golem | Gólem de cristal | L2 | slow, tanky | crystal
silica_swarm | Enjambre de sílice | L2 | many, weak | crystal
quartz_serpent | Serpiente de cuarzo | L2 | boss | crystal
magma_salamander | Salamandra de magma | L3 | medium, fast | basalt
titan_beetle | Escarabajo de titanio | L3 | tanky | basalt
basalt_colossus | Coloso basáltico | L3 | boss | basalt
void_wraith | Ente del vacío | L4 | fast | void
plasma_devourer | Devorador de plasma | L4 | tanky | void
core_guardian | Guardián del núcleo | L4 | boss | void
Drops: L0 hide/bone/sinew; L1 chitin; L2 crystal_shard; L3 heat_gland (+basalt); L4 void_essence.

## C. Raw materials (63) — obtained without a recipe
Surface (L0): wood_log, stick, plant_fiber, stone, gravel, flint, clay, sand, water (fluid), hide, bone, sinew, resin, sapling,
copper_ore(h0), tin_ore(h0), iron_ore(h0 rare / h1), peat, salt
L1 (h1): coal, limestone, sulfur, saltpeter, crude_oil (h2, pumpjack), (iron_ore, flint, salt also here)
L2 (h2–3): zinc_ore, lead_ore, silver_ore, gold_ore, nickel_ore, quartz, amethyst, bauxite, chromite,
manganese_ore, natural_gas (h3, gas_well), (copper/tin/coal also)
L3 (h4–5): rutile, wolframite, platinum_ore, cobalt_ore, spodumene, molybdenite, vanadinite, monazite,
uraninite, thorite, diamond_raw, ruby_raw, sapphire_raw, obsidian, basalt
L4 (h6–7): iridium_ore, osmium_ore, corestone, plasma_crystal, neutronium_ore, magma (infinite),
deuterium_brine (infinite, brine_pump), helium3 (infinite, he3_collector)
Farms: algae (algae_farm), rubber_sap (greenhouse). Drops: chitin, crystal_shard, heat_gland, void_essence.

## D. Science items
rp0 Saber primitivo (study_table: from stick+flint+charcoal... cheap), rp1 Ciencia básica, rp2 Ciencia industrial,
rp3 Ciencia química, rp4 Ciencia nuclear, rp5 Ciencia cuántica. Category `science`.

## E. Ammo items
arrow (stick+flint+plant_fiber), ballista_bolt (iron_rod+plank), cannon_shell (steel+black_powder),
bullet (brass+black_powder). Category `ammo`.

## F. SFX keys (audio.js must implement all)
Machine loops: furnace, kiln, forge, hammer, saw, mill, steam, boiler, crusher, press, lathe, wiremill, assembler,
electric_hum, chemical, refinery, electrolyzer, centrifuge, compressor, arc, vacuum, enrichment, cryo, fabricator,
nano, quantum, drill_hand, drill_steam, drill_electric, drill_laser, drill_plasma, pump, wheel, windmill,
generator_diesel, turbine, reactor, fusion, lab, turret_charge, waterwheel, farm, bonsai.
One-shots: ui_click, ui_hover, ui_open, ui_close, ui_tab, build_place, build_done, dismantle, repair, research,
research_done, discover, wave_warning, wave_start, wave_end, brownout, integrity_low, structure_broken, excavated,
event_warning, weather_rain, weather_storm, shot_arrow, shot_ballista, shot_cannon, shot_gatling, shot_laser,
shot_tesla, shot_plasma, hit, enemy_die, growl, screech, crystal_chime, magma_roar, void_whisper, layer_switch,
save, error, objective, blueprint_paste, gather.
Ambience beds (Audio.ambient(layer, night, weather)): surface_day (wind, birds), surface_night (crickets, wind),
rain, storm, caves (drips, low rumble), deep (crystal hum), abyss (heat, sub-bass), core (void drone).
