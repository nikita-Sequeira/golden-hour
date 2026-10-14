import { useState, useCallback } from 'react';
import { getUserGeolocation, findNearestStation, NearestStationResult } from '../utils/geo';
import { WESTERN_LINE_STATIONS, WesternStation } from '../data/stations';

export interface LocationState {
  coords: { lat: number; lng: number } | null;
  accuracyMeters?: number;
  source: 'gps' | 'station';
  nearestStation: WesternStation | null;
  selectedStationName: string;
  isOutsideArea: boolean;
  statusText: string;
  error: string | null;
  isLoading: boolean;
}

export function useLocation(initialStationName: string = 'Bandra Station') {
  // Find station object or fallback
  const fallbackStation =
    WESTERN_LINE_STATIONS.find((s) => s.name === initialStationName) ||
    WESTERN_LINE_STATIONS.find((s) => s.id === 'bandra') ||
    WESTERN_LINE_STATIONS[11]; // Bandra

  const [state, setState] = useState<LocationState>({
    coords: null,
    accuracyMeters: undefined,
    source: 'station',
    nearestStation: fallbackStation,
    selectedStationName: fallbackStation.name,
    isOutsideArea: false,
    statusText: '',
    error: null,
    isLoading: false,
  });

  const requestGps = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
      statusText: 'Finding your location...',
    }));

    try {
      const geo = await getUserGeolocation((msg) => {
        setState((prev) => ({ ...prev, statusText: msg }));
      });

      const nearestRes: NearestStationResult = findNearestStation(geo.lat, geo.lng);

      if (nearestRes.isOutsideArea) {
        setState((prev) => ({
          ...prev,
          coords: { lat: geo.lat, lng: geo.lng },
          accuracyMeters: geo.accuracyMeters,
          source: 'station',
          isOutsideArea: true,
          statusText: `You seem to be outside the Western Line area (~${nearestRes.distanceKm} km away). Please pick a station below.`,
          error: `Outside Western Line (~${nearestRes.distanceKm} km). Please choose your nearest Western Railway station manually.`,
          isLoading: false,
        }));
      } else if (nearestRes.station) {
        const stationObj = nearestRes.station;
        setState((prev) => ({
          ...prev,
          coords: { lat: geo.lat, lng: geo.lng },
          accuracyMeters: geo.accuracyMeters,
          source: 'gps',
          nearestStation: stationObj,
          selectedStationName: stationObj.name,
          isOutsideArea: false,
          statusText: `Location found: near ${stationObj.name} (~${nearestRes.distanceKm} km)`,
          error: null,
          isLoading: false,
        }));
      }
      return geo;
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        source: 'station',
        statusText: "Couldn't get your location. Pick your station below.",
        error: err.message || 'Location unavailable',
        isLoading: false,
      }));
      return null;
    }
  }, []);

  const selectStationManually = useCallback((stationName: string) => {
    const matched = WESTERN_LINE_STATIONS.find((s) => s.name === stationName);
    if (matched) {
      setState((prev) => ({
        ...prev,
        source: 'station',
        nearestStation: matched,
        selectedStationName: matched.name,
        error: null,
        isOutsideArea: false,
        statusText: `Manual station selected: ${matched.name}`,
      }));
    }
  }, []);

  return {
    ...state,
    requestGps,
    selectStationManually,
  };
}
