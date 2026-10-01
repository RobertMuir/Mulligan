# TypeScript patterns

## Unions for states

```ts
// Avoid: contradictory combinations compile ({ isSyncing: true, error: "…", syncedAt: date }).
type SyncState = { isSyncing: boolean; syncedAt?: Date; error?: string };

// Prefer: only real states exist.
type SyncState =
  | { status: 'idle' }
  | { status: 'syncing'; startedAt: Date }
  | { status: 'synced'; syncedAt: Date }
  | { status: 'failed'; error: string; retryAt: Date };
```

Use one discriminant name across the codebase.

## Build the shape, don't police it

```ts
// Avoid: every caller must remember the check.
function pickReviewer(reviewers: Reviewer[]): Reviewer {
  if (reviewers.length === 0) throw new Error('no reviewers');
  return reviewers[0]!;
}

// Prefer: an empty list cannot be passed.
type NonEmpty<T> = readonly [T, ...T[]];
function pickReviewer(reviewers: NonEmpty<Reviewer>): Reviewer {
  return reviewers[0];
}

// Narrow once where a plain array arrives; the fact then travels with the type.
const hasItems = <T>(xs: readonly T[]): xs is NonEmpty<T> => xs.length > 0;
```

```ts
// Avoid: the ordering rule lives in a comment.
type Booking = { from: Date; to: Date }; // from must be before to

// Prefer: a negative booking cannot be written.
type Booking = { from: Date; minutes: number };
```

## Distinct ids

```ts
type OrderId = string & { readonly __brand: 'OrderId' };
type CustomerId = string & { readonly __brand: 'CustomerId' };

function parseOrderId(raw: string): OrderId {
  if (!/^ord_[a-z0-9]{12}$/.test(raw)) throw new Error(`not an order id: ${raw}`);
  return raw as OrderId; // the only cast, after the check
}

declare function assign(order: OrderId, customer: CustomerId): void;
// assign(customerId, orderId) no longer compiles.
```

Brand only what can genuinely be confused. Do not brand by reflex.

## `unknown` at the edges, one schema

```ts
import { z } from 'zod';

const Appointment = z.object({
  id: z.string(),
  startsAt: z.coerce.date(),
  status: z.enum(['booked', 'cancelled']),
});
type Appointment = z.infer<typeof Appointment>;

export async function fetchAppointment(id: string): Promise<Appointment> {
  const res = await fetch(`/api/appointments/${id}`);
  const body: unknown = await res.json();
  return Appointment.parse(body); // validated once, trusted afterwards
}
```

Reach for `safeParse` when invalid input is a normal outcome rather than a bug. Stick to whichever schema library the project already depends on; adding a new one for a single guard is not worth it.

## No casts to win arguments

When you meet an `as`, find out what the compiler cannot see:

- a missing discriminant → add one and switch on it;
- a type that is too wide (`Record<string, unknown>`) → narrow it;
- untyped input → parse it at the edge;
- a fact the type system cannot express → a brand, or `satisfies`.

## Narrowing

```ts
type Payment =
  | { method: 'card'; last4: string }
  | { method: 'bank'; sortCode: string }
  | { method: 'voucher'; code: string };

function receiptLine(p: Payment): string {
  if (p.method === 'card') return `Card ending ${p.last4}`; // narrowed by the discriminant
  if ('sortCode' in p) return `Bank transfer (${p.sortCode})`; // narrowed by `in`
  const voucher: { method: 'voucher'; code: string } = p; // only one variant is left
  return `Voucher ${voucher.code}`;
}

function feePence(p: Payment): number {
  switch (p.method) {
    case 'card':
      return 20;
    case 'bank':
      return 0;
    case 'voucher':
      return 0;
    default: {
      const missed: never = p; // a new payment method breaks the build here
      throw new Error(`unhandled payment ${JSON.stringify(missed)}`);
    }
  }
}
```

## Honest type guards

```ts
// Avoid: claims more than it checks.
const isInvoice = (x: unknown): x is Invoice => typeof x === 'object' && x !== null;

// Prefer: checks what the name promises — or use the schema.
const isInvoice = (x: unknown): x is Invoice => Invoice.safeParse(x).success;
```

## `satisfies` for config

```ts
const retry = { attempts: 3, backoff: 'exponential' } satisfies RetryPolicy;
// retry.backoff stays the literal 'exponential'; `as RetryPolicy` would widen it and skip the check.
```

## Derive, don't duplicate

```ts
// Avoid: a hand copy that drifts from the API type.
type BadgeProps = { name: string; avatarUrl: string };

// Prefer: derived from the source of truth.
type BadgeProps = Pick<User, 'name' | 'avatarUrl'>;
type Loaded = Awaited<ReturnType<typeof loadDashboard>>;
```

## Simplest total type

```ts
const total = (amounts: number[]) => amounts.reduce((a, b) => a + b, 0); // fine for []

// "The latest event" has no answer for an empty list. Either make the result honest…
function latest(events: readonly AuditEvent[]): AuditEvent | undefined {
  return events.at(-1);
}

// …or make the input honest, where callers always have at least one event.
function latestOf(events: NonEmpty<AuditEvent>): AuditEvent {
  return events.at(-1) ?? events[0];
}
```

## Options objects

```ts
// Avoid: two strings, easy to swap.
scheduleReminder(orderId, customerId, '09:00');

// Prefer:
scheduleReminder({ orderId, customerId, at: '09:00' });
```
