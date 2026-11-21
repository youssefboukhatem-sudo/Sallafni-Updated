export type Category = 'Tools' | 'Outdoor' | 'Bikes' | 'Electronics' | 'Party gear';
export type IconName = 'tool' | 'tent' | 'bike' | 'device' | 'bbq';

/** Public view of a neighbor (no email / phone / street). */
export interface Owner {
  id: number;
  name: string;
  city: string;
  area: string;
  lat: number | null;
  lng: number | null;
  score: number | null;
  n: number;
  avatar: string | null;
}

export interface Item {
  id: number;
  n: string;
  d: string;
  c: Category;
  p: number;
  cond: string;
  img: string | null;
  i: IconName;
  col: string;
  ownerId: number;
  owner: Owner;
}

/** Private details collected once, right after sign-up (the "Almost there!" step). */
export interface PersonalInfo {
  fn: string; ln: string; country: string; phone: string;
  street: string; line2: string; city: string; area: string; state: string; zip: string;
  lat?: number | null; lng?: number | null;
}

export interface Me extends PersonalInfo {
  id: number;
  email: string;
  complete: boolean;       // false until the "Almost there" step has been saved
  bio: string;
  avatar: string | null;   // "/uploads/<file>" or null
  createdAt: string;
}

export interface Review { score: number; comment: string; createdAt: string; reviewer: string; }

/** What other members see about a user (GET /api/users/:id). */
export interface PublicProfile extends Owner {
  bio: string;
  memberSince: string;
  reviews: Review[];
}

export type ApiStatus = 'pending' | 'accepted' | 'declined' | 'returned';

interface RequestBase {
  id: number;
  status: ApiStatus;
  from: string;
  to: string;
  note: string;
  total: number;
  returnedAt: string | null;
  item: { id: number; name: string };
  rated: number | null;
}
export interface OutgoingRequest extends RequestBase {
  lender: Owner;
  /** Only present once the lender accepted. */
  address: { street: string; area: string; city: string } | null;
}
export interface IncomingRequest extends RequestBase {
  borrower: Owner;
}

export interface Stats { listed: number; lentOut: number; earned: number; }

export interface RateTarget { kind: 'out' | 'in'; requestId: number; name: string; }
