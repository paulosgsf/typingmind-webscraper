const express = require('express');
const cheerio = require('cheerio');
const axios = require('axios');
const cors = require('cors');

// Importar o novo smart scraper
const { smartScrape, scrapeSinglePage } = require('./smart_scraper');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Headers para simular browser real (mantido para compatibilidade)
const browserHeaders = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate',
  'DNT': '1',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1'
};

// Função para limpar texto extraído (mantida para compatibilidade)
function cleanText(text) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, '\n')
    .trim();
}

// === ENDPOINT ORIGINAL MANTIDO (Zero Risco) ===
app.post('/webscrape', async (req, res) => {
  try {
    let { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ 
        error: 'URL é obrigatória',
        usage: 'POST /webscrape com { "url": "https://exemplo.com" }'
      });
    }

    // Limpar URL (mantido exatamente como estava)
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

    console.log(`Scraping: ${url}`);

    // Fazer requisição HTTP (método original)
    const response = await axios.get(url, {
      headers: browserHeaders,
      timeout: 10000,
      maxRedirects: 5
    });

    // Carregar HTML no Cheerio (método original)
    const $ = cheerio.load(response.data);

    // Remover elementos desnecessários (método original)
    $('script, style, nav, header, footer, .ad, .advertisement, #ads').remove();

    // Extrair conteúdo principal (método original)
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
      'body'
    ];

    for (const selector of contentSelectors) {
      const element = $(selector);
      if (element.length > 0 && element.text().trim().length > 100) {
        content = element.text();
        break;
      }
    }

    if (!content) {
      content = $('body').text();
    }

    // Limpar e processar texto (método original)
    const cleanedContent = cleanText(content);
    
    // Extrair metadados úteis (método original)
    const title = $('title').text().trim() || '';
    const description = $('meta[name="description"]').attr('content') || '';

    // Resposta estruturada (método original)
    const result = {
      url: url,
      title: title,
      description: description,
      content: cleanedContent,
      length: cleanedContent.length,
      scraped_at: new Date().toISOString()
    };

    console.log(`✅ Scraped ${url} - ${result.length} chars`);
    res.json(result);

  } catch (error) {
    console.error('❌ Scraping error:', error.message);
    
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

// === NOVOS ENDPOINTS: OTIMIZAÇÃO DE TOKENS ===

// Endpoint para scraping com otimização automática de tokens
app.post('/webscrape-ai-optimized', async (req, res) => {
  try {
    let { url, optimize = true, include_chunks = true, include_keywords = true } = req.body;
    
    if (!url) {
      return res.status(400).json({ 
        error: 'URL é obrigatória',
        usage: 'POST /webscrape-ai-optimized com { "url": "https://exemplo.com" }'
      });
    }

    // Limpar URL
    url = url.toString().trim();
    if (url.startsWith('{') && url.endsWith('}')) {
      url = url.slice(1, -1);
    }

    // Validar URL
    try {
      new URL(url);
    } catch (err) {
      return res.status(400).json({ error: 'URL inválida' });
    }

    console.log(`🧠 AI-optimized scraping: ${url}`);

    const result = await smartScrapeOptimized(url, {
      optimize,
      includeChunks: include_chunks,
      includeKeywords: include_keywords
    });

    res.json(result);

  } catch (error) {
    console.error('❌ AI-optimized scraping error:', error.message);
    
    if (error.code === 'ENOTFOUND') {
      return res.status(400).json({ error: 'URL não encontrada ou inacessível' });
    }
    
    if (error.code === 'ECONNABORTED') {
      return res.status(408).json({ error: 'Timeout - site muito lento' });
    }

    res.status(500).json({ 
      error: 'Erro no scraping otimizado para IA',
      message: error.message 
    });
  }
});

// Endpoint para comparação de métodos de otimização
app.post('/webscrape-optimization-comparison', async (req, res) => {
  try {
    let { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ 
        error: 'URL é obrigatória',
        usage: 'POST /webscrape-optimization-comparison com { "url": "https://exemplo.com" }'
      });
    }

    // Limpar URL
    url = url.toString().trim();
    if (url.startsWith('{') && url.endsWith('}')) {
      url = url.slice(1, -1);
    }

    // Validar URL
    try {
      new URL(url);
    } catch (err) {
      return res.status(400).json({ error: 'URL inválida' });
    }

    console.log(`🔬 Comparing optimization methods for: ${url}`);

    const result = await compareOptimizationMethods(url);
    res.json(result);

  } catch (error) {
    console.error('❌ Optimization comparison error:', error.message);
    
    if (error.code === 'ENOTFOUND') {
      return res.status(400).json({ error: 'URL não encontrada ou inacessível' });
    }
    
    if (error.code === 'ECONNABORTED') {
      return res.status(408).json({ error: 'Timeout - site muito lento' });
    }

    res.status(500).json({ 
      error: 'Erro na comparação de otimização',
      message: error.message 
    });
  }
});

// === NOVO ENDPOINT SMART (JavaScript + Cheerio Híbrido) ===
app.post('/webscrape-smart', async (req, res) => {
  try {
    let { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ 
        error: 'URL é obrigatória',
        usage: 'POST /webscrape-smart com { "url": "https://exemplo.com" }'
      });
    }

    // Limpar URL (mesmo método)
    url = url.toString().trim();
    if (url.startsWith('{') && url.endsWith('}')) {
      url = url.slice(1, -1);
      console.log('Cleaned URL from:', req.body.url, 'to:', url);
    }

    // Validar URL
    try {
      new URL(url);
    } catch (err) {
      return res.status(400).json({ error: 'URL inválida' });
    }

    console.log(`🧠 Smart scraping: ${url}`);

    // Usar o novo smart scraper
    const result = await smartScrape(url);
    
    // Log melhorado
    console.log(`✅ Smart scraped ${url} - ${result.length} chars via ${result.method} (${result.processingTime}ms)`);
    
    // Resposta com informações adicionais
    const response = {
      url: result.url,
      title: result.title,
      description: result.description,
      content: result.content,
      length: result.length,
      method: result.method,
      processing_time_ms: result.processingTime,
      scraped_at: result.scraped_at
    };

    // Adicionar métricas de comparação se disponível
    if (result.cheerioLength && result.jsdomLength) {
      response.method_comparison = {
        cheerio_length: result.cheerioLength,
        jsdom_length: result.jsdomLength,
        improvement_percent: ((result.jsdomLength - result.cheerioLength) / result.cheerioLength * 100).toFixed(1)
      };
    }

    res.json(response);

  } catch (error) {
    console.error('❌ Smart scraping error:', error.message);
    
    if (error.code === 'ENOTFOUND') {
      return res.status(400).json({ error: 'URL não encontrada ou inacessível' });
    }
    
    if (error.code === 'ECONNABORTED') {
      return res.status(408).json({ error: 'Timeout - site muito lento' });
    }

    res.status(500).json({ 
      error: 'Erro no smart scraping',
      message: error.message 
    });
  }
});

// Health check (mantido original)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'TypingMind Web Scraper Enhanced',
    version: '3.0.0',
    endpoints: {
      '/webscrape': 'Original Cheerio-only scraping',
      '/webscrape-smart': 'Smart hybrid Cheerio + JSDOM scraping',
      '/webscrape-intelligent': 'Intelligent sitemap crawling',
      '/webscrape-ai-optimized': 'AI-optimized scraping with token compression',
      '/webscrape-optimization-comparison': 'Compare standard vs optimized methods'
    },
    timestamp: new Date().toISOString()
  });
});

// === ENDPOINT INTELIGENTE MANTIDO (Zero Risco) ===
const { intelligentCrawl } = require('./sitemap_crawler');

// === NOVOS ENDPOINTS: OTIMIZAÇÃO DE TOKENS ===
const { smartScrapeOptimized, compareOptimizationMethods } = require('./smart_scraper_optimized');

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

// === NOVO ENDPOINT: COMPARAÇÃO DE MÉTODOS ===
app.post('/webscrape-compare', async (req, res) => {
  try {
    let { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ 
        error: 'URL é obrigatória',
        usage: 'POST /webscrape-compare com { "url": "https://exemplo.com" }'
      });
    }

    // Limpar URL
    url = url.toString().trim();
    if (url.startsWith('{') && url.endsWith('}')) {
      url = url.slice(1, -1);
    }

    console.log(`🔬 Comparing methods for: ${url}`);

    // Executar ambos os métodos
    const [originalResult, smartResult] = await Promise.all([
      // Método original (simulado via requisição interna)
      axios.post(`http://localhost:${PORT}/webscrape`, { url }).then(r => r.data).catch(e => ({ error: e.message })),
      // Método smart
      smartScrape(url).catch(e => ({ error: e.message }))
    ]);

    const comparison = {
      url: url,
      original_method: {
        content_length: originalResult.length || 0,
        method: 'cheerio',
        success: !originalResult.error,
        error: originalResult.error
      },
      smart_method: {
        content_length: smartResult.length || 0,
        method: smartResult.method || 'error',
        processing_time: smartResult.processingTime || 0,
        success: smartResult.success || false,
        error: smartResult.error
      },
      analysis: {}
    };

    // Análise da melhoria
    if (comparison.original_method.success && comparison.smart_method.success) {
      const originalLength = comparison.original_method.content_length;
      const smartLength = comparison.smart_method.content_length;
      
      comparison.analysis = {
        improvement_absolute: smartLength - originalLength,
        improvement_percent: originalLength > 0 ? ((smartLength - originalLength) / originalLength * 100).toFixed(1) : 'N/A',
        recommendation: smartLength > originalLength * 1.5 ? 'Use smart method' : 'Original method sufficient'
      };
    }

    res.json(comparison);

  } catch (error) {
    console.error('❌ Comparison error:', error.message);
    res.status(500).json({ 
      error: 'Erro na comparação',
      message: error.message 
    });
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Enhanced Web Scraper Server running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`🔧 Original endpoint: POST http://localhost:${PORT}/webscrape`);
  console.log(`🧠 Smart endpoint: POST http://localhost:${PORT}/webscrape-smart`);
  console.log(`🎯 Intelligent crawl: POST http://localhost:${PORT}/webscrape-intelligent`);
  console.log(`🔬 Method comparison: POST http://localhost:${PORT}/webscrape-compare`);
  console.log(`🤖 AI-optimized scraping: POST http://localhost:${PORT}/webscrape-ai-optimized`);
  console.log(`⚖️ Optimization comparison: POST http://localhost:${PORT}/webscrape-optimization-comparison`);
});