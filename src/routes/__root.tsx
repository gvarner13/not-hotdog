import { createRootRoute, HeadContent, Scripts } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import stylesheet from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Not Hotdog — One question. Two answers.' },
      {
        name: 'description',
        content:
          'The world is complicated. Lunch shouldn’t be. Submit photographic evidence to the Department of Hotdog Identification.',
      },
      { name: 'theme-color', content: '#f9f5e9' },
    ],
    links: [
      { rel: 'stylesheet', href: stylesheet },
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
    ],
  }),
  shellComponent: Document,
  notFoundComponent: () => (
    <main className="fallback">
      <h1>NOT A PAGE.</h1>
      <a href="/">Back to hotdogs →</a>
    </main>
  ),
  errorComponent: () => (
    <main className="fallback">
      <h1>THE MACHINE IS HAVING A MOMENT.</h1>
      <a href="/">Try again →</a>
    </main>
  ),
})

function Document({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
