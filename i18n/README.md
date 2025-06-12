# Trilium Web Clipper Plus i18n System

This directory contains the internationalization (i18n) system for the Trilium Web Clipper Plus extension.

## Features

- **Automatic Language Detection**: Detects browser language and uses it as default
- **Fallback Support**: Falls back to English if the detected language is not supported
- **Dynamic Language Switching**: Users can change language in the options page
- **Persistent Settings**: Language preference is saved to browser storage
- **Parameter Substitution**: Supports dynamic text with parameters (e.g., `{port}`, `{error}`)

## Supported Languages

- **English (en)**: Default and fallback language
- **Chinese (zh)**: Simplified Chinese

## File Structure

```
i18n/
├── i18n.js              # Core i18n functionality
├── locales/
│   ├── en.json          # English translations
│   └── zh.json          # Chinese translations
└── README.md            # This file
```

## Usage

### In HTML Files

Add `data-i18n` attributes to elements that need translation:

```html
<h1 data-i18n="app_title">Trilium Web Clipper Plus</h1>
<button data-i18n="save">Save</button>
<input type="submit" data-i18n="login_server" value="Login to the server instance"/>
```

### In JavaScript Files

1. **Initialize i18n system**:
```javascript
await initI18n();
```

2. **Get translated text**:
```javascript
const title = t('app_title');
const message = t('version_mismatch', {whatToUpgrade: 'Trilium Notes'});
```

3. **Change language**:
```javascript
await changeLanguage('zh');
```

4. **Get current language**:
```javascript
const currentLang = getCurrentLanguage();
```

## Adding New Languages

1. Create a new JSON file in `locales/` directory (e.g., `fr.json` for French)
2. Copy the structure from `en.json` and translate all values
3. Add the language code to `supportedLanguages` array in `i18n.js`
4. Update the language selector in `options.html`

## Adding New Translation Keys

1. Add the key-value pair to all language files in `locales/`
2. Use the key in HTML with `data-i18n` attribute or in JavaScript with `t()` function

## Parameter Substitution

Use curly braces for parameters in translation values:

```json
{
  "version_mismatch": "Please update {whatToUpgrade} to the latest version.",
  "connected_port": "Connected on port {port}"
}
```

Use in JavaScript:
```javascript
t('version_mismatch', {whatToUpgrade: 'Trilium Notes'});
t('connected_port', {port: 37740});
```

## Browser Compatibility

The i18n system works in:
- Chrome/Chromium extensions (Manifest V3)
- Firefox extensions
- Service workers (background scripts)
- Content scripts
- Popup and options pages

## Implementation Details

- **Language Detection**: Uses `navigator.language` to detect browser language
- **Storage**: Uses `browser.storage.sync` to persist language preference
- **Loading**: Dynamically loads translation files using `fetch()`
- **Fallback**: Always loads English translations as fallback
- **DOM Updates**: Automatically updates elements with `data-i18n` attributes
