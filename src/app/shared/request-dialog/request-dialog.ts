import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { errorMessage } from '../../core/format';
import { Item } from '../../core/models';
import { Store, priceLabel } from '../../core/store';

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

@Component({
  selector: 'app-request-dialog',
  imports: [RouterLink],
  templateUrl: './request-dialog.html',
})
export class RequestDialog {
  protected readonly store = inject(Store);
  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  protected readonly item = signal<Item | null>(null);
  protected readonly from = signal('');
  protected readonly to = signal('');
  protected readonly showError = signal(false);
  protected readonly serverError = signal('');
  protected readonly busy = signal(false);
  protected readonly today = ymd(new Date());
  protected readonly price = priceLabel;

  protected readonly owner = computed(() => this.item()?.owner);
  protected readonly score = computed(() => this.store.scoreText(this.owner()));
  protected readonly distance = computed(() => { const it = this.item(); return it ? this.store.distanceKm(it) : null; });
  protected readonly mapUrl = computed(() => {
    const c = this.store.coordsOf(this.owner());
    return c ? `https://www.openstreetmap.org/?mlat=${c[0]}&mlon=${c[1]}#map=13/${c[0]}/${c[1]}` : '';
  });

  protected readonly duration = computed(() => {
    const f = this.from(), t = this.to();
    if (!f || !t || t < f) return 'Choose your dates.';
    const days = Math.round((new Date(t).getTime() - new Date(f).getTime()) / 864e5) + 1;
    const p = this.item()?.p ?? 0;
    return `${days} ${days > 1 ? 'days' : 'day'}` + (p ? ` · total €${days * p}` : ' · free');
  });

  open(item: Item) {
    this.item.set(item);
    this.from.set('');
    this.to.set('');
    this.showError.set(false);
    this.serverError.set('');
    this.dlg().nativeElement.showModal();
  }

  protected close() {
    this.dlg().nativeElement.close();
  }

  protected rounded(d: number) {
    return d < 10 ? d.toFixed(1) : String(Math.round(d));
  }

  protected async submit(e: Event) {
    e.preventDefault();
    const f = this.from(), t = this.to(), it = this.item();
    if (!it || !f || !t || t < f || f < this.today) {
      this.showError.set(true);
      return;
    }
    this.showError.set(false);
    this.busy.set(true);
    this.serverError.set('');
    try {
      await this.store.sendRequest(it.id, f, t);
      this.close();
    } catch (err) {
      this.serverError.set(errorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }
}
