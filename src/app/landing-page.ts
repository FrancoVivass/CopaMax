import { AfterViewInit, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PostseasonCup, PostseasonCupMatch, TournamentDataService, TournamentScorer, TournamentSummary } from './tournament-data.service';

type Zone='A'|'B';
type MatchZone=Zone|'INTERZONAL';
interface Team {id:string;name:string;zone:Zone;logo:string;played:number;won:number;drawn:number;lost:number;gf:number;ga:number;pts:number;slug?:string;}
interface Match {id:string;date:string|null;time?:string|null;round:number;zone:MatchZone;home:string;away:string;homeScore:number|null;awayScore:number|null;venue:string;}
interface Sponsor {id:string;name:string;logo:string;url:string;category:string;}

@Component({selector:'app-landing-page',standalone:true,imports:[CommonModule,FormsModule,RouterLink],templateUrl:'./landing-page.html',styleUrl:'./landing-page.scss'})
export class LandingPage implements OnInit,AfterViewInit {
  menuOpen=false;activeZone:Zone='A';activeMatchZone:MatchZone='A';activeView:'fixture'|'results'='fixture';
  activeYear=new Date().getFullYear();availableYears:number[]=[];availableTournaments:TournamentSummary[]=[];activeTournamentId='';loadingData=false;
  teams:Team[]=[];matches:Match[]=[];rounds:number[]=[];selectedRound=1;sponsors:Sponsor[]=[];postseasonCups:PostseasonCup[]=[];scorers:TournamentScorer[]=[];
  private revealObserver?:IntersectionObserver;
  constructor(private data:TournamentDataService,private cdr:ChangeDetectorRef){}

  async ngOnInit():Promise<void>{
    this.loadingData=true;this.cdr.markForCheck();
    try{
      if(!this.data.isConfigured){this.availableYears=[this.activeYear];return;}
      this.availableYears=await this.data.getYears();
      if(!this.availableYears.length)this.availableYears=[this.activeYear];
      const currentYear=new Date().getFullYear();this.activeYear=this.availableYears.includes(currentYear)?currentYear:this.availableYears[0];
      this.availableTournaments=await this.data.getTournaments();
      const first=this.tournamentsForYear(this.activeYear)[0];
      if(first)await this.loadTournament(first.id);else this.clearTournament();
    }catch{this.clearTournament();}
    finally{this.loadingData=false;this.cdr.markForCheck();}
  }
  ngAfterViewInit():void{
    if(!('IntersectionObserver'in window))return;
    this.revealObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{
      if(entry.isIntersecting){entry.target.classList.add('is-visible');this.revealObserver?.unobserve(entry.target);}
    }),{threshold:.12});
    this.observeRevealElements();
  }
  private observeRevealElements():void{
    if(!this.revealObserver)return;
      document.querySelectorAll('.intro-top,.intro-body,.stat-strip,.teams-content>.eyebrow,.teams-title-row,.teams-footer,.sponsors-heading,.sponsor-card,.competition-head,.standings-card,.fixtures-card,.scorers-heading,.scorer-feature,.next-content,.quote-section blockquote').forEach((el,i)=>{
      if(el.classList.contains('is-visible'))return;
      el.classList.add('reveal-on-scroll');(el as HTMLElement).style.setProperty('--reveal-delay',`${Math.min(i%4,3)*65}ms`);this.revealObserver?.observe(el);
    });
  }
  get zoneTeams():Team[]{return this.teams.filter(t=>t.zone===this.activeZone).sort((a,b)=>b.pts-a.pts||(b.gf-b.ga)-(a.gf-a.ga)||b.gf-a.gf||a.name.localeCompare(b.name));}
  get visibleMatches():Match[]{return this.matches.filter(m=>m.zone===this.activeMatchZone&&m.round===this.selectedRound&&(this.activeView==='results'?m.homeScore!==null:m.homeScore===null)).sort((a,b)=>`${a.date||'9999'} ${a.time||''}`.localeCompare(`${b.date||'9999'} ${b.time||''}`));}
  get completedCount():number{return this.matches.filter(m=>m.homeScore!==null).length;}
  get nextMatch():Match|undefined{return this.matches.filter(m=>m.homeScore===null).sort((a,b)=>`${a.date||'9999'} ${a.time||''}`.localeCompare(`${b.date||'9999'} ${b.time||''}`))[0];}
  team(id:string):Team|undefined{return this.teams.find(t=>t.id===id);}
  cupRoundName(round:number):string{return round===1?'CUARTOS':round===2?'SEMIFINAL':'FINAL';}
  cupWinner(match:PostseasonCupMatch):string{if(match.homeScore===null||match.awayScore===null)return '';if(match.homeScore===match.awayScore)return match.winnerTeamId?this.team(match.winnerTeamId)?.name||'Ganador a confirmar':'Ganador por penales a confirmar';return this.team(match.homeScore>match.awayScore?match.homeTeamId:match.awayTeamId)?.name||'Ganador';}
  tournamentsForYear(year:number):TournamentSummary[]{return this.availableTournaments.filter(t=>t.year===Number(year)).sort((a,b)=>a.edition-b.edition);}
  async selectYear(year:number):Promise<void>{this.activeYear=Number(year);const first=this.tournamentsForYear(this.activeYear)[0];if(first)await this.loadTournament(first.id);else this.clearTournament();}
  async loadTournament(id:string):Promise<void>{
    const tournament=this.availableTournaments.find(t=>t.id===id);if(!tournament)return;
    this.activeYear=tournament.year;this.activeTournamentId=tournament.id;this.loadingData=true;this.cdr.markForCheck();
    try{const data=await this.data.loadTournament(id);this.teams=data.teams;this.matches=data.matches;this.sponsors=data.sponsors;this.refreshRounds();this.selectedRound=this.rounds[0]||1;try{this.postseasonCups=await this.data.loadPostseasonCups(id);}catch{this.postseasonCups=[];}try{this.scorers=await this.data.loadTournamentScorers(id);}catch{this.scorers=[];}}
    catch{this.clearTournament();}
    finally{this.loadingData=false;this.cdr.markForCheck();requestAnimationFrame(()=>this.observeRevealElements());}
  }
  private clearTournament():void{this.activeTournamentId='';this.teams=[];this.matches=[];this.sponsors=[];this.postseasonCups=[];this.scorers=[];this.refreshRounds();this.cdr.markForCheck();}
  private refreshRounds():void{this.rounds=[...new Set(this.matches.map(m=>m.round))].sort((a,b)=>a-b);if(!this.rounds.includes(this.selectedRound))this.selectedRound=this.rounds[0]||1;}
  moveSponsorCarousel(direction:number):void{document.querySelector('.sponsor-track')?.scrollBy({left:direction*300,behavior:'smooth'});}
  scrollToSection(event:Event,id:string):void{event.preventDefault();this.menuOpen=false;history.replaceState(null,'',`#${id}`);document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'});}
  logoFallback(event:Event):void{(event.target as HTMLImageElement).style.display='none';}
  roundLabel(round:number):string{return `Fecha ${String(round).padStart(2,'0')}`;}
  formatDate(date:string|null):string{if(!date)return 'Día a confirmar';const day=date.split('T')[0];return new Intl.DateTimeFormat('es-AR',{weekday:'short',day:'2-digit',month:'short'}).format(new Date(`${day}T12:00:00`));}
  formatTime(time:string|null|undefined,date?:string|null):string{const value=time||date?.split('T')[1]?.slice(0,5);return value?value.slice(0,5):'Hora a confirmar';}
  showMatch(match:Match):void{this.activeZone=this.team(match.home)?.zone||'A';this.activeMatchZone=match.zone;this.selectedRound=match.round;this.activeView='fixture';document.getElementById('liga-copa')?.scrollIntoView({behavior:'smooth'});}
}
