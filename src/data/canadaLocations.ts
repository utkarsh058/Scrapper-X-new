export interface CanadianProvince {
  name: string;
  code: string;
  type: 'PROVINCE' | 'TERRITORY';
  cities: string[];
}

export const CANADIAN_PROVINCES_AND_TERRITORIES: CanadianProvince[] = [
  // 10 Provinces
  {
    name: 'Ontario',
    code: 'ON',
    type: 'PROVINCE',
    cities: [
      'Toronto', 'Ottawa', 'Mississauga', 'Brampton', 'Hamilton',
      'London', 'Markham', 'Vaughan', 'Kitchener', 'Windsor',
      'Burlington', 'Greater Sudbury', 'Oshawa', 'Barrie', 'St. Catharines',
      'Cambridge', 'Kingston', 'Guelph', 'Thunder Bay', 'Waterloo',
      'Brantford', 'Pickering', 'Niagara Falls', 'Peterborough', 'Sault Ste. Marie',
      'Sarnia', 'Belleville', 'North Bay', 'Cornwall', 'Timmins',
      'Chatham-Kent', 'Woodstock', 'St. Thomas', 'Stratford', 'Orillia'
    ]
  },
  {
    name: 'Quebec',
    code: 'QC',
    type: 'PROVINCE',
    cities: [
      'Montreal', 'Quebec City', 'Laval', 'Gatineau', 'Longueuil',
      'Sherbrooke', 'Saguenay', 'Levis', 'Trois-Rivieres', 'Terrebonne',
      'Saint-Jean-sur-Richelieu', 'Brossard', 'Repentigny', 'Saint-Jerome', 'Drummondville'
    ]
  },
  {
    name: 'British Columbia',
    code: 'BC',
    type: 'PROVINCE',
    cities: [
      'Vancouver', 'Surrey', 'Burnaby', 'Richmond', 'Abbotsford',
      'Coquitlam', 'Kelowna', 'Victoria', 'Nanaimo', 'Kamloops',
      'Chilliwack', 'Prince George', 'Maple Ridge', 'New Westminster', 'Langley'
    ]
  },
  {
    name: 'Alberta',
    code: 'AB',
    type: 'PROVINCE',
    cities: [
      'Calgary', 'Edmonton', 'Red Deer', 'Lethbridge', 'St. Albert',
      'Medicine Hat', 'Grande Prairie', 'Airdrie', 'Spruce Grove', 'Leduc'
    ]
  },
  {
    name: 'Manitoba',
    code: 'MB',
    type: 'PROVINCE',
    cities: [
      'Winnipeg', 'Brandon', 'Steinbach', 'Thompson', 'Portage la Prairie',
      'Winkler', 'Selkirk', 'Morden', 'Dauphin'
    ]
  },
  {
    name: 'Saskatchewan',
    code: 'SK',
    type: 'PROVINCE',
    cities: [
      'Saskatoon', 'Regina', 'Prince Albert', 'Moose Jaw', 'Swift Current',
      'Yorkton', 'North Battleford', 'Lloydminster', 'Warman', 'Weyburn'
    ]
  },
  {
    name: 'Nova Scotia',
    code: 'NS',
    type: 'PROVINCE',
    cities: [
      'Halifax', 'Dartmouth', 'Sydney', 'Truro', 'New Glasgow',
      'Glace Bay', 'Kentville', 'Amherst', 'Bridgewater'
    ]
  },
  {
    name: 'New Brunswick',
    code: 'NB',
    type: 'PROVINCE',
    cities: [
      'Moncton', 'Saint John', 'Fredericton', 'Dieppe', 'Miramichi',
      'Edmundston', 'Bathurst', 'Campbellton'
    ]
  },
  {
    name: 'Newfoundland and Labrador',
    code: 'NL',
    type: 'PROVINCE',
    cities: [
      "St. John's", 'Mount Pearl', 'Corner Brook', 'Conception Bay South',
      'Grand Falls-Windsor', 'Paradise', 'Gander', 'Happy Valley-Goose Bay'
    ]
  },
  {
    name: 'Prince Edward Island',
    code: 'PE',
    type: 'PROVINCE',
    cities: [
      'Charlottetown', 'Summerside', 'Stratford', 'Cornwall', 'Montague'
    ]
  },
  // 3 Territories
  {
    name: 'Northwest Territories',
    code: 'NT',
    type: 'TERRITORY',
    cities: [
      'Yellowknife', 'Inuvik', 'Hay River', 'Fort Smith', 'Behchoko'
    ]
  },
  {
    name: 'Nunavut',
    code: 'NU',
    type: 'TERRITORY',
    cities: [
      'Iqaluit', 'Rankin Inlet', 'Arviat', 'Baker Lake', 'Cambridge Bay'
    ]
  },
  {
    name: 'Yukon',
    code: 'YT',
    type: 'TERRITORY',
    cities: [
      'Whitehorse', 'Dawson City', 'Watson Lake', 'Haines Junction'
    ]
  }
];

export function getCitiesForCanadianProvince(provinceNameOrCode: string): string[] {
  const clean = provinceNameOrCode.trim().toLowerCase();
  const prov = CANADIAN_PROVINCES_AND_TERRITORIES.find(
    p => p.name.toLowerCase() === clean || p.code.toLowerCase() === clean
  );
  return prov ? prov.cities : [];
}

export { validateAdministrativeRegion, type AdministrativeRegionValidationResult } from '@/lib/location/RegionRegistry';
