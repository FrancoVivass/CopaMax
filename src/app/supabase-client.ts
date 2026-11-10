import { createClient } from '@supabase/supabase-js';
import { environment } from '../environments/environment';

export const supabase = environment.supabaseUrl && environment.supabaseAnonKey
  ? createClient(environment.supabaseUrl, environment.supabaseAnonKey)
  : null;
