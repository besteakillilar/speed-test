# 🌐 İnternet Hız Testi - Kurulum Rehberi

## 📁 Dosya Yapısı

```
speed test/
├── index.html              → Ana sayfa (tarayıcıda açın)
├── style.css               → Tasarım dosyası
├── app.js                  → Uygulama mantığı
├── google-apps-script.js   → Google Apps Script kodu (kopyalanacak)
└── KURULUM-REHBERI.md      → Bu dosya
```

---

## 🚀 1. ADIM - Hız Testini Kullanma

1. `index.html` dosyasını tarayıcınızda açın (Chrome önerilir)
2. **BAŞLAT** butonuna tıklayarak manuel test yapabilirsiniz
3. Test sonuçları otomatik olarak sayfada görüntülenir

---

## 📊 2. ADIM - Google Sheets Entegrasyonu

### Google Sheets Hazırlığı:

1. [Google Sheets](https://sheets.google.com) açın ve **yeni bir boş tablo** oluşturun
2. Tabloya bir isim verin: örn. **"İnternet Hız Testleri"**

### Apps Script Kurulumu:

3. Tabloda: **Uzantılar → Apps Script** menüsüne tıklayın
4. Açılan editörde varsayılan kodu **tamamen silin**
5. `google-apps-script.js` dosyasındaki **tüm kodu kopyalayıp yapıştırın**
6. **💾 Kaydet** butonuna tıklayın (Ctrl+S)

### Web Uygulaması Olarak Yayınlama:

7. **Dağıt → Yeni dağıtım** menüsüne tıklayın
8. Sol üstteki ⚙️ simgesinden **"Web uygulaması"** seçin
9. Ayarlar:
   - **Açıklama**: Hız Testi API
   - **Şu kullanıcı olarak çalıştır**: Ben
   - **Erişimi olan kullanıcılar**: **Herkes** (önemli!)
10. **Dağıt** butonuna tıklayın
11. İzin isterse **İzin Ver** → hesabınızı seçin → **Gelişmiş** → **Güvensiz git** → **İzin Ver**
12. Verilen URL'yi **kopyalayın** (https://script.google.com/macros/s/.../exec)

### Speed Test Sayfasında Ayar:

13. Speed Test sayfasında **⚙️ Ayarlar** bölümünü açın
14. **Google Apps Script URL** alanına kopyaladığınız URL'yi yapıştırın
15. **E-posta Adresi** alanına günlük rapor alacağınız e-postayı yazın
16. **Kaydet** butonuna tıklayın
17. **Bağlantıyı Test Et** butonuyla kontrol edin

---

## ⏰ 3. ADIM - Otomatik Zamanlayıcı

### Tarayıcı Tabanlı Zamanlayıcı (Sayfa açıkken):
1. Speed Test sayfasında **Otomatik Zamanlayıcı** toggle'ını açın
2. Sayfa açık kaldığı sürece şu saatlerde otomatik test yapılır:
   - **08:30** - Sabah testi
   - **14:30** - Öğlen testi
   - **17:30** - Akşam testi

> ⚠️ **Not**: Otomatik testlerin çalışması için sayfanın tarayıcıda açık kalması gerekir!
> Bilgisayarınızı açtığınızda bu sayfayı açık bırakın.

---

## 📧 4. ADIM - Günlük E-posta Raporu

### E-posta Adresini Ayarlama:

1. Google Sheets tablonuzda **"Ayarlar"** sayfası otomatik oluşturulacak
2. Bu sayfada **B1** hücresine e-posta adresinizi yazın.

### Otomatik E-posta Tetikleyicisi:

3. Apps Script editöründe üst menüden fonksiyon seçicisinden **`setupDailyTrigger`** fonksiyonunu seçin
4. **▶ Çalıştır** butonuna tıklayın
5. İzin isterse onaylayın
6. Bu kadar! Tetikleyici otomatik olarak kurulur ve her gün **18:00-19:00** arası e-posta gönderilir

> ✅ `setupDailyTrigger()` fonksiyonu çalıştırıldığında, günlük e-posta tetikleyicisi
> otomatik olarak oluşturulur. Manuel tetikleyici eklemeye gerek yoktur.

---

## ⭐ Hız Değerlendirme Ölçeği

| İndirme Hızı | Değerlendirme | Emoji |
|:---:|:---:|:---:|
| 100+ Mbps | Çok Yüksek | 🚀 |
| 50-99 Mbps | Yüksek | ⚡ |
| 25-49 Mbps | İyi | 👍 |
| 10-24 Mbps | Orta | 📶 |
| 5-9 Mbps | Düşük | 🐌 |
| 0-4 Mbps | Çok Düşük | ❌ |

---

## 📋 E-posta Rapor İçeriği

Günlük rapor şunları içerir:
- 📊 Günün genel değerlendirmesi (ör: "Hızınız: Yüksek")
- 📈 Ortalama, minimum ve maksimum indirme/yükleme hızları
- 📋 Her testin detaylı tablosu (saat, tür, hızlar, ping)
- 🎨 Renkli ve profesyonel HTML e-posta tasarımı

---

## 🔧 Sorun Giderme

| Sorun | Çözüm |
|---|---|
| Google Sheets'e veri gitmiyor | URL'yi kontrol edin, "Herkes" erişimi aktif mi? |
| 403/400 hatası | Apps Script'i yeniden dağıtın (yeni sürüm) |
| Otomatik test çalışmıyor | Sayfanın tarayıcıda açık olduğundan emin olun |
| E-posta gelmiyor | Ayarlar sayfasındaki B1 hücresini kontrol edin |
| CORS hatası | Script URL'sinin /exec ile bittiğinden emin olun |
