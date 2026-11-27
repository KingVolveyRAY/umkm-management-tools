import { useEffect, useRef, useState } from 'react';
import { api } from './common.jsx';
import { createLiveness } from './liveness.js';

const empty = { actions: [], count: 0, cue: 'idle', error: '' };

export function useFaceVerification(video, kind, aspectRatio) {
  const current = useRef({ attempt: 0, frame: 0, tracker: null, proof: null });
  const ratio = useRef(aspectRatio);
  const [state, setState] = useState(empty);
  useEffect(() => { ratio.current = aspectRatio; }, [aspectRatio]);

  useEffect(() => {
    const work = current.current;
    return () => {
      work.attempt += 1;
      cancelAnimationFrame(work.frame);
      work.tracker?.close();
      work.tracker = null;
    };
  }, []);

  function pause() {
    cancelAnimationFrame(current.current.frame);
  }

  async function start() {
    const work = current.current;
    const attempt = ++work.attempt;
    pause();
    work.proof = null;
    setState({ ...empty, cue: 'loading' });
    const fail = message => {
      work.proof = null;
      setState({ ...empty, cue: 'error', error: message });
    };
    try {
      if (!work.tracker) {
        const { createFaceTracker } = await import('./face-tracker.js');
        const tracker = await createFaceTracker();
        if (work.attempt !== attempt) { tracker.close(); return; }
        work.tracker = tracker;
      }
    } catch {
      if (work.attempt === attempt) fail('Pemeriksa wajah belum bisa dimuat. Coba ulangi verifikasi.');
      return;
    }
    try {
      const challenge = await api('/attendance/challenge', { method: 'POST', body: { kind } });
      if (work.attempt !== attempt) return;
      const expiresAt = Date.parse(challenge.expiresAt);
      const tracker = createLiveness(challenge.steps, performance.now());
      setState({ ...empty, actions: challenge.steps, cue: 'missing' });
      let lastVideoTime = -1;
      let lastFrameTime = -Infinity;
      let lastStatus = '';
      const scan = time => {
        if (work.attempt !== attempt) return;
        if (Date.now() >= expiresAt) { fail('Waktu verifikasi habis. Ulangi untuk melanjutkan.'); return; }
        const live = video.current;
        if (live?.readyState >= 2 && live.currentTime !== lastVideoTime && time - lastFrameTime >= 65) {
          lastVideoTime = live.currentTime;
          lastFrameTime = time;
          try {
            const result = tracker.sample(work.tracker.sample(live, time, ratio.current), time);
            work.proof = result.cue === 'complete' ? { id: challenge.id, steps: result.completed, expiresAt } : null;
            const key = result.cue + ':' + result.completed.length;
            if (key !== lastStatus) {
              lastStatus = key;
              setState({ actions: challenge.steps, count: result.completed.length, cue: result.cue, error: '' });
            }
          } catch {
            fail('Kamera terputus saat memeriksa wajah. Coba ulangi verifikasi.');
            return;
          }
        }
        work.frame = requestAnimationFrame(scan);
      };
      work.frame = requestAnimationFrame(scan);
    } catch (error) {
      if (work.attempt === attempt) fail(error.message);
    }
  }

  return { state, start, pause, proof: () => current.current.proof };
}
