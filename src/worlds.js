// What each building slot is in each world: name, product, color, 3D model, a true
// fact, and the customers who order from it. The economy numbers live in economy.js
// and are the same for every world; only the look and story change.

const C = (name, makes, unit, color, model, fact) => ({ name, makes, unit, color, model, fact });

export const SKINS = {
  colorado: {
    mine: C('Ore Mine', 'iron ore', 'ore', 0x8a6a4f, 'mine', 'Most iron ore is dug from huge open pits, then crushed and concentrated so it is rich enough to go into a furnace.'),
    furnace: C('Steel Furnace', 'steel', 'steel', 0xc75b3e, 'furnace', 'Most new steel comes from basic oxygen furnaces, which blow pure oxygen through molten iron to burn off extra carbon.'),
    press: C('Bolt Press', 'bolts', 'bolts', 0x4a86c8, 'press', 'Most bolts are cold-headed: a machine punches the head into cut steel wire, then the threads are rolled on, which makes them stronger than cut threads.'),
    gear: C('Gear Cutter', 'gears', 'gears', 0xe3a93a, 'gear', 'Gear teeth are shaped as involute curves, so two meshing gears keep a constant speed ratio as they turn.'),
    engine: C('Engine Line', 'engines', 'engines', 0x7f6bbf, 'engine', 'In a piston engine, the crankshaft turns the pistons’ up-and-down motion into rotation.'),
    turbine: C('Turbine Shop', 'turbines', 'turbines', 0x2fa39a, 'turbine', 'Jet engine turbine blades run in gas hotter than their own melting point. Cooling air through tiny internal channels and ceramic coatings keep them alive.'),
    rocket: C('Rocket Bay', 'rockets', 'rockets', 0xe8e4da, 'rocket', 'To stay in low Earth orbit, a rocket has to reach about 7.8 km/s, roughly 28,000 km/h.'),
    power: C('Power Plant', 'electricity', 'MW', 0x6f8fa8, 'power', 'The white plume from a power plant’s cooling tower is water vapor, not smoke: it is heat from the plant leaving as evaporating water.'),
    hq: C('Headquarters', 'managers', 'managers', 0x5b7a99, 'hq', 'Many factory towns grew around one company office, where managers planned shifts and sent supervisors out to each plant.'),
    datacenter: C('Data Center', 'compute', 'PFLOPS', 0x3d4b6b, 'datacenter', 'Data centers spend a big share of their electricity on cooling, because nearly all the power the servers use turns into heat.'),
  },
  // the Wild West: a frontier boom town of false-front timber buildings on dirt streets
  desert: {
    mine: C('Gold Mine', 'gold ore', 'ore', 0x8a6a45, 'goldmine', 'Gold doesn’t rust or tarnish, which is why gold coins dug up after centuries can still shine.'),
    furnace: C('Stamp Mill', 'gold', 'gold', 0xb5532a, 'stampmill', 'Stamp mills crushed ore with heavy iron stamps lifted by a turning camshaft and dropped over and over. The biggest could be heard for miles.'),
    press: C('Frontier Bank', 'gold coins', 'coins', 0x3f4a5c, 'bank', 'Many frontier banks kept their money in iron safes with time locks, which would not open before a set hour even for someone who knew the combination.'),
    gear: C('General Store', 'supplies', 'supplies', 0x6f8f5a, 'genstore', 'A frontier general store sold nearly everything a town needed, from flour and nails to boots, and often doubled as the post office.'),
    engine: C('Livery Stable', 'wagons', 'wagons', 0xa8643a, 'livery', 'Livery stables rented out horses and wagons and boarded travellers’ horses, a bit like a car rental and a parking garage in one.'),
    turbine: C('Railroad Depot', 'locomotives', 'locomotives', 0x9c3a2a, 'depot', 'The first railroad across the United States was finished in 1869, when the last spike was driven at Promontory Summit, Utah.'),
    rocket: C('Rocket Ranch', 'rockets', 'rockets', 0xd9c4a0, 'rocketranch', 'Robert Goddard launched the first liquid-fuelled rocket in 1926. It flew for about two and a half seconds and climbed about 12 metres.'),
    power: C('Windmill Farm', 'electricity', 'MW', 0x8a6a45, 'windmills', 'More than six million farm windmills were built in America between the 1850s and the 1970s, most of them pumping water for cattle.'),
    hq: C('The Saloon', 'managers', 'managers', 0x8a5a3a, 'saloon', 'Saloons often had swinging half doors, called batwing doors, that let the air through while hiding the room from the street.'),
    datacenter: C('Telegraph Office', 'compute', 'PFLOPS', 0x4a5a3a, 'telegraph', 'A good telegraph operator could send 30 or more words a minute in Morse code, and others on the line could often tell who it was by their “fist”, their sending style.'),
  },
  moon: {
    mine: C('Regolith Digger', 'regolith', 'regolith', 0x8f8f96, 'regolith', 'Moon dust, called regolith, is sharp and clingy because there is no wind or water on the Moon to wear the grains smooth.'),
    furnace: C('Helium-3 Refinery', 'helium-3', 'helium-3', 0x5c8fc0, 'he3', 'Helium-3 is rare on Earth but thought to be more common in lunar soil, delivered by the solar wind. Scientists study it as a possible fusion fuel.'),
    press: C('Fuel Cell Lab', 'fuel cells', 'fuel cells', 0x4fb3a8, 'fuelcell', 'Fuel cells make electricity by combining hydrogen and oxygen, and their only exhaust is water. Apollo spacecraft used them for power.'),
    gear: C('Habitat Printer', 'habitats', 'habitats', 0xd8d4c8, 'habitat', 'Engineers are testing 3D-printing buildings out of Moon dust, so astronauts won’t have to haul every building material from Earth.'),
    engine: C('Rover Garage', 'moon rovers', 'rovers', 0xc9a24a, 'lunarrover', 'The Apollo Lunar Roving Vehicle folded up to fit inside the lander. Astronauts drove one on three missions.'),
    turbine: C('Telescope Works', 'telescopes', 'telescopes', 0x6b5fb5, 'telescope', 'A radio telescope on the Moon’s far side would be shielded from Earth’s radio noise, which is why astronomers want to build one there.'),
    rocket: C('Starship Yard', 'starships', 'starships', 0xcfd3da, 'starship', 'Leaving the Moon takes far less speed than leaving Earth: about 2.4 km/s to escape the Moon versus about 11.2 km/s for Earth.'),
    power: C('Fusion Reactor', 'electricity', 'MW', 0x7a4fc0, 'fusion', 'Fusion reactors try to recreate what powers the Sun: fusing light atoms together to release energy.'),
    hq: C('Mission Control', 'managers', 'managers', 0xcfd3da, 'hqmoon', 'Radio signals take about 1.3 seconds to travel between the Earth and the Moon, so every conversation with Mission Control has a small delay.'),
    datacenter: C('Quantum Lab', 'compute', 'PFLOPS', 0x2d6a8f, 'quantum', 'Quantum computers use qubits that can hold a mix of 0 and 1 at once, and most kinds must be chilled close to absolute zero.'),
  },
  mars: {
    mine: C('Ice Driller', 'water ice', 'ice', 0x6fc3e0, 'icedrill', 'Mars has lots of water frozen as ice, at its poles and just under the dusty ground in many places.'),
    furnace: C('Oxygen Plant', 'oxygen', 'oxygen', 0x2fb5a0, 'oxyplant', 'Splitting water with electricity gives oxygen to breathe and hydrogen for rocket fuel.'),
    press: C('Greenhouse Dome', 'crops', 'crops', 0x5cc04a, 'greenhouse', 'Mars soil has many plant nutrients but also toxic salts, so it would need washing before crops could grow in it.'),
    gear: C('Brick Kiln', 'Mars bricks', 'bricks', 0xc0583a, 'brickworks', 'Engineers have made strong bricks just by squeezing Mars-like soil hard, without any baking or glue.'),
    engine: C('Hab Factory', 'habitats', 'habs', 0xe9eef2, 'habworks', 'Mars air is about 1% as thick as Earth\u2019s, so homes there must be sealed and pressurized like a spacecraft.'),
    turbine: C('Atmosphere Processor', 'air', 'air', 0x8a7fd0, 'atmos', 'NASA\u2019s MOXIE experiment on the Perseverance rover made oxygen from Mars\u2019 carbon dioxide air.'),
    rocket: C('Mars Spaceport', 'starships', 'starships', 0xdfe3e8, 'marsport', 'Mars and Earth line up for the shortest trip only about every 26 months.'),
    power: C('Wind Farm', 'electricity', 'MW', 0xf2f4f6, 'windfarm', 'Mars winds can whip dust into storms that cover the whole planet for weeks.'),
    hq: C('Colony Command', 'managers', 'managers', 0x2fb5a0, 'hqmars', 'A day on Mars, called a sol, lasts 24 hours and 39 minutes.'),
    datacenter: C('Ice Vault Data Center', 'compute', 'PFLOPS', 0x4f7fbf, 'icevault', 'Mars is cold (around -60\u00b0C on average), so a data center there could be cooled for free.'),
  },
  // Japan: temple workshops under curved grey tile roofs, white plaster and vermilion,
  // thatched farmhouses and a castle keep, in gardens of cherry trees, pines and koi ponds
  japan: {
    mine: C('Iron Sand Pit', 'iron sand', 'sand', 0x3a3a40, 'satetsu', 'Japanese swordsmiths’ steel was made from iron sand (satetsu), washed out of crushed hillsides by channels of running water.'),
    furnace: C('Tatara Furnace', 'tamahagane steel', 'steel', 0xc8502a, 'tatara', 'A tatara furnace burns for about three days and nights without stopping. Then it is broken open to take out the bloom of steel, and its best part is called tamahagane.'),
    press: C('Bladesmith Forge', 'katana', 'blades', 0x2f4f7a, 'kajiba', 'A Japanese swordsmith folds the steel over and over while forging, which spreads the carbon evenly and squeezes out bits of slag.'),
    gear: C('Karakuri Workshop', 'clockwork dolls', 'dolls', 0xc8342a, 'karakuri', 'Karakuri dolls are clockwork robots from the Edo period. The tea-serving doll walks to a guest when a cup is put on its tray and stops when the cup is lifted off.'),
    engine: C('Bullet Train Works', 'bullet trains', 'trains', 0x1f5fb0, 'shinkansen', 'The first Shinkansen bullet train line opened in 1964, between Tokyo and Osaka, just before the Tokyo Olympics.'),
    turbine: C('Robot Works', 'robots', 'robots', 0xe8622a, 'robotics', 'Japanese companies build a large share of the world’s industrial robots, the arms that weld, paint and assemble in factories.'),
    rocket: C('Tanegashima Spaceport', 'rockets', 'rockets', 0xd9302a, 'spaceportjp', 'Tanegashima Space Center, on an island south of Kyushu, is Japan’s largest rocket launch site, with its pads right beside the sea.'),
    power: C('Water Wheel Mill', 'electricity', 'MW', 0x6b4a30, 'waterwheel', 'For centuries, water wheels powered Japanese mills, lifting heavy wooden pounders to polish rice and grind grain.'),
    hq: C('Castle Keep', 'managers', 'managers', 0x2a2a2e, 'castle', 'Himeji Castle’s main keep was finished in 1609. Its white plastered walls, which also helped protect it from fire, earned it the name White Heron Castle.'),
    datacenter: C('Pagoda Data Center', 'compute', 'PFLOPS', 0xd2452c, 'pagoda', 'Tall wooden pagodas in Japan have stood through centuries of earthquakes. Each storey can sway on its own around a central pillar, the shinbashira.'),
  },
};

export const CUSTOMERS = {
  colorado: {
    mine: ['Ridgeline Smelter', 'Valley Steel Mill', 'Highland Foundry'],
    furnace: ['Valley Rail Yard', 'River Bridge Crew', 'Lakeside Shipyard'],
    press: ['Ridge Bike Works', 'Valley Builders', 'Riverside Stadium'],
    gear: ['Hilltop Wind Farm', 'Clock Tower Repair', 'Mountain Rail Co.'],
    engine: ['Summit Motors', 'Snowpeak Snowcat Co.', 'Valley Tractors'],
    turbine: ['Regional Airport Hangar', 'High Plains Power', 'Timberline Air Lines'],
    rocket: ['Space Agency', 'Orbital Freight Co.', 'Lunar Mining Group'],
  },
  desert: {
    mine: ['Assay Office', 'Prospectors’ Co-op', 'Frontier Mint'],
    furnace: ['Jeweller’s Shop', 'Territorial Mint', 'Gold Dust Exchange'],
    press: ['Cattle Barons', 'Railroad Payroll', 'Stagecoach Line'],
    gear: ['Homesteaders', 'Wagon Train', 'Mining Camp'],
    engine: ['Pony Express', 'Cattle Drive Outfit', 'Freight Company'],
    turbine: ['Transcontinental Line', 'Silver Mine Railway', 'Overland Express'],
    rocket: ['Steam Rocket Society', 'Frontier Sky Survey', 'Space Agency'],
  },
  mars: {
    mine: ['Colony Water Works', 'Ice Rink Club', 'Hydroponics Co-op'],
    furnace: ['Rocket Fuel Depot', 'Life Support Team', 'Breathable Air Co.'],
    press: ['Colony Canteen', 'Jezero Bakery', 'Seed Vault'],
    gear: ['Dome Builders', 'Canyon Bridge Crew', 'Road Pavers Guild'],
    engine: ['New Settlers League', 'Crater Hotel Mars', 'Science Station'],
    turbine: ['Terraforming Authority', 'Sky Thickeners Inc.', 'Weather Makers'],
    rocket: ['Jupiter Expedition', 'Belt Miners Union', 'Deep Space Fleet'],
  },
  moon: {
    mine: ['Habitat Builders', 'Lunar Brickworks', 'Crater Road Crew'],
    furnace: ['Fusion Fuel Depot', 'Earth Energy Exchange', 'Deep Space Labs'],
    press: ['Moonbase Life Support', 'Night Shift Power', 'Rover Charging Co.'],
    gear: ['Tranquility Settlers', 'Crater Hotel', 'Science Outpost'],
    engine: ['Ice Prospectors', 'Lunar Tour Co.', 'Rim Survey Team'],
    turbine: ['Far Side Observatory', 'Deep Sky Institute', 'Exoplanet Hunters'],
    rocket: ['Mars Colony Fleet', 'Asteroid Miners', 'Outer Planets Mission'],
  },
  japan: {
    mine: ['Village Tatara Guild', 'Mountain Smelters', 'Riverside Ironworks'],
    furnace: ['Swordsmiths’ Guild', 'Temple Bell Foundry', 'Shipwright Yard'],
    press: ['Castle Armory', 'Kendo Dojo', 'Imperial Museum'],
    gear: ['Festival Float Makers', 'Tea House Owners', 'Puppet Theatre'],
    engine: ['Tokaido Line', 'Hokkaido Express', 'Mountain Railway'],
    turbine: ['Car Assembly Plant', 'Hospital Helpers', 'Space Robotics Lab'],
    rocket: ['Space Agency', 'Asteroid Sample Mission', 'Lunar Explorers'],
  },
};

export const skin = (worldId, id) => (SKINS[worldId] || SKINS.colorado)[id] || SKINS.colorado[id];
