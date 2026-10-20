import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { verdictSchema, type Verdict } from '../lib/classification'
import { prepareImage } from '../lib/image'

export const Route = createFileRoute('/')({ component: Home })

type Phase = 'idle' | 'preparing' | 'ready' | 'analyzing' | 'done'
const loadingMessages = [
  'Consulting the bun database…',
  'Cross-examining the condiments…',
  'Ruling out actual dogs…',
  'Taking lunch very seriously…',
]

function HotdogDrawing() {
  return (
    <svg
      viewBox="0 0 360 230"
      fill="none"
      className="hotdog-drawing"
      aria-hidden="true"
    >
      <g transform="rotate(-22 180 115)">
        <path
          d="M71 112C47 71 75 43 119 46L269 70C321 79 323 129 290 149L116 154Z"
          fill="#E3A33C"
          stroke="#27271F"
          strokeWidth="4"
        />
        <path
          d="M83 91C64 73 80 55 104 60L281 92C307 96 306 128 281 130L103 115Z"
          fill="#BD432E"
          stroke="#27271F"
          strokeWidth="4"
        />
        <path
          d="M104 80L124 94L144 86L162 101L182 93L200 107L220 101L240 114L262 108"
          stroke="#F8D65D"
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M76 103C52 107 57 141 89 157L244 184C283 189 313 165 297 139C288 124 274 129 258 128L105 102C93 101 85 100 76 103Z"
          fill="#F5C96E"
          stroke="#27271F"
          strokeWidth="4"
        />
        <path
          d="M82 127C101 144 118 144 137 148M157 151L243 166"
          stroke="#DE9D37"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path
          d="M103 116L108 120M141 124L145 128M183 134L187 138M222 138L227 142M267 146L272 149"
          stroke="#FFF3CA"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </g>
      <path
        d="M45 46L35 36M46 69L29 67M310 181L324 186M307 201L315 213"
        stroke="#27271F"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}

function UploadIcon({ camera = false }: { camera?: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {camera ? (
        <>
          <path d="M4 6h4l2-3h4l2 3h4a1 1 0 0 1 1 1v13H3V7a1 1 0 0 1 1-1Z" />
          <circle cx="12" cy="13" r="4" />
        </>
      ) : (
        <>
          <path d="M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6" />
        </>
      )}
    </svg>
  )
}

function Home() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null)
  const [verdict, setVerdict] = useState<Verdict | null>(null)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [loadingIndex, setLoadingIndex] = useState(0)
  const upload = useRef<HTMLInputElement>(null)
  const camera = useRef<HTMLInputElement>(null)
  const controller = useRef<AbortController | null>(null)
  const operation = useRef(0)
  const busy = phase === 'preparing' || phase === 'analyzing'

  useEffect(
    () => () => {
      if (photo) URL.revokeObjectURL(photo.url)
    },
    [photo],
  )
  useEffect(
    () => () => {
      operation.current++
      controller.current?.abort()
    },
    [],
  )
  useEffect(() => {
    if (phase !== 'analyzing') return
    const timer = window.setInterval(
      () => setLoadingIndex((n) => (n + 1) % loadingMessages.length),
      2400,
    )
    return () => window.clearInterval(timer)
  }, [phase])

  async function selectFile(file?: File) {
    if (!file || busy) return
    const id = ++operation.current
    setError('')
    setVerdict(null)
    setPhoto(null)
    setPhase('preparing')
    try {
      const blob = await prepareImage(file)
      if (id !== operation.current) return
      setPhoto({ blob, url: URL.createObjectURL(blob) })
      setPhase('ready')
    } catch (cause) {
      if (id !== operation.current) return
      setError(
        cause instanceof Error ? cause.message : 'Could not open that image.',
      )
      setPhase('idle')
    }
  }

  async function analyze() {
    if (!photo || busy) return
    setError('')
    setPhase('analyzing')
    setLoadingIndex(0)
    const abort = new AbortController()
    controller.current = abort
    const timeout = window.setTimeout(() => abort.abort(), 60_000)
    try {
      const response = await fetch('/api/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'image/jpeg' },
        body: photo.blob,
        signal: abort.signal,
      })
      const body: unknown = await response.json()
      if (!response.ok) {
        const message =
          body &&
          typeof body === 'object' &&
          'error' in body &&
          typeof body.error === 'string'
            ? body.error
            : 'The department is unavailable. Please try again.'
        throw new Error(message)
      }
      setVerdict(verdictSchema.parse(body))
      setPhase('done')
    } catch (cause) {
      setError(
        abort.signal.aborted
          ? 'This inspection took too long. Please try again.'
          : cause instanceof Error
            ? cause.message
            : 'Connection lost. Please try again.',
      )
      setPhase('ready')
    } finally {
      window.clearTimeout(timeout)
      controller.current = null
    }
  }

  function reset() {
    operation.current++
    setPhoto(null)
    setVerdict(null)
    setError('')
    setPhase('idle')
  }

  const resultLabel = verdict?.hotdog ? 'HOTDOG.' : 'NOT HOTDOG.'
  const confidence = verdict
    ? Math.round(
        (verdict.hotdog ? verdict.probability : 1 - verdict.probability) * 100,
      )
    : 0

  return (
    <>
      <a href="#inspection" className="skip-link">
        Skip to the hotdog inspector
      </a>
      <header className="site-header">
        <a href="/" className="wordmark" aria-label="Not Hotdog home">
          <span className="brand-icon" aria-hidden="true">
            🌭
          </span>{' '}
          NOT HOTDOG<span className="wordmark-dot">®*</span>
        </a>
        <span className="header-note">
          <span className="status-dot" /> A VERY SPECIFIC INTELLIGENCE
        </span>
        <a href="#method" className="header-link">
          The science <span aria-hidden="true">↗</span>
        </a>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="tiny-cross">✳</span> DEPT. OF HOTDOG
              IDENTIFICATION
            </div>
            <h1>
              One question.
              <br />
              Two{' '}
              <span className="underlined">
                answers.
                <svg
                  viewBox="0 0 380 20"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path d="M4 14Q181-3 373 8M22 19Q201 7 350 16" />
                </svg>
              </span>
            </h1>
            <p className="hero-description">
              The world is complicated. Lunch shouldn’t be.
              <br className="desktop-break" /> Our AI can identify a hotdog. And
              absolutely nothing else.
            </p>
            <div className="hero-bottom">
              <span className="mini-label">
                27 BILLION PARAMETERS.
                <br />
                <strong>ONE CALLING IN LIFE.</strong>
              </span>
              <span className="hand-note">
                finally, useful AI <span aria-hidden="true">↴</span>
              </span>
            </div>
          </div>
          <div className="hero-art">
            <div className="orbit-text">
              ADVANCED TECHNOLOGY. QUESTIONABLE PURPOSE.
            </div>
            <HotdogDrawing />
            <div className="specimen-label">
              <span className="status-dot" /> FIG. 01 — THE SUSPECT
            </div>
            <div className="round-stamp">
              100%
              <br />
              <span>
                BUN-BASED
                <br />
                RESEARCH
              </span>
            </div>
          </div>
        </section>

        <section
          id="inspection"
          className="inspection"
          aria-labelledby="inspection-title"
        >
          <div className="inspection-heading">
            <div>
              <span className="section-number">01 / THE INSPECTION</span>
              <h2 id="inspection-title">Show us what you’re working with.</h2>
            </div>
            <span className="classified-label">FOR CULINARY USE ONLY</span>
          </div>
          <div className="inspection-grid">
            <div
              className={`upload-panel ${dragging ? 'dragging' : ''} ${photo ? 'has-photo' : ''}`}
              onDragOver={(event) => {
                event.preventDefault()
                if (!busy) setDragging(true)
              }}
              onDragLeave={(event) => {
                if (
                  !event.currentTarget.contains(
                    event.relatedTarget as Node | null,
                  )
                )
                  setDragging(false)
              }}
              onDrop={(event) => {
                event.preventDefault()
                setDragging(false)
                void selectFile(event.dataTransfer.files[0])
              }}
            >
              <input
                ref={upload}
                id="photo-upload"
                aria-label="Upload a photo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                disabled={busy}
                onChange={(event) => {
                  void selectFile(event.target.files?.[0])
                  event.target.value = ''
                }}
              />
              <input
                ref={camera}
                id="camera-upload"
                aria-label="Take a photo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                hidden
                disabled={busy}
                onChange={(event) => {
                  void selectFile(event.target.files?.[0])
                  event.target.value = ''
                }}
              />
              {photo ? (
                <>
                  <img
                    src={photo.url}
                    alt="Your submitted photographic evidence"
                    className="evidence-photo"
                  />
                  <span className="photo-label">EXHIBIT A</span>
                  {phase === 'analyzing' ? <div className="scan-line" /> : null}
                  {!busy ? (
                    <button
                      className="change-photo"
                      onClick={() => upload.current?.click()}
                    >
                      ↻ Change photo
                    </button>
                  ) : null}
                </>
              ) : (
                <div className="upload-content">
                  <div className="upload-symbol">
                    <UploadIcon />
                  </div>
                  <h3>
                    {phase === 'preparing'
                      ? 'Preparing the evidence…'
                      : dragging
                        ? 'Drop it like it’s hot(dog).'
                        : 'Drop your evidence here.'}
                  </h3>
                  <p>A hotdog. A shoe. Your emotionally unavailable cat.</p>
                  <button
                    className="button dark"
                    disabled={busy}
                    onClick={() => upload.current?.click()}
                  >
                    <UploadIcon /> Upload a photo{' '}
                    <span aria-hidden="true">↗</span>
                  </button>
                  <button
                    className="camera-button"
                    disabled={busy}
                    onClick={() => camera.current?.click()}
                  >
                    <UploadIcon camera /> Or take a photo
                  </button>
                  <span className="file-note">
                    JPG, PNG, WEBP · UP TO 20 MB
                  </span>
                </div>
              )}
              <span className="corner top-left" />
              <span className="corner top-right" />
              <span className="corner bottom-left" />
              <span className="corner bottom-right" />
            </div>
            <div
              className={`verdict-panel ${verdict ? (verdict.hotdog ? 'positive' : 'negative') : ''}`}
              aria-live="polite"
              aria-busy={busy}
            >
              <div className="verdict-top">
                <span className="section-number">OFFICIAL VERDICT</span>
                <span className="case-number">NH—001</span>
              </div>
              {verdict ? (
                <div className="result-content">
                  <span className="result-symbol" aria-hidden="true">
                    {verdict.hotdog ? '✓' : '×'}
                  </span>
                  <h3 className="result-title">{resultLabel}</h3>
                  <p>
                    {verdict.hotdog
                      ? 'A triumph of sausage engineering.'
                      : 'Could be anything. Not our department.'}
                  </p>
                  <div className="confidence">
                    <div>
                      <span>MODEL PROBABILITY</span>
                      <strong>{confidence}%</strong>
                    </div>
                    <div className="confidence-track">
                      <span style={{ width: `${confidence}%` }} />
                    </div>
                  </div>
                  <span className="result-fineprint">
                    An AI estimate, not a scientific certainty.
                    <br />
                    Inspected in {(verdict.elapsedMs / 1000).toFixed(1)}s. Lunch
                    is still your call.
                  </span>
                  <button className="button result-button" onClick={reset}>
                    Inspect another suspect <span aria-hidden="true">↗</span>
                  </button>
                </div>
              ) : (
                <div className="pending-content">
                  <div
                    className={`pending-symbol ${busy ? 'spinning' : ''}`}
                    aria-hidden="true"
                  >
                    {busy ? '✳' : '?'}
                  </div>
                  <h3>
                    {phase === 'analyzing'
                      ? 'Important science<br />is happening.'
                      : photo
                        ? 'Evidence received.'
                        : 'The jury is hungry.'}
                  </h3>
                  <p>
                    {phase === 'analyzing'
                      ? loadingMessages[loadingIndex]
                      : photo
                        ? 'Let’s settle this incredibly specific question.'
                        : 'Submit a photo. Receive a verdict.\nQuestion everything you thought you knew.'}
                  </p>
                  {photo ? (
                    <button
                      className="button dark analyze-button"
                      onClick={() => void analyze()}
                      disabled={busy}
                    >
                      {busy ? 'Inspecting…' : 'Is it a hotdog?'}{' '}
                      <span aria-hidden="true">→</span>
                    </button>
                  ) : (
                    <div className="possible-results">
                      <span>✓ HOTDOG</span>
                      <span>× NOT HOTDOG</span>
                    </div>
                  )}
                </div>
              )}
              <div className="verdict-bottom">
                <span className="status-dot" /> POWERED BY CLOUDFLARE CLEF
              </div>
            </div>
          </div>
          {error ? (
            <div role="alert" className="error-message">
              <strong>Small condiment malfunction.</strong> {error}
            </div>
          ) : null}
          <div className="privacy-note">
            <span aria-hidden="true">↳</span> Photos are resized in your
            browser, then sent to Cloudflare for inspection. We don’t save a
            photo gallery.
          </div>
        </section>

        <section id="method" className="method" aria-labelledby="method-title">
          <div className="method-intro">
            <span className="section-number">
              02 / THE GROUNDBREAKING SCIENCE
            </span>
            <h2 id="method-title">
              Less artificial general intelligence.
              <br />
              More artificial <em>sausage</em> intelligence.
            </h2>
          </div>
          <div className="method-cards">
            <article>
              <span className="step-number">01</span>
              <h3>You provide the pixels.</h3>
              <p>
                Upload a photo or use your camera. Ideally of something you
                suspect might be lunch.
              </p>
            </article>
            <article>
              <span className="step-number">02</span>
              <h3>We call in the expert.</h3>
              <p>
                Cloudflare’s CLEF model examines the image through AI Gateway.
                Yes, this is real AI.
              </p>
            </article>
            <article>
              <span className="step-number">03</span>
              <h3>Two possible futures.</h3>
              <p>
                Hotdog. Not hotdog. No recipes, no life advice, no “as a large
                language model.”
              </p>
            </article>
          </div>
        </section>
        <aside className="manifesto">
          <span aria-hidden="true">✳</span>
          <p>
            Not every problem needs AI.
            <br />
            <strong>This one definitely didn’t.</strong>
          </p>
          <span aria-hidden="true">✳</span>
        </aside>
      </main>
      <footer className="site-footer">
        <span>
          NOT HOTDOG <span aria-hidden="true">🌭</span>{' '}
          <span className="footer-note">A deeply unserious application.</span>
        </span>
        <span>
          *Not actually registered. Inspired by Silicon Valley. Unaffiliated.
        </span>
      </footer>
    </>
  )
}
