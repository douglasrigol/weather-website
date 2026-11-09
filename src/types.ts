export interface City {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  admin1?: string;
  country?: string;
}

export interface CurrentConditions {
  time: string;
  temperature: number;
  apparent: number;
  humidity: number;
  precipitation: number;
  windSpeed: number;
  windGusts: number;
  windDirection: number;
  code: number;
  isDay: boolean;
  uv: number;
  /** em metros */
  visibility: number;
  /** em hPa */
  pressure: number;
  cloudCover: number;
}

export interface HourPoint {
  time: string;
  temperature: number;
  rainChance: number;
  windSpeed: number;
  code: number;
  isDay: boolean;
}

export interface DayPoint {
  date: string;
  code: number;
  max: number;
  min: number;
  rainChance: number;
  rainSum: number;
  windMax: number;
  windDirection: number;
  sunrise: string;
  sunset: string;
  uvMax: number;
}

export interface Forecast {
  timezone: string;
  utcOffsetSeconds: number;
  current: CurrentConditions;
  hourly: HourPoint[];
  daily: DayPoint[];
}

/** Resumo do tempo agora de uma cidade (lista de favoritas e globo). */
export interface CityNow {
  city: City;
  temperature: number;
  code: number;
  isDay: boolean;
  windSpeed: number;
  windDirection: number;
  humidity: number;
}

export type Unit = 'c' | 'f';

export type WeatherKind =
  | 'clear'
  | 'partly'
  | 'cloudy'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'snow'
  | 'storm';

export type SkyTheme =
  | 'clear-day'
  | 'cloudy-day'
  | 'rain-day'
  | 'snow-day'
  | 'fog-day'
  | 'storm'
  | 'clear-night'
  | 'cloudy-night';
