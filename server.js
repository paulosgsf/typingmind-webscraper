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

// Função para limpar texto extraído
function cleanText(text) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, '\n')
    .trim();
}

// Endpoint principal de web scraping
app.post('/webscrape', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ 
        error: 'URL é obrigatória',
        usage: 'POST /webscrape com { "url": "https://exemplo.com" }'
      });
    }

    // Validar URL
    let targetUrl;
    try {
      targetUrl = new URL(url);
    } catch (err) {
      return res.status(400).json({ error: 'URL inválida' });
    }

    console.log(`Scraping: ${url}`);

    // Fazer requisição HTTP
    const response = await axios.get(url, {
      headers: browserHeaders,
      timeout: 10000,
      maxRedirects: 5
    });

    // Carregar HTML no Cheerio
    const $ = cheerio.load(response.data);

    // Remover elementos desnecessários
    $('script, style, nav, header, footer, .ad, .advertisement, #ads').remove();

    // Extrair conteúdo principal
    let content = '';
    
    // Tentar diferentes seletores comuns para conteúdo principal
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

    // Fallback: pegar todo o texto do body se nenhum seletor funcionou
    if (!content) {
      content = $('body').text();
    }

    // Limpar e processar texto
    const cleanedContent = cleanText(content);
    
    // Extrair metadados úteis
    const title = $('title').text().trim() || '';
    const description = $('meta[name="description"]').attr('content') || '';

    // Resposta estruturada
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

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'TypingMind Web Scraper',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Web Scraper Server running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`🔧 Scrape endpoint: POST http://localhost:${PORT}/webscrape`);
});
