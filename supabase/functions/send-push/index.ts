// Supabase Edge Function — send-push
// Recibe { subscription, title, body } y envía una notificación Web Push via VAPID.
//
// Secrets requeridos (Supabase Dashboard → Settings → Secrets):
//   VAPID_PRIVATE_KEY = Z1Prxj3UUsriw8_EldLMdslP388bqmEDEO9o4NS1SNw
//
// Para desplegar desde CLI:
//   supabase functions deploy send-push --no-verify-jwt

import webpush from 'npm:web-push@3.6.7';

const VAPID_PUBLIC =
  'BH6cAHyPF_2GBOo7MooRRf_sh91NkQvwEcTW6jC420pXOLaM8lN_yy9P6_7vhQoil49-3pUyxvNpbndP0zzyqEQ';
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
const CONTACT      = 'mailto:danielcruzbautista@gmail.com';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

webpush.setVapidDetails(CONTACT, VAPID_PUBLIC, VAPID_PRIVATE);

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }

  try {
    const { subscription, title, body } = await req.json();
    if (!subscription) {
      return new Response(JSON.stringify({ error: 'subscription requerida' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    await webpush.sendNotification(
      subscription,
      JSON.stringify({ title: title ?? 'Biblioteca', body: body ?? '' }),
    );

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[send-push] error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }
});
