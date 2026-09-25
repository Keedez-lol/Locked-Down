(() => {
'use strict';
const LD = window.LD;
LD.Content = LD.Content || {};
const enemies = [];
/* E(id, name, layer, {hp, speed, dmg, armor, armorType, size, color, color2, sfx, drops, threat, boss?, night?, attackRate?}, desc, lore?) */
const E = (id, name, layer, s, desc, lore) => {
  enemies.push(Object.assign({
    id, name, layer, hp: 10, speed: 1, dmg: 1, attackRate: s.boss ? 0.6 : 1, armor: 0, armorType: 'none', size: 0.8,
    color: '#8a8378', color2: '#3a3733', sprite: id, sfx: 'growl', drops: {}, threat: 1, boss: false, night: false, desc, lore: lore || ''
  }, s));
};

/* ── L0 Superficie · fauna sin blindaje · daño cinético pleno ── */
E('wolf', 'Lobo', 0, { hp: 30, speed: 2.4, dmg: 4, size: 0.6, color: '#8a8378', color2: '#3a3733', sfx: 'growl', drops: { hide: 1, sinew: 0.5 }, threat: 1, night: true },
  'Cánido de manada que caza al anochecer y se orienta por el olor del almacén. Frágil de forma individual: una torre de vigía lo abate en cinco flechas.');
E('boar', 'Jabalí', 0, { hp: 90, speed: 1.6, dmg: 8, size: 0.8, color: '#6e5a48', color2: '#2e241c', sfx: 'growl', drops: { hide: 1, bone: 1, sinew: 0.5 }, threat: 2 },
  'Suido de pelaje hirsuto y espaldar grueso que embiste en línea recta contra la primera estructura que le cierra el paso. Aguanta el triple que un lobo y destroza empalizadas si se le deja tiempo.');
E('bear', 'Oso', 0, { hp: 400, speed: 1.4, dmg: 20, size: 1.2, color: '#5a4838', color2: '#241c14', sfx: 'growl', drops: { hide: 4, bone: 4, sinew: 3 }, threat: 4, boss: true, night: true },
  'Úrsido de gran tamaño que baja de las crestas rocosas con las migraciones nocturnas. Cada zarpazo arranca veinte puntos de integridad; conviene recibirlo con balistas y un doble anillo de muro.',
  'Los primeros colonos lo llamaron «el que llama a la puerta»: siempre ataca el mismo tramo de empalizada hasta abrirlo.');

/* ── L1 Cuevas someras · quitina · vulnerable al calor, resiste lo eléctrico ── */
E('cave_bat', 'Murciélago gigante', 1, { hp: 40, speed: 3.2, dmg: 3, size: 0.5, color: '#5c5560', color2: '#26222a', sfx: 'screech', drops: { chitin: 1 }, threat: 1 },
  'Quiróptero cavernícola de envergadura métrica que vuela en bandadas siguiendo las corrientes de aire del pozo. Muy rápido y muy frágil: su único peligro es llegar en número.');
E('cave_spider', 'Araña de cueva', 1, { hp: 120, speed: 2.0, dmg: 8, armor: 3, armorType: 'chitin', size: 0.7, color: '#4e4a3c', color2: '#1e1c16', sfx: 'screech', drops: { chitin: 2 }, threat: 2 },
  'Arácnido de exoesqueleto quitinoso que absorbe tres puntos de cada impacto cinético. Se desplaza por escombros y muros con la misma facilidad y ataca cualquier cable o tubería que roza su camino.');
E('armored_mole', 'Topo acorazado', 1, { hp: 900, speed: 1.0, dmg: 25, armor: 8, armorType: 'chitin', size: 1.1, color: '#6b5e4e', color2: '#2c2620', sfx: 'screech', drops: { chitin: 5, bone: 3 }, threat: 4, boss: true },
  'Excavador ciego cubierto de placas quitinosas solapadas que anulan las flechas y reducen a un tercio los virotes de balista. Abre brecha por el muro más débil y arrasa la maquinaria que encuentra tras él.',
  'Sus galerías aparecen en los planos de las cuevas como líneas discontinuas: los topógrafos no se atreven a levantarlas.');

/* ── L2 Profundidad media · cristal · lo eléctrico lo rompe, lo cinético rebota ── */
E('crystal_golem', 'Gólem de cristal', 2, { hp: 600, speed: 1.0, dmg: 22, armor: 12, armorType: 'crystal', size: 1.0, color: '#7d8ea8', color2: '#3a4358', sfx: 'crystal_chime', drops: { crystal_shard: 2 }, threat: 2 },
  'Agregado de cuarzo y feldespato que se mueve por resonancia piezoeléctrica. La red cristalina desvía la mitad del daño cinético, pero una bobina Tesla lo hace vibrar hasta fracturarlo.');
E('silica_swarm', 'Enjambre de sílice', 2, { hp: 60, speed: 2.8, dmg: 4, armor: 4, armorType: 'crystal', size: 0.5, color: '#a8b4c0', color2: '#56606c', sfx: 'crystal_chime', drops: { crystal_shard: 1 }, threat: 1 },
  'Nube de esquirlas silíceas que se desplaza como un solo organismo y erosiona el metal por abrasión. Cada unidad es débil; el problema es que llegan por decenas.');
E('quartz_serpent', 'Serpiente de cuarzo', 2, { hp: 2600, speed: 1.6, dmg: 45, armor: 15, armorType: 'crystal', size: 1.4, color: '#9aa6bc', color2: '#40485c', sfx: 'crystal_chime', drops: { crystal_shard: 3, quartz: 4 }, threat: 4, boss: true },
  'Ofidio segmentado de vértebras de cuarzo que serpentea entre los pilares a velocidad de carga. Su blindaje cristalino de quince puntos deja inútil todo lo que no sea artillería pesada o descarga eléctrica.',
  'Los mineros dicen que se oye antes de verse: un tintineo de vidrio que recorre las galerías.');

/* ── L3 Profundidad profunda · basalto · casi inmune a lo cinético, sensible al plasma ── */
E('magma_salamander', 'Salamandra de magma', 3, { hp: 1200, speed: 2.2, dmg: 40, armor: 20, armorType: 'basalt', size: 0.8, color: '#b4562c', color2: '#4a2014', sfx: 'magma_roar', drops: { heat_gland: 1, basalt: 2 }, threat: 1 },
  'Anfibio termófilo que emerge de las charcas de magma con la piel vitrificada en costras de basalto. Rápida y agresiva, funde cables y tuberías al contacto.');
E('titan_beetle', 'Escarabajo de titanio', 3, { hp: 3500, speed: 0.9, dmg: 60, armor: 35, armorType: 'basalt', size: 1.2, color: '#4c4a48', color2: '#1c1a18', sfx: 'magma_roar', drops: { heat_gland: 1, basalt: 3 }, threat: 2 },
  'Coleóptero acorazado cuyos élitros incorporan rutilo cristalizado: treinta y cinco puntos de blindaje que anulan cañones y ametralladoras. Lento pero imparable, tritura muros de titanio mandíbula a mandíbula.');
E('basalt_colossus', 'Coloso basáltico', 3, { hp: 12000, speed: 0.7, dmg: 150, armor: 60, armorType: 'basalt', size: 1.6, color: '#3e3a38', color2: '#c85a2a', sfx: 'magma_roar', drops: { heat_gland: 3, basalt: 8, obsidian: 2 }, threat: 4, boss: true },
  'Masa de basalto columnar animada por un núcleo de magma que se ve latir entre las grietas. Cada golpe demuele ciento cincuenta puntos de estructura; solo los láseres concentrados o el plasma perforante le hacen mella.',
  'Se levanta de la propia roca del estrato: donde cae, queda un afloramiento de obsidiana.');

/* ── L4 Núcleo · vacío · solo lo hiere plasma o calor perforante ── */
E('void_wraith', 'Ente del vacío', 4, { hp: 5000, speed: 2.6, dmg: 120, armor: 40, armorType: 'void', size: 0.9, color: '#5a4a7a', color2: '#1a1226', sfx: 'void_whisper', drops: { void_essence: 1 }, threat: 1 },
  'Entidad de materia no clásica que surge de las grietas del vacío y atraviesa el estrato a gran velocidad. Los proyectiles y las descargas lo cruzan sin efecto: solo el plasma perforante interactúa con su estructura.');
E('plasma_devourer', 'Devorador de plasma', 4, { hp: 15000, speed: 1.2, dmg: 300, armor: 80, armorType: 'void', size: 1.3, color: '#4a3c68', color2: '#8a6ad0', sfx: 'void_whisper', drops: { void_essence: 2 }, threat: 2 },
  'Organismo que se alimenta de plasma confinado y busca los reactores de fusión como una polilla la luz. Su envoltura absorbe ochenta puntos por impacto y resiste tres veces más que un ente del vacío.');
E('core_guardian', 'Guardián del núcleo', 4, { hp: 60000, speed: 0.8, dmg: 800, armor: 150, armorType: 'void', size: 1.6, color: '#2a2036', color2: '#c86ae0', sfx: 'void_whisper', drops: { void_essence: 3, plasma_crystal: 2 }, threat: 4, boss: true },
  'Estructura inmensa de esencia del vacío condensada que patrulla el perímetro del núcleo planetario. Ochocientos puntos de daño por golpe y sesenta mil de integridad: exige una batería de torretas de plasma y muros térmicos en profundidad.',
  'No hay registro de que nadie lo haya visto entero. Los sensores dibujan un contorno; el resto lo completa el miedo.');

LD.Content.enemies = enemies;
})();
