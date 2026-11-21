import { Component, DestroyRef, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Api } from '../../core/api';
import { errorMessage, fmtMonth, fmtShort } from '../../core/format';
import { PublicProfile } from '../../core/models';
import { Store } from '../../core/store';
import { ItemCard } from '../../shared/item-card/item-card';

const BIO_MAX = 200;

/** Crop to a centered square and downscale so the upload is ~20 KB instead of several MB. */
async function toAvatarBlob(file: File, size = 256): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  canvas.getContext('2d')!.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, size, size);
  bmp.close();
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/jpeg', 0.85),
  );
}

/**
 * Social-style profile. Two routes use this page:
 *   /profile   -> my own profile (edit profile, log out, delete account)
 *   /u/:id     -> another member's public profile (read only)
 */
@Component({ selector: 'app-profile', imports: [FormsModule, RouterLink, ItemCard], templateUrl: './profile.html' })
export class ProfilePage {
  protected readonly store = inject(Store);
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly dlg = viewChild<ElementRef<HTMLDialogElement>>('dlg');

  protected readonly fmtShort = fmtShort;
  protected readonly bioMax = BIO_MAX;

  /** null = my own profile; a number = viewing that member. */
  private readonly viewId = signal<number | null>(null);
  protected readonly own = computed(() => this.viewId() === null);
  protected readonly pub = signal<PublicProfile | null>(null);   // rating, reviews (and everything for other members)
  protected readonly notFound = signal(false);

  // ----- what to display (mine comes from the store, others' from the public endpoint) -----
  protected readonly name = computed(() => (this.own() ? this.store.displayName() : (this.pub()?.name ?? '')));
  protected readonly initial = computed(() => (this.name()[0] ?? '?').toUpperCase());
  protected readonly bio = computed(() => (this.own() ? (this.store.user()?.bio ?? '') : (this.pub()?.bio ?? '')));
  protected readonly location = computed(() => {
    const o = this.own() ? this.store.user() : this.pub();
    return [o?.area, o?.city].filter(Boolean).join(', ');
  });
  protected readonly since = computed(() => {
    const s = this.own() ? this.store.user()?.createdAt : this.pub()?.memberSince;
    return s ? fmtMonth(s) : '';
  });
  protected readonly items = computed(() =>
    this.own() ? this.store.mine() : this.store.items().filter((i) => i.ownerId === this.viewId()),
  );

  // ----- edit mode -----
  protected readonly editing = signal(false);
  protected form = { fn: '', ln: '', bio: '' };
  /** undefined = picture unchanged, null = remove it, Blob = new picture (uploaded on Save). */
  private readonly draft = signal<Blob | null | undefined>(undefined);
  private readonly draftUrl = signal<string | null>(null);
  protected readonly errors = signal<{ fn?: boolean; ln?: boolean; bio?: boolean }>({});
  protected readonly serverError = signal('');
  protected readonly avatarError = signal('');
  protected readonly saving = signal(false);

  protected readonly avatarSrc = computed(() => {
    if (!this.own()) return this.pub()?.avatar ?? null;
    const d = this.draft();
    return d === undefined ? (this.store.user()?.avatar ?? null) : d === null ? null : this.draftUrl();
  });

  constructor() {
    inject(ActivatedRoute).paramMap.pipe(takeUntilDestroyed()).subscribe((p) => {
      const id = p.get('id');
      this.viewId.set(id ? Number(id) : null);
      this.editing.set(false);
      void this.load();
    });
    inject(DestroyRef).onDestroy(() => this.setDraft(undefined));
  }

  private async load() {
    this.notFound.set(false);
    this.pub.set(null);
    const me = this.store.user();
    const id = this.viewId() ?? me?.id;
    if (id == null) return;
    if (this.viewId() !== null && id === me?.id) {           // /u/<my id> is just my own profile
      void this.router.navigateByUrl('/profile', { replaceUrl: true });
      return;
    }
    try {
      this.pub.set(await this.api.publicProfile(id));
    } catch (e) {
      if ((e as { status?: number }).status === 404) this.notFound.set(true);
    }
  }

  private setDraft(d: Blob | null | undefined) {
    const old = this.draftUrl();
    if (old) URL.revokeObjectURL(old);
    this.draft.set(d);
    this.draftUrl.set(d instanceof Blob ? URL.createObjectURL(d) : null);
  }

  protected startEdit() {
    const u = this.store.user()!;
    this.form = { fn: u.fn, ln: u.ln, bio: u.bio };
    this.setDraft(undefined);
    this.errors.set({});
    this.serverError.set('');
    this.avatarError.set('');
    this.editing.set(true);
  }

  protected cancelEdit() {
    this.setDraft(undefined);
    this.editing.set(false);
  }

  protected async onAvatar(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.avatarError.set('Please choose an image file.');
      return;
    }
    try {
      this.setDraft(await toAvatarBlob(file));
      this.avatarError.set('');
    } catch {
      this.avatarError.set('Could not read that image. Try a JPEG or PNG.');
    }
  }

  protected removeAvatar() {
    this.setDraft(null);
    this.avatarError.set('');
  }

  protected async save() {
    this.serverError.set('');
    const data = { fn: this.form.fn.trim(), ln: this.form.ln.trim(), bio: this.form.bio.trim() };
    const errs = { fn: !data.fn, ln: !data.ln, bio: data.bio.length > BIO_MAX };
    this.errors.set(errs);
    if (errs.fn || errs.ln || errs.bio) return;

    this.saving.set(true);
    try {
      await this.store.saveProfile(data, this.draft());   // PATCH /auth/me/profile (+ PUT/DELETE /auth/me/avatar)
      this.setDraft(undefined);
      this.editing.set(false);
      void this.load();
    } catch (e) {
      this.serverError.set(errorMessage(e));
    } finally {
      this.saving.set(false);
    }
  }

  // ----- log out / delete account -----
  protected async logout() {
    this.store.logout();
    await this.router.navigateByUrl('/');
  }

  protected readonly deletePassword = signal('');
  protected readonly deleteError = signal('');
  protected readonly deleting = signal(false);

  protected openDelete() {
    this.deletePassword.set('');
    this.deleteError.set('');
    this.dlg()?.nativeElement.showModal();
  }

  protected closeDelete() {
    this.dlg()?.nativeElement.close();
  }

  protected async confirmDelete(e: Event) {
    e.preventDefault();
    if (!this.deletePassword()) {
      this.deleteError.set('Enter your password to confirm.');
      return;
    }
    this.deleting.set(true);
    try {
      await this.store.deleteAccount(this.deletePassword());   // DELETE /auth/me { password }
      this.closeDelete();
      await this.router.navigateByUrl('/');
    } catch (err) {
      this.deleteError.set(errorMessage(err));                 // e.g. wrong password / active loan
    } finally {
      this.deleting.set(false);
    }
  }
}
