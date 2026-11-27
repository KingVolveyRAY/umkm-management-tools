import assert from 'node:assert/strict';
import test from 'node:test';
import { createLiveness } from '../src/liveness.js';
import { frameCrop } from '../src/camera-frame.js';

test('mobile and desktop frames are cropped from landscape and portrait cameras without stretching', () => {
  assert.deepEqual(frameCrop(640, 480, 3 / 4), { x: 140, y: 0, width: 360, height: 480 });
  assert.deepEqual(frameCrop(480, 640, 3 / 4), { x: 0, y: 0, width: 480, height: 640 });
  assert.deepEqual(frameCrop(960, 720, 16 / 9), { x: 0, y: 90, width: 960, height: 540 });
});

const neutral = { scores: { eyeLeft: 0, eyeRight: 0, smileLeft: 0, smileRight: 0 } };
const frame = (eyeLeft, eyeRight, smileLeft = 0, smileRight = 0) => ({ scores: { eyeLeft, eyeRight, smileLeft, smileRight } });

test('liveness detects a full blink and a sustained smile, and resets after losing the face', () => {
  const check = createLiveness(['blink', 'smile'], 0);
  assert.equal(check.sample({ cue: 'missing' }, 40).present, false);
  check.sample(neutral, 100);
  check.sample(neutral, 240);
  check.sample(frame(.8, 0), 310);
  assert.equal(check.sample(neutral, 390).completed.length, 0);
  check.sample(frame(.84, .92), 460);
  assert.equal(check.sample(neutral, 570).completed[0].action, 'blink');
  check.sample(neutral, 640);
  check.sample(neutral, 790);
  check.sample(frame(0, 0, .74, .77), 850);
  assert.equal(check.sample(neutral, 930).completed.length, 1);
  check.sample(frame(0, 0, .74, .77), 1000);
  assert.equal(check.sample(frame(0, 0, .74, .77), 1340).cue, 'complete');
  assert.equal(check.sample({ cue: 'multiple' }, 1410).present, false);
  assert.equal(check.sample(neutral, 2300).completed.length, 0);
});
