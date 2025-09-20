// Smart Hybrid Scraper - Cheerio + JSDOM Fallback
// Detecta automaticamente quando usar JavaScript rendering

const cheerio = require('cheerio');
const { JSDOM } = require('jsdom');
const axios = require('axios');

// Headers profissionais para simular browser real
const browserHeaders = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate',
  'DNT': '1',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1'
};

/**
 * Detecta se um resultado do Cheerio indica necessidade de JavaScript rendering
 * @param {Object} cheerioResult - Resultado da extração com Cheerio
 * @param {string} html - HTML bruto da página
 * @returns {boolean} True se precisa de JavaScript rendering
 */
function needsJavaScriptRendering(cheerioResult, html) {
  const $ = cheerio.load(html);
  
  // Critério 1: Conteúdo muito baixo
  if (cheerioResult.content.length < 800) {
    return true;
  }
  
  // Critério 2: Indicadores de frameworks JavaScript
  const frameworkIndicators = $('[data-reactroot], #root, #app, [data-v-], [ng-app], app-root').length;
  if (frameworkIndicators > 0) {
    return true;
  }
  
  // Critério 3: Muitas tags script (mais de 8)
  const scriptTags = $('script').length;
  if (scriptTags > 8) {
    return true;
  }
  
  // Critério 4: Containers principais vazios
  const mainContainers = $('main, #main, .main, #content, .content');
  let emptyContainers = 0;
  mainContainers.each((i, el) => {
    const text = $(el).text().trim();
    if (text.length < 100) emptyContainers++;
  });
  
  if (emptyContainers > 0 && mainContainers.length > 0) {
    return true;
  }
  
  return false;
}

/**
 * Função de limpeza de texto melhorada
 * @param {string} text - Texto para limpar
 * @returns {string} Texto limpo
 */
function cleanText(text) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, '\n')
    .replace(/\t+/g, ' ')
    .trim();
}

/**
 * Extração semântica de conteúdo usando Cheerio
 * @param {Object} $ - Instância do Cheerio
 * @returns {Object} Resultado da extração
 */
function extractWithCheerio($) {
  // Remove elementos desnecessários
  $('script, style, nav, header, footer, .ad, .advertisement, #ads, .cookie-banner, .gdpr-banner').remove();

  let content = '';
  let title = $('title').text().trim() || '';
  let description = $('meta[name="description"]').attr('content') || '';
  
  // Seletores em ordem de prioridade semântica
  const contentSelectors = [
    'main article',
    'article', 
    'main',
    '[role="main"]',
    '.post-content',
    '.entry-content',
    '.article-content', 
    '.content',
    '.main-content',
    '#content',
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

  // Fallback: pegar todo o texto do body
  if (!content) {
    content = $('body').text();
  }

  return {
    title,
    description,
    content: cleanText(content),
    method: 'cheerio'
  };
}

/**
 * Extração usando JSDOM (para sites que precisam de JavaScript)
 * @param {string} html - HTML da página
 * @param {string} url - URL da página
 * @returns {Promise<Object>} Resultado da extração
 */
async function extractWithJSDOM(html, url) {
  return new Promise((resolve, reject) => {
    try {
      console.log('🔄 Switching to JSDOM for JavaScript content...');
      
      // Configuração do JSDOM
      const dom = new JSDOM(html, {
        url: url,
        referrer: url,
        contentType: "text/html",
        includeNodeLocations: true,
        storageQuota: 10000000,
        resources: "usable",
        runScripts: "dangerously",
        beforeParse(window) {
          // Aguardar carregamento da página
          window.addEventListener('load', () => {
            setTimeout(() => {
              extractFromJSDOM(window, resolve);
            }, 2000); // Aguarda 2s para JavaScript executar
          });
        }
      });

      // Fallback se 'load' não disparar em 8 segundos
      setTimeout(() => {
        console.log('⏰ JSDOM timeout, extracting available content...');
        extractFromJSDOM(dom.window, resolve);
      }, 8000);

    } catch (error) {
      console.error('❌ JSDOM error:', error.message);
      reject(error);
    }
  });
}

/**
 * Extrai conteúdo da instância JSDOM
 * @param {Object} window - Window object do JSDOM
 * @param {Function} resolve - Função de resolve da Promise
 */
function extractFromJSDOM(window, resolve) {
  try {
    const document = window.document;
    
    // Remove elementos desnecessários
    const elementsToRemove = document.querySelectorAll('script, style, nav, header, footer, .ad, .advertisement, #ads, .cookie-banner, .gdpr-banner');
    elementsToRemove.forEach(el => el.remove());

    let content = '';
    let title = document.querySelector('title')?.textContent?.trim() || '';
    let description = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
    
    // Seletores semânticos para JSDOM
    const contentSelectors = [
      'main article',
      'article', 
      'main',
      '[role="main"]',
      '.post-content',
      '.entry-content',
      '.article-content', 
      '.content',
      '.main-content',
      '#content',
      '.docs-content',
      '.documentation',
      '.markdown-body'
    ];

    for (const selector of contentSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim().length > 100) {
        content = element.textContent;
        break;
      }
    }

    // Fallback: body completo
    if (!content) {
      content = document.body?.textContent || '';
    }

    // Fechar JSDOM para liberar memória
    window.close();

    resolve({
      title,
      description,
      content: cleanText(content),
      method: 'jsdom'
    });

  } catch (error) {
    console.error('❌ Error extracting from JSDOM:', error.message);
    resolve({
      title: '',
      description: '',
      content: '',
      method: 'jsdom',
      error: error.message
    });
  }
}

/**
 * Função principal de scraping inteligente
 * @param {string} url - URL para scraping
 * @returns {Promise<Object>} Resultado completo do scraping
 */
async function smartScrape(url) {
  const startTime = Date.now();
  
  try {
    console.log(`🔍 Smart scraping: ${url}`);
    
    // 1. Fazer requisição HTTP
    const response = await axios.get(url, {
      headers: browserHeaders,
      timeout: 10000,
      maxRedirects: 5
    });

    const html = response.data;
    const $ = cheerio.load(html);

    // 2. Tentar extração com Cheerio primeiro (rápido)
    const cheerioResult = extractWithCheerio($);
    
    console.log(`📊 Cheerio extracted: ${cheerioResult.content.length} chars`);

    // 3. Verificar se precisa de JavaScript rendering
    const needsJS = needsJavaScriptRendering(cheerioResult, html);
    
    if (!needsJS) {
      console.log('✅ Cheerio result sufficient, no JavaScript needed');
      
      return {
        url: url,
        title: cheerioResult.title,
        description: cheerioResult.description,
        content: cheerioResult.content,
        length: cheerioResult.content.length,
        method: 'cheerio',
        processingTime: Date.now() - startTime,
        success: true,
        scraped_at: new Date().toISOString()
      };
    }

    // 4. Fallback para JSDOM
    console.log('🔄 Cheerio insufficient, switching to JSDOM...');
    
    const jsdomResult = await extractWithJSDOM(html, url);
    
    console.log(`📊 JSDOM extracted: ${jsdomResult.content.length} chars`);

    // 5. Comparar resultados e escolher o melhor
    const finalResult = jsdomResult.content.length > cheerioResult.content.length ? jsdomResult : cheerioResult;
    
    console.log(`✅ Using ${finalResult.method} result (${finalResult.content.length} chars)`);

    return {
      url: url,
      title: finalResult.title,
      description: finalResult.description,
      content: finalResult.content,
      length: finalResult.content.length,
      method: finalResult.method,
      cheerioLength: cheerioResult.content.length,
      jsdomLength: jsdomResult.content.length,
      processingTime: Date.now() - startTime,
      success: true,
      scraped_at: new Date().toISOString()
    };

  } catch (error) {
    console.error(`❌ Smart scraping failed for ${url}:`, error.message);
    
    return {
      url: url,
      title: '',
      description: '',
      content: '',
      length: 0,
      method: 'error',
      processingTime: Date.now() - startTime,
      success: false,
      error: error.message,
      scraped_at: new Date().toISOString()
    };
  }
}

/**
 * Função legada compatível com código existente
 * @param {string} url - URL para scraping
 * @returns {Promise<Object>} Resultado no formato original
 */
async function scrapeSinglePage(url) {
  const result = await smartScrape(url);
  
  // Formato compatível com código existente
  return {
    url: result.url,
    title: result.title,
    description: result.description,
    content: result.content,
    length: result.length,
    success: result.success,
    error: result.error,
    scraped_at: result.scraped_at
  };
}

/**
 * Teste rápido da funcionalidade
 */
async function testSmartScraper() {
  const testUrls = [
    'https://docs.targetteal.com/',
    'https://react.dev/learn',
    'https://example.com' // Site simples para comparação
  ];

  console.log('🧪 Testing Smart Scraper...\n');

  for (const url of testUrls) {
    try {
      const result = await smartScrape(url);
      console.log(`\n📊 Results for ${url}:`);
      console.log(`   Method: ${result.method}`);
      console.log(`   Content: ${result.length} chars`);
      console.log(`   Time: ${result.processingTime}ms`);
      console.log(`   Success: ${result.success}`);
      
      if (result.method === 'jsdom' && result.cheerioLength) {
        const improvement = ((result.length - result.cheerioLength) / result.cheerioLength * 100).toFixed(1);
        console.log(`   Improvement: +${improvement}% vs Cheerio`);
      }
      
    } catch (error) {
      console.error(`❌ Test failed for ${url}: ${error.message}`);
    }
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n✅ Smart Scraper testing completed!');
}

module.exports = {
  smartScrape,
  scrapeSinglePage,
  needsJavaScriptRendering,
  extractWithCheerio,
  extractWithJSDOM,
  testSmartScraper
};

// Para teste direto
if (require.main === module) {
  testSmartScraper().catch(console.error);
}
