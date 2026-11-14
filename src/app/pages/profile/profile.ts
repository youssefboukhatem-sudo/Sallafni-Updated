import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CITIES } from '../../core/data';
import { errorMessage } from '../../core/format';
import { Profile } from '../../core/models';
import { Store } from '../../core/store';

type Required = 'fn' | 'ln' | 'phone' | 'street' | 'city';
const REQUIRED: Required[] = ['fn', 'ln', 'phone', 'street', 'city'];
const GEO_DEFAULT = 'Sharing your device location makes distances more accurate.';

@Component({ selector: 'app-profile', imports: [FormsModule], templateUrl: './profile.html' })
export class ProfilePage implements OnInit {
  private readonly store = inject(Store);
  private readonly router = inject(Router);

  protected readonly countries = ['Tunisia', 'Algeria', 'Morocco', 'Libya', 'France', 'Other'];
  protected readonly cityNames = Object.keys(CITIES).map((k) => k.replace(/\b\w/g, (c) => c.toUpperCase()));

  protected model: Profile = this.blank();
  protected readonly errors = signal<Partial<Record<Required, boolean>>>({});
  protected readonly geoStatus = signal(GEO_DEFAULT);
  protected readonly serverError = signal('');
  protected readonly busy = signal(false);
  private geo: [number, number] | null = null;

  ngOnInit() {
    const saved = this.store.user();
    if (saved) {
      this.model = { ...this.blank(), ...Object.fromEntries(Object.entries(saved).filter(([, v]) => v !== null)) };
      this.geoStatus.set(saved.lat != null ? 'Exact location saved.' : GEO_DEFAULT);
    }
  }

  private blank(): Profile {
    return { fn: '', ln: '', country: 'Tunisia', phone: '', street: '', line2: '', city: '', area: '', state: '', zip: '' };
  }

  protected locate() {
    if (!navigator.geolocation) {
      this.geoStatus.set('Location is not available in this browser.');
      return;
    }
    this.geoStatus.set('Locating…');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        this.geo = [p.coords.latitude, p.coords.longitude];
        this.geoStatus.set('Location captured. It is only used to calculate distances.');
      },
      () => this.geoStatus.set('Could not get your location. You can continue with your city instead.'),
    );
  }

  protected async submit() {
    const errs: Partial<Record<Required, boolean>> = {};
    let first: Required | null = null;
    for (const k of REQUIRED) {
      const bad = !String(this.model[k]).trim();
      errs[k] = bad;
      if (bad && !first) first = k;
    }
    this.errors.set(errs);
    if (first) {
      document.getElementById(first)?.focus();
      return;
    }

    const old = this.store.user();
    const next = Object.fromEntries(
      Object.entries(this.model)
        .filter(([k]) => ['fn', 'ln', 'country', 'phone', 'street', 'line2', 'city', 'area', 'state', 'zip'].includes(k))
        .map(([k, v]) => [k, String(v ?? '').trim()]),
    ) as unknown as Profile;
    if (this.geo) { next.lat = this.geo[0]; next.lng = this.geo[1]; }
    else if (old?.lat != null && old.city === next.city) { next.lat = old.lat; next.lng = old.lng; }

    this.busy.set(true);
    this.serverError.set('');
    try {
      await this.store.saveProfile(next);
      this.router.navigateByUrl('/choose');
    } catch (e) {
      this.serverError.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
