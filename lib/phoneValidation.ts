const kenyaPhonePattern = /^(?:\+254|0)?[1-9]\d{8}$/;

export const KENYAN_PHONE_ERROR = 'Use format +254712345678 or 0712345678';

export function normalizeKenyanPhone(value: string) {
  const compact = value.trim().replace(/[\s()-]/g, '');
  if (!kenyaPhonePattern.test(compact)) return null;
  if (compact.startsWith('+254')) return compact;
  if (compact.startsWith('0')) return `+254${compact.slice(1)}`;
  return `+254${compact}`;
}

export function isValidKenyanPhone(value: string) {
  return normalizeKenyanPhone(value) !== null;
}

export function validateKenyanPhone(value: string) {
  return normalizeKenyanPhone(value) ? null : KENYAN_PHONE_ERROR;
}

export default normalizeKenyanPhone;

// Keep the pattern intentionally limited to Kenyan mobile numbers for WhatsApp contact consistency.

