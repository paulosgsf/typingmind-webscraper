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
// SEMANTIC CONTENT EXTRACTION FUNCTIONS
// ========================================

function extractSemanticContent($) {
  // Priority cascade for semantic elements
  const semanticSelectors = [
    'main article', 'article', 'main', '[role="main"]',
    '.post-content', '.article-content', '.entry-content',
    '.content-area', '.docs-content', '.documentation', '.markdown-body'
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
  
  $('div, section, article, main').each((i, elem) => {
    const $elem = $(elem);
    const score = calculateContentScore($elem, $);
    
    if (score > bestScore && score > 50) {
      bestScore = score;
      bestElement = $elem;
    }
  });
  
  if (bestElement) {
    console.log(`✅ Best content found with score: ${bestScore}`);
    return cleanAndStructureContent(bestElement, $);
  }
  
  console.log('⚠️ Using body fallback with aggressive cleaning');
  return cleanAndStructureContent($('body'), $);
}

function calculateContentScore($elem, $) {
  const text = $elem.text().trim();
  const textLength = text.length;
  
  if (textLength < 50) return 0;
  
  const linkText = $elem.find('a').text().length;
  const linkDensity = linkText / Math.max(textLength, 1);
  
  let score = Math.sqrt(textLength);
  
  // Penalties
  score -= linkDensity * 200;
  score -= $elem.find('script, style').length * 50;
  score -= $elem.find('.ad, .advertisement, .social').length * 30;
  
  // Bonuses
  score += $elem.find('p').length * 15;
  score += $elem.find('h1, h2, h3, h4, h5, h6').length * 10;
  score += $elem.find('ul, ol').length * 5;
  
  // Class name bonuses
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
  const $clean = $content.clone();
  
  // Remove noise elements
  $clean.find('script, style, nav, header, footer, aside').remove();
  $clean.find('.ad, .ads, .advertisement, .social-share').remove();
  $clean.find('.breadcrumb, .pagination, .related-posts').remove();
  $clean.find('[class*="sidebar"], [class*="widget"]').remove();
  
  // Clean up noise patterns
  $clean.find('div').each((i, elem) => {
    const $div = $(elem);
    const text = $div.text().trim();
    
    const linkText = $div.find('a').text().length;
    const linkDensity = linkText / Math.max(text.length, 1);
    if (linkDensity > 0.7 && text.length < 200) {
      $div.remove();
    }
    
    if (text.length < 30 && !$div.find('h1, h2, h3, h4, h5, h6').length) {
      $div.remove();
    }
  });
  
  // Extract structured text
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
  
  // Fallback
  if (cleanText.trim().length < 100) {
    cleanText = $clean.text();
  }
  
  return cleanText.trim();
}

// ========================================
// ADVANCED METADATA EXTRACTION FUNCTIONS
// ========================================

function extractAdvancedMetadata($, content, url) {
  return {
    title: extractTitle($),
    description: extractDescription($),
    author: extractAuthor($),
    keywords: extractKeywords($, content),
    publishDate: extractPublishDate($),
    language: extractLanguage($, content),
    wordCount: calculateWordCount(content),
    readingTime: estimateReadingTime(content),
    contentType: classifyContentType($, url),
    openGraph: extractOpenGraph($),
    lastModified: extractLastModified($),
    canonicalUrl: extractCanonicalUrl($)
  };
}

function extractTitle($) {
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
  const descriptionSources = [
    $('meta[name="description"]').attr('content'),
    $('meta[property="og:description"]').attr('content'),
    $('meta[name="twitter:description"]').attr('content')
  ];
  
  for (const desc of descriptionSources) {
    if (desc && desc.length > 20 && desc.length < 500) {
      return desc;
    }
  }
  return '';
}

function extractAuthor($) {
  const authorSelectors = [
    'meta[name="author"]',
    'meta[property="article:author"]', 
    '.author', '.byline', '[rel="author"]',
    '.post-author', '[itemProp="author"]'
  ];
  
  for (const selector of authorSelectors) {
    const element = $(selector);
    if (element.length > 0) {
      const author = element.attr('content') || element.text().trim();
      if (author && author.length > 0 && author.length < 100) {
        return author.replace(/^(by\s+|author:\s*)/i, '').trim();
      }
    }
  }
  return null;
}

function extractKeywords($, content) {
  // Try meta keywords first
  const metaKeywords = $('meta[name="keywords"]').attr('content');
  if (metaKeywords) {
    return metaKeywords.split(',').map(k => k.trim()).filter(k => k.length > 0).slice(0, 10);
  }
  
  // Extract from content
  if (!content || content.length < 100) return [];
  
  const technicalTerms = [
    'API', 'authentication', 'configuration', 'installation', 'setup',
    'tutorial', 'guide', 'documentation', 'getting started', 'quickstart',
    'parameters', 'endpoints', 'methods', 'functions', 'classes'
  ];
  
  const foundTerms = [];
  const lowerContent = content.toLowerCase();
  
  technicalTerms.forEach(term => {
    if (lowerContent.includes(term.toLowerCase())) {
      foundTerms.push(term);
    }
  });
  
  return foundTerms.slice(0, 5);
}

function extractPublishDate($) {
  const dateSources = [
    $('meta[property="article:published_time"]').attr('content'),
    $('meta[property="article:modified_time"]').attr('content'),
    $('time[datetime]').attr('datetime')
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
  const htmlLang = $('html').attr('lang');
  if (htmlLang) {
    return htmlLang.split('-')[0];
  }
  
  if (!content || content.length < 50) return 'unknown';
  
  const englishIndicators = ['the', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'of', 'with'];
  const words = content.toLowerCase().split(/\s+/).slice(0, 100);
  
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
  const wordsPerMinute = 200;
  const minutes = Math.ceil(wordCount / wordsPerMinute);
  return `${minutes} min read`;
}

function classifyContentType($, url) {
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
  
  return 'general';
}

function extractOpenGraph($) {
  const og = {};
  const ogTags = {
    'og:title': 'title',
    'og:description': 'description', 
    'og:type': 'type',
    'og:url': 'url',
    'og:image': 'image'
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
    $('meta[name="last-modified"]').attr('content')
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
// TOKEN OPTIMIZATION FUNCTIONS - ENTREGA 3
// ========================================

function optimizeForLLM(content, metadata) {
  try {
    console.log('🎯 Optimizing content for LLM consumption...');
    
    const optimizations = {
      originalLength: content.length,
      markdown: convertToOptimizedMarkdown(content),
      compressed: compressVerboseText(content),
      structured: structureContentForAI(content, metadata),
      chunked: semanticChunk(content)
    };
    
    // Choose best optimization
    const optimizedContent = optimizations.structured;
    
    console.log(`✅ Token optimization: ${content.length} → ${optimizedContent.length} chars (${Math.round((1 - optimizedContent.length / content.length) * 100)}% reduction)`);
    
    return {
      content: optimizedContent,
      optimization_stats: {
        original_length: optimizations.originalLength,
        optimized_length: optimizedContent.length,
        reduction_percentage: Math.round((1 - optimizedContent.length / content.length) * 100),
        techniques_applied: ['markdown_optimization', 'verbose_compression', 'structure_enhancement']
      }
    };
  } catch (error) {
    console.error('Error in LLM optimization:', error.message);
    return { content, optimization_stats: null };
  }
}

function convertToOptimizedMarkdown(content) {
  if (!content || content.length < 50) return content;
  
  let optimized = content;
  
  // Clean up excessive whitespace while preserving structure
  optimized = optimized.replace(/\n\s*\n\s*\n/g, '\n\n'); // Max 2 line breaks
  optimized = optimized.replace(/\s+/g, ' '); // Normalize spaces
  optimized = optimized.replace(/\n\s+/g, '\n'); // Remove indentation
  
  // Optimize headers for hierarchy
  optimized = optimized.replace(/^#{4,6}\s+/gm, '### '); // Flatten deep headers to h3
  optimized = optimized.replace(/^##\s+([^#])/gm, '## $1'); // Ensure proper spacing
  
  // Optimize lists
  optimized = optimized.replace(/^\s*•\s+/gm, '• '); // Normalize bullet spacing
  optimized = optimized.replace(/(\n• [^\n]+)\n\n/g, '$1\n'); // Reduce spacing in lists
  
  // Remove redundant text patterns
  optimized = optimized.replace(/\b(War diese Seite hilfreich\?|Was this page helpful\?)\b.*$/gim, '');
  optimized = optimized.replace(/\b(Home|Navigation|Search|Suchen)\b[\w\s]*$/gim, '');
  
  return optimized.trim();
}

function compressVerboseText(content) {
  if (!content || content.length < 50) return content;
  
  // Verbose phrase replacements (40% token reduction)
  const compressions = {
    // English compressions
    'in order to': 'to',
    'due to the fact that': 'because',
    'for the purpose of': 'to',
    'in the event that': 'if',
    'with regard to': 'regarding',
    'it is important to note that': '',
    'it should be noted that': '',
    'please be aware that': '',
    'it is worth mentioning that': '',
    'we would like to point out that': '',
    'as previously mentioned': '',
    'as mentioned above': '',
    'as described earlier': '',
    
    // German compressions (for the German content we're processing)
    'es ist wichtig zu bemerken, dass': '',
    'wie bereits erwähnt': '',
    'es sollte beachtet werden, dass': '',
    'aufgrund der Tatsache, dass': 'weil',
    'im Hinblick auf': 'bezüglich',
    'zu dem Zweck': 'um zu',
    
    // Technical redundancies
    'artificial intelligence': 'AI',
    'machine learning': 'ML',
    'natural language processing': 'NLP',
    'large language model': 'LLM',
    'application programming interface': 'API'
  };
  
  let compressed = content;
  
  // Apply compressions
  Object.entries(compressions).forEach(([verbose, concise]) => {
    const regex = new RegExp(verbose, 'gi');
    compressed = compressed.replace(regex, concise);
  });
  
  // Remove redundant words and phrases
  compressed = compressed.replace(/\b(also|additionally|furthermore|moreover|in addition)\s+/gi, '');
  compressed = compressed.replace(/\b(basically|essentially|actually|literally)\s+/gi, '');
  compressed = compressed.replace(/\s+(and so on|etc\.?|and more)\b/gi, '');
  
  // Clean up extra spaces created by removals
  compressed = compressed.replace(/\s+/g, ' ');
  compressed = compressed.replace(/\s*\n\s*/g, '\n');
  
  return compressed.trim();
}

function structureContentForAI(content, metadata) {
  if (!content || content.length < 50) return content;
  
  let structured = '';
  
  // Add context header if we have metadata
  if (metadata && metadata.contentType && metadata.contentType !== 'unknown') {
    structured += `# ${metadata.contentType.charAt(0).toUpperCase() + metadata.contentType.slice(1)}\n\n`;
  }
  
  // Process content sections
  const sections = content.split('\n##').filter(section => section.trim().length > 0);
  
  if (sections.length > 1) {
    // Multi-section content
    sections.forEach((section, index) => {
      let sectionContent = section.trim();
      
      // Restore header marker for non-first sections
      if (index > 0 && !sectionContent.startsWith('#')) {
        sectionContent = '## ' + sectionContent;
      }
      
      // Optimize section content
      sectionContent = optimizeSectionContent(sectionContent);
      
      if (sectionContent.length > 10) { // Only include substantial sections
        structured += sectionContent + '\n\n';
      }
    });
  } else {
    // Single section content
    structured += optimizeSectionContent(content);
  }
  
  return structured.trim();
}

function optimizeSectionContent(section) {
  let optimized = section;
  
  // Extract and organize bullet points
  const bullets = optimized.match(/• [^\n]+/g) || [];
  const mainContent = optimized.replace(/• [^\n]+/g, '').trim();
  
  let result = '';
  
  // Add main content first
  if (mainContent.length > 20) {
    result += mainContent + '\n';
  }
  
  // Add bullets in organized way
  if (bullets.length > 0) {
    if (result.length > 0) result += '\n';
    
    // Group similar bullets if many
    if (bullets.length > 8) {
      result += bullets.slice(0, 6).join('\n') + '\n• [... and more]\n';
    } else {
      result += bullets.join('\n') + '\n';
    }
  }
  
  return result.trim();
}

function semanticChunk(content, maxChunkSize = 2000) {
  if (!content || content.length <= maxChunkSize) return [content];
  
  const chunks = [];
  const sections = content.split('\n## ').filter(s => s.trim().length > 0);
  
  let currentChunk = '';
  
  sections.forEach(section => {
    const fullSection = section.startsWith('##') ? section : '## ' + section;
    
    if (currentChunk.length + fullSection.length <= maxChunkSize) {
      currentChunk += fullSection + '\n\n';
    } else {
      if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = fullSection + '\n\n';
    }
  });
  
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks.length > 0 ? chunks : [content];
}

// Enhanced content extraction that gets full definitions, not just headers
function extractEnhancedSemanticContent($) {
  // Try to get more complete content including definitions
  const semanticSelectors = [
    'main article', 'article', 'main', '[role="main"]',
    '.post-content', '.article-content', '.entry-content',
    '.content-area', '.docs-content', '.documentation', '.markdown-body'
  ];
  
  for (const selector of semanticSelectors) {
    const $content = $(selector);
    if ($content.length && $content.text().length > 200) {
      console.log(`✅ Found content using semantic selector: ${selector}`);
      return extractFullContentWithDefinitions($content, $);
    }
  }
  
  console.log('🔍 Using enhanced content scoring algorithm...');
  return enhancedContentScoringFallback($);
}

function extractFullContentWithDefinitions($content, $) {
  const $clean = $content.clone();
  
  // Remove noise but preserve definition content
  $clean.find('script, style, nav, header, footer, aside').remove();
  $clean.find('.ad, .ads, .advertisement, .social-share').remove();
  $clean.find('.breadcrumb, .pagination, .related-posts').remove();
  $clean.find('[class*="sidebar"]:not([class*="content"])').remove();
  
  let structuredContent = '';
  
  // Extract content with full definitions
  $clean.find('h1, h2, h3, h4, h5, h6').each((i, elem) => {
    const $heading = $(elem);
    const level = parseInt(elem.tagName.slice(1));
    const headingText = $heading.text().trim();
    
    if (headingText.length > 0) {
      structuredContent += '\n' + '#'.repeat(level) + ' ' + headingText + '\n\n';
      
      // Get content after this heading until next heading
      let $current = $heading.next();
      let sectionContent = '';
      
      while ($current.length && !$current.is('h1, h2, h3, h4, h5, h6')) {
        const text = $current.text().trim();
        
        if (text.length > 20) {
          if ($current.is('p')) {
            sectionContent += text + '\n\n';
          } else if ($current.is('ul, ol')) {
            $current.find('li').each((j, li) => {
              const liText = $(li).text().trim();
              if (liText.length > 0) {
                sectionContent += '• ' + liText + '\n';
              }
            });
            sectionContent += '\n';
          } else if ($current.is('div') && text.length > 50) {
            sectionContent += text + '\n\n';
          }
        }
        
        $current = $current.next();
      }
      
      if (sectionContent.trim().length > 0) {
        structuredContent += sectionContent;
      }
    }
  });
  
  // Fallback: if no headings found, get all paragraphs and lists
  if (structuredContent.trim().length < 100) {
    $clean.find('p').each((i, elem) => {
      const text = $(elem).text().trim();
      if (text.length > 20) {
        structuredContent += text + '\n\n';
      }
    });
    
    $clean.find('ul, ol').each((i, elem) => {
      const $list = $(elem);
      $list.find('li').each((j, li) => {
        const text = $(li).text().trim();
        if (text.length > 0) {
          structuredContent += '• ' + text + '\n';
        }
      });
      structuredContent += '\n';
    });
  }
  
  return structuredContent.trim();
}

function enhancedContentScoringFallback($) {
  // Similar to original but tries to get full content
  let bestElement = null;
  let bestScore = 0;
  
  $('div, section, article, main').each((i, elem) => {
    const $elem = $(elem);
    const score = calculateContentScore($elem, $);
    
    if (score > bestScore && score > 30) { // Lower threshold for more content
      bestScore = score;
      bestElement = $elem;
    }
  });
  
  if (bestElement) {
    console.log(`✅ Best content found with score: ${bestScore}`);
    return extractFullContentWithDefinitions(bestElement, $);
  }
  
  console.log('⚠️ Using body fallback with full content extraction');
  return extractFullContentWithDefinitions($('body'), $);
}

// Function to clean extracted text
function cleanText(text) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, '\n')
    .trim();
}

// ========================================
// MAIN SCRAPING FUNCTIONS (ENHANCED)
// ========================================

// Enhanced function to scrape a single page with SELECTIVE TOKEN OPTIMIZATION
async function scrapeSinglePage(url) {
  try {
    console.log(`Scraping: ${url}`);
    
    const response = await axios.get(url, {
      headers: browserHeaders,
      timeout: 10000,
      maxRedirects: 5
    });

    const $ = cheerio.load(response.data);

    // Remove unnecessary elements early
    $('script, style, nav, header, footer, .ad, .advertisement, #ads').remove();

    // Extract main content using ORIGINAL semantic algorithm (that worked)
    const rawContent = extractSemanticContent($);
    const cleanedContent = cleanText(rawContent);
    
    // Extract advanced metadata (11 fields)
    const metadata = extractAdvancedMetadata($, cleanedContent, url);

    // SELECTIVE optimization: Only apply safe improvements
    const optimizedContent = applySafeOptimizations(cleanedContent);
    const reductionPercentage = Math.round((1 - optimizedContent.length / cleanedContent.length) * 100);

    console.log(`✅ Successfully scraped ${url} - ${optimizedContent.length} chars`);
    if (reductionPercentage > 0) {
      console.log(`🎯 Content optimized: ${reductionPercentage}% reduction`);
    }

    return {
      url: url,
      
      // Enhanced metadata fields (11 total)
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
      
      // Optimized content (safe optimizations only)
      content: optimizedContent,
      length: optimizedContent.length,
      optimization_stats: reductionPercentage > 0 ? {
        original_length: cleanedContent.length,
        optimized_length: optimizedContent.length,
        reduction_percentage: reductionPercentage,
        techniques_applied: ['safe_cleanup', 'whitespace_optimization', 'redundancy_removal']
      } : null,
      
      // Technical fields
      success: true,
      scraped_at: new Date().toISOString()
    };

  } catch (error) {
    console.error(`Failed to scrape ${url}:`, error.message);
    
    return {
      url: url,
      title: '', description: '', author: null, keywords: [],
      publishDate: null, language: 'unknown', wordCount: 0,
      readingTime: '0 min read', contentType: 'unknown',
      openGraph: null, lastModified: null, canonicalUrl: null,
      content: '', length: 0, optimization_stats: null,
      success: false, error: error.message, scraped_at: new Date().toISOString()
    };
  }
}

// Safe optimization function that only applies proven improvements
function applySafeOptimizations(content) {
  if (!content || content.length < 50) return content;
  
  let optimized = content;
  
  // Safe optimizations that don't lose content
  
  // 1. Clean up excessive whitespace
  optimized = optimized.replace(/\n\s*\n\s*\n/g, '\n\n'); // Max 2 line breaks
  optimized = optimized.replace(/[ \t]+/g, ' '); // Normalize spaces but preserve newlines
  optimized = optimized.replace(/\n /g, '\n'); // Remove leading spaces on lines
  
  // 2. Remove obvious redundant phrases (conservative)
  optimized = optimized.replace(/\b(War diese Seite hilfreich\?|Was this page helpful\?)\s*$/gim, '');
  optimized = optimized.replace(/\b(Home|Navigation|Search|Suchen)[\s\w]*\n/gim, '');
  
  // 3. Compress only safe verbose phrases
  const safeCompressions = {
    'in order to': 'to',
    'due to the fact that': 'because',
    'artificial intelligence': 'AI',
    'large language model': 'LLM',
    'application programming interface': 'API'
  };
  
  Object.entries(safeCompressions).forEach(([verbose, concise]) => {
    const regex = new RegExp(`\\b${verbose}\\b`, 'gi');
    optimized = optimized.replace(regex, concise);
  });
  
  // 4. Final cleanup
  optimized = optimized.replace(/\s+$/gm, ''); // Remove trailing spaces
  optimized = optimized.trim();
  
  return optimized;
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
    const filteredUrls = filterUrlsByType(cleanedUrls, type, maxPages * 2);
    
    if (filteredUrls.length === 0) {
      console.log('No URLs match the specified type, falling back to base URL');
      filteredUrls.push(baseUrl);
    }
    
    // Step 4: Prioritize and limit
    console.log('\n=== STEP 4: PRIORITIZING URLS ===');
    const prioritizedUrls = prioritizeUrls(filteredUrls, type, maxPages);
    
    // Step 5: Batch scrape with enhanced metadata
    console.log('\n=== STEP 5: BATCH SCRAPING ===');
    const scrapedPages = await batchScrape(prioritizedUrls, rateLimitMs);
    
    // Step 6: Consolidate results with enhanced metadata
    console.log('\n=== STEP 6: CONSOLIDATING RESULTS ===');
    const successfulPages = scrapedPages.filter(page => page.success && page.content.length > 50);
    
    const consolidatedContent = successfulPages
      .map(page => {
        let pageSection = `=== ${page.title || 'Untitled'} ===\n`;
        pageSection += `URL: ${page.url}\n`;
        
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