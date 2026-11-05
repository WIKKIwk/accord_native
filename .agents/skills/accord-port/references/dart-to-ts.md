# Dart to TypeScript traps

Rows marked "ran" were executed side by side on 2026-11-05: Dart 3.13.2 and Node 22, with
`TZ=Asia/Tashkent`. Each one produces wrong data without any error.

## Numbers

| Dart | Result | Naive JS | Result | Port it as |
|---|---|---|---|---|
| `(-2.5).round()` | -3 | `Math.round(-2.5)` | -2 | `Math.sign(x) * Math.round(Math.abs(x))` (ran) |
| `(-7) % 3` | 2 | `-7 % 3` | -1 | `((a % n) + n) % n`, for positive `n` (ran) |
| `1.0.toString()` | `1.0` | `String(1.0)` | `1` | Decide from the V2 type; add `.0` where V2 shows or sends a double (ran) |
| `jsonEncode({'a': 1.0})` | `{"a":1.0}` | `JSON.stringify` | `{"a":1}` | Fine for JSON numbers, but not when the string itself is hashed, compared or used as a key (ran) |
| `jsonDecode('1.0') is double` | true | `typeof` | `number` | `is int` and `is double` checks do not port; read what the branch is for (ran) |
| `jsonDecode('9007199254740993')` | exact | `JSON.parse` | `...992` | Check whether any id or rev can pass 2^53; if so, open an item (ran) |
| `int.tryParse('12abc')` | null | `parseInt` | 12 | `/^\s*[+-]?\d+\s*$/` first, then `Number` (ran) |
| `double.tryParse('')` | null | `Number('')` | 0 | Reject blank and invalid input first (ran) |
| `double.tryParse('1.5x')` | null | `parseFloat` | 1.5 | Validate the whole string (ran) |

Safe as they are: `~/` with `Math.trunc(a / b)`, `.toInt()` with `Math.trunc`, and `toStringAsFixed` with
`toFixed`. All gave the same results for the values tried (ran).

## Dates

| Dart | Result | Naive JS | Result |
|---|---|---|---|
| `DateTime.parse('2026-01-15')` | Local midnight | `new Date('2026-01-15')` | **UTC** midnight, which is 05:00 in Tashkent (ran) |
| `DateTime.parse('2026-01-15T10:00:00')` | Local | `new Date(...)` | Local, the same (ran) |
| `toIso8601String()` on a local date | No `Z`, no offset | `toISOString()` | Always UTC with `Z` (ran) |
| `toIso8601String()` with microseconds | 6 fraction digits | `toISOString()` | 3 digits (ran) |

For date-only strings, build `new Date(y, m - 1, d)` from the parts. Port the exact `toLocal`,
`toUtc` and format calls. When a date string goes to the server, compare it with the V2 test's expected
value.

## Order

| Dart | Result | JS | Result |
|---|---|---|---|
| `jsonDecode` map with keys `"10","2","b"` | `10, 2, b` | `JSON.parse`, `Object.keys` | **`2, 10, b`** (ran) |
| `List.sort` with ties, 64 items | Not stable | `Array.sort` | Stable (ran) |
| `['b','A','a','B']..sort()` | `A, B, a, b` | `.sort()` | Same (ran) |
| `a.compareTo(b)` | Code-unit order | `localeCompare` | **Different:** `a, A, b, B` (ran) |

- JS reorders integer-like object keys, and `JSON.parse` loses the original order. If V2 iterates a JSON
  map keyed by numeric ids and the order is visible, stop relying on key order. Use an explicit order
  array from the payload when one exists (for example `sequences`), otherwise open an item.
- For Dart `compareTo` on strings, use `a < b ? -1 : a > b ? 1 : 0`, never `localeCompare`.
- If a V2 comparator can tie on lists over 32 items, its tie order is an accident of Dart's algorithm.
  Do not try to reproduce it. Note it in `PORT.md` when the order is visible.

## Errors that disappear

| Dart | Behaviour | JS |
|---|---|---|
| `'abc'.substring(5)` | Throws `RangeError` | Returns `''` (ran) |
| `[].first`, `.last`, `.single`, `firstWhere` without `orElse` | Throws `StateError` | `[].at(0)` is `undefined` (ran) |
| `x as String` | Throws at run time | `as string` does nothing at run time (ran) |
| `map['k']!` on null | Throws | `!` does nothing at run time |
| Unknown enum in a `fromJson` | Often throws, as `userRoleFromJson` does | No error unless written |

A V2 throw is usually what sends a screen to its error state. When V2 would throw, throw in V4 too, or
the bad value silently renders as data.

## Null, JSON and URLs

- Keep `null` and an absent key apart where V2 does. `jsonEncode({'a': null})` keeps the key, and
  `JSON.stringify({a: undefined})` drops it.
- `json['x']?.toString() ?? ''` also turns numbers into strings. A TS helper that only accepts strings
  (`typeof value === 'string'`) returns `''` for a number, so match the V2 expression exactly.
- `.trim()` matched in the case tried, which included NBSP (ran).
- `Uri(queryParameters: {...})` and `URLSearchParams` both encode a space as `+`. `Uri.encodeComponent`
  and `encodeURIComponent` both use `%20` (ran). Port whichever V2 used.
- `queryParameters` with a list value repeats the key, as `k=1&k=2` (ran). Use `append`.
- `package:http` sets a `text/plain` content type on a string body unless a header says otherwise. RN
  `fetch` has its own defaults, so assert headers in tests.

## Concurrency

- No isolates exist, and `compute` has no direct equivalent. See "Large JSON" in `mechanisms.md`.
- `Completer` becomes a stored resolver or a shared promise. Keep the single-flight semantics of
  `_reauthenticationInFlight`.
- `Stream.timeout` needs a timer that restarts on every event.
- After every `await`, re-check what V2 re-checks (`mounted`, session revision). Otherwise a stale result
  lands on the wrong account or screen.
- `Zone` and `Expando` are per-zone and per-object test hooks. Do not port them. Use the module overrides
  in the test harness.
