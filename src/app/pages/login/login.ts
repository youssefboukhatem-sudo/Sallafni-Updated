import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { errorMessage } from '../../core/format';
import { Store } from '../../core/store';

@Component({ selector: 'app-login', templateUrl: './login.html' })
export class Login {
  private readonly router = inject(Router);
  private readonly store = inject(Store);

  // "Join your neighborhood" links here with ?mode=register to open the sign-up form directly.
  protected readonly mode = signal<'login' | 'register'>(
    inject(ActivatedRoute).snapshot.queryParamMap.get('mode') === 'register' ? 'register' : 'login',
  );
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly showPassword = signal(false);
  protected readonly emailError = signal(false);
  protected readonly passwordError = signal(false);
  protected readonly serverError = signal('');
  protected readonly busy = signal(false);

  protected toggleMode(e: Event) {
    e.preventDefault();
    this.mode.set(this.mode() === 'login' ? 'register' : 'login');
    this.serverError.set('');
  }

  protected async submit(e: Event) {
    e.preventDefault();
    const okEmail = /^\S+@\S+\.\S+$/.test(this.email());
    const okPassword = this.password().length >= 8;
    this.emailError.set(!okEmail);
    this.passwordError.set(!okPassword);
    this.serverError.set('');
    if (!okEmail || !okPassword) return;

    this.busy.set(true);
    try {
      const user = this.mode() === 'login'
        ? await this.store.login(this.email().trim(), this.password())
        : await this.store.register(this.email().trim(), this.password());
      this.router.navigateByUrl(user.complete ? '/choose' : '/almost-there');
    } catch (err) {
      this.serverError.set(errorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }
}
