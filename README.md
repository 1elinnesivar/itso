# Mobilya Takip

İTSO mobilya firma kayıtlarını Supabase PostgreSQL üzerinde yöneten Türkçe Next.js uygulamasıdır. `/records` sayfası giriş yapmadan güvenli, salt okunur özet sunar. Supabase Auth ile giriş yapan yönetici kayıtları, temas sorumlularını, içe aktarmaları, arşivi ve denetim geçmişini yönetebilir.

## Yerel kurulum

1. `npm install` çalıştırın.
2. `.env.example` dosyasını `.env.local` olarak kopyalayın.
3. Supabase proje URL ve publishable key değerlerini girin.
4. Migration dosyalarını zaman sırasıyla uygulayın.
5. `npm run dev` ile uygulamayı başlatın.

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

`Service Role Key`, PostgreSQL bağlantı adresleri ve parolalar uygulama ortamına veya `NEXT_PUBLIC_*` değişkenlerine eklenmemelidir.

## Veritabanı

Şema, RLS politikaları, RPC işlemleri ve Realtime yayını `supabase/migrations/` altında tutulur. Migration’ları dosya adı sırasıyla uygulayın. Yerel geri yükleme aracı `scripts/restore-backup-to-supabase.mjs`, yalnız Git tarafından yok sayılan `.env.migration.local` ve `.migration-backups/` ile çalışır.

## Doğrulama

```powershell
npm run typecheck
npm test
npm run build
```

Production dağıtımında Vercel’e yalnız Supabase URL ve publishable key eklenir. Yazma işlemleri oturum, RLS, rol kontrollü RPC’ler ve optimistic locking ile korunur.
