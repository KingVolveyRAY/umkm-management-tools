import { FaceLandmarker } from '@mediapipe/tasks-vision';
import wasmLoaderPath from '@mediapipe/tasks-vision/vision_wasm_internal.js?url';
import wasmBinaryPath from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url';

export async function createFaceTracker() {
  const model = await FaceLandmarker.createFromOptions({ wasmLoaderPath, wasmBinaryPath }, {
    baseOptions: { modelAssetPath: '/vision/face_landmarker.task', delegate: 'CPU' },
    runningMode: 'VIDEO',
    numFaces: 2,
    outputFaceBlendshapes: true,
    minFaceDetectionConfidence: .55,
    minFacePresenceConfidence: .55,
  });

  return {
    close: () => model.close(),
    sample(video, timestamp) {
      const result = model.detectForVideo(video, timestamp);
      if (result.faceLandmarks.length !== 1) {
        return { cue: result.faceLandmarks.length > 1 ? 'multiple' : 'missing' };
      }
      const points = result.faceLandmarks[0];
      const width = Math.abs(points[234].x - points[454].x);
      const height = Math.abs(points[152].y - points[10].y);
      const nose = points[1];
      if (width < .19 || height < .23 || nose.x < .22 || nose.x > .78 || nose.y < .22 || nose.y > .78) return { cue: 'position' };
      const scores = Object.fromEntries((result.faceBlendshapes[0]?.categories ?? []).map(category => [category.categoryName, category.score]));
      return { scores: {
        eyeLeft: scores.eyeBlinkLeft ?? 0, eyeRight: scores.eyeBlinkRight ?? 0,
        smileLeft: scores.mouthSmileLeft ?? 0, smileRight: scores.mouthSmileRight ?? 0,
      } };
    },
  };
}
