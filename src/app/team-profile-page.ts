import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TeamProfileData, TeamProfileMatch, TournamentDataService } from './tournament-data.service';

@Component({standalone:true,selector:'app-team-profile',imports:[CommonModule,RouterLink],templateUrl:'./team-profile-page.html',styleUrl:'./team-profile-page.scss'})
export class TeamProfilePage implements OnInit {
  profile:TeamProfileData|null=null;loading=true;error='';
  constructor(private route:ActivatedRoute,private router:Router,private data:TournamentDataService,private cdr:ChangeDetectorRef){}
  async ngOnInit():Promise<void>{try{this.profile=await this.data.loadPublicTeamProfile(this.route.snapshot.paramMap.get('slug')||'');}catch(e){this.error=e instanceof Error?e.message:'No se pudo abrir el perfil del equipo.';}finally{this.loading=false;this.cdr.markForCheck();}}
  get upcomingMatches():TeamProfileMatch[]{return (this.profile?.matches||[]).filter(m=>m.homeScore===null).slice(0,3);}
  get recentResults():TeamProfileMatch[]{return (this.profile?.matches||[]).filter(m=>m.homeScore!==null).slice().reverse().slice(0,3);}
  get identityVariant():number{const id=this.profile?.team.id||this.profile?.slug||'club';let hash=0;for(let i=0;i<id.length;i++)hash=(hash*31+id.charCodeAt(i))|0;return Math.abs(hash)%6+1;}
  get identityHue():number{const id=this.profile?.team.id||this.profile?.slug||'club';let hash=0;for(let i=0;i<id.length;i++)hash=(hash*31+id.charCodeAt(i))|0;return ((hash%360)+360)%360;}
  outcome(match:TeamProfileMatch):string{if(!this.profile)return '';const home=match.home===this.profile.team.id;const scored=home?match.homeScore:match.awayScore;const conceded=home?match.awayScore:match.homeScore;return scored===conceded?'EMPATE':Number(scored)>Number(conceded)?'TRIUNFO':'DERROTA';}
  matchDay(date:string|null):string{return date?new Intl.DateTimeFormat('es-AR',{day:'2-digit'}).format(new Date(`${date}T12:00:00`)):'—';}
  matchMonth(date:string|null):string{return date?new Intl.DateTimeFormat('es-AR',{month:'short'}).format(new Date(`${date}T12:00:00`)).replace('.','').toUpperCase():'A CONFIRMAR';}
  matchWeekday(date:string|null):string{return date?new Intl.DateTimeFormat('es-AR',{weekday:'long'}).format(new Date(`${date}T12:00:00`)).toUpperCase():'DÍA A CONFIRMAR';}
  matchTime(time:string|null):string{if(!time)return 'HORA A CONFIRMAR';const match=/^(\d{1,2}:\d{2})/.exec(time.trim());return match?`${match[1]} HS`:time;}
  matchDate(date:string|null):string{if(!date)return 'Fecha a confirmar';return new Intl.DateTimeFormat('es-AR',{weekday:'short',day:'2-digit',month:'short'}).format(new Date(`${date}T12:00:00`));}
  whatsappLink(phone:string):string{return `https://wa.me/${phone.replace(/[^0-9]/g,'')}`;}
  scrollToSection(event:Event,id:string):void{event.preventDefault();void this.router.navigate([],{relativeTo:this.route,fragment:id,replaceUrl:true}).finally(()=>requestAnimationFrame(()=>document.getElementById(id)?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'})));}
}
