import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CATEGORIES, HOME_CHIPS, STEPS } from '../../core/data';
import { Store } from '../../core/store';
import { ItemCard } from '../../shared/item-card/item-card';

@Component({
  selector: 'app-home',
  imports: [RouterLink, ItemCard],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  private readonly store = inject(Store);
  private readonly router = inject(Router);

  protected readonly featured = computed(() => this.store.items().slice(0, 4));
  protected readonly chips = HOME_CHIPS;
  protected readonly tab = signal<'lend' | 'borrow'>('lend');
  protected readonly steps = computed(() => STEPS[this.tab()]);

  protected pickChip(chip: string) {
    this.store.category.set((CATEGORIES as string[]).includes(chip) ? chip : '');
    this.router.navigateByUrl('/borrower');
  }
}
