// JavaScript Rendering Diagnostic Tool
// Detecta se um site usa client-side rendering que o Cheerio não consegue processar

const cheerio = require('cheerio');
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
 * Detecta se um site provavelmente usa JavaScript client-side rendering
 * @param {string} html - HTML bruto da página
 * @param {Object} $ - Instância do Cheerio
 * @param {string} url - URL da página (para contexto)
 * @returns {Object} Análise detalhada do JavaScript rendering
 */
function detectJavaScriptRendering(html, $, url) {
  const analysis = {
    url: url,
    likelyJavaScriptRendered: false,
    confidence: 0,
    indicators: [],
    stats: {
      staticContentLength: 0,
      scriptTags: 0,
      reactIndicators: 0,
      vueIndicators: 0,
      frameworkIndicators: 0,
      loadingIndicators: 0,
      emptyContainers: 0
    },
    recommendations: []
  };

  // 1. Análise de conteúdo estático
  const bodyText = $('body').text().trim();
  const staticContentLength = bodyText.length;
  analysis.stats.staticContentLength = staticContentLength;

  // 2. Contagem de script tags
  const scriptTags = $('script').length;
  analysis.stats.scriptTags = scriptTags;

  // 3. Detectar indicadores de frameworks JavaScript
  const reactIndicators = $('[data-reactroot], #root, #app, [data-react-app]').length;
  const vueIndicators = $('[data-v-], [v-], #app[data-v-app]').length;
  const angularIndicators = $('[ng-app], [data-ng-app], app-root').length;
  
  analysis.stats.reactIndicators = reactIndicators;
  analysis.stats.vueIndicators = vueIndicators;
  analysis.stats.frameworkIndicators = reactIndicators + vueIndicators + angularIndicators;

  // 4. Detectar elementos de loading/placeholder
  const loadingIndicators = $('.loading, .spinner, .skeleton, [data-loading]').length;
  const loadingTexts = bodyText.match(/loading|carregando|cargando/gi)?.length || 0;
  analysis.stats.loadingIndicators = loadingIndicators + loadingTexts;

  // 5. Detectar containers vazios que deveriam ter conteúdo
  const mainContainers = $('main, #main, .main, #content, .content, .container');
  let emptyContainers = 0;
  mainContainers.each((i, el) => {
    const text = $(el).text().trim();
    if (text.length < 50) emptyContainers++;
  });
  analysis.stats.emptyContainers = emptyContainers;

  // 6. Análise de indicadores específicos no HTML
  const htmlSource = html.toLowerCase();
  const jsFrameworkKeywords = [
    'react', 'vue', 'angular', 'next.js', 'nuxt', 'gatsby',
    'create-react-app', 'webpack', 'vite', 'parcel'
  ];
  
  let frameworkMentions = 0;
  jsFrameworkKeywords.forEach(keyword => {
    if (htmlSource.includes(keyword)) {
      frameworkMentions++;
      analysis.indicators.push(`Framework mencionado: ${keyword}`);
    }
  });

  // 7. SCORING ALGORITHM - Determinar probabilidade de JavaScript rendering
  let score = 0;

  // Critério 1: Muito pouco conteúdo estático (forte indicador)
  if (staticContentLength < 500) {
    score += 40;
    analysis.indicators.push(`Conteúdo estático muito baixo: ${staticContentLength} chars`);
  } else if (staticContentLength < 1500) {
    score += 20;
    analysis.indicators.push(`Conteúdo estático baixo: ${staticContentLength} chars`);
  }

  // Critério 2: Muitas tags script (indicador médio)
  if (scriptTags > 10) {
    score += 25;
    analysis.indicators.push(`Muitas tags script: ${scriptTags}`);
  } else if (scriptTags > 5) {
    score += 15;
    analysis.indicators.push(`Tags script moderadas: ${scriptTags}`);
  }

  // Critério 3: Indicadores de frameworks (forte indicador)
  if (analysis.stats.frameworkIndicators > 0) {
    score += 30;
    analysis.indicators.push(`Indicadores de framework JS: ${analysis.stats.frameworkIndicators}`);
  }

  // Critério 4: Containers vazios (forte indicador)
  if (emptyContainers > 0) {
    score += 25;
    analysis.indicators.push(`Containers principais vazios: ${emptyContainers}`);
  }

  // Critério 5: Indicadores de loading (médio indicador)
  if (analysis.stats.loadingIndicators > 0) {
    score += 15;
    analysis.indicators.push(`Indicadores de loading: ${analysis.stats.loadingIndicators}`);
  }

  // Critério 6: Frameworks mencionados no HTML
  if (frameworkMentions > 0) {
    score += frameworkMentions * 10;
  }

  // Critério 7: Padrões específicos de SPA
  if (htmlSource.includes('single page app') || htmlSource.includes('spa')) {
    score += 20;
    analysis.indicators.push('Menção explícita a SPA');
  }

  // 8. Definir confiança e recomendações
  analysis.confidence = Math.min(score, 100);

  if (score >= 70) {
    analysis.likelyJavaScriptRendered = true;
    analysis.recommendations.push('🚨 ALTA probabilidade de JavaScript rendering - Usar Puppeteer/JSDOM');
    analysis.recommendations.push('Cheerio provavelmente não consegue extrair conteúdo principal');
  } else if (score >= 40) {
    analysis.likelyJavaScriptRendered = true;
    analysis.recommendations.push('⚠️ MÉDIA probabilidade de JavaScript rendering - Testar fallback');
    analysis.recommendations.push('Monitorar qualidade do conteúdo extraído');
  } else {
    analysis.likelyJavaScriptRendered = false;
    analysis.recommendations.push('✅ BAIXA probabilidade de JavaScript rendering - Cheerio deve funcionar');
    analysis.recommendations.push('Site provavelmente usa server-side rendering tradicional');
  }

  return analysis;
}

/**
 * Testa um site específico e fornece diagnóstico completo
 * @param {string} url - URL para testar
 * @returns {Object} Análise completa do site
 */
async function diagnoseSite(url) {
  try {
    console.log(`\n🔍 Analisando: ${url}`);
    
    const response = await axios.get(url, {
      headers: browserHeaders,
      timeout: 10000,
      maxRedirects: 5
    });

    const $ = cheerio.load(response.data);
    
    // Extração básica (método atual)
    let content = '';
    const contentSelectors = [
      'main', 'article', '[role="main"]', '.content', 
      '.main-content', '#content', '.post-content', 
      '.entry-content', 'body'
    ];

    for (const selector of contentSelectors) {
      const element = $(selector);
      if (element.length > 0 && element.text().trim().length > 100) {
        content = element.text().trim();
        break;
      }
    }

    if (!content) {
      content = $('body').text().trim();
    }

    // Diagnóstico JavaScript
    const jsAnalysis = detectJavaScriptRendering(response.data, $, url);
    
    // Resultado consolidado
    const result = {
      url: url,
      extractedContentLength: content.length,
      extractedPreview: content.substring(0, 200) + (content.length > 200 ? '...' : ''),
      javascriptAnalysis: jsAnalysis,
      timestamp: new Date().toISOString()
    };

    // Log resultados
    console.log(`📊 Conteúdo extraído: ${result.extractedContentLength} caracteres`);
    console.log(`🎯 Confiança JS Rendering: ${jsAnalysis.confidence}%`);
    console.log(`📋 Indicadores encontrados: ${jsAnalysis.indicators.length}`);
    
    jsAnalysis.recommendations.forEach(rec => console.log(`   ${rec}`));

    return result;

  } catch (error) {
    console.error(`❌ Erro ao analisar ${url}: ${error.message}`);
    return {
      url: url,
      error: error.message,
      extractedContentLength: 0,
      javascriptAnalysis: {
        likelyJavaScriptRendered: false,
        confidence: 0,
        indicators: [`Erro na requisição: ${error.message}`]
      }
    };
  }
}

/**
 * Executa diagnóstico em batch para múltiplos sites
 * @param {Array} urls - Lista de URLs para testar
 * @returns {Array} Resultados de todos os testes
 */
async function batchDiagnosis(urls) {
  console.log(`🚀 Iniciando diagnóstico em lote de ${urls.length} sites...\n`);
  
  const results = [];
  
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const result = await diagnoseSite(url);
    results.push(result);
    
    // Rate limiting entre requests
    if (i < urls.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // Sumário final
  console.log('\n📈 SUMÁRIO DO DIAGNÓSTICO:');
  console.log('='.repeat(50));
  
  const jsRenderingSites = results.filter(r => r.javascriptAnalysis?.likelyJavaScriptRendered);
  const lowContentSites = results.filter(r => r.extractedContentLength < 1000);
  
  console.log(`Sites com JavaScript Rendering: ${jsRenderingSites.length}/${results.length}`);
  console.log(`Sites com baixo conteúdo extraído: ${lowContentSites.length}/${results.length}`);
  
  if (jsRenderingSites.length > 0) {
    console.log('\n🚨 Sites que PRECISAM de JavaScript rendering:');
    jsRenderingSites.forEach(site => {
      console.log(`   ${site.url} (${site.javascriptAnalysis.confidence}% confiança, ${site.extractedContentLength} chars)`);
    });
  }
  
  return results;
}

// Lista de sites para teste
const testUrls = [
  'https://docs.targetteal.com/',
  'https://docs.anthropic.com/claude',
  'https://react.dev/learn',
  'https://vuejs.org/guide/',
  'https://nextjs.org/docs'
];

// Exportar funções para uso
module.exports = {
  detectJavaScriptRendering,
  diagnoseSite,
  batchDiagnosis,
  testUrls
};

// Para executar diagnóstico direto (se chamado diretamente)
if (require.main === module) {
  batchDiagnosis(testUrls)
    .then(results => {
      console.log('\n✅ Diagnóstico concluído!');
      console.log('Use os resultados para decidir a estratégia de implementação.');
    })
    .catch(error => {
      console.error('❌ Erro no diagnóstico:', error);
    });
}
