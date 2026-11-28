import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const RESOURCE_ROOT = resolve(import.meta.dirname, '../resources');
const catalogs = {
  de: JSON.parse(readFileSync(resolve(RESOURCE_ROOT, 'messages.de.json'), 'utf8')),
  en: JSON.parse(readFileSync(resolve(RESOURCE_ROOT, 'messages.en.json'), 'utf8')),
};

export function supportedLanguage(value) {
  const normalized = String(value ?? '').toLowerCase().split(/[-_]/u)[0];
  return normalized === 'de' || normalized === 'en' ? normalized : null;
}

function localeValue(locale) {
  if (locale && typeof locale === 'object') {
    const candidate = ['LC_ALL', 'LC_MESSAGES', 'LANG', 'LANGUAGE']
      .map((key) => locale[key])
      .find((value) => value !== undefined && value !== null && value !== '');
    if (candidate === undefined) return null;
    return candidate;
  }
  return locale;
}

export function resolveLanguage(cli, config, locale = process.env) {
  for (const [source, candidate] of [
    ['cli', cli],
    ['config', config],
    ['locale', localeValue(locale)],
  ]) {
    if (candidate === undefined || candidate === null || candidate === '') continue;
    const candidates = String(candidate).split(':').filter(Boolean);
    const normalized = candidates.map(supportedLanguage);
    if (normalized.some((value) => value === null)) {
      throw new Error(
        `Unsupported installer language from ${source}: "${String(candidate)}". Pass --language de or --language en.`
      );
    }
    if (new Set(normalized).size > 1) {
      throw new Error(
        `Ambiguous installer language from ${source}: "${String(candidate)}". Pass --language de or --language en.`
      );
    }
    const value = normalized[0];
    if (source !== 'locale' && String(candidate) !== value) {
      throw new Error(
        `Unsupported installer language from ${source}: "${String(candidate)}". Use exactly --language de or --language en.`
      );
    }
    return { language: value, source };
  }
  throw new Error('Installer language could not be determined. Pass --language de or --language en.');
}

export function translate(language, id, values = {}) {
  if (!catalogs[language]) throw new Error(`unsupported language: ${language}`);
  if (!catalogs[language][id]) throw new Error(`missing message for ${language}: ${id}`);
  return {
    language,
    fallback: false,
    text: Object.entries(values).reduce(
      (message, [key, value]) => message.replaceAll(`{${key}}`, String(value)),
      catalogs[language][id]
    ),
  };
}

export function validateMessageCatalogs() {
  const deKeys = Object.keys(catalogs.de).sort();
  const enKeys = Object.keys(catalogs.en).sort();
  if (JSON.stringify(deKeys) !== JSON.stringify(enKeys)) {
    throw new Error('de/en message catalogs do not have identical keys');
  }
  for (const id of deKeys) {
    for (const language of ['de', 'en']) {
      if (!String(catalogs[language][id]).trim()) throw new Error(`${language} message ${id} is empty`);
      const placeholders = [...String(catalogs[language][id]).matchAll(/\{([^}]+)\}/gu)]
        .map((match) => match[1])
        .sort();
      const expected = [
        ...String(catalogs.de[id]).matchAll(/\{([^}]+)\}/gu),
      ].map((match) => match[1]).sort();
      if (JSON.stringify(placeholders) !== JSON.stringify(expected)) {
        throw new Error(`${language} message ${id} has different placeholders`);
      }
    }
  }
}
