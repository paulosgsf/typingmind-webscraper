// Patterns for different types of content
const CONTENT_PATTERNS = {
  documentation: {
    include: [
      '/docs/', '/doc/', '/guide/', '/guides/', '/tutorial/', '/tutorials/',
      '/getting-started/', '/quickstart/', '/setup/', '/installation/',
      '/manual/', '/handbook/', '/reference/', '/intro/', '/introduction/',
      '/overview/', '/help/', '/support/', '/learn/', '/examples/'
    ],
    exclude: [
      '/blog/', '/blogs/', '/news/', '/press/', '/changelog/', '/releases/',
      '/download/', '/downloads/', '/pricing/', '/contact/', '/about/',
      '/legal/', '/privacy/', '/terms/', '/careers/', '/jobs/',
      '/api-reference/', '/api/', '/swagger/', '/openapi/'
    ]
  },
  
  general: {
    include: [
      // Very broad - basically include most content
    ],
    exclude: [
      '/admin/', '/login/', '/register/', '/account/', '/dashboard/',
      '/search/', '/404/', '/error/', '/maintenance/'
    ]
  }
};

function filterUrlsByType(urls, type = 'documentation', maxPages = 15) {
  const patterns = CONTENT_PATTERNS[type] || CONTENT_PATTERNS.general;
  
  console.log(`Filtering ${urls.length} URLs for type: ${type}`);
  
  // Step 1: Apply include filters
  let filteredUrls = urls;
  if (patterns.include && patterns.include.length > 0) {
    filteredUrls = urls.filter(url => {
      return patterns.include.some(pattern => url.toLowerCase().includes(pattern.toLowerCase()));
    });
    console.log(`After include filters: ${filteredUrls.length} URLs`);
  }
  
  // Step 2: Apply exclude filters
  if (patterns.exclude && patterns.exclude.length > 0) {
    filteredUrls = filteredUrls.filter(url => {
      return !patterns.exclude.some(pattern => url.toLowerCase().includes(pattern.toLowerCase()));
    });
    console.log(`After exclude filters: ${filteredUrls.length} URLs`);
  }
  
  // Step 3: Remove duplicates
  filteredUrls = [...new Set(filteredUrls)];
  
  // Step 4: Apply max pages limit
  if (filteredUrls.length > maxPages) {
    console.log(`Limiting to ${maxPages} pages from ${filteredUrls.length} candidates`);
    filteredUrls = filteredUrls.slice(0, maxPages);
  }
  
  return filteredUrls;
}

function validateUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function cleanUrls(urls) {
  return urls
    .filter(url => url && typeof url === 'string')
    .map(url => url.trim())
    .filter(url => url.length > 0)
    .filter(validateUrl)
    .filter(url => url.startsWith('http'));
}

function analyzeUrlPatterns(urls) {
  const patterns = {};
  
  urls.forEach(url => {
    try {
      const urlObj = new URL(url);
      const pathSegments = urlObj.pathname.split('/').filter(Boolean);
      
      pathSegments.forEach((segment, index) => {
        if (index === 0) { // First segment
          patterns[segment] = (patterns[segment] || 0) + 1;
        }
      });
    } catch (error) {
      // Skip invalid URLs
    }
  });
  
  // Sort by frequency
  const sortedPatterns = Object.entries(patterns)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10);
  
  console.log('Top URL patterns found:', sortedPatterns);
  return sortedPatterns;
}

module.exports = {
  filterUrlsByType,
  cleanUrls,
  analyzeUrlPatterns,
  CONTENT_PATTERNS
};
