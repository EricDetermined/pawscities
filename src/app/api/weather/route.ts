import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = searchParams.get('lat');
    const lon = searchParams.get('lon');

    if (!lat || !lon) {
      return NextResponse.json({ error: 'lat and lon parameters required' }, { status: 400 });
    }

    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,is_day&temperature_unit=fahrenheit&timezone=auto`;
    const response = await fetch(weatherUrl);
    const data = await response.json();

    if (!data.current) {
      return NextResponse.json({ error: 'Unable to fetch weather data' }, { status: 500 });
    }

    const current = data.current;
    const weatherCode = current.weather_code;
    let condition = 'clear';
    let description = 'Clear sky';
    let icon = '\u2600\uFE0F';
    let suggestIndoor = false;

    if (weatherCode === 0) {
      condition = 'clear'; description = 'Clear sky'; icon = current.is_day ? '\u2600\uFE0F' : '\uD83C\uDF19';
    } else if (weatherCode <= 3) {
      condition = 'cloudy'; description = weatherCode === 1 ? 'Mainly clear' : weatherCode === 2 ? 'Partly cloudy' : 'Overcast'; icon = '\u26C5';
    } else if (weatherCode <= 49) {
      condition = 'fog'; description = 'Foggy'; icon = '\uD83C\uDF2B\uFE0F'; suggestIndoor = true;
    } else if (weatherCode <= 59) {
      condition = 'drizzle'; description = 'Drizzle'; icon = '\uD83C\uDF26\uFE0F'; suggestIndoor = true;
    } else if (weatherCode <= 69) {
      condition = 'rain'; description = weatherCode <= 63 ? 'Light rain' : 'Heavy rain'; icon = '\uD83C\uDF27\uFE0F'; suggestIndoor = true;
    } else if (weatherCode <= 79) {
      condition = 'snow'; description = 'Snow'; icon = '\uD83C\uDF28\uFE0F'; suggestIndoor = true;
    } else if (weatherCode <= 82) {
      condition = 'rain'; description = 'Rain showers'; icon = '\uD83C\uDF27\uFE0F'; suggestIndoor = true;
    } else if (weatherCode <= 86) {
      condition = 'snow'; description = 'Snow showers'; icon = '\uD83C\uDF28\uFE0F'; suggestIndoor = true;
    } else if (weatherCode >= 95) {
      condition = 'thunderstorm'; description = 'Thunderstorm'; icon = '\u26C8\uFE0F'; suggestIndoor = true;
    }

    const temp = current.temperature_2m;
    const wind = current.wind_speed_10m;
    if (temp > 95 || temp < 32 || wind > 25) {
      suggestIndoor = true;
    }

    return NextResponse.json({
      temperature: Math.round(temp),
      temperatureUnit: '\u00B0F',
      humidity: current.relative_humidity_2m,
      windSpeed: Math.round(wind),
      condition,
      description,
      icon,
      suggestIndoor,
      weatherCode,
    });
  } catch (error) {
    console.error('Weather API error:', error);
    return NextResponse.json({ error: 'Failed to fetch weather' }, { status: 500 });
  }
}
