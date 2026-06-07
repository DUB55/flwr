export type Language = 'en' | 'nl';

interface Translations {
  [key: string]: string;
}

let currentLanguage: Language = 'en';
let translations: Translations = {};

export const loadTranslations = async (lang: Language): Promise<void> => {
  try {
    const response = await fetch(`/i18n/${lang}.csv`);
    const csvText = await response.text();
    
    translations = {};
    const lines = csvText.split('\n');
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const [id, text] = line.split(',');
      if (id && text) {
        translations[id] = text;
      }
    }
    
    currentLanguage = lang;
  } catch (error) {
    console.error('Failed to load translations:', error);
  }
};

export const setLanguage = (lang: Language): void => {
  currentLanguage = lang;
  loadTranslations(lang);
};

export const getLanguage = (): Language => currentLanguage;

export const t = (id: string): string => {
  return translations[id] || id;
};

export const toggleLanguage = (): void => {
  const newLang: Language = currentLanguage === 'en' ? 'nl' : 'en';
  setLanguage(newLang);
};
