-- İlk migration'dan önce oluşturulan Auth kullanıcıları için profil üretir.
-- Tekrar çalıştırılması güvenlidir; mevcut profil ve roller değiştirilmez.
insert into public.profiles (id, display_name)
select
  users.id,
  coalesce(
    users.raw_user_meta_data ->> 'display_name',
    split_part(users.email, '@', 1)
  )
from auth.users as users
on conflict (id) do nothing;

