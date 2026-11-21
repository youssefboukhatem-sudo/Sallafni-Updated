import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Store } from './store';

/** Private pages: need an account AND the one-time "Almost there" step to be done. */
export const authGuard: CanActivateFn = () => {
  const store = inject(Store);
  const router = inject(Router);
  const u = store.user();
  if (!u) return router.createUrlTree(['/login']);
  return u.complete ? true : router.createUrlTree(['/almost-there']);
};

/** /almost-there: only for signed-in users who have not completed it yet (it is shown once). */
export const almostThereGuard: CanActivateFn = () => {
  const store = inject(Store);
  const router = inject(Router);
  const u = store.user();
  if (!u) return router.createUrlTree(['/login']);
  return u.complete ? router.createUrlTree(['/profile']) : true;
};

/** /login: someone who is already signed in goes straight on. */
export const guestGuard: CanActivateFn = () => {
  const store = inject(Store);
  const router = inject(Router);
  const u = store.user();
  if (!u) return true;
  return router.createUrlTree([u.complete ? '/choose' : '/almost-there']);
};
