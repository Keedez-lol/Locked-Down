(() => {
'use strict';
const LD = window.LD;
LD.Content = LD.Content || {};

/* ── deposits: freq = expected veins per 1000 tiles (world.js weights rare ones towards the outer ring), size = tiles per vein,
      amount = units per tile (null → infinite everywhere; the outer ring is infinite regardless) ── */
const D = (res, hardness, freq, size, amount, fluid) => ({ res, hardness, freq, size, amount, fluid: !!fluid, infinite: amount === null });
const F = (res, hardness, freq, size, amount) => D(res, hardness, freq, size, amount, true);

const layers = [
  { idx: 0, id: 'surface', name: 'Superficie', w: 256, h: 192, chunk: 16, ambient: 0.95, tint: '#c9c9b8', heat: false,
    unlockedBy: null, borerTier: 0, rockBase: 1, rockPerChunk: 0.35, waveBase: 720, music: 'surface',
    terrains: ['grass', 'forest', 'dirt', 'sand', 'water', 'rock', 'clay', 'bog', 'saltflat', 'gravel'],
    deposits: [
      D('copper_ore', 0, 0.30, [3, 6], [900, 2500]),
      D('tin_ore', 0, 0.24, [3, 5], [800, 2200]),
      D('iron_ore', 0, 0.16, [3, 5], [800, 2200]),
      D('coal', 0, 0.12, [3, 6], [1000, 2500])
    ],
    enemies: ['wolf', 'boar', 'bear'],
    desc: 'Llanura templada con bosques, ríos y afloramientos donde se levanta el almacén central; toda la extensión es edificable sin excavar. Los yacimientos someros son pequeños y se agotan, salvo en el anillo exterior, donde la mena es inagotable.',
    lore: 'El cielo está sellado. Lo único que queda por explorar está debajo.' },

  { idx: 1, id: 'caves', name: 'Cuevas someras', w: 128, h: 96, chunk: 16, ambient: 0.35, tint: '#3b3a38', heat: false,
    unlockedBy: 'shaft_coal', borerTier: 2, rockBase: 1, rockPerChunk: 0.35, waveBase: 780, music: 'caves',
    terrains: ['cave_floor', 'cave_wall', 'cave_water', 'rubble', 'coal_seam'],
    deposits: [
      D('coal', 1, 2.4, [5, 14], [2000, 5000]),
      D('iron_ore', 1, 1.2, [4, 10], [1800, 5000]),
      D('limestone', 1, 1.1, [5, 12], [1500, 5000]),
      D('sulfur', 1, 0.7, [3, 7], [1500, 4000]),
      D('saltpeter', 1, 0.6, [3, 6], [1500, 4000]),
      D('salt', 1, 0.5, [3, 6], [1500, 4500]),
      D('flint', 1, 0.45, [2, 5], [1000, 3000]),
      F('crude_oil', 2, 0.4, [3, 6], [4000, 12000])
    ],
    enemies: ['cave_bat', 'cave_spider', 'armored_mole'],
    desc: 'Red de galerías kársticas a treinta metros bajo la superficie, con vetas de hulla a la vista y bolsas de petróleo en la roca más dura. Cada bloque nace como roca maciza y una tuneladora de vapor lo abre; la oscuridad es total sin lámparas.',
    lore: 'El primer pozo se hundió buscando carbón. Lo que subió por el elevador, además del carbón, fueron los murciélagos.' },

  { idx: 2, id: 'deep', name: 'Profundidad media', w: 128, h: 96, chunk: 16, ambient: 0.30, tint: '#2f3440', heat: false,
    unlockedBy: 'shaft_deep', borerTier: 3, rockBase: 2, rockPerChunk: 0.40, waveBase: 840, music: 'deep',
    terrains: ['deep_floor', 'deep_wall', 'crystal_floor', 'deep_water', 'rubble'],
    deposits: [
      D('copper_ore', 2, 1.2, [4, 9], [1800, 5000]),
      D('zinc_ore', 2, 1.0, [4, 9], [1800, 5000]),
      D('quartz', 2, 1.0, [4, 9], [1800, 5000]),
      D('tin_ore', 2, 0.8, [3, 7], [1500, 4500]),
      D('lead_ore', 2, 0.8, [4, 8], [1500, 5000]),
      D('nickel_ore', 2, 0.8, [4, 8], [1500, 5000]),
      D('bauxite', 2, 0.8, [4, 9], [1800, 5000]),
      D('coal', 2, 0.7, [4, 10], [2000, 5000]),
      D('limestone', 2, 0.6, [4, 10], [1500, 5000]),
      D('chromite', 3, 0.45, [3, 7], [1500, 4500]),
      D('manganese_ore', 3, 0.45, [3, 7], [1500, 4500]),
      D('silver_ore', 3, 0.35, [3, 6], [1500, 4000]),
      D('gold_ore', 3, 0.30, [3, 5], [1500, 4000]),
      D('amethyst', 3, 0.30, [3, 6], [1500, 4000]),
      F('natural_gas', 3, 0.4, [3, 6], [6000, 16000])
    ],
    enemies: ['crystal_golem', 'silica_swarm', 'quartz_serpent'],
    desc: 'Estrato metamórfico de roca dura y suelos cristalinos que emiten una luz azulada propia; la roca exige tuneladora eléctrica y su dureza dobla la de las cuevas. Aquí se concentran los metales no férreos, el cuarzo y las bolsas de gas natural.',
    lore: 'Los cristales cantan cuando pasa una cinta transportadora. Los mineros aprendieron pronto a distinguir ese canto del de los gólems.' },

  { idx: 3, id: 'abyss', name: 'Profundidad profunda', w: 112, h: 80, chunk: 16, ambient: 0.25, tint: '#3a2a26', heat: false,
    unlockedBy: 'shaft_abyss', borerTier: 5, rockBase: 4, rockPerChunk: 0.45, waveBase: 900, music: 'abyss',
    terrains: ['abyss_floor', 'abyss_wall', 'obsidian_floor', 'magma', 'vent'],
    deposits: [
      D('rutile', 4, 1.1, [4, 9], [2500, 8000]),
      D('basalt', 4, 1.0, [5, 12], [3000, 8000]),
      D('wolframite', 4, 0.9, [3, 7], [2500, 7000]),
      D('obsidian', 4, 0.8, [4, 9], [2500, 7000]),
      D('cobalt_ore', 4, 0.8, [3, 7], [2000, 7000]),
      D('spodumene', 4, 0.7, [3, 7], [2000, 7000]),
      D('molybdenite', 4, 0.7, [3, 6], [2000, 6500]),
      D('fluorite', 4, 0.6, [3, 6], [2000, 6500]),
      D('uraninite', 5, 0.5, [3, 6], [2000, 6000]),
      D('monazite', 5, 0.45, [3, 6], [2000, 6000]),
      D('vanadinite', 5, 0.45, [3, 6], [2000, 6000]),
      D('thorite', 5, 0.4, [3, 5], [2000, 6000]),
      D('platinum_ore', 5, 0.4, [3, 5], [2000, 5500]),
      D('diamond_raw', 5, 0.4, [2, 4], [2000, 5000]),
      D('ruby_raw', 5, 0.4, [2, 4], [2000, 5000]),
      D('sapphire_raw', 5, 0.4, [2, 4], [2000, 5000])
    ],
    enemies: ['magma_salamander', 'titan_beetle', 'basalt_colossus'],
    desc: 'Zona abisal de basalto columnar cruzada por charcas de magma y fumarolas geotérmicas; solo la tuneladora láser muerde una roca cuatro veces más dura que la de las cuevas. Es el único estrato con titanio, wolframio, uranio, torio y gemas.',
    lore: 'A esta profundidad la roca no está fría. Los planos lo anotan con una sola palabra en el cajetín: CALOR.' },

  { idx: 4, id: 'core', name: 'Núcleo', w: 96, h: 64, chunk: 16, ambient: 0.20, tint: '#241c33', heat: true,
    unlockedBy: 'shaft_core', borerTier: 7, rockBase: 7, rockPerChunk: 0.5, waveBase: 960, music: 'core',
    terrains: ['core_floor', 'core_wall', 'magma_sea', 'plasma_floor', 'void_crack'],
    deposits: [
      D('corestone', 6, 1.3, [4, 10], [4000, 12000]),
      D('iridium_ore', 6, 1.0, [3, 7], [3500, 11000]),
      D('plasma_crystal', 6, 0.95, [3, 7], [3000, 10000]),
      D('osmium_ore', 6, 0.85, [3, 7], [3500, 11000]),
      D('neutronium_ore', 7, 0.6, [3, 6], [3000, 9000]),
      F('magma', 6, 0.8, [3, 7], null),
      F('deuterium_brine', 6, 0.7, [3, 6], null),
      F('helium3', 7, 0.6, [3, 6], null)
    ],
    enemies: ['void_wraith', 'plasma_devourer', 'core_guardian'],
    desc: 'Frontera del núcleo planetario: mares de magma, suelos de plasma confinado y grietas por las que se filtra el vacío. El calor degrada toda estructura sin blindaje térmico y la roca solo cede ante la tuneladora de plasma; a cambio, magma, salmuera de deuterio y helio-3 brotan sin agotarse.',
    lore: 'Aquí termina el plano. Lo que hay más abajo no tiene número de dibujo.' }
];

/* ── terrains: flags read by World.terrainFlags (walkable/buildable/solid/water/magma/rock); natural = hand-gather item ── */
const terrains = [];
const T = (id, name, layer, o, desc) => {
  terrains.push(Object.assign({ id, name, layer, walkable: true, buildable: true, solid: false, water: false, magma: false, rock: false, natural: null, light: 0, color: '#555', desc }, o));
};
const solid = { walkable: false, buildable: false, solid: true, rock: true };
const liquid = { walkable: false, buildable: false, water: true };
const molten = { walkable: false, buildable: false, magma: true };
const nat = (item, rate) => ({ item, rate: rate || 1 });

/* L0 */
T('grass', 'Pradera', 0, { color: '#5f6b45', natural: nat('plant_fiber') }, 'Herbazal abierto y llano, el terreno de construcción por defecto. A mano rinde fibra vegetal.');
T('forest', 'Bosque', 0, { color: '#3f5233', natural: nat('stick') }, 'Masa arbórea que el leñador convierte en troncos y que rebrota con lentitud. A mano se recogen varas.');
T('dirt', 'Tierra', 0, { color: '#6b5a45' }, 'Suelo desnudo y compactado de sendas y claros secos. Edificable, sin recurso natural.');
T('sand', 'Arena', 0, { color: '#b8a97e', natural: nat('sand') }, 'Playa silícea en la orilla de los lagos. Materia prima del vidrio, extraíble con el arenero.');
T('water', 'Agua', 0, Object.assign({ color: '#3f5f73' }, liquid), 'Lagos y ríos: ni se pisa ni se edifica. Las ruedas hidráulicas y las bombas deben tocarla.');
T('rock', 'Roca', 0, { color: '#6e6a63', rock: true, natural: nat('stone') }, 'Afloramiento de roca madre. Sede de la cantera y fuente de piedra y sílex a mano.');
T('clay', 'Arcilla', 0, { color: '#8a6a52', natural: nat('clay') }, 'Depósito plástico junto a los cursos de agua. La barrera de arcilla lo explota para el ladrillo.');
T('bog', 'Turbera', 0, { color: '#4d5a3d', natural: nat('peat') }, 'Humedal ácido de materia vegetal semidescompuesta. Combustible pobre pero inmediato.');
T('saltflat', 'Salar', 0, { color: '#cfc8b4', natural: nat('salt') }, 'Costra de evaporitas en las hondonadas secas. Las salinas obtienen sal con agua.');
T('gravel', 'Grava', 0, { color: '#8c877c', natural: nat('gravel') }, 'Derrubios de pedregal y vados de río. Árido de hormigón y lecho de cimentación.');
/* L1 */
T('cave_floor', 'Suelo de cueva', 1, { color: '#46433f' }, 'Suelo calizo de las galerías excavadas. Edificable en cuanto el bloque está abierto.');
T('cave_wall', 'Roca de cueva', 1, Object.assign({ color: '#2b2927' }, solid), 'Roca maciza sin excavar o pilar de sostén. Impide el paso y la construcción.');
T('cave_water', 'Agua subterránea', 1, Object.assign({ color: '#2e4552' }, liquid), 'Lago freático de aguas frías. Sirve de toma para las bombas del estrato.');
T('rubble', 'Escombros', 1, { color: '#5a5651', layers: [1, 2, 3, 4], natural: nat('stone') }, 'Derrumbe de bloques sueltos, presente en todos los estratos inferiores, por el que se filtra la fauna. A mano rinde piedra.');
T('coal_seam', 'Veta de carbón', 1, { color: '#2a2a2b' }, 'Capa de hulla expuesta en el suelo de la galería. Se explota con perforadoras.');
/* L2 */
T('deep_floor', 'Suelo profundo', 2, { color: '#3e424a' }, 'Suelo metamórfico gris azulado de las profundidades. Terreno de construcción del estrato.');
T('deep_wall', 'Roca profunda', 2, Object.assign({ color: '#262a31' }, solid), 'Gneis compacto sin excavar. Exige tuneladora eléctrica.');
T('crystal_floor', 'Suelo cristalino', 2, { color: '#5a5f7a', light: 0.5 }, 'Lecho de cuarzo que emite una luz azulada propia. Ilumina sin lámparas y es edificable.');
T('deep_water', 'Agua profunda', 2, Object.assign({ color: '#2c3e5a' }, liquid), 'Acuífero profundo de aguas mineralizadas. Toma para bombas.');
/* L3 */
T('abyss_floor', 'Suelo abisal', 3, { color: '#3a2f2b' }, 'Suelo basáltico caliente de las cámaras abisales. Edificable una vez abierto el bloque.');
T('abyss_wall', 'Roca abisal', 3, Object.assign({ color: '#221b19' }, solid), 'Basalto columnar sin excavar. Solo cede ante la tuneladora láser.');
T('obsidian_floor', 'Suelo de obsidiana', 3, { color: '#1f1c22', natural: nat('obsidian') }, 'Colada de vidrio volcánico enfriado. A mano se desprende obsidiana.');
T('magma', 'Magma', 3, Object.assign({ color: '#c8501f', light: 0.8 }, molten), 'Charca de roca fundida: ni se pisa ni se edifica. Ilumina su entorno.');
T('vent', 'Fumarola', 3, { color: '#4a3a33', light: 0.3 }, 'Salida geotérmica de gases a presión. Sede obligatoria de la central geotérmica.');
/* L4 */
T('core_floor', 'Suelo del núcleo', 4, { color: '#2b2434' }, 'Corteza mineral del límite del núcleo. Edificable, pero el calor degrada lo que no lleve blindaje térmico.');
T('core_wall', 'Roca del núcleo', 4, Object.assign({ color: '#16111c' }, solid), 'Roca ultradensa sin excavar. Solo la tuneladora de plasma la atraviesa.');
T('magma_sea', 'Mar de magma', 4, Object.assign({ color: '#d4602a', light: 1 }, molten), 'Extensión de magma inagotable que ilumina el estrato. Intransitable e inedificable.');
T('plasma_floor', 'Suelo de plasma', 4, { color: '#3a3b66', light: 0.7 }, 'Suelo con plasma confinado en la red cristalina, de brillo violeta. Edificable.');
T('void_crack', 'Grieta del vacío', 4, { color: '#0e0a14', buildable: false, light: 0.2 }, 'Fisura por la que se filtran los entes del vacío. Se puede cruzar, pero no edificar encima.');

LD.Content.layers = layers;
LD.Content.terrains = terrains;
})();
