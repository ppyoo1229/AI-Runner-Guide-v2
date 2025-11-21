import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://vgpmomzotvczxuldurei.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZncG1vbXpvdHZjenh1bGR1cmVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1NDc2MjcsImV4cCI6MjA3OTEyMzYyN30.I01MlydAwkGlw-eW1i6bof0IuqhXLNh3l9CKWV9R-IE'

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Import the supabase client like this:
// For React:
// import { supabase } from "@/integrations/supabase/client";
// For React Native:
// import { supabase } from "@/src/integrations/supabase/client";
