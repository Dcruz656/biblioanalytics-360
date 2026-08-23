import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL
  || 'https://mqlpqjhyulibwpeiivws.supabase.co';
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xbHBxamh5dWxpYndwZWlpdndzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0NDYxNTIsImV4cCI6MjEwMzAyMjE1Mn0.D-DQCQCG--2mRMEcemyaZ6X0irYrBxNZBy3Ad4jszLs';

export const supabase = createClient(url, key);
export const isOnline = true;
