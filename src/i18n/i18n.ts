import i18n from 'i18next';
import type { Module } from 'i18next';
import { initReactI18next } from 'react-i18next';
import {
  capitalizeAll,
  capitalizeFirstChar,
  capitalizeFirstWord,
} from './processors';

type LocaleJson = Record<string, unknown>;
type LocaleModule = { default: LocaleJson };
type LocaleLoader = () => Promise<LocaleModule>;
type LanguageNamespaceLoaders = Record<string, Record<string, LocaleLoader>>;
const FALLBACK_LANGUAGE = 'en';
const DEFAULT_NAMESPACE = 'core';

const modules = import.meta.glob('./locales/**/*.json') as Record<
  string,
  LocaleLoader
>;

const languageNamespaceLoaders: LanguageNamespaceLoaders = {};

// Dynamically detect unique language codes
export const supportedLanguages: string[] = Array.from(
  new Set(
    Object.keys(modules)
      .map((path) => {
        const match = path.match(/\.\/locales\/([^/]+)\//);
        return match ? match[1] : null;
      })
      .filter((lang): lang is string => typeof lang === 'string')
  )
);

for (const path in modules) {
  // Path format: './locales/en/core.json'
  const match = path.match(/\.\/locales\/([^/]+)\/([^/]+)\.json$/);
  if (!match) continue;

  const [, lang, ns] = match;
  languageNamespaceLoaders[lang] = languageNamespaceLoaders[lang] || {};
  languageNamespaceLoaders[lang][ns] = modules[path];
}

const normalizeLanguage = (value: string | null | undefined): string => {
  const normalized = value?.toLowerCase().trim();
  if (!normalized) {
    return FALLBACK_LANGUAGE;
  }

  if (supportedLanguages.includes(normalized)) {
    return normalized;
  }

  const baseLanguage = normalized.split('-')[0];
  if (supportedLanguages.includes(baseLanguage)) {
    return baseLanguage;
  }

  return FALLBACK_LANGUAGE;
};

const loadLanguageResources = async (language: string): Promise<string> => {
  const resolvedLanguage = normalizeLanguage(language);
  const namespaces =
    languageNamespaceLoaders[resolvedLanguage] ??
    languageNamespaceLoaders[FALLBACK_LANGUAGE];

  if (!namespaces) {
    return resolvedLanguage;
  }

  await Promise.all(
    Object.entries(namespaces).map(async ([namespace, loader]) => {
      if (i18n.hasResourceBundle(resolvedLanguage, namespace)) {
        return;
      }

      const module = await loader();
      i18n.addResourceBundle(
        resolvedLanguage,
        namespace,
        module.default,
        true,
        true
      );
    })
  );

  return resolvedLanguage;
};

export const changeLanguageWithResources = async (
  language: string
): Promise<string> => {
  const resolvedLanguage = await loadLanguageResources(language);
  await i18n.changeLanguage(resolvedLanguage);
  return resolvedLanguage;
};

export const i18nReady = (async () => {
  const initialLanguage = await loadLanguageResources(navigator.language);

  await i18n
    .use(initReactI18next)
    .use(capitalizeAll as Module)
    .use(capitalizeFirstChar as Module)
    .use(capitalizeFirstWord as Module)
    .init({
      fallbackLng: FALLBACK_LANGUAGE,
      lng: initialLanguage,
      supportedLngs: supportedLanguages,
      ns: [DEFAULT_NAMESPACE],
      defaultNS: DEFAULT_NAMESPACE,
      interpolation: { escapeValue: false },
      react: { useSuspense: false },
      debug: import.meta.env.MODE === 'development',
    });
})();

export default i18n;
