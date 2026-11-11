import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TournamentDataService, TournamentScorer, TournamentSummary } from './tournament-data.service';
import { VectorIconComponent } from './vector-icon';

@Component({selector:'app-scorers-page',standalone:true,imports:[CommonModule,FormsModule,RouterLink,VectorIconComponent],templateUrl:'./scorers-page.html',styleUrl:'./scorers-page.scss'})
export class ScorersPage implements OnInit {
  years:number[]=[];tournaments:TournamentSummary[]=[];year=0;tournamentId='';scorers:TournamentScorer[]=[];loading=true;error='';
  constructor(private data:TournamentDataService,private cdr:ChangeDetectorRef){}
  get selectedTournamentName():string{return this.tournaments.find(t=>t.id===this.tournamentId)?.name||'Torneo';}
  get podium():TournamentScorer[]{return this.scorers.slice(0,3);}
  get remaining():TournamentScorer[]{return this.scorers.slice(3);}
  async ngOnInit():Promise<void>{try{this.years=await this.data.getYears();this.tournaments=await this.data.getTournaments();this.year=this.years[0]||new Date().getFullYear();await this.loadYear();}catch(error){this.error=this.message(error);}finally{this.loading=false;this.cdr.markForCheck();}}
  async loadYear():Promise<void>{this.tournamentId=this.tournaments.find(t=>t.year===Number(this.year))?.id||'';await this.loadTournament(this.tournamentId);}
  async loadTournament(id:string):Promise<void>{this.tournamentId=id;this.error='';this.loading=true;this.cdr.markForCheck();try{this.scorers=id?await this.data.loadTournamentScorers(id):[];}catch(error){this.scorers=[];this.error=this.message(error);}finally{this.loading=false;this.cdr.markForCheck();}}
  private message(error:unknown):string{return error instanceof Error?error.message:'No se pudo cargar la tabla de goleadores.';}
}
