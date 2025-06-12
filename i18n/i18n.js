/**
 * Trilium Web Clipper i18n System
 * Supports internationalization with browser language detection and fallback
 */

class I18n {
    constructor() {
        this.currentLanguage = 'en';
        this.fallbackLanguage = 'en';
        this.translations = {};
        this.supportedLanguages = ['en', 'zh'];
    }

    /**
     * Initialize i18n system
     */
    async init() {
        // Get saved language preference or detect browser language
        const savedLanguage = await this.getSavedLanguage();
        const browserLanguage = this.detectBrowserLanguage();
        
        this.currentLanguage = savedLanguage || browserLanguage || this.fallbackLanguage;
        
        // Load translations
        await this.loadTranslations();
        
        // Apply translations to current page
        this.applyTranslations();
    }

    /**
     * Detect browser language
     */
    detectBrowserLanguage() {
        // Check if navigator is available (not available in some environments like Service Workers)
        if (typeof navigator === 'undefined') {
            return this.fallbackLanguage;
        }

        const browserLang = navigator.language || navigator.userLanguage;
        if (!browserLang) {
            return this.fallbackLanguage;
        }

        const langCode = browserLang.split('-')[0].toLowerCase();

        return this.supportedLanguages.includes(langCode) ? langCode : this.fallbackLanguage;
    }

    /**
     * Get saved language from storage
     */
    async getSavedLanguage() {
        try {
            if (typeof browser !== 'undefined' && browser.storage) {
                const result = await browser.storage.sync.get('language');
                return result.language;
            }
        } catch (error) {
            console.warn('Failed to get saved language:', error);
        }
        return null;
    }

    /**
     * Save language preference
     */
    async saveLanguage(language) {
        try {
            if (typeof browser !== 'undefined' && browser.storage) {
                await browser.storage.sync.set({ language: language });
            }
        } catch (error) {
            console.warn('Failed to save language:', error);
        }
    }

    /**
     * Load translations for current language
     */
    async loadTranslations() {
        try {
            // Load current language
            const currentLangUrl = browser.runtime.getURL(`i18n/locales/${this.currentLanguage}.json`);
            const currentResponse = await fetch(currentLangUrl);
            const currentTranslations = await currentResponse.json();
            
            // Load fallback language if different
            let fallbackTranslations = {};
            if (this.currentLanguage !== this.fallbackLanguage) {
                const fallbackLangUrl = browser.runtime.getURL(`i18n/locales/${this.fallbackLanguage}.json`);
                const fallbackResponse = await fetch(fallbackLangUrl);
                fallbackTranslations = await fallbackResponse.json();
            }
            
            // Merge translations with fallback
            this.translations = { ...fallbackTranslations, ...currentTranslations };
        } catch (error) {
            console.error('Failed to load translations:', error);
            // If loading fails, try to load fallback
            if (this.currentLanguage !== this.fallbackLanguage) {
                try {
                    const fallbackLangUrl = browser.runtime.getURL(`i18n/locales/${this.fallbackLanguage}.json`);
                    const fallbackResponse = await fetch(fallbackLangUrl);
                    this.translations = await fallbackResponse.json();
                } catch (fallbackError) {
                    console.error('Failed to load fallback translations:', fallbackError);
                }
            }
        }
    }

    /**
     * Get translated text
     */
    t(key, params = {}) {
        let text = this.translations[key] || key;
        
        // Replace parameters
        Object.keys(params).forEach(param => {
            text = text.replace(new RegExp(`\\{${param}\\}`, 'g'), params[param]);
        });
        
        return text;
    }

    /**
     * Apply translations to DOM elements with data-i18n attribute
     */
    applyTranslations() {
        // Check if we're in an environment with DOM access
        if (typeof document === 'undefined') {
            // Skip DOM operations in environments like Service Workers
            return;
        }

        const elements = document.querySelectorAll('[data-i18n]');
        elements.forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translatedText = this.t(key);

            // Handle different element types
            if (element.tagName === 'INPUT' && (element.type === 'submit' || element.type === 'button')) {
                element.value = translatedText;
            } else if (element.tagName === 'INPUT' && element.placeholder !== undefined) {
                element.placeholder = translatedText;
            } else {
                element.textContent = translatedText;
            }
        });
    }

    /**
     * Change language
     */
    async changeLanguage(language) {
        if (!this.supportedLanguages.includes(language)) {
            console.warn(`Unsupported language: ${language}`);
            return;
        }
        
        this.currentLanguage = language;
        await this.saveLanguage(language);
        await this.loadTranslations();
        this.applyTranslations();
    }

    /**
     * Get current language
     */
    getCurrentLanguage() {
        return this.currentLanguage;
    }

    /**
     * Get supported languages
     */
    getSupportedLanguages() {
        return this.supportedLanguages;
    }
}

// Global i18n instance
let i18nInstance = null;

/**
 * Initialize i18n system
 */
async function initI18n() {
    if (!i18nInstance) {
        i18nInstance = new I18n();
        await i18nInstance.init();
    }
    return i18nInstance;
}

/**
 * Get translation function
 */
function t(key, params = {}) {
    if (!i18nInstance) {
        console.warn('i18n not initialized, returning key:', key);
        return key;
    }
    return i18nInstance.t(key, params);
}

/**
 * Change language
 */
async function changeLanguage(language) {
    if (!i18nInstance) {
        await initI18n();
    }
    return i18nInstance.changeLanguage(language);
}

/**
 * Get current language
 */
function getCurrentLanguage() {
    return i18nInstance ? i18nInstance.getCurrentLanguage() : 'en';
}

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { initI18n, t, changeLanguage, getCurrentLanguage };
} else if (typeof window !== 'undefined') {
    window.initI18n = initI18n;
    window.t = t;
    window.changeLanguage = changeLanguage;
    window.getCurrentLanguage = getCurrentLanguage;
}
