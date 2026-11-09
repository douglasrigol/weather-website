/**
 * Converte latitude/longitude em posição 3D numa esfera de raio `r`.
 * Segue a mesma orientação do modelo earth.glb (longitude 0 em +X, norte em +Y).
 */
export function latLonToVec(lat: number, lon: number, r = 1): [number, number, number] {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;
  return [-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta)];
}
