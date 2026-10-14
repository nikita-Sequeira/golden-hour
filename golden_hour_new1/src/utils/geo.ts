import { WESTERN_LINE_STATIONS, WesternStation } from '../data/stations';

export interface NearestStationResult {
  station: WesternStation | null;
  stationName: string | null;
  distanceKm: number;
  isOutsideArea: boolean;
}

export interface GeolocationResult {
  lat: number;
  lng: number;
  accuracyMeters?: number;
  source: 'gps' | 'station';
}

/**
 * Haversine formula to compute great-circle distance between two GPS coordinates in kilometers.
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (lat1 === lat2 && lon1 === lon2) return 0;
  const R = 6371; // Earth's mean radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return Math.round(d * 10) / 10;
}

/**
 * Finds the nearest Western Railway station to given coordinates.
 * If > 8 km, marks isOutsideArea = true.
 * Returns null if coordinates are invalid.
 */
export function findNearestStation(lat: number, lng: number): NearestStationResult {
  if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
    return {
      station: null,
      stationName: null,
      distanceKm: Infinity,
      isOutsideArea: false,
    };
  }

  let nearest: WesternStation | null = null;
  let minDistance = Infinity;

  for (const st of WESTERN_LINE_STATIONS) {
    const dist = calculateDistanceKm(lat, lng, st.lat, st.lng);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = st;
    }
  }

  const isOutsideArea = minDistance > 8.0;

  return {
    station: nearest,
    stationName: nearest ? nearest.name : null,
    distanceKm: minDistance === Infinity ? 0 : minDistance,
    isOutsideArea,
  };
}

/**
 * Two-tier browser geolocation request with timeout and friendly error message.
 * Tries fast cached/low-accuracy fix first, then attempts high accuracy refinement.
 */
export function getUserGeolocation(
  onProgress?: (statusText: string) => void
): Promise<GeolocationResult> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser. Please select your nearest station manually.'));
      return;
    }

    if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      reject(new Error('Location only works on a secure (https) page. Please pick your nearest station manually.'));
      return;
    }

    let hasResolved = false;

    if (onProgress) onProgress('Finding your location...');

    // 1. Try fast low-accuracy fix first (maxAge 60s, timeout 3.5s)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!hasResolved) {
          hasResolved = true;
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracyMeters: pos.coords.accuracy,
            source: 'gps',
          });
        }
      },
      (fastErr) => {
        // If permission denied immediately, fail early with clear help
        if (fastErr.code === fastErr.PERMISSION_DENIED) {
          hasResolved = true;
          reject(
            new Error(
              'Location permission was denied. Tap the location icon in your browser address bar to allow location, or choose your station manually below.'
            )
          );
          return;
        }

        // Try high accuracy if fast fix failed or timed out
        if (onProgress) onProgress('Refining high-accuracy GPS...');

        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (!hasResolved) {
              hasResolved = true;
              resolve({
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                accuracyMeters: pos.coords.accuracy,
                source: 'gps',
              });
            }
          },
          (highErr) => {
            if (hasResolved) return;
            hasResolved = true;
            let msg = 'Could not get your location. Please pick your station below.';
            if (highErr.code === highErr.PERMISSION_DENIED) {
              msg = 'Location permission was denied. Tap the location icon in your browser address bar to allow location, or choose your station manually below.';
            } else if (highErr.code === highErr.TIMEOUT) {
              msg = 'Location request timed out. Please pick your station below or click Retry Location.';
            } else if (highErr.code === highErr.POSITION_UNAVAILABLE) {
              msg = 'Location unavailable on your network. Please pick your station below.';
            }
            reject(new Error(msg));
          },
          {
            enableHighAccuracy: true,
            timeout: 7000,
            maximumAge: 5000,
          }
        );
      },
      {
        enableHighAccuracy: false,
        timeout: 3500,
        maximumAge: 60000,
      }
    );
  });
}
