import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./landing-page').then(m => m.LandingPage), title: 'Copa Max Dolores — El fútbol nos encuentra' },
  { path: 'admin', loadComponent: () => import('./admin-page').then(m => m.AdminPage), title: 'Administración — Copa Max Dolores' },
  { path: 'goleadores', loadComponent: () => import('./scorers-page').then(m => m.ScorersPage), title: 'Goleadores — Copa Max Dolores' },
  { path: 'equipos', loadComponent: () => import('./teams-directory-page').then(m => m.TeamsDirectoryPage), title: 'Equipos — Copa Max Dolores' },
  { path: 'equipos/:slug', loadComponent: () => import('./team-profile-page').then(m => m.TeamProfilePage), title: 'Club — Copa Max Dolores' },
  { path: 'club-admin', loadComponent: () => import('./team-owner-page').then(m => m.TeamOwnerPage), title: 'Panel del equipo — Copa Max Dolores' },
  { path: '**', redirectTo: '' }
];
