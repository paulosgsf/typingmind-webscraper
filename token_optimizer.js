// AI Token Optimizer - Compressão semântica para LLMs
// Reduz tokens preservando significado e contexto

/**
 * Otimizador de tokens especializado para consumo de IA
 */
class AITokenOptimizer {
  
  constructor() {
    // Palavras vazias em português e inglês que podem ser removidas sem perder contexto
    this.stopWords = new Set([
      // Português
      'o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas', 'de', 'da', 'do', 'das', 'dos',
      'em', 'na', 'no', 'nas', 'nos', 'para', 'por', 'com', 'sem', 'sob', 'sobre',
      'é', 'são', 'foi', 'foram', 'será', 'serão', 'tem', 'têm', 'teve', 'tiveram',
      'que', 'qual', 'quais', 'quando', 'onde', 'como', 'porque', 'porquê',
      'este', 'esta', 'estes', 'estas', 'esse', 'essa', 'esses', 'essas',
      'aquele', 'aquela', 'aqueles', 'aquelas', 'seu', 'sua', 'seus', 'suas',
      'nosso', 'nossa', 'nossos', 'nossas', 'meu', 'minha', 'meus', 'minhas',
      
      // Inglês
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of',
      'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before',
      'after', 'above', 'below', 'between', 'among', 'is', 'are', 'was', 'were',
      'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
      'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that',
      'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him',
      'her', 'us', 'them', 'my', 'your', 'his', 'its', 'our', 'their'
    ]);
    
    // Padrões de compressão semântica
    this.compressionPatterns = [
      // Expressões verbosas -> concisas
      { pattern: /\b(?:devido ao fato de que|em razão de que|por causa de que)\b/gi, replacement: 'porque' },
      { pattern: /\b(?:a fim de que|com o objetivo de|com a finalidade de)\b/gi, replacement: 'para' },
      { pattern: /\b(?:no sentido de que|de modo que|de forma que)\b/gi, replacement: 'para que' },
      { pattern: /\b(?:é importante notar que|vale destacar que|cabe mencionar que)\b/gi, replacement: '' },
      { pattern: /\b(?:é possível que|pode ser que|é provável que)\b/gi, replacement: 'pode' },
      { pattern: /\b(?:uma grande quantidade de|um grande número de)\b/gi, replacement: 'muitos' },
      { pattern: /\b(?:uma pequena quantidade de|um pequeno número de)\b/gi, replacement: 'poucos' },
      { pattern: /\b(?:no que diz respeito a|com relação a|em relação a)\b/gi, replacement: 'sobre' },
      
      // Inglês
      { pattern: /\bin order to\b/gi, replacement: 'to' },
      { pattern: /\bdue to the fact that\b/gi, replacement: 'because' },
      { pattern: /\ba large number of\b/gi, replacement: 'many' },
      { pattern: /\ba small number of\b/gi, replacement: 'few' },
      { pattern: /\bit is important to note that\b/gi, replacement: '' },
      { pattern: /\bit should be noted that\b/gi, replacement: '' },
      { pattern: /\bas a result of\b/gi, replacement: 'because of' },
      { pattern: /\bin spite of the fact that\b/gi, replacement: 'although' }
    ];
  }
  
  /**
   * Otimiza conteúdo completo para consumo de IA
   * @param {Object} extractedData - Dados extraídos do scraping
   * @returns {Object} Dados otimizados com métricas
   */
  optimizeForAI(extractedData) {
    const startTime = Date.now();
    const originalLength = extractedData.content.length;
    
    // 1. Estruturação semântica
    const structuredContent = this.createSemanticStructure(extractedData.content, extractedData.title);
    
    // 2. Compressão inteligente
    const compressedContent = this.intelligentCompress(structuredContent);
    
    // 3. Markdown otimizado para LLM
    const markdownContent = this.optimizedMarkdown(compressedContent, extractedData.title);
    
    // 4. Extração de keywords
    const keywords = this.extractKeywords(compressedContent);
    
    // 5. Chunking semântico
    const chunks = this.semanticChunk(markdownContent);
    
    // 6. Métricas de otimização
    const optimizedLength = markdownContent.length;
    const compressionRatio = ((originalLength - optimizedLength) / originalLength * 100).toFixed(1);
    
    return {
      original: extractedData,
      optimized: {
        title: extractedData.title,
        description: extractedData.description,
        content: markdownContent,
        length: optimizedLength,
        keywords: keywords,
        chunks: chunks,
        method: extractedData.method + '-optimized'
      },
      optimization_stats: {
        original_length: originalLength,
        optimized_length: optimizedLength,
        compression_ratio: `${compressionRatio}%`,
        tokens_saved: Math.round((originalLength - optimizedLength) / 4), // Estimativa: 4 chars = 1 token
        processing_time_ms: Date.now() - startTime
      }
    };
  }
  
  /**
   * Cria estrutura semântica do conteúdo
   * @param {string} content - Conteúdo bruto
   * @param {string} title - Título da página
   * @returns {string} Conteúdo estruturado
   */
  createSemanticStructure(content, title) {
    // Dividir em parágrafos semânticos
    const paragraphs = content
      .split(/\n\s*\n/)
      .map(p => p.trim())
      .filter(p => p.length > 20);
    
    // Identificar tipos de conteúdo
    const structuredParagraphs = paragraphs.map(paragraph => {
      // Detectar listas
      if (this.isList(paragraph)) {
        return this.formatList(paragraph);
      }
      
      // Detectar código
      if (this.isCode(paragraph)) {
        return this.formatCode(paragraph);
      }
      
      // Detectar títulos/headers dentro do texto
      if (this.isHeader(paragraph)) {
        return this.formatHeader(paragraph);
      }
      
      // Parágrafo normal
      return this.formatParagraph(paragraph);
    });
    
    return structuredParagraphs.join('\n\n');
  }
  
  /**
   * Compressão inteligente preservando significado
   * @param {string} content - Conteúdo estruturado
   * @returns {string} Conteúdo comprimido
   */
  intelligentCompress(content) {
    let compressed = content;
    
    // 1. Aplicar padrões de compressão semântica
    this.compressionPatterns.forEach(({ pattern, replacement }) => {
      compressed = compressed.replace(pattern, replacement);
    });
    
    // 2. Remover redundâncias e repetições
    compressed = this.removeRedundancies(compressed);
    
    // 3. Otimizar espaços em branco
    compressed = this.optimizeWhitespace(compressed);
    
    // 4. Compactar frases desnecessárias
    compressed = this.compactUnnecessaryPhrases(compressed);
    
    return compressed;
  }
  
  /**
   * Converte para Markdown otimizado para LLMs
   * @param {string} content - Conteúdo comprimido
   * @param {string} title - Título principal
   * @returns {string} Markdown estruturado
   */
  optimizedMarkdown(content, title) {
    let markdown = '';
    
    // Título principal
    if (title) {
      markdown += `# ${title}\n\n`;
    }
    
    // Processar conteúdo linha por linha
    const lines = content.split('\n');
    let inCodeBlock = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (!line) continue;
      
      // Detectar blocos de código
      if (line.includes('```') || line.includes('function') || line.includes('const ') || line.includes('import ')) {
        if (!inCodeBlock) {
          markdown += '```\n';
          inCodeBlock = true;
        }
        markdown += line + '\n';
        continue;
      }
      
      if (inCodeBlock && (line.includes('}') || line.includes(');'))) {
        markdown += line + '\n```\n\n';
        inCodeBlock = false;
        continue;
      }
      
      // Headers (detectar por padrões)
      if (this.isHeaderLine(line)) {
        const level = this.getHeaderLevel(line);
        markdown += `${'#'.repeat(level)} ${this.cleanHeaderText(line)}\n\n`;
        continue;
      }
      
      // Listas
      if (this.isListItem(line)) {
        markdown += `- ${this.cleanListItem(line)}\n`;
        continue;
      }
      
      // Parágrafo normal
      if (line.length > 10) {
        markdown += line + '\n\n';
      }
    }
    
    // Fechar código se ainda aberto
    if (inCodeBlock) {
      markdown += '```\n\n';
    }
    
    // Limpeza final
    return markdown
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
  
  /**
   * Extrai keywords automaticamente do conteúdo
   * @param {string} content - Conteúdo para análise
   * @returns {Array} Lista de keywords relevantes
   */
  extractKeywords(content) {
    // Tokenizar texto
    const words = content
      .toLowerCase()
      .replace(/[^\w\sáàâãéèêíìîóòôõúùûç]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !this.stopWords.has(word));
    
    // Contar frequências
    const frequency = {};
    words.forEach(word => {
      frequency[word] = (frequency[word] || 0) + 1;
    });
    
    // Filtrar e ordenar keywords
    const keywords = Object.entries(frequency)
      .filter(([word, freq]) => freq >= 2) // Aparecer pelo menos 2 vezes
      .sort(([,a], [,b]) => b - a)
      .slice(0, 8) // Top 8 keywords
      .map(([word]) => word);
    
    return keywords;
  }
  
  /**
   * Divide conteúdo em chunks semânticos para LLMs
   * @param {string} content - Conteúdo em markdown
   * @returns {Array} Array de chunks semânticos
   */
  semanticChunk(content) {
    const maxChunkSize = 2000; // chars por chunk
    const chunks = [];
    
    // Dividir por headers primeiro
    const sections = content.split(/(?=^#{1,6}\s)/m);
    
    for (const section of sections) {
      if (section.length <= maxChunkSize) {
        chunks.push(section.trim());
      } else {
        // Dividir seções grandes por parágrafos
        const paragraphs = section.split('\n\n');
        let currentChunk = '';
        
        for (const paragraph of paragraphs) {
          if (currentChunk.length + paragraph.length <= maxChunkSize) {
            currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
          } else {
            if (currentChunk) {
              chunks.push(currentChunk.trim());
            }
            currentChunk = paragraph;
          }
        }
        
        if (currentChunk) {
          chunks.push(currentChunk.trim());
        }
      }
    }
    
    return chunks.filter(chunk => chunk.length > 50);
  }
  
  // === MÉTODOS AUXILIARES ===
  
  isList(text) {
    return /^[\s]*[-*•]\s/.test(text) || /^\s*\d+\.\s/.test(text);
  }
  
  isCode(text) {
    return /^[\s]*(?:function|const|let|var|import|export|class|if|for|while)\s/.test(text) || 
           text.includes('()') || text.includes('{}') || text.includes('[]');
  }
  
  isHeader(text) {
    return text.length < 100 && /^[A-Z][^.!?]*$/.test(text.trim());
  }
  
  isHeaderLine(line) {
    return line.length < 80 && 
           !line.includes('.') && 
           !line.includes(',') &&
           (line.match(/[A-Z]/g) || []).length >= 2;
  }
  
  isListItem(line) {
    return /^[-*•]\s/.test(line) || /^\d+\.\s/.test(line);
  }
  
  getHeaderLevel(line) {
    if (line.length < 30) return 2;
    if (line.length < 50) return 3;
    return 4;
  }
  
  cleanHeaderText(text) {
    return text.replace(/^[-*•\d\.]\s*/, '').trim();
  }
  
  cleanListItem(text) {
    return text.replace(/^[-*•\d\.]\s*/, '').trim();
  }
  
  formatList(text) {
    return text.split('\n')
      .map(line => line.trim())
      .filter(line => line)
      .map(line => line.startsWith('-') || line.startsWith('*') ? line : `- ${line}`)
      .join('\n');
  }
  
  formatCode(text) {
    return '```\n' + text + '\n```';
  }
  
  formatHeader(text) {
    return `## ${text}`;
  }
  
  formatParagraph(text) {
    return text.trim();
  }
  
  removeRedundancies(text) {
    // Remover frases repetidas
    const sentences = text.split(/[.!?]+/);
    const uniqueSentences = [...new Set(sentences.map(s => s.trim()))]
      .filter(s => s.length > 10);
    
    return uniqueSentences.join('. ').trim();
  }
  
  optimizeWhitespace(text) {
    return text
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .trim();
  }
  
  compactUnnecessaryPhrases(text) {
    // Remover frases comuns que não agregam valor semântico
    const unnecessaryPhrases = [
      /\b(?:como mencionado anteriormente|conforme dito antes|como visto acima)\b/gi,
      /\b(?:vale a pena mencionar que|é interessante notar que)\b/gi,
      /\b(?:neste contexto|nesse sentido|dessa forma)\b/gi,
      /\b(?:as mentioned above|as stated before|it should be noted)\b/gi,
      /\b(?:it is worth mentioning|it is interesting to note)\b/gi
    ];
    
    let cleaned = text;
    unnecessaryPhrases.forEach(phrase => {
      cleaned = cleaned.replace(phrase, '');
    });
    
    return cleaned.replace(/\s+/g, ' ').trim();
  }
}

module.exports = {
  AITokenOptimizer
};
