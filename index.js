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
    const day = req.query.day || 'today';
    if (!trainNo) return res.send(wrapHTML('Error', '<div class="error">Missing Train No</div>'));

    try {
        const url = `https://trainstatus.info/running-status/${trainNo}-${day}`;
        const response = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 5000
        });
        
        const $ = cheerio.load(response.data);
        const statusMsg = $('.status-box, .alert, .badge').text().trim();
        
        if (!statusMsg) {
             return res.send(wrapHTML('Result', '<div class="error">Train not found or data unavailable.</div>'));
        }

        // Build the top banner with exact status
        let content = `<div class="card" style="border-left: 4px solid #0b3e71;">
            <div class="card-title">Live Status</div>
            <div class="card-text success" style="font-weight:bold; font-size: 15px;">${statusMsg}</div>
        </div>`;
        
        let foundAny = false;

        // Build the detailed timeline
        $('tbody.ampstart-caption tr').each((i, el) => {
            const tds = $(el).find('td');
            if (tds.length >= 7) {
                foundAny = true;
                const stnName = $(tds[1]).text().trim();
                const schArr = $(tds[2]).text().trim();
                const schDep = $(tds[3]).text().trim();
                
                const actArr = $(tds[4]).contents().first().text().trim();
                const delayArr = $(tds[4]).find('span.red, span.green').first().text().trim();
                
                const actDep = $(tds[5]).contents().first().text().trim();
                const delayDep = $(tds[5]).find('span.red, span.green').first().text().trim();
                
                const dist = $(tds[6]).contents().first().text().trim();

                const isCurrent = statusMsg.toUpperCase().includes(stnName.toUpperCase());

                content += `<div class="card ${isCurrent ? 'tl-current' : ''}">
                    <div class="card-title">${stnName}</div>
                    <div class="tl-times" style="flex-direction:column; gap:3px;">
                        <span style="font-weight:bold; color:#0b3e71;">ETA (Arr): ${actArr} ${delayArr} <span style="font-weight:normal; color:#888; font-size:10px;">(Sch: ${schArr})</span></span>
                        <span style="font-weight:bold; color:#5da03b;">ETD (Dep): ${actDep} ${delayDep} <span style="font-weight:normal; color:#888; font-size:10px;">(Sch: ${schDep})</span></span>
                        <span>Dist: ${dist} km</span>
                    </div>
                </div>`;
            }
        });

        if (!foundAny) {
            content += '<div class="error">Timeline data unavailable.</div>';
        }
        res.send(wrapHTML(trainNo, content));
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

        $('.trainlist tr').each((i, el) => {
            const tds = $(el).find('td');
            if (tds.length >= 7) {
                const trnNum = $(tds[0]).text().trim();
                const trnName = $(tds[1]).text().trim();
                const fromStn = $(tds[2]).text().trim();
                const dep = $(tds[3]).text().trim();
                const toStn = $(tds[4]).text().trim();
                const arr = $(tds[5]).text().trim();
                const travelTime = $(tds[6]).text().trim();
                content += `<div class="card">
                    <div class="card-title">${trnNum} - ${trnName}</div>
                    <div class="card-text">Dep: ${dep} (${fromStn}) | Arr: ${arr} (${toStn})</div>
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

        const scheduleTable = $('table').filter((i, el) => $(el).text().includes('Station Name') && $(el).text().includes('Distance')).first();
        if (scheduleTable.length > 0) {
            scheduleTable.find('tr').each((i, el) => {
                const tds = $(el).find('td');
                if (tds.length >= 4) {
                    // It can be 5 columns or more.
                    // The first column usually contains the S.No and Code, like "1PRYJ"
                    const col0 = $(tds[0]).text().trim();
                    const codeMatch = col0.match(/[A-Z]+/);
                    if (!codeMatch) return; // Skip headers
                    const stnCode = codeMatch[0];

                    // The station name and distance are usually in index 2 (or the one containing 'kms')
                    let dist = '-';
                    let col2 = $(tds[2]).text().trim();
                    const distMatch = col2.match(/(\d+)\s*kms/);
                    if (distMatch) dist = distMatch[1];

                    // The timings are usually in the last column
                    let arr = '-', dep = '-';
                    const timingText = $(tds[tds.length - 1]).text().trim();
                    const timeMatches = timingText.match(/(\d{2}:\d{2})/g);
                    if (timeMatches && timeMatches.length >= 2) {
                        arr = timeMatches[0];
                        dep = timeMatches[1];
                    } else if (timeMatches && timeMatches.length === 1) {
                        if (timingText.toLowerCase().includes('source')) {
                            arr = 'Source';
                            dep = timeMatches[0];
                        } else {
                            arr = timeMatches[0];
                            dep = 'Dest';
                        }
                    }

                    content += `<div class="card">
                        <div class="card-title">${stnCode}</div>
                        <div class="tl-times">
                            <span>Arr: ${arr} | Dep: ${dep}</span>
                            <span>Dist: ${dist} km</span>
                        </div>
                    </div>`;
                }
            });
        }

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
