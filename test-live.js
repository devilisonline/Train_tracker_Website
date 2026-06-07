const axios = require('axios');
const cheerio = require('cheerio');

async function test() {
    try {
        const response = await axios.get('https://etrain.info/train/14117/live', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const $ = cheerio.load(response.data);
        $('table').each((i, el) => {
            console.log(`Table ${i} class: ${$(el).attr('class')}`);
        });
        
        // Let's print the first row of each table to see what's inside
        $('table').each((i, el) => {
            console.log(`Table ${i} first row:`, $(el).find('tr').first().text().replace(/\s+/g, ' ').substring(0, 100));
        });
    } catch(e) { console.error(e.message); }
}
test();
