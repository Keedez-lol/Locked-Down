(() => {
'use strict';
const LD = window.LD;
LD.Content = LD.Content || {};
const defs = [];
const PASSIVE = { logistics: 1, storage: 1, special: 1, core: 1 };
const FUEL_T0 = ['charcoal', 'coal', 'coke', 'peat', 'wood_log', 'plank', 'stick'];
const FUEL_STEAM = ['coal', 'coke', 'charcoal', 'peat', 'wood_log'];
/* S(id, name, cat, tier, size, sprite, sfx, fields) — sfx '-' → null; ocMax defaults by role and tier (decision 25) */
const S = (id, name, cat, tier, size, sprite, sfx, o) => {
  const d = Object.assign({ id, name, cat, tier, size, sprite, sfx: sfx === '-' ? null : sfx, speed: 1, complexity: 1, heatproof: false }, o);
  if (d.ocMax === undefined) d.ocMax = (PASSIVE[cat] || d.wall) ? 0 : tier <= 1 ? 1 : tier <= 5 ? 2 : 3;
  defs.push(d);
};
/* deposit extractor; fluid extractors carry `fluids` (the resource list) as well as `fluid` for the progression checks */
const EX = (hardnessMax, rate, res, extra) => {
  const e = Object.assign({ hardnessMax, rate, fluid: !!res }, extra || {});
  if (res) { e.res = res; e.fluids = res; }
  return e;
};
const LAMP = (radius, color, intensity) => ({ radius, color, intensity });

/* ── core / logistics / storage ── */
S('hub', 'Almacén central', 'core', 0, 3, 'hub', '-', {
  cost: {}, buildTime: 1, hp: 5000, storage: { cap: 500 }, types: ['hand'], light: LAMP(4, '#ffe2b0', 0.5),
  desc: 'Depósito sellado de la colonia y banco de trabajo manual. Toda cinta conectada a él enlaza sus máquinas con el inventario de la superficie.',
  lore: 'Lo primero que se levantó tras el sellado: cuatro muros de piedra en torno a lo poco que quedaba. Indestructible por decreto más que por diseño.' });
S('elevator', 'Elevador de recursos', 'core', 2, 2, 'elevator', 'pump', {
  cost: { iron_frame: 2, iron_gear: 4, rope: 8, plank: 12 }, buildTime: 10, hp: 1500, complexity: 2, elevator: { rate: 5 },
  desc: 'Jaula de madera y hierro sobre cabria. Sube 5 objetos/s del estrato a la superficie y baja lo que dictan sus reglas; enlaza cintas, cables y tuberías con el pozo.',
  lore: 'El primero se monta con las mismas maderas que apuntalan el pozo. Los siguientes, ya con criterio.' });
S('elevator_steel', 'Elevador de acero', 'logistics', 3, 2, 'elevator', 'pump', {
  cost: { steel_frame: 6, steel_gear: 8, motor: 2, steel_rod: 12, circuit_basic: 2, concrete: 20 }, buildTime: 15, hp: 2200, complexity: 2, elevator: { rate: 20 },
  desc: 'Jaula de acero con cabrestante eléctrico. 20 objetos/s entre el estrato y la superficie.' });
S('elevator_industrial', 'Elevador industrial', 'logistics', 5, 2, 'elevator', 'electric_hum', {
  cost: { titanium_frame: 4, motor: 8, steel_gear: 16, processor: 2, reinforced_concrete: 24, aluminium_wire: 16 }, buildTime: 25, hp: 3000, complexity: 3, elevator: { rate: 80 }, power: { use: 100e3 },
  desc: 'Doble jaula de titanio con motores en tándem. 80 objetos/s; consume 100 kW.' });
S('elevator_quantum', 'Elevador cuántico', 'logistics', 7, 2, 'elevator', 'quantum', {
  cost: { core_frame: 4, quantum_processor: 2, superconductor_wire: 24, nanotube: 8, thermal_plate: 12, motor: 12 }, buildTime: 40, hp: 4000, complexity: 5, heatproof: true, elevator: { rate: 400 }, power: { use: 5e6 }, light: LAMP(4, '#b28cff', 0.6),
  desc: 'Cabina de nanotubos en guía superconductora. 400 objetos/s; blindado contra el calor del núcleo.',
  lore: 'No sube: desaparece de un estrato y aparece en otro. Los ingenieros prefieren no mirar el hueco mientras tanto.' });
S('drive_shaft', 'Eje de transmisión', 'logistics', 1, 1, 'cable', '-', {
  cost: { wooden_gear: 1, stick: 2 }, buildTime: 1, hp: 120, overlay: 'cable', cable: { cap: 10e3 },
  desc: 'Eje de madera con engranajes que transmite par mecánico. Hasta 10 kW entre ruedas, molinos y máquinas de la era mecánica.' });
S('cable_copper', 'Cable de cobre', 'logistics', 2, 1, 'cable', '-', {
  cost: { insulated_wire: 1 }, buildTime: 1, hp: 150, overlay: 'cable', cable: { cap: 300e3 },
  desc: 'Conductor de cobre aislado sobre postes. Hasta 300 kW.' });
S('cable_hv', 'Cable de alta tensión', 'logistics', 4, 1, 'cable', '-', {
  cost: { aluminium_wire: 2, rubber: 1 }, buildTime: 1, hp: 220, overlay: 'cable', cable: { cap: 20e6 },
  desc: 'Línea de aluminio aislada en caucho. Hasta 20 MW.' });
S('cable_super', 'Cable superconductor', 'logistics', 7, 1, 'cable', '-', {
  cost: { superconductor_wire: 2, ceramic: 2 }, buildTime: 1, hp: 400, overlay: 'cable', cable: { cap: Infinity }, heatproof: true,
  desc: 'Cerámica superconductora en vaina refrigerada. Sin límite de potencia; resiste el calor del núcleo.' });
S('pipe_wood', 'Canalización de madera', 'logistics', 0, 1, 'pipe', '-', {
  cost: { plank: 1 }, buildTime: 1, hp: 100, overlay: 'pipe', pipe: { rate: 2 },
  desc: 'Canal de tablones sellado con resina. 2 unidades/s de fluido a baja presión.' });
S('pipe_bronze', 'Tubería de bronce', 'logistics', 1, 1, 'pipe', '-', {
  cost: { bronze_pipe: 1 }, buildTime: 1, hp: 150, overlay: 'pipe', pipe: { rate: 8 },
  desc: 'Tubo de bronce embridado. 8 unidades/s.' });
S('pipe_steel', 'Tubería de acero', 'logistics', 3, 1, 'pipe', '-', {
  cost: { steel_pipe: 1 }, buildTime: 1, hp: 220, overlay: 'pipe', pipe: { rate: 40 },
  desc: 'Tubo de acero soldado para vapor y ácidos a presión. 40 unidades/s.' });
S('pipe_titanium', 'Tubería de titanio', 'logistics', 5, 1, 'pipe', '-', {
  cost: { titanium_pipe: 1 }, buildTime: 1, hp: 300, overlay: 'pipe', pipe: { rate: 200 },
  desc: 'Tubo de titanio para fluidos corrosivos y criogénicos. 200 unidades/s.' });
S('pipe_quantum', 'Tubería cuántica', 'logistics', 7, 1, 'pipe', '-', {
  cost: { nanotube: 1, titanium_pipe: 1 }, buildTime: 1, hp: 400, overlay: 'pipe', pipe: { rate: Infinity }, heatproof: true,
  desc: 'Conducto de nanotubos sin pérdida de carga. Caudal ilimitado; resiste el calor del núcleo.' });
S('tank_wood', 'Tonel', 'storage', 0, 1, 'tank', '-', {
  cost: { plank: 6, rope: 2 }, buildTime: 2, hp: 200, tank: { cap: 300, cryo: false },
  desc: 'Tonel de duelas cerrado con cuerda. Almacena 300 unidades de un solo fluido.' });
S('tank_iron', 'Depósito de hierro', 'storage', 2, 1, 'tank', '-', {
  cost: { iron_plate: 6, valve: 1 }, buildTime: 4, hp: 500, tank: { cap: 2000, cryo: false },
  desc: 'Depósito remachado de hierro con válvula. 2.000 unidades.' });
S('tank_steel', 'Tanque de acero', 'storage', 3, 2, 'tank', '-', {
  cost: { steel_plate: 12, steel_pipe: 2, valve: 2 }, buildTime: 6, hp: 1200, tank: { cap: 10000, cryo: false },
  desc: 'Tanque cilíndrico de acero soldado. 10.000 unidades.' });
S('tank_titanium', 'Tanque de titanio', 'storage', 5, 2, 'tank', '-', {
  cost: { titanium_plate: 12, titanium_pipe: 2, valve: 2 }, buildTime: 8, hp: 2000, tank: { cap: 60000, cryo: false },
  desc: 'Tanque de titanio inerte a ácidos y sales. 60.000 unidades.' });
S('tank_cryo', 'Tanque criogénico', 'storage', 6, 2, 'tank', 'cryo', {
  cost: { titanium_plate: 16, titanium_pipe: 4, heat_exchanger: 2, processor: 1, plastic: 8 }, buildTime: 10, hp: 2000, complexity: 3, tank: { cap: 30000, cryo: true }, power: { use: 50e3 },
  desc: 'Vaso de doble pared al vacío con refrigeración activa. 30.000 unidades; único capaz de contener fluidos criogénicos. Consume 50 kW mientras está lleno.' });
S('tank_quantum', 'Tanque cuántico', 'storage', 7, 3, 'tank', 'quantum', {
  cost: { core_frame: 2, nanotube: 12, thermal_plate: 8, superconductor_wire: 8, titanium_plate: 24, quantum_processor: 1 }, buildTime: 20, hp: 4000, complexity: 4, heatproof: true, tank: { cap: 2000000, cryo: true }, power: { use: 1e6 },
  desc: 'Recipiente con confinamiento de campo. 2.000.000 unidades, criogénico, resistente al calor del núcleo. Consume 1 MW mientras contiene fluido.' });
S('conveyor_wood', 'Rodillos de madera', 'logistics', 0, 1, 'conveyor', '-', {
  cost: { plank: 2, stick: 1 }, buildTime: 1, hp: 120, conveyor: { rate: 2 },
  desc: 'Camino de rodillos de madera. Enlaza estructuras con el almacén a 2 objetos/s.' });
S('conveyor_iron', 'Cinta de hierro', 'logistics', 2, 1, 'conveyor', '-', {
  cost: { iron_plate: 1, wooden_gear: 1 }, buildTime: 1, hp: 180, conveyor: { rate: 8 },
  desc: 'Cinta de cuero sobre rodillos de hierro. 8 objetos/s.' });
S('conveyor_steel', 'Cinta de acero', 'logistics', 3, 1, 'conveyor', '-', {
  cost: { steel_plate: 1, steel_rod: 1 }, buildTime: 1, hp: 240, conveyor: { rate: 24 },
  desc: 'Cinta articulada de acero con motorización en línea. 24 objetos/s.' });
S('conveyor_titanium', 'Cinta de titanio', 'logistics', 5, 1, 'conveyor', '-', {
  cost: { titanium_plate: 1, bearing: 1 }, buildTime: 1, hp: 320, conveyor: { rate: 80 },
  desc: 'Cinta de titanio sobre rodamientos sellados. 80 objetos/s.' });
S('conveyor_quantum', 'Cinta cuántica', 'logistics', 7, 1, 'conveyor', '-', {
  cost: { nanotube: 1, core_alloy: 1 }, buildTime: 1, hp: 400, conveyor: { rate: 400 }, heatproof: true,
  desc: 'Guía de levitación sin partes móviles. 400 objetos/s; resiste el calor del núcleo.' });
S('shaft_coal', 'Pozo minero', 'logistics', 2, 2, 'shaft', 'drill_steam', {
  cost: { iron_frame: 6, iron_gear: 8, mechanism: 4, plank: 40, rope: 20, brick: 24 }, buildTime: 20, hp: 2000, complexity: 2, shaft: { layer: 1, rate: 5 },
  desc: 'Pozo entibado con cabria de hierro hasta las cuevas someras. Al terminar instala un elevador en su centro; conduce energía y 5 unidades/s de fluido entre estratos.',
  lore: 'Nadie sabía qué había debajo. Solo que arriba se acababa el carbón.' });
S('shaft_deep', 'Pozo profundo', 'logistics', 3, 2, 'shaft', 'drill_electric', {
  cost: { steel_frame: 8, motor: 4, steel_gear: 12, drill_head: 4, concrete: 40, circuit_basic: 4, steel_rod: 16 }, buildTime: 30, hp: 2600, complexity: 3, shaft: { layer: 2, rate: 20 },
  desc: 'Pozo revestido de hormigón con perforadora eléctrica hasta las cuevas profundas. Conduce energía y 20 unidades/s de fluido.',
  lore: 'A esa profundidad la roca canta. Los primeros mineros creyeron que era el viento.' });
S('shaft_abyss', 'Pozo abisal', 'logistics', 5, 2, 'shaft', 'drill_laser', {
  cost: { steel_frame: 12, motor: 10, drill_head: 12, circuit_advanced: 6, reinforced_concrete: 80, aluminium_plate: 24, stainless_plate: 16, transformer_core: 2, heat_exchanger: 2 }, buildTime: 45, hp: 3200, complexity: 4, shaft: { layer: 3, rate: 80 },
  desc: 'Pozo de hormigón armado y camisa de inoxidable hasta el abismo. Conduce energía y 80 unidades/s de fluido.',
  lore: 'El sensor de fondo marcó 400 °C antes de fundirse. Se bajó igual.' });
S('shaft_core', 'Pozo del núcleo', 'logistics', 7, 2, 'shaft', 'drill_plasma', {
  cost: { nanotube: 16, superconductor_wire: 32, titanium_frame: 12, laser_emitter: 6, processor: 8, thermal_plate: 24, motor: 16, reinforced_concrete: 120, carbide_tip: 8 }, buildTime: 60, hp: 4000, complexity: 5, heatproof: true, shaft: { layer: 4, rate: 400 }, light: LAMP(3, '#e8401c', 0.5),
  desc: 'Pozo con camisa térmica y guía de nanotubos hasta el núcleo. Conduce energía y 400 unidades/s de fluido.',
  lore: 'El último pozo. Debajo ya no hay roca: hay lo que sostiene la roca.' });
S('warehouse_wood', 'Granero', 'storage', 0, 2, 'warehouse', '-', {
  cost: { plank: 16, stick: 8, rope: 4 }, buildTime: 4, hp: 400, storage: { cap: 200 },
  desc: 'Cobertizo de tablones. Amplía en 200 unidades el límite por objeto del estrato.' });
S('warehouse_stone', 'Almacén de piedra', 'storage', 1, 2, 'warehouse', '-', {
  cost: { stone: 40, plank: 12, brick: 10 }, buildTime: 6, hp: 900, storage: { cap: 600 },
  desc: 'Nave de mampostería con techo de tablones. +600 unidades por objeto.' });
S('warehouse_steel', 'Almacén de acero', 'storage', 3, 2, 'warehouse', '-', {
  cost: { steel_plate: 30, steel_frame: 4, concrete: 24, circuit_basic: 1 }, buildTime: 10, hp: 1800, storage: { cap: 2500 },
  desc: 'Nave de estructura de acero sobre solera de hormigón. +2.500 unidades por objeto.' });
S('warehouse_auto', 'Almacén automatizado', 'storage', 5, 2, 'warehouse', 'electric_hum', {
  cost: { steel_frame: 6, motor: 4, processor: 2, reinforced_concrete: 24, steel_plate: 24, sensor: 2 }, buildTime: 16, hp: 2400, complexity: 2, storage: { cap: 12000 }, power: { use: 20e3 },
  desc: 'Estanterías de gran altura con transelevadores. +12.000 unidades por objeto; consume 20 kW.' });
S('silo_quantum', 'Silo cuántico', 'storage', 7, 3, 'warehouse', 'quantum', {
  cost: { core_frame: 4, quantum_processor: 2, nanotube: 24, thermal_plate: 16, titanium_plate: 40, motor: 8 }, buildTime: 30, hp: 4000, complexity: 4, heatproof: true, storage: { cap: 100000 }, power: { use: 2e6 }, light: LAMP(3, '#b28cff', 0.4),
  desc: 'Almacenamiento en matriz comprimida. +100.000 unidades por objeto; consume 2 MW; resiste el calor del núcleo.' });
S('torch', 'Antorcha', 'special', 0, 1, 'torch', '-', {
  cost: { stick: 1, plant_fiber: 1 }, buildTime: 1, hp: 60, light: LAMP(3, '#ffb060', 0.7),
  desc: 'Vara con estopa embreada. Ilumina 3 casillas en las cuevas.' });
S('lamp', 'Farol eléctrico', 'special', 2, 1, 'lamp', '-', {
  cost: { glass: 1, copper_wire: 2, iron_plate: 1 }, buildTime: 1, hp: 120, light: LAMP(5, '#ffe9c0', 0.9), power: { use: 50 },
  desc: 'Filamento en ampolla de vidrio sobre poste. Ilumina 5 casillas; consume 50 W.' });
S('maintenance_bay', 'Taller de mantenimiento', 'special', 4, 2, 'maintenance_bay', 'assembler', {
  cost: { steel_frame: 2, motor: 2, circuit_advanced: 1, mechanism: 4, steel_plate: 12, sensor: 1 }, buildTime: 15, hp: 1200, complexity: 2, maintenance: { radius: 8 }, power: { use: 40e3 },
  desc: 'Taller con grúa pórtico y brigada automática. Cada 10 s repara las estructuras en un radio de 8 casillas con materiales del estrato; consume 40 kW.' });

/* ── nature (natural resources, farming) ── */
S('gather_hut', 'Refugio del recolector', 'nature', 0, 2, 'gather_hut', 'farm', {
  cost: { stick: 10, plant_fiber: 8, rope: 2 }, buildTime: 3, hp: 300, surfaceOnly: true, nature: { kind: 'gather', radius: 4, rate: 0.25 },
  desc: 'Cabaña desde la que se recogen varas, fibra, piedra y sílex de las casillas naturales en un radio de 4. Un objeto cada 4 s.' });
S('woodcutter', 'Cabaña del leñador', 'nature', 0, 2, 'woodcutter', 'saw', {
  cost: { plank: 8, stick: 6, rope: 3, hand_tool: 1 }, buildTime: 4, hp: 300, surfaceOnly: true, nature: { kind: 'woodcutter', radius: 5, rate: 0.4 },
  desc: 'Tala los árboles maduros en un radio de 5 y deja que rebroten. Troncos y, a veces, resina.' });
S('hunting_lodge', 'Cabaña de caza', 'nature', 0, 2, 'hunting_lodge', 'farm', {
  cost: { plank: 10, stick: 8, rope: 4, hand_tool: 1 }, buildTime: 4, hp: 300, surfaceOnly: true, nature: { kind: 'hunt', radius: 6, out: { hide: 0.05, bone: 0.04, sinew: 0.03 } },
  desc: 'Puesto de trampas en terreno silvestre. Rinde piel, hueso y tendón según el bosque y la pradera libres en un radio de 6.' });
S('well', 'Pozo de agua', 'nature', 0, 1, 'well', 'pump', {
  cost: { stone: 14, plank: 4, rope: 2 }, buildTime: 3, hp: 250, nature: { kind: 'well', out: { water: 0.3 } },
  desc: 'Pozo de brocal con cubo. 0,3 unidades/s de agua a la red de tuberías; más con lluvia.' });
S('pump_hand', 'Bomba manual', 'nature', 1, 1, 'pump_hand', 'pump', {
  cost: { bronze_pipe: 3, wooden_gear: 2, plank: 6, leather: 2 }, buildTime: 4, hp: 300, needsWater: true, nature: { kind: 'pump', out: { water: 1.2 } },
  desc: 'Bomba de émbolo con cuero junto a una masa de agua. 1,2 unidades/s a la red de tuberías.' });
S('pump_electric', 'Bomba eléctrica', 'nature', 3, 1, 'pump_electric', 'pump', {
  cost: { pump_mechanism: 1, motor: 1, steel_pipe: 3, circuit_basic: 1 }, buildTime: 8, hp: 500, complexity: 2, needsWater: true, nature: { kind: 'pump', out: { water: 8 } }, power: { use: 6e3 },
  desc: 'Bomba centrífuga junto al agua. 8 unidades/s a la red; consume 6 kW.' });
S('quarry', 'Cantera', 'extract', 0, 2, 'quarry', 'drill_hand', {
  cost: { stick: 8, plank: 4, hand_tool: 2, rope: 2 }, buildTime: 4, hp: 350, nature: { kind: 'farm', terrain: 'rock', out: { stone: 0.6, flint: 0.06, gravel: 0.1 } },
  desc: 'Frente de cantera sobre roca. 0,6 piedra/s con algo de grava y sílex.' });
S('clay_pit', 'Barrera de arcilla', 'extract', 0, 2, 'clay_pit', 'drill_hand', {
  cost: { stick: 6, plank: 4, hand_tool: 1 }, buildTime: 3, hp: 300, nature: { kind: 'farm', terrain: 'clay', out: { clay: 0.4 } },
  desc: 'Excavación sobre terreno arcilloso. 0,4 arcilla/s.' });
S('sand_pit', 'Arenero', 'extract', 1, 2, 'sand_pit', 'drill_hand', {
  cost: { plank: 6, hand_tool: 2, rope: 2, stick: 4 }, buildTime: 3, hp: 300, nature: { kind: 'farm', terrain: 'sand', out: { sand: 0.5 } },
  desc: 'Cribas y palas sobre arenal. 0,5 arena/s.' });
S('peat_cutter', 'Turbera', 'extract', 1, 2, 'peat_cutter', 'drill_hand', {
  cost: { plank: 8, hand_tool: 2, rope: 3 }, buildTime: 4, hp: 300, nature: { kind: 'farm', terrain: 'bog', out: { peat: 0.3 } },
  desc: 'Corte y secado de turba sobre ciénaga. 0,3 turba/s: combustible pobre pero abundante.' });
S('salt_works', 'Salinas', 'extract', 1, 2, 'salt_works', 'farm', {
  cost: { plank: 10, clay: 8, rope: 3, bronze_pipe: 2 }, buildTime: 5, hp: 300, nature: { kind: 'farm', terrain: 'saltflat', out: { salt: 0.3 }, consumes: { water: 0.3 } },
  desc: 'Balsas de evaporación sobre salar. 0,3 sal/s a partir de 0,3 agua/s por tubería.' });
S('planter', 'Vivero', 'nature', 1, 2, 'planter', 'farm', {
  cost: { plank: 10, clay: 4, rope: 3, hand_tool: 1 }, buildTime: 4, hp: 300, surfaceOnly: true, nature: { kind: 'planter', radius: 5, interval: 20, consumes: { water: 0.05 } },
  desc: 'Semillero que replanta bosque en la pradera libre de un radio de 5 cada 20 s. Riego por tubería; un plantón acelera cada ciclo.' });
S('tree_farm', 'Plantación forestal', 'nature', 2, 3, 'tree_farm', 'saw', {
  cost: { plank: 24, clay: 8, rope: 8, bronze_pipe: 4, wood_frame: 2 }, buildTime: 8, hp: 600, surfaceOnly: true, complexity: 2, nature: { kind: 'farm', out: { wood_log: 0.5 }, consumes: { water: 0.1 } },
  desc: 'Cultivo de crecimiento rápido con riego. 0,5 troncos/s por 0,1 agua/s.' });
S('fiber_farm', 'Campo de fibra', 'nature', 1, 3, 'fiber_farm', 'farm', {
  cost: { plank: 16, rope: 6, clay: 6, bronze_pipe: 2 }, buildTime: 6, hp: 450, surfaceOnly: true, nature: { kind: 'farm', out: { plant_fiber: 0.4 }, consumes: { water: 0.08 } },
  desc: 'Bancales de lino y cáñamo con acequias. 0,4 fibra/s por 0,08 agua/s.' });
S('bonsai', 'Bonsái industrial', 'nature', 3, 1, 'bonsai', 'bonsai', {
  cost: { glass: 4, ceramic: 2, copper_wire: 4, steel_plate: 2, clay: 2 }, buildTime: 6, hp: 300, complexity: 2, nature: { kind: 'farm', out: { wood_log: 0.15 }, consumes: { water: 0.05 } }, power: { use: 200 },
  desc: 'Árbol enano bajo lámpara de cultivo. 0,15 troncos/s por 0,05 agua/s y 200 W; funciona bajo tierra.' });
S('bonsai_hydro', 'Bonsái hidropónico', 'nature', 5, 1, 'bonsai_hydro', 'bonsai', {
  cost: { titanium_pipe: 2, glass: 6, plastic: 4, sensor: 1, sapling: 2, fertilizer: 4, circuit_advanced: 1 }, buildTime: 10, hp: 400, complexity: 3, nature: { kind: 'farm', out: { wood_log: 0.6, resin: 0.06 }, consumes: { water: 0.15 } }, power: { use: 2e3 },
  desc: 'Cultivo hidropónico de alta densidad con espectro controlado. 0,6 troncos/s y algo de resina por 0,15 agua/s y 2 kW.' });
S('algae_farm', 'Estanque de algas', 'nature', 4, 3, 'algae_farm', 'farm', {
  cost: { glass: 16, steel_pipe: 6, concrete: 12, pump_mechanism: 1, circuit_basic: 2, fertilizer: 6 }, buildTime: 12, hp: 700, surfaceOnly: true, complexity: 2, nature: { kind: 'farm', out: { algae: 0.8 }, consumes: { water: 0.3 } }, power: { use: 5e3 },
  desc: 'Fotobiorreactor abierto con agitación. 0,8 algas/s por 0,3 agua/s y 5 kW: base del biocombustible.' });
S('greenhouse', 'Invernadero', 'nature', 4, 3, 'greenhouse', 'farm', {
  cost: { glass: 24, steel_frame: 3, steel_pipe: 6, plastic: 8, sensor: 1, fertilizer: 8, circuit_basic: 2 }, buildTime: 15, hp: 800, surfaceOnly: true, complexity: 3, nature: { kind: 'farm', out: { plant_fiber: 0.6, rubber_sap: 0.2, sapling: 0.05 }, consumes: { water: 0.25 } }, power: { use: 15e3 },
  desc: 'Nave de vidrio climatizada con heveas y fibra. Fibra, látex por tubería y plantones; 0,25 agua/s y 15 kW.' });

/* ── excavation (tunnel borers) ── */
S('borer_steam', 'Tuneladora de vapor', 'extract', 2, 2, 'borer', 'drill_steam', {
  cost: { boiler: 1, drill_head: 2, iron_frame: 4, steel_plate: 6, piston: 2, steel_gear: 4 }, buildTime: 10, hp: 900, complexity: 2, borer: { rate: 2 }, burn: { mjPerSec: 0.05, fuels: FUEL_STEAM, fluidIn: { water: 0.15 } },
  desc: 'Cabezal de corona sobre chasis de vapor. Excava 2 casillas/s de roca de las cuevas someras; quema 0,05 MJ/s y toma 0,15 agua/s por tubería.',
  lore: 'Tose, chirría y avanza un palmo cada suspiro. Nadie la quiere y nadie la apaga.' });
S('borer_electric', 'Tuneladora eléctrica', 'extract', 3, 2, 'borer', 'drill_electric', {
  cost: { motor: 3, drill_head: 3, steel_frame: 4, steel_gear: 6, circuit_basic: 2, bearing: 4 }, buildTime: 15, hp: 1200, complexity: 3, borer: { rate: 4 }, power: { use: 80e3 },
  desc: 'Tuneladora con cabezal motorizado. 4 casillas/s hasta las cuevas profundas; consume 80 kW.' });
S('borer_laser', 'Tuneladora láser', 'extract', 5, 2, 'borer', 'drill_laser', {
  cost: { titanium_frame: 4, motor: 6, drill_head: 4, carbide_tip: 4, circuit_advanced: 4, tungsten_rod: 4, heat_exchanger: 1, sensor: 2 }, buildTime: 25, hp: 1800, complexity: 4, borer: { rate: 10 }, power: { use: 2e6 },
  desc: 'Cabezal de carburo asistido por ablación láser. 10 casillas/s hasta el abismo; consume 2 MW.',
  lore: 'La roca abisal no se rompe: se evapora. El olor dura semanas.' });
S('borer_plasma', 'Tuneladora de plasma', 'extract', 7, 3, 'borer', 'drill_plasma', {
  cost: { core_frame: 4, plasma_cell: 4, carbide_tip: 8, quantum_processor: 2, thermal_plate: 12, motor: 12, superconductor_wire: 16 }, buildTime: 40, hp: 3000, complexity: 5, heatproof: true, borer: { rate: 30 }, power: { use: 60e6 }, light: LAMP(4, '#c06aff', 0.6),
  desc: 'Antorcha de plasma confinado sobre chasis blindado. 30 casillas/s en el núcleo; consume 60 MW; resiste el calor.',
  lore: 'Funde la roca del núcleo y la deja vitrificada tras de sí. Por el túnel se puede mirar hasta el final.' });

/* ── extract (deposits) ── */
S('mine_hand', 'Mina a cielo abierto', 'extract', 0, 2, 'drill', 'drill_hand', {
  cost: { plank: 8, stick: 6, hand_tool: 2, rope: 2 }, buildTime: 4, hp: 350, extract: EX(0, 0.25),
  desc: 'Zanjas y picos sobre un yacimiento superficial. 0,25 unidades/s por casilla de dureza 0.' });
S('mine_gallery', 'Mina de galería', 'extract', 1, 2, 'drill', 'drill_hand', {
  cost: { plank: 18, stone: 12, rope: 6, hand_tool: 3, bronze_plate: 2 }, buildTime: 6, hp: 450, extract: EX(1, 0.4),
  desc: 'Galería entibada con vagonetas. 0,4 unidades/s por casilla hasta dureza 1; sin energía.' });
S('drill_steam', 'Perforadora de vapor', 'extract', 2, 2, 'drill', 'drill_steam', {
  cost: { boiler: 1, drill_head: 1, iron_frame: 3, iron_gear: 4, piston: 1, bronze_pipe: 4 }, buildTime: 8, hp: 700, complexity: 2, extract: EX(2, 0.8), burn: { mjPerSec: 0.03, fuels: FUEL_STEAM, fluidIn: { water: 0.1 } },
  desc: 'Perforadora de percusión a vapor. 0,8 unidades/s por casilla hasta dureza 2; quema 0,03 MJ/s y toma 0,1 agua/s.' });
S('drill_electric', 'Perforadora eléctrica', 'extract', 3, 2, 'drill', 'drill_electric', {
  cost: { motor: 2, drill_head: 2, steel_frame: 2, steel_gear: 4, circuit_basic: 1 }, buildTime: 10, hp: 900, complexity: 3, extract: EX(3, 1.5), power: { use: 40e3 },
  desc: 'Perforadora rotativa con motor eléctrico. 1,5 unidades/s por casilla hasta dureza 3; consume 40 kW.' });
S('excavator', 'Excavadora industrial', 'extract', 4, 3, 'drill', 'drill_electric', {
  cost: { motor: 4, drill_head: 4, steel_frame: 6, circuit_advanced: 1, bearing: 6, steel_gear: 8 }, buildTime: 18, hp: 1600, complexity: 3, extract: EX(4, 2.5), power: { use: 250e3 },
  desc: 'Rotopala sobre orugas con cangilones de acero. 2,5 unidades/s por casilla hasta dureza 4; consume 250 kW.' });
S('drill_laser', 'Taladro láser', 'extract', 5, 2, 'drill', 'drill_laser', {
  cost: { titanium_frame: 2, motor: 3, drill_head: 2, carbide_tip: 2, circuit_advanced: 2, sensor: 2, tungsten_wire: 4, crystal_lens: 1, fiber_optic: 2 }, buildTime: 22, hp: 1400, complexity: 4, extract: EX(5, 5), power: { use: 1.2e6 },
  desc: 'Corona de carburo con precalentamiento por haz. 5 unidades/s por casilla hasta dureza 5; consume 1,2 MW.' });
S('drill_cryo', 'Perforadora criogénica', 'extract', 6, 2, 'drill', 'drill_laser', {
  cost: { carbide_tip: 4, titanium_frame: 3, motor: 4, drill_head: 4, heat_exchanger: 2, processor: 2, titanium_pipe: 4 }, buildTime: 28, hp: 1800, complexity: 4, extract: EX(6, 9, null, { consumes: { liquid_nitrogen: 0.05 } }), power: { use: 3e6 },
  desc: 'Fractura la roca por choque térmico con nitrógeno líquido (0,05/s). 9 unidades/s por casilla hasta dureza 6; consume 3 MW.' });
S('extractor_plasma', 'Extractor de plasma', 'extract', 7, 3, 'drill', 'drill_plasma', {
  cost: { core_frame: 3, plasma_cell: 2, carbide_tip: 6, quantum_processor: 2, thermal_plate: 8, motor: 8, superconductor_wire: 12 }, buildTime: 40, hp: 3000, complexity: 5, heatproof: true, extract: EX(7, 20), power: { use: 40e6 }, light: LAMP(4, '#c06aff', 0.5),
  desc: 'Sublima el mineral del núcleo con plasma confinado y lo condensa en rampa. 20 unidades/s por casilla hasta dureza 7; consume 40 MW.' });
S('pumpjack', 'Balancín petrolífero', 'extract', 3, 2, 'pumpjack', 'pump', {
  cost: { pump_mechanism: 1, motor: 1, steel_frame: 2, steel_pipe: 6, steel_gear: 2, circuit_basic: 1 }, buildTime: 12, hp: 800, complexity: 2, extract: EX(2, 1.2, ['crude_oil']), power: { use: 30e3 },
  desc: 'Bomba de varillas sobre bolsa de crudo. 1,2 unidades/s por casilla a la red de tuberías; consume 30 kW.' });
S('gas_well', 'Pozo de gas', 'extract', 4, 2, 'gas_well', 'pump', {
  cost: { pump_mechanism: 2, motor: 1, steel_frame: 2, steel_pipe: 8, valve: 4, circuit_advanced: 1 }, buildTime: 14, hp: 900, complexity: 2, extract: EX(3, 2, ['natural_gas']), power: { use: 60e3 },
  desc: 'Cabezal de pozo con separador sobre bolsa de gas. 2 unidades/s por casilla a tuberías; consume 60 kW.' });
S('brine_pump', 'Bomba salina', 'extract', 6, 2, 'brine_pump', 'pump', {
  cost: { pump_mechanism: 4, titanium_frame: 3, titanium_pipe: 8, motor: 4, processor: 2, thermal_plate: 4, valve: 6 }, buildTime: 30, hp: 2000, complexity: 3, heatproof: true, extract: EX(6, 3, ['deuterium_brine']), power: { use: 800e3 },
  desc: 'Bomba de titanio sobre acuífero de salmuera pesada del núcleo. 3 unidades/s por casilla; consume 800 kW.' });
S('he3_collector', 'Colector de helio-3', 'extract', 7, 2, 'he3_collector', 'cryo', {
  cost: { core_frame: 2, pump_mechanism: 6, titanium_pipe: 16, thermal_plate: 8, quantum_processor: 1, heat_exchanger: 6, superconductor_wire: 8 }, buildTime: 40, hp: 2400, complexity: 4, heatproof: true, extract: EX(7, 1, ['helium3']), power: { use: 20e6 }, light: LAMP(3, '#e0d8f0', 0.4),
  desc: 'Campana criogénica sobre chimenea del núcleo. Condensa 1 unidad/s de helio-3 por casilla; consume 20 MW.' });

/* ── process ── */
S('workbench', 'Mesa de trabajo', 'process', 0, 1, 'workbench', 'hammer', {
  cost: { plank: 6, stick: 4, rope: 2 }, buildTime: 3, hp: 300, types: ['workbench', 'ammo'],
  desc: 'Banco con tornillo y plantillas. Ensambla piezas simples, munición y los primeros mecanismos.' });
S('charcoal_pit', 'Carbonera', 'process', 0, 2, 'charcoal_pit', 'furnace', {
  cost: { stone: 10, clay: 6, wood_log: 6 }, buildTime: 4, hp: 350, types: ['kiln'], light: LAMP(2, '#ff9a40', 0.35),
  desc: 'Pila de leña cubierta de tierra que arde sin aire. Carboniza troncos y cuece arcilla con su propio calor.' });
S('stone_furnace', 'Horno de piedra', 'process', 0, 1, 'stone_furnace', 'furnace', {
  cost: { stone: 18, clay: 8 }, buildTime: 4, hp: 400, types: ['smelting'], burn: { mjPerSec: 0.02, fuels: FUEL_T0 }, light: LAMP(2, '#ff8a30', 0.45),
  desc: 'Cuba de piedra con tiro natural. Funde cobre y estaño quemando 0,02 MJ/s de leña o carbón vegetal.' });
S('kiln', 'Horno de alfarero', 'process', 0, 1, 'kiln', 'kiln', {
  cost: { stone: 12, clay: 12, stick: 4 }, buildTime: 4, hp: 350, types: ['kiln'], burn: { mjPerSec: 0.015, fuels: FUEL_T0 }, light: LAMP(2, '#ff9a40', 0.35),
  desc: 'Horno de bóveda para ladrillo, cerámica y cal. Quema 0,015 MJ/s.' });
S('tannery', 'Curtiduría', 'process', 0, 2, 'tannery', 'farm', {
  cost: { plank: 8, stick: 6, rope: 4, stone: 6 }, buildTime: 4, hp: 300, types: ['tanning'],
  desc: 'Tinas de corteza y agua donde la piel se convierte en cuero.' });
S('bronze_forge', 'Forja de bronce', 'process', 1, 2, 'bronze_forge', 'forge', {
  cost: { brick: 20, stone: 16, bellows: 2, copper_ingot: 8, clay: 6 }, buildTime: 6, hp: 550, complexity: 2, types: ['smelting'], burn: { mjPerSec: 0.04, fuels: FUEL_T0 }, light: LAMP(3, '#ffa040', 0.5),
  desc: 'Fragua con fuelle y crisoles. Funde hierro y alea bronce, latón y electro; quema 0,04 MJ/s.' });
S('trip_hammer', 'Martinete', 'process', 1, 2, 'trip_hammer', 'hammer', {
  cost: { wood_frame: 2, wooden_gear: 4, stone: 20, rope: 4, copper_ingot: 6 }, buildTime: 6, hp: 500, complexity: 2, types: ['forging'], power: { use: 2e3 },
  desc: 'Mazo de leva movido por eje de transmisión. Forja placas, varillas, hilo y engranajes; consume 2 kW mecánicos.' });
S('sawmill', 'Aserradero', 'process', 1, 2, 'sawmill', 'saw', {
  cost: { wood_frame: 2, wooden_gear: 3, plank: 12, copper_plate: 4, rope: 4 }, buildTime: 6, hp: 450, complexity: 2, types: ['sawing'], power: { use: 1.5e3 },
  desc: 'Sierra alternativa sobre carro. Tablones, varas, engranajes y bastidores de madera; consume 1,5 kW mecánicos.' });
S('millstone', 'Molino de piedra', 'process', 1, 2, 'millstone', 'mill', {
  cost: { stone: 30, wooden_gear: 4, wood_frame: 1, rope: 4, bronze_gear: 2 }, buildTime: 6, hp: 600, complexity: 2, types: ['crushing'], power: { use: 2e3 },
  desc: 'Muelas de piedra sobre eje. Tritura mena a razón de 3 por 2 y muele pólvora y hueso; consume 2 kW mecánicos.' });
S('steam_hammer', 'Martillo de vapor', 'process', 2, 2, 'steam_hammer', 'hammer', {
  cost: { boiler: 1, piston: 2, steel_frame: 1, iron_plate: 8, steel_gear: 2 }, buildTime: 8, hp: 800, complexity: 3, types: ['forging'], power: { use: 12e3 },
  desc: 'Martillo pilón de vapor. Forja acero e inoxidable, cabezales y pistones; consume 12 kW.' });
S('blast_furnace', 'Alto horno', 'process', 2, 3, 'blast_furnace', 'furnace', {
  cost: { brick: 60, steel_plate: 12, iron_frame: 4, bellows: 2, valve: 2, stone: 30 }, buildTime: 12, hp: 1500, complexity: 3, types: ['blast'], burn: { mjPerSec: 0.1, fuels: ['coke', 'coal'] }, power: { use: 20e3 }, light: LAMP(4, '#ff7a20', 0.7),
  desc: 'Cuba de ladrillo con soplantes. Reduce hierro y produce acero con coque; quema 0,1 MJ/s y consume 20 kW en las soplantes.',
  lore: 'La primera colada iluminó la noche entera. La segunda ya no la miró nadie.' });
S('coke_oven', 'Horno de coque', 'process', 2, 2, 'coke_oven', 'furnace', {
  cost: { brick: 40, iron_plate: 8, valve: 2, clay: 12 }, buildTime: 8, hp: 800, complexity: 2, types: ['kiln'], light: LAMP(3, '#ff9a40', 0.45),
  desc: 'Batería de cámaras cerradas que destilan carbón. Coque y alquitrán por tubería; se calienta con sus propios gases.' });
S('crusher', 'Trituradora', 'process', 2, 2, 'crusher', 'crusher', {
  cost: { iron_frame: 2, steel_gear: 4, iron_plate: 8, drill_head: 1, mechanism: 2 }, buildTime: 8, hp: 800, complexity: 3, types: ['crushing'], power: { use: 15e3 },
  desc: 'Mandíbulas de acero sobre bastidor. Dobla el rendimiento de cualquier mena; consume 15 kW.' });
S('press', 'Prensa hidráulica', 'process', 3, 2, 'press', 'press', {
  cost: { piston: 4, steel_frame: 2, steel_plate: 12, motor: 1, circuit_basic: 1 }, buildTime: 10, hp: 900, complexity: 3, types: ['pressing'], power: { use: 25e3 },
  desc: 'Prensa de doble efecto. Lamina placas, álabes, electrodos y losas; consume 25 kW.' });
S('lathe', 'Torno', 'process', 3, 1, 'lathe', 'lathe', {
  cost: { motor: 1, steel_frame: 1, bearing: 2, steel_gear: 2, circuit_basic: 1 }, buildTime: 8, hp: 600, complexity: 3, types: ['lathe'], power: { use: 20e3 },
  desc: 'Torno paralelo de precisión. Rodamientos, varillas, obleas y gemas talladas; consume 20 kW.' });
S('wiremill', 'Trefiladora', 'process', 3, 1, 'wiremill', 'wiremill', {
  cost: { motor: 1, steel_frame: 1, steel_gear: 4, bearing: 2, circuit_basic: 1 }, buildTime: 8, hp: 600, complexity: 3, types: ['wiremill'], power: { use: 18e3 },
  desc: 'Hileras de carburo en cascada. Estira hilo de cobre, oro, aluminio y tungsteno, y fibra de vidrio; consume 18 kW.' });
S('assembler', 'Ensambladora', 'process', 3, 2, 'assembler', 'assembler', {
  cost: { motor: 2, steel_frame: 2, circuit_basic: 4, steel_plate: 8, mechanism: 2 }, buildTime: 12, hp: 900, complexity: 3, types: ['assembling', 'ammo'], power: { use: 40e3 },
  desc: 'Línea de montaje con brazos y útiles intercambiables. Motores, circuitos, turbinas y munición; consume 40 kW.' });
S('electric_furnace', 'Horno eléctrico', 'process', 3, 1, 'electric_furnace', 'electric_hum', {
  cost: { steel_frame: 1, brick: 24, copper_wire: 12, circuit_basic: 2, ceramic: 6 }, buildTime: 10, hp: 700, complexity: 3, types: ['smelting'], power: { use: 30e3 }, light: LAMP(2, '#ffc070', 0.4),
  desc: 'Horno de resistencias con control de temperatura. Todas las fundiciones hasta T3 sin combustible; consume 30 kW.' });
S('mixer', 'Mezcladora', 'process', 3, 2, 'mixer', 'mill', {
  cost: { motor: 1, steel_frame: 1, steel_plate: 6, steel_pipe: 2, valve: 2, circuit_basic: 1 }, buildTime: 10, hp: 700, complexity: 2, types: ['mixing', 'washing'], power: { use: 20e3 },
  desc: 'Tambor con palas y toma de agua. Hormigón, refrigerante y lubricante; lava mena triturada liberando trazas; consume 20 kW.' });
S('distillery', 'Destilería', 'process', 3, 2, 'distillery', 'boiler', {
  cost: { boiler: 1, steel_pipe: 8, valve: 4, steel_plate: 8, copper_plate: 6, circuit_basic: 1 }, buildTime: 12, hp: 800, complexity: 3, types: ['distilling'], power: { use: 30e3 },
  desc: 'Columna de platos con condensador de cobre. Fracciona crudo y alquitrán y destila etanol y biocombustible; consume 30 kW.' });
S('chemical_plant', 'Planta química', 'process', 4, 3, 'chemical_plant', 'chemical', {
  cost: { heat_exchanger: 2, stainless_plate: 12, steel_frame: 3, steel_pipe: 8, valve: 6, circuit_advanced: 2, pump_mechanism: 1 }, buildTime: 18, hp: 1600, complexity: 4, types: ['chemical'], power: { use: 120e3 },
  desc: 'Reactores de inoxidable con intercambiadores. Ácidos, amoniaco, plástico, caucho y la conversión del uranio; consume 120 kW.' });
S('refinery', 'Refinería', 'process', 4, 3, 'refinery', 'refinery', {
  cost: { heat_exchanger: 3, stainless_plate: 16, steel_frame: 4, steel_pipe: 12, valve: 8, circuit_advanced: 2, pump_mechanism: 2, concrete: 20 }, buildTime: 20, hp: 1800, complexity: 4, types: ['refining'], power: { use: 150e3 }, light: LAMP(3, '#ffb060', 0.3),
  desc: 'Torre de fraccionamiento y craqueador catalítico. Rendimiento completo del crudo con lubricante y betún; consume 150 kW.' });
S('electrolyzer', 'Electrolizador', 'process', 4, 2, 'electrolyzer', 'electrolyzer', {
  cost: { graphite_electrode: 4, stainless_plate: 8, steel_frame: 2, circuit_advanced: 2, aluminium_wire: 8, plastic: 4 }, buildTime: 15, hp: 1000, complexity: 3, types: ['electrolysis'], power: { use: 200e3 },
  desc: 'Celdas con electrodos de grafito. Hidrógeno, cloro, aluminio, litio y zinc electrolítico; consume 200 kW o más según el proceso.' });
S('centrifuge', 'Centrifugadora', 'process', 4, 2, 'centrifuge', 'centrifuge', {
  cost: { motor: 2, bearing: 8, stainless_plate: 8, steel_frame: 2, circuit_advanced: 2, aluminium_plate: 4 }, buildTime: 14, hp: 900, complexity: 3, types: ['centrifuge'], power: { use: 100e3 },
  desc: 'Rotor de alta velocidad sobre rodamientos. Separa aire, salmuera de deuterio y concentrados de platino; consume 100 kW.' });
S('compressor', 'Compresor', 'process', 4, 1, 'compressor', 'compressor', {
  cost: { piston: 4, motor: 1, steel_pipe: 4, steel_plate: 6, valve: 2, circuit_advanced: 1 }, buildTime: 10, hp: 700, complexity: 3, types: ['compressing'], power: { use: 60e3 },
  desc: 'Compresor alternativo de varias etapas. Aire comprimido y diamante sintético a alta presión; consume 60 kW.' });
S('arc_furnace', 'Horno de arco', 'process', 5, 3, 'arc_furnace', 'arc', {
  cost: { graphite_electrode: 8, refractory_brick: 40, steel_frame: 4, transformer_core: 4, stainless_plate: 16, circuit_advanced: 4, heat_exchanger: 2 }, buildTime: 24, hp: 2000, complexity: 4, types: ['arc'], power: { use: 1.2e6 }, light: LAMP(4, '#dfe8ff', 0.8),
  desc: 'Cuba refractaria con tres electrodos de grafito. Titanio, tungsteno, molibdeno, torio e iridio; consume 1,2 MW o más.',
  lore: 'El arco se oye a medio estrato. A oscuras, el reflejo en las paredes parece un relámpago detenido.' });
S('vacuum_furnace', 'Horno de vacío', 'process', 5, 2, 'vacuum_furnace', 'vacuum', {
  cost: { steel_frame: 2, refractory_brick: 24, stainless_plate: 12, pump_mechanism: 2, aluminium_wire: 12, circuit_advanced: 3, heat_exchanger: 1 }, buildTime: 22, hp: 1400, complexity: 4, types: ['vacuum'], power: { use: 800e3 },
  desc: 'Cámara evacuada con calentamiento por inducción. Carburo, superaleaciones, imanes de neodimio y obleas puras; consume 800 kW.' });
S('fabricator', 'Fabricador de precisión', 'process', 5, 2, 'fabricator', 'fabricator', {
  cost: { titanium_frame: 2, motor: 4, circuit_advanced: 6, sensor: 4, titanium_gear: 4, fiber_optic: 4, tungsten_wire: 4 }, buildTime: 24, hp: 1400, complexity: 4, types: ['fabrication'], power: { use: 500e3 },
  desc: 'Sala limpia con litografía y micromecanizado. Procesadores, emisores láser, puntas de carburo y componentes nucleares; consume 500 kW.' });
S('enrichment_centrifuge', 'Cascada de enriquecimiento', 'process', 6, 3, 'enrichment_centrifuge', 'enrichment', {
  cost: { motor: 12, bearing: 24, stainless_plate: 24, titanium_frame: 4, processor: 6, titanium_pipe: 8, lead_plate: 12 }, buildTime: 35, hp: 2400, complexity: 4, types: ['enrichment'], power: { use: 2e6 },
  desc: 'Cascada de centrifugadoras de gas en serie. Separa UF6 enriquecido de las colas empobrecidas; consume 2 MW.' });
S('fuel_fabricator', 'Fabricador de combustible nuclear', 'process', 6, 2, 'fuel_fabricator', 'fabricator', {
  cost: { titanium_frame: 2, stainless_plate: 12, lead_plate: 16, processor: 4, sensor: 4, motor: 2, titanium_pipe: 4 }, buildTime: 30, hp: 1800, complexity: 4, types: ['nuclear_fab'], power: { use: 300e3 },
  desc: 'Celda blindada con manipuladores. Pastillas, barras de combustible, MOX, reprocesamiento y cría de tritio; consume 300 kW.' });
S('cryo_plant', 'Planta criogénica', 'process', 6, 2, 'cryo_plant', 'cryo', {
  cost: { heat_exchanger: 4, titanium_pipe: 12, titanium_frame: 3, motor: 4, processor: 3, pump_mechanism: 2, stainless_plate: 12 }, buildTime: 30, hp: 1800, complexity: 4, types: ['cryo'], power: { use: 1.5e6 },
  desc: 'Ciclo de expansión en cascada. Nitrógeno e hidrógeno líquidos, deuterio y las pastillas de fusión; consume 1,5 MW.' });
S('nano_forge', 'Nanoforja', 'process', 7, 3, 'nano_forge', 'nano', {
  cost: { titanium_frame: 6, laser_emitter: 6, processor: 8, superalloy_plate: 16, thermal_plate: 12, lithium_cell: 8, heat_exchanger: 4, fiber_optic: 8, tungsten_plate: 8 }, buildTime: 45, hp: 3000, complexity: 5, heatproof: true, types: ['quantum'], power: { use: 25e6 }, light: LAMP(4, '#8fd0ff', 0.7),
  desc: 'Cámara de deposición atómica con haces múltiples. Grafeno, nanotubos, superconductores y la aleación del núcleo; consume 25 MW.',
  lore: 'No fabrica: ordena. Átomo a átomo, hasta que la materia se rinde y se queda quieta.' });
S('matter_assembler', 'Ensamblador cuántico', 'process', 7, 3, 'matter_assembler', 'quantum', {
  cost: { core_frame: 4, quantum_processor: 6, nanotube: 24, superconductor_wire: 24, plasma_cell: 2, motor: 8, thermal_plate: 8 }, buildTime: 50, hp: 3400, complexity: 5, heatproof: true, types: ['quantum'], power: { use: 40e6 }, light: LAMP(4, '#b28cff', 0.8),
  desc: 'Manipulador de campo para ensamblaje a escala molecular. Procesadores cuánticos, bobinas de confinamiento e inyectores; consume 40 MW.',
  lore: 'Las piezas no se tocan: se convencen de encajar.' });

/* ── power ── */
S('water_wheel', 'Rueda hidráulica', 'power', 1, 2, 'water_wheel', 'waterwheel', {
  cost: { wood_frame: 3, wooden_gear: 4, plank: 16, bronze_gear: 2, rope: 6 }, buildTime: 6, hp: 500, complexity: 2, needsWater: true, power: { gen: 4e3 },
  desc: 'Rueda de cangilones junto a un curso de agua. 4 kW mecánicos constantes por eje de transmisión.' });
S('windmill', 'Molino de viento', 'power', 1, 2, 'windmill', 'windmill', {
  cost: { wood_frame: 3, wooden_gear: 4, plank: 20, cloth: 6, rope: 8 }, buildTime: 6, hp: 450, complexity: 2, surfaceOnly: true, power: { gen: 2.5e3, source: 'wind' },
  desc: 'Aspas de tela sobre torre de madera. 2,5 kW mecánicos en superficie; más con tormenta, que también lo desgasta.' });
S('steam_engine', 'Máquina de vapor', 'power', 2, 2, 'steam_engine', 'steam', {
  cost: { boiler: 1, piston: 2, iron_frame: 2, iron_plate: 10, bronze_gear: 4, valve: 2, brick: 16 }, buildTime: 6, hp: 700, complexity: 3, power: { gen: 60e3, fuel: FUEL_STEAM, fluidIn: { water: 0.2 } },
  desc: 'Caldera y cilindro con volante. 60 kW quemando carbón, coque, carbón vegetal, turba o troncos, con 0,2 agua/s por tubería.',
  lore: 'El primer silbato de vapor cambió el ritmo de la colonia. Desde entonces nadie duerme del todo.' });
S('coal_plant', 'Central térmica', 'power', 3, 3, 'coal_plant', 'boiler', {
  cost: { boiler: 3, dynamo: 2, steel_frame: 4, steel_pipe: 8, brick: 40, circuit_basic: 2, concrete: 16 }, buildTime: 15, hp: 1800, complexity: 3, power: { gen: 400e3, fuel: ['coal', 'coke'], fluidIn: { water: 0.8 } },
  desc: 'Calderas acuotubulares y turbina de vapor con dinamo. 400 kW con carbón o coque y 0,8 agua/s.' });
S('diesel_generator', 'Generador diésel', 'power', 4, 2, 'diesel_generator', 'generator_diesel', {
  cost: { dynamo: 2, piston: 4, steel_frame: 3, steel_pipe: 4, circuit_advanced: 1, valve: 2 }, buildTime: 12, hp: 1000, complexity: 3, power: { gen: 1.5e6, fuel: ['diesel', 'kerosene', 'biofuel', 'ethanol'] },
  desc: 'Motor de combustión interna acoplado a dinamo. 1,5 MW con diésel, queroseno, biocombustible o etanol tomados de la red de tuberías.' });
S('gas_turbine', 'Turbina de gas', 'power', 4, 3, 'gas_turbine', 'turbine', {
  cost: { turbine: 2, dynamo: 3, steel_frame: 4, transformer_core: 1, stainless_plate: 12, circuit_advanced: 2, steel_pipe: 6 }, buildTime: 18, hp: 1600, complexity: 4, power: { gen: 3e6, fuel: ['natural_gas', 'hydrogen'] },
  desc: 'Turbina de ciclo abierto con cámara de inoxidable. 3 MW quemando gas natural o hidrógeno por tubería.' });
S('solar_panel', 'Panel solar', 'power', 4, 1, 'solar_panel', '-', {
  cost: { silicon_wafer: 4, glass: 4, aluminium_plate: 2, copper_wire: 4, circuit_advanced: 1 }, buildTime: 6, hp: 300, surfaceOnly: true, power: { gen: 80e3, source: 'solar' },
  desc: 'Módulo fotovoltaico de silicio. Hasta 80 kW según la luz del día; casi nada con lluvia o tormenta.' });
S('geothermal_plant', 'Central geotérmica', 'power', 4, 3, 'geothermal_plant', 'turbine', {
  cost: { turbine: 3, dynamo: 3, heat_exchanger: 3, steel_frame: 6, basalt_slab: 20, steel_pipe: 12, transformer_core: 2, circuit_advanced: 2, concrete: 24 }, buildTime: 24, hp: 2200, complexity: 4, needsVent: true, power: { gen: 5e6 }, light: LAMP(3, '#ff9a50', 0.4),
  desc: 'Turbina de ciclo binario sobre una fumarola del abismo. 5 MW constantes sin combustible.' });
S('battery', 'Acumulador', 'power', 3, 1, 'battery', '-', {
  cost: { battery_cell: 4, steel_plate: 2, copper_wire: 4 }, buildTime: 6, hp: 400, power: { store: 50e6 },
  desc: 'Banco de celdas de plomo. Almacena 50 MJ del excedente de la red y los devuelve en los picos.' });
S('capacitor_bank', 'Banco de condensadores', 'power', 5, 2, 'capacitor_bank', 'electric_hum', {
  cost: { capacitor: 40, transformer_core: 4, aluminium_plate: 16, lithium_cell: 8, steel_frame: 4, processor: 1 }, buildTime: 18, hp: 1200, complexity: 3, power: { store: 5e9 },
  desc: 'Matriz de condensadores y celdas de litio. Almacena 5 GJ con respuesta instantánea.' });
S('fission_reactor', 'Reactor de fisión', 'power', 6, 3, 'fission_reactor', 'reactor', {
  cost: { reactor_vessel: 1, control_rod: 8, heat_exchanger: 6, turbine: 4, dynamo: 4, processor: 8, titanium_pipe: 16, reinforced_concrete: 80, lead_plate: 24, transformer_core: 4 }, buildTime: 45, hp: 4000, complexity: 5,
  power: { gen: 150e6, fuel: ['fuel_rod', 'mox_rod', 'thorium_fuel'], fluidIn: { water: 5 }, waste: { spent_fuel: 1 }, cooling: 'cooling_tower' }, light: LAMP(4, '#8fd0ff', 0.6),
  desc: 'Reactor de agua a presión con turbinas. 150 MW con barras de uranio, MOX o torio y 5 agua/s; devuelve una barra gastada por cada una consumida. Sin torre de refrigeración adyacente rinde la mitad y se desgasta cinco veces más.',
  lore: 'El primer megavatio nuclear se celebró en silencio. Todo el mundo miraba los indicadores.' });
S('cooling_tower', 'Torre de refrigeración', 'power', 6, 2, 'cooling_tower', 'steam', {
  cost: { reinforced_concrete: 40, heat_exchanger: 2, titanium_pipe: 8, pump_mechanism: 2, motor: 2, steel_frame: 4 }, buildTime: 20, hp: 2000, complexity: 3, power: { fluidIn: { water: 2 } },
  desc: 'Torre hiperbólica de tiro natural. Evacúa el calor de un reactor adyacente consumiendo 2 agua/s mientras este funciona.' });
S('fusion_reactor', 'Reactor de fusión', 'power', 7, 3, 'fusion_reactor', 'fusion', {
  cost: { containment_coil: 8, plasma_injector: 4, core_frame: 8, quantum_processor: 8, superconductor_wire: 64, thermal_plate: 32, turbine: 8, dynamo: 8, heat_exchanger: 12, reinforced_concrete: 120 }, buildTime: 60, hp: 4000, complexity: 5, heatproof: true,
  power: { gen: 2e9, fuel: ['fusion_pellet', 'he3_pellet'] }, light: LAMP(6, '#c0e8ff', 1),
  desc: 'Tokamak con bobinas superconductoras y manta térmica. 2 GW con pastillas de deuterio-tritio o helio-3; resiste el calor del núcleo.',
  lore: 'Una estrella de bolsillo, encendida a treinta horas y cinco estratos de la superficie. Aquí termina el descenso y empieza otra cosa.' });

/* ── research ── */
S('study_table', 'Mesa de estudio', 'research', 0, 1, 'study_table', 'lab', {
  cost: { plank: 8, cloth: 2, stick: 4 }, buildTime: 3, hp: 250, types: ['research'], lab: { tier: 0 },
  desc: 'Mesa con muestras, corteza y carboncillo. Compila saber primitivo y sostiene la investigación de la edad de piedra.' });
S('lab_basic', 'Laboratorio', 'research', 2, 2, 'lab_basic', 'lab', {
  cost: { plank: 16, glass: 6, copper_wire: 8, iron_plate: 6, circuit_basic: 2, cloth: 4 }, buildTime: 8, hp: 600, complexity: 2, types: ['research'], lab: { tier: 1 }, power: { use: 10e3 },
  desc: 'Gabinete con banco de ensayos y galvanómetros. Ciencia básica e industrial; investiga tecnologías hasta nivel 1; consume 10 kW.',
  lore: 'Vidrio, hilo de cobre y una pizarra. Con menos se han derribado imperios.' });
S('lab_industrial', 'Laboratorio industrial', 'research', 4, 3, 'lab_industrial', 'lab', {
  cost: { steel_frame: 4, glass: 12, circuit_advanced: 6, sensor: 2, transformer_core: 1, plastic: 8, concrete: 16 }, buildTime: 18, hp: 1400, complexity: 3, types: ['research'], lab: { tier: 2 }, power: { use: 200e3 },
  desc: 'Nave con campanas de extracción y sala de instrumentos. Ciencia química y nuclear; tecnologías hasta nivel 2; consume 200 kW.' });
S('lab_quantum', 'Laboratorio cuántico', 'research', 6, 3, 'lab_quantum', 'quantum', {
  cost: { titanium_frame: 6, processor: 12, superconductor_wire: 8, fiber_optic: 8, lithium_cell: 6, sensor: 6, reinforced_concrete: 30, heat_exchanger: 2 }, buildTime: 35, hp: 2400, complexity: 4, types: ['research'], lab: { tier: 3 }, power: { use: 5e6 }, light: LAMP(3, '#b28cff', 0.5),
  desc: 'Cámara aislada con criostato y computación superconductora. Ciencia cuántica; cualquier tecnología; consume 5 MW.',
  lore: 'Trabaja a diez milikelvin sobre un océano de magma. Los ingenieros llaman a eso equilibrio.' });

/* ── defense ── */
S('palisade', 'Empalizada', 'defense', 0, 1, 'wall', '-', {
  cost: { stick: 4, plank: 2 }, buildTime: 2, hp: 150, wall: true,
  desc: 'Estacas afiladas atadas. 150 de integridad; desvía a la fauna hacia otro camino.' });
S('stone_wall', 'Muro de piedra', 'defense', 1, 1, 'wall', '-', {
  cost: { stone: 6 }, buildTime: 3, hp: 500, wall: true,
  desc: 'Mampostería en seco. 500 de integridad.' });
S('steel_wall', 'Muro de acero', 'defense', 3, 1, 'wall', '-', {
  cost: { steel_plate: 3, concrete: 2 }, buildTime: 4, hp: 2000, wall: true,
  desc: 'Placas de acero sobre zócalo de hormigón. 2.000 de integridad.' });
S('titanium_wall', 'Muro de titanio', 'defense', 5, 1, 'wall', '-', {
  cost: { titanium_plate: 3, reinforced_concrete: 2 }, buildTime: 5, hp: 6000, wall: true,
  desc: 'Panel de titanio sobre hormigón armado. 6.000 de integridad.' });
S('thermal_wall', 'Muro blindado térmico', 'defense', 7, 1, 'wall', '-', {
  cost: { thermal_plate: 2, basalt_slab: 2, core_alloy: 1 }, buildTime: 8, hp: 20000, wall: true, heatproof: true,
  desc: 'Losa de basalto revestida de placa térmica y aleación del núcleo. 20.000 de integridad; resiste el calor del núcleo.' });
S('watchtower', 'Torre de vigía', 'defense', 0, 1, 'watchtower', 'turret_charge', {
  cost: { plank: 10, stick: 6, rope: 4 }, buildTime: 4, hp: 300, turret: { range: 5, dmg: 6, rate: 1, dmgType: 'kinetic', ap: false, ammo: { arrow: 1 } },
  desc: 'Atalaya de madera con arquero. Alcance 5, 6 de daño por flecha, un disparo por segundo.',
  lore: 'La primera noche con lobos se pasó a flechazos desde este tablado.' });
S('ballista', 'Balista', 'defense', 1, 2, 'ballista', 'turret_charge', {
  cost: { wood_frame: 2, plank: 12, rope: 8, iron_rod: 4, bronze_gear: 2 }, buildTime: 6, hp: 500, complexity: 2, turret: { range: 7, dmg: 30, rate: 0.4, dmgType: 'kinetic', ap: false, ammo: { ballista_bolt: 1 } },
  desc: 'Arco de torsión sobre afuste giratorio. Alcance 7, 30 de daño por virote cada 2,5 s.' });
S('cannon_turret', 'Torreta de cañón', 'defense', 3, 2, 'cannon_turret', 'turret_charge', {
  cost: { steel_frame: 1, steel_plate: 8, steel_gear: 2, mechanism: 1, circuit_basic: 1 }, buildTime: 10, hp: 900, complexity: 3, turret: { range: 8, dmg: 60, rate: 0.8, dmgType: 'kinetic', ap: false, ammo: { cannon_shell: 1 } }, power: { use: 10e3 },
  desc: 'Cañón de retrocarga con orientación eléctrica. Alcance 8, 60 de daño por proyectil; consume 10 kW.' });
S('gatling_turret', 'Torreta automática', 'defense', 4, 1, 'gatling_turret', 'turret_charge', {
  cost: { motor: 1, steel_plate: 6, steel_gear: 4, bearing: 2, circuit_advanced: 1, mechanism: 1 }, buildTime: 10, hp: 700, complexity: 3, turret: { range: 7, dmg: 12, rate: 6, dmgType: 'kinetic', ap: false, ammo: { bullet: 1 } }, power: { use: 30e3 },
  desc: 'Ametralladora rotativa con alimentación por cinta. Alcance 7, 12 de daño a seis disparos por segundo; consume 30 kW.' });
S('tesla_coil', 'Bobina Tesla', 'defense', 4, 1, 'tesla_coil', 'electric_hum', {
  cost: { transformer_core: 2, copper_wire: 24, resonator: 1, ceramic: 6, circuit_advanced: 1, capacitor: 4 }, buildTime: 12, hp: 600, complexity: 4, turret: { range: 4, dmg: 25, rate: 2, dmgType: 'electric', ap: false }, power: { use: 200e3 }, light: LAMP(3, '#a0c8ff', 0.5),
  desc: 'Resonador de alta tensión. Descarga 25 de daño eléctrico dos veces por segundo sobre todo lo que entra en un radio de 4; consume 200 kW.' });
S('laser_turret', 'Torreta láser', 'defense', 5, 1, 'laser_turret', 'turret_charge', {
  cost: { laser_emitter: 1, titanium_frame: 1, motor: 1, processor: 1, heat_exchanger: 1, sensor: 1 }, buildTime: 15, hp: 800, complexity: 4, turret: { range: 9, dmg: 45, rate: 2, dmgType: 'thermal', ap: false }, power: { use: 400e3 },
  desc: 'Emisor de rubí sobre montura estabilizada. Alcance 9, 45 de daño térmico dos veces por segundo; consume 400 kW.' });
S('plasma_turret', 'Torreta de plasma', 'defense', 7, 2, 'plasma_turret', 'turret_charge', {
  cost: { carbide_tip: 4, thermal_plate: 6, plasma_cell: 2, core_frame: 1, quantum_processor: 1, superconductor_wire: 8, laser_emitter: 1 }, buildTime: 30, hp: 2400, complexity: 5, heatproof: true, turret: { range: 10, dmg: 400, rate: 1, dmgType: 'plasma', ap: true }, power: { use: 8e6 }, light: LAMP(4, '#c06aff', 0.7),
  desc: 'Cañón de plasma magnéticamente confinado. Alcance 10, 400 de daño perforante por segundo, eficaz contra los entes del vacío; consume 8 MW.',
  lore: 'Lo único que detiene a lo que sale de las grietas. Cuando dispara, el estrato entero parpadea.' });

LD.Content.structures = defs;
})();
