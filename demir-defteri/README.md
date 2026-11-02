# Demir Defteri

Beslenme günlüğü + full body antrenman programı + set sayaçlı antrenman modu. Tek dosyalık web uygulaması; veriler tarayıcının yerel depolamasında (localStorage) tutulur, JSON ile yedeklenir.

## GitHub Pages'te yayınlama

1. Bu klasördeki dosyaları deponun köküne (veya `docs/` klasörüne) koy.
2. GitHub → Settings → Pages → "Deploy from a branch" → branch `main`, klasör `/ (root)` (veya `/docs`).
3. Birkaç dakika sonra `https://<kullanıcı>.github.io/<depo>/` adresinde çalışır. Telefonda tarayıcı menüsünden "Ana ekrana ekle" ile uygulama gibi kurulur, çevrimdışı açılır.

## Yapay zeka özellikleri

Sayfa claude.ai dışında çalışırken Claude özellikleri (metin/fotoğraftan kalori, menü önerisi, koç yorumu) için Ayarlar'a kendi Anthropic API anahtarını girersin. Anahtar yalnızca tarayıcında saklanır, yedeğe yazılmaz. Anahtarsız: besin listesi, elle giriş, program ve antrenman modu tamamen çalışır.

## Dosyalar

- `index.html` — uygulamanın tamamı
- `manifest.webmanifest`, `sw.js`, `icon-*.png`, `apple-touch-icon.png` — PWA (ana ekrana ekleme, çevrimdışı)
- `clips/` — kendi ürettiğin hareket videoları (`tools/uret_klipler.py` ile Veo üzerinden üretilir; `clips/manifest.json` hangi hareketin videosu olduğunu söyler). Klip varsa uygulama YouTube yerine onu oynatır.
- `tools/` — klip üretme scripti ve promptlar
