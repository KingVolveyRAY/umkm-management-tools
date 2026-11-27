export const livenessLabels = { blink: 'Kedipkan kedua mata', smile: 'Senyum dan tahan sebentar' };

export function createLiveness(actions, startedAt) {
  let completed = [];
  let neutralSince = null;
  let actionSince = null;
  let lastFace = null;

  function resetGesture() {
    neutralSince = null;
    actionSince = null;
  }

  return {
    sample(face, timestamp) {
      if (lastFace != null && timestamp - lastFace > 850) {
        completed = [];
        resetGesture();
      }
      if (!face.scores) {
        resetGesture();
        return { cue: face.cue, completed, present: false };
      }
      lastFace = timestamp;
      const action = actions[completed.length];
      if (!action) return { cue: 'complete', completed, present: true };

      const { eyeLeft, eyeRight, smileLeft, smileRight } = face.scores;
      const blink = action === 'blink';
      const neutral = blink ? Math.max(eyeLeft, eyeRight) < .33 : Math.max(smileLeft, smileRight) < .38;
      const active = blink ? Math.min(eyeLeft, eyeRight) > .5
        : Math.min(smileLeft, smileRight) > .38 && (smileLeft + smileRight) / 2 > .55;
      const alreadyNeutral = neutralSince != null && timestamp - neutralSince >= 120;
      if (!alreadyNeutral) {
        neutralSince = neutral ? neutralSince ?? timestamp : null;
        return { cue: 'neutral', completed, present: true };
      }

      if (active) actionSince ??= timestamp;
      const actionTime = timestamp - (actionSince ?? timestamp);
      const done = actionSince != null && (blink ? neutral && actionTime >= 60 && actionTime <= 900 : active && actionTime >= 330);
      if (done) {
        completed = [...completed, { action, elapsed: Math.round(timestamp - startedAt) }];
        resetGesture();
        return { cue: completed.length === actions.length ? 'complete' : 'neutral', completed, present: true };
      }
      if (blink && actionSince != null && actionTime > 900) resetGesture();
      else if (!blink && !active) actionSince = null;
      return { cue: 'action', completed, present: true };
    },
  };
}
