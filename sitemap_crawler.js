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

// Function to clean extracted text
function cleanText(text) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, '\n')
    .trim();
}

// Function to scrape a single page (reusing logic from original server.js)
async function scrapeSinglePage(url) {
  try {
    console.log(`Scraping: ${url}`);
    
    const response = await axios.get(url, {
      headers: browserHeaders,
      timeout: 8000,
      maxRedirects: 3
    });

    const $ = cheerio.load(response.data);

    // Remove unnecessary elements
    $('script, style, nav, header, footer, .ad, .advertisement, #ads').remove();

    // Extract main content
    let content = '';
    
    const contentSelectors = [
      'main',
      'article', 
      '[role="main"]',
      '.content',
      '.main-content',
      '#content',
      '.post-content',
      '.entry-content',
      '.docs-content',
      '.documentation',
      '.markdown-body',
      'body'
    ];

    for (const selector of contentSelectors) {
      const element = $(selector);
      if (element.length > 0 && element.text().trim().length > 100) {
        content = element.text();
        break;
      }
    }

    // Fallback: get all text from body
    if (!content) {
      content = $('body').text();
    }

    // Clean and process text
    const cleanedContent = cleanText(content);
    
    // Extract metadata
    const title = $('title').text().trim() || '';
    const description = $('meta[name="description"]').attr('content') || '';

    return {
      url: url,
      title: title,
      description: description,
      content: cleanedContent,
      length: cleanedContent.length,
      success: true,
      scraped_at: new Date().toISOString()
    };

  } catch (error) {
    console.error(`Failed to scrape ${url}:`, error.message);
    return {
      url: url,
      title: '',
      description: '',
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
    
    // Step 6: Consolidate results
    console.log('\n=== STEP 6: CONSOLIDATING RESULTS ===');
    const successfulPages = scrapedPages.filter(page => page.success && page.content.length > 50);
    
    const consolidatedContent = successfulPages
      .map(page => `=== ${page.title || 'Untitled'} ===\nURL: ${page.url}\n\n${page.content}\n\n`)
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
