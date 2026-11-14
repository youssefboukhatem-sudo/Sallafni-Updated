import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Store } from './core/store';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
})
export class App {
  protected readonly store = inject(Store);
  private readonly router = inject(Router);

  protected search(e: Event) {
    e.preventDefault();
    this.router.navigateByUrl('/borrower');
  }

  protected logout() {
    this.store.logout();
    this.router.navigateByUrl('/');
  }
}
