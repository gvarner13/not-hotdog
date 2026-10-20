import { describe, expect, it, vi } from 'vitest'
import {
  buildInput,
  MAX_IMAGE_BYTES,
  parseVerdict,
  validateJpeg,
} from './classification'
import { handleClassify } from './classify.server'

// Minimal SOF header: tests the bounded header validator, not an image decoder.
const jpeg = (width = 800, height = 600) =>
  new Uint8Array([
    0xff,
    0xd8,
    0xff,
    0xc0,
    0x00,
    0x0b,
    8,
    height >> 8,
    height & 255,
    width >> 8,
    width & 255,
    1,
    1,
    0x11,
    0,
    0xff,
    0xd9,
  ])
const answer = (noul: number) => ({
  answers: { hotdog: { type: 'noul', noul } },
})
const deps = () => ({
  run: vi.fn().mockResolvedValue(answer(0.98)),
  limit: vi.fn().mockResolvedValue({ success: true }),
})
const request = (body = jpeg(), headers: Record<string, string> = {}) =>
  new Request('https://not-hotdog.example/api/classify', {
    method: 'POST',
    headers: { 'content-type': 'image/jpeg', ...headers },
    body: new Uint8Array(body),
  })

describe('CLEF contract', () => {
  it('uses image inputs and typed yes/no classification, not chat completions', () => {
    const input = buildInput('data:image/jpeg;base64,example')
    expect(input.model).toBe('clef')
    expect(input.images).toEqual(['data:image/jpeg;base64,example'])
    expect(input.questions.hotdog.type).toBe('noul')
  })
  it.each([
    [0, false],
    [0.49, false],
    [0.5, true],
    [1, true],
  ])('maps probability %s to %s', (probability, hotdog) => {
    expect(parseVerdict(answer(probability as number), 20)).toEqual({
      hotdog,
      probability,
      elapsedMs: 20,
    })
  })
  it.each([
    {},
    { answers: {} },
    answer(-1),
    answer(2),
    answer(NaN),
    answer(Infinity),
  ])('rejects malformed output rather than inventing a verdict', (output) => {
    expect(() => parseVerdict(output, 1)).toThrow()
  })
})

describe('image limits', () => {
  it('accepts a bounded JPEG frame', () =>
    expect(() => validateJpeg(jpeg())).not.toThrow())
  it('accepts progressive JPEG', () => {
    const bytes = jpeg()
    bytes[3] = 0xc2
    expect(() => validateJpeg(bytes)).not.toThrow()
  })
  it.each([
    new Uint8Array(),
    new Uint8Array([1, 2, 3]),
    jpeg(1025),
    jpeg(0),
    jpeg(100, 2000),
    jpeg().slice(0, 10),
  ])('rejects invalid, truncated, or oversized dimensions', (bytes) => {
    expect(() => validateJpeg(bytes)).toThrow()
  })
  it('rejects oversized bytes', () =>
    expect(() => validateJpeg(new Uint8Array(MAX_IMAGE_BYTES + 1))).toThrow())
})

describe('classification endpoint', () => {
  it('returns a real parsed verdict, no-store, and passes embedded image bytes', async () => {
    const services = deps()
    const response = await handleClassify(
      request(jpeg(), { 'cf-connecting-ip': '192.0.2.1' }),
      services,
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toMatchObject({
      hotdog: true,
      probability: 0.98,
    })
    expect(services.limit).toHaveBeenCalledWith('192.0.2.1')
    expect(services.run.mock.calls[0][0].images[0]).toMatch(
      /^data:image\/jpeg;base64,/,
    )
  })
  it('returns not hotdog for a low probability', async () => {
    const services = deps()
    services.run.mockResolvedValue(answer(0.01))
    const response = await handleClassify(request(), services)
    expect(await response.json()).toMatchObject({
      hotdog: false,
      probability: 0.01,
    })
  })
  it('blocks cross-origin requests before inference', async () => {
    const services = deps()
    expect(
      (
        await handleClassify(
          request(jpeg(), { origin: 'https://elsewhere.example' }),
          services,
        )
      ).status,
    ).toBe(403)
    expect(services.run).not.toHaveBeenCalled()
  })
  it('blocks cross-site fetch metadata even without an Origin', async () => {
    expect(
      (
        await handleClassify(
          request(jpeg(), { 'sec-fetch-site': 'cross-site' }),
          deps(),
        )
      ).status,
    ).toBe(403)
  })
  it('rejects other MIME types', async () => {
    const services = deps()
    expect(
      (
        await handleClassify(
          request(jpeg(), { 'content-type': 'image/svg+xml' }),
          services,
        )
      ).status,
    ).toBe(415)
    expect(services.run).not.toHaveBeenCalled()
  })
  it('rejects corrupt images without inference', async () => {
    const services = deps()
    expect(
      (await handleClassify(request(new Uint8Array([1, 2, 3])), services))
        .status,
    ).toBe(400)
    expect(services.run).not.toHaveBeenCalled()
  })
  it('bounds bodies even without Content-Length', async () => {
    const services = deps()
    expect(
      (
        await handleClassify(
          request(new Uint8Array(MAX_IMAGE_BYTES + 1)),
          services,
        )
      ).status,
    ).toBe(413)
    expect(services.run).not.toHaveBeenCalled()
  })
  it('rejects declared oversized bodies', async () => {
    expect(
      (
        await handleClassify(
          request(jpeg(), { 'content-length': String(MAX_IMAGE_BYTES + 1) }),
          deps(),
        )
      ).status,
    ).toBe(413)
  })
  it('rate limits before reading the image or calling CLEF', async () => {
    const services = deps()
    services.limit.mockResolvedValue({ success: false })
    const response = await handleClassify(request(), services)
    expect(response.status).toBe(429)
    expect(response.headers.get('retry-after')).toBe('60')
    expect(services.run).not.toHaveBeenCalled()
  })
  it('hides provider details on failure', async () => {
    const services = deps()
    services.run.mockRejectedValue(new Error('private provider payload'))
    const response = await handleClassify(request(), services)
    expect(response.status).toBe(502)
    expect(await response.text()).not.toContain('private provider payload')
  })
  it('does not turn an invalid model response into a not-hotdog result', async () => {
    const services = deps()
    services.run.mockResolvedValue({ response: 'maybe' })
    expect((await handleClassify(request(), services)).status).toBe(502)
  })
  it('rejects non-POST calls', async () => {
    expect(
      (
        await handleClassify(
          new Request('https://not-hotdog.example/api/classify'),
          deps(),
        )
      ).status,
    ).toBe(405)
  })
})
