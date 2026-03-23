

// Sheet adları
const SHEET_NAME = 'Hız Testleri';
const CONFIG_SHEET = 'Ayarlar';

// ===== WEB APP ENDPOINT =====
function doGet(e) {
  try {
    const action = e.parameter.action;

    switch (action) {
      case 'addResult':
        return addResult(e.parameter);
      case 'getResults':
        return getResults(e.parameter);
      case 'test':
        return ContentService.createTextOutput(JSON.stringify({ status: 'ok' }))
          .setMimeType(ContentService.MimeType.JSON);
      default:
        return ContentService.createTextOutput(JSON.stringify({ status: 'ok', message: 'Speed Test API' }))
          .setMimeType(ContentService.MimeType.JSON);
    }
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  return doGet(e);
}

// ===== SONUÇ EKLEME =====
function addResult(params) {
  const sheet = getOrCreateSheet();

  const row = [
    params.date || new Date().toLocaleDateString('tr-TR'),
    params.time || new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
    params.type || 'Manuel',
    parseFloat(params.download) || 0,
    parseFloat(params.upload) || 0,
    parseInt(params.ping) || 0,
    parseFloat(params.jitter) || 0,
    params.rating || '',
    new Date().toISOString()
  ];

  sheet.appendRow(row);

  // Satırı renklendir
  const lastRow = sheet.getLastRow();
  const download = parseFloat(params.download) || 0;

  if (download >= 100) {
    sheet.getRange(lastRow, 1, 1, 9).setBackground('#d1fae5'); // Yeşil
  } else if (download >= 50) {
    sheet.getRange(lastRow, 1, 1, 9).setBackground('#e0e7ff'); // Mavi
  } else if (download >= 25) {
    sheet.getRange(lastRow, 1, 1, 9).setBackground('#dbeafe'); // Açık mavi
  } else if (download >= 10) {
    sheet.getRange(lastRow, 1, 1, 9).setBackground('#fef3c7'); // Sarı
  } else {
    sheet.getRange(lastRow, 1, 1, 9).setBackground('#fee2e2'); // Kırmızı
  }

  return ContentService.createTextOutput(JSON.stringify({
    status: 'ok',
    message: 'Sonuç eklendi',
    row: lastRow
  })).setMimeType(ContentService.MimeType.JSON);
}

// ===== SONUÇLARI GETIR =====
function getResults(params) {
  const sheet = getOrCreateSheet();
  const data = sheet.getDataRange().getValues();

  // Header'ı atla
  const results = data.slice(1).map(row => ({
    date: row[0],
    time: row[1],
    type: row[2],
    download: row[3],
    upload: row[4],
    ping: row[5],
    jitter: row[6],
    rating: row[7]
  }));

  return ContentService.createTextOutput(JSON.stringify({
    status: 'ok',
    results: results
  })).setMimeType(ContentService.MimeType.JSON);
}

// ===== SHEET OLUŞTUR =====
function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);

    // Başlıkları ekle
    const headers = ['Tarih', 'Saat', 'Tür', 'İndirme (Mbps)', 'Yükleme (Mbps)', 'Ping (ms)', 'Jitter (ms)', 'Değerlendirme', 'Zaman Damgası'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

    // Başlık stilini ayarla
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground('#1a1a2e');
    headerRange.setFontColor('#ffffff');
    headerRange.setFontWeight('bold');
    headerRange.setFontSize(11);
    headerRange.setHorizontalAlignment('center');

    // Sütun genişliklerini ayarla
    sheet.setColumnWidth(1, 110);  // Tarih
    sheet.setColumnWidth(2, 80);   // Saat
    sheet.setColumnWidth(3, 90);   // Tür
    sheet.setColumnWidth(4, 130);  // İndirme
    sheet.setColumnWidth(5, 130);  // Yükleme
    sheet.setColumnWidth(6, 90);   // Ping
    sheet.setColumnWidth(7, 90);   // Jitter
    sheet.setColumnWidth(8, 120);  // Değerlendirme
    sheet.setColumnWidth(9, 180);  // Zaman Damgası

    // Satırları dondur
    sheet.setFrozenRows(1);
  }

  return sheet;
}



function sendDailyReport() {
  const sheet = getOrCreateSheet();
  const data = sheet.getDataRange().getValues();

  // E-posta adresini ayarlardan al veya burada belirle
  const EMAIL = getEmailAddress();
  if (!EMAIL) {
    Logger.log('E-posta adresi bulunamadı');
    return;
  }

  // Bugünün verilerini filtrele
  const today = new Date().toLocaleDateString('tr-TR');
  const todayResults = data.slice(1).filter(row => row[0] === today);

  if (todayResults.length === 0) {
    // Bugün test yapılmamışsa bilgi maili gönder
    MailApp.sendEmail({
      to: EMAIL,
      subject: `🌐 Hız Testi Günlük Raporu - ${today}`,
      htmlBody: createNoTestEmail(today)
    });
    return;
  }

  // İstatistikleri hesapla
  const downloads = todayResults.map(r => parseFloat(r[3]) || 0);
  const uploads = todayResults.map(r => parseFloat(r[4]) || 0);
  const pings = todayResults.map(r => parseInt(r[5]) || 0);

  const stats = {
    avgDownload: (downloads.reduce((a, b) => a + b, 0) / downloads.length).toFixed(1),
    maxDownload: Math.max(...downloads).toFixed(1),
    minDownload: Math.min(...downloads).toFixed(1),
    avgUpload: (uploads.reduce((a, b) => a + b, 0) / uploads.length).toFixed(1),
    maxUpload: Math.max(...uploads).toFixed(1),
    minUpload: Math.min(...uploads).toFixed(1),
    avgPing: Math.round(pings.reduce((a, b) => a + b, 0) / pings.length),
    testCount: todayResults.length
  };

  // Değerlendirme
  const avgDl = parseFloat(stats.avgDownload);
  let ratingEmoji, ratingText, ratingColor;

  if (avgDl >= 100) { ratingEmoji = '🚀'; ratingText = 'Çok Yüksek'; ratingColor = '#10b981'; }
  else if (avgDl >= 50) { ratingEmoji = '⚡'; ratingText = 'Yüksek'; ratingColor = '#6366f1'; }
  else if (avgDl >= 25) { ratingEmoji = '👍'; ratingText = 'İyi'; ratingColor = '#06b6d4'; }
  else if (avgDl >= 10) { ratingEmoji = '📶'; ratingText = 'Orta'; ratingColor = '#f59e0b'; }
  else if (avgDl >= 5) { ratingEmoji = '🐌'; ratingText = 'Düşük'; ratingColor = '#ef4444'; }
  else { ratingEmoji = '❌'; ratingText = 'Çok Düşük'; ratingColor = '#ef4444'; }

  // HTML e-posta oluştur
  const htmlBody = createEmailHTML(today, todayResults, stats, ratingEmoji, ratingText, ratingColor);

  MailApp.sendEmail({
    to: EMAIL,
    subject: `${ratingEmoji} Hız Testi Raporu - ${today} | Hızınız: ${ratingText} (${stats.avgDownload} Mbps)`,
    htmlBody: htmlBody
  });

  Logger.log('Günlük rapor gönderildi: ' + EMAIL);
}

// ===== E-POSTA ADRESINI AL =====
function getEmailAddress() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let configSheet = ss.getSheetByName(CONFIG_SHEET);

  if (!configSheet) {
    configSheet = ss.insertSheet(CONFIG_SHEET);
    configSheet.getRange('A1').setValue('E-posta Adresi');
    configSheet.getRange('B1').setValue(''); // Buraya e-posta adresinizi yazın
    configSheet.getRange('A1').setFontWeight('bold');
    return null;
  }

  return configSheet.getRange('B1').getValue();
}

// ===== E-POSTA HTML ŞABLONU =====
function createEmailHTML(date, results, stats, emoji, ratingText, color) {
  let tableRows = results.map(r => {
    // Google Sheets saati Date objesi olarak döndürürse formatla (Date -> HH:mm)
    let timeStr = r[1];
    if (timeStr instanceof Date) {
      timeStr = Utilities.formatDate(timeStr, Session.getScriptTimeZone(), "HH:mm");
    }

    return `
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:14px;">${timeStr}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:14px;">
        <span style="background:${r[2] === 'Otomatik' ? '#dbeafe' : '#ede9fe'};color:${r[2] === 'Otomatik' ? '#3b82f6' : '#7c3aed'};padding:3px 10px;border-radius:12px;font-size:12px;font-weight:600;">${r[2]}</span>
      </td>
      <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:14px;font-weight:600;">${parseFloat(r[3]).toFixed(1)} Mbps</td>
      <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:14px;font-weight:600;">${parseFloat(r[4]).toFixed(1)} Mbps</td>
      <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:14px;">${r[5]} ms</td>
      <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:14px;">${r[7]}</td>
    </tr>
  `}).join('');

  return `
  <!DOCTYPE html>
  <html>
  <head><meta charset="UTF-8"></head>
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
    <div style="max-width:650px;margin:20px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
      
      <!-- Header -->
      <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);padding:30px 32px;text-align:center;">
        <h1 style="margin:0 0 8px;color:white;font-size:22px;font-weight:700;">🌐 İnternet Hız Testi Raporu</h1>
        <p style="margin:0;color:#94a3b8;font-size:14px;">${date}</p>
      </div>
      
      <!-- Rating Banner -->
      <div style="background:linear-gradient(135deg,${color}15,${color}08);padding:24px 32px;text-align:center;border-bottom:1px solid #e2e8f0;">
        <div style="font-size:48px;margin-bottom:8px;">${emoji}</div>
        <h2 style="margin:0 0 4px;color:${color};font-size:26px;font-weight:800;">Hızınız: ${ratingText}</h2>
        <p style="margin:0;color:#64748b;font-size:14px;">Ortalama İndirme: ${stats.avgDownload} Mbps</p>
      </div>
      
      <!-- Stats Grid -->
      <div style="padding:24px 32px;display:flex;flex-wrap:wrap;gap:12px;">
        <div style="flex:1;min-width:140px;background:#f8fafc;border-radius:12px;padding:16px;text-align:center;">
          <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Ort. İndirme</div>
          <div style="font-size:24px;font-weight:700;color:#6366f1;">${stats.avgDownload} <span style="font-size:12px;color:#94a3b8;">Mbps</span></div>
          <div style="font-size:11px;color:#94a3b8;margin-top:4px;">Min: ${stats.minDownload} / Max: ${stats.maxDownload}</div>
        </div>
        <div style="flex:1;min-width:140px;background:#f8fafc;border-radius:12px;padding:16px;text-align:center;">
          <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Ort. Yükleme</div>
          <div style="font-size:24px;font-weight:700;color:#06b6d4;">${stats.avgUpload} <span style="font-size:12px;color:#94a3b8;">Mbps</span></div>
          <div style="font-size:11px;color:#94a3b8;margin-top:4px;">Min: ${stats.minUpload} / Max: ${stats.maxUpload}</div>
        </div>
        <div style="flex:1;min-width:140px;background:#f8fafc;border-radius:12px;padding:16px;text-align:center;">
          <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Ort. Ping</div>
          <div style="font-size:24px;font-weight:700;color:#10b981;">${stats.avgPing} <span style="font-size:12px;color:#94a3b8;">ms</span></div>
          <div style="font-size:11px;color:#94a3b8;margin-top:4px;">Toplam test: ${stats.testCount}</div>
        </div>
      </div>
      
      <!-- Results Table -->
      <div style="padding:0 32px 24px;">
        <h3 style="margin:0 0 12px;font-size:15px;color:#1e293b;font-weight:600;">📋 Test Detayları</h3>
        <table style="width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden;">
          <thead>
            <tr style="background:#f8fafc;">
              <th style="padding:10px 16px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Saat</th>
              <th style="padding:10px 16px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Tür</th>
              <th style="padding:10px 16px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">İndirme</th>
              <th style="padding:10px 16px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Yükleme</th>
              <th style="padding:10px 16px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Ping</th>
              <th style="padding:10px 16px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Durum</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </div>
      
      <!-- Footer -->
      <div style="background:#f8fafc;padding:16px 32px;text-align:center;border-top:1px solid #e2e8f0;">
        <p style="margin:0;font-size:12px;color:#94a3b8;">Bu rapor otomatik olarak oluşturulmuştur.</p>
      </div>
    </div>
  </body>
  </html>
  `;
}

function createNoTestEmail(date) {
  return `
  <!DOCTYPE html>
  <html>
  <head><meta charset="UTF-8"></head>
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
    <div style="max-width:500px;margin:20px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);text-align:center;padding:40px;">
      <div style="font-size:48px;margin-bottom:16px;">📭</div>
      <h2 style="margin:0 0 8px;color:#1e293b;font-size:20px;">Bugün Test Yapılmadı</h2>
      <p style="margin:0;color:#64748b;font-size:14px;">${date} tarihinde hiç hız testi kaydı bulunamadı.</p>
    </div>
  </body>
  </html>
  `;
}



function setupDailyTrigger() {
  // Mevcut tetikleyicileri temizle
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'sendDailyReport') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // Günlük 18:00-19:00 arası tetikleyici kur
  ScriptApp.newTrigger('sendDailyReport')
    .timeBased()
    .everyDays(1)
    .atHour(18)
    .create();

  Logger.log('Günlük rapor tetikleyicisi kuruldu (18:00-19:00)');
}
