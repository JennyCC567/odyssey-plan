import cityCoordinates from "../../八字命理分析/references/cities.json";

export const supportedCities = Object.keys(cityCoordinates).sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));

export const supportedCitySet = new Set(supportedCities);

export function isSupportedCity(city: string) {
  return supportedCitySet.has(city.trim());
}

export function searchCities(query: string, limit = 8) {
  const normalized = query.trim();

  if (!normalized) return supportedCities.slice(0, limit);

  const startsWithMatches = supportedCities.filter((city) => city.startsWith(normalized));
  const includesMatches = supportedCities.filter((city) => !city.startsWith(normalized) && city.includes(normalized));

  return [...startsWithMatches, ...includesMatches].slice(0, limit);
}
