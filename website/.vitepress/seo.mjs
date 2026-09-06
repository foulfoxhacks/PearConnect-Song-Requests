export const origin = 'https://pearconnect.mellozone.site';
const publisher = {
  '@type': 'Organization',
  '@id': `${origin}/#publisher`,
  name: 'FoulFoxHacks',
  url: 'https://github.com/foulfoxhacks'
};
const preview = {
  url: `${origin}/desktop-overview.png`,
  alt: 'PearConnect desktop preview showing connections, request controls and recent results with sample data',
  width: 1839,
  height: 1220
};

// Page data travels with client navigation as well as the prerendered HTML.
export function addPageMetadata(page) {
  const path = page.relativePath.replace(/index\.md$/, '').replace(/\.md$/, '');
  const canonical = `${origin}/${path}`;
  const title = `${page.title} | PearConnect`;
  const description = page.description;
  const graph = [
    publisher,
    {
      '@type': 'WebSite', '@id': `${origin}/#website`, url: `${origin}/`,
      name: 'PearConnect', inLanguage: 'en-US', publisher: { '@id': publisher['@id'] }
    },
    {
      '@type': 'WebPage', '@id': `${canonical}#webpage`, url: canonical,
      name: title, description, inLanguage: 'en-US',
      isPartOf: { '@id': `${origin}/#website` }, publisher: { '@id': publisher['@id'] },
      ...(path === '' ? { mainEntity: { '@id': `${origin}/#software` } } : {})
    }
  ];
  if (path === '') {
    graph.push({
      '@type': 'SoftwareApplication', '@id': `${origin}/#software`,
      name: 'PearConnect', url: `${origin}/`, description,
      applicationCategory: 'MultimediaApplication', operatingSystem: 'Windows',
      softwareVersion: '0.3.0-beta.5', isAccessibleForFree: true,
      downloadUrl: 'https://github.com/foulfoxhacks/PearConnect-Song-Requests/releases/download/v0.3.0-beta.5/PearConnect-0.3.0-beta.5-win-x64.zip',
      releaseNotes: `${origin}/docs/releases`, screenshot: preview.url,
      license: 'https://github.com/foulfoxhacks/PearConnect-Song-Requests/blob/main/LICENSE',
      author: { '@id': publisher['@id'] }, publisher: { '@id': publisher['@id'] }
    });
  }
  if (path.startsWith('docs/')) {
    const items = [{ name: 'PearConnect', item: `${origin}/` }, { name: 'Documentation', item: `${origin}/docs/` }];
    if (path !== 'docs/') items.push({ name: page.title, item: canonical });
    graph.push({
      '@type': 'BreadcrumbList', '@id': `${canonical}#breadcrumbs`,
      itemListElement: items.map((item, index) => ({ '@type': 'ListItem', position: index + 1, ...item }))
    });
    graph[2].breadcrumb = { '@id': `${canonical}#breadcrumbs` };
  }
  page.frontmatter.head ??= [];
  page.frontmatter.head.push(
    ['link', { rel: 'canonical', href: canonical }],
    ['meta', { name: 'robots', content: page.frontmatter.noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:url', content: canonical }],
    ['meta', { property: 'og:title', content: title }],
    ['meta', { property: 'og:description', content: description }],
    ['meta', { property: 'og:image', content: preview.url }],
    ['meta', { property: 'og:image:type', content: 'image/png' }],
    ['meta', { property: 'og:image:width', content: String(preview.width) }],
    ['meta', { property: 'og:image:height', content: String(preview.height) }],
    ['meta', { property: 'og:image:alt', content: preview.alt }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:title', content: title }],
    ['meta', { name: 'twitter:description', content: description }],
    ['meta', { name: 'twitter:image', content: preview.url }],
    ['meta', { name: 'twitter:image:alt', content: preview.alt }],
    ['script', { type: 'application/ld+json' }, JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replaceAll('<', '\\u003c')]
  );
}
