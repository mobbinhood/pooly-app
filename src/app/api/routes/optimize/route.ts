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
function twoOptImprove(stops: Stop[], maxIterations = 100): Stop[] {
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
          // Reverse the segment between i+1 and j
          const segment = route.slice(i + 1, j + 1).reverse();
          route.splice(i + 1, segment.length, ...segment);
          improved = true;
        }
      }
    }
  }

  return route;
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

export async function POST(request: Request) {
  const supabase = await createClient();
  const { route_id } = await request.json();

  if (!route_id) return NextResponse.json({ error: 'route_id required' }, { status: 400 });

  // Get stops with customer coordinates
  const { data: stops, error } = await supabase
    .from('route_stops')
    .select('id, stop_order, customers(latitude, longitude)')
    .eq('route_id', route_id)
    .order('stop_order', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!stops?.length) return NextResponse.json({ message: 'No stops to optimize' });

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

  // Step 1: Nearest-neighbor initial solution
  const nnOrder = nearestNeighborOrder(stopsWithCoords);

  // Step 2: 2-opt improvement pass
  const optimized = twoOptImprove(nnOrder);

  const optimizedDist = totalDistance(optimized);
  const savedMiles = Math.max(0, originalDist - optimizedDist);

  // Update stop orders in batch
  const updates = optimized.map((stop, i) =>
    supabase.from('route_stops').update({ stop_order: i }).eq('id', stop.id)
  );
  await Promise.all(updates);

  return NextResponse.json({
    message: `Route optimized — saved ${savedMiles.toFixed(1)} miles`,
    stops: optimized.length,
    total_miles: Math.round(optimizedDist * 10) / 10,
    saved_miles: Math.round(savedMiles * 10) / 10,
  });
}
