import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Simple nearest-neighbor route optimization
function optimizeStops(stops: { id: string; lat: number; lng: number }[]) {
  if (stops.length <= 2) return stops;

  const optimized: typeof stops = [];
  const remaining = [...stops];

  // Start with first stop
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
    .eq('route_id', route_id);

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

  const optimized = optimizeStops(stopsWithCoords);

  // Update stop orders
  for (let i = 0; i < optimized.length; i++) {
    await supabase.from('route_stops').update({ stop_order: i }).eq('id', optimized[i].id);
  }

  return NextResponse.json({ message: 'Route optimized', stops: optimized.length });
}
