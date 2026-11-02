# Demir Defteri — mağaza paketi

İki yol var; ikisi de aynı web kodunu (`../site`) paketler.

## A) PWABuilder (kurulum yok, 10 dakika)
1. Siteyi yayınla (GitHub Pages ya da kendi alan adın). `index.html` içindeki `APP` bloğu dolu olsun.
2. https://www.pwabuilder.com → site adresini gir → **Package for stores** → Android (Google Play) paketini indir (.aab + imzalama anahtarı). iOS için de Xcode projesi üretir.
3. Google Play Console'da uygulama oluştur, .aab'yi yükle. Not: tarayıcı çubuğunun görünmemesi için PWABuilder'ın verdiği `assetlinks.json` dosyasını sitenin kökünde `/.well-known/assetlinks.json` olarak yayınla (kendi alan adı gerekir; `kullanici.github.io/depo/` altında bu dosya köke konamaz).

## B) Capacitor (tam native kabuk, bildirim/arka plan eklentileri için)
Gereken: Node 18+, Android Studio (Android), Xcode (iOS, yalnız Mac).
```
cd mobile
npm install
npm run sync:www          # ../site → www
npx cap add android       # bir kez
npm run build:android     # www'yi senkronlar ve Android Studio'yu açar → Build → Generate Signed Bundle (.aab)
```
iOS için `npx cap add ios` ve `npm run build:ios` (Xcode'da imzala ve App Store Connect'e gönder).

Mağaza için ayrıca gerekir: gizlilik politikası sayfası (sağlık verisi işlendiği için zorunlu), 512×512 ikon, en az 2 ekran görüntüsü (telefon), kısa/uzun açıklama (TR + EN), veri güvenliği formu (Play Console: "veriler şifreli aktarılır, kullanıcı silebilir").
