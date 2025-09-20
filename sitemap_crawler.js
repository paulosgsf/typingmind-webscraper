const cheerio = require('cheerio');
const axios = require('axios');
const { discoverSitemap } = require('./utils/xml_parser');
const { filterUrlsByType, cleanUrls } = require('./utils/url_filters');
const { prioritizeUrls } = require('./utils/priority_sorter');

// Headers para simular browser real
const browserHeaders = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate',
  'DNT': '1',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1'
};

// ========================================
// ADVANCED METADATA EXTRACTION FUNCTIONS
// ========================================

function extractAdvancedMetadata($, content, url) {
  const metadata = {
    // Basic fields (existing)
    title: extractTitle($),
    description: extractDescription($),
    
    // New advanced fields
    author: extractAuthor($),
    keywords: extractKeywords($, content),
    publishDate: extractPublishDate($),
    language: extractLanguage($, content),
    wordCount: calculateWordCount(content),
    readingTime: estimateReadingTime(content),
    contentType: classifyContentType($, url),
    openGraph: extractOpenGraph($),
    
    // Technical metadata
    lastModified: extractLastModified($),
    canonicalUrl: extractCanonicalUrl($)
  };
  
  return metadata;
}

function extractTitle($) {
  // Try multiple title sources in order of preference
  const titleSources = [
    $('meta[property="og:title"]').attr('content'),
    $('meta[name="twitter:title"]').attr('content'),
    $('h1').first().text().trim(),
    $('title').text().trim()
  ];
  
  for (const title of titleSources) {
    if (title && title.length > 0 && title.length < 200) {
      return title;
    }
  }
  
  return '';
}

function extractDescription($) {
  // Try multiple description sources
  const descriptionSources = [
    $('meta[name="description"]').attr('content'),
    $('meta[property="og:description"]').attr('content'),
    $('meta[name="twitter:description"]').attr('content'),
    $('.excerpt, .summary, .intro').first().text().trim()
  ];
  
  for (const desc of descriptionSources) {
    if (desc && desc.length > 20 && desc.length < 500) {
      return desc;
    }
  }
  
  return '';
}

function extractAuthor($) {
  // Try multiple author detection patterns
  const authorSelectors = [
    'meta[name="author"]',
    'meta[property="article:author"]', 
    '.author',
    '.byline',
    '[rel="author"]',
    '.post-author',
    '[itemProp="author"]',
    '.author-name',
    '.writer'
  ];
  
  for (const selector of authorSelectors) {
    const element = $(selector);
    if (element.length > 0) {
      const author = element.attr('content') || element.text().trim();
      if (author && author.length > 0 && author.length < 100) {
        // Clean up common prefixes
        return author.replace(/^(by\s+|author:\s*)/i, '').trim();
      }
    }
  }
  
  return null;
}

function extractKeywords($, content) {
  // Extract from meta keywords
  const metaKeywords = $('meta[name="keywords"]').attr('content');
  if (metaKeywords) {
    return metaKeywords.split(',').map(k => k.trim()).filter(k => k.length > 0);
  }
  
  // Extract from tags/categories
  const tags = [];
  $('.tag, .category, .label, [rel="tag"]').each((i, elem) => {
    const tag = $(elem).text().trim();
    if (tag && tag.length > 0 && tag.length < 50) {
      tags.push(tag);
    }
  });
  
  if (tags.length > 0) {
    return tags.slice(0, 10); // Limit to 10 tags
  }
  
  // Fallback: extract common technical terms from content
  return extractKeywordsFromContent(content);
}

function extractKeywordsFromContent(content) {
  if (!content || content.length < 100) return [];
  
  // Common technical/documentation keywords to look for
  const technicalTerms = [
    'API', 'authentication', 'configuration', 'installation', 'setup',
    'tutorial', 'guide', 'documentation', 'getting started', 'quickstart',
    'parameters', 'endpoints', 'methods', 'functions', 'classes',
    'variables', 'constants', 'properties', 'attributes'
  ];
  
  const foundTerms = [];
  const lowerContent = content.toLowerCase();
  
  technicalTerms.forEach(term => {
    if (lowerContent.includes(term.toLowerCase())) {
      foundTerms.push(term);
    }
  });
  
  return foundTerms.slice(0, 5); // Limit to 5 auto-detected terms
}

function extractPublishDate($) {
  // Try multiple date formats and sources
  const dateSources = [
    $('meta[property="article:published_time"]').attr('content'),
    $('meta[property="article:modified_time"]').attr('content'),
    $('meta[name="publish_date"]').attr('content'),
    $('time[datetime]').attr('datetime'),
    $('time[pubdate]').attr('datetime'),
    $('.date, .publish-date, .post-date').first().text().trim()
  ];
  
  for (const dateStr of dateSources) {
    if (dateStr) {
      const parsedDate = new Date(dateStr);
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate.toISOString();
      }
    }
  }
  
  return null;
}

function extractLanguage($, content) {
  // Try HTML lang attribute first
  const htmlLang = $('html').attr('lang');
  if (htmlLang) {
    return htmlLang.split('-')[0]; // Get just the language part (en from en-US)
  }
  
  // Try meta content-language
  const metaLang = $('meta[http-equiv="content-language"]').attr('content');
  if (metaLang) {
    return metaLang.split('-')[0];
  }
  
  // Simple language detection based on content
  return detectLanguageFromContent(content);
}

function detectLanguageFromContent(content) {
  if (!content || content.length < 50) return 'unknown';
  
  // Very basic language detection (English vs others)
  const englishIndicators = ['the', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'of', 'with'];
  const words = content.toLowerCase().split(/\s+/).slice(0, 100); // First 100 words
  
  let englishScore = 0;
  englishIndicators.forEach(indicator => {
    englishScore += words.filter(word => word === indicator).length;
  });
  
  return englishScore > 5 ? 'en' : 'unknown';
}

function calculateWordCount(content) {
  if (!content) return 0;
  return content.trim().split(/\s+/).filter(word => word.length > 0).length;
}

function estimateReadingTime(content) {
  const wordCount = calculateWordCount(content);
  const wordsPerMinute = 200; // Average reading speed
  const minutes = Math.ceil(wordCount / wordsPerMinute);
  return `${minutes} min read`;
}

function classifyContentType($, url) {
  // Classify based on URL patterns and content structure
  const urlLower = url.toLowerCase();
  
  if (urlLower.includes('/docs/') || urlLower.includes('/documentation/')) {
    return 'documentation';
  }
  
  if (urlLower.includes('/api/') || urlLower.includes('/reference/')) {
    return 'api-reference';
  }
  
  if (urlLower.includes('/tutorial/') || urlLower.includes('/guide/')) {
    return 'tutorial';
  }
  
  if (urlLower.includes('/blog/') || urlLower.includes('/news/')) {
    return 'blog';
  }
  
  // Classify based on content structure
  const hasCodeBlocks = $('pre, code').length > 3;
  const hasAPIMethods = $('h2, h3').text().toLowerCase().includes('method');
  
  if (hasAPIMethods) return 'api-reference';
  if (hasCodeBlocks) return 'technical-guide';
  
  return 'general';
}

function extractOpenGraph($) {
  const og = {};
  
  // Extract common Open Graph tags
  const ogTags = {
    'og:title': 'title',
    'og:description': 'description', 
    'og:type': 'type',
    'og:url': 'url',
    'og:image': 'image',
    'og:site_name': 'siteName'
  };
  
  Object.entries(ogTags).forEach(([property, key]) => {
    const content = $(`meta[property="${property}"]`).attr('content');
    if (content) {
      og[key] = content;
    }
  });
  
  return Object.keys(og).length > 0 ? og : null;
}

function extractLastModified($) {
  const modifiedSources = [
    $('meta[property="article:modified_time"]').attr('content'),
    $('meta[name="last-modified"]').attr('content'),
    $('.last-modified, .updated').first().text().trim()
  ];
  
  for (const dateStr of modifiedSources) {
    if (dateStr) {
      const parsedDate = new Date(dateStr);
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate.toISOString();
      }
    }
  }
  
  return null;
}

function extractCanonicalUrl($) {
  return $('link[rel="canonical"]').attr('href') || null;
}

// ========================================
// SEMANTIC CONTENT EXTRACTION FUNCTIONS
// ========================================

function extractSemanticContent($) {
  // Priority cascade for semantic elements (try specific first)
  const semanticSelectors = [
    'main article',
    'article', 
    'main',
    '[role="main"]',
    '.post-content',
    '.article-content', 
    '.entry-content',
    '.content-area',
    '.docs-content',
    '.documentation',
    '.markdown-body'
  ];
  
  // Try semantic selectors first
  for (const selector of semanticSelectors) {
    const $content = $(selector);
    if ($content.length && $content.text().length > 200) {
      console.log(`✅ Found content using semantic selector: ${selector}`);
      return cleanAndStructureContent($content, $);
    }
  }
  
  // Fallback: Content scoring algorithm
  console.log('🔍 Using content scoring algorithm...');
  return contentScoringFallback($);
}

function contentScoringFallback($) {
  let bestElement = null;
  let bestScore = 0;
  
  // Score all potential content containers
  $('div, section, article, main').each((i, elem) => {
    const $elem = $(elem);
    const score = calculateContentScore($elem, $);
    
    if (score > bestScore && score > 50) { // Minimum threshold
      bestScore = score;
      bestElement = $elem;
    }
  });
  
  if (bestElement) {
    console.log(`✅ Best content found with score: ${bestScore}`);
    return cleanAndStructureContent(bestElement, $);
  }
  
  // Ultimate fallback: body with aggressive cleaning
  console.log('⚠️ Using body fallback with aggressive cleaning');
  return cleanAndStructureContent($('body'), $);
}

function calculateContentScore($elem, $) {
  const text = $elem.text().trim();
  const textLength = text.length;
  
  if (textLength < 50) return 0; // Too short
  
  // Calculate link density (lower is better for content)
  const linkText = $elem.find('a').text().length;
  const linkDensity = linkText / Math.max(textLength, 1);
  
  // Base score from text length
  let score = Math.sqrt(textLength);
  
  // Penalties
  score -= linkDensity * 200; // Heavy penalty for link spam
  score -= $elem.find('script, style').length * 50; // Penalty for noise
  score -= $elem.find('.ad, .advertisement, .social').length * 30;
  
  // Bonuses
  score += $elem.find('p').length * 15; // Bonus for paragraphs
  score += $elem.find('h1, h2, h3, h4, h5, h6').length * 10; // Bonus for headings
  score += $elem.find('ul, ol').length * 5; // Bonus for lists
  
  // Class name bonuses (semantic indicators)
  const className = $elem.attr('class') || '';
  if (className.includes('content')) score += 30;
  if (className.includes('main')) score += 25;
  if (className.includes('article')) score += 25;
  if (className.includes('post')) score += 20;
  
  // Class name penalties  
  if (className.includes('sidebar')) score -= 50;
  if (className.includes('nav')) score -= 40;
  if (className.includes('footer')) score -= 40;
  if (className.includes('header')) score -= 30;
  
  return Math.max(0, score);
}

function cleanAndStructureContent($content, $) {
  // Clone to avoid modifying original
  const $clean = $content.clone();
  
  // Remove noise elements aggressively
  $clean.find('script, style, nav, header, footer, aside').remove();
  $clean.find('.ad, .ads, .advertisement, .social-share').remove();
  $clean.find('.breadcrumb, .pagination, .related-posts').remove();
  $clean.find('[class*="sidebar"], [class*="widget"]').remove();
  
  // Clean up common noise patterns
  $clean.find('div').each((i, elem) => {
    const $div = $(elem);
    const text = $div.text().trim();
    
    // Remove divs that are mostly links
    const linkText = $div.find('a').text().length;
    const linkDensity = linkText / Math.max(text.length, 1);
    if (linkDensity > 0.7 && text.length < 200) {
      $div.remove();
    }
    
    // Remove very short divs that are likely UI elements
    if (text.length < 30 && !$div.find('h1, h2, h3, h4, h5, h6').length) {
      $div.remove();
    }
  });
  
  // Extract clean text with basic structure preservation
  let cleanText = '';
  
  // Process headings with hierarchy
  $clean.find('h1, h2, h3, h4, h5, h6').each((i, elem) => {
    const level = parseInt(elem.tagName.slice(1));
    const text = $(elem).text().trim();
    if (text.length > 0) {
      cleanText += '\n' + '#'.repeat(level) + ' ' + text + '\n\n';
    }
  });
  
  // Process paragraphs
  $clean.find('p').each((i, elem) => {
    const text = $(elem).text().trim();
    if (text.length > 0) {
      cleanText += text + '\n\n';
    }
  });
  
  // Process lists
  $clean.find('ul, ol').each((i, elem) => {
    const $list = $(elem);
    $list.find('li').each((j, li) => {
      const text = $(li).text().trim();
      if (text.length > 0) {
        cleanText += '• ' + text + '\n';
      }
    });
    cleanText += '\n';
  });
  
  // Fallback: if structured extraction didn't work, get all text
  if (cleanText.trim().length < 100) {
    cleanText = $clean.text();
  }
  
  return cleanText.trim();
}

// Function to clean extracted text (legacy function, now enhanced)
function cleanText(text) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, '\n')
    .trim();
}

// ========================================
// MAIN SCRAPING FUNCTIONS (UPDATED)
// ========================================

// Function to scrape a single page with semantic extraction
async function scrapeSinglePage(url) {
  try {
    console.log(`Scraping: ${url}`);
    
    const response = await axios.get(url, {
      headers: browserHeaders,
      timeout: 8000,
      maxRedirects: 3
    });

    const $ = cheerio.load(response.data);

    // Remove unnecessary elements early
    $('script, style, nav, header, footer, .ad, .advertisement, #ads').remove();

    // Extract main content using semantic algorithm
    const content = extractSemanticContent($);

    // Clean and process text (apply final cleaning)
    const cleanedContent = cleanText(content);
    
    // Extract advanced metadata (11 fields)
    const metadata = extractAdvancedMetadata($, cleanedContent, url);

    return {
      url: url,
      
      // Enhanced metadata fields
      title: metadata.title,
      description: metadata.description,
      author: metadata.author,
      keywords: metadata.keywords,
      publishDate: metadata.publishDate,
      language: metadata.language,
      wordCount: metadata.wordCount,
      readingTime: metadata.readingTime,
      contentType: metadata.contentType,
      openGraph: metadata.openGraph,
      lastModified: metadata.lastModified,
      canonicalUrl: metadata.canonicalUrl,
      
      // Content and technical fields
      content: cleanedContent,
      length: cleanedContent.length,
      success: true,
      scraped_at: new Date().toISOString()
    };

  } catch (error) {
    console.error(`Failed to scrape ${url}:`, error.message);
    return {
      url: url,
      
      // Empty metadata fields for failed scraping
      title: '',
      description: '',
      author: null,
      keywords: [],
      publishDate: null,
      language: 'unknown',
      wordCount: 0,
      readingTime: '0 min read',
      contentType: 'unknown',
      openGraph: null,
      lastModified: null,
      canonicalUrl: null,
      
      // Content and technical fields
      content: '',
      length: 0,
      success: false,
      error: error.message,
      scraped_at: new Date().toISOString()
    };
  }
}

// Rate-limited batch scraping
async function batchScrape(urls, delayMs = 1000) {
  const results = [];
  
  console.log(`Starting batch scrape of ${urls.length} URLs with ${delayMs}ms delay`);
  
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const pageData = await scrapeSinglePage(url);
    results.push(pageData);
    
    console.log(`Scraped ${i + 1}/${urls.length}: ${pageData.success ? 'SUCCESS' : 'FAILED'} - ${url}`);
    
    // Rate limiting: wait between requests (except for last one)
    if (i < urls.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`Batch scrape completed: ${successful.length} successful, ${failed.length} failed`);
  
  return results;
}

// Main intelligent crawling function
async function intelligentCrawl(baseUrl, options = {}) {
  const {
    maxPages = 15,
    type = 'documentation',
    rateLimitMs = 1000
  } = options;
  
  console.log(`Starting intelligent crawl for: ${baseUrl}`);
  console.log(`Options: maxPages=${maxPages}, type=${type}, rateLimit=${rateLimitMs}ms`);
  
  try {
    // Step 1: Discover sitemap
    console.log('\n=== STEP 1: DISCOVERING SITEMAP ===');
    let discoveredUrls = await discoverSitemap(baseUrl);
    
    if (discoveredUrls.length === 0) {
      console.log('No sitemap found, using fallback method');
      // Fallback: just scrape the base URL
      discoveredUrls = [baseUrl];
    } else {
      console.log(`Found ${discoveredUrls.length} URLs in sitemap`);
    }
    
    // Step 2: Clean and validate URLs
    console.log('\n=== STEP 2: CLEANING URLS ===');
    const cleanedUrls = cleanUrls(discoveredUrls);
    console.log(`Cleaned URLs: ${cleanedUrls.length} valid URLs`);
    
    // Step 3: Filter by content type
    console.log('\n=== STEP 3: FILTERING BY TYPE ===');
    const filteredUrls = filterUrlsByType(cleanedUrls, type, maxPages * 2); // Get more candidates for prioritization
    
    if (filteredUrls.length === 0) {
      console.log('No URLs match the specified type, falling back to base URL');
      filteredUrls.push(baseUrl);
    }
    
    // Step 4: Prioritize and limit
    console.log('\n=== STEP 4: PRIORITIZING URLS ===');
    const prioritizedUrls = prioritizeUrls(filteredUrls, type, maxPages);
    
    // Step 5: Batch scrape
    console.log('\n=== STEP 5: BATCH SCRAPING ===');
    const scrapedPages = await batchScrape(prioritizedUrls, rateLimitMs);
    
    // Step 6: Consolidate results with enhanced metadata
    console.log('\n=== STEP 6: CONSOLIDATING RESULTS ===');
    const successfulPages = scrapedPages.filter(page => page.success && page.content.length > 50);
    
    const consolidatedContent = successfulPages
      .map(page => {
        let pageSection = `=== ${page.title || 'Untitled'} ===\n`;
        pageSection += `URL: ${page.url}\n`;
        
        // Add rich metadata
        if (page.author) pageSection += `Author: ${page.author}\n`;
        if (page.contentType) pageSection += `Type: ${page.contentType}\n`;
        if (page.readingTime) pageSection += `Reading Time: ${page.readingTime}\n`;
        if (page.keywords && page.keywords.length > 0) {
          pageSection += `Keywords: ${page.keywords.join(', ')}\n`;
        }
        
        pageSection += `\n${page.content}\n\n`;
        return pageSection;
      })
      .join('');
    
    const summary = {
      baseUrl,
      totalDiscovered: discoveredUrls.length,
      totalFiltered: filteredUrls.length,
      totalScraped: scrapedPages.length,
      totalSuccessful: successfulPages.length,
      totalContent: consolidatedContent.length,
      scrapedAt: new Date().toISOString()
    };
    
    console.log('\n=== SUMMARY ===');
    console.log(`Discovered: ${summary.totalDiscovered} URLs`);
    console.log(`Filtered: ${summary.totalFiltered} URLs`);
    console.log(`Scraped: ${summary.totalScraped} URLs`);
    console.log(`Successful: ${summary.totalSuccessful} URLs`);
    console.log(`Total content: ${summary.totalContent} characters`);
    
    return {
      summary,
      pages: successfulPages,
      consolidatedContent,
      allResults: scrapedPages
    };
    
  } catch (error) {
    console.error('Intelligent crawl failed:', error);
    throw error;
  }
}

module.exports = {
  intelligentCrawl,
  scrapeSinglePage,
  batchScrape
};