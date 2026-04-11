const axios = require('axios');
const cheerio = require('cheerio');

async function main() {
  const scientificName = process.argv[2] || 'Prunus persica';
  const url = `http://www.efloras.org/search_page.aspx?flora_id=2&search_tab=search&name_str=${encodeURIComponent(scientificName)}&submit=Search`;

  const response = await axios.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PlantSystemBot/1.0)' },
    timeout: 15000
  });

  const $ = cheerio.load(response.data || '');
  const candidates = [
    $('.zh').first().text(),
    $('.chinese_name').first().text(),
    $('td:contains("Chinese Name")').next('td').text(),
    $('td:contains("中文名")').next('td').text(),
    $('span:contains("中文名")').next().text(),
    $('*:contains("中文名")').next().text(),
    $('.flora_taxon_name').first().text()
  ].map((t) => String(t || '').trim());

  console.log('URL:', url);
  console.log('Candidates:', candidates);
  console.log('Any CJK:', candidates.some((x) => /[\u3400-\u9FFF]/.test(x)));
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
