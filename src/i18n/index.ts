import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import enCommon from './en/common.json'

// English is the source language. Add a locale by creating src/i18n/<lang>/common.json
// and registering it in `resources` below.
export const resources = {
  en: { common: enCommon },
} as const

void i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  defaultNS: 'common',
  interpolation: { escapeValue: false },
})

export default i18n
