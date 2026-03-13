import { jsxRenderer } from 'hono/jsx-renderer'
import { Link, ViteClient } from 'vite-ssr-components/hono'

type RendererProps = {
  children: unknown
  locale?: string
  title?: string
}

export const renderer = jsxRenderer(({ children, locale, title }: RendererProps) => {
  return (
    <html lang={locale ?? 'zh-CN'}>
      <head>
        <meta charSet="utf-8" />
        <meta content="width=device-width, initial-scale=1" name="viewport" />
        <title>{title ?? '日均成本账本'}</title>
        <link href="https://fonts.googleapis.com" rel="preconnect" />
        <link crossOrigin="" href="https://fonts.gstatic.com" rel="preconnect" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Manrope:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <ViteClient />
        <Link href="/src/style.css" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  )
})
