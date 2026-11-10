import { Injectable } from '@angular/core';
import { supabase } from './supabase-client';

export type TournamentZone = 'A' | 'B';
export type TournamentMatchZone = TournamentZone | 'INTERZONAL';
export interface TournamentSummary { id:string; year:number; edition:number; name:string; }
export interface TournamentTeam { id:string; name:string; zone:TournamentZone; logo:string; played:number; won:number; drawn:number; lost:number; gf:number; ga:number; pts:number; slug?:string; }
export interface TournamentPlayer { id:string; teamId:string; name:string; number:number|null; photoUrl?:string; }
export interface TournamentMatch { id:string; date:string|null; time:string|null; round:number; zone:TournamentMatchZone; home:string; away:string; homeScore:number|null; awayScore:number|null; venue:string; }
export interface TournamentSponsor { id:string; name:string; logo:string; url:string; category:string; }
export interface TournamentData { teams:TournamentTeam[]; players:TournamentPlayer[]; matches:TournamentMatch[]; sponsors:TournamentSponsor[]; }
export interface TeamDirectoryItem extends TournamentTeam {slug:string;coachName:string;bannerUrl:string;description:string;tagline:string;accentColor:string;}
export interface TeamStaffMember {id:string;teamId:string;name:string;role:string;photoUrl:string;}
export interface TeamAchievement {id:string;teamId:string;title:string;description:string;year:number|null;imageUrl:string;}
export interface TeamGalleryImage {id:string;teamId:string;url:string;caption:string;}
export interface TeamProfileMatch {id:string;round:number;date:string|null;time:string|null;venue:string;zone:TournamentMatchZone;home:string;away:string;homeName:string;awayName:string;homeLogo:string;awayLogo:string;homeScore:number|null;awayScore:number|null;}
export interface TeamProfileData {team:TournamentTeam;slug:string;seasonYear:number;tournamentName:string;profileStyle:'stadium'|'heritage'|'street';description:string;tagline:string;coachName:string;coachPhotoUrl:string;bannerUrl:string;city:string;foundedYear:number|null;instagramUrl:string;facebookUrl:string;whatsapp:string;accentColor:string;staff:TeamStaffMember[];achievements:TeamAchievement[];players:TournamentPlayer[];gallery:TeamGalleryImage[];matches:TeamProfileMatch[];}
export type PostseasonCupType='ORO'|'PLATA';
export interface PostseasonCupEntry {id:string;cupId:string;teamId:string;seed:number;teamName:string;zone:TournamentZone;logo:string;}
export interface PostseasonCupMatch {id:string;cupId:string;roundNumber:number;matchNumber:number;date:string|null;time:string|null;homeTeamId:string;awayTeamId:string;homeName:string;awayName:string;homeLogo:string;awayLogo:string;homeScore:number|null;awayScore:number|null;winnerTeamId:string|null;venue:string;}
export interface PostseasonCup {id:string;tournamentId:string;tournamentName:string;seasonYear:number;type:PostseasonCupType;championTeamId:string|null;championTeamName:string;entries:PostseasonCupEntry[];matches:PostseasonCupMatch[];}
export interface TeamOwnerCredentials {email:string;temporaryPassword:string;}

@Injectable({providedIn:'root'})
export class TournamentDataService {
  get isConfigured():boolean{return supabase!==null;}

  async getYears():Promise<number[]> {
    const {data,error}=await this.client().from('seasons').select('season_year').order('season_year',{ascending:false});
    if(error) throw error;
    return (data||[]).map(row=>Number(row.season_year));
  }
  async getTournaments(year?:number):Promise<TournamentSummary[]> {
    let request=this.client().from('tournaments').select('id,season_year,edition,name').order('season_year',{ascending:false}).order('edition');
    if(year!==undefined)request=request.eq('season_year',year);
    const {data,error}=await request;
    if(error)throw error;
    return (data||[]).map((r:any):TournamentSummary=>({id:r.id,year:Number(r.season_year),edition:Number(r.edition),name:r.name}));
  }
  async loadTournament(tournamentId:string):Promise<TournamentData> {
    const client=this.client();
    const [standingRows,matchRows,sponsorRows]=await Promise.all([
      client.from('standings').select('*').eq('tournament_id',tournamentId).order('position'),
      client.from('matches').select('*').eq('tournament_id',tournamentId).order('scheduled_date',{nullsFirst:false}).order('scheduled_time',{nullsFirst:false}),
      client.from('sponsors').select('*').eq('tournament_id',tournamentId).eq('is_active',true).order('display_order').order('name')
    ]);
    if(standingRows.error)throw standingRows.error;if(matchRows.error)throw matchRows.error;if(sponsorRows.error)throw sponsorRows.error;
    const standingData=standingRows.data||[];const teamIdsForProfiles=standingData.map((r:any)=>r.team_id);let teamSlugs=new Map<string,string>();
    if(teamIdsForProfiles.length){const {data:profiles,error:profileError}=await client.from('team_profiles').select('team_id,slug').in('team_id',teamIdsForProfiles);if(profileError)throw profileError;teamSlugs=new Map((profiles||[]).map((p:any)=>[p.team_id,p.slug]));}
    const teams=standingData.map((r:any):TournamentTeam=>({id:r.team_id,name:r.name,zone:r.zone,logo:r.logo_url||'',played:Number(r.played||0),won:Number(r.won||0),drawn:Number(r.drawn||0),lost:Number(r.lost||0),gf:Number(r.goals_for||0),ga:Number(r.goals_against||0),pts:Number(r.points||0),slug:teamSlugs.get(r.team_id)||r.team_id}));
    let players:TournamentPlayer[]=[];const teamIds=teams.map(t=>t.id);
    if(teamIds.length){const result=await client.from('players').select('*').in('team_id',teamIds).order('name');if(result.error)throw result.error;players=(result.data||[]).map((r:any):TournamentPlayer=>({id:r.id,teamId:r.team_id,name:r.name,number:r.shirt_number===null?null:Number(r.shirt_number)}));}
    const matches=(matchRows.data||[]).map((r:any):TournamentMatch=>({id:r.id,date:r.scheduled_date||r.scheduled_at?.slice(0,10)||null,time:r.scheduled_time||r.scheduled_at?.slice(11,16)||null,round:Number(r.round),zone:r.zone,home:r.home_team_id,away:r.away_team_id,homeScore:r.home_score===null?null:Number(r.home_score),awayScore:r.away_score===null?null:Number(r.away_score),venue:r.venue||''}));
    const sponsors=(sponsorRows.data||[]).map((r:any):TournamentSponsor=>({id:r.id,name:r.name,logo:r.logo_url||'',url:r.website_url||'',category:r.category||'SPONSOR OFICIAL'}));
    return {teams,players,matches,sponsors};
  }

  async loadTeamDirectory(tournamentId:string):Promise<TeamDirectoryItem[]>{
    const client=this.client();
    const {data:rows,error}=await client.from('standings').select('*').eq('tournament_id',tournamentId).order('name');
    if(error)throw error;
    const ids=(rows||[]).map((r:any)=>r.team_id);if(!ids.length)return [];
    const {data:profiles,error:profileError}=await client.from('team_profiles').select('team_id,slug,description,coach_name,banner_url,tagline,accent_color').in('team_id',ids);
    if(profileError)throw profileError;
    const byTeam=new Map((profiles||[]).map((p:any)=>[p.team_id,p]));
    return (rows||[]).map((r:any):TeamDirectoryItem=>{const p:any=byTeam.get(r.team_id)||{};return {id:r.team_id,name:r.name,zone:r.zone,logo:r.logo_url||'',played:Number(r.played||0),won:Number(r.won||0),drawn:Number(r.drawn||0),lost:Number(r.lost||0),gf:Number(r.goals_for||0),ga:Number(r.goals_against||0),pts:Number(r.points||0),slug:p.slug||r.team_id,description:p.description||'',tagline:p.tagline||'',accentColor:p.accent_color||'#09a9ef',coachName:p.coach_name||'',bannerUrl:p.banner_url||''};});
  }

  async loadPublicTeamProfile(slug:string):Promise<TeamProfileData>{return this.loadTeamProfile('slug',slug);}
  async loadOwnedTeamProfile(teamId:string):Promise<TeamProfileData>{return this.loadTeamProfile('team_id',teamId);}
  private async loadTeamProfile(column:'slug'|'team_id',value:string):Promise<TeamProfileData>{
    const client=this.client();
    const {data:p,error}=await client.from('team_profiles').select('team_id,slug,description,tagline,coach_name,coach_photo_url,banner_url,city,founded_year,instagram_url,facebook_url,whatsapp,accent_color,profile_style,teams!inner(id,name,zone,logo_url,season_year,tournament_id)').eq(column,value).single();
    if(error)throw error;
    const teamRow=Array.isArray((p as any).teams)?(p as any).teams[0]:(p as any).teams;
    const [{data:standing,error:standingError},{data:players,error:playersError},{data:staff,error:staffError},{data:achievements,error:achievementsError},{data:gallery,error:galleryError},{data:matchRows,error:matchesError},{data:tournament,error:tournamentError}]=await Promise.all([
      client.from('standings').select('*').eq('team_id',p.team_id).eq('tournament_id',teamRow.tournament_id).maybeSingle(),
      client.from('players').select('*').eq('team_id',p.team_id).order('shirt_number').order('name'),
      client.from('team_staff').select('*').eq('team_id',p.team_id).order('sort_order').order('name'),
      client.from('team_achievements').select('*').eq('team_id',p.team_id).order('achievement_year',{ascending:false,nullsFirst:false}).order('created_at',{ascending:false}),
      client.from('team_gallery').select('*').eq('team_id',p.team_id).order('sort_order').order('created_at',{ascending:false}),
      client.from('matches').select('*').eq('tournament_id',teamRow.tournament_id).or(`home_team_id.eq.${p.team_id},away_team_id.eq.${p.team_id}`).order('scheduled_date',{nullsFirst:false}).order('scheduled_time',{nullsFirst:false}),
      client.from('tournaments').select('name,season_year').eq('id',teamRow.tournament_id).maybeSingle()
    ]);
    if(standingError)throw standingError;if(playersError)throw playersError;if(staffError)throw staffError;if(achievementsError)throw achievementsError;if(galleryError)throw galleryError;if(matchesError)throw matchesError;if(tournamentError)throw tournamentError;
    const matchTeamIds=[...new Set((matchRows||[]).flatMap((m:any)=>[m.home_team_id,m.away_team_id]))];let teamById=new Map<string,any>();
    if(matchTeamIds.length){const {data:matchTeams,error:matchTeamsError}=await client.from('teams').select('id,name,logo_url').in('id',matchTeamIds);if(matchTeamsError)throw matchTeamsError;teamById=new Map((matchTeams||[]).map((t:any)=>[t.id,t]));}
    const matches:TeamProfileMatch[]=(matchRows||[]).map((m:any)=>{const home=teamById.get(m.home_team_id),away=teamById.get(m.away_team_id);return {id:m.id,round:Number(m.round),date:m.scheduled_date||m.scheduled_at?.slice(0,10)||null,time:m.scheduled_time||m.scheduled_at?.slice(11,16)||null,venue:m.venue||'',zone:m.zone,home:m.home_team_id,away:m.away_team_id,homeName:home?.name||'Equipo',awayName:away?.name||'Equipo',homeLogo:home?.logo_url||'',awayLogo:away?.logo_url||'',homeScore:m.home_score===null?null:Number(m.home_score),awayScore:m.away_score===null?null:Number(m.away_score)};});
    const team:TournamentTeam={id:teamRow.id,name:teamRow.name,zone:teamRow.zone,logo:teamRow.logo_url||'',played:Number((standing as any)?.played||0),won:Number((standing as any)?.won||0),drawn:Number((standing as any)?.drawn||0),lost:Number((standing as any)?.lost||0),gf:Number((standing as any)?.goals_for||0),ga:Number((standing as any)?.goals_against||0),pts:Number((standing as any)?.points||0)};
    return {team,slug:p.slug,seasonYear:Number(tournament?.season_year||teamRow.season_year||new Date().getFullYear()),tournamentName:tournament?.name||'Torneo',profileStyle:p.profile_style||'stadium',description:p.description||'',tagline:p.tagline||'',coachName:p.coach_name||'',coachPhotoUrl:p.coach_photo_url||'',bannerUrl:p.banner_url||'',city:p.city||'',foundedYear:p.founded_year===null?null:Number(p.founded_year),instagramUrl:p.instagram_url||'',facebookUrl:p.facebook_url||'',whatsapp:p.whatsapp||'',accentColor:p.accent_color||'#09a9ef',players:(players||[]).map((r:any)=>({id:r.id,teamId:r.team_id,name:r.name,number:r.shirt_number===null?null:Number(r.shirt_number),photoUrl:r.photo_url||''})),staff:(staff||[]).map((r:any)=>({id:r.id,teamId:r.team_id,name:r.name,role:r.role,photoUrl:r.photo_url||''})),achievements:(achievements||[]).map((r:any)=>({id:r.id,teamId:r.team_id,title:r.title,description:r.description||'',year:r.achievement_year===null?null:Number(r.achievement_year),imageUrl:r.image_url||''})),gallery:(gallery||[]).map((r:any)=>({id:r.id,teamId:r.team_id,url:r.image_url,caption:r.caption||''})),matches};
  }

  async updateTeamProfile(teamId:string,profile:{description:string;tagline:string;coachName:string;coachPhotoUrl:string;bannerUrl:string;city:string;foundedYear:number|null;instagramUrl:string;facebookUrl:string;whatsapp:string;accentColor:string;profileStyle:'stadium'|'heritage'|'street'}):Promise<void>{
    const {error}=await this.client().from('team_profiles').update({description:profile.description,tagline:profile.tagline||null,coach_name:profile.coachName||null,coach_photo_url:profile.coachPhotoUrl||null,banner_url:profile.bannerUrl||null,city:profile.city||null,founded_year:profile.foundedYear,instagram_url:profile.instagramUrl||null,facebook_url:profile.facebookUrl||null,whatsapp:profile.whatsapp||null,accent_color:profile.accentColor||'#09a9ef',profile_style:profile.profileStyle,updated_at:new Date().toISOString()}).eq('team_id',teamId);
    if(error)throw error;
  }
  async updateTeamName(teamId:string,name:string):Promise<void>{const {error}=await this.client().from('teams').update({name:name.trim(),updated_at:new Date().toISOString()}).eq('id',teamId);if(error)throw error;}
  async updateTeamLogo(teamId:string,logoUrl:string):Promise<void>{const {error}=await this.client().from('teams').update({logo_url:logoUrl||null}).eq('id',teamId);if(error)throw error;}
  async uploadTeamAsset(teamId:string,file:File):Promise<string>{
    if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('La imagen debe ser PNG, JPG o WebP.');
    if(file.size>8*1024*1024)throw new Error('La imagen no puede superar 8 MB.');
    const extension=file.name.split('.').pop()?.toLowerCase()||'png';const path=`${teamId}/${crypto.randomUUID()}.${extension}`;const storage=this.client().storage.from('team-assets');
    const {error}=await storage.upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type});if(error)throw error;return storage.getPublicUrl(path).data.publicUrl;
  }
  async addTeamStaff(teamId:string,member:{name:string;role:string;photoUrl?:string}):Promise<TeamStaffMember>{
    const {data,error}=await this.client().from('team_staff').insert({team_id:teamId,name:member.name,role:member.role,photo_url:member.photoUrl||null}).select('*').single();if(error)throw error;return {id:data.id,teamId:data.team_id,name:data.name,role:data.role,photoUrl:data.photo_url||''};
  }
  async deleteTeamStaff(id:string):Promise<void>{const {error}=await this.client().from('team_staff').delete().eq('id',id);if(error)throw error;}
  async updateTeamStaffPhoto(id:string,photoUrl:string):Promise<void>{const {error}=await this.client().from('team_staff').update({photo_url:photoUrl||null}).eq('id',id);if(error)throw error;}
  async addTeamAchievement(teamId:string,achievement:{title:string;description:string;year:number|null;imageUrl?:string}):Promise<TeamAchievement>{
    const {data,error}=await this.client().from('team_achievements').insert({team_id:teamId,title:achievement.title,description:achievement.description||null,achievement_year:achievement.year,image_url:achievement.imageUrl||null}).select('*').single();if(error)throw error;return {id:data.id,teamId:data.team_id,title:data.title,description:data.description||'',year:data.achievement_year===null?null:Number(data.achievement_year),imageUrl:data.image_url||''};
  }
  async deleteTeamAchievement(id:string):Promise<void>{const {error}=await this.client().from('team_achievements').delete().eq('id',id);if(error)throw error;}
  async updateTeamAchievementImage(id:string,imageUrl:string):Promise<void>{const {error}=await this.client().from('team_achievements').update({image_url:imageUrl||null}).eq('id',id);if(error)throw error;}
  async addTeamGalleryImage(teamId:string,url:string,caption:string):Promise<void>{const {error}=await this.client().from('team_gallery').insert({team_id:teamId,image_url:url,caption:caption.trim()||null});if(error)throw error;}
  async deleteTeamGalleryImage(id:string):Promise<void>{const {error}=await this.client().from('team_gallery').delete().eq('id',id);if(error)throw error;}
  async createTeamOwnerAccount(teamId:string,email:string):Promise<TeamOwnerCredentials>{
    const {data,error}=await this.client().functions.invoke('create-team-owner',{body:{teamId,email}});
    if(error){
      const context=(error as any).context as Response|undefined;
      if(context?.status===404)throw new Error('La función create-team-owner todavía no está desplegada en Supabase. Desde la carpeta del proyecto ejecutá: npx supabase login, npx supabase link --project-ref buuvjtikgwdmpbvcwbnp y npx supabase functions deploy create-team-owner.');
      if(error.name==='FunctionsFetchError')throw new Error('No se pudo conectar con la función create-team-owner de Supabase. Revisá la conexión y confirmá que la función esté desplegada en el proyecto Copa Max.');
      if(context){const body=await context.clone().json().catch(()=>null);if(body?.error)throw new Error(String(body.error));}
      throw error;
    }
    if(!data?.email||!data?.temporaryPassword)throw new Error('Supabase respondió sin las credenciales esperadas. Revisá los registros de la función create-team-owner.');
    return {email:data.email,temporaryPassword:data.temporaryPassword};
  }

  async createTournament(year:number,name:string):Promise<TournamentSummary>{
    const client=this.client();
    const {error:seasonError}=await client.from('seasons').upsert({season_year:year},{onConflict:'season_year'});
    if(seasonError)throw seasonError;
    const existing=await this.getTournaments(year);if(existing.length>=2)throw new Error(`El año ${year} ya tiene sus dos torneos.`);
    const edition=existing.reduce((max,t)=>Math.max(max,t.edition),0)+1;
    const {data,error}=await client.from('tournaments').insert({season_year:year,edition,name:name.trim()||`Torneo ${edition}`}).select('id,season_year,edition,name').single();
    if(error)throw error;
    return {id:data.id,year:Number(data.season_year),edition:Number(data.edition),name:data.name};
  }
  async deleteTournament(tournamentId:string):Promise<void>{
    this.requireTournament(tournamentId);
    const {error}=await this.client().from('tournaments').delete().eq('id',tournamentId);
    if(error)throw error;
  }

  async addTeam(year:number,tournamentId:string,team:{name:string;zone:TournamentZone;logo:string}):Promise<TournamentTeam>{
    this.requireTournament(tournamentId);
    const {data,error}=await this.client().from('teams').insert({season_year:year,tournament_id:tournamentId,name:team.name,zone:team.zone,logo_url:team.logo||null}).select('id,name,zone,logo_url').single();
    if(error)throw error;
    return {id:data.id,name:data.name,zone:data.zone,logo:data.logo_url||'',played:0,won:0,drawn:0,lost:0,gf:0,ga:0,pts:0};
  }

  async uploadTeamLogo(year:number,tournamentId:string,file:File):Promise<string>{return this.uploadImage('team-logos',year,tournamentId,file);}
  async uploadSponsorLogo(year:number,tournamentId:string,file:File):Promise<string>{return this.uploadImage('sponsor-logos',year,tournamentId,file);}
  private async uploadImage(bucket:string,year:number,tournamentId:string,file:File):Promise<string>{
    this.requireTournament(tournamentId);
    if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('La imagen debe ser PNG, JPG o WebP.');
    if(file.size>5*1024*1024)throw new Error('La imagen no puede superar 5 MB.');
    const extension=file.name.split('.').pop()?.toLowerCase()||'png';const path=`${year}/${tournamentId}/${crypto.randomUUID()}.${extension}`;
    const storage=this.client().storage.from(bucket);const {error}=await storage.upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type});
    if(error)throw error;return storage.getPublicUrl(path).data.publicUrl;
  }

  async addPlayer(player:{teamId:string;name:string;number:number|null;photoUrl?:string}):Promise<TournamentPlayer>{
    const {data,error}=await this.client().from('players').insert({team_id:player.teamId,name:player.name,shirt_number:player.number,photo_url:player.photoUrl||null}).select('*').single();
    if(error)throw error;return {id:data.id,teamId:data.team_id,name:data.name,number:data.shirt_number===null?null:Number(data.shirt_number),photoUrl:data.photo_url||''};
  }
  async deletePlayer(id:string):Promise<void>{const {error}=await this.client().from('players').delete().eq('id',id);if(error)throw error;}
  async updatePlayerPhoto(id:string,photoUrl:string):Promise<void>{const {error}=await this.client().from('players').update({photo_url:photoUrl||null}).eq('id',id);if(error)throw error;}

  async addSponsor(year:number,tournamentId:string,sponsor:{name:string;logo:string;url:string;category:string}):Promise<TournamentSponsor>{
    this.requireTournament(tournamentId);
    const {data,error}=await this.client().from('sponsors').insert({season_year:year,tournament_id:tournamentId,name:sponsor.name,logo_url:sponsor.logo||null,website_url:sponsor.url||null,category:sponsor.category||'SPONSOR OFICIAL'}).select('*').single();
    if(error)throw error;return {id:data.id,name:data.name,logo:data.logo_url||'',url:data.website_url||'',category:data.category};
  }
  async deleteSponsor(id:string):Promise<void>{const {error}=await this.client().from('sponsors').delete().eq('id',id);if(error)throw error;}

  async saveMatch(year:number,tournamentId:string,match:Omit<TournamentMatch,'id'>,id?:string):Promise<TournamentMatch>{
    this.requireTournament(tournamentId);
    const row={season_year:year,tournament_id:tournamentId,round:match.round,zone:match.zone,scheduled_date:match.date||null,scheduled_time:match.time||null,scheduled_at:match.date&&match.time?new Date(`${match.date}T${match.time}`).toISOString():null,home_team_id:match.home,away_team_id:match.away,home_score:match.homeScore,away_score:match.awayScore,venue:match.venue||null};
    const request=id?this.client().from('matches').update(row).eq('id',id):this.client().from('matches').insert(row);
    const {data,error}=await request.select('*').single();
    if(error)throw error;return {id:data.id,date:data.scheduled_date||data.scheduled_at?.slice(0,10)||null,time:data.scheduled_time||data.scheduled_at?.slice(11,16)||null,round:Number(data.round),zone:data.zone,home:data.home_team_id,away:data.away_team_id,homeScore:data.home_score===null?null:Number(data.home_score),awayScore:data.away_score===null?null:Number(data.away_score),venue:data.venue||''};
  }
  async deleteMatch(id:string):Promise<void>{const {error}=await this.client().from('matches').delete().eq('id',id);if(error)throw error;}

  async loadPostseasonCups(tournamentId:string):Promise<PostseasonCup[]>{
    this.requireTournament(tournamentId);
    const client=this.client();
    const {data:cups,error}=await client.from('postseason_cups').select('id,tournament_id,cup_type,champion_team_id,champion:teams!postseason_cups_champion_team_id_fkey(id,name),tournaments!inner(name,season_year)').eq('tournament_id',tournamentId).order('cup_type');
    if(error)throw error;
    const ids=(cups||[]).map((c:any)=>c.id);if(!ids.length)return [];
    const [{data:entries,error:entryError},{data:matches,error:matchError}]=await Promise.all([
      client.from('postseason_cup_entries').select('id,cup_id,team_id,seed,teams!postseason_cup_entries_team_id_fkey(id,name,zone,logo_url)').in('cup_id',ids).order('seed'),
      client.from('postseason_cup_matches').select('id,cup_id,round_number,match_number,scheduled_date,scheduled_time,home_team_id,away_team_id,home_score,away_score,winner_team_id,venue,home_team:teams!postseason_cup_matches_home_team_id_fkey(id,name,logo_url),away_team:teams!postseason_cup_matches_away_team_id_fkey(id,name,logo_url)').in('cup_id',ids).order('round_number').order('match_number')
    ]);
    if(entryError)throw entryError;if(matchError)throw matchError;
    return (cups||[]).map((c:any):PostseasonCup=>{const tournament=Array.isArray(c.tournaments)?c.tournaments[0]:c.tournaments;const champion=Array.isArray(c.champion)?c.champion[0]:c.champion;return {id:c.id,tournamentId:c.tournament_id,tournamentName:tournament?.name||'Torneo',seasonYear:Number(tournament?.season_year||new Date().getFullYear()),type:c.cup_type,championTeamId:c.champion_team_id||null,championTeamName:champion?.name||'',entries:(entries||[]).filter((e:any)=>e.cup_id===c.id).map((e:any)=>{const t=Array.isArray(e.teams)?e.teams[0]:e.teams;return {id:e.id,cupId:e.cup_id,teamId:e.team_id,seed:Number(e.seed),teamName:t?.name||'Equipo',zone:t?.zone||'A',logo:t?.logo_url||''};}),matches:(matches||[]).filter((m:any)=>m.cup_id===c.id).map((m:any)=>{const home=Array.isArray(m.home_team)?m.home_team[0]:m.home_team,away=Array.isArray(m.away_team)?m.away_team[0]:m.away_team;return {id:m.id,cupId:m.cup_id,roundNumber:Number(m.round_number),matchNumber:Number(m.match_number),date:m.scheduled_date||null,time:m.scheduled_time?.slice(0,5)||null,homeTeamId:m.home_team_id,awayTeamId:m.away_team_id,homeName:home?.name||'Equipo',awayName:away?.name||'Equipo',homeLogo:home?.logo_url||'',awayLogo:away?.logo_url||'',homeScore:m.home_score===null?null:Number(m.home_score),awayScore:m.away_score===null?null:Number(m.away_score),winnerTeamId:m.winner_team_id||null,venue:m.venue||''};})};});
  }
  async createPostseasonCup(tournamentId:string,type:PostseasonCupType,qualifiedTeams:Array<{teamId:string;seed:number}>):Promise<void>{
    this.requireTournament(tournamentId);
    const {data,error}=await this.client().from('postseason_cups').insert({tournament_id:tournamentId,cup_type:type}).select('id').single();if(error)throw error;
    if(!qualifiedTeams.length)return;
    const {error:entryError}=await this.client().from('postseason_cup_entries').insert(qualifiedTeams.map(e=>({cup_id:data.id,team_id:e.teamId,seed:e.seed})));
    if(entryError){await this.client().from('postseason_cups').delete().eq('id',data.id);throw entryError;}
  }
  async addPostseasonCupTeam(cupId:string,teamId:string,seed:number):Promise<void>{const {error}=await this.client().from('postseason_cup_entries').insert({cup_id:cupId,team_id:teamId,seed});if(error)throw error;}
  async removePostseasonCupTeam(entryId:string):Promise<void>{const {error}=await this.client().from('postseason_cup_entries').delete().eq('id',entryId);if(error)throw error;}
  async savePostseasonCupMatch(match:Omit<PostseasonCupMatch,'id'|'homeName'|'awayName'|'homeLogo'|'awayLogo'>,id?:string):Promise<void>{
    const row={cup_id:match.cupId,round_number:match.roundNumber,match_number:match.matchNumber,scheduled_date:match.date||null,scheduled_time:match.time||null,home_team_id:match.homeTeamId,away_team_id:match.awayTeamId,home_score:match.homeScore,away_score:match.awayScore,winner_team_id:match.winnerTeamId||null,venue:match.venue||null};
    const request=id?this.client().from('postseason_cup_matches').update(row).eq('id',id):this.client().from('postseason_cup_matches').insert(row);const {error}=await request;if(error)throw error;
  }
  async deletePostseasonCupMatch(id:string):Promise<void>{const {error}=await this.client().from('postseason_cup_matches').delete().eq('id',id);if(error)throw error;}

  private requireTournament(tournamentId:string):void{if(!tournamentId)throw new Error('No hay un torneo seleccionado. Creá o seleccioná un torneo antes de cargar datos.');}
  private client(){if(!supabase)throw new Error('Supabase no está configurado.');return supabase;}
}
