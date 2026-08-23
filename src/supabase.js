import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL
  || 'https://mqlpqjhyulibwpeiivws.supabase.co';
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xbHBxamh5dWxpYndwZWlpdndzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0NDYxNTIsImV4cCI6MjEwMzAyMjE1Mn0.D-DQCQCG--2mRMEcemyaZ6X0irYrBxNZBy3Ad4jszLs';

// Lazy init — avoids TDZ from circular deps inside @supabase/supabase-js
let _client = null;
function client() {
  if (!_client) _client = createClient(url, key);
  return _client;
}

export const supabase = new Proxy({}, {
  get(_, prop) {
    const val = client()[prop];
    return typeof val === 'function' ? val.bind(client()) : val;
  },
});

export const isOnline = true;
