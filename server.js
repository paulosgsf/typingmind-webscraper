const express = require('express');
const cheerio = require('cheerio');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

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

// Import the semantic extraction functions from sitemap_crawler
const { scrapeSinglePage } = require('./sitemap_crawler');

// Função para limpar texto extraído (legacy support)
function cleanText(text) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, '\n')
    .trim();
}

// Endpoint principal de web scraping (enhanced with metadata)
app.post('/webscrape', async (req, res) => {
  try {
    let { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ 
        error: 'URL é obrigatória',
        usage: 'POST /webscrape com { "url": "https://exemplo.com" }'
      });
    }

    // Limpar URL (remover chaves extras se houver)
    url = url.toString().trim();
    if (url.startsWith('{') && url.endsWith('}')) {
      url = url.slice(1, -1);
      console.log('Cleaned URL from:', req.body.url, 'to:', url);
    }

    // Validar URL
    let targetUrl;
    try {
      targetUrl = new URL(url);
    } catch (err) {
      return res.status(400).json({ error: 'URL inválida' });
    }

    console.log(`=== ENHANCED SCRAPING REQUEST ===`);
    console.log(`URL: ${url}`);

    // Use the enhanced scraping function from sitemap_crawler
    const result = await scrapeSinglePage(url);
    
    if (result.success) {
      console.log(`✅ Enhanced scraping completed: ${result.length} chars`);
      console.log(`✅ Metadata fields: ${Object.keys(result).length} total fields`);
      
      // Log metadata summary for debugging
      console.log('📊 Metadata Summary:');
      console.log(`  - Title: ${result.title ? 'YES' : 'NO'}`);
      console.log(`  - Author: ${result.author ? 'YES' : 'NO'}`);
      console.log(`  - Keywords: ${result.keywords?.length || 0} found`);
      console.log(`  - Content Type: ${result.contentType}`);
      console.log(`  - Language: ${result.language}`);
      console.log(`  - Word Count: ${result.wordCount}`);
      console.log(`  - Reading Time: ${result.readingTime}`);
      
      res.json(result);
    } else {
      console.log(`❌ Enhanced scraping failed: ${result.error}`);
      res.status(500).json(result);
    }

  } catch (error) {
    console.error('❌ Enhanced scraping error:', error.message);
    
    if (error.code === 'ENOTFOUND') {
      return res.status(400).json({ error: 'URL não encontrada ou inacessível' });
    }
    
    if (error.code === 'ECONNABORTED') {
      return res.status(408).json({ error: 'Timeout - site muito lento' });
    }

    res.status(500).json({ 
      error: 'Erro interno do servidor',
      message: error.message 
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'TypingMind Web Scraper',
    version: '2.0.0', // Updated version
    features: ['semantic_extraction', 'advanced_metadata', 'intelligent_crawling'],
    timestamp: new Date().toISOString()
  });
});

// === INTELLIGENT CRAWLING ENDPOINT ===
const { intelligentCrawl } = require('./sitemap_crawler');

// Endpoint para crawling inteligente de documentação
app.post('/webscrape-intelligent', async (req, res) => {
  try {
    let { base_url, url, max_pages = 15, type = 'documentation' } = req.body;

    // Fix parameter name (plugin sends 'url' instead of 'base_url')
    if (!base_url && url) {
      base_url = url;
    }

    // Clean URL (remove extra braces like the simple endpoint does)
    if (base_url) {
      base_url = base_url.toString().trim();
      if (base_url.startsWith('{') && base_url.endsWith('}')) {
        base_url = base_url.slice(1, -1);
        console.log('Cleaned base_url from:', url || req.body.base_url, 'to:', base_url);
      }
    }    
    
    console.log('=== INTELLIGENT CRAWL REQUEST ===');
    console.log('Body:', req.body);
    
    if (!base_url) {
      return res.status(400).json({ 
        error: 'base_url é obrigatória',
        usage: 'POST /webscrape-intelligent com { "base_url": "https://docs.exemplo.com" }'
      });
    }

    console.log(`Starting intelligent crawl: ${base_url}`);
    
    const result = await intelligentCrawl(base_url, { 
      maxPages: max_pages, 
      type: type 
    });
    
    res.json({
      site_url: base_url,
      type: type,
      summary: result.summary,
      pages: result.pages,
      consolidated_content: result.consolidatedContent,
      scraped_at: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Intelligent crawl error:', error);
    res.status(500).json({ 
      error: 'Crawling inteligente falhou', 
      details: error.message 
    });
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Web Scraper Server v2.0 Enhanced running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`🔧 Enhanced scrape: POST http://localhost:${PORT}/webscrape`);
  console.log(`🧠 Intelligent crawl: POST http://localhost:${PORT}/webscrape-intelligent`);
  console.log(`✨ NEW Features:`);
  console.log(`   - Semantic content extraction`);
  console.log(`   - 11 metadata fields (vs 3 before)`);
  console.log(`   - Content scoring algorithm`);
  console.log(`   - Intelligent sitemap crawling`);
  console.log(`📊 Metadata fields: title, description, author, keywords, publishDate,`);
  console.log(`    language, wordCount, readingTime, contentType, openGraph, lastModified, canonicalUrl`);
});