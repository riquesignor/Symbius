// Cliente do NotificationHub (push remoto — funciona com o app fechado)
const NOTIFICATION_HUB_URL = 'http://localhost:5000';

export type DeviceType = 'iOS' | 'Android' | 'Web';

export async function registrarDispositivo(
  userId: string,
  expoPushToken: string,
  deviceType: DeviceType,
) {
  try {
    await fetch(`${NOTIFICATION_HUB_URL}/api/devices/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        token: expoPushToken,
        deviceType,
        deviceName: null,
      }),
    });
  } catch (e) {
    console.log('❌ Erro ao registrar dispositivo no NotificationHub:', e);
  }
}

export async function enviarNotificacaoRemota(
  userId: string,
  title: string,
  message: string,
  data?: Record<string, string>,
) {
  try {
    await fetch(`${NOTIFICATION_HUB_URL}/api/notifications/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        title,
        message,
        primaryChannel: 'push',
        fallbackChannels: [],
        data: data || {},
      }),
    });
  } catch (e) {
    console.log('❌ Erro ao enviar notificação remota:', e);
  }
}
