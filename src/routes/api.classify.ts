import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { handleClassify } from '../lib/classify.server'
import { MODEL } from '../lib/classification'

export const Route = createFileRoute('/api/classify')({
  server: {
    handlers: {
      POST: ({ request }) =>
        handleClassify(request, {
          limit: (key) => env.CLASSIFY_LIMITER.limit({ key }),
          run: (input) =>
            env.AI.run(MODEL, input, {
              gateway: { id: env.AI_GATEWAY_ID, skipCache: true },
            }),
        }),
    },
  },
})
