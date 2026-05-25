/**
 * NZ location cascade for the property address fields:
 *   Country → Region → District/City → Suburb (suggestion list; Autocomplete accepts free text)
 *
 * Regions = the 16 official NZ regions.
 * Districts = the 67 territorial authorities (cities + districts). For unitary authorities
 * (Auckland, Nelson, Gisborne, Tasman, Marlborough) the region and the territorial authority
 * are essentially the same — those regions have a single district entry.
 * Suburbs = a curated set for the major cities. Less-common suburbs can be typed freehand
 * via the Autocomplete component.
 *
 * Keep this file declarative and ASCII-friendly. We deliberately use plain "Manawatu-Whanganui"
 * and "Hawkes Bay" spellings (no macrons) so existing keyboards on Windows work without IME tricks;
 * the values are stored verbatim in the property table.
 */

export const COUNTRIES = [
  { code: 'NZ', name: 'New Zealand' },
];

export const NZ_REGIONS = [
  { name: 'Northland' },
  { name: 'Auckland' },
  { name: 'Waikato' },
  { name: 'Bay of Plenty' },
  { name: 'Gisborne' },
  { name: "Hawke's Bay" },
  { name: 'Taranaki' },
  { name: 'Manawatu-Whanganui' },
  { name: 'Wellington' },
  { name: 'Tasman' },
  { name: 'Nelson' },
  { name: 'Marlborough' },
  { name: 'West Coast' },
  { name: 'Canterbury' },
  { name: 'Otago' },
  { name: 'Southland' },
];

/** region name → array of district / city names */
export const NZ_DISTRICTS = {
  'Northland': ['Far North District', 'Kaipara District', 'Whangarei District'],
  'Auckland': ['Auckland'],
  'Waikato': [
    'Hamilton City', 'Hauraki District', 'Matamata-Piako District', 'Otorohanga District',
    'South Waikato District', 'Taupo District', 'Thames-Coromandel District', 'Waikato District',
    'Waipa District', 'Waitomo District',
  ],
  'Bay of Plenty': [
    'Kawerau District', 'Opotiki District', 'Rotorua Lakes District', 'Tauranga City',
    'Western Bay of Plenty District', 'Whakatane District',
  ],
  'Gisborne': ['Gisborne District'],
  "Hawke's Bay": [
    "Central Hawke's Bay District", 'Hastings District', 'Napier City', 'Wairoa District',
  ],
  'Taranaki': ['New Plymouth District', 'South Taranaki District', 'Stratford District'],
  'Manawatu-Whanganui': [
    'Horowhenua District', 'Manawatu District', 'Palmerston North City', 'Rangitikei District',
    'Ruapehu District', 'Tararua District', 'Whanganui District',
  ],
  'Wellington': [
    'Carterton District', 'Kapiti Coast District', 'Lower Hutt City', 'Masterton District',
    'Porirua City', 'South Wairarapa District', 'Upper Hutt City', 'Wellington City',
  ],
  'Tasman': ['Tasman District'],
  'Nelson': ['Nelson City'],
  'Marlborough': ['Marlborough District'],
  'West Coast': ['Buller District', 'Grey District', 'Westland District'],
  'Canterbury': [
    'Ashburton District', 'Christchurch City', 'Hurunui District', 'Kaikoura District',
    'Mackenzie District', 'Selwyn District', 'Timaru District', 'Waimakariri District',
    'Waimate District', 'Waitaki District',
  ],
  'Otago': [
    'Central Otago District', 'Clutha District', 'Dunedin City', 'Queenstown-Lakes District',
  ],
  'Southland': ['Gore District', 'Invercargill City', 'Southland District'],
};

/** district / city name → suggested suburb list. Anything not listed can be free-typed. */
export const NZ_SUBURBS = {
  'Auckland': [
    'Albany', 'Auckland CBD', 'Avondale', 'Birkenhead', 'Botany Downs', 'Browns Bay', 'Devonport',
    'Ellerslie', 'Epsom', 'Glen Eden', 'Glen Innes', 'Grey Lynn', 'Henderson', 'Herne Bay',
    'Howick', 'Manukau', 'Mission Bay', 'Mount Albert', 'Mount Eden', 'Mount Roskill',
    'Mount Wellington', 'New Lynn', 'Newmarket', 'North Shore', 'Onehunga', 'Otahuhu',
    'Pakuranga', 'Papakura', 'Parnell', 'Ponsonby', 'Pukekohe', 'Remuera', 'Royal Oak',
    'St Heliers', 'Takapuna', 'Westmere',
  ],
  'Wellington City': [
    'Aro Valley', 'Brooklyn', 'Hataitai', 'Houghton Bay', 'Island Bay', 'Johnsonville',
    'Karori', 'Kelburn', 'Khandallah', 'Kilbirnie', 'Lyall Bay', 'Miramar', 'Mount Cook',
    'Mount Victoria', 'Newtown', 'Ngaio', 'Northland', 'Oriental Bay', 'Owhiro Bay',
    'Roseneath', 'Seatoun', 'Strathmore Park', 'Tawa', 'Te Aro', 'Thorndon', 'Vogeltown',
    'Wadestown', 'Wellington Central', 'Wilton',
  ],
  'Lower Hutt City': [
    'Alicetown', 'Avalon', 'Belmont', 'Boulcott', 'Days Bay', 'Eastbourne', 'Epuni',
    'Hutt Central', 'Korokoro', 'Lower Hutt Central', 'Maungaraki', 'Naenae', 'Petone',
    'Stokes Valley', 'Taita', 'Wainuiomata', 'Waterloo', 'Woburn',
  ],
  'Upper Hutt City': [
    'Akatarawa', 'Birchville', 'Clouston Park', 'Ebdentown', 'Heretaunga', 'Kingsley Heights',
    'Maoribank', 'Pinehaven', 'Silverstream', 'Te Marua', 'Timberlea', 'Totara Park',
    'Trentham', 'Upper Hutt Central', 'Wallaceville',
  ],
  'Porirua City': [
    'Aotea', 'Camborne', 'Cannons Creek', 'Linden', 'Mana', 'Papakowhai', 'Paremata',
    'Pauatahanui', 'Plimmerton', 'Porirua CBD', 'Pukerua Bay', 'Titahi Bay', 'Waitangirua',
    'Whitby',
  ],
  'Kapiti Coast District': [
    'Otaki', 'Otaki Beach', 'Paekakariki', 'Paraparaumu', 'Paraparaumu Beach', 'Raumati Beach',
    'Raumati South', 'Waikanae', 'Waikanae Beach',
  ],
  'Hamilton City': [
    'Chartwell', 'Claudelands', 'Dinsdale', 'Enderley', 'Fairfield', 'Fairview Downs',
    'Flagstaff', 'Frankton', 'Glenview', 'Hamilton Central', 'Hamilton East', 'Hamilton Lake',
    'Hillcrest', 'Huntington', 'Maeroa', 'Melville', 'Nawton', 'Rototuna', 'Silverdale',
    'St Andrews', 'Te Rapa', 'Western Heights',
  ],
  'Tauranga City': [
    'Bellevue', 'Bethlehem', 'Brookfield', 'Gate Pa', 'Greerton', 'Judea', 'Matua',
    'Mount Maunganui', 'Otumoetai', 'Papamoa', 'Papamoa Beach', 'Parkvale', 'Pyes Pa',
    'Tauranga CBD', 'Tauriko', 'Welcome Bay',
  ],
  'Rotorua Lakes District': [
    'Fairy Springs', 'Fenton Park', 'Glenholme', 'Hillcrest', 'Kawaha Point', 'Mangakakahi',
    'Ngongotaha', 'Owhata', 'Pukehangi', 'Rotorua CBD', 'Springfield', 'Sunnybrook',
    'Tihiotonga', 'Western Heights',
  ],
  'New Plymouth District': [
    'Bell Block', 'Brooklands', 'Fitzroy', 'Frankleigh Park', 'Glen Avon', 'Highlands Park',
    'Inglewood', 'Lynmouth', 'Marfell', 'Merrilands', 'Moturoa', 'New Plymouth Central',
    'Oakura', 'Spotswood', 'Strandon', 'Vogeltown', 'Waitara', 'Westown', 'Whalers Gate',
  ],
  'Napier City': [
    'Ahuriri', 'Bay View', 'Bluff Hill', 'Greenmeadows', 'Marewa', 'Napier South', 'Onekawa',
    'Pirimai', 'Poraiti', 'Tamatea', 'Taradale', 'Westshore',
  ],
  'Hastings District': [
    'Akina', 'Camberley', 'Clive', 'Flaxmere', 'Frimley', 'Havelock North', 'Hastings Central',
    'Mahora', 'Mayfair', 'Parkvale', 'Raureka', 'St Leonards',
  ],
  'Palmerston North City': [
    'Aokautere', 'Awapuni', 'Cloverlea', 'Fitzherbert', 'Highbury', 'Hokowhitu', 'Kelvin Grove',
    'Linton', 'Milson', 'Palmerston North Central', 'Riverdale', 'Roslyn', 'Takaro',
    'Terrace End', 'West End',
  ],
  'Whanganui District': [
    'Aramoho', 'Bastia Hill', 'Castlecliff', 'College Estate', 'Durie Hill', 'Gonville',
    'Otamatea', 'Putiki', 'Springvale', 'St Johns Hill', 'Tawhero', 'Whanganui Central',
    'Whanganui East',
  ],
  'Whangarei District': [
    'Avenues', 'Kamo', 'Kensington', 'Maunu', 'Morningside', 'Onerahi', 'Otaika', 'Parahaki',
    'Raumanga', 'Regent', 'Riverside', 'Tikipunga', 'Whangarei Central', 'Whau Valley',
  ],
  'Christchurch City': [
    'Addington', 'Avonhead', 'Beckenham', 'Bishopdale', 'Bryndwr', 'Burnside', 'Burwood',
    'Cashmere', 'Christchurch Central', 'Fendalton', 'Halswell', 'Hornby', 'Ilam', 'Lyttelton',
    'Linwood', 'Merivale', 'New Brighton', 'Opawa', 'Papanui', 'Riccarton', 'Shirley',
    'Spreydon', 'St Albans', 'Sumner', 'Sydenham', 'Upper Riccarton', 'Wigram', 'Woolston',
  ],
  'Dunedin City': [
    'Andersons Bay', 'Brockville', 'Caversham', 'Concord', 'Corstorphine', 'Dunedin Central',
    'Forbury', 'Green Island', 'Halfway Bush', 'Kaikorai', 'Maori Hill', 'Maryhill',
    'Mornington', 'Mosgiel', 'Musselburgh', 'North East Valley', 'North Dunedin', 'Pine Hill',
    'Roslyn', 'St Clair', 'St Kilda', 'South Dunedin', 'Wakari', 'Waverley',
  ],
  'Queenstown-Lakes District': [
    'Arrowtown', 'Arthurs Point', 'Cromwell', 'Fernhill', 'Frankton', 'Kelvin Heights',
    'Kingston', 'Lake Hayes', 'Queenstown Central', 'Wanaka',
  ],
  'Invercargill City': [
    'Appleby', 'Avenal', 'Glengarry', 'Grasmere', 'Hawthorndale', 'Invercargill Central',
    'Kennington', 'Newfield', 'Otatara', 'Richmond', 'Rosedale', 'Strathern', 'Waikiwi',
    'Windsor',
  ],
  'Nelson City': [
    'Atawhai', 'Bishopdale', 'Brightwater', 'Britannia Heights', 'Enner Glynn', 'Maitai Valley',
    'Maitlands', 'Monaco', 'Nelson Central', 'Nelson South', 'Stoke', 'Tahunanui', 'The Wood',
    'Toi Toi', 'Victory', 'Wakatu',
  ],
  'Gisborne District': [
    'Awapuni', 'Elgin', 'Gisborne Central', 'Inner Kaiti', 'Kaiti', 'Mangapapa', 'Riverdale',
    'Tamarau', 'Te Hapara', 'Wainui Beach', 'Whataupoko',
  ],
};

export function regionsForCountry(country) {
  if (country !== 'NZ') return [];
  return NZ_REGIONS.map((r) => r.name);
}

export function districtsForRegion(region) {
  if (!region) return [];
  return NZ_DISTRICTS[region] ?? [];
}

export function suburbsForDistrict(district) {
  if (!district) return [];
  return NZ_SUBURBS[district] ?? [];
}
