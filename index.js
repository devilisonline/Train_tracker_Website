const express = require('express');
const axios = require('axios');
const path = require('path');
const cheerio = require('cheerio');
const app = express();
const port = 8080;

app.use(express.urlencoded({ extended: true }));
// Serve the static frontend
app.use(express.static(path.join(__dirname, 'public')));

// Basic HTML wrapper
function wrapHTML(title, content) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <link rel="stylesheet" href="/style.css">
</head>
<body>
    <div class="header">
        <a href="/" class="back-btn">&larr; Home</a>
        <h2>${title}</h2>
    </div>
    <div class="result-container">
        ${content}
    </div>
</body>
</html>`;
}

// 1. Spot Result
app.get('/spot-result', async (req, res) => {
    const trainNo = req.query.trainNo;
    if (!trainNo) return res.send(wrapHTML('Error', '<div class="error">Missing Train No</div>'));

    try {
        const response = await axios.get(`https://rappid.in/apis/train.php?train_no=${trainNo}`, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 5000
        });
        
        if (response.data && response.data.success) {
            let content = `<div class="card"><div class="card-title">Live Status</div><div class="card-text success" style="font-weight:bold;">${response.data.message || 'Running'}</div><div class="card-text">Updated: ${response.data.updated_time || 'Just now'}</div></div>`;
            
            response.data.data.forEach(stn => {
                content += `<div class="card ${stn.is_current_station ? 'tl-current' : ''}">
                    <div class="card-title">${stn.station_name} <span style="font-size:11px;color:#888;">(PF ${stn.platform})</span></div>
                    <div class="tl-times">
                        <span>Arr/Dep: ${stn.timing}</span>
                        <span>Dist: ${stn.distance}</span>
                    </div>
                </div>`;
            });
            res.send(wrapHTML(response.data.train_name || trainNo, content));
        } else {
            res.send(wrapHTML('Result', '<div class="error">Train not found or data unavailable.</div>'));
        }
    } catch (e) {
        res.send(wrapHTML('Error', `<div class="error">Backend Error: ${e.message}</div>`));
    }
});

// Helper for mapping station names to codes
const stationMap = {
    "prayagraj": "PRYJ", "allahabad": "PRYJ", "kanpur": "CNB", "delhi": "NDLS",
    "new delhi": "NDLS", "jaunpur": "JNU", "mumbai": "CSMT", "patna": "PNBE",
    "lucknow": "LKO", "varanasi": "BSB", "kolkata": "HWH", "howrah": "HWH",
    "chennai": "MAS", "bangalore": "SBC", "hyderabad": "SC", "pune": "PUNE",
    "ahmedabad": "ADI", "jaipur": "JP", "surat": "ST", "agra": "AGC",
    "prayagraj junction": "PRYJ", "kanpur central": "CNB", "gorakhpur": "GKP",
    "gorakhpur junction": "GKP", "varanasi junction": "BSB", "mumbai central": "MMCT",
    "ahmedabad junction": "ADI", "patna junction": "PNBE", "howrah junction": "HWH"
};

function getCode(name) {
    const clean = name.toLowerCase().trim();
    return stationMap[clean] || clean.toUpperCase();
}

// 2. Trains Between Stations
app.get('/between-result', async (req, res) => {
    let from = req.query.from;
    let to = req.query.to;
    if (!from || !to) return res.send(wrapHTML('Error', '<div class="error">Missing Station Codes</div>'));

    try {
        const url = `https://etrain.info/trains/${getCode(from)}-to-${getCode(to)}`;
        const { data } = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 5000 });
        const $ = cheerio.load(data);
        let content = '';

        $('.trainlist > tbody > tr').each((i, el) => {
            const tds = $(el).find('td');
            if (tds.length >= 8) {
                const trnNum = $(tds[0]).text().trim();
                const trnName = $(tds[1]).text().trim();
                const dep = $(tds[4]).text().trim();
                const arr = $(tds[5]).text().trim();
                const travelTime = $(tds[6]).text().trim();
                content += `<div class="card">
                    <div class="card-title">${trnNum} - ${trnName}</div>
                    <div class="card-text">Dep: ${dep} | Arr: ${arr}</div>
                    <div class="card-text">Travel Time: ${travelTime}</div>
                </div>`;
            }
        });

        if (!content) content = '<div class="error">No trains found.</div>';
        res.send(wrapHTML(`Trains: ${from.toUpperCase()} to ${to.toUpperCase()}`, content));
    } catch (e) {
        res.send(wrapHTML('Error', `<div class="error">Error: ${e.message}</div>`));
    }
});

// 3. Train Schedule
app.get('/schedule-result', async (req, res) => {
    const trainNo = req.query.trainNo;
    if (!trainNo) return res.send(wrapHTML('Error', '<div class="error">Missing Train No</div>'));

    try {
        const url = `https://etrain.info/train/${trainNo}/schedule`;
        const { data } = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 5000 });
        const $ = cheerio.load(data);
        let content = '';

        $('.trainlist > tbody > tr').each((i, el) => {
            const tds = $(el).find('td');
            if (tds.length >= 7) {
                const stnCode = $(tds[1]).text().trim();
                const arr = $(tds[3]).text().trim();
                const dep = $(tds[4]).text().trim();
                const dist = $(tds[6]).text().trim();
                content += `<div class="card">
                    <div class="card-title">${stnCode}</div>
                    <div class="tl-times">
                        <span>Arr: ${arr} | Dep: ${dep}</span>
                        <span>Dist: ${dist} km</span>
                    </div>
                </div>`;
            }
        });

        if (!content) content = '<div class="error">Schedule not found.</div>';
        res.send(wrapHTML(`Schedule: ${trainNo}`, content));
    } catch (e) {
        res.send(wrapHTML('Error', `<div class="error">Error: ${e.message}</div>`));
    }
});

// 4. Live Station
app.get('/station-result', async (req, res) => {
    const stn = req.query.stn;
    if (!stn) return res.send(wrapHTML('Error', '<div class="error">Missing Station Code</div>'));

    try {
        const code = getCode(stn);
        const url = `https://erail.in/station-live/${code}`;
        const { data } = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 5000 });
        const $ = cheerio.load(data);
        let content = '';

        $('table tr').each((i, el) => {
            const tds = $(el).find('td');
            if (tds.length >= 3) {
                const trainNumSpan = $(tds[0]).find('span').text().trim();
                const trainNameDiv = $(tds[0]).find('div').text().trim();
                let arr = $(tds[1]).text().trim();
                let dep = $(tds[2]).text().trim();
                
                if (arr.toUpperCase() === 'SRC') arr = 'Starts Here';
                if (dep.toUpperCase() === 'DST') dep = 'Ends Here';
                
                if(trainNumSpan) {
                    content += `<div class="card">
                        <div class="card-title">${trainNumSpan} - ${trainNameDiv}</div>
                        <div class="card-text">Arr: ${arr} | Dep: ${dep}</div>
                    </div>`;
                }
            }
        });

        if (!content) content = '<div class="error">No trains found at this station currently.</div>';
        res.send(wrapHTML(`Live: ${code}`, content));
    } catch (e) {
        res.send(wrapHTML('Error', `<div class="error">Error: ${e.message}</div>`));
    }
});

if (require.main === module) {
    app.listen(port, () => {
        console.log(`Premium Train Tracker Server is running on port ${port}!`);
    });
}
module.exports = app;
