// Tab Switching Logic
function switchTab(tabId, element) {
    // Update active nav link
    document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));
    element.classList.add('active');

    // Update active tab content
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
}

// Clear input helper
function clearInput(inputId) {
    document.getElementById(inputId).value = '';
}

// Clear entire forms
function clearStationForm() {
    clearInput('station-code');
    clearInput('station-to');
    document.getElementById('station-result').classList.remove('show');
}

function clearBetweenForm() {
    clearInput('between-src');
    clearInput('between-dest');
    document.getElementById('between-result').classList.remove('show');
}

// Swap Stations helper
function swapStations() {
    const srcInput = document.getElementById('between-src');
    const destInput = document.getElementById('between-dest');
    const temp = srcInput.value;
    srcInput.value = destInput.value;
    destInput.value = temp;
}

// Loading Spinner Helper
function showLoading(containerId) {
    const container = document.getElementById(containerId);
    container.classList.add('show');
    container.innerHTML = '<div class="loader"><i class="fa-solid fa-spinner fa-spin"></i> Fetching Data...</div>';
}

function renderError(containerId, message) {
    const container = document.getElementById(containerId);
    container.innerHTML = `<div class="error-text"><i class="fa-solid fa-circle-exclamation"></i> ${message}</div>`;
}

// API Fetchers
async function fetchLiveStatus() {
    const trainNo = document.getElementById('live-train-no').value.trim();
    if (!trainNo) return;
    
    showLoading('live-result');
    try {
        const response = await fetch(`/api/live?trainNo=${trainNo}`);
        const data = await response.json();
        
        if (!data.success) {
            renderError('live-result', data.message || 'Train not found or not running today.');
            return;
        }

        const trainName = data.train_name;
        const lastUpdate = data.updated_time || 'Just now';
        
        let headerHtml = `
            <div class="live-header" style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                    <h3>${trainName}</h3>
                    <div class="updated-time"><i class="fas fa-history"></i> ${lastUpdate}</div>
                </div>
                <button onclick="fetchLiveStatus()" class="btn-primary" style="padding: 8px 15px; font-size: 13px; display: flex; align-items: center; gap: 6px;">
                    <i class="fa-solid fa-arrows-rotate"></i> Refresh
                </button>
            </div>
            <div class="light-theme-timeline">
                <div class="tl-header-row">
                    <div class="tl-arr">Arrival</div>
                    <div class="tl-stn">Station</div>
                    <div class="tl-dep">Departure</div>
                </div>
        `;

        let html = headerHtml;

        let foundCurrent = false;
        
        let currentStationIndex = -1;
        if (data.message) {
            const msgLower = data.message.toLowerCase();
            for (let i = data.data.length - 1; i >= 0; i--) {
                const stnLower = data.data[i].station_name.toLowerCase();
                if (msgLower.includes(stnLower)) {
                    currentStationIndex = i;
                    break;
                }
            }
        }

        data.data.forEach((station, index) => {
            let isCurrent = false;
            
            if (currentStationIndex !== -1) {
                isCurrent = (index === currentStationIndex);
            } else if (station.is_current_station) {
                isCurrent = true;
            }
            
            if (isCurrent) foundCurrent = true;
            
            let isPassed = false;
            if (currentStationIndex !== -1) {
                isPassed = index <= currentStationIndex;
            } else if (data.message) {
                isPassed = !isCurrent && !foundCurrent;
                if (isCurrent) isPassed = true;
            } else {
                isPassed = false;
            }
            
            const isFuture = !isPassed;

            const isSource = station.halt.toLowerCase() === "source";
            const isDest = station.timing === "Destination" || station.halt.toLowerCase() === "destination";
            
            let actArr = '', schedArr = '', actDep = '', schedDep = '';
            
            if (station.timing.length === 10) {
                actArr = station.timing.substring(0, 5);
                schedArr = station.timing.substring(5, 10);
                
                const haltMatch = station.halt.match(/(\d+)/);
                if (haltMatch) {
                    const haltMins = parseInt(haltMatch[1]);
                    const [ah, am] = actArr.split(':').map(Number);
                    const actTotal = ah * 60 + am + haltMins;
                    actDep = `${String(Math.floor(actTotal / 60) % 24).padStart(2, '0')}:${String(actTotal % 60).padStart(2, '0')}`;
                    
                    const [sh, sm] = schedArr.split(':').map(Number);
                    const schedTotal = sh * 60 + sm + haltMins;
                    schedDep = `${String(Math.floor(schedTotal / 60) % 24).padStart(2, '0')}:${String(schedTotal % 60).padStart(2, '0')}`;
                } else {
                    actDep = actArr;
                    schedDep = schedArr;
                }
            } else if (station.timing.length === 5) {
                actArr = station.timing; schedArr = station.timing;
                actDep = station.timing; schedDep = station.timing;
            } else if (isDest) {
                actArr = "End"; schedArr = "End";
                actDep = "-"; schedDep = "-";
            }
            
            if (isSource) { actArr = "-"; schedArr = "-"; }
            if (isDest) { actDep = "-"; schedDep = "-"; }

            const onTime = station.delay.toLowerCase().includes('on time');
            const delayClass = onTime ? 'ontime' : 'late';
            
            const itemClass = isCurrent ? 'tl-item current' : (isFuture ? 'tl-item future' : 'tl-item');
            const dotClass = isFuture ? 'tl-dot future' : 'tl-dot';
            const lineClass = isFuture ? 'tl-line future' : 'tl-line';

            html += `
                <div class="${itemClass}">
                    <div class="tl-col-arr">
                        ${schedArr !== '-' ? `<div class="tl-time-sched">${schedArr}</div>` : ''}
                        ${actArr !== '-' ? `<div class="tl-time-act ${delayClass}">${actArr}</div>` : ''}
                    </div>
                    
                    <div class="tl-center">
                        ${isCurrent ? `<div class="tl-train-icon"><i class="fa-solid fa-train"></i></div>` : `<div class="${dotClass}"></div>`}
                        ${index < data.data.length - 1 ? `<div class="${lineClass}"></div>` : ''}
                        
                        ${isCurrent ? `
                            <div class="tl-msg-box">
                                <span class="tl-msg-time">As of ${lastUpdate.replace('Updated ', '')}</span>
                                ${data.message}
                            </div>
                        ` : ''}
                    </div>
                    
                    <div class="tl-col-info">
                        <div class="tl-stn-name">${station.station_name} <sup>${station.platform !== '-' ? station.platform : ''}</sup></div>
                        <div class="tl-stn-meta">${station.distance !== '-' ? station.distance : '0 km'} | <span class="pf">PF #${station.platform !== '-' ? station.platform : '1'}</span></div>
                    </div>
                    
                    <div class="tl-col-dep">
                        ${schedDep !== '-' ? `<div class="tl-time-sched">${schedDep}</div>` : ''}
                        ${actDep !== '-' ? `<div class="tl-time-act ${delayClass}">${actDep}</div>` : ''}
                    </div>
                </div>
            `;
            
            // Add Next Stop Banner
            if (isCurrent && index < data.data.length - 1) {
                const nextStn = data.data[index + 1];
                html += `
                    <div class="tl-next-banner">
                        Next Stop ${nextStn.station_name.toUpperCase()} at ${nextStn.distance !== '-' ? nextStn.distance : '...'} 
                        <span class="tl-next-badge" style="background-color: ${onTime ? '#7ab360' : '#d04646'}">${station.delay}</span>
                    </div>
                `;
            }
        });
        
        html += `</div></div>`;
        document.getElementById('live-result').innerHTML = html;
    } catch (error) {
        renderError('live-result', 'Failed to fetch live status.');
    }
}

async function fetchSchedule() {
    const trainNo = document.getElementById('schedule-train-no').value.trim();
    if (!trainNo) return;
    
    showLoading('schedule-result');
    try {
        const response = await fetch(`/api/schedule?trainNo=${trainNo}`);
        const text = await response.text();
        
        if (text.includes("Error") || text.includes("not found")) {
            renderError('schedule-result', text);
            return;
        }

        // We expect raw text separated by newlines from our backend for now
        // Let's format it nicely
        const lines = text.split('\n');
        let html = `<h3>Schedule for Train ${trainNo}</h3>`;
        lines.forEach(line => {
            if(line.trim()) {
                const parts = line.split('|');
                html += `
                    <div class="status-item">
                        <div class="station">${parts[0].trim()}</div>
                        <div class="time">${parts[1] ? parts[1].trim() : ''}</div>
                    </div>
                `;
            }
        });
        
        document.getElementById('schedule-result').innerHTML = html;
    } catch (error) {
        renderError('schedule-result', 'Failed to fetch schedule.');
    }
}

async function fetchBetweenTrains() {
    const src = document.getElementById('between-src').value.trim();
    const dest = document.getElementById('between-dest').value.trim();
    if (!src || !dest) return;
    
    showLoading('between-result');
    try {
        const response = await fetch(`/api/between?from=${src}&to=${dest}`);
        const text = await response.text();
        
        if (text.includes("Error") || text.includes("No trains found")) {
            renderError('between-result', text);
            return;
        }

        const lines = text.split('\n');
        let html = `<h3>Trains from ${src.toUpperCase()} to ${dest.toUpperCase()}</h3>`;
        lines.forEach(line => {
            if(line.trim()) {
                const match = line.match(/<b>(\d{5})/);
                const tNo = match ? match[1] : '';
                html += `
                    <div class="status-item clickable-item" onclick="trackTrain('${tNo}')">
                        <div class="station">${line}</div>
                        <i class="fa-solid fa-chevron-right arrow-icon"></i>
                    </div>
                `;
            }
        });
        
        document.getElementById('between-result').innerHTML = html;
    } catch (error) {
        renderError('between-result', 'Failed to fetch trains.');
    }
}

async function fetchLiveStation() {
    const stn = document.getElementById('station-code').value.trim();
    if (!stn) return;
    
    showLoading('station-result');
    try {
        const response = await fetch(`/api/station?stn=${stn}`);
        const text = await response.text();
        
        if (text.includes("Error") || text.includes("not found")) {
            renderError('station-result', text);
            return;
        }

        const lines = text.split('\n');
        let html = `<h3>Live Board for ${stn.toUpperCase()}</h3>`;
        lines.forEach(line => {
            if(line.trim()) {
                const match = line.match(/<b>(\d{5})/);
                const tNo = match ? match[1] : '';
                html += `
                    <div class="status-item clickable-item" onclick="trackTrain('${tNo}')">
                        <div class="station">${line}</div>
                        <i class="fa-solid fa-chevron-right arrow-icon"></i>
                    </div>
                `;
            }
        });
        
        document.getElementById('station-result').innerHTML = html;
    } catch (error) {
        renderError('station-result', 'Failed to fetch live station.');
    }
}

// Global track train helper
function trackTrain(trainNo) {
    if (!trainNo) return;
    document.getElementById('live-train-no').value = trainNo;
    switchTab('spot-train', document.querySelector('.nav-links li:first-child'));
    fetchLiveStatus();
}

// Add Enter key support
document.getElementById('live-train-no').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') fetchLiveStatus();
});
document.getElementById('schedule-train-no').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') fetchSchedule();
});
