(() => {
'use strict';
const LD = window.LD;
LD.Content = LD.Content || {};
const techs = [];
/* T(id, name, era, requires, cost, time, lab, structures, recipes, desc, hint) */
const T = (id, name, era, requires, cost, time, lab, structures, recipes, desc, hint) => {
  techs.push({ id, name, era, requires, cost, time, lab, unlocks: { structures, recipes }, desc, hint });
};

/* ── Era 0 · Edad de piedra (mesa de estudio, coste en materia prima o saber primitivo) ── */
T('stone_tools', 'Herramientas de piedra', 0, [], { stick: 12, stone: 10 }, 30, 0,
  ['mine_hand', 'clay_pit'], [],
  'Filos de sílex enmangados en vara y atados con cuerda: pico, azuela y raedera. Permite abrir la primera mina a cielo abierto y explotar la barrera de arcilla.',
  'Recoge varas del bosque y piedra de los afloramientos con la herramienta de mano y levanta una mina sobre un yacimiento de cobre o estaño.');
T('fire_charcoal', 'Fuego y carbón vegetal', 0, ['stone_tools'], { stick: 20, stone: 12, plant_fiber: 6 }, 45, 0,
  ['charcoal_pit', 'stone_furnace'], [],
  'Combustión controlada en fosa cubierta: la madera se carboniza sin arder y rinde carbón vegetal de 16 MJ. El horno de piedra funde cobre y estaño con ese carbón.',
  'Construye una carbonera junto al leñador y acumula carbón vegetal: la mesa de estudio lo convierte en saber primitivo.');
T('pottery', 'Alfarería', 0, ['fire_charcoal'], { rp0: 10, stone: 10 }, 45, 0,
  ['kiln'], [],
  'Cocción de arcilla a 900 °C en horno cerrado. Produce ladrillo para hornos mayores y cerámica para aislantes y piezas de fundición.',
  'Levanta el horno de alfarero cerca de la barrera de arcilla y cuece ladrillo: la forja de bronce necesita veinte.');
T('hunting', 'Caza y trampeo', 0, ['stone_tools'], { stick: 16, plant_fiber: 16 }, 40, 0,
  ['hunting_lodge'], [],
  'Trampas de lazo y arco corto en terreno silvestre. La cabaña de caza rinde piel, hueso y tendón de forma continua sin esperar a las manadas.',
  'Coloca la cabaña de caza junto a bosque y pradera libres para obtener piel, hueso y tendón sin depender de los lobos.');
T('tanning', 'Curtido', 0, ['hunting'], { hide: 6, plant_fiber: 12 }, 50, 0,
  ['tannery'], ['tanning_leather_water', 'workbench_bellows'],
  'Curtido vegetal de pieles con taninos de corteza y harina de hueso en pilas de agua. El cuero resultante se cose en fuelles y émbolos.',
  'Curte las pieles de la cabaña de caza: el cuero es imprescindible para los fuelles de la forja y la bomba manual.');
T('granary', 'Granero', 0, ['stone_tools'], { stick: 24, plant_fiber: 10 }, 40, 0,
  ['warehouse_wood'], [],
  'Almacén de tablón elevado sobre pilotes que protege el material de la humedad. Cada granero suma 200 unidades al tope de cada objeto en su estrato.',
  'Construye graneros junto al almacén central para elevar el tope de cada material por encima de 200.');

/* ── Era 1 · Edad del bronce (saber primitivo) ── */
T('bronze_working', 'Metalurgia del bronce', 1, ['fire_charcoal', 'pottery'], { rp0: 20 }, 60, 0,
  ['bronze_forge'], ['smelting_bronze'],
  'Aleación de cobre y estaño 3:1 fundida en forja de ladrillo con fuelles. El bronce es más duro que el cobre y se forja en placa, varilla y engranaje.',
  'Funde tres lingotes de cobre y uno de estaño en la forja de bronce; aliméntala con carbón vegetal.');
T('wind_power', 'Molino de viento', 1, ['bronze_working'], { rp0: 24 }, 70, 0,
  ['windmill', 'drive_shaft'], [],
  'Aspas de tela sobre bastidor de madera que mueven un eje vertical. Los ejes de transmisión reparten hasta 10 kW mecánicos a las máquinas de la era.',
  'Coloca molinos en superficie y tiende ejes de transmisión hasta las máquinas; con tormenta rinden un 60 % más.');
T('forging', 'Martinete', 1, ['wind_power'], { rp0: 30 }, 80, 0,
  ['trip_hammer'], ['forging_copper_plate', 'forging_bronze_plate', 'forging_bronze_rod', 'forging_bronze_gear', 'forging_copper_wire', 'workbench_mechanism'],
  'Mazo de leva accionado por eje que golpea el lingote caliente sobre yunque de piedra. Produce placas, varillas, hilo de cobre y engranajes de bronce.',
  'Conecta el martinete a un molino mediante ejes de transmisión y forja placas y engranajes de bronce.');
T('water_power', 'Rueda hidráulica', 1, ['forging'], { rp0: 30 }, 80, 0,
  ['water_wheel'], [],
  'Rueda de paletas sobre corriente con engranajes de bronce en el eje. Entrega 4 kW constantes, sin depender del viento ni del combustible.',
  'Construye la rueda tocando una casilla de agua: 4 kW estables, más fiables que el molino.');
T('sawmill', 'Aserradero', 1, ['forging'], { rp0: 30 }, 80, 0,
  ['sawmill'], ['sawing_plank', 'sawing_stick', 'sawing_wooden_gear', 'sawing_wood_frame'],
  'Sierra alternativa de placa de cobre movida por eje. Cuadruplica el rendimiento en tablón frente al corte a mano y produce bastidores con resina.',
  'Alimenta el aserradero con troncos del leñador: cuatro tablones por tronco en lugar de dos.');
T('millstone', 'Molino de piedra', 1, ['forging'], { rp0: 36 }, 90, 0,
  ['millstone'], ['crushing_copper_mill', 'crushing_tin_mill', 'crushing_iron_mill', 'crushing_bone_meal', 'smelting_copper', 'smelting_tin', 'smelting_bronze_direct'],
  'Muela giratoria de piedra sobre solera fija. Tritura la mena antes de fundirla: dos menas rinden tres de mena triturada.',
  'Muele la mena antes de fundirla: dos menas dan tres de triturada y el horno las funde una a una.');
T('iron_working', 'Hierro forjado', 1, ['forging'], { rp0: 40 }, 100, 0,
  ['mine_gallery'], ['smelting_iron_ore', 'smelting_iron', 'forging_iron_plate', 'forging_iron_rod', 'forging_iron_gear', 'workbench_iron_frame', 'workbench_mechanism_iron'],
  'Reducción de mena de hierro en forja con fuelle y carbón vegetal. El hierro forjado permite bastidores y mecanismos rígidos y minas de galería entibadas.',
  'Funde mena de hierro en la forja de bronce y abre minas de galería sobre vetas de dureza 1.');
T('bronze_plumbing', 'Tuberías de bronce', 1, ['forging', 'tanning', 'iron_working'], { rp0: 30 }, 80, 0,
  ['pipe_bronze', 'pump_hand'], ['forging_bronze_pipe', 'workbench_valve'],
  'Tubo de bronce forjado sobre mandril, estanco a 8 unidades/s, y válvula de asiento de placa de bronce y varilla de hierro. La bomba de émbolo con cuero eleva agua de lagos y ríos.',
  'Sustituye las canalizaciones de madera por tubería de bronce y coloca bombas manuales junto al agua.');
T('stone_masonry', 'Cantería', 1, ['pottery'], { rp0: 24 }, 70, 0,
  ['stone_wall', 'warehouse_stone'], [],
  'Sillares de piedra asentados con mortero de arcilla. El muro de piedra resiste 500 puntos y el almacén de piedra guarda 600 unidades por objeto.',
  'Rodea la base con muro de piedra y sustituye los graneros por almacenes de piedra.');
T('ballista', 'Balista', 1, ['iron_working'], { rp0: 40 }, 100, 0,
  ['ballista'], ['ammo_ballista_bolt'],
  'Arco de torsión sobre bastidor de madera con engranajes de bronce. Lanza virotes de varilla de hierro de 30 puntos de daño a 7 casillas.',
  'Fabrica virotes con varilla de hierro y tablón en la mesa de trabajo; la balista detiene jabalíes y osos.');
T('surface_extraction', 'Arenero y turbera', 1, ['pottery'], { rp0: 20 }, 60, 0,
  ['sand_pit', 'peat_cutter'], ['smelting_glass'],
  'Explotación de arena de playa y turba de humedal con pala y criba. La arena fundida a 1400 °C da vidrio; la turba es un combustible pobre pero inmediato.',
  'Coloca el arenero sobre arena y la turbera sobre turbera; funde arena en el horno de piedra para obtener vidrio.');
T('salt_works', 'Salinas', 1, ['bronze_plumbing'], { rp0: 24 }, 70, 0,
  ['salt_works'], [],
  'Balsas de evaporación sobre salar alimentadas con agua por tubería. La sal es la base del refrigerante y de la salmuera electrolítica.',
  'Construye las salinas sobre salar y conéctalas con tubería a un pozo de agua.');
T('fiber_farming', 'Agricultura de fibra', 1, ['bronze_plumbing'], { rp0: 30 }, 80, 0,
  ['fiber_farm', 'planter'], [],
  'Cultivo de lino y cáñamo en bancales regados por tubería de bronce. El vivero replanta bosque en pradera libre para el leñador.',
  'El campo de fibra necesita agua por tubería; el vivero replanta bosque en las praderas próximas al leñador.');
T('forestry', 'Plantación forestal', 1, ['fiber_farming', 'sawmill'], { rp0: 40 }, 120, 0,
  ['tree_farm'], [],
  'Silvicultura intensiva en parcela de 3×3 con riego. Produce 0,5 troncos/s sin depender del bosque natural ni de su lento rebrote.',
  'La plantación produce 0,5 troncos/s con agua por tubería; es la base de todo el suministro de madera.');

/* ── Era 2 · Era del vapor (ciencia básica, laboratorio) ── */
T('basic_science', 'Ciencia básica', 2, ['forestry', 'iron_working', 'millstone'], { rp0: 60 }, 120, 0,
  ['lab_basic'], ['smelting_solder_tin', 'workbench_circuit_basic', 'workbench_rp1', 'research_rp1'],
  'Método experimental con instrumental de vidrio y circuitos de estaño soldado. El laboratorio investiga a 10 kW y produce ciencia básica.',
  'Construye el laboratorio con circuitos básicos y produce ciencia básica con hilo de cobre, engranaje de bronce y tela.');
T('coking', 'Coque', 2, ['basic_science'], { rp1: 40 }, 120, 1,
  ['coke_oven'], ['kiln_coke'],
  'Destilación seca de la hulla en horno cerrado de ladrillo. Dos carbones rinden un coque de 30 MJ y alquitrán que sale por tubería.',
  'Explota una veta de carbón con la mina y carboniza dos carbones en un coque; recoge el alquitrán en un depósito.');
T('blast_furnace', 'Alto horno y acero', 2, ['coking'], { rp1: 60 }, 180, 1,
  ['blast_furnace'], ['blast_iron', 'blast_steel', 'blast_steel_direct', 'forging_steel_plate', 'forging_steel_rod', 'forging_steel_gear', 'forging_steel_pipe', 'workbench_steel_frame'],
  'Reducción continua de mena con coque y caliza en cuba de ladrillo a 1500 °C. El arrabio carburado se convierte en acero, el material estructural de la era.',
  'Sobrecarga el martinete (OC 1) para forjar las primeras placas de acero hasta disponer de martillo de vapor.');
T('pressure_vessels', 'Calderas y válvulas', 2, ['blast_furnace', 'bronze_plumbing'], { rp1: 60, steel_ingot: 8 }, 160, 1,
  ['tank_iron'], ['workbench_boiler', 'forging_piston'],
  'Recipientes de placa de acero remachada con pistones estancos. La caldera genera vapor a presión para toda la maquinaria de la era.',
  'Ensambla calderas con placa de acero, tubo de acero, válvulas y ladrillo; el depósito de hierro guarda 2000 unidades.');
T('steam_power', 'Máquina de vapor', 2, ['pressure_vessels'], { rp1: 80 }, 200, 1,
  ['steam_engine', 'cable_copper', 'lamp'], ['workbench_insulated_wire'],
  'Cilindro de doble efecto acoplado a una dinamo primitiva: 60 kW con carbón y agua. El hilo aislado con tela y resina permite cables de 300 kW y faroles.',
  'Alimenta la máquina con carbón y agua por tubería y reparte los 60 kW con cable de cobre.');
T('steam_forging', 'Martillo de vapor', 2, ['steam_power'], { rp1: 70 }, 180, 1,
  ['steam_hammer'], ['forging_drill_head'],
  'Martillo pilón de pistón con caldera propia. Forja a nivel 2 sin sobrecarga y produce cabezales de perforación de acero endurecido.',
  'El martillo de vapor forja acero a nivel 2 sin sobrecarga; fabrica cabezales de perforación para las máquinas de minado.');
T('crushing', 'Trituradora', 2, ['steam_power'], { rp1: 70 }, 180, 1,
  ['crusher'], ['crushing_copper', 'crushing_tin', 'crushing_iron'],
  'Mandíbulas de acero accionadas por mecanismo excéntrico. Dobla la mena: cada unidad rinde dos de mena triturada.',
  'La trituradora dobla la mena: una mena da dos de triturada, el doble que el molino de piedra.');
T('iron_logistics', 'Cintas de hierro', 2, ['basic_science'], { rp1: 50 }, 120, 1,
  ['conveyor_iron'], [],
  'Banda sobre rodillos de placa de hierro con engranajes de madera. Transporta 8 objetos/s, cuatro veces más que los rodillos de madera.',
  'Sustituye los rodillos de madera por cinta de hierro en las líneas saturadas.');
T('steam_drilling', 'Perforadora de vapor', 2, ['steam_forging'], { rp1: 80 }, 200, 1,
  ['drill_steam'], [],
  'Torre de perforación con pistón de vapor y cabezal de acero. Extrae yacimientos de dureza 2 a 0,8 unidades/s por casilla.',
  'Perfora yacimientos de dureza 2 con caldera, carbón y agua por tubería.');
T('mining_shaft', 'Pozo minero', 2, ['steam_drilling', 'iron_logistics'], { rp1: 120, iron_ingot: 20 }, 300, 1,
  ['shaft_coal'], [],
  'Pozo vertical entibado con bastidor de hierro y jaula de cuerda hasta las cuevas someras. El pozo transmite fuerza y fluidos y coloca un elevador en el centro del estrato.',
  'Hunde el pozo minero para abrir las cuevas someras: carbón, caliza, azufre, salitre y petróleo.');
T('steam_boring', 'Tuneladora de vapor', 2, ['mining_shaft'], { rp1: 100 }, 240, 1,
  ['borer_steam'], [],
  'Cabeza rotatoria de cabezales de acero movida por caldera. Excava 2 casillas/s de roca de dureza 1 y recupera piedra y grava.',
  'Baja una tuneladora al estrato 1 y colócala tocando el borde de un bloque sin excavar.');
T('cave_minerals', 'Cal y pólvora', 2, ['mining_shaft'], { rp1: 80 }, 180, 1,
  [], ['kiln_quicklime', 'kiln_cement', 'crushing_black_powder', 'workbench_fertilizer'],
  'Calcinación de caliza en cal viva y mezcla de carbón, azufre y salitre en proporción 1:1:2. La cal da cemento; el salitre, pólvora y fertilizante.',
  'Cuece caliza en cal viva y muele carbón vegetal, azufre y salitre para obtener pólvora.');

/* ── Era 3 · Era eléctrica (ciencia industrial) ── */
T('industrial_science', 'Ciencia industrial', 3, ['steam_power', 'blast_furnace'], { rp1: 120 }, 180, 1,
  [], ['research_rp2'],
  'Normalización de medidas y ensayo de materiales con instrumental de acero y vidrio. El laboratorio produce ciencia industrial.',
  'Combina placa de acero, circuito básico y vidrio en el laboratorio para producir ciencia industrial.');
T('electromagnetism', 'Electromagnetismo', 3, ['industrial_science'], { rp2: 80, copper_wire: 24 }, 240, 1,
  ['assembler'], ['assembling_magnet', 'assembling_electromagnet', 'assembling_motor', 'assembling_dynamo', 'assembling_circuit_basic', 'assembling_steel_frame'],
  'Inducción en bobinas de hilo de cobre sobre núcleo de hierro. La ensambladora fabrica imanes, electroimanes, motores y dinamos.',
  'La ensambladora fabrica motores y dinamos: la base de toda máquina eléctrica y de la central térmica.');
T('machining', 'Torno y prensa', 3, ['electromagnetism'], { rp2: 100 }, 240, 1,
  ['press', 'lathe'], ['pressing_steel_plate', 'pressing_copper_plate', 'pressing_bronze_plate', 'pressing_iron_plate', 'pressing_brick', 'lathe_bearing', 'lathe_steel_rod', 'lathe_bronze_rod', 'lathe_iron_rod'],
  'Mecanizado con motor eléctrico: la prensa hidráulica lamina dos placas por ciclo y el torno produce varillas y rodamientos de precisión.',
  'La prensa dobla el rendimiento en placa frente a la forja; el torno fabrica rodamientos para las máquinas rotativas.');
T('wire_drawing', 'Trefiladora', 3, ['electromagnetism'], { rp2: 80 }, 200, 1,
  ['wiremill'], ['wiremill_copper_wire', 'wiremill_glass_fiber'],
  'Estirado del lingote a través de hileras calibradas. Cuatro hilos por lingote de cobre y fibra de vidrio fina a partir de vidrio fundido.',
  'La trefiladora saca cuatro hilos por lingote de cobre, el doble que el martinete.');
T('steel_logistics', 'Logística de acero', 3, ['electromagnetism'], { rp2: 100 }, 240, 1,
  ['conveyor_steel', 'elevator_steel', 'warehouse_steel'], [],
  'Cinta de placa de acero a 24 objetos/s, elevador motorizado de 20 objetos/s entre estratos y almacén de acero de 2500 unidades por objeto.',
  'Sustituye el elevador de cuerda por el de acero: cuatro veces más caudal entre el estrato y la superficie.');
T('steel_plumbing', 'Tuberías y bombas de acero', 3, ['electromagnetism'], { rp2: 100 }, 240, 1,
  ['pipe_steel', 'tank_steel', 'pump_electric'], ['assembling_pump_mechanism'],
  'Tubo de acero soldado para 40 unidades/s y tanque de 10 000 unidades. La bomba eléctrica de 6 kW eleva 8 unidades/s de agua.',
  'Tiende tubería de acero y coloca bombas eléctricas junto al agua para alimentar calderas y lavaderos.');
T('mixing', 'Mezcladora y hormigón', 3, ['steel_plumbing', 'cave_minerals'], { rp2: 100 }, 240, 1,
  ['mixer'], ['mixing_concrete', 'mixing_concrete_stone', 'mixing_coolant', 'assembling_reinforced_concrete'],
  'Tambor rotativo con paletas para mezclas húmedas. Cemento, árido y agua dan hormigón; con varilla de acero, hormigón armado; con sal, refrigerante.',
  'Mezcla cemento, grava, arena y agua en la mezcladora: el hormigón es la base del pozo profundo y las centrales.');
T('ore_washing', 'Lavado de mena', 3, ['mixing', 'crushing'], { rp2: 120 }, 300, 1,
  [], ['washing_copper', 'washing_tin', 'washing_iron', 'washing_zinc', 'washing_lead', 'washing_silver', 'washing_gold', 'washing_nickel',
       'smelting_purified_copper', 'smelting_purified_tin', 'smelting_purified_iron', 'smelting_purified_zinc', 'smelting_purified_lead', 'smelting_purified_silver', 'smelting_purified_gold', 'smelting_purified_nickel'],
  'Lavado de la mena triturada en la mezcladora con agua. Elimina la ganga y recupera trazas de otros metales: oro del cobre, plata del plomo, cobalto del níquel.',
  'Lava la mena triturada en la mezcladora con agua por tubería: aparecen trazas de oro, plata y cobalto.');
T('electric_drilling', 'Perforación eléctrica', 3, ['machining'], { rp2: 140, motor: 2 }, 300, 1,
  ['drill_electric', 'borer_electric'], [],
  'Perforadora y tuneladora con motor eléctrico de 40 y 80 kW. Extraen dureza 3 y abren 4 casillas/s de roca en el estrato medio.',
  'Perfora a dureza 3 con la perforadora eléctrica; la tuneladora eléctrica excava el doble que la de vapor.');
T('deep_shaft', 'Pozo profundo', 3, ['electric_drilling', 'mixing'], { rp2: 200, motor: 4 }, 420, 1,
  ['shaft_deep'], ['crushing_zinc', 'crushing_lead', 'crushing_nickel', 'crushing_bauxite'],
  'Pozo de hormigón con jaula motorizada hasta la profundidad media. Abre el estrato de los metales no férreos, el cuarzo y el gas natural.',
  'Hunde el pozo profundo y baja tuneladoras eléctricas: zinc, plomo, níquel, bauxita, cuarzo y cromita.');
T('nonferrous_metallurgy', 'Metales no férreos', 3, ['deep_shaft'], { rp2: 120 }, 300, 1,
  [], ['smelting_zinc', 'smelting_lead', 'smelting_nickel', 'smelting_brass', 'smelting_solder', 'forging_lead_plate', 'pressing_lead_plate'],
  'Fundición de zinc, plomo y níquel a partir de mena triturada. El latón (cobre y zinc 3:1) da cartuchería; la soldadura de estaño y plomo, circuitos.',
  'Funde zinc y plomo del estrato medio: la soldadura de estaño y plomo cuadruplica el rendimiento de los circuitos.');
T('precious_metals', 'Metales preciosos', 3, ['nonferrous_metallurgy', 'wire_drawing'], { rp2: 140 }, 300, 1,
  [], ['crushing_silver', 'crushing_gold', 'smelting_silver', 'smelting_gold', 'smelting_electrum', 'wiremill_gold_wire', 'wiremill_gold_wire_electrum'],
  'Fundición de plata y oro de las vetas profundas y de las trazas del lavado. El hilo de oro no se oxida y es imprescindible en los circuitos avanzados.',
  'Trefila hilo de oro a partir de lingote de oro o electro: cada circuito avanzado necesita dos.');
T('electric_metallurgy', 'Horno eléctrico', 3, ['machining', 'deep_shaft'], { rp2: 140 }, 300, 1,
  ['electric_furnace'], ['smelting_silicon', 'lathe_silicon_wafer', 'smelting_glass_quartz'],
  'Horno de resistencias de hilo de cobre con cámara cerámica. Alcanza el nivel 3 de fundición: silicio a partir de cuarzo y coque, vidrio de cuarzo.',
  'Funde cuarzo y coque en el horno eléctrico para obtener silicio y córtalo en obleas en el torno.');
T('stainless_steel', 'Acero inoxidable', 3, ['electric_metallurgy', 'nonferrous_metallurgy'], { rp2: 160 }, 360, 1,
  [], ['crushing_chromite', 'crushing_manganese', 'smelting_chromium', 'smelting_manganese', 'blast_steel_manganese', 'smelting_stainless', 'forging_stainless_plate', 'pressing_stainless_plate', 'assembling_heat_exchanger'],
  'Reducción de cromita y manganeso con coque y aleación con acero y níquel. El inoxidable resiste los ácidos y forma los intercambiadores de calor.',
  'Funde seis de acero, dos de cromo y uno de níquel en el horno eléctrico: el inoxidable es la base de la industria química.');
T('distillation', 'Destilería', 3, ['steel_plumbing'], { rp2: 100 }, 240, 1,
  ['distillery'], ['distilling_tar', 'distilling_ethanol'],
  'Columna de destilación fraccionada con caldera y serpentín de cobre. Separa nafta y betún del alquitrán y fermenta fibra vegetal en etanol.',
  'Destila el alquitrán del horno de coque: la nafta es la materia prima del plástico.');
T('oil_pumping', 'Balancín petrolífero', 3, ['distillation', 'electric_drilling', 'mixing'], { rp2: 160 }, 360, 1,
  ['pumpjack'], ['distilling_crude', 'mixing_lubricant'],
  'Bomba de varillas sobre pozo entubado para las bolsas de crudo de las cuevas. La destilación del crudo rinde diésel, queroseno y alquitrán.',
  'Coloca el balancín sobre una bolsa de petróleo del estrato 1 y destila el crudo; con resina y diésel se mezcla lubricante.');
T('coal_power', 'Central térmica', 3, ['electromagnetism', 'steel_plumbing'], { rp2: 160, dynamo: 1 }, 360, 1,
  ['coal_plant'], [],
  'Tres calderas sobre dinamos con condensador de agua. 400 kW con carbón o coque y 0,8 unidades/s de agua por tubería.',
  'La central térmica rinde 400 kW: alimenta carbón por cinta y agua por tubería de acero.');
T('batteries', 'Acumuladores', 3, ['nonferrous_metallurgy'], { rp2: 120 }, 300, 1,
  ['battery'], ['assembling_battery_cell'],
  'Celda de plomo y ácido en vaso de vidrio con placa de cobre. El acumulador almacena 50 MJ y cubre los picos de demanda de la red.',
  'Ensambla celdas con placa de plomo, cobre y vidrio; los acumuladores absorben el excedente de la red.');
T('steel_defense', 'Artillería y muro de acero', 3, ['mixing', 'cave_minerals'], { rp2: 140 }, 300, 1,
  ['cannon_turret', 'steel_wall'], ['ammo_cannon_shell'],
  'Cañón de retrocarga con mecanismo de acero y proyectil de pólvora. Sesenta puntos de daño cinético a 8 casillas; el muro de acero resiste 2000.',
  'Fabrica proyectiles con lingote de acero y pólvora; la torreta de cañón necesita 10 kW por cable.');
T('bonsai', 'Bonsái industrial', 3, ['electromagnetism', 'forestry'], { rp2: 80 }, 240, 1,
  ['bonsai'], [],
  'Cultivo forzado en urna de vidrio con luz eléctrica y riego cerrado. 0,15 troncos/s en una sola casilla, apto para estratos sin bosque.',
  'Coloca bonsáis en las cuevas con agua y 200 W para tener madera sin subir troncos por el elevador.');

/* ── Era 4 · Era industrial (ciencia química, laboratorio industrial) ── */
T('chemistry', 'Planta química', 4, ['distillation', 'stainless_steel'], { rp2: 200, stainless_plate: 8 }, 300, 1,
  ['chemical_plant'], ['chemical_plastic', 'chemical_plastic_ethanol', 'chemical_plastic_chitin', 'chemical_rubber_synthetic'],
  'Reactores de inoxidable con intercambiadores de calor y bombas dosificadoras. Polimeriza nafta o etanol en plástico y vulcaniza nafta con azufre en caucho.',
  'Alimenta la planta química con nafta por tubería: el plástico y el caucho sintético abren la electrónica avanzada.');
T('advanced_circuits', 'Circuitos avanzados', 4, ['chemistry', 'precious_metals'], { rp2: 200, silicon_wafer: 8 }, 360, 1,
  [], ['assembling_circuit_advanced', 'wiremill_insulated_wire', 'assembling_transformer_core'],
  'Oblea de silicio sobre placa de plástico con pistas de hilo de oro. El cable aislado con caucho y el núcleo de transformador permiten redes de mayor potencia.',
  'Ensambla circuitos avanzados con dos básicos, una oblea, plástico e hilo de oro.');
T('instrumentation', 'Sensores y mantenimiento', 4, ['advanced_circuits'], { rp2: 200 }, 360, 1,
  ['maintenance_bay'], ['lathe_crystal_oscillator', 'assembling_sensor', 'assembling_resonator', 'assembling_fiber_optic'],
  'Oscilador de cuarzo tallado, resonador de amatista y fibra óptica de vidrio. El taller de mantenimiento repara automáticamente en un radio de 8.',
  'Talla cuarzo en osciladores y ensambla sensores; el taller de mantenimiento repara todo lo que hay a 8 casillas.');
T('compressed_air', 'Aire comprimido y ácidos', 4, ['advanced_circuits'], { rp2: 160 }, 300, 1,
  ['compressor'], ['compressing_air', 'chemical_sulfuric_acid_air', 'chemical_hydrochloric_acid_salt'],
  'Compresor de pistones que produce aire a presión sin insumos. Con azufre y agua rinde ácido sulfúrico; con sal, ácido clorhídrico.',
  'El compresor produce aire comprimido de la nada: con azufre y agua, la planta química lo convierte en ácido sulfúrico.');
T('chemical_science', 'Ciencia química', 4, ['compressed_air', 'batteries', 'instrumentation'], { rp2: 240, circuit_advanced: 4 }, 420, 1,
  ['lab_industrial'], ['research_rp3'],
  'Laboratorio de 200 kW con campanas de plástico y bancos de ensayo. Produce ciencia química a partir de plástico, ácido, circuito avanzado y celda.',
  'Construye el laboratorio industrial y produce ciencia química con plástico, ácido sulfúrico, circuito avanzado y celda de acumulador.');
T('electrolysis', 'Electrólisis', 4, ['chemical_science'], { rp3: 150 }, 360, 2,
  ['electrolyzer'], ['kiln_graphite', 'pressing_graphite_electrode', 'electrolysis_water', 'electrolysis_brine', 'electrolysis_zinc', 'chemical_sulfuric_acid', 'chemical_hydrochloric_acid'],
  'Cuba con electrodos de grafito prensado a 200 kW. Disocia el agua en hidrógeno y oxígeno y la salmuera en cloro e hidrógeno.',
  'Prensa grafito en electrodos y electroliza agua: el oxígeno da ácido sulfúrico puro y el hidrógeno alimenta la síntesis.');
T('aluminium', 'Aluminio', 4, ['electrolysis'], { rp3: 200 }, 420, 2,
  ['cable_hv'], ['chemical_alumina', 'chemical_alumina_sulfuric', 'electrolysis_aluminium', 'pressing_aluminium_plate', 'wiremill_aluminium_wire', 'assembling_capacitor', 'kiln_refractory_brick'],
  'Digestión de bauxita en ácido y reducción de la alúmina por electrólisis con electrodos de grafito. El aluminio da cable de alta tensión de 20 MW y condensadores.',
  'Digiere bauxita en ácido y electroliza la alúmina; el cable de alta tensión de aluminio transporta 20 MW.');
T('refining', 'Refinería', 4, ['chemical_science', 'oil_pumping'], { rp3: 180 }, 420, 2,
  ['refinery'], ['refining_crude'],
  'Torre de fraccionamiento con intercambiadores en inoxidable. Cada 10 de crudo rinden nafta, diésel, queroseno, lubricante y betún.',
  'La refinería saca de cada 10 de crudo 4 de nafta, 3 de diésel, 2 de queroseno y lubricante.');
T('diesel_power', 'Generador diésel', 4, ['refining'], { rp3: 200 }, 420, 2,
  ['diesel_generator'], [],
  'Motor de pistones de encendido por compresión acoplado a dos dinamos. 1,5 MW con diésel, queroseno, biocombustible o etanol por tubería.',
  'Conecta el generador a un tanque de diésel por tubería: 1,5 MW por unidad, quince veces la máquina de vapor.');
T('gas_extraction', 'Pozo de gas', 4, ['refining'], { rp3: 200 }, 420, 2,
  ['gas_well'], ['chemical_hydrogen_reforming'],
  'Cabezal de pozo con válvulas para las bolsas de gas natural de la profundidad media. El reformado con vapor convierte el gas en hidrógeno.',
  'Coloca el pozo de gas sobre una bolsa del estrato 2; el gas natural alimenta turbinas y se reforma en hidrógeno.');
T('gas_turbine', 'Turbina de gas', 4, ['gas_extraction', 'aluminium'], { rp3: 260 }, 480, 2,
  ['gas_turbine'], ['pressing_turbine_blade', 'assembling_turbine'],
  'Turbina de álabes prensados con rodamientos lubricados sobre tres dinamos. 3 MW con gas natural o hidrógeno.',
  'Prensa álabes y ensambla turbinas con lubricante; la turbina de gas rinde 3 MW con gas natural.');
T('nitrogen_chemistry', 'Química del nitrógeno', 4, ['electrolysis', 'compressed_air'], { rp3: 180 }, 420, 2,
  ['centrifuge'], ['centrifuge_air', 'chemical_ammonia', 'chemical_nitric_acid', 'chemical_nitric_acid_saltpeter', 'chemical_fertilizer'],
  'Separación del aire en centrifugadora y síntesis de amoniaco con hidrógeno a presión. El amoniaco oxidado da ácido nítrico y fertilizante.',
  'Centrifuga aire comprimido para obtener nitrógeno y sintetiza amoniaco con hidrógeno: la base del ácido nítrico.');
T('gatling', 'Torreta automática', 4, ['nitrogen_chemistry'], { rp3: 220 }, 420, 2,
  ['gatling_turret'], ['ammo_bullet', 'ammo_bullet_smokeless'],
  'Ametralladora de cañones rotativos con motor eléctrico. Seis disparos por segundo con cartucho de latón y pólvora o propelente sin humo.',
  'Fabrica cartuchos con latón y pólvora; con ácido nítrico y nafta, veinte cartuchos por lingote.');
T('tesla', 'Bobina Tesla', 4, ['instrumentation', 'aluminium'], { rp3: 260 }, 480, 2,
  ['tesla_coil'], [],
  'Transformador resonante con condensadores y resonador de amatista. Descarga eléctrica a todos los enemigos en 4 casillas: quiebra el cristal.',
  'La bobina Tesla golpea a todo lo que hay en 4 casillas y fractura a los gólems de cristal del estrato 2.');
T('excavation', 'Excavadora industrial', 4, ['electric_drilling', 'advanced_circuits'], { rp3: 280 }, 480, 2,
  ['excavator'], [],
  'Rotopala de 3×3 con cuatro motores y cabezales sobre rodamientos. Extrae yacimientos de dureza 4 a 2,5 unidades/s por casilla.',
  'La excavadora cubre nueve casillas y alcanza dureza 4: rutilo, wolframita y basalto del abismo.');
T('solar', 'Energía solar', 4, ['aluminium'], { rp3: 220 }, 420, 2,
  ['solar_panel'], [],
  'Célula fotovoltaica de oblea de silicio sobre vidrio y marco de aluminio. 80 kW de día en superficie, sin combustible; casi nada con lluvia.',
  'Cubre pradera libre con paneles solares: 80 kW cada uno de día, con acumuladores para la noche.');
T('algae', 'Cultivo de algas', 4, ['chemical_science'], { rp3: 160 }, 360, 2,
  ['algae_farm'], ['distilling_ethanol_algae', 'distilling_biofuel', 'chemical_coolant_glycol'],
  'Estanque de vidrio y hormigón con bomba de recirculación y fertilizante. Las algas se destilan en etanol y biocombustible con lubricante.',
  'El estanque de algas rinde 0,8 algas/s con agua y fertilizante; destílalas en biocombustible para el generador.');
T('greenhouse', 'Invernadero', 4, ['algae'], { rp3: 200 }, 420, 2,
  ['greenhouse'], ['chemical_rubber'],
  'Invernadero climatizado con sensores y riego. Produce fibra, látex y plantones; el látex vulcanizado con azufre da caucho natural.',
  'El invernadero produce látex por tubería y plantones: vulcaniza el látex con azufre para obtener caucho.');

/* ── Era 5 · Era avanzada (ciencia química, laboratorio industrial) ── */
T('abyss_shaft', 'Pozo abisal', 5, ['excavation', 'gas_turbine'], { rp3: 400, transformer_core: 2 }, 600, 2,
  ['shaft_abyss'], ['pressing_basalt_slab', 'smelting_glass_obsidian'],
  'Pozo de hormigón armado e inoxidable con transformadores e intercambiadores hasta el abismo basáltico. Abre el único estrato con titanio, wolframio, uranio y gemas.',
  'Hunde el pozo abisal y baja excavadoras: el basalto prensado en losas y la obsidiana fundida en vidrio son lo primero.');
T('arc_furnace', 'Horno de arco', 5, ['abyss_shaft'], { rp3: 350 }, 480, 2,
  ['arc_furnace'], ['arc_steel', 'arc_stainless', 'arc_silicon'],
  'Horno de 1,2 MW con electrodos de grafito y cámara refractaria. Funde a nivel 5: acero e inoxidable en masa y silicio directo de la arena.',
  'El horno de arco funde cuatro lingotes de acero por coque y silicio directamente de arena y coque.');
T('titanium', 'Titanio', 5, ['arc_furnace', 'electrolysis'], { rp3: 400 }, 540, 2,
  ['titanium_wall'], ['crushing_rutile', 'chemical_titanium_tetrachloride', 'arc_titanium', 'pressing_titanium_plate', 'pressing_titanium_pipe', 'lathe_titanium_rod', 'lathe_titanium_gear', 'assembling_titanium_frame'],
  'Cloración del rutilo con coque y reducción del tetracloruro en horno de arco. El titanio es ligero, inoxidable y resiste 6000 puntos en muro.',
  'Clora rutilo triturado en la planta química y reduce el tetracloruro en el horno de arco; el cloro se recupera.');
T('tungsten', 'Tungsteno', 5, ['titanium'], { rp3: 400, titanium_ingot: 8 }, 540, 2,
  [], ['crushing_wolframite', 'chemical_tungsten_oxide', 'arc_tungsten', 'pressing_tungsten_plate', 'lathe_tungsten_rod', 'wiremill_tungsten_wire'],
  'Lixiviación de la wolframita en ácido clorhídrico y reducción del óxido con hidrógeno en el arco. El tungsteno funde a 3400 °C: filamentos y placas térmicas.',
  'Disuelve wolframita en ácido clorhídrico y reduce el óxido con hidrógeno en el horno de arco.');
T('carbide', 'Horno de vacío y carburo', 5, ['tungsten'], { rp3: 450, tungsten_ingot: 8 }, 600, 2,
  ['vacuum_furnace'], ['vacuum_tungsten_carbide', 'vacuum_tungsten_carbide_direct', 'vacuum_diamond', 'compressing_diamond', 'vacuum_silicon_wafer'],
  'Sinterizado a presión reducida sin oxidación. Tungsteno y grafito dan carburo; el grafito con hidrógeno cristaliza en diamante sintético.',
  'Sinteriza tungsteno y grafito en el horno de vacío; el carburo con diamante forma las puntas de perforación láser.');
T('fabrication', 'Fabricador de precisión', 5, ['carbide', 'instrumentation'], { rp3: 500 }, 600, 2,
  ['fabricator'], ['fabrication_carbide_tip', 'lathe_crystal_lens'],
  'Célula de montaje con sensores y fibra óptica sobre bastidor de titanio. Fabrica puntas de carburo y lentes con tolerancias de micra.',
  'El fabricador une dos de carburo y un diamante en dos puntas de carburo; talla lentes con fragmentos de cristal.');
T('laser_drilling', 'Perforación láser', 5, ['fabrication'], { rp3: 550, carbide_tip: 4 }, 720, 2,
  ['drill_laser', 'borer_laser'], ['lathe_ruby', 'lathe_sapphire', 'lathe_diamond', 'lathe_crystal_lens_sapphire'],
  'Cabezal láser de fibra con puntas de carburo: extrae dureza 5 y excava 10 casillas/s de basalto. Talla rubí, zafiro y diamante en bruto.',
  'El taladro láser alcanza dureza 5: uranio, torio, platino, vanadio, monacita y gemas del abismo.');
T('processors', 'Procesadores', 5, ['fabrication'], { rp3: 500 }, 660, 2,
  [], ['chemical_hydrofluoric_acid', 'fabrication_processor'],
  'Grabado de obleas con ácido fluorhídrico de fluorita y encapsulado cerámico con hilo de oro. El procesador gobierna la maquinaria de nivel 5 y superior.',
  'Produce ácido fluorhídrico con fluorita y ácido sulfúrico; el fabricador graba procesadores con obleas y circuitos avanzados.');
T('lasers', 'Emisor láser', 5, ['laser_drilling', 'processors'], { rp3: 600, processor: 2 }, 780, 2,
  ['laser_turret'], ['fabrication_laser_emitter'],
  'Rubí tallado bombeado por condensadores y refrigerado por circuito cerrado. La torreta láser inflige 45 de daño térmico a 9 casillas sin munición.',
  'Fabrica emisores con rubí, lente, condensadores y sensor; la torreta láser funde la quitina de las cuevas.');
T('superalloys', 'Superaleaciones y placas térmicas', 5, ['fabrication'], { rp3: 500 }, 660, 2,
  [], ['crushing_cobalt', 'smelting_cobalt', 'crushing_molybdenite', 'arc_molybdenum', 'vacuum_superalloy', 'pressing_superalloy_plate', 'fabrication_thermal_plate', 'fabrication_thermal_plate_alloy'],
  'Aleación de níquel, cromo, cobalto y molibdeno sinterizada al vacío. Con tungsteno y cerámica, o glándula térmica, forma placas que soportan el calor del núcleo.',
  'Funde cobalto y molibdeno y sinteriza la superaleación; las placas térmicas blindan las máquinas del núcleo.');
T('titanium_logistics', 'Logística de titanio', 5, ['titanium'], { rp3: 400 }, 540, 2,
  ['conveyor_titanium', 'pipe_titanium', 'tank_titanium'], [],
  'Cinta sobre rodamientos a 80 objetos/s, tubería de titanio a 200 unidades/s y tanque de 60 000 unidades.',
  'Sustituye cintas y tuberías de acero por titanio en las líneas principales: más del triple de caudal.');
T('automated_logistics', 'Logística automatizada', 5, ['processors', 'titanium_logistics'], { rp3: 600 }, 720, 2,
  ['elevator_industrial', 'warehouse_auto'], [],
  'Elevador industrial de 80 objetos/s con ocho motores y almacén automatizado de 12 000 unidades gestionado por procesador.',
  'El elevador industrial mueve 80 objetos/s; el almacén automatizado guarda 12 000 unidades por objeto con 20 kW.');
T('lithium', 'Litio y condensadores', 5, ['processors', 'electrolysis'], { rp3: 550 }, 660, 2,
  ['capacitor_bank'], ['crushing_spodumene', 'electrolysis_lithium', 'assembling_lithium_cell'],
  'Electrólisis de espodumena en ácido clorhídrico y celda de litio y grafito. El banco de condensadores almacena 5 GJ para la red.',
  'Electroliza espodumena triturada para obtener litio; el banco de condensadores guarda cien veces más que los acumuladores.');
T('platinum', 'Platino y craqueo', 5, ['laser_drilling', 'nitrogen_chemistry', 'refining'], { rp3: 500 }, 660, 2,
  [], ['crushing_platinum', 'smelting_platinum', 'washing_platinum', 'smelting_purified_platinum', 'centrifuge_platinum', 'refining_cracking'],
  'Concentración de mena de platino por lavado y centrifugado con trazas de iridio y osmio. El platino cataliza el craqueo del queroseno en nafta.',
  'Extrae mena de platino con el taladro láser; con una pizca de platino la refinería craquea queroseno en nafta.');
T('vanadium', 'Vanadio', 5, ['laser_drilling'], { rp3: 450 }, 600, 2,
  [], ['crushing_vanadinite', 'smelting_vanadium', 'arc_titanium_alloy'],
  'Reducción de vanadinita con coque, que libera también plomo. La aleación Ti-6Al-4V rinde seis lingotes de titanio por cuatro.',
  'Funde vanadinita en el horno eléctrico y alea titanio con vanadio y aluminio en el arco: 50 % más de titanio.');
T('rare_earths', 'Tierras raras', 5, ['laser_drilling'], { rp3: 500 }, 660, 2,
  [], ['crushing_monazite', 'chemical_rare_earth_oxide', 'vacuum_neodymium_magnet', 'assembling_motor_neodymium'],
  'Digestión de monacita en ácido sulfúrico, que separa óxido de tierras raras y torita. El imán de neodimio triplica el rendimiento de los motores.',
  'Digiere monacita en ácido sulfúrico y sinteriza imanes de neodimio: tres motores por imán.');
T('geothermal', 'Central geotérmica', 5, ['abyss_shaft', 'titanium'], { rp3: 600 }, 780, 2,
  ['geothermal_plant'], ['assembling_turbine_titanium'],
  'Turbinas de titanio sobre fumarola con intercambiadores y cimentación de losa de basalto. 5 MW sin combustible en el abismo.',
  'Construye la central sobre una fumarola del estrato 3 con turbinas de titanio: 5 MW constantes.');
T('hydroponics', 'Bonsái hidropónico', 5, ['greenhouse', 'titanium_logistics'], { rp3: 350 }, 480, 2,
  ['bonsai_hydro'], [],
  'Cultivo en solución nutritiva con sensor y tubería de titanio. 0,6 troncos/s y resina en una sola casilla con 2 kW.',
  'Planta bonsáis hidropónicos con plantones del invernadero: cuatro veces la madera del bonsái industrial.');

/* ── Era 6 · Era nuclear (ciencia nuclear, laboratorio cuántico) ── */
T('uranium_processing', 'Procesado de uranio', 6, ['laser_drilling', 'processors'], { rp3: 500 }, 600, 2,
  [], ['crushing_uraninite', 'chemical_yellowcake', 'chemical_uf6'],
  'Lixiviación de uraninita en ácido sulfúrico hasta torta amarilla y fluoración con ácido fluorhídrico a hexafluoruro de uranio gaseoso.',
  'Tritura uraninita, lixívala en ácido sulfúrico y fluora la torta amarilla: el UF6 va a la cascada de enriquecimiento.');
T('enrichment', 'Enriquecimiento', 6, ['uranium_processing'], { rp3: 600 }, 720, 2,
  ['enrichment_centrifuge'], ['enrichment_uf6'],
  'Cascada de centrifugadoras de titanio a 2 MW que separa el isótopo fisible. Ocho de UF6 dan uno enriquecido y seis empobrecidos.',
  'La cascada consume ocho de UF6 por cada uno enriquecido; guarda el UF6 empobrecido para el uranio empobrecido.');
T('fuel_fabrication', 'Combustible nuclear', 6, ['enrichment'], { rp3: 650 }, 780, 2,
  ['fuel_fabricator'], ['nuclear_fab_uranium_pellet', 'nuclear_fab_depleted_uranium', 'nuclear_fab_fuel_rod', 'fabrication_control_rod', 'fabrication_reactor_vessel'],
  'Conversión del UF6 en pastillas de óxido y envainado en inoxidable. Ocho pastillas por barra; las barras de control de plata y cobalto regulan la reacción.',
  'Convierte UF6 enriquecido en pastillas y envaina ocho por barra; fabrica la vasija y las barras de control para el reactor.');
T('cryogenics', 'Criogenia', 6, ['nitrogen_chemistry', 'processors'], { rp3: 600 }, 720, 2,
  ['cryo_plant', 'tank_cryo'], ['cryo_liquid_nitrogen', 'cryo_air', 'cryo_liquid_hydrogen', 'cryo_cryo_coolant'],
  'Licuación de gases por expansión Joule-Thomson en planta de 1,5 MW. El tanque criogénico aislado conserva nitrógeno e hidrógeno líquidos.',
  'Licúa nitrógeno en la planta criogénica y guárdalo en tanques criogénicos: sin él no hay superconductores.');
T('nuclear_science', 'Ciencia nuclear', 6, ['fuel_fabrication', 'cryogenics'], { rp3: 700, uranium_pellet: 4 }, 900, 2,
  ['lab_quantum'], ['research_rp4'],
  'Laboratorio blindado de 5 MW con celdas de litio y fibra óptica. Produce ciencia nuclear a partir de pastilla de uranio, procesador y refrigerante.',
  'El laboratorio cuántico exige hilo superconductor de la nanoforja; produce ciencia nuclear con pastilla de uranio, procesador y refrigerante.');
T('fission', 'Reactor de fisión', 6, ['nuclear_science'], { rp4: 600, fuel_rod: 2 }, 900, 3,
  ['fission_reactor', 'cooling_tower'], [],
  'Vasija de inoxidable y plomo con cuatro turbinas: 150 MW con barras de combustible y 5 unidades/s de agua. Sin torre de refrigeración adyacente rinde la mitad y se desgasta cinco veces más.',
  'Coloca la torre de refrigeración pegada al reactor y aliméntalo con agua por tubería de titanio y barras de combustible.');
T('breeding', 'Ciclo cerrado del combustible', 6, ['fission'], { rp4: 800 }, 1080, 3,
  [], ['nuclear_fab_spent_fuel', 'nuclear_fab_plutonium', 'nuclear_fab_mox_rod', 'crushing_thorite', 'arc_thorium', 'nuclear_fab_thorium_fuel'],
  'Reprocesado del combustible gastado en ácido nítrico para extraer plutonio y fabricar barras MOX. La torita reducida en el arco da combustible de torio.',
  'Reprocesa combustible gastado en ácido nítrico para obtener plutonio; una barra MOX rinde un 25 % más que la de uranio.');
T('cryo_drilling', 'Perforación criogénica', 6, ['cryogenics', 'nuclear_science'], { rp4: 700 }, 960, 3,
  ['drill_cryo'], [],
  'Perforadora de 3 MW con puntas de carburo refrigeradas con nitrógeno líquido. Fractura roca de dureza 6: corestone, iridio y osmio del núcleo.',
  'La perforadora criogénica alcanza dureza 6 con nitrógeno líquido por tubería: es la única que muerde el núcleo.');
T('brine_pumping', 'Bomba salina y deuterio', 6, ['cryo_drilling'], { rp4: 900 }, 1080, 3,
  ['brine_pump'], ['centrifuge_deuterium', 'cryo_deuterium', 'nuclear_fab_tritium'],
  'Bomba blindada de 800 kW para la salmuera de deuterio y el magma del núcleo. El deuterio se concentra por centrifugado o criogenia; con litio se cría tritio.',
  'Coloca la bomba salina sobre salmuera de deuterio en el núcleo; concentra deuterio y cría tritio con litio.');

/* ── Era 7 · Era cuántica (ciencia cuántica) ── */
T('nanotechnology', 'Nanotecnología', 7, ['nuclear_science', 'lasers'], { rp4: 500 }, 900, 2,
  ['nano_forge', 'cable_super'], ['quantum_graphene', 'quantum_nanotube', 'quantum_superconductor_wire'],
  'Nanoforja de 25 MW con emisores láser que exfolia grafito en grafeno y lo enrolla en nanotubos con nitrógeno líquido. El hilo superconductor conduce sin pérdidas.',
  'La nanoforja produce grafeno, nanotubos e hilo superconductor: con él se construyen el laboratorio cuántico y el cable superconductor.');
T('core_shaft', 'Pozo del núcleo', 7, ['nanotechnology', 'cryo_drilling'], { rp4: 1000, nanotube: 8 }, 1200, 3,
  ['shaft_core'], ['crushing_iridium', 'arc_iridium', 'crushing_osmium', 'arc_osmium', 'mixing_magma_quench'],
  'Pozo blindado con placas térmicas y emisores láser hasta el límite del núcleo. Abre iridio, osmio, corestone, cristal de plasma y salmuera de deuterio inagotable.',
  'Hunde el pozo del núcleo: todo lo que baje sin blindaje térmico perderá un 0,05 % de integridad por segundo.');
T('core_alloys', 'Aleaciones del núcleo', 7, ['core_shaft'], { rp4: 1000, iridium_ingot: 4 }, 1200, 3,
  [], ['quantum_core_alloy', 'quantum_core_frame', 'quantum_plasma_cell', 'quantum_plasma_cell_void'],
  'Corestone fundida con iridio y carburo en la nanoforja. El bastidor del núcleo con placas térmicas y nanotubos y la celda de plasma confinado son las piezas de toda máquina de la era.',
  'Funde dos de corestone, un iridio y un carburo en aleación del núcleo; carga cristal de plasma con hidrógeno líquido en celdas.');
T('quantum_science', 'Ciencia cuántica', 7, ['core_alloys'], { rp4: 1200, plasma_cell: 2 }, 1200, 3,
  [], ['quantum_quantum_processor', 'research_rp5'],
  'Procesador cuántico de grafeno y cristal de plasma con interconexión superconductora. Produce ciencia cuántica con procesador cuántico, celda de plasma y neutronio.',
  'Fabrica procesadores cuánticos en la nanoforja; la ciencia cuántica exige además neutronio del extractor de plasma.');
T('plasma_boring', 'Tuneladora y extractor de plasma', 7, ['quantum_science'], { rp4: 1200, quantum_processor: 2 }, 1500, 3,
  ['borer_plasma', 'extractor_plasma'], ['crushing_neutronium', 'quantum_neutronium', 'quantum_neutronium_void'],
  'Chorro de plasma confinado en celda que vaporiza roca de dureza 7 a 30 casillas/s. El extractor de plasma arranca mena de neutronio, que la nanoforja compacta con plasma o esencia del vacío.',
  'La tuneladora de plasma abre el núcleo y el extractor de plasma extrae mena de neutronio: compáctala con celdas de plasma.');
T('quantum_assembly', 'Ensamblador cuántico', 7, ['plasma_boring'], { rp5: 800 }, 1200, 3,
  ['matter_assembler'], ['quantum_plasma_injector', 'quantum_containment_coil'],
  'Ensamblador de 40 MW que posiciona materia átomo a átomo. Fabrica inyectores de plasma de osmio y bobinas de confinamiento superconductoras.',
  'El ensamblador cuántico fabrica bobinas de confinamiento e inyectores de plasma: ocho y cuatro para el reactor de fusión.');
T('helium3', 'Colector de helio-3', 7, ['plasma_boring', 'brine_pumping'], { rp5: 1000 }, 1200, 3,
  ['he3_collector'], ['cryo_fusion_pellet', 'cryo_he3_pellet'],
  'Colector criogénico de 20 MW sobre las fumarolas de helio-3 del núcleo. La planta criogénica compacta deuterio y tritio, o helio-3 y deuterio, en pastillas de fusión.',
  'Coloca el colector sobre una fumarola de helio-3 y compacta pastillas en la planta criogénica: la de helio-3 rinde 9 GJ.');
T('fusion', 'Reactor de fusión', 7, ['quantum_assembly', 'helium3'], { rp5: 2500, containment_coil: 1 }, 1800, 3,
  ['fusion_reactor'], [],
  'Toro de confinamiento magnético con ocho bobinas superconductoras y cuatro inyectores. 2 GW con pastillas de fusión o de helio-3.',
  'Ocho bobinas, cuatro inyectores y ocho turbinas: el reactor de fusión entrega 2 GW y atrae a los devoradores de plasma.');
T('quantum_logistics', 'Logística cuántica', 7, ['plasma_boring'], { rp5: 1200 }, 1200, 3,
  ['conveyor_quantum', 'pipe_quantum', 'tank_quantum'], [],
  'Cinta de nanotubos y aleación del núcleo a 400 objetos/s, tubería cuántica sin límite de caudal y tanque criogénico de dos millones de unidades.',
  'Tiende cinta y tubería cuánticas en el núcleo: sin límite de caudal y blindadas contra el calor.');
T('quantum_storage', 'Silo y elevador cuánticos', 7, ['quantum_logistics'], { rp5: 1500 }, 1500, 3,
  ['silo_quantum', 'elevator_quantum'], [],
  'Silo de 100 000 unidades por objeto y elevador de 400 objetos/s blindados con placas térmicas y gobernados por procesador cuántico.',
  'El elevador cuántico mueve 400 objetos/s entre el núcleo y la superficie; el silo guarda 100 000 unidades por objeto.');
T('plasma_defense', 'Defensa de plasma', 7, ['quantum_assembly'], { rp5: 1800 }, 1500, 3,
  ['plasma_turret', 'thermal_wall'], [],
  'Torreta de plasma perforante de 8 MW: 400 puntos a 10 casillas contra cualquier blindaje, incluido el vacío. El muro térmico resiste 20 000 puntos y el calor del núcleo.',
  'Solo el plasma perforante hiere a los entes del vacío: rodea el reactor con muros térmicos y torretas de plasma.');

LD.Content.techs = techs;
LD.Content.START = {
  structures: ['hub', 'workbench', 'gather_hut', 'woodcutter', 'well', 'quarry', 'torch', 'conveyor_wood', 'pipe_wood', 'tank_wood', 'study_table', 'palisade', 'watchtower', 'elevator'],
  recipes: ['hand_stick', 'hand_plank', 'hand_rope', 'hand_rope_sinew', 'hand_hand_tool', 'hand_arrow', 'hand_cloth', 'hand_bone_meal',
    'workbench_rope', 'workbench_cloth', 'workbench_hand_tool', 'workbench_wooden_gear', 'workbench_wood_frame',
    'tanning_leather', 'kiln_charcoal', 'kiln_charcoal_sticks', 'kiln_brick', 'kiln_ceramic',
    'smelting_copper_ore', 'smelting_tin_ore', 'research_rp0', 'research_rp0_tools', 'ammo_arrow']
};
})();
