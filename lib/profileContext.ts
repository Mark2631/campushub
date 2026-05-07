export type ProfileContext =
  | {
      mode: 'personal';
      businessId: null;
      businessName: null;
    }
  | {
      mode: 'business';
      businessId: string;
      businessName: string;
    };

const storageKey = 'campustrader-profile-context';

export const personalProfileContext: ProfileContext = {
  mode: 'personal',
  businessId: null,
  businessName: null,
};

export function readStoredProfileContext(): ProfileContext {
  if (typeof window === 'undefined') return personalProfileContext;

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return personalProfileContext;
    const parsed = JSON.parse(raw) as ProfileContext;
    if (parsed.mode === 'business' && parsed.businessId && parsed.businessName) {
      return parsed;
    }
  } catch (error) {
    console.error('Unable to read profile context:', error);
  }

  return personalProfileContext;
}

export function storeProfileContext(context: ProfileContext) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(storageKey, JSON.stringify(context));
}
