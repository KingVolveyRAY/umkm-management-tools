export function frameCrop(width, height, ratio) {
  const cropWidth = Math.min(width, height * ratio);
  const cropHeight = Math.min(height, width / ratio);
  return { x: (width - cropWidth) / 2, y: (height - cropHeight) / 2, width: cropWidth, height: cropHeight };
}

export function drawCameraFrame(canvas, video, ratio, maxSize) {
  const crop = frameCrop(video.videoWidth, video.videoHeight, ratio);
  const scale = Math.min(1, maxSize / Math.max(crop.width, crop.height));
  const width = Math.round(crop.width * scale);
  const height = Math.round(crop.height * scale);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const context = canvas.getContext('2d');
  context.drawImage(video, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height);
  return context;
}
