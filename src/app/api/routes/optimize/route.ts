import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type Stop = { id: string; lat: number; lng: number };

// Nearest-neighbor greedy initial solution
function nearestNeighborOrder(stops: Stop[]): Stop[] {
  if (stops.length <= 2) return stops;

  const optimized: Stop[] = [];
  const remaining = [...stops];

  let current = remaining.shift()!;
  optimized.push(current);

  while (remaining.length > 0) {
    let nearestIdx = 0;
    let nearestDist = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const dist = haversine(current.lat, current.lng, remaining[i].lat, remaining[i].lng);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = i;
      }
    }

    current = remaining.splice(nearestIdx, 1)[0];
    optimized.push(current);
  }

  return optimized;
}

// 2-opt improvement: iteratively reverse segments to reduce total distance
function twoOptImprove(stops: Stop[], maxIterations = 150): Stop[] {
  if (stops.length <= 3) return stops;

  const route = [...stops];
  let improved = true;
  let iterations = 0;

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;

    for (let i = 0; i < route.length - 2; i++) {
      for (let j = i + 2; j < route.length; j++) {
        const a = route[i];
        const b = route[i + 1];
        const c = route[j];
        const d = route[j + 1 < route.length ? j + 1 : 0];

        const currentDist = haversine(a.lat, a.lng, b.lat, b.lng) + haversine(c.lat, c.lng, d.lat, d.lng);
        const newDist = haversine(a.lat, a.lng, c.lat, c.lng) + haversine(b.lat, b.lng, d.lat, d.lng);

        if (newDist < currentDist - 0.001) {
          const segment = route.slice(i + 1, j + 1).reverse();
          route.splice(i + 1, segment.length, ...segment);
          improved = true;
        }
      }
    }
  }

  return route;
}

// Or-opt: try moving single stops to better positions
function orOptImprove(stops: Stop[], maxIterations = 100): Stop[] {
  if (stops.length <= 3) return stops;

  const route = [...stops];
  let improved = true;
  let iterations = 0;

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;

    for (let i = 0; i < route.length; i++) {
      const prevI = i === 0 ? -1 : i - 1;
      const nextI = i === route.length - 1 ? -1 : i + 1;

      // Cost of removing stop i from its current position
      let removeCost = 0;
      if (prevI >= 0) removeCost -= haversine(route[prevI].lat, route[prevI].lng, route[i].lat, route[i].lng);
      if (nextI >= 0) removeCost -= haversine(route[i].lat, route[i].lng, route[nextI].lat, route[nextI].lng);
      if (prevI >= 0 && nextI >= 0) removeCost += haversine(route[prevI].lat, route[prevI].lng, route[nextI].lat, route[nextI].lng);

      let bestInsert = -1;
      let bestGain = 0;

      for (let j = 0; j < route.length - 1; j++) {
        if (j === prevI || j === i) continue;
        const insertCost = haversine(route[j].lat, route[j].lng, route[i].lat, route[i].lng)
          + haversine(route[i].lat, route[i].lng, route[j + 1].lat, route[j + 1].lng)
          - haversine(route[j].lat, route[j].lng, route[j + 1].lat, route[j + 1].lng);
        const gain = -(removeCost + insertCost);
        if (gain > bestGain + 0.001) {
          bestGain = gain;
          bestInsert = j;
        }
      }

      if (bestInsert >= 0) {
        const [stop] = route.splice(i, 1);
        const insertAt = bestInsert >= i ? bestInsert : bestInsert + 1;
        route.splice(insertAt, 0, stop);
        improved = true;
        break; // restart after modification
      }
    }
  }

  return route;
}

// Try multiple starting points for nearest-neighbor and return the best
function bestNearestNeighbor(stops: Stop[]): Stop[] {
  if (stops.length <= 3) return nearestNeighborOrder(stops);

  const maxStarts = Math.min(stops.length, 5);
  let bestRoute = nearestNeighborOrder(stops);
  let bestDist = totalDistance(bestRoute);

  for (let s = 1; s < maxStarts; s++) {
    // Rotate starting point
    const rotated = [...stops.slice(s), ...stops.slice(0, s)];
    const candidate = nearestNeighborOrder(rotated);
    const dist = totalDistance(candidate);
    if (dist < bestDist) {
      bestDist = dist;
      bestRoute = candidate;
    }
  }

  return bestRoute;
}

// Calculate total route distance in miles
function totalDistance(stops: Stop[]): number {
  let dist = 0;
  for (let i = 0; i < stops.length - 1; i++) {
    dist += haversine(stops[i].lat, stops[i].lng, stops[i + 1].lat, stops[i + 1].lng);
  }
  return dist;
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959; // miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number) { return deg * Math.PI / 180; }

async function geocodeAddress(address: string, city: string, state: string, zip: string | null): Promise<{ lat: number; lng: number } | null> {
  const query = encodeURIComponent(`${address}, ${city}, ${state} ${zip || ''}, USA`);
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`,
      { headers: { 'User-Agent': 'Pooly Pool Service App' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.length === 0) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { route_id } = await request.json();

  if (!route_id) return NextResponse.json({ error: 'route_id required' }, { status: 400 });

  // Get stops with customer coordinates and address for auto-geocoding
  const { data: stops, error } = await supabase
    .from('route_stops')
    .select('id, stop_order, customers(id, latitude, longitude, address, city, state, zip)')
    .eq('route_id', route_id)
    .order('stop_order', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!stops?.length) return NextResponse.json({ message: 'No stops to optimize' });

  // Auto-geocode missing coordinates
  let geocodedCount = 0;
  for (const s of stops) {
    const cust = s.customers as unknown as { id: string; latitude: number | null; longitude: number | null; address: string; city: string; state: string; zip: string | null } | null;
    if (!cust || (cust.latitude && cust.longitude)) continue;
    if (!cust.address || !cust.city || !cust.state) continue;

    const coords = await geocodeAddress(cust.address, cust.city, cust.state, cust.zip);
    if (coords) {
      await supabase.from('customers').update({ latitude: coords.lat, longitude: coords.lng }).eq('id', cust.id);
      cust.latitude = coords.lat;
      cust.longitude = coords.lng;
      geocodedCount++;
      // Rate limit: 1 req/sec for Nominatim
      if (geocodedCount < 10) await new Promise(r => setTimeout(r, 1100));
    }
  }

  // Filter stops with coordinates
  const stopsWithCoords = stops
    .filter((s: Record<string, unknown>) => {
      const cust = s.customers as { latitude: number | null; longitude: number | null } | null;
      return cust?.latitude && cust?.longitude;
    })
    .map((s: Record<string, unknown>) => {
      const cust = s.customers as { latitude: number; longitude: number };
      return {
        id: s.id as string,
        lat: cust.latitude,
        lng: cust.longitude,
      };
    });

  if (stopsWithCoords.length < 2) {
    return NextResponse.json({ message: 'Need at least 2 stops with coordinates to optimize' });
  }

  // Calculate original distance
  const originalDist = totalDistance(stopsWithCoords);

  // Step 1: Best nearest-neighbor from multiple starting points
  const nnOrder = bestNearestNeighbor(stopsWithCoords);

  // Step 2: 2-opt improvement pass
  const twoOpted = twoOptImprove(nnOrder);

  // Step 3: Or-opt single-stop relocation
  const optimized = orOptImprove(twoOpted);

  const optimizedDist = totalDistance(optimized);
  const savedMiles = Math.max(0, originalDist - optimizedDist);

  // Update stop orders in batch
  const updates = optimized.map((stop, i) =>
    supabase.from('route_stops').update({ stop_order: i }).eq('id', stop.id)
  );
  await Promise.all(updates);

  // Calculate per-leg distances
  const legs: { from: string; to: string; miles: number }[] = [];
  for (let i = 0; i < optimized.length - 1; i++) {
    legs.push({
      from: optimized[i].id,
      to: optimized[i + 1].id,
      miles: Math.round(haversine(optimized[i].lat, optimized[i].lng, optimized[i + 1].lat, optimized[i + 1].lng) * 10) / 10,
    });
  }

  // Detect clusters (geographic groupings) for insight
  const clusters = detectClusters(optimized, 2.0); // 2 mile cluster radius

  return NextResponse.json({
    message: `Route optimized — saved ${savedMiles.toFixed(1)} miles`,
    stops: optimized.length,
    total_miles: Math.round(optimizedDist * 10) / 10,
    original_miles: Math.round(originalDist * 10) / 10,
    saved_miles: Math.round(savedMiles * 10) / 10,
    saved_pct: originalDist > 0 ? Math.round((savedMiles / originalDist) * 100) : 0,
    geocoded: geocodedCount,
    legs,
    clusters: clusters.length,
    longest_leg: legs.length > 0 ? Math.max(...legs.map(l => l.miles)) : 0,
  });
}

// Simple cluster detection: group stops within radius of each other
function detectClusters(stops: Stop[], radiusMiles: number): Stop[][] {
  if (stops.length < 2) return [stops];
  const visited = new Set<number>();
  const clusters: Stop[][] = [];

  for (let i = 0; i < stops.length; i++) {
    if (visited.has(i)) continue;
    const cluster: Stop[] = [stops[i]];
    visited.add(i);
    for (let j = i + 1; j < stops.length; j++) {
      if (visited.has(j)) continue;
      if (haversine(stops[i].lat, stops[i].lng, stops[j].lat, stops[j].lng) <= radiusMiles) {
        cluster.push(stops[j]);
        visited.add(j);
      }
    }
    clusters.push(cluster);
  }
  return clusters;
}
