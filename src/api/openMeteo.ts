import type { City, CityNow, Forecast } from '../types';

const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const REVERSE_URL = 'https://api.bigdatacloud.net/data/reverse-geocode-client';

interface GeoResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  admin1?: string;
  country?: string;
}

export async function searchCities(query: string, signal?: AbortSignal): Promise<City[]> {
  const name = query.trim();
  if (name.length < 2) return [];

  const params = new URLSearchParams({ name, count: '6', language: 'pt', format: 'json' });
  const res = await fetch(`${GEOCODING_URL}?${params}`, { signal });
  if (!res.ok) throw new Error('A busca de cidades não respondeu. Tente de novo em instantes.');

  const data = (await res.json()) as { results?: GeoResult[] };
  return (data.results ?? []).map(({ id, name, latitude, longitude, admin1, country }) => ({
    id,
    name,
    latitude,
    longitude,
    admin1,
    country,
  }));
}

/** Formato cru devolvido pela Open-Meteo (somente os campos pedidos). */
export interface RawForecast {
  timezone: string;
  utc_offset_seconds: number;
  current: {
    time: string;
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    precipitation: number;
    wind_speed_10m: number;
    wind_gusts_10m: number;
    wind_direction_10m: number;
    weather_code: number;
    is_day: number;
    uv_index: number;
    visibility: number;
    surface_pressure: number;
    cloud_cover: number;
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    precipitation_probability: number[];
    wind_speed_10m: number[];
    weather_code: number[];
    is_day: number[];
  };
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: number[];
    precipitation_sum: number[];
    wind_speed_10m_max: number[];
    wind_direction_10m_dominant: number[];
    sunrise: string[];
    sunset: string[];
    uv_index_max: number[];
  };
}

export function parseForecast(raw: RawForecast): Forecast {
  const { current: c, hourly: h, daily: d } = raw;
  return {
    timezone: raw.timezone,
    utcOffsetSeconds: raw.utc_offset_seconds ?? 0,
    current: {
      time: c.time,
      temperature: c.temperature_2m,
      apparent: c.apparent_temperature,
      humidity: c.relative_humidity_2m,
      precipitation: c.precipitation,
      windSpeed: c.wind_speed_10m,
      windGusts: c.wind_gusts_10m ?? c.wind_speed_10m,
      windDirection: c.wind_direction_10m,
      code: c.weather_code,
      isDay: c.is_day === 1,
      uv: c.uv_index ?? 0,
      visibility: c.visibility ?? 10000,
      pressure: c.surface_pressure ?? 1013,
      cloudCover: c.cloud_cover ?? 0,
    },
    hourly: h.time.map((time, i) => ({
      time,
      temperature: h.temperature_2m[i],
      rainChance: h.precipitation_probability[i] ?? 0,
      windSpeed: h.wind_speed_10m[i] ?? 0,
      code: h.weather_code[i],
      isDay: h.is_day[i] === 1,
    })),
    daily: d.time.map((date, i) => ({
      date,
      code: d.weather_code[i],
      max: d.temperature_2m_max[i],
      min: d.temperature_2m_min[i],
      rainChance: d.precipitation_probability_max[i] ?? 0,
      rainSum: d.precipitation_sum[i] ?? 0,
      windMax: d.wind_speed_10m_max[i] ?? 0,
      windDirection: d.wind_direction_10m_dominant[i] ?? 0,
      sunrise: d.sunrise[i],
      sunset: d.sunset[i],
      uvMax: d.uv_index_max[i] ?? 0,
    })),
  };
}

export async function getForecast(city: City, signal?: AbortSignal): Promise<Forecast> {
  const params = new URLSearchParams({
    latitude: String(city.latitude),
    longitude: String(city.longitude),
    current: [
      'temperature_2m',
      'apparent_temperature',
      'relative_humidity_2m',
      'precipitation',
      'wind_speed_10m',
      'wind_gusts_10m',
      'wind_direction_10m',
      'weather_code',
      'is_day',
      'uv_index',
      'visibility',
      'surface_pressure',
      'cloud_cover',
    ].join(','),
    hourly: 'temperature_2m,precipitation_probability,wind_speed_10m,weather_code,is_day',
    daily: [
      'weather_code',
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_probability_max',
      'precipitation_sum',
      'wind_speed_10m_max',
      'wind_direction_10m_dominant',
      'sunrise',
      'sunset',
      'uv_index_max',
    ].join(','),
    timezone: 'auto',
    forecast_days: '7',
  });

  const res = await fetch(`${FORECAST_URL}?${params}`, { signal });
  if (!res.ok) throw new Error('O serviço de previsão não respondeu. Tente de novo em instantes.');
  return parseForecast((await res.json()) as RawForecast);
}

interface RawNow {
  current: {
    temperature_2m: number;
    weather_code: number;
    is_day: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
    relative_humidity_2m: number;
  };
}

/** Tempo agora de várias cidades numa única requisição. */
export async function getCurrentMany(cities: City[], signal?: AbortSignal): Promise<CityNow[]> {
  if (cities.length === 0) return [];
  const params = new URLSearchParams({
    latitude: cities.map((c) => c.latitude.toFixed(4)).join(','),
    longitude: cities.map((c) => c.longitude.toFixed(4)).join(','),
    current: 'temperature_2m,weather_code,is_day,wind_speed_10m,wind_direction_10m,relative_humidity_2m',
    timezone: 'auto',
  });
  const res = await fetch(`${FORECAST_URL}?${params}`, { signal });
  if (!res.ok) throw new Error('O serviço de previsão não respondeu.');
  const json = (await res.json()) as RawNow | RawNow[];
  const list = Array.isArray(json) ? json : [json];
  return list.map((item, i) => ({
    city: cities[i],
    temperature: item.current.temperature_2m,
    code: item.current.weather_code,
    isDay: item.current.is_day === 1,
    windSpeed: item.current.wind_speed_10m,
    windDirection: item.current.wind_direction_10m,
    humidity: item.current.relative_humidity_2m,
  }));
}

/** Descobre o nome da cidade a partir das coordenadas do navegador. */
export async function reverseGeocode(latitude: number, longitude: number): Promise<City> {
  const fallback: City = { id: -1, name: 'Sua localização', latitude, longitude };
  try {
    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      localityLanguage: 'pt',
    });
    const res = await fetch(`${REVERSE_URL}?${params}`);
    if (!res.ok) return fallback;
    const data = (await res.json()) as {
      city?: string;
      locality?: string;
      principalSubdivision?: string;
      countryName?: string;
    };
    const name = data.city || data.locality;
    if (!name) return fallback;
    return {
      ...fallback,
      id: Math.round(latitude * 1000) * 100000 + Math.round(longitude * 1000),
      name,
      admin1: data.principalSubdivision,
      country: data.countryName,
    };
  } catch {
    return fallback;
  }
}
