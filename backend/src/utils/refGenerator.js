// Generates the next sequential reference number for a given prefix + year,
// e.g. nextRef(client, 'GRN') -> 'GRN-2026-0004'. Backend-SRS §6.8 requires
// this to happen server-side (never trust a client-supplied reference) with
// row locking so concurrent requests can never collide on the same number.
//
// MUST be called with a transaction client (from withTransaction), because
// the INSERT ON CONFLICT below takes a row lock that must be released by
// the same COMMIT/ROLLBACK that persists the record using this reference.
//
// ref_sequences.next_val always holds "the number that will be assigned
// the next time this prefix+year is used." Each call atomically reads that
// value and increments the stored value by 1 in a single statement, so two
// concurrent requests can never read the same number.
async function nextRef(client, prefix) {
  const year = new Date().getFullYear();

  const { rows } = await client.query(
    `INSERT INTO ref_sequences (prefix, year, next_val)
     VALUES ($1, $2, 2)
     ON CONFLICT (prefix, year)
     DO UPDATE SET next_val = ref_sequences.next_val + 1
     RETURNING next_val`,
    [prefix, year]
  );

  // rows[0].next_val is always the value AFTER this call's increment, so
  // the number this call should assign is one less than that.
  const assigned = rows[0].next_val - 1;
  const serial = String(assigned).padStart(4, '0');
  return `${prefix}-${year}-${serial}`;
}

module.exports = { nextRef };
