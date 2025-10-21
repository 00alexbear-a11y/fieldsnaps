import { Capacitor } from '@capacitor/core';
import { Geolocation, Position } from '@capacitor/geolocation';

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number | null;
  altitudeAccuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
}

export const nativeGeolocation = {
  async getCurrentPosition(): Promise<LocationCoordinates | null> {
    if (!Capacitor.isNativePlatform()) {
      if ('geolocation' in navigator) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject);
          });
          
          return {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            altitudeAccuracy: position.coords.altitudeAccuracy,
            heading: position.coords.heading,
            speed: position.coords.speed,
          };
        } catch (error) {
          console.warn('Web geolocation failed:', error);
          return null;
        }
      }
      return null;
    }

    try {
      const position: Position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
      });

      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        altitude: position.coords.altitude,
        altitudeAccuracy: position.coords.altitudeAccuracy,
        heading: position.coords.heading,
        speed: position.coords.speed,
      };
    } catch (error) {
      console.warn('Native geolocation failed:', error);
      return null;
    }
  },

  async requestPermissions(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      return 'geolocation' in navigator;
    }

    try {
      const result = await Geolocation.requestPermissions();
      return result.location === 'granted';
    } catch (error) {
      console.warn('Geolocation permissions request failed:', error);
      return false;
    }
  },
};
