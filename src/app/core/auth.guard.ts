import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Store } from './store';

/** Pages that need an account redirect to /login. */
export const authGuard: CanActivateFn = () => {
  const store = inject(Store);
  return store.loggedIn() ? true : inject(Router).createUrlTree(['/login']);
};
