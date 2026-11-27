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

export function resolveLanguage(cli, config, locale = process.env.LANG) {
  for (const [source, candidate] of [['cli', cli], ['config', config], ['locale', locale]]) {
    if (candidate === undefined || candidate === null || candidate === '') continue;
    const normalized = supportedLanguage(candidate);
    if (!normalized) throw new Error(`unsupported language from ${source}: ${String(candidate)}`);
    return { language: normalized, source };
  }
  throw new Error('language could not be determined; pass --language de or --language en');
}

export function translate(language, id, values = {}) {
  if (!catalogs[language]) throw new Error(`unsupported language: ${language}`);
  const fallback = language === 'de' ? 'en' : 'de';
  if (!catalogs[language][id] && !catalogs[fallback][id]) {
    throw new Error(`missing message ID in all languages: ${id}`);
  }
  const used = catalogs[language][id] ? language : fallback;
  if (!catalogs[used][id]) throw new Error(`missing message: ${id}`);
  return {
    language: used,
    fallback: used !== language,
    text: Object.entries(values).reduce(
      (message, [key, value]) => message.replaceAll(`{${key}}`, String(value)),
      catalogs[used][id]
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
