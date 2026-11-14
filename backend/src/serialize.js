// Shape DB rows into the JSON the Angular app consumes.

const ICON = { Tools: 'tool', Outdoor: 'tent', Bikes: 'bike', Electronics: 'device', 'Party gear': 'bbq' };
const COLOR = { Tools: '#e8f3ff', Outdoor: '#e9f7ec', Bikes: '#fff4e0', Electronics: '#f1ecff', 'Party gear': '#ffeceb' };

const score = (u) => (u.rating_count ? Math.round((u.rating_sum / u.rating_count) * 10) / 10 : null);

/** Public view of a user: never exposes email, phone or street. */
const publicUser = (u) => ({
  id: u.id,
  name: u.first_name || u.email.split('@')[0],
  city: u.city,
  area: u.area,
  lat: u.lat,
  lng: u.lng,
  score: score(u),
  n: u.rating_count,
});

/** The user's own full profile. */
const me = (u) => ({
  id: u.id,
  email: u.email,
  fn: u.first_name, ln: u.last_name, country: u.country, phone: u.phone,
  street: u.street, line2: u.line2, city: u.city, area: u.area, state: u.state, zip: u.zip,
  lat: u.lat, lng: u.lng,
  complete: Boolean(u.first_name && u.last_name && u.phone && u.street && u.city),
});

const item = (r) => ({
  id: r.id,
  n: r.name,
  d: r.description || r.category,
  c: r.category,
  p: r.price,
  cond: r.condition,
  img: r.image,
  i: ICON[r.category],
  col: COLOR[r.category],
  ownerId: r.owner_id,
  owner: publicUser({
    id: r.owner_id, email: r.o_email, first_name: r.o_first_name, city: r.o_city, area: r.o_area,
    lat: r.o_lat, lng: r.o_lng, rating_sum: r.o_sum, rating_count: r.o_count,
  }),
});

module.exports = { ICON, COLOR, score, publicUser, me, item };
