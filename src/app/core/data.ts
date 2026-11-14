import { Category, IconName } from './models';

/** Approximate city-centre coordinates, used for distance when no device location is shared. */
export const CITIES: Record<string, [number, number]> = {
  tunis: [36.8065, 10.1815], ariana: [36.8665, 10.1647], 'ben arous': [36.7531, 10.2189],
  'la marsa': [36.8782, 10.3247], sousse: [35.8256, 10.6084], monastir: [35.7643, 10.8113],
  mahdia: [35.5047, 11.0622], sfax: [34.7406, 10.7603], nabeul: [36.4513, 10.7357],
  hammamet: [36.4, 10.6167], bizerte: [37.2744, 9.8739], kairouan: [35.6781, 10.0963],
  gabes: [33.8815, 10.0982], djerba: [33.875, 10.8575], gafsa: [34.425, 8.7842],
  tozeur: [33.9197, 8.1335], beja: [36.7256, 9.1817], jendouba: [36.5011, 8.7803],
  kasserine: [35.1676, 8.8365], medenine: [33.3549, 10.5055], tataouine: [32.9297, 10.4518],
};

export const CATEGORIES: Category[] = ['Tools', 'Outdoor', 'Bikes', 'Electronics', 'Party gear'];
export const CATEGORY_ICON: Record<Category, IconName> = {
  Tools: 'tool', Outdoor: 'tent', Bikes: 'bike', Electronics: 'device', 'Party gear': 'bbq',
};
export const CONDITIONS = ['New', 'Like new', 'Good', 'Fair', 'Worn but works'];
export const HOME_CHIPS = ['Sound & Video', 'Gaming', 'Pets', 'Tools', 'Outdoor', 'Bikes', 'Party gear'];

export const STEPS = {
  lend: [
    ['1. Add items', 'Add a photo and the condition of what you want to share'],
    ['2. Accept', 'Check requests with their dates; accept if it suits you'],
    ['3. Free or fee', 'Decide if your listing is free or for a small fee'],
    ['Peace of mind', 'You stay in control of who borrows and when it comes back'],
  ],
  borrow: [
    ['1. Search', 'Find what you need from neighbors close by'],
    ['2. Request', 'Choose your pick-up and return dates and send a request'],
    ['3. Pick up', 'Meet your neighbor and collect the item'],
    ['4. Return', 'Give it back on the agreed date and leave a review'],
  ],
};
