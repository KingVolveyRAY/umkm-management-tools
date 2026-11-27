export function resolveTodayAttendance(data, updated, currentDay) {
  const currentUpdated = updated && (data ? updated.day >= data.day : updated.day === currentDay) ? updated : null;
  const records = currentUpdated && (currentUpdated.day > (data?.day ?? '') || currentUpdated.rows.length > (data?.rows.length || 0))
    ? currentUpdated.rows
    : data?.rows ?? [];
  return {
    ready: Boolean(data || currentUpdated),
    records,
    arrival: records.find(row => row.kind === 'in') ?? null,
    departure: records.find(row => row.kind === 'out') ?? null,
  };
}

export function directAttendanceAction({ ready, arrival, departure, venueConfigured, error }) {
  const done = Boolean(arrival && departure);
  const kind = arrival ? 'out' : 'in';
  const label = done ? 'Sudah absen pulang' : kind === 'out' ? 'Absen Pulang Langsung' : 'Absen Masuk Langsung';
  const variant = done ? 'done' : kind;
  const disabled = done || !ready || !venueConfigured;
  const title = !venueConfigured
    ? 'Minta pemilik mengatur lokasi outlet sebelum absen.'
    : !ready && error
      ? error
      : undefined;
  return { kind, label, variant, done, disabled, title };
}
