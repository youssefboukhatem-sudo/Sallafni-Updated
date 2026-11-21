import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { Login } from './pages/login/login';
import { AlmostTherePage } from './pages/almost-there/almost-there';
import { ProfilePage } from './pages/profile/profile';
import { Choose } from './pages/choose/choose';
import { Lender } from './pages/lender/lender';
import { Borrower } from './pages/borrower/borrower';
import { authGuard, guestGuard, almostThereGuard } from './core/auth.guard';

const base = 'Sallafni';

export const routes: Routes = [
  { path: '', component: Home, pathMatch: 'full', title: `${base} – Why buy it when you can borrow it` },
  { path: 'login', component: Login, canActivate: [guestGuard], title: `Log in – ${base}` },
  // Shown once, right after sign-up. When it is saved, this redirects to /profile.
  { path: 'almost-there', component: AlmostTherePage, canActivate: [almostThereGuard], title: `Almost there – ${base}` },
  { path: 'profile', component: ProfilePage, canActivate: [authGuard], title: `Your profile – ${base}` },
  { path: 'u/:id', component: ProfilePage, title: `Member profile – ${base}` },
  { path: 'choose', component: Choose, canActivate: [authGuard], title: `Borrow or lend – ${base}` },
  { path: 'lender', component: Lender, canActivate: [authGuard], title: `Lender dashboard – ${base}` },
  { path: 'borrower', component: Borrower, title: `Borrow – ${base}` },
  { path: '**', redirectTo: '' },
];
