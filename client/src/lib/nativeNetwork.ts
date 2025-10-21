import { Capacitor } from '@capacitor/core';
import { Network, ConnectionStatus } from '@capacitor/network';

export interface NetworkStatus {
  connected: boolean;
  connectionType: 'wifi' | 'cellular' | 'none' | 'unknown';
}

export const nativeNetwork = {
  async getStatus(): Promise<NetworkStatus> {
    if (!Capacitor.isNativePlatform()) {
      return {
        connected: navigator.onLine,
        connectionType: navigator.onLine ? 'unknown' : 'none',
      };
    }

    try {
      const status: ConnectionStatus = await Network.getStatus();
      
      let connectionType: 'wifi' | 'cellular' | 'none' | 'unknown' = 'unknown';
      if (!status.connected) {
        connectionType = 'none';
      } else if (status.connectionType === 'wifi') {
        connectionType = 'wifi';
      } else if (status.connectionType === 'cellular') {
        connectionType = 'cellular';
      }

      return {
        connected: status.connected,
        connectionType,
      };
    } catch (error) {
      console.warn('Network status check failed:', error);
      return {
        connected: navigator.onLine,
        connectionType: navigator.onLine ? 'unknown' : 'none',
      };
    }
  },

  addListener(callback: (status: NetworkStatus) => void): () => void {
    if (!Capacitor.isNativePlatform()) {
      const handler = () => {
        callback({
          connected: navigator.onLine,
          connectionType: navigator.onLine ? 'unknown' : 'none',
        });
      };
      
      window.addEventListener('online', handler);
      window.addEventListener('offline', handler);
      
      return () => {
        window.removeEventListener('online', handler);
        window.removeEventListener('offline', handler);
      };
    }

    const listener = Network.addListener('networkStatusChange', (status) => {
      let connectionType: 'wifi' | 'cellular' | 'none' | 'unknown' = 'unknown';
      if (!status.connected) {
        connectionType = 'none';
      } else if (status.connectionType === 'wifi') {
        connectionType = 'wifi';
      } else if (status.connectionType === 'cellular') {
        connectionType = 'cellular';
      }

      callback({
        connected: status.connected,
        connectionType,
      });
    });

    return () => {
      listener.then(handle => handle.remove());
    };
  },
};
