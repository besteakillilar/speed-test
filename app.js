// ===== SPEED TEST APP =====
// İnternet hız testi, otomatik zamanlayıcı, Google Sheets entegrasyonu

(function () {
    'use strict';

    // ===== STATE =====
    const state = {
        isTesting: false,
        autoScheduleEnabled: false,
        scheduleInterval: null,
        todayResults: [],
        historyDateOffset: 0, // 0 = bugün, -1 = dün, -2 = önceki gün...
        config: {
            scriptUrl: '',
            emailAddress: ''
        }
    };

    // ===== SCHEDULE TIMES =====
    const SCHEDULE_TIMES = [
        { id: '0830', hour: 8, minute: 30, label: 'Sabah' },
        { id: '1430', hour: 14, minute: 30, label: 'Öğlen' },
        { id: '1730', hour: 17, minute: 30, label: 'Akşam' }
    ];

    // ===== INITIALIZATION =====
    function init() {
        loadConfig();
        loadTodayResults();
        initHistoryNav();
        startClock();
        addGaugeGradient();
        updateRating();
        updateScheduleStatuses();

        // Check if auto schedule was enabled
        const autoEnabled = localStorage.getItem('autoScheduleEnabled');
        if (autoEnabled === 'true') {
            document.getElementById('autoScheduleToggle').checked = true;
            state.autoScheduleEnabled = true;
            startScheduleChecker();
        }
    }

    // ===== CLOCK =====
    function startClock() {
        function updateClock() {
            const now = new Date();
            const h = String(now.getHours()).padStart(2, '0');
            const m = String(now.getMinutes()).padStart(2, '0');
            const s = String(now.getSeconds()).padStart(2, '0');
            document.getElementById('liveClock').textContent = `${h}:${m}:${s}`;
        }
        updateClock();
        setInterval(updateClock, 1000);
    }

    // ===== GAUGE SVG GRADIENT =====
    function addGaugeGradient() {
        const svg = document.querySelector('.gauge-svg');
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        defs.innerHTML = `
            <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#6366f1"/>
                <stop offset="50%" stop-color="#06b6d4"/>
                <stop offset="100%" stop-color="#10b981"/>
            </linearGradient>
        `;
        svg.insertBefore(defs, svg.firstChild);
    }

    // ===== SPEED TEST LOGIC =====
    // Uses multiple image downloads to estimate speed
    // This is a simplified but functional approach

    async function measurePing() {
        const pings = [];
        const testUrl = 'https://www.google.com/favicon.ico';

        for (let i = 0; i < 5; i++) {
            const start = performance.now();
            try {
                await fetch(testUrl + '?t=' + Date.now() + Math.random(), {
                    mode: 'no-cors',
                    cache: 'no-store'
                });
                const end = performance.now();
                pings.push(end - start);
            } catch (e) {
                pings.push(0);
            }
        }

        const validPings = pings.filter(p => p > 0);
        if (validPings.length === 0) return { ping: 0, jitter: 0 };

        const avgPing = validPings.reduce((a, b) => a + b, 0) / validPings.length;

        // Jitter = average deviation between consecutive pings
        let jitter = 0;
        if (validPings.length > 1) {
            let totalDiff = 0;
            for (let i = 1; i < validPings.length; i++) {
                totalDiff += Math.abs(validPings[i] - validPings[i - 1]);
            }
            jitter = totalDiff / (validPings.length - 1);
        }

        return {
            ping: Math.round(avgPing),
            jitter: Math.round(jitter * 10) / 10
        };
    }

    async function measureDownloadSpeed(onProgress) {
        // Test with multiple file sizes from Cloudflare
        const testFiles = [
            { url: 'https://speed.cloudflare.com/__down?bytes=1000000', size: 1000000 },
            { url: 'https://speed.cloudflare.com/__down?bytes=5000000', size: 5000000 },
            { url: 'https://speed.cloudflare.com/__down?bytes=10000000', size: 10000000 },
            { url: 'https://speed.cloudflare.com/__down?bytes=25000000', size: 25000000 }
        ];

        let totalBytes = 0;
        let totalTime = 0;
        let speeds = [];

        for (let i = 0; i < testFiles.length; i++) {
            const test = testFiles[i];
            try {
                const start = performance.now();
                const response = await fetch(test.url + '&t=' + Date.now(), {
                    cache: 'no-store'
                });
                const blob = await response.blob();
                const end = performance.now();

                const duration = (end - start) / 1000; // seconds
                const bytesReceived = blob.size || test.size;
                const speedMbps = (bytesReceived * 8) / (duration * 1000000);

                totalBytes += bytesReceived;
                totalTime += duration;
                speeds.push(speedMbps);

                if (onProgress) {
                    const progress = ((i + 1) / testFiles.length) * 100;
                    onProgress(speedMbps, progress);
                }
            } catch (e) {
                console.warn('Download test chunk failed:', e);
            }
        }

        if (speeds.length === 0) return 0;

        // Use higher samples average (discard warm-up)
        speeds.sort((a, b) => b - a);
        const topSpeeds = speeds.slice(0, Math.max(1, Math.ceil(speeds.length * 0.7)));
        const avgSpeed = topSpeeds.reduce((a, b) => a + b, 0) / topSpeeds.length;

        return Math.round(avgSpeed * 100) / 100;
    }

    async function measureUploadSpeed(onProgress) {
        const testSizes = [500000, 1000000, 2000000, 5000000];
        let speeds = [];

        for (let i = 0; i < testSizes.length; i++) {
            const size = testSizes[i];
            try {
                // Generate random data
                const data = new Blob([new ArrayBuffer(size)]);

                const start = performance.now();
                await fetch('https://speed.cloudflare.com/__up', {
                    method: 'POST',
                    body: data,
                    cache: 'no-store'
                });
                const end = performance.now();

                const duration = (end - start) / 1000;
                const speedMbps = (size * 8) / (duration * 1000000);
                speeds.push(speedMbps);

                if (onProgress) {
                    const progress = ((i + 1) / testSizes.length) * 100;
                    onProgress(speedMbps, progress);
                }
            } catch (e) {
                console.warn('Upload test chunk failed:', e);
            }
        }

        if (speeds.length === 0) return 0;

        speeds.sort((a, b) => b - a);
        const topSpeeds = speeds.slice(0, Math.max(1, Math.ceil(speeds.length * 0.7)));
        const avgSpeed = topSpeeds.reduce((a, b) => a + b, 0) / topSpeeds.length;

        return Math.round(avgSpeed * 100) / 100;
    }

    // ===== GAUGE ANIMATION =====
    function updateGauge(value, maxValue = 200) {
        const progress = document.getElementById('gaugeProgress');
        const totalLength = 377; // approximate arc length
        const percentage = Math.min(value / maxValue, 1);
        const offset = totalLength - (totalLength * percentage);
        progress.style.strokeDashoffset = offset;

        // Animate the number
        document.getElementById('gaugeValue').textContent = Math.round(value);
    }

    function resetGauge() {
        document.getElementById('gaugeProgress').style.strokeDashoffset = 377;
        document.getElementById('gaugeValue').textContent = '0';
    }

    // ===== MAIN TEST FUNCTION =====
    async function startSpeedTest(isAutomatic = false) {
        if (state.isTesting) return;
        state.isTesting = true;

        const btn = document.getElementById('startBtn');
        btn.classList.add('testing');
        btn.querySelector('.start-btn-text').textContent = 'TEST EDİLİYOR...';
        btn.disabled = true;

        resetGauge();
        document.getElementById('downloadSpeed').textContent = '--';
        document.getElementById('uploadSpeed').textContent = '--';
        document.getElementById('pingValue').textContent = '--';
        document.getElementById('jitterValue').textContent = '--';

        const results = {
            timestamp: new Date().toISOString(),
            time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
            date: new Date().toLocaleDateString('tr-TR'),
            type: isAutomatic ? 'Otomatik' : 'Manuel',
            download: 0,
            upload: 0,
            ping: 0,
            jitter: 0
        };

        try {
            // Phase 1: Ping
            document.getElementById('gaugeLabel').textContent = 'Ping ölçülüyor...';
            document.getElementById('pingCard').classList.add('active');
            const pingResult = await measurePing();
            results.ping = pingResult.ping;
            results.jitter = pingResult.jitter;
            document.getElementById('pingValue').textContent = results.ping;
            document.getElementById('jitterValue').textContent = results.jitter;
            document.getElementById('pingCard').classList.remove('active');
            document.getElementById('jitterCard').classList.add('active');
            await sleep(300);
            document.getElementById('jitterCard').classList.remove('active');

            // Phase 2: Download
            document.getElementById('gaugeLabel').textContent = 'İndirme hızı ölçülüyor...';
            document.getElementById('downloadCard').classList.add('active');
            results.download = await measureDownloadSpeed((speed, progress) => {
                updateGauge(speed);
                document.getElementById('downloadSpeed').textContent = speed.toFixed(1);
            });
            document.getElementById('downloadSpeed').textContent = results.download.toFixed(1);
            document.getElementById('downloadCard').classList.remove('active');
            updateGauge(results.download);
            await sleep(500);

            // Phase 3: Upload
            document.getElementById('gaugeLabel').textContent = 'Yükleme hızı ölçülüyor...';
            document.getElementById('uploadCard').classList.add('active');
            resetGauge();
            results.upload = await measureUploadSpeed((speed, progress) => {
                updateGauge(speed);
                document.getElementById('uploadSpeed').textContent = speed.toFixed(1);
            });
            document.getElementById('uploadSpeed').textContent = results.upload.toFixed(1);
            document.getElementById('uploadCard').classList.remove('active');
            updateGauge(results.upload);

            // Done
            document.getElementById('gaugeLabel').textContent = 'Test tamamlandı!';
            showToast('Hız testi başarıyla tamamlandı!', 'success');

            // Save result
            state.todayResults.push(results);
            saveTodayResults();
            updateHistoryTable();
            updateRating();

            // Send to Google Sheets
            if (state.config.scriptUrl) {
                await sendToGoogleSheets(results);
            }

        } catch (error) {
            console.error('Speed test error:', error);
            document.getElementById('gaugeLabel').textContent = 'Test başarısız oldu';
            showToast('Hız testi sırasında hata oluştu: ' + error.message, 'error');
        }

        // Reset button
        btn.classList.remove('testing');
        btn.querySelector('.start-btn-text').textContent = 'BAŞLAT';
        btn.disabled = false;
        state.isTesting = false;
    }

    // ===== GOOGLE SHEETS INTEGRATION =====
    async function sendToGoogleSheets(results) {
        if (!state.config.scriptUrl) {
            showToast('Google Sheets URL ayarlanmamış', 'warning');
            return;
        }

        try {
            const params = new URLSearchParams({
                action: 'addResult',
                date: results.date,
                time: results.time,
                type: results.type,
                download: results.download,
                upload: results.upload,
                ping: results.ping,
                jitter: results.jitter,
                rating: getRatingLabel(results.download)
            });

            const response = await fetch(state.config.scriptUrl + '?' + params.toString(), {
                method: 'GET',
                mode: 'no-cors'
            });

            showToast('Sonuçlar Google Sheets\'e gönderildi', 'success');
        } catch (error) {
            console.error('Google Sheets error:', error);
            showToast('Google Sheets\'e gönderim başarısız', 'error');
        }
    }

    // ===== SCHEDULE SYSTEM =====
    function toggleAutoSchedule() {
        const toggle = document.getElementById('autoScheduleToggle');
        state.autoScheduleEnabled = toggle.checked;
        localStorage.setItem('autoScheduleEnabled', toggle.checked);

        if (toggle.checked) {
            startScheduleChecker();
            showToast('Otomatik zamanlayıcı aktif', 'success');
        } else {
            stopScheduleChecker();
            showToast('Otomatik zamanlayıcı kapatıldı', 'info');
        }
        updateNextTestInfo();
    }

    function startScheduleChecker() {
        // Check every 30 seconds
        state.scheduleInterval = setInterval(checkSchedule, 30000);
        checkSchedule();
        updateNextTestInfo();
    }

    function stopScheduleChecker() {
        if (state.scheduleInterval) {
            clearInterval(state.scheduleInterval);
            state.scheduleInterval = null;
        }
        document.getElementById('nextTestInfo').textContent = 'Zamanlayıcı kapalı';
    }

    function checkSchedule() {
        if (!state.autoScheduleEnabled) return;

        const now = new Date();
        const currentH = now.getHours();
        const currentM = now.getMinutes();

        for (const schedule of SCHEDULE_TIMES) {
            // Check if it's the right time (within 1 minute window)
            if (currentH === schedule.hour && currentM === schedule.minute) {
                // Check if already tested this time slot today
                const todayKey = `tested_${schedule.id}_${now.toLocaleDateString('tr-TR')}`;
                if (!localStorage.getItem(todayKey)) {
                    localStorage.setItem(todayKey, 'true');
                    showToast(`${schedule.label} otomatik testi başlıyor...`, 'info');
                    startSpeedTest(true);
                    break;
                }
            }
        }

        updateScheduleStatuses();
        updateNextTestInfo();
    }

    function updateScheduleStatuses() {
        const now = new Date();
        const today = now.toLocaleDateString('tr-TR');
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        for (const schedule of SCHEDULE_TIMES) {
            const el = document.getElementById(`schedule-${schedule.id}`);
            const statusEl = document.getElementById(`status-${schedule.id}`);
            const scheduleMinutes = schedule.hour * 60 + schedule.minute;

            const todayKey = `tested_${schedule.id}_${today}`;
            const wasTested = localStorage.getItem(todayKey);

            el.classList.remove('done', 'active');

            if (wasTested) {
                el.classList.add('done');
                statusEl.textContent = 'Tamamlandı';
            } else if (state.autoScheduleEnabled && Math.abs(currentMinutes - scheduleMinutes) <= 5) {
                el.classList.add('active');
                statusEl.textContent = 'Yakında...';
            } else if (currentMinutes > scheduleMinutes) {
                statusEl.textContent = 'Kaçırıldı';
            } else {
                statusEl.textContent = 'Bekliyor';
            }
        }
    }

    function updateNextTestInfo() {
        const infoEl = document.getElementById('nextTestInfo');
        if (!state.autoScheduleEnabled) {
            infoEl.textContent = 'Zamanlayıcı kapalı';
            return;
        }

        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const today = now.toLocaleDateString('tr-TR');

        let nextTest = null;
        for (const schedule of SCHEDULE_TIMES) {
            const scheduleMinutes = schedule.hour * 60 + schedule.minute;
            const todayKey = `tested_${schedule.id}_${today}`;
            if (scheduleMinutes > currentMinutes && !localStorage.getItem(todayKey)) {
                nextTest = schedule;
                break;
            }
        }

        if (nextTest) {
            const h = String(nextTest.hour).padStart(2, '0');
            const m = String(nextTest.minute).padStart(2, '0');
            infoEl.textContent = `Sonraki test: ${h}:${m} (${nextTest.label})`;
        } else {
            infoEl.textContent = 'Bugün için tüm testler tamamlandı';
        }
    }

    // ===== RATING SYSTEM =====
    function getRatingInfo(downloadSpeed) {
        if (downloadSpeed >= 100) return { emoji: '🚀', text: 'Çok Yüksek', color: '#10b981', class: 'excellent', percent: 100 };
        if (downloadSpeed >= 50) return { emoji: '⚡', text: 'Yüksek', color: '#6366f1', class: 'good', percent: 80 };
        if (downloadSpeed >= 25) return { emoji: '👍', text: 'İyi', color: '#06b6d4', class: 'good', percent: 65 };
        if (downloadSpeed >= 10) return { emoji: '📶', text: 'Orta', color: '#f59e0b', class: 'average', percent: 45 };
        if (downloadSpeed >= 5) return { emoji: '🐌', text: 'Düşük', color: '#ef4444', class: 'poor', percent: 25 };
        return { emoji: '❌', text: 'Çok Düşük', color: '#ef4444', class: 'poor', percent: 10 };
    }

    function getRatingLabel(downloadSpeed) {
        return getRatingInfo(downloadSpeed).text;
    }

    function updateRating() {
        const results = state.todayResults;
        if (results.length === 0) {
            document.getElementById('ratingEmoji').textContent = '⏳';
            document.getElementById('ratingText').textContent = 'Test bekleniyor';
            document.getElementById('ratingBar').style.width = '0%';
            document.getElementById('ratingDetails').textContent = 'Henüz test yapılmadı';
            return;
        }

        // Average of today's downloads
        const avgDownload = results.reduce((sum, r) => sum + r.download, 0) / results.length;
        const avgUpload = results.reduce((sum, r) => sum + r.upload, 0) / results.length;
        const avgPing = results.reduce((sum, r) => sum + r.ping, 0) / results.length;

        const rating = getRatingInfo(avgDownload);

        document.getElementById('ratingEmoji').textContent = rating.emoji;
        document.getElementById('ratingText').textContent = `Hızınız: ${rating.text}`;
        document.getElementById('ratingText').style.background = `linear-gradient(135deg, ${rating.color}, ${rating.color}dd)`;
        document.getElementById('ratingText').style.webkitBackgroundClip = 'text';
        document.getElementById('ratingText').style.webkitTextFillColor = 'transparent';
        document.getElementById('ratingBar').style.width = rating.percent + '%';
        document.getElementById('ratingBar').style.background = `linear-gradient(135deg, ${rating.color}, ${rating.color}aa)`;

        document.getElementById('ratingDetails').innerHTML = `
            Ort. İndirme: <strong>${avgDownload.toFixed(1)} Mbps</strong> | 
            Ort. Yükleme: <strong>${avgUpload.toFixed(1)} Mbps</strong> | 
            Ort. Ping: <strong>${Math.round(avgPing)} ms</strong><br>
            Toplam test: <strong>${results.length}</strong>
        `;
    }

    // ===== HISTORY TABLE =====
    function getDateByOffset(offset) {
        const d = new Date();
        d.setDate(d.getDate() + offset);
        return d;
    }

    function getDateKey(offset) {
        return getDateByOffset(offset).toLocaleDateString('tr-TR');
    }

    function getResultsForDate(offset) {
        const dateKey = getDateKey(offset);
        if (offset === 0) {
            // Filter todayResults to only show results with today's date
            return state.todayResults.filter(r => r.date === dateKey);
        }
        const saved = localStorage.getItem('speedtest_results_' + dateKey);
        if (saved) {
            try {
                const allResults = JSON.parse(saved);
                // Filter by date to ensure only matching day's results
                return allResults.filter(r => r.date === dateKey);
            } catch (e) { return []; }
        }
        return [];
    }

    function getDateLabel(offset) {
        if (offset === 0) return 'Bugün';
        if (offset === -1) return 'Dün';
        const d = getDateByOffset(offset);
        const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
        return days[d.getDay()];
    }

    function initHistoryNav() {
        state.historyDateOffset = 0;
        updateHistoryDateDisplay();
    }

    function updateHistoryDateDisplay() {
        const offset = state.historyDateOffset;
        const dateLabel = document.getElementById('historyDateLabel');
        const dateValue = document.getElementById('historyDateValue');
        const prevBtn = document.getElementById('historyPrev');
        const nextBtn = document.getElementById('historyNext');

        dateLabel.textContent = getDateLabel(offset);
        dateValue.textContent = getDateKey(offset);

        // Disable next button if already at today
        nextBtn.disabled = (offset >= 0);

        // Disable prev button if going too far back (max 30 days)
        prevBtn.disabled = (offset <= -30);

        // Add/remove 'today' class for special styling
        const navDisplay = document.querySelector('.nav-date-display');
        if (offset === 0) {
            navDisplay.classList.add('is-today');
        } else {
            navDisplay.classList.remove('is-today');
        }
    }

    function navigateHistory(direction) {
        const newOffset = state.historyDateOffset + direction;
        if (newOffset > 0 || newOffset < -30) return;
        state.historyDateOffset = newOffset;
        updateHistoryDateDisplay();
        updateHistoryTable();
    }

    function updateHistoryTable() {
        const tbody = document.getElementById('historyBody');
        const results = getResultsForDate(state.historyDateOffset);

        if (results.length === 0) {
            const dateStr = getDateKey(state.historyDateOffset);
            tbody.innerHTML = `<tr class="empty-row"><td colspan="6">${dateStr} tarihinde test yapılmadı</td></tr>`;
            return;
        }

        tbody.innerHTML = results.map((r, i) => {
            const rating = getRatingInfo(r.download);
            const typeClass = r.type === 'Otomatik' ? 'badge-auto' : 'badge-manual';
            return `
                <tr>
                    <td>${r.time}</td>
                    <td><span class="badge ${typeClass}">${r.type}</span></td>
                    <td><strong>${r.download.toFixed(1)}</strong> Mbps</td>
                    <td><strong>${r.upload.toFixed(1)}</strong> Mbps</td>
                    <td>${r.ping} ms</td>
                    <td><span class="badge badge-${rating.class}">${rating.text}</span></td>
                </tr>
            `;
        }).reverse().join('');
    }

    // ===== CONFIG =====
    function loadConfig() {
        const saved = localStorage.getItem('speedtest_config');
        if (saved) {
            try {
                state.config = JSON.parse(saved);
            } catch (e) {
                console.warn('Config load error:', e);
            }
        }
    }

    // ===== LOCAL STORAGE =====
    function saveTodayResults() {
        const today = new Date().toLocaleDateString('tr-TR');
        localStorage.setItem('speedtest_results_' + today, JSON.stringify(state.todayResults));
    }

    function loadTodayResults() {
        const today = new Date().toLocaleDateString('tr-TR');
        const saved = localStorage.getItem('speedtest_results_' + today);
        if (saved) {
            try {
                const allResults = JSON.parse(saved);
                // Only keep results that match today's date
                state.todayResults = allResults.filter(r => r.date === today);
                // Re-save cleaned data
                if (state.todayResults.length !== allResults.length) {
                    saveTodayResults();
                }
                updateHistoryTable();
            } catch (e) {
                state.todayResults = [];
            }
        }
    }

    // ===== TOAST =====
    function showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('toast-out');
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    // ===== UTILS =====
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ===== EXPOSE GLOBALS =====
    window.startSpeedTest = () => startSpeedTest(false);
    window.toggleAutoSchedule = toggleAutoSchedule;
    window.navigateHistory = navigateHistory;

    // ===== START =====
    document.addEventListener('DOMContentLoaded', init);
})();
