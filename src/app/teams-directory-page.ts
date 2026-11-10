import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TeamDirectoryItem, TournamentDataService, TournamentSummary } from './tournament-data.service';

@Component({standalone:true,selector:'app-teams-directory',imports:[CommonModule,FormsModule,RouterLink],templateUrl:'./teams-directory-page.html',styleUrl:'./teams-directory-page.scss'})
export class TeamsDirectoryPage implements OnInit {
  years:number[]=[];tournaments:TournamentSummary[]=[];year=0;tournamentId='';teams:TeamDirectoryItem[]=[];loading=true;error='';
  constructor(private data:TournamentDataService,private cdr:ChangeDetectorRef){}
  get selectedTournamentName():string{return this.tournaments.find(t=>t.id===this.tournamentId)?.name||'';}
  async ngOnInit():Promise<void>{try{this.years=await this.data.getYears();this.year=this.years[0]||new Date().getFullYear();await this.loadYear();}catch(e){this.error=this.message(e);}finally{this.loading=false;this.cdr.markForCheck();}}
  async loadYear():Promise<void>{this.tournaments=await this.data.getTournaments(this.year);this.tournamentId=this.tournaments[0]?.id||'';await this.loadTournament();}
  async loadTournament():Promise<void>{this.loading=true;this.error='';this.cdr.markForCheck();try{this.teams=this.tournamentId?await this.data.loadTeamDirectory(this.tournamentId):[];}catch(e){this.error=this.message(e);this.teams=[];}finally{this.loading=false;this.cdr.markForCheck();}}
  private message(e:unknown):string{return e instanceof Error?e.message:'No se pudieron cargar los equipos.';}
}
