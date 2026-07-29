# Mobilya Takip

Excel tabanlı mobilya üye kayıtlarını Supabase üzerinde çok kullanıcılı olarak yöneten Türkçe Next.js uygulaması.

Paylaşılan `/records` bağlantısı giriş yapmadan güvenli, salt okunur özet sunar.
Anonim görünüm yalnız sıra, unvan, durum, meslek grubu, mahalle ve satır rengini
gösterir. Telefon, açık adres, yetkili/temas isimleri ve notlar yalnız giriş yapan
kullanıcılara görünür. Admin ve editör işlemleri Supabase Auth oturumu, RPC rol
kontrolleri ve RLS ile korunur.

## Yerel kurulum

1. `npm install` çalıştırın.
2. `.env.example` dosyasını `.env.local` olarak kopyalayın ve Supabase proje URL’si ile publishable key’i girin.
3. `supabase/migrations/` altındaki migration’ları dosya adı sırasıyla Supabase projesine uygulayın.
4. Supabase Dashboard → Authentication üzerinden kullanıcı oluşturun.
5. İlk admin rolünü SQL Editor üzerinden atayın:

   ```sql
   update public.profiles
   set role = 'admin'
   where id = '<auth-user-uuid>';
   ```

6. `npm run dev` ile uygulamayı açın. Admin hesabıyla **İçe Aktar** ekranına gidip yerel `mobilya-takip.xlsx` dosyasını seçin. Önizleme 390 kayıt gösterdikten sonra aktarımı onaylayın.

## Ortam değişkenleri

Yalnız aşağıdaki istemci-güvenli değerler kullanılır:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

Service Role Key uygulama tarafından kullanılmaz ve Vercel istemci ortamına eklenmemelidir.

## Doğrulama

```powershell
npm run typecheck
npm test
npm run build
```

Production’da Vercel projesini private GitHub deposuna bağlayın, iki ortam değişkenini tanımlayın ve Supabase Auth URL Configuration bölümüne Vercel alan adını ekleyin.
