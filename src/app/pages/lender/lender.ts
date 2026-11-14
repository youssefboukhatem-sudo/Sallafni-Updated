import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CATEGORIES, CONDITIONS } from '../../core/data';
import { STATUS_BADGE, errorMessage, fmtRange, loanInfo } from '../../core/format';
import { Category, IncomingRequest } from '../../core/models';
import { Store } from '../../core/store';
import { ItemCard } from '../../shared/item-card/item-card';
import { RateDialog } from '../../shared/rate-dialog/rate-dialog';

@Component({ selector: 'app-lender', imports: [FormsModule, ItemCard, RateDialog], templateUrl: './lender.html' })
export class Lender {
  protected readonly store = inject(Store);
  private readonly rateDialog = viewChild.required(RateDialog);
  private readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('photo');

  protected readonly categories = CATEGORIES;
  protected readonly conditions = CONDITIONS;
  protected readonly badge = STATUS_BADGE;
  protected readonly range = fmtRange;
  protected readonly loanInfo = loanInfo;

  protected form = { name: '', cat: 'Tools' as Category, cond: 'Good', price: 0 };
  protected readonly photoUrl = signal('');
  protected readonly photoError = signal(false);
  protected readonly error = signal('');
  protected readonly busy = signal(false);
  private photo: File | null = null;

  protected rate(r: IncomingRequest) {
    this.rateDialog().open({ kind: 'in', requestId: r.id, name: r.borrower.name });
  }

  protected async answer(r: IncomingRequest, accept: boolean) {
    this.error.set('');
    try { await this.store.answerIncoming(r.id, accept); } catch (e) { this.error.set(errorMessage(e)); }
  }

  protected async returned(r: IncomingRequest) {
    this.error.set('');
    try { await this.store.returnLoan(r.id); } catch (e) { this.error.set(errorMessage(e)); }
  }

  protected onPhoto(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    this.photoError.set(false);
    this.photo = null;
    if (!file) { this.photoUrl.set(''); return; }
    if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) {
      this.photoError.set(true);
      input.value = '';
      this.photoUrl.set('');
      return;
    }
    this.photo = file;
    this.photoUrl.set(URL.createObjectURL(file));
  }

  protected async addItem() {
    this.error.set('');
    this.busy.set(true);
    try {
      await this.store.addItem({ name: this.form.name, category: this.form.cat, price: Number(this.form.price) || 0, condition: this.form.cond, photo: this.photo });
      this.form = { name: '', cat: 'Tools', cond: 'Good', price: 0 };
      this.fileInput().nativeElement.value = '';
      this.photoUrl.set('');
      this.photo = null;
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
