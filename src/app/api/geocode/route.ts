import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { address, city, state, zip } = await request.json();

  if (!address || !city || !state) {
    return NextResponse.json({ error: 'Address, city, and state are required' }, { status: 400 });
  }

  const query = encodeURIComponent(`${address}, ${city}, ${state} ${zip || ''}, USA`);

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`,
      {
        headers: {
          'User-Agent': 'Pooly Pool Service App',
        },
      }
    );

    if (!res.ok) {
      return NextResponse.json({ error: 'Geocoding service unavailable' }, { status: 503 });
    }

    const data = await res.json();

    if (data.length === 0) {
      return NextResponse.json({ latitude: null, longitude: null, found: false });
    }

    return NextResponse.json({
      latitude: parseFloat(data[0].lat),
      longitude: parseFloat(data[0].lon),
      found: true,
    });
  } catch (error) {
    console.error('Geocoding error:', error);
    return NextResponse.json({ error: 'Failed to geocode address' }, { status: 500 });
  }
}
