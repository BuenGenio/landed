/**
 * Pre-renders the public pages in every language into web/, one URL per page per language:
 *
 *   site/index.html    →  web/index.html                 web/<lang>/index.html
 *   site/about.html    →  web/about/index.html           web/<lang>/about/index.html      (and contact, terms, privacy)
 *
 * English lives at the root and is the x-default; the other languages at /<code>/. Each page gets the
 * translated text baked in (the same data-i18n rules meta.js applies at runtime, so the browser sees no
 * change when the dictionary loads), <html lang dir>, a canonical URL, hreflang alternates, Open Graph and
 * Twitter tags, JSON-LD, and root-absolute asset paths. Also writes sitemap.xml, robots.txt, the OG image
 * and favicons.
 *
 *   node scripts/build-site.js            SITE_URL=https://landed.school by default
 */
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import * as cheerio from 'cheerio'
import { createHash } from 'node:crypto'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'site'), WEB = join(ROOT, 'web')
const SITE = (process.env.SITE_URL || 'https://landed.school').replace(/\/$/, '')
const BUILT = new Date().toISOString().slice(0, 10)

// ---- languages and dictionaries (the same files the browser loads) ----
const DICTS = {}
globalThis.MD = { i18n: { register: (code, dict) => { DICTS[code] = dict } } }
for (const f of readdirSync(join(WEB, 'meta', 'i18n')).filter(f => f.endsWith('.js'))) await import(pathToFileURL(join(WEB, 'meta', 'i18n', f)).href)
const metaSrc = readFileSync(join(WEB, 'meta', 'meta.js'), 'utf8')
const LANGS = JSON.parse('[' + [...metaSrc.matchAll(/\{ code: "([^"]+)",\s*flag: "([^"]+)",\s*label: "([^"]+)",\s*locale: "([^"]+)",\s*dir: "([^"]+)" \}/g)]
  .map(m => JSON.stringify({ code: m[1], flag: m[2], label: m[3], locale: m[4], dir: m[5] })).join(',') + ']')
if (!LANGS.length) throw new Error('Could not read LANGS from web/meta/meta.js')
const OG_LOCALE = { en: 'en_GB', es: 'es_ES', 'zh-CN': 'zh_CN', 'zh-HK': 'zh_HK', 'zh-TW': 'zh_TW', pl: 'pl_PL', uk: 'uk_UA', ar: 'ar_AR', ro: 'ro_RO' }

const t = (lang, key) => {
  let v = DICTS[lang]?.[key]; if (v == null) v = DICTS.en?.[key]; if (v == null) return null
  if (typeof v === 'object') v = v.other ?? Object.values(v)[0]
  return String(v)
}

// ---- pages ----
const PAGES = [
  { id: 'home', file: 'index.html', path: '', type: 'WebPage' },
  { id: 'about', file: 'about.html', path: 'about/', type: 'AboutPage' },
  { id: 'contact', file: 'contact.html', path: 'contact/', type: 'ContactPage' },
  { id: 'terms', file: 'terms.html', path: 'terms/', type: 'WebPage' },
  { id: 'privacy', file: 'privacy.html', path: 'privacy/', type: 'WebPage' },
]
const langPrefix = code => (code === 'en' ? '' : `/${code}`)
const urlFor = (page, code) => `${SITE}${langPrefix(code)}/${page.path}`
const hrefFor = (page, code) => `${langPrefix(code)}/${page.path}`

const include = html => html.replace(/<!-- @include ([\w.-]+) -->/g, (_, f) => include(readFileSync(join(SRC, f), 'utf8')))
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

function seoHead(page, lang) {
  const meta = page.id === 'home' ? { title: t(lang, 'meta.title'), desc: t(lang, 'meta.description') } : { title: t(lang, `${page.id}.meta.title`), desc: t(lang, `${page.id}.meta.description`) }
  const url = urlFor(page, lang)
  const alternates = LANGS.map(l => `<link rel="alternate" hreflang="${l.code === 'en' ? 'en-GB' : l.locale}" href="${urlFor(page, l.code)}">`).join('\n')
  const ogAlt = LANGS.filter(l => l.code !== lang).map(l => `<meta property="og:locale:alternate" content="${OG_LOCALE[l.code]}">`).join('\n')
  return `<title>${esc(meta.title)}</title>
<meta name="description" content="${esc(meta.desc)}">
<link rel="canonical" href="${url}">
${alternates}
<link rel="alternate" hreflang="x-default" href="${urlFor(page, 'en')}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Landed">
<meta property="og:title" content="${esc(meta.title)}">
<meta property="og:description" content="${esc(meta.desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/img/og.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(t(lang, 'room.aria'))}">
<meta property="og:locale" content="${OG_LOCALE[lang]}">
${ogAlt}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(meta.title)}">
<meta name="twitter:description" content="${esc(meta.desc)}">
<meta name="twitter:image" content="${SITE}/img/og.jpg">
<meta name="theme-color" content="#1B2430">
<link rel="icon" href="/img/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/img/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/img/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<script type="application/ld+json">${JSON.stringify(jsonLd(page, lang))}</script>`
}

function jsonLd(page, lang) {
  const org = { '@type': 'Organization', '@id': `${SITE}/#org`, name: 'Landed', url: SITE + '/', logo: `${SITE}/img/apple-touch-icon.png`, email: 'hello@landed.school',
    address: { '@type': 'PostalAddress', addressLocality: 'Aberdeen', addressCountry: 'GB' }, areaServed: 'Aberdeen, Scotland', description: t(lang, 'meta.description') }
  const site = { '@type': 'WebSite', '@id': `${SITE}/#website`, url: SITE + '/', name: 'Landed', publisher: { '@id': `${SITE}/#org` }, inLanguage: LANGS.map(l => l.locale) }
  const web = { '@type': page.type, '@id': urlFor(page, lang), url: urlFor(page, lang), name: page.id === 'home' ? t(lang, 'meta.title') : t(lang, `${page.id}.meta.title`),
    description: page.id === 'home' ? t(lang, 'meta.description') : t(lang, `${page.id}.meta.description`), inLanguage: LANGS.find(l => l.code === lang).locale, isPartOf: { '@id': `${SITE}/#website` } }
  const crumbs = { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Landed', item: urlFor(PAGES[0], lang) }, ...(page.id === 'home' ? [] : [{ '@type': 'ListItem', position: 2, name: t(lang, `nav.${page.id}`), item: urlFor(page, lang) }])] }
  const graph = [org, site, web, crumbs]
  if (page.id === 'home') {
    const CAT = catalogue()
    graph.push({ '@type': 'Product', name: t(lang, 'kit.arrival.name'), description: t(lang, 'kit.arrival.line'), image: `${SITE}/img/icons/skeuomorphic/kit-arrival.webp`, brand: { '@id': `${SITE}/#org` },
      offers: ['arrival', 'winter', 'both'].map(k => ({ '@type': 'Offer', name: t(lang, `kit.${k}.name`), price: CAT.kits[k].price, priceCurrency: 'GBP', availability: 'https://schema.org/PreOrder', url: urlFor(page, lang), areaServed: 'Aberdeen' })) })
    graph.push({ '@type': 'FAQPage', mainEntity: [1, 2, 3, 4, 5].map(i => ({ '@type': 'Question', name: t(lang, `faq.${i}.q`), acceptedAnswer: { '@type': 'Answer', text: t(lang, `faq.${i}.a`) } })) })
  }
  return { '@context': 'https://schema.org', '@graph': graph }
}
/** ?v=<build hash> on our own CSS/JS so the long cache in _headers never serves a stale file after a deploy.
    One hash over everything in web/meta plus catalogue.js and hero-slides.js, so a change anywhere (a dictionary,
    a skin, an icon path) refreshes all of them together; meta.js passes it on to the dictionaries it loads. */
const BUILD_VER = (() => {
  const h = createHash('sha1'); const walk = d => { for (const f of readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) f.isDirectory() ? walk(join(d, f.name)) : h.update(readFileSync(join(d, f.name))) }
  walk(join(WEB, 'meta')); for (const f of ['catalogue.js', 'hero-slides.js']) if (existsSync(join(WEB, f))) h.update(readFileSync(join(WEB, f)))
  return h.digest('hex').slice(0, 8)
})()
const version = rel => (/\.(css|js)$/.test(rel) ? '?v=' + BUILD_VER : '')
function slideFigures(lang) {
  if (!globalThis.LANDED_SLIDES) { globalThis.LANDED_SLIDES = null; new Function(readFileSync(join(WEB, 'hero-slides.js'), 'utf8'))() }
  const CAT = catalogue()
  const lqipFile = join(WEB, 'img', 'hero', 'lqip.json')
  const lqip = existsSync(lqipFile) ? JSON.parse(readFileSync(lqipFile, 'utf8')) : {}
  const have = (globalThis.LANDED_SLIDES || []).filter(s => existsSync(join(WEB, 'img', 'hero', `${s.id}-1536.webp`)))
  return have.map((s, i) => {
    const names = s.items.map(id => t(lang, CAT.names.item[id] ? `item.${id}` : `addon.${id}`)).join(', ')
    const alt = `${t(lang, 'room.aria')}: ${names}`
    const bg = lqip[s.id] ? ` style="background:url(${lqip[s.id]}) center/cover"` : ''
    return `<figure class="md-slide${i ? '' : ' is-on'}" data-id="${s.id}" data-tags="${s.tags.join(' ')}"${bg}><img src="/img/hero/${s.id}-1536.webp" srcset="/img/hero/${s.id}-768.webp 768w, /img/hero/${s.id}-1536.webp 1536w" sizes="100vw" width="1536" height="1024" alt="${esc(alt)}" ${i ? 'loading="lazy"' : 'fetchpriority="high"'} decoding="async"></figure>`
  }).join('\n')
}
function catalogue() {
  if (!globalThis.LANDED_CATALOGUE) { globalThis.LANDED_CATALOGUE = null; new Function(readFileSync(join(WEB, 'catalogue.js'), 'utf8'))() }
  return globalThis.LANDED_CATALOGUE
}

function render(page, lang) {
  const L = LANGS.find(l => l.code === lang)
  const $ = cheerio.load(include(readFileSync(join(SRC, page.file), 'utf8')))
  $('html').attr('lang', L.locale).attr('dir', L.dir).attr('data-lang', lang).attr('data-page', page.id)
  // translated text, the same three forms meta.js applies at runtime
  $('[data-i18n]').each((_, el) => { const s = t(lang, $(el).attr('data-i18n')); if (s != null) $(el).text(s) })
  $('[data-i18n-html]').each((_, el) => { const s = t(lang, $(el).attr('data-i18n-html')); if (s != null) $(el).html(s) })
  $('[data-i18n-attr]').each((_, el) => { for (const pair of $(el).attr('data-i18n-attr').split(/[;,]/)) { const [attr, key] = pair.split(':').map(x => x.trim()); const s = key && t(lang, key); if (s != null) $(el).attr(attr, s) } })
  // internal links follow the language
  $('[data-nav]').each((_, el) => { const p = PAGES.find(p => p.id === $(el).attr('data-nav')); if (p) $(el).attr('href', hrefFor(p, lang)); if (p && p.id === page.id) $(el).attr('aria-current', 'page') })
  // assets are referenced relative to web/ in the templates; pages live in subfolders
  for (const attr of ['href', 'src']) $(`[${attr}]`).each((_, el) => { const v = $(el).attr(attr); if (/^(meta|img|catalogue\.js|hero-slides\.js|site\.webmanifest)/.test(v)) $(el).attr(attr, '/' + v + version(v)) })
  $('[srcset]').each((_, el) => { $(el).attr('srcset', $(el).attr('srcset').replace(/(^|,\s*)(img\/)/g, '$1/$2')) })
  $('head').find('*').first().before(`<!-- built ${BUILT} by scripts/build-site.js from site/${page.file}; edit the template, not this file -->\n`)
  if (page.id === 'home') $('#hero-slides').html(slideFigures(lang))
  $('[data-hide-on]').each((_, el) => { if ($(el).attr('data-hide-on').split(/\s+/).includes(page.id)) $(el).remove(); else $(el).removeAttr('data-hide-on') })
  let html = $.html()
  html = html.replace('<!-- @seo page="' + page.id + '" -->', seoHead(page, lang))
  return html
}

// ---- outputs ----
const written = []
function out(rel, content) { const f = join(WEB, rel); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, content); written.push(rel) }
for (const l of LANGS) if (l.code !== 'en' && existsSync(join(WEB, l.code))) rmSync(join(WEB, l.code), { recursive: true })
for (const page of PAGES) for (const l of LANGS) out(`${l.code === 'en' ? '' : l.code + '/'}${page.path}index.html`, render(page, l.code))

out('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${PAGES.flatMap(page => LANGS.map(l => `  <url>
    <loc>${urlFor(page, l.code)}</loc>
    <lastmod>${BUILT}</lastmod>
    <changefreq>${page.id === 'home' ? 'weekly' : 'monthly'}</changefreq>
    <priority>${page.id === 'home' ? '1.0' : page.id === 'about' || page.id === 'contact' ? '0.7' : '0.4'}</priority>
${LANGS.map(a => `    <xhtml:link rel="alternate" hreflang="${a.code === 'en' ? 'en-GB' : a.locale}" href="${urlFor(page, a.code)}"/>`).join('\n')}
    <xhtml:link rel="alternate" hreflang="x-default" href="${urlFor(page, 'en')}"/>
  </url>`)).join('\n')}
</urlset>
`)
out('robots.txt', `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/

Sitemap: ${SITE}/sitemap.xml
`)
out('site.webmanifest', JSON.stringify({ name: 'Landed', short_name: 'Landed', start_url: '/', display: 'browser', background_color: '#FFFFFF', theme_color: '#1B2430', icons: [{ src: '/img/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }, { src: '/img/favicon.svg', sizes: 'any', type: 'image/svg+xml' }] }, null, 2))
out('_headers', `/admin/*
  X-Robots-Tag: noindex, nofollow
/api/*
  X-Robots-Tag: noindex
/meta/*
  Cache-Control: public, max-age=31536000, immutable
/img/*
  Cache-Control: public, max-age=604800
`)

// favicon + OG image (only when missing or older than the source photo)
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#1B2430"/><path d="M19 15v34h27v-7H27V15z" fill="#F0A030"/></svg>`
if (!existsSync(join(WEB, 'img', 'favicon.svg'))) { writeFileSync(join(WEB, 'img', 'favicon.svg'), favicon); written.push('img/favicon.svg') }
try {
  const sharp = (await import('sharp')).default
  if (!existsSync(join(WEB, 'img', 'favicon-32.png'))) { await sharp(Buffer.from(favicon)).resize(32, 32).png().toFile(join(WEB, 'img', 'favicon-32.png')); written.push('img/favicon-32.png') }
  if (!existsSync(join(WEB, 'img', 'apple-touch-icon.png'))) { await sharp(Buffer.from(favicon)).resize(180, 180).png().toFile(join(WEB, 'img', 'apple-touch-icon.png')); written.push('img/apple-touch-icon.png') }
  const ogSource = existsSync(join(ROOT, 'assets', 'hero', 'bed-duvet.png')) ? join(ROOT, 'assets', 'hero', 'bed-duvet.png') : join(WEB, 'img', 'first-night.jpg')
  if (!existsSync(join(WEB, 'img', 'og.jpg'))) {
    const badge = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect x="48" y="470" width="470" height="112" rx="24" fill="#1B2430" opacity=".92"/><text x="80" y="546" font-family="Helvetica, Arial, sans-serif" font-size="58" font-weight="800" fill="#fff">Landed <tspan fill="#F0A030" font-weight="500" font-size="30">Aberdeen</tspan></text></svg>`)
    await sharp(ogSource).resize(1200, 630, { fit: 'cover', position: 'attention' }).composite([{ input: badge }]).jpeg({ quality: 82 }).toFile(join(WEB, 'img', 'og.jpg'))
    written.push('img/og.jpg')
  }
} catch (err) { console.warn('images skipped:', err.message) }

console.log(`Built ${PAGES.length} pages × ${LANGS.length} languages → web/ (${written.length} files, assets v=${BUILD_VER})`)
