const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();
const port = 8080;

app.use(express.urlencoded({ extended: true }));
// Serve the modern frontend
app.use(express.static(path.join(__dirname, 'public')));

// 1. Live Train Status API (Using unrestricted Rappid API)
app.get('/api/live', async (req, res) => {
    const trainNo = req.query.trainNo;
    if (!trainNo) return res.status(400).json({ success: false, message: "Missing Train No" });

    try {
        const response = await axios.get(`https://rappid.in/apis/train.php?train_no=${trainNo}`, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 5000
        });
        
        if (response.data && response.data.success) {
            res.json(response.data);
        } else {
            res.json({ success: false, message: "Train not found or data unavailable." });
        }
    } catch (error) {
        console.error("Live Status API Error:", error.message);
        res.json({ success: false, message: "Backend Error: " + error.message });
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

// 2. Trains Between Stations API (Scraping etrain.info)
app.get('/api/between', async (req, res) => {
    const from = getCode(req.query.from || "");
    const to = getCode(req.query.to || "");
    if (!from || !to) return res.send("Error: Missing stations");
    
    try {
        const response = await axios.get(`https://etrain.info/trains/${from}-to-${to}`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }, timeout: 5000
        });
        const cheerio = require('cheerio');
        const $ = cheerio.load(response.data);
        const trains = [];
        $('.trainlist tbody tr').each((i, el) => {
            const trainNum = $(el).find('td:nth-child(1)').text().trim();
            const trainName = $(el).find('td:nth-child(2)').text().trim();
            const depTime = $(el).find('td:nth-child(4)').text().trim();
            const arrTime = $(el).find('td:nth-child(6)').text().trim();
            if(trainNum) trains.push(`<b>${trainNum} - ${trainName}</b> | Dep: ${depTime} | Arr: ${arrTime}`);
        });
        
        if (trains.length === 0) return res.send(`No trains found between ${from} & ${to}. Try exact station codes.`);
        
        res.setHeader('Content-Type', 'text/plain');
        res.send(trains.join('\n'));
    } catch(e) { 
        res.send("Backend Error: " + e.message); 
    }
});

// 3. Train Schedule API (Using rappid.in)
app.get('/api/schedule', async (req, res) => {
    const trainNo = req.query.trainNo;
    if (!trainNo) return res.send("Error: Missing Train No");
    
    try {
        const response = await axios.get(`https://rappid.in/apis/train.php?train_no=${trainNo}`, {
            headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 5000
        });
        
        if (response.data && response.data.success && response.data.data) {
            const stations = response.data.data.map(stn => {
                let timingStr = stn.timing;
                if (timingStr.length === 10) {
                    timingStr = `Arrive: ${timingStr.substring(0, 5)} / Depart: ${timingStr.substring(5, 10)}`;
                } else if (timingStr.length === 5) {
                    timingStr = `Time: ${timingStr}`;
                } else if (timingStr === "Destination" || (stn.halt && stn.halt.toLowerCase() === "destination")) {
                    timingStr = "Destination";
                }
                return `${stn.station_name} | ${timingStr}`;
            });
            res.setHeader('Content-Type', 'text/plain');
            res.send(stations.join('\n'));
        } else {
            res.send("Schedule not found. Check train number.");
        }
    } catch(e) { 
        res.send("Backend Error: " + e.message); 
    }
});

// 4. Live Station Board API (Scraping erail.in)
app.get('/api/station', async (req, res) => {
    let stn = getCode(req.query.stn || "");
    if (!stn) return res.send("Error: Missing station code");
    
    // Fallback: If user enters e.g. "PRYJ PRAYAGRAJ", try to extract the code
    if (stn.length > 4 && stn.includes(' ')) {
        const parts = stn.split(' ');
        stn = parts.find(p => p.length >= 2 && p.length <= 4) || stn;
    }
    
    try {
        const response = await axios.get(`https://erail.in/station-live/${stn}`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }, timeout: 5000
        });
        const cheerio = require('cheerio');
        const $ = cheerio.load(response.data);
        const trains = [];
        
        // Scraping the station departure board from erail.in
        $('table tr').each((i, el) => {
            const tds = $(el).find('td');
            if (tds.length >= 3) {
                const trainNumSpan = $(tds[0]).find('span').text().trim();
                const trainNameDiv = $(tds[0]).find('.name').text().replace(trainNumSpan, '').trim();
                let arr = $(tds[1]).text().trim();
                let dep = $(tds[2]).text().trim();
                
                if (arr.toUpperCase() === 'SRC') arr = 'Starts Here';
                if (dep.toUpperCase() === 'DST') dep = 'Ends Here';
                
                if(trainNumSpan) trains.push(`<b>${trainNumSpan} - ${trainNameDiv}</b> | Arr: ${arr} | Dep: ${dep}`);
            }
        });
        
        if (trains.length === 0) return res.send("No trains found at this station currently.");
        
        res.setHeader('Content-Type', 'text/plain');
        res.send(trains.slice(0, 30).join('\n')); // return max 30
    } catch(e) { 
        res.send("Backend Error: " + e.message); 
    }
});

if (require.main === module) {
    app.listen(port, () => {
        console.log(`Premium Train Tracker Server is running on port ${port}!`);
    });
}
module.exports = app;
