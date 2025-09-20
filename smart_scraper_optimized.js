// Smart Scraper with AI Token Optimization
// Combina extração híbrida + otimização de tokens

const { smartScrape } = require('./smart_scraper');
const { AITokenOptimizer } = require('./token_optimizer');

/**
 * Scraping inteligente com otimização automática para IA
 * @param {string} url - URL para scraping
 * @param {Object} options - Opções de otimização
 * @returns {Promise<Object>} Resultado completo otimizado
 */
async function smartScrapeOptimized(url, options = {}) {
  const {
    optimize = true,
    includeChunks = true,
    includeKeywords = true,
    includeComparison = true
  } = options;
  
  const startTime = Date.now();
  
  try {
    console.log(`🧠 Smart scraping with AI optimization: ${url}`);
    
    // 1. Fazer scraping inteligente primeiro
    const scrapedData = await smartScrape(url);
    
    if (!scrapedData.success) {
      return {
        ...scrapedData,
        optimization_applied: false,
        total_processing_time: Date.now() - startTime
      };
    }
    
    // 2. Aplicar otimização se solicitada
    if (!optimize) {
      return {
        ...scrapedData,
        optimization_applied: false,
        total_processing_time: Date.now() - startTime
      };
    }
    
    console.log('🔧 Applying AI token optimization...');
    
    // 3. Inicializar otimizador
    const optimizer = new AITokenOptimizer();
    
    // 4. Otimizar conteúdo
    const optimizationResult = optimizer.optimizeForAI({
      title: scrapedData.title,
      description: scrapedData.description,
      content: scrapedData.content,
      method: scrapedData.method
    });
    
    // 5. Construir resposta completa
    const result = {
      url: url,
      success: true,
      scraping: {
        title: scrapedData.title,
        description: scrapedData.description,
        content: scrapedData.content,
        length: scrapedData.length,
        method: scrapedData.method,
        processing_time: scrapedData.processingTime
      },
      optimized: {
        title: optimizationResult.optimized.title,
        description: optimizationResult.optimized.description,
        content: optimizationResult.optimized.content,
        length: optimizationResult.optimized.length,
        method: optimizationResult.optimized.method
      },
      optimization_stats: optimizationResult.optimization_stats,
      total_processing_time: Date.now() - startTime,
      scraped_at: new Date().toISOString()
    };
    
    // 6. Adicionar elementos opcionais
    if (includeKeywords && optimizationResult.optimized.keywords) {
      result.keywords = optimizationResult.optimized.keywords;
    }
    
    if (includeChunks && optimizationResult.optimized.chunks) {
      result.chunks = optimizationResult.optimized.chunks;
      result.chunks_count = result.chunks.length;
    }
    
    if (includeComparison && scrapedData.cheerioLength && scrapedData.jsdomLength) {
      result.method_comparison = {
        cheerio_length: scrapedData.cheerioLength,
        jsdom_length: scrapedData.jsdomLength,
        selected_method: scrapedData.method
      };
    }
    
    // 7. Log resultados
    const compressionRatio = optimizationResult.optimization_stats.compression_ratio;
    console.log(`✅ Optimized scraping completed:`);
    console.log(`   Original: ${result.scraping.length} chars`);
    console.log(`   Optimized: ${result.optimized.length} chars`);
    console.log(`   Compression: ${compressionRatio}`);
    console.log(`   Keywords: ${result.keywords?.length || 0}`);
    console.log(`   Chunks: ${result.chunks_count || 0}`);
    console.log(`   Total time: ${result.total_processing_time}ms`);
    
    return result;
    
  } catch (error) {
    console.error(`❌ Optimized scraping failed for ${url}:`, error.message);
    
    return {
      url: url,
      success: false,
      error: error.message,
      optimization_applied: false,
      total_processing_time: Date.now() - startTime,
      scraped_at: new Date().toISOString()
    };
  }
}

/**
 * Compara métodos de scraping com e sem otimização
 * @param {string} url - URL para teste
 * @returns {Promise<Object>} Comparação detalhada
 */
async function compareOptimizationMethods(url) {
  const startTime = Date.now();
  
  try {
    console.log(`🔬 Comparing optimization methods for: ${url}`);
    
    // Executar ambos os métodos em paralelo
    const [standardResult, optimizedResult] = await Promise.all([
      smartScrape(url).catch(e => ({ error: e.message, success: false })),
      smartScrapeOptimized(url, { includeChunks: false, includeComparison: false }).catch(e => ({ error: e.message, success: false }))
    ]);
    
    const comparison = {
      url: url,
      standard_method: {
        success: standardResult.success,
        content_length: standardResult.length || 0,
        method: standardResult.method || 'error',
        processing_time: standardResult.processingTime || 0,
        error: standardResult.error
      },
      optimized_method: {
        success: optimizedResult.success,
        original_length: optimizedResult.scraping?.length || 0,
        optimized_length: optimizedResult.optimized?.length || 0,
        compression_ratio: optimizedResult.optimization_stats?.compression_ratio || '0%',
        tokens_saved: optimizedResult.optimization_stats?.tokens_saved || 0,
        keywords_found: optimizedResult.keywords?.length || 0,
        processing_time: optimizedResult.total_processing_time || 0,
        error: optimizedResult.error
      },
      analysis: {},
      compared_at: new Date().toISOString(),
      comparison_time: Date.now() - startTime
    };
    
    // Análise comparativa
    if (comparison.standard_method.success && comparison.optimized_method.success) {
      const standardLength = comparison.standard_method.content_length;
      const optimizedLength = comparison.optimized_method.optimized_length;
      
      comparison.analysis = {
        content_quality: standardLength > 1000 ? 'good' : 'limited',
        optimization_effectiveness: optimizedLength < standardLength ? 'effective' : 'minimal',
        token_efficiency: `${comparison.optimized_method.tokens_saved} tokens saved`,
        recommendation: optimizedLength < standardLength * 0.8 ? 
          'Use optimized method for AI consumption' : 
          'Standard method sufficient'
      };
    } else {
      comparison.analysis = {
        status: 'One or both methods failed',
        recommendation: 'Check error details and retry'
      };
    }
    
    return comparison;
    
  } catch (error) {
    console.error('❌ Comparison failed:', error.message);
    
    return {
      url: url,
      error: error.message,
      comparison_time: Date.now() - startTime,
      compared_at: new Date().toISOString()
    };
  }
}

/**
 * Batch testing de otimização em múltiplas URLs
 * @param {Array} urls - Lista de URLs para teste
 * @param {Object} options - Opções de teste
 * @returns {Promise<Object>} Resultados consolidados
 */
async function batchOptimizationTest(urls, options = {}) {
  const { 
    delayMs = 2000,
    includeComparisons = true 
  } = options;
  
  console.log(`🧪 Starting batch optimization test for ${urls.length} URLs...`);
  
  const results = [];
  const stats = {
    total_urls: urls.length,
    successful: 0,
    failed: 0,
    total_tokens_saved: 0,
    average_compression: 0,
    total_keywords: 0
  };
  
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    
    try {
      console.log(`\n📊 Testing ${i + 1}/${urls.length}: ${url}`);
      
      const result = includeComparisons ? 
        await compareOptimizationMethods(url) :
        await smartScrapeOptimized(url);
      
      results.push(result);
      
      // Atualizar estatísticas
      if (result.success || result.optimized_method?.success) {
        stats.successful++;
        
        if (result.optimization_stats) {
          stats.total_tokens_saved += result.optimization_stats.tokens_saved || 0;
        } else if (result.optimized_method) {
          stats.total_tokens_saved += result.optimized_method.tokens_saved || 0;
        }
        
        if (result.keywords) {
          stats.total_keywords += result.keywords.length;
        } else if (result.optimized_method) {
          stats.total_keywords += result.optimized_method.keywords_found || 0;
        }
      } else {
        stats.failed++;
      }
      
    } catch (error) {
      console.error(`❌ Failed to test ${url}: ${error.message}`);
      results.push({
        url: url,
        success: false,
        error: error.message
      });
      stats.failed++;
    }
    
    // Rate limiting
    if (i < urls.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  // Calcular métricas finais
  if (stats.successful > 0) {
    stats.average_compression = (stats.total_tokens_saved / stats.successful).toFixed(1);
  }
  
  console.log('\n📈 BATCH TEST SUMMARY:');
  console.log('='.repeat(50));
  console.log(`Successful tests: ${stats.successful}/${stats.total_urls}`);
  console.log(`Failed tests: ${stats.failed}/${stats.total_urls}`);
  console.log(`Total tokens saved: ${stats.total_tokens_saved}`);
  console.log(`Average compression per URL: ${stats.average_compression} tokens`);
  console.log(`Total keywords extracted: ${stats.total_keywords}`);
  
  return {
    results: results,
    statistics: stats,
    tested_at: new Date().toISOString()
  };
}

module.exports = {
  smartScrapeOptimized,
  compareOptimizationMethods,
  batchOptimizationTest
};
