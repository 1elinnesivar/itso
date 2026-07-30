export const CONTACT_WHATSAPP_MESSAGE = `Selamünaleyküm, hayırlı işler.

Üç gün önce Ticaret ve Sanayi Odası seçimleriyle ilgili gerçekleştirdiğimiz davetimize katılıp yanımızda olduğunuz için çok teşekkür ederim.

Mobilya Toptan ve Perakende Komitesi için görüşebileceğinizi söylediğiniz kişilerin listesini sizinle paylaştım. Sizden ricam, *mümkün olan en kısa sürede* listedeki isimlerle iletişime geçip komitemiz için desteklerini istemeniz.

Önümüzdeki süreçte bu kişilere yapacağımız ziyaretlerde de sizi yanımızda görmek isteriz.

Desteğiniz için şimdiden teşekkür ederim. Hayırlı işler, iyi günler dilerim.

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
