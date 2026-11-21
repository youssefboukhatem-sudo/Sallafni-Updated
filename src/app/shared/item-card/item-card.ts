import { Component, computed, inject, input, signal } from '@angular/core';
import { Item } from '../../core/models';
import { ITEM_IMAGES } from '../../core/resources';
import { Store, priceLabel } from '../../core/store';

@Component({
  selector: 'app-item-card',
  template: `
    <article class="item">
      <div class="thumb" [style.background]="item().col">
        @if (imageSrc() && !imgFailed()) {
          <img [src]="imageSrc()" [alt]="item().n" loading="lazy" (error)="imgFailed.set(true)" />
        } @else {
          <svg aria-hidden="true"><use [attr.href]="'#i-' + item().i" /></svg>
        }
        <span class="tag" [class.free]="!item().p">{{ price(item().p) }}</span>
      </div>
      <div class="body">
        <h3>{{ item().n }}</h3>
        <p class="muted small">{{ item().d }}</p>
        <p class="cond">Condition: <strong>{{ item().cond }}</strong></p>
        <div class="owner">
          <span class="av" aria-hidden="true">{{ item().owner.name[0] }}</span>{{ item().owner.name }}
          @if (store.scoreText(item().owner); as s) { <span class="score">★ {{ s }}</span> }
        </div>
        <ng-content />
      </div>
    </article>
  `,
  styles: `
  :host { display: contents; }
  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
  }
`,
})
export class ItemCard {
  readonly item = input.required<Item>();
  protected readonly store = inject(Store);
  protected readonly imgFailed = signal(false);
  protected readonly price = priceLabel;

  /** The item's own image if it has one, otherwise the file from resources.ts. */
 protected readonly imageSrc = computed(() => {
  const item = this.item();
  if (item.img) return item.img;
  const name = item.n.toLowerCase();
  const key = Object.keys(ITEM_IMAGES).find((k) => name.includes(k));
  return key ? ITEM_IMAGES[key] : '';
});
}