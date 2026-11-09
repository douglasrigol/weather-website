import { describe, expect, it } from 'vitest';
import { parseForecast, type RawForecast } from '../api/openMeteo';
import { beaufort, cityClock, convertTemp, formatDayLabel, formatHour, nextHours, windDirection } from './format';
import { daySummary } from './summary';
import { sceneParamsFor } from '../scene/sceneParams';
import { describeWeather, skyThemeFor, temperatureTypeAxes } from './weather';

describe('convertTemp', () => {
  it('arredonda em Celsius e converte para Fahrenheit', () => {
    expect(convertTemp(21.6, 'c')).toBe(22);
    expect(convertTemp(0, 'f')).toBe(32);
    expect(convertTemp(100, 'f')).toBe(212);
  });

  it('não exibe -0', () => {
    expect(Object.is(convertTemp(-0.3, 'c'), -0)).toBe(false);
  });
});

describe('formatação de datas', () => {
  it('nomeia hoje e amanhã e usa o dia da semana depois', () => {
    expect(formatDayLabel('2026-11-09', 0)).toBe('Hoje');
    expect(formatDayLabel('2026-11-10', 1)).toBe('Amanhã');
    // 11/11/2026 é uma quarta-feira
    expect(formatDayLabel('2026-11-11', 2)).toBe('Qua');
  });

  it('formata a hora curta', () => {
    expect(formatHour('2026-11-09T07:00')).toBe('7h');
  });
});

describe('windDirection', () => {
  it('converte graus em pontos cardeais', () => {
    expect(windDirection(0)).toBe('N');
    expect(windDirection(90)).toBe('L');
    expect(windDirection(225)).toBe('SO');
    expect(windDirection(359)).toBe('N');
  });
});

describe('clima e tema do céu', () => {
  it('descreve códigos WMO', () => {
    expect(describeWeather(0).kind).toBe('clear');
    expect(describeWeather(63).label).toBe('Chuva');
    expect(describeWeather(1234).kind).toBe('cloudy');
  });

  it('escolhe o tema pelo tempo e pela hora do dia', () => {
    expect(skyThemeFor('clear', true)).toBe('clear-day');
    expect(skyThemeFor('clear', false)).toBe('clear-night');
    expect(skyThemeFor('rain', false)).toBe('cloudy-night');
    expect(skyThemeFor('storm', true)).toBe('storm');
  });

  it('deixa o número mais pesado quanto mais quente', () => {
    expect(temperatureTypeAxes(35).weight).toBeGreaterThan(temperatureTypeAxes(5).weight);
    expect(temperatureTypeAxes(-30).weight).toBe(250);
    expect(temperatureTypeAxes(60).weight).toBe(800);
  });
});

describe('nextHours', () => {
  const hourly = ['00', '01', '02', '03', '04'].map((h, i) => ({
    time: `2026-11-09T${h}:00`,
    temperature: 20 + i,
    rainChance: 0,
    windSpeed: 0,
    code: 0,
    isDay: true,
  }));

  it('começa na hora atual', () => {
    const result = nextHours(hourly, '2026-11-09T02:45', 2);
    expect(result.map((h) => h.time)).toEqual(['2026-11-09T02:00', '2026-11-09T03:00']);
  });
});

describe('parseForecast', () => {
  it('transforma a resposta da API no formato do app', () => {
    const raw: RawForecast = {
      timezone: 'America/Sao_Paulo',
      utc_offset_seconds: -10800,
      current: {
        time: '2026-11-09T14:00',
        temperature_2m: 27.4,
        apparent_temperature: 29,
        relative_humidity_2m: 60,
        precipitation: 0,
        wind_speed_10m: 12,
        wind_gusts_10m: 25,
        wind_direction_10m: 90,
        weather_code: 2,
        is_day: 1,
        uv_index: 6.2,
        visibility: 24000,
        surface_pressure: 1012,
        cloud_cover: 40,
      },
      hourly: {
        time: ['2026-11-09T14:00'],
        temperature_2m: [27.4],
        precipitation_probability: [10],
        wind_speed_10m: [12],
        weather_code: [2],
        is_day: [1],
      },
      daily: {
        time: ['2026-11-09'],
        weather_code: [2],
        temperature_2m_max: [30],
        temperature_2m_min: [19],
        precipitation_probability_max: [20],
        precipitation_sum: [3.2],
        wind_speed_10m_max: [28],
        wind_direction_10m_dominant: [120],
        sunrise: ['2026-11-09T05:20'],
        sunset: ['2026-11-09T18:40'],
        uv_index_max: [9.1],
      },
    };

    const forecast = parseForecast(raw);
    expect(forecast.current.isDay).toBe(true);
    expect(forecast.current.temperature).toBe(27.4);
    expect(forecast.hourly[0].rainChance).toBe(10);
    expect(forecast.daily[0]).toMatchObject({ max: 30, min: 19, uvMax: 9.1, windMax: 28 });
    expect(forecast.current.visibility).toBe(24000);
    expect(forecast.utcOffsetSeconds).toBe(-10800);
  });
});

describe('vento e relógio', () => {
  it('classifica o vento na escala Beaufort', () => {
    expect(beaufort(0).force).toBe(0);
    expect(beaufort(15).name).toBe('Brisa fraca');
    expect(beaufort(130).force).toBe(12);
  });

  it('calcula a hora local da cidade', () => {
    const utcNoon = Date.UTC(2026, 10, 9, 12, 0);
    expect(cityClock(-10800, utcNoon)).toBe('09:00');
    expect(cityClock(32400, utcNoon)).toBe('21:00');
  });
});

describe('resumo do dia e cenário', () => {
  const day = {
    date: '2026-11-09',
    code: 95,
    max: 31,
    min: 21,
    rainChance: 80,
    rainSum: 12.4,
    windMax: 24,
    windDirection: 135,
    sunrise: '2026-11-09T05:18',
    sunset: '2026-11-09T18:47',
    uvMax: 9,
  };

  it('monta uma frase legível', () => {
    expect(daySummary(day, 'c')).toBe(
      'Máxima de 31° e mínima de 21°. Chance de chuva de 80%, com cerca de 12 mm. Vento de até 24 km/h vindo do SE.',
    );
  });

  it('liga chuva e raios na tempestade', () => {
    const storm = sceneParamsFor(95, true, 20, 90);
    expect(storm.storm).toBe(true);
    expect(storm.rain).toBe(1);
    // vento do leste empurra a chuva para a esquerda
    expect(storm.wind).toBeLessThan(0);
    expect(sceneParamsFor(0, false, 5, 0).stars).toBe(1);
  });
});
