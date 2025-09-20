// Priority keywords for different content types
const PRIORITY_KEYWORDS = {
  documentation: {
    high: ['intro', 'introduction', 'getting-started', 'quickstart', 'overview', 'guide', 'tutorial', 'setup'],
    medium: ['example', 'usage', 'configuration', 'installation', 'concepts', 'basics'],
    low: ['advanced', 'troubleshooting', 'faq', 'migration', 'changelog']
  }
};

function calculateUrlPriority(url, index, type = 'documentation') {
  let score = 100; // Base score
  
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.toLowerCase();
    const segments = pathname.split('/').filter(Boolean);
    
    // 1. Depth penalty (prefer pages closer to root)
    const depth = segments.length;
    score -= depth * 3;
    
    // 2. Keyword scoring
    const keywords = PRIORITY_KEYWORDS[type] || PRIORITY_KEYWORDS.documentation;
    
    // High priority keywords
    if (keywords.high.some(keyword => pathname.includes(keyword))) {
      score += 25;
    }
    
    // Medium priority keywords
    if (keywords.medium.some(keyword => pathname.includes(keyword))) {
      score += 15;
    }
    
    // Low priority keywords (still positive, but less)
    if (keywords.low.some(keyword => pathname.includes(keyword))) {
      score += 5;
    }
    
    // 3. Path structure bonuses
    if (pathname === '/' || pathname === '/docs' || pathname === '/docs/') {
      score += 30; // Root documentation page
    }
    
    if (segments[0] === 'docs' && segments.length === 2) {
      score += 20; // Direct child of /docs/
    }
    
    // 4. File extension penalties
    if (pathname.endsWith('.xml') || pathname.endsWith('.json') || pathname.endsWith('.pdf')) {
      score -= 20;
    }
    
    // 5. Common patterns
    if (pathname.includes('index') && !pathname.includes('api')) {
      score += 10;
    }
    
    if (pathname.includes('readme')) {
      score += 15;
    }
    
    // 6. Original position bonus (earlier in sitemap = likely more important)
    score += Math.max(0, 50 - index);
    
    return Math.max(0, score); // Ensure non-negative
    
  } catch (error) {
    console.error(`Error calculating priority for ${url}:`, error.message);
    return 0;
  }
}

function prioritizeUrls(urls, type = 'documentation', maxPages = 15) {
  console.log(`Prioritizing ${urls.length} URLs`);
  
  // Calculate priority for each URL
  const prioritizedUrls = urls.map((url, index) => ({
    url,
    priority: calculateUrlPriority(url, index, type),
    originalIndex: index
  }));
  
  // Sort by priority (descending)
  prioritizedUrls.sort((a, b) => {
    if (b.priority !== a.priority) {
      return b.priority - a.priority;
    }
    // If same priority, prefer original order
    return a.originalIndex - b.originalIndex;
  });
  
  // Log top priorities for debugging
  console.log('Top priority URLs:');
  prioritizedUrls.slice(0, Math.min(5, prioritizedUrls.length)).forEach((item, index) => {
    console.log(`${index + 1}. [${item.priority}] ${item.url}`);
  });
  
  // Return top N URLs
  const result = prioritizedUrls
    .slice(0, maxPages)
    .map(item => item.url);
  
  console.log(`Selected ${result.length} URLs for scraping`);
  return result;
}

function analyzeUrlPriorities(urls, type = 'documentation') {
  const analysis = {
    total: urls.length,
    priorities: [],
    distribution: {
      high: 0,
      medium: 0,
      low: 0
    }
  };
  
  urls.forEach((url, index) => {
    const priority = calculateUrlPriority(url, index, type);
    analysis.priorities.push({ url, priority });
    
    if (priority >= 80) analysis.distribution.high++;
    else if (priority >= 50) analysis.distribution.medium++;
    else analysis.distribution.low++;
  });
  
  // Sort by priority
  analysis.priorities.sort((a, b) => b.priority - a.priority);
  
  return analysis;
}

module.exports = {
  calculateUrlPriority,
  prioritizeUrls,
  analyzeUrlPriorities,
  PRIORITY_KEYWORDS
};