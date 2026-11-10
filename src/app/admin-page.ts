import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SupabaseAuthService } from './supabase-auth.service';
import { PostseasonCup, PostseasonCupMatch, PostseasonCupType, TeamOwnerCredentials, TournamentDataService, TournamentMatch, TournamentMatchZone, TournamentPlayer, TournamentSponsor, TournamentSummary, TournamentTeam, TournamentZone } from './tournament-data.service';

type Team = TournamentTeam;
type Player = TournamentPlayer;
type Match = TournamentMatch;
type Sponsor = TournamentSponsor;
type Zone = TournamentZone;

@Component({selector:'app-admin-page',standalone:true,imports:[CommonModule,FormsModule],templateUrl:'./admin-page.html',styleUrl:'./admin-page.scss'})
export class AdminPage implements OnInit {
  email=''; password=''; loginError=''; loginBusy=false; authenticated=false; checkingSession=true; toast='';
  dashboardError=''; loadingData=false; activeYear=2026; availableYears:number[]=[]; availableTournaments:TournamentSummary[]=[]; activeTournamentId=''; newSeasonYear=new Date().getFullYear(); newTournamentName='';
  teamLogoFile:File|null=null; teamLogoPreview=''; savingTeam=false; sponsorLogoFile:File|null=null; sponsorLogoPreview=''; savingSponsor=false;
  teams:Team[]=[]; players:Player[]=[]; matches:Match[]=[]; sponsors:Sponsor[]=[]; rounds:number[]=[]; editingId='';
  teamForm={name:'',zone:'A' as Zone,logo:''}; playerForm={teamId:'',name:'',number:'' as number|''};
  sponsorForm={name:'',logo:'',url:'',category:'SPONSOR OFICIAL'};
  ownerForm={teamId:'',email:''};ownerBusy=false;ownerCredentials:TeamOwnerCredentials|null=null;
  postseasonCups:PostseasonCup[]=[];cupTypes:PostseasonCupType[]=['ORO','PLATA'];cupTeamToAdd:Record<string,string>={};cupMatchEdit:Record<string,string>={};
  cupMatchForms:Record<string,{roundNumber:number;matchNumber:number;homeTeamId:string;awayTeamId:string;homeScore:number|'';awayScore:number|'';winnerTeamId:string;date:string;time:string;venue:string}>={};
  matchForm={date:'',time:'',round:1,zone:'A' as TournamentMatchZone,home:'',away:'',homeScore:'' as number|'',awayScore:'' as number|'',venue:''};
  constructor(public auth:SupabaseAuthService,private data:TournamentDataService,private cdr:ChangeDetectorRef){}

  async ngOnInit():Promise<void>{
    try{
      this.authenticated=await this.withTimeout(this.auth.hasAdminSession(),8000,'La verificación tardó demasiado. Revisá tu conexión e intentá ingresar nuevamente.');
      this.checkingSession=false;
      this.cdr.markForCheck();
      if(this.authenticated){
        this.loadingData=true;
        void this.withTimeout(this.initializeDashboard(),15000,'Supabase no respondió a tiempo. Revisá la conexión y recargá el panel.')
          .catch(error=>{this.dashboardError=this.errorText(error);this.loadingData=false;});
      }
    }catch(error){this.loginError=this.errorText(error);this.checkingSession=false;this.cdr.markForCheck();}
  }
  async initializeDashboard():Promise<void>{
    this.loadingData=true;this.dashboardError='';
    try{
      this.availableYears=await this.data.getYears();
      this.availableTournaments=await this.data.getTournaments();
      const currentYear=new Date().getFullYear();
      this.activeYear=this.availableYears.includes(currentYear)?currentYear:(this.availableYears[0]||currentYear);
      this.newSeasonYear=currentYear;const first=this.tournamentsForYear(this.activeYear)[0];
      if(first){this.activeTournamentId=first.id;this.newTournamentName=`Torneo ${first.edition+1}`;await this.loadTournament(first.id);}
      else {this.activeTournamentId='';this.newTournamentName='Torneo 1';this.clearTournamentData();this.dashboardError=`No hay torneos para ${this.activeYear}. Creá uno desde este panel.`;}
    }catch(error){this.dashboardError=this.errorText(error);}
    finally{this.loadingData=false;this.cdr.markForCheck();}
  }
  get canEditTournament():boolean{return !!this.activeTournamentId&&this.availableTournaments.some(t=>t.id===this.activeTournamentId);}
  tournamentsForYear(year:number):TournamentSummary[]{return this.availableTournaments.filter(t=>t.year===Number(year)).sort((a,b)=>a.edition-b.edition);}
  async selectYear(year:number):Promise<void>{
    this.activeYear=Number(year);const first=this.tournamentsForYear(this.activeYear)[0];
    if(first){this.activeTournamentId=first.id;await this.loadTournament(first.id);}else{this.activeTournamentId='';this.teams=[];this.players=[];this.matches=[];this.sponsors=[];this.postseasonCups=[];this.refreshRounds();}
  }
  async loadTournament(tournamentId:string):Promise<void>{
    const selected=this.availableTournaments.find(t=>t.id===tournamentId);if(!selected)return;
    this.activeTournamentId=selected.id;this.activeYear=selected.year;this.loadingData=true;this.dashboardError='';
    try{const season=await this.data.loadTournament(tournamentId);this.teams=season.teams;this.players=season.players;this.matches=season.matches;this.sponsors=season.sponsors;this.refreshRounds();try{this.postseasonCups=await this.data.loadPostseasonCups(tournamentId);this.ensureCupMatchForms();}catch(error){this.postseasonCups=[];this.dashboardError=this.errorText(error);}}
    catch(error){this.dashboardError=this.errorText(error);this.teams=[];this.players=[];this.matches=[];this.sponsors=[];this.refreshRounds();}
    finally{this.loadingData=false;this.cdr.markForCheck();}
  }
  async createTournament():Promise<void>{
    const year=Number(this.newSeasonYear);if(!Number.isInteger(year)||year<2000||year>2100){this.notify('Ingresá un año válido');return;}
    try{const tournament=await this.data.createTournament(year,this.newTournamentName);this.availableYears=await this.data.getYears();this.availableTournaments=await this.data.getTournaments();this.activeYear=year;this.newTournamentName=`Torneo ${tournament.edition+1}`;await this.loadTournament(tournament.id);this.notify(`${tournament.name} creado`);}
    catch(error){this.dashboardError=this.errorText(error);}
  }
  async deleteTournament():Promise<void>{
    const tournament=this.availableTournaments.find(t=>t.id===this.activeTournamentId);if(!tournament)return;
    const confirmed=window.confirm(`¿Eliminar “${tournament.name}” (${tournament.year})? Se borrarán sus ${this.teams.length} clubes, planteles, partidos y sponsors. Esta acción no se puede deshacer.`);
    if(!confirmed)return;
    this.loadingData=true;this.dashboardError='';
    try{
      await this.data.deleteTournament(tournament.id);
      this.availableTournaments=this.availableTournaments.filter(t=>t.id!==tournament.id);
      this.availableYears=await this.data.getYears();
      const next=this.tournamentsForYear(this.activeYear)[0]||this.availableTournaments[0];
      if(next)await this.loadTournament(next.id);
      else{this.activeTournamentId='';this.clearTournamentData();this.newTournamentName='Torneo 1';this.dashboardError=`“${tournament.name}” fue eliminado. Creá otro torneo cuando quieras.`;}
      this.notify(`Torneo ${tournament.name} eliminado`);
    }catch(error){this.dashboardError=this.errorText(error);}
    finally{this.loadingData=false;this.cdr.markForCheck();}
  }
  async login():Promise<void>{
    this.loginError='';this.loginBusy=true;
    try{await this.auth.signInAsAdmin(this.email.trim(),this.password);this.authenticated=true;this.password='';await this.initializeDashboard();}
    catch(error){this.loginError=this.errorText(error);}
    finally{this.loginBusy=false;this.cdr.markForCheck();}
  }
  async logout():Promise<void>{await this.auth.signOut();this.authenticated=false;this.email='';this.password='';}
  team(id:string):Team|undefined{return this.teams.find(t=>t.id===id);}
  teamsForZone(zone:Zone):Team[]{return this.teams.filter(t=>t.zone===zone);}
  teamsForMatchZone(zone:TournamentMatchZone):Team[]{return zone==='INTERZONAL'?this.teams:this.teamsForZone(zone);}
  clearMatchTeams():void{this.matchForm.home='';this.matchForm.away='';}
  onLogoSelected(event:Event):void{
    const input=event.target as HTMLInputElement;const file=input.files?.[0]||null;
    if(!file){this.teamLogoFile=null;this.teamLogoPreview='';return;}
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)){this.clearLogoPreview();this.dashboardError='El escudo debe ser PNG, JPG o WebP.';input.value='';return;}
    if(file.size>5*1024*1024){this.clearLogoPreview();this.dashboardError='El escudo no puede superar 5 MB.';input.value='';return;}
    this.dashboardError='';this.teamForm.logo='';this.clearLogoPreview();this.teamLogoFile=file;this.teamLogoPreview=URL.createObjectURL(file);
  }
  onSponsorLogoSelected(event:Event):void{
    const input=event.target as HTMLInputElement;const file=input.files?.[0]||null;
    if(!file){this.sponsorLogoFile=null;this.sponsorLogoPreview='';return;}
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)){this.clearSponsorLogoPreview();this.dashboardError='El logo del sponsor debe ser PNG, JPG o WebP.';input.value='';return;}
    if(file.size>5*1024*1024){this.clearSponsorLogoPreview();this.dashboardError='El logo del sponsor no puede superar 5 MB.';input.value='';return;}
    this.dashboardError='';this.sponsorForm.logo='';this.clearSponsorLogoPreview();this.sponsorLogoFile=file;this.sponsorLogoPreview=URL.createObjectURL(file);
  }
  roundLabel(round:number):string{return `Fecha ${String(round).padStart(2,'0')}`;}
  formatDate(date:string|null):string{if(!date)return 'Día a confirmar';const day=date.split('T')[0];return new Intl.DateTimeFormat('es-AR',{day:'2-digit',month:'short'}).format(new Date(`${day}T12:00:00`));}
  formatTime(time:string|null):string{return time?time.slice(0,5):'Hora a confirmar';}
  private refreshRounds():void{this.rounds=[...new Set(this.matches.map(m=>m.round))].sort((a,b)=>a-b);if(!this.rounds.includes(this.matchForm.round))this.matchForm.round=this.rounds[0]||1;}
  private clearTournamentData():void{this.teams=[];this.players=[];this.matches=[];this.sponsors=[];this.postseasonCups=[];this.refreshRounds();}
  async addTeam():Promise<void>{
    if(!this.canEditTournament){this.dashboardError='Elegí o creá un torneo antes de cargar clubes.';return;}
    const name=this.teamForm.name.trim();if(!name){this.notify('Ingresá el nombre del equipo');return;}
    this.savingTeam=true;
    try{const logo=this.teamLogoFile?await this.data.uploadTeamLogo(this.activeYear,this.activeTournamentId,this.teamLogoFile):this.teamForm.logo.trim();const team=await this.data.addTeam(this.activeYear,this.activeTournamentId,{name,zone:this.teamForm.zone,logo});this.teams=[...this.teams,team];this.teamForm={name:'',zone:'A',logo:''};this.clearLogoPreview();this.notify('Equipo agregado');}
    catch(error){this.dashboardError=this.errorText(error);}
    finally{this.savingTeam=false;}
  }
  async createTeamOwner():Promise<void>{
    if(!this.ownerForm.teamId||!this.ownerForm.email.trim()){this.dashboardError='Seleccioná un equipo e ingresá el email de su responsable.';return;}
    this.ownerBusy=true;this.dashboardError='';this.ownerCredentials=null;
    try{this.ownerCredentials=await this.data.createTeamOwnerAccount(this.ownerForm.teamId,this.ownerForm.email.trim());this.notify('Acceso de club generado.');}
    catch(error){this.dashboardError=this.errorText(error);}
    finally{this.ownerBusy=false;this.cdr.markForCheck();}
  }
  async copyOwnerCredentials():Promise<void>{if(!this.ownerCredentials)return;try{await navigator.clipboard.writeText(`Email: ${this.ownerCredentials.email}\nContraseña temporal: ${this.ownerCredentials.temporaryPassword}`);this.notify('Credenciales copiadas.');}catch{this.notify('No se pudieron copiar; seleccioná los datos.');}}
  clearLogoPreview():void{if(this.teamLogoPreview)URL.revokeObjectURL(this.teamLogoPreview);this.teamLogoFile=null;this.teamLogoPreview='';}
  clearSponsorLogoPreview():void{if(this.sponsorLogoPreview)URL.revokeObjectURL(this.sponsorLogoPreview);this.sponsorLogoFile=null;this.sponsorLogoPreview='';}
  async addPlayer():Promise<void>{
    const name=this.playerForm.name.trim();if(!name||!this.playerForm.teamId){this.notify('Elegí un equipo y escribí el nombre');return;}
    try{const player=await this.data.addPlayer({teamId:this.playerForm.teamId,name,number:this.playerForm.number===''?null:Number(this.playerForm.number)});this.players=[...this.players,player];this.playerForm={teamId:this.playerForm.teamId,name:'',number:''};this.notify('Jugador agregado');}
    catch(error){this.dashboardError=this.errorText(error);}
  }
  async deletePlayer(id:string):Promise<void>{try{await this.data.deletePlayer(id);this.players=this.players.filter(p=>p.id!==id);}catch(error){this.dashboardError=this.errorText(error);}}
  async addSponsor():Promise<void>{
    if(!this.canEditTournament){this.dashboardError='Elegí o creá un torneo antes de cargar sponsors.';return;}
    const name=this.sponsorForm.name.trim();if(!name){this.notify('Ingresá el nombre del sponsor');return;}
    this.savingSponsor=true;
    try{const logo=this.sponsorLogoFile?await this.data.uploadSponsorLogo(this.activeYear,this.activeTournamentId,this.sponsorLogoFile):this.sponsorForm.logo.trim();const sponsor=await this.data.addSponsor(this.activeYear,this.activeTournamentId,{name,logo,url:this.sponsorForm.url.trim(),category:this.sponsorForm.category.trim()||'SPONSOR OFICIAL'});this.sponsors=[...this.sponsors,sponsor];this.sponsorForm={name:'',logo:'',url:'',category:'SPONSOR OFICIAL'};this.clearSponsorLogoPreview();this.notify('Sponsor agregado al carrusel');}
    catch(error){this.dashboardError=this.errorText(error);}
    finally{this.savingSponsor=false;}
  }
  async deleteSponsor(id:string):Promise<void>{try{await this.data.deleteSponsor(id);this.sponsors=this.sponsors.filter(s=>s.id!==id);this.notify('Sponsor quitado del carrusel');}catch(error){this.dashboardError=this.errorText(error);}}
  async saveMatch():Promise<void>{
    if(!this.canEditTournament){this.dashboardError='Elegí o creá un torneo antes de cargar partidos.';return;}
    const f=this.matchForm;if(!f.home||!f.away||f.home===f.away){this.notify('Elegí dos equipos distintos');return;}
    const homeZone=this.team(f.home)?.zone,awayZone=this.team(f.away)?.zone;
    if(f.zone==='INTERZONAL'?homeZone===awayZone:homeZone!==f.zone||awayZone!==f.zone){this.notify(f.zone==='INTERZONAL'?'Un partido interzonal debe cruzar equipos de las zonas A y B.':'Los dos equipos deben pertenecer a la zona elegida.');return;}
    const scored=f.homeScore!==''&&f.awayScore!=='';
    const match={date:f.date||null,time:f.time||null,round:Number(f.round),zone:f.zone,home:f.home,away:f.away,homeScore:scored?Number(f.homeScore):null,awayScore:scored?Number(f.awayScore):null,venue:f.venue.trim()};
    try{const saved=await this.data.saveMatch(this.activeYear,this.activeTournamentId,match,this.editingId||undefined);this.matches=this.editingId?this.matches.map(m=>m.id===saved.id?saved:m):[...this.matches,saved];this.refreshRounds();await this.refreshStandings();this.resetMatch();this.notify('Partido guardado · tabla actualizada');}
    catch(error){this.dashboardError=this.errorText(error);}
  }
  editMatch(m:Match):void{this.editingId=m.id;this.matchForm={date:m.date?.split('T')[0]||'',time:m.time||m.date?.split('T')[1]?.slice(0,5)||'',round:m.round,zone:m.zone,home:m.home,away:m.away,homeScore:m.homeScore??'',awayScore:m.awayScore??'',venue:m.venue};window.scrollTo({top:0,behavior:'smooth'});}
  async deleteMatch(id:string):Promise<void>{try{await this.data.deleteMatch(id);this.matches=this.matches.filter(m=>m.id!==id);await this.refreshStandings();this.notify('Partido eliminado');}catch(error){this.dashboardError=this.errorText(error);}}
  resetMatch():void{this.editingId='';this.matchForm={date:'',time:'',round:this.rounds[0]||1,zone:'A',home:'',away:'',homeScore:'',awayScore:'',venue:''};}
  private async refreshStandings():Promise<void>{const fresh=await this.data.loadTournament(this.activeTournamentId);this.teams=fresh.teams;this.players=fresh.players;this.matches=fresh.matches;this.sponsors=fresh.sponsors;this.refreshRounds();}
  rankedTeams(zone:Zone):Team[]{return this.teams.filter(t=>t.zone===zone).slice().sort((a,b)=>(b.pts-a.pts)||((b.gf-b.ga)-(a.gf-a.ga))||(b.gf-a.gf)||a.name.localeCompare(b.name,'es'));}
  qualifiers(type:PostseasonCupType):Team[]{const first=type==='ORO'?0:4;return (['A','B'] as Zone[]).flatMap(z=>this.rankedTeams(z).slice(first,first+4));}
  cup(type:PostseasonCupType):PostseasonCup|undefined{return this.postseasonCups.find(c=>c.type===type);}
  allLeagueMatchesComplete():boolean{return this.matches.length>0&&this.matches.every(m=>m.homeScore!==null&&m.awayScore!==null);}
  cupRoundName(round:number):string{return round===1?'CUARTOS DE FINAL':round===2?'SEMIFINAL':'FINAL';}
  cupMatchFormFor(cupId:string){return this.cupMatchForms[cupId]||(this.cupMatchForms[cupId]={roundNumber:1,matchNumber:1,homeTeamId:'',awayTeamId:'',homeScore:'',awayScore:'',winnerTeamId:'',date:'',time:'',venue:''});}
  private ensureCupMatchForms():void{for(const cup of this.postseasonCups)if(!this.cupMatchForms[cup.id])this.cupMatchForms[cup.id]={roundNumber:1,matchNumber:cup.matches.filter(m=>m.roundNumber===1).length+1,homeTeamId:'',awayTeamId:'',homeScore:'',awayScore:'',winnerTeamId:'',date:'',time:'',venue:''};}
  setCupRound(cup:PostseasonCup,round:number):void{const f=this.cupMatchFormFor(cup.id);f.roundNumber=Number(round);f.matchNumber=cup.matches.filter(m=>m.roundNumber===f.roundNumber).length+1;f.homeTeamId='';f.awayTeamId='';f.winnerTeamId='';}
  teamsForCupRound(cup:PostseasonCup,round:number){if(round<=1)return cup.entries;const previous=cup.matches.filter(m=>m.roundNumber===round-1);if(!previous.length)return cup.entries;const ids=previous.map(m=>m.homeScore===null||m.awayScore===null?null:m.homeScore===m.awayScore?m.winnerTeamId:m.homeScore>m.awayScore?m.homeTeamId:m.awayTeamId).filter((id):id is string=>!!id);return cup.entries.filter(e=>ids.includes(e.teamId));}
  cupWinner(match:PostseasonCupMatch):string|null{if(match.homeScore===null||match.awayScore===null)return null;if(match.homeScore===match.awayScore)return match.winnerTeamId;return match.homeScore>match.awayScore?match.homeTeamId:match.awayTeamId;}
  qualifyingRank(type:PostseasonCupType,team:Team):number{return this.rankedTeams(team.zone).findIndex(t=>t.id===team.id)+1;}
  teamsAvailableForCup(cup:PostseasonCup):Team[]{return this.teams.filter(t=>!cup.entries.some(e=>e.teamId===t.id));}
  async prepareCup(type:PostseasonCupType):Promise<void>{
    if(!this.canEditTournament)return;
    if(!this.allLeagueMatchesComplete()){this.notify('Completá todos los resultados del torneo antes de abrir las copas.');return;}
    const selected=this.qualifiers(type);if(!selected.length){this.notify('No hay equipos en las posiciones clasificatorias para esta copa.');return;}
    this.loadingData=true;this.dashboardError='';try{await this.data.createPostseasonCup(this.activeTournamentId,type,selected.map((team,index)=>({teamId:team.id,seed:index+1})));this.postseasonCups=await this.data.loadPostseasonCups(this.activeTournamentId);this.ensureCupMatchForms();this.notify(`Copa ${type} creada con ${selected.length} clasificados.`);}catch(error){this.dashboardError=this.errorText(error);}finally{this.loadingData=false;this.cdr.markForCheck();}
  }
  async addCupTeam(cup:PostseasonCup):Promise<void>{const teamId=this.cupTeamToAdd[cup.id];if(!teamId)return;const team=this.team(teamId);if(!team)return;try{await this.data.addPostseasonCupTeam(cup.id,teamId,cup.entries.length+1);this.postseasonCups=await this.data.loadPostseasonCups(this.activeTournamentId);this.ensureCupMatchForms();this.cupTeamToAdd[cup.id]='';this.notify(`${team.name} agregado a Copa ${cup.type}.`);}catch(error){this.dashboardError=this.errorText(error);}}
  async removeCupTeam(entryId:string):Promise<void>{try{await this.data.removePostseasonCupTeam(entryId);this.postseasonCups=await this.data.loadPostseasonCups(this.activeTournamentId);this.ensureCupMatchForms();this.notify('Clasificado quitado de la copa.');}catch(error){this.dashboardError=this.errorText(error);}}
  editCupMatch(cup:PostseasonCup,match:PostseasonCupMatch):void{this.cupMatchEdit[cup.id]=match.id;this.cupMatchForms[cup.id]={roundNumber:match.roundNumber,matchNumber:match.matchNumber,homeTeamId:match.homeTeamId,awayTeamId:match.awayTeamId,homeScore:match.homeScore??'',awayScore:match.awayScore??'',winnerTeamId:match.winnerTeamId||'',date:match.date||'',time:match.time||'',venue:match.venue||''};}
  async saveCupMatch(cup:PostseasonCup):Promise<void>{const f=this.cupMatchFormFor(cup.id);if(!f.homeTeamId||!f.awayTeamId||f.homeTeamId===f.awayTeamId){this.notify('Elegí dos equipos distintos para el cruce.');return;}if((f.homeScore==='')!==(f.awayScore==='')){this.notify('Completá los dos goles o dejá ambos vacíos.');return;}if(f.homeScore!==''&&f.homeScore===f.awayScore&&!f.winnerTeamId){this.notify('En una eliminatoria empatada, indicá quién pasó por penales.');return;}try{await this.data.savePostseasonCupMatch({cupId:cup.id,roundNumber:Number(f.roundNumber),matchNumber:Number(f.matchNumber),date:f.date||null,time:f.time||null,homeTeamId:f.homeTeamId,awayTeamId:f.awayTeamId,homeScore:f.homeScore===''?null:Number(f.homeScore),awayScore:f.awayScore===''?null:Number(f.awayScore),winnerTeamId:f.homeScore!==''&&f.homeScore===f.awayScore?f.winnerTeamId:null,venue:f.venue},this.cupMatchEdit[cup.id]);this.postseasonCups=await this.data.loadPostseasonCups(this.activeTournamentId);this.ensureCupMatchForms();this.cupMatchEdit[cup.id]='';this.cupMatchForms[cup.id]={roundNumber:1,matchNumber:cup.matches.filter(m=>m.roundNumber===1).length+1,homeTeamId:'',awayTeamId:'',homeScore:'',awayScore:'',winnerTeamId:'',date:'',time:'',venue:''};this.notify('Cruce de copa guardado. El campeón de la final se actualiza automáticamente.');}catch(error){this.dashboardError=this.errorText(error);}}
  async deleteCupMatch(id:string):Promise<void>{try{await this.data.deletePostseasonCupMatch(id);this.postseasonCups=await this.data.loadPostseasonCups(this.activeTournamentId);this.ensureCupMatchForms();this.notify('Cruce de copa eliminado.');}catch(error){this.dashboardError=this.errorText(error);}}
  private errorText(error:unknown):string{
    const message=error instanceof Error?error.message:(error as {message?:string})?.message||'Ocurrió un error al comunicarse con Supabase.';
    if(message.includes('null value in column "tournament_id"'))return 'No estaba seleccionado el torneo al guardar. Actualizá el panel y elegí un torneo; si sigue pasando, ejecutá la última versión de supabase/schema.sql.';
    if(message.includes('Could not find the table')||message.includes('schema cache'))return 'No encuentro las tablas. Ejecutá la última versión de supabase/schema.sql en el SQL Editor de tu proyecto.';
    if(message.toLowerCase().includes('bucket not found'))return 'Falta el bucket de imágenes del torneo. Volvé a ejecutar la última versión de supabase/schema.sql.';
    if(message.includes('ya tiene sus dos torneos'))return message;
    return message;
  }
  private notify(message:string):void{this.toast=message;setTimeout(()=>this.toast='',2500);}
  private withTimeout<T>(operation:Promise<T>,milliseconds:number,message:string):Promise<T>{
    let timer:ReturnType<typeof setTimeout>;
    return Promise.race([operation,new Promise<T>((_,reject)=>{timer=setTimeout(()=>reject(new Error(message)),milliseconds);})])
      .finally(()=>clearTimeout(timer));
  }
  private static localDateTime():string{const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,16);}
  private localDateTime():string{return AdminPage.localDateTime();}
  private toLocalDateTime(value:string):string{const d=new Date(value);d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,16);}
}
