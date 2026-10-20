import { bindings, defineConfig } from 'cf/config'

export default defineConfig({
  worker: {
    name: 'not-hotdog',
    entrypoint: '@tanstack/react-start/server-entry',
    compatibilityDate: '2026-10-16',
    compatibilityFlags: ['nodejs_compat'],
    observability: { enabled: true, traces: { enabled: true } },
    env: {
      AI: bindings.ai({ dev: { remote: true } }),
      AI_GATEWAY_ID: bindings.text('not-hotdog'),
      CLASSIFY_LIMITER: bindings.rateLimit({
        namespace: '14829001',
        simple: { limit: 10, period: 60 },
      }),
    },
  },
})
