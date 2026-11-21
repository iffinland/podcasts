export const coverDimensions = (width: number, height: number, max = 1024) => {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  )
    throw new Error('Invalid cover dimensions.');
  const scale = Math.min(1, max / width, max / height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
};
const encode = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error('Could not prepare the cover image.')),
      type,
      quality
    )
  );
export async function prepareCover(file: File): Promise<File> {
  if (file.size > 10 * 1024 * 1024)
    throw new Error('Cover image is larger than 10 MB.');
  let source: CanvasImageSource;
  let width: number, height: number;
  let release = () => {};
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file, {
      imageOrientation: 'from-image',
    });
    source = bitmap;
    width = bitmap.width;
    height = bitmap.height;
    release = () => bitmap.close();
  } else {
    const url = URL.createObjectURL(file);
    const image = new Image();
    try {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () =>
          reject(
            new Error(
              'Cannot read this cover image. Choose a PNG, JPEG or WebP image.'
            )
          );
        image.src = url;
      });
    } catch (error) {
      URL.revokeObjectURL(url);
      throw error;
    }
    source = image;
    width = image.naturalWidth;
    height = image.naturalHeight;
    release = () => URL.revokeObjectURL(url);
  }
  try {
    const size = coverDimensions(width, height);
    if (
      width === size.width &&
      height === size.height &&
      file.size <= 512 * 1024 &&
      ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
    )
      return file;
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d');
    if (!context)
      throw new Error('Cover processing is unavailable in this browser.');
    context.drawImage(source, 0, 0, size.width, size.height);
    let blob = await encode(canvas, 'image/webp', 0.82);
    if (blob.type !== 'image/webp') {
      context.globalCompositeOperation = 'destination-over';
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      blob = await encode(canvas, 'image/jpeg', 0.82);
    }
    if (blob.size > 512 * 1024) blob = await encode(canvas, blob.type, 0.6);
    if (blob.size > 512 * 1024) {
      const reduced = coverDimensions(canvas.width, canvas.height, 768);
      canvas.width = reduced.width;
      canvas.height = reduced.height;
      const smaller = canvas.getContext('2d');
      if (!smaller) throw new Error('Cannot resize this cover.');
      smaller.drawImage(source, 0, 0, reduced.width, reduced.height);
      if (blob.type === 'image/jpeg') {
        smaller.globalCompositeOperation = 'destination-over';
        smaller.fillStyle = '#ffffff';
        smaller.fillRect(0, 0, canvas.width, canvas.height);
      }
      blob = await encode(canvas, blob.type, 0.6);
    }
    if (!['image/webp', 'image/jpeg'].includes(blob.type))
      throw new Error('This browser cannot encode a supported cover format.');
    if (blob.size > 512 * 1024)
      throw new Error(
        'This cover is too complex to reduce below 512 KB. Choose a smaller image.'
      );
    return new File(
      [blob],
      `${file.name.replace(/\.[^.]+$/, '')}-cover.${blob.type === 'image/webp' ? 'webp' : 'jpg'}`,
      { type: blob.type, lastModified: file.lastModified }
    );
  } finally {
    release();
  }
}
