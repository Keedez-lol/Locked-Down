(() => {
'use strict';
const LD = window.LD;
LD.Content = LD.Content || {};
const recipes = [];
/* R(id, type, tier, in, out, time, energyOverrideW?) — energy null = machine default */
const R = (id, type, tier, inp, out, time, energy) => { recipes.push({ id, type, tier, in: inp, out, time, energy: energy === undefined ? null : energy }); };

/* ── hand (T0, hub) ── */
R('hand_stick', 'hand', 0, { wood_log: 1 }, { stick: 4 }, 2);
R('hand_plank', 'hand', 0, { wood_log: 1 }, { plank: 2 }, 4);
R('hand_rope', 'hand', 0, { plant_fiber: 4 }, { rope: 1 }, 3);
R('hand_rope_sinew', 'hand', 0, { sinew: 2 }, { rope: 1 }, 3);
R('hand_hand_tool', 'hand', 0, { stick: 1, flint: 2, rope: 1 }, { hand_tool: 1 }, 3);
R('hand_arrow', 'hand', 0, { stick: 2, flint: 1, plant_fiber: 1 }, { arrow: 4 }, 3);
R('hand_bone_meal', 'hand', 0, { bone: 2 }, { bone_meal: 2 }, 3);

/* ── workbench (T0) ── */
R('workbench_rope', 'workbench', 0, { plant_fiber: 4 }, { rope: 2 }, 3);
R('workbench_cloth', 'workbench', 0, { plant_fiber: 3 }, { cloth: 1 }, 4);
R('workbench_hand_tool', 'workbench', 0, { stick: 1, flint: 2, rope: 1 }, { hand_tool: 2 }, 4);
R('workbench_wooden_gear', 'workbench', 0, { plank: 2 }, { wooden_gear: 1 }, 4);
R('workbench_wood_frame', 'workbench', 0, { plank: 4, rope: 1 }, { wood_frame: 1 }, 5);
R('workbench_bellows', 'workbench', 0, { leather: 2, plank: 2 }, { bellows: 1 }, 5);
R('workbench_fertilizer', 'workbench', 0, { bone_meal: 2, saltpeter: 1 }, { fertilizer: 3 }, 4);
R('workbench_mechanism', 'workbench', 0, { bronze_gear: 2, wooden_gear: 2, bronze_rod: 1 }, { mechanism: 1 }, 6);
R('workbench_mechanism_iron', 'workbench', 0, { iron_gear: 2, iron_rod: 1, wood_frame: 1 }, { mechanism: 1 }, 6);
R('workbench_valve', 'workbench', 0, { bronze_plate: 1, iron_rod: 1 }, { valve: 2 }, 5);
R('workbench_iron_frame', 'workbench', 0, { iron_plate: 4, iron_rod: 2 }, { iron_frame: 1 }, 6);
R('workbench_steel_frame', 'workbench', 0, { steel_plate: 4, steel_rod: 4 }, { steel_frame: 1 }, 10);
R('workbench_boiler', 'workbench', 0, { steel_plate: 6, steel_pipe: 2, valve: 2, brick: 8 }, { boiler: 1 }, 12);
R('workbench_insulated_wire', 'workbench', 0, { copper_wire: 2, cloth: 1, resin: 1 }, { insulated_wire: 2 }, 4);
R('workbench_circuit_basic', 'workbench', 0, { iron_plate: 1, copper_wire: 3, solder: 1 }, { circuit_basic: 1 }, 8);
R('workbench_rp1', 'workbench', 0, { copper_wire: 2, bronze_gear: 1, cloth: 1 }, { rp1: 1 }, 10);

/* ── tanning (T0) ── */
R('tanning_leather', 'tanning', 0, { hide: 1, plant_fiber: 2 }, { leather: 1 }, 6);
R('tanning_leather_water', 'tanning', 0, { hide: 2, water: 3, bone_meal: 1 }, { leather: 3 }, 8);

/* ── kiln (kiln/charcoal_pit T0, coke_oven T2) ── */
R('kiln_charcoal', 'kiln', 0, { wood_log: 2 }, { charcoal: 1 }, 6);
R('kiln_charcoal_sticks', 'kiln', 0, { stick: 6 }, { charcoal: 1 }, 5);
R('kiln_brick', 'kiln', 0, { clay: 2 }, { brick: 1 }, 5);
R('kiln_ceramic', 'kiln', 0, { clay: 1, sand: 1 }, { ceramic: 1 }, 5);
R('kiln_quicklime', 'kiln', 0, { limestone: 1 }, { quicklime: 1 }, 6);
R('kiln_cement', 'kiln', 0, { quicklime: 2, clay: 1 }, { cement: 2 }, 8);
R('kiln_coke', 'kiln', 2, { coal: 2 }, { coke: 1, tar: 1 }, 10);
R('kiln_graphite', 'kiln', 2, { coke: 3, bitumen: 1 }, { graphite: 2 }, 12);
R('kiln_refractory_brick', 'kiln', 2, { alumina: 1, clay: 2 }, { refractory_brick: 2 }, 8);

/* ── smelting (stone_furnace T0, bronze_forge T1, electric_furnace T3) ── */
R('smelting_copper_ore', 'smelting', 0, { copper_ore: 1 }, { copper_ingot: 1 }, 6);
R('smelting_tin_ore', 'smelting', 0, { tin_ore: 1 }, { tin_ingot: 1 }, 6);
R('smelting_copper', 'smelting', 0, { crushed_copper: 1 }, { copper_ingot: 1 }, 5);
R('smelting_tin', 'smelting', 0, { crushed_tin: 1 }, { tin_ingot: 1 }, 5);
R('smelting_iron_ore', 'smelting', 1, { iron_ore: 1 }, { iron_ingot: 1 }, 8);
R('smelting_iron', 'smelting', 1, { crushed_iron: 1 }, { iron_ingot: 1 }, 6);
R('smelting_bronze', 'smelting', 1, { copper_ingot: 3, tin_ingot: 1 }, { bronze_ingot: 4 }, 8);
R('smelting_glass', 'smelting', 1, { sand: 2 }, { glass: 1 }, 6);
R('smelting_glass_obsidian', 'smelting', 3, { obsidian: 1, sand: 1 }, { glass: 3 }, 6);
R('smelting_zinc', 'smelting', 1, { crushed_zinc: 1 }, { zinc_ingot: 1 }, 6);
R('smelting_lead', 'smelting', 1, { crushed_lead: 1 }, { lead_ingot: 1 }, 6);
R('smelting_silver', 'smelting', 1, { crushed_silver: 1 }, { silver_ingot: 1 }, 6);
R('smelting_gold', 'smelting', 1, { crushed_gold: 1 }, { gold_ingot: 1 }, 6);
R('smelting_nickel', 'smelting', 1, { crushed_nickel: 1 }, { nickel_ingot: 1 }, 7);
R('smelting_brass', 'smelting', 1, { copper_ingot: 3, zinc_ingot: 1 }, { brass_ingot: 4 }, 8);
R('smelting_electrum', 'smelting', 1, { gold_ingot: 1, silver_ingot: 1 }, { electrum_ingot: 2 }, 8);
R('smelting_solder', 'smelting', 1, { tin_ingot: 1, lead_ingot: 1 }, { solder: 4 }, 6);
R('smelting_solder_tin', 'smelting', 0, { tin_ingot: 1 }, { solder: 2 }, 6);
R('smelting_purified_copper', 'smelting', 1, { purified_copper: 1 }, { copper_ingot: 1 }, 4);
R('smelting_purified_tin', 'smelting', 1, { purified_tin: 1 }, { tin_ingot: 1 }, 4);
R('smelting_purified_iron', 'smelting', 1, { purified_iron: 1 }, { iron_ingot: 1 }, 4);
R('smelting_purified_zinc', 'smelting', 1, { purified_zinc: 1 }, { zinc_ingot: 1 }, 4);
R('smelting_purified_lead', 'smelting', 1, { purified_lead: 1 }, { lead_ingot: 1 }, 4);
R('smelting_purified_silver', 'smelting', 1, { purified_silver: 1 }, { silver_ingot: 1 }, 4);
R('smelting_purified_gold', 'smelting', 1, { purified_gold: 1 }, { gold_ingot: 1 }, 4);
R('smelting_purified_nickel', 'smelting', 1, { purified_nickel: 1 }, { nickel_ingot: 1 }, 5);
R('smelting_platinum', 'smelting', 3, { crushed_platinum: 1 }, { platinum_ingot: 1 }, 10);
R('smelting_purified_platinum', 'smelting', 3, { purified_platinum: 1 }, { platinum_ingot: 1 }, 8);
R('smelting_chromium', 'smelting', 3, { crushed_chromite: 1, coke: 1 }, { chromium_ingot: 1 }, 10);
R('smelting_manganese', 'smelting', 3, { crushed_manganese: 1, coke: 1 }, { manganese_ingot: 1 }, 10);
R('smelting_cobalt', 'smelting', 3, { crushed_cobalt: 1, coke: 1 }, { cobalt_ingot: 1 }, 10);
R('smelting_vanadium', 'smelting', 3, { crushed_vanadinite: 2, coke: 1 }, { vanadium_ingot: 1, lead_ingot: 1 }, 12);
R('smelting_silicon', 'smelting', 3, { quartz: 2, coke: 1 }, { silicon_ingot: 1 }, 10);
R('smelting_stainless', 'smelting', 3, { steel_ingot: 6, chromium_ingot: 2, nickel_ingot: 1 }, { stainless_ingot: 8 }, 12);

/* ── blast (blast_furnace T2) ── */
R('blast_iron', 'blast', 2, { crushed_iron: 3, coke: 1, limestone: 1 }, { iron_ingot: 3 }, 12);
R('blast_steel', 'blast', 2, { iron_ingot: 2, coke: 1 }, { steel_ingot: 2 }, 10);
R('blast_steel_direct', 'blast', 2, { crushed_iron: 2, coke: 2, limestone: 1 }, { steel_ingot: 2 }, 14);
R('blast_steel_manganese', 'blast', 2, { iron_ingot: 4, coke: 2, manganese_ingot: 1 }, { steel_ingot: 5 }, 14);

/* ── forging (trip_hammer T1, steam_hammer T2) ── */
R('forging_copper_plate', 'forging', 1, { copper_ingot: 1 }, { copper_plate: 1 }, 4);
R('forging_bronze_plate', 'forging', 1, { bronze_ingot: 1 }, { bronze_plate: 1 }, 5);
R('forging_iron_plate', 'forging', 1, { iron_ingot: 1 }, { iron_plate: 1 }, 5);
R('forging_lead_plate', 'forging', 1, { lead_ingot: 1 }, { lead_plate: 1 }, 5);
R('forging_bronze_rod', 'forging', 1, { bronze_ingot: 1 }, { bronze_rod: 2 }, 5);
R('forging_iron_rod', 'forging', 1, { iron_ingot: 1 }, { iron_rod: 2 }, 5);
R('forging_copper_wire', 'forging', 1, { copper_ingot: 1 }, { copper_wire: 2 }, 5);
R('forging_bronze_gear', 'forging', 1, { bronze_ingot: 2 }, { bronze_gear: 1 }, 6);
R('forging_iron_gear', 'forging', 1, { iron_ingot: 2 }, { iron_gear: 1 }, 6);
R('forging_bronze_pipe', 'forging', 1, { bronze_ingot: 1 }, { bronze_pipe: 1 }, 6);
R('forging_steel_plate', 'forging', 1, { steel_ingot: 1 }, { steel_plate: 1 }, 6);
R('forging_steel_rod', 'forging', 1, { steel_ingot: 1 }, { steel_rod: 2 }, 6);
R('forging_steel_gear', 'forging', 1, { steel_ingot: 2 }, { steel_gear: 1 }, 8);
R('forging_steel_pipe', 'forging', 1, { steel_ingot: 1 }, { steel_pipe: 1 }, 8);
R('forging_stainless_plate', 'forging', 2, { stainless_ingot: 1 }, { stainless_plate: 1 }, 8);
R('forging_drill_head', 'forging', 2, { steel_rod: 2, iron_gear: 1 }, { drill_head: 1 }, 8);
R('forging_piston', 'forging', 2, { steel_rod: 1, steel_plate: 1, leather: 1 }, { piston: 1 }, 8);

/* ── sawing (sawmill T1) ── */
R('sawing_plank', 'sawing', 1, { wood_log: 1 }, { plank: 4 }, 4);
R('sawing_stick', 'sawing', 1, { wood_log: 1 }, { stick: 8 }, 3);
R('sawing_wooden_gear', 'sawing', 1, { plank: 2 }, { wooden_gear: 2 }, 4);
R('sawing_wood_frame', 'sawing', 1, { plank: 4, resin: 1 }, { wood_frame: 2 }, 6);

/* ── crushing (millstone T1 ×1.5, crusher T2 ×2) ── */
R('crushing_copper_mill', 'crushing', 1, { copper_ore: 2 }, { crushed_copper: 3 }, 6);
R('crushing_tin_mill', 'crushing', 1, { tin_ore: 2 }, { crushed_tin: 3 }, 6);
R('crushing_iron_mill', 'crushing', 1, { iron_ore: 2 }, { crushed_iron: 3 }, 7);
R('crushing_bone_meal', 'crushing', 1, { bone: 1 }, { bone_meal: 2 }, 4);
R('crushing_black_powder', 'crushing', 1, { charcoal: 1, sulfur: 1, saltpeter: 2 }, { black_powder: 4 }, 8);
const ORES = ['copper', 'tin', 'iron', 'zinc', 'lead', 'silver', 'gold', 'nickel', 'chromite', 'manganese', 'bauxite', 'rutile', 'wolframite', 'platinum', 'cobalt', 'spodumene', 'molybdenite', 'vanadinite', 'monazite', 'uraninite', 'thorite', 'iridium', 'osmium', 'neutronium'];
const ORE_ID = { copper: 'copper_ore', tin: 'tin_ore', iron: 'iron_ore', zinc: 'zinc_ore', lead: 'lead_ore', silver: 'silver_ore', gold: 'gold_ore', nickel: 'nickel_ore', chromite: 'chromite', manganese: 'manganese_ore', bauxite: 'bauxite', rutile: 'rutile', wolframite: 'wolframite', platinum: 'platinum_ore', cobalt: 'cobalt_ore', spodumene: 'spodumene', molybdenite: 'molybdenite', vanadinite: 'vanadinite', monazite: 'monazite', uraninite: 'uraninite', thorite: 'thorite', iridium: 'iridium_ore', osmium: 'osmium_ore', neutronium: 'neutronium_ore' };
for (const o of ORES) R('crushing_' + o, 'crushing', 2, { [ORE_ID[o]]: 1 }, { ['crushed_' + o]: 2 }, o === 'neutronium' ? 12 : 5);

/* ── washing (T2+, water; byproducts are trace ores) ── */
const W = (o, by, t) => R('washing_' + o, 'washing', 2, { ['crushed_' + o]: 2, water: 2 }, Object.assign({ ['purified_' + o]: 2 }, by), t || 6);
W('copper', { crushed_gold: 0.1 });
W('tin', { crushed_zinc: 0.15 });
W('iron', { crushed_manganese: 0.15 });
W('zinc', { crushed_lead: 0.15, crushed_silver: 0.05 });
W('lead', { crushed_silver: 0.15 });
W('silver', { crushed_gold: 0.1 });
W('gold', { crushed_silver: 0.2 });
W('nickel', { crushed_cobalt: 0.1, crushed_platinum: 0.03 });
W('platinum', { crushed_iridium: 0.05, crushed_osmium: 0.05 }, 8);

/* ── pressing (press T3) ── */
R('pressing_steel_plate', 'pressing', 3, { steel_ingot: 2 }, { steel_plate: 2 }, 5);
R('pressing_stainless_plate', 'pressing', 3, { stainless_ingot: 2 }, { stainless_plate: 2 }, 6);
R('pressing_aluminium_plate', 'pressing', 3, { aluminium_ingot: 1 }, { aluminium_plate: 1 }, 5);
R('pressing_titanium_plate', 'pressing', 3, { titanium_ingot: 1 }, { titanium_plate: 1 }, 8);
R('pressing_titanium_pipe', 'pressing', 3, { titanium_ingot: 1 }, { titanium_pipe: 1 }, 8);
R('pressing_tungsten_plate', 'pressing', 3, { tungsten_ingot: 1 }, { tungsten_plate: 1 }, 10);
R('pressing_superalloy_plate', 'pressing', 3, { superalloy_ingot: 1 }, { superalloy_plate: 1 }, 10);
R('pressing_turbine_blade', 'pressing', 3, { steel_plate: 1 }, { turbine_blade: 2 }, 6);
R('pressing_graphite_electrode', 'pressing', 3, { graphite: 2 }, { graphite_electrode: 1 }, 8);
R('pressing_basalt_slab', 'pressing', 3, { basalt: 2 }, { basalt_slab: 1 }, 8);
R('pressing_brick', 'pressing', 3, { clay: 4 }, { brick: 4 }, 6);

/* ── lathe (T3) ── */
R('lathe_bearing', 'lathe', 3, { steel_ingot: 1 }, { bearing: 2 }, 6);
R('lathe_steel_rod', 'lathe', 3, { steel_ingot: 1 }, { steel_rod: 3 }, 5);
R('lathe_silicon_wafer', 'lathe', 3, { silicon_ingot: 1 }, { silicon_wafer: 4 }, 8);
R('lathe_crystal_oscillator', 'lathe', 3, { quartz: 1 }, { crystal_oscillator: 2 }, 6);
R('lathe_titanium_rod', 'lathe', 3, { titanium_ingot: 1 }, { titanium_rod: 2 }, 10);
R('lathe_titanium_gear', 'lathe', 3, { titanium_ingot: 2 }, { titanium_gear: 1 }, 12);
R('lathe_tungsten_rod', 'lathe', 3, { tungsten_ingot: 1 }, { tungsten_rod: 2 }, 12);
R('lathe_ruby', 'lathe', 3, { ruby_raw: 1 }, { ruby: 1 }, 10);
R('lathe_sapphire', 'lathe', 3, { sapphire_raw: 1 }, { sapphire: 1 }, 10);
R('lathe_diamond', 'lathe', 3, { diamond_raw: 1 }, { diamond: 1 }, 12);
R('lathe_crystal_lens', 'lathe', 3, { crystal_shard: 2 }, { crystal_lens: 1 }, 10);
R('lathe_crystal_lens_sapphire', 'lathe', 3, { sapphire: 1, glass: 2 }, { crystal_lens: 1 }, 12);

/* ── wiremill (T3) ── */
R('wiremill_copper_wire', 'wiremill', 3, { copper_ingot: 1 }, { copper_wire: 4 }, 4);
R('wiremill_gold_wire', 'wiremill', 3, { gold_ingot: 1 }, { gold_wire: 4 }, 6);
R('wiremill_gold_wire_electrum', 'wiremill', 3, { electrum_ingot: 1 }, { gold_wire: 3 }, 6);
R('wiremill_aluminium_wire', 'wiremill', 3, { aluminium_ingot: 1 }, { aluminium_wire: 4 }, 5);
R('wiremill_tungsten_wire', 'wiremill', 3, { tungsten_ingot: 1 }, { tungsten_wire: 4 }, 10);
R('wiremill_glass_fiber', 'wiremill', 3, { glass: 2 }, { glass_fiber: 4 }, 6);
R('wiremill_insulated_wire', 'wiremill', 3, { copper_wire: 2, rubber: 1 }, { insulated_wire: 4 }, 5);

/* ── assembling (assembler T3) ── */
R('assembling_circuit_basic', 'assembling', 3, { iron_plate: 2, copper_wire: 6, solder: 2 }, { circuit_basic: 3 }, 8);
R('assembling_steel_frame', 'assembling', 3, { steel_plate: 4, steel_rod: 4 }, { steel_frame: 2 }, 8);
R('assembling_titanium_frame', 'assembling', 3, { titanium_plate: 4, titanium_rod: 4 }, { titanium_frame: 1 }, 14);
R('assembling_magnet', 'assembling', 3, { steel_ingot: 1, copper_wire: 2 }, { magnet: 1 }, 6);
R('assembling_electromagnet', 'assembling', 3, { iron_rod: 1, copper_wire: 8 }, { electromagnet: 1 }, 6);
R('assembling_motor', 'assembling', 3, { electromagnet: 2, magnet: 1, steel_rod: 1, steel_plate: 2 }, { motor: 1 }, 10);
R('assembling_motor_neodymium', 'assembling', 3, { neodymium_magnet: 1, aluminium_wire: 6, steel_rod: 1, aluminium_plate: 2 }, { motor: 3 }, 10);
R('assembling_dynamo', 'assembling', 3, { electromagnet: 4, magnet: 2, steel_frame: 1 }, { dynamo: 1 }, 12);
R('assembling_transformer_core', 'assembling', 3, { iron_plate: 6, insulated_wire: 6, ceramic: 2 }, { transformer_core: 1 }, 12);
R('assembling_turbine', 'assembling', 3, { turbine_blade: 8, steel_rod: 2, bearing: 2, lubricant: 1 }, { turbine: 1 }, 12);
R('assembling_turbine_titanium', 'assembling', 3, { turbine_blade: 8, titanium_rod: 2, bearing: 2, titanium_gear: 1, lubricant: 1 }, { turbine: 2 }, 14);
R('assembling_pump_mechanism', 'assembling', 3, { bearing: 1, steel_rod: 1, steel_plate: 2, steel_gear: 1, valve: 1 }, { pump_mechanism: 1 }, 8);
R('assembling_heat_exchanger', 'assembling', 3, { stainless_plate: 6, steel_pipe: 4 }, { heat_exchanger: 1 }, 12);
R('assembling_capacitor', 'assembling', 3, { aluminium_plate: 2, plastic: 1, copper_wire: 1 }, { capacitor: 4 }, 8);
R('assembling_battery_cell', 'assembling', 3, { lead_plate: 2, copper_plate: 1, glass: 1 }, { battery_cell: 1 }, 10);
R('assembling_lithium_cell', 'assembling', 3, { lithium_ingot: 1, graphite: 2, plastic: 1, aluminium_plate: 1 }, { lithium_cell: 2 }, 12);
R('assembling_sensor', 'assembling', 3, { crystal_oscillator: 1, circuit_basic: 1, copper_wire: 2, glass: 1 }, { sensor: 1 }, 10);
R('assembling_resonator', 'assembling', 3, { amethyst: 2, copper_wire: 4, silver_ingot: 1 }, { resonator: 1 }, 10);
R('assembling_circuit_advanced', 'assembling', 3, { circuit_basic: 2, silicon_wafer: 1, plastic: 2, gold_wire: 2 }, { circuit_advanced: 1 }, 12);
R('assembling_fiber_optic', 'assembling', 3, { glass_fiber: 4, plastic: 1 }, { fiber_optic: 2 }, 8);
R('assembling_reinforced_concrete', 'assembling', 3, { concrete: 4, steel_rod: 2 }, { reinforced_concrete: 4 }, 10);

/* ── mixing (mixer T3) ── */
R('mixing_concrete', 'mixing', 3, { cement: 2, gravel: 3, sand: 2, water: 2 }, { concrete: 4 }, 8);
R('mixing_concrete_stone', 'mixing', 3, { cement: 2, stone: 2, sand: 1, water: 2 }, { concrete: 3 }, 8);
R('mixing_coolant', 'mixing', 3, { water: 4, salt: 1 }, { coolant: 4 }, 6);
R('mixing_lubricant', 'mixing', 3, { resin: 2, diesel: 1 }, { lubricant: 2 }, 6);
R('mixing_magma_quench', 'mixing', 3, { magma: 4, water: 4 }, { basalt_slab: 2, glass: 1 }, 8);

/* ── distilling (distillery T3) ── */
R('distilling_crude', 'distilling', 3, { crude_oil: 10 }, { diesel: 3, kerosene: 3, tar: 3 }, 10);
R('distilling_tar', 'distilling', 3, { tar: 4 }, { naphtha: 1, bitumen: 1 }, 8);
R('distilling_ethanol', 'distilling', 3, { plant_fiber: 6, water: 4 }, { ethanol: 2 }, 12);
R('distilling_ethanol_algae', 'distilling', 3, { algae: 4, water: 2 }, { ethanol: 3 }, 10);
R('distilling_biofuel', 'distilling', 3, { algae: 6, water: 2 }, { biofuel: 3, lubricant: 1 }, 12);

/* ── chemical (chemical_plant T4) ── */
R('chemical_sulfuric_acid', 'chemical', 4, { sulfur: 1, water: 2, oxygen: 1 }, { sulfuric_acid: 3 }, 8);
R('chemical_sulfuric_acid_air', 'chemical', 4, { sulfur: 2, water: 4, compressed_air: 4 }, { sulfuric_acid: 4 }, 12);
R('chemical_hydrochloric_acid', 'chemical', 4, { chlorine: 1, hydrogen: 1 }, { hydrochloric_acid: 2 }, 6);
R('chemical_hydrochloric_acid_salt', 'chemical', 4, { salt: 2, sulfuric_acid: 1 }, { hydrochloric_acid: 2 }, 8);
R('chemical_ammonia', 'chemical', 4, { nitrogen: 1, hydrogen: 3 }, { ammonia: 2 }, 8);
R('chemical_nitric_acid', 'chemical', 4, { ammonia: 1, oxygen: 2, water: 1 }, { nitric_acid: 2 }, 8);
R('chemical_nitric_acid_saltpeter', 'chemical', 4, { saltpeter: 2, sulfuric_acid: 1 }, { nitric_acid: 2 }, 10);
R('chemical_hydrogen_reforming', 'chemical', 4, { natural_gas: 2, water: 2 }, { hydrogen: 6 }, 8);
R('chemical_hydrofluoric_acid', 'chemical', 4, { fluorite: 2, sulfuric_acid: 1 }, { hydrofluoric_acid: 2 }, 10);
R('chemical_alumina', 'chemical', 4, { crushed_bauxite: 3, hydrochloric_acid: 1 }, { alumina: 2 }, 10);
R('chemical_titanium_tetrachloride', 'chemical', 4, { crushed_rutile: 2, chlorine: 2, coke: 1 }, { titanium_tetrachloride: 2 }, 10);
R('chemical_tungsten_oxide', 'chemical', 4, { crushed_wolframite: 2, hydrochloric_acid: 1 }, { tungsten_oxide: 2 }, 10);
R('chemical_rare_earth_oxide', 'chemical', 4, { crushed_monazite: 4, sulfuric_acid: 2 }, { rare_earth_oxide: 2, crushed_thorite: 0.5 }, 12);
R('chemical_yellowcake', 'chemical', 4, { crushed_uraninite: 4, sulfuric_acid: 4 }, { yellowcake: 2 }, 12);
R('chemical_uf6', 'chemical', 4, { yellowcake: 1, hydrofluoric_acid: 4 }, { uf6: 4 }, 12);
R('chemical_plastic', 'chemical', 4, { naphtha: 4 }, { plastic: 2 }, 8);
R('chemical_plastic_ethanol', 'chemical', 4, { ethanol: 4 }, { plastic: 2 }, 10);
R('chemical_plastic_chitin', 'chemical', 4, { chitin: 4, hydrochloric_acid: 1 }, { plastic: 2 }, 10);
R('chemical_rubber', 'chemical', 4, { rubber_sap: 4, sulfur: 1 }, { rubber: 2 }, 8);
R('chemical_rubber_synthetic', 'chemical', 4, { naphtha: 3, sulfur: 1 }, { rubber: 2 }, 10);
R('chemical_fertilizer', 'chemical', 4, { ammonia: 2, saltpeter: 1 }, { fertilizer: 6 }, 8);

/* ── refining (refinery T4) ── */
R('refining_crude', 'refining', 4, { crude_oil: 10 }, { naphtha: 4, diesel: 3, kerosene: 2, lubricant: 1, bitumen: 1 }, 12);
R('refining_cracking', 'refining', 4, { kerosene: 4, platinum_ingot: 0.1 }, { naphtha: 3 }, 8);

/* ── electrolysis (electrolyzer T4) ── */
R('electrolysis_water', 'electrolysis', 4, { water: 2 }, { hydrogen: 2, oxygen: 1 }, 6);
R('electrolysis_brine', 'electrolysis', 4, { salt: 2, water: 2 }, { chlorine: 1, hydrogen: 1 }, 8);
R('electrolysis_aluminium', 'electrolysis', 4, { alumina: 2, graphite_electrode: 1 }, { aluminium_ingot: 2 }, 12, 400000);
R('electrolysis_lithium', 'electrolysis', 4, { crushed_spodumene: 4, hydrochloric_acid: 2 }, { lithium_ingot: 1, chlorine: 1 }, 14);
R('electrolysis_zinc', 'electrolysis', 4, { crushed_zinc: 2, sulfuric_acid: 1 }, { zinc_ingot: 2 }, 10);

/* ── centrifuge (T4) ── */
R('centrifuge_air', 'centrifuge', 4, { compressed_air: 4 }, { nitrogen: 3, oxygen: 1 }, 6);
R('centrifuge_deuterium', 'centrifuge', 4, { deuterium_brine: 20 }, { deuterium: 1 }, 20);
R('centrifuge_platinum', 'centrifuge', 4, { crushed_platinum: 4 }, { purified_platinum: 3, crushed_nickel: 0.5 }, 10);

/* ── compressing (compressor T4) ── */
R('compressing_air', 'compressing', 4, {}, { compressed_air: 4 }, 4);
R('compressing_diamond', 'compressing', 4, { graphite: 8 }, { diamond: 1 }, 40, 600000);

/* ── arc (arc_furnace T5) ── */
R('arc_titanium', 'arc', 5, { titanium_tetrachloride: 2, graphite_electrode: 1 }, { titanium_ingot: 1, chlorine: 2 }, 20, 2.4e6);
R('arc_titanium_alloy', 'arc', 5, { titanium_ingot: 4, vanadium_ingot: 1, aluminium_ingot: 1 }, { titanium_ingot: 6 }, 16);
R('arc_tungsten', 'arc', 5, { tungsten_oxide: 1, hydrogen: 3 }, { tungsten_ingot: 1 }, 20, 2e6);
R('arc_silicon', 'arc', 5, { sand: 4, coke: 2 }, { silicon_ingot: 2 }, 16);
R('arc_molybdenum', 'arc', 5, { crushed_molybdenite: 2, oxygen: 1 }, { molybdenum_ingot: 1 }, 16);
R('arc_thorium', 'arc', 5, { crushed_thorite: 2, hydrochloric_acid: 2 }, { thorium_ingot: 1 }, 24);
R('arc_iridium', 'arc', 5, { crushed_iridium: 2, graphite_electrode: 1 }, { iridium_ingot: 1 }, 30, 3e6);
R('arc_osmium', 'arc', 5, { crushed_osmium: 2, graphite_electrode: 1 }, { osmium_ingot: 1 }, 30, 3e6);

/* ── vacuum (vacuum_furnace T5) ── */
R('vacuum_tungsten_carbide', 'vacuum', 5, { tungsten_ingot: 1, graphite: 1 }, { tungsten_carbide: 1 }, 20);
R('vacuum_superalloy', 'vacuum', 5, { nickel_ingot: 4, chromium_ingot: 2, cobalt_ingot: 1, molybdenum_ingot: 1 }, { superalloy_ingot: 6 }, 24);
R('vacuum_neodymium_magnet', 'vacuum', 5, { rare_earth_oxide: 2, iron_ingot: 2 }, { neodymium_magnet: 2 }, 20);
R('vacuum_diamond', 'vacuum', 5, { graphite: 4, hydrogen: 1 }, { diamond: 1 }, 40);
R('vacuum_silicon_wafer', 'vacuum', 5, { silicon_ingot: 1 }, { silicon_wafer: 8 }, 12);

/* ── fabrication (fabricator T5) ── */
R('fabrication_processor', 'fabrication', 5, { silicon_wafer: 2, circuit_advanced: 2, gold_wire: 4, ceramic: 2, hydrofluoric_acid: 1 }, { processor: 1 }, 20);
R('fabrication_laser_emitter', 'fabrication', 5, { ruby: 1, crystal_lens: 1, capacitor: 2, electromagnet: 1, tungsten_wire: 2, sensor: 1, fiber_optic: 1, coolant: 2 }, { laser_emitter: 1 }, 24);
R('fabrication_carbide_tip', 'fabrication', 5, { tungsten_carbide: 2, diamond: 1 }, { carbide_tip: 2 }, 16);
R('fabrication_thermal_plate', 'fabrication', 5, { tungsten_plate: 2, ceramic: 4, heat_gland: 1 }, { thermal_plate: 2 }, 20);
R('fabrication_thermal_plate_alloy', 'fabrication', 5, { tungsten_plate: 2, ceramic: 4, superalloy_plate: 1 }, { thermal_plate: 1 }, 24);
R('fabrication_control_rod', 'fabrication', 5, { silver_ingot: 3, cobalt_ingot: 1, stainless_plate: 1 }, { control_rod: 1 }, 20);
R('fabrication_reactor_vessel', 'fabrication', 5, { stainless_plate: 20, lead_plate: 10, reinforced_concrete: 8, refractory_brick: 6 }, { reactor_vessel: 1 }, 40);

/* ── enrichment (enrichment_centrifuge T6) ── */
R('enrichment_uf6', 'enrichment', 6, { uf6: 8 }, { enriched_uf6: 1, depleted_uf6: 6 }, 30);

/* ── nuclear_fab (fuel_fabricator T6) ── */
R('nuclear_fab_uranium_pellet', 'nuclear_fab', 6, { enriched_uf6: 2, hydrogen: 1, water: 1 }, { uranium_pellet: 2, hydrofluoric_acid: 2 }, 20);
R('nuclear_fab_depleted_uranium', 'nuclear_fab', 6, { depleted_uf6: 4, hydrogen: 2 }, { depleted_uranium: 1, hydrofluoric_acid: 4 }, 16);
R('nuclear_fab_fuel_rod', 'nuclear_fab', 6, { uranium_pellet: 8, stainless_plate: 2 }, { fuel_rod: 1 }, 24);
R('nuclear_fab_spent_fuel', 'nuclear_fab', 6, { depleted_uranium: 4, uranium_pellet: 1 }, { spent_fuel: 2 }, 40);
R('nuclear_fab_plutonium', 'nuclear_fab', 6, { spent_fuel: 2, nitric_acid: 4 }, { plutonium: 1, depleted_uranium: 2 }, 30);
R('nuclear_fab_mox_rod', 'nuclear_fab', 6, { plutonium: 1, depleted_uranium: 7, stainless_plate: 2 }, { mox_rod: 1 }, 30);
R('nuclear_fab_thorium_fuel', 'nuclear_fab', 6, { thorium_ingot: 6, uranium_pellet: 2, stainless_plate: 2 }, { thorium_fuel: 1 }, 30);
R('nuclear_fab_tritium', 'nuclear_fab', 6, { lithium_ingot: 2, deuterium: 1 }, { tritium: 1 }, 30);

/* ── cryo (cryo_plant T6) ── */
R('cryo_liquid_nitrogen', 'cryo', 6, { nitrogen: 4 }, { liquid_nitrogen: 3 }, 10);
R('cryo_air', 'cryo', 6, { compressed_air: 8 }, { liquid_nitrogen: 5, oxygen: 2 }, 14);
R('cryo_liquid_hydrogen', 'cryo', 6, { hydrogen: 4 }, { liquid_hydrogen: 3 }, 12);
R('cryo_deuterium', 'cryo', 6, { deuterium_brine: 10 }, { deuterium: 1 }, 16);
R('cryo_cryo_coolant', 'cryo', 6, { liquid_nitrogen: 2, coolant: 2 }, { cryo_coolant: 4 }, 8);
R('cryo_fusion_pellet', 'cryo', 6, { deuterium: 2, tritium: 2 }, { fusion_pellet: 1 }, 30);
R('cryo_he3_pellet', 'cryo', 6, { helium3: 3, deuterium: 1 }, { he3_pellet: 1 }, 30);

/* ── quantum (nano_forge / matter_assembler T7) ── */
R('quantum_neutronium', 'quantum', 7, { crushed_neutronium: 4, plasma_cell: 1 }, { neutronium_ingot: 1 }, 60, 80e6);
R('quantum_core_alloy', 'quantum', 7, { corestone: 2, iridium_ingot: 1, tungsten_carbide: 1 }, { core_alloy: 2 }, 40);
R('quantum_graphene', 'quantum', 7, { graphite: 4, hydrogen: 2 }, { graphene: 2 }, 30);
R('quantum_nanotube', 'quantum', 7, { graphene: 2, liquid_nitrogen: 1 }, { nanotube: 2 }, 30);
R('quantum_superconductor_wire', 'quantum', 7, { silver_ingot: 2, copper_ingot: 2, rare_earth_oxide: 1, liquid_nitrogen: 2 }, { superconductor_wire: 4 }, 30);
R('quantum_quantum_processor', 'quantum', 7, { processor: 2, graphene: 2, plasma_crystal: 1, superconductor_wire: 2 }, { quantum_processor: 1 }, 60);
R('quantum_plasma_cell', 'quantum', 7, { plasma_crystal: 1, liquid_hydrogen: 2 }, { plasma_cell: 1 }, 30);
R('quantum_plasma_cell_void', 'quantum', 7, { void_essence: 1, liquid_hydrogen: 2 }, { plasma_cell: 2 }, 30);
R('quantum_core_frame', 'quantum', 7, { core_alloy: 4, thermal_plate: 2, nanotube: 2 }, { core_frame: 1 }, 40);
R('quantum_containment_coil', 'quantum', 7, { superconductor_wire: 8, core_frame: 1, resonator: 2, cryo_coolant: 4 }, { containment_coil: 1 }, 45);
R('quantum_plasma_injector', 'quantum', 7, { osmium_ingot: 2, tungsten_rod: 2, platinum_ingot: 1, crystal_lens: 1, titanium_pipe: 2, lithium_cell: 2, fiber_optic: 1, processor: 1 }, { plasma_injector: 1 }, 45);

/* ── research (study_table T0, lab_basic T2, lab_industrial T4, lab_quantum T6) ── */
R('research_rp0', 'research', 0, { stick: 2, flint: 1, charcoal: 1 }, { rp0: 2 }, 4);
R('research_rp0_tools', 'research', 0, { hand_tool: 1, charcoal: 1, bone: 1 }, { rp0: 3 }, 5);
R('research_rp1', 'research', 2, { copper_wire: 2, bronze_gear: 1, cloth: 1 }, { rp1: 2 }, 8);
R('research_rp2', 'research', 2, { steel_plate: 1, circuit_basic: 1, glass: 1 }, { rp2: 2 }, 12);
R('research_rp3', 'research', 4, { plastic: 2, sulfuric_acid: 2, circuit_advanced: 1, battery_cell: 1 }, { rp3: 2 }, 16);
R('research_rp4', 'research', 4, { uranium_pellet: 1, processor: 1, coolant: 4 }, { rp4: 2 }, 24);
R('research_rp5', 'research', 6, { quantum_processor: 1, plasma_cell: 1, neutronium_ingot: 1 }, { rp5: 4 }, 40);

/* ── ammo (workbench T0 / assembler) ── */
R('ammo_arrow', 'ammo', 0, { stick: 2, flint: 1, plant_fiber: 1 }, { arrow: 6 }, 3);
R('ammo_ballista_bolt', 'ammo', 0, { iron_rod: 1, plank: 1 }, { ballista_bolt: 2 }, 5);
R('ammo_cannon_shell', 'ammo', 0, { steel_ingot: 1, black_powder: 2 }, { cannon_shell: 2 }, 8);
R('ammo_bullet', 'ammo', 0, { brass_ingot: 1, black_powder: 1 }, { bullet: 10 }, 6);
R('ammo_bullet_smokeless', 'ammo', 0, { brass_ingot: 1, nitric_acid: 1, naphtha: 1 }, { bullet: 20 }, 8);

/* ── additional routes (alternates that make each machine useful across eras) ── */
R('hand_cloth', 'hand', 0, { plant_fiber: 3 }, { cloth: 1 }, 4);
R('smelting_bronze_direct', 'smelting', 1, { crushed_copper: 3, crushed_tin: 1 }, { bronze_ingot: 4 }, 10);
R('smelting_glass_quartz', 'smelting', 3, { quartz: 1, sand: 2 }, { glass: 4 }, 8);
R('pressing_copper_plate', 'pressing', 3, { copper_ingot: 2 }, { copper_plate: 2 }, 4);
R('pressing_bronze_plate', 'pressing', 3, { bronze_ingot: 2 }, { bronze_plate: 2 }, 5);
R('pressing_iron_plate', 'pressing', 3, { iron_ingot: 2 }, { iron_plate: 2 }, 5);
R('pressing_lead_plate', 'pressing', 3, { lead_ingot: 2 }, { lead_plate: 2 }, 5);
R('lathe_bronze_rod', 'lathe', 3, { bronze_ingot: 1 }, { bronze_rod: 3 }, 5);
R('lathe_iron_rod', 'lathe', 3, { iron_ingot: 1 }, { iron_rod: 3 }, 5);
R('chemical_coolant_glycol', 'chemical', 4, { ethanol: 2, water: 4 }, { coolant: 6 }, 8);
R('chemical_alumina_sulfuric', 'chemical', 4, { crushed_bauxite: 3, sulfuric_acid: 1 }, { alumina: 2 }, 10);
R('arc_steel', 'arc', 5, { iron_ingot: 4, coke: 1, graphite_electrode: 1 }, { steel_ingot: 4 }, 10);
R('arc_stainless', 'arc', 5, { steel_ingot: 6, chromium_ingot: 2, nickel_ingot: 1 }, { stainless_ingot: 9 }, 10);
R('vacuum_tungsten_carbide_direct', 'vacuum', 5, { tungsten_oxide: 1, graphite: 2, hydrogen: 2 }, { tungsten_carbide: 1 }, 30);
R('quantum_neutronium_void', 'quantum', 7, { crushed_neutronium: 4, void_essence: 2 }, { neutronium_ingot: 1 }, 50, 60e6);

/* names for alternative routes (default name = product name) */
const NAMES = {
  hand_plank: 'Tablón (a mano)', hand_rope_sinew: 'Cuerda (tendón)', hand_bone_meal: 'Harina de hueso (a mano)',
  workbench_mechanism_iron: 'Mecanismo (hierro)', workbench_rp1: 'Ciencia básica (manual)',
  tanning_leather_water: 'Cuero (curtido en cuba)', kiln_charcoal_sticks: 'Carbón vegetal (varas)',
  smelting_copper_ore: 'Cobre (mena sin triturar)', smelting_tin_ore: 'Estaño (mena sin triturar)', smelting_iron_ore: 'Hierro (mena sin triturar)',
  smelting_glass_obsidian: 'Vidrio (obsidiana)', smelting_solder_tin: 'Soldadura (solo estaño)',
  smelting_purified_copper: 'Cobre (purificado)', smelting_purified_tin: 'Estaño (purificado)', smelting_purified_iron: 'Hierro (purificado)',
  smelting_purified_zinc: 'Zinc (purificado)', smelting_purified_lead: 'Plomo (purificado)', smelting_purified_silver: 'Plata (purificada)',
  smelting_purified_gold: 'Oro (purificado)', smelting_purified_nickel: 'Níquel (purificado)', smelting_purified_platinum: 'Platino (purificado)',
  smelting_vanadium: 'Vanadio y plomo', blast_iron: 'Hierro (alto horno)', blast_steel_direct: 'Acero (reducción directa)', blast_steel_manganese: 'Acero (al manganeso)',
  crushing_copper_mill: 'Cobre triturado (molino)', crushing_tin_mill: 'Estaño triturado (molino)', crushing_iron_mill: 'Hierro triturado (molino)',
  pressing_brick: 'Ladrillo (prensado)', lathe_steel_rod: 'Varilla de acero (torno)', lathe_crystal_lens_sapphire: 'Lente (zafiro)',
  wiremill_gold_wire_electrum: 'Hilo de oro (electro)', wiremill_insulated_wire: 'Cable aislado (caucho)',
  assembling_motor_neodymium: 'Motor (neodimio)', assembling_turbine_titanium: 'Turbina (titanio)',
  mixing_concrete_stone: 'Hormigón (ciclópeo)', mixing_lubricant: 'Lubricante (grasa de resina)', mixing_magma_quench: 'Temple de magma',
  distilling_crude: 'Destilación de crudo', distilling_tar: 'Destilación de alquitrán', distilling_ethanol: 'Etanol (fibra)', distilling_ethanol_algae: 'Etanol (algas)', distilling_biofuel: 'Biocombustible (algas)',
  chemical_sulfuric_acid_air: 'Ácido sulfúrico (aire)', chemical_hydrochloric_acid_salt: 'Ácido clorhídrico (sal)', chemical_nitric_acid_saltpeter: 'Ácido nítrico (salitre)',
  chemical_hydrogen_reforming: 'Hidrógeno (reformado de gas)', chemical_plastic_ethanol: 'Plástico (bioetanol)', chemical_plastic_chitin: 'Plástico (quitina)',
  chemical_rubber_synthetic: 'Caucho (sintético)', chemical_fertilizer: 'Fertilizante (amoniaco)', chemical_rare_earth_oxide: 'Tierras raras y torio',
  refining_crude: 'Refinado de crudo', refining_cracking: 'Craqueo de queroseno', electrolysis_water: 'Electrólisis del agua', electrolysis_brine: 'Electrólisis de salmuera',
  electrolysis_zinc: 'Zinc (electrolítico)', centrifuge_air: 'Separación de aire', centrifuge_deuterium: 'Deuterio (centrifugado)', centrifuge_platinum: 'Platino (concentrado)',
  compressing_air: 'Aire comprimido', compressing_diamond: 'Diamante (alta presión)', arc_titanium_alloy: 'Titanio (aleación Ti-6-4)', arc_silicon: 'Silicio (arena)',
  vacuum_diamond: 'Diamante (deposición)', vacuum_silicon_wafer: 'Oblea (alta pureza)', fabrication_thermal_plate_alloy: 'Placa térmica (superaleación)',
  nuclear_fab_spent_fuel: 'Irradiación de blanco fértil', nuclear_fab_plutonium: 'Reprocesamiento', cryo_air: 'Destilación criogénica de aire', cryo_deuterium: 'Deuterio (criodestilación)',
  quantum_plasma_cell_void: 'Celda de plasma (esencia del vacío)', quantum_neutronium_void: 'Neutronio (catálisis del vacío)',
  hand_cloth: 'Tela (a mano)', smelting_bronze_direct: 'Bronce (cofusión de triturados)', smelting_glass_quartz: 'Vidrio (cuarzo)',
  pressing_copper_plate: 'Placa de cobre (prensa)', pressing_bronze_plate: 'Placa de bronce (prensa)', pressing_iron_plate: 'Placa de hierro (prensa)', pressing_lead_plate: 'Placa de plomo (prensa)',
  lathe_bronze_rod: 'Varilla de bronce (torno)', lathe_iron_rod: 'Varilla de hierro (torno)', chemical_coolant_glycol: 'Refrigerante (glicol)', chemical_alumina_sulfuric: 'Alúmina (sulfúrico)',
  arc_steel: 'Acero (arco eléctrico)', arc_stainless: 'Inoxidable (arco eléctrico)', vacuum_tungsten_carbide_direct: 'Carburo (reducción directa)', research_rp0_tools: 'Saber primitivo (herramientas)', ammo_bullet_smokeless: 'Cartucho (pólvora sin humo)'
};
for (const r of recipes) if (NAMES[r.id]) r.name = NAMES[r.id];

LD.Content.recipes = recipes;
})();
