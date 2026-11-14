import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { errorMessage } from '../../core/format';
import { RateTarget } from '../../core/models';
import { Store } from '../../core/store';

@Component({
  selector: 'app-rate-dialog',
  templateUrl: './rate-dialog.html',
})
export class RateDialog {
  private readonly store = inject(Store);
  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  protected readonly scores = Array.from({ length: 10 }, (_, i) => i + 1);
  protected readonly target = signal<RateTarget | null>(null);
  protected readonly selected = signal(0);
  protected readonly comment = signal('');
  protected readonly showError = signal(false);
  protected readonly serverError = signal('');
  protected readonly busy = signal(false);

  open(target: RateTarget) {
    this.target.set(target);
    this.selected.set(0);
    this.comment.set('');
    this.showError.set(false);
    this.serverError.set('');
    this.dlg().nativeElement.showModal();
  }

  protected close() {
    this.dlg().nativeElement.close();
  }

  protected async submit(e: Event) {
    e.preventDefault();
    const t = this.target();
    if (!this.selected() || !t) {
      this.showError.set(true);
      return;
    }
    this.busy.set(true);
    this.serverError.set('');
    try {
      await this.store.rate(t, this.selected(), this.comment());
      this.close();
    } catch (err) {
      this.serverError.set(errorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }
}
