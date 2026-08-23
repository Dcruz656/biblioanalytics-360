const VAPID_PUBLIC_KEY =
  'BH6cAHyPF_2GBOo7MooRRf_sh91NkQvwEcTW6jC420pXOLaM8lN_yy9P6_7vhQoil49-3pUyxvNpbndP0zzyqEQ';

const EDGE_FN_URL =
  'https://mqlpqjhyulibwpeiivws.supabase.co/functions/v1/send-push';

const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xbHBxamh5dWxpYndwZWlpdndzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0NDYxNTIsImV4cCI6MjEwMzAyMjE1Mn0.D-DQCQCG--2mRMEcemyaZ6X0irYrBxNZBy3Ad4jszLs';

function urlBase64ToUint8Array(b64) {
  const padding = '='.repeat((4 - b64.length % 4) % 4);
  const base64  = (b64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return false;
  try {
    await navigator.serviceWorker.register('/sw.js');
    return true;
  } catch (err) {
    console.error('[push] SW register failed:', err);
    return false;
  }
}

export async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }
    return sub.toJSON();
  } catch (err) {
    console.error('[push] subscribe failed:', err);
    return null;
  }
}

export async function sendPush(subscription, title, body) {
  try {
    await fetch(EDGE_FN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ subscription, title, body }),
    });
  } catch (err) {
    console.error('[push] sendPush failed:', err);
  }
}
