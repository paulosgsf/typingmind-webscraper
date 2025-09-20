const xml2js = require('xml2js');
const axios = require('axios');

async function parseSitemap(xmlContent, baseUrl = null) {
  try {
    const parser = new xml2js.Parser({
      explicitArray: false,
      ignoreAttrs: false
    });
    
    const result = await parser.parseStringPromise(xmlContent);
    const urls = [];

    // Handle regular sitemap
    if (result.urlset && result.urlset.url) {
      const urlEntries = Array.isArray(result.urlset.url) ? result.urlset.url : [result.urlset.url];
      
      urlEntries.forEach(entry => {
        if (entry.loc) {
          let url = typeof entry.loc === 'string' ? entry.loc : entry.loc._;
          if (url) {
            url = url.trim();
            // Convert relative URLs to absolute
            if (baseUrl && url.startsWith('/')) {
              url = baseUrl.replace(/\/$/, '') + url;
            }
            urls.push(url);
          }
        }
      });
    }

    // Handle sitemap index
    if (result.sitemapindex && result.sitemapindex.sitemap) {
      const sitemapEntries = Array.isArray(result.sitemapindex.sitemap) ? result.sitemapindex.sitemap : [result.sitemapindex.sitemap];
      
      for (const entry of sitemapEntries) {
        if (entry.loc) {
          let sitemapUrl = typeof entry.loc === 'string' ? entry.loc : entry.loc._;
          if (sitemapUrl) {
            sitemapUrl = sitemapUrl.trim();
            // Convert relative URLs to absolute
            if (baseUrl && sitemapUrl.startsWith('/')) {
              sitemapUrl = baseUrl.replace(/\/$/, '') + sitemapUrl;
            }
            try {
              const response = await axios.get(sitemapUrl, { timeout: 5000 });
              const childUrls = await parseSitemap(response.data, baseUrl);
              urls.push(...childUrls);
            } catch (error) {
              console.log(`Failed to fetch child sitemap: ${sitemapUrl}`);
            }
          }
        }
      }
    }

    return [...new Set(urls)]; // Remove duplicates
  } catch (error) {
    console.error('XML parsing error:', error.message);
    return [];
  }
}

async function discoverSitemap(baseUrl) {
  const possiblePaths = [
    '/sitemap.xml',
    '/sitemap_index.xml',
    '/sitemaps.xml',
    '/sitemap/sitemap.xml'
  ];

  // Clean base URL
  const cleanBaseUrl = baseUrl.replace(/\/$/, '');
  
  console.log(`Discovering sitemap for: ${cleanBaseUrl}`);

  // Try direct sitemap paths
  for (const path of possiblePaths) {
    try {
      const sitemapUrl = cleanBaseUrl + path;
      console.log(`Trying: ${sitemapUrl}`);
      
      const response = await axios.get(sitemapUrl, { 
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SitemapBot/1.0)'
        }
      });
      
      if (response.data && response.data.includes('<urlset') || response.data.includes('<sitemapindex')) {
        console.log(`Found sitemap: ${sitemapUrl}`);
        return await parseSitemap(response.data, cleanBaseUrl);
      }
    } catch (error) {
      // Continue to next possibility
    }
  }

  // Try robots.txt
  try {
    const robotsUrl = cleanBaseUrl + '/robots.txt';
    console.log(`Checking robots.txt: ${robotsUrl}`);
    
    const response = await axios.get(robotsUrl, { timeout: 5000 });
    const robotsContent = response.data;
    
    const sitemapMatches = robotsContent.match(/Sitemap:\s*(https?:\/\/[^\s]+)/gi);
    if (sitemapMatches) {
      for (const match of sitemapMatches) {
        const sitemapUrl = match.replace(/Sitemap:\s*/i, '').trim();
        try {
          console.log(`Found sitemap in robots.txt: ${sitemapUrl}`);
          const sitemapResponse = await axios.get(sitemapUrl, { timeout: 5000 });
          return await parseSitemap(sitemapResponse.data, cleanBaseUrl);
        } catch (error) {
          continue;
        }
      }
    }
  } catch (error) {
    console.log('No robots.txt found');
  }

  console.log('No sitemap found, will use fallback method');
  return [];
}

module.exports = {
  parseSitemap,
  discoverSitemap
};
