# Alumetric Profil Katalog Görselleri (Profile Catalog Images)

Bu klasör, yazılım içindeki alüminyum profil kesitlerinin dinamik olarak yüklenip gösterilmesini sağlar. 

## Nasıl Çalışır?

Yazılım, projede seçilen profil koduna (örneğin: `70T-102-18`) göre bu klasörü kontrol eder ve eşleşen resmi yükler. Eğer resim bulunamazsa, otomatik olarak arka planda kodlanmış olan vektörel CAD çizimini (SVG) gösterir.

## Dosya Eklemek / Güncellemek

1. Katalog görsellerinizin arka planını şeffaf (PNG) yapın veya beyaz yapın.
2. Görsellerinizi, tam profil koduyla eşleşecek şekilde adlandırın:
   - `70T-102-18` için -> **`70T-102-18.png`**
   - `70T-201-18` için -> **`70T-201-18.png`**
   - `70TH-102-18` için -> **`70TH-102-18.png`**
3. Görselleri bu klasöre (`/public/profiles/`) ekleyin ve değişikliklerinizi GitHub'a yükleyin.

## Desteklenen Formatlar

* Varsayılan olarak `.png` formatı otomatik yüklenir.
* Tüm şifreler, lisanslar ve kullanıcılar için eş zamanlı olarak kalıcı hale gelir.
