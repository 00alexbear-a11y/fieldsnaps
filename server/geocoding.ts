interface GeocodeResult {
  latitude: string;
  longitude: string;
  formattedAddress: string;
}

/**
 * Geocode an address to latitude/longitude using Google Geocoding API
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  if (!address || !address.trim()) {
    return null;
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.error('GOOGLE_MAPS_API_KEY not configured');
    return null;
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address.trim())}&key=${apiKey}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const response = await fetch(url, {
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`Geocoding HTTP error: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      console.warn(`Geocoding failed for address "${address}": ${data.status}`);
      return null;
    }

    const result = data.results[0];
    const location = result.geometry.location;

    return {
      latitude: location.lat.toString(),
      longitude: location.lng.toString(),
      formattedAddress: result.formatted_address,
    };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error('Geocoding request timed out');
    } else {
      console.error('Geocoding error:', error.message);
    }
    return null;
  }
}
