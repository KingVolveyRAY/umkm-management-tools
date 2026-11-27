import assert from 'node:assert/strict';
import test from 'node:test';
import { directAttendanceAction, resolveTodayAttendance } from '../src/attendance-state.js';

const clockIn = { id: 1, kind: 'in', timestamp: '2026-11-27T01:00:00.000Z' };
const clockOut = { id: 2, kind: 'out', timestamp: '2026-11-27T09:00:00.000Z' };

test('resolveTodayAttendance merges fresh post-submit records and resets across day changes', () => {
  const initial = resolveTodayAttendance(null, null, '2026-11-27');
  assert.equal(initial.ready, false);
  assert.equal(initial.arrival, null);

  const loadedEmpty = resolveTodayAttendance({ day: '2026-11-27', rows: [] }, null, '2026-11-27');
  assert.equal(loadedEmpty.ready, true);
  assert.equal(loadedEmpty.arrival, null);

  const afterClockIn = resolveTodayAttendance(
    { day: '2026-11-27', rows: [] },
    { day: '2026-11-27', rows: [clockIn] },
    '2026-11-27',
  );
  assert.equal(afterClockIn.arrival, clockIn);
  assert.equal(afterClockIn.departure, null);

  const nextDay = resolveTodayAttendance(
    { day: '2026-11-28', rows: [] },
    { day: '2026-11-27', rows: [clockOut, clockIn] },
    '2026-11-28',
  );
  assert.deepEqual(nextDay.records, []);
  assert.equal(nextDay.arrival, null);
  assert.equal(nextDay.departure, null);

  const midnightSubmit = resolveTodayAttendance(
    { day: '2026-11-27', rows: [] },
    { day: '2026-11-28', rows: [clockIn] },
    '2026-11-28',
  );
  assert.equal(midnightSubmit.arrival, clockIn);
});

test('directAttendanceAction transitions from Absen Masuk Langsung to Absen Pulang Langsung to Sudah absen pulang', () => {
  const loading = directAttendanceAction({ ready: false, arrival: null, departure: null, venueConfigured: true, error: '' });
  assert.equal(loading.label, 'Absen Masuk Langsung');
  assert.equal(loading.variant, 'in');
  assert.equal(loading.disabled, true);

  const readyToIn = directAttendanceAction({ ready: true, arrival: null, departure: null, venueConfigured: true, error: '' });
  assert.equal(readyToIn.label, 'Absen Masuk Langsung');
  assert.equal(readyToIn.kind, 'in');
  assert.equal(readyToIn.variant, 'in');
  assert.equal(readyToIn.disabled, false);

  const readyToOut = directAttendanceAction({ ready: true, arrival: clockIn, departure: null, venueConfigured: true, error: '' });
  assert.equal(readyToOut.label, 'Absen Pulang Langsung');
  assert.equal(readyToOut.kind, 'out');
  assert.equal(readyToOut.variant, 'out');
  assert.equal(readyToOut.disabled, false);

  const finished = directAttendanceAction({ ready: true, arrival: clockIn, departure: clockOut, venueConfigured: true, error: '' });
  assert.equal(finished.label, 'Sudah absen pulang');
  assert.equal(finished.variant, 'done');
  assert.equal(finished.done, true);
  assert.equal(finished.disabled, true);

  const unconfigured = directAttendanceAction({ ready: true, arrival: null, departure: null, venueConfigured: false, error: '' });
  assert.equal(unconfigured.disabled, true);
  assert.match(unconfigured.title, /lokasi outlet/);
});
