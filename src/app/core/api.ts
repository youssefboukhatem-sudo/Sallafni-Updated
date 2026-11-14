import { HttpClient, HttpInterceptorFn } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { IncomingRequest, Item, Me, OutgoingRequest, Owner, Profile, Stats } from './models';

const TOKEN_KEY = 'sallafni.token';
export const tokenStore = {
  get: () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set: (t: string) => { try { localStorage.setItem(TOKEN_KEY, t); } catch { /* storage unavailable */ } },
  clear: () => { try { localStorage.removeItem(TOKEN_KEY); } catch { /* storage unavailable */ } },
};

/** Adds the JWT to every API call. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const t = tokenStore.get();
  return next(t && req.url.startsWith('/api') ? req.clone({ setHeaders: { Authorization: `Bearer ${t}` } }) : req);
};

/** Thin typed wrapper over the REST API (see backend/README). */
@Injectable({ providedIn: 'root' })
export class Api {
  private readonly http = inject(HttpClient);
  private readonly b = '/api';

  register = (email: string, password: string) => firstValueFrom(this.http.post<{ token: string; user: Me }>(`${this.b}/auth/register`, { email, password }));
  login = (email: string, password: string) => firstValueFrom(this.http.post<{ token: string; user: Me }>(`${this.b}/auth/login`, { email, password }));
  me = () => firstValueFrom(this.http.get<Me>(`${this.b}/auth/me`));
  saveProfile = (p: Profile) => firstValueFrom(this.http.put<Me>(`${this.b}/auth/me`, p));

  items = () => firstValueFrom(this.http.get<Item[]>(`${this.b}/items`));
  myItems = () => firstValueFrom(this.http.get<Item[]>(`${this.b}/items/mine`));
  addItem = (fd: FormData) => firstValueFrom(this.http.post<Item>(`${this.b}/items`, fd));
  deleteItem = (id: number) => firstValueFrom(this.http.delete<void>(`${this.b}/items/${id}`));

  outgoing = () => firstValueFrom(this.http.get<OutgoingRequest[]>(`${this.b}/requests/outgoing`));
  incoming = () => firstValueFrom(this.http.get<IncomingRequest[]>(`${this.b}/requests/incoming`));
  stats = () => firstValueFrom(this.http.get<Stats>(`${this.b}/requests/stats`));
  sendRequest = (itemId: number, from: string, to: string, note = '') =>
    firstValueFrom(this.http.post<OutgoingRequest>(`${this.b}/requests`, { itemId, from, to, note }));
  act = (id: number, action: 'accept' | 'decline' | 'return') =>
    firstValueFrom(this.http.post<IncomingRequest>(`${this.b}/requests/${id}/${action}`, {}));
  rate = (id: number, score: number, comment: string) =>
    firstValueFrom(this.http.post<{ rated: number; ratee: Owner }>(`${this.b}/requests/${id}/rate`, { score, comment }));
}
