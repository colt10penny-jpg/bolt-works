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
  desert: {
    mine: C('Sand Quarry', 'silica sand', 'sand', 0xd9a441, 'quarry', 'Most glass is made mainly from silica sand, melted together with soda ash and limestone.'),
    furnace: C('Glass Kiln', 'glass', 'glass', 0xc8643c, 'kiln', 'Most flat glass is made by floating molten glass on a bath of molten tin, which leaves it perfectly flat and smooth.'),
    press: C('Solar Panel Fab', 'solar panels', 'panels', 0x2f5fb0, 'solarfab', 'Most solar panels use silicon cells, which turn sunlight directly into electricity with no moving parts.'),
    gear: C('Battery Plant', 'batteries', 'batteries', 0x3fa35a, 'battery', 'Lithium-ion batteries store energy by moving lithium ions from one electrode to the other as they charge, and back as they discharge.'),
    engine: C('Drone Works', 'drones', 'drones', 0xe07b2a, 'drone', 'Quadcopters steer by spinning some propellers faster than others. Half the propellers spin the opposite way so the drone doesn’t twirl.'),
    turbine: C('Rover Factory', 'rovers', 'rovers', 0xb84a3a, 'rover', 'NASA engineers have tested Mars rover prototypes in the Mojave Desert, because its dry, rocky ground resembles Mars.'),
    rocket: C('Launch Pad', 'rockets', 'rockets', 0xd8d2c4, 'launchpad', 'Rockets are usually launched toward the east to pick up a free speed boost from Earth’s rotation.'),
    power: C('Solar Farm', 'electricity', 'MW', 0x2a4f8f, 'solarfarm', 'A solar farm’s output peaks around midday, so many are paired with big batteries to keep power flowing after sunset.'),
    hq: C('Desert HQ', 'managers', 'managers', 0xd9b38c, 'hqdesert', 'Thick adobe walls soak up the desert sun by day and release the heat at night, keeping the inside comfortable.'),
    datacenter: C('Desert Data Center', 'compute', 'PFLOPS', 0xb8946a, 'datacenterdesert', 'Data centers in dry places can use evaporative cooling, which works best when the air is hot and dry.'),
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
    mine: ['Barstow Glassworks', 'Dune Builders', 'Mojave Cement Co.'],
    furnace: ['Vegas Skyline Windows', 'Greenhouse Growers', 'Palm Springs Spa'],
    press: ['Rooftop Solar Co.', 'Desert Sun Utility', 'Off-Grid Ranches'],
    gear: ['EV Truck Fleet', 'Night Grid Storage', 'Rover Test Team'],
    engine: ['Wildfire Watch', 'Desert Mail Drones', 'Film Crew Aerials'],
    turbine: ['Mars Prep Lab', 'Dune Racing League', 'Canyon Survey Team'],
    rocket: ['Satellite Startup', 'Weather Service', 'Space Agency'],
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
};

export const skin = (worldId, id) => (SKINS[worldId] || SKINS.colorado)[id] || SKINS.colorado[id];
