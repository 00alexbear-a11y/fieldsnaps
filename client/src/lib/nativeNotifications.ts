import { Capacitor } from '@capacitor/core';
import { LocalNotifications, ScheduleOptions } from '@capacitor/local-notifications';

export interface NotificationOptions {
  title: string;
  body: string;
  id?: number;
  schedule?: {
    at: Date;
  };
}

export const nativeNotifications = {
  async requestPermissions(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      if ('Notification' in window) {
        const result = await Notification.requestPermission();
        return result === 'granted';
      }
      return false;
    }

    try {
      const result = await LocalNotifications.requestPermissions();
      return result.display === 'granted';
    } catch (error) {
      console.warn('Notification permissions request failed:', error);
      return false;
    }
  },

  async schedule(options: NotificationOptions): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(options.title, {
          body: options.body,
        });
      }
      return;
    }

    try {
      const scheduleOptions: ScheduleOptions = {
        notifications: [
          {
            id: options.id || Date.now(),
            title: options.title,
            body: options.body,
            schedule: options.schedule,
          },
        ],
      };

      await LocalNotifications.schedule(scheduleOptions);
    } catch (error) {
      console.warn('Notification scheduling failed:', error);
    }
  },

  async cancel(id: number): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    
    try {
      await LocalNotifications.cancel({ notifications: [{ id }] });
    } catch (error) {
      console.warn('Notification cancellation failed:', error);
    }
  },

  async cancelAll(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    
    try {
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length > 0) {
        await LocalNotifications.cancel({ notifications: pending.notifications });
      }
    } catch (error) {
      console.warn('Cancel all notifications failed:', error);
    }
  },
};
