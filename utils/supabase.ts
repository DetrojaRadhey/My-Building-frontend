import { createClient } from '@supabase/supabase-js';

// Get the anon key from: Supabase Dashboard → Project Settings → API → anon/public key
const SUPABASE_URL = 'https://poeuxlhzcwqahrvdfhds.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvZXV4bGh6Y3dxYWhydmRmaGRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNjc5NTIsImV4cCI6MjA4OTY0Mzk1Mn0.1QOgi_D4amSBQgveJrEu276pbasApNXCgiFkZQ-nn5E';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: { params: { eventsPerSecond: 10 } },
});
