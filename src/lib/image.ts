import { MAX_IMAGE_BYTES, MAX_IMAGE_SIDE } from './classification'

export async function prepareImage(file: File): Promise<Blob> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error(
      'We inspect JPEG, PNG, and WebP. Please convert other formats first.',
    )
  }
  if (file.size > 20 * 1024 * 1024)
    throw new Error('That’s a lot of evidence. Choose an image under 20 MB.')
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const scale = Math.min(
      1,
      MAX_IMAGE_SIDE / Math.max(image.naturalWidth, image.naturalHeight),
    )
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Your browser could not prepare the image.')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) =>
          result
            ? resolve(result)
            : reject(new Error('Could not prepare that image.')),
        'image/jpeg',
        0.86,
      )
    })
    if (blob.size > MAX_IMAGE_BYTES)
      throw new Error('Please try a smaller image.')
    return blob
  } catch (error) {
    if (error instanceof DOMException)
      throw new Error(
        'We couldn’t read that image. Try a different JPEG, PNG, or WebP.',
      )
    throw error
  } finally {
    URL.revokeObjectURL(url)
  }
}
