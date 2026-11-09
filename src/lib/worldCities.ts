import type { City } from '../types';

/** Cidades mostradas no globo para dar um retrato do tempo no mundo agora. */
export const WORLD_CITIES: City[] = [
  { id: 3448439, name: 'São Paulo', latitude: -23.55, longitude: -46.63, country: 'Brasil' },
  { id: 3451190, name: 'Rio de Janeiro', latitude: -22.91, longitude: -43.18, country: 'Brasil' },
  { id: 3663517, name: 'Manaus', latitude: -3.1, longitude: -60.02, country: 'Brasil' },
  { id: 3452925, name: 'Porto Alegre', latitude: -30.03, longitude: -51.23, country: 'Brasil' },
  { id: 3435910, name: 'Buenos Aires', latitude: -34.61, longitude: -58.38, country: 'Argentina' },
  { id: 3871336, name: 'Santiago', latitude: -33.45, longitude: -70.65, country: 'Chile' },
  { id: 3936456, name: 'Lima', latitude: -12.05, longitude: -77.04, country: 'Peru' },
  { id: 3688689, name: 'Bogotá', latitude: 4.61, longitude: -74.08, country: 'Colômbia' },
  { id: 3530597, name: 'Cidade do México', latitude: 19.43, longitude: -99.13, country: 'México' },
  { id: 5128581, name: 'Nova York', latitude: 40.71, longitude: -74.01, country: 'Estados Unidos' },
  { id: 5368361, name: 'Los Angeles', latitude: 34.05, longitude: -118.24, country: 'Estados Unidos' },
  { id: 6167865, name: 'Toronto', latitude: 43.7, longitude: -79.42, country: 'Canadá' },
  { id: 3413829, name: 'Reykjavík', latitude: 64.14, longitude: -21.9, country: 'Islândia' },
  { id: 2643743, name: 'Londres', latitude: 51.51, longitude: -0.13, country: 'Reino Unido' },
  { id: 2267057, name: 'Lisboa', latitude: 38.72, longitude: -9.14, country: 'Portugal' },
  { id: 2988507, name: 'Paris', latitude: 48.85, longitude: 2.35, country: 'França' },
  { id: 360630, name: 'Cairo', latitude: 30.04, longitude: 31.24, country: 'Egito' },
  { id: 2332459, name: 'Lagos', latitude: 6.45, longitude: 3.39, country: 'Nigéria' },
  { id: 184745, name: 'Nairóbi', latitude: -1.29, longitude: 36.82, country: 'Quênia' },
  { id: 3369157, name: 'Cidade do Cabo', latitude: -33.93, longitude: 18.42, country: 'África do Sul' },
  { id: 524901, name: 'Moscou', latitude: 55.75, longitude: 37.62, country: 'Rússia' },
  { id: 292223, name: 'Dubai', latitude: 25.2, longitude: 55.27, country: 'Emirados Árabes' },
  { id: 1275339, name: 'Mumbai', latitude: 19.08, longitude: 72.88, country: 'Índia' },
  { id: 1880252, name: 'Singapura', latitude: 1.29, longitude: 103.85, country: 'Singapura' },
  { id: 1816670, name: 'Pequim', latitude: 39.9, longitude: 116.4, country: 'China' },
  { id: 1850147, name: 'Tóquio', latitude: 35.68, longitude: 139.69, country: 'Japão' },
  { id: 2147714, name: 'Sydney', latitude: -33.87, longitude: 151.21, country: 'Austrália' },
  { id: 2193733, name: 'Auckland', latitude: -36.85, longitude: 174.76, country: 'Nova Zelândia' },
];

export const DEFAULT_FAVORITES: City[] = [
  { id: 3451190, name: 'Rio de Janeiro', latitude: -22.91, longitude: -43.18, admin1: 'Rio de Janeiro', country: 'Brasil' },
  { id: 3464975, name: 'Curitiba', latitude: -25.43, longitude: -49.27, admin1: 'Paraná', country: 'Brasil' },
  { id: 3452925, name: 'Porto Alegre', latitude: -30.03, longitude: -51.23, admin1: 'Rio Grande do Sul', country: 'Brasil' },
];
