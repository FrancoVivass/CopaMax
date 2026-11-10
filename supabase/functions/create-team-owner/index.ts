import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authorization = req.headers.get('Authorization');
    if (!authorization) return respond({ error: 'Sesión requerida.' }, 401);
    const caller = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
    const { data: userData, error: userError } = await caller.auth.getUser();
    if (userError || !userData.user) return respond({ error: 'Sesión inválida.' }, 401);
    const { data: admin, error: adminError } = await caller.from('admins').select('user_id').eq('user_id', userData.user.id).maybeSingle();
    if (adminError || !admin) return respond({ error: 'Solo administración puede crear accesos.' }, 403);

    const body = await req.json();
    const teamId = String(body.teamId || '');
    const email = String(body.email || '').trim().toLowerCase();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(teamId) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return respond({ error: 'Equipo o email inválido.' }, 400);

    const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: team, error: teamError } = await service.from('teams').select('id').eq('id', teamId).maybeSingle();
    if (teamError || !team) return respond({ error: 'El equipo seleccionado no existe.' }, 404);
    const { data: currentAssignment } = await service.from('team_owners').select('user_id').eq('team_id', teamId).maybeSingle();
    const { data: existingUsers, error: listError } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) return respond({ error: listError.message }, 500);
    const existing = existingUsers.users.find((u) => u.email?.toLowerCase() === email);
    if (existing) {
      const { data: adminRecord } = await service.from('admins').select('user_id').eq('user_id', existing.id).maybeSingle();
      if (adminRecord) return respond({ error: 'Ese email ya pertenece a la administración de Copa Max.' }, 409);
      const { data: ownerRecord } = await service.from('team_owners').select('team_id').eq('user_id', existing.id).maybeSingle();
      if (ownerRecord && ownerRecord.team_id !== teamId) return respond({ error: 'Ese email ya está asignado a otro equipo.' }, 409);
    }
    if (currentAssignment && currentAssignment.user_id !== existing?.id) return respond({ error: 'Este equipo ya tiene un acceso asignado. Usá el email existente para renovar sus credenciales.' }, 409);
    const temporaryPassword = `CM-${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}a!`;
    let authUserId: string | undefined;
    if (existing) {
      const { data, error } = await service.auth.admin.updateUserById(existing.id, { password: temporaryPassword, email_confirm: true });
      if (error) return respond({ error: error.message }, 400);
      authUserId = data.user.id;
    } else {
      const { data, error } = await service.auth.admin.createUser({ email, password: temporaryPassword, email_confirm: true });
      if (error || !data.user) return respond({ error: error?.message || 'No se pudo crear la cuenta.' }, 400);
      authUserId = data.user.id;
    }
    const { error: ownerError } = await service.from('team_owners').upsert({ user_id: authUserId, team_id: teamId }, { onConflict: 'user_id' });
    if (ownerError) return respond({ error: ownerError.message }, 400);
    return respond({ email, temporaryPassword });
  } catch (error) {
    return respond({ error: error instanceof Error ? error.message : 'Error interno.' }, 500);
  }
});
