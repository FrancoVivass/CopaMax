import { Injectable } from '@angular/core';
import { supabase } from './supabase-client';

@Injectable({ providedIn: 'root' })
export class SupabaseAuthService {
  get isConfigured(): boolean { return supabase !== null; }

  async signInAsAdmin(email: string, password: string): Promise<void> {
    if (!supabase) throw new Error('Falta configurar Supabase en src/environments/environment.ts.');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) throw new Error('El email o la contraseña no son correctos.');
    const { data: admin, error: adminError } = await supabase.from('admins').select('user_id').eq('user_id', data.user.id).maybeSingle();
    if (adminError || !admin) {
      await supabase.auth.signOut();
      throw new Error('Esta cuenta no tiene permisos de administrador de Copa Max.');
    }
  }

  async hasAdminSession(): Promise<boolean> {
    if (!supabase) return false;
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!sessionData.session) return false;
    const { data, error: userError } = await supabase.auth.getUser(sessionData.session.access_token);
    if (userError) throw userError;
    if (!data.user) return false;
    const { data: admin, error } = await supabase.from('admins').select('user_id').eq('user_id', data.user.id).maybeSingle();
    if (error) throw error;
    if (!admin) {
      await supabase.auth.signOut();
      return false;
    }
    return true;
  }

  async signInAsTeamOwner(email: string, password: string): Promise<string> {
    if (!supabase) throw new Error('Falta configurar Supabase.');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) throw new Error('El email o la contraseña no son correctos.');
    const { data: owner, error: ownerError } = await supabase.from('team_owners').select('team_id').eq('user_id', data.user.id).maybeSingle();
    if (ownerError || !owner) { await supabase.auth.signOut(); throw new Error('Esta cuenta no tiene un equipo asignado.'); }
    return owner.team_id;
  }

  async getOwnedTeamId(): Promise<string | null> {
    if (!supabase) return null;
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return null;
    const { data: user } = await supabase.auth.getUser(session.session.access_token);
    if (!user.user) return null;
    const { data, error } = await supabase.from('team_owners').select('team_id').eq('user_id', user.user.id).maybeSingle();
    if (error) throw error;
    return data?.team_id || null;
  }

  async signOut(): Promise<void> {
    if (supabase) await supabase.auth.signOut();
  }
}
