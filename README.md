# Mobilya Takip

İTSO mobilya firma kayıtlarını Nhost PostgreSQL üzerinde yöneten Türkçe Next.js uygulamasıdır. `/records` sayfası giriş yapmadan salt okunur kullanılabilir. Nhost Auth ile giriş yapan uygulama yöneticisi kayıtları, temas sorumlularını, içe aktarmaları, arşivi ve denetim geçmişini yönetebilir.

## Yerel kurulum

1. `npm install` çalıştırın.
2. `.env.example` dosyasını `.env.local` olarak kopyalayın.
3. Nhost proje subdomain ve region değerlerini girin.
4. `npm run dev` ile uygulamayı başlatın.

```env
NEXT_PUBLIC_NHOST_SUBDOMAIN=your-nhost-subdomain
NEXT_PUBLIC_NHOST_REGION=eu-central-1
```

Bu iki değer istemci tarafında kullanılabilir. `NHOST_ADMIN_SECRET`, PostgreSQL bağlantı adresleri ve parolalar uygulama ortamına veya `NEXT_PUBLIC_*` değişkenlerine eklenmemelidir.

## Veritabanı taşıma araçları

`scripts/` altındaki taşıma araçları yalnız kontrollü geçiş ve bakım için kullanılır:

- `migrate-database-to-nhost.mjs`: uygulama tablolarını ve verileri taşır, içerik özetlerini doğrular.
- `migrate-functions-to-nhost.mjs`: RPC, optimistic locking ve audit fonksiyonlarını kurar.
- `configure-nhost-metadata.mjs`: Hasura tablo, rol ve fonksiyon izinlerini uygular.

Bu araçların kullandığı `.env.migration.local` ve `.migration-backups/` Git tarafından yok sayılır.

## Doğrulama

```powershell
npm run typecheck
npm test
npm run build
```

Production dağıtımında Vercel projesine yalnız `NEXT_PUBLIC_NHOST_SUBDOMAIN` ve `NEXT_PUBLIC_NHOST_REGION` değerlerini ekleyin. Ziyaretçi erişimi Hasura `public` rolüyle salt okunur, yönetim işlemleri özel `app_admin` rolüyle sınırlandırılmıştır.
