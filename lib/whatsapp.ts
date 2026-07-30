export const CONTACT_WHATSAPP_MESSAGE = `Selamünaleyküm, hayırlı işler.

Üç gün önce gerçekleştirdiğimiz davetimize katılarak yanımızda olduğunuz için gönülden teşekkür ederim.

Mobilya Toptan ve Perakende Komitesi için görüşebileceğinizi belirttiğiniz kişilerin yer aldığı listeyi sizinle paylaştım. Sizden ricamız, mümkün olan en kısa sürede listedeki isimlerle iletişime geçerek komitemize destek olmaları konusunda görüşmenizdir.

Devam eden süreçte, belirttiğiniz kişilere gerçekleştireceğimiz ziyaretlerde de sizi yanımızda görmekten memnuniyet duyarız.

Desteğiniz için şimdiden teşekkür eder, hayırlı günler dilerim.

Alican Yavaş
Mobilyamevime`;

export function normalizeWhatsAppNumber(value: string): string | null {
  let digits = value.replace(/\D/g, "");
  const turkishMobile = digits.match(/(?:90|0)?5\d{9}/)?.[0];
  if (turkishMobile) digits = turkishMobile;
  if (digits.startsWith("0090")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) {
    digits = `90${digits.slice(1)}`;
  } else if (digits.length === 10 && digits.startsWith("5")) {
    digits = `90${digits}`;
  }
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}

export function createWhatsAppUrl(number: string) {
  const normalized = normalizeWhatsAppNumber(number);
  if (!normalized) return null;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(CONTACT_WHATSAPP_MESSAGE)}`;
}
