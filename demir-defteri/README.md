# Demir Defteri

Beslenme günlüğü + full body antrenman programı + set sayaçlı antrenman modu. Tek dosyalık web uygulaması; veriler tarayıcının yerel depolamasında (localStorage) tutulur, JSON ile yedeklenir.

## GitHub Pages'te yayınlama

1. Bu klasördeki dosyaları deponun köküne (veya `docs/` klasörüne) koy.
2. GitHub → Settings → Pages → "Deploy from a branch" → branch `main`, klasör `/ (root)` (veya `/docs`).
3. Birkaç dakika sonra `https://<kullanıcı>.github.io/<depo>/` adresinde çalışır. Telefonda tarayıcı menüsünden "Ana ekrana ekle" ile uygulama gibi kurulur, çevrimdışı açılır.

## Yapay zeka özellikleri

Sayfa claude.ai dışında çalışırken Claude özellikleri (metin/fotoğraftan kalori, menü önerisi, koç yorumu) için Ayarlar'a kendi Anthropic API anahtarını girersin. Anahtar yalnızca tarayıcında saklanır, yedeğe yazılmaz. Anahtarsız: besin listesi, elle giriş, program ve antrenman modu tamamen çalışır.

## Supabase (bulut eşitleme + SQL)

Veriler istersen kendi Supabase projene (PostgreSQL) yazılır; cihazlar arası eşitlenir, SQL ile sorgulanır.

1. supabase.com'da proje aç.
2. SQL Editor'de `supabase.sql` dosyasını çalıştır (tablolar: `food_entries`, `weights`, `workouts`, `workout_sets`, `app_state`; görünümler: `daily_nutrition`, `exercise_progress`, `weekly_volume`, `personal_records`; satır güvenliği (RLS) açık).
3. Project Settings → API'deki Project URL ve anon public anahtarını uygulamada Ayarlar → Supabase'e gir, e-posta + şifreyle kayıt ol.
4. Her kayıt 2 sn içinde buluta gider; açılışta buluttan çekilir. Çevrimdışıyken yerelde birikir, internet gelince gönderilir.

## Ürün olarak dağıtım (giriş ekranı, kurumsal kullanım)

`index.html` içindeki `APP` bloğunu doldur: `name`, `tagline`, `company`, `supabaseUrl`, `supabaseAnonKey` ve istersen `aiProxy`. Dolu olduğunda kullanıcılar ilk ekranda e-posta + şifreyle kayıt olur / giriş yapar, kurulum sihirbazı hedefleri alır ve haftalık planı üretir; Supabase alanlarını hiç görmezler.

Yapay zekâyı kullanıcıya anahtar sordurmadan vermek için `supabase/functions/ai` fonksiyonunu kur (dosyanın başındaki adımlar): anahtar sunucuda kalır, `ai_usage` tablosu günlük limiti tutar (`AI_DAILY_LIMIT`). Sağlayıcı: DeepSeek (ucuz, metin), OpenAI (metin + fotoğraf), Anthropic. Fonksiyon adresini `APP.aiProxy`'ye yaz.

## Dil

Uygulama Türkçe ve İngilizce. İlk açılışta cihaz diline göre seçilir; giriş ekranı, kurulum ve Ayarlar → Profil'den değiştirilir. Yeni dil eklemek için `index.html` içindeki dil katmanına (EN_UI / EN_DATA bloklarının benzeri) bir sözlük eklenir.

## Mağaza paketi (Android / iOS)

`mobile/README.md`: PWABuilder ile paket (kurulumsuz) ya da Capacitor projesi (native kabuk).

## Dosyalar

- `index.html` — uygulamanın tamamı
- `manifest.webmanifest`, `sw.js`, `icon-*.png`, `apple-touch-icon.png` — PWA (ana ekrana ekleme, çevrimdışı)
- `clips/` — kendi ürettiğin hareket videoları (`tools/uret_klipler.py` ile Veo üzerinden üretilir; `clips/manifest.json` hangi hareketin videosu olduğunu söyler). Klip varsa uygulama YouTube yerine onu oynatır.
- `tools/` — klip üretme scripti ve promptlar
- `supabase.sql` — Supabase tabloları, güvenlik politikaları ve raporlama görünümleri
- `supabase/functions/ai/index.ts` — yapay zekâ vekil fonksiyonu (DeepSeek / OpenAI / Anthropic, günlük limit)
