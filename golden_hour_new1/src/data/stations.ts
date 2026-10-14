export interface WesternStation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  zone: string;
}

export const WESTERN_LINE_STATIONS: WesternStation[] = [
  { id: 'churchgate', name: 'Churchgate Station', lat: 18.9322, lng: 72.8264, zone: 'South Mumbai' },
  { id: 'marine-lines', name: 'Marine Lines Station', lat: 18.9447, lng: 72.8236, zone: 'South Mumbai' },
  { id: 'charni-road', name: 'Charni Road Station', lat: 18.9519, lng: 72.8193, zone: 'South Mumbai' },
  { id: 'grant-road', name: 'Grant Road Station', lat: 18.9633, lng: 72.8159, zone: 'South Mumbai' },
  { id: 'mumbai-central', name: 'Mumbai Central Station', lat: 18.9712, lng: 72.8197, zone: 'Mumbai Central - Parel' },
  { id: 'mahalaxmi', name: 'Mahalaxmi Station', lat: 18.9827, lng: 72.8242, zone: 'Mumbai Central - Parel' },
  { id: 'lower-parel', name: 'Lower Parel Station', lat: 18.9953, lng: 72.8306, zone: 'Mumbai Central - Parel' },
  { id: 'prabhadevi', name: 'Prabhadevi Station', lat: 19.0146, lng: 72.8290, zone: 'Mumbai Central - Parel' },
  { id: 'dadar', name: 'Dadar Station', lat: 19.0178, lng: 72.8478, zone: 'Dadar - Mahim' },
  { id: 'matunga-road', name: 'Matunga Road Station', lat: 19.0289, lng: 72.8427, zone: 'Dadar - Mahim' },
  { id: 'mahim', name: 'Mahim Station', lat: 19.0410, lng: 72.8422, zone: 'Dadar - Mahim' },
  { id: 'bandra', name: 'Bandra Station', lat: 19.0544, lng: 72.8402, zone: 'Bandra - Khar' },
  { id: 'khar-road', name: 'Khar Road Station', lat: 19.0694, lng: 72.8384, zone: 'Bandra - Khar' },
  { id: 'santacruz', name: 'Santacruz Station', lat: 19.0818, lng: 72.8409, zone: 'Santacruz - Vile Parle' },
  { id: 'vile-parle', name: 'Vile Parle Station', lat: 19.0998, lng: 72.8438, zone: 'Santacruz - Vile Parle' },
  { id: 'andheri', name: 'Andheri Station', lat: 19.1197, lng: 72.8464, zone: 'Andheri - Jogeshwari' },
  { id: 'jogeshwari', name: 'Jogeshwari Station', lat: 19.1362, lng: 72.8489, zone: 'Andheri - Jogeshwari' },
  { id: 'ram-mandir', name: 'Ram Mandir Station', lat: 19.1517, lng: 72.8503, zone: 'Andheri - Jogeshwari' },
  { id: 'goregaon', name: 'Goregaon Station', lat: 19.1648, lng: 72.8492, zone: 'Goregaon - Malad' },
  { id: 'malad', name: 'Malad Station', lat: 19.1860, lng: 72.8486, zone: 'Goregaon - Malad' },
  { id: 'kandivali', name: 'Kandivali Station', lat: 19.2045, lng: 72.8522, zone: 'Kandivali - Borivali - Dahisar' },
  { id: 'borivali', name: 'Borivali Station', lat: 19.2290, lng: 72.8573, zone: 'Kandivali - Borivali - Dahisar' },
  { id: 'dahisar', name: 'Dahisar Station', lat: 19.2503, lng: 72.8592, zone: 'Kandivali - Borivali - Dahisar' },
  { id: 'mira-road', name: 'Mira Road Station', lat: 19.2812, lng: 72.8559, zone: 'Mira Road - Bhayandar' },
  { id: 'bhayandar', name: 'Bhayandar Station', lat: 19.3082, lng: 72.8520, zone: 'Mira Road - Bhayandar' },
  { id: 'naigaon', name: 'Naigaon Station', lat: 19.3512, lng: 72.8468, zone: 'Vasai - Nallasopara - Virar' },
  { id: 'vasai-road', name: 'Vasai Road Station', lat: 19.3807, lng: 72.8322, zone: 'Vasai - Nallasopara - Virar' },
  { id: 'nallasopara', name: 'Nallasopara Station', lat: 19.4182, lng: 72.8196, zone: 'Vasai - Nallasopara - Virar' },
  { id: 'virar', name: 'Virar Station', lat: 19.4552, lng: 72.8115, zone: 'Vasai - Nallasopara - Virar' },
];

export const WESTERN_STATION_NAMES: string[] = WESTERN_LINE_STATIONS.map((s) => s.name);

export const WESTERN_STATIONS_MAP: Record<string, WesternStation> = Object.fromEntries(
  WESTERN_LINE_STATIONS.map((s) => [s.name, s])
);

export const WESTERN_STATIONS_BY_ID: Record<string, WesternStation> = Object.fromEntries(
  WESTERN_LINE_STATIONS.map((s) => [s.id, s])
);
