import { Buffer } from 'node:buffer'
import {
  buildInput,
  MAX_IMAGE_BYTES,
  MODEL,
  parseVerdict,
  validateJpeg,
} from './classification'

type Dependencies = {
  run: (input: ReturnType<typeof buildInput>) => Promise<unknown>
  limit: (key: string) => Promise<{ success: boolean }>
}

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      ...(status === 429 ? { 'Retry-After': '60' } : {}),
    },
  })
}

async function readImage(request: Request) {
  const length = request.headers.get('content-length')
  if (length && Number(length) > MAX_IMAGE_BYTES)
    throw new RangeError('Image is too large.')
  const reader = request.body?.getReader()
  if (!reader) throw new Error('No image received.')
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_IMAGE_BYTES) {
        await reader.cancel()
        throw new RangeError('Image is too large.')
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  return Buffer.concat(chunks, size)
}

export async function handleClassify(
  request: Request,
  deps: Dependencies,
): Promise<Response> {
  if (request.method !== 'POST')
    return json({ error: 'Use POST to submit evidence.' }, 405)
  const origin = request.headers.get('origin')
  if (
    (origin && origin !== new URL(request.url).origin) ||
    request.headers.get('sec-fetch-site') === 'cross-site'
  ) {
    return json({ error: 'Please submit your image from this site.' }, 403)
  }
  if (
    request.headers.get('content-type')?.split(';')[0].trim() !== 'image/jpeg'
  ) {
    return json({ error: 'Please upload a JPEG image.' }, 415)
  }

  try {
    const { success } = await deps.limit(
      request.headers.get('cf-connecting-ip') ?? 'local',
    )
    if (!success)
      return json(
        {
          error:
            'Easy on the mustard. Please wait a minute before trying again.',
        },
        429,
      )
    let image: Buffer
    try {
      image = await readImage(request)
      validateJpeg(image)
    } catch (error) {
      return json(
        { error: error instanceof Error ? error.message : 'Invalid image.' },
        error instanceof RangeError ? 413 : 400,
      )
    }

    const started = Date.now()
    const output = await deps.run(
      buildInput('data:image/jpeg;base64,' + image.toString('base64')),
    )
    const verdict = parseVerdict(output, Date.now() - started)
    console.info(
      JSON.stringify({
        event: 'classification_complete',
        model: MODEL,
        elapsedMs: verdict.elapsedMs,
      }),
    )
    return json(verdict)
  } catch {
    // Never log photo bytes, provider payloads, or IP addresses.
    console.error(
      JSON.stringify({ event: 'classification_failed', model: MODEL }),
    )
    return json(
      {
        error:
          'The hotdog department is temporarily out to lunch. Please try again.',
      },
      502,
    )
  }
}
