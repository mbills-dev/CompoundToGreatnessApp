import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  return finalStatus === 'granted';
}

export async function scheduleDailyReminders(
  morningEnabled: boolean = true,
  eveningEnabled: boolean = true
) {
  if (Platform.OS === 'web') {
    return;
  }

  await cancelAllNotifications();

  if (morningEnabled) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Are we running today?',
        body: 'Start your day strong. Complete your daily tasks.',
        sound: true,
      },
      trigger: {
        hour: 8,
        minute: 0,
        repeats: true,
      } as any,
    });
  }

  if (eveningEnabled) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Still time to complete today',
        body: "Don't break your streak. Finish your daily tasks now.",
        sound: true,
      },
      trigger: {
        hour: 20,
        minute: 0,
        repeats: true,
      } as any,
    });
  }
}

export async function cancelAllNotifications() {
  if (Platform.OS === 'web') {
    return;
  }

  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function sendImmediateNotification(title: string, body: string) {
  if (Platform.OS === 'web') {
    return;
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
    },
    trigger: null,
  });
}
